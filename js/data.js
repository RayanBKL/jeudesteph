// ============================================================
// STÉPHANE, LE ROI DU CENDRIER — Data Layer
// ============================================================

const RARITIES = {
  'commune':     { name: 'Commune',     color: '#94a3b8', baseValue: 5,     energy: 15, cough: 30, dropOrder: 0 },
  'peu-commune': { name: 'Peu commune', color: '#22c55e', baseValue: 15,    energy: 20, cough: 27, dropOrder: 1 },
  'rare':        { name: 'Rare',        color: '#3b82f6', baseValue: 60,    energy: 26, cough: 24, dropOrder: 2 },
  'epique':      { name: 'Épique',      color: '#9333ea', baseValue: 250,   energy: 33, cough: 20, dropOrder: 3 },
  'legendaire':  { name: 'Légendaire',  color: '#f59e0b', baseValue: 1500,  energy: 42, cough: 15, dropOrder: 4 },
  'mythique':    { name: 'Mythique',    color: '#e03030', baseValue: 10000, energy: 55, cough: 10, dropOrder: 5 },
};

const SERIES = {
  'classiques':   { name: 'Les Classiques du Quartier', packs: ['tabac', 'duty'] },
  'roulees':      { name: 'Les Roulées du Dimanche',    packs: ['tabac', 'duty'] },
  'duty':         { name: 'Duty Free Prestige',         packs: ['duty', 'contre'] },
  'annees80':     { name: 'Les Années 80',              packs: ['duty', 'contre'] },
  'docks':        { name: 'Contrebande des Docks',      packs: ['contre'] },
  'saisons':      { name: 'Les Saisons',                packs: ['saison'] },
  'mythes':       { name: 'Les Mythes du Cendrier',     packs: ['contre'] },
};

