// ============================================================
// THE ASHTRAY KING — Compte joueur et sauvegarde en ligne
//
// • Au démarrage : session Supabase → profil → sauvegarde en ligne → jeu.
// • La progression (collection, argent, talents, trophées…) est un instantané des clés
//   localStorage du jeu, envoyé au serveur 20 s après un changement (et quand on quitte l'onglet).
// • Conflit entre deux appareils : le serveur refuse l'écrasement et le joueur choisit.
// • Un navigateur ne mélange jamais deux comptes : les données locales portent l'identifiant
//   de leur propriétaire (ak_owner).
// Les rangs, classements et parties entre joueurs ne passent PAS par ici : le serveur seul les modifie.
// ============================================================

const Account = (() => {
  // Données du jeu stockées dans le navigateur et copiées dans la sauvegarde en ligne
  const KEYS = [
    'stephane_v1', 'empire_state', 'empire_clicker', 'empire_free_packs_count', 'empire_next_free_pack_time',
    'empire_last_free_pack', 'ashtray_talents_gow', 'ashtray_talents', 'league_v1', 'prestige_v1', 'ut_squad_v1',
    'casino_last_result', 'casino_bank_advance_at', 'ashtray_pvp_deck', 'ashtray_audio_enabled',
  ];
  const PREFIXES = ['rules_seen_'];
  const OWNER = 'ak_owner', STAMP = 'ak_stamp', DIRTY = 'ak_dirty';
  const PUSH_DELAY = 20000;

  let user = null;
  let profile = null;
  let stamp = null;          // date de la dernière version connue côté serveur
  let timer = null;
  let pushing = false;
  let live = false;          // true une fois connecté : les changements locaux déclenchent l'envoi
  let applying = false;      // true pendant le remplacement des données locales (aucun envoi)
  const rawSet = Storage.prototype.setItem;
  const rawRemove = Storage.prototype.removeItem;

  const isGameKey = k => KEYS.includes(k) || PREFIXES.some(p => k.startsWith(p));
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { rawSet.call(localStorage, k, v); } catch (e) {} },
    del: k => { try { rawRemove.call(localStorage, k); } catch (e) {} },
  };

  function gameKeysPresent() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isGameKey(k)) out.push(k);
    }
    return out;
  }
  function snapshot() {
    const data = {};
    gameKeysPresent().forEach(k => { data[k] = ls.get(k); });
    return data;
  }
  function clearGameData() { gameKeysPresent().forEach(ls.del); }
  function applySnapshot(data) {
    applying = true;
    clearGameData();
    Object.entries(data || {}).forEach(([k, v]) => { if (isGameKey(k) && typeof v === 'string') ls.set(k, v); });
  }

  // Tout changement d'une clé du jeu → envoi différé
  function hook() {
    Storage.prototype.setItem = function (k, v) {
      rawSet.call(this, k, v);
      if (this === localStorage && live && !applying && isGameKey(k)) markDirty();
    };
    Storage.prototype.removeItem = function (k) {
      rawRemove.call(this, k);
      if (this === localStorage && live && !applying && isGameKey(k)) markDirty();
    };
  }
  function markDirty() {
    ls.set(DIRTY, '1');
    if (!timer) timer = setTimeout(() => { timer = null; push(); }, PUSH_DELAY);
  }

  function client() { return window.sb || null; }
  function deviceName() {
    const ua = navigator.userAgent;
    return /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Navigateur';
  }

  // ── Envoi ──────────────────────────────────────────────────
  async function push(force = false) {
    const sb = client();
    if (!sb || !user || pushing || applying) return;
    pushing = true;
    try {
      const { data, error } = await sb.rpc('cloud_save_put', { p_data: snapshot(), p_base: stamp, p_device: deviceName(), p_force: force });
      if (error) throw error;
      if (data && data.conflict) {
        await resolveConflict();
      } else if (data && data.ok) {
        stamp = data.updated_at;
        ls.set(STAMP, stamp);
        ls.del(DIRTY);
        setStatus('ok');
      }
    } catch (e) {
      console.warn('[Account] envoi impossible :', e.message || e);
      setStatus('offline');
      if (!timer) timer = setTimeout(() => { timer = null; push(); }, 60000);
    } finally {
      pushing = false;
    }
  }

  async function pull() {
    const sb = client();
    const { data, error } = await sb.from('cloud_saves').select('data, updated_at').maybeSingle();
    if (error) throw error;
    return data;
  }

  // Renvoie true si la page va se recharger avec la version en ligne
  async function resolveConflict() {
    const loadOnline = confirm('Ta progression a été modifiée sur un autre appareil.\n\nOK : charger la version en ligne (les changements faits ici seront perdus).\nAnnuler : garder cet appareil et écraser la version en ligne.');
    if (loadOnline) {
      const save = await pull();
      if (save) {
        applySnapshot(save.data);
        ls.set(OWNER, user.id); ls.set(STAMP, save.updated_at); ls.del(DIRTY);
        location.reload();
        return true;
      }
      return false;
    }
    pushing = false;
    await push(true);
    return false;
  }

  // ── Démarrage ──────────────────────────────────────────────
  async function boot() {
    hook();
    const sb = client();
    if (!sb) {
      showAuth();
      showAuthMsg('Impossible de joindre le serveur du jeu. Vérifie ta connexion internet puis recharge la page.', 'error');
      return;
    }
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      try {
        await onSignedIn(data.session.user);
        return;
      } catch (e) {
        console.warn('[Account] reprise de session impossible :', e.message || e);
      }
    }
    if (ls.get('stephane_age_ok') === '1') showAuth(); else showAgeGate();
  }

  function showAuth() { if (typeof showAuthScreen === 'function') showAuthScreen(); }
  function showAuthMsg(m, t) { if (typeof window.showAuthMsg === 'function') window.showAuthMsg(m, t); }

  // Appelé après chaque connexion réussie (connexion, inscription, reprise de session)
  async function onSignedIn(u) {
    const sb = client();
    user = u;
    if (window.CloudSync) { CloudSync.currentUser = u; CloudSync.isOnline = true; }

    const { data: prof, error: perr } = await sb.from('profiles').select('id, pseudo, friend_code, avatar, avatar_small, summary, level').eq('id', u.id).maybeSingle();
    if (perr) throw perr;
    profile = prof || { id: u.id, pseudo: (u.user_metadata && u.user_metadata.pseudo) || (u.email || 'Joueur').split('@')[0] };

    const owner = ls.get(OWNER);
    const localStamp = ls.get(STAMP);
    const dirty = ls.get(DIRTY) === '1';
    const hasLocal = gameKeysPresent().some(k => k === 'empire_state' || k === 'empire_clicker');
    const cloud = await pull();

    if (cloud) {
      const sameOwner = owner === u.id;
      if (sameOwner && localStamp === cloud.updated_at) {
        stamp = cloud.updated_at;                         // déjà à jour
      } else if (sameOwner && dirty && hasLocal) {
        // Changements locaux non envoyés ET version plus récente en ligne : le joueur choisit
        stamp = localStamp;
        live = true;
        if (await resolveConflict()) return;
      } else if (sessionStorage.getItem('ak_reloaded') === u.id + cloud.updated_at) {
        stamp = cloud.updated_at;                         // sécurité anti-boucle de rechargement
      } else {
        // Autre compte sur ce navigateur, première connexion ici, ou rien à perdre : la version en ligne gagne
        applySnapshot(cloud.data);
        ls.set(OWNER, u.id); ls.set(STAMP, cloud.updated_at); ls.del(DIRTY);
        sessionStorage.setItem('ak_reloaded', u.id + cloud.updated_at);
        location.reload();
        return;
      }
    } else {
      // Aucune sauvegarde en ligne : si les données de ce navigateur sont à ce joueur (ou à personne), on les envoie
      if (owner && owner !== u.id) clearGameData();
      stamp = null;
      ls.set(OWNER, u.id);
      live = true;
      await push();
    }
    ls.set(OWNER, u.id);
    live = true;
    applying = false;

    // Photo de profil : celle du serveur, ou on envoie celle de ce navigateur
    if (typeof PlayerProfile !== 'undefined') await PlayerProfile.syncWithProfile(profile);
    if (typeof League !== 'undefined' && League.syncFromServer) await League.syncFromServer();

    document.addEventListener('visibilitychange', () => { if (document.hidden && ls.get(DIRTY) === '1') push(); });
    window.addEventListener('pagehide', () => { if (ls.get(DIRTY) === '1') push(); });
    window.addEventListener('online', () => { if (ls.get(DIRTY) === '1') push(); });

    if (typeof startGame === 'function') startGame();
  }

  async function signOut() {
    clearTimeout(timer); timer = null;
    if (user && ls.get(DIRTY) === '1') await push();
    live = false;
    clearGameData();
    ls.del(OWNER); ls.del(STAMP); ls.del(DIRTY); ls.del('player_avatar'); ls.del('player_avatar_small');
    if (window.CloudSync) await CloudSync.signOut();
    user = null; profile = null; stamp = null;
    location.reload();
  }

  function setStatus(s) {
    const el = document.getElementById('top-sync');
    if (!el) return;
    el.dataset.state = s;
    el.title = s === 'ok' ? 'Progression sauvegardée en ligne' : s === 'offline' ? 'Sauvegarde en ligne impossible pour le moment : on réessaie' : 'Sauvegarde…';
  }

  return {
    boot, onSignedIn, signOut, push,
    get user() { return user; },
    get profile() { return profile; },
    setProfile(p) { profile = { ...(profile || {}), ...p }; },
    get live() { return live; },
  };
})();

if (typeof window !== 'undefined') window.Account = Account;
