// ============================================================
// THE ASHTRAY KING — Arbre de talents (en cercle : 5 branches, 5 ponts, le Roi du Cendrier au centre)
// ============================================================

const TalentsEngine = (() => {

  // ── L'arbre : 5 branches de 8 talents qui partent du bord vers le centre, reliées par 25 « ponts » (5 anneaux × 5 paires de branches voisines) ──
  // Chaque talent d'une branche demande le précédent. Un pont demande les DEUX talents voisins du même anneau (donc deux branches avancées à la même hauteur).
  // Le Roi du Cendrier, au centre, demande les 5 ponts du dernier anneau. Coûts : 1-1-1-2-2-2-3-3 par branche, ponts 1 / 1 / 2 / 3 / 4, Roi 8 = 138 points (≈ niveau 110).
  const BRANCHES = [
    { id: 'clic', label: 'Clics', angle: 0, nodes: [
      { name: 'Pouce Échauffé', icon: '👆', type: 'click', mult: 1.06, desc: 'Clics : +6 % d\'argent par clic.', lore: 'Il suffit de chauffer le pouce.' },
      { name: 'Pouce Calleux', icon: '💪', type: 'click', mult: 1.08, desc: 'Clics : +8 % d\'argent par clic (en plus).', lore: 'Plus rien ne le fait mal.' },
      { name: 'Coup Sec', icon: '💥', type: 'crit', critChance: 0.08, critMult: 2.5, desc: 'Critiques : 8 % de tes clics rapportent ×2,5 (au lieu de 5 % à ×2).', lore: 'Un clic, et le comptoir tremble.' },
      { name: 'Doigt de Fer', icon: '🔨', type: 'click', mult: 1.10, desc: 'Clics : +10 % d\'argent par clic (en plus).', lore: 'Forgé par dix mille parties de baby-foot.' },
      { name: 'Poignet Souple', icon: '🤚', type: 'click', mult: 1.12, desc: 'Clics : +12 % d\'argent par clic (en plus).', lore: 'Ça claque sans fatigue.' },
      { name: 'Coup du Patron', icon: '👊', type: 'crit', critChance: 0.15, critMult: 4, desc: 'Critiques : 15 % de tes clics rapportent ×4.', lore: 'Quand le patron tape, tout le monde paie.' },
      { name: 'Marteau-Pilon', icon: '⚒️', type: 'click', mult: 1.15, desc: 'Clics : +15 % d\'argent par clic (en plus).', lore: 'Le doigt de la presse hydraulique.' },
      { name: 'Main de Maître', icon: '🖐️', type: 'crit', critChance: 0.25, critMult: 5, desc: 'Critiques : 25 % de tes clics rapportent ×5.', lore: 'Même les anciens applaudissent.' },
    ] },
    { id: 'auto', label: 'Auto-clic', angle: 72, nodes: [
      { name: 'Clope au Bec', icon: '🚬', type: 'auto', val: 1, desc: 'Auto-clic : 1 clic gratuit par seconde (tant que tu joues).', lore: 'Les mains dans les poches, le jeu tourne.' },
      { name: 'Tic Nerveux', icon: '⚡', type: 'auto', val: 1.5, desc: 'Auto-clic : 1,5 clic par seconde.', lore: 'Le doigt ne s\'arrête plus.' },
      { name: 'Rythme de Croisière', icon: '🔄', type: 'auto', val: 2, desc: 'Auto-clic : 2 clics par seconde.', lore: 'Ni trop vite, ni trop lent.' },
      { name: 'Cendrier Rotatif', icon: '⚙️', type: 'auto', val: 3, desc: 'Auto-clic : 3 clics par seconde.', lore: 'Un engrenage qui récolte sans râler.' },
      { name: 'Moulin à Clics', icon: '🌀', type: 'auto', val: 4, desc: 'Auto-clic : 4 clics par seconde.', lore: 'Ça brasse du clic toute la journée.' },
      { name: 'Machine à Clics', icon: '🛠️', type: 'auto', val: 5, desc: 'Auto-clic : 5 clics par seconde.', lore: 'Même le comptable a du mal à suivre.' },
      { name: 'Chaîne de Montage', icon: '🏗️', type: 'auto', val: 7, desc: 'Auto-clic : 7 clics par seconde.', lore: 'Un clic, un autre, un autre...' },
      { name: 'Usine Stéphane 24/7', icon: '🏭', type: 'auto', val: 10, desc: 'Auto-clic : 10 clics par seconde.', lore: 'Ça tourne même quand il dort.' },
    ] },
    { id: 'rente', label: 'Revenu des cartes', angle: 144, nodes: [
      { name: 'Petit Loyer', icon: '🏠', type: 'passive', mult: 1.03, desc: 'Revenu des cartes : +3 %.', lore: 'Un studio au-dessus du bar.' },
      { name: 'Bail Commercial', icon: '📄', type: 'passive', mult: 1.03, desc: 'Revenu des cartes : +3 % (en plus).', lore: 'Neuf ans fermes, c\'est écrit.' },
      { name: 'Gérant Fiable', icon: '🧾', type: 'passive', mult: 1.04, desc: 'Revenu des cartes : +4 % (en plus).', lore: 'Il ne pique jamais dans la caisse. Presque.' },
      { name: 'Toucher de Midas', icon: '🪙', type: 'midas', passiveToClick: 0.02, desc: 'Chaque clic rapporte en plus 2 % de ton revenu par seconde.', lore: 'L\'or coule des doigts.' },
      { name: 'Sous-Location', icon: '🔑', type: 'passive', mult: 1.05, desc: 'Revenu des cartes : +5 % (en plus).', lore: 'Le locataire sous-loue au voisin.' },
      { name: 'Immeuble de Rapport', icon: '🏢', type: 'passive', mult: 1.06, desc: 'Revenu des cartes : +6 % (en plus).', lore: 'Quatre étages, zéro ascenseur.' },
      { name: 'Reconversion en Hôtel', icon: '🏨', type: 'passive', mult: 1.07, desc: 'Revenu des cartes : +7 % (en plus).', lore: 'Une étoile, mais on y croit.' },
      { name: 'Empire Immobilier', icon: '🏛️', type: 'passive', mult: 1.08, desc: 'Revenu des cartes : +8 % (en plus).', lore: 'Trois bars, deux PMU, un kiosque.' },
    ] },
    { id: 'paquets', label: 'Paquets', angle: 216, nodes: [
      { name: 'Livreur Matinal', icon: '📦', type: 'pack', cooldown: 0.97, desc: 'Paquet gratuit : arrive 3 % plus vite.', lore: 'Il passe avant le café.' },
      { name: 'Bon Flair', icon: '👃', type: 'drop', dropRare: 1.06, desc: 'Paquets : 6 % de chances en plus de tomber sur des Rares.', lore: 'Tu sens les bonnes cartes à l\'odeur.' },
      { name: 'Garantie Raccourcie', icon: '🎫', type: 'drop', pityReduce: 1, desc: 'Paquets : la carte garantie arrive 1 paquet plus tôt.', lore: 'Le destin finit par céder.' },
      { name: 'Œil de Lynx', icon: '👁️', type: 'drop', dropEpic: 1.10, desc: 'Paquets : +10 % de chances d\'Épiques et de Légendaires.', lore: 'Il repère l\'éclat doré à travers l\'emballage.' },
      { name: 'Tournée Prioritaire', icon: '🚐', type: 'pack', cooldown: 0.96, desc: 'Paquet gratuit : arrive 4 % plus vite (en plus).', lore: 'Le livreur connaît ton code d\'entrée.' },
      { name: 'Nez Creux', icon: '🐽', type: 'drop', dropRare: 1.08, desc: 'Paquets : 8 % de chances en plus de tomber sur des Rares (en plus).', lore: 'Un truffier de cartes.' },
      { name: 'Fin de Série', icon: '🏁', type: 'drop', pityReduce: 2, desc: 'Paquets : la carte garantie arrive 2 paquets plus tôt (en plus).', lore: 'Même la poisse a une limite.' },
      { name: 'Chasseur de Mythiques', icon: '🌟', type: 'drop', mythicMult: 1.8, desc: 'Paquets : les cartes Mythiques tombent 1,8 fois plus souvent.', lore: 'Une chance sur un million, mais presque deux fois plus souvent.' },
    ] },
    { id: 'rep', label: 'Réputation (XP)', angle: 288, nodes: [
      { name: 'Habitué du Comptoir', icon: '🍺', type: 'xp', mult: 1.02, desc: 'XP : +2 % sur tout (clics, paquets, parties, casino).', lore: 'Le patron connaît ton prénom.' },
      { name: 'Joueur Régulier', icon: '🎲', type: 'xp', mult: 1.03, desc: 'XP : +3 % (en plus).', lore: 'Même table, même heure.' },
      { name: 'Pilier de Bar', icon: '🏆', type: 'xp', mult: 1.03, desc: 'XP : +3 % (en plus).', lore: 'Il était là avant les néons.' },
      { name: 'Mémoire des Anciens', icon: '📜', type: 'xp', mult: 1.04, desc: 'XP : +4 % (en plus).', lore: 'Il raconte les parties de 1987.' },
      { name: 'Conteur Officiel', icon: '🎙️', type: 'xp', mult: 1.04, desc: 'XP : +4 % (en plus).', lore: 'On se tait quand il commence.' },
      { name: 'Figure du Quartier', icon: '🧔', type: 'xp', mult: 1.05, desc: 'XP : +5 % (en plus).', lore: 'Les enfants le montrent du doigt.' },
      { name: 'Voix du Comptoir', icon: '📣', type: 'xp', mult: 1.06, desc: 'XP : +6 % (en plus).', lore: 'Quand il parle, la télé baisse.' },
      { name: 'Sage du Comptoir', icon: '🦉', type: 'xp', mult: 1.08, desc: 'XP : +8 % (en plus).', lore: 'On vient le consulter avant de parier.' },
    ] },
  ];
  // 5 anneaux de ponts (1, 2, 3, 5, 7) × 5 paires de branches voisines : (clic, auto), (auto, rente), (rente, paquets), (paquets, rep), (rep, clic)
  // Les ponts des anneaux 1 et 2 sont bon marché : dès 3 à 5 points on mélange deux branches.
  const BRIDGES = [
    [ // clic + auto
      { name: 'Premier Réflexe', icon: '☝️', type: 'click', mult: 1.04, desc: 'Clics : +4 % d\'argent par clic (en plus).', lore: 'Le doigt commence à penser tout seul.' },
      { name: 'Doigts Entraînés', icon: '🎹', type: 'click', mult: 1.05, desc: 'Clics : +5 % d\'argent par clic (en plus).', lore: 'Des gammes de clics tous les matins.' },
      { name: 'Pouce Mécanique', icon: '🤖', type: 'click', mult: 1.08, desc: 'Clics : +8 % d\'argent par clic (en plus).', lore: 'Le pouce et la machine, main dans la main.' },
      { name: 'Clic en Chaîne', icon: '⛓️', type: 'click', mult: 1.10, desc: 'Clics : +10 % d\'argent par clic (en plus).', lore: 'Un clic en appelle un autre.' },
      { name: 'Réflexe Automatique', icon: '⚡', type: 'click', mult: 1.14, desc: 'Clics : +14 % d\'argent par clic (en plus).', lore: 'Le doigt part avant la tête.' } ],
    [ // auto + rente
      { name: 'Petite Rente', icon: '🪙', type: 'passive', mult: 1.02, desc: 'Revenu des cartes : +2 % (en plus).', lore: 'Quelques pièces qui rentrent sans rien faire.' },
      { name: 'Compte en Banque', icon: '🏦', type: 'passive', mult: 1.03, desc: 'Revenu des cartes : +3 % (en plus).', lore: 'Un vrai compte, avec un vrai conseiller.' },
      { name: 'Rente Automatique', icon: '💸', type: 'passive', mult: 1.03, desc: 'Revenu des cartes : +3 % (en plus).', lore: 'Le tiroir-caisse se remplit tout seul.' },
      { name: 'Loyers Indexés', icon: '📈', type: 'passive', mult: 1.04, desc: 'Revenu des cartes : +4 % (en plus).', lore: 'Ça monte tous les ans, c\'est la loi.' },
      { name: 'Caisse Enregistreuse', icon: '🧮', type: 'passive', mult: 1.06, desc: 'Revenu des cartes : +6 % (en plus).', lore: 'Elle ne dort jamais non plus.' } ],
    [ // rente + paquets
      { name: 'Petit Colis', icon: '📬', type: 'pack', cooldown: 0.98, desc: 'Paquet gratuit : arrive 2 % plus vite (en plus).', lore: 'Une enveloppe glissée sous la porte.' },
      { name: 'Tournée Régulière', icon: '🛵', type: 'pack', cooldown: 0.98, desc: 'Paquet gratuit : arrive 2 % plus vite (en plus).', lore: 'Il passe à heure fixe, enfin presque.' },
      { name: 'Grossiste Fidèle', icon: '🚚', type: 'pack', cooldown: 0.97, desc: 'Paquet gratuit : arrive 3 % plus vite (en plus).', lore: 'Il te réserve les meilleurs cartons.' },
      { name: 'Camion Prioritaire', icon: '🚛', type: 'pack', cooldown: 0.96, desc: 'Paquet gratuit : arrive 4 % plus vite (en plus).', lore: 'Un camion entier, garé en double file.' },
      { name: 'Dépôt Personnel', icon: '🏪', type: 'pack', cooldown: 0.94, desc: 'Paquet gratuit : arrive 6 % plus vite (en plus).', lore: 'Plus besoin d\'attendre le livreur.' } ],
    [ // paquets + rep
      { name: 'Premier Souhait', icon: '🕯️', type: 'drop', pityReduce: 1, desc: 'Paquets : la carte garantie arrive 1 paquet plus tôt (en plus).', lore: 'Une bougie, un vœu, une carte.' },
      { name: 'Nez Fin', icon: '🧐', type: 'drop', dropRare: 1.05, desc: 'Paquets : 5 % de chances en plus de tomber sur des Rares (en plus).', lore: 'Le patron sent les bons coups.' },
      { name: 'Bonne Étoile', icon: '⭐', type: 'drop', pityReduce: 2, desc: 'Paquets : la carte garantie arrive 2 paquets plus tôt (en plus).', lore: 'Tout le quartier te veut du bien.' },
      { name: 'Chance du Quartier', icon: '🍀', type: 'drop', dropEpic: 1.12, desc: 'Paquets : +12 % de chances d\'Épiques et de Légendaires (en plus).', lore: 'Les voisins gardent leurs meilleures cartes pour toi.' },
      { name: 'Étoile Filante', icon: '🌠', type: 'drop', mythicMult: 1.3, desc: 'Paquets : les cartes Mythiques tombent 1,3 fois plus souvent (en plus).', lore: 'Fais un vœu, il y a du monde.' } ],
    [ // rep + clic
      { name: 'Bon Début', icon: '🌱', type: 'xp', mult: 1.02, desc: 'XP : +2 % (en plus).', lore: 'On te salue en entrant.' },
      { name: 'Réputation Naissante', icon: '🗣️', type: 'xp', mult: 1.03, desc: 'XP : +3 % (en plus).', lore: 'Les clients commencent à parler de toi.' },
      { name: 'Cérémonie de Comptoir', icon: '🎖️', type: 'xp', mult: 1.04, desc: 'XP : +4 % (en plus).', lore: 'On t\'a remis une médaille en carton.' },
      { name: 'Légende Locale', icon: '📰', type: 'xp', mult: 1.05, desc: 'XP : +5 % (en plus).', lore: 'Ton nom est dans le journal du quartier.' },
      { name: 'Panthéon du Bar', icon: '🥇', type: 'xp', mult: 1.07, desc: 'XP : +7 % (en plus).', lore: 'Ta photo, au-dessus du flipper.' } ],
  ];
  const BR_COST = [1, 1, 1, 2, 2, 2, 3, 3], BRIDGE_RINGS = [1, 2, 3, 5, 7], BRIDGE_COST = [1, 1, 2, 3, 4];
  const NODES = [];
  BRANCHES.forEach((br) => br.nodes.forEach((n, k) => {
    NODES.push({ ...n, id: `${br.id}_${k + 1}`, branch: br.id, branchLabel: br.label, ring: k + 1, angle: br.angle, cost: BR_COST[k], prereqs: k === 0 ? [] : [`${br.id}_${k}`] });
  }));
  BRIDGES.forEach((trio, i) => trio.forEach((n, j) => {
    const ring = BRIDGE_RINGS[j];
    NODES.push({ ...n, id: `pont_${ring}_${i + 1}`, branch: 'pont', branchLabel: 'Pont entre deux branches', ring, angle: i * 72 + 36, cost: BRIDGE_COST[j], need: 2,
      prereqs: [`${BRANCHES[i].id}_${ring}`, `${BRANCHES[(i + 1) % 5].id}_${ring}`] });
  }));
  NODES.push({ id: 'roi', name: 'Roi du Cendrier', icon: '👑', branch: 'centre', branchLabel: 'Le sommet', ring: 0, angle: 0, cost: 8, type: 'apex', mult: 2.2, passiveMult: 1.5, critChance: 0.4, critMult: 6, need: 5,
    prereqs: [1, 2, 3, 4, 5].map(i => `pont_7_${i}`), desc: 'Clics ×2,2, revenu des cartes ×1,5 et 40 % de critiques à ×6. Demande les 5 ponts du dernier anneau.', lore: 'Stéphane n\'est plus le roi du cendrier. Il est l\'empereur.' });

  // Un talent est « atteignable » quand il a assez de prérequis forgés (1 pour une chaîne, les 2 bouts pour un pont, les 5 ponts pour le centre)
  const needOf = n => n.need || 1;

  let state = {
    pointsAvailable: 0,
    totalPointsEarned: 0,
    unlocked: {}, // { [nodeId]: true }
    selectedNodeId: 'clic_1',
    treeV: 3,
    lastRespec: 0           // dernier retrait de talent / réinitialisation (1 par 24 h : sinon on change de branche à volonté selon ce qu'on fait)
  };
  const RESPEC_MS = 24 * 3600 * 1000;
  const respecWait = () => Math.max(0, (state.lastRespec || 0) + RESPEC_MS - Date.now());
  const waitText = ms => { const h = Math.floor(ms / 3600000), m = Math.ceil((ms % 3600000) / 60000); return (h ? h + ' h ' : '') + m + ' min'; };

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
    return have >= (needOf(node));
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
      return say(node.need === 2 ? `Il faut les deux : ${names}.` : node.need === 5 ? `Il faut les 5 ponts.` : `Il faut d'abord : ${names}.`, 'warning');
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
    if (respecWait() > 0) return say(`Un seul retrait de talent par jour : encore ${waitText(respecWait())}.`, 'warning');
    const next = { ...state.unlocked }; delete next[nodeId];
    if (!allStillValid(next)) return say('Impossible : d\'autres talents forgés en dépendent.', 'warning');
    state.unlocked = next;
    state.pointsAvailable += node.cost;
    state.lastRespec = Date.now();
    state.selectedNodeId = nodeId;
    saveState();
    if (window.SoundFX && SoundFX.click) SoundFX.click();
    say(`${node.name} retiré : ${node.cost} point${node.cost > 1 ? 's' : ''} rendu${node.cost > 1 ? 's' : ''}.`, 'info');
    applyEffects();
  }

  function reset() {
    if (respecWait() > 0) return say(`Un seul retrait de talent par jour : encore ${waitText(respecWait())}.`, 'warning');
    const refund = Object.keys(state.unlocked).reduce((a, id) => a + (state.unlocked[id] && nodeById(id) ? nodeById(id).cost : 0), 0);
    state.unlocked = {};
    state.pointsAvailable += refund;
    if (refund > 0) state.lastRespec = Date.now();
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

    // L'auto-clic compte le TEMPS écoulé (cps × secondes) au lieu de « 1 clic par tick » : quand le téléphone est occupé (5 doigts qui spamment),
    // les ticks arrivent en retard ou sont sautés, et l'auto-clic « s'arrêtait ». Là, il rattrape (jusqu'à 2 s de retard).
    let last = performance.now(), carry = 0;
    autoClickTimer = setInterval(() => {
      const now = performance.now(), dt = Math.min(2000, now - last); last = now;
      // Ne pas compter si le navigateur/onglet est en arrière-plan ou minimisé
      if (document.hidden || document.visibilityState !== 'visible') { carry = 0; return; }
      // L'auto-clic tourne sur toutes les pages (casino, jeux, bourse…) tant que le joueur utilise la fenêtre (vérifié dans triggerClick)
      carry += cps * dt / 1000;
      const n = Math.floor(carry);
      if (n > 0 && typeof ClickerEngine !== 'undefined' && ClickerEngine.triggerClick) { carry -= n; ClickerEngine.triggerClick(false, n); }
    }, 100);
  }

  // ── Effets des talents forgés, lus par le reste du jeu ────────
  // Les effets sont lus à CHAQUE clic : on les garde en mémoire jusqu'à ce que l'arbre change (saveState / loadState vident `memo`)
  let memo = {}, version = 0;
  const memoized = (key, compute) => () => (key in memo ? memo[key] : (memo[key] = compute()));
  const active = fn => NODES.filter(n => isNodeUnlocked(n.id) && fn(n));
  const prod = (list, key) => list.reduce((m, n) => m * (n[key] || 1), 1);

  function getAutoClicksPerSec_() { return active(n => n.type === 'auto').reduce((m, n) => Math.max(m, n.val), 0); }
  function getClickPowerMult_() { return prod(active(n => n.type === 'click' || n.type === 'apex'), 'mult'); }
  function getXPMult_() { return prod(active(n => n.type === 'xp'), 'mult'); }
  function getPassiveMultiplier_() { return prod(active(n => n.type === 'passive'), 'mult') * prod(active(n => n.type === 'apex'), 'passiveMult'); }
  // Multiplicateur du délai des paquets gratuits (0,8 = 20 % plus rapide)
  function getFreePackCooldownMult_() { return prod(active(n => n.type === 'pack'), 'cooldown'); }
  function getCritChance_() { return active(n => n.critChance).reduce((m, n) => Math.max(m, n.critChance), 0.05); }
  function getCritMult_() { return active(n => n.critMult).reduce((m, n) => Math.max(m, n.critMult), 2); }
  function getPassiveToClickRate_() { return active(n => n.type === 'midas').reduce((m, n) => Math.max(m, n.passiveToClick), 0); }
  function getPityReduction() { return active(n => n.pityReduce).reduce((a, n) => a + n.pityReduce, 0); }
  function getMythicChanceMult() { return prod(active(n => n.mythicMult), 'mythicMult'); }
  function getFoilChanceBonus() { return 0; }
  const getAutoClicksPerSec = memoized('auto', getAutoClicksPerSec_), getClickPowerMult = memoized('click', getClickPowerMult_), getXPMult = memoized('xp', getXPMult_),
    getPassiveMultiplier = memoized('passive', getPassiveMultiplier_), getCritChance = memoized('cc', getCritChance_), getCritMult = memoized('cm', getCritMult_),
    getPassiveToClickRate = memoized('midas', getPassiveToClickRate_), getFreePackCooldownMult = memoized('pack', getFreePackCooldownMult_);
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
  const ringRadius = ring => ring === 0 ? 0 : 0.45 - (ring - 1) * 0.0475;
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
    const reqText = !prereqNames.length ? 'Aucun prérequis : tu peux commencer par là.' : sel.need === 2 ? `Demande les deux : ${prereqNames.join(' et ')}.` : sel.need === 5 ? 'Demande les 5 ponts du dernier anneau.' : prereqNames.length > 1 ? `Demande l'un de : ${prereqNames.join(' ou ')}.` : `Demande : ${prereqNames[0]}.`;
    const hint = selOn ? (respecWait() > 0 ? `Retrait possible dans ${waitText(respecWait())}` : 'Double-clic pour le retirer (1 retrait par jour)') : arePrereqsMet(sel) ? (state.pointsAvailable >= sel.cost ? 'Double-clic pour le forger' : `Il te manque ${sel.cost - state.pointsAvailable} point${sel.cost - state.pointsAvailable > 1 ? 's' : ''}`) : 'Verrouillé';

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
            ${[1, 2, 3, 4, 5, 6, 7, 8].map(r => `<circle cx="50" cy="50" r="${(ringRadius(r) * 100).toFixed(2)}" class="gow-ring" />`).join('')}
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
            <div class="gow-inspect-tier">${sel.branch === 'centre' ? 'LE SOMMET' : sel.branch === 'pont' ? 'PONT ENTRE DEUX BRANCHES' : 'BRANCHE ' + sel.branchLabel.toUpperCase() + ' · ' + sel.ring + '/8'}</div>
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
    memo = {}; version++;
    localStorage.setItem('ashtray_talents_gow', JSON.stringify(state));
  }

  function loadState() {
    memo = {}; version++;
    try {
      const saved = localStorage.getItem('ashtray_talents_gow');
      if (saved) {
        const parsed = JSON.parse(saved), old = parsed.treeV !== 3;
        state = { ...state, ...parsed };
        // talents qui n'existent plus (ancien arbre) : retirés ; les points dépensés sont toujours recalculés = total gagné − talents forgés
        Object.keys(state.unlocked || {}).forEach(id => { if (!nodeById(id)) delete state.unlocked[id]; });
        if (old) state.unlocked = {};
        const spent = Object.keys(state.unlocked).reduce((a, id) => a + nodeById(id).cost, 0);
        const before = state.pointsAvailable;
        state.pointsAvailable = Math.max(0, state.totalPointsEarned - spent);
        state.treeV = 3; state.selectedNodeId = nodeById(state.selectedNodeId) ? state.selectedNodeId : 'clic_1';
        saveState();
        if (old || state.pointsAvailable !== before) setTimeout(() => say('L\'arbre de talents a été refait : tes points sont rendus, refais ton arbre.', 'gold'), 2500);
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
    getVersion: () => version,
    getState: () => ({ ...state }),
    getNodes: () => NODES
  };
})();
