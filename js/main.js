// ============================================================
// STÉPHANE — Main Entry Point & Event Bindings
// ============================================================

let currentMfaFactorId = null;

// ============================================================
// INIT
// ============================================================
async function init() {
  // Clean URL
  if (window.location.pathname.endsWith('index.html')) {
    window.history.replaceState(null, '', window.location.pathname.replace(/index\.html$/, ''));
  }

  // Check cloud session first if Supabase is available
  if (window.CloudSync) {
    const session = await CloudSync.getSession();
    if (session) {
      const profile = await CloudSync.loadProfile();
      const inventory = await CloudSync.loadInventory();
      if (profile) {
        syncFromCloudProfile(profile, inventory);
        checkDailyReset();
        updateFreePacks();
        showGameUI();
        return;
      }
    }
  }

  // Fallback to local save
  const loggedIn = loadGame();
  checkDailyReset();
  updateFreePacks();

  if (loggedIn && GameState.isLoggedIn) {
    showGameUI();
  } else {
    showAgeGate();
  }
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
      <div style="font-size:3rem">🚫</div>
      <h2 style="font-family:var(--font-title);color:var(--red);margin:16px 0">Accès interdit</h2>
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
  if (!email || !email.includes('@')) { showToast('Email invalide', 'error'); return; }
  if (!password || password.length < 6) { showToast('Mot de passe de 6 caractères minimum requis', 'error'); return; }

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.textContent = 'Création en cours...';

  try {
    if (window.CloudSync && window.sb) {
      const res = await CloudSync.signUp(email, password, pseudo);
      if (!res.ok) {
        showToast(res.msg, 'error');
        btn.disabled = false;
        btn.textContent = '🎮 Créer mon compte';
        return;
      }

      if (res.requireEmailConfirm) {
        showAuthMsg(res.msg, 'success');
        btn.disabled = false;
        btn.textContent = '🎮 Créer mon compte';
        return;
      }
    }

    // Local fallback / direct login
    registerUser(pseudo, email, password);
    showGameUI();
  } catch (err) {
    showToast(err.message || 'Erreur inattendue', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🎮 Créer mon compte';
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
    if (window.CloudSync && window.sb) {
      const res = await CloudSync.signIn(email, password);
      if (!res.ok) {
        showToast(res.msg, 'error');
        btn.disabled = false;
        btn.textContent = '🔑 Connexion';
        return;
      }

      // Check if MFA is required
      if (res.requireMFA) {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('mfa-form').classList.remove('hidden');
        document.getElementById('auth-title').textContent = 'Validation 2FA';
        btn.disabled = false;
        btn.textContent = '🔑 Connexion';
        return;
      }

      // Sync Cloud profile
      const profile = await CloudSync.loadProfile();
      const inventory = await CloudSync.loadInventory();
      if (profile) {
        syncFromCloudProfile(profile, inventory);
      } else {
        loginUser(email, password);
      }
      showGameUI();
      return;
    }

    // Local fallback
    const result = loginUser(email, password);
    if (!result.ok) { showToast(result.msg, 'error'); return; }
    showGameUI();
  } catch (err) {
    showToast(err.message || 'Erreur', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔑 Connexion';
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

  const profile = await CloudSync.loadProfile();
  const inventory = await CloudSync.loadInventory();
  if (profile) syncFromCloudProfile(profile, inventory);
  showGameUI();
});

document.getElementById('btn-cancel-mfa')?.addEventListener('click', () => {
  document.getElementById('mfa-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('auth-title').textContent = 'Se connecter';
});

// Mot de passe oublié
document.getElementById('link-forgot-pw')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = prompt('Entrez votre adresse email pour recevoir un lien de réinitialisation :');
  if (!email || !email.includes('@')) return;

  if (window.sb) {
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) showToast(error.message, 'error');
    else showToast('Email de réinitialisation envoyé !', 'success');
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

  updateHUD();
  startFreePackTimer();
  showPage('course');

  // Kick off background timers
  setInterval(() => {
    updateFreePacks();
    if (currentPage === 'paquets') renderFreePackBanner();
    if (currentPage === 'bourse') Bourse.renderPredictions();
  }, 10000);

  showToast(`Bienvenue, ${GameState.pseudo} ! 🚬`, 'gold');
}

// ============================================================
// NAVIGATION
// ============================================================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (!page) return;
    showPage(page);
  });
});

document.getElementById('btn-profile-top')?.addEventListener('click', () => showPage('profil'));

