// ============================================================
// THE ASHTRAY KING — Empire Manager
// Orchestrates: Clicker, Cards, Inventory, Pack Opening, Empire rooms
// ============================================================

const EmpireManager = (() => {

  // ── Game State ─────────────────────────────────────────────
  let state = {
    // Inventory: { itemId: quantity }
    inventory: {},

    // Cartes en circulation (tous comptes confondus : sorties de boosters ou découvertes)
    circulatedItems: {},

    // Offres actives sur la Bourse (ventes directes & enchères des joueurs / collectionneurs)
    marketListings: [],

    // Offres mises en vente par le joueur
    myListings: [],

    // Pack pity counters
    pityState: {},

    // Empire rooms and assigned cards
    rooms: {
      comptoir: { name: 'Le Comptoir', icon: '🚬', slots: 3, assigned: [], unlockLevel: 1 },
      arriere:  { name: 'L\'Arrière-Boutique', icon: '🌿', slots: 3, assigned: [], unlockLevel: 3 },
      vip:      { name: 'Le Carré VIP', icon: '👠', slots: 2, assigned: [], unlockLevel: 5 },
      bar:      { name: 'Le Bar Clandestin', icon: '🥃', slots: 3, assigned: [], unlockLevel: 8 },
      cartel:   { name: 'Le Cartel', icon: '💊', slots: 5, assigned: [], unlockLevel: 15 },
    },

    // Casino daily bets
    betsToday: 0,
    lastBetDay: null,

    // Opened packs count
    totalPacksOpened: 0,
  };

  // ── Current UI state ───────────────────────────────────────
  let currentPage = 'clicker';
  let currentInventoryCat = 'all';

  // Familles affichées : les clopes et leurs accessoires sont regroupés
  function catMatches(cat, filter) {
    if (!filter || filter === 'all') return true;
    if (filter === 'tabac') return cat === 'cigarette' || cat === 'briquet';
    return cat === filter;
  }
  let currentInventorySort = 'rarity';
  let pendingPackResults = [];
  let revealIndex = 0;

  // ── Init ───────────────────────────────────────────────────
  function init() {
    loadState();
    updateFreePackDisplay();
    bindNavigation();
    bindPackShop();
    bindInventoryFilters();
    bindEmpireRooms();
    bindCasino();
    try { autoFillRooms(); recalcAllPassives(); } catch (e) {}
    navigateTo('clicker');
    console.log('[EmpireManager] Ready.');
  }

  // ── Navigation ─────────────────────────────────────────────
  function bindNavigation() {
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page) navigateTo(page);
      });
    });

    document.getElementById('btn-quick-talents')?.addEventListener('click', () => navigateTo('talents'));
    document.getElementById('btn-quick-empire')?.addEventListener('click', () => navigateTo('empire'));
    // « Tes cartes / seconde » : un clic mène à l'Arrière-Boutique, où se placent les cartes
    const cpsPill = document.getElementById('clicker-cps')?.parentElement;
    if (cpsPill) { cpsPill.style.cursor = 'pointer'; cpsPill.title = 'Placer mes cartes (Arrière-Boutique)'; cpsPill.addEventListener('click', () => navigateTo('empire')); }
    document.getElementById('btn-quick-bourse')?.addEventListener('click', () => navigateTo('bourse'));
  }

  let navGuarding = false;
  function navigateTo(page) {
    if (page === 'course' || page === 'home') page = 'clicker';
    // Partie en ligne en cours : changer d'onglet = abandonner (on demande confirmation) ; table de poker : on quitte la table
    if (currentPage === 'multi' && page !== 'multi' && window.Online && Online.inMatch && Online.inMatch() && !navGuarding) {
      navGuarding = true;
      GameDialog.confirm('Si tu quittes cet écran, la partie est perdue.', { title: 'Abandonner la partie ?', ok: 'Abandonner', danger: true }).then(async ok => {
        if (ok) { await Online.forfeitCurrent(); navGuarding = false; navigateTo(page); }
        else { navGuarding = false; document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === currentPage)); }
      });
      return;
    }
    if (currentPage === 'casino' && page !== 'casino' && window.Poker && Poker.atTable && Poker.atTable() && !navGuarding) {
      navGuarding = true;
      GameDialog.confirm('Tu te couches s\'il y a une main en cours, et tes jetons te reviennent.', { title: 'Quitter la table de poker ?', ok: 'Quitter' }).then(async ok => {
        if (ok) { await Poker.leaveSilently(); navGuarding = false; navigateTo(page); }
        else { navGuarding = false; document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === currentPage)); }
      });
      return;
    }
    currentPage = page;

    // Update nav
    document.querySelectorAll('.bottom-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
      p.classList.add('hidden');
      p.style.display = 'none';
    });
    const target = document.getElementById('page-' + page) || document.getElementById('page-clicker');
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('active');
      target.style.display = 'block';
    }

    // On-enter hooks
    if (page === 'inventaire') renderInventory();
    if (page === 'empire')     renderEmpire();
    if (page === 'paquets')    renderPackShop();
    if (page === 'profil' && typeof renderProfile === 'function') { renderProfile(); if (window.Social) Social.onProfileOpen(); }
    if (page === 'reglages' && typeof renderSettings === 'function') renderSettings();
    if (page === 'bourse')     renderBourse();
    if (page === 'casino' && typeof Casino !== 'undefined' && Casino.render) Casino.render();
    if (page === 'talents') {
      if (typeof TalentsEngine !== 'undefined') TalentsEngine.render();
      else if (typeof renderSkillTree === 'function') renderSkillTree();
    }
    if (page === 'multi') {
      // Salle de jeux (mini-jeux classés). Ne pas écraser une partie de course en cours de retour.
      if (typeof GameHub !== 'undefined') {
        if (GameHub.keepScreenOnce) GameHub.keepScreenOnce = false;
        else if (window.Online && Online.inMatch && Online.inMatch()) {
          // partie en cours : on la garde à l'écran (et on retourne sur la piste si une course est en train de se courir)
          if (typeof RaceEngine !== 'undefined' && RaceEngine.active && RaceEngine.pvp) setTimeout(() => showPage('race'), 0);
        }
        else GameHub.render();
      }
    }
  }

  // ── Boutique : carrousel horizontal de paquets ─────────────
  let packCarouselBound = false;

  function formatOdds(v) {
    const pct = v * 100;
    if (pct >= 1) return Math.round(pct) + '%';
    if (pct >= 0.1) return pct.toFixed(1).replace('.', ',') + '%';
    if (pct >= 0.01) return pct.toFixed(2).replace('.', ',') + '%';
    return '<0,01%';
  }

  function renderPackShop() {
    const container = document.getElementById('empire-packs-grid');
    if (!container) return;
    container.innerHTML = '';

    // Le paquet gratuit d'abord, puis les paquets payants
    container.appendChild(buildPackCard(EMPIRE_PACKS.gratuit, true));
    Object.values(EMPIRE_PACKS).filter(p => p.price > 0).sort((a, b) => a.price - b.price).forEach(pack => {
      container.appendChild(buildPackCard(pack));
    });

    renderPackDots();
    bindPackCarousel();
    updateFreePackDisplay();
    requestAnimationFrame(updateActivePack);
  }

  function buildPackCard(pack, isFree = false) {
    const div = document.createElement('div');
    div.className = 'pack-slide' + (isFree ? ' pack-slide-free' : '');
    div.dataset.pack = pack.id;

    const oddsHtml = Object.entries(pack.odds)
      .filter(([,v]) => v > 0)
      .sort((a,b) => b[1]-a[1])
      .map(([k,v]) => `<span class="pack-odds-pill odds-${k}">${EMPIRE_RARITIES[k].name} ${formatOdds(v)}</span>`)
      .join('');

    div.innerHTML = `
      <div class="pack-slide-visual">
        ${PackArt.buildBooster(pack)}
        ${isFree ? '<span class="pack-free-ribbon">Gratuit</span>' : ''}
      </div>
      <div class="pack-info">
        <div class="pack-info-name">${PackArt.cleanName(pack)}</div>
        <p class="pack-card-desc">${pack.description}</p>
        <div class="pack-card-odds">${oddsHtml}</div>
        <div class="pack-buy-row">
          ${isFree ? `
            <span class="pack-price-tag pack-free-timer" id="free-pack-timer-empire">…</span>
            <button class="btn-empire btn-empire-primary" id="btn-open-free-empire" disabled>Ouvrir</button>
          ` : `
            <span class="pack-price-tag">${formatCash(pack.price)} €</span>
            <button class="btn-empire btn-empire-primary btn-buy-empire-pack" data-pack="${pack.id}">Ouvrir ×${pack.count}</button>
          `}
        </div>
      </div>
    `;
    return div;
  }

  function renderPackDots() {
    const dots = document.getElementById('pack-dots');
    const track = document.getElementById('empire-packs-grid');
    if (!dots || !track) return;
    dots.innerHTML = [...track.children].map((s, i) =>
      `<button class="pack-dot" data-i="${i}" aria-label="Paquet ${i + 1}"></button>`).join('');
  }

  function scrollToPack(slide, smooth = true) {
    const track = slide?.parentElement;
    if (!track) return;
    track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  }

  function stepPack(dir) {
    const track = document.getElementById('empire-packs-grid');
    if (!track) return;
    const slides = [...track.children];
    const i = slides.findIndex(sl => sl.classList.contains('is-active'));
    const next = slides[Math.max(0, Math.min(slides.length - 1, i + dir))];
    if (next) scrollToPack(next);
  }

  function updateActivePack() {
    const track = document.getElementById('empire-packs-grid');
    if (!track || !track.children.length) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    [...track.children].forEach((sl, i) => {
      const d = Math.abs(sl.offsetLeft + sl.offsetWidth / 2 - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    [...track.children].forEach((sl, i) => sl.classList.toggle('is-active', i === best));
    document.querySelectorAll('#pack-dots .pack-dot').forEach((d, i) => d.classList.toggle('active', i === best));
    const prev = document.getElementById('pack-nav-prev');
    const next = document.getElementById('pack-nav-next');
    if (prev) prev.disabled = best === 0;
    if (next) next.disabled = best === track.children.length - 1;
  }

  function bindPackCarousel() {
    if (packCarouselBound) return;
    const track = document.getElementById('empire-packs-grid');
    if (!track) return;
    packCarouselBound = true;

    let raf = 0;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateActivePack);
    }, { passive: true });

    // Molette verticale -> défilement horizontal
    track.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        track.scrollBy({ left: e.deltaY });
        e.preventDefault();
      }
    }, { passive: false });

    // Cliquer sur un paquet de côté le ramène au centre
    track.addEventListener('click', (e) => {
      const slide = e.target.closest('.pack-slide');
      if (!slide || e.target.closest('button')) return;
      if (!slide.classList.contains('is-active')) scrollToPack(slide);
    });

    document.getElementById('pack-nav-prev')?.addEventListener('click', () => stepPack(-1));
    document.getElementById('pack-nav-next')?.addEventListener('click', () => stepPack(1));
    document.getElementById('pack-dots')?.addEventListener('click', (e) => {
      const dot = e.target.closest('[data-i]');
      if (dot) scrollToPack(track.children[+dot.dataset.i]);
    });
    window.addEventListener('resize', () => requestAnimationFrame(updateActivePack));
  }

  function bindPackShop() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-buy-empire-pack');
      if (!btn) return;
      const packId = btn.dataset.pack;
      buyPack(packId);
    });
  }

  function buyPack(packId) {
    const pack = EMPIRE_PACKS[packId];
    if (!pack) return;

    const currentCash = (typeof ClickerEngine !== 'undefined' && ClickerEngine.getCash) ? ClickerEngine.getCash() : (window.GameState ? GameState.money : 0);
    if (currentCash < pack.price) {
      if (typeof ClickerEngine !== 'undefined' && ClickerEngine.showToast) {
        ClickerEngine.showToast(`❌ Pas assez d'argent ! Manque ${formatCash(pack.price - currentCash)} €`, 'danger');
      } else if (typeof showToast === 'function') {
        showToast(`Pas assez d'argent ! Manque ${formatCash(pack.price - currentCash)} €`, 'error');
      }
      return;
    }

    if (typeof spendMoney === 'function') {
      spendMoney(pack.price);
    } else {
      ClickerEngine.setCash(currentCash - pack.price);
    }
    state.totalPacksOpened++;
    // XP d'ouverture : prix d'origine / 100 (minimum 15)
    if (ClickerEngine.gainXP) ClickerEngine.gainXP(pack.xp != null ? pack.xp : Balance.xpForPack(pack.price));

    const items = drawEmpirePack(packId, state.pityState);
    items.forEach(item => addToInventory(item.id));
    emitPackPrestige(items);
    autoFillRooms();

    saveState();
    openPackReveal(items, pack);
  }

  function emitPackPrestige(items) {
    if (typeof Prestige === 'undefined') return;
    Prestige.emit('pack_open');
    items.forEach(it => Prestige.emit('card_drawn', { rarity: it.rarity }));
  }

  const escHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function addToInventory(itemId) {
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    if (!state.circulatedItems) state.circulatedItems = {};
    state.circulatedItems[itemId] = true;
    if (typeof ClickerEngine !== 'undefined') {
      if (ClickerEngine.recalcPassive) ClickerEngine.recalcPassive();
      if (ClickerEngine.recalcClickPower) ClickerEngine.recalcClickPower();
    }
  }

  // Échanges entre joueurs : une carte part ou arrive hors paquet
  function takeCard(itemId) {
    if (!(state.inventory[itemId] > 0)) return false;
    state.inventory[itemId]--;
    if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
    saveState(); autoFillRooms(); recalcAllPassives();
    return true;
  }
  function giveCard(itemId) {
    addToInventory(itemId);
    saveState(); autoFillRooms(); recalcAllPassives();
  }

  // ── Ouverture de paquet ────────────────────────────────────
  // 1. Le paquet tombe au centre : on le déchire (tap ou glisser)
  // 2. Les cartes arrivent face cachée : tap = retourner, tap = suivante
  // 3. Récapitulatif
  const RARITY_ORDER = ['commune', 'peu-commune', 'rare', 'epique', 'legendaire', 'mythique'];
  let revealFlipped = false;
  let revealBusy = false;
  let newFlags = [];

  function openPackReveal(items, pack) {
    pendingPackResults = items;
    revealIndex = 0;

    // Une carte est « nouvelle » si on n'en possède qu'un exemplaire (première occurrence du tirage)
    const seen = {};
    newFlags = items.map(it => {
      const before = (state.inventory[it.id] || 0) - items.filter(x => x.id === it.id).length;
      const isNew = before <= 0 && !seen[it.id];
      seen[it.id] = true;
      return isNew;
    });

    const overlay = document.getElementById('empire-pack-overlay');
    const boosterStage = document.getElementById('empire-booster-stage');
    const revealStage = document.getElementById('empire-reveal-stage');
    const recapStage = document.getElementById('empire-recap-stage');
    const zone = document.getElementById('pokemon-pack-container');
    const tearBtn = document.getElementById('btn-tear-booster');
    const hint = document.getElementById('po-hint');
    if (!overlay || !zone) return;

    overlay.classList.remove('hidden', 'is-revealing');
    overlay.style.setProperty('--pack-color', (PackArt.THEMES[pack.id] || PackArt.THEMES.gratuit)[1]);
    boosterStage.classList.remove('hidden');
    revealStage.classList.add('hidden');
    recapStage.classList.add('hidden');

    zone.innerHTML = `<div class="po-booster-drop">${PackArt.buildBooster(pack, { tearable: true })}</div>`;
    const booster = zone.querySelector('.booster');
    if (hint) hint.textContent = 'Glisse le doigt sur le paquet (ou touche-le) pour le déchirer';
    if (tearBtn) tearBtn.disabled = false;

    let torn = false;
    const tear = () => {
      if (torn) return;
      torn = true;
      if (tearBtn) tearBtn.disabled = true;
      tearBooster(booster);
    };

    // Glisser horizontalement pour déchirer ; un simple tap ouvre aussi
    let startX = null;
    let progress = 0;
    booster.addEventListener('pointerdown', (e) => {
      if (torn) return;
      startX = e.clientX;
      progress = 0;
      booster.setPointerCapture?.(e.pointerId);
    });
    booster.addEventListener('pointermove', (e) => {
      if (startX === null || torn) return;
      progress = Math.min(1, Math.abs(e.clientX - startX) / (booster.offsetWidth * 0.55));
      booster.style.setProperty('--tear', progress.toFixed(3));
      if (progress >= 1) tear();
    });
    const release = () => {
      if (startX === null) return;
      startX = null;
      if (torn) return;
      if (progress < 0.08 || progress > 0.45) tear();
      else booster.style.setProperty('--tear', 0);
    };
    booster.addEventListener('pointerup', release);
    booster.addEventListener('pointercancel', release);
    if (tearBtn) tearBtn.onclick = tear;
  }

  function tearBooster(booster) {
    if (window.SoundFX) {
      if (SoundFX.tear) SoundFX.tear();
      else if (SoundFX.click) SoundFX.click();
    }
    booster.style.setProperty('--tear', 1);
    booster.classList.add('is-torn');
    flashScreen('rgba(255,226,160,0.30)');

    setTimeout(() => booster.closest('.po-booster-drop')?.classList.add('is-dropping'), 520);
    setTimeout(() => {
      document.getElementById('empire-booster-stage')?.classList.add('hidden');
      document.getElementById('empire-reveal-stage')?.classList.remove('hidden');
      document.getElementById('empire-pack-overlay')?.classList.add('is-revealing');
      renderRevealDots();
      showNextCard();
    }, 1050);
  }

  function flashScreen(color) {
    const flash = document.getElementById('po-flash');
    if (!flash) return;
    flash.style.background = `radial-gradient(circle at 50% 46%, ${color} 0%, transparent 62%)`;
    flash.classList.remove('is-on');
    void flash.offsetWidth;
    flash.classList.add('is-on');
  }

  function renderRevealDots() {
    const dots = document.getElementById('po-dots');
    if (!dots) return;
    dots.innerHTML = pendingPackResults.map(() => '<span class="po-dot"></span>').join('');
  }

  function updateRevealDots() {
    document.querySelectorAll('#po-dots .po-dot').forEach((d, i) => {
      d.classList.toggle('done', i < revealIndex || (i === revealIndex && revealFlipped));
      d.classList.toggle('current', i === revealIndex);
      const item = pendingPackResults[i];
      if (item && (i < revealIndex || (i === revealIndex && revealFlipped))) d.dataset.rarity = item.rarity;
    });
  }

  function showNextCard() {
    if (revealIndex >= pendingPackResults.length) {
      showRecap();
      return;
    }

    const zone = document.getElementById('empire-card-showcase');
    const counter = document.getElementById('empire-card-counter');
    const nextBtn = document.getElementById('btn-empire-next-card');
    const hint = document.getElementById('po-reveal-hint');
    const item = pendingPackResults[revealIndex];

    revealFlipped = false;
    if (counter) counter.textContent = `Carte ${revealIndex + 1}/${pendingPackResults.length}`;
    if (nextBtn) nextBtn.textContent = 'Retourner';
    if (hint) { hint.textContent = 'Touche la carte pour la retourner'; hint.className = 'po-hint'; }
    updateRevealDots();

    zone.querySelectorAll('.rv-card').forEach(old => {
      old.classList.add('is-leaving');
      setTimeout(() => old.remove(), 450);
    });

    const card = CardsRenderer.buildRevealCard(item, { isNew: newFlags[revealIndex] });
    card.addEventListener('click', advanceReveal);
    zone.appendChild(card);
  }

  function advanceReveal() {
    if (revealBusy) return;
    if (!revealFlipped) {
      flipCurrentCard();
    } else {
      revealIndex++;
      showNextCard();
    }
  }

  function flipCurrentCard() {
    const zone = document.getElementById('empire-card-showcase');
    const card = zone?.querySelector('.rv-card:not(.is-leaving)');
    const item = pendingPackResults[revealIndex];
    if (!card || !item) return;

    revealBusy = true;
    revealFlipped = true;
    card.classList.add('is-flipped');
    updateRevealDots();

    const rank = RARITY_ORDER.indexOf(item.rarity);
    const rarityName = (EMPIRE_RARITIES[item.rarity] || {}).name || '';
    const hint = document.getElementById('po-reveal-hint');
    const nextBtn = document.getElementById('btn-empire-next-card');

    setTimeout(() => {
      if (rank >= 2) burstParticles(zone, item.rarity, rank >= 4 ? 34 : rank >= 3 ? 24 : 14);
      if (rank >= 3) flashScreen(rank >= 5 ? 'rgba(255,90,70,0.28)' : rank >= 4 ? 'rgba(255,200,60,0.28)' : 'rgba(180,110,255,0.22)');
      if (window.SoundFX) {
        if (rank >= 3 && SoundFX.win) SoundFX.win();
        else if (rank === 2 && SoundFX.upgrade) SoundFX.upgrade();
        else if (SoundFX.click) SoundFX.click();
      }
      if (hint) {
        hint.textContent = `${rarityName}${newFlags[revealIndex] ? ' · Nouvelle carte !' : ''}`;
        hint.className = `po-hint po-hint-rarity rarity-text-${item.rarity}`;
      }
      if (nextBtn) nextBtn.textContent = revealIndex + 1 >= pendingPackResults.length ? 'Voir le tirage' : 'Carte suivante';
      revealBusy = false;
    }, 380);
  }

  // Révélation : une lueur douce derrière la carte, des rayons lents et quelques étincelles qui montent
  function burstParticles(zone, rarity, count) {
    const fx = document.createElement('div');
    fx.className = `po-fx rv-r-${rarity}`;
    fx.innerHTML = '<i class="po-aura"></i><i class="po-rays"></i>';
    const n = Math.max(5, Math.round(count / 3));
    for (let i = 0; i < n; i++) {
      const sp = document.createElement('b');
      sp.className = 'po-spark';
      sp.style.setProperty('--x', `${(Math.random() - 0.5) * 260}px`);
      sp.style.setProperty('--y0', `${40 + Math.random() * 120}px`);
      sp.style.setProperty('--y1', `${-90 - Math.random() * 130}px`);
      sp.style.setProperty('--d', `${1.5 + Math.random() * 1}s`);
      sp.style.setProperty('--delay', `${Math.random() * 0.5}s`);
      sp.style.setProperty('--s', `${8 + Math.random() * 10}px`);
      fx.appendChild(sp);
    }
    zone.appendChild(fx);
    setTimeout(() => fx.remove(), 3000);
  }

  function showRecap() {
    const revealStage = document.getElementById('empire-reveal-stage');
    const recapStage = document.getElementById('empire-recap-stage');
    const recapGrid = document.getElementById('empire-recap-grid');
    const sub = document.getElementById('po-recap-sub');

    revealStage.classList.add('hidden');
    recapStage.classList.remove('hidden');

    if (!recapGrid) return;
    recapGrid.innerHTML = '';

    pendingPackResults.forEach((item, i) => {
      const card = CardsRenderer.buildCard(item, {
        compact: true,
        isNew: newFlags[i],
        onClick: () => {},
      });
      card.style.setProperty('--i', i);
      recapGrid.appendChild(card);
    });

    if (sub) {
      const nbNew = newFlags.filter(Boolean).length;
      const value = pendingPackResults.reduce((sum, it) => sum + (it.value || 0), 0);
      sub.textContent = `${pendingPackResults.length} cartes · ${nbNew} nouvelle${nbNew > 1 ? 's' : ''} · Cote totale ${formatCash(value)} €`;
    }
  }

  function bindPackRevealButtons() {
    const nextBtn = document.getElementById('btn-empire-next-card');
    if (nextBtn) nextBtn.addEventListener('click', advanceReveal);

    const skipBtn = document.getElementById('btn-empire-skip');
    if (skipBtn) skipBtn.addEventListener('click', showRecap);

    const collectBtn = document.getElementById('btn-empire-collect');
    if (collectBtn) collectBtn.addEventListener('click', () => {
      document.getElementById('empire-pack-overlay')?.classList.add('hidden');
      // Recalc passives in case new cards were added
      recalcAllPassives();
      ClickerEngine.showToast('✅ Cartes ajoutées à votre collection !', 'success');
      // On reste dans la boutique pour pouvoir enchaîner les paquets
      if (currentPage === 'paquets') updateFreePackDisplay(); else navigateTo('paquets');
    });
  }

  // ── Inventory ──────────────────────────────────────────────
  let invViewMode = 'owned'; // 'owned' | 'catalog' | 'doubles'
  let invSearch = '';

  function renderInventory() {
    const grid = document.getElementById('empire-inv-grid');
    if (!grid) return;

    const totalCatalog = typeof getTotalCatalogCount === 'function' ? getTotalCatalogCount() : 11152;
    const ownedIds = Object.keys(state.inventory).filter(id => (state.inventory[id] || 0) > 0);
    const ownedCountEl = document.getElementById('inv-owned-count');
    if (ownedCountEl) {
      ownedCountEl.textContent = `${ownedIds.length} / ${totalCatalog.toLocaleString('fr-FR')} cartes découvertes (${((ownedIds.length / totalCatalog) * 100).toFixed(1)}%)`;
    }

    // Progression par famille, affichée sur chaque onglet
    const all = (typeof getAllBaseItemsList === 'function') ? getAllBaseItemsList() : [...EMPIRE_DB];
    document.querySelectorAll('#page-inventaire .cat-tab[data-cat]').forEach(tab => {
      const f = tab.dataset.cat;
      const total = all.filter(i => catMatches(i.cat, f)).length;
      const owned = ownedIds.filter(id => { const it = getEmpireItemById(id); return it && catMatches(it.cat, f); }).length;
      let span = tab.querySelector('.tab-count');
      if (!span) { span = document.createElement('span'); span.className = 'tab-count'; tab.appendChild(span); }
      span.textContent = `${owned}/${total.toLocaleString('fr-FR')}`;
    });

    let items = [];
    if (invViewMode === 'owned') {
      items = ownedIds.map(id => getEmpireItemById(id)).filter(Boolean);
    } else if (invViewMode === 'doubles') {
      // Cartes en plusieurs exemplaires : le surplus se vend sur la Bourse
      items = ownedIds.filter(id => state.inventory[id] > 1).map(id => getEmpireItemById(id)).filter(Boolean);
    } else {
      items = all.slice();
    }

    // Category filter
    if (currentInventoryCat !== 'all') {
      items = items.filter(i => catMatches(i.cat, currentInventoryCat));
    }

    // Recherche par nom
    if (invSearch) items = items.filter(i => i.name.toLowerCase().includes(invSearch));

    // Sort
    const rarityOrder = { mythique:6, legendaire:5, epique:4, rare:3, 'peu-commune':2, commune:1 };
    if (currentInventorySort === 'rarity') {
      items.sort((a,b) => (rarityOrder[b.rarity]||0) - (rarityOrder[a.rarity]||0));
    } else if (currentInventorySort === 'value') {
      items.sort((a,b) => b.value - a.value);
    } else if (currentInventorySort === 'value_asc') {
      items.sort((a,b) => a.value - b.value);
    } else if (currentInventorySort === 'name') {
      items.sort((a,b) => a.name.localeCompare(b.name, 'fr'));
    } else if (currentInventorySort === 'name_desc') {
      items.sort((a,b) => b.name.localeCompare(a.name, 'fr'));
    } else if (currentInventorySort === 'owned') {
      items.sort((a,b) => (state.inventory[b.id]||0) - (state.inventory[a.id]||0));
    }

    if (items.length === 0) {
      grid.innerHTML = `<p class="empty-state">${invViewMode === 'owned'
        ? 'Aucune carte de cette famille pour l\'instant. Ouvre des paquets dans la Boutique, ou passe en « Catalogue complet » pour voir ce qui t\'attend.'
        : invViewMode === 'doubles' ? 'Aucun double ici : tu n\'as qu\'un exemplaire de chaque carte.'
        : 'Aucune carte.'}</p>`;
      return;
    }

    // Affichage progressif : 60 cartes, puis la suite quand on arrive en bas de la grille
    const PAGE = 60;
    let shown = 0;
    grid.innerHTML = '';
    const sentinel = document.createElement('div');
    sentinel.className = 'grid-sentinel';
    const more = () => {
      const chunk = items.slice(shown, shown + PAGE);
      shown += chunk.length;
      const tmp = document.createElement('div');
      CardsRenderer.buildGrid(tmp, chunk, state.inventory, { onClick: (item) => CardsRenderer.openCardModal(item) });
      while (tmp.firstChild) grid.insertBefore(tmp.firstChild, sentinel);
      if (shown >= items.length) { sentinel.remove(); if (invObserver) invObserver.disconnect(); }
    };
    grid.appendChild(sentinel);
    if (invObserver) invObserver.disconnect();
    invObserver = ('IntersectionObserver' in window)
      ? new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) more(); }, { root: grid, rootMargin: '400px' })
      : null;
    more();
    if (invObserver && sentinel.isConnected) invObserver.observe(sentinel);
    else while (shown < items.length) more();
  }
  let invObserver = null;

  function bindInventoryFilters() {
    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentInventoryCat = tab.dataset.cat || 'all';
        renderInventory();
      });
    });

    const viewSel = document.getElementById('inv-view-empire');
    if (viewSel) {
      viewSel.addEventListener('change', () => {
        invViewMode = viewSel.value;
        renderInventory();
      });
    }

    const searchInp = document.getElementById('inv-search-empire');
    if (searchInp) {
      searchInp.addEventListener('input', () => { invSearch = searchInp.value.toLowerCase().trim(); renderInventory(); });
    }

    const sortSel = document.getElementById('inv-sort-empire');
    if (sortSel) {
      sortSel.addEventListener('change', () => {
        currentInventorySort = sortSel.value;
        renderInventory();
      });
    }

    const resetBtn = document.getElementById('btn-reset-empire-game');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (await GameDialog.confirm('Ta collection sera effacée et tu recommenceras à neuf.', { title: 'Réinitialiser la collection ?', ok: 'Tout effacer', danger: true })) {
          resetEntireGame(true);
        }
      });
    }
  }

  // ── Empire Rooms ───────────────────────────────────────────
  function renderEmpire() {
    const container = document.getElementById('empire-rooms-container');
    if (!container) return;
    autoFillRooms();
    container.innerHTML = '';

    const empireLevel = ClickerEngine.getState().empireLevel;
    const passive = ClickerEngine.getState().passivePerSec || 0;
    const bar = document.createElement('div');
    bar.className = 'empire-auto-bar';
    bar.innerHTML = `<div><strong>${formatCash(passive)} €/s</strong><span>de revenu passif grâce aux cartes placées ici</span></div>
      <button class="btn-empire ${state.autoRooms === false ? 'btn-empire-secondary' : 'btn-empire-primary'}" id="btn-empire-auto">Placement auto : ${state.autoRooms === false ? 'NON' : 'OUI'}</button>`;
    container.appendChild(bar);
    bar.querySelector('#btn-empire-auto').addEventListener('click', () => {
      state.autoRooms = state.autoRooms === false;
      saveState();
      if (state.autoRooms !== false) autoFillRooms();
      renderEmpire();
      recalcAllPassives();
    });

    Object.entries(state.rooms).forEach(([roomId, room]) => {
      const locked = empireLevel < room.unlockLevel;
      const div = document.createElement('div');
      div.className = `empire-location${locked ? ' locked' : ''}`;
      div.dataset.room = roomId;

      // Calculate room income
      const roomIncome = room.assigned.reduce((sum, id) => {
        const item = getEmpireItemById(id);
        return sum + (item ? item.cashPerSec : 0);
      }, 0);

      div.innerHTML = `
        <div class="empire-location-header">
          <div class="empire-location-icon">${room.icon}</div>
          <div class="empire-location-info">
            <div class="empire-location-name">${room.name}</div>
            <div class="empire-location-level">${locked ? `🔒 Débloqué au niveau Empire ${room.unlockLevel}` : `${room.slots} emplacements`}</div>
          </div>
          <div class="empire-location-income">
            <div class="empire-income-val">${formatCash(roomIncome)} €/s</div>
          </div>
        </div>
        ${!locked ? `
          <div class="empire-slots" id="slots-${roomId}">
            ${renderRoomSlots(roomId, room)}
            ${room.assigned.length < room.slots ? `
              <div class="empire-slot add-slot" data-room="${roomId}">
                <span class="slot-emoji">＋</span>
                <span style="font-size:0.6rem;color:var(--text-dim)">Assigner</span>
              </div>` : ''}
          </div>` : ''}
      `;

      container.appendChild(div);
    });

    // Bind slot interactions
    document.querySelectorAll('.add-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        const roomId = slot.dataset.room;
        openAssignModal(roomId);
      });
    });

    document.querySelectorAll('.empire-slot.filled').forEach(slot => {
      slot.addEventListener('click', () => {
        const itemId = slot.dataset.item;
        const roomId = slot.closest('.empire-location').dataset.room;
        if (state.autoRooms !== false) { ClickerEngine.showToast('Placement auto activé : désactive-le pour choisir toi-même', 'info'); return; }
        if (itemId && roomId) unassignFromRoom(roomId, itemId);
      });
    });
  }

  function renderRoomSlots(roomId, room) {
    return room.assigned.map(itemId => {
      const item = getEmpireItemById(itemId);
      if (!item) return '';
      const r = CardsRenderer.RARITY_CONFIG[item.rarity] || {};
      return `
        <div class="empire-slot filled" data-item="${itemId}" data-room="${roomId}"
             style="--card-border:${r.border||'#3b82f6'}">
          <span class="slot-emoji">${item.emoji}</span>
          <span class="slot-name">${item.name.substring(0,12)}</span>
          <span class="slot-cps">+${formatCash(item.cashPerSec)}/s</span>
        </div>
      `;
    }).join('');
  }

  function openAssignModal(roomId) {
    const room = state.rooms[roomId];
    if (!room) return;

    // Get owned items not currently assigned anywhere
    const allAssigned = Object.values(state.rooms).flatMap(r => r.assigned);
    const ownedItems = Object.keys(state.inventory)
      .filter(id => !allAssigned.includes(id) && (state.inventory[id] || 0) > 0)
      .map(id => getEmpireItemById(id))
      .filter(Boolean);

    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;

    if (ownedItems.length === 0) {
      body.innerHTML = `<div style="text-align:center;padding:32px">
        <div style="font-size:2.5rem;margin-bottom:8px">📦</div>
        <p style="color:var(--text-muted)">Aucun objet disponible à assigner. Ouvrez des paquets dans la Boutique !</p>
      </div>`;
    } else {
      body.innerHTML = `
        <h3 style="font-family:var(--font-title);font-size:1.5rem;color:var(--empire-gold);margin-bottom:16px">
          Assigner dans ${room.name}
        </h3>
        <div id="assign-modal-grid" class="pick-wrap"></div>
      `;

      const grid = body.querySelector('#assign-modal-grid');
      CardsRenderer.buildPicker(grid, ownedItems, state.inventory, {
        mode: 'passive',
        onClick: (item) => {
          assignToRoom(roomId, item.id);
          modal.classList.add('hidden');
          renderEmpire();
          recalcAllPassives();
          ClickerEngine.showToast(`✅ ${item.name} assignée dans ${room.name} !`, 'success');
        },
      });
    }

    modal.classList.remove('hidden');
  }

  function assignToRoom(roomId, itemId) {
    const room = state.rooms[roomId];
    if (!room || room.assigned.length >= room.slots) return;
    if (!room.assigned.includes(itemId)) {
      room.assigned.push(itemId);
    }
    saveState();
  }

  function unassignFromRoom(roomId, itemId) {
    const room = state.rooms[roomId];
    if (!room) return;
    room.assigned = room.assigned.filter(id => id !== itemId);
    saveState();
    renderEmpire();
    recalcAllPassives();
    ClickerEngine.showToast('❌ Carte retirée de l\'emplacement', 'info');
  }

  function bindEmpireRooms() {
    // Handled in renderEmpire
  }

  // Placement automatique : les meilleures cartes (revenu passif) vont dans les pièces débloquées.
  // Désactivable depuis la page de l'Empire (état.autoRooms === false) pour placer ses cartes à la main.
  function autoFillRooms() {
    if (state.autoRooms === false) return;
    const level = (typeof ClickerEngine !== 'undefined' && ClickerEngine.getState) ? (ClickerEngine.getState().empireLevel || 1) : 1;
    const open = Object.values(state.rooms).filter(r => level >= r.unlockLevel);
    const slots = open.reduce((a, r) => a + r.slots, 0);
    const best = Object.keys(state.inventory).filter(id => (state.inventory[id] || 0) > 0).map(id => getEmpireItemById(id)).filter(Boolean)
      .sort((a, b) => (b.cashPerSec || 0) - (a.cashPerSec || 0)).slice(0, slots).map(i => i.id);
    let i = 0, changed = false;
    Object.values(state.rooms).forEach(r => {
      const next = level >= r.unlockLevel ? best.slice(i, i += r.slots) : [];
      if (JSON.stringify(next) !== JSON.stringify(r.assigned)) { r.assigned = next; changed = true; }
    });
    if (changed) { saveState(); recalcAllPassives(); }
  }

  function recalcAllPassives() {
    const allAssigned = Object.values(state.rooms).flatMap(r => r.assigned);
    ClickerEngine.setPassiveCards([...new Set(allAssigned)]);   // (getState() renvoie une copie : on passe par cette fonction)
  }

  // ═══════════════════════════════════════════════════════════
  // BOURSE & MARCHÉ P2P (ventes entre joueurs & Argus Mondial)
  // Règle stricte : Une carte ne peut être achetée QUE si elle est en circulation
  // et qu'un joueur / collectionneur l'a mise en vente !
  // ═══════════════════════════════════════════════════════════

  let bourseTab = 'listings'; // 'listings' | 'catalog' | 'my_sales' | 'history'
  let bourseCatFilter = 'all';
  let bourseRarityFilter = 'all';
  let bourseOwnershipFilter = 'all';
  let bourseListingTypeFilter = 'all'; // 'all' | 'sale' | 'auction'
  let bourseSort = 'value_desc';
  let bourseSearchQuery = '';
  let bourseListSort = 'new';   // tri des offres : new | price_asc | price_desc | name | rarity
  let boursePage = 1;
  const BOURSE_PAGE_SIZE = 32;

  // Cartes de base initiales connues de la communauté (Communes & Peu Communes de départ)
  // Strictement aucune Mythique ni Légendaire pour préserver la règle absolue !
  const INITIAL_CIRCULATION_SEED = [
    'marlboro-rouge', 'camel-filtre', 'winston-rouge', 'lucky-strike-original',
    'chesterfield-red', 'gauloises-bleues', 'gitanes-brunes', 'philip-morris',
    'bic-jetable', 'bic-mini', 'ricard', 'kronenbourg-1664', 'claquettes-chaussettes',
    'bond-street', 'marlboro-medium', 'pastis-51', 'joint-basics', 'shit-marocain'
  ];

  // ── Vrai marché entre joueurs (serveur) ─────────────────────
  // Plus aucun faux acheteur : les offres viennent uniquement des autres joueurs, et seuls de vrais joueurs achètent.
  let marketFetchedAt = 0, marketFetching = false;
  // Tant que la Bourse est ouverte, les offres des autres joueurs se mettent à jour toutes les 15 secondes
  setInterval(() => {
    if (currentPage !== 'bourse' || document.hidden) return;
    refreshMarket(true).then(changed => { if (changed && currentPage === 'bourse' && bourseTab !== 'catalog') renderBourse(); });
  }, 15000);
  async function refreshMarket(force) {
    if (marketFetching || !window.sb || !(window.Account && Account.user)) return false;
    if (!force && Date.now() - marketFetchedAt < 8000) return false;
    marketFetching = true;
    try {
      const { data, error } = await window.sb.rpc('market_open');
      if (error || !Array.isArray(data)) return false;
      const all = data.map(o => ({ id: o.id, itemId: o.card, seller: o.mine ? 'Vous' : o.seller, isPlayer: !!o.mine, type: 'sale', price: o.price, currentBid: o.price, minBid: o.price, created: Date.parse(o.at), server: true }))
        .filter(l => getEmpireItemById(l.itemId));
      const changed = JSON.stringify(all.map(l => l.id)) !== JSON.stringify((state.marketListings || []).map(l => l.id));
      state.marketListings = all;
      state.myListings = all.filter(l => l.isPlayer);
      marketFetchedAt = Date.now();
      return changed;
    } finally { marketFetching = false; }
  }

  function ensureCirculationAndMarket() {
    if (!state.circulatedItems) state.circulatedItems = {};
    if (!state.marketListings) state.marketListings = [];
    if (!state.myListings) state.myListings = [];

    // 1. Enregistrer dans la circulation mondiale toutes les cartes du joueur
    Object.keys(state.inventory || {}).forEach(id => {
      if ((state.inventory[id] || 0) > 0) {
        state.circulatedItems[id] = true;
      }
    });

    // 2. Si aucune carte n'est encore enregistrée en circulation, injecter le seed de base
    if (Object.keys(state.circulatedItems).length === 0) {
      INITIAL_CIRCULATION_SEED.forEach(id => {
        state.circulatedItems[id] = true;
      });
    }

    // 3. Anciennes annonces locales (avant le vrai marché) : les cartes mises « en vente » reviennent dans l'inventaire
    if ((state.myListings || []).some(l => !l.server)) {
      (state.myListings || []).forEach(l => { if (!l.server) state.inventory[l.itemId] = (state.inventory[l.itemId] || 0) + 1; });
      state.myListings = [];
      state.marketListings = [];
      saveState();
    }
  }

  // ── Historique des prix : chaque vente fait bouger la cote ──────────────
  // state.priceHistory[itemId] = { ema, sales, last, at }
  function recordSale(itemId, price) {
    if (!state.priceHistory) state.priceHistory = {};
    const item = getEmpireItemById(itemId);
    if (!item || !price) return;
    const h = state.priceHistory[itemId] || { ema: item.value, sales: 0 };
    // Moyenne mobile : les ventes récentes pèsent 30 %
    h.ema = Math.round(h.ema * 0.7 + price * 0.3);
    h.sales++;
    h.last = price;
    h.at = Date.now();
    state.priceHistory[itemId] = h;
  }

  // Cote actuelle d'une carte : valeur de base corrigée par ses ventes (entre ×0,5 et ×2)
  function marketValue(item) {
    const h = state.priceHistory && state.priceHistory[item.id];
    if (!h || !h.sales) return item.value;
    return Math.round(item.value * Math.min(2, Math.max(0.5, h.ema / item.value)));
  }

  // Indice d'une famille : écart moyen entre cote actuelle et valeur de base des cartes déjà échangées
  function categoryIndex(filter) {
    const hist = state.priceHistory || {};
    const rows = Object.keys(hist).map(id => getEmpireItemById(id)).filter(it => it && catMatches(it.cat, filter));
    if (!rows.length) return 0;
    const avg = rows.reduce((a, it) => a + marketValue(it) / it.value, 0) / rows.length;
    return Math.round((avg - 1) * 1000) / 10;
  }

  // ── MOTEUR ÉCONOMIQUE BOURSE : OFFRE & DEMANDE RÉALISTE ──────
  function getCardMarketMetrics(item) {
    if (!item) return null;
    const baseVal = marketValue(item) || (EMPIRE_RARITIES[item.rarity]?.valueBase || 50);
    const activeListings = (state.marketListings || []).filter(l => l.itemId === item.id);
    const supply = activeListings.length;
    const isCirculated = !!(state.circulatedItems && state.circulatedItems[item.id]);

    // Score de demande déterministe (Rareté + Revenus/sec + Hash)
    let hash = 0;
    for (let i = 0; i < item.id.length; i++) hash = (hash * 31 + item.id.charCodeAt(i)) & 0xffffff;
    const rarityWeights = { commune: 40, 'peu-commune': 55, rare: 70, epique: 82, legendaire: 92, mythique: 98 };
    const baseDemand = rarityWeights[item.rarity] || 50;
    const dynamicOffset = (hash % 19) - 9; // -9 à +9
    const demandScore = Math.min(99, Math.max(10, baseDemand + dynamicOffset));

    // Formule Offre vs Demande :
    // Pénurie (supply faible / nulle) -> prime de valeur
    // Surabondance (supply >= 3) -> décote
    let supplyFactor = 1.0;
    if (supply === 0) {
      supplyFactor = isCirculated ? 1.25 : 1.0;
    } else if (supply === 1) {
      supplyFactor = 1.10;
    } else if (supply === 2) {
      supplyFactor = 1.0;
    } else {
      supplyFactor = Math.max(0.68, 1.0 - (supply - 2) * 0.08);
    }

    const demandFactor = 0.85 + (demandScore / 100) * 0.35;
    const estimatedValue = Math.round(baseVal * supplyFactor * demandFactor);
    const trendPercent = Math.round(((supplyFactor * demandFactor) - 1.0) * 100 * 10) / 10;

    let liquidityLabel = 'Marché équilibré';
    if (!isCirculated) {
      liquidityLabel = 'Non tirée (0 sur les serveurs)';
    } else if (supply === 0) {
      liquidityLabel = 'Pénurie totale (0 offre en vente)';
    } else if (demandScore > 75 && supply <= 2) {
      liquidityLabel = 'Forte demande (Très recherchée)';
    } else if (supply >= 4) {
      liquidityLabel = 'Offre abondante (Forte concurrence)';
    }

    const directSales = activeListings.filter(l => l.type === 'sale').sort((a,b) => a.price - b.price);
    const auctions = activeListings.filter(l => l.type === 'auction').sort((a,b) => (a.currentBid || a.price) - (b.currentBid || b.price));

    return {
      item,
      baseVal,
      estimatedValue,
      trendPercent,
      demandScore,
      supply,
      isCirculated,
      liquidityLabel,
      activeListings,
      directSales,
      auctions,
      cheapestDirect: directSales[0] || null,
      cheapestAuction: auctions[0] || null
    };
  }

  function renderBourse() {
    const container = document.getElementById('bourse-empire-list');
    if (!container) return;

    ensureCirculationAndMarket();
    refreshMarket().then(changed => { if (changed && currentPage === 'bourse') renderBourse(); });

    // Indices calculés à partir des vraies ventes (0 % tant que rien ne s'est échangé)
    const indices = [
      { cat:'tabac',   name:'TABAC & ACCESSOIRES' },
      { cat:'alcool',  name:'SPIRITUEUX & CAVE' },
      { cat:'drogue',  name:'MARCHÉ NOIR' },
      { cat:'actrice', name:'VIP & PRESTIGE' },
      { cat:'beauf',   name:'TERROIRS & RELIQUES' },
      { cat:'foot',    name:'FOOTBALL' },
      { cat:'refs',    name:'MÈMES' },
      { cat:'chanteur', name:'MUSIQUE' },
      { cat:'culte',   name:'CULTE' },
    ].map(x => ({ ...x, delta: categoryIndex(x.cat) }));

    const activeListingsCount = state.marketListings.length;
    const myListingsCount = state.myListings.length;

    container.innerHTML = `
      <!-- Ticker des 6 Indices Boursiers Sans Emojis Kitsch -->
      <div class="bourse-indices-bar" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:14px">
        ${indices.map(idx => `
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:0.7rem;font-weight:700;letter-spacing:0.04em;color:var(--text-muted)">${idx.name}</span>
            <span style="font-family:var(--font-stat);font-size:0.8rem;font-weight:800;color:${idx.delta >= 0 ? '#22c55e' : '#ef4444'}">
              ${idx.delta >= 0 ? '+' : ''}${idx.delta}%
            </span>
          </div>
        `).join('')}
      </div>

      <!-- Navigation Bourse Épurée -->
      <div class="bourse-tabs-row" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn-empire ${bourseTab === 'listings' ? 'btn-empire-primary' : 'btn-empire-secondary'}" id="btn-bourse-listings" style="flex:1;min-width:140px;font-size:0.82rem;font-weight:700">
          Place de Marché (${activeListingsCount})
        </button>
        <button class="btn-empire ${bourseTab === 'catalog' ? 'btn-empire-primary' : 'btn-empire-secondary'}" id="btn-bourse-catalog" style="flex:1;min-width:140px;font-size:0.82rem;font-weight:700">
          Argus & Cotes Offre / Demande
        </button>
        <button class="btn-empire ${bourseTab === 'my_sales' ? 'btn-empire-primary' : 'btn-empire-secondary'}" id="btn-bourse-my-sales" style="flex:1;min-width:140px;font-size:0.82rem;font-weight:700">
          Mes Ventes (${myListingsCount})
        </button>
        <button class="btn-empire ${bourseTab === 'history' ? 'btn-empire-primary' : 'btn-empire-secondary'}" id="btn-bourse-history" style="flex:1;min-width:140px;font-size:0.82rem;font-weight:700">
          Cartes vendues
        </button>
      </div>

      <!-- Zone Dynamique selon l'onglet -->
      <div id="bourse-tab-content"></div>
    `;

    // Bind navigation buttons
    container.querySelector('#btn-bourse-listings')?.addEventListener('click', () => {
      bourseTab = 'listings';
      renderBourse();
    });

    container.querySelector('#btn-bourse-catalog')?.addEventListener('click', () => {
      bourseTab = 'catalog';
      boursePage = 1;
      renderBourse();
    });

    container.querySelector('#btn-bourse-my-sales')?.addEventListener('click', () => {
      bourseTab = 'my_sales';
      renderBourse();
    });

    container.querySelector('#btn-bourse-history')?.addEventListener('click', () => {
      bourseTab = 'history';
      renderBourse();
    });

    const tabContent = container.querySelector('#bourse-tab-content');
    if (!tabContent) return;

    if (bourseTab === 'listings') {
      renderBourseListings(tabContent);
    } else if (bourseTab === 'catalog') {
      renderBourseCatalogView(tabContent);
    } else if (bourseTab === 'my_sales') {
      renderBourseMySales(tabContent);
    } else if (bourseTab === 'history') {
      renderBourseHistory(tabContent);
    }
  }

  // ── Historique : cartes vendues et achetées ────────────────
  async function renderBourseHistory(container) {
    container.innerHTML = '<p class="soc-empty" style="padding:20px;text-align:center">Chargement…</p>';
    let rows = [];
    if (window.sb && window.Account && Account.user) {
      const { data } = await window.sb.rpc('market_history');
      rows = data || [];
    }
    if (!container.isConnected) return;
    const sold = rows.filter(r => r.sold);
    const earned = sold.reduce((a, r) => a + Number(r.net || 0), 0);
    const when = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    container.innerHTML = `
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:12px 16px;margin-bottom:12px">
        <h3 style="font-family:var(--font-title);color:var(--empire-gold);font-size:1.1rem">Tes ventes et achats</h3>
        <p style="font-size:0.78rem;color:var(--text-muted)">${sold.length} carte${sold.length > 1 ? 's' : ''} vendue${sold.length > 1 ? 's' : ''} · ${formatCash(earned)} € encaissés (commission de 5 % déduite)</p>
      </div>
      ${rows.length ? `<div class="hist-list">${rows.map(r => {
        const it = getEmpireItemById(r.card);
        return `<div class="hist-row ${r.sold ? 'is-sold' : 'is-bought'}">
          <span class="hist-name"><strong>${escHtml(it ? it.name : r.card)}</strong><em>${r.sold ? 'Vendue à' : 'Achetée à'} ${escHtml(r.other || 'un joueur')} · ${when(r.at)}</em></span>
          <span class="hist-amt">${r.sold ? '+' + formatCash(r.net) : '−' + formatCash(r.price)} €</span>
        </div>`;
      }).join('')}</div>` : '<p class="soc-empty" style="text-align:center;padding:24px">Aucune vente ni achat pour l\'instant.</p>'}`;
  }

  // ── 0. FICHE DÉTAILLÉE DE COTATION & CARNET D'ORDRES (TOUTES LES OFFRES) ──
  function openCardOrderBookModal(itemId) {
    const item = getEmpireItemById(itemId);
    if (!item) return;

    const metrics = getCardMarketMetrics(item);
    if (!metrics) return;

    const ownedQty = state.inventory[item.id] || 0;
    const now = Date.now();

    const modal = document.createElement('div');
    modal.className = 'bourse-modal-backdrop';

    modal.innerHTML = `
      <div class="bourse-modal-box bourse-modal-orderbook">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:12px">
          <div>
            <span style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);font-weight:700">
              Terminal Bourse &bull; Cotation Réelle
            </span>
            <h3 style="font-family:var(--font-title);font-size:1.3rem;color:#fff;margin:2px 0 0">
              ${item.name}
            </h3>
          </div>
          <button class="btn-empire btn-empire-secondary btn-close-ob-modal" style="padding:4px 10px;font-size:0.8rem">✕</button>
        </div>

        <!-- Visuel et Indicateurs Offre / Demande -->
        <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
          <div id="ob-card-preview-mount" style="flex:0 0 120px;display:flex;justify-content:center"></div>
          
          <div style="flex:1;min-width:210px;display:flex;flex-direction:column;gap:8px">
            <div class="ob-metrics-grid">
              <div class="ob-metric-box">
                <span class="ob-metric-label">Cote Estimée (Argus)</span>
                <div class="ob-metric-val" style="color:var(--empire-gold)">
                  ${formatCash(metrics.estimatedValue)} €
                  <span style="font-size:0.7rem;font-weight:800;color:${metrics.trendPercent >= 0 ? '#22c55e' : '#ef4444'}">
                    ${metrics.trendPercent >= 0 ? '+' : ''}${metrics.trendPercent}%
                  </span>
                </div>
              </div>

              <div class="ob-metric-box">
                <span class="ob-metric-label">Offre Actuelle</span>
                <div class="ob-metric-val">
                  ${metrics.supply} <span style="font-size:0.75rem;font-weight:600;color:var(--text-muted)">en vente</span>
                </div>
              </div>

              <div class="ob-metric-box">
                <span class="ob-metric-label">Indice Demande</span>
                <div class="ob-metric-val" style="color:#60a5fa">
                  ${metrics.demandScore}<span style="font-size:0.7rem;color:var(--text-muted)">/100</span>
                </div>
              </div>

              <div class="ob-metric-box">
                <span class="ob-metric-label">Statut Disponibilité</span>
                <div style="font-size:0.75rem;font-weight:800;color:${!metrics.isCirculated ? '#f87171' : metrics.supply > 0 ? '#4ade80' : '#facc15'}">
                  ${!metrics.isCirculated ? 'Non tirée (0)' : metrics.supply > 0 ? 'En vente active' : 'Rupture (0 offre)'}
                </div>
              </div>
            </div>

            <div style="font-size:0.72rem;padding:7px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;color:var(--text-muted);line-height:1.4">
              Marché : <strong style="color:#fff">${metrics.liquidityLabel}</strong>
            </div>
          </div>
        </div>

        <!-- Section Toutes les Offres Disponibles -->
        <div style="margin-top:4px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h4 style="font-size:0.82rem;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:#fff;margin:0">
              Toutes les Offres Actives (${metrics.supply})
            </h4>
            <span style="font-size:0.7rem;color:var(--text-muted)">
              ${metrics.directSales.length} offre(s) en vente
            </span>
          </div>

          <div id="ob-offers-container" style="display:flex;flex-direction:column;gap:6px;max-height:210px;overflow-y:auto;padding-right:4px">
            ${metrics.supply === 0 ? `
              <div style="text-align:center;padding:24px 12px;background:rgba(255,255,255,0.02);border-radius:10px;color:var(--text-muted)">
                <p style="font-size:0.85rem;margin:0 0 4px;font-weight:600">
                  ${metrics.isCirculated ? 'Aucune offre active en vente pour cette carte.' : 'Carte jamais encore tirée sur les serveurs.'}
                </p>
                <p style="font-size:0.75rem;margin:0">
                  ${metrics.isCirculated ? 'Soyez le premier collectionneur à lister votre exemplaire sur le marché !' : 'Ouvrez des paquets pour tenter de la découvrir.'}
                </p>
              </div>
            ` : metrics.activeListings.map(l => {
              const isSelf = l.isPlayer || l.seller === 'Vous';
              const timeLeftMin = Math.max(1, Math.round(((l.endsAt || (now + 3600000)) - now) / 60000));
              const hours = Math.floor(timeLeftMin / 60);
              const mins = timeLeftMin % 60;
              const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

              return `
                <div class="ob-offer-row">
                  <div class="ob-offer-info">
                    <div class="ob-offer-seller">
                      ${isSelf ? '<span style="color:#fbbf24">★ Vous</span>' : escHtml(l.seller)}
                      <span class="listing-type-badge ${l.type === 'auction' ? 'listing-type-auction' : 'listing-type-sale'}" style="font-size:0.6rem;padding:2px 6px">
                        ${l.type === 'auction' ? 'Enchère' : 'Vente directe'}
                      </span>
                    </div>
                    <div class="ob-offer-type">
                      ${l.type === 'auction' ? `Fin dans ${timeStr} &bull; Mené par ${l.highBidder || 'Personne'}` : 'Achat immédiat'}
                    </div>
                  </div>

                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="ob-offer-price">
                      <div class="ob-offer-amount">
                        ${formatCash(l.type === 'auction' ? l.currentBid : l.price)} €
                      </div>
                      ${l.type === 'auction' ? `<div class="ob-offer-timer">Min : ${formatCash(l.minBid)} €</div>` : ''}
                    </div>

                    ${isSelf ? `
                      <button class="btn-empire btn-empire-secondary btn-ob-cancel" data-id="${l.id}" style="padding:6px 10px;font-size:0.7rem;color:#f87171">
                        Retirer
                      </button>
                    ` : l.type === 'auction' ? `
                      <button class="btn-empire btn-empire-primary btn-ob-bid" data-id="${l.id}" style="padding:6px 12px;font-size:0.72rem">
                        Enchérir (${formatCash(l.minBid)} €)
                      </button>
                    ` : `
                      <button class="btn-empire btn-empire-primary btn-ob-buy" data-id="${l.id}" style="padding:6px 12px;font-size:0.72rem">
                        Acheter direct
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Pied de Modale : Mon inventaire et Mise en vente -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;flex-wrap:wrap;gap:8px">
          <div style="font-size:0.78rem;color:var(--text-muted)">
            Votre inventaire : <strong style="color:#fff">${ownedQty} exemplaire(s)</strong>
          </div>
          ${ownedQty > 0 ? `
            <button id="btn-ob-sell-this" class="btn-empire btn-empire-primary" style="padding:8px 16px;font-size:0.78rem">
              Mettre un exemplaire en vente
            </button>
          ` : `
            <button disabled class="btn-empire btn-empire-secondary" style="padding:8px 16px;font-size:0.75rem;opacity:0.4;cursor:not-allowed">
              Non possédée
            </button>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const mount = modal.querySelector('#ob-card-preview-mount');
    if (mount) {
      const card = CardsRenderer.buildCard(item, { compact: true, quantity: ownedQty });
      mount.appendChild(card);
    }

    modal.querySelector('.btn-close-ob-modal')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelector('#btn-ob-sell-this')?.addEventListener('click', () => {
      modal.remove();
      openSellCardModal(item.id);
    });

    modal.querySelectorAll('.btn-ob-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        modal.remove();
        buyMarketListing(id);
      });
    });

    modal.querySelectorAll('.btn-ob-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        modal.remove();
        cancelPlayerListing(id);
      });
    });
  }

  // ── 1. ONGLET : OFFRES ACTIVES DU MARCHÉ & ENCHÈRES ────────
  function renderBourseListings(container) {
    let listings = [...state.marketListings];

    // Filtre par catégorie
    if (bourseCatFilter !== 'all') {
      listings = listings.filter(l => {
        const it = getEmpireItemById(l.itemId);
        return it && catMatches(it.cat, bourseCatFilter);
      });
    }

    // Filtre par type (Vente vs Enchère)
    if (bourseListingTypeFilter !== 'all') {
      listings = listings.filter(l => l.type === bourseListingTypeFilter);
    }

    // Recherche
    if (bourseSearchQuery) {
      listings = listings.filter(l => {
        const it = getEmpireItemById(l.itemId);
        if (!it) return false;
        const text = `${it.name} ${it.desc || ''} ${l.seller}`.toLowerCase();
        return text.includes(bourseSearchQuery);
      });
    }

    // Tri des offres
    const rk = { mythique: 6, legendaire: 5, epique: 4, rare: 3, 'peu-commune': 2, commune: 1 };
    const itemOf = l => getEmpireItemById(l.itemId) || {};
    const priceOf = l => Number(l.type === 'auction' ? l.currentBid : l.price) || 0;
    if (bourseListSort === 'price_asc') listings.sort((a, b) => priceOf(a) - priceOf(b));
    else if (bourseListSort === 'price_desc') listings.sort((a, b) => priceOf(b) - priceOf(a));
    else if (bourseListSort === 'name') listings.sort((a, b) => String(itemOf(a).name || '').localeCompare(String(itemOf(b).name || ''), 'fr'));
    else if (bourseListSort === 'rarity') listings.sort((a, b) => (rk[itemOf(b).rarity] || 0) - (rk[itemOf(a).rarity] || 0) || priceOf(a) - priceOf(b));

    container.innerHTML = `
      <div class="bourse-info-banner" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:0.8rem;color:#fde047;line-height:1.4">
        ⚡ <strong>Place de Marché Entre Joueurs & Collectionneurs</strong> :
        Ici, uniquement des cartes mises en vente par de vrais joueurs, à prix fixe. Tu paies, tu reçois la carte ; le vendeur touche le prix moins 5 % de commission.
      </div>

      <!-- Filtres et Recherche -->
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <button type="button" class="btn-empire btn-empire-secondary" id="btn-bourse-refresh" style="padding:8px 12px;font-size:0.75rem">Actualiser</button>
        <input type="text" id="bourse-listings-search" class="game-input" style="flex:2;min-width:180px;padding:8px 12px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid var(--border-lit);color:#fff;font-size:0.8rem"
               placeholder="Rechercher une offre, un vendeur ou une carte..." value="${bourseSearchQuery}" />
        <select id="bourse-listings-sort" class="game-select-empire" aria-label="Trier les offres">
          <option value="new" ${bourseListSort === 'new' ? 'selected' : ''}>Plus récentes</option>
          <option value="price_asc" ${bourseListSort === 'price_asc' ? 'selected' : ''}>Prix croissant</option>
          <option value="price_desc" ${bourseListSort === 'price_desc' ? 'selected' : ''}>Prix décroissant</option>
          <option value="rarity" ${bourseListSort === 'rarity' ? 'selected' : ''}>Rareté</option>
          <option value="name" ${bourseListSort === 'name' ? 'selected' : ''}>Nom (A-Z)</option>
        </select>
      </div>

      <!-- Onglets Catégories -->
      <div class="inventory-cat-tabs" style="margin-bottom:14px">
        <button class="cat-tab ${bourseCatFilter === 'all' ? 'active' : ''}" data-blcat="all">Tous</button>
        <button class="cat-tab ${bourseCatFilter === 'tabac' ? 'active' : ''}" data-blcat="tabac">Tabac & accessoires</button>
        <button class="cat-tab ${bourseCatFilter === 'alcool' ? 'active' : ''}" data-blcat="alcool">Boissons</button>
        <button class="cat-tab ${bourseCatFilter === 'drogue' ? 'active' : ''}" data-blcat="drogue">Substances</button>
        <button class="cat-tab ${bourseCatFilter === 'actrice' ? 'active' : ''}" data-blcat="actrice">VIP</button>
        <button class="cat-tab ${bourseCatFilter === 'beauf' ? 'active' : ''}" data-blcat="beauf">Terroirs</button>
        <button class="cat-tab ${bourseCatFilter === 'foot' ? 'active' : ''}" data-blcat="foot">Football</button>
        <button class="cat-tab ${bourseCatFilter === 'refs' ? 'active' : ''}" data-blcat="refs">Mèmes</button>
        <button class="cat-tab ${bourseCatFilter === 'chanteur' ? 'active' : ''}" data-blcat="chanteur">Musique</button>
        <button class="cat-tab ${bourseCatFilter === 'culte' ? 'active' : ''}" data-blcat="culte">Culte</button>
      </div>

      <!-- Grille des Offres Actives -->
      <div id="bourse-listings-grid" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center"></div>
    `;

    container.querySelector('#btn-bourse-refresh')?.addEventListener('click', async () => {
      await refreshMarket(true);
      renderBourseListings(container);
      const count = (state.marketListings || []).length;
      showToast(count ? `${count} offre${count > 1 ? 's' : ''} en vente.` : 'Aucune offre pour le moment.', 'info');
    });

    const searchInp = container.querySelector('#bourse-listings-search');
    searchInp?.addEventListener('input', (e) => {
      bourseSearchQuery = e.target.value.toLowerCase().trim();
      renderBourseListings(container);
      // la liste est redessinée : on remet le curseur dans la barre pour pouvoir continuer à taper
      const again = container.querySelector('#bourse-listings-search');
      if (again) { again.focus(); const n = again.value.length; try { again.setSelectionRange(n, n); } catch (err) {} }
    });
    container.querySelector('#bourse-listings-sort')?.addEventListener('change', (e) => {
      bourseListSort = e.target.value;
      renderBourseListings(container);
    });

    container.querySelector('#bourse-listing-type-select')?.addEventListener('change', (e) => {
      bourseListingTypeFilter = e.target.value;
      renderBourseListings(container);
    });

    container.querySelectorAll('[data-blcat]').forEach(btn => {
      btn.addEventListener('click', () => {
        bourseCatFilter = btn.dataset.blcat;
        renderBourseListings(container);
      });
    });

    const grid = container.querySelector('#bourse-listings-grid');
    if (!grid) return;

    if (listings.length === 0) {
      grid.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:var(--text-muted);width:100%">
          <p style="font-size:1.1rem;margin-bottom:6px">📭 Aucune offre actuellement en vente pour ce filtre.</p>
          <p style="font-size:0.8rem">Ouvrez des paquets ou revenez plus tard pour voir de nouvelles annonces de collectionneurs !</p>
        </div>
      `;
      return;
    }

    const now = Date.now();

    listings.forEach(listing => {
      const item = getEmpireItemById(listing.itemId);
      if (!item) return;

      const isSelf = listing.isPlayer || listing.seller === 'Vous';
      const timeLeftMin = Math.max(1, Math.round(((listing.endsAt || (now + 3600000)) - now) / 60000));
      const hours = Math.floor(timeLeftMin / 60);
      const mins = timeLeftMin % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

      const cardWrap = document.createElement('div');
      cardWrap.className = 'bourse-listing-card';

      const cardVisual = CardsRenderer.buildCard(item, { compact: true });
      cardVisual.style.cursor = 'pointer';
      cardVisual.title = 'Cliquer pour ouvrir la cote boursière et toutes les offres de cette carte';
      cardVisual.addEventListener('click', () => openCardOrderBookModal(listing.itemId));

      const sameCardCount = (state.marketListings || []).filter(l => l.itemId === listing.itemId).length;

      const infoBox = document.createElement('div');
      infoBox.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:5px;align-items:center';

      infoBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <span class="listing-type-badge ${listing.type === 'auction' ? 'listing-type-auction' : 'listing-type-sale'}">
            ${listing.type === 'auction' ? 'Enchère' : 'Vente directe'}
          </span>
          <span class="listing-seller-tag ${isSelf ? 'listing-seller-self' : ''}">
            ${isSelf ? '★ Vous' : escHtml(listing.seller)}
          </span>
        </div>

        <div class="listing-price-box">
          <div class="listing-price-val">
            ${listing.type === 'auction' ? formatCash(listing.currentBid) + ' €' : formatCash(listing.price) + ' €'}
          </div>
          <div class="listing-timer">
            ${listing.type === 'auction' ? `Fin dans ${timeStr}` : 'Achat direct'}
          </div>
        </div>

        <div style="width:100%;display:flex;flex-direction:column;gap:4px">
          ${isSelf ? `
            <button class="btn-empire btn-empire-secondary btn-cancel-listing" data-id="${listing.id}" style="width:100%;padding:6px;font-size:0.7rem;color:#f87171;border-color:rgba(239,68,68,0.4)">
              Annuler l'annonce
            </button>
          ` : listing.type === 'auction' ? `
            <button class="btn-empire btn-empire-primary btn-bid-auction" data-id="${listing.id}" style="width:100%;padding:6px;font-size:0.72rem">
              Enchérir (${formatCash(listing.minBid)} €)
            </button>
            ${listing.price ? `
              <button class="btn-empire btn-empire-secondary btn-buyout-auction" data-id="${listing.id}" style="width:100%;padding:5px;font-size:0.68rem">
                Achat immédiat (${formatCash(listing.price)} €)
              </button>
            ` : ''}
          ` : `
            <button class="btn-empire btn-empire-primary btn-buy-listing" data-id="${listing.id}" style="width:100%;padding:6px;font-size:0.72rem">
              Acheter (${formatCash(listing.price)} €)
            </button>
          `}
          <button class="btn-empire btn-empire-secondary btn-inspect-ob" data-item-id="${listing.itemId}" style="width:100%;padding:3px;font-size:0.64rem;color:var(--text-muted)">
            Toutes les offres (${sameCardCount})
          </button>
        </div>
      `;

      cardWrap.appendChild(cardVisual);
      cardWrap.appendChild(infoBox);
      grid.appendChild(cardWrap);
    });

    grid.querySelectorAll('.btn-inspect-ob').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCardOrderBookModal(btn.dataset.itemId);
      });
    });

    // Événements d'achat et d'enchères
    grid.querySelectorAll('.btn-buy-listing, .btn-buyout-auction').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        buyMarketListing(id);
      });
    });


    grid.querySelectorAll('.btn-cancel-listing').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        cancelPlayerListing(id);
      });
    });
  }

  // ── 2. ONGLET : COTE & ARGUS MONDIAL (11 000+ CARTES) ──────
  function renderBourseCatalogView(container) {
    container.innerHTML = `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:0.8rem;color:var(--text-muted);line-height:1.4">
        📖 <strong>Cote Officielle & Disponibilité</strong> :
        Consultez l'argus mondial de toutes les cartes. Si une carte n'est pas encore sortie sur les serveurs ou qu'aucun joueur ne la vend, son achat est impossible.
      </div>

      <!-- Barre de Recherche -->
      <div style="margin-bottom:10px">
        <input type="text" id="bourse-search-input" class="game-input" style="width:100%;padding:10px 14px;border-radius:10px;background:rgba(0,0,0,0.4);border:1px solid var(--border-lit);color:#fff;font-size:0.85rem"
               placeholder="Rechercher une carte (ex: Marlboro, Clara Morgane, Vodka, Zippo...)"
               value="${bourseSearchQuery}" />
      </div>

      <!-- Onglets Catégories -->
      <div class="inventory-cat-tabs" style="margin-bottom:10px">
        <button class="cat-tab ${bourseCatFilter === 'all' ? 'active' : ''}" data-bcat="all">Tous</button>
        <button class="cat-tab ${bourseCatFilter === 'tabac' ? 'active' : ''}" data-bcat="tabac">Tabac & accessoires</button>
        <button class="cat-tab ${bourseCatFilter === 'alcool' ? 'active' : ''}" data-bcat="alcool">Boissons</button>
        <button class="cat-tab ${bourseCatFilter === 'drogue' ? 'active' : ''}" data-bcat="drogue">Substances</button>
        <button class="cat-tab ${bourseCatFilter === 'actrice' ? 'active' : ''}" data-bcat="actrice">VIP</button>
        <button class="cat-tab ${bourseCatFilter === 'beauf' ? 'active' : ''}" data-bcat="beauf">Terroirs</button>
        <button class="cat-tab ${bourseCatFilter === 'foot' ? 'active' : ''}" data-bcat="foot">Football</button>
        <button class="cat-tab ${bourseCatFilter === 'refs' ? 'active' : ''}" data-bcat="refs">Mèmes</button>
        <button class="cat-tab ${bourseCatFilter === 'chanteur' ? 'active' : ''}" data-bcat="chanteur">Musique</button>
        <button class="cat-tab ${bourseCatFilter === 'culte' ? 'active' : ''}" data-bcat="culte">Culte</button>
      </div>

      <!-- Filtres Secondaires -->
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <select id="bourse-rarity-select" class="game-input" style="flex:1;min-width:110px;padding:6px;font-size:0.75rem;background:#111;color:#fff;border-radius:8px">
          <option value="all" ${bourseRarityFilter === 'all' ? 'selected' : ''}>Toutes raretés</option>
          <option value="commune" ${bourseRarityFilter === 'commune' ? 'selected' : ''}>Commune</option>
          <option value="peu-commune" ${bourseRarityFilter === 'peu-commune' ? 'selected' : ''}>Peu Commune</option>
          <option value="rare" ${bourseRarityFilter === 'rare' ? 'selected' : ''}>Rare</option>
          <option value="epique" ${bourseRarityFilter === 'epique' ? 'selected' : ''}>Épique</option>
          <option value="legendaire" ${bourseRarityFilter === 'legendaire' ? 'selected' : ''}>Légendaire</option>
          <option value="mythique" ${bourseRarityFilter === 'mythique' ? 'selected' : ''}>Mythique</option>
        </select>

        <select id="bourse-ownership-select" class="game-input" style="flex:1;min-width:110px;padding:6px;font-size:0.75rem;background:#111;color:#fff;border-radius:8px">
          <option value="all" ${bourseOwnershipFilter === 'all' ? 'selected' : ''}>Tout le catalogue</option>
          <option value="owned" ${bourseOwnershipFilter === 'owned' ? 'selected' : ''}>Déjà possédées</option>
          <option value="unowned" ${bourseOwnershipFilter === 'unowned' ? 'selected' : ''}>Non possédées</option>
        </select>

        <select id="bourse-sort-select" class="game-input" style="flex:1;min-width:110px;padding:6px;font-size:0.75rem;background:#111;color:#fff;border-radius:8px">
          <option value="value_desc" ${bourseSort === 'value_desc' ? 'selected' : ''}>Cote la + élevée</option>
          <option value="value_asc" ${bourseSort === 'value_asc' ? 'selected' : ''}>Cote la + basse</option>
          <option value="cps_desc" ${bourseSort === 'cps_desc' ? 'selected' : ''}>Revenu/s max</option>
          <option value="name" ${bourseSort === 'name' ? 'selected' : ''}>Nom (A-Z)</option>
        </select>
      </div>

      <!-- Compteur et Pagination Top -->
      <div id="bourse-pagination-top" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:0.75rem;color:var(--text-muted)"></div>

      <!-- Grille TCG des Cartes de Bourse -->
      <div id="bourse-cards-grid" class="cards-grid" style="gap:12px;display:flex;flex-wrap:wrap;justify-content:center"></div>

      <!-- Pagination Bottom -->
      <div id="bourse-pagination-bottom" style="display:flex;justify-content:center;gap:12px;align-items:center;margin-top:16px"></div>
    `;

    const searchInp = container.querySelector('#bourse-search-input');
    searchInp?.addEventListener('input', (e) => {
      bourseSearchQuery = e.target.value.toLowerCase().trim();
      boursePage = 1;
      renderBourseCatalog();
    });

    container.querySelectorAll('[data-bcat]').forEach(btn => {
      btn.addEventListener('click', () => {
        bourseCatFilter = btn.dataset.bcat;
        boursePage = 1;
        renderBourse();
      });
    });

    container.querySelector('#bourse-rarity-select')?.addEventListener('change', (e) => {
      bourseRarityFilter = e.target.value;
      boursePage = 1;
      renderBourseCatalog();
    });

    container.querySelector('#bourse-ownership-select')?.addEventListener('change', (e) => {
      bourseOwnershipFilter = e.target.value;
      boursePage = 1;
      renderBourseCatalog();
    });

    container.querySelector('#bourse-sort-select')?.addEventListener('change', (e) => {
      bourseSort = e.target.value;
      boursePage = 1;
      renderBourseCatalog();
    });

    renderBourseCatalog();
  }

  function renderBourseCatalog() {
    const grid = document.getElementById('bourse-cards-grid');
    const pTop = document.getElementById('bourse-pagination-top');
    const pBottom = document.getElementById('bourse-pagination-bottom');
    if (!grid) return;

    let items = [];
    if (typeof getAllBaseItemsList === 'function') {
      items = getAllBaseItemsList();
    } else {
      items = [...EMPIRE_DB];
    }

    if (bourseCatFilter !== 'all') {
      items = items.filter(it => catMatches(it.cat, bourseCatFilter));
    }

    if (bourseRarityFilter !== 'all') {
      items = items.filter(it => it.rarity === bourseRarityFilter);
    }

    if (bourseOwnershipFilter === 'owned') {
      items = items.filter(it => (state.inventory[it.id] || 0) > 0);
    } else if (bourseOwnershipFilter === 'unowned') {
      items = items.filter(it => !(state.inventory[it.id] || 0));
    }

    if (bourseSearchQuery) {
      items = items.filter(it => {
        const text = `${it.name} ${it.desc || ''} ${it.cat || ''} ${it.rarity || ''}`.toLowerCase();
        return text.includes(bourseSearchQuery);
      });
    }

    items.sort((a, b) => {
      if (bourseSort === 'value_desc') return (b.value || 0) - (a.value || 0);
      if (bourseSort === 'value_asc') return (a.value || 0) - (b.value || 0);
      if (bourseSort === 'cps_desc') return (b.cashPerSec || 0) - (a.cashPerSec || 0);
      if (bourseSort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

    const totalCount = items.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / BOURSE_PAGE_SIZE));
    if (boursePage > totalPages) boursePage = totalPages;

    const startIdx = (boursePage - 1) * BOURSE_PAGE_SIZE;
    const pageItems = items.slice(startIdx, startIdx + BOURSE_PAGE_SIZE);

    if (pTop) {
      pTop.innerHTML = `
        <span>Affichage de <strong>${totalCount > 0 ? startIdx + 1 : 0} à ${Math.min(startIdx + BOURSE_PAGE_SIZE, totalCount)}</strong> sur <strong>${totalCount}</strong> cartes</span>
        <span>Page ${boursePage} / ${totalPages}</span>
      `;
    }

    if (pBottom) {
      pBottom.innerHTML = `
        <button class="btn-empire btn-empire-secondary" id="btn-page-prev" ${boursePage <= 1 ? 'disabled' : ''} style="padding:6px 14px;font-size:0.75rem">
          ◀ Précédent
        </button>
        <span style="font-size:0.8rem;color:var(--text-muted)">${boursePage} / ${totalPages}</span>
        <button class="btn-empire btn-empire-secondary" id="btn-page-next" ${boursePage >= totalPages ? 'disabled' : ''} style="padding:6px 14px;font-size:0.75rem">
          Suivant ▶
        </button>
      `;
      pBottom.querySelector('#btn-page-prev')?.addEventListener('click', () => {
        if (boursePage > 1) { boursePage--; renderBourseCatalog(); }
      });
      pBottom.querySelector('#btn-page-next')?.addEventListener('click', () => {
        if (boursePage < totalPages) { boursePage++; renderBourseCatalog(); }
      });
    }

    grid.innerHTML = '';
    if (pageItems.length === 0) {
      grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:32px;width:100%">Aucune carte trouvée pour cette recherche.</p>';
      return;
    }

    pageItems.forEach((item) => {
      const owned = state.inventory[item.id] || 0;
      const metrics = getCardMarketMetrics(item);
      const isCirculated = metrics.isCirculated;
      const activeOffers = metrics.activeListings;
      const hasOffers = activeOffers.length > 0;
      const cheapestOffer = hasOffers ? activeOffers.slice().sort((a,b) => (a.price || a.currentBid) - (b.price || b.currentBid))[0] : null;

      const cardWrap = document.createElement('div');
      cardWrap.className = 'bourse-item-card-wrap';
      cardWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:8px;width:160px;box-sizing:border-box;gap:6px;cursor:pointer;transition:transform 0.15s ease, border-color 0.15s ease';

      cardWrap.addEventListener('mouseenter', () => {
        cardWrap.style.borderColor = 'rgba(245,158,11,0.4)';
        cardWrap.style.transform = 'translateY(-2px)';
      });
      cardWrap.addEventListener('mouseleave', () => {
        cardWrap.style.borderColor = 'rgba(255,255,255,0.08)';
        cardWrap.style.transform = 'translateY(0)';
      });

      const card = CardsRenderer.buildCard(item, {
        compact: true,
        quantity: owned
      });

      const tradeBar = document.createElement('div');
      tradeBar.style.cssText = 'width:100%;text-align:center;display:flex;flex-direction:column;gap:4px';

      if (!isCirculated) {
        tradeBar.innerHTML = `
          <div style="font-family:var(--font-stat);font-size:0.75rem;color:var(--empire-gold);font-weight:700">
            Cote : ${formatCash(metrics.estimatedValue)} €
          </div>
          <div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.5);color:#f87171;font-size:0.62rem;font-weight:700;padding:2px 4px;border-radius:4px">
            Non découverte
          </div>
          <button class="btn-empire btn-empire-secondary btn-open-orderbook" data-item-id="${item.id}" style="width:100%;padding:4px 2px;font-size:0.65rem">
            Fiche & Cotes
          </button>
        `;
      } else if (!hasOffers) {
        tradeBar.innerHTML = `
          <div style="font-family:var(--font-stat);font-size:0.75rem;color:var(--empire-gold);font-weight:700">
            Cote : ${formatCash(metrics.estimatedValue)} €
            <span style="font-size:0.65rem;color:${metrics.trendPercent >= 0 ? '#22c55e' : '#ef4444'}">
              (${metrics.trendPercent >= 0 ? '+' : ''}${metrics.trendPercent}%)
            </span>
          </div>
          <div style="background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.5);color:#fde047;font-size:0.62rem;font-weight:700;padding:2px 4px;border-radius:4px">
            Rupture (0 offre)
          </div>
          <button class="btn-empire btn-empire-secondary btn-open-orderbook" data-item-id="${item.id}" style="width:100%;padding:4px 2px;font-size:0.65rem">
            Voir le carnet
          </button>
          ${owned > 0 ? `
            <button class="btn-empire btn-empire-secondary btn-quick-sell" data-id="${item.id}" style="width:100%;padding:3px;font-size:0.62rem;color:#f59e0b;border-color:#f59e0b">
              Mettre en vente
            </button>
          ` : ''}
        `;
      } else {
        const buyPrice = cheapestOffer.price || cheapestOffer.currentBid;
        tradeBar.innerHTML = `
          <div style="font-family:var(--font-stat);font-size:0.75rem;color:#4ade80;font-weight:700">
            Dès ${formatCash(buyPrice)} €
            <span style="font-size:0.65rem;color:${metrics.trendPercent >= 0 ? '#22c55e' : '#ef4444'}">
              (${metrics.trendPercent >= 0 ? '+' : ''}${metrics.trendPercent}%)
            </span>
          </div>
          <div style="font-size:0.62rem;color:var(--text-muted)">
            ${activeOffers.length} offre(s) active(s)
          </div>
          <button class="btn-empire btn-empire-primary btn-open-orderbook" data-item-id="${item.id}" style="width:100%;padding:4px 2px;font-size:0.68rem">
            Toutes les offres (${activeOffers.length})
          </button>
          ${owned > 0 ? `
            <button class="btn-empire btn-empire-secondary btn-quick-sell" data-id="${item.id}" style="width:100%;padding:3px;font-size:0.62rem;color:#f59e0b;border-color:#f59e0b">
              Mettre en vente
            </button>
          ` : ''}
        `;
      }

      cardWrap.appendChild(card);
      cardWrap.appendChild(tradeBar);

      // Clic sur toute la carte ouvre la fiche complète
      cardWrap.addEventListener('click', (e) => {
        if (e.target.closest('.btn-quick-sell')) return;
        openCardOrderBookModal(item.id);
      });

      grid.appendChild(cardWrap);
    });

    grid.querySelectorAll('.btn-open-orderbook').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCardOrderBookModal(btn.dataset.itemId);
      });
    });

    grid.querySelectorAll('.btn-quick-sell').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.id;
        openSellCardModal(itemId);
      });
    });
  }

  // ── 3. ONGLET : MES VENTES & METTRE EN VENTE ───────────────
  function renderBourseMySales(container) {
    const myListings = state.myListings || [];
    const ownedIds = Object.keys(state.inventory || {}).filter(id => (state.inventory[id] || 0) > 0);

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:12px 16px;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <h3 style="font-family:var(--font-title);color:var(--empire-gold);font-size:1.2rem">🏷️ Ta boutique</h3>
          <p style="font-size:0.78rem;color:var(--text-muted)">Vous avez <strong>${myListings.length}</strong> annonce(s) en ligne sur la Bourse.</p>
        </div>
        <button id="btn-open-new-sale-modal" class="btn-empire btn-empire-primary" style="padding:8px 18px;font-size:0.8rem">
          ➕ Mettre une carte en vente
        </button>
      </div>

      <!-- Annonces actives du joueur -->
      <h4 style="font-family:var(--font-stat);font-size:0.9rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">
        Vos Annonces Actives (${myListings.length})
      </h4>

      <div id="my-sales-grid" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:24px"></div>

      <!-- Vos cartes possédées disponibles pour la vente -->
      <h4 style="font-family:var(--font-stat);font-size:0.9rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">
        Vos Cartes Disponibles en Inventaire (${ownedIds.length})
      </h4>
      <div id="my-inventory-sellable-grid" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center"></div>
    `;

    container.querySelector('#btn-open-new-sale-modal')?.addEventListener('click', () => {
      if (ownedIds.length === 0) {
        showToast('Vous ne possédez aucune carte à vendre pour le moment ! Ouvrez un paquet.', 'warning');
        return;
      }
      openSellPicker();
    });

    const salesGrid = container.querySelector('#my-sales-grid');
    if (salesGrid) {
      if (myListings.length === 0) {
        salesGrid.innerHTML = `
          <div style="text-align:center;padding:24px;color:var(--text-muted);width:100%;background:rgba(255,255,255,0.02);border-radius:12px">
            <p>Aucune annonce en cours. Mettez vos doubles ou vos cartes rares en vente pour gagner de l'argent !</p>
          </div>
        `;
      } else {
        myListings.forEach(l => {
          const item = getEmpireItemById(l.itemId);
          if (!item) return;

          const cardWrap = document.createElement('div');
          cardWrap.className = 'bourse-listing-card';
          const card = CardsRenderer.buildCard(item, { compact: true });

          const box = document.createElement('div');
          box.style.cssText = 'width:100%;text-align:center;display:flex;flex-direction:column;gap:6px';
          box.innerHTML = `
            <span class="listing-type-badge ${l.type === 'auction' ? 'listing-type-auction' : 'listing-type-sale'}">
              ${l.type === 'auction' ? '🔨 Enchère' : '🏷️ Vente Directe'}
            </span>
            <div class="listing-price-box">
              <div class="listing-price-val">${formatCash(l.price)} €</div>
              <div class="listing-timer">En ligne sur le marché</div>
            </div>
            <button class="btn-empire btn-empire-secondary btn-cancel-my-listing" data-id="${l.id}" style="width:100%;padding:6px;font-size:0.7rem;color:#f87171">
              ❌ Retirer de la vente
            </button>
          `;

          cardWrap.appendChild(card);
          cardWrap.appendChild(box);
          salesGrid.appendChild(cardWrap);
        });

        salesGrid.querySelectorAll('.btn-cancel-my-listing').forEach(btn => {
          btn.addEventListener('click', () => cancelPlayerListing(btn.dataset.id));
        });
      }
    }

    const invGrid = container.querySelector('#my-inventory-sellable-grid');
    if (invGrid) {
      ownedIds.slice(0, 24).forEach(id => {
        const item = getEmpireItemById(id);
        if (!item) return;
        const qty = state.inventory[id] || 0;

        const w = document.createElement('div');
        w.style.cssText = 'display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:6px;width:154px;box-sizing:border-box;gap:6px';

        const c = CardsRenderer.buildCard(item, { compact: true, quantity: qty });
        const b = document.createElement('button');
        b.className = 'btn-empire btn-empire-primary';
        b.style.cssText = 'width:100%;padding:5px 4px;font-size:0.68rem;font-weight:700';
        b.textContent = 'Mettre en vente';
        b.onclick = () => openSellCardModal(id);

        w.appendChild(c);
        w.appendChild(b);
        invGrid.appendChild(w);
      });
    }
  }

  // ── 4. ACTIONS : ACHETER UNE ANNONCE DU MARCHÉ ──────────────
  async function buyMarketListing(listingId) {
    const listing = state.marketListings.find(l => l.id === listingId);
    if (!listing) return showToast('Cette offre n\'est plus disponible !', 'warning');
    if (listing.isPlayer || listing.seller === 'Vous') return showToast('Vous ne pouvez pas acheter votre propre annonce !', 'warning');
    const price = listing.price;
    if (ClickerEngine.getCash() < price) return showToast('Pas assez d\'argent pour acquérir cette carte !', 'error');
    if (buying) return;
    buying = true;
    try {
      // 1) le serveur doit connaître ta sauvegarde à jour (solde)  2) on débite  3) le serveur valide l'achat  4) la carte arrive
      if (window.Account && Account.push) await Account.push();
      if (typeof spendMoney === 'function') { if (!spendMoney(price)) return showToast('Pas assez d\'argent pour acquérir cette carte !', 'error'); }
      else ClickerEngine.setCash(ClickerEngine.getCash() - price);
      const { data, error } = await window.sb.rpc('market_buy', { p_id: listingId });
      if (error) {
        if (typeof earnMoney === 'function') earnMoney(price); else ClickerEngine.setCash(ClickerEngine.getCash() + price);   // remboursement
        await refreshMarket(true);
        showToast((error.message || 'Achat impossible').replace(/^.*?:\s*/, ''), 'warning');
        return renderBourse();
      }
      recordSale(listing.itemId, price);
      addToInventory(listing.itemId);
      state.marketListings = state.marketListings.filter(l => l.id !== listingId);
      saveState();
      autoFillRooms();
      recalcAllPassives();
      if (window.Account && Account.push) Account.push();
      const item = getEmpireItemById(listing.itemId);
      if (window.SoundFX && SoundFX.gold) SoundFX.gold();
      showToast(`Achat réussi : ${item?.name} à ${listing.seller} pour ${formatCash(price)} € !`, 'success');
      renderBourse();
    } finally { buying = false; }
  }
  let buying = false;

  async function cancelPlayerListing(listingId) {
    const { data, error } = await window.sb.rpc('market_cancel', { p_id: listingId });
    if (error) { await refreshMarket(true); showToast((error.message || 'Annulation impossible').replace(/^.*?:\s*/, ''), 'warning'); return renderBourse(); }
    state.inventory[data] = (state.inventory[data] || 0) + 1;     // la carte revient dans l'inventaire
    state.myListings = (state.myListings || []).filter(l => l.id !== listingId);
    state.marketListings = (state.marketListings || []).filter(l => l.id !== listingId);
    saveState();
    autoFillRooms();
    recalcAllPassives();
    if (window.Account && Account.push) Account.push();
    showToast('Annonce retirée : ta carte est revenue dans ton inventaire.', 'info');
    renderBourse();
  }

  // Choix de la carte à vendre : toute la collection, avec les mêmes filtres que l'onglet Cartes
  function openSellPicker() {
    const modal = document.createElement('div');
    modal.className = 'bourse-modal-backdrop';
    const RAR = { commune: 0, 'peu-commune': 1, rare: 2, epique: 3, legendaire: 4, mythique: 5 };
    modal.innerHTML = `
      <div class="bourse-modal-box sell-picker">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h3 style="font-family:var(--font-title);font-size:1.3rem;color:var(--empire-gold)">Quelle carte vendre ?</h3>
          <button class="btn-empire btn-empire-secondary" data-x style="padding:4px 10px">✕</button>
        </div>
        <input type="search" class="game-input" id="sp-q" placeholder="Chercher une carte…" style="width:100%;padding:8px">
        <div class="sell-picker-filters">
          <select class="game-select-empire" id="sp-cat"><option value="all">Toutes les familles</option><option value="tabac">Tabac &amp; accessoires</option><option value="alcool">Boissons</option><option value="drogue">Substances</option><option value="actrice">VIP</option><option value="beauf">Terroirs</option><option value="foot">Football</option><option value="refs">Mèmes</option><option value="chanteur">Musique</option><option value="culte">Culte</option><option value="saison">Saison</option></select>
          <select class="game-select-empire" id="sp-rar"><option value="all">Toutes raretés</option><option value="commune">Commune</option><option value="peu-commune">Peu commune</option><option value="rare">Rare</option><option value="epique">Épique</option><option value="legendaire">Légendaire</option><option value="mythique">Mythique</option></select>
          <select class="game-select-empire" id="sp-sort"><option value="value">Les plus chères</option><option value="rarity">Les plus rares</option><option value="qty">Les plus nombreuses</option><option value="name">Nom A-Z</option><option value="cheap">Les moins chères</option></select>
          <label class="sp-dbl"><input type="checkbox" id="sp-dbl"> Doubles</label>
        </div>
        <div id="sp-grid" class="sell-picker-grid"></div>
      </div>`;
    document.body.appendChild(modal);
    const grid = modal.querySelector('#sp-grid'), $ = q => modal.querySelector(q);
    const draw = () => {
      const q = ($('#sp-q').value || '').trim().toLowerCase(), cat = $('#sp-cat').value, rar = $('#sp-rar').value, dbl = $('#sp-dbl').checked, sort = $('#sp-sort').value;
      grid.innerHTML = '';
      let items = Object.keys(state.inventory || {}).filter(id => (state.inventory[id] || 0) > 0).map(id => getEmpireItemById(id))
        .filter(it => it && (!q || it.name.toLowerCase().includes(q)) && catMatches(it.cat, cat) && (rar === 'all' || it.rarity === rar) && (!dbl || state.inventory[it.id] > 1));
      const qty = it => state.inventory[it.id] || 0;
      items.sort(sort === 'rarity' ? (a, b) => (RAR[b.rarity] || 0) - (RAR[a.rarity] || 0) || b.value - a.value : sort === 'qty' ? (a, b) => qty(b) - qty(a) : sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'fr') : sort === 'cheap' ? (a, b) => a.value - b.value : (a, b) => b.value - a.value);
      if (!items.length) grid.innerHTML = '<p class="empty-state">Aucune carte ne correspond.</p>';
      items.slice(0, 80).forEach(it => grid.appendChild(CardsRenderer.buildCard(it, { compact: true, quantity: qty(it), onClick: () => { modal.remove(); openSellCardModal(it.id); } })));
    };
    ['#sp-q'].forEach(i => $(i).addEventListener('input', draw));
    ['#sp-cat', '#sp-rar', '#sp-sort', '#sp-dbl'].forEach(i => $(i).addEventListener('change', draw));
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-x]')) modal.remove(); });
    draw();
  }

  // ── 5. MODAL DE MISE EN VENTE PAR LE JOUEUR ────────────────
  function openSellCardModal(itemId) {
    const item = getEmpireItemById(itemId);
    if (!item) return;

    const ownedQty = state.inventory[itemId] || 0;
    if (ownedQty <= 0) return showToast('Vous ne possédez pas cette carte.', 'error');

    // Création modal
    const modal = document.createElement('div');
    modal.className = 'bourse-modal-backdrop';

    modal.innerHTML = `
      <div class="bourse-modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--empire-gold)">🏷️ Mettre en vente</h3>
          <button class="btn-empire btn-empire-secondary btn-close-sell-modal" style="padding:4px 10px;font-size:0.8rem">✕</button>
        </div>

        <div style="display:flex;gap:14px;align-items:center;background:rgba(255,255,255,0.03);padding:10px;border-radius:12px">
          <div id="sell-modal-card-preview" style="transform:scale(0.85);transform-origin:top left;width:110px"></div>
          <div>
            <div style="font-weight:800;font-size:1rem;color:#fff">${item.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">Cote Argus : <strong style="color:var(--empire-gold)">${formatCash(item.value)} €</strong></div>
            <div style="font-size:0.75rem;color:var(--text-muted)">En stock : <strong>${ownedQty}</strong> exemplaire(s)</div>
          </div>
        </div>

        <div>
          <label id="sell-price-label" style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:6px">
            Prix de vente souhaité (€) :
          </label>
          <input type="number" id="sell-price-input" class="game-input" style="width:100%;padding:10px;font-size:1rem;font-weight:700;color:var(--empire-gold);background:#000;border:1px solid var(--border-lit);border-radius:8px"
                 value="${Math.max(10, item.value)}" min="1" max="100000000" />
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">
            💡 Astuce : Un prix proche de la cote (${formatCash(item.value)} €) attire rapidement les collectionneurs du serveur.
          </p>
        </div>

        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn-empire btn-empire-secondary btn-close-sell-modal" style="flex:1;padding:10px">Annuler</button>
          <button id="btn-confirm-post-listing" class="btn-empire btn-empire-primary" style="flex:2;padding:10px;font-weight:800">
            Publier sur la Bourse
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const prevBox = modal.querySelector('#sell-modal-card-preview');
    if (prevBox) {
      prevBox.appendChild(CardsRenderer.buildCard(item, { compact: true }));
    }

    const priceInput = modal.querySelector('#sell-price-input');

    modal.querySelectorAll('.btn-close-sell-modal').forEach(b => {
      b.onclick = () => modal.remove();
    });

    modal.querySelector('#btn-confirm-post-listing')?.addEventListener('click', async () => {
      const priceVal = parseInt(priceInput?.value || '0');
      if (isNaN(priceVal) || priceVal <= 0) return showToast('Veuillez entrer un montant valide supérieur à 0.', 'warning');
      if ((state.inventory[itemId] || 0) <= 0) { modal.remove(); return showToast('Vous ne possédez plus cette carte.', 'error'); }
      const btn = modal.querySelector('#btn-confirm-post-listing'); btn.disabled = true;
      // la sauvegarde en ligne (qui contient encore la carte) part d'abord, puis le serveur ouvre l'annonce
      if (window.Account && Account.push) await Account.push();
      const { error } = await window.sb.rpc('market_list', { p_card: itemId, p_price: priceVal });
      if (error) { btn.disabled = false; return showToast((error.message || 'Mise en vente impossible').replace(/^.*?:\s*/, ''), 'warning'); }
      // la carte est mise de côté jusqu'à la vente ou l'annulation
      state.inventory[itemId]--;
      if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
      saveState();
      autoFillRooms();
      recalcAllPassives();
      if (window.Account && Account.push) Account.push();
      modal.remove();
      await refreshMarket(true);
      showToast(`Ta carte "${item.name}" est en vente pour ${formatCash(priceVal)} €. Tu recevras l'argent quand un joueur l'achète.`, 'success');
      bourseTab = 'my_sales';
      renderBourse();
    });
  }

  // ── Casino ─────────────────────────────────────────────────
  function bindCasino() {
    // Handled in casino.js with cash-only synchronization
  }

  // ── Free Pack Stacking (Max 10) ─────────────────────────────
  let freePackTimerId = null;

  function updateFreePackDisplay() {
    if (freePackTimerId) clearTimeout(freePackTimerId);

    // 10 minutes par paquet gratuit (moins avec les talents « Livreur du Tabac » / « Grossiste Agréé »)
    const cdMult = (typeof TalentsEngine !== 'undefined' && TalentsEngine.getFreePackCooldownMult) ? TalentsEngine.getFreePackCooldownMult() : 1;
    const cooldown = Math.round(10 * 60 * 1000 * cdMult);
    const now = Date.now();

    let freePacks = parseInt(localStorage.getItem('empire_free_packs_count') ?? '3'); // 3 offerts au départ
    let nextPackTime = parseInt(localStorage.getItem('empire_next_free_pack_time') || '0');

    if (!nextPackTime || isNaN(nextPackTime)) {
      nextPackTime = now + cooldown;
      localStorage.setItem('empire_next_free_pack_time', String(nextPackTime));
    }

    // Calculer le cumul de paquets pendant l'absence ou le temps de jeu
    while (now >= nextPackTime && freePacks < 10) {
      freePacks++;
      nextPackTime += cooldown;
    }
    if (freePacks >= 10) {
      freePacks = 10;
      nextPackTime = now + cooldown;
    }
    localStorage.setItem('empire_free_packs_count', String(freePacks));
    localStorage.setItem('empire_next_free_pack_time', String(nextPackTime));

    const btn = document.getElementById('btn-open-free-empire');
    const timer = document.getElementById('free-pack-timer-empire');
    const hudPacks = document.getElementById('hud-packs');
    if (hudPacks) hudPacks.textContent = freePacks + (freePacks === 1 ? ' paquet' : ' paquets');
    const stock = document.getElementById('free-pack-stock');
    if (stock) stock.textContent = `${freePacks}/10`;

    if (btn) {
      btn.disabled = freePacks <= 0;
      btn.textContent = freePacks > 0 ? `Ouvrir (${freePacks}/10)` : '0 Paquet';
    }

    if (timer) {
      if (freePacks >= 10) {
        timer.textContent = 'Stock plein (10/10)';
      } else {
        const remaining = Math.max(0, nextPackTime - now);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
        timer.textContent = freePacks > 0 ? `+1 dans ${timeStr}` : `Prochain dans ${timeStr}`;
      }
    }

    if (btn) {
      btn.onclick = () => {
        let currentPacks = parseInt(localStorage.getItem('empire_free_packs_count') || '0');
        if (currentPacks <= 0) return showToast('Aucun paquet gratuit disponible !', 'warning');

        currentPacks--;
        localStorage.setItem('empire_free_packs_count', String(currentPacks));
        
        if (ClickerEngine.gainXP) ClickerEngine.gainXP(15);
        const items = drawEmpirePack('gratuit', state.pityState);
        items.forEach(item => addToInventory(item.id));
        emitPackPrestige(items);
        if (typeof Prestige !== 'undefined') Prestige.emit('free_pack');
        autoFillRooms();
        saveState();
        openPackReveal(items, EMPIRE_PACKS.gratuit);
        updateFreePackDisplay();
      };
    }

    freePackTimerId = setTimeout(updateFreePackDisplay, 1000);
  }

  // ── Helpers ────────────────────────────────────────────────
  function formatCash(n) {
    if (typeof ClickerEngine !== 'undefined' && ClickerEngine.formatCash) {
      return ClickerEngine.formatCash(n);
    }
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + ' k';
    return (n || 0).toLocaleString('fr-FR');
  }

  // ── Persistence & Auto-Reset ───────────────────────────────
  const CURRENT_EMPIRE_VERSION = 'v5_clean_unique_recalibrated';

  function saveState() {
    state.saveVersion = CURRENT_EMPIRE_VERSION;
    localStorage.setItem('empire_state', JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem('empire_state');
      if (raw) {
        const saved = JSON.parse(raw);
        // Si ancienne sauvegarde issue d'une version avec variantes ou obsolète : RESET automatique propre
        if (!saved.saveVersion || saved.saveVersion !== CURRENT_EMPIRE_VERSION) {
          console.warn('[EmpireManager] Ancienne sauvegarde détectée. Réinitialisation complète pour les nouvelles cartes.');
          resetEntireGame(false);
          return;
        }
        Object.assign(state, saved);
        // Nouvelle échelle de l'économie (voir js/balance.js) : cotes et annonces des anciennes sauvegardes
        if ((saved.balanceVersion || 1) < Balance.VERSION) {
          const k = Balance.migrateFactors(saved.balanceVersion || 1).value;
          Object.values(state.priceHistory || {}).forEach(h => { if (h && typeof h.ema === 'number') h.ema = Math.round(h.ema * k); });
          (state.myListings || []).forEach(l => { ['price', 'currentBid', 'minBid'].forEach(f => { if (typeof l[f] === 'number') l[f] = Math.round(l[f] * k); }); });
        }
        if ((saved.balanceVersion || 0) < Balance.VERSION) { state.balanceVersion = Balance.VERSION; saveState(); }
      } else {
        state.balanceVersion = Balance.VERSION;
        saveState();
      }
    } catch(e) { /* ignore */ }
    ensureCirculationAndMarket();
  }

  function resetEntireGame(reload = true) {
    state.inventory = {};
    state.circulatedItems = {};
    state.totalPacksOpened = 0;
    state.pityState = {};
    state.myListings = [];
    state.saveVersion = CURRENT_EMPIRE_VERSION;
    saveState();

    if (typeof ClickerEngine !== 'undefined' && ClickerEngine.resetGame) {
      ClickerEngine.resetGame();
    }
    localStorage.removeItem('ashtray_pvp_deck');
    localStorage.setItem('empire_last_free_pack', '0');

    if (reload) {
      if (typeof ClickerEngine !== 'undefined' && ClickerEngine.showToast) {
        ClickerEngine.showToast('🧹 Partie réinitialisée avec succès ! Nouvelle collection propre prête.', 'success');
      }
      setTimeout(() => {
        window.location.reload();
      }, 400);
    }
  }

  // Expose globalement pour accès direct
  if (typeof window !== 'undefined') {
    window.resetEntireGame = resetEntireGame;
  }

  // ── Public ─────────────────────────────────────────────────
  return {
    init,
    navigateTo,
    getInventory: () => state.inventory,
    marketValue,
    recordSale,
    categoryIndex,
    addToInventory,
    takeCard,
    giveCard,
    saveState,
    resetEntireGame,
    autoFillRooms,
    bindPackRevealButtons,
    renderInventory,
    openSellCardModal,
  };

})();

// ── DOM Ready ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Bind modal close
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    document.getElementById('modal-overlay')?.classList.add('hidden');
  });

  // Bind pack reveal buttons
  EmpireManager.bindPackRevealButtons();

  // Init after clicker
  setTimeout(() => {
    EmpireManager.init();
  }, 200);
});
