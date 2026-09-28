// ============================================================
// STÉPHANE — Pack System & Opening Animation
// ============================================================

const PackSystem = {
  openingQueue: [],  // cigs to reveal
  revealed: 0,

  drawPack(packType) {
    const pack = PACK_TYPES[packType];
    if (!pack) return [];
    const results = [];

    for (let i = 0; i < pack.size; i++) {
      let rarity = drawRarity(packType);

      // Pity check
      if (pack.pityKey) {
        GameState.pityCounters[pack.pityKey] = (GameState.pityCounters[pack.pityKey] || 0) + 1;
        if (GameState.pityCounters[pack.pityKey] >= pack.pityThreshold) {
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

    const cigs = this.drawPack(packType);
    cigs.forEach(cig => addCigarette(cig));
    saveGame();
    updateHUD();

    this.startOpeningAnimation(packType, cigs);
  },

  startOpeningAnimation(packType, cigs) {
    const overlay = document.getElementById('pack-opening-overlay');
    if (!overlay) { this.fallbackShow(cigs); return; }

    overlay.classList.remove('hidden');
    this.openingQueue = cigs;
    this.revealed = 0;

    // Set pack visual
    const packFront = document.getElementById('pack-front');
    const packWrap = document.getElementById('pack-3d-wrap');
    const cardsRow = document.getElementById('cards-row');
    const doneBtn = document.getElementById('btn-pack-done');

    if (packFront) {
      const visuals = {
        tabac: { bg: 'linear-gradient(135deg,#8B6914,#654B0A)', icon: '🚬', label: 'TABAC DU COIN' },
        duty:  { bg: 'linear-gradient(135deg,#1e3a5f,#2563eb)', icon: '✈️', label: 'DUTY FREE' },
        contre:{ bg: 'linear-gradient(135deg,#1a0a0a,#3b0000)', icon: '🚔', label: 'CONTREBANDE' },
        saison:{ bg: 'linear-gradient(135deg,#1a3a1a,#15803d)', icon: '🌟', label: 'SAISON' },
      };
      const v = visuals[packType] || visuals.tabac;
      packFront.style.background = v.bg;
      packFront.innerHTML = `<div style="font-size:3rem">${v.icon}</div><div style="font-family:var(--font-title);font-size:1rem;color:#fff;margin-top:8px">${v.label}</div>`;
    }

    if (packWrap) packWrap.classList.remove('hidden');
    if (cardsRow) { cardsRow.innerHTML = ''; cardsRow.classList.add('hidden'); }
    if (doneBtn) doneBtn.classList.add('hidden');

    // Create card placeholders
    if (cardsRow) {
      cigs.forEach((cig, i) => {
        const card = document.createElement('div');
        card.className = `reveal-card rarity-${cig.rarity}`;
        card.id = `card-${i}`;
        card.innerHTML = `
          <div class="card-cig-icon">${cig.icon || '🚬'}</div>
          <div class="card-cig-name">${cig.name}</div>
          <div class="card-cig-rarity" style="color:${rarityColor(cig.rarity)}">${RARITIES[cig.rarity]?.name || ''}</div>
          <div style="font-size:0.55rem;color:var(--text-dim)">${cig.desc ? cig.desc.slice(0,40)+'…' : ''}</div>
        `;
        cardsRow.appendChild(card);
      });
    }

    // Click to open
    if (packWrap) {
      packWrap._handler = () => this.triggerOpen(cigs);
      packWrap.addEventListener('click', packWrap._handler, { once: true });
    }
  },

  triggerOpen(cigs) {
    const packWrap = document.getElementById('pack-3d-wrap');
    const cardsRow = document.getElementById('cards-row');

    if (packWrap) packWrap.classList.add('hidden');
    if (cardsRow) cardsRow.classList.remove('hidden');

    // Reveal cards one by one with delays
    cigs.forEach((cig, i) => {
      setTimeout(() => {
        const card = document.getElementById(`card-${i}`);
        if (card) {
          card.classList.add('shown');
          // Special effects for rare+
          const order = ['commune','peu-commune','rare','epique','legendaire','mythique'];
          const rarityIdx = order.indexOf(cig.rarity);
          if (rarityIdx >= 4) {
            showToast(`${cig.icon} ${cig.name} — ${RARITIES[cig.rarity]?.name} !`, rarityIdx >= 5 ? 'mythic' : 'legendary');
            // Particle effect
            this.spawnParticles(card, cig.rarity);
          } else if (rarityIdx >= 3) {
            showToast(`${cig.icon} ${cig.name} — Épique !`, 'gold');
          }
        }
      }, 300 + i * 500);
    });

    // Show done button after all revealed
    setTimeout(() => {
      const doneBtn = document.getElementById('btn-pack-done');
      if (doneBtn) doneBtn.classList.remove('hidden');
    }, 300 + cigs.length * 500 + 400);
  },

  closePack() {
    const overlay = document.getElementById('pack-opening-overlay');
    if (overlay) overlay.classList.add('hidden');
    updatePackPage();
  },

  spawnParticles(cardEl, rarity) {
    if (!cardEl) return;
    const colors = { legendaire: ['#f59e0b','#fbbf24','#fde68a'], mythique: ['#ef4444','#f87171','#ff6b6b'] };
    const cols = colors[rarity] || ['#fff'];
    const rect = cardEl.getBoundingClientRect();
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.style.cssText = `position:fixed;pointer-events:none;z-index:9999;
        width:8px;height:8px;border-radius:50%;
        background:${cols[i % cols.length]};
        left:${rect.left + rect.width/2}px;top:${rect.top + rect.height/2}px;
        transition:transform 0.8s ease,opacity 0.8s ease;opacity:1;`;
      document.body.appendChild(p);
      const angle = (i / 12) * Math.PI * 2;
      const dist = 80 + Math.random() * 60;
      setTimeout(() => {
        p.style.transform = `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px)`;
        p.style.opacity = '0';
        setTimeout(() => p.remove(), 800);
      }, 50);
    }
  },

  fallbackShow(cigs) {
    const names = cigs.map(c => `${c.icon} ${c.name} (${RARITIES[c.rarity]?.name})`).join('\n');
    alert('Vous obtenez :\n' + names);
  },
};

// ============================================================
// FREE PACK TIMER
// ============================================================
let freePackInterval = null;

function startFreePackTimer() {
  if (freePackInterval) clearInterval(freePackInterval);
  freePackInterval = setInterval(() => {
    updateFreePacks();
    renderFreePackBanner();
  }, 5000);
}

function renderFreePackBanner() {
  updateFreePacks();
  const countEl = document.getElementById('free-packs-count');
  const timerEl = document.getElementById('free-pack-timer');
  const btnEl   = document.getElementById('btn-open-free');

  if (!countEl) return;

  countEl.textContent = `${GameState.freePacks} / ${GAME_CONST.MAX_FREE_PACKS} disponibles`;

  if (GameState.freePacks > 0) {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = `Ouvrir ${GameState.freePacks} 📦`; }
    if (timerEl) timerEl.textContent = 'Prêts !';
  } else {
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Ouvrir 📦'; }
    const remaining = Math.max(0, GameState.nextFreePackAt - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    if (timerEl) timerEl.textContent = `Prochain dans ${mins}:${secs.toString().padStart(2,'0')}`;
  }

  // Pity bars
  const pbarEpic = document.getElementById('pbar-epic');
  const pbarLegendary = document.getElementById('pbar-legendary');
  const pbarMythic = document.getElementById('pbar-mythic');
  const ptextEpic = document.getElementById('ptext-epic');
  const ptextLeg = document.getElementById('ptext-legendary');
  const ptextMyth = document.getElementById('ptext-mythic');

  const epicCount = GameState.pityCounters.tabac_epic || 0;
  const legCount  = GameState.pityCounters.duty_legendary || 0;
  const mythCount = GameState.pityCounters.contre_mythic || 0;

  if (pbarEpic) pbarEpic.style.width = ((epicCount / 20) * 100) + '%';
  if (pbarLegendary) pbarLegendary.style.width = ((legCount / 15) * 100) + '%';
  if (pbarMythic) pbarMythic.style.width = ((mythCount / 25) * 100) + '%';
  if (ptextEpic) ptextEpic.textContent = `${epicCount}/20 paquets Tabac`;
  if (ptextLeg)  ptextLeg.textContent  = `${legCount}/15 paquets Duty Free`;
  if (ptextMyth) ptextMyth.textContent = `${mythCount}/25 paquets Contrebande`;
}

function updatePackPage() {
  renderFreePackBanner();
}
