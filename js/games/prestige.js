// ============================================================
// THE ASHTRAY KING — Prestiges (trophées façon PS5)
// • Défis de la semaine : 10 défis (6 Bronze, 3 Argent, 1 Or) tirés au sort,
//   du lundi 0 h au dimanche 23 h 59. Tous réussis = Platine de la semaine.
// • Prestiges de rang : un trophée permanent par palier atteint dans chaque jeu.
// Les trophées gagnés restent pour toujours dans la vitrine.
// ============================================================

const Prestige = (() => {
  const STORE_KEY = 'prestige_v1';

  const TROPHY = {
    // Comme les trophées PlayStation : surtout pour la collection, petite récompense d'XP seulement
    bronze:  { name: 'Bronze',  color: '#c57b3a', xp: 25,  packs: 0 },
    argent:  { name: 'Argent',  color: '#c9d2dc', xp: 60,  packs: 0 },
    or:      { name: 'Or',      color: '#ffc43a', xp: 150, packs: 0 },
    platine: { name: 'Platine', color: '#9fe7ff', xp: 400, packs: 0 },
  };

  const GAME_NAMES = { ut: 'Ultimate Comptoir', quiz: 'Quiz du Comptoir', bataille: 'Bataille de Comptoir', des421: '421', pbc: 'Pierre-Briquet-Clope', course: 'Course Clandestine' };
  const RARITY_RANK = { commune: 0, 'peu-commune': 1, rare: 2, epique: 3, legendaire: 4, mythique: 5 };

  // Modèles de défis : on/match décident de ce qui fait avancer le compteur
  const POOL = [
    // ── Bronze ──
    { id: 'clics_1500',   tier: 'bronze', target: 3000, text: 'Clique 3 000 fois sur le jeton', on: 'click' },
    { id: 'packs_5',      tier: 'bronze', target: 15,  text: 'Ouvre 15 paquets', on: 'pack_open' },
    { id: 'wins_5',       tier: 'bronze', target: 15,  text: 'Gagne 15 parties dans la salle de jeux', on: 'game_end', match: p => p.result === 'win' },
    { id: 'play_bat_5',   tier: 'bronze', target: 15,  text: 'Joue 15 Batailles de Comptoir', on: 'game_end', match: p => p.game === 'bataille' },
    { id: 'play_421_5',   tier: 'bronze', target: 15,  text: 'Joue 15 parties de 421', on: 'game_end', match: p => p.game === 'des421' },
    { id: 'play_pbc_5',   tier: 'bronze', target: 15,  text: 'Joue 15 parties de Pierre-Briquet-Clope', on: 'game_end', match: p => p.game === 'pbc' },
    { id: 'casino_3',     tier: 'bronze', target: 9,  text: 'Gagne 9 fois au casino', on: 'casino_win' },
    { id: 'poker_6',      tier: 'bronze', target: 9,  text: 'Gagne 9 mains de poker (Ultimate Poker ou table)', on: 'poker_win' },
    { id: 'rares_5',      tier: 'bronze', target: 15,  text: 'Tire 15 cartes Rares ou mieux', on: 'card_drawn', match: p => RARITY_RANK[p.rarity] >= 2 },
    { id: 'play_ut_3',    tier: 'bronze', target: 9,  text: 'Joue 9 matchs d\'Ultimate Comptoir', on: 'game_end', match: p => p.game === 'ut' },
    { id: 'goals_ut_8',   tier: 'bronze', target: 24,  text: 'Marque 24 buts en Ultimate Comptoir', on: 'ut_goals' },
    { id: 'brelan_1',     tier: 'bronze', target: 1,  text: 'Sors un brelan au 421', on: 'dice_combo', match: p => p.combo === 'brelan' || p.combo === 'mac' },
    // ── Argent ──
    { id: 'win_bat_5',    tier: 'argent', target: 15,  text: 'Gagne 15 Batailles de Comptoir', on: 'game_end', match: p => p.game === 'bataille' && p.result === 'win' },
    { id: 'win_421_5',    tier: 'argent', target: 15,  text: 'Gagne 15 parties de 421', on: 'game_end', match: p => p.game === 'des421' && p.result === 'win' },
    { id: 'win_pbc_6',    tier: 'argent', target: 18,  text: 'Gagne 18 parties de Pierre-Briquet-Clope', on: 'game_end', match: p => p.game === 'pbc' && p.result === 'win' },
    { id: 'win_ut_4',     tier: 'argent', target: 12,  text: 'Gagne 12 matchs d\'Ultimate Comptoir', on: 'game_end', match: p => p.game === 'ut' && p.result === 'win' },
    { id: 'clean_ut',     tier: 'argent', target: 1,  text: 'Gagne un match d\'Ultimate Comptoir sans encaisser de but', on: 'perfect', match: p => p.game === 'ut' },
    { id: 'combo_421',    tier: 'argent', target: 1,  text: 'Sors un 421 au 421', on: 'dice_combo', match: p => p.combo === '421' },
    { id: 'sweep_bat',    tier: 'argent', target: 1,  text: 'Gagne une Bataille 3 manches à 0', on: 'perfect', match: p => p.game === 'bataille' },
    { id: 'sweep_pbc',    tier: 'argent', target: 1,  text: 'Gagne un Pierre-Briquet-Clope 3 à 0', on: 'perfect', match: p => p.game === 'pbc' },
    { id: 'bj_2',         tier: 'argent', target: 6,  text: 'Fais 6 Blackjacks au casino', on: 'blackjack' },
    { id: 'poker_25',     tier: 'argent', target: 25, text: 'Gagne 25 mains de poker', on: 'poker_win' },
    { id: 'epiques_2',    tier: 'argent', target: 6,  text: 'Tire 6 cartes Épiques ou mieux', on: 'card_drawn', match: p => RARITY_RANK[p.rarity] >= 3 },
    { id: 'clics_6000',   tier: 'argent', target: 12000, text: 'Clique 12 000 fois sur le jeton', on: 'click' },
    // ── Or ──
    { id: 'rankup_3',     tier: 'or', target: 9,  text: 'Monte de 9 rangs (tous jeux confondus)', on: 'rank_up', amount: p => p.count || 1 },
    { id: 'wins_25',      tier: 'or', target: 75, text: 'Gagne 75 parties dans la salle de jeux', on: 'game_end', match: p => p.result === 'win' },
    { id: 'mac',          tier: 'or', target: 1,  text: 'Sors un Mac (trois as) au 421', on: 'dice_combo', match: p => p.combo === 'mac' },
    { id: 'legend_1',     tier: 'or', target: 1,  text: 'Tire une carte Légendaire ou Mythique', on: 'card_drawn', match: p => RARITY_RANK[p.rarity] >= 4 },
    { id: 'streak_5',     tier: 'or', target: 1,  text: 'Gagne 5 parties d\'affilée dans un même jeu', on: 'game_end', match: p => p.result === 'win' && p.streak >= 5 },
    { id: 'packs_25',     tier: 'or', target: 75, text: 'Ouvre 75 paquets', on: 'pack_open' },
  ];
  const WEEKLY_COUNT = { bronze: 6, argent: 3, or: 1 };

  let data = load();
  let listeners = [];

  // ── Semaine en cours (lundi 0 h, heure locale) ─────────────
  function weekStart(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (x.getDay() + 6) % 7; // lundi = 0
    x.setDate(x.getDate() - day);
    return x;
  }
  function weekId(d = new Date()) {
    const w = weekStart(d);
    return `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
  }
  function msUntilReset() {
    const next = weekStart();
    next.setDate(next.getDate() + 7);
    return next - new Date();
  }

  // Tirage déterministe des défis à partir de l'identifiant de la semaine
  function seeded(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    return () => {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function weeklyChallenges(id = weekId()) {
    const rnd = seeded('ashtray-' + id);
    const out = [];
    Object.entries(WEEKLY_COUNT).forEach(([tier, n]) => {
      const pool = POOL.filter(c => c.tier === tier).slice();
      for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    });
    return out;
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      d.trophies = d.trophies || [];
      return d;
    } catch (e) {
      return { trophies: [] };
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  // Nouvelle semaine : on repart de zéro (les trophées déjà gagnés restent)
  function ensureWeek() {
    const id = weekId();
    if (data.week !== id) {
      data.week = id;
      data.progress = {};
      data.done = {};
      save();
    }
  }

  function hasTrophy(id) {
    return data.trophies.some(t => t.id === id);
  }

  function award(id, tier, name, detail) {
    if (hasTrophy(id)) return;
    const t = TROPHY[tier];
    data.trophies.push({ id, tier, name, detail, at: Date.now() });
    save();
    if (typeof ClickerEngine !== 'undefined' && ClickerEngine.gainXP) ClickerEngine.gainXP(t.xp);
    if (t.packs) {
      const cur = parseInt(localStorage.getItem('empire_free_packs_count') ?? '3') || 0;
      localStorage.setItem('empire_free_packs_count', String(Math.min(10, cur + t.packs)));
    }
    showTrophyPopup(tier, name, t);
    listeners.forEach(fn => { try { fn(); } catch (e) {} });
  }

  // ── Événements du jeu ──────────────────────────────────────
  function emit(type, payload = {}) {
    // les quêtes du jour et les succès écoutent les mêmes événements
    try { if (window.Quests) Quests.on(type, payload); if (window.Achievements) Achievements.on(type, payload); } catch (e) {}
    ensureWeek();

    // Défis de la semaine
    weeklyChallenges().forEach(ch => {
      if (ch.on !== type || data.done[ch.id]) return;
      if (ch.match && !ch.match(payload)) return;
      const inc = ch.amount ? ch.amount(payload) : (payload.n || 1);
      data.progress[ch.id] = Math.min(ch.target, (data.progress[ch.id] || 0) + inc);
      if (data.progress[ch.id] >= ch.target) {
        data.done[ch.id] = Date.now();
        award(`w${data.week}-${ch.id}`, ch.tier, ch.text, `Semaine du ${formatWeek(data.week)}`);
      }
    });
    save();

    // Platine de la semaine
    const list = weeklyChallenges();
    if (list.every(c => data.done[c.id]) && !hasTrophy(`w${data.week}-platine`)) {
      award(`w${data.week}-platine`, 'platine', 'Tous les défis de la semaine', `Semaine du ${formatWeek(data.week)}`);
    }

    // Prestiges de rang (permanents)
    if (type === 'rank_up' && typeof League !== 'undefined') {
      const rank = League.RANKS[payload.rankIndex];
      if (rank) {
        const tierFirst = League.RANKS.findIndex(r => r.tierIndex === rank.tierIndex);
        for (let ti = 1; ti <= rank.tierIndex; ti++) {
          const tierName = League.TIERS[ti].name;
          const tier = ti >= 9 ? 'platine' : ti >= 7 ? 'or' : ti >= 4 ? 'argent' : 'bronze';
          award(`rank-${payload.game}-${League.TIERS[ti].id}`, tier, `${tierName} en ${GAME_NAMES[payload.game] || payload.game}`, 'Prestige de rang');
        }
        void tierFirst;
      }
    }
    listeners.forEach(fn => { try { fn(); } catch (e) {} });
  }

  function formatWeek(id) {
    const [y, m, d] = id.split('-');
    return `${d}/${m}/${y}`;
  }

  function weekly() {
    ensureWeek();
    return weeklyChallenges().map(ch => ({
      ...ch,
      progress: data.progress[ch.id] || 0,
      done: !!data.done[ch.id],
      reward: TROPHY[ch.tier],
    }));
  }

  function trophies() {
    return data.trophies.slice().sort((a, b) => b.at - a.at);
  }

  function counts() {
    const c = { bronze: 0, argent: 0, or: 0, platine: 0 };
    data.trophies.forEach(t => { c[t.tier] = (c[t.tier] || 0) + 1; });
    return c;
  }

  // ── Notification façon console ─────────────────────────────
  function trophyIcon(tier, size = 28) {
    const c = TROPHY[tier] ? TROPHY[tier].color : '#ffc43a';
    return `<svg class="trophy-icon" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 4h14v6a7 7 0 0 1-14 0z" fill="${c}" stroke="#120a04" stroke-width="2" stroke-linejoin="round"/>
      <path d="M9 6H5v2a5 5 0 0 0 5 5M23 6h4v2a5 5 0 0 1-5 5" fill="none" stroke="#120a04" stroke-width="2"/>
      <path d="M14 17h4v5h-4z" fill="${c}" stroke="#120a04" stroke-width="2"/>
      <rect x="10" y="22" width="12" height="5" rx="1" fill="${c}" stroke="#120a04" stroke-width="2"/>
    </svg>`;
  }

  function showTrophyPopup(tier, name, t) {
    const el = document.createElement('div');
    el.className = `trophy-popup trophy-${tier}`;
    el.innerHTML = `
      ${trophyIcon(tier, 34)}
      <div class="trophy-popup-text">
        <span class="trophy-popup-kicker">Prestige ${t.name} débloqué</span>
        <strong>${name}</strong>
        <span class="trophy-popup-reward">+${t.xp} XP${t.packs ? ` · +${t.packs} paquet${t.packs > 1 ? 's' : ''} gratuit${t.packs > 1 ? 's' : ''}` : ''}</span>
      </div>`;
    document.body.appendChild(el);
    if (window.SoundFX && SoundFX.win) SoundFX.win();
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 500); }, 4200);
  }

  function onChange(fn) { listeners.push(fn); }

  return { emit, weekly, trophies, counts, msUntilReset, weekId, formatWeek, trophyIcon, onChange, TROPHY };
})();

if (typeof window !== 'undefined') window.Prestige = Prestige;
