// ============================================================
// THE ASHTRAY KING — Marché du Jour & Bourse (Zero Emojis)
// 24h Daily Reset, Seeded per Player, Realistic Drop Rates
// ============================================================

const Market = {
  currentTab: 'jour',
  boughtToday: {},

  renderMarket() {
    const content = document.getElementById('market-content');
    if (!content) return;

    // Set up tab events
    document.querySelectorAll('.market-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.market-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.mtab;
        this.renderMarket();
      };
    });

    switch (this.currentTab) {
      case 'jour':     this.renderDailyMarket(content); break;
      case 'mon':      this.renderMyMarket(content); break;
      case 'quartier': this.renderNeighborhoodMarket(content); break;
      case 'amis':     this.renderFriendsMarket(content); break;
      default:         this.renderDailyMarket(content); break;
    }
  },

  // ============================================================
  // MARCHÉ DU JOUR (Official 24h Daily Reset, Seeded per User)
  // ============================================================
  renderDailyMarket(content) {
    const stock = this.getDailyMarketStock();
    const timeLeft = this.getTimeUntilMidnight();
    const hrs = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);
    const secs = Math.floor((timeLeft % 60000) / 1000);

    let html = `
      <div class="market-daily-banner">
        <div class="mdb-title">
          <strong>Sélection Officielle du Jour</strong>
          <p>Catalogue unique réassorti chaque jour à minuit. Taux d'apparition stricts.</p>
        </div>
        <div class="game-timer-pill">
          <span class="icon-inline">${getIcon('clock')}</span>
          <span>Prochain réassort : <strong>${hrs}h ${mins}m ${secs}s</strong></span>
        </div>
      </div>
      <div class="market-list-grid">
    `;

    stock.forEach((item, i) => {
      const basePrice = Math.round(getBoursePrice(item.id) * GAME_CONST.GAME_MARKET_BUY_RATIO);
      const discount = item.discount || 0;
      const price = discount > 0 ? Math.round(basePrice * (1 - discount / 100)) : basePrice;
      const isBought = this.boughtToday[item.id];
      const rColor = rarityColor(item.rarity);
      const rName = RARITIES[item.rarity]?.name || item.rarity;
      const resolvedImg = resolveCigaretteImage(item);
      const stickerGraphic = resolvedImg
        ? `<img src="${resolvedImg}" alt="${item.name}" class="ml-sticker-img" />`
        : generateCleanCigaretteSVG(item);

      html += `
        <div class="market-listing-card rarity-${item.rarity}" style="border-color:${rColor}">
          ${item.badge ? `<div class="ml-promo-badge">${item.badge}</div>` : ''}
          <div class="ml-cig-preview">
            <div class="ml-sticker-box">
              ${stickerGraphic}
            </div>
          </div>
          <div class="ml-body">
            <div class="ml-header">
              <span class="ml-name">${item.name}</span>
              <span class="ml-rarity-badge" style="color:${rColor}">${rName}</span>
            </div>
            <div class="ml-series">${SERIES[item.series]?.name || ''}</div>
            <div class="ml-desc">"${item.desc || ''}"</div>
            <div class="ml-footer">
              <div class="ml-price-tag">
                <span class="ml-price-val">${fmt(price)}</span>
                ${discount > 0 ? `<span class="ml-price-old">${fmt(basePrice)}</span>` : `<span class="ml-price-label">Bourse : ${fmt(getBoursePrice(item.id))}</span>`}
              </div>
              <button class="btn-primary btn-sm btn-daily-buy" data-idx="${i}" data-price="${price}" ${isBought ? 'disabled' : ''}>
                ${isBought ? 'Acheté' : 'Acheter'}
              </button>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    content.innerHTML = html;

    // Attach buy listeners
    content.querySelectorAll('.btn-daily-buy').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx);
        const price = parseInt(btn.dataset.price);
        const item = stock[idx];
        if (!item || this.boughtToday[item.id]) return;

        if (!spendMoney(price)) {
          showToast('Pas assez d\'argent !', 'error');
          return;
        }

        addCigarette(item);
        this.boughtToday[item.id] = true;
        showToast(`Acheté : ${item.name}`, 'success');
        this.renderDailyMarket(content);
      };
    });
  },

  getDailyMarketStock() {
    const list = (typeof CIGARETTES !== 'undefined' && Array.isArray(CIGARETTES) && CIGARETTES.length > 0)
      ? CIGARETTES
      : ((typeof window !== 'undefined' && window.CIGARETTES) || (typeof CIGARETTES_DB !== 'undefined' ? CIGARETTES_DB : []));

    if (!list || list.length === 0) return [];

    // Generate deterministic seed for the user for TODAY's date (YYYY-MM-DD)
    const todayStr = new Date().toISOString().slice(0, 10);
    const userKey = (GameState.pseudo || 'guest') + '_' + (GameState.userId || 'local') + '_' + todayStr;
    
    let hash = 0;
    for (let i = 0; i < userKey.length; i++) {
      hash = ((hash << 5) - hash) + userKey.charCodeAt(i);
      hash |= 0;
    }
    const rng = (typeof seededRng === 'function') ? seededRng(Math.abs(hash) + 1) : Math.random;

    // Draw 8 unique items with realistic tiers
    const stock = [];
    const usedIds = new Set();

    // 1 Épique guaranteed
    const epics = list.filter(c => c.rarity === 'epique');
    if (epics.length > 0) {
      const pick = epics[Math.floor(rng() * epics.length)];
      usedIds.add(pick.id);
      stock.push({ ...pick, discount: 20, badge: 'VENTE FLASH -20%' });
    }

    // 2 Rares guaranteed
    const rares = list.filter(c => c.rarity === 'rare' && !usedIds.has(c.id));
    for (let k = 0; k < 2 && rares.length > 0; k++) {
      const pick = rares[Math.floor(rng() * rares.length)];
      usedIds.add(pick.id);
      stock.push({ ...pick, discount: 15, badge: 'OFFRE DU JOUR' });
    }

    // 3 Peu-communes
    const uncommons = list.filter(c => c.rarity === 'peu-commune' && !usedIds.has(c.id));
    for (let k = 0; k < 3 && uncommons.length > 0; k++) {
      const pick = uncommons[Math.floor(rng() * uncommons.length)];
      usedIds.add(pick.id);
      stock.push({ ...pick, discount: 10, badge: 'IMPORT DIRECT' });
    }

    // 2 Communes
    const commons = list.filter(c => c.rarity === 'commune' && !usedIds.has(c.id));
    for (let k = 0; k < 2 && commons.length > 0; k++) {
      const pick = commons[Math.floor(rng() * commons.length)];
      usedIds.add(pick.id);
      stock.push({ ...pick, discount: 0, badge: 'ESSENTIEL' });
    }

    // Fill up to 8 if needed
    while (stock.length < 8) {
      const remaining = list.filter(c => !usedIds.has(c.id));
      if (!remaining.length) break;
      const pick = remaining[Math.floor(rng() * remaining.length)];
      usedIds.add(pick.id);
      stock.push(pick);
    }

    return stock;
  },

  getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  },

  // ============================================================
  // MON ÉTAL (Player's Personal Market Stall)
  // ============================================================
  renderMyMarket(content) {
    const maxSlots = GameState.marketSlots;
    const listings = GameState.myListings;

    let html = `
      <div class="my-market-header">
        <div>
          <strong>Mon Étal de Vente</strong>
          <p>Mettez en vente vos doubles auprès d'autres joueurs (Commission : 5%).</p>
        </div>
        <span class="badge">Emplacements : ${listings.length}/${maxSlots}</span>
      </div>
    `;

    // Sell form
    const inv = getInventoryArray().filter(e => !GameState.myListings.find(l => l.cigId === e.cig.id));
    if (inv.length && listings.length < maxSlots) {
      html += `
        <div class="sell-form-box">
          <select id="sel-sell-cig" class="game-select">
            <option value="">Sélectionner une cigarette...</option>
            ${inv.map(e => `<option value="${e.cig.id}">${e.cig.name} (${RARITIES[e.cig.rarity]?.name}) — Valeur bourse : ${fmt(getBoursePrice(e.cig.id))}</option>`).join('')}
          </select>
          <div class="sell-input-row">
            <input type="number" id="sell-price" class="game-input" placeholder="Prix de vente (€)" min="1" />
            <button id="btn-sell-cig" class="btn-primary">Mettre en vente</button>
          </div>
        </div>
      `;
    }

    if (listings.length === 0) {
      html += `<div class="market-empty-box">Votre étal est actuellement vide. Choisissez une cigarette à mettre en vente ci-dessus.</div>`;
    } else {
      html += `<div class="market-list-grid">`;
      listings.forEach(listing => {
        const cig = listing.cigData;
        const rColor = rarityColor(cig.rarity);
        html += `
          <div class="market-listing-card rarity-${cig.rarity}" style="border-color:${rColor}">
            <div class="ml-cig-preview">${renderRealCigaretteHTML(cig, 'card')}</div>
            <div class="ml-body">
              <div class="ml-header">
                <span class="ml-name">${cig.name}</span>
                <span class="ml-rarity-badge" style="color:${rColor}">${RARITIES[cig.rarity]?.name || ''}</span>
              </div>
              <div class="ml-footer">
                <div class="ml-price-tag">
                  <span class="ml-price-val">${fmt(listing.price)}</span>
                  <span class="ml-price-label">En vente</span>
                </div>
                <button class="btn-secondary btn-sm btn-market-remove" data-listing="${listing.id}">Retirer</button>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    content.innerHTML = html;

    const sellBtn = document.getElementById('btn-sell-cig');
    if (sellBtn) sellBtn.onclick = () => this.listCig();

    content.querySelectorAll('.btn-market-remove').forEach(btn => {
      btn.onclick = () => this.removeListing(btn.dataset.listing);
    });
  },

  listCig() {
    const cigId = document.getElementById('sel-sell-cig')?.value;
    const priceInput = document.getElementById('sell-price')?.value;
    if (!cigId) return showToast('Sélectionnez une cigarette', 'error');
    const price = parseInt(priceInput);
    if (!price || price < 1) return showToast('Prix invalide', 'error');
    if (GameState.myListings.length >= GameState.marketSlots) return showToast('Étal complet', 'error');

    const entry = GameState.inventory[cigId];
    if (!entry || entry.count <= 0) return showToast('Cigarette introuvable', 'error');

    if (!removeCigarette(cigId, 1)) return;

    const listing = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      cigId,
      cigData: { ...entry.cig },
      price,
      listedAt: Date.now(),
      seller: GameState.pseudo,
    };
    GameState.myListings.push(listing);
    saveGame();
    showToast(`${entry.cig.name} mis en vente pour ${fmt(price)}`, 'success');
    this.renderMarket();
  },

  removeListing(listingId) {
    const idx = GameState.myListings.findIndex(l => l.id === listingId);
    if (idx === -1) return;
    const listing = GameState.myListings[idx];
    addCigarette(listing.cigData);
    GameState.myListings.splice(idx, 1);
    saveGame();
    showToast('Cigarette retirée de la vente', 'success');
    this.renderMarket();
  },

  // ============================================================
  // TABACS DU QUARTIER (Simulated Active Community Stalls)
  // ============================================================
  renderNeighborhoodMarket(content) {
    const stalls = [
      { name: "Tabac Le Balto — Chez Gérard", owner: "Gérard", seed: 101 },
      { name: "Civette de la Gare — Momo", owner: "Momo", seed: 202 },
      { name: "Le Relais PMU — Dédé", owner: "Dédé", seed: 303 },
      { name: "Kiosque 24/7 — Kevin", owner: "Kevin93", seed: 404 }
    ];

    const current6hSlot = Math.floor(Date.now() / (6 * 3600000));
    let html = `
      <div class="market-daily-banner">
        <div>
          <strong>Tabacs &amp; Étalages du Quartier</strong>
          <p>Cessions entre particuliers et habitués du quartier (Renouvelé toutes les 6 heures).</p>
        </div>
      </div>
    `;

    stalls.forEach(stall => {
      const rng = seededRng(stall.seed + current6hSlot);
      const eligible = CIGARETTES.filter(c => c.rarity !== 'mythique' && !c.seasonal);
      const items = [];
      for (let i = 0; i < 2; i++) {
        items.push(eligible[Math.floor(rng() * eligible.length)]);
      }

      html += `
        <div class="neighborhood-stall-box">
          <div class="ns-header">
            <strong>${stall.name}</strong>
            <span class="ns-owner">Gérant : ${stall.owner}</span>
          </div>
          <div class="market-list-grid">
      `;

      items.forEach((item, idx) => {
        const variance = 0.85 + (rng() * 0.3); // 85% to 115% of bourse
        const price = Math.round(getBoursePrice(item.id) * variance);
        const rColor = rarityColor(item.rarity);
        const resolvedImg = resolveCigaretteImage(item);
        const stickerGraphic = resolvedImg
          ? `<img src="${resolvedImg}" alt="${item.name}" class="ml-sticker-img" />`
          : generateCleanCigaretteSVG(item);
        html += `
          <div class="market-listing-card rarity-${item.rarity}" style="border-color:${rColor}">
            <div class="ml-cig-preview">
              <div class="ml-sticker-box">
                ${stickerGraphic}
              </div>
            </div>
            <div class="ml-body">
              <div class="ml-header">
                <span class="ml-name">${item.name}</span>
                <span class="ml-rarity-badge" style="color:${rColor}">${RARITIES[item.rarity]?.name || ''}</span>
              </div>
              <div class="ml-footer">
                <div class="ml-price-tag">
                  <span class="ml-price-val">${fmt(price)}</span>
                </div>
                <button class="btn-primary btn-sm btn-ns-buy" data-cid="${item.id}" data-price="${price}">Acheter</button>
              </div>
            </div>
          </div>
        `;
      });

      html += `</div></div>`;
    });

    content.innerHTML = html;

    content.querySelectorAll('.btn-ns-buy').forEach(btn => {
      btn.onclick = () => {
        const cid = btn.dataset.cid;
        const price = parseInt(btn.dataset.price);
        const cig = CIGARETTES.find(c => c.id === cid);
        if (!cig) return;

        if (!spendMoney(price)) {
          showToast('Pas assez d\'argent !', 'error');
          return;
        }

        addCigarette(cig);
        btn.disabled = true;
        btn.textContent = 'Acheté';
        showToast(`Acheté : ${cig.name}`, 'success');
      };
    });
  },

  // ============================================================
  // TABACS AMIS
  // ============================================================
  renderFriendsMarket(content) {
    if (!GameState.friends || !GameState.friends.length) {
      content.innerHTML = `
        <div class="market-empty-box">
          <p>Vous n'avez pas encore d'amis connectés.</p>
          <p style="font-size:0.8rem;color:var(--text-dim);margin-top:8px">Ajoutez des amis via l'onglet Amis pour explorer leurs étals personnels.</p>
        </div>
      `;
      return;
    }

    let html = `<div class="friends-market-list">`;
    GameState.friends.forEach(friend => {
      html += `
        <div class="friend-stall-row">
          <span>Étal de <strong>${friend.pseudo}</strong></span>
          <button class="btn-secondary btn-sm" data-friend="${friend.code}">Consulter l'étal</button>
        </div>
      `;
    });
    html += `</div><div id="friend-market-display"></div>`;
    content.innerHTML = html;
  }
};

