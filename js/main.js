// ============================================================
// STÉPHANE — Main Entry Point & Event Bindings
// ============================================================

let currentMfaFactorId = null;

// ============================================================
// INIT
// ============================================================
async function init() {
  try {
    // Clean URL
    if (window.location.pathname.endsWith('index.html')) {
      window.history.replaceState(null, '', window.location.pathname.replace(/index\.html$/, ''));
    }
    await Account.boot();   // session → profil → sauvegarde en ligne → startGame()
  } catch (err) {
    console.error('Erreur init():', err);
    showAuthScreen();
    showAuthMsg('Impossible de joindre le serveur du jeu : ' + (err.message || 'erreur inconnue'), 'error');
  }
}

// Lancé par Account une fois le joueur connecté et sa sauvegarde en place
function startGame() {
  loadGame();
  GameState.isLoggedIn = true;
  const prof = Account.profile;
  if (prof) {
    GameState.pseudo = prof.pseudo || GameState.pseudo;
    GameState.friendCode = prof.friend_code || GameState.friendCode;
  }
  GameState.email = (Account.user && Account.user.email) || GameState.email || '';
  if (!GameState.pseudo) GameState.pseudo = 'Joueur';
  if (GameState.freePacks === undefined || GameState.freePacks === null) GameState.freePacks = 5;
  GameState.freePacks = Math.min(10, Math.max(0, GameState.freePacks));

  // Cartes de départ de l'ancien mode course si l'inventaire est vide
  if (Object.keys(GameState.inventory).length === 0) {
    const starters = ['marlboro-rouge', 'camel-filtre', 'gauloises-bleues', 'clope-bite-phallus', 'megot-86-tiède', 'gitanes-papier-mais'];
    starters.forEach(id => {
      const c = getCigaretteById(id);
      if (c) addCigarette(c);
    });
    GameState.equippedSlots[0] = 'marlboro-rouge';
    GameState.equippedSlots[1] = 'camel-filtre';
    GameState.equippedSlots[2] = 'gauloises-bleues';
  }

  checkDailyReset();
  updateFreePacks();
  showGameUI();
}

// ============================================================
// AGE GATE
// ============================================================
function showAgeGate() {
  document.getElementById('age-gate').classList.remove('hidden');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('game-ui').classList.add('hidden');
}

document.getElementById('btn-age-ok').addEventListener('click', () => {
  localStorage.setItem('stephane_age_ok', '1');
  document.getElementById('age-gate').classList.add('hidden');
  showAuthScreen();
});

document.getElementById('btn-age-no').addEventListener('click', () => {
  document.getElementById('age-gate').innerHTML = `
    <div class="age-gate-box" style="text-align:center">
      <h2 style="font-family:var(--font-title);color:var(--red);margin:16px 0;font-size:2rem">Accès Strictement Réservé 18+</h2>
      <p style="color:var(--text-muted)">Ce jeu est réservé aux personnes majeures.</p>
    </div>`;
});

// ============================================================
// AUTH
// ============================================================
function showAuthScreen() {
  document.getElementById('age-gate').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('game-ui').classList.add('hidden');
}

function showAuthMsg(msg, type = 'info') {
  const box = document.getElementById('auth-status-msg');
  box.className = `auth-msg-box ${type}`;
  box.textContent = msg;
  box.classList.remove('hidden');
}

function clearAuthMsg() {
  const box = document.getElementById('auth-status-msg');
  box.textContent = '';
  box.classList.add('hidden');
}

