// ============================================================
// THE ASHTRAY KING — Tableau de bord admin
// Les données viennent de fonctions serveur qui vérifient que tu es admin (table admin_users).
// On utilise la session du jeu : connecte-toi dans le jeu (même navigateur, même adresse), puis ouvre cette page.
// ============================================================
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' Md'; if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M'; if (n >= 1e4) return Math.round(n / 1e3) + ' k'; return Math.round(n).toLocaleString('fr-FR'); };
  const GAME_NAMES = { ut: 'Ultimate Comptoir', bataille: 'Bataille', des421: '421', pbc: 'Pierre-Briquet-Clope', quiz: 'Quiz', course: 'Course' };
  const COLORS = { ut: '#4fe08c', bataille: '#ffc43a', des421: '#ff8a4f', pbc: '#e2322b', quiz: '#6aa8ff', course: '#c58bff' };
  let tab = 'overview', overview = null, players = null, sortKey = 'last_seen', sortDir = -1, search = '';

  function ago(t) {
    if (!t) return '—';
    const s = (Date.now() - Date.parse(t)) / 1000;
    if (s < 90) return 'à l\'instant';
    if (s < 3600) return Math.round(s / 60) + ' min';
    if (s < 86400) return Math.round(s / 3600) + ' h';
    return Math.round(s / 86400) + ' j';
  }
  const day = t => t ? new Date(t).toLocaleDateString('fr-FR') : '—';

  // ── Graphiques (SVG maison) ──
  function barChart(data, o = {}) {
    const w = 560, h = 170, pad = 24, n = data.length || 1, max = Math.max(1, ...data.map(d => d.y));
    const bw = (w - pad * 2) / n;
    const bars = data.map((d, i) => `<rect x="${pad + i * bw + 1}" y="${h - pad - (d.y / max) * (h - pad * 2)}" width="${Math.max(1, bw - 2)}" height="${(d.y / max) * (h - pad * 2)}" rx="2" fill="${o.color || '#ffc43a'}"><title>${esc(d.x)} : ${d.y}</title></rect>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}"><line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#4a3626"/><text x="${pad}" y="12" fill="#b9a888" font-size="11">max ${fmt(max)}</text>${bars}
      <text x="${pad}" y="${h - 6}" fill="#b9a888" font-size="10">${esc(data[0] ? data[0].x : '')}</text><text x="${w - pad}" y="${h - 6}" fill="#b9a888" font-size="10" text-anchor="end">${esc(data[data.length - 1] ? data[data.length - 1].x : '')}</text></svg>`;
  }
  function lineChart(data, o = {}) {
    const w = 560, h = 170, pad = 26;
    if (data.length < 2) return '<p class="ad-msg" style="padding:18px 0">Pas encore assez de relevés (un par jour, vers 3 h du matin).</p>';
    const max = Math.max(1, ...data.map(d => d.y)), min = Math.min(0, ...data.map(d => d.y));
    const X = i => pad + (i / (data.length - 1)) * (w - pad * 2), Y = v => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    const pts = data.map((d, i) => `${X(i).toFixed(1)},${Y(d.y).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}"><line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#4a3626"/><text x="${pad}" y="12" fill="#b9a888" font-size="11">max ${fmt(max)}</text>
      <polyline fill="none" stroke="${o.color || '#ffc43a'}" stroke-width="2.5" points="${pts}"/>${data.map((d, i) => `<circle cx="${X(i)}" cy="${Y(d.y)}" r="3" fill="${o.color || '#ffc43a'}"><title>${esc(d.x)} : ${fmt(d.y)}</title></circle>`).join('')}
      <text x="${pad}" y="${h - 6}" fill="#b9a888" font-size="10">${esc(data[0].x)}</text><text x="${w - pad}" y="${h - 6}" fill="#b9a888" font-size="10" text-anchor="end">${esc(data[data.length - 1].x)}</text></svg>`;
  }
  function stacked(rows) {   // rows : [{d, game, n}] -> barres empilées par jour
    const days = [...new Set(rows.map(r => r.d))].sort();
    if (!days.length) return '<p class="ad-msg" style="padding:18px 0">Aucune partie classée pour l\'instant.</p>';
    const games = Object.keys(GAME_NAMES), w = 560, h = 170, pad = 24, bw = (w - pad * 2) / days.length;
    const totals = days.map(d => rows.filter(r => r.d === d).reduce((a, r) => a + r.n, 0)), max = Math.max(1, ...totals);
    let svg = `<svg viewBox="0 0 ${w} ${h}"><line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#4a3626"/><text x="${pad}" y="12" fill="#b9a888" font-size="11">max ${max}</text>`;
    days.forEach((d, i) => {
      let y = h - pad;
      games.forEach(g => {
        const n = (rows.find(r => r.d === d && r.game === g) || { n: 0 }).n; if (!n) return;
        const hh = n / max * (h - pad * 2); y -= hh;
        svg += `<rect x="${pad + i * bw + 1}" y="${y}" width="${Math.max(1, bw - 2)}" height="${hh}" fill="${COLORS[g]}"><title>${esc(d)} · ${GAME_NAMES[g]} : ${n}</title></rect>`;
      });
    });
    return svg + `</svg><div class="ad-legend">${games.map(g => `<span><i style="background:${COLORS[g]}"></i>${GAME_NAMES[g]}</span>`).join('')}</div>`;
  }

  // ── Écrans ──
  function viewOverview() {
    const o = overview;
    const kp = (v, l) => `<div class="ad-kpi"><b>${fmt(v)}</b><span>${l}</span></div>`;
    const topMax = Math.max(1, ...o.top.map(t => t.level));
    $('app').innerHTML = `
      <div class="ad-kpis">${kp(o.players, 'joueurs inscrits')}${kp(o.active_24h, 'actifs sur 24 h')}${kp(o.active_7d, 'actifs sur 7 jours')}${kp(o.new_24h, 'nouveaux (24 h)')}${kp(o.new_7d, 'nouveaux (7 jours)')}${kp(o.matches_24h, 'parties en ligne (24 h)')}${kp(o.clans, 'clans')}${kp(o.flagged, 'comptes signalés')}</div>
      <div class="ad-grid">
        <div class="ad-card"><h3>Inscriptions par jour (30 jours)</h3>${barChart(o.signups.map(s => ({ x: s.d, y: s.n })))}</div>
        <div class="ad-card"><h3>Joueurs actifs par jour</h3>${lineChart(o.daily.map(s => ({ x: s.d, y: s.active })), { color: '#4fe08c' })}</div>
        <div class="ad-card"><h3>Parties classées par jour et par jeu (30 jours)</h3>${stacked(o.games)}</div>
        <div class="ad-card"><h3>Parties par jeu (depuis le début)</h3>${o.by_game.length ? o.by_game.map(g => `<div class="ad-bar"><span style="width:150px">${esc(GAME_NAMES[g.game] || g.game)}</span><i style="width:${Math.max(4, g.n / Math.max(...o.by_game.map(x => x.n)) * 200)}px"></i><span>${g.n} (${g.pvp} contre de vrais joueurs)</span></div>`).join('') : '<p class="ad-msg" style="padding:12px 0">Aucune partie pour l\'instant.</p>'}</div>
        <div class="ad-card"><h3>Meilleurs joueurs (niveau)</h3>${o.top.map(t => `<div class="ad-bar" data-open="${esc(t.id)}" style="cursor:pointer"><span style="width:130px;overflow:hidden;text-overflow:ellipsis">${esc(t.pseudo)}</span><i style="width:${Math.max(6, t.level / topMax * 160)}px"></i><span>niv. ${t.level} · ${t.cards} cartes</span></div>`).join('')}</div>
      </div>`;
    bindOpen();
  }

  function rowsFiltered(onlyFlagged) {
    let rows = (players || []).filter(p => !onlyFlagged || p.flagged || p.flags > 0);
    rows = rows.slice().sort((a, b) => { const x = a[sortKey], y = b[sortKey]; return (x == null ? -1 : y == null ? 1 : (x > y ? 1 : x < y ? -1 : 0)) * sortDir; });
    return rows;
  }
  function viewPlayers(onlyFlagged) {
    const rows = rowsFiltered(onlyFlagged);
    const cols = [['pseudo', 'Pseudo'], ['email', 'E-mail'], ['level', 'Niveau'], ['cards', 'Cartes'], ['cash', 'Argent'], ['packs', 'Paquets'], ['lp', 'PL (mois)'], ['last_seen', 'Dernière activité'], ['created_at', 'Inscrit le'], ['flags', 'Signalements']];
    $('app').innerHTML = `
      ${onlyFlagged ? '' : `<input class="ad-search" id="search" placeholder="Chercher un pseudo ou un e-mail" value="${esc(search)}" />`}
      <p class="ad-sub">${rows.length} joueur${rows.length > 1 ? 's' : ''}${onlyFlagged ? ' signalé(s) par l\'anti-triche' : ''}. Clique sur une ligne pour voir son évolution.</p>
      <div class="ad-card ad-scroll"><table><thead><tr>${cols.map(([k, l]) => `<th data-sort="${k}">${l}${sortKey === k ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(p => `<tr data-open="${esc(p.id)}"><td>${esc(p.pseudo)}${p.flagged ? ' <span class="ad-flag">⚑</span>' : ''}</td><td>${esc(p.email)}${p.confirmed ? '' : ' <span class="ad-flag" title="E-mail non confirmé">?</span>'}</td><td>${p.level}</td><td>${p.cards}</td><td>${fmt(p.cash)}</td><td>${fmt(p.packs)}</td><td>${p.lp}</td><td>${ago(p.last_seen)}</td><td>${day(p.created_at)}</td><td>${p.flags ? `<span class="ad-flag">${p.flags}</span>` : '0'}</td></tr>`).join('')}</tbody></table></div>`;
    document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => { sortDir = sortKey === th.dataset.sort ? -sortDir : -1; sortKey = th.dataset.sort; viewPlayers(onlyFlagged); }));
    $('search')?.addEventListener('input', debounce(async e => { search = e.target.value; players = await load('admin_players', { p_search: search, p_limit: 300, p_offset: 0 }); viewPlayers(false); $('search').focus(); $('search').setSelectionRange(search.length, search.length); }, 350));
    bindOpen();
  }

  async function openPlayer(id) {
    $('modal').hidden = false;
    $('modal').innerHTML = '<div class="ad-sheet"><p class="ad-msg">Chargement…</p></div>';
    const d = await load('admin_player', { p_id: id });
    if (!d) { $('modal').hidden = true; return; }
    const h = d.history || [];
    const sum = d.summary || {};
    $('modal').innerHTML = `<div class="ad-sheet">
      <div class="ad-row" style="justify-content:space-between;align-items:flex-start"><div><h2>${esc(d.pseudo)}${d.flagged ? ' <span class="ad-flag">⚑ signalé</span>' : ''}</h2><p class="ad-sub">${esc(d.email)} · code ami ${esc(d.friend_code)}</p></div><button class="ad-btn" id="close">Fermer</button></div>
      <div class="ad-row"><span class="ad-pill">Inscrit le ${day(d.created_at)}</span><span class="ad-pill">Dernière activité : ${ago(d.last_seen)}</span><span class="ad-pill">Dernière connexion : ${ago(d.last_sign_in)}</span><span class="ad-pill">${d.friends} ami${d.friends > 1 ? 's' : ''}</span><span class="ad-pill">Niveau ${sum.level || 1}</span><span class="ad-pill">${sum.cards || 0} cartes uniques</span>${d.clan ? `<span class="ad-pill">Clan ${esc(d.clan.name)} [${esc(d.clan.tag)}]${d.clan.leader ? ' (chef)' : ''}</span>` : ''}${d.flag_info ? `<span class="ad-pill ad-flag">Anti-triche : ${d.flag_info.n} refus (${esc(d.flag_info.reason)})</span>` : ''}</div>
      <div class="ad-grid">
        <div class="ad-card"><h3>Niveau</h3>${lineChart(h.map(x => ({ x: x.d, y: x.level })), { color: '#ffc43a' })}</div>
        <div class="ad-card"><h3>Cartes uniques</h3>${lineChart(h.map(x => ({ x: x.d, y: x.cards })), { color: '#4fe08c' })}</div>
        <div class="ad-card"><h3>Argent</h3>${lineChart(h.map(x => ({ x: x.d, y: x.cash })), { color: '#ff8a4f' })}</div>
        <div class="ad-card"><h3>Paquets ouverts</h3>${lineChart(h.map(x => ({ x: x.d, y: x.packs })), { color: '#6aa8ff' })}</div>
      </div>
      <div class="ad-card ad-scroll"><h3>Rangs par jeu</h3>${d.ratings.length ? `<table><thead><tr><th>Mois</th><th>Jeu</th><th>PL</th><th>V</th><th>D</th><th>N</th></tr></thead><tbody>${d.ratings.map(r => `<tr><td>${esc(r.season)}</td><td>${esc(GAME_NAMES[r.game] || r.game)}</td><td>${r.lp}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.draws}</td></tr>`).join('')}</tbody></table>` : '<p class="ad-sub">Aucune partie classée.</p>'}</div>
      <div class="ad-card ad-scroll" style="margin-top:14px"><h3>30 dernières parties classées</h3>${d.log.length ? `<table><thead><tr><th>Quand</th><th>Jeu</th><th>Résultat</th><th>Contre</th><th>PL</th></tr></thead><tbody>${d.log.map(l => `<tr style="cursor:default"><td>${ago(l.at)}</td><td>${esc(GAME_NAMES[l.game] || l.game)}</td><td>${l.result === 'win' ? '<span class="ad-ok">victoire</span>' : l.result === 'loss' ? 'défaite' : 'nul'}</td><td>${l.mode === 'pvp' ? 'un joueur' : 'l\'ordi'}</td><td>${l.delta > 0 ? '+' : ''}${l.delta}</td></tr>`).join('')}</tbody></table>` : '<p class="ad-sub">Aucune.</p>'}</div>
      <div class="ad-row"><button class="ad-btn" id="flag">${d.flagged ? 'Retirer le signalement' : 'Signaler ce compte (le retire du classement collectionneurs)'}</button></div></div>`;
    $('close').onclick = () => { $('modal').hidden = true; };
    $('flag').onclick = async () => { await sb.rpc('admin_set_flag', { p_id: id, p_flagged: !d.flagged }); players = await load('admin_players', { p_search: search, p_limit: 300, p_offset: 0 }); openPlayer(id); if (tab !== 'overview') show(); };
  }
  function bindOpen() { document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openPlayer(el.dataset.open))); }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  async function load(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) { $('app').innerHTML = `<p class="ad-msg">${/Accès refusé/.test(error.message) ? 'Accès réservé à l\'administrateur.' : esc(error.message)}</p>`; return null; }
    return data;
  }

  function show() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === tab));
    if (tab === 'overview' && overview) viewOverview();
    else if (tab === 'players' && players) viewPlayers(false);
    else if (tab === 'flagged' && players) viewPlayers(true);
  }

  async function boot() {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) { $('app').innerHTML = '<p class="ad-msg">Tu n\'es pas connecté sur cette adresse.<br><br><a href="index.html">Ouvre le jeu, connecte-toi avec ton compte admin</a>, puis reviens ici.</p>'; return; }
    const { data: admin } = await sb.rpc('am_i_admin');
    if (!admin) { $('app').innerHTML = '<p class="ad-msg">Accès réservé à l\'administrateur.</p>'; return; }
    $('tabs').hidden = false; $('refresh').hidden = false;
    await refresh();
  }
  async function refresh() {
    $('app').innerHTML = '<p class="ad-msg">Chargement…</p>';
    overview = await load('admin_overview'); if (!overview) return;
    players = await load('admin_players', { p_search: search, p_limit: 300, p_offset: 0 }); if (!players) return;
    show();
  }
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; show(); }));
  $('refresh').addEventListener('click', refresh);
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) $('modal').hidden = true; });
  boot();
})();
