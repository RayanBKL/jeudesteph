// ============================================================
// STÉPHANE — Market & Bourse
// ============================================================

const Market = {
  currentTab: 'mon',
  randomMarketCache: null,
  randomMarketExpiry: 0,

  renderMarket() {
    const content = document.getElementById('market-content');
    if (!content) return;

    switch (this.currentTab) {
      case 'mon':    this.renderMyMarket(content); break;
      case 'jeu':    this.renderGameMarket(content); break;
      case 'alea':   this.renderRandomMarket(content); break;
      case 'amis':   this.renderFriendsMarket(content); break;
    }
  },

  // MY MARKET
  renderMyMarket(content) {
    const maxSlots = GameState.marketSlots;
    const listings = GameState.myListings;

    let html = `<div class="my-market-header">
      <span>Emplacements : ${listings.length}/${maxSlots}</span>
    </div>`;

    // Sell form
    const inv = getInventoryArray().filter(e => !GameState.myListings.find(l => l.cigId === e.cig.id));
    if (inv.length && listings.length < maxSlots) {
      html += `<div class="sell-form">
        <select id="sel-sell-cig" class="game-select">
          <option value="">Choisir une cigarette...</option>
          ${inv.map(e => `<option value="${e.cig.id}">${e.cig.icon} ${e.cig.name} (${RARITIES[e.cig.rarity]?.name}) — ${fmt(getBoursePrice(e.cig.id))} bourse</option>`).join('')}
        </select>
        <input type="number" id="sell-price" class="game-input" placeholder="Prix" min="1" style="width:100px" />
        <button id="btn-sell-cig" class="btn-primary">Mettre en vente</button>
      </div>`;
    }

    if (listings.length === 0) {
      html += `<div class="market-empty">Votre tabac est vide. Mettez des cigarettes en vente !</div>`;
    } else {
      listings.forEach(listing => {
        const cig = listing.cigData;
        html += `<div class="market-listing rarity-${cig.rarity}">
          <div class="ml-icon">${cig.icon || '🚬'}</div>
          <div class="ml-info">
            <div class="ml-name">${cig.name}</div>
            <div class="ml-rarity" style="color:${rarityColor(cig.rarity)}">${RARITIES[cig.rarity]?.name || ''}</div>
            <div style="font-size:0.72rem;color:var(--text-dim)">Bourse : ${fmt(getBoursePrice(cig.id))}</div>
          </div>
          <div class="ml-price">${fmt(listing.price)}</div>
          <div class="ml-actions">
            <button class="btn-market-remove" data-listing="${listing.id}">Retirer</button>
          </div>
        </div>`;
      });
    }

    html += `<div style="font-size:0.8rem;color:var(--text-dim);margin-top:8px">Commission de vente : 5% — Vous recevez l'argent immédiatement à l'achat.</div>`;

    content.innerHTML = html;

    // Events
    const sellBtn = document.getElementById('btn-sell-cig');
    if (sellBtn) sellBtn.addEventListener('click', () => this.listCig());
    content.querySelectorAll('.btn-market-remove').forEach(btn => {
      btn.addEventListener('click', () => this.removeListing(btn.dataset.listing));
    });
  },

  listCig() {
    const cigId = document.getElementById('sel-sell-cig')?.value;
    const priceInput = document.getElementById('sell-price')?.value;
    if (!cigId) return showToast('Choisissez une cigarette !', 'error');
    const price = parseInt(priceInput);
    if (!price || price < 1) return showToast('Prix invalide !', 'error');
    if (GameState.myListings.length >= GameState.marketSlots) return showToast('Tabac plein !', 'error');
    const entry = GameState.inventory[cigId];
    if (!entry || entry.count <= 0) return showToast('Cigarette introuvable !', 'error');

    // Remove from inventory
    if (!removeCigarette(cigId, 1)) return;

    const listing = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      cigId, cigData: { ...entry.cig },
      price, listedAt: Date.now(),
      seller: GameState.pseudo,
    };
    GameState.myListings.push(listing);
    saveGame();
    showToast(`🏪 ${entry.cig.name} mis en vente pour ${fmt(price)} !`, 'success');
    this.renderMarket();
  },

  removeListing(listingId) {
    const idx = GameState.myListings.findIndex(l => l.id === listingId);
    if (idx === -1) return;
    const listing = GameState.myListings[idx];
    // Return to inventory
    addCigarette(listing.cigData);
    GameState.myListings.splice(idx, 1);
    saveGame();
    showToast('Cigarette retirée de la vente', 'success');
    this.renderMarket();
  },

  // GAME MARKET (1h rotation)
  renderGameMarket(content) {
    const gameStock = this.getGameMarketStock();
    const timeLeft = this.getGameMarketTimeLeft();
    const mins = Math.floor(timeLeft / 60000);
    const secs = Math.floor((timeLeft % 60000) / 1000);

    let html = `<div class="game-timer-text">🕐 Renouvellement dans ${mins}:${secs.toString().padStart(2,'0')}</div>`;

    gameStock.forEach((item, i) => {
      const price = Math.round(getBoursePrice(item.id) * GAME_CONST.GAME_MARKET_BUY_RATIO);
      html += `<div class="market-listing rarity-${item.rarity}">
        <div class="ml-icon">${item.icon || '🚬'}</div>
        <div class="ml-info">
          <div class="ml-name">${item.name}</div>
          <div class="ml-rarity" style="color:${rarityColor(item.rarity)}">${RARITIES[item.rarity]?.name || ''}</div>
          <div style="font-size:0.72rem;color:var(--text-dim)">Prix bourse : ${fmt(getBoursePrice(item.id))}</div>
        </div>
        <div class="ml-price">${fmt(price)}</div>
        <div class="ml-actions">
          <button class="btn-market-buy" data-item="${i}" data-price="${price}">Acheter</button>
        </div>
      </div>`;
    });

    content.innerHTML = html;
    content.querySelectorAll('.btn-market-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.item);
        const price = parseInt(btn.dataset.price);
        const item = gameStock[idx];
        if (!item) return;
        if (!spendMoney(price)) { showToast('Pas assez d\'argent !', 'error'); return; }
        addCigarette(item);
        showToast(`✅ Acheté : ${item.name} !`, 'success');
        btn.closest('.market-listing').style.opacity = '0.4';
        btn.disabled = true;
        btn.textContent = 'Acheté';
      });
    });
  },

  getGameMarketStock() {
    // Seeded by hour
    const hourSeed = Math.floor(Date.now() / 3600000);
    const rng = seededRng(hourSeed);
    const eligible = CIGARETTES.filter(c => c.rarity !== 'mythique' && !c.seasonal);
    const shuffled = [...eligible].sort(() => rng() - 0.5);
    return shuffled.slice(0, 10);
  },

  getGameMarketTimeLeft() {
    const nextHour = (Math.floor(Date.now() / 3600000) + 1) * 3600000;
    return nextHour - Date.now();
  },

  // RANDOM MARKET (15min rotation)
  renderRandomMarket(content) {
    if (Date.now() > this.randomMarketExpiry || !this.randomMarketCache) {
      const rng = seededRng(Math.floor(Date.now() / 900000));
      const eligible = CIGARETTES.filter(c => !c.seasonal);
      const shuffled = [...eligible].sort(() => rng() - 0.5);
      this.randomMarketCache = shuffled.slice(0, 8);
      this.randomMarketExpiry = (Math.floor(Date.now() / 900000) + 1) * 900000;
    }

    const timeLeft = this.randomMarketExpiry - Date.now();
    const mins = Math.floor(timeLeft / 60000);

    let html = `<div class="game-timer-text">🎲 Tabac de Gérard (change dans ${mins} min)
      <button id="btn-new-random" class="btn-secondary btn-sm" style="margin-left:8px">Autre tabac 🔄</button>
    </div>`;

    this.randomMarketCache.forEach((item, i) => {
      const price = Math.round(getBoursePrice(item.id) * (0.9 + Math.random() * 0.2));
      html += `<div class="market-listing rarity-${item.rarity}">
        <div class="ml-icon">${item.icon || '🚬'}</div>
        <div class="ml-info">
          <div class="ml-name">${item.name}</div>
          <div class="ml-rarity" style="color:${rarityColor(item.rarity)}">${RARITIES[item.rarity]?.name || ''}</div>
        </div>
        <div class="ml-price">${fmt(price)}</div>
        <div class="ml-actions">
          <button class="btn-market-buy" data-item="${i}" data-price="${price}">Acheter</button>
        </div>
      </div>`;
    });

    content.innerHTML = html;

    document.getElementById('btn-new-random')?.addEventListener('click', () => {
      this.randomMarketCache = null;
      this.renderMarket();
    });

    content.querySelectorAll('.btn-market-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.item);
        const price = parseInt(btn.dataset.price);
        const item = this.randomMarketCache[idx];
        if (!item) return;
        if (!spendMoney(price)) { showToast('Pas assez d\'argent !', 'error'); return; }
        addCigarette(item);
        showToast(`✅ Acheté : ${item.name} !`, 'success');
        btn.closest('.market-listing').style.opacity = '0.4';
        btn.disabled = true;
      });
    });
  },

  // FRIENDS MARKET
  renderFriendsMarket(content) {
    if (!GameState.friends.length) {
      content.innerHTML = '<div class="market-empty">Ajoutez des amis pour voir leurs tabacs !</div>';
      return;
    }
    let html = '<div class="friends-market-list">';
    GameState.friends.forEach(friend => {
      html += `<div style="margin-bottom:8px">
        <button class="btn-secondary btn-sm" data-friend="${friend.code}">🏪 Tabac de ${friend.pseudo}</button>
      </div>`;
    });
    html += '</div><div id="friend-market-display"></div>';
    content.innerHTML = html;
    content.querySelectorAll('[data-friend]').forEach(btn => {
      btn.addEventListener('click', () => this.showFriendMarket(btn.dataset.friend));
    });
  },

  showFriendMarket(friendCode) {
    // Friend listings are stored globally for simplicity
    const display = document.getElementById('friend-market-display');
    const friend = GameState.friends.find(f => f.code === friendCode);
    if (!display || !friend) return;
    display.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;margin-top:8px">Le tabac de ${friend.pseudo} est actuellement vide. (Système multijoueur complet disponible avec backend)</p>`;
  },
};