document.getElementById('link-to-login').addEventListener('click', (e) => {
  e.preventDefault();
  clearAuthMsg();
  document.getElementById('auth-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('mfa-form')?.classList.add('hidden');
  document.getElementById('auth-title').textContent = 'Se connecter';
});

document.getElementById('link-to-register').addEventListener('click', (e) => {
  e.preventDefault();
  clearAuthMsg();
  document.getElementById('auth-form').classList.remove('hidden');
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('mfa-form')?.classList.add('hidden');
  document.getElementById('auth-title').textContent = 'Créer un compte';
});

// Inscription
document.getElementById('btn-register').addEventListener('click', async () => {
  clearAuthMsg();
  const pseudo = document.getElementById('auth-pseudo').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if (!pseudo || pseudo.length < 2) { showToast('Pseudo trop court (min 2 caractères)', 'error'); return; }
  if (pseudo.length > 20 || !/^[\p{L}\p{N} _.\-']+$/u.test(pseudo)) { showToast('Pseudo : 20 caractères max, lettres, chiffres, espaces et - _ . \' uniquement', 'error'); return; }
  if (!email || !email.includes('@')) { showToast('Email invalide', 'error'); return; }
  if (!document.getElementById('auth-accept')?.checked) { showToast('Coche la case : 18 ans ou plus et acceptation des conditions', 'error'); return; }
  if (!password || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) { showToast('Mot de passe : 8 caractères minimum avec une minuscule, une majuscule et un chiffre', 'error'); return; }

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.textContent = 'Création en cours...';

  try {
    // Pseudo déjà pris ?
    const { data: free } = await window.sb.rpc('pseudo_available', { p_pseudo: pseudo });
    if (free === false) {
      const m = 'Ce pseudo est déjà pris, choisis-en un autre.';
      showToast(m, 'error'); showAuthMsg(m, 'error');
      btn.disabled = false; btn.textContent = 'Créer mon compte';
      return;
    }
    const res = await CloudSync.signUp(email, password, pseudo);
    if (!res.ok) {
      showToast(res.msg, 'error');
      showAuthMsg(res.msg, 'error');
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';
      return;
    }

    if (res.requireEmailConfirm) {
      showAuthMsg(res.msg, 'success');
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';
      return;
    }

    // Compte créé et connecté
    showToast(`Bienvenue ${pseudo} !`, 'success');
    await Account.onSignedIn(res.user);
  } catch (err) {
    showToast(err.message || 'Erreur inattendue', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer mon compte';
  }
});

// Connexion
document.getElementById('btn-login').addEventListener('click', async () => {
  clearAuthMsg();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) { showToast('Remplissez tous les champs', 'error'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Connexion...';

  try {
    const res = await CloudSync.signIn(email, password);
    if (!res.ok) {
      // Traduction des erreurs Supabase courantes
      let msg = res.msg || 'Identifiants incorrects';
      if (msg.toLowerCase().includes('email not confirmed')) {
        msg = 'Email non confirmé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation.';
      } else if (msg.toLowerCase().includes('user already registered')) {
        msg = 'Un compte existe déjà avec cet e-mail : connecte-toi.';
      } else if (msg.toLowerCase().includes('invalid login')) {
        msg = 'Email ou mot de passe incorrect.';
      } else if (msg.toLowerCase().includes('too many requests')) {
        msg = 'Trop de tentatives. Attendez quelques minutes.';
      }
      showToast(msg, 'error');
      showAuthMsg(msg, 'error');
      btn.disabled = false;
      btn.textContent = 'Connexion';
      return;
    }

    // Check if MFA is required
    if (res.requireMFA) {
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('mfa-form').classList.remove('hidden');
      document.getElementById('auth-title').textContent = 'Validation 2FA';
      btn.disabled = false;
      btn.textContent = 'Connexion';
      return;
    }

    showToast('Connexion réussie !', 'success');
    await Account.onSignedIn(res.user);
  } catch (err) {
    console.error('Erreur login :', err);
    showToast(err.message || 'Erreur inattendue', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connexion';
  }
});

// MFA Verification submit
document.getElementById('btn-verify-mfa')?.addEventListener('click', async () => {
  const code = document.getElementById('mfa-code').value.trim();
  if (code.length !== 6) { showToast('Entrez un code valide à 6 chiffres', 'error'); return; }

  const factors = await sb.auth.mfa.listFactors();
  const totpFactor = factors?.data?.totp?.[0];
  if (!totpFactor) { showToast('Facteur 2FA introuvable', 'error'); return; }

  const res = await CloudSync.verifyMFALogin(totpFactor.id, code);
  if (!res.ok) {
    showToast('Code 2FA invalide', 'error');
    return;
  }

  const { data: sess } = await sb.auth.getSession();
  if (sess && sess.session) await Account.onSignedIn(sess.session.user);
});

document.getElementById('btn-cancel-mfa')?.addEventListener('click', () => {
  document.getElementById('mfa-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('auth-title').textContent = 'Se connecter';
});

// Mot de passe oublié
document.getElementById('link-forgot-pw')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = ((await GameDialog.prompt('Entre ton adresse e-mail : on t\'envoie un lien pour choisir un nouveau mot de passe.', { title: 'Mot de passe oublié', ok: 'Envoyer', input: { type: 'email', placeholder: 'Ton adresse e-mail' } })) || '').trim();
  if (!email || !email.includes('@')) return;

  if (window.sb) {
    const captchaToken = Captcha.take('login');
    if (captchaToken === null) { showToast('Vérification anti-robot en cours : patiente une seconde puis réessaie.', 'info'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { captchaToken, redirectTo: location.origin + '/' });
    Captcha.reset('login');
    if (error) showToast(/rate|seconds/i.test(error.message) ? 'Trop de demandes. Réessaie dans quelques minutes.' : error.message, 'error');
    else showToast('Si ce compte existe, un e-mail de réinitialisation vient de partir.', 'success');
  } else {
    showToast('Service disponible une fois connecté à Supabase', 'info');
  }
});

// Enter key on inputs
['auth-email', 'auth-password', 'auth-pseudo'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-register').click();
  });
});
['login-email', 'login-password'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
});
document.getElementById('mfa-code')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-verify-mfa').click();
});

