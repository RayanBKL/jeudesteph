// ============================================================
// THE ASHTRAY KING — Tableau de bord admin
// Les données viennent de fonctions serveur qui vérifient que tu es admin (table admin_users).
// On utilise la session du jeu : connecte-toi dans le jeu (même navigateur, même adresse), puis ouvre cette page.
// ============================================================
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' Md'; if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M'; if (n >= 1e4) return Math.round(n / 1e3) + ' k'; return Math.round(n).toLocaleString('fr-FR'); };
  const GAME_NAMES = { ut: 'Ultimate Comptoir', bataille: 'Bataille', des421: '421', pbc: 'Pierre-Briquet-Clope', quiz: 'Quiz (retiré)', course: 'Course (retirée)' };
  const COLORS = { ut: '#4fe08c', bataille: '#ffc43a', des421: '#ff8a4f', pbc: '#e2322b', quiz: '#6aa8ff', course: '#c58bff' };
  let tab = 'overview', events = null, overview = null, reports = null, players = null, sortKey = 'last_seen', sortDir = -1, search = '';

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

  function ask({ title, text, input, ok = 'OK', danger = false }) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'ad-modal'; el.style.zIndex = 40; el.style.alignItems = 'center';
      el.innerHTML = `<div class="ad-sheet" style="max-width:420px"><h2>${esc(title)}</h2><p class="ad-sub">${esc(text || '')}</p>
        ${input ? `<input class="ad-search" id="ask-in" placeholder="${esc(input)}" style="max-width:none" />` : ''}
        <div class="ad-row" style="justify-content:flex-end"><button class="ad-btn" id="ask-no">Annuler</button><button class="ad-btn" id="ask-yes" style="${danger ? 'background:#b8211b' : 'background:#ffc43a;color:#120a04'}">${esc(ok)}</button></div></div>`;
      document.body.appendChild(el);
      const done = v => { el.remove(); resolve(v); };
      el.querySelector('#ask-no').onclick = () => done(null);
      el.querySelector('#ask-yes').onclick = () => done(input ? el.querySelector('#ask-in').value : true);
      (el.querySelector('#ask-in') || el.querySelector('#ask-yes')).focus();
    });
  }
  const parseAmount = v => { const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

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
      <div class="ad-card" style="margin-top:14px"><h3>Crédits (argent du joueur)</h3>
        <p class="ad-sub">Solde enregistré : <b>${fmt(d.cash)} €</b>. Le changement est appliqué dans le jeu du joueur à sa prochaine connexion ou dans la minute s'il est en ligne.</p>
        <div class="ad-row"><input class="ad-search" id="cash-amount" placeholder="Montant (ex. 50000)" style="margin:0;max-width:200px" /><input class="ad-search" id="cash-note" placeholder="Message au joueur (facultatif)" style="margin:0;max-width:260px" />
        <button class="ad-btn" data-cash="add">Ajouter</button><button class="ad-btn" data-cash="sub">Retirer</button><button class="ad-btn" data-cash="set">Fixer le solde à</button></div></div>
      <div class="ad-card ad-scroll" style="margin-top:14px"><h3>Journal des actions admin sur ce joueur</h3><div id="ad-log"><p class="ad-sub">Chargement…</p></div></div>
      <div class="ad-row" style="justify-content:space-between;margin-top:18px"><button class="ad-btn" id="flag">${d.flagged ? 'Retirer le signalement' : 'Signaler ce compte (le retire du classement collectionneurs)'}</button>${d.is_admin ? '' : '<button class="ad-btn" id="del" style="background:#7a1812">Supprimer ce compte</button>'}</div></div>`;
    $('close').onclick = () => { $('modal').hidden = true; };
    const renderLog = async () => {
      const l = await sb.rpc('admin_log_list', { p_target: id, p_limit: 20 });
      const rows = (l.data || []);
      $('ad-log').innerHTML = rows.length ? `<table><tbody>${rows.map(x => `<tr style="cursor:default"><td>${ago(x.at)}</td><td>${esc(x.action)}</td><td>${esc(x.detail && x.detail.mode ? (x.detail.mode === 'set' ? 'fixé à ' : (x.detail.montant >= 0 ? '+' : '')) + fmt(x.detail.montant) + ' €' : '')} ${esc((x.detail && x.detail.note) || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="ad-sub">Aucune action.</p>';
    };
    renderLog();
    document.querySelectorAll('[data-cash]').forEach(b => b.addEventListener('click', async () => {
      const amt = parseAmount($('cash-amount').value);
      if (amt === null || amt < 0) { await ask({ title: 'Montant invalide', text: 'Entre un nombre positif, par exemple 50000.', ok: 'OK' }); return; }
      const mode = b.dataset.cash === 'set' ? 'set' : 'add', value = b.dataset.cash === 'sub' ? -amt : amt;
      const label = mode === 'set' ? `Fixer le solde de ${d.pseudo} à ${fmt(amt)} € ?` : `${value >= 0 ? 'Ajouter' : 'Retirer'} ${fmt(Math.abs(value))} € ${value >= 0 ? 'à' : 'de'} ${d.pseudo} ?`;
      if (!(await ask({ title: 'Confirmer', text: label, ok: 'Confirmer' }))) return;
      const r = await sb.rpc('admin_grant_cash', { p_id: id, p_mode: mode, p_amount: value, p_note: $('cash-note').value || null });
      if (r.error) { await ask({ title: 'Erreur', text: r.error.message, ok: 'OK' }); return; }
      $('cash-amount').value = ''; $('cash-note').value = ''; renderLog();
    }));
    $('del')?.addEventListener('click', async () => {
      const typed = await ask({ title: 'Supprimer ce compte ?', text: `Définitif : le compte, la partie, les rangs, les amis. Pour confirmer, écris le pseudo « ${d.pseudo} ».`, input: 'Pseudo du joueur', ok: 'Supprimer', danger: true });
      if (typed === null) return;
      const r = await sb.rpc('admin_delete_user', { p_id: id, p_confirm: typed });
      if (r.error) { await ask({ title: 'Suppression impossible', text: r.error.message, ok: 'OK' }); return; }
      $('modal').hidden = true; await refresh();
    });
    $('flag').onclick = async () => { await sb.rpc('admin_set_flag', { p_id: id, p_flagged: !d.flagged }); players = await load('admin_players', { p_search: search, p_limit: 300, p_offset: 0 }); openPlayer(id); if (tab !== 'overview') show(); };
  }
  function bindOpen() { document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openPlayer(el.dataset.open))); }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  async function load(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) { $('app').innerHTML = `<p class="ad-msg">${/Accès refusé/.test(error.message) ? 'Accès réservé à l\'administrateur.' : esc(error.message)}</p>`; return null; }
    return data;
  }

  function viewMessages() {
    const rows = reports || [];
    const open = rows.filter(r => !r.handled && !r.deleted);
    $('msg-count').textContent = open.length ? `(${open.length})` : '';
    $('app').innerHTML = `<p class="ad-sub">${open.length} signalement${open.length > 1 ? 's' : ''} à traiter. Un message supprimé disparaît du chat des deux côtés. Les messages sont de toute façon effacés après 30 jours.</p>
      <div class="ad-card ad-scroll">${rows.length ? `<table><thead><tr><th>Quand</th><th>Auteur</th><th>Message</th><th>Salon</th><th>Signalé par</th><th></th></tr></thead><tbody>${rows.map(r => `<tr style="cursor:default${r.handled || r.deleted ? ';opacity:.5' : ''}">
        <td>${ago(r.at)}</td><td><a href="#" data-open="${esc(r.sender)}">${esc(r.sender_pseudo)}</a></td><td style="white-space:normal;max-width:380px">${esc(r.body)}</td><td>${r.scope === 'clan' ? 'clan' : 'privé'}</td><td>${esc(r.reporter_pseudo)}</td>
        <td>${r.deleted ? 'supprimé' : r.handled ? 'traité' : `<button class="ad-btn" data-del-msg="${r.message_id}">Supprimer</button> <button class="ad-btn" data-dismiss="${r.id}">Ignorer</button>`}</td></tr>`).join('')}</tbody></table>` : '<p class="ad-sub">Aucun signalement.</p>'}</div>`;
    document.querySelectorAll('[data-del-msg]').forEach(b => b.addEventListener('click', async () => {
      if (!(await ask({ title: 'Supprimer ce message ?', text: 'Il disparaît du chat.', ok: 'Supprimer', danger: true }))) return;
      await sb.rpc('admin_chat_delete', { p_message: +b.dataset.delMsg, p_handled: true }); reports = await load('admin_chat_reports'); viewMessages();
    }));
    document.querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', async () => { await sb.rpc('admin_chat_dismiss', { p_report: +b.dataset.dismiss }); reports = await load('admin_chat_reports'); viewMessages(); }));
    document.querySelectorAll('a[data-open]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openPlayer(a.dataset.open); }));
  }

  // ── Évènements : tournois de poker programmés par l'admin ──
  const STATUS = { scheduled: 'à venir', running: 'en cours', done: 'terminé', cancelled: 'annulé' };
  function viewEvents() {
    const rows = events || [];
    const soon = new Date(Date.now() + 3600e3 * 24); soon.setMinutes(soon.getMinutes() - soon.getTimezoneOffset());
    $('app').innerHTML = `<p class="ad-sub">Un évènement = un tournoi de poker de 2 à 6 joueurs. Les joueurs s'inscrivent à l'avance ; à l'heure dite la table s'ouvre toute seule (moins de 2 inscrits : annulé et remboursé). La cagnotte offerte s'ajoute aux droits d'entrée et se partage entre les premiers.</p>
      <div class="ad-card"><h3>Créer un évènement</h3>
        <div class="ad-form" style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
          <label>Titre<input id="ev-title" maxlength="40" placeholder="Tournoi du week-end"></label>
          <label>Départ<input id="ev-start" type="datetime-local" value="${soon.toISOString().slice(0, 16)}"></label>
          <label>Droit d'entrée (€, 0 = gratuit)<input id="ev-fee" type="number" min="0" value="0"></label>
          <label>Cagnotte offerte (€)<input id="ev-prize" type="number" min="0" value="100000"></label>
          <label>Joueurs max<select id="ev-max"><option>2</option><option>3</option><option>4</option><option>5</option><option selected>6</option></select></label>
          <label style="grid-column:1/-1">Description (facultatif)<input id="ev-desc" maxlength="240" placeholder="Le gagnant empoche la cagnotte"></label>
        </div>
        <p><button class="ad-btn" id="ev-create">Programmer</button> <span id="ev-msg" class="ad-sub"></span></p>
      </div>
      <div class="ad-card ad-scroll"><h3>Évènements</h3>${rows.length ? `<table><thead><tr><th>Titre</th><th>Départ</th><th>Entrée</th><th>Cagnotte</th><th>Inscrits</th><th>État</th><th></th></tr></thead><tbody>${rows.map(e => `<tr style="cursor:default${e.status === 'cancelled' ? ';opacity:.5' : ''}"><td>${esc(e.title)}</td><td>${new Date(e.starts_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${fmt(e.fee)} €</td><td>${fmt(e.prize)} €</td><td title="${esc((e.players || []).join(', '))}">${e.regs}/${e.max}</td><td>${STATUS[e.status] || e.status}</td><td>${e.status === 'scheduled' ? `<button class="ad-btn" data-cancel-ev="${e.id}">Annuler</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="ad-sub">Aucun évènement.</p>'}</div>`;
    $('ev-create').onclick = async () => {
      const title = $('ev-title').value.trim(), start = $('ev-start').value;
      if (title.length < 2 || !start) { $('ev-msg').textContent = 'Titre et date obligatoires.'; return; }
      const { error } = await sb.rpc('admin_event_create', { p_title: title, p_desc: $('ev-desc').value, p_starts: new Date(start).toISOString(), p_fee: +$('ev-fee').value || 0, p_max: +$('ev-max').value, p_prize: +$('ev-prize').value || 0 });
      if (error) { $('ev-msg').textContent = error.message; return; }
      events = await load('admin_events'); viewEvents();
    };
    document.querySelectorAll('[data-cancel-ev]').forEach(b => b.addEventListener('click', async () => {
      if (!(await ask({ title: 'Annuler cet évènement ?', text: 'Les inscrits sont remboursés.', ok: 'Annuler l\'évènement', danger: true }))) return;
      const { error } = await sb.rpc('admin_event_cancel', { p_id: b.dataset.cancelEv }); if (error) await ask({ title: 'Impossible', text: error.message });
      events = await load('admin_events'); viewEvents();
    }));
  }

  function show() {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === tab));
    if (tab === 'overview' && overview) viewOverview();
    else if (tab === 'players' && players) viewPlayers(false);
    else if (tab === 'flagged' && players) viewPlayers(true);
    else if (tab === 'messages' && reports) viewMessages();
    else if (tab === 'events' && events) viewEvents();
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
    events = await load('admin_events') || [];
    reports = await load('admin_chat_reports') || []; $('msg-count').textContent = reports.filter(r => !r.handled && !r.deleted).length ? `(${reports.filter(r => !r.handled && !r.deleted).length})` : '';
    show();
  }
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; show(); }));
  $('refresh').addEventListener('click', refresh);
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) $('modal').hidden = true; });
  boot();
})();
