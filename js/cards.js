// ============================================================
// THE ASHTRAY KING — Cards Renderer
// Generates premium holographic Trading Card UI for all collectibles
// ============================================================

const CardsRenderer = (() => {

  // Rarity config (mirrors empire_db.js)
  const RARITY_CONFIG = {
    commune:      { label:'Commune',      bg:'#372b22', border:'#b3a899', glow:'0 0 8px rgba(179,168,153,0.3)',  foil:false, stars:1 },
    'peu-commune':{ label:'Peu Commune',  bg:'#0f2a1a', border:'#22c55e', glow:'0 0 12px rgba(34,197,94,0.4)',  foil:false, stars:2 },
    rare:         { label:'Rare',         bg:'#302116', border:'#3b82f6', glow:'0 0 16px rgba(59,130,246,0.5)', foil:false, stars:3 },
    epique:       { label:'Épique',       bg:'#261b12', border:'#a855f7', glow:'0 0 20px rgba(168,85,247,0.6)', foil:true,  stars:4 },
    legendaire:   { label:'Légendaire',   bg:'#1a1200', border:'#f59e0b', glow:'0 0 28px rgba(245,158,11,0.7)', foil:true,  stars:5 },
    mythique:     { label:'Mythique',     bg:'#1a0000', border:'#ef4444', glow:'0 0 40px rgba(239,68,68,0.9)',  foil:true,  stars:6 },
  };

  const CAT_CONFIG = {
    cigarette: { label:'Cigarette', accent:'#f59e0b' },
    briquet:   { label:'Accessoire',accent:'#ef4444' }, // Briquets, feuilles OCB/Raw, filtres, cendriers
    alcool:    { label:'Boisson',   accent:'#8b5cf6' }, // Bières, alcools, softs cultes (Coca, Orangina, Red Bull)
    drogue:    { label:'Substance', accent:'#10b981' },
    actrice:   { label:'VIP',       accent:'#ec4899' },
    beauf:     { label:'Terroir',   accent:'#f97316' }, // Terroirs, gastronomie & objets cultes
    foot:      { label:'Football',  accent:'#2f9e44' },
    refs:      { label:'Mème',      accent:'#3d8bfd' },
    chanteur:  { label:'Musique',   accent:'#a35cf0' },
    culte:     { label:'Culte',     accent:'#e2322b' },
    saison:    { label:'Saison',    accent:'#ffc43a' },
  };

  // ── Build a Card Element ────────────────────────────────────
  function buildCard(item, options = {}) {
    const r = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.commune;
    const cat = CAT_CONFIG[item.cat] || { label:'Item', accent:'#b3a899' };
    const owned = options.quantity || 0;
    const isNew = options.isNew || false;
    const compact = options.compact || false;

    const card = document.createElement('div');
    card.className = `empire-card rarity-${item.rarity}${compact ? ' card-compact' : ''}${isNew ? ' card-new' : ''}`;
    card.dataset.itemId = item.id;
    card.dataset.rarity = item.rarity;
    card.dataset.category = item.cat;

    card.style.setProperty('--card-border', r.border);
    card.style.setProperty('--card-glow', r.glow);
    card.style.setProperty('--card-bg', r.bg);
    card.style.setProperty('--cat-accent', cat.accent);

    card.innerHTML = buildCardInner(item, r, cat, owned, isNew, compact);

    // Click handler
    card.addEventListener('click', () => {
      if (options.onClick) options.onClick(item, card);
      else openCardModal(item);
    });

    return card;
  }

  function buildCardInner(item, r, cat, owned, isNew, compact) {
    const starsStr = '★'.repeat(r.stars || 1);
    const imageHtml = buildImageHtml(item, compact);

    return `
      ${r.foil ? '<div class="card-foil-overlay"></div>' : ''}

      <div class="card-frame-header">
        <div class="card-header-left">
          ${isNew ? '<span class="card-new-pill">NOUVEAU</span>' : ''}
          <span class="card-cat-tag">${cat.label.toUpperCase()}</span>
        </div>
        <div class="card-header-right">
          ${item.variantTag ? `<span class="card-variant-tag">${item.variantTag}</span>` : ''}
          <span class="card-stars-tag" title="${r.label}">${starsStr}</span>
        </div>
      </div>

      <div class="card-art-frame">
        ${imageHtml}
        ${item.cat === 'foot' && item.ovr ? `<div class="card-ut-badge"><b>${item.ovr}</b><span>${item.pos}</span></div>` : ''}
        ${owned > 1 ? `<div class="card-copy-badge">×${owned}</div>` : ''}
      </div>

      <div class="card-info-box">
        <div class="card-title-row">
          <div class="card-title-text" title="${item.name}">${item.name}</div>
          <div class="card-rarity-sub" style="color:${r.border}">${item.cat === 'foot' && item.nat ? `${item.nat}${(item.clubs || [])[0] ? ' · ' + item.clubs[0] : ''}` : r.label.toUpperCase()}</div>
        </div>
        ${compact ? `
          <div class="card-stats-grid compact-grid">
            <div class="stat-col">
              <span class="stat-label">PASSIF</span>
              <span class="stat-val stat-val-passive">+${formatVal(item.cashPerSec)}/s</span>
            </div>
            <div class="stat-col">
              <span class="stat-label">COTE</span>
              <span class="stat-val stat-val-market">${formatVal(cote(item))}€</span>
            </div>
          </div>
        ` : `
          <div class="card-stats-grid">
            <div class="stat-col">
              <span class="stat-label">PASSIF</span>
              <span class="stat-val stat-val-passive">+${formatVal(item.cashPerSec)}/s</span>
            </div>
            <div class="stat-col">
              <span class="stat-label">CLIC</span>
              <span class="stat-val stat-val-click">+${formatVal(item.clickBoost)}</span>
            </div>
            <div class="stat-col">
              <span class="stat-label">COTE</span>
              <span class="stat-val stat-val-market">${formatVal(cote(item))}€</span>
            </div>
          </div>
        `}
      </div>
    `;
  }

  // ── Card Photo Resolver (Dynamic redirection or direct link) ──
  function resolveCardPhoto(item) {
    if (!item) return null;

    // 1. Fichier WebP local explicite dans assets/cards/
    if (item.img && item.img.startsWith('assets/cards/')) return withImgRev(item.img);
    if (item.image && item.image.startsWith('assets/cards/')) return withImgRev(item.image);

    // 2. Chemin WebP déterministe standard (1470+ vraies photos locales)
    const cat = item.cat || 'cigarette';
    const cid = item.id;
    const prefix = cat === 'cigarette' ? 'cig' : cat === 'alcool' ? 'alc' : cat === 'briquet' ? 'acc' : cat === 'beauf' ? 'ter' : cat === 'actrice' ? 'act' : cat === 'foot' ? 'fbl' : cat === 'refs' ? 'ref' : cat === 'chanteur' ? 'mus' : cat === 'culte' ? 'cul' : 'drg';
    return withImgRev(`assets/cards/${prefix}_${cid}.webp`);
  }

  // ── Sceau / Armoiries Vectorielles Collector (Si pas de photo authentique) ──
  function buildCollectorEmblem(item, compact) {
    const r = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.commune;
    const cat = CAT_CONFIG[item.cat] || { label:'ITEM', accent:'#b3a899' };
    
    // Initiales élégantes (max 2 lettres)
    const rawWords = (item.name || 'TCG').trim().replace(/['"«»]/g, '').split(/[\s\-_]+/);
    let initials = '';
    if (rawWords.length >= 2) {
      initials = ((rawWords[0][0] || '') + (rawWords[1][0] || '')).toUpperCase();
    } else if (rawWords.length === 1 && rawWords[0].length >= 2) {
      initials = rawWords[0].substring(0, 2).toUpperCase();
    } else {
      initials = (rawWords[0] || 'K').toUpperCase();
    }

    const color = r.border || '#3b82f6';
    const catLabel = (cat.label || 'COLLECTION').toUpperCase();
    const itemIdSafe = String(item.id || 'x').replace(/[^a-zA-Z0-9]/g, '_');

    return `
      <div class="card-collector-emblem-wrap" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <svg viewBox="0 0 160 140" width="100%" height="100%" class="card-collector-svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="emb-grad-${itemIdSafe}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${color}" stop-opacity="0.95"/>
              <stop offset="50%" stop-color="${shadeColor(color, -25)}" stop-opacity="0.75"/>
              <stop offset="100%" stop-color="${color}" stop-opacity="0.95"/>
            </linearGradient>
            <radialGradient id="emb-bg-${itemIdSafe}" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
              <stop offset="70%" stop-color="${shadeColor(color, -40)}" stop-opacity="0.06"/>
              <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
            </radialGradient>
            <pattern id="emb-mesh-${itemIdSafe}" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 12 0 L 0 12 M 0 0 L 12 12" fill="none" stroke="${color}" stroke-width="0.35" stroke-opacity="0.16"/>
            </pattern>
          </defs>

          <!-- Halo radial fond -->
          <circle cx="80" cy="70" r="62" fill="url(#emb-bg-${itemIdSafe})"/>
          <rect x="14" y="10" width="132" height="120" rx="8" fill="url(#emb-mesh-${itemIdSafe})" />

          <!-- Armoirie / Cadre héraldique externe ciselé -->
          <rect x="18" y="12" width="124" height="116" rx="8" fill="none" stroke="${color}" stroke-width="0.8" stroke-opacity="0.4" stroke-dasharray="3,3"/>
          <path d="M 80 18 L 134 45 L 134 95 L 80 122 L 26 95 L 26 45 Z" fill="rgba(17,12,9,0.75)" stroke="url(#emb-grad-${itemIdSafe})" stroke-width="1.6"/>

          <!-- Filet intérieur -->
          <path d="M 80 24 L 128 48 L 128 92 L 80 116 L 32 92 L 32 48 Z" fill="none" stroke="${color}" stroke-width="0.6" stroke-opacity="0.6"/>

          <!-- Couronne héraldique / Étoile au sommet -->
          <g transform="translate(80, 36)">
            <path d="M -12 0 L -8 -6 L 0 -1 L 8 -6 L 12 0 Z" fill="${color}" opacity="0.85"/>
            <circle cx="0" cy="-4" r="1.5" fill="#ffffff"/>
          </g>

          <!-- Monogramme central gravé -->
          <text x="80" y="74" text-anchor="middle" font-family="'Cinzel', 'Cinzel Decorative', 'Georgia', serif" font-weight="900" font-size="28" fill="#ffffff" letter-spacing="2" style="filter: drop-shadow(0 2px 8px ${color})">
            ${initials}
          </text>

          <!-- Ruban cartouche inférieur -->
          <g transform="translate(80, 94)">
            <rect x="-46" y="-7" width="92" height="14" rx="3" fill="#130f0c" stroke="${color}" stroke-width="0.8"/>
            <text x="0" y="3.5" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="800" font-size="6.5" fill="${color}" letter-spacing="1.2">
              COLLECTION PRIVÉE
            </text>
          </g>

          <!-- Badge catégorie -->
          <text x="80" y="112" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="700" font-size="5.5" fill="rgba(255,255,255,0.6)" letter-spacing="0.8">
            AUTHENTIQUE • ${catLabel}
          </text>
        </svg>
      </div>
    `;
  }

  function buildImageHtml(item, compact) {
    const realPhoto = resolveCardPhoto(item);
    if (realPhoto) {
      return `<img src="${realPhoto}" class="card-img" alt="${item.name}" loading="lazy" onerror="CardsRenderer.imgFail(this)" /><div class="card-collector-fallback" style="display:none;width:100%;height:100%">${buildCollectorEmblem(item, compact)}</div>`;
    }
    return buildCollectorEmblem(item, compact);
  }

  // ── Full Card Modal ────────────────────────────────────────
  function openCardModal(item) {
    const r = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.commune;
    const cat = CAT_CONFIG[item.cat] || { label:'Item', accent:'#b3a899' };
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="card-modal-inner" style="--card-border:${r.border};--cat-accent:${cat.accent}">
        <div class="card-modal-art">
          ${buildImageHtml(item, false)}
        </div>
        <div class="card-modal-info">
          <div class="card-modal-rarity" style="color:${r.border}">${r.label.toUpperCase()} · ${'★'.repeat(r.stars || 1)}</div>
          <h2 class="card-modal-name">${item.name}</h2>
          <p class="card-modal-desc">${item.desc}</p>
          <div class="card-modal-stats">
            <div class="cms"><span>PASSIF</span><strong>+${formatVal(item.cashPerSec)} €/s</strong></div>
            <div class="cms"><span>CLIC</span><strong>+${formatVal(item.clickBoost)} €/clic</strong></div>
            <div class="cms"><span>VALEUR BOURSE</span><strong>${formatVal(cote(item))} €</strong></div>
            ${item.cat === 'foot' && item.ovr ? `
              <div class="cms"><span>NOTE ULTIMATE</span><strong>${item.ovr} · ${({GB:'Gardien',DEF:'Défenseur',MIL:'Milieu',ATT:'Attaquant'})[item.pos] || item.pos}</strong></div>
              <div class="cms"><span>NATIONALITÉ</span><strong>${item.nat || '—'}</strong></div>
              <div class="cms cms-wide"><span>CLUBS (LIENS VERTS)</span><strong>${(item.clubs || []).join(', ') || '—'}</strong></div>` : ''}
            ${item.skill ? `<div class="cms"><span>CAPACITÉ</span><strong>${item.skill.replace(/_/g, ' ').toUpperCase()}</strong></div>` : ''}
          </div>
          <div class="card-modal-actions">
            <button class="btn-empire btn-empire-secondary btn-assign-passive" data-id="${item.id}">Assigner en Passif</button>
            <button class="btn-empire btn-empire-primary btn-equip-click" data-id="${item.id}">Équiper au Clic</button>
          </div>
      </div>
    `;

    body.querySelector('.btn-assign-passive')?.addEventListener('click', () => {
      ClickerEngine.assignPassiveCard(item.id);
      ClickerEngine.showToast(`✅ ${item.name} assignée en revenu passif !`, 'success');
      modal.classList.add('hidden');
    });

    body.querySelector('.btn-equip-click')?.addEventListener('click', () => {
      ClickerEngine.equipClickCard(item.id);
      ClickerEngine.showToast(`👆 ${item.name} équipée pour le clic !`, 'success');
      modal.classList.add('hidden');
    });

    modal.classList.remove('hidden');
  }

  // ── Grid Builder ───────────────────────────────────────────
  function buildGrid(container, items, inventory = {}, options = {}) {
    if (!container) return;
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-state">Aucun objet trouvé.</p>';
      return;
    }

    items.forEach(item => {
      const qty = inventory[item.id] || 0;
      const card = buildCard(item, {
        quantity: qty,
        compact: options.compact || false,
        onClick: options.onClick,
      });
      if (qty === 0) card.classList.add('card-unowned');
      container.appendChild(card);
    });
  }

  // ── Pack Opening: Reveal Cards ─────────────────────────────
  // Carte à retourner pendant l'ouverture d'un paquet (dos + face)
  function buildRevealCard(item, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = `rv-card rv-r-${item.rarity}`;
    wrap.innerHTML = `
      <div class="rv-aura"></div>
      <div class="rv-inner">
        <div class="rv-face rv-back">
          <div class="rv-back-art">
            <img src="assets/logo.jpg" alt="" draggable="false" />
            <span>The Ashtray King</span>
          </div>
        </div>
        <div class="rv-face rv-front"></div>
      </div>
    `;
    const front = buildCard(item, { isNew: !!opts.isNew, onClick: () => {} });
    front.classList.add('card-reveal-mode');
    wrap.querySelector('.rv-front').appendChild(front);
    return wrap;
  }

  // ── Helpers ────────────────────────────────────────────────
  // Cote affichée : valeur de base corrigée par les ventes de la Bourse
  function cote(item) {
    return (typeof EmpireManager !== 'undefined' && EmpireManager.marketValue) ? EmpireManager.marketValue(item) : item.value;
  }

  function formatVal(n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (n >= 1e9) return (n/1e9).toFixed(1) + 'Md';
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    if (n >= 1)   return n.toFixed(n < 10 ? 1 : 0);
    return Number(n).toFixed(2);
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + percent));
    const b = Math.min(255, Math.max(0, (num & 0xFF) + percent));
    return `#${((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}`;
  }

  // Sélecteur de cartes (placement dans l'Empire, cases de clic) : recherche, filtre par famille et tri (meilleur bonus d'abord)
  function buildPicker(container, items, inventory, opts = {}) {
    if (!container) return;
    const bonusKey = opts.mode === 'click' ? 'clickBoost' : 'cashPerSec';
    const bonusLabel = opts.mode === 'click' ? 'Meilleur bonus de clic' : 'Meilleur revenu passif';
    const RO = { mythique: 6, legendaire: 5, epique: 4, rare: 3, 'peu-commune': 2, commune: 1 };
    container.innerHTML = `
      <div class="pick-bar">
        <input type="search" class="game-input pick-search" placeholder="Chercher une carte" autocomplete="off" />
        <select class="game-select-empire pick-sort" aria-label="Trier">
          <option value="bonus">${bonusLabel}</option><option value="rarity">Rareté</option><option value="value">Valeur</option><option value="name">Nom (A-Z)</option>
        </select>
        <select class="game-select-empire pick-cat" aria-label="Famille">
          <option value="all">Toutes</option><option value="tabac">Tabac</option><option value="alcool">Boissons</option><option value="drogue">Substances</option><option value="actrice">VIP</option>
          <option value="beauf">Terroirs</option><option value="foot">Football</option><option value="refs">Mèmes</option><option value="chanteur">Musique</option><option value="culte">Culte</option><option value="saison">Saison</option>
        </select>
      </div>
      <p class="pick-count"></p>
      <div class="cards-grid pick-grid"></div>
      <button type="button" class="btn-empire btn-empire-secondary pick-more hidden">Voir plus de cartes</button>`;
    const q = container.querySelector('.pick-search'), sortSel = container.querySelector('.pick-sort'), catSel = container.querySelector('.pick-cat');
    const grid = container.querySelector('.pick-grid'), more = container.querySelector('.pick-more'), count = container.querySelector('.pick-count');
    const PAGE = 48; let list = [], shown = 0;
    const draw = () => {
      const chunk = list.slice(shown, shown + PAGE);
      chunk.forEach(item => {
        const card = buildCard(item, { quantity: inventory[item.id] || 0, compact: true, onClick: opts.onClick });
        grid.appendChild(card);
      });
      shown += chunk.length;
      more.classList.toggle('hidden', shown >= list.length);
    };
    const refresh = () => {
      const term = q.value.trim().toLowerCase(), cat = catSel.value;
      list = items.filter(i => (!term || i.name.toLowerCase().includes(term)) && (cat === 'all' || (cat === 'tabac' ? (i.cat === 'cigarette' || i.cat === 'briquet') : i.cat === cat)));
      const by = sortSel.value;
      if (by === 'bonus') list.sort((a, b) => (b[bonusKey] || 0) - (a[bonusKey] || 0));
      else if (by === 'rarity') list.sort((a, b) => (RO[b.rarity] || 0) - (RO[a.rarity] || 0) || (b[bonusKey] || 0) - (a[bonusKey] || 0));
      else if (by === 'value') list.sort((a, b) => (b.value || 0) - (a.value || 0));
      else list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      grid.innerHTML = ''; shown = 0;
      count.textContent = list.length ? `${list.length} carte${list.length > 1 ? 's' : ''}` : 'Aucune carte ne correspond.';
      draw();
    };
    q.addEventListener('input', refresh); sortSel.addEventListener('change', refresh); catSel.addEventListener('change', refresh);
    more.addEventListener('click', draw);
    refresh();
  }


  // Image de carte qui ne charge pas (réseau mobile capricieux) : on réessaie 2 fois avant d'afficher l'emblème de secours
  function imgFail(img) {
    const n = +(img.dataset.retry || 0);
    if (n < 2) {
      img.dataset.retry = n + 1;
      setTimeout(() => { try { const u = new URL(img.getAttribute('src'), location.href); u.searchParams.set('r', n + 1); img.src = u.href; } catch (e) {} }, 1500 * (n + 1));
      return;
    }
    img.onerror = null; img.style.display = 'none';
    const fb = img.parentElement && img.parentElement.querySelector('.card-collector-fallback'); if (fb) fb.style.display = 'flex';
  }

  return {
    buildPicker,
    imgFail,
    buildCard,
    buildGrid,
    buildRevealCard,
    openCardModal,
    buildCollectorEmblem,
    resolveCardPhoto,
    RARITY_CONFIG,
    CAT_CONFIG,
  };
})();
