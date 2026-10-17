// ============================================================
// THE ASHTRAY KING — Ligues (un classement par mini-jeu)
// 26 rangs : 8 paliers × 3 divisions (III → I), puis Parrain et Roi du Comptoir.
// 100 points de ligue (PL) par rang. On ne retombe jamais sous le début de son palier.
// ============================================================

const League = (() => {
  const STORE_KEY = 'league_v1';

  const TIERS = [
    { id: 'megot',     name: 'Mégot',           color: '#8a7358', divisions: 3 },
    { id: 'roulee',    name: 'Roulée',          color: '#b08d57', divisions: 3 },
    { id: 'blonde',    name: 'Blonde',          color: '#e9c46a', divisions: 3 },
    { id: 'brune',     name: 'Brune',           color: '#a0612f', divisions: 3 },
    { id: 'cigarillo', name: 'Cigarillo',       color: '#d9622b', divisions: 3 },
    { id: 'havane',    name: 'Havane',          color: '#b3261e', divisions: 3 },
    { id: 'buraliste', name: 'Buraliste',       color: '#3fcf7a', divisions: 3 },
    { id: 'baron',     name: 'Baron',           color: '#4d96ff', divisions: 3 },
    { id: 'parrain',   name: 'Parrain',         color: '#b06bff', divisions: 1 },
    { id: 'roi',       name: 'Roi du Comptoir', color: '#ffc43a', divisions: 1 },
  ];
  const ROMAN = ['III', 'II', 'I'];

  // Liste à plat des 26 rangs
  const RANKS = [];
  TIERS.forEach((t, ti) => {
    for (let d = 0; d < t.divisions; d++) {
      RANKS.push({
        index: RANKS.length,
        tierIndex: ti,
        tier: t,
        name: t.divisions > 1 ? `${t.name} ${ROMAN[d]}` : t.name,
        color: t.color,
      });
    }
  });
  const LP_PER_RANK = 100;
  const TOP = RANKS.length - 1;

  const GAMES = {
    ut:       { name: 'Ultimate Comptoir' },
    quiz:     { name: 'Quiz du Comptoir' },
    bataille: { name: 'Bataille de Comptoir' },
    des421:   { name: '421' },
    pbc:      { name: 'Pierre-Briquet-Clope' },
    course:   { name: 'Course Clandestine' },
  };

  let data = load();

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      d.games = d.games || {};
      return d;
    } catch (e) {
      return { games: {} };
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function gameState(game) {
    if (!data.games[game]) data.games[game] = { lp: 0, wins: 0, losses: 0, draws: 0, streak: 0, best: 0 };
    return data.games[game];
  }

  function rankFromLp(lp) {
    const index = Math.min(TOP, Math.floor(lp / LP_PER_RANK));
    const rank = RANKS[index];
    const inRank = index === TOP ? lp - TOP * LP_PER_RANK : lp % LP_PER_RANK;
    return { ...rank, lp, inRank };
  }

  function getRank(game) {
    return rankFromLp(gameState(game).lp);
  }

  // 0 (Mégot) → 1 (Roi) : sert à régler la force de l'ordinateur
  function difficulty(game) {
    return Math.min(1, getRank(game).index / TOP);
  }

  // Enregistre une partie classée : c'est le SERVEUR qui calcule les points (il applique aussi les limites :
  // pas deux parties en moins de 12 s, 200 parties/jour, et contre l'ordi on ne dépasse pas Buraliste I).
  async function record(game, result) {
    const sb = window.sb;
    if (!sb || !(window.Account && Account.user)) return { error: 'Connecte-toi pour jouer en classé.' };
    const { data, error } = await sb.rpc('league_record', { p_game: game, p_result: result });
    if (error) return { error: error.message || 'Partie non classée.' };
    return applyResult(game, data, result);
  }

  // Résultat renvoyé par le serveur (contre l'ordi ou contre un vrai joueur) → rang local + défis
  function applyResult(game, data, result) {
    const g = gameState(game);
    g.lp = data.lp; g.wins = data.wins; g.losses = data.losses; g.draws = data.draws; g.streak = data.streak;
    g.best = Math.max(g.best || 0, data.after);
    save();

    const before = rankFromLp(data.lp - data.delta);
    const after = rankFromLp(data.lp);
    const promoted = after.index > before.index;
    if (typeof Prestige !== 'undefined') {
      Prestige.emit('game_end', { game, result, streak: g.streak });
      if (promoted) Prestige.emit('rank_up', { game, rankIndex: after.index, count: after.index - before.index });
    }
    return { delta: data.delta, before, after, promoted, demoted: after.index < before.index, streak: g.streak, capped: data.capped };
  }

  // Au démarrage : on récupère ses vrais rangs depuis le serveur (saison en cours)
  async function syncFromServer() {
    const sb = window.sb;
    if (!sb) return;
    const { data, error } = await sb.rpc('get_my_ratings');
    if (error || !data) return;
    Object.keys(GAMES).forEach(k => { const g = gameState(k); g.lp = 0; g.wins = 0; g.losses = 0; g.draws = 0; g.streak = 0; });
    data.forEach(r => {
      const g = gameState(r.game);
      g.lp = r.lp; g.wins = r.wins; g.losses = r.losses; g.draws = r.draws; g.streak = r.streak; g.pos = r.pos;
      g.best = Math.max(g.best || 0, Math.min(25, Math.floor(r.lp / 100)));
    });
    save();
  }

  function stats(game) {
    return { ...gameState(game) };
  }

  // Écusson de rang (HTML)
  function badge(rankIndex, size = 'md') {
    const r = RANKS[Math.max(0, Math.min(TOP, rankIndex))];
    const div = r.tier.divisions > 1 ? ROMAN[r.index - RANKS.findIndex(x => x.tierIndex === r.tierIndex)] : (r.tier.id === 'roi' ? '♛' : '★');
    return `<span class="rank-badge rank-${size}" style="--rk:${r.color}" title="${r.name}">
      <span class="rank-badge-shape"><span class="rank-badge-div">${div}</span></span>
    </span>`;
  }

  // Saison de 30 jours depuis le 1er octobre 2026 (même calcul que le serveur)
  function seasonInfo() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const day = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 9, 1)) / 86400000);
    const n = Math.max(0, Math.floor(day / 30));
    return { n: n + 1, left: 30 - (day - n * 30) };
  }
  function seasonLabel() {
    const s = seasonInfo();
    return `${s.n} · ${s.left} j restants`;
  }

  return { seasonLabel, TIERS, RANKS, GAMES, LP_PER_RANK, getRank, rankFromLp, difficulty, record, applyResult, syncFromServer, stats, badge };
})();

if (typeof window !== 'undefined') window.League = League;
