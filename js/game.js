// ============================================================
// STÉPHANE — Core Game Engine (localStorage persistence)
// ============================================================

const SAVE_KEY = 'stephane_v1';

const GameState = {
  // Auth
  isLoggedIn: false,
  pseudo: '',
  email: '',
  friendCode: '',

  // Economy
  money: 500,     // Starting money

  // XP / Level
  xp: 0,
  level: 1,
  skillPoints: 0,

  // Skills
  skills: { slots: 0, energy: 0, cough: 0, recovery: 0, market: 0 },

  // Cigarettes inventory: { cigId: { cig: CIGARETTE_OBJ, count: N, equipped: bool, forSale: { price, listingId } } }
  inventory: {},

  // Equipped slots: array of cigId or null
  equippedSlots: [null, null, null],

  // Packs
  freePacks: 0,
  nextFreePackAt: 0,   // timestamp
  pityCounters: { tabac_epic: 0, duty_legendary: 0, contre_mythic: 0 },

  // Race stats
  stats: { totalRaces: 0, totalWins: 0, totalMoney: 0, goldStreak: 0, bestTimes: {} },
  totalRaces: 0,
  totalWins: 0,
  totalMoney: 0,  // All-time earned
  selectedTrack: 'trottoir',
  dailyRaces: 0,
  lastDailyReset: '',
  goldStreak: 0,
  pendingStreakBonus: false,
  bestTimes: { trottoir: null, boulevard: null, autoroute: null },

  // Market
  myListings: [],         // { id, cigId, cigData, price, listedAt }
  marketSlots: 10,

  // Bourse
  bourseHistory: {},  // { cigId: [pricePoints] }
  predictions: [],    // { cigId, direction, mise, createdAt, resolveAt }

  // Casino
  casinoBetsToday: 0,
  casinoLastReset: '',
  doubleUpActive: false,
  doubleUpCount: 0,
  doubleUpAmount: 0,

  // Friends (pseudo-backend with localStorage)
  friends: [],      // { code, pseudo, online }
  pendingFriends: [],
  sentChallenges: [],     // { id, friendCode, track, mise, myTime, friendTime, status, createdAt }
  receivedChallenges: [], // same

  // Leaderboard data
  globalLB: [],    // simulated

  // Achievements
  seriesCompleted: [],
};

if (typeof window !== 'undefined') window.GameState = GameState;

// ============================================================
// PERSISTENCE (LocalStorage + Supabase Cloud Auto-sync)
// ============================================================
let cloudSaveTimeout = null;

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(GameState));
  } catch(e) { console.warn('Save failed', e); }

}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    Object.assign(GameState, saved);
    return GameState.isLoggedIn;
  } catch(e) {
    console.warn('Load failed', e);
    return false;
  }
}



// ============================================================
// AUTH
// ============================================================



function getDefaultState() {
  return {
    isLoggedIn: false, pseudo: '', email: '', friendCode: '',
    money: 500, xp: 0, level: 1, skillPoints: 0,
    skills: { slots: 0, energy: 0, cough: 0, recovery: 0, market: 0 },
    inventory: {}, equippedSlots: [null, null, null],
    freePacks: 0, nextFreePackAt: Date.now() + GAME_CONST.FREE_PACK_INTERVAL_MS,
    pityCounters: { tabac_epic: 0, duty_legendary: 0, contre_mythic: 0 },
    totalRaces: 0, totalWins: 0, totalMoney: 500, selectedTrack: 'trottoir',
    dailyRaces: 0, lastDailyReset: '', goldStreak: 0, pendingStreakBonus: false,
    bestTimes: { trottoir: null, boulevard: null, autoroute: null },
    myListings: [], marketSlots: 10,
    bourseHistory: {}, predictions: [],
    casinoBetsToday: 0, casinoLastReset: '', doubleUpActive: false, doubleUpCount: 0, doubleUpAmount: 0,
    friends: [], pendingFriends: [], sentChallenges: [], receivedChallenges: [],
    globalLB: [], seriesCompleted: [],
  };
}

// Safe global formatter
if (typeof fmt === 'undefined') {
  window.fmt = function(n) {
    if (typeof n !== 'number' || isNaN(n)) n = 0;
    return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' €';
  };
}

