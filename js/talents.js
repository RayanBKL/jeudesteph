// ============================================================
// THE ASHTRAY KING — God of War Skill Tree (Arbre Runique)
// Constellation de Talents en Losanges Runiques & Canaux Sacrés
// ============================================================

const TalentsEngine = (() => {

  // Définition des 17 Nœuds Runiques du Panthéon
  const NODES = [
    // Tier 1 (Haut - 4 Nœuds Fondateurs)
    { id: 'colosse_1', name: 'Souffle Primordial', icon: '⚔️', banner: '⚒️', tier: 1, x: 16, y: 12, cost: 1, type: 'auto', val: 1, prereqs: [], desc: 'Allume la flamme sacrée : débloque l\'Auto-Cliqueur à 1 clic/s.', lore: 'La première bouffée gravée dans la pierre par Stéphane.' },
    { id: 'forge_1',   name: 'Pierre de Force',    icon: '🗼', banner: '⚒️', tier: 1, x: 38, y: 12, cost: 1, type: 'click', mult: 1.35, prereqs: [], desc: '+35% sur tous les gains des clics manuels.', lore: 'La forge spartiate durcit chaque frappe du pouce.' },
    { id: 'butin_1',   name: 'Sceau de Fortune',   icon: '👑', banner: '💍', tier: 1, x: 62, y: 12, cost: 1, type: 'drop', dropBoost: 1.25, prereqs: [], desc: '+25% de chances de trouver des cartes Rares dans les paquets.', lore: 'Le flair divin d\'un pilleur de cendriers célestes.' },
    { id: 'rage_1',    name: 'Fureur de Kratos',   icon: '🔥', banner: '⚔️', tier: 1, x: 84, y: 12, cost: 1, type: 'click', mult: 1.2, prereqs: [], desc: '+20% sur tous les gains des clics manuels.', lore: 'Une colère rougeoyante qui embrase les poumons.' },

    // Tier 2 (5 Nœuds - Croisement Runique)
    { id: 'colosse_2', name: 'Fournaise Perpétuelle', icon: '⚒️', banner: '⚒️', tier: 2, x: 12, y: 24, cost: 2, type: 'auto', val: 3, prereqs: ['colosse_1'], desc: 'Auto-clic accéléré à 3 clics automatiques par seconde.', lore: 'Le foyer brûle nuit et jour sans jamais faiblir.' },
    { id: 'forge_2',   name: 'Lames du Destin',    icon: '⚔️', banner: '⚔️', tier: 2, x: 31, y: 24, cost: 2, type: 'crit', critChance: 0.12, critMult: 3, prereqs: ['colosse_1', 'forge_1'], desc: 'Débloque 12% de Coups Critiques (gains multipliés par ×3 au clic).', lore: 'Des lames forgées dans le goudron des enfers.' },
    { id: 'centre_2',  name: 'Rune du Buraliste',  icon: '⚜️', banner: '🪙', tier: 2, x: 50, y: 24, cost: 2, type: 'market', prereqs: ['forge_1', 'butin_1'], desc: '+25% sur la valeur marchande de revente des doublons.', lore: 'Le tarif préférentiel des contrebandiers de haut vol.' },
    { id: 'butin_2',   name: 'Pity Accélérée',     icon: '🗼', banner: '💍', tier: 2, x: 69, y: 24, cost: 2, type: 'drop', pityReduce: 5, prereqs: ['butin_1', 'rage_1'], desc: 'Réduit de 5 boosters le quota pour déclencher la garantie Pity.', lore: 'Le destin s\'incline devant la ténacité du banni.' },
    { id: 'rage_2',    name: 'Sang d\'Acier',      icon: '🛡️', banner: '🗼', tier: 2, x: 88, y: 24, cost: 2, type: 'click', mult: 1.25, prereqs: ['rage_1'], desc: '+25% supplémentaires sur les gains des clics.', lore: 'Des bronches blindées capables de résister à la tempête.' },

    // Tier 3 (3 Nœuds Centraux)
    { id: 'colosse_3', name: 'Cendrier Rotatif',   icon: '⚡', banner: '🪙', tier: 3, x: 26, y: 36, cost: 3, type: 'auto', val: 8, prereqs: ['colosse_2', 'forge_2'], desc: 'Vitesse d\'auto-clic augmentée à 8 clics par seconde.', lore: 'Un engrenage infatigable qui récolte le magot sans arrêt.' },
    { id: 'centre_3',  name: 'L\'Œil Divin',       icon: '👁️', banner: '💍', tier: 3, x: 50, y: 36, cost: 3, type: 'drop', dropEpicBoost: 1.45, prereqs: ['forge_2', 'centre_2', 'butin_2'], desc: '+45% de chances d\'obtenir des cartes Épiques et Légendaires.', lore: 'La vision perçante pour déceler les reliques interdites.' },
    { id: 'forge_3',   name: 'Super Critique',     icon: '⚔️', banner: '🪙', tier: 3, x: 74, y: 36, cost: 3, type: 'crit', critChance: 0.25, critMult: 4.5, prereqs: ['centre_2', 'butin_2', 'rage_2'], desc: 'Chances de critique poussées à 25% (dégâts et gains ×4.5).', lore: 'Chaque impact résonne comme un coup de tonnerre.' },

    // Tier 4 (2 Nœuds Transcendants)
    { id: 'midas_4',   name: 'Toucher de Midas',   icon: '👑', banner: '🪙', tier: 4, x: 38, y: 48, cost: 4, type: 'midas', passiveToClick: 0.025, prereqs: ['colosse_3', 'centre_3'], desc: 'Chaque clic rapporte 2.5% de votre revenu passif par seconde en bonus brut !', lore: 'L\'or coule des doigts à chaque pression sur l\'écran.' },
    { id: 'foil_4',    name: 'Chasseur de Légendes', icon: '✨', banner: '💍', tier: 4, x: 62, y: 48, cost: 4, type: 'drop', dropBoost: 0.35, prereqs: ['centre_3', 'forge_3'], desc: '+35% de chance de trouver des cartes Rares, Épiques et Légendaires.', lore: 'Le reflet doré des cartes sacrées brille à travers le paquet.' },

    // Tier 5 (3 Nœuds Apex - Sommet Mythique)
    { id: 'apex_colosse', name: 'Usine Stéphane 24/7', icon: '🏛️', banner: '⚒️', tier: 5, x: 26, y: 59, cost: 5, type: 'auto', val: 25, prereqs: ['midas_4'], desc: 'Auto-clic colossal à 25 clics/s et active en permanence le bonus passif !', lore: 'L\'empire industriel absolu qui tourne même pendant votre sommeil.' },
    { id: 'apex_kratos',  name: 'Ragnarök du Cendrier', icon: '💀', banner: '⚔️', tier: 5, x: 50, y: 59, cost: 5, type: 'apex', mult: 2.2, critChance: 0.35, critMult: 6.0, prereqs: ['midas_4', 'foil_4'], desc: 'Multiplicateur général ×2.2 sur TOUS les gains et 35% de Critiques dévastateurs (×6.0) !', lore: 'La fureur mythologique qui terrasse les dieux du tabac.' },
    { id: 'apex_mythic',  name: 'L\'Œil d\'Odin Mythique', icon: '👁️', banner: '💍', tier: 5, x: 74, y: 59, cost: 5, type: 'drop', mythicMult: 3.0, prereqs: ['foil_4'], desc: 'Chance de cartes Mythiques multipliée par 3 dans tous les boosters du jeu !', lore: 'La bénédiction suprême des dieux anciens sur chaque tirage.' },
    // Tier 6-8 (Le Grand Œuvre : points gagnés aussi avec les prestiges Or et Platine)
    { id: 'passif_6', name: 'Comptoir Rentable', icon: '💰', banner: '🪙', tier: 6, x: 26, y: 70, cost: 2, type: 'passive', mult: 1.15, prereqs: ['apex_colosse', 'apex_kratos'], desc: '+15% sur tout le revenu passif de tes cartes.', lore: 'Le tiroir-caisse sonne même quand le patron fait la sieste.' },
    { id: 'clic_6',   name: 'Pouce d\'Acier',     icon: '👊', banner: '⚔️', tier: 6, x: 50, y: 70, cost: 2, type: 'click', mult: 1.3, prereqs: ['apex_kratos'], desc: '+30% sur les gains des clics manuels.', lore: 'Un pouce forgé par dix mille parties de baby-foot.' },
    { id: 'pack_6',   name: 'Livreur du Tabac',   icon: '📦', banner: '💍', tier: 6, x: 74, y: 70, cost: 2, type: 'pack', cooldown: 0.85, prereqs: ['apex_kratos', 'apex_mythic'], desc: 'Les paquets gratuits arrivent 15% plus vite.', lore: 'Le livreur passe deux fois par jour, et il connaît ton prénom.' },
    { id: 'passif_7', name: 'Empire Immobilier',  icon: '🏛️', banner: '🪙', tier: 7, x: 26, y: 83, cost: 3, type: 'passive', mult: 1.25, prereqs: ['passif_6'], desc: '+25% supplémentaires sur le revenu passif.', lore: 'Trois bars, deux PMU et un kiosque à journaux.' },
    { id: 'crit_7',   name: 'Coup du Patron',     icon: '💥', banner: '⚔️', tier: 7, x: 50, y: 83, cost: 3, type: 'crit', critChance: 0.4, critMult: 6, prereqs: ['clic_6'], desc: '40% de coups critiques, gains ×6.', lore: 'Quand le patron tape sur le comptoir, tout le monde paie.' },
    { id: 'pack_7',   name: 'Grossiste Agréé',    icon: '🚚', banner: '💍', tier: 7, x: 74, y: 83, cost: 3, type: 'pack', cooldown: 0.75, prereqs: ['pack_6'], desc: 'Les paquets gratuits arrivent 25% plus vite (au total).', lore: 'Un camion entier, garé en double file devant le tabac.' },
    { id: 'apex_8',   name: 'Empereur du Cendrier', icon: '👑', banner: '👑', tier: 8, x: 50, y: 95, cost: 5, type: 'passive', mult: 1.5, clickMult: 1.5, prereqs: ['passif_7', 'crit_7', 'pack_7'], desc: 'Revenu passif ×1,5 et clics ×1,5. Le sommet absolu.', lore: 'Stéphane n\'est plus roi du cendrier. Il est empereur.' },
  ];

  // Connexions entre les nœuds
  const CONDUITS = [
    ['colosse_1', 'colosse_2'],
    ['colosse_1', 'forge_2'],
    ['forge_1',   'forge_2'],
    ['forge_1',   'centre_2'],
    ['butin_1',   'centre_2'],
    ['butin_1',   'butin_2'],
    ['rage_1',    'butin_2'],
    ['rage_1',    'rage_2'],
    ['colosse_2', 'colosse_3'],
    ['forge_2',   'colosse_3'],
    ['forge_2',   'centre_3'],
    ['centre_2',  'centre_3'],
    ['butin_2',   'centre_3'],
    ['butin_2',   'forge_3'],
    ['rage_2',    'forge_3'],
    ['colosse_3', 'midas_4'],
    ['centre_3',  'midas_4'],
    ['centre_3',  'foil_4'],
    ['forge_3',   'foil_4'],
    ['midas_4',   'apex_colosse'],
    ['midas_4',   'apex_kratos'],
    ['foil_4',    'apex_kratos'],
    ['foil_4',    'apex_mythic'],
    ['apex_colosse', 'passif_6'], ['apex_kratos', 'passif_6'], ['apex_kratos', 'clic_6'], ['apex_kratos', 'pack_6'], ['apex_mythic', 'pack_6'],
    ['passif_6', 'passif_7'], ['clic_6', 'crit_7'], ['pack_6', 'pack_7'],
    ['passif_7', 'apex_8'], ['crit_7', 'apex_8'], ['pack_7', 'apex_8']
  ];

  let state = {
    pointsAvailable: 0,
    totalPointsEarned: 0,
    unlocked: {}, // { [nodeId]: true }
    selectedNodeId: 'colosse_1'
  };

  let autoClickTimer = null;

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

  function isNodeUnlocked(id) {
    return !!state.unlocked[id];
  }

  function arePrereqsMet(node) {
    if (!node.prereqs || node.prereqs.length === 0) return true;
    // Si au moins un prérequis direct est débloqué
    return node.prereqs.some(pId => isNodeUnlocked(pId));
  }

  function canUnlock(node) {
    if (isNodeUnlocked(node.id)) return false;
    if (!arePrereqsMet(node)) return false;
    return state.pointsAvailable >= node.cost;
  }

  function unlockNode(nodeId) {
    const node = NODES.find(n => n.id === nodeId);
    if (!node) return;

    if (isNodeUnlocked(nodeId)) {
      if (window.showToast) showToast('Rune déjà forgée et maîtrisée !', 'info');
      return;
    }

    if (!arePrereqsMet(node)) {
      if (window.showToast) showToast('Préréquis non atteints : forgez les runes précédentes !', 'warning');
      return;
    }

    if (state.pointsAvailable < node.cost) {
      if (window.showToast) showToast(`Il vous faut ${node.cost} Points de Talent !`, 'error');
      return;
    }

    state.pointsAvailable -= node.cost;
    state.unlocked[nodeId] = true;
    state.selectedNodeId = nodeId;
    saveState();

    if (window.SoundFX) {
      if (SoundFX.win) SoundFX.win();
      else if (SoundFX.click) SoundFX.click();
    }

    if (window.showToast) {
      showToast(`🔥 Rune Forgée : ${node.name} !`, 'success');
    }

    startAutoClicker();
    if (typeof ClickerEngine !== 'undefined') { ClickerEngine.recalcPassive(); ClickerEngine.recalcClickPower(); }
    render();
  }

  function reset() {
    let refund = 0;
    Object.keys(state.unlocked).forEach(nId => {
      if (state.unlocked[nId]) {
        const node = NODES.find(n => n.id === nId);
        if (node) refund += node.cost;
      }
    });

    state.unlocked = {};
    state.pointsAvailable += refund;
    saveState();
    startAutoClicker();
    if (typeof ClickerEngine !== 'undefined') { ClickerEngine.recalcPassive(); ClickerEngine.recalcClickPower(); }
    render();

    if (window.showToast) showToast('🔄 Talents réinitialisés ! Tous les points récupérés.', 'info');
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
      // 1. Ne pas compter si le navigateur/onglet est en arrière-plan ou minimisé
      if (document.hidden || document.visibilityState !== 'visible') return;

      // 2. Ne pas compter si le joueur est sur une autre page du jeu (Casino, Bourse, Paquets, etc.)
      const clickerPage = document.getElementById('page-clicker');
      if (!clickerPage || clickerPage.classList.contains('hidden') || clickerPage.style.display === 'none') {
        return;
      }

      if (typeof ClickerEngine !== 'undefined' && ClickerEngine.triggerClick) {
        ClickerEngine.triggerClick(false);
      }
    }, intervalMs);
  }

  // ── Getters Intégrés au Moteur de Jeu ────────────────────────
  function getAutoClicksPerSec() {
    let maxAuto = 0;
    NODES.filter(n => n.type === 'auto' && isNodeUnlocked(n.id)).forEach(n => {
      if (n.val > maxAuto) maxAuto = n.val;
    });
    return maxAuto;
  }

  function getClickPowerMult() {
    let mult = 1.0;
    NODES.filter(n => (n.type === 'click' || n.type === 'apex') && isNodeUnlocked(n.id)).forEach(n => {
      if (n.mult) mult *= n.mult;
    });
    NODES.filter(n => n.clickMult && isNodeUnlocked(n.id)).forEach(n => { mult *= n.clickMult; });
    return mult;
  }

  function getPassiveMultiplier() {
    let mult = 1.0;
    NODES.filter(n => n.type === 'passive' && isNodeUnlocked(n.id)).forEach(n => { mult *= n.mult; });
    return mult;
  }

  // Multiplicateur du délai des paquets gratuits (0,75 = 25 % plus rapide)
  function getFreePackCooldownMult() {
    let m = 1.0;
    NODES.filter(n => n.type === 'pack' && isNodeUnlocked(n.id)).forEach(n => { m = Math.min(m, n.cooldown); });
    return m;
  }

  function getCritChance() {
    let chance = 0.05; // Base 5%
    NODES.filter(n => (n.type === 'crit' || n.type === 'apex') && isNodeUnlocked(n.id)).forEach(n => {
      if (n.critChance && n.critChance > chance) chance = n.critChance;
    });
    return chance;
  }

  function getCritMult() {
    let mult = 2.0; // Base x2
    NODES.filter(n => (n.type === 'crit' || n.type === 'apex') && isNodeUnlocked(n.id)).forEach(n => {
      if (n.critMult && n.critMult > mult) mult = n.critMult;
    });
    return mult;
  }

  function getPassiveToClickRate() {
    return isNodeUnlocked('midas_4') ? 0.025 : 0.0;
  }

  function getFoilChanceBonus() {
    return isNodeUnlocked('foil_4') ? 0.22 : 0.0;
  }

  function getPityReduction() {
    return isNodeUnlocked('butin_2') ? 5 : 0;
  }

  function getMythicChanceMult() {
    return isNodeUnlocked('apex_mythic') ? 3.0 : 1.0;
  }

  // ── Rendu Visuel Style God of War ───────────────────────────
  function render() {
    const container = document.getElementById('talents-content');
    if (!container) return;

    syncPointsWithPlayer();

    const unlockedCount = Object.keys(state.unlocked).filter(k => state.unlocked[k]).length;
    const selectedNode = NODES.find(n => n.id === state.selectedNodeId) || NODES[0];
    const isSelectedUnlocked = isNodeUnlocked(selectedNode.id);
    const canUnlockSelected = canUnlock(selectedNode);

    container.innerHTML = `
      <div class="gow-tree-wrapper">
        <!-- God of War Banner Header (Identique au screenshot) -->
        <div class="gow-tree-top-bar">
          <div class="gow-unlocked-title">
            <span class="gow-pt-hilite">${unlockedCount}/${NODES.length}</span> talents · 1 point par niveau d'Empire, +1 bonus tous les 5 niveaux
          </div>
          <div class="gow-pts-badge-right">
            <span class="gow-orb-icon">⭐</span>
            <strong>${state.pointsAvailable} PT</strong> disponibles
            <button id="btn-gow-reset" class="btn-gow-reset" title="Réinitialiser tous les talents">🔄 Réinitialiser</button>
          </div>
        </div>

        <!-- The Grand Slate Tablet / Skill Tree Canvas -->
        <div class="gow-tree-board">
          <!-- Background SVG for Runic Energy Conduits -->
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

            ${CONDUITS.map(([fromId, toId]) => {
              const fromNode = NODES.find(n => n.id === fromId);
              const toNode = NODES.find(n => n.id === toId);
              if (!fromNode || !toNode) return '';
              const isConduitLit = isNodeUnlocked(fromId) && isNodeUnlocked(toId);

              return `
                <!-- Dark stone conduit channel -->
                <line x1="${fromNode.x}" y1="${fromNode.y}" x2="${toNode.x}" y2="${toNode.y}"
                      class="gow-line-channel" />
                <!-- Lit runic line if active -->
                ${isConduitLit ? `
                  <line x1="${fromNode.x}" y1="${fromNode.y}" x2="${toNode.x}" y2="${toNode.y}"
                        class="gow-line-lit" />
                ` : ''}
              `;
            }).join('')}
          </svg>

          <!-- 17 Runic Diamond Nodes -->
          <div class="gow-nodes-layer">
            ${NODES.map(node => {
              const isUnlocked = isNodeUnlocked(node.id);
              const isReachable = arePrereqsMet(node) && !isUnlocked;
              const isSelected = node.id === state.selectedNodeId;
              const canAfford = state.pointsAvailable >= node.cost;

              let nodeClass = 'gow-node';
              if (isUnlocked) nodeClass += ' gow-node-unlocked';
              else if (isReachable) nodeClass += canAfford ? ' gow-node-ready' : ' gow-node-locked';
              else nodeClass += ' gow-node-disabled';

              if (isSelected) nodeClass += ' gow-node-selected';

              return `
                <div class="${nodeClass}" style="left:${node.x}%; top:${node.y}%;" data-node-id="${node.id}">
                  <!-- Outer halo glow for unlocked nodes -->
                  ${isUnlocked ? '<div class="gow-diamond-aura"></div>' : ''}

                  <!-- The Tilted Runic Diamond (45deg) -->
                  <div class="gow-diamond-outer">
                    <div class="gow-diamond-inner">
                      <div class="gow-diamond-icon">${node.icon}</div>
                    </div>
                  </div>

                  <!-- Hanging Ribbon Banner (comme sur le screenshot) -->
                  <div class="gow-ribbon-banner">
                    <span class="gow-ribbon-tag">${isUnlocked ? '✓' : node.banner}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- God of War Inspector Card (Détail de la Rune sélectionnée) -->
        <div class="gow-inspector-panel">
          <div class="gow-inspector-left">
            <div class="gow-inspect-diamond ${isSelectedUnlocked ? 'gow-inspect-unlocked' : ''}">
              <span>${selectedNode.icon}</span>
            </div>
          </div>
          <div class="gow-inspector-center">
            <div class="gow-inspect-tier">TIER ${selectedNode.tier} · RUNE DU PANTHÉON</div>
            <h3 class="gow-inspect-title">${selectedNode.name}</h3>
            <p class="gow-inspect-desc">${selectedNode.desc}</p>
            <p class="gow-inspect-lore">« ${selectedNode.lore} »</p>
          </div>
          <div class="gow-inspector-right">
            <div class="gow-inspect-cost-label">
              ${isSelectedUnlocked ? '<span class="tag-unlocked-god">MAÎTRISÉ</span>' : `COÛT : <strong>${selectedNode.cost} PT</strong>`}
            </div>
            ${isSelectedUnlocked ? `
              <button class="btn-gow-action btn-gow-mastered" disabled>
                ✅ Rune Active
              </button>
            ` : `
              <button class="btn-gow-action btn-gow-forge" data-forge-id="${selectedNode.id}" ${!canUnlockSelected ? 'disabled' : ''}>
                ${canUnlockSelected ? `🔥 Forger (${selectedNode.cost} PT)` : (!arePrereqsMet(selectedNode) ? '🔒 Prérequis Manquant' : '⭐ Points Insuffisants')}
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    // Event listeners
    container.querySelector('#btn-gow-reset')?.addEventListener('click', reset);

    container.querySelectorAll('.gow-node').forEach(el => {
      el.addEventListener('click', () => {
        state.selectedNodeId = el.dataset.nodeId;
        render();
      });
    });

    container.querySelector('.btn-gow-forge')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.forgeId;
      if (id) unlockNode(id);
    });
  }

  function saveState() {
    localStorage.setItem('ashtray_talents_gow', JSON.stringify(state));
  }

  function loadState() {
    try {
      const saved = localStorage.getItem('ashtray_talents_gow');
      if (saved) {
        state = { ...state, ...JSON.parse(saved) };
      } else {
        // Migration depuis l'ancien arbre en 3 colonnes si existant
        const legacy = localStorage.getItem('ashtray_talents');
        if (legacy) {
          const l = JSON.parse(legacy);
          if (l.spent) {
            if (l.spent.auto >= 1) state.unlocked['colosse_1'] = true;
            if (l.spent.auto >= 2) state.unlocked['colosse_2'] = true;
            if (l.spent.auto >= 3) state.unlocked['colosse_3'] = true;
            if (l.spent.auto >= 4) state.unlocked['midas_4'] = true;
            if (l.spent.auto >= 5) state.unlocked['apex_colosse'] = true;

            if (l.spent.click >= 1) state.unlocked['forge_1'] = true;
            if (l.spent.click >= 2) state.unlocked['forge_2'] = true;
            if (l.spent.click >= 3) state.unlocked['forge_3'] = true;
            if (l.spent.click >= 5) state.unlocked['apex_kratos'] = true;

            if (l.spent.drop >= 1) state.unlocked['butin_1'] = true;
            if (l.spent.drop >= 2) state.unlocked['butin_2'] = true;
            if (l.spent.drop >= 3) state.unlocked['foil_4'] = true;
            if (l.spent.drop >= 5) state.unlocked['apex_mythic'] = true;
          }
          if (l.pointsAvailable !== undefined) state.pointsAvailable = l.pointsAvailable;
          if (l.totalPointsEarned !== undefined) state.totalPointsEarned = l.totalPointsEarned;
        }
      }
    } catch (e) {
      console.error('Error loading talents state', e);
    }
  }

  return {
    init,
    render,
    unlockNode,
    reset,
    getAutoClicksPerSec,
    getClickPowerMult,
    getCritChance,
    getCritMult,
    getPassiveToClickRate,
    getFoilChanceBonus,
    getPityReduction,
    getMythicChanceMult,
    getPassiveMultiplier,
    getFreePackCooldownMult,
    prestigePoints,
    syncPointsWithPlayer,
    getState: () => ({ ...state }),
    getNodes: () => NODES
  };
})();