// ============================================================
// SHOW GAME
// ============================================================
function showGameUI() {
  document.getElementById('age-gate').classList.add('hidden');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('game-ui').classList.remove('hidden');

  if (typeof PlayerProfile !== 'undefined') PlayerProfile.renderTopBar();
  if (typeof initAllIcons === 'function') initAllIcons();
  if (typeof initAudioButton === 'function') initAudioButton();
  updateHUD();
  startFreePackTimer();
  if (typeof TalentsEngine !== 'undefined' && TalentsEngine.init) TalentsEngine.init();
  if (typeof Casino !== 'undefined' && Casino.init) Casino.init();
  showPage('clicker');

  // Kick off background timers
  setInterval(() => {
    updateFreePacks();
    if (currentPage === 'paquets') renderFreePackBanner();
    if (currentPage === 'bourse') Bourse.renderPredictions();
  }, 10000);

  if (window.Social) Social.start();
  showToast(`Bienvenue, ${GameState.pseudo} !`, 'gold');
}

// ============================================================
// NAVIGATION
// ============================================================
document.querySelectorAll('.nav-btn, .home-menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (!page) return;
    showPage(page);
  });
});

document.getElementById('btn-profile-top')?.addEventListener('click', () => {
  // Le bouton du joueur (photo + pseudo) ouvre son profil
  showPage('profil');
});

// ============================================================
// COURSE PAGE & HOME
// ============================================================
document.querySelectorAll('.track-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    GameState.selectedTrack = card.dataset.track;
    saveGame();
    
    // Mettre à jour le texte du bouton de sélection
    const trackName = card.querySelector('.track-name')?.textContent || 'Piste';
    const btnSelect = document.getElementById('btn-track-select');
    if (btnSelect) btnSelect.innerHTML = `📍 ${trackName}`;
    
    // Fermer le modal
    document.getElementById('track-overlay')?.classList.add('hidden');
  });
});

document.getElementById('btn-track-select')?.addEventListener('click', () => {
  document.getElementById('track-overlay')?.classList.remove('hidden');
});
document.getElementById('track-close')?.addEventListener('click', () => {
  document.getElementById('track-overlay')?.classList.add('hidden');
});