// ============================================================
// COURSE PAGE
// ============================================================
document.querySelectorAll('.track-card').forEach(card => {
  card.addEventListener('click', () => {
    if (card.classList.contains('locked')) {
      showToast('Piste verrouillée ! Montez de niveau pour la débloquer.', 'error');
      return;
    }
    document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    GameState.selectedTrack = card.dataset.track;
    saveGame();
  });
});

document.getElementById('btn-start-solo')?.addEventListener('click', () => {
  const track = GameState.selectedTrack || 'trottoir';
  const trackData = TRACKS[track];

  if (!trackData) return;
  if (GameState.level < trackData.unlockLevel) {
    showToast('Piste verrouillée !', 'error');
    return;
  }

  // Check equipped cigs
  const equipped = getEquippedCigs();
  if (equipped.length === 0) {
    openModal(`
      <div style="text-align:center;padding:16px">
        <div style="font-size:3rem;margin-bottom:16px">🚬</div>
        <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--accent);margin-bottom:12px">Aucune cigarette équipée !</h3>
        <p style="color:var(--text-muted);margin-bottom:16px">Stéphane court plus vite avec des cigarettes.<br>Mais vous pouvez quand même courir... sans boost.</p>
        <div style="display:flex;gap:12px;justify-content:center">
          <button id="modal-run-anyway" class="btn-primary">Courir quand même 😤</button>
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

document.getElementById('btn-start-duel')?.addEventListener('click', () => {
  if (!GameState.friends.length) {
    showToast('Ajoutez des amis pour les défier !', 'error');
    showPage('amis');
    return;
  }
  showPage('amis');
});

// ============================================================
// RACE CONTROLS
// ============================================================
document.getElementById('btn-fumer')?.addEventListener('click', () => RaceEngine.smoke());
document.getElementById('btn-fumer')?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  RaceEngine.smoke();
}, { passive: false });

document.getElementById('btn-abandon')?.addEventListener('click', () => {
  if (confirm('Abandonner la course ?')) {
    RaceEngine.stop();
    showPage('course');
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
      <button class="btn-primary btn-sm" ${canRecycle ? '' : 'disabled'} data-from="${rule.from}">Recycler ♻️</button>
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
document.getElementById('btn-copy-code')?.addEventListener('click', () => {
  const code = GameState.friendCode;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => showToast('Code copié ! 📋', 'success'));
});

document.getElementById('btn-add-friend')?.addEventListener('click', () => {
  const val = document.getElementById('add-friend-input')?.value.trim();
  if (!val) return;
  const result = addFriend(val);
  if (!result.ok) { showToast(result.msg, 'error'); return; }
  showToast('Ami ajouté ! 👥', 'success');
  document.getElementById('add-friend-input').value = '';
  Friends.renderFriendsList();
});

document.getElementById('add-friend-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-add-friend').click();
});

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
  if (confirm('Se déconnecter ?')) {
    if (window.CloudSync) await CloudSync.signOut();
    logoutUser();
    showAuthScreen();
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
    <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--accent);margin-bottom:12px">🔐 Activer la Double Authentification</h3>
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
      showToast('2FA activée avec succès ! Votre compte est ultra-sécurisé 🛡️', 'success');
      closeModal();
      btn.textContent = '2FA Activé ✅';
      btn.disabled = true;
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
    } else {
      showToast('Code invalide, réessayez', 'error');
    }
  });
});

document.getElementById('btn-settings')?.addEventListener('click', () => {
  openModal(`
    <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--accent);margin-bottom:16px">⚙️ Paramètres</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:var(--bg-surface);border-radius:var(--r-sm);padding:12px;font-size:0.85rem;color:var(--text-muted)">
        <strong style="color:var(--text)">Version</strong><br>Stéphane, le Roi du Cendrier v1.0<br>
        <br><strong style="color:var(--text)">Données</strong><br>Toutes les données sont stockées localement dans votre navigateur.
        <br>Argent virtuel uniquement — Aucun achat réel, aucun retrait.
      </div>
      <div style="background:rgba(224,48,48,0.1);border:1px solid var(--red);border-radius:var(--r-sm);padding:12px;font-size:0.85rem;color:var(--red)">
        ⚠️ Le tabac est dangereux pour la santé. Ce jeu est satirique et humoristique, il ne fait pas l'apologie du tabac. Réservé aux 18 ans et plus.
      </div>
      <button id="btn-reset-game" class="btn-danger">🗑️ Réinitialiser la partie</button>
    </div>
  `);
  document.getElementById('btn-reset-game')?.addEventListener('click', () => {
    if (confirm('Êtes-vous sûr ? Toutes vos données seront perdues !')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });
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
