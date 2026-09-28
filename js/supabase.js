// ============================================================
// STÉPHANE — Supabase Client & Cloud Sync Engine
// ============================================================

const SUPABASE_CONFIG = {
  url: 'https://xfktspcyvfwdyuzewyni.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhma3RzcGN5dmZ3ZHl1emV3eW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODgxOTAsImV4cCI6MjEwNjE2NDE5MH0.R_Z0sobT8A3epxDFkKu8dy8AA0uuvo7BaTHpYYHhBow'
};

// Initialize Supabase client
let sb = null;
if (window.supabase) {
  sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
} else {
  console.warn('Supabase JS library not loaded. Falling back to local offline mode.');
}

const CloudSync = {
  currentUser: null,
  isOnline: false,

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  async signUp(email, password, pseudo) {
    if (!sb) return { ok: false, msg: 'Supabase non initialisé' };
    try {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { pseudo: pseudo }
        }
      });

      if (error) throw error;

      // Check if email confirmation is required
      if (data?.user && !data.session) {
        return {
          ok: true,
          requireEmailConfirm: true,
          msg: 'Compte créé ! Un email de confirmation a été envoyé à ' + email + '. Cliquez sur le lien pour valider votre compte.'
        };
      }

      this.currentUser = data.user;
      return { ok: true, user: data.user, session: data.session };
    } catch (err) {
      console.error('Erreur inscription Supabase:', err);
      return { ok: false, msg: err.message || 'Erreur lors de l’inscription' };
    }
  },

  async signIn(email, password) {
    if (!sb) return { ok: false, msg: 'Supabase non initialisé' };
    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Check if MFA TOTP is required
      const { data: mfaData, error: mfaError } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!mfaError && mfaData?.nextLevel === 'aal2' && mfaData?.currentLevel === 'aal1') {
        return {
          ok: true,
          requireMFA: true,
          userId: data.user.id,
          msg: 'Code de double authentification (2FA) requis'
        };
      }

      this.currentUser = data.user;
      this.isOnline = true;
      return { ok: true, user: data.user, session: data.session };
    } catch (err) {
      console.error('Erreur connexion Supabase:', err);
      return { ok: false, msg: err.message || 'Identifiants incorrects' };
    }
  },

  async signOut() {
    if (sb) {
      try {
        await sb.auth.signOut();
      } catch (e) {
        console.warn('SignOut error', e);
      }
    }
    this.currentUser = null;
    this.isOnline = false;
  },

  async getSession() {
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session) {
        this.currentUser = data.session.user;
        this.isOnline = true;
        return data.session;
      }
    } catch (e) {
      console.warn('Session check failed', e);
    }
    return null;
  },

  // ============================================================
  // DOUBLE AUTHENTIFICATION (MFA / TOTP)
  // ============================================================

  async enrollMFA() {
    if (!sb) return { ok: false, msg: 'Supabase non disponible' };
    try {
      const { data, error } = await sb.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'StephaneRoiDuCendrier'
      });
      if (error) throw error;
      return {
        ok: true,
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri
      };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  },

  async verifyMFAEnrollment(factorId, code) {
    if (!sb) return { ok: false };
    try {
      const { data, error } = await sb.auth.mfa.challengeAndVerify({
        factorId,
        code
      });
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  },

  async verifyMFALogin(factorId, code) {
    if (!sb) return { ok: false };
    try {
      const challenge = await sb.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await sb.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code
      });
      if (verify.error) throw verify.error;

      this.isOnline = true;
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  },

  // ============================================================
  // PROFIL & STATS SYNC
  // ============================================================

  async loadProfile() {
    if (!sb || !this.currentUser) return null;
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error) {
        console.warn('Erreur chargement profil (table existe-t-elle ?):', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.warn('loadProfile error', e);
      return null;
    }
  },

  async saveProfile(state) {
    if (!sb || !this.currentUser) return false;
    try {
      const updateData = {
        money: state.money,
        xp: state.xp,
        level: state.level,
        skill_points: state.skillPoints,
        skills: state.skills,
        stats: {
          totalRaces: state.totalRaces,
          totalWins: state.totalWins,
          totalMoney: state.totalMoney,
          goldStreak: state.goldStreak,
          bestTimes: state.bestTimes
        },
        equipped_slots: state.equippedSlots,
        pity_counters: state.pityCounters,
        free_packs: state.freePacks,
        updated_at: new Date().toISOString()
      };

      const { error } = await sb
        .from('profiles')
        .update(updateData)
        .eq('id', this.currentUser.id);

      if (error) {
        console.warn('Erreur sauvegarde profil cloud:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('saveProfile error', e);
      return false;
    }
  },

  // ============================================================
  // INVENTAIRE
  // ============================================================

  async loadInventory() {
    if (!sb || !this.currentUser) return null;
    try {
      const { data, error } = await sb
        .from('user_inventory')
        .select('*')
        .eq('user_id', this.currentUser.id);

      if (error) {
        console.warn('Erreur chargement inventaire cloud:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.warn('loadInventory error', e);
      return null;
    }
  },

  async saveInventoryItem(cigId, count, equipped, isForSale, salePrice) {
    if (!sb || !this.currentUser) return;
    try {
      await sb.from('user_inventory').upsert({
        user_id: this.currentUser.id,
        cig_id: cigId,
        count: count,
        equipped: equipped,
        is_for_sale: isForSale || false,
        sale_price: salePrice || null
      }, { onConflict: 'user_id,cig_id' });
    } catch (e) {
      console.warn('saveInventoryItem error', e);
    }
  },

  // ============================================================
  // COURSES (Logs & Anti-triche)
  // ============================================================

  async recordRace(raceData) {
    if (!sb || !this.currentUser) return;
    try {
      await sb.from('race_history').insert({
        user_id: this.currentUser.id,
        track: raceData.track,
        race_time: raceData.time,
        medal: raceData.medal,
        coughs: raceData.coughs || 0,
        combos: raceData.combos || {},
        reward_money: raceData.rewardMoney || 0,
        reward_xp: raceData.rewardXp || 0
      });
    } catch (e) {
      console.warn('recordRace cloud log failed', e);
    }
  },

  // ============================================================
  // CLASSEMENTS EN LIGNE
  // ============================================================

  async fetchTopPlayers(limit = 20) {
    if (!sb) return [];
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('pseudo, friend_code, money, level, stats')
        .order('money', { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data.map((p, idx) => ({
        rank: idx + 1,
        pseudo: p.pseudo,
        code: p.friend_code,
        money: p.money,
        level: p.level,
        wins: p.stats?.totalWins || 0
      }));
    } catch (e) {
      return [];
    }
  }
};

window.CloudSync = CloudSync;