document.getElementById('btn-start-solo')?.addEventListener('click', () => {
  const track = GameState.selectedTrack || 'trottoir';
  const trackData = TRACKS[track];
  if (!trackData) return;

  // Check equipped cigs
  const equipped = getEquippedCigs();
  if (equipped.length === 0) {
    openModal(`
      <div style="text-align:center;padding:16px">
        <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--accent);margin-bottom:12px">Aucune cigarette équipée !</h3>
        <p style="color:var(--text-muted);margin-bottom:16px">Stéphane court plus vite avec des cigarettes.<br>Vous pouvez quand même courir sans boost.</p>
        <div style="display:flex;gap:12px;justify-content:center">
          <button id="modal-run-anyway" class="btn-primary">Courir sans boost</button>
          <button id="modal-equip-first" class="btn-secondary">Équiper d'abord</button>
        </div>
      </div>
    `);
    document.getElementById('modal-run-anyway')?.addEventListener('click', () => {
      closeModal();
      RaceEngine.start(track);
    });
    document.getElementById('modal-equip-first')?.addEventListener('click', closeModal);
    return;
  }

  RaceEngine.start(track);
});

// ============================================================
// RACE CONTROLS
// ============================================================
document.getElementById('btn-fumer')?.addEventListener('click', () => RaceEngine.smoke());
document.getElementById('btn-fumer')?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  RaceEngine.smoke();
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && RaceEngine.active) {
    e.preventDefault();
    RaceEngine.smoke();
  }
});

document.getElementById('btn-abandon')?.addEventListener('click', async () => {
  if (await GameDialog.confirm('Tu perds la course en cours.', { title: 'Abandonner ?', ok: 'Abandonner', danger: true })) {
    if (RaceEngine.pvp && window.Online) { Online.abandonRace(); return; }
    const ranked = !!RaceEngine.leagueMode;
    RaceEngine.stop();
    if (ranked && typeof CourseClandestine !== 'undefined') CourseClandestine.onAbandon();
    else showPage('course');
  }
});

document.getElementById('btn-result-ok')?.addEventListener('click', () => {
  showPage('course');
  renderCoursePageFull();
});

// ============================================================
// PAQUETS PAGE
// ============================================================
document.getElementById('btn-open-free')?.addEventListener('click', () => {
  PackSystem.openPack('tabac', true);
});

document.querySelectorAll('.btn-buy-pack').forEach(btn => {
  btn.addEventListener('click', () => {
    const packType = btn.dataset.pack;
    PackSystem.openPack(packType, false);
  });
});

document.getElementById('pack-3d-wrap')?.addEventListener('click', () => {
  // Handled dynamically in PackSystem.startOpeningAnimation
});

document.getElementById('btn-pack-done')?.addEventListener('click', () => {
  PackSystem.closePack();
  showPage('inventaire');
});

// ============================================================
// INVENTAIRE PAGE
// ============================================================
document.getElementById('inv-sort')?.addEventListener('change', renderInventory);
document.getElementById('inv-filter')?.addEventListener('change', renderInventory);

document.getElementById('btn-recycle')?.addEventListener('click', () => {
  const panel = document.getElementById('recycle-panel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (isHidden) renderRecyclePanel();
});

function renderRecyclePanel() {
  const counts = getRecyclableCounts();
  const el = document.getElementById('recycle-options');
  if (!el) return;
  el.innerHTML = RECYCLE_RULES.map(rule => {
    const available = counts[rule.from] || 0;
    const canRecycle = available >= rule.cost;
    return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:10px;background:var(--bg-surface);border-radius:var(--r-sm)">
      <span style="flex:1;font-size:0.85rem"><strong style="color:${RARITIES[rule.from]?.color}">${RARITIES[rule.from]?.name}</strong> (${available}) → <strong style="color:${RARITIES[rule.to]?.color}">${RARITIES[rule.to]?.name}</strong> — Coût : ${rule.cost}</span>
      <button class="btn-primary btn-sm" ${canRecycle ? '' : 'disabled'} data-from="${rule.from}">Recycler</button>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-from]').forEach(btn => {
    btn.addEventListener('click', () => {
      recycle(btn.dataset.from);
      renderInventory();
      renderRecyclePanel();
    });
  });
}

// ============================================================
// MARCHÉ PAGE
// ============================================================
document.querySelectorAll('.market-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Market.currentTab = tab.dataset.mtab;
    Market.renderMarket();
  });
});

// ============================================================
// BOURSE PAGE
// ============================================================
document.getElementById('bourse-search')?.addEventListener('input', (e) => {
  Bourse.filter = e.target.value;
  Bourse.render();
});

