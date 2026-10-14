// ============================================================
// THE ASHTRAY KING — Master Data Layer (1200+ International Cigarettes & Pop-Art Engine)
// Authentic Global Brands, Comic Stickers, Zero Emojis, 3D TCG System
// ============================================================

// Global Deterministic RNG for daily markets & reproducible seeds
function seededRng(seed) {
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const RARITIES = {
  'commune':     { name: 'Commune',     color: '#b3a899', baseValue: 15,    energy: 15, cough: 28, dropOrder: 0, glow: 'rgba(179,168,153,0.4)' },
  'peu-commune': { name: 'Peu commune', color: '#22c55e', baseValue: 45,    energy: 22, cough: 24, dropOrder: 1, glow: 'rgba(34,197,94,0.5)' },
  'rare':        { name: 'Rare',        color: '#3b82f6', baseValue: 160,   energy: 30, cough: 20, dropOrder: 2, glow: 'rgba(59,130,246,0.6)' },
  'epique':      { name: 'Épique',      color: '#a855f7', baseValue: 650,   energy: 42, cough: 16, dropOrder: 3, glow: 'rgba(168,85,247,0.7)' },
  'legendaire':  { name: 'Légendaire',  color: '#f59e0b', baseValue: 3500,  energy: 55, cough: 12, dropOrder: 4, glow: 'rgba(245,158,11,0.8)' },
  'mythique':    { name: 'Mythique',    color: '#ef4444', baseValue: 20000, energy: 75, cough: 6,  dropOrder: 5, glow: 'rgba(239,68,68,0.95)' },
};

const SERIES = {
  'classiques':  { name: 'Les Classiques du Comptoir',  packs: ['tabac', 'duty'] },
  'terroirs':    { name: 'Brunes & Terroirs de France', packs: ['tabac', 'duty'] },
  'duty':        { name: 'Duty Free International',     packs: ['duty', 'contre'] },
  'annees80':    { name: 'Vintage 80s & Bolides F1',    packs: ['duty', 'contre'] },
  'underground': { name: 'Grands Cigares & Salons VIP', packs: ['duty', 'contre'] },
  'insolites':   { name: 'Bonbons & Bizarreries',       packs: ['tabac', 'saison'] },
  'beauf':       { name: 'Le Grand Cendrier Beauf WTF', packs: ['tabac', 'contre'] },
  'mythes':      { name: 'Les Reliques Célestes',       packs: ['contre', 'saison'] },
};

// ============================================================
// PACK ODDS & CONFIGS
// ============================================================
const PACK_TYPES = {
  tabac: {
    name: 'Tabac du Balto', price: 120, size: 5,
    odds: { commune: 0.65, 'peu-commune': 0.25, rare: 0.08, epique: 0.018, legendaire: 0.002, mythique: 0 },
    series: ['classiques', 'terroirs', 'insolites', 'beauf'],
    pityKey: 'tabac_epic', pityThreshold: 20, pityRarity: 'epique',
  },
  duty: {
    name: 'Duty Free Aéroport', price: 450, size: 5,
    odds: { commune: 0.35, 'peu-commune': 0.35, rare: 0.20, epique: 0.08, legendaire: 0.018, mythique: 0.002 },
    series: ['classiques', 'duty', 'annees80', 'underground'],
    pityKey: 'duty_legendary', pityThreshold: 15, pityRarity: 'legendaire',
  },
  contre: {
    name: 'Contrebande des Docks', price: 1250, size: 5,
    odds: { commune: 0.15, 'peu-commune': 0.25, rare: 0.32, epique: 0.18, legendaire: 0.08, mythique: 0.02 },
    series: ['duty', 'annees80', 'beauf', 'underground', 'mythes'],
    pityKey: 'contre_mythic', pityThreshold: 25, pityRarity: 'mythique',
  },
  saison: {
    name: 'Édition Spéciale Céleste', price: 900, size: 5,
    odds: { commune: 0, 'peu-commune': 0.10, rare: 0.55, epique: 0.28, legendaire: 0.06, mythique: 0.01 },
    series: ['insolites', 'beauf', 'mythes'],
    pityKey: null,
  },
};

// Track configs (Unchecked & Unlocked for sandbox testing)
const TRACKS = {
  trottoir: {
    name: 'Trottoir de Belleville', distance: 500, baseTime: 60, unlockLevel: 1, icon: '🚶',
    rewards: { or: 80, argent: 45, bronze: 25, rate: 10 },
    goldTime: 40, silverTime: 50, bronzeTime: 60,
    xp: { or: 140, argent: 90, bronze: 60, rate: 25 },
  },
  boulevard: {
    name: 'Boulevard Magenta', distance: 800, baseTime: 90, unlockLevel: 1, icon: '🚗',
    rewards: { or: 200, argent: 120, bronze: 70, rate: 15 },
    goldTime: 60, silverTime: 75, bronzeTime: 90,
    xp: { or: 300, argent: 200, bronze: 120, rate: 50 },
  },
  autoroute: {
    name: 'Périphérique Est 100%', distance: 1300, baseTime: 120, unlockLevel: 1, icon: '🛣️',
    rewards: { or: 550, argent: 320, bronze: 180, rate: 35 },
    goldTime: 85, silverTime: 105, bronzeTime: 125,
    xp: { or: 750, argent: 480, bronze: 300, rate: 100 },
  },
};

// Level XP curve
const LEVEL_XP = [];
for (let i = 1; i <= 100; i++) {
  LEVEL_XP.push(Math.floor(100 * Math.pow(1.14, i - 1)));
}

const LEVEL_TITLES = [
  { min: 1,  max: 5,  title: 'Mégoteur Débutant' },
  { min: 6,  max: 12, title: 'Fumeur de Comptoir' },
  { min: 13, max: 20, title: 'Chaîne-Fumeur du Balto' },
  { min: 21, max: 35, title: 'Baron de la Nicotine' },
  { min: 36, max: 50, title: 'Grand Maître du Briquet' },
  { min: 51, max: 999, title: 'Stéphane, Roi Suprême du Cendrier' },
];

function getLevelTitle(level) {
  const entry = LEVEL_TITLES.find(t => level >= t.min && level <= t.max);
  return entry ? entry.title : 'Roi du Cendrier';
}

function getTotalXPForLevel(level) {
  let total = 0;
  for (let i = 0; i < level - 1; i++) total += LEVEL_XP[i] || LEVEL_XP[LEVEL_XP.length-1];
  return total;
}

// ============================================================
// SKILL TREE DEFINITIONS (4 RPG Branches)
// ============================================================
const SKILL_TREE_BRANCHES = [
  {
    id: 'lung',
    name: "Poumon d'Acier",
    icon: '🫁',
    color: '#10b981',
    desc: 'Résistance extrême à la toux, endurance et survie sur le bitume.',
    skills: [
      { id: 'cough', name: 'Gorge en Zinc', icon: '🛡️', desc: '-10% toux générée par taffe', maxLevel: 5, cost: 1, effect: '-10% toux/lvl' },
      { id: 'recovery', name: 'Ventilation Turbo', icon: '💨', desc: '+20% récupération d\'énergie au repos', maxLevel: 4, cost: 1, effect: '+20% recup/lvl' },
      { id: 'souffle', name: 'Capacité Pulmonaire', icon: '🫁', desc: '+15 énergie max de départ en course', maxLevel: 5, cost: 2, effect: '+15 énergie/lvl' },
      { id: 'resurrection', name: 'Survie du Cendrier', icon: '⚡', desc: '1 fois par course, évite le KO de toux à 100% et restore 35% de souffle', maxLevel: 1, cost: 3, effect: 'Anti-mort active' }
    ]
  },
  {
    id: 'smoke',
    name: 'Fumeur du Bitume',
    icon: '⚡',
    color: '#f59e0b',
    desc: 'Vitesse de pointe, taffes explosives et propulsion au goudron.',
    skills: [
      { id: 'energy', name: 'Taffe de Fusée', icon: '🚀', desc: '+12% de boost d\'énergie à chaque cigarette allumée', maxLevel: 5, cost: 1, effect: '+12% boost/lvl' },
      { id: 'combustion', name: 'Sprint du Fennec', icon: '🔥', desc: '+2.5 km/h vitesse maximale de sprint', maxLevel: 4, cost: 2, effect: '+2.5 km/h/lvl' },
      { id: 'magnet', name: 'Aspiration de Billets', icon: '🧲', desc: 'Attire automatiquement les pièces et bonus en course', maxLevel: 2, cost: 2, effect: 'Rayon aimant' },
      { id: 'nitro_86', name: 'Combo Invincible 8.6', icon: '🍺', desc: 'Après 3 taffes parfaites, vitesse folle sans toux pendant 4s', maxLevel: 1, cost: 3, effect: 'Mode Berserk' }
    ]
  },
  {
    id: 'market',
    name: 'Buraliste & Contrebande',
    icon: '💰',
    color: '#3b82f6',
    desc: 'Économie, emplacements de cartes équipées et négoce clandestin.',
    skills: [
      { id: 'slots', name: 'Poches Cargo XXL', icon: '🎒', desc: '+1 emplacement cigarette équipée pour la course', maxLevel: 3, cost: 2, effect: '+1 slot équipé' },
      { id: 'market', name: 'Réseau de Vente', icon: '🏪', desc: '+1 vitrine de vente au marché du tabac', maxLevel: 4, cost: 1, effect: '+1 slot vente' },
      { id: 'recycle_bonus', name: 'Mégoteur Malin', icon: '♻️', desc: 'Recycler coûte 1 cigarette de moins', maxLevel: 2, cost: 2, effect: 'Recyclage réduit' },
      { id: 'bourse_insider', name: 'Délit d\'Initié', icon: '📈', desc: 'Prédit les hausses et krachs boursiers avec 90% de précision', maxLevel: 1, cost: 3, effect: 'Flair boursier' }
    ]
  },
  {
    id: 'karma',
    name: 'Karma du Cendrier & Gacha',
    icon: '🎰',
    color: '#a855f7',
    desc: 'Chance insolente dans les boosters, au PMU et aux jeux de hasard.',
    skills: [
      { id: 'lucky_gacha', name: 'Doigts d\'Or TCG', icon: '✨', desc: '+25% de probabilité de tirer des cartes Rares et Épiques', maxLevel: 4, cost: 2, effect: '+25% drop rare' },
      { id: 'pity_boost', name: 'Pity Express', icon: '🎯', desc: 'Réduit de 4 le nombre de paquets nécessaires pour la garantie Pity', maxLevel: 2, cost: 2, effect: '-4 paquets pity' },
      { id: 'casino_boost', name: 'Martingale du Balto', icon: '🎲', desc: '+8% de chances de victoire à la Roulette et Pile ou Face', maxLevel: 3, cost: 2, effect: '+8% chance casino' },
      { id: 'jackpot_celeste', name: 'Baraka Céleste', icon: '👑', desc: 'Gains financiers doublés sur tous les succès et courses or', maxLevel: 1, cost: 4, effect: 'Gains ×2' }
    ]
  }
];

const SKILLS_DEF = [];
SKILL_TREE_BRANCHES.forEach(branch => {
  branch.skills.forEach(s => {
    SKILLS_DEF.push({ ...s, branchId: branch.id });
  });
});

const COMBOS = {
  'fumee-parfaite': { name: 'Fumée Parfaite', icon: '✨', desc: 'Toux divisée par 2', trigger: 'green-zone' },
  'enchainement-2': { name: 'Enchaînement ×2', icon: '🔗', desc: 'Boost +30%', trigger: 'same-brand-x2' },
  'enchainement-3': { name: 'Enchaînement ×3', icon: '⛓️', desc: 'Boost +60%', trigger: 'same-brand-x3' },
  'montee-puissance':{ name: 'Montée en Puissance', icon: '📈', desc: '+20% énergie', trigger: 'ascending-rarity' },
  'chaine-parfaite': { name: 'Chaîne Céleste', icon: '🔥', desc: 'Vitesse max 4s sans aucune toux', trigger: 'triple-green' },
};

const GAME_CONST = {
  FREE_PACK_INTERVAL_MS: 8 * 60 * 1000,
  MAX_FREE_PACKS: 10,
  BASE_SPEED: 9,
  MAX_SPEED: 44,
  // Course : constantes utilisées par js/race.js (elles manquaient : énergie = NaN, course impossible à finir)
  ENERGY_DECAY_RATE: 5,     // énergie perdue par seconde
  COUGH_DECAY_RATE: 8,      // toux qui retombe par seconde
  SMOKE_ENERGY_GAIN: 25,    // énergie gagnée par sprint
  SMOKE_COUGH_BASE: 22,     // toux ajoutée par sprint
  ENERGY_DECAY: 0.28,
  COUGH_DECAY: 0.55,
  COUGH_THRESHOLD: 100,
  COUGH_BLOCK_MS: 3000,
  COUGH_RESET_TO: 35,
  MARKET_COMMISSION: 0.05,
  GAME_MARKET_SELL_RATIO: 0.75,
  GAME_MARKET_BUY_RATIO: 1.15,
  CASINO_MAX_BETS: 60,
  CASINO_UNLOCK_LEVEL: 1,
  MAX_DAILY_SOLO: 40,
  GOLD_STREAK_BONUS: 0.6,
  PRED_MULTIPLIER: 1.95,
  MAX_PREDICTIONS: 6,
  DUEL_COMMISSION: 0.05,
  MAX_DAILY_DUEL: 15,
  PRICE_VARIATION_CAP: 0.25,
};

if (typeof window !== 'undefined') window.GAME_CONST = GAME_CONST;

const CASINO_PILE_FACE = {
  commune:     { win: 0.49 },
  'peu-commune': { win: 0.47 },
  rare:        { win: 0.45 },
  epique:      { win: 0.43 },
  legendaire:  { win: 0.41 },
  mythique:    { win: 0.39 },
};

const CASINO_ROULETTE = [
  { id: 'prudent', name: 'Prudent (1 chance sur 2)', odds: 0.48, mult: 2,  icon: '🟢' },
  { id: 'risque',  name: 'Risqué (1 chance sur 5)',  odds: 0.20, mult: 5,  icon: '🟡' },
  { id: 'jackpot', name: 'Jackpot Cendrier (1/12)',  odds: 0.09, mult: 12, icon: '🔴' },
];

// ============================================================
// LOAD 1200+ CIGARETTES FROM DATABASE
// ============================================================
const CIGARETTES = (typeof CIGARETTES_DB !== 'undefined' && Array.isArray(CIGARETTES_DB) && CIGARETTES_DB.length > 0)
  ? CIGARETTES_DB
  : [
      {
        id: "marlboro-rouge",
        name: "Marlboro Rouge Chevron",
        rarity: "commune",
        series: "classiques",
        brand: "Marlboro",
        country: "US",
        filter: "cork", shaft: "white", ember: "red",
        desc: "Le paquet au chevron rouge légendaire.",
        speed: 18, endurance: 22, cough: 28,
        image: "assets/cig_marlboro.jpg", sound: "COWBOY!"
      }
    ];

if (typeof window !== 'undefined') window.CIGARETTES = CIGARETTES;

// Helper lookups
function getCigaretteById(id) {
  return CIGARETTES.find(c => c.id === id) || null;
}

function getCigarettesByRarity(rarity) {
  return CIGARETTES.filter(c => c.rarity === rarity);
}

function getCigarettesBySeries(seriesId) {
  return CIGARETTES.filter(c => c.series === seriesId);
}

function rarityColor(rarity) {
  return RARITIES[rarity]?.color || '#b3a899';
}

function fmt(n) {
  if (typeof n !== 'number' || isNaN(n)) n = 0;
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' €';
}

function getCigsForPack(packType) {
  const pack = PACK_TYPES[packType];
  if (!pack) return CIGARETTES;
  const filtered = CIGARETTES.filter(c => pack.series.includes(c.series));
  return filtered.length > 0 ? filtered : CIGARETTES;
}

function drawRarity(packType) {
  const pack = PACK_TYPES[packType];
  if (!pack) return 'commune';
  
  const odds = { ...pack.odds };
  const gachaBonus = (GameState.skills?.lucky_gacha || 0) * 0.05;
  if (gachaBonus > 0) {
    if (odds.rare) odds.rare += gachaBonus * 0.5;
    if (odds.epique) odds.epique += gachaBonus * 0.3;
    if (odds.legendaire) odds.legendaire += gachaBonus * 0.15;
    if (odds.mythique !== undefined && odds.mythique > 0) odds.mythique += gachaBonus * 0.05;
    if (odds.commune) odds.commune = Math.max(0.05, odds.commune - gachaBonus);
  }

  const r = Math.random();
  let cumul = 0;
  for (const [rarity, chance] of Object.entries(odds)) {
    cumul += chance;
    if (r < cumul) return rarity;
  }
  return 'commune';
}

function drawCigarette(packType, rarity) {
  let eligibles = getCigsForPack(packType).filter(c => c.rarity === rarity);
  if (!eligibles.length) {
    eligibles = CIGARETTES.filter(c => c.rarity === rarity);
  }
  if (!eligibles.length) return CIGARETTES[0];
  return eligibles[Math.floor(Math.random() * eligibles.length)];
}

// ============================================================
// SMART CIGARETTE IMAGE RESOLVER & HIGH-DEF TCG CARD ENGINE
// Maps brands directly to custom comic stickers or renders crisp TCG artwork
// ============================================================

function resolveCigaretteImage(cig) {
  if (!cig) return null;
  if (cig.image && cig.image.startsWith('assets/cards/')) return cig.image;
  if (cig.img && cig.img.startsWith('assets/cards/')) return cig.img;

  if (cig.image && (cig.image.startsWith('http://') || cig.image.startsWith('https://') || cig.image.startsWith('data:'))) {
    return cig.image;
  }
  if (cig.image && cig.image.startsWith('assets/stephane')) {
    return cig.image;
  }

  // Local WebP standard path with category prefix
  const cat = cig.cat || 'cigarette';
  const prefix = cat === 'cigarette' ? 'cig' : cat === 'alcool' ? 'alc' : cat === 'briquet' ? 'acc' : cat === 'beauf' ? 'ter' : cat === 'actrice' ? 'act' : cat === 'foot' ? 'fbl' : cat === 'refs' ? 'ref' : cat === 'chanteur' ? 'mus' : cat === 'culte' ? 'cul' : 'drg';
  return `assets/cards/${prefix}_${cig.id}.webp`;
}

// Global helper to get a random cigarette by rarity or any random cigarette
function getRandomCigarette(rarity = 'rare') {
  let list = getCigarettesByRarity(rarity);
  if (list && list.length > 0) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return CIGARETTES[Math.floor(Math.random() * CIGARETTES.length)] || CIGARETTES[0];
}
if (typeof window !== 'undefined') {
  window.getRandomCigarette = getRandomCigarette;
}

function generateCleanCigaretteSVG(cig) {
  const rColor = rarityColor(cig.rarity);
  const brand = (cig.brand || cig.name || 'CIG').slice(0, 10).toUpperCase();
  const filterType = cig.filter || 'cork';
  const shaftType = cig.shaft || 'white';
  const emberType = cig.ember || 'amber';
  const uid = Math.abs((cig.id || 'cig').split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0));

  // Realistic Filter Gradients
  let filtGrad1 = '#f59e0b', filtGrad2 = '#b45309', filtDot = '#78350f', isCork = true;
  if (filterType === 'gold') {
    filtGrad1 = '#fde047'; filtGrad2 = '#ca8a04'; filtDot = '#854d0e'; isCork = false;
  } else if (filterType === 'black' || filterType === 'charcoal') {
    filtGrad1 = '#514237'; filtGrad2 = '#271b12'; filtDot = '#110c08'; isCork = false;
  } else if (filterType === 'white') {
    filtGrad1 = '#f8fafc'; filtGrad2 = '#ded7ce'; filtDot = '#b3a899'; isCork = false;
  } else if (filterType === 'pink') {
    filtGrad1 = '#f472b6'; filtGrad2 = '#db2777'; filtDot = '#9d174d'; isCork = false;
  } else if (filterType === 'neon') {
    filtGrad1 = '#06b6d4'; filtGrad2 = '#a855f7'; filtDot = '#4c1d95'; isCork = false;
  } else if (filterType === 'wood') {
    filtGrad1 = '#92400e'; filtGrad2 = '#451a03'; filtDot = '#270c01'; isCork = false;
  } else if (filterType === 'none') {
    filtGrad1 = '#d97706'; filtGrad2 = '#78350f'; filtDot = '#451a03'; isCork = false;
  }

  // Realistic Shaft Gradients
  let shaftTop = '#ffffff', shaftMid = '#f8fafc', shaftBot = '#ded7ce';
  if (shaftType === 'black') {
    shaftTop = '#655a4b'; shaftMid = '#372b22'; shaftBot = '#271b12';
  } else if (shaftType === 'brown' || shaftType === 'sepia') {
    shaftTop = '#b45309'; shaftMid = '#78350f'; shaftBot = '#451a03';
  } else if (shaftType === 'yellow') {
    shaftTop = '#fef08a'; shaftMid = '#eab308'; shaftBot = '#ca8a04';
  } else if (shaftType === 'pink') {
    shaftTop = '#fce7f3'; shaftMid = '#f472b6'; shaftBot = '#db2777';
  }

  // Glowing Ember Gradients
  let emb1 = '#ffffff', emb2 = '#f59e0b', emb3 = '#ef4444';
  if (emberType === 'blue') {
    emb2 = '#38bdf8'; emb3 = '#2563eb';
  } else if (emberType === 'green') {
    emb2 = '#4ade80'; emb3 = '#16a34a';
  } else if (emberType === 'purple') {
    emb2 = '#c084fc'; emb3 = '#9333ea';
  }

  return `
    <svg class="cig-popart-sticker-svg" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Paper Shaft 3D Cylinder -->
        <linearGradient id="sh_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${shaftTop}" />
          <stop offset="30%" stop-color="${shaftTop}" />
          <stop offset="70%" stop-color="${shaftMid}" />
          <stop offset="100%" stop-color="${shaftBot}" />
        </linearGradient>

        <!-- Filter 3D Cylinder -->
        <linearGradient id="fl_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${filtGrad1}" />
          <stop offset="40%" stop-color="${filtGrad1}" />
          <stop offset="80%" stop-color="${filtGrad2}" />
          <stop offset="100%" stop-color="#261005" />
        </linearGradient>

        <!-- Ember Core Radial Glow (No Smoke) -->
        <radialGradient id="em_${uid}" cx="40%" cy="50%" r="60%">
          <stop offset="0%" stop-color="${emb1}" />
          <stop offset="35%" stop-color="${emb2}" />
          <stop offset="75%" stop-color="${emb3}" />
          <stop offset="100%" stop-color="#1b1918" />
        </radialGradient>

        <!-- Procedural Band Color -->
        <linearGradient id="band_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="hsl(${uid % 360}, 80%, 70%)" />
          <stop offset="50%" stop-color="hsl(${uid % 360}, 80%, 50%)" />
          <stop offset="100%" stop-color="hsl(${uid % 360}, 80%, 30%)" />
        </linearGradient>

        <!-- Metallic Gold Ring -->
        <linearGradient id="gold_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="50%" stop-color="#eab308" />
          <stop offset="100%" stop-color="#854d0e" />
        </linearGradient>

        <!-- Comic Halftone Pattern -->
        <pattern id="dotpat_${uid}" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#ffffff" opacity="0.3" />
        </pattern>
      </defs>

      <!-- THE 3D TILTED POP-ART CIGARETTE (ROTATED -32 DEGREES) -->
      <!-- Procedural scale and thickness based on UID -->
      <g transform="translate(145, 175) rotate(-32) scale(${0.85 + (uid % 30) / 100}, ${0.8 + (uid % 40) / 100})" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.65))">
        <!-- Die-Cut White Sticker Silhouette (Thick white sticker border) -->
        <g stroke="#ffffff" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
          <rect x="-95" y="-18" width="195" height="36" rx="6" fill="#ffffff" />
          <ellipse cx="-95" cy="0" rx="9" ry="18" fill="#ffffff" />
          <ellipse cx="100" cy="0" rx="9" ry="18" fill="#ffffff" />
        </g>

        <!-- Base Outer Ink Outline -->
        <!-- Filter Section with procedural length -->
        ${filterType !== 'none' ? `
          <rect x="-95" y="-17" width="${40 + (uid % 30)}" height="34" rx="4" fill="url(#fl_${uid})" stroke="#271b12" stroke-width="3.5" />
          <!-- Filter Flat Circular End -->
          <ellipse cx="-95" cy="0" rx="7" ry="17" fill="url(#fl_${uid})" stroke="#271b12" stroke-width="3.5" />
          ${isCork ? `
            <!-- Procedural Cork Specks -->
            <g fill="${filtDot}" opacity="0.45">
              <circle cx="-85" cy="-6" r="${1 + (uid%3)/10}" /><circle cx="-75" cy="4" r="${1.2 + (uid%5)/10}" />
              <circle cx="-65" cy="-8" r="${1.3}" /><circle cx="${-55 - (uid%10)}" cy="5" r="${1.5}" />
              <circle cx="-78" cy="10" r="1.4" /><circle cx="-62" cy="9" r="1.3" />
            </g>
          ` : ''}
          <!-- Procedural Separator Band (Gold or Colored) -->
          <rect x="${-55 + (uid % 30)}" y="-17" width="${3 + (uid % 8)}" height="34" fill="${(uid % 2 === 0) ? `url(#gold_${uid})` : `url(#band_${uid})`}" stroke="#271b12" stroke-width="2.5" />
        ` : `
          <!-- No Filter End -->
          <ellipse cx="-95" cy="0" rx="7" ry="17" fill="#ded7ce" stroke="#271b12" stroke-width="3.5" />
        `}

        <!-- Main Paper Shaft -->
        <!-- Procedural length adjustments based on filter size -->
        <rect x="${filterType !== 'none' ? -55 + (uid % 30) : -95}" y="-17" 
              width="${filterType !== 'none' ? 153 - (uid % 30) : 193}" height="34" rx="3"
              fill="url(#sh_${uid})" stroke="#271b12" stroke-width="3.5" />

        <!-- Procedural Burn Marks or Stains (Randomly appearing based on UID) -->
        ${(uid % 5 === 0) ? `<circle cx="${20 + (uid % 50)}" cy="-5" r="${2 + (uid % 4)}" fill="#78350f" opacity="0.3" />` : ''}
        ${(uid % 7 === 0) ? `<path d="M ${-10 + (uid%40)},-17 Q ${-5 + (uid%40)},-5 ${-10 + (uid%40)},17" fill="none" stroke="#78350f" stroke-width="1.5" opacity="0.4" />` : ''}

        <!-- 3D Cel-Shading: Top Gloss Highlight -->
        <rect x="${filterType !== 'none' ? -54 + (uid % 30) : -94}" y="-16" 
              width="${filterType !== 'none' ? 151 - (uid % 30) : 191}" height="6" rx="2"
              fill="#ffffff" opacity="0.65" />

        <!-- 3D Cel-Shading: Bottom Dark Core -->
        <rect x="${filterType !== 'none' ? -54 + (uid % 30) : -94}" y="7" 
              width="${filterType !== 'none' ? 151 - (uid % 30) : 191}" height="9" rx="2"
              fill="#271b12" opacity="0.14" />

        <!-- Procedural Rolled Paper Lines -->
        <g stroke="rgba(0,0,0,0.08)" stroke-width="1.2">
          ${[...Array(3 + (uid % 3))].map((_, i) => `<line x1="${-15 + i*25 + (uid%10)}" y1="-17" x2="${-15 + i*25 + (uid%10)}" y2="17" />`).join('')}
        </g>

        <!-- Brand Ribbon Crest with Procedural Placement and Color -->
        <g transform="translate(${-18 + (uid % 40) - 20}, -13)">
          <rect x="0" y="0" width="${40 + (uid % 30)}" height="26" rx="${uid % 8}" fill="${(uid % 4 === 0) ? rColor : `hsl(${(uid * 7) % 360}, 70%, 50%)`}" stroke="#271b12" stroke-width="2" />
          <text x="${(40 + (uid % 30))/2}" y="17" font-family="'Impact', 'Arial Black', sans-serif" font-size="${8 + (uid % 4)}" font-weight="900"
                fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${brand}</text>
        </g>

        <!-- Ash Core & Licking Cartoon Flame at Tip -->
        <g transform="translate(98, 0)">
          <!-- Carbon Ash Ring -->
          <ellipse cx="0" cy="0" rx="6" ry="17" fill="#1b1918" stroke="#271b12" stroke-width="3" />
          <!-- Glowing Ember Core -->
          <ellipse cx="2" cy="0" rx="5" ry="14" fill="url(#em_${uid})" />
          <ellipse cx="3" cy="0" rx="2.5" ry="8" fill="#ffffff" opacity="0.95" />

          <!-- Licking Cartoon Fire Tongue -->
          <path d="M 0,-14 Q 10,-20 14,-7 Q 16,-18 22,-5 Q 16,8 20,16 Q 8,18 0,13 Z"
                fill="#f59e0b" stroke="#271b12" stroke-width="2" />
          <path d="M 0,-8 Q 8,-12 11,-4 Q 12,-10 16,-2 Q 12,6 15,10 Q 6,12 0,7 Z"
                fill="#ef4444" />
        </g>
      </g>
    </svg>
  `;
}

