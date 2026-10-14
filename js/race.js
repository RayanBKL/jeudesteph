// ============================================================
// THE ASHTRAY KING — Race Engine (PMU Hippodrome Style, Zero Emojis)
// 4-Couloirs avec rivaux virtuels et podium en direct
// ============================================================

const RaceEngine = {
  active: false,
  track: null,
  distance: 0,
  speed: 0,
  energy: 30,
  cough: 0,
  coughing: false,
  coughTimer: 0,
  elapsed: 0,
  cigarettes: [],
  currentCigIndex: 0,
  comboState: { greenStreak: 0, lastBrands: [], combosFired: [] },
  rafId: null,
  lastFrameTime: 0,

  // Concurrents virtuels (IA du PMU)
  rivals: [],

  initRivals(track) {
    const goldPace = (track.distance / track.goldTime) * 3.6;
    const silverPace = (track.distance / track.silverTime) * 3.6;
    const bronzePace = (track.distance / track.bronzeTime) * 3.6;

    this.rivals = [
      {
        id: 'bot-1',
        name: 'Gégé Philip Morris',
        badge: '#2 GÉGÉ',
        avatar: 'GE',
        color: '#ef4444',
        distance: 0,
        baseSpeed: silverPace * (0.95 + Math.random() * 0.12),
        currentSpeed: silverPace,
        boostTimer: 0,
        nextBoost: 2 + Math.random() * 3,
        element: document.getElementById('runner-bot-1'),
        speedEl: document.getElementById('speed-bot-1')
      },
      {
        id: 'bot-2',
        name: 'Momo Sans Filtre',
        badge: '#3 MOMO',
        avatar: 'MO',
        color: '#3b82f6',
        distance: 0,
        baseSpeed: silverPace * (0.90 + Math.random() * 0.15),
        currentSpeed: silverPace,
        boostTimer: 0,
        nextBoost: 3 + Math.random() * 4,
        element: document.getElementById('runner-bot-2'),
        speedEl: document.getElementById('speed-bot-2')
      },
      {
        id: 'bot-3',
        name: 'Dédé le Briquet',
        badge: '#4 DÉDÉ',
        avatar: 'DE',
        color: '#10b981',
        distance: 0,
        baseSpeed: bronzePace * (0.94 + Math.random() * 0.14),
        currentSpeed: bronzePace,
        boostTimer: 0,
        nextBoost: 4 + Math.random() * 3,
        element: document.getElementById('runner-bot-3'),
        speedEl: document.getElementById('speed-bot-3')
      }
    ];
  },

  start(trackId) {
    this.track = TRACKS[trackId] || TRACKS.trottoir;

    this.distance = 0;
    this.speed = 0;
    this.energy = 30 + (GameState.skills.souffle || 0) * 3;
    this.cough = 0;
    this.coughing = false;
    this.coughTimer = 0;
    this.elapsed = 0;
    // En course classée, tout le monde court à armes égales (pas de bonus de cartes)
    this.cigarettes = this.leagueMode ? [] : getEquippedCigs().map(c => ({ ...c, used: false }));
    this.currentCigIndex = 0;
    this.comboState = { greenStreak: 0, lastBrands: [], combosFired: [] };
    this.lastFrameTime = performance.now();

    // Initialiser les rivaux
    this.initRivals(this.track);
    // Course classée : les rivaux vont plus ou moins vite selon le rang du joueur
    // Vitesse calée sur la vitesse max du joueur : ~62 % au rang Mégot, ~92 % au rang Roi du Comptoir
    if (this.leagueMode) {
      const base = GAME_CONST.MAX_SPEED * (0.62 + this.leagueMode.difficulty * 0.3);
      const spread = [1.02, 0.97, 0.9];
      this.rivals.forEach((r, i) => { r.baseSpeed = base * spread[i] * (0.97 + Math.random() * 0.06); r.currentSpeed = r.baseSpeed; });
    }

    // Initialiser l'UI PMU
    const badgeEl = document.getElementById('pmu-track-badge');
    const distEl = document.getElementById('pmu-dist-total');
    const playerNameEl = document.getElementById('pmu-player-name');
    if (badgeEl) badgeEl.textContent = this.track.name;
    if (distEl) distEl.textContent = this.track.distance + ' m';
    if (playerNameEl) playerNameEl.textContent = GameState.pseudo || 'Stéphane';

    showPage('race');
    this.renderQueue();
    this.renderLeaderboard();
    this.active = true;
    this.loop();
  },

  loop() {
    if (!this.active) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    this.update(dt);
    this.render();

    if (this.distance >= this.track.distance) {
      this.finish();
      return;
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  },

  update(dt) {
    this.elapsed += dt;

    // Gestion de la toux
    if (this.coughing) {
      this.coughTimer -= dt;
      this.speed = 0;
      if (this.coughTimer <= 0) {
        this.coughing = false;
        this.cough = Math.max(0, this.cough - 40);
        hideCough();
      }
      this.updateRivals(dt);
      return;
    }

    // Perte naturelle d'énergie
    this.energy = Math.max(0, this.energy - GAME_CONST.ENERGY_DECAY_RATE * dt);

    // Baisse naturelle de la toux
    this.cough = Math.max(0, this.cough - GAME_CONST.COUGH_DECAY_RATE * dt);

    // Vitesse basée sur l'énergie
    const targetSpeed = (this.energy / 100) * GAME_CONST.MAX_SPEED;
    this.speed += (targetSpeed - this.speed) * 0.15;

    // Avancée du joueur
    const speedMs = (this.speed * 1000) / 3600;
    this.distance += speedMs * dt;

    // Mise à jour de l'IA des rivaux
    this.updateRivals(dt);
  },

  updateRivals(dt) {
    this.rivals.forEach(bot => {
      bot.boostTimer += dt;
      if (bot.boostTimer >= bot.nextBoost) {
        bot.boostTimer = 0;
        bot.nextBoost = 3 + Math.random() * 5;
        bot.currentSpeed = bot.baseSpeed * (1.1 + Math.random() * 0.25);
      } else {
        bot.currentSpeed += (bot.baseSpeed - bot.currentSpeed) * 0.05;
      }

      const botSpeedMs = (bot.currentSpeed * 1000) / 3600;
      bot.distance += botSpeedMs * dt;
    });
  },

  smoke() {
    if (!this.active || this.coughing) return;

    const available = this.cigarettes.filter(c => !c.used);
    const cig = available[0] || null;
    if (window.SoundFX) SoundFX.puff();

    let energyGain = GAME_CONST.SMOKE_ENERGY_GAIN;
    let coughAdded = GAME_CONST.SMOKE_COUGH_BASE;

    if (cig) {
      cig.used = true;
      const rarity = RARITIES[cig.rarity];
      energyGain += (rarity?.energy || 10);
      coughAdded += (rarity?.cough || 20);

      // Réductions de compétences
      const resCough = (GameState.skills.resistance_toux || 0) * 0.05;
      coughAdded *= (1 - resCough);

      // Série "Les Roulées" : bonus de vitesse
      if (cig.series === 'roulees') energyGain *= 1.25;
      // "Les Années 80" : -15% toux
      if (cig.series === 'annees80') coughAdded *= 0.85;
    }

    // Vérifier zone verte (timing parfait)
    const inGreen = this.energy >= 10 && this.energy <= 25;
    if (inGreen) {
      energyGain *= 1.5;
      coughAdded = Math.round(coughAdded * 0.4);
      this.comboState.greenStreak++;
      showComboText('TIMING PARFAIT ! Boost +50%');

      if (this.comboState.greenStreak >= 3) {
        this.speed = GAME_CONST.MAX_SPEED * 1.3;
        coughAdded = 0;
        this.comboState.combosFired.push('chaine-parfaite');
        showComboText('CHAÎNE PARFAITE ! Boost max');
        this.comboState.greenStreak = 0;
      }
    } else {
      this.comboState.greenStreak = 0;
    }

    // Combos de marque
    if (cig) {
      this.comboState.lastBrands.push(cig.id);
      if (this.comboState.lastBrands.length > 3) this.comboState.lastBrands.shift();
      if (this.comboState.lastBrands.length >= 2 &&
          this.comboState.lastBrands[this.comboState.lastBrands.length-2] === this.comboState.lastBrands[this.comboState.lastBrands.length-1]) {
        this.speed *= 1.35;
        this.comboState.combosFired.push('enchainement-2');
        showComboText('Double de marque ! Boost +35%');
      }
    }

    // Appliquer l'énergie et la toux
    this.energy = Math.min(100, this.energy + energyGain);
    this.cough = Math.min(100, this.cough + coughAdded);

    this.currentCigIndex++;
    this.renderQueue();

    // Effet visuel de fumée sur le profil
    showSmokeEffect();
  },

  triggerCough() {
    this.coughing = true;
    this.coughTimer = GAME_CONST.COUGH_BLOCK_MS / 1000;
    this.speed = 0;
    this.comboState.greenStreak = 0;
    if (window.SoundFX) SoundFX.cough();
    document.body.classList.add('screen-shake-intense');
    setTimeout(() => document.body.classList.remove('screen-shake-intense'), 400);
    showCough();
    showComboText('QUINTE DE TOUX ! Arrêt temporaire');
  },

  getRanking() {
    const list = [
      { id: 'player', name: GameState.pseudo || 'Stéphane', distance: this.distance, isPlayer: true },
      ...this.rivals.map(r => ({ id: r.id, name: r.name, distance: r.distance, isPlayer: false }))
    ];
    list.sort((a, b) => b.distance - a.distance);
    return list;
  },

  renderLeaderboard() {
    const ranking = this.getRanking();

    ranking.forEach((racer, index) => {
      const el = document.getElementById(`lead-pos-${index + 1}`);
      if (el) {
        el.textContent = racer.name + (racer.isPlayer ? ' (Vous)' : '');
        el.parentElement.style.opacity = racer.isPlayer ? '1' : '0.85';
      }
    });

    const playerRank = ranking.findIndex(r => r.isPlayer) + 1;
    const liveRankEl = document.getElementById('r-live-rank');
    if (liveRankEl) {
      const suffixes = { 1: '1er', 2: '2e', 3: '3e', 4: '4e' };
      liveRankEl.textContent = suffixes[playerRank] || `${playerRank}e`;
    }
  },

  render() {
    const trackDist = this.track.distance;

    // Gauges
    const gEnergy = document.getElementById('g-energy');
    const gCough = document.getElementById('g-cough');
    const gvEnergy = document.getElementById('gv-energy');
    const gvCough = document.getElementById('gv-cough');
    if (gEnergy) gEnergy.style.width = this.energy.toFixed(0) + '%';
    if (gCough)  gCough.style.width = this.cough.toFixed(0) + '%';
    if (gvEnergy) gvEnergy.textContent = this.energy.toFixed(0);
    if (gvCough)  gvCough.textContent  = this.cough.toFixed(0);

    // Déclenchement de la toux
    if (this.cough >= 100 && !this.coughing) {
      this.triggerCough();
    }

    // Stats
    const rDist = document.getElementById('r-dist');
    const rTime = document.getElementById('r-time');
    const rSpeed = document.getElementById('r-speed');
    if (rDist) rDist.textContent = Math.min(Math.round(this.distance), trackDist) + ' m';
    if (rTime) rTime.textContent = this.elapsed.toFixed(1) + 's';
    if (rSpeed) rSpeed.textContent = this.speed.toFixed(0) + ' km/h';

    // Position du joueur sur le rail PMU (0% à 90% max pour laisser voir la ligne d'arrivée)
    const playerPct = Math.min((this.distance / trackDist) * 88, 88);
    const playerChip = document.getElementById('runner-player');
    if (playerChip) playerChip.style.left = playerPct + '%';

    // Positions des rivaux sur leurs rails
    this.rivals.forEach(bot => {
      const botPct = Math.min((bot.distance / trackDist) * 88, 88);
      if (bot.element) bot.element.style.left = botPct + '%';
      if (bot.speedEl) bot.speedEl.textContent = bot.currentSpeed.toFixed(0) + ' km/h';
    });

    // Mise à jour du classement en direct
    this.renderLeaderboard();
  },

  renderQueue() {
    const container = document.getElementById('cig-queue');
    if (!container) return;
    container.innerHTML = '';
    this.cigarettes.forEach((cig, i) => {
      const el = document.createElement('div');
      el.className = 'queue-cig' + (i === this.currentCigIndex ? ' active-cig' : '') + (cig.used ? ' used-cig' : '');
      el.innerHTML = `
        <div style="width:36px">${renderRealCigaretteHTML(cig, 'slot')}</div>
        <div style="font-size:0.55rem;color:${rarityColor(cig.rarity)}">${(RARITIES[cig.rarity]?.name || '').slice(0,4)}</div>
      `;
      container.appendChild(el);
    });
  },

  // Arrêt sans résultat (abandon)
  stop() {
    this.active = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  },

  finish() {
    this.active = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (window.SoundFX) SoundFX.win();

    const ranking = this.getRanking();
    const playerRank = ranking.findIndex(r => r.isPlayer) + 1;
    const time = this.elapsed;
    const track = this.track;

    // Course classée (salle de jeux) : résultat de ligue, sans les gains de la course libre
    if (this.leagueMode && typeof CourseClandestine !== 'undefined') {
      GameState.totalRaces++;
      if (playerRank === 1) GameState.totalWins = (GameState.totalWins || 0) + 1;
      saveGame();
      CourseClandestine.onFinish(playerRank, time);
      return;
    }

    let medal = 'rate';
    if (playerRank === 1) medal = 'or';
    else if (playerRank === 2) medal = 'argent';
    else if (playerRank === 3) medal = 'bronze';

    let reward = track.rewards[medal] || track.rewards.rate;
    let xpReward = track.xp[medal] || track.xp.rate;

    // Limite quotidienne
    GameState.dailyRaces++;
    if (GameState.dailyRaces > GAME_CONST.MAX_DAILY_SOLO) reward = Math.floor(reward / 2);

    // Série de victoires (Or)
    if (playerRank === 1) {
      GameState.goldStreak++;
      GameState.totalWins = (GameState.totalWins || 0) + 1;
      if (GameState.pendingStreakBonus) {
        reward = Math.floor(reward * (1 + GAME_CONST.GOLD_STREAK_BONUS));
        GameState.pendingStreakBonus = false;
        showToast('Bonus série +50% appliqué !', 'gold');
      }
      if (GameState.goldStreak >= 3) {
        GameState.pendingStreakBonus = true;
        GameState.goldStreak = 0;
      }
    } else {
      GameState.goldStreak = 0;
      GameState.pendingStreakBonus = false;
    }

    // Meilleur temps
    const trackId = Object.keys(TRACKS).find(k => TRACKS[k] === track) || 'trottoir';
    if (!GameState.bestTimes[trackId] || time < GameState.bestTimes[trackId]) {
      GameState.bestTimes[trackId] = time;
    }

    GameState.totalRaces++;
    earnMoney(reward);
    earnXP(xpReward);
    saveGame();

    showResultScreen(medal, playerRank, time, reward, xpReward, ranking, this.comboState.combosFired);
  }
};

// DOM helpers for race
function showCough() {
  const el = document.getElementById('cough-bubble');
  if (el) el.classList.remove('hidden');
}
function hideCough() {
  const el = document.getElementById('cough-bubble');
  if (el) el.classList.add('hidden');
}
function showComboText(text) {
  const el = document.getElementById('combo-zone');
  if (!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}
function showSmokeEffect() {
  const smoke = document.getElementById('pmu-player-smoke');
  if (!smoke) return;
  smoke.classList.add('active');
  setTimeout(() => smoke.classList.remove('active'), 600);
}

// Result screen
function showResultScreen(medal, rank, time, money, xp, ranking, combos) {
  showPage('resultat');

  const titles = {
    1: 'Victoire ! 1ère Place',
    2: '2ème Place — Podium',
    3: '3ème Place — Podium',
    4: 'Course Terminée'
  };

  const titleEl = document.getElementById('r-title');
  const rankBannerEl = document.getElementById('r-rank-banner');
  const timeEl = document.getElementById('r-time-result');
  const moneyEl = document.getElementById('r-money');
  const xpEl = document.getElementById('r-xp');

  if (titleEl) titleEl.textContent = titles[rank] || 'Course terminée';
  if (rankBannerEl) rankBannerEl.textContent = `${rank}e Place`;
  if (timeEl) timeEl.textContent = `Chrono officiel : ${time.toFixed(2)}s`;
  if (moneyEl) moneyEl.textContent = '+' + fmt(money);
  if (xpEl) xpEl.textContent = '+' + xp + ' XP';

  // Podium récapitulatif
  const podiumEl = document.getElementById('r-podium');
  if (podiumEl && ranking) {
    const medals = ['1er', '2e', '3e', '4e'];
    podiumEl.innerHTML = ranking.map((r, i) => {
      let badgeClass = i === 0 ? 'b-1st' : i === 1 ? 'b-2nd' : i === 2 ? 'b-3rd' : 'b-4th';
      return `
        <div class="podium-line ${r.isPlayer ? 'podium-player' : ''}">
          <span class="p-rank"><span class="pod-badge ${badgeClass}">${medals[i]}</span></span>
          <span class="p-name">${r.name}${r.isPlayer ? ' (Vous)' : ''}</span>
          <span class="p-dist">${Math.floor(r.distance)}m</span>
        </div>
      `;
    }).join('');
  }

  const comboEl = document.getElementById('r-combos');
  if (comboEl) {
    const uniq = [...new Set(combos)];
    comboEl.innerHTML = uniq.map(c => COMBOS[c] ? `${COMBOS[c].name}` : '').filter(Boolean).join(' · ');
  }
}