// ============================================================
// ECONOMY
// ============================================================
function earnMoney(amount) {
  const num = Math.round(Number(amount)) || 0;
  if (num <= 0) return;
  GameState.money = (Number(GameState.money) || 0) + num;
  GameState.totalMoney = (Number(GameState.totalMoney) || 0) + num;
  saveGame();
  updateHUD();
  if (typeof ClickerEngine !== 'undefined' && ClickerEngine.setCash && ClickerEngine.getCash() !== GameState.money) {
    ClickerEngine.setCash(GameState.money);
  }
}

function spendMoney(amount) {
  const num = Math.round(Number(amount)) || 0;
  if (num <= 0) return false;
  if ((Number(GameState.money) || 0) < num) return false;
  GameState.money = (Number(GameState.money) || 0) - num;
  saveGame();
  updateHUD();
  if (typeof ClickerEngine !== 'undefined' && ClickerEngine.setCash && ClickerEngine.getCash() !== GameState.money) {
    ClickerEngine.setCash(GameState.money);
  }
  return true;
}

// ============================================================
// INVENTORY
// ============================================================
function addCigarette(cig) {
  const key = cig.id;
  if (!GameState.inventory[key]) {
    GameState.inventory[key] = { cig, count: 0, equipped: false };
  }
  GameState.inventory[key].count++;
  checkSeriesCompletion();
  saveGame();
}

function removeCigarette(cigId, count = 1) {
  if (!GameState.inventory[cigId]) return false;
  if (GameState.inventory[cigId].count < count) return false;
  GameState.inventory[cigId].count -= count;
  if (GameState.inventory[cigId].count <= 0) {
    // Un-equip if needed
    GameState.equippedSlots = GameState.equippedSlots.map(s => s === cigId ? null : s);
    delete GameState.inventory[cigId];
  }
  saveGame();
  return true;
}

function getInventoryArray() {
  return Object.values(GameState.inventory).filter(e => e.count > 0);
}

// ============================================================
// EQUIPMENT
// ============================================================
function getMaxSlots() {
  return 3 + (GameState.skills.slots || 0);
}

function equipCig(cigId, slotIndex) {
  const maxSlots = getMaxSlots();
  if (slotIndex >= maxSlots) { showToast('Slot non disponible !', 'error'); return; }
  if (!GameState.inventory[cigId] || GameState.inventory[cigId].count <= 0) { showToast('Cigarette introuvable !', 'error'); return; }
  // Remove from other slots
  GameState.equippedSlots = GameState.equippedSlots.map((s, i) => i === slotIndex ? null : s);
  // Equip
  GameState.equippedSlots[slotIndex] = cigId;
  saveGame();
}

function unequipSlot(slotIndex) {
  GameState.equippedSlots[slotIndex] = null;
  saveGame();
}

function getEquippedCigs() {
  const maxSlots = getMaxSlots();
  return GameState.equippedSlots.slice(0, maxSlots).filter(Boolean).map(id => GameState.inventory[id]?.cig).filter(Boolean);
}

// ============================================================
// XP / LEVEL
// ============================================================
function earnXP(amount) {
  GameState.xp += amount;
  let leveledUp = false;
  while (true) {
    const needed = LEVEL_XP[GameState.level - 1] || 999999;
    if (GameState.xp >= needed) {
      GameState.xp -= needed;
      GameState.level++;
      GameState.skillPoints++;
      leveledUp = true;
      showToast(`Niveau ${GameState.level} atteint ! +1 point de compétence`, 'gold');
      // Unlock market slot every 5 levels
      if (GameState.level % 5 === 0) {
        GameState.marketSlots++;
        showToast(`Nouvel emplacement tabac débloqué !`, 'success');
      }
    } else break;
  }
  saveGame();
  updateHUD();
}

// ============================================================
// DAILY RESET CHECK
// ============================================================
function checkDailyReset() {
  const today = new Date().toDateString();
  if (GameState.lastDailyReset !== today) {
    GameState.lastDailyReset = today;
    GameState.dailyRaces = 0;
    GameState.casinoBetsToday = 0;
    GameState.casinoLastReset = today;
    saveGame();
  }
}