// ============================================================
// CARTOON CIGARETTE RENDERER
// Renders the glorious collectible cigarette on inventory, modals, pack reveals
// ============================================================
function renderRealCigaretteHTML(cig, layout = 'card') {
  if (!cig) return '';
  const rColor = rarityColor(cig.rarity);
  const resolvedImg = resolveCigaretteImage(cig);

  // Visual Graphic: High-Quality Artwork image if available, otherwise Pop-Art Comic Sticker SVG
  const graphic = resolvedImg
    ? `<img src="${resolvedImg}" alt="${cig.name}" class="cig-cartoon-sticker-img" />`
    : generateCleanCigaretteSVG(cig);

  // 1. PACK REVEAL — La cigarette en grand, mode unboxing spotlight immersif (PAS DE CARTE !)
  if (layout === 'pack-reveal') {
    const rarityGlow = RARITIES[cig.rarity]?.glow || 'rgba(245,158,11,0.6)';
    const rarityName = RARITIES[cig.rarity]?.name || '';
    
    return `
      <div class="cig-reveal-spotlight rarity-${cig.rarity}" style="--r-color:${rColor};--r-glow:${rarityGlow}">
        <div class="reveal-spotlight-halo"></div>
        <div class="reveal-cig-standalone-float">
          ${resolvedImg 
            ? `<div class="reveal-cig-photo-unboxed-wrap">
                 <img src="${resolvedImg}" alt="${cig.name}" class="reveal-cig-photo-unboxed" />
               </div>`
            : generateCleanCigaretteSVG(cig)}
          <div class="reveal-cig-ember-pulse"></div>
        </div>
        <div class="reveal-smoke-particle p1"></div>
        <div class="reveal-smoke-particle p2"></div>
        <div class="reveal-smoke-particle p3"></div>
      </div>
    `;
  }

  // 2. SLOT (EQUIPPED IN RUNNER RACE)
  if (layout === 'slot') {
    return `
      <div class="cig-cartoon-slot-wrap rarity-${cig.rarity}" style="--r-color: ${rColor}" title="${cig.name}">
        <div class="slot-pack-mini">
          ${graphic}
        </div>
        <span class="cig-cartoon-slot-name">${cig.name.slice(0, 16)}</span>
      </div>
    `;
  }

  // 3. RECAP (SUMMARY AFTER PACK OPENING)
  if (layout === 'recap') {
    return `
      <div class="cig-cartoon-recap-wrap rarity-${cig.rarity}" style="--r-color: ${rColor}">
        <div class="cig-cartoon-recap-img-box">
          ${graphic}
        </div>
        <div class="cig-cartoon-recap-info">
          <span class="cig-recap-name">${cig.name}</span>
          <span class="badge-rarity rarity-${cig.rarity}">${RARITIES[cig.rarity]?.name || ''}</span>
        </div>
      </div>
    `;
  }

  // 4. DEFAULT 'CARD' (INVENTORY, MARKET, VITRINE, MODAL INSPECT)
  return `
    <div class="cig-cartoon-card-wrap rarity-${cig.rarity}" style="--r-color: ${rColor}">
      <div class="cig-cartoon-card-art">
        <div class="cig-art-holo-wrapper">
          ${graphic}
        </div>
        <div class="cig-cartoon-card-badge rarity-${cig.rarity}">${RARITIES[cig.rarity]?.name || ''}</div>
      </div>
      <div class="cig-cartoon-card-meta">
        <span class="cig-card-brand">${cig.name}</span>
        <div class="cig-card-substats">
          <span class="cig-stat-tag speed-tag">VIT +${cig.speed || RARITIES[cig.rarity]?.energy || 10}</span>
          <span class="cig-stat-tag cough-tag">TOUX -${cig.cough || RARITIES[cig.rarity]?.cough || 10}</span>
        </div>
      </div>
    </div>
  `;
}

