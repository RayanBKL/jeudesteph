// ============================================================
// THE ASHTRAY KING — Poker : « Ultimate Poker » contre la banque + tables multijoueurs (Texas Hold'em)
// Les deux modes vivent dans le Casino (onglets). Les tables sont arbitrées par le serveur (supabase/migrations/023_poker.sql).
// ============================================================
const Poker = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (typeof formatCash === 'function' ? formatCash(n) : Math.round(n).toLocaleString('fr-FR'));
  const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const RVAL = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
  const HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];

  const cardHtml = (c, hidden) => {
    if (hidden || !c) return '<div class="pk-card pk-back"></div>';
    const r = c[0] === 'T' ? '10' : c[0], s = c[1];
    return `<div class="pk-card ${s === 'h' || s === 'd' ? 'is-red' : ''}"><span class="pk-r">${r}</span><span class="pk-s">${SUIT[s]}</span></div>`;
  };
  const slotHtml = () => '<div class="pk-card pk-empty"></div>';

  // ── Évaluation (même règle que le serveur) ──
  function score5(h) {
    const r = h.map(c => RVAL[c[0]]).sort((a, b) => b - a);
    const flush = h.every(c => c[1] === h[0][1]);
    const cnt = {}; r.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    let straight = false, hi = 0;
    if (new Set(r).size === 5) { if (r[0] - r[4] === 4) { straight = true; hi = r[0]; } else if (r[0] === 14 && r[1] === 5 && r[4] === 2) { straight = true; hi = 5; } }
    const groups = Object.entries(cnt).map(([v, n]) => [+v, n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const pattern = groups.map(g => g[1]).join('');
    let cat = straight && flush ? 8 : pattern === '41' ? 7 : pattern === '32' ? 6 : flush ? 5 : straight ? 4 : pattern === '311' ? 3 : pattern === '221' ? 2 : pattern === '2111' ? 1 : 0;
    const kick = straight ? [hi] : groups.flatMap(g => Array(g[1]).fill(g[0]));
    let score = cat; for (let i = 0; i < 5; i++) score = score * 15 + (kick[i] || 0);
    return { score, cat, royal: cat === 8 && hi === 14 };
  }
  function best(cards) {
    let top = null; const n = cards.length;
    for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++) for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) {
      const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
      if (!top || s.score > top.score) top = s;
    }
    return top;
  }
  const handName = e => e.royal ? 'Quinte flush royale' : HAND_NAMES[e.cat];
  const freshDeck = () => {
    const d = []; 'AKQJT98765432'.split('').forEach(r => 'shdc'.split('').forEach(s => d.push(r + s)));
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  };
  const cashNow = () => (window.ClickerEngine && ClickerEngine.getCash) ? ClickerEngine.getCash() : 0;

  // ════════════════════════════════════════════════════════
  // ULTIMATE POKER (Ultimate Texas Hold'em contre la banque)
  // ════════════════════════════════════════════════════════
  const U = { phase: 'bet', ante: 0, trips: 0, play: 0, deck: [], me: [], dealer: [], board: [], msg: '', msgClass: '', last: null };
  const TRIPS_PAY = { 3: 3, 4: 4, 5: 7, 6: 8, 7: 30, 8: 40 };    // brelan 3:1, quinte 4:1, couleur 7:1, full 8:1, carré 30:1, quinte flush 40:1 (royale 50:1)
  const BLIND_PAY = { 4: 1, 5: 1.5, 6: 3, 7: 10, 8: 50 };         // quinte 1:1, couleur 3:2, full 3:1, carré 10:1, quinte flush 50:1 (royale 500:1)

  function renderUltimate(content) {
    stopTable();
    const bet = (typeof Casino !== 'undefined' ? Casino.wager(1, 6) : 50);   // « Tapis » : de quoi suivre jusqu'à la mise ×4
    if (U.phase === 'bet' && !U.ante) U.ante = bet;
    const shown = U.phase === 'bet' ? 0 : U.phase === 'pre' ? 0 : U.phase === 'flop' ? 3 : 5;
    const revealDealer = U.phase === 'end';
    const boardCells = [0, 1, 2, 3, 4].map(i => i < shown ? cardHtml(U.board[i]) : slotHtml()).join('');
    const total = U.ante * 2 + U.trips + U.play;
    let controls = '';
    if (U.phase === 'bet') {
      controls = `
        ${Casino.renderWagerControls()}
        <div class="pk-bets-row">
          <button class="btn-secondary pk-mini" id="uth-trips">Trips : ${U.trips ? fmt(U.trips) + ' €' : 'non'}</button>
          <button class="btn-secondary pk-mini" id="uth-rules">Règles</button>
        </div>
        <button class="btn-primary btn-bj-deal pk-main-btn" id="uth-deal">Distribuer (${fmt(U.ante * 2 + U.trips)} €)</button>`;
    } else if (U.phase === 'pre') {
      controls = `<div class="pk-actions"><button class="btn-secondary" id="uth-check">Check</button><button class="btn-primary" id="uth-x4">Miser ×4 (${fmt(U.ante * 4)})</button><button class="btn-primary" id="uth-x3">×3 (${fmt(U.ante * 3)})</button></div>`;
    } else if (U.phase === 'flop') {
      controls = `<div class="pk-actions"><button class="btn-secondary" id="uth-check">Check</button><button class="btn-primary" id="uth-x2">Miser ×2 (${fmt(U.ante * 2)})</button></div>`;
    } else if (U.phase === 'river') {
      controls = `<div class="pk-actions"><button class="btn-secondary" id="uth-fold">Se coucher</button><button class="btn-primary" id="uth-x1">Miser ×1 (${fmt(U.ante)})</button></div>`;
    } else {
      controls = `<button class="btn-primary btn-bj-deal pk-main-btn" id="uth-again">Nouvelle main</button>`;
    }
    const myBest = shown >= 3 && U.me.length ? best(U.me.concat(U.board.slice(0, shown))) : null;
    content.innerHTML = `
      <div class="casino-felt-table pk-table pk-uth">
        <div class="pk-zone"><div class="pk-label">Banque${revealDealer && U.last ? ' · ' + esc(U.last.dealerName) : ''}</div><div class="pk-row">${U.dealer.length ? U.dealer.map(c => cardHtml(c, !revealDealer)).join('') : slotHtml() + slotHtml()}</div></div>
        <div class="pk-zone"><div class="pk-label">Tapis</div><div class="pk-row">${boardCells}</div></div>
        <div class="pk-zone"><div class="pk-label">Toi${myBest ? ' · ' + esc(handName(myBest)) : ''}</div><div class="pk-row">${U.me.length ? U.me.map(c => cardHtml(c)).join('') : slotHtml() + slotHtml()}</div></div>
        <div class="pk-bets">
          <span>Ante <b>${fmt(U.ante)}</b></span><span>Blind <b>${fmt(U.ante)}</b></span>${U.trips ? `<span>Trips <b>${fmt(U.trips)}</b></span>` : ''}${U.play ? `<span>Play <b>${fmt(U.play)}</b></span>` : ''}
        </div>
        <div class="pk-msg ${U.msgClass}">${U.msg || (U.phase === 'bet' ? 'Mise de départ : l\'Ante et la Blind sont égales.' : '')}</div>
        <div class="pk-controls">${controls}</div>
      </div>`;
    bindUltimate(content);
  }

  function bindUltimate(content) {
    const $ = s => content.querySelector(s);
    if (U.phase === 'bet') {
      Casino.bindWagerEvents(content);
      content.querySelectorAll('.casino-chip').forEach(b => b.addEventListener('click', () => { U.ante = Casino.wager(1, 6); renderUltimate(content); }));
      $('#uth-trips')?.addEventListener('click', () => { const unit = typeof Casino.cashMise === 'number' ? Casino.cashMise : Math.max(5, Math.floor(U.ante / 10)); const cyc = [0, unit, unit * 2]; U.trips = cyc[(cyc.indexOf(U.trips) + 1) % cyc.length]; renderUltimate(content); });
      $('#uth-rules')?.addEventListener('click', showRules);
      $('#uth-deal')?.addEventListener('click', () => uthDeal(content));
    }
    $('#uth-check')?.addEventListener('click', () => uthCheck(content));
    $('#uth-x4')?.addEventListener('click', () => uthPlay(content, 4));
    $('#uth-x3')?.addEventListener('click', () => uthPlay(content, 3));
    $('#uth-x2')?.addEventListener('click', () => uthPlay(content, 2));
    $('#uth-x1')?.addEventListener('click', () => uthPlay(content, 1));
    $('#uth-fold')?.addEventListener('click', () => uthFold(content));
    $('#uth-again')?.addEventListener('click', () => { U.phase = 'bet'; U.me = []; U.dealer = []; U.board = []; U.play = 0; U.msg = ''; U.msgClass = ''; renderUltimate(content); });
  }

  function showRules() {
    const el = document.createElement('div');
    el.className = 'soc-modal';
    el.innerHTML = `<div class="soc-modal-card pp-card"><h3>Ultimate Poker</h3>
      <div class="bj-hist-list">
        <p>Tu mises l'<b>Ante</b> et la <b>Blind</b> (égales). Chacun reçoit 2 cartes, 5 cartes communes viennent ensuite.</p>
        <p><b>Avant le flop</b> : check ou mise ×4 / ×3 l'Ante. <b>Au flop</b> : check ou ×2. <b>À la river</b> : ×1 ou tu te couches (tu perds Ante et Blind).</p>
        <p>La banque se qualifie avec une paire ou mieux. Sinon ton Ante est rendue. Le Play gagne ou perd contre la banque.</p>
        <p><b>Blind</b> (si tu gagnes) : quinte 1:1, couleur 3:2, full 3:1, carré 10:1, quinte flush 50:1, royale 500:1 ; moins qu'une quinte : rendue.</p>
        <p><b>Trips</b> (facultatif) : brelan 3:1, quinte 4:1, couleur 7:1, full 8:1, carré 30:1, quinte flush 40:1, royale 50:1.</p>
      </div><button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button></div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); });
    document.body.appendChild(el);
  }

  function uthDeal(content) {
    const cost = U.ante * 2 + U.trips;
    if (U.ante < 5) return showToast('Mise minimale : 5 €', 'error');
    if (!spendMoney(cost)) return showToast('Solde insuffisant pour couvrir tes mises. Utilise l\'avance bancaire.', 'error');
    U.deck = freshDeck();
    U.me = [U.deck.pop(), U.deck.pop()]; U.dealer = [U.deck.pop(), U.deck.pop()];
    U.board = [U.deck.pop(), U.deck.pop(), U.deck.pop(), U.deck.pop(), U.deck.pop()];
    U.play = 0; U.phase = 'pre'; U.msg = 'Check ou mise ×4 / ×3 ?'; U.msgClass = '';
    if (typeof Casino !== 'undefined') Casino.recordBet();
    if (window.SoundFX) SoundFX.click();
    renderUltimate(content);
  }
  function uthCheck(content) {
    if (U.phase === 'pre') { U.phase = 'flop'; U.msg = 'Flop. Check ou mise ×2 ?'; }
    else if (U.phase === 'flop') { U.phase = 'river'; U.msg = 'Turn et river. Mise ×1 ou couche-toi.'; }
    if (window.SoundFX) SoundFX.click();
    renderUltimate(content);
  }
  function uthPlay(content, mult) {
    const cost = U.ante * mult;
    if (!spendMoney(cost)) return showToast('Solde insuffisant pour cette mise.', 'error');
    U.play = cost;
    uthShowdown(content, false);
  }
  function uthFold(content) { uthShowdown(content, true); }

  function uthShowdown(content, folded) {
    const me7 = U.me.concat(U.board), de7 = U.dealer.concat(U.board);
    const mb = best(me7), db = best(de7);
    const qualifies = db.cat >= 1;
    let back = 0; const lines = [];
    const cmp = mb.score > db.score ? 1 : mb.score < db.score ? -1 : 0;
    if (!folded) {
      // Play : 1 pour 1 contre la banque
      if (cmp > 0) back += U.play * 2; else if (cmp === 0) back += U.play;
      // Ante : rendue si la banque ne se qualifie pas
      if (!qualifies) back += U.ante; else if (cmp > 0) back += U.ante * 2; else if (cmp === 0) back += U.ante;
      // Blind : ne paie que si tu gagnes avec une quinte ou mieux ; rendue si moins ; perdue si tu perds
      if (cmp > 0) { const mult = mb.royal ? 500 : BLIND_PAY[mb.cat]; back += mult ? U.ante + U.ante * mult : U.ante; } else if (cmp === 0) back += U.ante;
    }
    // Trips : indépendant de la banque, payé même si tu te couches
    if (U.trips) { const m = mb.royal ? 50 : TRIPS_PAY[mb.cat]; if (m) { back += U.trips * (m + 1); lines.push(`Trips ${handName(mb)} +${fmt(U.trips * m)}`); } }
    const staked = U.ante * 2 + U.trips + U.play;
    const net = Math.round(back - staked);
    if (back > 0) earnMoney(back);
    U.phase = 'end';
    U.last = { dealerName: handName(db) };
    const head = folded ? `Tu te couches : −${fmt(U.ante * 2)}` : cmp > 0 ? `Tu gagnes avec ${handName(mb)} contre ${handName(db)}` : cmp < 0 ? `La banque gagne avec ${handName(db)}` : 'Égalité parfaite';
    U.msg = `${head}${qualifies || folded ? '' : ' (la banque ne se qualifie pas : Ante rendue)'} · ${net > 0 ? '+' : ''}${fmt(net)} €${lines.length ? ' · ' + lines.join(' · ') : ''}`;
    U.msgClass = net > 0 ? 'win' : net < 0 ? 'lose' : 'push';
    if (typeof Casino !== 'undefined') Casino.recordResult(net > 0 ? 'win' : net < 0 ? 'lose' : 'push', Math.abs(net), `Ultimate Poker : ${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))}`);
    if (net > 0 && window.SoundFX) SoundFX.win(); else if (net < 0 && window.SoundFX) SoundFX.cough();
    if (typeof Prestige !== 'undefined' && net > 0) Prestige.emit('poker_win');
    if (typeof saveGame === 'function') saveGame();
    renderUltimate(content);
  }

  // ════════════════════════════════════════════════════════
  // POKER EN TABLE (multijoueur, serveur)
  // ════════════════════════════════════════════════════════
  const BUYINS = [1000, 5000, 20000, 100000, 500000, 2000000];
  let T = { id: null, data: null, timer: null, busy: false, host: null, raise: 0, view: 'lobby', lastNo: 0, sig: '' };
  const sb = () => window.sb;
  const online = () => !!(sb() && window.Account && Account.user);
  const errMsg = e => (e && e.message ? e.message : 'Erreur').replace(/^.*?:\s*/, '');

  function stopTable() { if (T.timer) { clearInterval(T.timer); T.timer = null; } }

  async function renderTable(content) {
    stopTable(); T.host = content; T.sig = '';
    if (!online()) { content.innerHTML = '<div class="pk-table"><p class="soc-empty" style="padding:24px;text-align:center">Connecte-toi pour jouer à une table de poker avec d\'autres joueurs.</p></div>'; return; }
    const { data } = await sb().rpc('poker_my_table');
    if (data) { T.id = data; return openTable(content); }
    T.id = null; renderLobby(content);
  }

  async function renderLobby(content) {
    if (T.view !== 'lobby') T.view = 'lobby';
    const draw = async () => {
      if (!content.isConnected || !content.querySelector('.pk-lobby, .pk-lobby-loading')) return;
      const [{ data }, { data: evData }] = await Promise.all([sb().rpc('poker_tables_list'), sb().rpc('events_list')]);
      const rows = (data || []), cash = rows.filter(t => t.kind !== 'tournoi'), evs = evData || [];
      const keep = { name: content.querySelector('#pk-name')?.value || '' };
      // un évènement auquel je participe vient de démarrer : on m'assoit à la table
      const mine = evs.find(e => e.table_id);
      if (mine) { T.id = mine.table_id; return openTable(content); }
      content.innerHTML = `
        <div class="casino-felt-table pk-table pk-lobby">
          <div class="pk-lobby-head"><strong>Poker à table</strong><span>Texas Hold'em entre joueurs</span></div>
          <div class="pk-sec"><h4>Tables · mise de départ</h4>
            <div class="pk-create">
              <input class="game-input" id="pk-name" maxlength="24" placeholder="Nom de la table (facultatif)" value="${esc(keep.name)}" />
              <select class="game-select-empire" id="pk-buyin">${BUYINS.map(b => `<option value="${b}">Mise de départ ${fmt(b)} €</option>`).join('')}</select>
              <button class="btn-primary" id="pk-open">Ouvrir une table</button>
            </div>
            <div class="pk-list">${cash.length ? cash.map(rowHtml).join('') : '<p class="soc-empty" style="text-align:center;padding:10px">Aucune table ouverte.</p>'}</div>
          </div>
          <div class="pk-sec"><h4>Évènements · tournois de la maison <button class="btn-secondary pk-mini" id="pkt-board">Classement</button></h4>
            <p class="ig-small">Un évènement n'est ouvert qu'à certaines dates : inscris-toi avant l'heure, la table s'ouvre toute seule. 1 500 jetons chacun, blindes +1 niveau toutes les 2 minutes. 60 % du droit d'entrée va dans la cagnotte, 40 % est ta PRIME (qui t'élimine la touche tout de suite). La maison peut ajouter une cagnotte.</p>
            <div class="pk-list">${evs.length ? evs.map(evHtml).join('') : '<p class="soc-empty" style="text-align:center;padding:10px">Aucun évènement de prévu pour le moment.</p>'}</div>
          </div>
        </div>`;
      content.querySelector('#pk-open').addEventListener('click', () => createTable(content));
      content.querySelector('#pkt-board').addEventListener('click', showBoard);
      content.querySelectorAll('[data-join]').forEach(b => b.addEventListener('click', () => joinTable(content, b.dataset.join)));
      content.querySelectorAll('[data-ev]').forEach(b => b.addEventListener('click', () => eventAction(content, b.dataset.ev, b.dataset.act)));
    };
    const when = iso => { const d = new Date(iso); return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
    const evHtml = e => `<div class="pk-trow"><span class="pk-tname"><strong>${esc(e.title)}</strong><em>${e.status === 'running' ? 'en cours' : when(e.starts_at)} · ${e.fee ? 'entrée ' + fmt(e.fee) + ' €' : 'gratuit'}${e.prize ? ' · cagnotte offerte ' + fmt(e.prize) + ' €' : ''}${e.description ? ' · ' + esc(e.description) : ''}</em></span>
        <span class="pk-tseats">${e.regs}/${e.max}</span>${e.status !== 'scheduled' ? '<button class="btn-secondary pk-mini" disabled>En cours</button>' : e.mine ? `<button class="btn-secondary pk-mini" data-ev="${e.id}" data-act="out">Se désinscrire</button>` : `<button class="btn-primary pk-mini" data-ev="${e.id}" data-act="in" ${e.regs >= e.max ? 'disabled' : ''}>S'inscrire</button>`}</div>`;
    const rowHtml = t => t.kind === 'tournoi'
      ? `<div class="pk-trow"><span class="pk-tname"><strong>${esc(t.name)}</strong><em>Entrée ${fmt(t.buyin)} € (prime ${fmt(Math.floor(t.buyin * 0.4))} €) · cagnotte ${fmt(t.pool || 0)} € · ${t.status === 'running' ? 'en cours (niveau ' + (t.level || 1) + ')' : 'inscriptions'} · ${esc(t.players.join(', ') || 'vide')}</em></span>
          <span class="pk-tseats">${t.seats}/${t.max_seats}</span><button class="btn-secondary pk-mini" data-join="${t.id}" ${t.status !== 'registering' || t.seats >= t.max_seats ? 'disabled' : ''}>S'inscrire</button></div>`
      : `<div class="pk-trow"><span class="pk-tname"><strong>${esc(t.name)}</strong><em>${fmt(t.buyin)} € · blindes ${fmt(t.sb)}/${fmt(t.bb)} · ${esc(t.players.join(', ') || 'vide')}</em></span>
          <span class="pk-tseats">${t.seats}/${t.max_seats}${t.playing ? ' · en jeu' : ''}</span><button class="btn-secondary pk-mini" data-join="${t.id}" ${t.seats >= t.max_seats ? 'disabled' : ''}>Rejoindre</button></div>`;
    content.innerHTML = '<div class="pk-lobby-loading"><p class="soc-empty" style="padding:24px;text-align:center">Chargement des tables…</p></div>';
    await draw();
    T.timer = setInterval(() => { if (!document.hidden && content.querySelector('.pk-lobby') && !content.querySelector('#pk-name:focus, #pkt-name:focus')) draw(); }, 5000);
  }

  async function showBoard() {
    const { data } = await sb().rpc('tourney_leaderboard', { p_all: false });
    const rows = data || [];
    const el = document.createElement('div'); el.className = 'soc-modal';
    el.innerHTML = `<div class="soc-modal-card pp-card"><h3>Classement des tournois</h3><p class="soc-empty">Saison en cours · victoires, podiums, gains nets</p>
      <div class="bj-hist-list">${rows.length ? rows.map((r, i) => `<div class="pk-trow"><span class="pk-tseats">${i + 1}</span><span class="pk-tname"><strong>${esc(r.pseudo)}</strong><em>${r.played} tournoi${r.played > 1 ? 's' : ''} · ${r.wins} victoire${r.wins > 1 ? 's' : ''} · ${r.podiums} podium${r.podiums > 1 ? 's' : ''}</em></span><span class="pk-tseats">${r.net >= 0 ? '+' : '−'}${fmt(Math.abs(r.net))} €</span></div>`).join('') : '<p class="soc-empty">Personne n\'a encore fini de tournoi cette saison.</p>'}</div>
      <button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button></div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); });
    document.body.appendChild(el);
  }

  async function syncMoney() {
    // la mise de départ (ou les jetons qui reviennent) passe par un crédit côté serveur : on l'applique tout de suite
    if (window.Account && Account.push) await Account.push();
  }
  async function applyCredits() {
    if (window.Account && Account.applyGrants) await Account.applyGrants();
    if (typeof Casino !== 'undefined' && Casino.updateHeaderDashboard) Casino.updateHeaderDashboard();
  }

  async function createTable(content) {
    const buyin = +content.querySelector('#pk-buyin').value, name = content.querySelector('#pk-name').value;
    if (cashNow() < buyin) return showToast('Tu n\'as pas assez d\'argent pour cette mise de départ.', 'error');
    await syncMoney();
    const { data, error } = await sb().rpc('poker_create', { p_name: name, p_buyin: buyin });
    if (error) return showToast(errMsg(error), 'error');
    await applyCredits(); T.id = data; openTable(content);
  }
  async function eventAction(content, id, act) {
    if (act === 'in') await syncMoney();
    const { error } = await sb().rpc(act === 'in' ? 'event_register' : 'event_unregister', { p_id: id });
    if (error) return showToast(errMsg(error), 'error');
    await applyCredits();
    showToast(act === 'in' ? 'Inscrit ! La table s\'ouvrira toute seule à l\'heure dite : reviens dans le poker à ce moment.' : 'Désinscrit, droit d\'entrée remboursé.', act === 'in' ? 'success' : 'info');
    renderLobby(content);
  }
  async function joinTable(content, id) {
    await syncMoney();
    const { error } = await sb().rpc('poker_join', { p_table: id });
    if (error) return showToast(errMsg(error), 'error');
    await applyCredits(); T.id = id; openTable(content);
  }

  async function leaveTable(content) {
    const tk = T.data && T.data.table.kind === 'tournoi', st = tk && T.data.tourney && T.data.tourney.status;
    const msg = !tk ? 'Tu te couches s\'il y a une main en cours, et tes jetons te reviennent.' : st === 'registering' ? 'Ton droit d\'entrée te sera remboursé.' : 'Tu abandonnes le tournoi : le droit d\'entrée est perdu.';
    if (!(await GameDialog.confirm(msg, { title: tk ? 'Quitter le tournoi ?' : 'Quitter la table ?', ok: 'Quitter', danger: tk && st !== 'registering' }))) return;
    // On coupe d'abord la vérification automatique (sinon elle pouvait revenir après le départ et afficher « tu n'es plus à la table »)
    stopTable(); T.id = null; T.data = null;
    for (let i = 0; i < 40 && T.busy; i++) await new Promise(r => setTimeout(r, 50));
    const { error } = await sb().rpc('poker_leave');
    if (error) showToast(errMsg(error), 'error');
    await applyCredits(); renderLobby(content);
  }

  function openTable(content) {
    T.view = 'table'; T.data = null; T.sig = '';
    content.innerHTML = '<div class="casino-felt-table pk-table"><p class="soc-empty" style="padding:24px;text-align:center">Connexion à la table…</p></div>';
    stopTable();
    const poll = async () => {
      if (!content.isConnected || document.hidden || T.busy || !T.id) return;
      if (!content.querySelector('.pk-table')) return stopTable();
      T.busy = true;
      try {
        const { data, error } = await sb().rpc('poker_get', { p_table: T.id });
        if (error) {
          stopTable(); await applyCredits();
          const id = T.id; T.id = null;
          if (T.data && T.data.table && T.data.table.kind === 'tournoi') { T.data = null; return tourneyOver(content, id); }
          showToast(errMsg(error) === 'Tu n\'es pas à cette table' ? 'Tu n\'es plus à la table : tes jetons te reviennent.' : errMsg(error), 'info'); renderLobby(content); return;
        }
        if (data.tourney && data.tourney.status === 'done') { stopTable(); await applyCredits(); const id = T.id; T.id = null; T.data = null; return tourneyOver(content, id); }
        T.data = data; drawTable(content);
      } finally { T.busy = false; }
    };
    poll(); T.timer = setInterval(poll, 1000);
  }

  // Résultat d'un tournoi : place, gain
  async function tourneyOver(content, id) {
    await applyCredits();
    const { data } = await sb().rpc('poker_tourney_info', { p_table: id });
    renderLobby(content);
    if (!data || !data.tourney) return;
    const me = Account.user.id, pl = (data.tourney.places || []).find(p => p.uid === me);
    if (!pl) return;
    if (pl.place === 1 && typeof Prestige !== 'undefined') Prestige.emit('tourney_win');
    if (pl.place <= 3 && typeof Prestige !== 'undefined') Prestige.emit('tourney_podium');
    const el = document.createElement('div'); el.className = 'soc-modal';
    el.innerHTML = `<div class="soc-modal-card pp-card"><h3>${pl.place === 1 ? 'Tu gagnes le tournoi !' : 'Tournoi terminé'}</h3>
      <p class="soc-empty">${esc(data.name)}</p><p style="font-size:1.1rem">Tu finis <b>${pl.place}${pl.place === 1 ? 'er' : 'e'}</b> sur ${(data.tourney.players || []).length}${pl.prize || pl.bounty ? ` · <b style="color:var(--gold)">+${fmt((pl.prize || 0) + (pl.bounty || 0))} €</b>` : ' · pas de gain'}${pl.bounty ? ` (dont ${fmt(pl.bounty)} € de primes, ${pl.kills || 0} élimination${(pl.kills || 0) > 1 ? 's' : ''})` : ''}</p>
      <div class="bj-hist-list">${(data.tourney.places || []).slice().sort((a, b) => a.place - b.place).map(p => `<div class="pk-trow"><span class="pk-tseats">${p.place}</span><span class="pk-tname"><strong>${esc(p.pseudo)}</strong></span><span class="pk-tseats">${(p.prize || p.bounty) ? '+' + fmt((p.prize || 0) + (p.bounty || 0)) + ' €' : ''}${p.kills ? ' · ' + p.kills + ' ✕' : ''}</span></div>`).join('')}</div>
      <button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button></div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); });
    document.body.appendChild(el);
  }

  function legal(d) {
    const h = d.hand; if (!h || h.phase === 'done') return null;
    const me = d.seats.find(s => s.seat === d.me.seat); if (!me || !h.players[me.seat] ) return null;
    const mine = h.players[me.seat]; const myTurn = h.to_act === me.seat && !mine.folded;
    const toCall = Math.max(0, h.cur - mine.bet);
    const minTo = h.cur + h.minraise, maxTo = mine.bet + me.stack;
    return { myTurn, toCall: Math.min(toCall, me.stack), minTo: Math.min(minTo, maxTo), maxTo, stack: me.stack, bet: mine.bet, cur: h.cur, canRaise: me.stack > toCall };
  }

  function drawTable(content) {
    const d = T.data; if (!d) return;
    const h = d.hand, t = d.table, now = Date.parse(d.now), isT = t.kind === 'tournoi', tr = d.tourney, UN = isT ? '' : ' €';
    const myHole = d.me.hole, L = legal(d);
    const sig = JSON.stringify([d.seats.map(s => [s.seat, s.stack, s.bet, s.folded, s.allin]), h && [h.no, h.phase, h.board, h.to_act, h.cur, h.pot], myHole, d.next_hand_at && 1, tr && [tr.status, tr.level, tr.pool], d.seats.length]);
    // compte à rebours : mis à jour sans tout redessiner
    const dl = h && h.deadline ? Math.max(0, Math.ceil((Date.parse(h.deadline) - now) / 1000)) : null;
    if (sig === T.sig) { const c = content.querySelector('.pk-clock'); if (c && dl != null) c.textContent = dl + ' s'; return; }
    T.sig = sig;
    const board = (h ? h.board : []);
    const boardCells = [0, 1, 2, 3, 4].map(i => board[i] ? cardHtml(board[i]) : slotHtml()).join('');
    const res = h && h.phase === 'done' ? h.result : null;
    const me = d.seats.find(s => s.seat === d.me.seat);
    const seatsHtml = d.seats.filter(s => s.seat !== d.me.seat).map(s => {
      const turn = h && h.to_act === s.seat && h.phase !== 'done';
      const shown = res && res.shown && res.shown[s.seat];
      const cards = s.in_hand && !s.folded ? (shown ? shown.map(c => cardHtml(c)).join('') : '<div class="pk-card pk-back pk-sm"></div><div class="pk-card pk-back pk-sm"></div>') : '';
      const win = res && res.payouts && res.payouts[s.seat];
      return `<div class="pk-seat ${turn ? 'is-turn' : ''} ${s.folded ? 'is-folded' : ''}">
        <span class="pk-sname">${h && h.dealer === s.seat ? '<i class="pk-btn">D</i>' : ''}${esc(s.pseudo)}</span>
        <span class="pk-sstack">${fmt(s.stack)}${UN}${s.allin ? ' · tapis' : ''}</span>
        <span class="pk-scards">${cards}</span>
        ${s.bet ? `<span class="pk-sbet">${fmt(s.bet)}</span>` : ''}${win ? `<span class="pk-swin">+${fmt(win)}</span>` : ''}${turn && dl != null ? `<span class="pk-clock">${dl} s</span>` : ''}</div>`;
    }).join('') || '<div class="pk-seat pk-wait">Tu attends d\'autres joueurs…</div>';
    let controls = '';
    if (L && L.myTurn) {
      const pot = h.pot || 0;
      const presets = [['Mini', L.minTo], ['½ pot', Math.min(L.maxTo, h.cur + Math.ceil(pot / 2))], ['Pot', Math.min(L.maxTo, h.cur + pot)], ['Tapis', L.maxTo]].filter(p => p[1] >= L.minTo || p[0] === 'Tapis');
      if (!T.raise || T.raise < L.minTo || T.raise > L.maxTo) T.raise = L.minTo;
      controls = `
        <div class="pk-actions">
          <button class="btn-secondary" data-act="fold">Se coucher</button>
          ${L.toCall > 0 ? `<button class="btn-primary" data-act="call">Suivre ${fmt(L.toCall)}</button>` : `<button class="btn-primary" data-act="check">Check</button>`}
          ${L.canRaise ? `<button class="btn-primary" data-act="raise">${L.cur > 0 ? 'Relancer à' : 'Miser'} ${fmt(T.raise)}</button>` : ''}
          ${L.canRaise ? `<button class="btn-primary pk-allin" data-act="allin">Tout miser (${fmt(L.stack)})</button>` : ''}
        </div>
        ${L.canRaise ? `<div class="pk-raise"><input type="range" id="pk-slider" min="${L.minTo}" max="${L.maxTo}" step="${Math.max(1, Math.round(t.bb / 2))}" value="${T.raise}">
          <div class="pk-presets">${presets.map(p => `<button class="btn-secondary pk-mini" data-preset="${p[1]}">${p[0]}</button>`).join('')}</div></div>` : ''}`;
    } else if (L && h.phase !== 'done') {
      controls = `<div class="pk-wait-line">${me && h.players[me.seat] && h.players[me.seat].folded ? 'Tu t\'es couché. ' : ''}${h.to_act ? 'Au tour de ' + esc((d.seats.find(s => s.seat === h.to_act) || {}).pseudo || '…') : ''}</div>`;
    } else if (res) {
      const wl = Object.entries(res.payouts || {}).map(([seat, amt]) => { const s = d.seats.find(x => x.seat === +seat); return `${esc(s ? s.pseudo : '?')} +${fmt(amt)}${res.names && res.names[seat] ? ' (' + esc(res.names[seat]) + ')' : ''}`; }).join(' · ');
      controls = `<div class="pk-result">${wl || ''}</div><div class="pk-wait-line">Prochaine main…</div>`;
    } else {
      controls = `<div class="pk-wait-line">${isT && tr && tr.status === 'registering' ? 'On attend les autres joueurs…' : isT ? 'Prochaine main…' : 'En attente d\'un deuxième joueur…'}</div>`;
    }
    content.innerHTML = `
      <div class="casino-felt-table pk-table pk-game">
        <div class="pk-top"><span><strong>${esc(t.name)}</strong> · ${fmt(t.sb)}/${fmt(t.bb)}</span><span class="pk-pot">Pot ${fmt(h ? h.pot : 0)}${UN}</span><button class="btn-secondary pk-mini" id="pk-leave">${isT ? 'Abandonner' : 'Quitter'}</button></div>
        ${isT && tr ? `<div class="pk-tbanner">${tr.status === 'registering' ? `Inscriptions ${d.seats.length}/${t.max_seats} · le tournoi démarre quand la table est complète` : `Niveau ${tr.level || 1} · blindes ${fmt(t.sb)}/${fmt(t.bb)}`} · cagnotte <b>${fmt((tr.pool || 0) + (tr.forfeit || 0))} €</b> · prime <b>${fmt(tr.bounty_each || 0)} €</b> par joueur${tr.kills && me && tr.kills[me.user_id] ? ` · tes éliminations : <b>${tr.kills[me.user_id]}</b>` : ''}</div>` : ''}
        <div class="pk-seats">${seatsHtml}</div>
        <div class="pk-zone"><div class="pk-row">${boardCells}</div></div>
        <div class="pk-me ${L && L.myTurn ? 'is-turn' : ''}">
          <div class="pk-row">${myHole && h ? myHole.map(c => cardHtml(c)).join('') : slotHtml() + slotHtml()}</div>
          <div class="pk-mestack"><b>${fmt(me ? me.stack : 0)}${UN}</b>${h && me && h.players[me.seat] && h.players[me.seat].bet ? `<span class="pk-sbet">${fmt(h.players[me.seat].bet)}</span>` : ''}${L && L.myTurn && dl != null ? `<span class="pk-clock">${dl} s</span>` : ''}</div>
        </div>
        <div class="pk-controls">${controls}</div>
      </div>`;
    content.querySelector('#pk-leave').addEventListener('click', () => leaveTable(content));
    content.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => tableAct(content, b.dataset.act)));
    content.querySelector('#pk-slider')?.addEventListener('input', e => { T.raise = +e.target.value; const b = content.querySelector('[data-act="raise"]'); if (b && L) b.textContent = `${L.cur > 0 ? 'Relancer à' : 'Miser'} ${fmt(T.raise)}`; });
    content.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { T.raise = +b.dataset.preset; T.sig = ''; drawTable(content); }));
    // fin de main : musique et argent à jour
    if (h && h.phase === 'done' && h.no !== T.lastNo) { T.lastNo = h.no; applyCredits(); if (res && res.payouts && me && res.payouts[me.seat] && typeof Prestige !== 'undefined') Prestige.emit('poker_win'); }
  }

  async function tableAct(content, act) {
    if (T.busy) return; T.busy = true;
    try {
      const L = legal(T.data);
      const amount = act === 'raise' ? (T.raise >= L.maxTo ? L.maxTo : T.raise) : act === 'allin' ? L.maxTo : 0;
      const { data, error } = await sb().rpc('poker_action', { p_table: T.id, p_action: act === 'raise' && amount >= L.maxTo ? 'allin' : act, p_amount: amount });
      if (error) showToast(errMsg(error), 'error'); else { T.data = data; T.sig = ''; drawTable(content); }
    } finally { T.busy = false; }
  }

  // Assis à une table (pour demander confirmation avant de quitter l'onglet)
  const atTable = () => !!(T.id && T.view === 'table');
  async function leaveSilently() {
    stopTable();
    try { await sb().rpc('poker_leave'); } catch (e) {}
    T.id = null; T.data = null; T.view = 'lobby';
    await applyCredits();
  }

  return { renderUltimate, renderTable, stopTable, best, handName, atTable, leaveSilently };
})();

if (typeof window !== 'undefined') window.Poker = Poker;