document.getElementById('pd-hausse')?.addEventListener('click', () => {
  document.getElementById('pd-hausse').classList.add('active');
  document.getElementById('pd-baisse').classList.remove('active');
});
document.getElementById('pd-baisse')?.addEventListener('click', () => {
  document.getElementById('pd-baisse').classList.add('active');
  document.getElementById('pd-hausse').classList.remove('active');
});

document.getElementById('btn-pred-add')?.addEventListener('click', () => {
  const cigId = document.getElementById('pred-cig')?.value;
  const direction = document.getElementById('pd-hausse').classList.contains('active') ? 'hausse' : 'baisse';
  const mise = parseInt(document.getElementById('pred-mise')?.value);
  Bourse.addPrediction(cigId, direction, mise);
});

// ============================================================
// CASINO PAGE
// ============================================================
document.querySelectorAll('.cas-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.cas-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Casino.currentTab = tab.dataset.ctab;
    Casino.render();
  });
});

// ============================================================
// AMIS PAGE
// ============================================================


// ============================================================
// CLASSEMENTS PAGE
// ============================================================
document.querySelectorAll('.lb-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    Leaderboard.currentTab = tab.dataset.lbtab;
    Leaderboard.render();
  });
});

document.querySelectorAll('.scope-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Leaderboard.currentScope = btn.dataset.scope;
    Leaderboard.render();
  });
});

// ============================================================
// MODAL
// ============================================================
document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ============================================================
// PROFILE & SECURITY (2FA)
// ============================================================
document.getElementById('btn-logout')?.addEventListener('click', async () => {
  if (await GameDialog.confirm('Ta progression est sauvegardée en ligne : tu la retrouveras en te reconnectant.', { title: 'Se déconnecter ?', ok: 'Déconnexion' })) {
    await Account.signOut();
  }
});

document.getElementById('btn-toggle-2fa')?.addEventListener('click', async () => {
  if (!window.CloudSync || !CloudSync.currentUser) {
    showToast('Vous devez être connecté avec un compte réel pour activer la 2FA', 'info');
    return;
  }

  const btn = document.getElementById('btn-toggle-2fa');
  btn.disabled = true;
  btn.textContent = 'Génération QR Code...';

  const res = await CloudSync.enrollMFA();
  btn.disabled = false;
  btn.textContent = 'Activer 2FA';

  if (!res.ok) {
    showToast(res.msg || 'Erreur lors de l’activation 2FA', 'error');
    return;
  }

  openModal(`
    <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--accent);margin-bottom:12px">Activer la Double Authentification</h3>
    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">
      1. Ouvrez <strong>Google Authenticator</strong> (ou toute appli TOTP) sur votre téléphone.<br>
      2. Scannez le code QR ci-dessous, ou saisissez manuellement la clé secrète.<br>
      3. Entrez le code à 6 chiffres affiché par l'application pour valider.
    </p>
    <div style="background:#fff;padding:12px;border-radius:var(--r-md);display:inline-block;margin:0 auto 16px auto;text-align:center">
      ${res.qrCode ? `<img src="${res.qrCode}" alt="QR Code 2FA" style="width:180px;height:180px;display:block;margin:0 auto" />` : ''}
    </div>
    <div style="background:var(--bg-surface);padding:8px 12px;border-radius:var(--r-sm);font-family:monospace;font-size:0.8rem;word-break:break-all;margin-bottom:16px;text-align:center">
      Clé secrète : <strong>${res.secret}</strong>
    </div>
    <div style="display:flex;gap:8px">
      <input type="text" id="modal-totp-verify-code" class="game-input text-center" placeholder="123456" maxlength="6" />
      <button id="btn-submit-mfa-verify" class="btn-primary">Valider</button>
    </div>
  `);

  document.getElementById('btn-submit-mfa-verify')?.addEventListener('click', async () => {
    const code = document.getElementById('modal-totp-verify-code').value.trim();
    if (code.length !== 6) { showToast('Entrez un code à 6 chiffres', 'error'); return; }

    const verifyRes = await CloudSync.verifyMFAEnrollment(res.factorId, code);
    if (verifyRes.ok) {
      showToast('2FA activée avec succès ! Compte sécurisé.', 'success');
      closeModal();
      btn.textContent = '2FA Activé';
      btn.disabled = true;
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
    } else {
      showToast('Code invalide, réessayez', 'error');
    }
  });
});

