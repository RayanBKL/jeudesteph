// ============================================================
// THE ASHTRAY KING — UI Layer (Zero Emojis, Real Cigarette Render)
// Navigation, Inventory, Modals, Toasts, HUD Icons
// ============================================================

let currentPage = 'course';

function initAllIcons() {
  const iconMappings = {
    'icon-hud-money': 'euro',
    'icon-hud-packs': 'pack',
    'icon-hud-level': 'bolt',
    'icon-settings': 'settings',
    'icon-page-course': 'race',
    'icon-page-paquets': 'pack',
    'icon-page-inv': 'inventory',
    'icon-page-marche': 'market',
    'icon-page-bourse': 'bourse',
    'icon-page-casino': 'casino',
    'icon-page-amis': 'friends',
    'icon-page-classements': 'trophy',
    'nav-icon-course': 'race',
    'nav-icon-paquets': 'pack',
    'nav-icon-inventaire': 'inventory',
    'nav-icon-marche': 'market',
    'nav-icon-bourse': 'bourse',
    'nav-icon-casino': 'casino',
    'nav-icon-amis': 'friends',
    'nav-icon-classements': 'trophy',
    'icon-tr-trottoir': 'trottoir',
    'icon-tr-boulevard': 'boulevard',
    'icon-tr-autoroute': 'autoroute',
    'icon-flame': 'flame',
  };

  Object.entries(iconMappings).forEach(([elId, iconName]) => {
    const el = document.getElementById(elId);
    if (el && !el.hasChildNodes()) {
      el.innerHTML = getIcon(iconName);
    }
  });

  document.querySelectorAll('.lock-svg').forEach(el => {
    if (!el.hasChildNodes()) el.innerHTML = getIcon('lock');
  });
}

