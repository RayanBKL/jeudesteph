// ============================================================
// STÉPHANE — Race Engine
// ============================================================

const RaceEngine = {
  active: false,
  track: null,
  energy: 30,
  cough: 0,
  speed: GAME_CONST.BASE_SPEED,
  distance: 0,
  elapsed: 0,      // seconds
  coughing: false,
  coughTimer: 0,
  cigarettes: [],  // current race cigarettes, copies
  currentCigIndex: 0,
  lastSmokeTime: 0,
  smokeCooldown: 1000, // ms
  comboState: {
    greenStreak: 0,   // consecutive green-zone smokes
    lastBrands: [],   // last 3 brands smoked
    lastRarities: [], // last 3 rarities smoked (ascending check)
    combosFired: [],
  },
  rafId: null,
  lastTick: 0,
  pendingCombos: [],

  start(trackId) {
    this.track = TRACKS[trackId];
    if (!this.track) return;

    this.active = true;
    this.energy = 30;
    this.cough = 0;
    this.speed = GAME_CONST.BASE_SPEED;
    this.distance = 0;
    this.elapsed = 0;
    this.coughing = false;
    this.coughTimer = 0;
    this.lastTick = performance.now();
    this.currentCigIndex = 0;
    this.lastSmokeTime = 0;
    this.pendingCombos = [];
    this.comboState = { greenStreak: 0, lastBrands: [], lastRarities: [], combosFired: [] };

    // Copy equipped cigs
    this.cigarettes = getEquippedCigs().map(c => ({ ...c, used: false }));

    // Show race page
    showPage('race');
    this.renderQueue();
    this.loop();
  },

  stop() {
    this.active = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  },

  loop() {
    if (!this.active) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.1); // seconds, capped
    this.lastTick = now;

    this.tick(dt);
    this.render();

    // Check finish
    if (this.distance >= this.track.distance) {
      this.finish();
      return;
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  },

  tick(dt) {
    if (this.coughing) {
      this.coughTimer -= dt;
      if (this.coughTimer <= 0) {
        this.coughing = false;
        this.cough = GAME_CONST.COUGH_RESET_TO;
        hideCough();
      }
      // No movement while coughing
      return;
    }

    this.elapsed += dt;

    // Energy decay
    const energyDecay = GAME_CONST.ENERGY_DECAY / getRecoveryMod();
    this.energy = Math.max(0, this.energy - energyDecay * dt);

    // Cough decay
    this.cough = Math.max(0, this.cough - GAME_CONST.COUGH_DECAY * dt);

    // Check cough threshold
    if (this.cough >= GAME_CONST.COUGH_THRESHOLD) {
      this.triggerCough();
      return;
    }

    // Speed based on energy
    const baseSpeed = GAME_CONST.BASE_SPEED;
    const maxSpeed = GAME_CONST.MAX_SPEED;
    const energyFraction = this.energy / 100;
    this.speed = baseSpeed + (maxSpeed - baseSpeed) * energyFraction;

    // Update distance
    const distPerSec = (this.speed * 1000) / 3600; // km/h to m/s
    this.distance += distPerSec * dt;
    this.distance = Math.min(this.distance, this.track.distance);
  },

  smoke() {
    if (!this.active || this.coughing) return;
    if (Date.now() - this.lastSmokeTime < this.smokeCooldown) return;
    if (this.currentCigIndex >= this.cigarettes.length) {
      showToast('Plus de cigarettes !', 'error');
      return;
    }

    const cig = this.cigarettes[this.currentCigIndex];
    if (cig.used) { this.currentCigIndex++; this.smoke(); return; }

    cig.used = true;
    this.lastSmokeTime = Date.now();

    // Energy & cough
    const energyGain = (RARITIES[cig.rarity]?.energy || 15) * getEnergyMod();
    let coughAdded = (RARITIES[cig.rarity]?.cough || 30) * getCoughMod();

    // Check combos
    const isGreenZone = this.energy >= 10 && this.energy <= 25;
    let comboText = '';

    // Combo: Fumée parfaite
    if (isGreenZone) {
      coughAdded *= 0.5;
      this.comboState.greenStreak++;
      comboText = '✨ Fumée parfaite ! Toux ÷2';
      this.comboState.combosFired.push('fumee-parfaite');
      showComboText(comboText);

      // Triple green: Chaîne parfaite
      if (this.comboState.greenStreak >= 3) {
        comboText = '🔥 CHAÎNE PARFAITE ! Vitesse max !';
        this.speed = GAME_CONST.MAX_SPEED;
        coughAdded = 0;
        this.comboState.combosFired.push('chaine-parfaite');
        setTimeout(() => { this.speed = GAME_CONST.BASE_SPEED; }, 3000);
        showComboText(comboText);
        this.comboState.greenStreak = 0;
      }
    } else {
      this.comboState.greenStreak = 0;
    }

    // Combo: Enchaînement de marque
    this.comboState.lastBrands.push(cig.id);
    if (this.comboState.lastBrands.length > 3) this.comboState.lastBrands.shift();
    if (this.comboState.lastBrands.length >= 3 &&
        this.comboState.lastBrands[0] === this.comboState.lastBrands[1] &&
        this.comboState.lastBrands[1] === this.comboState.lastBrands[2]) {
      // × 3
      this.speed *= 1.60;
      this.comboState.combosFired.push('enchainement-3');
      showComboText('⛓️ ENCHAÎNEMENT ×3 ! Boost +60% !');
    } else if (this.comboState.lastBrands.length >= 2 &&
        this.comboState.lastBrands[this.comboState.lastBrands.length-2] === this.comboState.lastBrands[this.comboState.lastBrands.length-1]) {
      this.speed *= 1.30;
      this.comboState.combosFired.push('enchainement-2');
      showComboText('🔗 Enchaînement ×2 ! Boost +30% !');
    }

    // Combo: Montée en puissance (3 ascending rarities)
    const rarityOrder = ['commune','peu-commune','rare','epique','legendaire','mythique'];
    this.comboState.lastRarities.push(cig.rarity);
    if (this.comboState.lastRarities.length > 3) this.comboState.lastRarities.shift();
    if (this.comboState.lastRarities.length === 3) {
      const r0 = rarityOrder.indexOf(this.comboState.lastRarities[0]);
      const r1 = rarityOrder.indexOf(this.comboState.lastRarities[1]);
      const r2 = rarityOrder.indexOf(this.comboState.lastRarities[2]);
      if (r0 < r1 && r1 < r2) {
        const bonus = energyGain * 0.2;
        this.energy = Math.min(100, this.energy + bonus);
        this.comboState.combosFired.push('montee-puissance');
        showComboText('📈 Montée en puissance ! +20% énergie !');
      }
    }

    // Apply energy
    this.energy = Math.min(100, this.energy + energyGain);
    this.cough = Math.min(100, this.cough + coughAdded);

    this.currentCigIndex++;
    this.renderQueue();

    // Flash smoke on runner
    showSmokeEffect();
  },

  triggerCough() {
    this.coughing = true;
    this.coughTimer = GAME_CONST.COUGH_BLOCK_MS / 1000;
    this.speed = 0;
    this.comboState.greenStreak = 0;
    showCough();
    setTimeout(() => { this.cough = GAME_CONST.COUGH_RESET_TO; }, GAME_CONST.COUGH_BLOCK_MS);
  },

  finish() {
    this.active = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);

    const time = this.elapsed;
    const track = this.track;
    let medal = 'rate';
    if (time <= track.goldTime)        medal = 'or';
    else if (time <= track.silverTime) medal = 'argent';
    else if (time <= track.bronzeTime) medal = 'bronze';

    let reward = track.rewards[medal] || track.rewards.rate;
    let xpReward = track.xp[medal] || track.xp.rate;

    // Daily race limit
    GameState.dailyRaces++;
    if (GameState.dailyRaces > GAME_CONST.MAX_DAILY_SOLO) reward = Math.floor(reward / 2);

    // Streak bonus
    if (medal === 'or') {
      GameState.goldStreak++;
      if (GameState.pendingStreakBonus) {
        reward = Math.floor(reward * (1 + GAME_CONST.GOLD_STREAK_BONUS));
        GameState.pendingStreakBonus = false;
        showToast('🔥 Bonus série +50% appliqué !', 'gold');
      }
      if (GameState.goldStreak >= 3) {
        GameState.pendingStreakBonus = true;
        GameState.goldStreak = 0;
      }
    } else {
      GameState.goldStreak = 0;
      GameState.pendingStreakBonus = false;
    }

    // Update best time
    const trackId = Object.keys(TRACKS).find(k => TRACKS[k] === track);
    if (!GameState.bestTimes[trackId] || time < GameState.bestTimes[trackId]) {
      GameState.bestTimes[trackId] = time;
    }

    GameState.totalRaces++;
    earnMoney(reward);
    earnXP(xpReward);
    saveGame();

    showResultScreen(medal, time, reward, xpReward, this.comboState.combosFired);
  },

  render() {
    // Gauges
    const gEnergy = document.getElementById('g-energy');
    const gCough = document.getElementById('g-cough');
    const gvEnergy = document.getElementById('gv-energy');
    const gvCough = document.getElementById('gv-cough');
    if (gEnergy) gEnergy.style.width = this.energy.toFixed(0) + '%';
    if (gCough)  gCough.style.width = this.cough.toFixed(0) + '%';
    if (gvEnergy) gvEnergy.textContent = this.energy.toFixed(0);
    if (gvCough)  gvCough.textContent = this.cough.toFixed(0);

    // Stats
    const rTime = document.getElementById('r-time');
    const rSpeed = document.getElementById('r-speed');
    const rDist = document.getElementById('r-dist');
    if (rTime)  rTime.textContent = this.elapsed.toFixed(1) + 's';
    if (rSpeed) rSpeed.textContent = this.speed.toFixed(1) + ' km/h';
    if (rDist)  rDist.textContent = Math.floor(this.distance) + ' m';

    // Runner animation speed
    const anim = document.getElementById('runner-anim');
    const legs = document.querySelectorAll('.runner-leg');
    if (anim) {
      const speedFrac = this.speed / GAME_CONST.MAX_SPEED;
      const dur = Math.max(0.15, 0.45 - speedFrac * 0.3);
      legs.forEach(l => l.style.animationDuration = dur + 's');
    }

    // Track scroll (parallax)
    const stripes = document.getElementById('road-stripes');
    if (stripes) {
      const ratio = GAME_CONST.MAX_SPEED / 3600; // max scroll speed
      const scrollPx = this.distance * 2;
      stripes.style.transform = `translateX(${-scrollPx % 80}px)`;
    }

    // Cough indicator
    if (this.coughing) {
      const gCoughBar = document.getElementById('g-cough');
      if (gCoughBar) gCoughBar.style.background = 'linear-gradient(90deg,#ef4444,#ff0000)';
    }
  },

  renderQueue() {
    const container = document.getElementById('cig-queue');
    if (!container) return;
    container.innerHTML = '';
    this.cigarettes.forEach((cig, i) => {
      const el = document.createElement('div');
      el.className = 'queue-cig' + (i === this.currentCigIndex ? ' active-cig' : '') + (cig.used ? ' used-cig' : '');
      el.innerHTML = `<div class="queue-cig-icon">${cig.icon || '🚬'}</div>
        <div style="font-size:0.55rem;color:${rarityColor(cig.rarity)}">${(RARITIES[cig.rarity]?.name || '').slice(0,4)}</div>`;
      container.appendChild(el);
    });
  },
};

