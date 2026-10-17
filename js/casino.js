// ============================================================
// CASINO DE MONTE-CARLO — SALONS PRIVÉS EUROPÉENS
// Blackjack Européen (ENHC - Règle sans carte cachée) & Roulette Européenne (37 N° & Règle du Partage)
// ============================================================

const Casino = {
  currentTab: 'blackjack', // 'blackjack' | 'roulette'
  cashMise: 50,
  lastResult: null,

  // Blackjack State (Sabot de 6 Jeux Européens = 312 cartes, ENHC, Multi-Mains & Side Bets)
  bj: {
    shoe: null,
    cutCardIndex: 234,
    cardsDealtFromShoe: 0,
    dealerHand: [],
    dealerScore: 0,
    dealerHasNaturalBJ: false,
    status: 'idle', // 'idle' | 'playing' | 'dealer' | 'finished'
    activeSpotIdx: 1, // 0: Main I, 1: Main II (Centre), 2: Main III
    spots: [
      { id: 0, name: 'Main I', active: false, bet: 50, sidePP: 0, side213: 0, hand: [], score: 0, status: 'idle', isSplit: false, splitHands: [], splitIdx: 0, splitBets: [], sidePPRating: null, side213Rating: null, outcome: null },
      { id: 1, name: 'Main II (Centre)', active: true, bet: 50, sidePP: 0, side213: 0, hand: [], score: 0, status: 'idle', isSplit: false, splitHands: [], splitIdx: 0, splitBets: [], sidePPRating: null, side213Rating: null, outcome: null },
      { id: 2, name: 'Main III', active: false, bet: 50, sidePP: 0, side213: 0, hand: [], score: 0, status: 'idle', isSplit: false, splitHands: [], splitIdx: 0, splitBets: [], sidePPRating: null, side213Rating: null, outcome: null }
    ],
    roundNetGain: 0,
    msg: '',
    msgClass: '',
  },

  // Roulette State (Roulette Européenne à 37 numéros : 0 vert + 1 à 36)
  roulette: {
    bets: {}, // e.g. { 'num_7': 50, 'cheval_1_2': 100, 'carre_1_2_4_5': 50, 'red': 100 }
    specialMode: 'normal', // 'normal' | 'cheval' | 'transversale' | 'carre' | 'sixain'
    selectedFirstNum: null,
    spinning: false,
    winningNumber: null,
    history: [14, 2, 0, 31, 19, 7],
    wheelAngle: 0,
    ballAngle: 0,
  },

  // European Wheel Numbers order on physical cylinder (37 numéros)
  wheelNumbers: [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ],

  redNumbers: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],

  init() {
    try {
      const saved = localStorage.getItem('casino_last_result');
      if (saved) this.lastResult = JSON.parse(saved);
    } catch(e) {}
    this.bindGlobalTabs();
    this.render();
  },

  bindGlobalTabs() {
    document.querySelectorAll('.cas-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.cas-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.ctab || 'blackjack';
        this.render();
      };
    });

    const advanceBtn = document.getElementById('btn-casino-bank-advance');
    if (advanceBtn) {
      advanceBtn.onclick = () => {
        // Filet de sécurité : seulement quand on est presque à sec, et pas plus d'une fois toutes les 10 minutes
        const cash = (window.ClickerEngine && ClickerEngine.getCash) ? ClickerEngine.getCash() : (GameState.money || 0);
        const wait = this.bankAdvanceWaitMs();
        if (cash >= this.BANK_ADVANCE_MAX_CASH) {
          return showToast(`L'avance de la banque n'est possible que si ton solde est sous ${this.BANK_ADVANCE_MAX_CASH} €.`, 'info');
        }
        if (wait > 0) {
          return showToast(`La banque te fera une nouvelle avance dans ${Math.ceil(wait / 60000)} min.`, 'info');
        }
        localStorage.setItem('casino_bank_advance_at', String(Date.now()));
        earnMoney(this.BANK_ADVANCE_AMOUNT);
        if (window.SoundFX) SoundFX.win();
        showToast(`La banque t'avance ${fmt(this.BANK_ADVANCE_AMOUNT)} pour te refaire.`, 'gold');
        this.updateHeaderDashboard();
      };
    }
  },

  BANK_ADVANCE_AMOUNT: 500,
  BANK_ADVANCE_MAX_CASH: 50,
  BANK_ADVANCE_COOLDOWN_MS: 10 * 60 * 1000,

  bankAdvanceWaitMs() {
    const last = parseInt(localStorage.getItem('casino_bank_advance_at') || '0') || 0;
    return Math.max(0, last + this.BANK_ADVANCE_COOLDOWN_MS - Date.now());
  },

  updateHeaderDashboard() {
    const balEl = document.getElementById('casino-player-balance');
    const curCash = (window.ClickerEngine && ClickerEngine.getCash) ? ClickerEngine.getCash() : ((window.GameState && GameState.money) || 0);
    if (balEl) balEl.textContent = fmt(curCash);

    const advanceBtn = document.getElementById('btn-casino-bank-advance');
    if (advanceBtn) {
      const usable = curCash < this.BANK_ADVANCE_MAX_CASH && this.bankAdvanceWaitMs() === 0;
      advanceBtn.classList.toggle('is-unavailable', !usable);
      advanceBtn.title = `Si tu es à sec (moins de ${this.BANK_ADVANCE_MAX_CASH} €), la banque t'avance ${this.BANK_ADVANCE_AMOUNT} € pour continuer à jouer. Une fois toutes les 10 minutes.`;
    }

    const badge = document.getElementById('casino-last-result-badge');
    const amountEl = document.getElementById('casino-last-result-amount');
    if (!badge || !amountEl) return;

    if (!this.lastResult || this.lastResult.type === 'idle') {
      badge.className = 'casino-last-result-badge is-idle';
      amountEl.textContent = 'Faites vos jeux';
      return;
    }

    if (this.lastResult.type === 'win') {
      badge.className = 'casino-last-result-badge is-win';
      amountEl.textContent = `+${fmt(this.lastResult.amount)} · ${this.lastResult.text}`;
    } else if (this.lastResult.type === 'lose') {
      badge.className = 'casino-last-result-badge is-lose';
      amountEl.textContent = `-${fmt(this.lastResult.amount)} · ${this.lastResult.text}`;
    } else if (this.lastResult.type === 'push') {
      badge.className = 'casino-last-result-badge is-push';
      amountEl.textContent = `0 € · ${this.lastResult.text}`;
    }
  },

  recordResult(type, amount, text) {
    if (type === 'win' && typeof Prestige !== 'undefined') Prestige.emit('casino_win', { amount });
    this.lastResult = { type, amount: Math.abs(amount || 0), text: text || '' };
    try {
      localStorage.setItem('casino_last_result', JSON.stringify(this.lastResult));
    } catch(e) {}
    this.updateHeaderDashboard();
  },

  checkLimit() {
    return true;
  },

  recordBet() {
    GameState.casinoBetsToday = (GameState.casinoBetsToday || 0) + 1;
    saveGame();
    this.updateHeaderDashboard();
  },

  renderWagerControls() {
    return `
      <div class="casino-wager-bar">
        <div class="wager-cash-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center">
          <label style="font-weight:800;color:var(--empire-gold);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em">Jeton :</label>
          <div class="casino-chips" style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="casino-chip ${this.cashMise === 5 ? 'active' : ''}" data-v="5" style="background:#867969;color:#fff">5€</button>
            <button class="casino-chip ${this.cashMise === 10 ? 'active' : ''}" data-v="10" style="background:#3b82f6;color:#fff">10€</button>
            <button class="casino-chip ${this.cashMise === 25 ? 'active' : ''}" data-v="25" style="background:#10b981;color:#fff">25€</button>
            <button class="casino-chip ${this.cashMise === 50 ? 'active' : ''}" data-v="50" style="background:#f59e0b;color:#000">50€</button>
            <button class="casino-chip ${this.cashMise === 100 ? 'active' : ''}" data-v="100" style="background:#ef4444;color:#fff">100€</button>
            <button class="casino-chip ${this.cashMise === 500 ? 'active' : ''}" data-v="500" style="background:#8b5cf6;color:#fff">500€</button>
            <button class="casino-chip ${this.cashMise === 1000 ? 'active' : ''}" data-v="1000" style="background:#ec4899;color:#fff">1K€</button>
            <button class="casino-chip ${this.cashMise === 5000 ? 'active' : ''}" data-v="5000" style="background:#06b6d4;color:#000">5K€</button>
            <button class="casino-chip ${this.cashMise === 25000 ? 'active' : ''}" data-v="25000" style="background:#eab308;color:#000">25K€</button>
            <button class="casino-chip ${this.cashMise === 100000 ? 'active' : ''}" data-v="100000" style="background:#ffffff;color:#000">100K€</button>
          </div>
        </div>
      </div>
    `;
  },

  bindWagerEvents(content) {
    content.querySelectorAll('.casino-chip').forEach(btn => {
      btn.onclick = () => {
        this.cashMise = parseInt(btn.dataset.v);
        content.querySelectorAll('.casino-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        if (window.SoundFX) SoundFX.click();
      };
    });
  },

  render() {
    const content = document.getElementById('casino-content');
    if (!content) return;

    if (!this._resizeBound) {
      this._resizeBound = true;
      let narrow = this.isNarrow();
      window.addEventListener('resize', () => {
        if (this.isNarrow() !== narrow) {
          narrow = this.isNarrow();
          if (document.getElementById('page-casino')?.classList.contains('active') && !this.roulette.spinning) this.render();
        }
      });
    }

    this.bindGlobalTabs();
    this.updateHeaderDashboard();

    if (this.currentTab === 'blackjack') {
      this.renderBlackjack(content);
    } else {
      this.renderRoulette(content);
    }
  },

  // ============================================================
  // BLACKJACK EUROPÉEN MULTI-MAINS & SIDE BETS
  // ENHC (European No Hole Card) — Banque s'arrête à 17 — Paiement 3:2
  // Subtilité majeure : Le Blackjack Naturel (As + 10 en 2 cartes) bat un 21 en 3 cartes ou plus.
  // Side Bets officiels : Paires Parfaites (jusqu'à 25:1) & 21+3 (jusqu'à 100:1)
  // ============================================================
  initShoe(numDecks = 6) {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = [
      { r: '2', v: 2 }, { r: '3', v: 3 }, { r: '4', v: 4 }, { r: '5', v: 5 },
      { r: '6', v: 6 }, { r: '7', v: 7 }, { r: '8', v: 8 }, { r: '9', v: 9 },
      { r: '10', v: 10 }, { r: 'J', v: 10 }, { r: 'Q', v: 10 }, { r: 'K', v: 10 },
      { r: 'A', v: 11 }
    ];
    const shoe = [];
    for (let d = 0; d < numDecks; d++) {
      for (let s of suits) {
        for (let val of values) {
          shoe.push({
            suit: s,
            rank: val.r,
            val: val.v,
            color: (s === '♥' || s === '♦') ? 'red' : 'black'
          });
        }
      }
    }
    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
    this.bj.shoe = shoe;
    this.bj.cardsDealtFromShoe = 0;
    this.bj.cutCardIndex = Math.floor(shoe.length * 0.75);
    return shoe;
  },

  drawCardFromShoe() {
    if (!this.bj.shoe || this.bj.shoe.length < 20 || this.bj.cardsDealtFromShoe >= this.bj.cutCardIndex) {
      this.initShoe(6);
    }
    this.bj.cardsDealtFromShoe++;
    return this.bj.shoe.pop();
  },

  calculateHand(hand) {
    if (!hand || hand.length === 0) return 0;
    let sum = 0;
    let aces = 0;
    for (let c of hand) {
      sum += c.val;
      if (c.rank === 'A') aces++;
    }
    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces--;
    }
    return sum;
  },

  isNaturalBJ(hand) {
    return Boolean(hand && hand.length === 2 && this.calculateHand(hand) === 21);
  },

  // Évaluation officielle Paires Parfaites (Perfect Pairs)
  evaluatePerfectPairs(c1, c2) {
    if (!c1 || !c2 || c1.rank !== c2.rank) return null;
    if (c1.suit === c2.suit) {
      return { type: 'perfect', mult: 25, label: 'Paire Parfaite 25:1', desc: 'Même symbole' };
    }
    if (c1.color === c2.color) {
      return { type: 'colored', mult: 12, label: 'Paire Couleur 12:1', desc: 'Deux cartes noires ou rouges' };
    }
    return { type: 'mixed', mult: 6, label: 'Paire Mixte 6:1', desc: 'Couleurs différentes (rouge + noir)' };
  },

  // Évaluation officielle 21+3 (Poker 3 cartes : 2 cartes joueur + 1 carte visible croupier)
  evaluate21Plus3(c1, c2, d1) {
    if (!c1 || !c2 || !d1) return null;
    const rankMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const ranks = [c1.rank, c2.rank, d1.rank];
    const suits = [c1.suit, c2.suit, d1.suit];
    const vals = ranks.map(r => rankMap[r]).sort((a, b) => a - b);

    const isFlush = (suits[0] === suits[1] && suits[1] === suits[2]);
    const isThreeOfAKind = (ranks[0] === ranks[1] && ranks[1] === ranks[2]);
    const isStraight = (vals[0] + 1 === vals[1] && vals[1] + 1 === vals[2]) ||
                      (vals[0] === 2 && vals[1] === 3 && vals[2] === 14); // As-2-3

    if (isThreeOfAKind && isFlush) {
      return { type: 'suited_trips', mult: 100, label: 'Brelan Suité (100:1)' };
    }
    if (isStraight && isFlush) {
      return { type: 'straight_flush', mult: 40, label: 'Quinte Flush (40:1)' };
    }
    if (isThreeOfAKind) {
      return { type: 'three_kind', mult: 30, label: 'Brelan (30:1)' };
    }
    if (isStraight) {
      return { type: 'straight', mult: 10, label: 'Quinte (10:1)' };
    }
    if (isFlush) {
      return { type: 'flush', mult: 5, label: 'Couleur (5:1)' };
    }
    return null;
  },

  canSplitSpot(spot) {
    if (this.bj.status !== 'playing' || !spot) return false;
    const curMoney = (window.ClickerEngine && ClickerEngine.getCash) ? ClickerEngine.getCash() : ((window.GameState && GameState.money) || 0);
    const betCost = spot.baseBet || spot.bet;

    if (!spot.isSplit) {
      // PREMIER SPLIT SUR LA MAIN INITIALE
      if (!spot.hand || spot.hand.length !== 2) return false;
      const c1 = spot.hand[0];
      const c2 = spot.hand[1];
      const isPair = (c1.rank === c2.rank) || (c1.val === 10 && c2.val === 10);
      return isPair && (curMoney >= betCost);
    } else {
      // RE-SPLIT SUR SOUS-MAIN EXISTANTE
      // Règle casino officielle : pas de re-split sur des As, max 4 sous-mains
      if (spot.isAceSplit) return false;
      if (!spot.splitHands || spot.splitHands.length >= 4) return false;
      const currentSub = spot.splitHands[spot.splitIdx];
      if (!currentSub || currentSub.length !== 2) return false;
      const c1 = currentSub[0];
      const c2 = currentSub[1];
      if (c1.rank === 'A') return false; // Jamais de re-split d'As
      const isPair = (c1.rank === c2.rank) || (c1.val === 10 && c2.val === 10);
      return isPair && (curMoney >= betCost);
    }
  },

  canDoubleSpot(spot) {
    if (this.bj.status !== 'playing' || !spot || spot.isSplit) return false;
    if (spot.hand.length !== 2) return false;
    const curMoney = (window.ClickerEngine && ClickerEngine.getCash) ? ClickerEngine.getCash() : ((window.GameState && GameState.money) || 0);
    const betCost = spot.baseBet || spot.bet;
    return curMoney >= betCost;
  },

  renderCardHTML(card, hidden = false) {
    if (hidden) {
      return `
        <div class="bj-card card-back">
          <div class="card-back-pattern"></div>
        </div>
      `;
    }
    return `
      <div class="bj-card ${card.color}">
        <div class="card-corner top-left">
          <span class="card-rank">${card.rank}</span>
          <span class="card-suit">${card.suit}</span>
        </div>
        <div class="card-center-suit">${card.suit}</div>
        <div class="card-corner bottom-right">
          <span class="card-rank">${card.rank}</span>
          <span class="card-suit">${card.suit}</span>
        </div>
      </div>
    `;
  },

  renderBlackjack(content) {
    const isPlaying = this.bj.status === 'playing';
    const isDealer = this.bj.status === 'dealer';
    const isFinished = this.bj.status === 'finished';
    const isIdle = this.bj.status === 'idle' || isFinished;

    const activeSpot = this.bj.spots[this.bj.activeSpotIdx];
    const canSplit = this.canSplitSpot(activeSpot);
    const canDouble = this.canDoubleSpot(activeSpot);

    // Calcul mise totale engagée
    const totalWagered = this.bj.spots.reduce((acc, sp) => {
      if (!sp.active) return acc;
      return acc + sp.bet + (sp.sidePP || 0) + (sp.side213 || 0);
    }, 0);

    content.innerHTML = `
      <div class="casino-felt-table blackjack-table">
        <div class="bj-felt-rim">

          <!-- Section Croupier : 1 seule carte visible au départ (règle officielle ENHC) -->
          <div class="bj-hand-section bj-dealer-area">
            <div class="bj-dealer-header">
              <span class="bj-dealer-title">Banque</span>
              <span class="bj-hand-score ${this.bj.dealerHand.length === 0 ? 'is-empty' : ''}" id="bj-dealer-score">
                ${this.bj.dealerHand.length > 0 ? (isFinished || isDealer ? this.bj.dealerScore : this.bj.dealerHand[0].val) : ''}
              </span>
            </div>
            <div class="bj-cards-row" id="bj-dealer-cards">
              ${this.bj.dealerHand.length === 0 ? '<div class="bj-card-placeholder">Attente des mises</div>' : ''}
              ${this.bj.dealerHand.map(c => this.renderCardHTML(c, false)).join('')}
            </div>
          </div>

          <!-- Message central -->
          <div class="bj-table-center">
            ${this.bj.msg ? `<div class="bj-status-msg ${this.bj.msgClass}">${this.bj.msg}</div>` : ''}
          </div>

          <!-- MULTI-MAINS : 3 SPOTS (Main I, Main II, Main III) -->
          <div class="bj-spots-container ${isIdle ? '' : 'is-dealing'}" style="--n:${isIdle ? 3 : Math.max(1, this.bj.spots.filter(sp => sp.active).length)}">
            ${this.bj.spots.map((spot, idx) => {
              const isCurrentPlaying = (isPlaying && this.bj.activeSpotIdx === idx);
              return `
                <div class="bj-spot ${spot.active ? '' : 'is-inactive'} ${isCurrentPlaying ? 'is-playing' : ''}" data-spot-idx="${idx}">
                  <div class="bj-spot-header">
                    <span class="bj-spot-title">
                      ${String(spot.name).replace(/\s*\((.*?)\)/, ' <small class="bj-spot-pos">($1)</small>')}
                      ${isCurrentPlaying ? '<span class="bj-active-hand-indicator">En cours</span>' : ''}
                    </span>
                    ${spot.active ? `
                      <span class="bj-spot-score">${spot.hand.length > 0 ? (spot.isSplit ? spot.splitHands.length + ' mains' : spot.score) : '-'}</span>
                    ` : ''}
                  </div>

                  <!-- Zone des Cartes -->
                  <div class="bj-spot-cards-zone">
                    ${!spot.active ? `
                      <div class="bj-card-placeholder">Main inactive</div>
                    ` : (spot.hand.length === 0 ? `
                      <div class="bj-card-placeholder">Placez votre mise</div>
                    ` : (spot.isSplit ? `
                      <div class="bj-split-grid bj-split-${spot.splitHands.length}">
                        ${spot.splitHands.map((subHand, sIdx) => {
                          const sub = this.calculateHand(subHand);
                          return `
                          <div class="bj-split-hand ${(spot.splitIdx === sIdx && isCurrentPlaying) ? 'is-current' : ''} ${sub > 21 ? 'is-bust' : ''}">
                            <span class="bj-split-score">${sub}</span>
                            <div class="bj-cards-row bj-cards-fan">
                              ${subHand.map(c => this.renderCardHTML(c)).join('')}
                            </div>
                          </div>`;
                        }).join('')}
                      </div>
                    ` : `
                      <div class="bj-cards-row bj-cards-fan">
                        ${spot.hand.map(c => this.renderCardHTML(c)).join('')}
                      </div>
                    `))}
                  </div>

                  <!-- Résultat Badge sur la main (Dédié et non superposé aux cartes) -->
                  <div class="bj-spot-outcome-row">
                    ${spot.outcome ? `
                      <div class="bj-hand-result-badge ${spot.outcome.type}">
                        ${spot.outcome.text}
                      </div>
                    ` : '<div class="bj-outcome-placeholder"></div>'}
                  </div>

                  <!-- Barre de Mise Principale -->
                  <div class="bj-spot-mainbet-bar">
                    <span class="bj-mainbet-label">Mise :</span>
                    <span class="bj-mainbet-val">${fmt(spot.bet)}</span>
                    ${isIdle ? `
                      <button class="bj-spot-toggle-btn ${spot.active ? 'active' : ''}" data-act-spot="${idx}">
                        ${spot.active ? 'Active' : 'Activer'}
                      </button>
                    ` : ''}
                  </div>

                  <!-- Side Bets : Paires Parfaites & 21+3 avec gain exact visible -->
                  <div class="bj-spot-sidebets-row">
                    <div class="bj-sidebet-box ${spot.sidePP > 0 ? 'has-bet' : ''}" data-side="pp" data-spot="${idx}" title="Cliquez pour changer la mise">
                      <span class="bj-sidebet-label">Paires</span>
                      <span class="bj-sidebet-val">${spot.sidePP > 0 ? fmt(spot.sidePP) : '0 €'}</span>
                      <span class="bj-sidebet-odds">Max 25:1</span>
                      ${spot.sidePPRating ? `
                        <span class="sidebet-result-pill ${spot.sidePPRating.mult ? 'win' : 'lose'}">
                          ${spot.sidePPRating.mult ? `+${fmt(spot.sidePP * spot.sidePPRating.mult)} (${spot.sidePPRating.label})` : `-${fmt(spot.sidePP)}`}
                        </span>
                      ` : ''}
                    </div>
                    <div class="bj-sidebet-box ${spot.side213 > 0 ? 'has-bet' : ''}" data-side="213" data-spot="${idx}" title="Cliquez pour changer la mise">
                      <span class="bj-sidebet-label">21+3</span>
                      <span class="bj-sidebet-val">${spot.side213 > 0 ? fmt(spot.side213) : '0 €'}</span>
                      <span class="bj-sidebet-odds">Max 100:1</span>
                      ${spot.side213Rating ? `
                        <span class="sidebet-result-pill ${spot.side213Rating.mult ? 'win' : 'lose'}">
                          ${spot.side213Rating.mult ? `+${fmt(spot.side213 * spot.side213Rating.mult)} (${spot.side213Rating.label})` : `-${fmt(spot.side213)}`}
                        </span>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Barre de Contrôle et d'Actions -->
        <div class="bj-controls-bar">
          ${isIdle ? `
            ${this.renderWagerControls()}
            <div class="bj-idle-actions">
              <button id="btn-bj-deal" class="btn-primary btn-bj-deal">
                Distribuer (${fmt(totalWagered)})
              </button>
              <div class="bj-secondary-actions">
                <button id="btn-bj-rebet" class="btn-secondary">🔄 Même mise (${fmt(this.bj.lastWagered || totalWagered)})</button>
                <button id="btn-bj-clear-bets" class="btn-secondary">🗑️ Effacer les mises</button>
                <button id="btn-bj-all-hands" class="btn-secondary">Activer les 3 mains</button>
                <button id="btn-bj-reset-sides" class="btn-secondary">Effacer side bets</button>
              </div>
            </div>
          ` : this.bj.status === 'insurance_prompt' ? `
            <div class="bj-insurance-box" style="background:linear-gradient(135deg,rgba(39,27,18,0.95),rgba(116,80,52,0.85));border:1px solid #3b82f6;border-radius:14px;padding:12px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;max-width:520px;margin:0 auto">
              <div style="font-size:0.9rem;font-weight:800;color:#93c5fd;display:flex;align-items:center;gap:6px">
                <span>🛡️</span> <span>La Banque montre un As ! Prendre l'Assurance ?</span>
              </div>
              <p style="font-size:0.75rem;color:#ded7ce;text-align:center;margin:0">
                L'assurance paye 2:1 si la banque a un Blackjack naturel. Coût : 50% de vos mises (${fmt(this.bj.insuranceCost)}).
              </p>
              <div style="display:flex;gap:10px;width:100%;justify-content:center">
                <button id="btn-bj-insure-yes" class="btn-primary" style="background:#2563eb;font-weight:800;padding:8px 16px;font-size:0.8rem">
                  Prendre l'Assurance (${fmt(this.bj.insuranceCost)})
                </button>
                <button id="btn-bj-insure-no" class="btn-secondary" style="font-weight:700;padding:8px 16px;font-size:0.8rem">
                  Refuser
                </button>
              </div>
            </div>
          ` : `
            <div class="bj-play-actions" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
              <button id="btn-bj-hit" class="btn-primary btn-bj-act" ${isDealer ? 'disabled' : ''} style="min-width:120px;font-weight:800">
                Tirer
              </button>
              <button id="btn-bj-stand" class="btn-secondary btn-bj-act" ${isDealer ? 'disabled' : ''} style="min-width:120px;font-weight:800;background:rgba(255,255,255,0.15)">
                Rester
              </button>
              <button id="btn-bj-double" class="btn-secondary btn-bj-act" ${!canDouble || isDealer ? 'disabled style="opacity:0.35;cursor:not-allowed;pointer-events:none;"' : ''} style="min-width:120px;font-weight:800">
                Doubler (×2)
              </button>
              ${canSplit ? `
                <button id="btn-bj-split" class="btn-primary btn-bj-act" style="background:#f59e0b;color:#000;min-width:120px;font-weight:800">
                  ${activeSpot && activeSpot.isSplit ? 'Re-Séparer' : 'Séparer'}
                </button>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    `;

    if (isIdle) {
      this.bindWagerEvents(content);

      // Bouton Distribuer
      content.querySelector('#btn-bj-deal')?.addEventListener('click', () => this.startBlackjackDeal());

      // Bouton Re-Miser (Même mise)
      content.querySelector('#btn-bj-rebet')?.addEventListener('click', () => this.blackjackRebet());

      // Bouton Effacer les Mises
      content.querySelector('#btn-bj-clear-bets')?.addEventListener('click', () => this.blackjackClearBets());

      // Toggle Spot Active
      content.querySelectorAll('.bj-spot-toggle-btn').forEach(btn => {
        btn.onclick = () => {
          const sIdx = parseInt(btn.dataset.actSpot);
          const spot = this.bj.spots[sIdx];
          spot.active = !spot.active;
          // Assurer qu'au moins 1 main reste active
          if (!this.bj.spots.some(s => s.active)) {
            spot.active = true;
          }
          if (spot.active && spot.bet <= 0) spot.bet = this.cashMise;
          if (window.SoundFX) SoundFX.click();
          this.render();
        };
      });

      // Bouton Activer les 3 Mains
      content.querySelector('#btn-bj-all-hands')?.addEventListener('click', () => {
        const anyInactive = this.bj.spots.some(s => !s.active);
        this.bj.spots.forEach(s => {
          s.active = anyInactive;
          if (s.active && s.bet <= 0) s.bet = this.cashMise;
        });
        if (window.SoundFX) SoundFX.click();
        this.render();
      });

      // Bouton Effacer Side Bets
      content.querySelector('#btn-bj-reset-sides')?.addEventListener('click', () => {
        this.bj.spots.forEach(s => { s.sidePP = 0; s.side213 = 0; });
        if (window.SoundFX) SoundFX.click();
        this.render();
      });

      // Clics sur Side Bets pour incrémenter (0 -> 5 -> 10 -> 25 -> 50 -> 100 -> 0)
      content.querySelectorAll('.bj-sidebet-box').forEach(box => {
        box.onclick = () => {
          const sIdx = parseInt(box.dataset.spot);
          const sideType = box.dataset.side;
          const spot = this.bj.spots[sIdx];
          if (!spot.active) spot.active = true;
          const cycle = [0, 5, 10, 25, 50, 100];
          const curVal = (sideType === 'pp') ? spot.sidePP : spot.side213;
          let nextIdx = (cycle.indexOf(curVal) + 1) % cycle.length;
          if (nextIdx === -1) nextIdx = 0;
          if (sideType === 'pp') spot.sidePP = cycle[nextIdx];
          else spot.side213 = cycle[nextIdx];
          if (window.SoundFX) SoundFX.click();
          this.render();
        };
      });

      // Clic sur barre de mise pour mettre le jeton sélectionné
      content.querySelectorAll('.bj-spot-mainbet-bar').forEach((bar, idx) => {
        bar.onclick = (e) => {
          if (e.target.classList.contains('bj-spot-toggle-btn')) return;
          const spot = this.bj.spots[idx];
          spot.active = true;
          spot.bet = this.cashMise;
          if (window.SoundFX) SoundFX.click();
          this.render();
        };
      });
    } else {
      content.querySelector('#btn-bj-insure-yes')?.addEventListener('click', () => this.acceptInsurance());
      content.querySelector('#btn-bj-insure-no')?.addEventListener('click', () => this.declineInsurance());
      content.querySelector('#btn-bj-hit')?.addEventListener('click', () => this.blackjackHit());
      content.querySelector('#btn-bj-stand')?.addEventListener('click', () => this.blackjackStand());
      content.querySelector('#btn-bj-double')?.addEventListener('click', () => this.blackjackDouble());
      content.querySelector('#btn-bj-split')?.addEventListener('click', () => this.blackjackSplit());
    }
  },

  acceptInsurance() {
    const cost = this.bj.insuranceCost || 0;
    if (cost > 0) {
      if (!spendMoney(cost)) {
        showToast("Solde insuffisant pour payer l'assurance !", "error");
        this.declineInsurance();
        return;
      }
      this.bj.insuranceActive = true;
      showToast(`🛡️ Assurance souscrite (-${fmt(cost)}) !`, "info");
      if (window.SoundFX) SoundFX.click();
    }
    this.resumeAfterInsurancePrompt();
  },

  declineInsurance() {
    this.bj.insuranceActive = false;
    this.resumeAfterInsurancePrompt();
  },

  resumeAfterInsurancePrompt() {
    this.bj.status = 'playing';
    const firstPlayableIdx = this.bj.spots.findIndex(s => s.active && s.status === 'playing');
    if (firstPlayableIdx !== -1) {
      this.bj.activeSpotIdx = firstPlayableIdx;
    } else {
      this.startDealerPlay();
      return;
    }
    this.render();
  },

  startBlackjackDeal() {
    // Vérifier les mains actives
    const activeSpots = this.bj.spots.filter(s => s.active);
    if (activeSpots.length === 0) {
      this.bj.spots[1].active = true;
    }

    // Réinitialiser l'état des mains
    this.bj.insuranceActive = false;
    this.bj.insuranceCost = 0;
    this.bj.spots.forEach(s => {
      s.hand = [];
      s.score = 0;
      s.isSplit = false;
      s.splitHands = [];
      s.splitIdx = 0;
      s.splitBets = [];
      s.isAceSplit = false;
      s.isDoubled = false;
      s.sidePPRating = null;
      s.side213Rating = null;
      s.outcome = null;
      s.status = s.active ? 'idle' : 'inactive';
      if (s.active && (!s.bet || s.bet < 5)) s.bet = this.cashMise;
      s.baseBet = s.bet;
    });

    const totalRequired = this.bj.spots.reduce((acc, s) => {
      if (!s.active) return acc;
      return acc + s.bet + (s.sidePP || 0) + (s.side213 || 0);
    }, 0);

    if (totalRequired < 5) return showToast('Mise minimale requise de 5 €', 'error');

    if (!spendMoney(totalRequired)) {
      showToast('Solde insuffisant pour couvrir vos mises. Utilisez l\'avance bancaire.', 'error');
      return;
    }

    this.bj.lastWagered = totalRequired;
    this.bj.lastBets = this.bj.spots.map(s => ({
      active: s.active,
      bet: s.baseBet || s.bet,
      sidePP: s.sidePP,
      side213: s.side213
    }));

    this.recordBet();
    if (window.SoundFX) SoundFX.click();

    // Sabot officiel 6 jeux
    if (!this.bj.shoe || this.bj.shoe.length < 20 || this.bj.cardsDealtFromShoe >= this.bj.cutCardIndex) {
      this.initShoe(6);
    }

    // Distribution officielle ENHC :
    // 1 seule carte visible pour le croupier
    this.bj.dealerHand = [this.drawCardFromShoe()];
    this.bj.dealerScore = this.calculateHand(this.bj.dealerHand);
    this.bj.dealerHasNaturalBJ = false;

    // 2 cartes pour chaque main active
    this.bj.spots.forEach(spot => {
      if (!spot.active) return;
      spot.hand = [this.drawCardFromShoe(), this.drawCardFromShoe()];
      spot.score = this.calculateHand(spot.hand);

      // Évaluation immédiate des Side Bets
      let sideGains = 0;
      if (spot.sidePP > 0) {
        const pp = this.evaluatePerfectPairs(spot.hand[0], spot.hand[1]);
        spot.sidePPRating = pp;
        if (pp) {
          const gain = spot.sidePP * pp.mult;
          sideGains += (gain + spot.sidePP);
          showToast(`${spot.name} : ${pp.label} ! (+${fmt(gain)})`, 'gold');
        }
      }

      if (spot.side213 > 0) {
        const p213 = this.evaluate21Plus3(spot.hand[0], spot.hand[1], this.bj.dealerHand[0]);
        spot.side213Rating = p213;
        if (p213) {
          const gain = spot.side213 * p213.mult;
          sideGains += (gain + spot.side213);
          showToast(`${spot.name} : ${p213.label} ! (+${fmt(gain)})`, 'gold');
        }
      }

      if (sideGains > 0) {
        earnMoney(sideGains);
        if (window.SoundFX) SoundFX.win();
      }

      // Vérification Blackjack Naturel (As + 10-valeur en 2 cartes)
      if (this.isNaturalBJ(spot.hand)) {
        spot.status = 'blackjack';
      } else {
        spot.status = 'playing';
      }
    });

    // 🛡️ RÈGLE OFFICIELLE : Si le croupier montre un As, proposer l'assurance avant toute action !
    if (this.bj.dealerHand[0].rank === 'A') {
      const activeSpotsWithoutBJ = this.bj.spots.filter(s => s.active && s.status !== 'blackjack');
      const insCost = activeSpotsWithoutBJ.reduce((acc, s) => acc + Math.round(s.bet * 0.5), 0);
      this.bj.insuranceCost = insCost;
      this.bj.status = 'insurance_prompt';
      this.render();
      return;
    }

    this.bj.status = 'playing';
    this.bj.msg = '';
    this.bj.msgClass = '';

    // Trouver la première main jouable (qui n'est pas déjà un Blackjack Naturel)
    const firstPlayableIdx = this.bj.spots.findIndex(s => s.active && s.status === 'playing');
    if (firstPlayableIdx !== -1) {
      this.bj.activeSpotIdx = firstPlayableIdx;
    } else {
      // Toutes les mains actives ont un Blackjack Naturel immédiat !
      this.startDealerPlay();
      return;
    }

    this.render();
  },

  blackjackHit() {
    if (this.bj.status !== 'playing') return;
    const spot = this.bj.spots[this.bj.activeSpotIdx];
    if (!spot || !spot.active) return;
    if (window.SoundFX) SoundFX.click();

    if (spot.isSplit) {
      const currentHand = spot.splitHands[spot.splitIdx];
      currentHand.push(this.drawCardFromShoe());
      const score = this.calculateHand(currentHand);
      if (score >= 21) {
        this.advanceActiveSpot();
        return;
      }
    } else {
      spot.hand.push(this.drawCardFromShoe());
      spot.score = this.calculateHand(spot.hand);
      if (spot.score > 21) {
        spot.status = 'bust';
        spot.outcome = { type: 'lose', text: `Brûlé (${spot.score})` };
        this.advanceActiveSpot();
        return;
      } else if (spot.score === 21) {
        spot.status = 'stand';
        this.advanceActiveSpot();
        return;
      }
    }

    this.render();
  },

  blackjackStand() {
    if (this.bj.status !== 'playing') return;
    const spot = this.bj.spots[this.bj.activeSpotIdx];
    if (!spot || !spot.active) return;
    if (window.SoundFX) SoundFX.click();

    if (spot.isSplit) {
      this.advanceActiveSpot();
    } else {
      spot.status = 'stand';
      this.advanceActiveSpot();
    }
  },

  blackjackDouble() {
    if (this.bj.status !== 'playing') return;
    const spot = this.bj.spots[this.bj.activeSpotIdx];
    if (!this.canDoubleSpot(spot)) return;

    const betCost = spot.baseBet || spot.bet;
    if (!spendMoney(betCost)) return showToast('Solde insuffisant pour doubler', 'error');

    spot.isDoubled = true;
    spot.bet = betCost * 2;
    this.recordBet();
    if (window.SoundFX) SoundFX.click();

    // Reçoit exactement 1 carte en doublant
    spot.hand.push(this.drawCardFromShoe());
    spot.score = this.calculateHand(spot.hand);

    if (spot.score > 21) {
      spot.status = 'bust';
      spot.outcome = { type: 'lose', text: `Brûlé (${spot.score})` };
    } else {
      spot.status = 'stand';
    }

    this.advanceActiveSpot();
  },

  blackjackSplit() {
    if (this.bj.status !== 'playing') return;
    const spot = this.bj.spots[this.bj.activeSpotIdx];
    if (!this.canSplitSpot(spot)) return;

    const betCost = spot.baseBet || spot.bet;
    if (!spendMoney(betCost)) return showToast('Solde insuffisant pour séparer', 'error');

    if (!spot.isSplit) {
      // PREMIER SPLIT SUR LA MAIN INITIALE
      spot.isSplit = true;
      const c1 = spot.hand[0];
      const c2 = spot.hand[1];
      const isAces = (c1.rank === 'A' && c2.rank === 'A');

      const card1Next = this.drawCardFromShoe();
      const card2Next = this.drawCardFromShoe();

      spot.splitHands = [
        [c1, card1Next],
        [c2, card2Next]
      ];
      spot.splitBets = [betCost, betCost];
      spot.splitIdx = 0;

      if (isAces) {
        // RÈGLE OFFICIELLE SPLIT D'AS (Monte-Carlo / ENHC) :
        // 1 seule carte par As. Aucun tirage supplémentaire (Stand automatique).
        spot.isAceSplit = true;
        showToast("Split d'As : 1 seule carte par As (Stand automatique)", 'gold');
        if (window.SoundFX) SoundFX.click();
        this.render();
        // Tour immédiatement terminé pour ce spot
        setTimeout(() => {
          this.advanceActiveSpot(true);
        }, 500);
        return;
      }
    } else {
      // RE-SPLIT SUR LA SOUS-MAIN EN COURS (cartes hors As)
      const currentSub = spot.splitHands[spot.splitIdx];
      const c1 = currentSub[0];
      const c2 = currentSub[1];
      const card1Next = this.drawCardFromShoe();
      const card2Next = this.drawCardFromShoe();

      spot.splitHands[spot.splitIdx] = [c1, card1Next];
      spot.splitHands.splice(spot.splitIdx + 1, 0, [c2, card2Next]);
      spot.splitBets.splice(spot.splitIdx + 1, 0, betCost);

      showToast(`Re-Split ! Paire séparée en ${spot.splitHands.length} mains`, 'gold');
    }

    if (window.SoundFX) SoundFX.click();
    this.render();
  },

  advanceActiveSpot(skipSubHands = false) {
    const spot = this.bj.spots[this.bj.activeSpotIdx];

    // Si la main est split et qu'il reste d'autres sous-mains à jouer (sauf si skipSubHands, ex: As)
    if (!skipSubHands && spot && spot.isSplit && spot.splitIdx < spot.splitHands.length - 1) {
      spot.splitIdx++;
      this.render();
      return;
    }

    // Trouver la prochaine main active qui est encore en statut 'playing'
    let nextIdx = -1;
    for (let i = this.bj.activeSpotIdx + 1; i < this.bj.spots.length; i++) {
      if (this.bj.spots[i].active && this.bj.spots[i].status === 'playing') {
        nextIdx = i;
        break;
      }
    }

    if (nextIdx !== -1) {
      this.bj.activeSpotIdx = nextIdx;
      this.render();
    } else {
      // Toutes les mains des joueurs sont terminées : tour de la Banque
      this.startDealerPlay();
    }
  },

  startDealerPlay() {
    this.bj.status = 'dealer';
    this.render();

    // Vérifier si toutes les mains sont brûlées
    const anySurviving = this.bj.spots.some(s => {
      if (!s.active) return false;
      if (s.isSplit) {
        return s.splitHands.some(sh => this.calculateHand(sh) <= 21);
      }
      return s.status === 'stand' || s.status === 'blackjack';
    });

    if (!anySurviving) {
      // Toutes les mains ont sauté (>21) : la banque gagne sans tirer
      this.resolveBlackjackOutcome();
      return;
    }

    // La Banque tire ses cartes selon la règle européenne (s'arrête à 17)
    const dealerStep = () => {
      this.bj.dealerHand.push(this.drawCardFromShoe());
      this.bj.dealerScore = this.calculateHand(this.bj.dealerHand);
      this.render();

      // Si le croupier a exactement 2 cartes et 21 -> Blackjack Naturel !
      if (this.bj.dealerHand.length === 2 && this.bj.dealerScore === 21) {
        this.bj.dealerHasNaturalBJ = true;
        this.resolveBlackjackOutcome();
        return;
      }

      if (this.bj.dealerScore < 17) {
        setTimeout(dealerStep, 450);
      } else {
        this.resolveBlackjackOutcome();
      }
    };

    setTimeout(dealerStep, 450);
  },

  resolveBlackjackOutcome() {
    const dScore = this.bj.dealerScore;
    const dealerHasBJ = this.isNaturalBJ(this.bj.dealerHand);
    let totalCashWon = 0;
    let totalWageredOnHands = 0;
    let roundNetSideProfit = 0;
    const resultSummaries = [];

    // Décompte officiel de l'Assurance (Paye 2:1 si Blackjack Croupier)
    if (this.bj.insuranceActive) {
      if (dealerHasBJ) {
        const insPayout = this.bj.insuranceCost * 3; // Mise remboursée + 2:1 net
        totalCashWon += insPayout;
        resultSummaries.push(`Assurance Payée (2:1) +${fmt(this.bj.insuranceCost * 2)}`);
        showToast(`🛡️ Assurance Gagnée (2:1) : +${fmt(this.bj.insuranceCost * 2)} !`, 'gold');
      } else {
        resultSummaries.push(`Assurance Perdue -${fmt(this.bj.insuranceCost)}`);
      }
    }

    this.bj.spots.forEach(spot => {
      if (!spot.active) return;
      totalWageredOnHands += spot.bet;

      // Décompte précis des Side Bets
      if (spot.sidePP > 0) {
        if (spot.sidePPRating && spot.sidePPRating.mult) {
          const gain = spot.sidePP * spot.sidePPRating.mult;
          roundNetSideProfit += gain;
          resultSummaries.push(`${spot.name} Paire +${fmt(gain)}`);
        } else {
          roundNetSideProfit -= spot.sidePP;
        }
      }

      if (spot.side213 > 0) {
        if (spot.side213Rating && spot.side213Rating.mult) {
          const gain = spot.side213 * spot.side213Rating.mult;
          roundNetSideProfit += gain;
          resultSummaries.push(`${spot.name} 21+3 +${fmt(gain)}`);
        } else {
          roundNetSideProfit -= spot.side213;
        }
      }

      // Gestion des mains séparées (Split)
      if (spot.isSplit) {
        spot.splitHands.forEach((subHand, sIdx) => {
          const pScore = this.calculateHand(subHand);
          const handBet = (spot.splitBets && spot.splitBets[sIdx]) ? spot.splitBets[sIdx] : (spot.baseBet || spot.bet);
          if (pScore > 21) {
            resultSummaries.push(`Main ${sIdx + 1} Brûlée`);
          } else if (dealerHasBJ) {
            resultSummaries.push(`Main ${sIdx + 1} Perdue contre BJ Banque`);
          } else if (dScore > 21 || pScore > dScore) {
            totalCashWon += (handBet * 2);
            resultSummaries.push(`Main ${sIdx + 1} Gagnée (+${fmt(handBet)})`);
          } else if (pScore === dScore) {
            totalCashWon += handBet;
            resultSummaries.push(`Main ${sIdx + 1} Égalité`);
          } else {
            resultSummaries.push(`Main ${sIdx + 1} Perdue`);
          }
        });
        spot.status = 'finished';
        return;
      }

      const pScore = spot.score;
      const playerHasBJ = this.isNaturalBJ(spot.hand);

      // CAS 1 : Joueur a brûlé (> 21)
      if (spot.status === 'bust' || pScore > 21) {
        spot.outcome = { type: 'lose', text: `Brûlé (${pScore})` };
        resultSummaries.push(`${spot.name} Brûlée`);
        return;
      }

      // CAS 2 : Le Croupier a un BLACKJACK NATUREL (As + 10-valeur en 2 cartes)
      // RÈGLE OFFICIELLE : Le Blackjack Naturel bat TOUS les 21 simples (en 3 cartes ou plus) !
      if (dealerHasBJ) {
        if (playerHasBJ) {
          // Égalité parfaite de Blackjack
          totalCashWon += spot.bet;
          spot.outcome = { type: 'push', text: 'Égalité de Blackjacks' };
          resultSummaries.push(`${spot.name} Égalité BJ`);
        } else {
          // Le joueur perd même s'il a 21 en 3 cartes ou plus !
          spot.outcome = { type: 'lose', text: 'Blackjack Croupier bat votre 21' };
          resultSummaries.push(`${spot.name} Perdue contre BJ Banque`);
        }
        return;
      }

      // CAS 3 : Le Croupier n'a PAS de Blackjack Naturel
      if (playerHasBJ) {
        // Le joueur gagne avec un paiement 3:2
        const profit = Math.round(spot.bet * 1.5);
        totalCashWon += (spot.bet + profit);
        spot.outcome = { type: 'bj', text: `Blackjack Naturel (3:2) +${fmt(profit)}` };
        if (typeof Prestige !== 'undefined') Prestige.emit('blackjack');
        resultSummaries.push(`${spot.name} Blackjack (3:2)`);
        return;
      }

      // Si le croupier a brûlé (> 21)
      if (dScore > 21) {
        totalCashWon += (spot.bet * 2);
        spot.outcome = { type: 'win', text: `Croupier brûle (${dScore}) +${fmt(spot.bet)}` };
        resultSummaries.push(`${spot.name} Gagne`);
        return;
      }

      // Comparaison normale des scores
      if (pScore > dScore) {
        totalCashWon += (spot.bet * 2);
        spot.outcome = { type: 'win', text: `Gagné (${pScore} vs ${dScore}) +${fmt(spot.bet)}` };
        resultSummaries.push(`${spot.name} Gagne`);
      } else if (pScore === dScore) {
        totalCashWon += spot.bet;
        spot.outcome = { type: 'push', text: `Égalité (${pScore} partout)` };
        resultSummaries.push(`${spot.name} Égalité`);
      } else {
        spot.outcome = { type: 'lose', text: `Perdu (${pScore} vs ${dScore})` };
        resultSummaries.push(`${spot.name} Perd`);
      }
    });

    if (totalCashWon > 0) {
      earnMoney(totalCashWon);
    }

    // RESTAURATION AUTOMATIQUE DES MISES INITIALES :
    // Annule le x2 temporaire de Doubler pour que la manche suivante ne démarre pas avec la mise doublée
    this.bj.spots.forEach(s => {
      if (s.baseBet) s.bet = s.baseBet;
      s.isDoubled = false;
      s.isAceSplit = false;
    });

    this.bj.status = 'finished';
    const netRoundProfit = (totalCashWon - totalWageredOnHands) + roundNetSideProfit;
    this.bj.roundNetGain = netRoundProfit;

    if (netRoundProfit > 0) {
      this.bj.msg = `Victoire : +${fmt(netRoundProfit)} (${resultSummaries.join(' · ')})`;
      this.bj.msgClass = 'bj-msg-win';
      this.recordResult('win', netRoundProfit, `Blackjack : +${fmt(netRoundProfit)}`);
      if (window.SoundFX) SoundFX.win();
    } else if (netRoundProfit < 0) {
      this.bj.msg = `Résultat : -${fmt(Math.abs(netRoundProfit))} (${resultSummaries.join(' · ')})`;
      this.bj.msgClass = 'bj-msg-lose';
      this.recordResult('lose', Math.abs(netRoundProfit), `Blackjack : -${fmt(Math.abs(netRoundProfit))}`);
      if (window.SoundFX) SoundFX.cough();
    } else {
      this.bj.msg = `Égalité générale : mises restituées`;
      this.bj.msgClass = 'bj-msg-push';
      this.recordResult('push', 0, 'Blackjack : Égalité');
    }

    saveGame();
    this.render();
  },

  blackjackRebet() {
    if (this.bj.status !== 'finished' && this.bj.status !== 'idle') return;
    if (this.bj.lastBets && this.bj.lastBets.length > 0) {
      this.bj.spots.forEach((s, idx) => {
        const lb = this.bj.lastBets[idx];
        if (lb) {
          s.active = lb.active;
          s.bet = lb.bet;
          s.baseBet = lb.bet;
          s.sidePP = lb.sidePP;
          s.side213 = lb.side213;
        }
      });
      showToast('Dernières mises rétablies', 'gold');
    }
    if (window.SoundFX) SoundFX.click();
    this.render();
  },

  blackjackClearBets() {
    if (this.bj.status !== 'finished' && this.bj.status !== 'idle') return;
    this.bj.spots.forEach((s, idx) => {
      s.bet = (idx === 1 ? this.cashMise : 0);
      s.baseBet = s.bet;
      s.active = (idx === 1);
      s.sidePP = 0;
      s.side213 = 0;
      s.hand = [];
      s.outcome = null;
    });
    showToast('Tapis nettoyé', 'info');
    if (window.SoundFX) SoundFX.click();
    this.render();
  },

  // ============================================================
  // JEU 2 : ROULETTE EUROPÉENNE (MONTE-CARLO)
  // 37 numéros (0 à 36). Règle du Partage : si 0 sort, 50% des chances simples remboursés !
  // Tapis complet : Plein, Cheval, Transversale, Carré, Sixain, Douzaines, Colonnes, Chances Simples.
  // ============================================================

  // ============================================================
  // JEU 2 : ROULETTE EUROPÉENNE (MONTE-CARLO)
  // 37 numéros (0 à 36). Règle du Partage : si 0 sort, 50% des chances simples remboursés !
  // Tapis complet : Plein, Cheval, Transversale, Carré, Sixain, Douzaines, Colonnes, Chances Simples.
  // ============================================================
  renderRoulette(content) {
    const totalBet = Object.values(this.roulette.bets).reduce((a, b) => a + b, 0);

    const row3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
    const row2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
    const row1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

    content.innerHTML = `
      <div class="casino-felt-table roulette-table">
        <div class="roulette-top-stage">
          <!-- Animated Wheel Canvas -->
          <div class="roulette-wheel-box">
            <canvas id="roulette-wheel-canvas" width="220" height="220"></canvas>
            <div class="wheel-pointer"></div>
          </div>

          <!-- Résultat direct & Historique -->
          <div class="roulette-status-box">
            <div class="roulette-last-win" id="roul-last-win">
              ${this.roulette.winningNumber !== null ? `
                <div class="win-bubble ${this.isRed(this.roulette.winningNumber) ? 'win-red' : (this.roulette.winningNumber === 0 ? 'win-green' : 'win-black')}">
                  ${this.roulette.winningNumber}
                </div>
                <div class="win-label">
                  ${this.roulette.winningNumber === 0 ? '0 VERT · PARTAGE' : (this.isRed(this.roulette.winningNumber) ? 'ROUGE' : 'NOIR')}
                </div>
              ` : '<span class="text-dim">Faites vos jeux</span>'}
            </div>

            <div class="roulette-history">
              <span style="font-size:0.75rem;font-weight:700;color:var(--empire-gold)">Derniers tirages :</span>
              <div class="history-chips">
                ${this.roulette.history.slice(0, 7).map(n => `
                  <span class="hist-chip ${this.isRed(n) ? 'hist-red' : (n === 0 ? 'hist-green' : 'hist-black')}">${n}</span>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- BARRE DES MISES SPÉCIALES EUROPÉENNES -->
        <div class="roulette-special-bar" style="display:flex;gap:6px;justify-content:center;margin-bottom:8px;flex-wrap:wrap">
          <button class="btn-empire ${this.roulette.specialMode === 'normal' ? 'btn-empire-primary' : 'btn-empire-secondary'}" data-smode="normal" style="font-size:0.75rem;padding:5px 12px;font-weight:700">
            Plein (35:1)
          </button>
          <button class="btn-empire ${this.roulette.specialMode === 'cheval' ? 'btn-empire-primary' : 'btn-empire-secondary'}" data-smode="cheval" style="font-size:0.75rem;padding:5px 12px;font-weight:700">
            À Cheval (17:1)
          </button>
          <button class="btn-empire ${this.roulette.specialMode === 'transversale' ? 'btn-empire-primary' : 'btn-empire-secondary'}" data-smode="transversale" style="font-size:0.75rem;padding:5px 12px;font-weight:700">
            Transversale (11:1)
          </button>
          <button class="btn-empire ${this.roulette.specialMode === 'carre' ? 'btn-empire-primary' : 'btn-empire-secondary'}" data-smode="carre" style="font-size:0.75rem;padding:5px 12px;font-weight:700">
            Carré (8:1)
          </button>
          <button class="btn-empire ${this.roulette.specialMode === 'sixain' ? 'btn-empire-primary' : 'btn-empire-secondary'}" data-smode="sixain" style="font-size:0.75rem;padding:5px 12px;font-weight:700">
            Sixain (5:1)
          </button>
        </div>

        ${this.roulette.specialMode !== 'normal' ? `
          <div style="background:rgba(245,158,11,0.15);border:1px solid #f59e0b;border-radius:8px;padding:6px 12px;margin-bottom:8px;text-align:center;font-size:0.78rem;color:#f59e0b">
            ${this.roulette.specialMode === 'cheval' ? (this.roulette.selectedFirstNum ? `Sélectionnez le 2ème numéro adjacent à ${this.roulette.selectedFirstNum}` : 'Mode Cheval : Cliquez sur le premier numéro') : ''}
            ${this.roulette.specialMode === 'transversale' ? 'Mode Transversale : Cliquez sur un numéro pour miser sur sa colonne de 3' : ''}
            ${this.roulette.specialMode === 'carre' ? 'Mode Carré : Cliquez sur un numéro pour miser sur son carré de 4' : ''}
            ${this.roulette.specialMode === 'sixain' ? 'Mode Sixain : Cliquez sur un numéro pour miser sur sa double-colonne de 6' : ''}
          </div>
        ` : ''}

        ${this.isNarrow() ? this.renderVerticalMat() : `
        <!-- LE VRAI TAPIS DE MISE VERT FRANÇAIS -->
        <div class="roulette-felt-mat">
          <div class="tapis-grid-outer" style="display:flex;gap:4px;margin-bottom:4px">
            <!-- Zéro Vert Européen -->
            <div class="tapis-cell tapis-zero" data-bet="num_0" style="width:52px;display:flex;align-items:center;justify-content:center;background:#15803d;color:#fff;border-radius:8px 0 0 8px;font-size:1.35rem;font-weight:900" title="Zéro Européen (Plein 35:1 · Règle du Partage sur chances simples)">
              <span>0</span>
              ${this.renderChipBadge('num_0')}
            </div>

            <!-- Grille 1 à 36 (3 lignes × 12 colonnes) -->
            <div class="tapis-numbers-grid" style="flex:1;display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:repeat(3,40px);gap:4px">
              ${row3.map(num => this.renderNumberCellHTML(num)).join('')}
              ${row2.map(num => this.renderNumberCellHTML(num)).join('')}
              ${row1.map(num => this.renderNumberCellHTML(num)).join('')}
            </div>

            <!-- Colonnes (2:1) -->
            <div class="tapis-columns-strip" style="width:52px;display:flex;flex-direction:column;gap:4px">
              <div class="tapis-cell tapis-side-cell" data-bet="col_3" style="height:40px;font-size:0.75rem" title="Colonne 3 (3,6,9...36)">2:1 ${this.renderChipBadge('col_3')}</div>
              <div class="tapis-cell tapis-side-cell" data-bet="col_2" style="height:40px;font-size:0.75rem" title="Colonne 2 (2,5,8...35)">2:1 ${this.renderChipBadge('col_2')}</div>
              <div class="tapis-cell tapis-side-cell" data-bet="col_1" style="height:40px;font-size:0.75rem" title="Colonne 1 (1,4,7...34)">2:1 ${this.renderChipBadge('col_1')}</div>
            </div>
          </div>

          <!-- Douzaines Européennes (P12, M12, D12) -->
          <div class="tapis-dozens-row">
            <div class="tapis-cell tapis-side-cell" data-bet="doz_1">1ère Douzaine (1-12) ${this.renderChipBadge('doz_1')}</div>
            <div class="tapis-cell tapis-side-cell" data-bet="doz_2">2ème Douzaine (13-24) ${this.renderChipBadge('doz_2')}</div>
            <div class="tapis-cell tapis-side-cell" data-bet="doz_3">3ème Douzaine (25-36) ${this.renderChipBadge('doz_3')}</div>
          </div>

          <!-- Chances Simples Européennes (1:1) avec règle du Partage -->
          <div class="tapis-outside-row">
            <div class="tapis-cell tapis-side-cell" data-bet="manque" title="Manque (1 à 18)">MANQUE (1-18) ${this.renderChipBadge('manque')}</div>
            <div class="tapis-cell tapis-side-cell" data-bet="pair" title="Pair">PAIR ${this.renderChipBadge('pair')}</div>
            <div class="tapis-cell tapis-side-cell tapis-red-label" data-bet="red" title="Rouge">ROUGE ${this.renderChipBadge('red')}</div>
            <div class="tapis-cell tapis-side-cell tapis-black-label" data-bet="black" title="Noir">NOIR ${this.renderChipBadge('black')}</div>
            <div class="tapis-cell tapis-side-cell" data-bet="impair" title="Impair">IMPAIR ${this.renderChipBadge('impair')}</div>
            <div class="tapis-cell tapis-side-cell" data-bet="passe" title="Passe (19 à 36)">PASSE (19-36) ${this.renderChipBadge('passe')}</div>
          </div>
        </div>
        `}

        <!-- Mises actives -->
        ${this.renderSpecialBetsList()}

        <!-- Contrôles et Lancement -->
        <div class="roulette-action-bar">
          ${this.renderWagerControls()}
          <div class="roulette-btns-row" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
            <button id="btn-roul-clear" class="btn-secondary btn-sm" ${totalBet === 0 || this.roulette.spinning ? 'disabled' : ''}>
              Effacer les mises
            </button>
            <div class="tapis-total-bet" style="font-size:0.9rem">Mise sur le tapis : <strong>${fmt(totalBet)}</strong></div>
            <button id="btn-roul-spin" class="btn-primary btn-huge btn-spin-wheel" ${totalBet === 0 || this.roulette.spinning ? 'disabled' : ''} style="font-weight:900">
              ${this.roulette.spinning ? 'Bille en rotation...' : 'LANCER LA BILLE'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindWagerEvents(content);
    this.drawRouletteWheel();
    content.querySelector('.roulette-wheel-box')?.addEventListener('click', () => {
      if (!this.roulette.spinning) this.openWheelView(false);
    });

    content.querySelectorAll('[data-smode]').forEach(btn => {
      btn.onclick = () => {
        this.roulette.specialMode = btn.dataset.smode;
        this.roulette.selectedFirstNum = null;
        this.render();
      };
    });

    content.querySelectorAll('.tapis-cell').forEach(cell => {
      cell.onclick = () => {
        if (this.roulette.spinning) return;
        const betKey = cell.dataset.bet;
        const num = parseInt(cell.dataset.num);
        if (!isNaN(num)) {
          this.handleNumberCellClick(num);
        } else if (betKey) {
          this.placeRouletteBet(betKey);
        }
      };
    });

    content.querySelector('#btn-roul-clear')?.addEventListener('click', () => {
      if (this.roulette.spinning) return;
      this.clearRouletteBets();
    });

    content.querySelector('#btn-roul-spin')?.addEventListener('click', () => {
      if (this.roulette.spinning) return;
      this.spinRoulette();
    });
  },

  // Écran étroit : tapis vertical (3 colonnes × 12 rangées), comme sur les roulettes mobiles
  isNarrow() {
    return window.innerWidth < 640;
  },

  renderVerticalMat() {
    const rows = [];
    for (let r = 0; r < 12; r++) {
      rows.push([r * 3 + 1, r * 3 + 2, r * 3 + 3].map(n => this.renderNumberCellHTML(n)).join(''));
    }
    const side = (key, label, cls = '') =>
      `<div class="tapis-cell tapis-side-cell ${cls}" data-bet="${key}"><span>${label}</span>${this.renderChipBadge(key)}</div>`;
    return `
      <div class="roulette-felt-mat mat-vertical">
        <div class="tapis-cell tapis-zero mv-zero" data-bet="num_0"><span>0</span>${this.renderChipBadge('num_0')}</div>
        <div class="mv-body">
          <div class="mv-outside">
            ${side('manque', '1-18')}${side('pair', 'Pair')}${side('red', 'Rouge', 'tapis-red-label')}
            ${side('black', 'Noir', 'tapis-black-label')}${side('impair', 'Impair')}${side('passe', '19-36')}
          </div>
          <div class="mv-dozens">
            ${side('doz_1', '1-12')}${side('doz_2', '13-24')}${side('doz_3', '25-36')}
          </div>
          <div class="mv-numbers">${rows.join('')}</div>
        </div>
        <div class="mv-columns">
          <div class="mv-spacer"></div>
          ${side('col_1', '2:1')}${side('col_2', '2:1')}${side('col_3', '2:1')}
        </div>
      </div>
    `;
  },

  renderNumberCellHTML(num) {
    const isRed = this.isRed(num);
    const betKey = `num_${num}`;
    const isSelected = this.roulette.selectedFirstNum === num;
    return `
      <div class="tapis-cell tapis-num-cell ${isRed ? 'tapis-red' : 'tapis-black'} ${isSelected ? 'selected-cell' : ''}" data-bet="${betKey}" data-num="${num}" style="${isSelected ? 'outline:3px solid #f59e0b;transform:scale(1.05);z-index:2' : ''}">
        <span class="tapis-num">${num}</span>
        ${this.renderChipBadge(betKey)}
      </div>
    `;
  },

  renderSpecialBetsList() {
    const specialKeys = Object.keys(this.roulette.bets).filter(k => k.startsWith('cheval_') || k.startsWith('street_') || k.startsWith('carre_') || k.startsWith('sixain_'));
    if (specialKeys.length === 0) return '';

    return `
      <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(234,179,8,0.2);border-radius:8px;padding:8px 12px;margin-bottom:10px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--empire-gold);margin-bottom:6px">Mises Combinées Actives :</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${specialKeys.map(k => {
            const val = this.roulette.bets[k];
            let label = k;
            if (k.startsWith('cheval_')) {
              const parts = k.replace('cheval_','').split('_');
              label = `Cheval ${parts[0]}/${parts[1]} (17:1)`;
            } else if (k.startsWith('street_')) {
              const start = parseInt(k.replace('street_',''));
              label = `Transversale ${start}-${start+2} (11:1)`;
            } else if (k.startsWith('carre_')) {
              const start = parseInt(k.replace('carre_',''));
              label = `Carré ${start},${start+1},${start+3},${start+4} (8:1)`;
            } else if (k.startsWith('sixain_')) {
              const start = parseInt(k.replace('sixain_',''));
              label = `Sixain ${start}-${start+5} (5:1)`;
            }
            return `<span style="background:#eab308;color:#000;font-size:0.7rem;font-weight:800;padding:2px 8px;border-radius:99px">${label} : ${fmt(val)}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  },

  handleNumberCellClick(num) {
    if (this.roulette.specialMode === 'normal') {
      this.placeRouletteBet(`num_${num}`);
      return;
    }

    if (this.roulette.specialMode === 'cheval') {
      if (this.roulette.selectedFirstNum === null) {
        this.roulette.selectedFirstNum = num;
        showToast(`Numéro ${num} sélectionné. Cliquez sur un numéro adjacent !`, 'info');
        this.render();
      } else {
        const n1 = this.roulette.selectedFirstNum;
        const n2 = num;
        if (n1 === n2) {
          this.roulette.selectedFirstNum = null;
          this.render();
          return;
        }
        if (!this.areNumbersAdjacent(n1, n2)) {
          showToast(`${n1} et ${n2} ne sont pas adjacents sur le tapis !`, 'error');
          this.roulette.selectedFirstNum = null;
          this.render();
          return;
        }
        const key = `cheval_${Math.min(n1, n2)}_${Math.max(n1, n2)}`;
        this.roulette.selectedFirstNum = null;
        this.placeRouletteBet(key);
      }
      return;
    }

    if (this.roulette.specialMode === 'transversale') {
      const colIdx = Math.floor((num - 1) / 3);
      const startNum = colIdx * 3 + 1;
      this.placeRouletteBet(`street_${startNum}`);
      return;
    }

    if (this.roulette.specialMode === 'carre') {
      let startNum = num;
      if (startNum % 3 === 0) startNum--;
      if (startNum > 32) startNum = 31;
      this.placeRouletteBet(`carre_${startNum}`);
      return;
    }

    if (this.roulette.specialMode === 'sixain') {
      const colIdx = Math.floor((num - 1) / 3);
      const startCol = Math.min(10, colIdx);
      const startNum = startCol * 3 + 1;
      this.placeRouletteBet(`sixain_${startNum}`);
      return;
    }
  },

  areNumbersAdjacent(n1, n2) {
    if (n1 === 0 || n2 === 0) {
      const other = n1 === 0 ? n2 : n1;
      return other === 1 || other === 2 || other === 3;
    }
    const diff = Math.abs(n1 - n2);
    if (diff === 1 && Math.floor((n1 - 1) / 3) === Math.floor((n2 - 1) / 3)) return true;
    if (diff === 3) return true;
    return false;
  },

  isRed(num) {
    return this.redNumbers.includes(num);
  },

  renderChipBadge(betKey) {
    const val = this.roulette.bets[betKey];
    if (!val) return '';
    return `<div class="tapis-chip-badge">${val >= 1000 ? (val/1000)+'k' : val}</div>`;
  },

  placeRouletteBet(betKey) {
    if (this.roulette.spinning) return;
    const addAmount = this.cashMise;
    if (!spendMoney(addAmount)) {
      showToast('Solde insuffisant ! Utilisez "+ Avance de Banque" en haut.', 'error');
      return;
    }

    this.recordBet();
    if (window.SoundFX) SoundFX.click();

    this.roulette.bets[betKey] = (this.roulette.bets[betKey] || 0) + addAmount;
    this.render();
  },

  clearRouletteBets() {
    if (this.roulette.spinning) return;
    for (let k in this.roulette.bets) {
      earnMoney(this.roulette.bets[k]);
    }
    showToast('Mises restituées.', 'info');
    this.roulette.bets = {};
    this.roulette.selectedFirstNum = null;
    if (window.SoundFX) SoundFX.click();
    this.render();
  },

  spinRoulette() {
    const totalBet = Object.values(this.roulette.bets).reduce((a, b) => a + b, 0);
    if (totalBet <= 0) return showToast('Placez une mise sur le tapis d\'abord !', 'error');

    this.roulette.spinning = true;
    this.render();

    const winningNum = Math.floor(Math.random() * 37);
    const winIndex = this.wheelNumbers.indexOf(winningNum);
    const slice = (Math.PI * 2) / 37;
    // La case gagnante doit finir sous la flèche (en haut, angle -π/2)
    const startAngle = this.roulette.wheelAngle % (Math.PI * 2);
    const finalAngle = -Math.PI / 2 - (winIndex + 0.5) * slice;
    let targetAngle = finalAngle;
    while (targetAngle < startAngle + Math.PI * 2 * 5) targetAngle += Math.PI * 2;

    const view = this.openWheelView(true);
    const duration = 5200;
    let startTime = null;

    const animate = (time) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3.2);

      this.roulette.wheelAngle = startAngle + ease * (targetAngle - startAngle);
      // La bille tourne en sens inverse puis tombe dans la case, sous la flèche
      const ballAngle = -Math.PI / 2 + (1 - ease) * Math.PI * 2 * 7;
      const drop = Math.max(0, (progress - 0.62) / 0.38);
      const ball = { angle: ballAngle, radiusRatio: 0.97 - 0.2 * Math.min(1, drop * 1.4) };

      this.drawRouletteWheel();
      if (view) this.drawWheelOn(view.canvas, ball);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (view) this.showWheelResult(view, winningNum);
        setTimeout(() => {
          this.closeWheelView();
          this.resolveRouletteSpin(winningNum, totalBet);
        }, view ? 1500 : 0);
      }
    };

    requestAnimationFrame(animate);
  },

  // Grande roue en plein écran (au lancer, ou en touchant la petite roue)
  openWheelView(isSpin) {
    this.closeWheelView();
    const overlay = document.createElement('div');
    overlay.className = 'roul-big-overlay';
    overlay.innerHTML = `
      <div class="roul-big-wrap">
        <div class="roul-big-pointer"></div>
        <canvas class="roul-big-canvas" width="720" height="720"></canvas>
        <div class="roul-big-result hidden"></div>
      </div>
      <p class="roul-big-hint">${isSpin ? 'Rien ne va plus…' : 'Touchez pour fermer'}</p>
    `;
    document.body.appendChild(overlay);
    if (!isSpin) overlay.addEventListener('click', () => this.closeWheelView());
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    const canvas = overlay.querySelector('canvas');
    this.drawWheelOn(canvas, null);
    return { overlay, canvas };
  },

  closeWheelView() {
    document.querySelectorAll('.roul-big-overlay').forEach(o => o.remove());
  },

  showWheelResult(view, n) {
    const el = view.overlay.querySelector('.roul-big-result');
    const hint = view.overlay.querySelector('.roul-big-hint');
    if (!el) return;
    el.className = `roul-big-result ${n === 0 ? 'win-green' : (this.isRed(n) ? 'win-red' : 'win-black')}`;
    el.textContent = n;
    if (hint) hint.textContent = n === 0 ? 'Zéro !' : `${n} ${this.isRed(n) ? 'Rouge' : 'Noir'} · ${n % 2 === 0 ? 'Pair' : 'Impair'} · ${n <= 18 ? 'Manque' : 'Passe'}`;
  },

  resolveRouletteSpin(winningNum, initialTotalBet) {
    this.roulette.spinning = false;
    this.roulette.winningNumber = winningNum;
    this.roulette.history.unshift(winningNum);
    if (this.roulette.history.length > 10) this.roulette.history.pop();

    let totalGains = 0;
    const isRedWin = this.isRed(winningNum);
    const isEven = winningNum !== 0 && winningNum % 2 === 0;

    for (let betKey in this.roulette.bets) {
      const amount = this.roulette.bets[betKey];

      // Exact number (Plein - pays 35:1 + original bet = 36x)
      if (betKey === `num_${winningNum}`) {
        totalGains += amount * 36;
      }
      // Cheval (Split - pays 17:1 + original bet = 18x)
      else if (betKey.startsWith('cheval_')) {
        const parts = betKey.replace('cheval_','').split('_').map(Number);
        if (parts.includes(winningNum)) {
          totalGains += amount * 18;
        }
      }
      // Transversale (Street - pays 11:1 + original bet = 12x)
      else if (betKey.startsWith('street_')) {
        const start = parseInt(betKey.replace('street_',''));
        if (winningNum >= start && winningNum <= start + 2) {
          totalGains += amount * 12;
        }
      }
      // Carré (Corner - pays 8:1 + original bet = 9x)
      else if (betKey.startsWith('carre_')) {
        const s = parseInt(betKey.replace('carre_',''));
        const cornerNums = [s, s + 1, s + 3, s + 4];
        if (cornerNums.includes(winningNum)) {
          totalGains += amount * 9;
        }
      }
      // Sixain (Line - pays 5:1 + original bet = 6x)
      else if (betKey.startsWith('sixain_')) {
        const start = parseInt(betKey.replace('sixain_',''));
        if (winningNum >= start && winningNum <= start + 5) {
          totalGains += amount * 6;
        }
      }
      // Colonnes (pays 2:1 + original bet = 3x)
      else if (betKey === 'col_1' && winningNum !== 0 && (winningNum - 1) % 3 === 0) {
        totalGains += amount * 3;
      } else if (betKey === 'col_2' && winningNum !== 0 && (winningNum - 2) % 3 === 0) {
        totalGains += amount * 3;
      } else if (betKey === 'col_3' && winningNum !== 0 && winningNum % 3 === 0) {
        totalGains += amount * 3;
      }
      // Color
      else if (betKey === 'red' && isRedWin) {
        totalGains += amount * 2;
      } else if (betKey === 'black' && !isRedWin && winningNum !== 0) {
        totalGains += amount * 2;
      }
      // Parity
      else if (betKey === 'pair' && isEven) {
        totalGains += amount * 2;
      } else if (betKey === 'impair' && !isEven && winningNum !== 0) {
        totalGains += amount * 2;
      }
      // Range 1-18 / 19-36
      else if (betKey === 'manque' && winningNum >= 1 && winningNum <= 18) {
        totalGains += amount * 2;
      } else if (betKey === 'passe' && winningNum >= 19 && winningNum <= 36) {
        totalGains += amount * 2;
      }
      // Dozens (pays 2:1 + original = 3x)
      else if (betKey === 'doz_1' && winningNum >= 1 && winningNum <= 12) {
        totalGains += amount * 3;
      } else if (betKey === 'doz_2' && winningNum >= 13 && winningNum <= 24) {
        totalGains += amount * 3;
      } else if (betKey === 'doz_3' && winningNum >= 25 && winningNum <= 36) {
        totalGains += amount * 3;
      }

      // RÈGLE EUROPÉENNE DU PARTAGE DU ZÉRO (Monte-Carlo / Casinos Français) :
      // Si 0 sort, 50% de la mise sur les chances simples (Rouge, Noir, Pair, Impair, Manque, Passe) est remboursée !
      else if (winningNum === 0 && ['red', 'black', 'pair', 'impair', 'manque', 'passe'].includes(betKey)) {
        totalGains += Math.floor(amount * 0.5);
      }
    }

    const netResult = totalGains - initialTotalBet;

    if (totalGains > 0) {
      earnMoney(totalGains);
      if (winningNum === 0 && netResult < 0) {
        showToast(`Règle du Partage (Zéro sorti) : 50% de vos chances simples remboursés (+${fmt(totalGains)}) !`, 'info');
        this.recordResult('lose', Math.abs(netResult), `N° 0 Partage (Remboursé ${fmt(totalGains)})`);
      } else {
        showToast(`🎉 GAGNÉ ! +${fmt(totalGains)} à la roulette (N° ${winningNum}) !`, 'gold');
        this.recordResult('win', netResult > 0 ? netResult : totalGains, `N° ${winningNum} ${winningNum === 0 ? 'Vert' : (isRedWin ? 'Rouge' : 'Noir')}`);
        if (window.SoundFX) SoundFX.win();
      }
    } else {
      showToast(`Numéro ${winningNum} : Mises perdues (-${fmt(initialTotalBet)})`, 'error');
      this.recordResult('lose', initialTotalBet, `N° ${winningNum} ${winningNum === 0 ? 'Vert' : (isRedWin ? 'Rouge' : 'Noir')}`);
      if (window.SoundFX) SoundFX.cough();
    }

    this.roulette.bets = {};
    this.roulette.selectedFirstNum = null;
    saveGame();
    this.render();
  },

  drawRouletteWheel() {
    const canvas = document.getElementById('roulette-wheel-canvas');
    if (canvas) this.drawWheelOn(canvas, null);
  },

  drawWheelOn(canvas, ball) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.43;
    const k = size / 220; // échelle par rapport à la petite roue d'origine

    ctx.clearRect(0, 0, size, size);

    // Cuvette en bois
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.495, 0, Math.PI * 2);
    ctx.fillStyle = '#5a3519';
    ctx.fill();
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = '#120a04';
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.roulette.wheelAngle);

    const slice = (Math.PI * 2) / 37;

    this.wheelNumbers.forEach((n, i) => {
      const angle = i * slice;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + slice);
      ctx.closePath();

      if (n === 0) {
        ctx.fillStyle = '#15803d'; // Zéro vert européen
      } else if (this.isRed(n)) {
        ctx.fillStyle = '#dc2626';
      } else {
        ctx.fillStyle = '#1b1918';
      }
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1 * k;
      ctx.stroke();

      ctx.save();
      ctx.rotate(angle + slice / 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(9 * k)}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.toString(), radius - 8 * k, 0);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, 30 * k, 0, Math.PI * 2);
    ctx.fillStyle = '#713f12';
    ctx.fill();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3 * k;
    ctx.stroke();

    ctx.restore();

    if (ball) {
      const r = radius * ball.radiusRatio;
      const bx = cx + Math.cos(ball.angle) * r;
      const by = cy + Math.sin(ball.angle) * r;
      ctx.beginPath();
      ctx.arc(bx, by, 5.5 * k, 0, Math.PI * 2);
      ctx.fillStyle = '#fffaf0';
      ctx.fill();
      ctx.lineWidth = 1.5 * k;
      ctx.strokeStyle = '#120a04';
      ctx.stroke();
    }
  }
};

window.Casino = Casino;
