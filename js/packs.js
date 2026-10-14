// ============================================================
// THE ASHTRAY KING — Pokémon TCG Pocket Style Pack Opening System
// 3D Pack Opening, Interactive Tilt, SoundFX & Fanfare
// ============================================================

const PackSystem = {
  currentPackType: null,
  currentCigs: [],
  currentIndex: 0,

  drawPack(packType) {
    const pack = PACK_TYPES[packType];
    if (!pack) return [];
    const results = [];

    // Check player skill pity reduction
    const pityReduction = (GameState.skills?.pity_boost || 0) * 4;
    const effectiveThreshold = Math.max(5, (pack.pityThreshold || 20) - pityReduction);

    for (let i = 0; i < pack.size; i++) {
      let rarity = drawRarity(packType);

      // Pity check
      if (pack.pityKey) {
        GameState.pityCounters[pack.pityKey] = (GameState.pityCounters[pack.pityKey] || 0) + 1;
        if (GameState.pityCounters[pack.pityKey] >= effectiveThreshold) {
          rarity = pack.pityRarity;
          GameState.pityCounters[pack.pityKey] = 0;
        }
      }

      const cig = drawCigarette(packType, rarity);
      results.push({ ...cig });
    }

    return results;
  },

  openPack(packType, isFree = false) {
    const pack = PACK_TYPES[packType];
    if (!pack) return;

    // Cost check
    if (!isFree) {
      if (!spendMoney(pack.price)) {
        showToast('Pas assez d\'argent !', 'error');
        return;
      }
    } else {
      if (GameState.freePacks <= 0) {
        showToast('Aucun paquet gratuit disponible !', 'error');
        return;
      }
      GameState.freePacks--;
    }

    if (window.SoundFX) SoundFX.click();

    const cigs = this.drawPack(packType);
    cigs.forEach(cig => addCigarette(cig));
    saveGame();
    updateHUD();

    this.startTcgOpeningFlow(packType, cigs);
  },

  startTcgOpeningFlow(packType, cigs) {
    const overlay = document.getElementById('pack-opening-overlay');
    if (!overlay) return;

    this.currentPackType = packType;
    this.currentCigs = cigs;
    this.currentIndex = 0;

    overlay.classList.remove('hidden');

    const stageBooster = document.getElementById('tcg-booster-stage');
    const stageReveal  = document.getElementById('tcg-reveal-stage');
    const stageRecap   = document.getElementById('tcg-recap-stage');
    const boosterArt   = document.getElementById('tcg-booster-art');
    const tearStrip    = document.getElementById('tcg-tear-strip');

    if (stageBooster) stageBooster.classList.remove('hidden');
    if (stageReveal)  stageReveal.classList.add('hidden');
    if (stageRecap)   stageRecap.classList.add('hidden');

    // Visual booster art
    const visualMap = {
      tabac:  'assets/pack_tabac.jpg',
      duty:   'assets/pack_duty.jpg',
      contre: 'assets/pack_contrebande.jpg',
      saison: 'assets/pack_tabac.jpg',
    };
    if (boosterArt) {
      boosterArt.style.backgroundImage = `url('${visualMap[packType] || visualMap.tabac}')`;
    }
    if (tearStrip) {
      tearStrip.style.transform = 'none';
      tearStrip.style.opacity = '1';
    }

    // Interactive 3D booster hover tilt
    const packContainer = document.querySelector('.tcg-pack-container');
    if (packContainer) {
      packContainer.onmousemove = (e) => {
        const rect = packContainer.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        packContainer.style.transform = `perspective(800px) rotateY(${x * 0.08}deg) rotateX(${-y * 0.08}deg) scale(1.02)`;
      };
      packContainer.onmouseleave = () => {
        packContainer.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
      };
    }

    // Click on booster to tear
    if (stageBooster) {
      const onBoosterClick = () => {
        stageBooster.removeEventListener('click', onBoosterClick);
        this.triggerPackTear();
      };
      stageBooster.addEventListener('click', onBoosterClick);
    }

    // Attach controls
    const skipBtn = document.getElementById('btn-tcg-skip');
    if (skipBtn) {
      skipBtn.onclick = () => {
        if (window.SoundFX) SoundFX.click();
        this.showRecapStage();
      };
    }

    const nextBtn = document.getElementById('btn-tcg-next');
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (window.SoundFX) SoundFX.click();
        this.advanceReveal();
      };
    }

    const collectBtn = document.getElementById('btn-tcg-collect');
    if (collectBtn) {
      collectBtn.onclick = () => {
        if (window.SoundFX) SoundFX.win();
        this.closeOverlay();
      };
    }
  },

  triggerPackTear() {
    const tearStrip = document.getElementById('tcg-tear-strip');
    const stageBooster = document.getElementById('tcg-booster-stage');

    if (window.SoundFX) SoundFX.tear();

    if (tearStrip) {
      tearStrip.style.transform = 'translateY(-70px) rotate(-12deg)';
      tearStrip.style.opacity = '0';
    }

    // Foil sparks
    if (stageBooster) {
      this.spawnTearParticles(stageBooster);
    }

    setTimeout(() => {
      if (stageBooster) stageBooster.classList.add('hidden');
      this.showRevealStep(0);
    }, 450);
  },

  showRevealStep(index) {
    if (index >= this.currentCigs.length) {
      this.showRecapStage();
      return;
    }

    this.currentIndex = index;
    const stageReveal = document.getElementById('tcg-reveal-stage');
    if (stageReveal) stageReveal.classList.remove('hidden');

    const cig = this.currentCigs[index];
    const counterEl = document.getElementById('tcg-counter');
    const showcaseEl = document.getElementById('tcg-cig-showcase');
    const infoCardEl = document.getElementById('tcg-cig-info-card');
    const nextBtn = document.getElementById('btn-tcg-next');

    if (counterEl) {
      counterEl.textContent = `Cigarette ${index + 1} / ${this.currentCigs.length}`;
    }

    // Play reveal sound according to rarity
    if (window.SoundFX) SoundFX.reveal(cig.rarity);

    // Screen shake on legendary/mythic
    if (['legendaire', 'mythique'].includes(cig.rarity)) {
      document.body.classList.add('screen-shake-intense');
      setTimeout(() => document.body.classList.remove('screen-shake-intense'), 500);
    }

    // Render 3D TCG Pocket card
    if (showcaseEl) {
      showcaseEl.innerHTML = renderRealCigaretteHTML(cig, 'pack-reveal');
      showcaseEl.className = `tcg-cig-showcase rarity-${cig.rarity}`;

      // Interactive 3D tilt on mousemove directly on the physical floating cigarette
      const cigFloatEl = showcaseEl.querySelector('.reveal-cig-standalone-float') || showcaseEl.querySelector('.cig-tcg-foil-card');
      if (cigFloatEl) {
        showcaseEl.onmousemove = (e) => {
          const rect = showcaseEl.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          cigFloatEl.style.transform = `perspective(900px) rotateY(${x * 30}deg) rotateX(${-y * 30}deg) scale(1.08)`;
        };
        showcaseEl.onmouseleave = () => {
          cigFloatEl.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)';
        };
      }
    }

    // Render stats and info
    const rarityObj = RARITIES[cig.rarity] || {};
    const seriesObj = SERIES[cig.series] || {};
    const bourseVal = getBoursePrice(cig.id);

    if (infoCardEl) {
      infoCardEl.innerHTML = `
        <div class="tcg-info-rarity" style="color: ${rarityObj.color || 'var(--accent)'}">
          ★ ${rarityObj.name.toUpperCase()} · ${seriesObj.name || ''}
        </div>
        <div class="tcg-info-name">${cig.name}</div>
        <div class="tcg-info-desc">"${cig.desc || ''}"</div>
        <div class="tcg-info-stats">
          <div class="tcg-stat-col">
            <span class="tcg-stat-val">+${cig.speed}</span>
            <span class="tcg-stat-lbl">Vitesse</span>
          </div>
          <div class="tcg-stat-col">
            <span class="tcg-stat-val">-${cig.cough}</span>
            <span class="tcg-stat-lbl">Toux</span>
          </div>
          <div class="tcg-stat-col">
            <span class="tcg-stat-val">${fmt(bourseVal)}</span>
            <span class="tcg-stat-lbl">Valeur Bourse</span>
          </div>
        </div>
      `;
    }

    // High rarity burst fanfare
    const order = ['commune','peu-commune','rare','epique','legendaire','mythique'];
    const rIdx = order.indexOf(cig.rarity);
    if (rIdx >= 4) {
      this.spawnParticles(showcaseEl, cig.rarity);
      showToast(`🔥 ${cig.name} — ${rarityObj.name.toUpperCase()} !`, rIdx >= 5 ? 'mythic' : 'legendary');
    } else if (rIdx >= 3) {
      showToast(`✨ ${cig.name} — Épique !`, 'gold');
    }

    // Next button label
    if (nextBtn) {
      if (index === this.currentCigs.length - 1) {
        nextBtn.innerHTML = 'Voir le récapitulatif ➔';
      } else {
        nextBtn.innerHTML = 'Suivante ➔';
      }
    }
  },

  advanceReveal() {
    if (this.currentIndex < this.currentCigs.length - 1) {
      this.showRevealStep(this.currentIndex + 1);
    } else {
      this.showRecapStage();
    }
  },

  showRecapStage() {
    const stageReveal = document.getElementById('tcg-reveal-stage');
    const stageRecap  = document.getElementById('tcg-recap-stage');
    const recapGrid   = document.getElementById('tcg-recap-grid');

    if (stageReveal) stageReveal.classList.add('hidden');
    if (stageRecap)  stageRecap.classList.remove('hidden');

    if (window.SoundFX) SoundFX.win();

    if (recapGrid) {
      recapGrid.innerHTML = this.currentCigs.map(cig => {
        const rColor = rarityColor(cig.rarity);
        return `
          <div class="tcg-recap-item rarity-${cig.rarity}" style="border-color:${rColor}">
            ${renderRealCigaretteHTML(cig, 'recap')}
            <div style="font-size:0.75rem;font-weight:800;color:var(--gold);margin-top:4px">${fmt(getBoursePrice(cig.id))}</div>
          </div>
        `;
      }).join('');
    }
  },

  closeOverlay() {
    const overlay = document.getElementById('pack-opening-overlay');
    if (overlay) overlay.classList.add('hidden');
    updatePackPage();
    if (typeof renderInventory === 'function') renderInventory();
    showToast('Cartes ajoutées à votre inventaire !', 'success');
  },

  spawnTearParticles(anchorEl) {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const cols = ['#f59e0b', '#ffffff', '#fbbf24', '#ded7ce'];
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      p.style.cssText = `position:fixed;pointer-events:none;z-index:9999;
        width:6px;height:6px;border-radius:50%;
        background:${cols[i % cols.length]};
        left:${rect.left + rect.width / 2}px;top:${rect.top + 50}px;
        transition:transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s ease;
        opacity:1;`;
      document.body.appendChild(p);
      const angle = (i / 22) * Math.PI * 2;
      const dist = 60 + Math.random() * 90;
      setTimeout(() => {
        p.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
        p.style.opacity = '0';
        setTimeout(() => p.remove(), 600);
      }, 30);
    }
  },

  spawnParticles(cardEl, rarity) {
    if (!cardEl) return;
    const colors = {
      legendaire: ['#f59e0b', '#fbbf24', '#fde68a', '#ffffff'],
      mythique:   ['#ef4444', '#f87171', '#ffffff', '#ff9999', '#f59e0b']
    };
    const cols = colors[rarity] || ['#ffffff', '#3b82f6'];
    const rect = cardEl.getBoundingClientRect();
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.style.cssText = `position:fixed;pointer-events:none;z-index:9999;
        width:8px;height:8px;border-radius:50%;
        background:${cols[i % cols.length]};
        left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;
        box-shadow: 0 0 12px ${cols[i % cols.length]};
        transition:transform 1s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 1s ease;
        opacity:1;`;
      document.body.appendChild(p);
      const angle = (i / 30) * Math.PI * 2;
      const dist = 90 + Math.random() * 140;
      setTimeout(() => {
        p.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
        p.style.opacity = '0';
        setTimeout(() => p.remove(), 1000);
      }, 40);
    }
  }
};