// DOM helpers for race
function showCough() {
  const el = document.getElementById('cough-bubble');
  if (el) { el.classList.remove('hidden'); }
  const face = document.querySelector('.runner-face');
  if (face) face.textContent = '🤢';
}
function hideCough() {
  const el = document.getElementById('cough-bubble');
  if (el) el.classList.add('hidden');
  const face = document.querySelector('.runner-face');
  if (face) face.textContent = '😤';
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
  const smoke = document.getElementById('runner-smoke');
  if (!smoke) return;
  smoke.style.opacity = '1';
  setTimeout(() => { smoke.style.opacity = '0'; }, 800);
}

// Result screen
function showResultScreen(medal, time, money, xp, combos) {
  showPage('resultat');
  const icons = { or: '🥇', argent: '🥈', bronze: '🥉', rate: '💨' };
  const titles = { or: 'OR ! Incroyable !', argent: 'ARGENT ! Bien joué !', bronze: 'BRONZE !', rate: 'RATÉ... Retente !' };
  document.getElementById('r-medal').textContent = icons[medal] || '🏅';
  document.getElementById('r-title').textContent = titles[medal] || 'Terminé !';
  document.getElementById('r-time').textContent = time.toFixed(2) + ' secondes';
  document.getElementById('r-money').textContent = '+' + fmt(money);
  document.getElementById('r-xp').textContent = '+' + xp + ' XP';
  const comboEl = document.getElementById('r-combos');
  if (comboEl) {
    const uniq = [...new Set(combos)];
    comboEl.innerHTML = uniq.map(c => COMBOS[c] ? `${COMBOS[c].icon} ${COMBOS[c].name}` : '').join(' · ');
  }
}
