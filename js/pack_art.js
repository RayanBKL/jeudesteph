// ============================================================
// THE ASHTRAY KING — Visuels des paquets (boosters)
// Emblèmes SVG dessinés + gabarit HTML du booster, utilisés par la
// boutique (carrousel) et par l'animation d'ouverture.
// ============================================================

const PackArt = (() => {

  const INK = '#120a04';
  const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

  // Couleurs du film métallisé : clair, principal, sombre
  const THEMES = {
    gratuit:   ['#ffe27a', '#e2322b', '#6e0f0a'],
    tabac:     ['#ff8a6e', '#d62a22', '#5e0c08'],
    beauf:     ['#ffe08a', '#c98a12', '#5a3606'],
    alcool:    ['#f08aa0', '#9e1f3c', '#3a0716'],
    pochon:    ['#9df59a', '#2e9e44', '#0b3315'],
    backstage: ['#ffb0e0', '#d63c9c', '#4f0b3d'],
    valise:    ['#b4c4ff', '#3a4fae', '#0f1844'],
    foot:      ['#a7f0a0', '#2e9e44', '#0b3315'],
    refs:      ['#9cc8ff', '#2f6fd6', '#0f1844'],
    musique:   ['#e0b8ff', '#8f45dc', '#2a0f44'],
    culte:     ['#ff9a8e', '#d62a22', '#3a0b08'],
  };

  const EMBLEMS = {
    gratuit: `
      <rect x="18" y="44" width="64" height="42" rx="4" fill="#e2322b" ${S}/>
      <rect x="12" y="32" width="76" height="16" rx="4" fill="#ff5a4f" ${S}/>
      <rect x="44" y="32" width="12" height="54" fill="#ffc43a" ${S}/>
      <path d="M50 32 C36 10 16 22 34 32 Z" fill="#ffc43a" ${S}/>
      <path d="M50 32 C64 10 84 22 66 32 Z" fill="#ffc43a" ${S}/>`,
    tabac: `
      <path d="M74 34 C64 26 84 18 74 8" fill="none" stroke="#e8dcc2" stroke-width="6" stroke-linecap="round"/>
      <g transform="rotate(-28 50 60)">
        <rect x="10" y="52" width="62" height="17" rx="3" fill="#fbf0d8" ${S}/>
        <rect x="10" y="52" width="20" height="17" rx="3" fill="#ff9d1c" ${S}/>
        <circle cx="17" cy="58" r="1.6" fill="#a0570b"/><circle cx="23" cy="63" r="1.6" fill="#a0570b"/>
        <rect x="72" y="52" width="10" height="17" rx="2" fill="#5b5048" ${S}/>
        <rect x="82" y="52" width="7" height="17" rx="2" fill="#ff3b1f" ${S}/>
      </g>`,
    beauf: `
      <g transform="rotate(-18 50 55)">
        <path d="M16 55 L5 46 M16 55 L6 64" fill="none" ${S}/>
        <rect x="14" y="38" width="74" height="34" rx="17" fill="#8b2e1f" ${S}/>
        <circle cx="32" cy="48" r="3" fill="#f6e9cc"/><circle cx="46" cy="60" r="3" fill="#f6e9cc"/>
        <circle cx="58" cy="47" r="2.5" fill="#f6e9cc"/><circle cx="36" cy="63" r="2.5" fill="#f6e9cc"/>
        <ellipse cx="80" cy="55" rx="8" ry="15" fill="#e88a7a" ${S}/>
        <circle cx="79" cy="51" r="2" fill="#f6e9cc"/><circle cx="82" cy="59" r="2" fill="#f6e9cc"/>
      </g>`,
    alcool: `
      <rect x="42" y="6" width="16" height="12" rx="2" fill="#c98a4a" ${S}/>
      <path d="M42 18 h16 v12 c0 6 14 10 14 24 v32 a6 6 0 0 1 -6 6 h-32 a6 6 0 0 1 -6 -6 v-32 c0 -14 14 -18 14 -24 z" fill="#7d1430" ${S}/>
      <rect x="32" y="54" width="36" height="22" rx="3" fill="#f6e9cc" ${S}/>
      <path d="M38 62 h24 M42 69 h16" stroke="#9e1f3c" stroke-width="3" stroke-linecap="round"/>
      <path d="M36 40 c2 -4 5 -6 8 -7" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="4" stroke-linecap="round"/>`,
    pochon: `
      <rect x="20" y="20" width="60" height="68" rx="6" fill="#dff3e6" ${S}/>
      <rect x="20" y="20" width="60" height="11" rx="4" fill="#e2322b" ${S}/>
      <g fill="#3fbf4f" ${S}>
        <ellipse cx="50" cy="56" rx="7" ry="18"/>
        <ellipse cx="50" cy="56" rx="6" ry="15" transform="rotate(-48 50 66)"/>
        <ellipse cx="50" cy="56" rx="6" ry="15" transform="rotate(48 50 66)"/>
      </g>
      <path d="M50 70 v12" ${S}/>`,
    backstage: `
      <path d="M8 32 h84 v12 a8 8 0 0 0 0 16 v12 h-84 v-12 a8 8 0 0 0 0 -16 z" fill="#ff4fa3" ${S}/>
      <path d="M30 32 v40" stroke="${INK}" stroke-width="3" stroke-dasharray="4 4"/>
      <path d="M19 44 l2.5 5 5.5 .8 -4 3.9 1 5.5 -5 -2.6 -5 2.6 1 -5.5 -4 -3.9 5.5 -.8 z" fill="#ffc43a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="61" y="61" text-anchor="middle" font-family="Cendrier, sans-serif" font-size="22" fill="#fff" stroke="${INK}" stroke-width="4" paint-order="stroke">VIP</text>`,
    valise: `
      <path d="M37 30 v-10 h26 v10" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M37 30 v-10 h26 v10" fill="none" stroke="#3a2416" stroke-width="3" stroke-linejoin="round"/>
      <rect x="10" y="30" width="80" height="54" rx="7" fill="#7a5230" ${S}/>
      <rect x="10" y="48" width="80" height="7" fill="#4a3018" ${S}/>
      <rect x="43" y="43" width="14" height="17" rx="2" fill="#ffc43a" ${S}/>
      <path d="M22 30 v54 M78 30 v54" stroke="#4a3018" stroke-width="4"/>`,
    refs: `
      <rect x="12" y="26" width="76" height="54" rx="8" fill="#2a1d13" ${S}/>
      <rect x="20" y="33" width="60" height="40" rx="4" fill="#9cc8ff" ${S}/>
      <path d="M36 14l14 12 14-12" fill="none" ${S}/>
      <text x="50" y="62" text-anchor="middle" font-family="Cendrier, sans-serif" font-size="22" fill="#ffc43a" stroke="#120a04" stroke-width="4" paint-order="stroke">6-7</text>
      <path d="M30 80v6M70 80v6" ${S}/>`,
    musique: `
      <circle cx="50" cy="52" r="34" fill="#1b1918" ${S}/>
      <circle cx="50" cy="52" r="24" fill="none" stroke="#3a3632" stroke-width="2"/>
      <circle cx="50" cy="52" r="16" fill="none" stroke="#3a3632" stroke-width="2"/>
      <circle cx="50" cy="52" r="10" fill="#ffc43a" ${S}/>
      <circle cx="50" cy="52" r="2.5" fill="#120a04"/>
      <path d="M30 34c5-5 12-8 20-8" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="3" stroke-linecap="round"/>`,
    culte: `
      <rect x="16" y="34" width="68" height="50" rx="4" fill="#2a1d13" ${S}/>
      <path d="M16 34l10-16h12l-10 16M38 34l10-16h12l-10 16M60 34l10-16h12l-10 16" fill="#f6e9cc" ${S}/>
      <rect x="16" y="34" width="68" height="10" fill="#f6e9cc" ${S}/>
      <text x="50" y="74" text-anchor="middle" font-family="Cendrier, sans-serif" font-size="18" fill="#ffc43a" stroke="#120a04" stroke-width="3" paint-order="stroke">CULTE</text>`,
    foot: `
      <defs><clipPath id="ball-clip"><circle cx="50" cy="52" r="34"/></clipPath></defs>
      <circle cx="50" cy="52" r="34" fill="#fbf0d8"/>
      <g clip-path="url(#ball-clip)" fill="#120a04">
        <path d="M50 40l11.4 8.3-4.4 13.4H43l-4.4-13.4z"/>
        <path d="M50 17l9 6.5-3.4 10.6H44.4L41 23.5z"/>
        <path d="M84 41l3 10.6-9 6.5-9-6.5 3.4-10.6z"/>
        <path d="M71 81l-10.6 3.4-6.5-9 6.5-9 10.6 3.4z"/>
        <path d="M29 81l-3.4-10.6 10.6-3.4 6.5 9-6.5 9z"/>
        <path d="M16 41l11.6 0 3.4 10.6-9 6.5-9-6.5z"/>
      </g>
      <g stroke="#120a04" stroke-width="2.5" stroke-linecap="round" clip-path="url(#ball-clip)">
        <path d="M50 40v-6M61.4 48.3l9-3M57 61.7l5 6M43 61.7l-5 6M38.6 48.3l-9-3"/>
      </g>
      <circle cx="50" cy="52" r="34" fill="none" ${S}/>
      <path d="M33 34c4-5 10-8 16-8" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="3" stroke-linecap="round"/>`,

  };

  function emblem(packId) {
    return `<svg viewBox="0 0 100 100" class="booster-emblem-svg" aria-hidden="true">${EMBLEMS[packId] || EMBLEMS.gratuit}</svg>`;
  }

  function themeStyle(packId) {
    const [p1, p2, p3] = THEMES[packId] || THEMES.gratuit;
    return `--p1:${p1};--p2:${p2};--p3:${p3}`;
  }

  // Nom sans l'emoji de tête (ex : « 🚬 Tabac & Accessoires » -> « Tabac & Accessoires »)
  function cleanName(pack) {
    return pack.name.replace(/^\S+\s/, '');
  }

  // Face du booster (sans le contour) : réutilisée deux fois pour l'effet de déchirure
  function face(pack) {
    return `
      <div class="booster-face">
        <div class="booster-crimp booster-crimp-top"></div>
        <div class="booster-brand">The Ashtray King</div>
        <div class="booster-emblem">${emblem(pack.id)}</div>
        <div class="booster-name">${cleanName(pack)}</div>
        <div class="booster-count">${pack.count} cartes</div>
        <div class="booster-shine"></div>
        <div class="booster-crimp booster-crimp-bottom"></div>
      </div>`;
  }

  // Booster complet. opts.tearable : découpé en deux couches (haut détachable + corps)
  function buildBooster(pack, opts = {}) {
    const inner = opts.tearable
      ? `<div class="booster-layer booster-body">${face(pack)}</div>
         <div class="booster-layer booster-top">${face(pack)}</div>
         <div class="booster-tear-line"></div>`
      : face(pack);
    return `<div class="booster${opts.tearable ? ' booster-tearable' : ''}" style="${themeStyle(pack.id)}">${inner}</div>`;
  }

  return { buildBooster, emblem, themeStyle, cleanName, THEMES };
})();

if (typeof window !== 'undefined') window.PackArt = PackArt;