// ============================================================
// FREE PACK TIMER & PITY BARS
// ============================================================
let freePackInterval = null;

function startFreePackTimer() {
  if (freePackInterval) clearInterval(freePackInterval);
  freePackInterval = setInterval(() => {
    updateFreePacks();
    renderFreePackBanner();
  }, 1000);
}

function renderFreePackBanner() {
  updateFreePacks();
  const countEl = document.getElementById('free-packs-count');
  const timerEl = document.getElementById('free-pack-timer');
  const btnEl   = document.getElementById('btn-open-free');
  const iconGift = document.getElementById('icon-gift-box');

  if (iconGift && !iconGift.hasChildNodes()) {
    iconGift.innerHTML = getIcon('gift');
  }

  if (!countEl) return;

  const maxPacks = GAME_CONST.MAX_FREE_PACKS || 10;
  countEl.textContent = `${GameState.freePacks} / ${maxPacks} disponibles`;

  if (GameState.freePacks > 0) {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = `Ouvrir (${GameState.freePacks})`;
    }
  } else {
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = 'Ouvrir';
    }
  }

  if (GameState.freePacks >= maxPacks) {
    if (timerEl) timerEl.textContent = `Stock max atteint (${maxPacks}/${maxPacks})`;
  } else {
    const remaining = Math.max(0, GameState.nextFreePackAt - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    if (timerEl) {
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      timerEl.textContent = GameState.freePacks > 0 
        ? `+1 dans ${timeStr} (Max ${maxPacks})`
        : `Prochain dans ${timeStr}`;
    }
  }

  // Pity bars with player skill reduction taken into account
  const pityReduction = (GameState.skills?.pity_boost || 0) * 4;
  const pbarEpic = document.getElementById('pbar-epic');
  const pbarLegendary = document.getElementById('pbar-legendary');
  const pbarMythic = document.getElementById('pbar-mythic');
  const ptextEpic = document.getElementById('ptext-epic');
  const ptextLeg = document.getElementById('ptext-legendary');
  const ptextMyth = document.getElementById('ptext-mythic');

  const epicThreshold = Math.max(5, 20 - pityReduction);
  const legThreshold  = Math.max(5, 15 - pityReduction);
  const mythThreshold = Math.max(8, 25 - pityReduction);

  const epicCount = GameState.pityCounters.tabac_epic || 0;
  const legCount  = GameState.pityCounters.duty_legendary || 0;
  const mythCount = GameState.pityCounters.contre_mythic || 0;

  if (pbarEpic) pbarEpic.style.width = Math.min(100, ((epicCount / epicThreshold) * 100)) + '%';
  if (pbarLegendary) pbarLegendary.style.width = Math.min(100, ((legCount / legThreshold) * 100)) + '%';
  if (pbarMythic) pbarMythic.style.width = Math.min(100, ((mythCount / mythThreshold) * 100)) + '%';
  if (ptextEpic) ptextEpic.textContent = `${epicCount}/${epicThreshold} paquets Tabac`;
  if (ptextLeg)  ptextLeg.textContent  = `${legCount}/${legThreshold} paquets Duty Free`;
  if (ptextMyth) ptextMyth.textContent = `${mythCount}/${mythThreshold} paquets Contrebande`;
}

function updatePackPage() {
  renderFreePackBanner();
}