// All 36 cigarette brands
const CIGARETTES = [
  // === CLASSIQUES DU QUARTIER ===
  { id: 'marlbourg',        name: 'Marlbourg',         rarity: 'commune',     series: 'classiques', icon: '🚬', desc: "Le classique des brasseries, saveur 'bière froide' garantie." },
  { id: 'gauloisement',     name: 'Gauloisement',      rarity: 'commune',     series: 'classiques', icon: '🚬', desc: "Pour celui qui a résisté aux nazis mais pas au tabac." },
  { id: 'camelia-lights',   name: 'Camélia Lights',    rarity: 'commune',     series: 'classiques', icon: '🚬', desc: "'Light' comme une plume... de plomb." },
  { id: 'chesterfiel',      name: 'Chesterfiel',       rarity: 'peu-commune', series: 'classiques', icon: '🚬', desc: "Il manque un 'd' mais pas de nicotine." },
  { id: 'pall-mouille',     name: 'Pall Mouille',      rarity: 'peu-commune', series: 'classiques', icon: '🚬', desc: "Idéale par temps de pluie. Surtout ne pas mouiller." },
  { id: 'lucky-strick',     name: 'Lucky Strick',      rarity: 'rare',        series: 'classiques', icon: '🚬', desc: "La chance absolue, du moins c'est ce qu'ils disent." },

  // === ROULÉES DU DIMANCHE ===
  { id: 'rouli-roulant',    name: 'Rouli-Roulant',     rarity: 'commune',     series: 'roulees', icon: '🪄', desc: "Le dimanche matin, sur le pas de la porte." },
  { id: 'tabac-tonton',     name: 'Tabac de Tonton',   rarity: 'commune',     series: 'roulees', icon: '🪄', desc: "Héritage familial de tonton Bernard." },
  { id: 'petite-roulee',    name: 'La Petite Roulée',  rarity: 'peu-commune', series: 'roulees', icon: '🪄', desc: "Minuscule mais mortelle. Le bonsaï du tabac." },
  { id: 'bolduc-blonde',    name: 'Bolduc Blonde',     rarity: 'peu-commune', series: 'roulees', icon: '🪄', desc: "Attachée avec du fil de coton. Caractère affirmé." },
  { id: 'feuille-volante',  name: 'Feuille Volante',   rarity: 'rare',        series: 'roulees', icon: '🪄', desc: "S'envole au premier coup de vent. Collector." },

  // === DUTY FREE PRESTIGE ===
  { id: 'kenth-silver',     name: 'Kenth Silver',      rarity: 'peu-commune', series: 'duty', icon: '✈️', desc: "De l'aéroport de Genève, forcément." },
  { id: 'vogueur-slim',     name: 'Vogueur Slim',      rarity: 'rare',        series: 'duty', icon: '✈️', desc: "Aussi mince que son fumeur ne le sera plus." },
  { id: 'davidov-gold',     name: 'Davidov Gold',      rarity: 'rare',        series: 'duty', icon: '✈️', desc: "Le bon goût de la classe internationale." },
  { id: 'dunnhill-royale',  name: 'Dunnhill Royale',   rarity: 'epique',      series: 'duty', icon: '👑', desc: "Approuvée par les rois. Désapprouvée par les médecins." },
  { id: 'rothmens-imp',     name: 'Rothmens Impériale',rarity: 'epique',      series: 'duty', icon: '👑', desc: "L'empire du goût. L'empire de la toux aussi." },
  { id: 'philippe-mori',    name: 'Philippe Moricaud', rarity: 'epique',      series: 'duty', icon: '👑', desc: "Le nom évoque la France bourgeoise des années 70." },

  // === ANNÉES 80 ===
  { id: 'disco-menthol',    name: 'Disco Menthol',     rarity: 'rare',        series: 'annees80', icon: '🕺', desc: "Fresh comme le dancefloor de Studio 54." },
  { id: 'neon-lights',      name: 'Néon Lights',       rarity: 'rare',        series: 'annees80', icon: '🕺', desc: "Elle brille autant que ta chemise de 1984." },
  { id: 'walkman-blend',    name: 'Walkman Blend',     rarity: 'epique',      series: 'annees80', icon: '🎵', desc: "S'écoute en fumant. Conseil de Stéphane." },
  { id: 'boombox-rouge',    name: 'Boombox Rouge',     rarity: 'epique',      series: 'annees80', icon: '🎵', desc: "Portable, puissante, et rouge criard." },
  { id: 'winstoune-84',     name: 'Winstoune 84',      rarity: 'legendaire',  series: 'annees80', icon: '⚡', desc: "L'année était grande. La cigarette l'est encore plus.", maxCirculation: 50 },

  // === CONTREBANDE DES DOCKS ===
  { id: 'port-noir',        name: 'Port-Noir',         rarity: 'rare',        series: 'docks', icon: '⚓', desc: "Chargée à quai, déchargée discrètement à 3h du matin." },
  { id: 'casablanca-exp',   name: 'Casablanca Express',rarity: 'epique',      series: 'docks', icon: '🌊', desc: "Le grand voyage. Aller simple vers la nicotine." },
  { id: 'mafia-blend',      name: 'Mafia Blend',       rarity: 'epique',      series: 'docks', icon: '🌊', desc: "On ne sait pas qui la fabrique. Et c'est mieux ainsi." },
  { id: 'vodka-tabac',      name: 'Vodka-Tabac Sibérien',rarity: 'legendaire', series: 'docks', icon: '🥃', desc: "Les Russes ont tout inventé. Surtout le mauvais goût.", maxCirculation: 40 },
  { id: 'douanier-corrompu',name: 'Le Douanier Corrompu',rarity: 'legendaire',series: 'docks', icon: '🥃', desc: "100% garantie non taxée. Par définition.", maxCirculation: 30 },

  // === SAISONS ===
  { id: 'barbecue-lights',  name: 'Barbecue d\'Été Lights', rarity: 'rare', series: 'saisons', icon: '☀️', desc: "Goût fumé naturel. L'été dans chaque bouffée.", seasonal: true },
  { id: 'galette-vanille',  name: 'Galette Vanille',   rarity: 'rare',        series: 'saisons', icon: '🫓', desc: "Janvier, la galette, et une cigarette. La tradition.", seasonal: true },
  { id: 'cupidon-rose',     name: 'Cupidon Rosé',      rarity: 'epique',      series: 'saisons', icon: '💕', desc: "Saint-Valentin. Pour lui ou pour elle. Ou pour personne.", seasonal: true },
  { id: 'pere-noel-menthol',name: 'Père Noël Menthol', rarity: 'epique',      series: 'saisons', icon: '🎅', desc: "Il l'a glissée dans la chaussette. Merci Père Noël.", seasonal: true },
  { id: 'citrouille-blonde',name: 'Citrouille Blonde', rarity: 'epique',      series: 'saisons', icon: '🎃', desc: "Halloween dans chaque puff. Effroyablement bonne.", seasonal: true },

  // === MYTHES DU CENDRIER ===
  { id: 'phenix-fumee',     name: 'Phénix de Fumée',   rarity: 'legendaire',  series: 'mythes', icon: '🔥', desc: "Elle renaît de ses cendres. Littéralement.", maxCirculation: 25 },
  { id: 'dernier-megot',    name: 'Le Dernier Mégot',  rarity: 'mythique',    series: 'mythes', icon: '💀', desc: "On dit qu'elle ne s'éteint jamais. On dit.", maxCirculation: 10 },
  { id: 'cigarette-or',     name: 'La Cigarette d\'Or', rarity: 'mythique',   series: 'mythes', icon: '✨', desc: "24 carats de goût. 0 carats de raison.", maxCirculation: 10 },
  { id: 'cendrier-maudit',  name: 'Le Cendrier Maudit',rarity: 'mythique',    series: 'mythes', icon: '💎', desc: "Maudite mais irrésistible. Le dilemme éternel.", maxCirculation: 10 },
];

