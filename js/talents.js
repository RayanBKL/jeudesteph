// ============================================================
// THE ASHTRAY KING — Arbre de talents (en cercle : 5 branches, 5 ponts, le Roi du Cendrier au centre)
// ============================================================

const TalentsEngine = (() => {

  // ── L'arbre : 5 branches (clics, auto-clic, revenu, paquets, réputation) qui partent du bord et montent vers le centre ──
  // Chaque branche = 5 talents à la suite (chacun demande le précédent). Les talents du 3e anneau se relient aussi à la branche voisine.
  // 5 « ponts » entre branches voisines demandent LES DEUX bouts ; le Roi du Cendrier, au centre, demande 3 ponts sur 5.
  const BRANCHES = [
    { id: 'clic', label: 'Clics', angle: 0, nodes: [
      { name: 'Pouce Échauffé', icon: '👆', type: 'click', mult: 1.10, desc: 'Clics : +10 % d\'argent par clic.', lore: 'Il suffit de chauffer le pouce.' },
      { name: 'Pouce Calleux', icon: '💪', type: 'click', mult: 1.12, desc: 'Clics : +12 % d\'argent par clic (en plus).', lore: 'Plus rien ne le fait mal.' },
      { name: 'Coup Sec', icon: '💥', type: 'crit', critChance: 0.10, critMult: 3, desc: 'Critiques : 10 % de tes clics rapportent ×3 (au lieu de 5 % à ×2).', lore: 'Un clic, et le comptoir tremble.' },
      { name: 'Doigt de Fer', icon: '🔨', type: 'click', mult: 1.2, desc: 'Clics : +20 % d\'argent par clic (en plus).', lore: 'Forgé par dix mille parties de baby-foot.' },
      { name: 'Coup du Patron', icon: '👊', type: 'crit', critChance: 0.25, critMult: 5, desc: 'Critiques : 25 % de tes clics rapportent ×5.', lore: 'Quand le patron tape, tout le monde paie.' },
    ] },
    { id: 'auto', label: 'Auto-clic', angle: 72, nodes: [
      { name: 'Clope au Bec', icon: '🚬', type: 'auto', val: 1, desc: 'Auto-clic : 1 clic gratuit par seconde (tant que tu joues).', lore: 'Les mains dans les poches, le jeu tourne.' },
      { name: 'Tic Nerveux', icon: '⚡', type: 'auto', val: 2, desc: 'Auto-clic : 2 clics par seconde.', lore: 'Le doigt ne s\'arrête plus.' },
      { name: 'Cendrier Rotatif', icon: '🔄', type: 'auto', val: 4, desc: 'Auto-clic : 4 clics par seconde.', lore: 'Un engrenage qui récolte sans râler.' },
      { name: 'Machine à Clics', icon: '⚙️', type: 'auto', val: 8, desc: 'Auto-clic : 8 clics par seconde.', lore: 'Même le comptable a du mal à suivre.' },
      { name: 'Usine Stéphane 24/7', icon: '🏭', type: 'auto', val: 16, desc: 'Auto-clic : 16 clics par seconde.', lore: 'Ça tourne même quand il dort.' },
    ] },
    { id: 'rente', label: 'Revenu des cartes', angle: 144, nodes: [
      { name: 'Petit Loyer', icon: '🏠', type: 'passive', mult: 1.05, desc: 'Revenu des cartes : +5 %.', lore: 'Un studio au-dessus du bar.' },
      { name: 'Bail Commercial', icon: '📄', type: 'passive', mult: 1.07, desc: 'Revenu des cartes : +7 % (en plus).', lore: 'Neuf ans fermes, c\'est écrit.' },
      { name: 'Gérant Fiable', icon: '🧾', type: 'passive', mult: 1.10, desc: 'Revenu des cartes : +10 % (en plus).', lore: 'Il ne pique jamais dans la caisse. Presque.' },
      { name: 'Toucher de Midas', icon: '🪙', type: 'midas', passiveToClick: 0.02, desc: 'Chaque clic rapporte en plus 2 % de ton revenu par seconde.', lore: 'L\'or coule des doigts.' },
      { name: 'Empire Immobilier', icon: '🏛️', type: 'passive', mult: 1.15, desc: 'Revenu des cartes : +15 % (en plus).', lore: 'Trois bars, deux PMU, un kiosque.' },
    ] },
    { id: 'paquets', label: 'Paquets', angle: 216, nodes: [
      { name: 'Livreur Matinal', icon: '📦', type: 'pack', cooldown: 0.95, desc: 'Paquet gratuit : arrive 5 % plus vite.', lore: 'Il passe avant le café.' },
      { name: 'Bon Flair', icon: '👃', type: 'drop', dropRare: 1.15, desc: 'Paquets : 15 % de chances en plus de tomber sur des Rares.', lore: 'Tu sens les bonnes cartes à l\'odeur.' },
      { name: 'Garantie Raccourcie', icon: '🎫', type: 'drop', pityReduce: 3, desc: 'Paquets : la carte garantie arrive 3 paquets plus tôt.', lore: 'Le destin finit par céder.' },
      { name: 'Œil de Lynx', icon: '👁️', type: 'drop', dropEpic: 1.3, desc: 'Paquets : +30 % de chances d\'Épiques et de Légendaires.', lore: 'Il repère l\'éclat doré à travers l\'emballage.' },
      { name: 'Chasseur de Mythiques', icon: '🌟', type: 'drop', mythicMult: 2, desc: 'Paquets : les cartes Mythiques tombent 2 fois plus souvent.', lore: 'Une chance sur un million, mais deux fois plus souvent.' },
    ] },
    { id: 'rep', label: 'Réputation (XP)', angle: 288, nodes: [
      { name: 'Habitué du Comptoir', icon: '🍺', type: 'xp', mult: 1.04, desc: 'XP : +4 % sur tout (clics, paquets, parties).', lore: 'Le patron connaît ton prénom.' },
      { name: 'Joueur Régulier', icon: '🎲', type: 'xp', mult: 1.05, desc: 'XP : +5 % (en plus).', lore: 'Même table, même heure.' },
      { name: 'Pilier de Bar', icon: '🏆', type: 'xp', mult: 1.06, desc: 'XP : +6 % (en plus).', lore: 'Il était là avant les néons.' },
      { name: 'Mémoire des Anciens', icon: '📜', type: 'xp', mult: 1.08, desc: 'XP : +8 % (en plus).', lore: 'Il raconte les parties de 1987.' },
      { name: 'Sage du Comptoir', icon: '🦉', type: 'xp', mult: 1.10, desc: 'XP : +10 % (en plus).', lore: 'On vient le consulter avant de parier.' },
    ] },
  ];
  const BRIDGES = [
    { name: 'Pouce Mécanique', icon: '🤖', type: 'click', mult: 1.15, desc: 'Clics : +15 % d\'argent par clic (en plus).', lore: 'Le pouce et la machine, main dans la main.' },
    { name: 'Rente Automatique', icon: '💸', type: 'passive', mult: 1.10, desc: 'Revenu des cartes : +10 % (en plus).', lore: 'Le tiroir-caisse se remplit tout seul.' },
    { name: 'Livraison Rentable', icon: '🚚', type: 'pack', cooldown: 0.90, desc: 'Paquet gratuit : arrive 10 % plus vite (en plus).', lore: 'Un camion entier, garé en double file.' },
    { name: 'Bonne Étoile', icon: '⭐', type: 'drop', pityReduce: 4, desc: 'Paquets : la carte garantie arrive 4 paquets plus tôt (en plus).', lore: 'Même la poisse a une limite.' },
    { name: 'Comptoir Légendaire', icon: '🥇', type: 'xp', mult: 1.10, desc: 'XP : +10 % (en plus).', lore: 'Tout le monde parle de toi.' },
  ];
  const BR_COST = [1, 1, 2, 2, 3];
  const NODES = [];
  BRANCHES.forEach((br, bi) => br.nodes.forEach((n, k) => {
    NODES.push({ ...n, id: `${br.id}_${k + 1}`, branch: br.id, branchLabel: br.label, ring: k + 1, angle: br.angle, cost: BR_COST[k], prereqs: k === 0 ? [] : [`${br.id}_${k}`] });
  }));
  // Lien entre branches voisines : un talent du 3e anneau peut aussi s'atteindre depuis le 3e anneau de la branche d'à côté
  BRANCHES.forEach((br, bi) => { const nb = BRANCHES[(bi + 1) % BRANCHES.length]; NODES.find(n => n.id === `${br.id}_3`).prereqs.push(`${nb.id}_3`); NODES.find(n => n.id === `${nb.id}_3`).prereqs.push(`${br.id}_3`); });
  BRIDGES.forEach((n, i) => NODES.push({ ...n, id: `pont_${i + 1}`, branch: 'pont', branchLabel: 'Pont entre deux branches', ring: 6, angle: i * 72 + 36, cost: 3, need: 2,
    prereqs: [`${BRANCHES[i].id}_5`, `${BRANCHES[(i + 1) % 5].id}_5`] }));
  NODES.push({ id: 'roi', name: 'Roi du Cendrier', icon: '👑', branch: 'centre', branchLabel: 'Le sommet', ring: 0, angle: 0, cost: 6, type: 'apex', mult: 1.5, passiveMult: 1.5, critChance: 0.35, critMult: 6, need: 3,
    prereqs: BRIDGES.map((_, i) => `pont_${i + 1}`), desc: 'Clics ×1,5, revenu des cartes ×1,5 et 35 % de critiques à ×6. Demande 3 ponts sur 5.', lore: 'Stéphane n\'est plus le roi du cendrier. Il est l\'empereur.' });

  // Un talent est « atteignable » quand il a assez de prérequis forgés (1 pour une chaîne, tous pour un pont, 3 sur 5 pour le centre)
  const needOf = n => n.need || 1;

  let state = {
    pointsAvailable: 0,
    totalPointsEarned: 0,
    unlocked: {}, // { [nodeId]: true }
    selectedNodeId: 'clic_1',
    treeV: 2
  };

  let autoClickTimer = null;
  let lastTap = { id: null, t: 0 };

  function init() {
    loadState();
    syncPointsWithPlayer();
    startAutoClicker();
    if (typeof ClickerEngine !== 'undefined') { ClickerEngine.recalcPassive(); ClickerEngine.recalcClickPower(); }
    render();
  }

  function prestigePoints() {
    if (typeof Prestige === 'undefined' || !Prestige.counts) return 0;
    const c = Prestige.counts();
    return (c.or || 0) + (c.platine || 0) * 2;
  }

  function syncPointsWithPlayer() {
    let empireLevel = 1;
    if (typeof ClickerEngine !== 'undefined' && ClickerEngine.getState) {
      empireLevel = ClickerEngine.getState().empireLevel || 1;
    }
    // 1 point par niveau d'Empire + 1 point bonus tous les 5 niveaux (arbre complet = 66 points, vers le niveau 55)
    const deservedTotal = empireLevel + Math.floor(empireLevel / 5);
    if (state.totalPointsEarned > deservedTotal) {
      // Ancienne règle (7 points + 2 par niveau) : on rend les points et on recommence l'arbre
      state.unlocked = {};
      state.pointsAvailable = deservedTotal;
      state.totalPointsEarned = deservedTotal;
      saveState();
      if (typeof startAutoClicker === 'function') startAutoClicker();
      return;
    }
    if (deservedTotal > state.totalPointsEarned) {
      const diff = deservedTotal - state.totalPointsEarned;
      state.pointsAvailable += diff;
      state.totalPointsEarned = deservedTotal;
      saveState();
    }
  }

  const isNodeUnlocked = id => !!state.unlocked[id];
  const nodeById = id => NODES.find(n => n.id === id);

  // Un talent est accessible si assez de ses prérequis sont dans l'ensemble donné
  function metIn(node, set) {
    if (!node.prereqs || node.prereqs.length === 0) return true;
    const have = node.prereqs.filter(p => set[p]).length;
    return have >= (node.need === 2 ? node.prereqs.length : needOf(node));
  }
  const arePrereqsMet = node => metIn(node, state.unlocked);

  function canUnlock(node) {
    return !isNodeUnlocked(node.id) && arePrereqsMet(node) && state.pointsAvailable >= node.cost;
  }

  // Tous les talents forgés restent-ils reliés au bord de l'arbre ? (sert à refuser le retrait d'un talent dont d'autres dépendent)
  function allStillValid(set) {
    const valid = {}; let changed = true;
    while (changed) {
      changed = false;
      NODES.forEach(n => { if (set[n.id] && !valid[n.id] && metIn(n, valid)) { valid[n.id] = true; changed = true; } });
    }
    return Object.keys(set).every(id => !set[id] || valid[id]);
  }

  function say(msg, kind) { if (window.showToast) showToast(msg, kind); }
  function applyEffects() {
    startAutoClicker();
    if (typeof ClickerEngine !== 'undefined') { ClickerEngine.recalcPassive(); ClickerEngine.recalcClickPower(); }
    render();
  }

  function unlockNode(nodeId) {
    const node = nodeById(nodeId);
    if (!node) return;
    if (isNodeUnlocked(nodeId)) return;
    if (!arePrereqsMet(node)) {
      const names = node.prereqs.map(p => nodeById(p).name).join(' · ');
      return say(node.need === 2 ? `Il faut les deux : ${names}.` : node.need === 3 ? `Il faut 3 ponts sur 5.` : `Il faut d'abord : ${names}.`, 'warning');
    }
    if (state.pointsAvailable < node.cost) return say(`Il te faut ${node.cost} point${node.cost > 1 ? 's' : ''} de talent.`, 'error');
    state.pointsAvailable -= node.cost;
    state.unlocked[nodeId] = true;
    state.selectedNodeId = nodeId;
    saveState();
    if (window.SoundFX) { if (SoundFX.win) SoundFX.win(); else if (SoundFX.click) SoundFX.click(); }
    say(`Talent forgé : ${node.name}`, 'success');
    applyEffects();
  }

  // Retirer un talent rend ses points, tant qu'aucun autre talent forgé n'en dépend
  function lockNode(nodeId) {
    const node = nodeById(nodeId);
    if (!node || !isNodeUnlocked(nodeId)) return;
    const next = { ...state.unlocked }; delete next[nodeId];
    if (!allStillValid(next)) return say('Impossible : d\'autres talents forgés en dépendent.', 'warning');
    state.unlocked = next;
    state.pointsAvailable += node.cost;
    state.selectedNodeId = nodeId;
    saveState();
    if (window.SoundFX && SoundFX.click) SoundFX.click();
    say(`${node.name} retiré : ${node.cost} point${node.cost > 1 ? 's' : ''} rendu${node.cost > 1 ? 's' : ''}.`, 'info');
    applyEffects();
  }

  function reset() {
    const refund = Object.keys(state.unlocked).reduce((a, id) => a + (state.unlocked[id] && nodeById(id) ? nodeById(id).cost : 0), 0);
    state.unlocked = {};
    state.pointsAvailable += refund;
    saveState();
    applyEffects();
    say('Talents réinitialisés : tous tes points sont rendus.', 'info');
  }

  function startAutoClicker() {
    if (autoClickTimer) {
      clearInterval(autoClickTimer);
      autoClickTimer = null;
    }

    const cps = getAutoClicksPerSec();
    if (cps <= 0) return;

    const intervalMs = Math.max(35, Math.floor(1000 / cps));
    autoClickTimer = setInterval(() => {
      // Ne pas compter si le navigateur/onglet est en arrière-plan ou minimisé
      if (document.hidden || document.visibilityState !== 'visible') return;
      // L'auto-clic tourne sur toutes les pages (casino, jeux, bourse…) tant que le joueur utilise la fenêtre (vérifié dans triggerClick)
      if (typeof ClickerEngine !== 'undefined' && ClickerEngine.triggerClick) {
        ClickerEngine.triggerClick(false);
      }
    }, intervalMs);
  }

  // ── Effets des talents forgés, lus par le reste du jeu ────────
  const active = fn => NODES.filter(n => isNodeUnlocked(n.id) && fn(n));
  const prod = (list, key) => list.reduce((m, n) => m * (n[key] || 1), 1);

  function getAutoClicksPerSec() { return active(n => n.type === 'auto').reduce((m, n) => Math.max(m, n.val), 0); }
  function getClickPowerMult() { return prod(active(n => n.type === 'click' || n.type === 'apex'), 'mult'); }
  function getXPMult() { return prod(active(n => n.type === 'xp'), 'mult'); }
  function getPassiveMultiplier() { return prod(active(n => n.type === 'passive'), 'mult') * prod(active(n => n.type === 'apex'), 'passiveMult'); }
  // Multiplicateur du délai des paquets gratuits (0,8 = 20 % plus rapide)
  function getFreePackCooldownMult() { return prod(active(n => n.type === 'pack'), 'cooldown'); }
  function getCritChance() { return active(n => n.critChance).reduce((m, n) => Math.max(m, n.critChance), 0.05); }
  function getCritMult() { return active(n => n.critMult).reduce((m, n) => Math.max(m, n.critMult), 2); }
  function getPassiveToClickRate() { return active(n => n.type === 'midas').reduce((m, n) => Math.max(m, n.passiveToClick), 0); }
  function getPityReduction() { return active(n => n.pityReduce).reduce((a, n) => a + n.pityReduce, 0); }
  function getMythicChanceMult() { return prod(active(n => n.mythicMult), 'mythicMult'); }
  function getFoilChanceBonus() { return 0; }
  // Modificateurs de tirage des paquets (utilisés par drawEmpirePack)
  function getDropMods() {
    return { rare: prod(active(n => n.dropRare), 'dropRare'), epic: prod(active(n => n.dropEpic), 'dropEpic'), mythic: getMythicChanceMult(), pity: getPityReduction() };
  }

  // Bilan : d'où vient chaque multiplicateur
  function summaryHtml() {
    const f = (n, d = 2) => Number(n).toFixed(d).replace('.', ',').replace(/,?0+$/, '');
    const lines = (list, fmt) => list.length ? list.map(n => `<li>${n.name} : ${fmt(n)}</li>`).join('') : '<li class="gow-none">Aucun talent forgé ici.</li>';
    const blocks = [
      ['Clics', `×${f(getClickPowerMult())}`, 'Tout ce qui multiplie l\'argent d\'un clic. Les bonus se multiplient entre eux.', active(n => n.type === 'click' || n.type === 'apex'), n => `×${f(n.mult)}`],
      ['Critiques', `${Math.round(getCritChance() * 100)} % de chances, gains ×${f(getCritMult(), 1)}`, 'Seul le meilleur critique compte, ils ne s\'additionnent pas. Sans talent : 5 % à ×2.', active(n => n.critChance), n => `${Math.round(n.critChance * 100)} % à ×${n.critMult}`],
      ['Auto-clic', `${getAutoClicksPerSec()} par seconde`, 'Seul le plus fort compte. Il ne tourne que quand tu es présent sur le jeu.', active(n => n.type === 'auto'), n => `${n.val} par seconde`],
      ['Revenu des cartes', `×${f(getPassiveMultiplier())}`, 'Multiplie l\'argent par seconde de tes cartes placées dans l\'Empire.', active(n => n.type === 'passive' || (n.type === 'apex')), n => `×${f(n.type === 'apex' ? n.passiveMult : n.mult)}`],
      ['Paquets', `gratuit toutes les ${f(10 * getFreePackCooldownMult(), 1)} min, garantie ${getPityReduction()} paquets plus tôt`, 'Délai du paquet gratuit, chances de rareté et garantie.', active(n => n.type === 'pack' || n.type === 'drop'), n => n.desc.replace(/^Paquets? ?(gratuit)? ?: ?/, '')],
      ['XP', `×${f(getXPMult())}`, 'Multiplie toute l\'XP gagnée (clics, paquets, parties) : tu montes de niveau plus vite, donc tu as plus de points.', active(n => n.type === 'xp'), n => `×${f(n.mult)}`],
    ];
    return blocks.map(([t, total, why, list, fmt]) => `<div class="help-block"><strong>${t} : ${total}</strong><p>${why}</p><ul class="help-list">${lines(list, fmt)}</ul></div>`).join('');
  }
  function openSummary() {
    const modal = document.getElementById('modal-overlay'), body = document.getElementById('modal-body');
    if (!modal || !body) return;
    body.innerHTML = `<h3 class="help-title">Ce que tes talents te donnent</h3>${summaryHtml()}
      <div class="help-block"><strong>Et les ×1,25, ×1,5, ×1,6 des cartes ?</strong><p>Ce sont les synergies de tes 3 cartes de clic (pas les talents). Elles sont détaillées dans l'aide « ? » à côté de ton compteur d'argent.</p></div>`;
    modal.classList.remove('hidden');
  }

  // ── Rendu : arbre en cercle, le meilleur talent est au CENTRE, les premiers sur le bord ──
  const ringRadius = ring => ring === 0 ? 0 : 0.43 - (ring - 1) * 0.065;
  function pos(node) {
    const th = node.angle * Math.PI / 180, R = ringRadius(node.ring);
    return { x: 50 + R * 100 * Math.sin(th), y: 50 - R * 100 * Math.cos(th) };
  }
  let scrollMemo = null;

  function render() {
    const container = document.getElementById('talents-content');
    if (!container) return;
    const oldScroll = container.querySelector('#gow-scroll');
    if (oldScroll) scrollMemo = { l: oldScroll.scrollLeft, t: oldScroll.scrollTop };

    syncPointsWithPlayer();

    const unlockedCount = Object.keys(state.unlocked).filter(k => state.unlocked[k]).length;
    const sel = nodeById(state.selectedNodeId) || NODES[0];
    const selOn = isNodeUnlocked(sel.id);
    const prereqNames = (sel.prereqs || []).map(p => nodeById(p).name);
    const reqText = !prereqNames.length ? 'Aucun prérequis : tu peux commencer par là.' : sel.need === 2 ? `Demande les deux : ${prereqNames.join(' et ')}.` : sel.need === 3 ? 'Demande 3 ponts sur 5.' : prereqNames.length > 1 ? `Demande l'un de : ${prereqNames.join(' ou ')}.` : `Demande : ${prereqNames[0]}.`;
    const hint = selOn ? 'Double-clic pour le retirer (points rendus)' : arePrereqsMet(sel) ? (state.pointsAvailable >= sel.cost ? 'Double-clic pour le forger' : `Il te manque ${sel.cost - state.pointsAvailable} point${sel.cost - state.pointsAvailable > 1 ? 's' : ''}`) : 'Verrouillé';

    container.innerHTML = `
      <div class="gow-tree-wrapper">
        <div class="gow-tree-top-bar">
          <div class="gow-unlocked-title">
            <span class="gow-pt-hilite">${unlockedCount}/${NODES.length}</span> talents · 1 point par niveau, +1 tous les 5 niveaux
          </div>
          <div class="gow-pts-badge-right">
            <strong>${state.pointsAvailable} pt${state.pointsAvailable > 1 ? 's' : ''}</strong>
            <button id="btn-gow-summary" class="btn-gow-reset" title="Voir d'où vient chaque bonus">Bilan</button>
            <button id="btn-gow-center" class="btn-gow-reset" title="Revenir au centre de l'arbre">Centre</button>
            <button id="btn-gow-reset" class="btn-gow-reset" title="Réinitialiser tous les talents">Réinitialiser</button>
          </div>
        </div>

        <div class="gow-tree-scroll" id="gow-scroll"><div class="gow-tree-board gow-radial">
          <svg class="gow-conduits-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gow-conduit-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ef4444"/>
                <stop offset="50%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#ef4444"/>
              </linearGradient>
              <filter id="gow-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.6" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
            </defs>
            ${[1, 2, 3, 4, 5, 6].map(r => `<circle cx="50" cy="50" r="${(ringRadius(r) * 100).toFixed(2)}" class="gow-ring" />`).join('')}
            ${links().map(([fromId, toId]) => {
              const f = nodeById(fromId), t = nodeById(toId), lit = isNodeUnlocked(fromId) && isNodeUnlocked(toId);
              const pf = pos(f), pt = pos(t);
              return `<line x1="${pf.x}" y1="${pf.y}" x2="${pt.x}" y2="${pt.y}" class="gow-line-channel" />${lit ? `<line x1="${pf.x}" y1="${pf.y}" x2="${pt.x}" y2="${pt.y}" class="gow-line-lit" />` : ''}`;
            }).join('')}
          </svg>

          <div class="gow-nodes-layer">
            ${NODES.map(node => {
              const on = isNodeUnlocked(node.id), reach = arePrereqsMet(node) && !on, afford = state.pointsAvailable >= node.cost;
              let cls = 'gow-node';
              if (on) cls += ' gow-node-unlocked'; else if (reach) cls += afford ? ' gow-node-ready' : ' gow-node-locked'; else cls += ' gow-node-disabled';
              if (node.id === state.selectedNodeId) cls += ' gow-node-selected';
              if (node.id === 'roi') cls += ' gow-node-king';
              const pp = pos(node);
              return `
                <div class="${cls}" style="left:${pp.x}%; top:${pp.y}%;" data-node-id="${node.id}">
                  ${on ? '<div class="gow-diamond-aura"></div>' : ''}
                  <div class="gow-diamond-outer"><div class="gow-diamond-inner"><div class="gow-diamond-icon">${node.icon}</div></div></div>
                  <div class="gow-cost">${on ? '✓' : node.cost}</div>
                </div>`;
            }).join('')}
          </div>
        </div></div>

        <div class="gow-inspector-panel">
          <div class="gow-inspector-left">
            <div class="gow-inspect-diamond ${selOn ? 'gow-inspect-unlocked' : ''}"><span>${sel.icon}</span></div>
          </div>
          <div class="gow-inspector-center">
            <div class="gow-inspect-tier">${sel.branch === 'centre' ? 'LE SOMMET' : sel.branch === 'pont' ? 'PONT ENTRE DEUX BRANCHES' : 'BRANCHE ' + sel.branchLabel.toUpperCase() + ' · ' + sel.ring + '/5'}</div>
            <h3 class="gow-inspect-title">${sel.name}</h3>
            <p class="gow-inspect-desc">${sel.desc}</p>
            <p class="gow-inspect-lore">${reqText}</p>
          </div>
          <div class="gow-inspector-right">
            <div class="gow-inspect-cost-label">${selOn ? '<span class="tag-unlocked-god">FORGÉ</span>' : `COÛT : <strong>${sel.cost} pt${sel.cost > 1 ? 's' : ''}</strong>`}</div>
            <div class="gow-hint">${hint}</div>
          </div>
        </div>
      </div>
    `;

    // Défilement : on garde la position, sinon on se place au centre (le talent ultime)
    const sc = container.querySelector('#gow-scroll');
    const center = () => { sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2; };
    if (sc) { if (scrollMemo) { sc.scrollLeft = scrollMemo.l; sc.scrollTop = scrollMemo.t; } else requestAnimationFrame(center); }
    container.querySelector('#btn-gow-center')?.addEventListener('click', () => sc && center());
    container.querySelector('#btn-gow-summary')?.addEventListener('click', openSummary);
    container.querySelector('#btn-gow-reset')?.addEventListener('click', async () => {
      const ok = typeof GameDialog !== 'undefined' ? await GameDialog.confirm('Retirer tous les talents et récupérer tes points ?', { title: 'Réinitialiser', ok: 'Réinitialiser', cancel: 'Non' }) : true;
      if (ok) reset();
    });

    container.querySelectorAll('.gow-node').forEach(el => {
      // Un clic : voir le talent. Double-clic (ou double tap) : le forger, ou le retirer s'il est déjà forgé.
      el.addEventListener('click', () => {
        const id = el.dataset.nodeId, now = Date.now();
        const second = lastTap.id === id && now - lastTap.t < 450;
        lastTap = { id, t: second ? 0 : now };
        state.selectedNodeId = id;
        if (second) { isNodeUnlocked(id) ? lockNode(id) : unlockNode(id); return; }
        render();
      });
    });
  }

  // Traits de l'arbre : chaque talent relié à ses prérequis
  function links() {
    const out = [];
    NODES.forEach(n => (n.prereqs || []).forEach(p => out.push([p, n.id])));
    return out;
  }

  function saveState() {
    localStorage.setItem('ashtray_talents_gow', JSON.stringify(state));
  }

  function loadState() {
    try {
      const saved = localStorage.getItem('ashtray_talents_gow');
      if (saved) {
        state = { ...state, ...JSON.parse(saved) };
        if (state.treeV !== 2) {
          // Nouvel arbre : les anciens talents n'existent plus, on rend tous les points
          state.unlocked = {};
          state.pointsAvailable = state.totalPointsEarned;
          state.selectedNodeId = 'clic_1';
          state.treeV = 2;
          saveState();
          setTimeout(() => say('L\'arbre de talents a été refait : tes points ont été rendus, refais ton arbre.', 'gold'), 2500);
        }
        if (!nodeById(state.selectedNodeId)) state.selectedNodeId = 'clic_1';
      }
    } catch (e) {
      console.error('Error loading talents state', e);
    }
  }

  return {
    init,
    render,
    unlockNode,
    lockNode,
    reset,
    getAutoClicksPerSec,
    getClickPowerMult,
    getCritChance,
    getCritMult,
    getPassiveToClickRate,
    getFoilChanceBonus,
    getPityReduction,
    getMythicChanceMult,
    getDropMods,
    getPassiveMultiplier,
    getXPMult,
    getFreePackCooldownMult,
    prestigePoints,
    syncPointsWithPlayer,
    openSummary,
    getState: () => ({ ...state }),
    getNodes: () => NODES
  };
})();