// ============================================================
// FREE PACKS
// ============================================================
function updateFreePacks() {
  const now = Date.now();
  if (GameState.freePacks >= GAME_CONST.MAX_FREE_PACKS) {
    GameState.nextFreePackAt = now + GAME_CONST.FREE_PACK_INTERVAL_MS;
    return;
  }
  while (now >= GameState.nextFreePackAt && GameState.freePacks < GAME_CONST.MAX_FREE_PACKS) {
    GameState.freePacks++;
    GameState.nextFreePackAt += GAME_CONST.FREE_PACK_INTERVAL_MS;
  }
  if (GameState.freePacks >= GAME_CONST.MAX_FREE_PACKS) {
    GameState.nextFreePackAt = now + GAME_CONST.FREE_PACK_INTERVAL_MS;
  }
  saveGame();
}

// ============================================================
// BOURSE PRICE ENGINE
// ============================================================
function getBoursePrice(cigId) {
  const cig = CIGARETTES.find(c => c.id === cigId);
  if (!cig) return 0;
  const base = RARITIES[cig.rarity]?.baseValue || 5;

  // Simulate circulation (inverse of how many in inventories)
  const totalInInventory = Object.values(
    JSON.parse(localStorage.getItem(SAVE_KEY) || '{}').inventory || {}
  ).filter(e => e.cig?.id === cigId).reduce((s, e) => s + e.count, 0);

  const targetCirculation = 20; // reference
  const actual = Math.max(1, totalInInventory + 1);
  const theoreticalPrice = base * Math.sqrt(targetCirculation / actual);
  const clampedTheory = Math.max(base * 0.5, Math.min(base * 3, theoreticalPrice));

  // Recent sales (from history)
  const history = GameState.bourseHistory[cigId] || [];
  if (history.length < 3) return Math.round(clampedTheory);

  const recent24h = history.filter(p => Date.now() - p.ts < 86400000);
  if (recent24h.length < 3) return Math.round(clampedTheory);

  const avgSale = recent24h.reduce((s, p) => s + p.price, 0) / recent24h.length;
  const mixed = 0.6 * avgSale + 0.4 * clampedTheory;
  return Math.round(mixed);
}

function recordSale(cigId, price) {
  if (!GameState.bourseHistory[cigId]) GameState.bourseHistory[cigId] = [];
  GameState.bourseHistory[cigId].push({ price, ts: Date.now() });
  // Keep last 50 entries
  if (GameState.bourseHistory[cigId].length > 50) {
    GameState.bourseHistory[cigId] = GameState.bourseHistory[cigId].slice(-50);
  }
  saveGame();
}

// ============================================================
// SERIES COMPLETION
// ============================================================
function checkSeriesCompletion() {
  for (const [seriesId, series] of Object.entries(SERIES)) {
    if (GameState.seriesCompleted.includes(seriesId)) continue;
    const seriesCigs = CIGARETTES.filter(c => c.series === seriesId);
    const allOwned = seriesCigs.every(c => GameState.inventory[c.id]?.count > 0);
    if (allOwned) {
      GameState.seriesCompleted.push(seriesId);
      GameState.skillPoints++;
      showToast(`Série "${series.name}" complétée ! +1 point de compétence`, 'gold');
      saveGame();
    }
  }
}

// ============================================================
// FAKE LEADERBOARD
// ============================================================

// ============================================================
// SKILLS & TALENT TREE
// ============================================================
function upgradeSkill(skillId) {
  const def = SKILLS_DEF.find(s => s.id === skillId);
  if (!def) return;
  const currentLevel = GameState.skills[skillId] || 0;
  if (currentLevel >= def.maxLevel) {
    showToast('Compétence au niveau maximum !', 'error');
    return;
  }
  if (GameState.skillPoints < def.cost) {
    showToast('Pas assez de points de compétence !', 'error');
    return;
  }
  GameState.skillPoints -= def.cost;
  GameState.skills[skillId] = currentLevel + 1;

  if (window.SoundFX) SoundFX.upgrade();

  // Apply instant effects
  if (skillId === 'slots') {
    const newMax = getMaxSlots();
    while (GameState.equippedSlots.length < newMax) GameState.equippedSlots.push(null);
  }
  if (skillId === 'market') GameState.marketSlots++;

  showToast(`Talent "${def.name}" augmenté au Niv. ${GameState.skills[skillId]} !`, 'gold');
  saveGame();
  if (typeof renderSkillTree === 'function') renderSkillTree();
  if (typeof renderSkills === 'function') renderSkills();
  updateHUD();
}