// Pack odds tables
const PACK_TYPES = {
  tabac: {
    name: 'Tabac du Coin', price: 100, size: 5,
    odds: { commune: 0.70, 'peu-commune': 0.22, rare: 0.065, epique: 0.014, legendaire: 0.001, mythique: 0 },
    series: ['classiques', 'roulees'],
    pityKey: 'tabac_epic', pityThreshold: 20, pityRarity: 'epique',
  },
  duty: {
    name: 'Duty Free', price: 400, size: 5,
    odds: { commune: 0.40, 'peu-commune': 0.32, rare: 0.20, epique: 0.065, legendaire: 0.014, mythique: 0.001 },
    series: ['classiques', 'roulees', 'duty', 'annees80'],
    pityKey: 'duty_legendary', pityThreshold: 15, pityRarity: 'legendaire',
  },
  contre: {
    name: 'Contrebande', price: 1100, size: 5,
    odds: { commune: 0.20, 'peu-commune': 0.30, rare: 0.30, epique: 0.15, legendaire: 0.045, mythique: 0.005 },
    series: ['duty', 'annees80', 'docks', 'mythes'],
    pityKey: 'contre_mythic', pityThreshold: 25, pityRarity: 'mythique',
  },
  saison: {
    name: 'Paquet de Saison', price: 800, size: 5,
    odds: { commune: 0, 'peu-commune': 0, rare: 0.65, epique: 0.35, legendaire: 0, mythique: 0 },
    series: ['saisons'],
    pityKey: null,
  },
};

// Track configs
const TRACKS = {
  trottoir: {
    name: 'Trottoir', distance: 500, baseTime: 60, unlockLevel: 1, icon: '🚶',
    rewards: { or: 60, argent: 35, bronze: 20, rate: 5 },
    goldTime: 40, silverTime: 50, bronzeTime: 60,
    xp: { or: 120, argent: 80, bronze: 50, rate: 20 },
  },
  boulevard: {
    name: 'Boulevard', distance: 800, baseTime: 90, unlockLevel: 10, icon: '🚗',
    rewards: { or: 150, argent: 90, bronze: 50, rate: 10 },
    goldTime: 60, silverTime: 75, bronzeTime: 90,
    xp: { or: 250, argent: 160, bronze: 100, rate: 40 },
  },
  autoroute: {
    name: 'Autoroute', distance: 1200, baseTime: 120, unlockLevel: 25, icon: '🛣️',
    rewards: { or: 400, argent: 240, bronze: 130, rate: 25 },
    goldTime: 80, silverTime: 100, bronzeTime: 120,
    xp: { or: 600, argent: 380, bronze: 240, rate: 80 },
  },
};

// Level progression
const LEVEL_XP = [];
for (let i = 1; i <= 100; i++) {
  LEVEL_XP.push(Math.floor(100 * Math.pow(1.15, i - 1)));
}

const LEVEL_TITLES = [
  { min: 1,  max: 10, title: 'Fumeur du dimanche' },
  { min: 11, max: 25, title: 'Chaîne-fumeur' },
  { min: 26, max: 50, title: 'Baron du trottoir' },
  { min: 51, max: 999, title: 'Légende du cendrier' },
];

function getLevelTitle(level) {
  const entry = LEVEL_TITLES.find(t => level >= t.min && level <= t.max);
  return entry ? entry.title : 'Légende du cendrier';
}

function getTotalXPForLevel(level) {
  let total = 0;
  for (let i = 0; i < level - 1; i++) total += LEVEL_XP[i] || LEVEL_XP[LEVEL_XP.length-1];
  return total;
}

// Skills definition
const SKILLS_DEF = [
  { id: 'slots',      name: 'Slots+',         icon: '🚬', desc: 'Emplacement cigarette supplémentaire',   maxLevel: 2, cost: 1, effect: 'slot+1' },
  { id: 'energy',     name: 'Souffle fort',   icon: '💨', desc: '+10% énergie gagnée par cigarette',      maxLevel: 3, cost: 1, effect: 'energy+10%' },
  { id: 'cough',      name: 'Gorge en acier', icon: '🛡️', desc: '-10% toux générée',                      maxLevel: 3, cost: 1, effect: 'cough-10%' },
  { id: 'recovery',   name: 'Ventilation',    icon: '🌬️', desc: 'Récupération d\'énergie +20% plus rapide', maxLevel: 2, cost: 1, effect: 'recovery+20%' },
  { id: 'market',     name: 'Commerce',       icon: '💰', desc: 'Emplacement tabac supplémentaire',        maxLevel: 2, cost: 1, effect: 'market+1' },
];

