// ============================================================
// THE ASHTRAY KING — Profil du joueur
// Photo de profil (recadrée en carré, compressée) et pseudo modifiable.
// La photo est gardée dans le navigateur (localStorage).
// ============================================================

const PlayerProfile = (() => {
  const AVATAR_KEY = 'player_avatar';
  const DEFAULT_AVATAR = 'assets/stephane_avatar.jpg';

  function getAvatar() {
    try { return localStorage.getItem(AVATAR_KEY) || DEFAULT_AVATAR; } catch (e) { return DEFAULT_AVATAR; }
  }

  function getPseudo() {
    return (typeof GameState !== 'undefined' && GameState.pseudo) || 'Joueur';
  }

  // Recadre au centre en carré 256×256 et compresse en JPEG (≈ 20 Ko)
  function fileToAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('Ce fichier n\'est pas une image.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image illisible.'));
        img.onload = () => {
          const size = 256;
          const side = Math.min(img.width, img.height);
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Petite version (64 px) pour les classements
  function smallOf(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        c.getContext('2d').drawImage(img, 0, 0, 64, 64);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function uploadAvatar(dataUrl) {
    if (!window.CloudSync || !CloudSync.currentUser) return;
    CloudSync.updateAvatar(dataUrl, dataUrl ? await smallOf(dataUrl) : null);
  }

  // Fenêtre de recadrage : on glisse la photo avec le doigt/la souris et on zoome avec le curseur
  function cropAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('Ce fichier n\'est pas une image.'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
      img.onload = () => {
        const SIZE = 256;
        const el = document.createElement('div');
        el.className = 'crop-overlay';
        el.innerHTML = `
          <div class="crop-card">
            <strong>Place ta photo</strong>
            <p>Glisse pour la déplacer, le curseur zoome.</p>
            <div class="crop-stage"><canvas width="${SIZE}" height="${SIZE}"></canvas><span class="crop-ring"></span></div>
            <input type="range" class="crop-zoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom" />
            <div class="crop-actions">
              <button class="btn-empire btn-empire-secondary" data-cancel>Annuler</button>
              <button class="btn-empire btn-empire-primary" data-ok>Valider</button>
            </div>
          </div>`;
        document.body.appendChild(el);
        const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d');
        const base = Math.max(SIZE / img.width, SIZE / img.height);
        let zoom = 1, x = 0, y = 0;     // x, y = décalage du centre de l'image (en pixels du canvas)
        const clamp = () => {
          const w = img.width * base * zoom, h = img.height * base * zoom;
          x = Math.max(-(w - SIZE) / 2, Math.min((w - SIZE) / 2, x));
          y = Math.max(-(h - SIZE) / 2, Math.min((h - SIZE) / 2, y));
        };
        const draw = () => {
          clamp();
          const w = img.width * base * zoom, h = img.height * base * zoom;
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SIZE, SIZE);
          ctx.drawImage(img, (SIZE - w) / 2 + x, (SIZE - h) / 2 + y, w, h);
        };
        draw();
        let drag = null;
        const scale = () => canvas.getBoundingClientRect().width / SIZE;
        canvas.addEventListener('pointerdown', e => { drag = { px: e.clientX, py: e.clientY, x, y }; canvas.setPointerCapture(e.pointerId); });
        canvas.addEventListener('pointermove', e => { if (!drag) return; x = drag.x + (e.clientX - drag.px) / scale(); y = drag.y + (e.clientY - drag.py) / scale(); draw(); });
        const end = () => { drag = null; };
        canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
        el.querySelector('.crop-zoom').addEventListener('input', e => { zoom = +e.target.value; draw(); });
        const close = () => { el.remove(); URL.revokeObjectURL(url); };
        el.querySelector('[data-cancel]').addEventListener('click', () => { close(); const err = new Error('annulé'); err.cancelled = true; reject(err); });
        el.querySelector('[data-ok]').addEventListener('click', () => { const out = canvas.toDataURL('image/jpeg', 0.85); close(); resolve(out); });
      };
      img.src = url;
    });
  }

  async function setAvatarFromFile(file) {
    const dataUrl = await cropAvatar(file);
    try {
      localStorage.setItem(AVATAR_KEY, dataUrl);
    } catch (e) {
      throw new Error('Stockage du navigateur plein.');
    }
    uploadAvatar(dataUrl);
    refreshAll();
  }

  function resetAvatar() {
    try { localStorage.removeItem(AVATAR_KEY); } catch (e) {}
    uploadAvatar(null);
    refreshAll();
  }

  // À la connexion : la photo du serveur prend la place de celle du navigateur (ou l'inverse la 1re fois)
  async function syncWithProfile(profile) {
    try {
      if (profile && profile.avatar) localStorage.setItem(AVATAR_KEY, profile.avatar);
      else if (localStorage.getItem(AVATAR_KEY)) await uploadAvatar(localStorage.getItem(AVATAR_KEY));
      else localStorage.removeItem(AVATAR_KEY);
    } catch (e) {}
  }

  async function setPseudo(raw) {
    const pseudo = String(raw || '').trim().replace(/\s+/g, ' ');
    if (pseudo.length < 2 || pseudo.length > 20) return { ok: false, msg: 'Le pseudo doit faire entre 2 et 20 caractères.' };
    if (!/^[\p{L}\p{N} _.\-']+$/u.test(pseudo)) return { ok: false, msg: 'Lettres, chiffres, espaces, - _ . et \' uniquement.' };
    if (typeof CloudSync !== 'undefined' && CloudSync.updatePseudo) {
      const res = await CloudSync.updatePseudo(pseudo);
      if (!res.ok) return res;
    }
    GameState.pseudo = pseudo;
    if (typeof saveGame === 'function') saveGame();
    refreshAll();
    return { ok: true };
  }

  // Barre du haut : photo + pseudo + niveau
  function renderTopBar() {
    const img = document.getElementById('top-avatar');
    const name = document.getElementById('top-pseudo');
    if (img) img.src = getAvatar();
    if (name) name.textContent = getPseudo();
  }

  function refreshAll() {
    renderTopBar();
    if (document.getElementById('page-profil')?.classList.contains('active') && typeof renderProfile === 'function') renderProfile();
  }

  return { getAvatar, getPseudo, setAvatarFromFile, resetAvatar, setPseudo, renderTopBar, refreshAll, syncWithProfile };
})();

if (typeof window !== 'undefined') window.PlayerProfile = PlayerProfile;