function resetSkills() {
  let refund = 0;
  for (const [sId, lvl] of Object.entries(GameState.skills || {})) {
    const def = SKILLS_DEF.find(s => s.id === sId);
    if (def && lvl > 0) {
      refund += lvl * (def.cost || 1);
    }
  }
  if (refund <= 0) {
    showToast('Aucun point investi à réinitialiser.', 'info');
    return;
  }
  GameState.skillPoints += refund;
  GameState.skills = { slots: 0, energy: 0, cough: 0, recovery: 0, market: 0 };
  
  if (window.SoundFX) SoundFX.click();
  showToast(`Arbre réinitialisé ! +${refund} points récupérés`, 'success');
  saveGame();
  if (typeof renderSkillTree === 'function') renderSkillTree();
  if (typeof renderSkills === 'function') renderSkills();
  updateHUD();
}

// Skill modifiers used across race, market and casino
function getEnergyMod() { return 1 + (GameState.skills.energy || 0) * 0.12; }
function getCoughMod()   { return Math.max(0.2, 1 - (GameState.skills.cough || 0) * 0.10); }
function getRecoveryMod(){ return 1 + (GameState.skills.recovery || 0) * 0.20; }
function getSpeedMod()   { return (GameState.skills.combustion || 0) * 2.5; }
function getMaxSlots()   { return 3 + (GameState.skills.slots || 0); }

// ============================================================
// RECYCLING
// ============================================================
const RECYCLE_RULES = [
  { from: 'commune', to: 'peu-commune', cost: 5 },
  { from: 'peu-commune', to: 'rare', cost: 5 },
  { from: 'rare', to: 'epique', cost: 4 },
  { from: 'epique', to: 'legendaire', cost: 3 },
];

function getRecyclableCounts() {
  const counts = {};
  for (const entry of Object.values(GameState.inventory)) {
    const r = entry.cig.rarity;
    counts[r] = (counts[r] || 0) + entry.count;
  }
  return counts;
}

function recycle(fromRarity) {
  const rule = RECYCLE_RULES.find(r => r.from === fromRarity);
  if (!rule) return;
  const counts = getRecyclableCounts();
  if ((counts[fromRarity] || 0) < rule.cost) {
    showToast(`Pas assez de ${RARITIES[fromRarity].name} !`, 'error');
    return;
  }
  // Remove `cost` cigarettes of fromRarity
  let removed = 0;
  for (const entry of Object.values(GameState.inventory)) {
    if (entry.cig.rarity !== fromRarity || removed >= rule.cost) continue;
    const toRemove = Math.min(rule.cost - removed, entry.count);
    entry.count -= toRemove;
    removed += toRemove;
    if (entry.count <= 0) delete GameState.inventory[entry.cig.id];
  }
  // Give 1 of the target rarity
  const eligible = CIGARETTES.filter(c => c.rarity === rule.to && !c.seasonal);
  const result = eligible[Math.floor(Math.random() * eligible.length)];
  addCigarette(result);
  showToast(`Recyclage réussi : vous obtenez ${result.name} (${RARITIES[rule.to].name}) !`, 'gold');
  saveGame();
}

// ============================================================
// HUD UPDATE
// ============================================================
function updateHUD() {
  const moneyEl = document.getElementById('hud-money');
  const packsEl = document.getElementById('hud-packs');
  const levelEl = document.getElementById('hud-level');
  const psMoney = document.getElementById('ps-money');

  // L'argent, le niveau et les paquets affichés sont ceux de l'Empire (clicker)
  // L'argent est affiché par ClickerEngine (spendMoney/earnMoney lui transmettent le solde).
  // Surtout pas ClickerEngine.render() ici : il recopierait l'ancien solde dans GameState.money.
  if (typeof ClickerEngine !== 'undefined' && ClickerEngine.isReady && ClickerEngine.isReady()) {
    if (levelEl) levelEl.textContent = 'Niv. ' + ClickerEngine.getState().empireLevel;
  } else {
    const formattedMoney = fmt(GameState.money);
    if (moneyEl) moneyEl.textContent = formattedMoney;
    if (levelEl) levelEl.textContent = 'Niv. ' + GameState.level;
    if (psMoney) psMoney.textContent = formattedMoney;
  }
  if (packsEl) {
    const free = parseInt(localStorage.getItem('empire_free_packs_count') ?? '3') || 0;
    packsEl.textContent = free + (free === 1 ? ' paquet' : ' paquets');
  }
}

// ============================================================
// FRIENDS & DUELS
// ============================================================


