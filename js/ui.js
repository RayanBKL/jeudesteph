// ============================================================
// STÉPHANE — UI Layer (modals, toasts, pages, inventory render)
// ============================================================

// ============================================================
// PAGE NAVIGATION
// ============================================================
let currentPage = 'course';

function showPage(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = '';
  });

  // Handle race & result as fixed overlays
  if (pageId === 'race') {
    const rp = document.getElementById('page-race');
    if (rp) { rp.classList.add('active'); rp.style.display = 'flex'; }
    return;
  }
  if (pageId === 'resultat') {
    const rp = document.getElementById('page-resultat');
    if (rp) { rp.classList.add('active'); rp.style.display = 'flex'; }
    return;
  }

  // Remove race overlay
  const raceEl = document.getElementById('page-race');
  const resultEl = document.getElementById('page-resultat');
  if (raceEl) { raceEl.classList.remove('active'); raceEl.style.display = ''; }
  if (resultEl) { resultEl.classList.remove('active'); resultEl.style.display = ''; }

  // Show target page
  const target = document.getElementById('page-' + pageId);
  if (target) { target.classList.add('active'); }

  // Update nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });

  currentPage = pageId;

  // Scroll to top
  const content = document.getElementById('game-content');
  if (content) content.scrollTop = 0;

  // Trigger page-specific render
  onPageEnter(pageId);
}

function onPageEnter(pageId) {
  switch (pageId) {
    case 'course':     renderCoursePageFull(); break;
    case 'paquets':    renderFreePackBanner(); break;
    case 'inventaire': renderInventory(); break;
    case 'marche':     Market.renderMarket(); break;
    case 'bourse':     Bourse.render(); break;
    case 'casino':     Casino.render(); break;
    case 'amis':       Friends.render(); break;
    case 'classements':Leaderboard.render(); break;
    case 'profil':     renderProfile(); break;
  }
}

// ============================================================
// COURSE PAGE
// ============================================================
function renderCoursePageFull() {
  renderTrackSelector();
  renderEquipmentSlots();
  renderStreakDisplay();
  renderDailyInfo();
}

function renderTrackSelector() {
  const cards = document.querySelectorAll('.track-card');
  cards.forEach(card => {
    const trackId = card.dataset.track;
    const track = TRACKS[trackId];
    if (!track) return;

    const locked = GameState.level < track.unlockLevel;
    card.classList.toggle('locked', locked);
    card.classList.toggle('active', trackId === GameState.selectedTrack && !locked);
  });
}

function renderEquipmentSlots() {
  const container = document.getElementById('cigarette-slots');
  const infoEl = document.getElementById('slot-info');
  if (!container) return;

  const maxSlots = getMaxSlots();
  while (GameState.equippedSlots.length < maxSlots) GameState.equippedSlots.push(null);

  const equipped = GameState.equippedSlots.filter(Boolean).length;
  if (infoEl) infoEl.textContent = `(${equipped}/${maxSlots} équipées)`;

  container.innerHTML = '';
  for (let i = 0; i < maxSlots; i++) {
    const cigId = GameState.equippedSlots[i];
    const entry = cigId ? GameState.inventory[cigId] : null;
    const cig = entry?.cig;

    const slot = document.createElement('div');
    slot.className = 'cig-slot' + (cig ? ` filled rarity-${cig.rarity}` : ' empty');
    slot.dataset.slot = i;

    if (cig) {
      slot.innerHTML = `
        <div class="slot-cig-icon">${cig.icon || '🚬'}</div>
        <div class="slot-cig-name">${cig.name}</div>
        <div class="slot-cig-rarity" style="color:${rarityColor(cig.rarity)}">${(RARITIES[cig.rarity]?.name || '').slice(0,6)}</div>
        <div class="slot-remove" title="Retirer">✕</div>
      `;
      slot.querySelector('.slot-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        unequipSlot(i);
        renderEquipmentSlots();
      });
    } else {
      slot.innerHTML = `<div style="font-size:1.6rem">+</div><div style="font-size:0.65rem">Vide</div>`;
      slot.addEventListener('click', () => openEquipModal(i));
    }

    container.appendChild(slot);
  }
}

