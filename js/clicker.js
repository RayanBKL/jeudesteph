// ============================================================
// THE ASHTRAY KING — Clicker Engine
// Core tapping mechanic, passive income, combos
// ============================================================

const ClickerEngine = (() => {

  // ── State ──────────────────────────────────────────────────
  let state = {
    cash: 0,
    cashPerClick: 1,
    passivePerSec: 0,
    totalClicks: 0,
    clicksFromManual: 0,
    clicksFromAuto: 0,
    earnedFromClicks: 0,
    earnedFromPassive: 0,
    totalEarned: 0,

    // Equipped items (affect click & passive)
    equippedClickCards: [],  // max 3 cards boosting click
    assignedPassiveCards: [], // unlimited but max per room

    // Combo system
    comboCount: 0,
    comboTimer: null,
    comboTimeoutMs: 1500,
    comboMultiplier: 1,

    // Police risk (from drogue cards)
    policeRisk: 0,          // 0–100
    policeTimer: null,

    // Empire level (unlocks rooms)
    empireLevel: 1,
    empireXP: 0,
    empireXPToNext: 300,

    // Passive tick interval
    passiveTick: null,
  };

  // ── DOM refs ────────────────────────────────────────────────
  let els = {};

  // ── Init ───────────────────────────────────────────────────
  let ready = false;

  function init() {
    loadFromStorage();
    cacheElements();
    bindEvents();
    recalcPassive();
    recalcClickPower();
    startPassiveTick();
    setInterval(renderClickRate, 500);
    document.getElementById('btn-clicker-help')?.addEventListener('click', openStatsHelp);
    ready = true;
    render();
    console.log('[Clicker] Engine initialized.');
  }

  function cacheElements() {
    els = {
      clickTarget:   document.getElementById('clicker-target'),
      cashDisplay:   document.getElementById('clicker-cash'),
      cpsDisplay:    document.getElementById('clicker-cps'),
      cpcDisplay:    document.getElementById('clicker-cpc'),
      comboDisplay:  document.getElementById('clicker-combo'),
      policeBar:     document.getElementById('police-bar-fill'),
      popContainer:  document.getElementById('clicker-pop-zone'),
      empireLvl:     document.getElementById('empire-level-display'),
      empireXPBar:   document.getElementById('empire-xp-fill'),
      totalClicks:   document.getElementById('stat-total-clicks'),
      subClicks:     document.getElementById('stat-sub-clicks'),
      clicksEarned:  document.getElementById('stat-clicks-earned'),
      passiveEarned: document.getElementById('stat-passive-earned'),
      totalEarned:   document.getElementById('stat-total-earned'),
    };
  }

  function bindEvents() {
    if (!els.clickTarget) return;

    // Main click / tap
    // Souris : on réagit dès l'appui (pas au relâchement) = plus réactif, et les clics très rapides ne sont plus perdus.
    // L'événement « click » ne sert plus qu'au clavier (detail 0) et aux scripts, qui sont refusés par l'anti-robot.
    els.clickTarget.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' && e.button === 0) handleClick(e); });
    els.clickTarget.addEventListener('click', (e) => { if (e.detail === 0) handleClick(e); });
    // Chaque doigt posé compte pour un clic (jusqu'à 5 doigts) ; deux doigts qui touchent « en même temps » ne sont pas un robot
    els.clickTarget.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const fingers = e.changedTouches && e.changedTouches.length ? [...e.changedTouches].slice(0, 5) : [e];
      fingers.forEach((t, i) => handleClick({ clientX: t.clientX, clientY: t.clientY, target: e.target, isTrusted: e.isTrusted, preventDefault() {} }, { multi: (e.touches && e.touches.length > 1) || i > 0 }));
    }, { passive: false });

    // Touch multi-finger bonus
    els.clickTarget.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  // ── Gains des clics sur les 5 dernières secondes ───────────
  const CLICK_RATE_WINDOW = 5000;
  let clickLog = [];

  function renderClickRate() {
    const now = performance.now();
    clickLog = clickLog.filter(c => now - c.t < CLICK_RATE_WINDOW);
    const perSec = clickLog.reduce((sum, c) => sum + c.v, 0) / (CLICK_RATE_WINDOW / 1000);
    const el = document.getElementById('clicker-click-rate');
    if (el) el.textContent = '+' + formatCash(perSec) + ' €';
  }

  // Récapitulatif de tous les bonus actifs (talents + 3 cartes de clic + synergie)
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function bonusAuditHtml(syn) {
    const T = (typeof TalentsEngine !== 'undefined') ? TalentsEngine : null;
    const f = (n, d = 2) => Number(n).toFixed(d).replace('.', ',').replace(/,?0+$/, '');
    const cards = (state.equippedClickCards || []).map(id => (typeof getEmpireItemById === 'function' ? getEmpireItemById(id) : null)).filter(Boolean);
    const cardRows = cards.length ? cards.map(c => `<li>${esc(c.name)} : +${formatCash(c.clickBoost || 0)} € par clic</li>`).join('') : '<li>Aucune carte dans les cases Clic 1, 2, 3.</li>';
    const rows = [];
    if (T) {
      const auto = T.getAutoClicksPerSec(); if (auto) rows.push(`Auto-clic : ${auto} clic${auto > 1 ? 's' : ''} par seconde`);
      rows.push(`Clics : ×${f(T.getClickPowerMult())} (talents)`);
      rows.push(`Critiques : ${Math.round(T.getCritChance() * 100)} % de chances, gains ×${f(T.getCritMult(), 1)}`);
      if (T.getPassiveToClickRate()) rows.push(`Chaque clic ajoute ${f(T.getPassiveToClickRate() * 100, 1)} % de ton revenu par seconde`);
      rows.push(`Revenu des cartes : ×${f(T.getPassiveMultiplier())} (talents)`);
      const cd = T.getFreePackCooldownMult(); rows.push(`Paquet gratuit : toutes les ${f(10 * cd, 1)} min`);
      if (T.getPityReduction()) rows.push(`Garantie de rare : ${T.getPityReduction()} paquets plus tôt`);
      if (T.getMythicChanceMult() > 1) rows.push(`Mythiques ×${T.getMythicChanceMult()} dans les paquets`);
      if (T.getXPMult && T.getXPMult() > 1) rows.push(`XP : ×${f(T.getXPMult())}`);
    }
    return `
      <div class="help-block">
        <strong>Tous tes bonus actifs</strong>
        <p>Tes 3 cartes de clic :</p>
        <ul class="help-list">${cardRows}</ul>
        <p>Synergie : ${esc(syn.name)} (×${syn.multiplier}). ${esc(syn.desc || '')}</p>
        <ul class="help-list">${rows.map(r => `<li>${r}</li>`).join('')}</ul>
      </div>`;
  }

  function openStatsHelp() {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;
    const syn = getCardSynergy(state.equippedClickCards);
    const talentMult = (typeof TalentsEngine !== 'undefined' && TalentsEngine.getClickPowerMult) ? TalentsEngine.getClickPowerMult() : 1;
    const cardBonus = state.equippedClickCards
      .map(id => (typeof getEmpireItemById === 'function' ? getEmpireItemById(id) : null))
      .filter(Boolean)
      .reduce((sum, it) => sum + (it.clickBoost || 0), 0);
    body.innerHTML = `
      <h3 class="help-title">D'où vient ton argent ?</h3>
      <div class="help-block">
        <strong>Chaque clic : +${formatCash(state.cashPerClick)} €</strong>
        <p>1 € de base + le bonus « CLIC » de tes 3 cartes équipées (+${formatCash(cardBonus)}), × synergie (×${syn.multiplier}) × talents (×${talentMult.toFixed(2).replace('.', ',')}). Équipe de meilleures cartes dans les cases Clic 1, 2, 3 pour l'augmenter.</p>
      </div>
      <div class="help-block">
        <strong>Tes clics / seconde</strong>
        <p>Ce que tes clics t'ont vraiment rapporté sur les 5 dernières secondes. Plus tu cliques vite, plus il monte ; il retombe à 0 quand tu t'arrêtes.</p>
      </div>
      <div class="help-block">
        <strong>Tes cartes / seconde : +${formatCash(state.passivePerSec)} €</strong>
        <p>Chaque carte que tu possèdes rapporte un peu d'argent toute seule (sa valeur « PASSIF »), même sans cliquer. Plus ta collection est grande et rare, plus ce chiffre monte.</p>
      </div>
      ${bonusAuditHtml(syn)}
      <div class="help-block">
        <strong>Pourquoi ×1,5 ici, ×1,25 là ?</strong>
        <p>C'est la synergie de tes 3 cartes de clic : un seul bonus s'applique, le plus fort qui correspond à ton équipe.</p>
        <p><b>3 cartes de la même famille</b> (le gros bonus) : Cigarettes, Briquets, Actrices, Footballeurs, Musique ×1,5 · Alcools, Culte ×1,45 · Substances ×1,6 · Reliques Beauf ×1,4 · Mèmes ×1,67.</p>
        <p><b>2 familles qui vont ensemble</b> : Cigarette + Briquet ×1,3 · Alcool + Actrice ×1,35 · Substance + Alcool ×1,3 · Footballeur + Boisson ×1,3 · Cigarette + Alcool ×1,25 · Cigarette + Beauf ×1,2 · Footballeur + Beauf ×1,2.</p>
        <p><b>3 familles différentes</b> : ×1,2. Sinon ×1.</p>
        <p>Les talents sont à part : leur détail est dans le bouton « Bilan » de l'arbre de talents.</p>
      </div>
      <div class="help-block">
        <strong>XP et niveau d'Empire</strong>
        <p>1 XP tous les 2 clics, de l'XP à chaque paquet ouvert et à chaque partie. Chaque niveau donne 1 point de talent et débloque de nouvelles salles.</p>
      </div>
    `;
    modal.classList.remove('hidden');
  }

  // ── Anti-bot & Cadence de Clic ──────────────────────────────
  let recentManualClicks = [];
  let botCooldownUntil = 0;

  // Détection de robot : un humain a une cadence irrégulière (écart-type de plusieurs ms entre deux clics) ;
  // un logiciel de clic automatique clique à intervalle fixe. On regarde les 30 derniers écarts.
  let clickGaps = [];
  let lastClickAt = 0;
  let botStrikes = [];
  const MAX_CPS = 1000;         // plus de limite de vitesse : seuls les robots (clics non fiables, cadence de machine) sont refusés
  const MIN_GAP_MS = 2;         // écart minimum entre deux clics d'un même doigt (évite les doublons d'événements)
  function looksAutomated(gaps) {
    if (!gaps || gaps.length < 40) return false;
    const g = gaps.slice(-40);
    const mean = g.reduce((a, b) => a + b, 0) / g.length;
    if (mean > 250) return false;                       // clics lents : rien à détecter
    const sd = Math.sqrt(g.reduce((a, b) => a + (b - mean) * (b - mean), 0) / g.length);
    return sd < Math.max(0.8, mean * 0.01);             // aucune variation du tout (< 1 ms) = robot ; un humain varie toujours de plusieurs ms
  }

  function triggerBotLockout(reason) {
    // Récidive : 3 alertes en 10 minutes = pause de 30 secondes au lieu de 2
    const t = Date.now();
    botStrikes = botStrikes.filter(x => t - x < 600000); botStrikes.push(t);
    const long = botStrikes.length >= 3;
    botCooldownUntil = performance.now() + (long ? 30000 : 2000);
    clickGaps = []; lastClickAt = 0;
    recentManualClicks = [];
    if (els.clickTarget) {
      els.clickTarget.classList.add('bot-locked');
      setTimeout(() => {
        if (els.clickTarget) els.clickTarget.classList.remove('bot-locked');
      }, long ? 30000 : 2000);
    }
    showToast(`${reason} Pause de ${long ? 30 : 2} secondes.`, 'danger');
  }

  // Les défis, quêtes et succès sont prévenus par paquets (tous les 0,5 s) : les prévenir à chaque clic faisait ramer le jeu
  let lastManualAt = 0;
  let pendingClicks = 0, clickFlushTimer = null;
  function queueClickEvent() {
    pendingClicks++;
    if (clickFlushTimer) return;
    clickFlushTimer = setTimeout(() => {
      clickFlushTimer = null; const n = pendingClicks; pendingClicks = 0;
      if (n && typeof Prestige !== 'undefined') Prestige.emit('click', { n });
    }, 500);
  }

  // ── Click Handler ──────────────────────────────────────────
  function handleClick(e, opts) {
    const now = performance.now();
    const multi = !!(opts && opts.multi);

    // 1. Anti-bot : cooldown actif
    if (now < botCooldownUntil) {
      if (e && e.preventDefault) e.preventDefault();
      return;
    }

    // 2. Anti-bot : détection d'événement artificiel / script console (.click(), dispatchEvent)
    if (e && e.isTrusted === false) {
      triggerBotLockout('Script / Macro externe non autorisé !');
      return;
    }

    // 3. Cadence de clics humains : fenêtre glissante sur 1000ms
    recentManualClicks = recentManualClicks.filter(t => now - t < 1000);
    const lastClickTime = recentManualClicks[recentManualClicks.length - 1] || 0;

    // Trop vite (plus de 100 clics sur la dernière seconde, ou moins de 7 ms d'écart pour un même doigt) : le clic en trop est simplement ignoré, sans pause
    if ((!multi && lastClickTime > 0 && now - lastClickTime < MIN_GAP_MS) || recentManualClicks.length >= MAX_CPS) return;
    // Trop régulier : cadence de machine
    // Seuls les clics d'un même doigt/curseur comptent pour la cadence (deux doigts posés ensemble ne sont pas un robot)
    if (!multi && lastClickAt && now - lastClickAt < 1500 && now - lastClickAt >= 15) clickGaps.push(now - lastClickAt); else if (!multi && !(lastClickAt && now - lastClickAt < 15)) clickGaps = [];
    lastClickAt = now;
    if (clickGaps.length > 60) clickGaps.shift();
    if (looksAutomated(clickGaps)) {
      triggerBotLockout('Cadence de robot détectée : un vrai fumeur ne clique pas au millième de seconde.');
      return;
    }

    recentManualClicks.push(now); lastManualAt = Date.now();

    const earned = computeClickEarnings(false);
    state.cash += earned;
    state.totalClicks++;
    state.clicksFromManual = (state.clicksFromManual || 0) + 1;
    state.earnedFromClicks = (state.earnedFromClicks || 0) + earned;
    state.totalEarned += earned;
    clickLog.push({ t: now, v: earned });
    queueClickEvent();

    // Petit retour visuel sur le compteur
    if (els.cashDisplay) {
      els.cashDisplay.classList.remove('bump');
      void els.cashDisplay.offsetWidth;
      els.cashDisplay.classList.add('bump');
    }

    // Pop-up visual
    spawnPopup(e, earned);

    // Empire XP
    // 0,5 XP par clic manuel (2 clics = 1 XP), quel que soit le gain : l'XP récompense le jeu, pas l'argent
    gainEmpireXP(0.5);

    renderFast();
    saveToStorage();
  }

  // ── Card Synergies (Combinaisons de cartes) ──────────────
  function getCardSynergy(equippedIds) {
    const items = (equippedIds || []).map(id => (typeof getEmpireItemById === 'function' ? getEmpireItemById(id) : null)).filter(Boolean);
    if (items.length === 0) {
      return { name: 'Aucune synergie', multiplier: 1.0, icon: '⚪', desc: 'Équipez des cartes pour débloquer des synergies thématiques !' };
    }

    const cats = items.map(it => it.cat);
    const counts = {};
    cats.forEach(c => counts[c] = (counts[c] || 0) + 1);

    // Triples (3 cartes de la même catégorie)
    if (counts['cigarette'] === 3) return { name: 'Tabagisme Impérial', multiplier: 1.5, icon: '🚬', desc: '+50% clics (3 Cigarettes)' };
    if (counts['briquet'] === 3)   return { name: 'Brasier Déchaîné',   multiplier: 1.5, icon: '🔥', desc: '+50% clics (3 Briquets)' };
    if (counts['alcool'] === 3)    return { name: 'Soirée Somptueuse',  multiplier: 1.45,icon: '🍸', desc: '+45% clics (3 Alcools)' };
    if (counts['drogue'] === 3)    return { name: 'Réseau de Cartel',   multiplier: 1.6, icon: '💊', desc: '+60% clics (3 Substances)' };
    if (counts['actrice'] === 3)   return { name: 'Harem VIP Mondial',  multiplier: 1.5, icon: '👠', desc: '+50% clics (3 Actrices VIP)' };
    if (counts['beauf'] === 3)     return { name: 'Camping 5 Étoiles',  multiplier: 1.4, icon: '🩴', desc: '+40% clics (3 Reliques Beauf)' };
    if (counts['foot'] === 3)      return { name: 'Attaque de Rêve',    multiplier: 1.5, icon: '⚽', desc: '+50% clics (3 Footballeurs)' };
    if (counts['refs'] === 3)      return { name: 'Six-Seven',          multiplier: 1.67, icon: '📱', desc: '+67% clics (3 Mèmes)' };
    if (counts['chanteur'] === 3)  return { name: 'Tête d\'Affiche',    multiplier: 1.5, icon: '🎤', desc: '+50% clics (3 Musique)' };
    if (counts['culte'] === 3)     return { name: 'Soirée DVD',         multiplier: 1.45, icon: '🎬', desc: '+45% clics (3 Culte)' };

    // Duos Thématiques
    if (counts['cigarette'] >= 1 && counts['briquet'] >= 1) return { name: 'Allumage Parfait', multiplier: 1.3, icon: '🚬🔥', desc: '+30% clics (Cigarette + Briquet)' };
    if (counts['cigarette'] >= 1 && counts['alcool'] >= 1)  return { name: 'Pause Comptoir',    multiplier: 1.25,icon: '🍷🚬', desc: '+25% clics (Cigarette + Alcool)' };
    if (counts['alcool'] >= 1 && counts['actrice'] >= 1)    return { name: 'Soirée VIP Lounge', multiplier: 1.35,icon: '🥂👠', desc: '+35% clics (Alcool + Actrice)' };
    if (counts['cigarette'] >= 1 && counts['beauf'] >= 1)   return { name: 'Apéro & Sauciflard',multiplier: 1.2, icon: '🌭🚬', desc: '+20% clics (Clope + Beauf)' };
    if (counts['drogue'] >= 1 && counts['alcool'] >= 1)     return { name: 'Cocktail Détonant', multiplier: 1.3, icon: '💊🍾', desc: '+30% clics (Substance + Alcool)' };
    if (counts['foot'] >= 1 && counts['alcool'] >= 1)       return { name: 'Soir de Match',     multiplier: 1.3, icon: '⚽🍺', desc: '+30% clics (Footballeur + Boisson)' };
    if (counts['foot'] >= 1 && counts['beauf'] >= 1)        return { name: 'Mi-temps Sandwich', multiplier: 1.2, icon: '⚽🧀', desc: '+20% clics (Footballeur + Terroir)' };

    // Trio Varié
    if (items.length === 3 && Object.keys(counts).length === 3) {
      return { name: 'Empire Diversifié', multiplier: 1.2, icon: '💼', desc: '+20% clics (3 Catégories variées)' };
    }

    return { name: 'Équipe Standard', multiplier: 1.0, icon: '✨', desc: 'Associez des cartes de même famille ou duos complémentaires !' };
  }

  function getNominalClickPower() {
    let base = (typeof Balance !== 'undefined') ? Balance.BASE_CLICK : 1.0; // Gain de base garanti
    const items = state.equippedClickCards.map(id => (typeof getEmpireItemById === 'function' ? getEmpireItemById(id) : null)).filter(Boolean);
    let cardBonus = 0;
    items.forEach(it => { cardBonus += (it.clickBoost || 0); });

    let total = base + cardBonus;

    // Multiplicateur Voie Puissance de Clic (Talents)
    if (typeof TalentsEngine !== 'undefined' && TalentsEngine.getClickPowerMult) {
      total *= TalentsEngine.getClickPowerMult();
    }

    // Card Synergy Multiplier
    const synergy = getCardSynergy(state.equippedClickCards);
    total *= synergy.multiplier;

    // Talent 5 Toucher de Midas : bonus passif direct au clic
    if (typeof TalentsEngine !== 'undefined' && TalentsEngine.getPassiveToClickRate) {
      total += (state.passivePerSec * TalentsEngine.getPassiveToClickRate());
    }

    return Math.max(1, Math.round(total));
  }

  function computeClickEarnings(isAuto = false) {
    let total = getNominalClickPower();

    // Coups Critiques augmentés par les Talents
    const critChance = (typeof TalentsEngine !== 'undefined' && TalentsEngine.getCritChance) ? TalentsEngine.getCritChance() : 0.05;
    const critMult = (typeof TalentsEngine !== 'undefined' && TalentsEngine.getCritMult) ? TalentsEngine.getCritMult() : 2.0;

    if (Math.random() < critChance) {
      total = Math.round(total * critMult);
      if (!isAuto) spawnCritText();
    }

    return total;
  }

  function triggerClick(spawnVisual = false, count = 1) {
    // 1. Ne rien compter si l'onglet du navigateur est masqué / inactif
    if (!isPlayerActive()) return;   // auto-clic : seulement si le joueur utilise la fenêtre

    // L'auto-clic continue sur toutes les pages (casino, mini-jeux, bourse…) : seul compte le fait d'être présent
    for (let i = 0; i < count; i++) {
      const earned = computeClickEarnings(true);
      state.cash += earned;
      state.totalClicks++;
      state.clicksFromAuto = (state.clicksFromAuto || 0) + 1;
      state.earnedFromClicks = (state.earnedFromClicks || 0) + earned;
      state.totalEarned += earned;
    }


    renderFast();
    saveToStorage();
  }

  function buildCombo(earned) {
    state.comboCount = 0;
    state.comboMultiplier = 1.0;
  }

  // ── Joueur présent ? ───────────────────────────────────────
  // Le revenu passif et l'auto-clic ne tournent que si le jeu est affiché, la fenêtre active (au premier plan)
  // et que le joueur a bougé la souris / touché l'écran / tapé au clavier dans les 2 dernières minutes.
  const IDLE_LIMIT_MS = 120000;
  let lastActivity = Date.now();
  ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'click'].forEach(ev =>
    window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true, capture: true }));
  function isPlayerActive() {
    if (window.AkBlocked) return false;      // partie ouverte sur un autre appareil : rien ne tourne ici
    return document.visibilityState === 'visible' && document.hasFocus() && (Date.now() - lastActivity) < IDLE_LIMIT_MS;
  }

  // ── Passive Income ─────────────────────────────────────────
  function startPassiveTick() {
    clearInterval(state.passiveTick);
    state.passiveTick = setInterval(() => {
      const active = isPlayerActive();
      const pill = document.getElementById('clicker-cps')?.parentElement;
      if (pill) { pill.classList.toggle('is-paused', !active); pill.title = active ? 'Placer mes cartes (Arrière-Boutique)' : 'En pause : le revenu tombe seulement quand tu utilises la fenêtre'; }
      if (active && state.passivePerSec > 0) {
        const earned = state.passivePerSec;
        state.cash += earned;
        state.earnedFromPassive = (state.earnedFromPassive || 0) + earned;
        state.totalEarned += earned;
        renderCash();
        if (els.passiveEarned) els.passiveEarned.textContent = formatCash(state.earnedFromPassive) + ' €';
        if (els.totalEarned) els.totalEarned.textContent = formatCash(state.totalEarned) + ' €';
        saveToStorage();
      }

      // Police raid chance
      if (state.policeRisk > 0 && Math.random() < state.policeRisk / 10000) {
        triggerPoliceRaid();
      }
    }, 1000);
  }

  function computePassiveIncome(cardIds) {
    let total = 0;

    // Récupérer tout l'inventaire possédé par le joueur
    const allOwned = {};
    if (typeof window.EmpireEngine !== 'undefined' && window.EmpireEngine.getState) {
      const eState = window.EmpireEngine.getState();
      if (eState && eState.inventory) {
        Object.entries(eState.inventory).forEach(([id, qty]) => {
          if (qty > 0) allOwned[id] = (allOwned[id] || 0) + qty;
        });
      }
    }
    try {
      const empSaved = JSON.parse(localStorage.getItem('the_ashtray_king_empire_save') || '{}');
      if (empSaved.inventory) {
        Object.entries(empSaved.inventory).forEach(([id, qty]) => {
          if (qty > 0) allOwned[id] = Math.max(allOwned[id] || 0, qty);
        });
      }
    } catch(e) {}

    // Si des cartes sont explicitement passées en argument, les sommer aussi
    if (Array.isArray(cardIds) && cardIds.length > 0) {
      cardIds.forEach(id => {
        allOwned[id] = Math.max(allOwned[id] || 0, 1);
      });
    }

    // Calculer le revenu passif de toutes les cartes possédées
    Object.entries(allOwned).forEach(([id, qty]) => {
      const it = (typeof getEmpireItemById === 'function') ? getEmpireItemById(id) : null;
      if (it && typeof it.cashPerSec === 'number' && it.cashPerSec > 0) {
        total += (it.cashPerSec * qty);
      }
    });

    if (typeof TalentsEngine !== 'undefined' && TalentsEngine.getPassiveMultiplier) {
      total *= TalentsEngine.getPassiveMultiplier();
    }
    return +total.toFixed(2);
  }

  function recalcPassive() {
    state.passivePerSec = computePassiveIncome(state.assignedPassiveCards);
    if (els.cpsDisplay) {
      els.cpsDisplay.textContent = '+' + formatCash(state.passivePerSec) + ' €';
    }
  }

  // ── Police Raid ────────────────────────────────────────────
  function triggerPoliceRaid() {
    const loss = Math.floor(state.cash * 0.15);
    state.cash = Math.max(0, state.cash - loss);
    showToast(`🚔 DESCENTE DE POLICE ! Vous perdez ${formatCash(loss)} en contrebande !`, 'danger');
    renderCash();
  }

  // ── Empire XP ─────────────────────────────────────────────
  // XP pour passer du niveau n au niveau n+1 : 300, 405, 547… (×1,35 par niveau jusqu'au niveau 12,
  // puis ×1,06) — niveau 10 ≈ 13 000 XP cumulés, niveau 30 ≈ 300 000, niveau 55 ≈ 1,7 million
  function xpForLevel(level) {
    const early = Math.min(level, 12) - 1;
    const late = Math.max(0, level - 12);
    return Math.round(300 * Math.pow(1.35, early) * Math.pow(1.06, late) / 5) * 5;
  }

  function gainEmpireXP(xp) {
    const xm = (typeof TalentsEngine !== 'undefined' && TalentsEngine.getXPMult) ? TalentsEngine.getXPMult() : 1;
    state.empireXP += xp * xm;
    while (state.empireXP >= state.empireXPToNext) {
      state.empireXP -= state.empireXPToNext;
      state.empireLevel++;
      state.empireXPToNext = xpForLevel(state.empireLevel);
      try { if (typeof EmpireManager !== 'undefined' && EmpireManager.autoFillRooms) EmpireManager.autoFillRooms(); } catch (e) {}
      onEmpireLevelUp();
    }
  }

  function onEmpireLevelUp() {
    showToast(`🏆 Empire Niveau ${state.empireLevel} débloqué !`, 'success');
    updateEmpireDisplay();
  }

  // ── Card Equipment ─────────────────────────────────────────
  function equipClickCard(itemId) {
    if (state.equippedClickCards.includes(itemId)) return;
    if (state.equippedClickCards.length >= 3) {
      state.equippedClickCards.shift();
    }
    state.equippedClickCards.push(itemId);
    recalcClickPower();
    saveToStorage();
  }

  function unequipClickCard(itemId) {
    state.equippedClickCards = state.equippedClickCards.filter(id => id !== itemId);
    recalcClickPower();
    saveToStorage();
  }

  function assignPassiveCard(itemId) {
    if (!state.assignedPassiveCards.includes(itemId)) {
      state.assignedPassiveCards.push(itemId);
    }
    recalcPassive();
    saveToStorage();
  }

  // Remplace la liste complète des cartes qui rapportent (utilisé par l'Arrière-Boutique)
  function setPassiveCards(ids) {
    state.assignedPassiveCards = Array.from(new Set(ids || []));
    recalcPassive();
    saveToStorage();
  }

  function removePassiveCard(itemId) {
    state.assignedPassiveCards = state.assignedPassiveCards.filter(id => id !== itemId);
    recalcPassive();
    saveToStorage();
  }

  function recalcClickPower() {
    // Si aucune carte de clic n'est équipée manuellement, auto-équiper les meilleures cartes possédées
    if (!state.equippedClickCards || state.equippedClickCards.length === 0) {
      const allOwned = {};
      try {
        const empSaved = JSON.parse(localStorage.getItem('the_ashtray_king_empire_save') || '{}');
        if (empSaved.inventory) {
          Object.entries(empSaved.inventory).forEach(([id, qty]) => { if (qty > 0) allOwned[id] = qty; });
        }
      } catch(e) {}
      if (typeof window.EmpireEngine !== 'undefined' && window.EmpireEngine.getState) {
        const eState = window.EmpireEngine.getState();
        if (eState && eState.inventory) {
          Object.entries(eState.inventory).forEach(([id, qty]) => { if (qty > 0) allOwned[id] = qty; });
        }
      }

      const bestCards = Object.keys(allOwned)
        .map(id => (typeof getEmpireItemById === 'function') ? getEmpireItemById(id) : null)
        .filter(it => it && (it.clickBoost || 0) > 0)
        .sort((a, b) => (b.clickBoost || 0) - (a.clickBoost || 0))
        .slice(0, 3)
        .map(it => it.id);

      if (bestCards.length > 0) {
        state.equippedClickCards = bestCards;
      }
    }

    state.cashPerClick = getNominalClickPower();
    if (els.cpcDisplay) {
      els.cpcDisplay.textContent = '+' + formatCash(state.cashPerClick) + ' €';
    }
  }

  // ── Visual Popups ──────────────────────────────────────────
  function spawnPopup(e, amount) {
    if (!els.popContainer) return;
    const pop = document.createElement('div');
    pop.className = 'click-popup' + (amount > 1000 ? ' pop-big' : '');
    pop.textContent = '+' + formatCash(amount) + ' €';

    // Position relative to click
    const rect = els.popContainer.getBoundingClientRect();
    const x = ((e.clientX || 0) - rect.left) || 50;
    const y = ((e.clientY || 0) - rect.top) || 50;
    pop.style.left = Math.max(5, Math.min(90, (x / rect.width) * 100)) + '%';
    pop.style.top = Math.max(5, Math.min(85, (y / rect.height) * 100)) + '%';

    // Random drift
    pop.style.setProperty('--drift', (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 40) + 'px');

    els.popContainer.appendChild(pop);
    setTimeout(() => pop.remove(), 1200);
  }

  function spawnCritText() {
    if (!els.popContainer) return;
    const crit = document.createElement('div');
    crit.className = 'click-popup pop-crit';
    crit.textContent = '💥 CRITIQUE ×2 !';
    crit.style.left = '50%';
    crit.style.top = '30%';
    els.popContainer.appendChild(crit);
    setTimeout(() => crit.remove(), 1500);
  }

  // ── Sound ──────────────────────────────────────────────────
  function playClickSound(type = 'normal') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = 440 + Math.random() * 200;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch(e) { /* silent fail */ }
  }

  // ── Render ─────────────────────────────────────────────────
  // Rendu de chaque clic : seulement les chiffres qui bougent (les emplacements de cartes et la synergie sont refaits par render())
  let fastQueued = false;
  function renderFast() {
    renderCash();
    if (fastQueued) return;
    fastQueued = true;
    requestAnimationFrame(() => {
      fastQueued = false;
      updateEmpireDisplay();
      if (els.totalClicks) els.totalClicks.textContent = formatNumber(state.totalClicks);
      if (els.subClicks) els.subClicks.textContent = `${formatNumber(state.clicksFromManual || 0)} manuels · ${formatNumber(state.clicksFromAuto || 0)} auto`;
      if (els.clicksEarned) els.clicksEarned.textContent = formatCash(state.earnedFromClicks || 0) + ' €';
      if (els.totalEarned) els.totalEarned.textContent = formatCash(state.totalEarned) + ' €';
    });
  }

  function render() {
    renderCash();
    renderCombo();
    updateEmpireDisplay();
    renderEquippedSlots();
    renderSynergyBadge();
    if (els.totalClicks) els.totalClicks.textContent = formatNumber(state.totalClicks);
    if (els.subClicks) {
      els.subClicks.textContent = `${formatNumber(state.clicksFromManual || 0)} manuels · ${formatNumber(state.clicksFromAuto || 0)} auto`;
    }
    if (els.clicksEarned) els.clicksEarned.textContent = formatCash(state.earnedFromClicks || 0) + ' €';
    if (els.passiveEarned) els.passiveEarned.textContent = formatCash(state.earnedFromPassive || 0) + ' €';
    if (els.totalEarned) els.totalEarned.textContent = formatCash(state.totalEarned) + ' €';
    if (els.cpcDisplay) els.cpcDisplay.textContent = '+' + formatCash(state.cashPerClick) + ' €';
    if (els.cpsDisplay) els.cpsDisplay.textContent = '+' + formatCash(state.passivePerSec) + ' €';
  }

  function renderSynergyBadge() {
    const banner = document.getElementById('clicker-synergy-banner');
    if (!banner) return;
    const syn = getCardSynergy(state.equippedClickCards);
    banner.innerHTML = `
      <div class="synergy-chip" style="background:${syn.multiplier > 1.0 ? 'linear-gradient(90deg, #f59e0b22, #f59e0b44)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${syn.multiplier > 1.0 ? '#f59e0b' : '#514237'}; border-radius:12px; padding:6px 12px; display:flex; align-items:center; gap:8px; justify-content:center; max-width:340px; margin:0 auto 12px">
        <span style="font-size:1.1rem">${syn.icon}</span>
        <div style="text-align:left">
          <div style="font-weight:700;font-size:0.78rem;color:${syn.multiplier > 1.0 ? '#f59e0b' : 'var(--text-muted)'}">${syn.name} ${syn.multiplier > 1.0 ? `(×${syn.multiplier})` : ''}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">${syn.desc}</div>
        </div>
      </div>
    `;
  }

  function renderEquippedSlots() {
    for (let i = 0; i < 3; i++) {
      const slotEl = document.getElementById(`eq-slot-${i}`);
      if (!slotEl) continue;
      const itemId = state.equippedClickCards[i];
      if (itemId) {
        const item = (typeof getEmpireItemById === 'function') ? getEmpireItemById(itemId) : null;
        if (item) {
          slotEl.classList.add('equipped');
          slotEl.innerHTML = `
            <span class="slot-emoji">${item.emoji}</span>
            <span style="font-weight:700;font-size:0.75rem">${item.name.substring(0,8)}</span>
            <span style="font-size:0.65rem;color:#22c55e">+${item.clickBoost}</span>
          `;
          slotEl.onclick = () => {
            unequipClickCard(itemId);
            showToast(`Retiré : ${item.name}`, 'info');
            render();
          };
          continue;
        }
      }
      slotEl.classList.remove('equipped');
      slotEl.innerHTML = `<span class="slot-emoji">➕</span><span>Clic ${i + 1}</span>`;
      slotEl.onclick = () => openEquipModal(i);
    }
  }

  function openEquipModal(slotIndex) {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;

    const inventory = (typeof EmpireManager !== 'undefined') ? EmpireManager.getInventory() : {};
    const ownedIds = Object.keys(inventory).filter(id => (inventory[id] || 0) > 0);

    const candidates = ownedIds
      .map(id => (typeof getEmpireItemById === 'function') ? getEmpireItemById(id) : null)
      .filter(item => item && !state.equippedClickCards.includes(item.id));

    if (candidates.length === 0) {
      body.innerHTML = `
        <div style="text-align:center;padding:28px">
          <div style="font-size:2.5rem;margin-bottom:8px">🃏</div>
          <p style="color:var(--text-muted)">Aucune carte disponible à équiper pour le clic.<br>Ouvrez des paquets dans la Boutique !</p>
        </div>
      `;
    } else {
      body.innerHTML = `
        <h3 style="font-family:var(--font-title);font-size:1.4rem;color:var(--empire-gold);margin-bottom:12px;text-align:center">
          Équiper une Carte de Clic (Slot ${slotIndex + 1})
        </h3>
        <div id="equip-modal-grid" class="pick-wrap"></div>
      `;

      const grid = body.querySelector('#equip-modal-grid');
      if (typeof CardsRenderer !== 'undefined' && CardsRenderer.buildPicker) {
        CardsRenderer.buildPicker(grid, candidates, inventory, {
          mode: 'click',
          onClick: (item) => {
            equipClickCard(item.id);
            modal.classList.add('hidden');
            render();
            showToast(`⚡ ${item.name} (+${item.clickBoost}/clic) équipée !`, 'success');
          },
        });
      }
    }

    modal.classList.remove('hidden');
  }

  function renderCash() {
    if (els.cashDisplay) {
      els.cashDisplay.textContent = formatCash(state.cash) + ' €';
    }
    // Barre du haut : même argent, même format
    const legacyHud = document.getElementById('hud-money');
    if (legacyHud) legacyHud.textContent = formatCash(state.cash) + ' €';
    const ps = document.getElementById('ps-money');
    if (ps) ps.textContent = formatCash(state.cash) + ' €';
    if (typeof GameState !== 'undefined') {
      GameState.money = state.cash;
    }
  }

  function renderCombo() {
    if (!els.comboDisplay) return;
    els.comboDisplay.textContent = '';
    els.comboDisplay.style.display = 'none';
  }

  function updateEmpireDisplay() {
    if (els.empireLvl) els.empireLvl.textContent = 'Empire Niv. ' + state.empireLevel;
    const hudLvl = document.getElementById('hud-level');
    if (hudLvl) hudLvl.textContent = 'Niv. ' + state.empireLevel;
    const xpLabel = `${formatNumber(Math.floor(state.empireXP))} / ${formatNumber(state.empireXPToNext)} XP`;
    const xpPct = Math.min(100, (state.empireXP / state.empireXPToNext) * 100) + '%';
    const xpText = document.getElementById('empire-xp-text');
    if (xpText) xpText.textContent = xpLabel;
    // Même niveau affiché sur l'écran « L'Empire »
    const roomsLvl = document.getElementById('empire-rooms-level');
    if (roomsLvl) roomsLvl.textContent = 'Empire Niv. ' + state.empireLevel;
    const roomsXp = document.getElementById('empire-rooms-xp');
    if (roomsXp) roomsXp.textContent = xpLabel;
    const roomsFill = document.getElementById('empire-rooms-xp-fill');
    if (roomsFill) roomsFill.style.width = xpPct;
    if (els.empireXPBar) {
      els.empireXPBar.style.width = Math.min(100, (state.empireXP / state.empireXPToNext) * 100) + '%';
    }
  }

  // ── Format helpers ─────────────────────────────────────────
  // Montant exact jusqu'au million (chaque clic se voit), puis notation courte à 2 décimales
  function formatCash(n) {
    n = Number(n) || 0;
    const short = (v, unit) => v.toFixed(2).replace('.', ',') + ' ' + unit;
    if (n >= 1e15) return short(n / 1e15, 'Qd');
    if (n >= 1e12) return short(n / 1e12, 'Tr');
    if (n >= 1e9)  return short(n / 1e9, 'Md');
    if (n >= 1e6)  return short(n / 1e6, 'M');
    if (n > 0 && n < 10 && n % 1 !== 0) return n.toFixed(2).replace('.', ',');
    return Math.floor(n).toLocaleString('fr-FR');
  }

  function formatNumber(n) {
    return (Number(n) || 0).toLocaleString('fr-FR');
  }

  // ── Toast ──────────────────────────────────────────────────
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.classList.add('toast-show'), 50);
    setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 400); }, 3500);
  }

  // ── Save / Load ────────────────────────────────────────────
  // Écriture locale différée (au plus une fois toutes les 400 ms) : écrire à chaque clic coûte cher ; forcée quand on quitte la page
  let saveTimer = null, savePending = false;
  function saveToStorage() { savePending = true; if (!saveTimer) saveTimer = setTimeout(flushSave, 400); }
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!savePending) return;           // rien de nouveau : on ne réécrit pas (sinon le moindre envoi en ligne se croit « modifié »)
    savePending = false;
    localStorage.setItem('empire_clicker', JSON.stringify({
      cash: state.cash,
      totalClicks: state.totalClicks,
      clicksFromManual: state.clicksFromManual,
      clicksFromAuto: state.clicksFromAuto,
      earnedFromClicks: state.earnedFromClicks,
      earnedFromPassive: state.earnedFromPassive,
      totalEarned: state.totalEarned,
      equippedClickCards: state.equippedClickCards,
      assignedPassiveCards: state.assignedPassiveCards,
      empireLevel: state.empireLevel,
      empireXP: state.empireXP,
      empireXPToNext: state.empireXPToNext,
      balanceVersion: state.balanceVersion,
    }));
  }

  window.addEventListener('pagehide', flushSave, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); }, true);

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem('empire_clicker');
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(state, saved);

        // Nouvelle échelle de l'économie (voir js/balance.js) : l'argent des anciennes sauvegardes est converti
        if (typeof Balance !== 'undefined' && (saved.balanceVersion || 1) < Balance.VERSION) {
          const f = Balance.migrateFactors(saved.balanceVersion || 1).cash;
          state.cash = Balance.capCash((state.cash || 0) * f);
          state.totalEarned = Math.round((state.totalEarned || 0) * f);
          state.earnedFromClicks = Math.round((state.earnedFromClicks || 0) * f);
          state.earnedFromPassive = Math.round((state.earnedFromPassive || 0) * f);
        }
        // ne JAMAIS faire redescendre la version : une vieille page ouverte ferait reconvertir l'argent (÷12) à la prochaine ouverture
        if (typeof Balance !== 'undefined') state.balanceVersion = Math.max(saved.balanceVersion || 0, Balance.VERSION);

        // Courbe d'XP : toujours recalculée depuis le niveau (les anciennes sauvegardes suivaient une autre courbe)
        state.empireXPToNext = xpForLevel(state.empireLevel || 1);
        if (state.empireXP >= state.empireXPToNext) state.empireXP = state.empireXPToNext - 1;

        // Rétrocompatibilité / Migration transparente pour anciennes sauvegardes
        if (state.totalClicks > 0 && !state.clicksFromManual && !state.clicksFromAuto) {
          state.clicksFromManual = state.totalClicks;
          state.clicksFromAuto = 0;
        }
        if (state.totalEarned > 0 && !state.earnedFromClicks && !state.earnedFromPassive) {
          state.earnedFromClicks = Math.round(state.totalEarned * 0.35);
          state.earnedFromPassive = Math.max(0, state.totalEarned - state.earnedFromClicks);
        }
      }
      if (typeof Balance !== 'undefined' && !state.balanceVersion) state.balanceVersion = Balance.VERSION;   // nouvelle partie : déjà à la bonne échelle
      if (typeof GameState !== 'undefined' && GameState.money > 0 && state.cash === 0) {
        state.cash = GameState.money;
      }
    } catch(e) { /* ignore */ }
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    flushSave,
    msSinceManualClick: () => Date.now() - lastManualAt,
    // Niveau fixé par l'administrateur : l'XP du niveau repart de 0
    setLevel: (lv) => { state.empireLevel = Math.max(1, Math.round(lv)); state.empireXP = 0; state.empireXPToNext = xpForLevel(state.empireLevel); try { if (typeof EmpireManager !== 'undefined' && EmpireManager.autoFillRooms) EmpireManager.autoFillRooms(); } catch (e) {} render(); saveToStorage(); },
    init,
    getState: () => ({ ...state }),
    getCash: () => state.cash,
    setCash: (v) => { state.cash = v; renderCash(); saveToStorage(); },
    addCash: (v) => { state.cash += v; state.totalEarned += v; renderCash(); saveToStorage(); },
    equipClickCard,
    unequipClickCard,
    assignPassiveCard,
    removePassiveCard,
    setPassiveCards,
    recalcPassive,
    recalcClickPower,
    formatCash,
    formatNumber,
    showToast,
    resetGame: () => {
      state.cash = 1000;
      state.totalClicks = 0;
      state.totalEarned = 1000;
      state.equippedClickCards = [];
      state.assignedPassiveCards = [];
      state.empireLevel = 1;
      state.empireXP = 0;
      state.empireXPToNext = xpForLevel(1);
      renderCash();
      saveToStorage();
    },
    render,
    isReady: () => ready,
    gainXP: (xp) => { gainEmpireXP(xp); render(); saveToStorage(); },
    triggerClick,
    looksAutomated,
    isPlayerActive,
  };
})();

if (typeof window !== "undefined") {
  window.ClickerEngine = ClickerEngine;
}

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Only init if clicker page exists
  if (document.getElementById('clicker-target')) {
    ClickerEngine.init();
  }
});
