// ============================================================
// THE ASHTRAY KING — Personnalisation : image du rond de clic + raccourci sur l'écran d'accueil du téléphone
// ============================================================
const Personalize = (() => {
  const KEY = 'ak_click_skin';
  const svg = body => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f6e9cc"/>${body}</svg>`);
  const SKINS = {
    stephane: { label: 'Stéphane', src: 'assets/stephane_avatar.jpg' },
    cigarette: { label: 'Cigarette', src: svg('<rect x="20" y="88" width="120" height="26" rx="4" fill="#fbf0d8" stroke="#120a04" stroke-width="6"/><rect x="20" y="88" width="34" height="26" fill="#d9822b" stroke="#120a04" stroke-width="6"/><rect x="140" y="88" width="30" height="26" fill="#9b948a" stroke="#120a04" stroke-width="6"/><path d="M176 84c10-16 -8-22 4-40" fill="none" stroke="#9b948a" stroke-width="7" stroke-linecap="round"/>') },
    briquet: { label: 'Briquet', src: svg('<rect x="64" y="70" width="72" height="110" rx="12" fill="#e2322b" stroke="#120a04" stroke-width="6"/><rect x="64" y="52" width="72" height="26" rx="6" fill="#bfbfbf" stroke="#120a04" stroke-width="6"/><path d="M100 44c18-18 14-26 0-38-14 12-18 20 0 38z" fill="#ffc43a" stroke="#120a04" stroke-width="5"/>') },
    cendrier: { label: 'Cendrier', src: svg('<ellipse cx="100" cy="128" rx="78" ry="34" fill="#9b948a" stroke="#120a04" stroke-width="6"/><ellipse cx="100" cy="118" rx="58" ry="22" fill="#3a3430" stroke="#120a04" stroke-width="6"/><rect x="50" y="96" width="62" height="12" rx="3" fill="#fbf0d8" stroke="#120a04" stroke-width="4" transform="rotate(-18 80 100)"/><path d="M124 94c10-14 -6-20 4-34" fill="none" stroke="#6e6a64" stroke-width="6" stroke-linecap="round"/>') },
    paquet: { label: 'Paquet', src: svg('<rect x="50" y="36" width="100" height="140" rx="10" fill="#c43b2d" stroke="#120a04" stroke-width="6"/><rect x="50" y="36" width="100" height="42" rx="10" fill="#fbf0d8" stroke="#120a04" stroke-width="6"/><circle cx="100" cy="116" r="22" fill="#ffc43a" stroke="#120a04" stroke-width="5"/><text x="100" y="124" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="22" fill="#120a04">K</text>') },
  };
  let deferredInstall = null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function current() { try { return localStorage.getItem(KEY) || 'stephane'; } catch (e) { return 'stephane'; } }

  function srcOf(skin) {
    if (SKINS[skin]) return SKINS[skin].src;
    if (skin === 'profil') { const p = window.Account && Account.profile; return (p && (p.avatar || p.avatar_small) && /^data:image\//.test(p.avatar || p.avatar_small)) ? (p.avatar || p.avatar_small) : SKINS.stephane.src; }
    if (skin.startsWith('carte:')) {
      const it = typeof getEmpireItemById === 'function' ? getEmpireItemById(skin.slice(6)) : null;
      if (it && typeof CardsRenderer !== 'undefined') return CardsRenderer.resolveCardPhoto(it);
    }
    return SKINS.stephane.src;
  }

  function apply() {
    const img = document.querySelector('#clicker-target .click-target-img');
    if (img) img.src = srcOf(current());
    const lab = document.getElementById('set-skin-label');
    if (lab) lab.textContent = labelOf(current());
  }

  function labelOf(skin) {
    if (SKINS[skin]) return SKINS[skin].label;
    if (skin === 'profil') return 'Ma photo de profil';
    if (skin.startsWith('carte:')) { const it = typeof getEmpireItemById === 'function' ? getEmpireItemById(skin.slice(6)) : null; return it ? it.name : 'Une carte'; }
    return 'Stéphane';
  }

  function set(skin) {
    try { localStorage.setItem(KEY, skin); } catch (e) {}
    apply();
    if (window.Account && Account.push) Account.push();
  }

  function modal(html) {
    document.querySelectorAll('.soc-modal.pz-modal').forEach(m => m.remove());
    const el = document.createElement('div');
    el.className = 'soc-modal pz-modal';
    el.innerHTML = `<div class="soc-modal-card pp-card">${html}</div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); });
    document.body.appendChild(el);
    return el;
  }

  function openPicker() {
    const own = (typeof EmpireManager !== 'undefined' && EmpireManager.getInventory) ? EmpireManager.getInventory() : {};
    const ids = Object.keys(own).filter(id => own[id] > 0);
    const items = ids.map(id => (typeof getEmpireItemById === 'function' ? getEmpireItemById(id) : null)).filter(Boolean).sort((a, b) => (b.value || 0) - (a.value || 0));
    const el = modal(`
      <h3>Rond du clic</h3>
      <div class="pz-grid">${Object.entries(SKINS).map(([k, v]) => `<button type="button" class="pz-opt ${current() === k ? 'is-on' : ''}" data-skin="${k}"><img src="${v.src}" alt=""><span>${esc(v.label)}</span></button>`).join('')}
        <button type="button" class="pz-opt ${current() === 'profil' ? 'is-on' : ''}" data-skin="profil"><img src="${srcOf('profil')}" alt=""><span>Ma photo</span></button></div>
      <h4>Une de mes cartes</h4>
      <input class="game-input sc-search" placeholder="Chercher dans mes cartes" />
      <div class="pz-grid pz-cards"></div>
      <button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button>`);
    const draw = () => {
      const q = el.querySelector('.sc-search').value.trim().toLowerCase();
      el.querySelector('.pz-cards').innerHTML = items.filter(i => !q || i.name.toLowerCase().includes(q)).slice(0, 30)
        .map(i => `<button type="button" class="pz-opt ${current() === 'carte:' + i.id ? 'is-on' : ''}" data-skin="carte:${esc(i.id)}"><img src="${esc(CardsRenderer.resolveCardPhoto(i))}" alt="" loading="lazy"><span>${esc(i.name)}</span></button>`).join('')
        || '<p class="soc-empty">Aucune carte.</p>';
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-skin]'); if (b) { set(b.dataset.skin); el.remove(); } });
    el.querySelector('.sc-search').addEventListener('input', draw);
    draw();
  }

  // ── Raccourci sur l'écran d'accueil ──
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  async function install() {
    if (deferredInstall) {
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (e) {}
      deferredInstall = null;
      return;
    }
    const msg = isIOS()
      ? 'Dans Safari, touche le bouton Partager (le carré avec la flèche), puis « Sur l\'écran d\'accueil ».'
      : 'Dans le menu de ton navigateur (les trois points), choisis « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».';
    if (window.GameDialog) GameDialog.alert(msg, { title: 'Ajouter le jeu à ton téléphone' }); else alert(msg);
  }

  // ── Notifications push (amis, paquet gratuit prêt) ──
  const VAPID_PUBLIC = 'BHZ5FCKqTH8IP3ooJGMWSmPCoWXk65HUNzMym1ZatMpJ8oth5RbvihX7as4Go9-Q9vvN2v11vrxzl1jRPXuwyIo';
  const b64ToBytes = b => { const pad = '='.repeat((4 - b.length % 4) % 4), s = atob((b + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  const bytesToB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  async function pushState() {
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); return sub && Notification.permission === 'granted' ? 'on' : 'off'; } catch (e) { return 'off'; }
  }
  async function refreshPushUi() {
    const st = await pushState(), btn = document.getElementById('set-push'), note = document.getElementById('set-push-note'); if (!btn) return;
    const L = { on: ['Désactiver', 'Tu seras prévenu quand un ami t\'invite ou t\'écrit, et quand un paquet gratuit est prêt.'],
      off: ['Activer', 'Reçois une notification quand un ami t\'invite ou t\'écrit, et quand un paquet gratuit est prêt.'],
      denied: ['Bloquées', 'Les notifications sont bloquées dans les réglages de ton navigateur ou de ton téléphone.'],
      unsupported: ['Indisponible', isIOS() && !standalone() ? 'Sur iPhone, ajoute d\'abord le jeu à l\'écran d\'accueil, puis réactive ici.' : 'Ce navigateur ne gère pas les notifications.'] }[st];
    btn.textContent = L[0]; btn.disabled = st === 'denied' || st === 'unsupported'; if (note) note.textContent = L[1];
  }
  async function togglePush() {
    const st = await pushState();
    try {
      const reg = await navigator.serviceWorker.ready;
      if (st === 'on') {
        const sub = await reg.pushManager.getSubscription();
        if (sub) { if (window.sb && window.Account && Account.user) await window.sb.rpc('push_unsubscribe', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
      } else {
        if (!window.Account || !Account.user) return showToast('Connecte-toi pour activer les notifications.', 'error');
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { refreshPushUi(); return showToast('Notifications refusées.', 'info'); }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
        const j = sub.toJSON();
        const { error } = await window.sb.rpc('push_subscribe', { p_endpoint: sub.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
        if (error) { await sub.unsubscribe(); return showToast('Impossible d\'activer les notifications : ' + error.message, 'error'); }
        showToast('Notifications activées.', 'gold');
      }
    } catch (e) { showToast('Notifications indisponibles sur cet appareil.', 'error'); }
    refreshPushUi();
  }

  function init() {
    apply();
    document.getElementById('set-push')?.addEventListener('click', togglePush);
    refreshPushUi();
    document.getElementById('set-skin')?.addEventListener('click', openPicker);
    const card = document.getElementById('set-install-card');
    if (card && standalone()) card.classList.add('hidden');
    document.getElementById('set-install')?.addEventListener('click', install);
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
    if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
    }
    // l'image peut changer quand la sauvegarde en ligne arrive (compte, carte choisie)
    setTimeout(apply, 1500); setTimeout(apply, 5000);
  }

  return { init, apply, set, openPicker, refreshPushUi };
})();

if (typeof window !== 'undefined') window.Personalize = Personalize;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Personalize.init()); else Personalize.init();