// Réglages : une vraie page (le profil est un autre écran)
let pageBeforeSettings = 'clicker';
document.getElementById('btn-settings')?.addEventListener('click', () => {
  const cur = (document.querySelector('.page.active')?.id || 'page-clicker').replace('page-', '');
  if (cur !== 'reglages') pageBeforeSettings = cur;
  showPage('reglages');
});
document.getElementById('set-back')?.addEventListener('click', () => showPage(pageBeforeSettings));
function renderSettings() {
  const mail = document.getElementById('set-email');
  const u = window.Account && Account.user;
  if (mail) mail.textContent = u && u.email ? 'Connecté avec ' + u.email : 'Connecté';
  if (window.sb && u) window.sb.rpc('am_i_admin').then(({ data }) => document.getElementById('set-admin')?.classList.toggle('hidden', !data)).catch(() => {});
  const a = document.getElementById('set-audio');
  if (a) a.textContent = (window.SoundFX && SoundFX.enabled) ? 'Activé' : 'Coupé';
}
document.getElementById('set-audio')?.addEventListener('click', () => {
  if (window.SoundFX) SoundFX.toggle();
  document.getElementById('icon-audio').textContent = SoundFX.enabled ? '🔊' : '🔇';
  renderSettings();
});
document.getElementById('btn-reset-save-full')?.addEventListener('click', async () => {
  if (await GameDialog.confirm('Toute ta progression sera effacée. C\'est définitif.', { title: 'Recommencer à zéro ?', ok: 'Tout effacer', danger: true })) window.resetEntireGame(true);
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
  if (currentPage === 'race' && RaceEngine.active) {
    if (e.code === 'Space' || e.code === 'KeyF') {
      e.preventDefault();
      RaceEngine.smoke();
    }
  }
  if (e.key === 'Escape') closeModal();
});

// ============================================================
// CHECK AGE GATE SKIP
// ============================================================
if (localStorage.getItem('stephane_age_ok') === '1') {
  // Already verified age before, but still need login
}

// ============================================================
// START
// ============================================================
init();

// Écran de chargement : visible au moins 1,2 s, puis fondu
(function hideSplash() {
  const splash = document.getElementById('splash-screen');
  if (!splash) return;
  const started = performance.now();
  const done = () => setTimeout(() => {
    splash.classList.add('is-hidden');
    setTimeout(() => splash.remove(), 600);
  }, Math.max(0, 1200 - (performance.now() - started)));
  if (document.readyState === 'complete') done();
  else window.addEventListener('load', done, { once: true });
})();

// Lien « mot de passe oublié » cliqué dans l'e-mail : on demande le nouveau mot de passe
if (window.sb) {
  sb.auth.onAuthStateChange((ev) => {
    if (ev !== 'PASSWORD_RECOVERY') return;
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'soc-modal';
      el.innerHTML = `<div class="soc-modal-card"><h3>Nouveau mot de passe</h3>
        <input type="password" id="np-pass" class="game-input" placeholder="8 car. : maj, min, chiffre" autocomplete="new-password" />
        <p class="soc-msg is-error hidden" id="np-msg"></p>
        <button class="btn-empire btn-empire-primary soc-wide" id="np-ok">Enregistrer</button></div>`;
      document.body.appendChild(el);
      el.querySelector('#np-ok').addEventListener('click', async () => {
        const pw = el.querySelector('#np-pass').value;
        const msg = el.querySelector('#np-msg');
        if (pw.length < 8 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) { msg.textContent = 'Il faut 8 caractères minimum avec une minuscule, une majuscule et un chiffre.'; msg.classList.remove('hidden'); return; }
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) { msg.textContent = /same|different/i.test(error.message) ? 'Choisis un mot de passe différent de l\'ancien.' : error.message; msg.classList.remove('hidden'); return; }
        el.remove();
        showToast('Mot de passe changé.', 'success');
      });
    }, 1200);
  });
}