// ============================================================
// BOURSE
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
      const trendIcon = trend === 'up' ? '📈 +' : trend === 'down' ? '📉 -' : '➡️';
      const diff = Math.abs(price - (prevPrice || price));
      const owned = (GameState.inventory[cig.id]?.count || 0);

      return `<div class="bourse-item" data-cig="${cig.id}">
        <div class="bi-icon">${cig.icon || '🚬'}</div>
        <div class="bi-info">
          <div class="bi-name">${cig.name} ${owned > 0 ? `<span style="background:var(--accent);color:#000;border-radius:100px;padding:1px 6px;font-size:0.65rem">×${owned}</span>` : ''}</div>
          <div class="bi-rarity" style="color:${rarityColor(cig.rarity)}">${RARITIES[cig.rarity]?.name || ''}</div>
          <div class="bi-circulation">Série : ${SERIES[cig.series]?.name || cig.series}</div>
        </div>
        <div>
          <div class="bi-price">${fmt(price)}</div>
          <div class="bi-trend ${trend}">${trendIcon}${fmt(diff)}</div>
        </div>
      </div>`;
    }).join('');

    // Click to show detail
    listEl.querySelectorAll('.bourse-item').forEach(el => {
      el.addEventListener('click', () => this.showDetail(el.dataset.cig));
    });

    this.renderPredictions();
    this.renderPredForm();
  },

  showDetail(cigId) {
    const cig = CIGARETTES.find(c => c.id === cigId);
    if (!cig) return;
    const price = getBoursePrice(cigId);
    const owned = GameState.inventory[cigId]?.count || 0;
    const max = cig.maxCirculation ? `Max en circulation : ${cig.maxCirculation}` : '';

    openModal(`
      <div class="modal-cig-header">
        <div class="modal-cig-icon">${cig.icon || '🚬'}</div>
        <div class="modal-cig-name">${cig.name}</div>
        <div class="modal-cig-rarity" style="color:${rarityColor(cig.rarity)}">${RARITIES[cig.rarity]?.name}</div>
      </div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;text-align:center">"${cig.desc || ''}"</p>
      <div class="modal-stats">
        <div class="modal-stat"><div class="modal-stat-val">${fmt(price)}</div><div class="modal-stat-lbl">Prix bourse</div></div>
        <div class="modal-stat"><div class="modal-stat-val">${owned}</div><div class="modal-stat-lbl">En votre possession</div></div>
        <div class="modal-stat"><div class="modal-stat-val">+${RARITIES[cig.rarity]?.energy || 0}</div><div class="modal-stat-lbl">Énergie</div></div>
        <div class="modal-stat"><div class="modal-stat-val">+${RARITIES[cig.rarity]?.cough || 0}</div><div class="modal-stat-lbl">Toux</div></div>
      </div>
      ${max ? `<p style="font-size:0.8rem;color:var(--gold);text-align:center">${max}</p>` : ''}
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
      showToast(`💸 Vendu au jeu : ${fmt(sellPrice)}`, 'success');
      closeModal();
    });

    document.getElementById('modal-btn-equip')?.addEventListener('click', () => {
      closeModal();
      showPage('inventaire');
      setTimeout(() => renderInventory(), 200);
    });
  },

  renderPredictions() {
    const el = document.getElementById('active-predictions');
    if (!el) return;

    // Resolve old predictions
    const now = Date.now();
    GameState.predictions = GameState.predictions.filter(pred => {
      if (pred.resolveAt > now) return true;
      // Resolve
      const oldPrice = pred.priceAtStart;
      const curPrice = getBoursePrice(pred.cigId);
      const diff = (curPrice - oldPrice) / oldPrice;
      if (Math.abs(diff) < 0.02) {
        earnMoney(pred.mise);
        showToast('🎯 Prédiction nulle — Mise remboursée', 'gold');
      } else {
        const won = (pred.direction === 'hausse' && diff > 0) || (pred.direction === 'baisse' && diff < 0);
        if (won) {
          const gain = Math.round(pred.mise * GAME_CONST.PRED_MULTIPLIER);
          earnMoney(gain);
          showToast(`🎯 Prédiction gagnée ! +${fmt(gain)}`, 'gold');
        } else {
          showToast(`🎯 Prédiction perdue. -${fmt(pred.mise)}`, 'error');
        }
      }
      return false;
    });
    saveGame();

    if (!GameState.predictions.length) {
      el.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem">Aucune prédiction active.</div>';
      return;
    }

    el.innerHTML = GameState.predictions.map(pred => {
      const cig = CIGARETTES.find(c => c.id === pred.cigId);
      const timeLeft = Math.max(0, pred.resolveAt - Date.now());
      const hrs = Math.floor(timeLeft / 3600000);
      const mins = Math.floor((timeLeft % 3600000) / 60000);
      return `<div class="pred-item">
        <span>${cig?.icon || '🚬'} ${cig?.name || pred.cigId}</span>
        <span>${pred.direction === 'hausse' ? '📈' : '📉'} ${pred.direction}</span>
        <span>Mise : ${fmt(pred.mise)}</span>
        <span style="color:var(--text-dim)">${hrs}h${mins}m restants</span>
      </div>`;
    }).join('');
  },

  renderPredForm() {
    const sel = document.getElementById('pred-cig');
    if (!sel) return;
    sel.innerHTML = CIGARETTES.map(c =>
      `<option value="${c.id}">${c.icon} ${c.name} (${RARITIES[c.rarity]?.name})</option>`
    ).join('');
  },

  addPrediction(cigId, direction, mise) {
    if (!cigId) return showToast('Choisissez une cigarette', 'error');
    if (!mise || mise < 10 || mise > 1000) return showToast('Mise entre 10 et 1000 €', 'error');
    if (GameState.predictions.length >= GAME_CONST.MAX_PREDICTIONS) return showToast('Maximum 5 prédictions actives', 'error');
    if (!spendMoney(mise)) return showToast('Pas assez d\'argent', 'error');

    GameState.predictions.push({
      cigId, direction, mise,
      priceAtStart: getBoursePrice(cigId),
      createdAt: Date.now(),
      resolveAt: Date.now() + 86400000,
    });
    saveGame();
    showToast(`🎯 Prédiction enregistrée !`, 'success');
    this.renderPredictions();
  },
};
