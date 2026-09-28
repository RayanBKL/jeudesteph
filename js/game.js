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

// ============================================================
// PERSISTENCE
// ============================================================
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
function registerUser(pseudo, email, password) {
  if (!pseudo || pseudo.length < 2) return { ok: false, msg: 'Pseudo trop court (min 2 caractères)' };
  if (!email.includes('@')) return { ok: false, msg: 'Email invalide' };
  if (!password || password.length < 4) return { ok: false, msg: 'Mot de passe trop court (min 4 caractères)' };

  // Check if user already exists
  const users = JSON.parse(localStorage.getItem('stephane_users') || '[]');
  if (users.find(u => u.email === email)) return { ok: false, msg: 'Email déjà utilisé' };

  const code = genCode(pseudo);
  users.push({ pseudo, email, password, code });
  localStorage.setItem('stephane_users', JSON.stringify(users));

  // Initialize game
  Object.assign(GameState, getDefaultState());
  GameState.isLoggedIn = true;
  GameState.pseudo = pseudo;
  GameState.email = email;
  GameState.friendCode = code;
  GameState.nextFreePackAt = Date.now() + GAME_CONST.FREE_PACK_INTERVAL_MS;

  // Give a starter free pack
  GameState.freePacks = 1;

  // Populate leaderboard with fake entries for fun
  generateFakeLB();

  saveGame();
  return { ok: true };
}

function loginUser(email, password) {
  const users = JSON.parse(localStorage.getItem('stephane_users') || '[]');
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return { ok: false, msg: 'Email ou mot de passe incorrect' };

  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
  if (saved.email === email) {
    Object.assign(GameState, saved);
    GameState.isLoggedIn = true;
  } else {
    Object.assign(GameState, getDefaultState());
    GameState.isLoggedIn = true;
    GameState.pseudo = user.pseudo;
    GameState.email = email;
    GameState.friendCode = user.code;
    GameState.freePacks = 1;
    generateFakeLB();
  }
  saveGame();
  return { ok: true };
}

function logoutUser() {
  saveGame();
  GameState.isLoggedIn = false;
}

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

// ============================================================
// ECONOMY
// ============================================================
function earnMoney(amount) {
  GameState.money += amount;
  GameState.totalMoney += Math.max(0, amount);
  saveGame();
  updateHUD();
}

function spendMoney(amount) {
  if (GameState.money < amount) return false;
  GameState.money -= amount;
  saveGame();
  updateHUD();
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
      showToast(`🎉 Niveau ${GameState.level} ! +1 point de compétence`, 'gold');
      // Unlock market slot every 5 levels
      if (GameState.level % 5 === 0) {
        GameState.marketSlots++;
        showToast(`🏪 Nouvel emplacement tabac débloqué !`, 'success');
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
      showToast(`📚 Série "${series.name}" complétée ! +1 point de compétence`, 'gold');
      saveGame();
    }
  }
}

// ============================================================
// FAKE LEADERBOARD
// ============================================================
function generateFakeLB() {
  const fakeNames = [
    'GauloisGuy', 'TabacTonton', 'NicotinKing', 'LeRouillé', 'PatriceSmoke',
    'BernardPuff', 'JacquesBlue', 'MimosaCig', 'FumeurFou', 'CendreRoyal',
  ];
  GameState.globalLB = fakeNames.map((name, i) => ({
    pseudo: name,
    fortune: Math.floor(50000 * Math.random() + 5000),
    bestTime: { trottoir: (35 + Math.random() * 20).toFixed(1) },
    wins: Math.floor(Math.random() * 50),
    rarity: ['commune','peu-commune','rare','epique','legendaire'][Math.min(i, 4)],
  }));
  saveGame();
}

// ============================================================
// SKILLS
// ============================================================
function upgradeSkill(skillId) {
  const def = SKILLS_DEF.find(s => s.id === skillId);
  if (!def) return;
  const currentLevel = GameState.skills[skillId] || 0;
  if (currentLevel >= def.maxLevel) { showToast('Compétence au niveau max !', 'error'); return; }
  if (GameState.skillPoints < def.cost) { showToast('Pas assez de points !', 'error'); return; }
  GameState.skillPoints -= def.cost;
  GameState.skills[skillId] = currentLevel + 1;
  // Apply effect
  if (skillId === 'slots') {
    const newMax = getMaxSlots();
    while (GameState.equippedSlots.length < newMax) GameState.equippedSlots.push(null);
  }
  if (skillId === 'market') GameState.marketSlots++;
  showToast(`⚡ Compétence "${def.name}" améliorée !`, 'success');
  saveGame();
}

// Skill modifiers
function getEnergyMod() { return 1 + (GameState.skills.energy || 0) * 0.10; }
function getCoughMod()   { return 1 - (GameState.skills.cough || 0) * 0.10; }
function getRecoveryMod(){ return 1 + (GameState.skills.recovery || 0) * 0.20; }

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
  showToast(`♻️ Recyclage : vous obtenez ${result.name} (${RARITIES[rule.to].name}) !`, 'gold');
  saveGame();
}

// ============================================================
// HUD UPDATE
// ============================================================
function updateHUD() {
  const moneyEl = document.getElementById('hud-money');
  const packsEl = document.getElementById('hud-packs');
  const levelEl = document.getElementById('hud-level');
  if (moneyEl) moneyEl.textContent = fmt(GameState.money);
  if (packsEl) packsEl.textContent = GameState.freePacks + (GameState.freePacks === 1 ? ' paquet' : ' paquets');
  if (levelEl) levelEl.textContent = 'Niv. ' + GameState.level;
}

// ============================================================
// FRIENDS & DUELS
// ============================================================
function addFriend(codeOrPseudo) {
  const users = JSON.parse(localStorage.getItem('stephane_users') || '[]');
  const target = users.find(u => u.code === codeOrPseudo || u.pseudo.toLowerCase() === codeOrPseudo.toLowerCase());
  if (!target) return { ok: false, msg: 'Joueur introuvable' };
  if (target.email === GameState.email) return { ok: false, msg: 'C\'est vous-même !' };
  if (GameState.friends.find(f => f.code === target.code)) return { ok: false, msg: 'Déjà ami' };
  GameState.friends.push({ code: target.code, pseudo: target.pseudo, online: false });
  saveGame();
  return { ok: true };
}

function sendChallenge(friendCode, trackId, mise) {
  if (GameState.money < mise) return { ok: false, msg: 'Pas assez d\'argent' };
  const dailyCount = GameState.sentChallenges.filter(c => c.friendCode === friendCode && isSameDay(c.createdAt)).length;
  if (dailyCount >= GAME_CONST.MAX_DAILY_DUEL) return { ok: false, msg: 'Limite de 10 défis/jour avec cet ami' };
  spendMoney(mise);
  const challenge = {
    id: Date.now().toString(),
    friendCode, track: trackId, mise,
    myTime: null, friendTime: null,
    status: 'pending_friend',
    createdAt: Date.now(),
    deadline: Date.now() + 86400000,
  };
  GameState.sentChallenges.push(challenge);
  saveGame();
  return { ok: true, challenge };
}

function isSameDay(ts) {
  const d1 = new Date(ts);
  const d2 = new Date();
  return d1.toDateString() === d2.toDateString();
}
