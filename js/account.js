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
    'casino_last_result', 'casino_bank_advance_at', 'ashtray_pvp_deck', 'ashtray_audio_enabled', 'ak_click_skin', 'ak_quests', 'ak_ach', 'ak_title', 'casino_bj_history',
  ];
  const PREFIXES = ['rules_seen_'];
  const OWNER = 'ak_owner', STAMP = 'ak_stamp', DIRTY = 'ak_dirty', LEFT = 'ak_signed_out';
  const PUSH_DELAY = 2500;
  const BASE = 'ak_base';      // chiffres de la dernière version synchronisée (sert à fusionner deux appareils)

  let user = null;
  let profile = null;
  let stamp = null;          // date de la dernière version connue côté serveur
  let timer = null;
  let pushing = false;
  let live = false;          // true une fois connecté : les changements locaux déclenchent l'envoi
  let applying = false;      // true pendant le remplacement des données locales (aucun envoi)
  let blocked = false;       // true si un autre onglet a pris la main : cet onglet n'envoie plus rien
  let frozen = false;        // true dès qu'une version reçue d'un autre appareil est écrite : la page va se recharger, le jeu en cours ne doit plus rien écrire (sinon il écrase la version reçue avec ses vieux chiffres)
  const TAB_KEY = 'ak_tab_lock', TAB_ID = Math.random().toString(36).slice(2);
  // Appareil principal : chaque onglet / appareil a un identifiant de session (gardé quand la page se recharge, nouveau à chaque nouvelle ouverture).
  // La dernière session ouverte « prend la main » côté serveur (session_claim) ; les autres affichent « déjà connecté ailleurs ».
  let sid = null;
  try { sid = sessionStorage.getItem('ak_sid'); } catch (e) {}
  if (!sid) {
    sid = 's' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem('ak_sid', sid); } catch (e) {}
  }
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
    try { if (typeof ClickerEngine !== 'undefined' && ClickerEngine.flushSave) ClickerEngine.flushSave(); } catch (e) {}
    const data = {};
    gameKeysPresent().forEach(k => { data[k] = ls.get(k); });
    return data;
  }
  function clearGameData() { gameKeysPresent().forEach(ls.del); }
  function applySnapshot(data) {
    applying = true; frozen = true;
    clearGameData();
    Object.entries(data || {}).forEach(([k, v]) => { if (isGameKey(k) && typeof v === 'string') ls.set(k, v); });
  }

  // Tout changement d'une clé du jeu → envoi différé
  function hook() {
    Storage.prototype.setItem = function (k, v) {
      if (frozen && this === localStorage && isGameKey(k)) return;
      rawSet.call(this, k, v);
      if (this === localStorage && live && !applying && isGameKey(k)) markDirty();
    };
    Storage.prototype.removeItem = function (k) {
      if (frozen && this === localStorage && isGameKey(k)) return;
      rawRemove.call(this, k);
      if (this === localStorage && live && !applying && isGameKey(k)) markDirty();
    };
  }
  function markDirty() {
    ls.set(DIRTY, '1');
    if (!timer) timer = setTimeout(() => { timer = null; push(); }, PUSH_DELAY);
  }

  // ── Un seul onglet actif par navigateur (sinon deux onglets s'écrasent la sauvegarde) ──
  function lockInfo() { try { return JSON.parse(ls.get(TAB_KEY) || 'null'); } catch (e) { return null; } }
  function claimLock() { ls.set(TAB_KEY, JSON.stringify({ id: TAB_ID, t: Date.now() })); }
  function otherTabAlive() { const l = lockInfo(); return !!(l && l.id !== TAB_ID && Date.now() - l.t < 6000); }

  function blockScreen(title, text, button, onClick) {
    document.getElementById('tab-block')?.remove();
    const el = document.createElement('div');
    el.id = 'tab-block';
    el.className = 'soc-modal dlg-modal tab-block';
    el.innerHTML = `<div class="soc-modal-card dlg-card"><h3>${title}</h3><p class="dlg-text">${text}</p><button class="btn-empire btn-empire-primary soc-wide">${button}</button></div>`;
    document.body.appendChild(el);
    el.querySelector('button').addEventListener('click', onClick);
    return el;
  }

  // Au démarrage : si le jeu tourne déjà dans un autre onglet, on le dit et on laisse le choix
  function waitForTabFree() {
    if (!otherTabAlive()) return Promise.resolve();
    return new Promise(resolve => {
      const el = blockScreen('Le jeu est déjà ouvert', 'The Ashtray King tourne dans un autre onglet de ce navigateur. Un seul onglet à la fois : sinon ta sauvegarde se mélange.', 'Jouer ici', () => { el.remove(); clearInterval(t); resolve(); });
      const t = setInterval(() => { if (!otherTabAlive()) { el.remove(); clearInterval(t); resolve(); } }, 1000);
    });
  }

  let guardStarted = false;
  function startTabGuardOnce() { if (!guardStarted) { guardStarted = true; startTabGuard(); } }

  function startTabGuard() {
    claimLock();
    setInterval(() => {
      if (blocked) return;
      const l = lockInfo();
      if (l && l.id !== TAB_ID) {
        blocked = true; live = false; clearTimeout(timer); timer = null;
        blockScreen('Jeu ouvert dans un autre onglet', 'Tu as repris la partie ailleurs. Cet onglet est en pause pour ne pas écraser ta sauvegarde.', 'Reprendre ici', () => location.reload());
      } else claimLock();
    }, 2000);
    window.addEventListener('pagehide', () => { const l = lockInfo(); if (l && l.id === TAB_ID) ls.del(TAB_KEY); });
  }

  function client() { return window.sb || null; }
  function deviceName() {
    const ua = navigator.userAgent;
    return /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Navigateur';
  }

  // ── Appareil principal ─────────────────────────────────────
  async function claimSession() {
    const sb = client(); if (!sb) return;
    try { const { error } = await sb.rpc('session_claim', { p_sid: sid, p_device: deviceName() }); if (!error) sessionStorage.setItem('ak_sid_claimed', '1'); } catch (e) {}
  }
  // Un autre appareil a pris la main : on envoie une dernière fois ce qui n'est pas encore parti, puis on bloque cet appareil
  async function loseControl(otherDevice) {
    if (blocked) return;
    try { if (ls.get(DIRTY) === '1') await push(); } catch (e) {}
    blocked = true; live = false; window.AkBlocked = true;
    clearTimeout(timer); timer = null;
    const where = otherDevice ? ` (${otherDevice})` : '';
    blockScreen('Tu es déjà connecté sur un autre appareil', `Ta partie est ouverte sur un autre appareil${where}. Un seul appareil à la fois, sinon la sauvegarde se mélange.`, 'Jouer sur cet appareil', takeOver);
  }
  // « Jouer sur cet appareil » : cet appareil devient le principal ; l'autre envoie sa dernière version et se bloque à son tour
  async function takeOver() {
    const btn = document.querySelector('#tab-block button');
    if (btn) { btn.disabled = true; btn.textContent = 'Synchronisation…'; }
    try {
      await claimSession();
      await new Promise(r => setTimeout(r, 7000));          // l'autre appareil voit le changement (≤ 6 s) et envoie sa dernière version
      const save = await pull();
      if (save) {
        applySnapshot(save.data); ls.set(OWNER, user.id); ls.set(STAMP, save.updated_at); ls.del(DIRTY); rememberBase(save.data);
        sessionStorage.setItem('ak_reloaded', user.id + save.updated_at);
      }
    } catch (e) { /* hors ligne : on recharge quand même, la page se resynchronisera */ }
    location.reload();
  }

  // ── Envoi ──────────────────────────────────────────────────
  async function push(force = false) {
    const sb = client();
    if (!sb || !user || pushing || applying || blocked) return;
    if (!force && stamp && ls.get(DIRTY) === '1' && sameCounters(counters(snapshot()), savedBase())) { ls.del(DIRTY); return; }   // rien de nouveau : on n'envoie pas (sinon l'autre appareil croit à une nouveauté)
    pushing = true;
    try {
      const sent = snapshot();       // ce qui part vraiment : la « version commune » retenue sera CELLE-LÀ (pas l'état du moment où la réponse arrive)
      const { data, error } = await sb.rpc('cloud_save_put', { p_data: sent, p_base: stamp, p_device: deviceName(), p_force: force });
      if (error) throw error;
      if (data && data.conflict) {
        await resolveConflict();
      } else if (data && data.rejected) {
        await handleRejected();
      } else if (data && data.ok) {
        stamp = data.updated_at;
        ls.set(STAMP, stamp);
        rememberBase(sent);
        // des clics ont pu arriver PENDANT l'envoi : ils ne sont pas dans la version envoyée, on garde donc « à envoyer »
        const nowSig = (ls.get('empire_clicker') || '') + (ls.get('empire_state') || '');
        if (nowSig === (sent.empire_clicker || '') + (sent.empire_state || '')) ls.del(DIRTY); else markDirty();
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

  // À la fermeture / mise en veille de la page : envoi qui survit à la fermeture (limite de 64 Ko pour ce mode), sinon envoi normal
  let accessToken = null;
  function trackToken() { const sb = client(); if (sb && sb.auth) { sb.auth.getSession().then(({ data }) => { accessToken = data && data.session ? data.session.access_token : null; }); sb.auth.onAuthStateChange((_e, sess) => { accessToken = sess ? sess.access_token : null; }); } }
  function pushOnLeave() {
    if (!user || pushing || applying || blocked) return;
    try {
      const sent = snapshot();
      const body = JSON.stringify({ p_data: sent, p_base: stamp, p_device: deviceName(), p_force: false });
      if (accessToken && body.length < 60000 && typeof SUPABASE_CONFIG !== 'undefined') {
        fetch(SUPABASE_CONFIG.url + '/rest/v1/rpc/cloud_save_put', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: 'Bearer ' + accessToken }, body })
          .then(r => r.json()).then(d => { if (d && d.ok) { stamp = d.updated_at; ls.set(STAMP, stamp); ls.del(DIRTY); rememberBase(sent); } }).catch(() => {});
        return;
      }
    } catch (e) {}
    push();
  }

  // Le serveur refuse une sauvegarde absurde (progression impossible, format cassé) : on NE touche PAS à la partie du joueur
  // (avant, on rechargeait la dernière version en ligne et on perdait de l'XP). Copie de sécurité locale + nouvel essai plus tard.
  async function handleRejected() {
    backup('refusee', snapshot());
    console.warn('[Account] sauvegarde refusée par le serveur, la partie locale est conservée');
    if (!timer) timer = setTimeout(() => { timer = null; push(); }, 120000);
  }

  async function pull() {
    const sb = client();
    const { data, error } = await sb.from('cloud_saves').select('data, updated_at').maybeSingle();
    if (error) throw error;
    return data;
  }

  // ── Chiffres d'une sauvegarde (argent, XP totale, clics, paquets, cartes) ──
  const xpForLevel = lv => Math.round(300 * Math.pow(1.35, Math.min(lv, 12) - 1) * Math.pow(1.06, Math.max(0, lv - 12)) / 5) * 5;
  const xpTotalOf = (level, xp) => { let t = xp || 0; for (let i = 1; i < (level || 1); i++) t += xpForLevel(i); return t; };
  function levelFromXp(total) { let lv = 1, left = Math.max(0, total); while (left >= xpForLevel(lv) && lv < 400) { left -= xpForLevel(lv); lv++; } return { level: lv, xp: left }; }
  function counters(data) {
    try {
      const c = JSON.parse((data && data.empire_clicker) || '{}'), e = JSON.parse((data && data.empire_state) || '{}'), inv = {};
      Object.entries(e.inventory || {}).forEach(([k, v]) => { if (+v > 0) inv[k] = +v; });
      return { cash: +c.cash || 0, totalEarned: +c.totalEarned || 0, totalClicks: +c.totalClicks || 0, xp: xpTotalOf(c.empireLevel || 1, +c.empireXP || 0), packs: +e.totalPacksOpened || 0, inv };
    } catch (err) { return null; }
  }
  // Deux parties ont-elles exactement les mêmes chiffres de progression ?
  function sameCounters(a, b) {
    if (!a || !b) return false;
    for (const k of ['cash', 'totalEarned', 'totalClicks', 'xp', 'packs']) if (Math.round(a[k] || 0) !== Math.round(b[k] || 0)) return false;
    const ia = a.inv || {}, ib = b.inv || {};
    const ids = new Set([...Object.keys(ia), ...Object.keys(ib)]);
    for (const id of ids) if ((ia[id] || 0) !== (ib[id] || 0)) return false;
    return true;
  }
  function rememberBase(data) { const c = counters(data); if (c) ls.set(BASE, JSON.stringify(c)); }
  const savedBase = () => { try { return JSON.parse(ls.get(BASE) || 'null'); } catch (e) { return null; } };

  // Avancement : l'XP totale ne baisse jamais ; à égalité, l'argent gagné, les clics puis les cartes
  function progressScore(data) {
    const c = counters(data); if (!c) return 0;
    return c.xp * 1e6 + c.totalEarned + c.totalClicks * 10 + c.packs * 100 + Object.values(c.inv).reduce((a, v) => a + v, 0);
  }

  // Fusion à trois (version commune + appareil A + appareil B) : on ADDITIONNE ce que chaque appareil a fait depuis la version commune.
  // Rien ne se perd : argent, XP, clics, paquets et cartes des deux côtés sont conservés.
  function mergeSaves(local, cloud, base) {
    const L = counters(local), C = counters(cloud); if (!L || !C || !base) return null;
    const tpl = progressScore(local) >= progressScore(cloud) ? local : cloud;     // le reste (talents, salles…) vient de la version la plus avancée
    const add = k => Math.max(0, Math.round(L[k] + C[k] - (base[k] || 0)));
    const c = JSON.parse(tpl.empire_clicker || '{}'), e = JSON.parse(tpl.empire_state || '{}');
    c.cash = add('cash'); c.totalEarned = add('totalEarned'); c.totalClicks = add('totalClicks');
    const lv = levelFromXp(add('xp')); c.empireLevel = lv.level; c.empireXP = lv.xp; c.empireXPToNext = xpForLevel(lv.level);
    e.totalPacksOpened = add('packs');
    const ids = new Set([...Object.keys(L.inv), ...Object.keys(C.inv), ...Object.keys(base.inv || {})]), inv = {};
    ids.forEach(id => { const n = Math.max(0, (L.inv[id] || 0) + (C.inv[id] || 0) - ((base.inv || {})[id] || 0)); if (n > 0) inv[id] = n; });
    e.inventory = inv;
    return { ...tpl, empire_clicker: JSON.stringify(c), empire_state: JSON.stringify(e) };
  }

  // Deux versions de la partie (autre appareil ou onglet) : on les FUSIONNE (voir mergeSaves) ; sans version commune connue,
  // on garde la plus avancée. Une copie de sécurité de l'autre version est gardée dans le navigateur.
  // Renvoie true si la page va se recharger.
  async function resolveConflict() {
    const save = await pull();
    if (!save) { pushing = false; await push(true); return false; }
    const local = snapshot();
    const base = savedBase();
    const Lc = counters(local), Cc = counters(save.data);
    // Mêmes chiffres des deux côtés : il n'y a rien à fusionner, on note simplement la version en ligne (pas de rechargement, pas d'envoi)
    if (sameCounters(Lc, Cc)) { stamp = save.updated_at; ls.set(STAMP, stamp); ls.set(OWNER, user.id); ls.del(DIRTY); rememberBase(save.data); return false; }
    // Cet appareil n'a rien fait depuis la dernière synchro : la version en ligne gagne
    if (base && sameCounters(Lc, base)) {
      applySnapshot(save.data); ls.set(OWNER, user.id); ls.set(STAMP, save.updated_at); ls.del(DIRTY); rememberBase(save.data);
      sessionStorage.setItem('ak_reloaded', user.id + save.updated_at);
      location.reload(); return true;
    }
    backup('avant-fusion', local);
    let result = base ? mergeSaves(local, save.data, base) : null;
    console.info('[Account] conflit : base', !!base, 'fusion', !!result, base && JSON.stringify({ local: counters(local), cloud: counters(save.data), base: { ...base, inv: undefined } }).slice(0, 300));
    if (!result) result = progressScore(local) > progressScore(save.data) ? local : save.data;
    // l'envoi part de la dernière version connue de CET appareil : le contrôle anti-triche mesure le temps depuis ce moment-là
    const sb = client();
    applySnapshot(result);
    const { data, error } = await sb.rpc('cloud_save_put', { p_data: result, p_base: stamp, p_device: deviceName(), p_force: true });
    if (!error && data && data.ok) {
      stamp = data.updated_at; ls.set(STAMP, stamp); ls.set(OWNER, user.id); ls.del(DIRTY); rememberBase(result);
      sessionStorage.setItem('ak_reloaded', user.id + stamp);
      if (typeof showToast === 'function') showToast('Partie synchronisée : tes deux appareils ont été fusionnés.', 'info');
      location.reload();
      return true;
    }
    // le serveur a refusé la fusion : on prend la version en ligne (la copie de sécurité reste dans le navigateur)
    applySnapshot(save.data); ls.set(OWNER, user.id); ls.set(STAMP, save.updated_at); ls.del(DIRTY); rememberBase(save.data);
    location.reload();
    return true;
  }

  // Copie de sécurité locale (les 3 dernières) : de quoi récupérer une partie si une synchronisation tourne mal
  function backup(label, data) {
    try {
      const k = 'ak_backup_' + Date.now() + '_' + label;
      rawSet.call(localStorage, k, JSON.stringify(data));
      const all = Object.keys(localStorage).filter(x => x.startsWith('ak_backup_')).sort();
      all.slice(0, Math.max(0, all.length - 3)).forEach(x => rawRemove.call(localStorage, x));
    } catch (e) {}
  }

  // Un autre appareil a envoyé une version plus récente : on s'en aperçoit tout de suite (au retour sur l'onglet, puis toutes les 45 s)
  // pour ne JAMAIS continuer à jouer — et surtout à écraser — avec une partie périmée.
  let checking = false;
  const busyNow = () => {
    try {
      if (typeof Casino !== 'undefined' && Casino.bj && ['playing', 'dealer', 'insurance_prompt'].includes(Casino.bj.status)) return true;
      if (typeof Casino !== 'undefined' && Casino.roulette && Casino.roulette.spinning) return true;
      if (window.Online && Online.inMatch && Online.inMatch()) return true;
      if (typeof ClickerEngine !== 'undefined' && ClickerEngine.msSinceManualClick && ClickerEngine.msSinceManualClick() < 1500) return true;   // le joueur est en train de cliquer : on ne recharge pas sous ses doigts
    } catch (e) {}
    return false;
  };
  async function checkCloud() {
    const sb = client();
    if (!sb || !user || !live || blocked || pushing || applying || checking || document.hidden) return;
    checking = true;
    try {
      try { if (typeof ClickerEngine !== 'undefined' && ClickerEngine.flushSave) ClickerEngine.flushSave(); } catch (e) {}   // les derniers clics (écriture différée) comptent comme des modifications locales
      const { data } = await sb.rpc('cloud_save_stamp');
      if (data && data.sid && data.sid !== sid) { await loseControl(data.sid_device); return; }   // un autre appareil est devenu le principal
      if (!data || !data.updated_at || data.updated_at === stamp) return;
      if (busyNow()) return;                                      // en pleine manche / en train de cliquer : on recommencera dans quelques secondes
      if (ls.get(DIRTY) === '1') { await push(); if (ls.get(DIRTY) === '1' || data.updated_at === stamp) return; if (stamp !== data.updated_at && document.hidden) return; }   // modifications locales aussi : conflit → fusion ; si rien à envoyer on continue
      if (busyNow()) return;                                      // pas en pleine manche : on recommencera
      const save = await pull();
      try { if (typeof ClickerEngine !== 'undefined' && ClickerEngine.flushSave) ClickerEngine.flushSave(); } catch (e) {}
      if (ls.get(DIRTY) === '1') { await push(); return; }        // le joueur a cliqué pendant qu'on regardait : on fusionne au lieu d'écraser
      if (save && sameCounters(counters(snapshot()), counters(save.data))) { stamp = save.updated_at; ls.set(STAMP, stamp); rememberBase(save.data); return; }   // même progression : pas de rechargement
      if (save) {
        applySnapshot(save.data); ls.set(OWNER, user.id); ls.set(STAMP, save.updated_at); ls.del(DIRTY); rememberBase(save.data);
        sessionStorage.setItem('ak_reloaded', user.id + save.updated_at);
        if (typeof showToast === 'function') showToast('Partie mise à jour depuis ton autre appareil.', 'info');
        location.reload();
      }
    } catch (e) { /* hors ligne : tant pis */ } finally { checking = false; }
  }

  // ── Démarrage ──────────────────────────────────────────────
  // Efface tout ce qui appartient au compte précédent (données du jeu + photo)
  function wipeAccountData() {
    clearGameData();
    ls.del(OWNER); ls.del(STAMP); ls.del(DIRTY); ls.del('player_avatar'); ls.del('player_avatar_small');
  }

  async function boot() {
    hook();
    // Déconnexion récente : le jeu a pu réécrire ses données juste avant le rechargement. On repart de zéro.
    if (ls.get(LEFT) === '1') { wipeAccountData(); ls.del(LEFT); }
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
    await waitForTabFree();
    startTabGuardOnce();
    user = u;
    trackToken();
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
        if (!savedBase()) rememberBase(snapshot());
      } else if (sameOwner && dirty && hasLocal) {
        // Changements locaux non envoyés ET version plus récente en ligne : le joueur choisit
        stamp = localStamp;
        live = true;
        if (await resolveConflict()) return;
      } else if (sessionStorage.getItem('ak_reloaded') === u.id + cloud.updated_at) {
        stamp = cloud.updated_at;                         // sécurité anti-boucle de rechargement
      } else {
        // Autre compte sur ce navigateur, première connexion ici, ou rien à perdre : la version en ligne gagne
        if (owner && owner !== u.id) { ls.del('player_avatar'); ls.del('player_avatar_small'); }
        applySnapshot(cloud.data);
        ls.set(OWNER, u.id); ls.set(STAMP, cloud.updated_at); ls.del(DIRTY); rememberBase(cloud.data);
        sessionStorage.setItem('ak_reloaded', u.id + cloud.updated_at);
        location.reload();
        return;
      }
    } else {
      // Aucune sauvegarde en ligne : un NOUVEAU compte repart à zéro. Une partie présente dans ce navigateur n'est reprise
      // que si elle n'appartient à aucun autre compte ET que le joueur le demande (sinon on copiait la partie d'un autre compte).
      let adopt = false;
      if (hasLocal && (!owner || owner === u.id)) {
        let lvl = 1, cards = 0;
        try { lvl = JSON.parse(ls.get('empire_clicker') || '{}').empireLevel || 1; cards = Object.values(JSON.parse(ls.get('empire_state') || '{}').inventory || {}).filter(v => +v > 0).length; } catch (e) {}
        if (owner === u.id) adopt = true;
        else if (lvl > 1 || cards > 3) {
          adopt = await GameDialog.confirm(`Une partie existe déjà dans ce navigateur (niveau ${lvl}, ${cards} cartes). La reprendre sur ce compte ? Sinon, ce compte démarre à neuf.`, { title: 'Reprendre la partie de ce navigateur ?', ok: 'La reprendre', cancel: 'Démarrer à neuf' });
        }
      }
      if (!adopt && hasLocal) {
        // Le jeu a déjà chargé l'ancienne partie en mémoire : on efface puis on recharge la page (le compte est marqué propriétaire)
        wipeAccountData(); ls.set(OWNER, u.id); location.reload(); return;
      }
      stamp = null;
      ls.set(OWNER, u.id);
      live = true;
      await push();
    }
    ls.set(OWNER, u.id);
    live = true;
    applying = false;
    // Dernier appareil ouvert = appareil principal. Une page rechargée garde sa session : si un autre appareil a pris la main entre-temps, elle reste bloquée.
    if (sessionStorage.getItem('ak_sid_claimed') !== '1') await claimSession();
    else {
      try { const { data: st } = await sb.rpc('cloud_save_stamp'); if (st && st.sid && st.sid !== sid) await loseControl(st.sid_device); } catch (e) {}
    }

    // Photo de profil : celle du serveur, ou on envoie celle de ce navigateur
    if (typeof PlayerProfile !== 'undefined') await PlayerProfile.syncWithProfile(profile);
    if (typeof League !== 'undefined' && League.syncFromServer) await League.syncFromServer();

    document.addEventListener('visibilitychange', () => { if (document.hidden && ls.get(DIRTY) === '1') pushOnLeave(); else if (!document.hidden) checkCloud(); });
    window.addEventListener('focus', () => checkCloud());
    window.addEventListener('pageshow', e => { if (e.persisted) checkCloud(); });     // iPhone : la page revient du « congélateur » sans rechargement
    setInterval(checkCloud, 6000);
    setTimeout(checkCloud, 4000);
    window.addEventListener('pagehide', () => { if (ls.get(DIRTY) === '1') pushOnLeave(); });
    window.addEventListener('online', () => { if (ls.get(DIRTY) === '1') push(); });

    if (typeof startGame === 'function') startGame();
    setTimeout(applyGrants, 1500);
  }

  // Crédits accordés par l'administrateur : appliqués une seule fois, puis la partie est sauvegardée
  async function applyGrants() {
    const sb = client();
    if (!sb || !user || blocked || typeof ClickerEngine === 'undefined') return;
    const { data, error } = await sb.rpc('my_grants');
    if (error || !data || !data.length) return;
    data.forEach(g => {
      if (g.card) {
        if (typeof EmpireManager !== 'undefined' && EmpireManager.giveCard) EmpireManager.giveCard(g.card);
        const it = typeof getEmpireItemById === 'function' ? getEmpireItemById(g.card) : null;
        if (typeof showToast === 'function') showToast(`${g.note || 'Échange'} : « ${it ? it.name : 'une carte'} » est dans ta collection.`, 'gold');
        return;
      }
      if (g.kind === 'level') {
        ClickerEngine.setLevel(Number(g.amount));
        if (typeof TalentsEngine !== 'undefined' && TalentsEngine.syncPointsWithPlayer) TalentsEngine.syncPointsWithPlayer();
        if (typeof showToast === 'function') showToast(`L'administrateur a fixé ton niveau à ${g.amount}.`, 'gold');
        return;
      }
      const cash = ClickerEngine.getCash();
      const next = g.mode === 'set' ? Number(g.amount) : cash + Number(g.amount);
      ClickerEngine.setCash(Math.max(0, Math.round(next)));
      if (typeof showToast === 'function') {
        const f = typeof ClickerEngine.formatCash === 'function' ? ClickerEngine.formatCash(Math.abs(g.amount)) : g.amount;
        if (g.kind === 'poker') { showToast(`${g.note || 'Poker'} (${g.amount >= 0 ? '+' : '−'}${f} €)`, g.amount >= 0 ? 'gold' : 'info'); return; }
        if (g.kind === 'market' && typeof Prestige !== 'undefined') Prestige.emit('market_sale');
        if (g.kind === 'market') { showToast(`${g.note || 'Vente'} : +${f} € (commission de 5 % déduite).`, 'gold'); return; }
        showToast(g.mode === 'set' ? `Ton solde a été fixé à ${f} € par l'administrateur.` : (g.amount >= 0 ? `L'administrateur t'a offert ${f} € !` : `L'administrateur a retiré ${f} € de ton solde.`) + (g.note ? ' ' + g.note : ''), 'gold');
      }
    });
    push();
  }

  async function signOut() {
    clearTimeout(timer); timer = null;
    if (user && ls.get(DIRTY) === '1') await push();
    live = false;
    wipeAccountData();
    ls.set(LEFT, '1');
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
    boot, onSignedIn, signOut, push, applyGrants, checkCloud, mergeSaves, counters,
    get user() { return user; },
    get profile() { return profile; },
    setProfile(p) { profile = { ...(profile || {}), ...p }; },
    get live() { return live; },
  };
})();

if (typeof window !== 'undefined') window.Account = Account;