function showPage(pageId) {
  if (pageId === 'course' || pageId === 'home') pageId = 'clicker';

  if (typeof EmpireManager !== 'undefined' && EmpireManager.navigateTo) {
    EmpireManager.navigateTo(pageId);
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
    p.style.display = '';
  });

  // Handle race & result as fixed overlays
  if (pageId === 'race') {
    const rp = document.getElementById('page-race');
    if (rp) { rp.classList.remove('hidden'); rp.classList.add('active'); rp.style.display = 'flex'; }
    return;
  }
  if (pageId === 'resultat') {
    const rp = document.getElementById('page-resultat');
    if (rp) { rp.classList.remove('hidden'); rp.classList.add('active'); rp.style.display = 'flex'; }
    return;
  }

  // Remove race overlay
  const raceEl = document.getElementById('page-race');
  const resultEl = document.getElementById('page-resultat');
  if (raceEl) { raceEl.classList.remove('active'); raceEl.classList.add('hidden'); raceEl.style.display = ''; }
  if (resultEl) { resultEl.classList.remove('active'); resultEl.classList.add('hidden'); resultEl.style.display = ''; }

  // Show target page
  const target = document.getElementById('page-' + pageId) || document.getElementById('page-clicker');
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
    target.style.display = 'block';
  }

  // Update nav
  document.querySelectorAll('.nav-btn, .bottom-nav-btn').forEach(btn => {
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
  if (window.SoundFX) SoundFX.click();
  switch (pageId) {
    case 'course':     renderCoursePageFull(); break;
    case 'paquets':    renderFreePackBanner(); break;
    case 'inventaire': renderInventory(); break;
    case 'talents':    if (typeof TalentsEngine !== 'undefined') TalentsEngine.render(); else renderSkillTree(); break;
    case 'multi':      if (typeof MultiplayerEngine !== 'undefined') MultiplayerEngine.render(); break;
    case 'marche':     Market.renderMarket(); break;
    case 'bourse':     Bourse.render(); break;
    case 'casino':     Casino.render(); break;
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
  updatePaddock();
}

function updatePaddock() {
  const lvlEl = document.getElementById('paddock-level');
  const spdEl = document.getElementById('paddock-speed-boost');
  const cghEl = document.getElementById('paddock-cough-reduce');
  const strkEl = document.getElementById('paddock-streak');
  const spchEl = document.getElementById('paddock-speech');

  if (lvlEl) lvlEl.textContent = GameState.level || 1;
  if (strkEl) strkEl.textContent = GameState.goldStreak || 0;

  const equipped = (typeof getEquippedCigs === 'function') ? getEquippedCigs() : [];
  let totalSpeed = 0;
  let totalCough = 0;
  equipped.forEach(c => {
    totalSpeed += c.speed || RARITIES[c.rarity]?.energy || 10;
    totalCough += c.cough || RARITIES[c.rarity]?.cough || 10;
  });

  if (spdEl) spdEl.textContent = `+${totalSpeed} km/h`;
  if (cghEl) cghEl.textContent = `-${Math.min(60, totalCough)}%`;

  if (spchEl) {
    const quotes = [
      "Mes poumons sont chauds, fais fumer le bitume !",
      "Donne-moi une bonne clope et je dépose Gégé !",
      "Un paquet dans la poche et c'est la victoire assurée !",
      "Regarde la concurrence, ils toussent déjà au départ !"
    ];
    spchEl.textContent = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
  }
}

function renderTrackSelector() {
  const cards = document.querySelectorAll('.track-card');
  cards.forEach(card => {
    const trackId = card.dataset.track;
    const track = TRACKS[trackId];
    if (!track) return;

    card.classList.remove('locked');
    card.classList.toggle('active', trackId === GameState.selectedTrack);
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
        <div class="slot-real-cig">${renderRealCigaretteHTML(cig, 'slot')}</div>
        <div class="slot-cig-rarity" style="color:${rarityColor(cig.rarity)}">${RARITIES[cig.rarity]?.name || ''}</div>
        <div class="slot-remove" title="Retirer">✕</div>
      `;
      slot.querySelector('.slot-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        unequipSlot(i);
        renderEquipmentSlots();
      });
    } else {
      slot.innerHTML = `<div style="font-size:1.6rem;line-height:1;color:var(--text-dim)">+</div><div style="font-size:0.65rem;color:var(--text-dim)">Vide</div>`;
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
    <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--accent);margin-bottom:16px">Équiper une cigarette</h3>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto">
      ${sorted.map(e => {
        const rarity = RARITIES[e.cig.rarity];
        return `
          <div class="equip-choice" data-cig="${e.cig.id}" style="
            display:flex;align-items:center;gap:12px;
            background:var(--bg-surface);border:1px solid ${rarity?.color || 'var(--border)'};
            border-radius:var(--r-md);padding:10px 14px;cursor:pointer;
            transition:transform 0.1s;
          ">
            <div style="width:70px">${renderRealCigaretteHTML(e.cig, 'slot')}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:0.9rem">${e.cig.name} ${e.count > 1 ? `<span style="color:var(--accent)">×${e.count}</span>` : ''}</div>
              <div style="font-size:0.72rem;color:${rarity?.color}">${rarity?.name || ''}</div>
              <div style="font-size:0.7rem;color:var(--text-dim)">Énergie +${rarity?.energy || 0} · Toux +${rarity?.cough || 0}</div>
            </div>
          </div>
        `;
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
    grid.innerHTML = '<div class="empty-state"><p>Aucune cigarette ici. Ouvrez des paquets !</p></div>';
  } else {
    grid.innerHTML = inv.map(e => {
      const rarity = RARITIES[e.cig.rarity];
      const isEquipped = GameState.equippedSlots.includes(e.cig.id);
      const rColor = rarityColor(e.cig.rarity);

      return `
        <div class="inv-card rarity-${e.cig.rarity}" data-cig="${e.cig.id}" style="border-color:${rColor}">
          ${e.count > 1 ? `<div class="cig-count">×${e.count}</div>` : ''}
          ${isEquipped ? `<div style="position:absolute;top:4px;left:4px;font-size:0.6rem;background:var(--green);border-radius:3px;padding:1px 4px;color:#000;font-weight:700">ÉQUIPÉ</div>` : ''}
          <div class="inv-cig-visual-wrap">
            ${renderRealCigaretteHTML(e.cig, 'card')}
          </div>
          <div class="cig-value">${fmt(getBoursePrice(e.cig.id))}</div>
        </div>
      `;
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
      return `
        <div class="series-badge ${complete ? 'complete' : ''}" title="${owned}/${seriesCigs.length} cigarettes">
          <span class="series-badge-status">${complete ? 'COMPLÈTE' : `${owned}/${seriesCigs.length}`}</span>
          <span class="series-badge-name">${series.name}</span>
        </div>
      `;
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
  const rColor = rarityColor(cig.rarity);

  openModal(`
    <div class="modal-cig-showcase">
      ${renderRealCigaretteHTML(cig, 'card')}
      <div class="modal-cig-name" style="margin-top:10px">${cig.name}</div>
      <div class="modal-cig-rarity" style="color:${rColor}">${rarity?.name || ''} · ${SERIES[cig.series]?.name || ''}</div>
    </div>
    <p class="modal-cig-quote">"${cig.desc || ''}"</p>
    <div class="modal-stats">
      <div class="modal-stat"><div class="modal-stat-val">×${entry.count}</div><div class="modal-stat-lbl">Possédées</div></div>
      <div class="modal-stat"><div class="modal-stat-val">${fmt(price)}</div><div class="modal-stat-lbl">Cours bourse</div></div>
      <div class="modal-stat"><div class="modal-stat-val">+${rarity?.energy || 0}</div><div class="modal-stat-lbl">Énergie</div></div>
      <div class="modal-stat"><div class="modal-stat-val">+${rarity?.cough || 0}</div><div class="modal-stat-lbl">Toux</div></div>
    </div>
    <div class="modal-actions">
      ${equippedInSlot >= 0
        ? `<button id="mb-unequip" class="btn-secondary">Déséquiper (Slot ${equippedInSlot+1})</button>`
        : `<button id="mb-equip" class="btn-primary">Équiper en course</button>`
      }
      <button id="mb-sell-game" class="btn-secondary">Vendre au jeu (${fmt(sellPrice)})</button>
      <button id="mb-sell-market" class="btn-secondary">Mettre sur mon étal</button>
    </div>
  `);

  document.getElementById('mb-equip')?.addEventListener('click', () => {
    const emptySlot = GameState.equippedSlots.findIndex(s => !s);
    if (emptySlot < 0) { showToast('Tous les slots sont remplis !', 'error'); return; }
    equipCig(cigId, emptySlot);
    closeModal();
    renderEquipmentSlots();
    showToast(`${cig.name} équipée`, 'success');
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
    showToast(`Vendu : +${fmt(sellPrice)}`, 'success');
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
// Photo et pseudo modifiables
function bindProfileEditing() {
  const img = document.getElementById('prof-avatar-img');
  if (img && typeof PlayerProfile !== 'undefined') img.src = PlayerProfile.getAvatar();

  const input = document.getElementById('prof-avatar-input');
  const form = document.getElementById('prof-pseudo-form');
  const field = document.getElementById('prof-pseudo-input');
  const editBtn = document.getElementById('btn-edit-pseudo');
  const cancelBtn = document.getElementById('btn-cancel-pseudo');
  const msg = document.getElementById('prof-pseudo-msg');
  const showMsg = (text, isError) => {
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'profile-form-msg' + (isError ? ' is-error' : '');
  };
  if (!input || input.dataset.bound) return;
  input.dataset.bound = '1';

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      await PlayerProfile.setAvatarFromFile(file);
      showToast('Photo de profil mise à jour !', 'success');
    } catch (e) {
      if (!e.cancelled) showToast(e.message, 'error');
    }
  });

  editBtn?.addEventListener('click', () => {
    form.classList.remove('hidden');
    field.value = GameState.pseudo || '';
    field.focus();
    field.select();
    msg?.classList.add('hidden');
  });
  cancelBtn?.addEventListener('click', () => form.classList.add('hidden'));
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await PlayerProfile.setPseudo(field.value);
    if (!res.ok) return showMsg(res.msg, true);
    form.classList.add('hidden');
    showMsg('Pseudo enregistré.', false);
  });
}

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

  // Progression : celle de l'Empire (clicker), pas l'ancien niveau de course
  const emp = (typeof ClickerEngine !== 'undefined' && ClickerEngine.getState) ? ClickerEngine.getState() : null;
  const level = emp ? emp.empireLevel : GameState.level;
  const xp = emp ? Math.floor(emp.empireXP) : GameState.xp;
  const neededXP = emp ? emp.empireXPToNext : (LEVEL_XP[GameState.level - 1] || 999);

  if (ps) ps.textContent = GameState.pseudo;
  if (pr) pr.textContent = getLevelTitle(level);
  if (xpFill) xpFill.style.width = Math.min(100, (xp / neededXP) * 100) + '%';
  if (xpText) xpText.textContent = `Empire Niv. ${level} · ${xp.toLocaleString('fr-FR')} / ${neededXP.toLocaleString('fr-FR')} XP`;

  const money = emp ? emp.cash : GameState.money;
  if (psMoney) psMoney.textContent = (typeof ClickerEngine !== 'undefined' ? ClickerEngine.formatCash(money) : Math.floor(money)) + ' €';
  if (psRaces) psRaces.textContent = GameState.totalRaces;
  if (psWins) psWins.textContent = GameState.totalWins;
  const inv = (typeof EmpireManager !== 'undefined' && EmpireManager.getInventory) ? EmpireManager.getInventory() : {};
  if (psCigs) psCigs.textContent = Object.values(inv).filter(q => q > 0).length;

  bindProfileEditing();
  if (skillPts) {
    // Points de l'arbre des talents (1 par niveau d'Empire)
    if (typeof TalentsEngine !== 'undefined' && TalentsEngine.getState) {
      TalentsEngine.syncPointsWithPlayer();
      const pts = TalentsEngine.getState().pointsAvailable;
      skillPts.textContent = pts + (pts > 1 ? ' pts' : ' pt');
    } else {
      skillPts.textContent = GameState.skillPoints + ' pts';
    }
  }

  if (skillsGrid) {
    skillsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 12px; background: rgba(0,0,0,0.3); border-radius: var(--r-md); border: 1px dashed var(--border);">
        <p style="margin-bottom: 8px; font-size: 0.85rem; color: var(--text-dim);">L'arbre de compétences complet est désormais disponible dans l'onglet dédié !</p>
        <button class="btn-primary btn-sm" onclick="showPage('talents')">Ouvrir l'Arbre des Talents ➔</button>
      </div>
    `;
  }
}

// ============================================================
// ARBRE DE COMPÉTENCES (SKILL TREE - 4 BRANCHES RPG)
// ============================================================
function renderSkillTree() {
  const container = document.getElementById('skill-tree-container');
  const ptsEl = document.getElementById('tree-skill-pts');
  const resetBtn = document.getElementById('btn-reset-skills');

  if (ptsEl) {
    ptsEl.textContent = `${GameState.skillPoints} pts`;
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetSkills();
    };
  }

  if (!container) return;

  const branches = typeof SKILL_TREE_BRANCHES !== 'undefined' ? SKILL_TREE_BRANCHES : [];

  container.innerHTML = branches.map(branch => {
    const branchSkillsHtml = branch.skills.map(skill => {
      const currentLevel = (GameState.skills && GameState.skills[skill.id]) || 0;
      const maxed = currentLevel >= skill.maxLevel;
      const canAfford = GameState.skillPoints >= skill.cost;
      const progressPct = Math.round((currentLevel / skill.maxLevel) * 100);

      return `
        <div class="tree-node-card ${maxed ? 'node-maxed' : currentLevel > 0 ? 'node-active' : ''}" style="--b-color: ${branch.color}">
          <div class="node-header">
            <span class="node-icon">${skill.icon}</span>
            <div class="node-title-box">
              <span class="node-title">${skill.name}</span>
              <span class="node-lvl-tag">${currentLevel} / ${skill.maxLevel}</span>
            </div>
          </div>
          <div class="node-progress-bar">
            <div class="node-progress-fill" style="width: ${progressPct}%; background: ${branch.color}"></div>
          </div>
          <p class="node-desc">${skill.desc}</p>
          <div class="node-effect-tag">${skill.effect}</div>
          <button class="btn-node-upgrade ${maxed ? 'btn-maxed' : canAfford ? 'btn-available' : 'btn-disabled'}"
                  data-skill="${skill.id}"
                  ${maxed || !canAfford ? 'disabled' : ''}>
            ${maxed ? '★ MAXÉ' : `Améliorer (${skill.cost} pt${skill.cost > 1 ? 's' : ''})`}
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="tree-branch-col" style="--branch-theme: ${branch.color}">
        <div class="tree-branch-header">
          <span class="branch-icon">${branch.icon}</span>
          <div>
            <h3 class="branch-title">${branch.name}</h3>
            <span class="branch-desc">${branch.desc}</span>
          </div>
        </div>
        <div class="tree-nodes-list">
          ${branchSkillsHtml}
        </div>
      </div>
    `;
  }).join('');

  // Attach button events
  container.querySelectorAll('.btn-node-upgrade:not(:disabled)').forEach(btn => {
    btn.onclick = () => {
      const sId = btn.dataset.skill;
      upgradeSkill(sId);
    };
  });
}

// Audio toggle button handler
function initAudioButton() {
  const btn = document.getElementById('btn-audio-toggle');
  const icon = document.getElementById('icon-audio');
  if (!btn || !icon) return;

  const updateIcon = () => {
    icon.textContent = SoundFX.enabled ? '🔊' : '🔇';
    btn.classList.toggle('audio-muted', !SoundFX.enabled);
  };

  btn.onclick = () => {
    SoundFX.toggle();
    updateIcon();
  };

  updateIcon();
}

window.renderSkillTree = renderSkillTree;
window.initAudioButton = initAudioButton;

// ============================================================
// MODAL & TOASTS
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

function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