// ============================================================
// BOURSE DU CENDRIER (Zero Emojis, Sleek Badges)
// ============================================================
const Bourse = {
  filter: '',

  render() {
    const listEl = document.getElementById('bourse-list');
    if (!listEl) return;

    const query = this.filter.toLowerCase();
    const filtered = CIGARETTES.filter(c =>
      !query || c.name.toLowerCase().includes(query) || (RARITIES[c.rarity]?.name || '').toLowerCase().includes(query)
    );

    const sorted = [...filtered].sort((a, b) => {
      const ra = ['commune','peu-commune','rare','epique','legendaire','mythique'];
      return ra.indexOf(b.rarity) - ra.indexOf(a.rarity);
    });

    listEl.innerHTML = sorted.map(cig => {
      const price = getBoursePrice(cig.id);
      const history = GameState.bourseHistory[cig.id] || [];
      const prevPrice = history.length >= 2 ? history[history.length - 2]?.price : price;
      const trend = price > (prevPrice || price) ? 'up' : price < (prevPrice || price) ? 'down' : 'flat';
      const trendSign = trend === 'up' ? '+' : trend === 'down' ? '-' : '=';
      const diff = Math.abs(price - (prevPrice || price));
      const owned = (GameState.inventory[cig.id]?.count || 0);

      return `
        <div class="bourse-item" data-cig="${cig.id}">
          <div class="bi-cig-preview">${renderRealCigaretteHTML(cig, 'slot')}</div>
          <div class="bi-info">
            <div class="bi-name">
              ${cig.name}
              ${owned > 0 ? `<span class="owned-badge">×${owned}</span>` : ''}
            </div>
            <div class="bi-rarity" style="color:${rarityColor(cig.rarity)}">${RARITIES[cig.rarity]?.name || ''}</div>
            <div class="bi-circulation">Série : ${SERIES[cig.series]?.name || cig.series}</div>
          </div>
          <div class="bi-right">
            <div class="bi-price">${fmt(price)}</div>
            <div class="bi-trend ${trend}">${trendSign} ${fmt(diff)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Click to show detail
    listEl.querySelectorAll('.bourse-item').forEach(el => {
      el.onclick = () => this.showDetail(el.dataset.cig);
    });

    this.renderPredictions();
    this.renderPredForm();
  },

  showDetail(cigId) {
    const cig = CIGARETTES.find(c => c.id === cigId);
    if (!cig) return;
    const price = getBoursePrice(cigId);
    const owned = GameState.inventory[cigId]?.count || 0;
    const rColor = rarityColor(cig.rarity);

    openModal(`
      <div class="modal-cig-showcase">
        ${renderRealCigaretteHTML(cig, 'card')}
        <div class="modal-cig-name" style="margin-top:10px">${cig.name}</div>
        <div class="modal-cig-rarity" style="color:${rColor}">${RARITIES[cig.rarity]?.name} · ${SERIES[cig.series]?.name || ''}</div>
      </div>
      <p class="modal-cig-quote">"${cig.desc || ''}"</p>
      <div class="modal-stats">
        <div class="modal-stat"><div class="modal-stat-val">${fmt(price)}</div><div class="modal-stat-lbl">Cours bourse</div></div>
        <div class="modal-stat"><div class="modal-stat-val">${owned}</div><div class="modal-stat-lbl">En stock</div></div>
        <div class="modal-stat"><div class="modal-stat-val">+${RARITIES[cig.rarity]?.energy || 0}</div><div class="modal-stat-lbl">Énergie</div></div>
        <div class="modal-stat"><div class="modal-stat-val">+${RARITIES[cig.rarity]?.cough || 0}</div><div class="modal-stat-lbl">Toux</div></div>
      </div>
      <div class="modal-actions" style="margin-top:16px">
        ${owned > 0 ? `<button id="modal-btn-sell" class="btn-secondary">Vendre au jeu (${fmt(Math.round(price * 0.7))})</button>` : ''}
        <button id="modal-btn-equip" class="btn-primary">Équiper en course</button>
      </div>
    `);

    document.getElementById('modal-btn-sell')?.addEventListener('click', () => {
      const sellPrice = Math.round(getBoursePrice(cigId) * GAME_CONST.GAME_MARKET_SELL_RATIO);
      removeCigarette(cigId, 1);
      earnMoney(sellPrice);
      recordSale(cigId, sellPrice);
      showToast(`Vendu au jeu : ${fmt(sellPrice)}`, 'success');
      closeModal();
      this.render();
    });

    document.getElementById('modal-btn-equip')?.addEventListener('click', () => {
      closeModal();
      showPage('inventaire');
    });
  },

  renderPredictions() {
    const el = document.getElementById('active-predictions');
    if (!el) return;

    const now = Date.now();
    GameState.predictions = GameState.predictions.filter(pred => {
      if (pred.resolveAt > now) return true;
      const oldPrice = pred.priceAtStart;
      const curPrice = getBoursePrice(pred.cigId);
      const diff = (curPrice - oldPrice) / oldPrice;
      if (Math.abs(diff) < 0.02) {
        earnMoney(pred.mise);
        showToast('Prédiction nulle — Mise remboursée', 'gold');
      } else {
        const won = (pred.direction === 'hausse' && diff > 0) || (pred.direction === 'baisse' && diff < 0);
        if (won) {
          const gain = Math.round(pred.mise * GAME_CONST.PRED_MULTIPLIER);
          earnMoney(gain);
          showToast(`Prédiction gagnée ! +${fmt(gain)}`, 'gold');
        } else {
          showToast(`Prédiction perdue : -${fmt(pred.mise)}`, 'error');
        }
      }
      return false;
    });
    saveGame();

    if (!GameState.predictions.length) {
      el.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Aucune position ouverte.</div>';
      return;
    }

    el.innerHTML = GameState.predictions.map(pred => {
      const cig = CIGARETTES.find(c => c.id === pred.cigId);
      const timeLeft = Math.max(0, pred.resolveAt - Date.now());
      const hrs = Math.floor(timeLeft / 3600000);
      const mins = Math.floor((timeLeft % 3600000) / 60000);
      return `
        <div class="pred-item">
          <span>${cig?.name || pred.cigId}</span>
          <span class="pred-badge ${pred.direction}">${pred.direction.toUpperCase()}</span>
          <span>Mise : ${fmt(pred.mise)}</span>
          <span style="color:var(--text-dim)">${hrs}h${mins}m</span>
        </div>
      `;
    }).join('');
  },

  renderPredForm() {
    const sel = document.getElementById('pred-cig');
    if (!sel) return;
    sel.innerHTML = CIGARETTES.map(c =>
      `<option value="${c.id}">${c.name} (${RARITIES[c.rarity]?.name})</option>`
    ).join('');
  },

  addPrediction(cigId, direction, mise) {
    if (!cigId) return showToast('Sélectionnez une marque', 'error');
    if (!mise || mise < 10 || mise > 1000) return showToast('Mise entre 10 et 1000 €', 'error');
    if (GameState.predictions.length >= GAME_CONST.MAX_PREDICTIONS) return showToast('Maximum 5 positions actives', 'error');
    if (!spendMoney(mise)) return showToast('Pas assez d\'argent', 'error');

    GameState.predictions.push({
      cigId, direction, mise,
      priceAtStart: getBoursePrice(cigId),
      createdAt: Date.now(),
      resolveAt: Date.now() + 86400000,
    });
    saveGame();
    showToast('Position enregistrée', 'success');
    this.renderPredictions();
  }
};

window.Market = Market;
window.Bourse = Bourse;