function openEquipModal(slotIndex) {
  const inv = getInventoryArray();
  if (!inv.length) {
    showToast('Aucune cigarette dans votre inventaire !', 'error');
    return;
  }

  const sorted = [...inv].sort((a, b) => {
    const ro = ['commune','peu-commune','rare','epique','legendaire','mythique'];
    return ro.indexOf(b.cig.rarity) - ro.indexOf(a.cig.rarity);
  });

  openModal(`
    <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--accent);margin-bottom:16px">🚬 Choisir une cigarette</h3>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto">
      ${sorted.map(e => {
        const rarity = RARITIES[e.cig.rarity];
        return `<div class="equip-choice" data-cig="${e.cig.id}" style="
          display:flex;align-items:center;gap:12px;
          background:var(--bg-surface);border:2px solid ${rarity?.color || 'var(--border)'};
          border-radius:var(--r-md);padding:12px;cursor:pointer;
          transition:transform 0.1s;
        ">
          <span style="font-size:2rem">${e.cig.icon || '🚬'}</span>
          <div style="flex:1">
            <div style="font-weight:700">${e.cig.name} ${e.count > 1 ? `<span style="color:var(--accent)">×${e.count}</span>` : ''}</div>
            <div style="font-size:0.72rem;color:${rarity?.color}">${rarity?.name || ''}</div>
            <div style="font-size:0.7rem;color:var(--text-dim)">⚡ +${rarity?.energy || 0} · 😷 +${rarity?.cough || 0}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `);

  document.querySelectorAll('.equip-choice').forEach(el => {
    el.addEventListener('click', () => {
      equipCig(el.dataset.cig, slotIndex);
      closeModal();
      renderEquipmentSlots();
    });
  });
}

function renderStreakDisplay() {
  const el = document.getElementById('gold-streak');
  const bonus = document.getElementById('bonus-indicator');
  if (el) el.textContent = GameState.goldStreak;
  if (bonus) bonus.classList.toggle('hidden', !GameState.pendingStreakBonus);
}

function renderDailyInfo() {
  const el = document.getElementById('daily-races');
  const warn = document.getElementById('half-gain-warn');
  if (el) el.textContent = GameState.dailyRaces;
  if (warn) warn.classList.toggle('hidden', GameState.dailyRaces <= GAME_CONST.MAX_DAILY_SOLO);
}

// ============================================================
// INVENTORY
// ============================================================
function renderInventory() {
  const grid = document.getElementById('inv-grid');
  const seriesGrid = document.getElementById('series-grid');
  if (!grid) return;

  const sort = document.getElementById('inv-sort')?.value || 'rarity';
  const filter = document.getElementById('inv-filter')?.value || 'all';

  let inv = getInventoryArray();
  if (filter !== 'all') inv = inv.filter(e => e.cig.rarity === filter);

  const ro = ['commune','peu-commune','rare','epique','legendaire','mythique'];
  if (sort === 'rarity') inv.sort((a,b) => ro.indexOf(b.cig.rarity) - ro.indexOf(a.cig.rarity));
  else if (sort === 'value') inv.sort((a,b) => getBoursePrice(b.cig.id) - getBoursePrice(a.cig.id));
  else inv.sort((a,b) => a.cig.name.localeCompare(b.cig.name));

  if (!inv.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🚬</div><p>Aucune cigarette ici. Ouvrez des paquets !</p></div>';
  } else {
    grid.innerHTML = inv.map(e => {
      const rarity = RARITIES[e.cig.rarity];
      const isEquipped = GameState.equippedSlots.includes(e.cig.id);
      return `<div class="inv-card rarity-${e.cig.rarity}" data-cig="${e.cig.id}">
        ${e.count > 1 ? `<div class="cig-count">×${e.count}</div>` : ''}
        ${isEquipped ? `<div style="position:absolute;top:4px;left:4px;font-size:0.6rem;background:var(--green);border-radius:3px;padding:1px 4px;color:#000;font-weight:700">EQ</div>` : ''}
        <div class="cig-icon">${e.cig.icon || '🚬'}</div>
        <div class="cig-name">${e.cig.name}</div>
        <div class="cig-rarity-label" style="color:${rarity?.color}">${rarity?.name || ''}</div>
        <div class="cig-value">${fmt(getBoursePrice(e.cig.id))}</div>
      </div>`;
    }).join('');

    // Click for detail
    grid.querySelectorAll('.inv-card').forEach(card => {
      card.addEventListener('click', () => openCigModal(card.dataset.cig));
    });
  }

  // Series
  if (seriesGrid) {
    seriesGrid.innerHTML = Object.entries(SERIES).map(([id, series]) => {
      const complete = GameState.seriesCompleted.includes(id);
      const seriesCigs = CIGARETTES.filter(c => c.series === id);
      const owned = seriesCigs.filter(c => GameState.inventory[c.id]?.count > 0).length;
      return `<div class="series-badge ${complete ? 'complete' : ''}" title="${owned}/${seriesCigs.length} cigarettes">
        ${complete ? '✅' : '📦'} ${series.name} (${owned}/${seriesCigs.length})
      </div>`;
    }).join('');
  }
}

function openCigModal(cigId) {
  const entry = GameState.inventory[cigId];
  if (!entry) return;
  const cig = entry.cig;
  const rarity = RARITIES[cig.rarity];
  const price = getBoursePrice(cigId);
  const sellPrice = Math.round(price * GAME_CONST.GAME_MARKET_SELL_RATIO);
  const equippedInSlot = GameState.equippedSlots.findIndex(s => s === cigId);

  openModal(`
    <div class="modal-cig-header">
      <div class="modal-cig-icon">${cig.icon || '🚬'}</div>
      <div class="modal-cig-name">${cig.name}</div>
      <div class="modal-cig-rarity" style="color:${rarity?.color}">${rarity?.name || ''}</div>
    </div>
    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;text-align:center">"${cig.desc || ''}"</p>
    <div class="modal-stats">
      <div class="modal-stat"><div class="modal-stat-val">×${entry.count}</div><div class="modal-stat-lbl">Possédées</div></div>
      <div class="modal-stat"><div class="modal-stat-val">${fmt(price)}</div><div class="modal-stat-lbl">Prix bourse</div></div>
      <div class="modal-stat"><div class="modal-stat-val">+${rarity?.energy || 0}</div><div class="modal-stat-lbl">Énergie</div></div>
      <div class="modal-stat"><div class="modal-stat-val">+${rarity?.cough || 0}</div><div class="modal-stat-lbl">Toux</div></div>
    </div>
    <div class="modal-actions">
      ${equippedInSlot >= 0
        ? `<button id="mb-unequip" class="btn-secondary">Déséquiper (slot ${equippedInSlot+1})</button>`
        : `<button id="mb-equip" class="btn-primary">🚬 Équiper en course</button>`
      }
      <button id="mb-sell-game" class="btn-secondary">💸 Vendre au jeu (${fmt(sellPrice)})</button>
      <button id="mb-sell-market" class="btn-secondary">🏪 Mettre en vente</button>
    </div>
  `);

  document.getElementById('mb-equip')?.addEventListener('click', () => {
    // Find first empty slot
    const emptySlot = GameState.equippedSlots.findIndex(s => !s);
    if (emptySlot < 0) { showToast('Tous les slots sont remplis !', 'error'); return; }
    equipCig(cigId, emptySlot);
    closeModal();
    renderEquipmentSlots();
    showToast(`🚬 ${cig.name} équipée !`, 'success');
  });

  document.getElementById('mb-unequip')?.addEventListener('click', () => {
    unequipSlot(equippedInSlot);
    closeModal();
    renderEquipmentSlots();
    showToast('Déséquipée', 'success');
  });

  document.getElementById('mb-sell-game')?.addEventListener('click', () => {
    removeCigarette(cigId, 1);
    earnMoney(sellPrice);
    recordSale(cigId, sellPrice);
    closeModal();
    renderInventory();
    showToast(`💸 Vendu : +${fmt(sellPrice)}`, 'success');
  });

  document.getElementById('mb-sell-market')?.addEventListener('click', () => {
    closeModal();
    showPage('marche');
    setTimeout(() => {
      Market.currentTab = 'mon';
      document.querySelectorAll('.market-tab').forEach(t => t.classList.toggle('active', t.dataset.mtab === 'mon'));
      Market.renderMarket();
    }, 200);
  });
}

// ============================================================
// PROFILE
// ============================================================
function renderProfile() {
  const ps = document.getElementById('prof-pseudo');
  const pr = document.getElementById('prof-rank');
  const xpText = document.getElementById('xp-text');
  const xpFill = document.getElementById('xp-fill');
  const psMoney = document.getElementById('ps-money');
  const psRaces = document.getElementById('ps-races');
  const psWins = document.getElementById('ps-wins');
  const psCigs = document.getElementById('ps-cigs');
  const skillPts = document.getElementById('skill-pts');
  const skillsGrid = document.getElementById('skills-grid');

  if (ps) ps.textContent = GameState.pseudo;
  if (pr) pr.textContent = getLevelTitle(GameState.level);

  const neededXP = LEVEL_XP[GameState.level - 1] || 999;
  const pct = Math.min(100, (GameState.xp / neededXP) * 100);
  if (xpFill) xpFill.style.width = pct + '%';
  if (xpText) xpText.textContent = `${GameState.xp} / ${neededXP} XP · Niv. ${GameState.level}`;

  if (psMoney) psMoney.textContent = fmt(GameState.money);
  if (psRaces) psRaces.textContent = GameState.totalRaces;
  if (psWins) psWins.textContent = GameState.totalWins;
  if (psCigs) psCigs.textContent = Object.values(GameState.inventory).reduce((s,e) => s + e.count, 0);
  if (skillPts) skillPts.textContent = GameState.skillPoints + ' pts';

  if (skillsGrid) {
    skillsGrid.innerHTML = SKILLS_DEF.map(skill => {
      const currentLevel = GameState.skills[skill.id] || 0;
      const maxed = currentLevel >= skill.maxLevel;
      return `<div class="skill-card">
        <div class="sk-icon">${skill.icon}</div>
        <div class="sk-name">${skill.name}</div>
        <div class="sk-desc">${skill.desc}</div>
        <div class="sk-level">${currentLevel}/${skill.maxLevel}</div>
        <button class="btn-primary btn-upgrade" data-skill="${skill.id}" ${maxed ? 'disabled' : ''}>
          ${maxed ? '✅ Max' : `⬆️ (1 pt)`}
        </button>
      </div>`;
    }).join('');

    skillsGrid.querySelectorAll('.btn-upgrade:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        upgradeSkill(btn.dataset.skill);
        renderProfile();
      });
    });
  }
}

// ============================================================
// MODAL
// ============================================================
function openModal(html) {
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  if (!overlay || !body) return;
  body.innerHTML = html;
  overlay.classList.remove('hidden');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('hidden');
}

// ============================================================
// TOASTS
// ============================================================
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
