// ============================================================
// THE ASHTRAY KING — Mode Multijoueur Clandestin (PvP)
// 1. ⚔️ Duels de Cartes (Card Wars 3v3 avec Paris de Cash)
// 2. 🏁 Course Clandestine en Direct (4 Joueurs)
// 3. 🏆 Salon & Leaderboard Mondial
// ============================================================

const MultiplayerEngine = (() => {

  const RIVALS_POOL = [
    { name: 'Stéphane_Le_Parrain', rank: 'Parrain Suprême', level: 42, power: 8400, wins: 154, avatar: 'assets/stephane_avatar.jpg' },
    { name: 'Mika_Puff_93', rank: 'Grossiste Banlieue', level: 28, power: 5200, wins: 89, avatar: 'assets/cards/cig_puff-dragibus-rgb.webp' },
    { name: 'Tony_Montparnasse', rank: 'Baron du Tabac', level: 35, power: 7100, wins: 112, avatar: 'assets/stephane_cig.jpg' },
    { name: 'Le_Chinois_du_Rif', rank: 'Importateur Secret', level: 39, power: 7900, wins: 130, avatar: 'assets/cards/cig_sobranie-black-russian.webp' },
    { name: 'Zizou_PMU', rank: 'Pilier de Comptoir', level: 19, power: 3400, wins: 45, avatar: 'assets/cards/alc_ricard-51.webp' },
    { name: 'Clara_Fan_Club', rank: 'Collectionneur VIP', level: 31, power: 6500, wins: 98, avatar: 'assets/cards/act_actrice-clara-morgane.webp' },
  ];

  let currentTab = 'duels'; // 'duels' | 'race' | 'leaderboard'
  let selectedBet = 500;
  let selectedCards = [null, null, null]; // 3 card IDs
  let duelState = {
    status: 'idle', // 'idle' | 'matching' | 'battling' | 'finished'
    opponent: null,
    playerScore: 0,
    opponentScore: 0,
    roundLogs: [],
  };

  function init() {
    loadSavedDeck();
    render();
    console.log('[MultiplayerEngine] Initialized.');
  }

  function loadSavedDeck() {
    try {
      const saved = localStorage.getItem('ashtray_pvp_deck');
      if (saved) selectedCards = JSON.parse(saved);
    } catch(e) {}
  }

  function saveDeck() {
    localStorage.setItem('ashtray_pvp_deck', JSON.stringify(selectedCards));
  }

  function getCardPower(item) {
    if (!item) return 0;
    const rarityWeights = { commune: 50, 'peu-commune': 150, rare: 450, epique: 1400, legendaire: 4500, mythique: 15000 };
    const base = rarityWeights[item.rarity] || 100;
    const valueBonus = Math.round(Math.sqrt(item.value || 100) * 10);
    const clickBonus = Math.round((item.clickBoost || 1) * 80);
    return base + valueBonus + clickBonus;
  }

  function autoFillDeck() {
    if (typeof EmpireEngine === 'undefined') return;
    const inv = EmpireEngine.getState().inventory || {};
    const ownedIds = Object.keys(inv).filter(id => inv[id] > 0);
    if (ownedIds.length === 0) {
      if (window.showToast) showToast('Ouvrez des paquets pour obtenir des cartes avant de combattre !', 'warning');
      return;
    }

    const sorted = ownedIds.map(id => getEmpireItemById(id)).filter(Boolean).sort((a,b) => getCardPower(b) - getCardPower(a));
    selectedCards = [
      sorted[0]?.id || null,
      sorted[1]?.id || sorted[0]?.id || null,
      sorted[2]?.id || sorted[0]?.id || null
    ];
    saveDeck();
    render();
    if (window.showToast) showToast('Deck de combat optimisé avec vos 3 meilleures cartes !', 'success');
  }

  function startMatchmaking() {
    const validCards = selectedCards.filter(Boolean);
    if (validCards.length < 3) {
      autoFillDeck();
      if (selectedCards.filter(Boolean).length < 3) return;
    }

    const curCash = (typeof ClickerEngine !== 'undefined' && ClickerEngine.getCash) ? ClickerEngine.getCash() : 0;
    if (curCash < selectedBet) {
      if (window.showToast) showToast(`Pas assez de cash ! Mise de ${selectedBet.toLocaleString()} € requise.`, 'error');
      return;
    }

    // Deduct bet
    if (typeof ClickerEngine !== 'undefined' && ClickerEngine.setCash) {
      ClickerEngine.setCash(curCash - selectedBet);
    }

    duelState.status = 'matching';
    duelState.roundLogs = [];
    duelState.playerScore = 0;
    duelState.opponentScore = 0;

    // Pick random rival
    const rival = RIVALS_POOL[Math.floor(Math.random() * RIVALS_POOL.length)];
    duelState.opponent = rival;

    render();

    // Match found animation
    setTimeout(() => {
      duelState.status = 'battling';
      runBattleRounds();
    }, 1400);
  }

  function runBattleRounds() {
    const pItems = selectedCards.map(id => getEmpireItemById(id)).filter(Boolean);
    const opPowerBase = Math.round(duelState.opponent.power / 3);

    let round = 1;
    function playRound() {
      if (round > 3) {
        finishBattle();
        return;
      }

      const pCard = pItems[round - 1];
      const pPower = getCardPower(pCard);
      // Random opponent power with variation
      const fluc = (Math.random() * 0.4) - 0.2;
      const opPower = Math.max(80, Math.round(opPowerBase * (1 + fluc)));

      const pCrit = Math.random() < 0.25;
      const finalPPower = pCrit ? Math.round(pPower * 1.5) : pPower;

      const pWins = finalPPower >= opPower;
      if (pWins) duelState.playerScore++;
      else duelState.opponentScore++;

      duelState.roundLogs.push({
        round,
        pCardName: pCard.name,
        pPower: finalPPower,
        pCrit,
        opPower,
        winner: pWins ? 'player' : 'opponent'
      });

      if (window.SoundFX) {
        if (pWins && SoundFX.win) SoundFX.win();
        else if (SoundFX.click) SoundFX.click();
      }

      render();
      round++;
      setTimeout(playRound, 1200);
    }

    playRound();
  }

  function finishBattle() {
    duelState.status = 'finished';
    const playerWon = duelState.playerScore > duelState.opponentScore;

    if (playerWon) {
      const pot = selectedBet * 2;
      if (typeof ClickerEngine !== 'undefined' && ClickerEngine.addCash) {
        ClickerEngine.addCash(pot);
      }
      if (window.SoundFX && SoundFX.win) SoundFX.win();
      if (window.showToast) showToast(`🏆 VICTOIRE ÉCLATANTE ! Vous remportez ${pot.toLocaleString()} € !`, 'success');
    } else {
      if (window.showToast) showToast(`💀 DÉFAITE face à ${duelState.opponent.name}... Vous perdez votre mise.`, 'error');
    }

    render();
  }

  function render() {
    const container = document.getElementById('multi-content');
    if (!container) return;

    container.innerHTML = `
      <div class="multi-view-wrap">
        <div class="multi-nav-tabs">
          <button class="multi-tab-btn ${currentTab === 'duels' ? 'active' : ''}" data-tab="duels">
            ⚔️ Duels de Cartes
          </button>
          <button class="multi-tab-btn ${currentTab === 'race' ? 'active' : ''}" data-tab="race">
            🏁 Course Multijoueur
          </button>
          <button class="multi-tab-btn ${currentTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">
            🏆 Classement Mondial
          </button>
        </div>

        ${currentTab === 'duels' ? renderDuelsView() : ''}
        ${currentTab === 'race' ? renderRaceView() : ''}
        ${currentTab === 'leaderboard' ? renderLeaderboardView() : ''}
      </div>
    `;

    bindEvents(container);
  }

  function renderDuelsView() {
    const pItems = selectedCards.map(id => (id ? getEmpireItemById(id) : null));
    const totalPower = pItems.reduce((acc, c) => acc + (c ? getCardPower(c) : 0), 0);

    return `
      <div class="pvp-arena-container">
        <!-- Deck Bar -->
        <div class="pvp-deck-header">
          <div>
            <h3 style="font-family:var(--font-title);font-size:1.4rem;color:#f59e0b;margin:0">⚔️ Cartel Wars (3 contre 3)</h3>
            <p style="font-size:0.75rem;color:var(--text-muted);margin:2px 0">Composez votre trio de choc pour défier les barons du réseau.</p>
          </div>
          <button id="btn-pvp-autofill" class="btn-empire btn-empire-secondary" style="font-size:0.75rem;padding:6px 14px">
            ⚡ Optimiser le Deck
          </button>
        </div>

        <!-- 3 Combat Slots -->
        <div class="pvp-slots-row">
          ${[0, 1, 2].map(idx => {
            const item = pItems[idx];
            if (!item) {
              return `
                <div class="pvp-slot-empty">
                  <span style="font-size:1.8rem">🃏</span>
                  <span style="font-size:0.7rem;color:var(--text-muted)">Slot ${idx + 1} Vide</span>
                </div>
              `;
            }
            return `
              <div class="pvp-slot-card rarity-${item.rarity}">
                <img src="${resolveCardPhoto(item)}" class="pvp-slot-img" alt="${item.name}" />
                <div class="pvp-slot-info">
                  <div class="pvp-slot-name">${item.name}</div>
                  <div class="pvp-slot-power">⚡ ${getCardPower(item).toLocaleString()} PWR</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="text-align:center;font-family:var(--font-stat);font-size:0.85rem;color:#fbbf24;font-weight:800;margin:10px 0">
          Puissance Totale du Deck : ${totalPower.toLocaleString()} PWR
        </div>

        <!-- Bets selector & Action -->
        ${duelState.status === 'idle' ? `
          <div class="pvp-bet-control">
            <span style="font-size:0.78rem;color:var(--text-muted);font-weight:700">Mise du Duel :</span>
            <div class="pvp-bet-chips">
              ${[100, 500, 2500, 10000, 50000].map(amt => `
                <button class="pvp-bet-chip ${selectedBet === amt ? 'active' : ''}" data-amt="${amt}">
                  ${amt >= 1000 ? (amt/1000) + 'k' : amt} €
                </button>
              `).join('')}
            </div>
          </div>

          <button id="btn-start-duel" class="btn-empire btn-empire-primary btn-full" style="padding:14px;font-size:1rem;margin-top:10px">
            ⚔️ Trouver un Adversaire (${selectedBet.toLocaleString()} €)
          </button>
        ` : ''}

        <!-- Matching / Battle Screen -->
        ${duelState.status !== 'idle' ? `
          <div class="pvp-battle-screen">
            <div class="pvp-clash-header">
              <div class="pvp-fighter">
                <span class="pvp-avatar-tag">VOUS</span>
                <span class="pvp-score-box">${duelState.playerScore}</span>
              </div>
              <div class="pvp-vs-badge">VS</div>
              <div class="pvp-fighter">
                <span class="pvp-score-box">${duelState.opponentScore}</span>
                <span class="pvp-avatar-tag">${duelState.opponent?.name || 'Rivaux'}</span>
              </div>
            </div>

            <!-- Round Logs -->
            <div class="pvp-logs-box">
              ${duelState.status === 'matching' ? `
                <div class="pvp-matching-pulse">
                  <div class="pvp-spinner"></div>
                  <span>Recherche d'un parrain en ligne sur le réseau...</span>
                </div>
              ` : ''}

              ${duelState.roundLogs.map(log => `
                <div class="pvp-log-entry ${log.winner === 'player' ? 'win' : 'loss'}">
                  <span>Round ${log.round} : <strong>${log.pCardName}</strong> (${log.pPower} PWR ${log.pCrit ? '🔥 CRIT' : ''})</span>
                  <span>vs ${duelState.opponent.name} (${log.opPower} PWR) ➔ ${log.winner === 'player' ? '🏆 Victoire !' : '❌ Défaite'}</span>
                </div>
              `).join('')}
            </div>

            ${duelState.status === 'finished' ? `
              <div style="text-align:center;margin-top:14px">
                <h4 style="font-family:var(--font-title);font-size:1.3rem;color:${duelState.playerScore > duelState.opponentScore ? '#4ade80' : '#ef4444'}">
                  ${duelState.playerScore > duelState.opponentScore ? '🎉 VICTOIRE DANS L\'ARÈNE !' : '💀 DÉFAITE AU COMBAT !'}
                </h4>
                <button id="btn-rematch" class="btn-empire btn-empire-primary" style="padding:10px 24px;margin-top:8px">
                  Rejouer un Duel
                </button>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderRaceView() {
    return `
      <div class="pvp-race-container" style="text-align:center;padding:20px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px">
        <h3 style="font-family:var(--font-title);font-size:1.4rem;color:#f59e0b">🏁 Courses Clandestines 4 Joueurs</h3>
        <p style="font-size:0.8rem;color:var(--text-muted);max-width:440px;margin:8px auto">
          Affrontez les contrebandiers sur la piste avec boosts en direct, esquive des patrouilles et paris de paquets scellés.
        </p>
        <div style="margin:20px auto;max-width:360px;background:rgba(0,0,0,0.4);border-radius:12px;padding:12px;text-align:left">
          <div style="font-size:0.75rem;color:#4ade80;font-weight:700;margin-bottom:8px">🟢 Salon Multijoueur Ouvert :</div>
          <div style="font-size:0.78rem;color:#fff;display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
            <span>1. Vous (Prêt)</span><span>🚗 205 GTI Turbo</span>
          </div>
          <div style="font-size:0.78rem;color:#a9a6a2;display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
            <span>2. Stéphane_Le_Fumeur</span><span>🏎️ Renault Magnum</span>
          </div>
          <div style="font-size:0.78rem;color:#a9a6a2;display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
            <span>3. Mika_93</span><span>🛵 Scooter 50cc Débridé</span>
          </div>
          <div style="font-size:0.78rem;color:#a9a6a2;display:flex;justify-content:space-between;padding:4px 0">
            <span>4. Le_Chinois_du_Rif</span><span>🚙 Fourgon Blindé</span>
          </div>
        </div>
        <button onclick="navigateTo('course')" class="btn-empire btn-empire-primary" style="padding:12px 28px">
          🚀 Rejoindre la Piste de Course
        </button>
      </div>
    `;
  }

  function renderLeaderboardView() {
    return `
      <div class="pvp-leaderboard-container">
        <h3 style="font-family:var(--font-title);font-size:1.3rem;color:#f59e0b;margin-bottom:12px">🏆 Classement Mondial des Parrains</h3>
        <div class="pvp-lb-list">
          ${RIVALS_POOL.map((r, i) => `
            <div class="pvp-lb-row ${i === 0 ? 'top-1' : ''}">
              <div class="pvp-lb-rank">#${i + 1}</div>
              <img src="${r.avatar}" class="pvp-lb-avatar" alt="${r.name}" onerror="this.src='assets/logo.jpg'" />
              <div class="pvp-lb-info">
                <div class="pvp-lb-name">${r.name}</div>
                <div class="pvp-lb-title">${r.rank} · Niv. ${r.level}</div>
              </div>
              <div class="pvp-lb-stat">
                <span class="pvp-lb-power">${r.power.toLocaleString()} PWR</span>
                <span class="pvp-lb-wins">${r.wins} Victoires</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function bindEvents(container) {
    container.querySelectorAll('.multi-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        render();
      });
    });

    container.querySelector('#btn-pvp-autofill')?.addEventListener('click', autoFillDeck);

    container.querySelectorAll('.pvp-bet-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        selectedBet = parseInt(chip.dataset.amt);
        render();
      });
    });

    container.querySelector('#btn-start-duel')?.addEventListener('click', startMatchmaking);
    container.querySelector('#btn-rematch')?.addEventListener('click', () => {
      duelState.status = 'idle';
      render();
    });
  }

  return {
    init,
    render,
  };
})();