// Combos definition
const COMBOS = {
  'fumee-parfaite': { name: 'Fumée parfaite', icon: '✨', desc: 'Toux divisée par 2', trigger: 'green-zone' },
  'enchainement-2': { name: 'Enchaînement ×2', icon: '🔗', desc: 'Boost +30%', trigger: 'same-brand-x2' },
  'enchainement-3': { name: 'Enchaînement ×3', icon: '⛓️', desc: 'Boost +60%', trigger: 'same-brand-x3' },
  'montee-puissance':{ name: 'Montée en puissance', icon: '📈', desc: '+20% énergie', trigger: 'ascending-rarity' },
  'chaine-parfaite': { name: 'Chaîne parfaite', icon: '🔥', desc: 'Vitesse max 3s sans toux', trigger: 'triple-green' },
};

// Game constants
const GAME_CONST = {
  FREE_PACK_INTERVAL_MS: 10 * 60 * 1000, // 10 min
  MAX_FREE_PACKS: 5,
  BASE_SPEED: 8,         // km/h
  MAX_SPEED: 28,         // km/h
  ENERGY_DECAY: 0.3,     // per second
  COUGH_DECAY: 0.5,      // per second
  COUGH_THRESHOLD: 100,
  COUGH_BLOCK_MS: 3000,
  COUGH_RESET_TO: 40,
  MARKET_COMMISSION: 0.05,
  GAME_MARKET_SELL_RATIO: 0.70,
  GAME_MARKET_BUY_RATIO: 1.15,
  CASINO_MAX_BETS: 50,
  CASINO_UNLOCK_LEVEL: 5,
  MAX_DAILY_SOLO: 30,
  GOLD_STREAK_BONUS: 0.5,
  PRED_MULTIPLIER: 1.9,
  MAX_PREDICTIONS: 5,
  DUEL_COMMISSION: 0.05,
  MAX_DAILY_DUEL: 10,
  PRICE_VARIATION_CAP: 0.20,
};

// Casino odds
const CASINO_PILE_FACE = {
  commune:     { win: 0.48 },
  'peu-commune': { win: 0.46 },
  rare:        { win: 0.44 },
  epique:      { win: 0.42 },
  legendaire:  { win: 0.40 },
  mythique:    { win: 0.38 },
};

const CASINO_ROULETTE = [
  { id: 'prudent', name: 'Prudent 🛡️',   odds: 0.45, mult: 2,  icon: '🟢' },
  { id: 'risque',  name: 'Risqué ⚡',     odds: 0.18, mult: 5,  icon: '🟡' },
  { id: 'jackpot', name: 'Jackpot 💥',    odds: 0.08, mult: 11, icon: '🔴' },
];

// Utility: get all cigarettes for a pack type (filter by series)
function getCigsForPack(packType) {
  const pack = PACK_TYPES[packType];
  return CIGARETTES.filter(c => pack.series.includes(c.series));
}

// Utility: draw a rarity from a pack
function drawRarity(packType) {
  const pack = PACK_TYPES[packType];
  const r = Math.random();
  let cumul = 0;
  for (const [rarity, chance] of Object.entries(pack.odds)) {
    cumul += chance;
    if (r < cumul) return rarity;
  }
  return 'commune';
}

// Utility: draw a cigarette from a specific rarity within a pack
function drawCigarette(packType, rarity) {
  const eligibles = getCigsForPack(packType).filter(c => c.rarity === rarity);
  if (!eligibles.length) {
    // fallback to any cig of this rarity
    const fallback = CIGARETTES.filter(c => c.rarity === rarity);
    if (!fallback.length) return CIGARETTES.find(c => c.rarity === 'commune');
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return eligibles[Math.floor(Math.random() * eligibles.length)];
}

// Utility: format money
function fmt(n) {
  if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(1) + ' M€';
  if (Math.abs(n) >= 1000) return (n/1000).toFixed(1) + ' k€';
  return Math.round(n) + ' €';
}

// Utility: get rarity color
function rarityColor(rarityId) {
  return (RARITIES[rarityId] || {}).color || '#fff';
}

// Utility: generate a random friend code
function genCode(pseudo) {
  return pseudo.slice(0,3).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
}

// Seeded random for reproducibility in price calc
function seededRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
}
