// ============================================================
// STÉPHANE — Casino
// ============================================================

const Casino = {
  currentTab: 'pf',
  rouletteChoice: 'prudent',
  mise: 100,
  doubleUpActive: false,
  doubleUpCount: 0,
  doubleUpGain: 0,

  render() {
    const content = document.getElementById('casino-content');
    if (!content) return;

    const dailyEl = document.getElementById('bets-today');
    if (dailyEl) dailyEl.textContent = GameState.casinoBetsToday;

    if (GameState.level < GAME_CONST.CASINO_UNLOCK_LEVEL) {
      content.innerHTML = `<div class="casino-game-box">
        <div style="font-size:3rem">🔒</div>
        <h3 style="margin:16px 0">Casino débloqué au niveau ${GAME_CONST.CASINO_UNLOCK_LEVEL}</h3>
        <p style="color:var(--text-muted)">Continuez à courir pour débloquer le casino !</p>
      </div>`;
      return;
    }

    switch (this.currentTab) {
      case 'pf':       this.renderPileFace(content); break;
      case 'roulette': this.renderRoulette(content); break;
      case 'cigs':     this.renderCigCasino(content); break;
    }
  },

  checkLimit() {
    if (GameState.casinoBetsToday >= GAME_CONST.CASINO_MAX_BETS) {
      showToast('Limite de 50 mises par jour atteinte. Revenez demain !', 'error');
      return false;
    }
    return true;
  },

  recordBet() {
    GameState.casinoBetsToday++;
    const dailyEl = document.getElementById('bets-today');
    if (dailyEl) dailyEl.textContent = GameState.casinoBetsToday;
    saveGame();
  },

  // === PILE OU FACE ===
  renderPileFace(content) {
    content.innerHTML = `
      <div class="casino-game-box">
        <h3 style="font-family:var(--font-title);font-size:1.6rem;color:var(--accent);margin-bottom:16px">🪙 Pile ou Face</h3>
        <div class="casino-mise-row">
          <label>Mise :</label>
          <input type="number" id="pf-mise" class="game-input" value="${this.mise}" min="10" max="5000" style="width:100px"/>
          <div class="mise-quick-btns">
            <button class="mise-quick" data-v="50">50</button>
            <button class="mise-quick" data-v="100">100</button>
            <button class="mise-quick" data-v="500">500</button>
            <button class="mise-quick" data-v="1000">1k</button>
          </div>
        </div>
        <div class="casino-coin" id="casino-coin">🪙</div>
        <div class="casino-result-text" id="pf-result"></div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button id="btn-pile" class="btn-primary btn-huge">PILE</button>
          <button id="btn-face" class="btn-primary btn-huge">FACE</button>
        </div>
        <div id="double-up-zone" class="hidden" style="margin-top:16px;text-align:center">
          <p style="color:var(--gold);font-weight:700">Quitte ou double ? (${this.doubleUpCount}/3 fois)</p>
          <div style="display:flex;gap:12px;justify-content:center">
            <button id="btn-double-up-yes" class="double-up-btn">💰 Relancer ! (Gain : ${fmt(this.doubleUpGain)})</button>
            <button id="btn-double-up-no" class="btn-secondary">Encaisser</button>
          </div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-top:12px">Chance de gagner : 45% · Gain : ×2</p>
      </div>
    `;

    // Quick mise buttons
    content.querySelectorAll('.mise-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        const miseInput = document.getElementById('pf-mise');
        if (miseInput) miseInput.value = btn.dataset.v;
      });
    });

    document.getElementById('btn-pile')?.addEventListener('click', () => this.playPileFace('pile'));
    document.getElementById('btn-face')?.addEventListener('click', () => this.playPileFace('face'));
    document.getElementById('btn-double-up-yes')?.addEventListener('click', () => this.doubleUp());
    document.getElementById('btn-double-up-no')?.addEventListener('click', () => this.cashOut());
  },

  playPileFace(choice) {
    if (!this.checkLimit()) return;
    const miseInput = document.getElementById('pf-mise');
    const mise = parseInt(miseInput?.value || 100);
    if (mise < 10 || mise > 5000) return showToast('Mise entre 10 et 5000 €', 'error');
    if (!spendMoney(mise)) return showToast('Pas assez d\'argent !', 'error');
    this.recordBet();

    const coin = document.getElementById('casino-coin');
    const result = document.getElementById('pf-result');
    const doubleZone = document.getElementById('double-up-zone');
    if (!coin || !result) return;

    coin.classList.add('flipping');
    setTimeout(() => {
      coin.classList.remove('flipping');
      const won = Math.random() < 0.45;
      const resultSide = Math.random() < 0.5 ? 'pile' : 'face';
      coin.textContent = resultSide === 'pile' ? '🪙' : '💫';

      if (won) {
        const gain = mise * 2;
        result.textContent = `GAGNÉ ! +${fmt(gain)}`;
        result.className = 'casino-result-text casino-win';
        this.doubleUpActive = true;
        this.doubleUpCount = 0;
        this.doubleUpGain = gain;
        if (doubleZone) {
          doubleZone.classList.remove('hidden');
          const yearBtn = document.getElementById('btn-double-up-yes');
          if (yearBtn) yearBtn.textContent = `💰 Relancer ! (Gain actuel : ${fmt(gain)})`;
        }
        // Don't pay yet — waiting for double-up decision
        saveGame();
      } else {
        result.textContent = `PERDU ! -${fmt(mise)}`;
        result.className = 'casino-result-text casino-lose';
        if (doubleZone) doubleZone.classList.add('hidden');
        this.doubleUpActive = false;
      }
    }, 700);
  },

  doubleUp() {
    if (!this.doubleUpActive) return;
    if (this.doubleUpCount >= 3) { this.cashOut(); return; }
    if (!this.checkLimit()) return;
    this.recordBet();

    this.doubleUpCount++;
    const won = Math.random() < 0.45;
    const result = document.getElementById('pf-result');
    const doubleZone = document.getElementById('double-up-zone');
    const yearBtn = document.getElementById('btn-double-up-yes');

    if (won) {
      this.doubleUpGain *= 2;
      if (result) { result.textContent = `ENCORE ! Gain : ${fmt(this.doubleUpGain)}`; result.className = 'casino-result-text casino-win'; }
      if (this.doubleUpCount >= 3) {
        showToast('🔥 Série parfaite ×8 ! Incroyable !', 'gold');
        this.cashOut();
      } else {
        if (yearBtn) yearBtn.textContent = `💰 Relancer ! (Gain actuel : ${fmt(this.doubleUpGain)})`;
      }
    } else {
      this.doubleUpActive = false;
      this.doubleUpGain = 0;
      if (result) { result.textContent = 'PERDU ! Tout est parti !'; result.className = 'casino-result-text casino-lose'; }
      if (doubleZone) doubleZone.classList.add('hidden');
      showToast('💸 Tout perdu ! Retente ta chance.', 'error');
    }
  },

  cashOut() {
    if (this.doubleUpGain > 0) {
      earnMoney(this.doubleUpGain);
      showToast(`💰 Encaissé : ${fmt(this.doubleUpGain)} !`, 'gold');
    }
    this.doubleUpActive = false;
    this.doubleUpGain = 0;
    this.doubleUpCount = 0;
    const doubleZone = document.getElementById('double-up-zone');
    if (doubleZone) doubleZone.classList.add('hidden');
  },

  // === ROULETTE ===
  renderRoulette(content) {
    content.innerHTML = `
      <div class="casino-game-box">
        <h3 style="font-family:var(--font-title);font-size:1.6rem;color:var(--accent);margin-bottom:16px">🎰 Roulette du Cendrier</h3>
        <div class="roulette-options" id="roulette-opts">
          ${CASINO_ROULETTE.map(opt => `
            <div class="roulette-opt ${opt.id === this.rouletteChoice ? 'selected' : ''}" data-opt="${opt.id}">
              <span style="font-size:1.5rem">${opt.icon}</span>
              <div class="roulette-opt-name">${opt.name}</div>
              <div class="roulette-opt-odds">Chances : ${(opt.odds*100).toFixed(0)}%</div>
              <div class="roulette-opt-gain">×${opt.mult}</div>
            </div>
          `).join('')}
        </div>
        <div class="casino-mise-row">
          <label>Mise :</label>
          <input type="number" id="roul-mise" class="game-input" value="${this.mise}" min="10" max="5000" style="width:100px"/>
          <div class="mise-quick-btns">
            <button class="mise-quick" data-v="50">50</button>
            <button class="mise-quick" data-v="200">200</button>
            <button class="mise-quick" data-v="1000">1k</button>
          </div>
        </div>
        <div class="casino-result-text" id="roul-result"></div>
        <button id="btn-roulette-play" class="btn-primary btn-huge" style="margin-top:16px">🎰 Lancer !</button>
      </div>
    `;

    content.querySelectorAll('.roulette-opt').forEach(el => {
      el.addEventListener('click', () => {
        content.querySelectorAll('.roulette-opt').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        this.rouletteChoice = el.dataset.opt;
      });
    });

    content.querySelectorAll('.mise-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        const miseInput = document.getElementById('roul-mise');
        if (miseInput) miseInput.value = btn.dataset.v;
      });
    });

    document.getElementById('btn-roulette-play')?.addEventListener('click', () => this.playRoulette());
  },

  playRoulette() {
    if (!this.checkLimit()) return;
    const mise = parseInt(document.getElementById('roul-mise')?.value || 100);
    if (mise < 10 || mise > 5000) return showToast('Mise entre 10 et 5000 €', 'error');
    if (!spendMoney(mise)) return showToast('Pas assez d\'argent !', 'error');
    this.recordBet();

    const opt = CASINO_ROULETTE.find(o => o.id === this.rouletteChoice);
    const result = document.getElementById('roul-result');
    if (!opt || !result) return;

    result.textContent = '🎰 ...';
    setTimeout(() => {
      const won = Math.random() < opt.odds;
      if (won) {
        const gain = Math.round(mise * opt.mult);
        earnMoney(gain);
        result.textContent = `🎉 GAGNÉ ! +${fmt(gain)} !`;
        result.className = 'casino-result-text casino-win';
        if (opt.id === 'jackpot') showToast(`💥 JACKPOT ! +${fmt(gain)} !`, 'gold');
      } else {
        result.textContent = `❌ PERDU ! -${fmt(mise)}`;
        result.className = 'casino-result-text casino-lose';
      }
    }, 800);
  },

  // === CIGARETTE CASINO ===
  renderCigCasino(content) {
    const inv = getInventoryArray();
    if (!inv.length) {
      content.innerHTML = `<div class="casino-game-box"><div style="font-size:3rem">🚬</div><p style="margin-top:16px;color:var(--text-muted)">Vous n'avez aucune cigarette à miser ! Ouvrez des paquets d'abord.</p></div>`;
      return;
    }

    content.innerHTML = `
      <div class="casino-game-box">
        <h3 style="font-family:var(--font-title);font-size:1.6rem;color:var(--accent);margin-bottom:8px">🚬 Casino Cigarettes</h3>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">Misez une cigarette : si vous gagnez, vous en obtenez une supplémentaire de même rareté. Si vous perdez, vous la perdez.</p>

        <div style="margin-bottom:16px">
          <select id="casino-cig-sel" class="game-select" style="width:100%">
            <option value="">Choisir une cigarette...</option>
            ${inv.map(e => `<option value="${e.cig.id}" data-rarity="${e.cig.rarity}">${e.cig.icon} ${e.cig.name} (${RARITIES[e.cig.rarity]?.name}) — Chance : ${(CASINO_PILE_FACE[e.cig.rarity]?.win * 100 || 48).toFixed(0)}%</option>`).join('')}
          </select>
        </div>

        <div class="casino-result-text" id="cig-result"></div>

        <div style="display:flex;gap:12px;justify-content:center;margin-top:16px">
          <button id="btn-cig-bet" class="btn-primary btn-huge">🎲 Miser !</button>
        </div>
        <p style="font-size:0.75rem;color:var(--text-dim);margin-top:12px">Plus la cigarette est rare, plus le risque est grand. Gagnant → cigarette de même rareté (marque aléatoire).</p>
      </div>
    `;

    document.getElementById('btn-cig-bet')?.addEventListener('click', () => {
      const sel = document.getElementById('casino-cig-sel');
      const cigId = sel?.value;
      if (!cigId) return showToast('Choisissez une cigarette !', 'error');
      this.playCigCasino(cigId);
    });
  },

  playCigCasino(cigId) {
    if (!this.checkLimit()) return;
    const entry = GameState.inventory[cigId];
    if (!entry || entry.count <= 0) return showToast('Cigarette introuvable !', 'error');
    const cig = entry.cig;
    const oddsObj = CASINO_PILE_FACE[cig.rarity];
    if (!oddsObj) return;

    // Remove cigarette
    if (!removeCigarette(cigId, 1)) return;
    this.recordBet();

    const result = document.getElementById('cig-result');
    const won = Math.random() < oddsObj.win;

    setTimeout(() => {
      if (won) {
        // Get a random cig of same rarity (not seasonal, not same brand necessarily)
        const eligible = CIGARETTES.filter(c => c.rarity === cig.rarity && !c.seasonal);
        const reward = eligible[Math.floor(Math.random() * eligible.length)];
        addCigarette(reward);
        if (result) { result.textContent = `🎉 GAGNÉ ! Vous obtenez : ${reward.icon} ${reward.name} !`; result.className = 'casino-result-text casino-win'; }
        showToast(`🎉 Casino : vous gagnez ${reward.name} !`, 'gold');
      } else {
        if (result) { result.textContent = `❌ PERDU ! ${cig.name} est détruite.`; result.className = 'casino-result-text casino-lose'; }
        showToast(`💸 Casino : ${cig.name} perdue.`, 'error');
      }
      saveGame();
      // Re-render to update inventory
      setTimeout(() => this.renderCigCasino(document.getElementById('casino-content')), 1500);
    }, 600);
  },
};
