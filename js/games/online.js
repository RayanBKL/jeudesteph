// ============================================================
// THE ASHTRAY KING — Parties en ligne contre de vrais joueurs
// Pierre-Briquet-Clope, 421 et Quiz. Le serveur arbitre tout (dés, coups cachés,
// chrono, forfait) : cet écran ne fait qu'afficher l'état et envoyer les coups.
// ============================================================

const Online = (() => {
  const TOTAL_TIME = { pbc: 25, des421: 45, quiz: 10 };
  const GAME_IDS = ['pbc', 'des421', 'quiz'];
  const cache = {};
  let run = null;          // partie en cours d'affichage
  let searchTimer = null;

  const sb = () => window.sb;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const avatar = p => `<span class="bd-avatar">${p && p.avatar_small && /^data:image\//.test(p.avatar_small) ? `<img src="${esc(p.avatar_small)}" alt="">` : `<b>${esc(((p && p.pseudo) || '?').slice(0, 1).toUpperCase())}</b>`}</span>`;

  async function profileOf(id) {
    if (cache[id]) return cache[id];
    const { data } = await sb().from('profiles').select('pseudo, avatar_small').eq('id', id).maybeSingle();
    return (cache[id] = data || { pseudo: 'Joueur' });
  }

  function available() { return !!(sb() && window.Account && Account.user); }

  function stopAll() {
    clearInterval(searchTimer); searchTimer = null;
    if (run) { clearInterval(run.poll); clearInterval(run.tick); run = null; }
  }

  // ── Choix du mode (ordi / vrai joueur) ─────────────────────
  async function chooser(container, game, localStart) {
    stopAll();
    const name = League.GAMES[game].name;
    let resume = null;
    if (available()) {
      const { data } = await sb().rpc('my_active_match', { p_game: game });
      resume = data || null;
    }
    container.innerHTML = `
      <div class="mg-screen">
        ${GameUI.header(game, 'Choisis ton adversaire')}
        <div class="on-modes">
          ${resume ? `<button class="on-mode on-mode-resume" data-resume><strong>Reprendre ma partie en cours</strong><span>Un adversaire t'attend</span></button>` : ''}
          <button class="on-mode" data-online ${available() ? '' : 'disabled'}><strong>Contre un vrai joueur</strong><span>Les points comptent double-ish : victoire ×1,5. Seul moyen de monter jusqu'au sommet.</span></button>
          <button class="on-mode" data-local><strong>Contre l'ordinateur</strong><span>Plafonné au rang Buraliste I. Parfait pour s'entraîner.</span></button>
        </div>
      </div>`;
    GameUI.bindBack(container);
    container.querySelector('[data-local]').addEventListener('click', localStart);
    container.querySelector('[data-online]').addEventListener('click', () => search(container, game, localStart));
    container.querySelector('[data-resume]')?.addEventListener('click', () => watch(container, resume, game, localStart));
  }

  // ── Recherche d'un adversaire ──────────────────────────────
  function search(container, game, localStart) {
    stopAll();
    const t0 = Date.now();
    container.innerHTML = `
      <div class="mg-screen mg-search">
        ${GameUI.header(game, 'Recherche d\'un adversaire')}
        <div class="on-searching">
          <div class="on-spinner"></div>
          <strong>On cherche quelqu'un au comptoir…</strong>
          <span id="on-wait">0 s</span>
          <p class="mg-hint" id="on-hint">Un autre joueur doit lancer la même recherche en même temps.</p>
          <div class="mg-actions">
            <button class="btn-empire btn-empire-secondary" id="on-cancel">Annuler</button>
            <button class="btn-empire btn-empire-primary hidden" id="on-vs-ai">Jouer contre l'ordi</button>
          </div>
        </div>
      </div>`;
    GameUI.bindBack(container);
    const leave = async () => { clearInterval(searchTimer); searchTimer = null; try { await sb().rpc('mm_cancel'); } catch (e) {} };
    container.querySelector('#on-cancel').addEventListener('click', async () => { await leave(); chooser(container, game, localStart); });
    container.querySelector('#on-vs-ai').addEventListener('click', async () => { await leave(); localStart(); });
    container.querySelector('[data-mg-back]').addEventListener('click', leave);

    const step = async () => {
      if (!container.querySelector('.mg-search')) { await leave(); return; }
      const secs = Math.floor((Date.now() - t0) / 1000);
      const w = container.querySelector('#on-wait'); if (w) w.textContent = `${secs} s`;
      if (secs >= 20) container.querySelector('#on-vs-ai')?.classList.remove('hidden');
      const { data, error } = await sb().rpc('mm_join', { p_game: game });
      if (error) {
        const h = container.querySelector('#on-hint'); if (h) h.textContent = 'Connexion au serveur impossible, on réessaie…';
        return;
      }
      if (data && data.match_id) { clearInterval(searchTimer); searchTimer = null; watch(container, data.match_id, game, localStart); }
    };
    step();
    searchTimer = setInterval(step, 2000);
  }

  // ── Partie en direct ───────────────────────────────────────
  async function watch(container, matchId, game, localStart) {
    stopAll();
    run = { container, id: matchId, game, localStart, sig: '', data: null, offset: 0, held: [false, false, false], myChoice: null, prevQ: null, prevI: -1, notice: '', over: false, checking: false, pending: false };
    await refresh();
    run.poll = setInterval(refresh, 1000);
    run.tick = setInterval(tick, 250);
  }

  async function refresh() {
    const r = run; if (!r || r.pending) return;
    if (!r.container.isConnected || !r.container.querySelector('.mg-online')) { if (r.data) { stopAll(); return; } }
    r.pending = true;
    try {
      const { data, error } = await sb().rpc('match_get', { p_match: r.id });
      if (run !== r) return;
      if (error) { setNotice('Connexion perdue, on réessaie…'); return; }
      apply(data);
    } finally { r.pending = false; }
  }

  async function apply(data) {
    const r = run; if (!r || !data) return;
    r.offset = Date.parse(data.now) - Date.now();
    // Nouvelle question du quiz : on garde l'ancienne pour montrer la bonne réponse
    if (data.game === 'quiz' && r.data && r.data.state.i !== data.state.i) {
      r.prevQ = r.data.state.q; r.myChoice = null;
      r.prevLast = data.state.last;
    }
    if (data.game === 'des421' && data.state.rolls[data.me] === 0) r.held = [false, false, false];
    const me = data.me, opp = 1 - me;
    const ids = [data.p1, data.p2];
    r.me = await profileOf(ids[me]); r.opp = await profileOf(ids[opp]);
    r.meId = ids[me];
    r.data = data;
    const sig = JSON.stringify([data.state, data.mine, data.status, r.held, r.myChoice, r.notice]);
    if (sig === r.sig) return;
    r.sig = sig;
    if (data.status !== 'active') return finish();
    render();
  }

  function setNotice(t) { if (run) { run.notice = t; } }

  // Compte à rebours et temps écoulé (appelé 4 fois par seconde)
  function tick() {
    const r = run; if (!r || !r.data || r.data.status !== 'active' || !r.data.deadline) return;
    const left = (Date.parse(r.data.deadline) - (Date.now() + r.offset)) / 1000;
    const fill = r.container.querySelector('.qz-timer-fill');
    if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, left / TOTAL_TIME[r.game]))})`;
    const t = r.container.querySelector('.on-time'); if (t) t.textContent = `${Math.max(0, Math.ceil(left))} s`;
    if (left < -1.2 && !r.checking) {
      r.checking = true;
      sb().rpc('match_timeout_check', { p_match: r.id }).then(({ data }) => { if (run === r && data) apply(data); }).finally(() => { if (run === r) r.checking = false; });
    }
  }

  function head(r, subtitle) {
    const s = r.data.state, me = r.data.me, opp = 1 - me;
    return `
      ${GameUI.header(r.game, subtitle)}
      <div class="mg-scoreboard on-board">
        <div class="mg-score-side">${avatar(r.me)}<span>Toi</span><strong>${s.scores[me]}</strong></div>
        <div class="mg-round"><span class="on-time"></span></div>
        <div class="mg-score-side">${avatar(r.opp)}<span>${esc(r.opp.pseudo)}</span><strong>${s.scores[opp]}</strong></div>
      </div>
      <div class="qz-timer"><div class="qz-timer-fill" style="animation:none"></div></div>`;
  }

  function render() {
    const r = run, d = r.data, c = r.container;
    const body = d.game === 'pbc' ? bodyPbc(r) : d.game === 'des421' ? bodyDes(r) : bodyQuiz(r);
    c.innerHTML = `<div class="mg-screen mg-online mg-${d.game === 'des421' ? '421' : d.game}">${head(r, d.game === 'pbc' ? 'Premier à 3 points' : d.game === 'des421' ? 'Premier à 2 manches' : 'Question ' + (d.state.i + 1) + '/' + d.state.total)}${body}${r.notice ? `<p class="mg-hint">${esc(r.notice)}</p>` : ''}</div>`;
    c.querySelector('[data-mg-back]').addEventListener('click', leaveMatch);
    c.querySelectorAll('[data-mg-help]').forEach(b => b.addEventListener('click', () => GameUI.showRules(b.dataset.mgHelp)));
    bindBody(r);
    tick();
  }

  async function leaveMatch() {
    const r = run; if (!r) return;
    if (r.data && r.data.status === 'active' && !(await GameDialog.confirm('Quitter la partie, c\'est la perdre.', { title: 'Abandonner ?', ok: 'Quitter', danger: true }))) return;
    const id = r.id; stopAll();
    if (r.data && r.data.status === 'active') await sb().rpc('match_forfeit', { p_match: id });
    GameHub.render();
  }

  // ── Pierre-Briquet-Clope ──
  const PBC_NAMES = { pierre: 'Pierre', briquet: 'Briquet', clope: 'Clope' };
  const PBC_VERB = { pierre: 'La pierre casse le briquet', briquet: 'Le briquet allume la clope', clope: 'La clope enfume la pierre' };
  function bodyPbc(r) {
    const d = r.data, s = d.state, me = d.me, opp = 1 - me, last = s.last;
    const locked = s.locked[me];
    let verdict = locked ? `Coup joué. ${esc(r.opp.pseudo)} réfléchit…` : 'Choisis ton coup';
    let mine = '<span class="pbc-q">?</span>', his = '<span class="pbc-q">?</span>', cls = '';
    if (last) {
      const my = last.moves[me], hers = last.moves[opp];
      if (!locked) {
        mine = my ? PBC.ICONS[my] : '<span class="pbc-q">?</span>'; his = hers ? PBC.ICONS[hers] : '<span class="pbc-q">?</span>';
        const res = last.result === 0 ? 'draw' : last.result === -1 ? 'void' : (last.result - 1 === me ? 'win' : 'loss');
        cls = 'is-' + res;
        verdict = res === 'draw' ? 'Égalité, on remet ça' : res === 'void' ? 'Personne n\'a joué, manche annulée'
          : res === 'win' ? (my ? PBC_VERB[my] : 'Il n\'a pas joué') : (hers ? PBC_VERB[hers] : 'Tu n\'as pas joué');
      }
    }
    return `
      <div class="pbc-arena">
        <div class="pbc-hand pbc-hand-ai ${last && !locked ? 'is-shown' : ''}">${his}</div>
        <div class="pbc-verdict ${cls}">${verdict}</div>
        <div class="pbc-hand pbc-hand-me ${last && !locked ? 'is-shown' : ''}">${mine}</div>
      </div>
      <div class="pbc-choices">
        ${Object.keys(PBC_NAMES).map(k => `<button class="pbc-choice" data-move="${k}" ${locked ? 'disabled' : ''}>${PBC.ICONS[k]}<span>${PBC_NAMES[k]}</span></button>`).join('')}
      </div>`;
  }

  // ── 421 ──
  function bodyDes(r) {
    const d = r.data, s = d.state, me = d.me, opp = 1 - me, last = s.last;
    const dice = d.mine.dice, rolls = s.rolls[me], done = s.done[me];
    const ev = dice ? Des421.evaluate(dice) : null;
    let lastLine = '&nbsp;';
    if (last && rolls === 0) {
      const a = Des421.evaluate(last.dice[me]).name, b = Des421.evaluate(last.dice[opp]).name;
      const res = last.result === 0 ? 'Manche nulle, on rejoue' : (last.result - 1 === me ? 'Manche pour toi' : `Manche pour ${esc(r.opp.pseudo)}`);
      lastLine = `${res} · toi ${esc(a)} · lui ${esc(b)}`;
    }
    const oppDice = last && rolls === 0 ? last.dice[opp] : null;
    return `
      <div class="d421-ai ${s.done[opp] ? '' : 'is-waiting'}">
        <span class="d421-label">${esc(r.opp.pseudo)}</span>
        <div class="d421-dice d421-dice-sm">${(oppDice || [0, 0, 0]).map(v => v ? Des421.diceSVG(v) : '<div class="die-empty"></div>').join('')}</div>
        <span class="d421-combo">${s.done[opp] ? 'a fini son tour' : s.rolls[opp] ? `lancer ${s.rolls[opp]}/3…` : 'réfléchit'}</span>
      </div>
      <div class="d421-table">
        <div class="d421-dice">${(dice || [0, 0, 0]).map((v, i) => v ? `<button class="die-btn" data-die="${i}" ${done || rolls === 0 || rolls >= 3 ? 'disabled' : ''}>${Des421.diceSVG(v, r.held[i])}</button>` : '<div class="die-empty die-empty-lg"></div>').join('')}</div>
        <div class="d421-combo d421-combo-lg">${ev ? esc(ev.name) : 'Lance les dés'}</div>
        <p class="mg-hint">${done ? 'En attente de l\'adversaire…' : rolls > 0 && rolls < 3 ? 'Touche un dé pour le garder, puis relance les autres' : lastLine}</p>
      </div>
      <div class="mg-actions">
        <button class="btn-empire btn-empire-secondary" data-act="stop" ${done || rolls === 0 ? 'disabled' : ''}>Je garde</button>
        <button class="btn-empire btn-empire-primary" data-act="roll" ${done || rolls >= 3 ? 'disabled' : ''}>Lancer (${3 - rolls})</button>
      </div>`;
  }

  // ── Quiz ──
  function bodyQuiz(r) {
    const d = r.data, s = d.state, me = d.me, answered = s.answered[me], q = s.q;
    let hint = answered ? 'Réponse envoyée, on attend l\'autre…' : '&nbsp;';
    if (!answered && r.prevQ && r.prevLast) {
      const pts = r.prevLast.points[me], good = r.prevQ.choices[r.prevLast.answer];
      hint = `${pts > 0 ? `Bien vu ! +${pts}` : 'Raté'} · c'était « ${esc(good)} »`;
    }
    return `
      <div class="qz-photo"><img src="${esc(q.img)}" alt="" /></div>
      <div class="qz-choices">
        ${q.choices.map((c, k) => `<button class="qz-choice ${r.myChoice === k ? 'is-picked' : ''}" data-k="${k}" ${answered ? 'disabled' : ''}>${esc(c)}</button>`).join('')}
      </div>
      <p class="mg-hint">${hint}</p>`;
  }

  async function send(promise) {
    const r = run;
    const { data, error } = await promise;
    if (run !== r) return;
    if (error) { setNotice((error.message || 'Coup refusé').replace(/^.*?:\s*/, '')); r.sig = ''; setTimeout(() => { if (run === r) { r.notice = ''; r.sig = ''; } }, 2500); }
    else { r.notice = ''; }
    if (data) apply(data); else { r.sig = ''; apply(r.data); }
  }

  function bindBody(r) {
    const c = r.container, id = r.id;
    c.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
      c.querySelectorAll('[data-move]').forEach(x => x.disabled = true);
      send(sb().rpc('pbc_move', { p_match: id, p_move: b.dataset.move }));
    }));
    c.querySelectorAll('[data-die]').forEach(b => b.addEventListener('click', () => {
      r.held[+b.dataset.die] = !r.held[+b.dataset.die];
      r.sig = ''; apply(r.data);
    }));
    c.querySelector('[data-act="roll"]')?.addEventListener('click', e => {
      e.target.disabled = true;
      const keep = r.data.state.rolls[r.data.me] > 0 ? r.held : [false, false, false];
      r.held = [false, false, false];
      if (window.SoundFX && SoundFX.click) SoundFX.click();
      send(sb().rpc('d421_roll', { p_match: id, p_keep: keep }));
    });
    c.querySelector('[data-act="stop"]')?.addEventListener('click', e => {
      e.target.disabled = true;
      send(sb().rpc('d421_stop', { p_match: id }));
    });
    c.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
      r.myChoice = +b.dataset.k;
      c.querySelectorAll('[data-k]').forEach(x => x.disabled = true);
      b.classList.add('is-picked');
      send(sb().rpc('quiz_answer', { p_match: id, p_i: r.data.state.i, p_choice: +b.dataset.k }));
    }));
  }

  // ── Fin de partie ──
  async function finish() {
    const r = run; if (!r || r.over) return;
    r.over = true;
    clearInterval(r.poll); clearInterval(r.tick);
    const d = r.data, s = d.state, me = d.me, opp = 1 - me;
    const result = d.winner == null ? 'draw' : d.winner === r.meId ? 'win' : 'loss';
    const reason = s.reason;
    r.container.innerHTML = `<div class="mg-screen mg-online mg-${d.game === 'des421' ? '421' : d.game}">${head(r, 'Partie terminée')}</div>`;
    const screen = r.container.querySelector('.mg-screen');
    const lp = s.lp && s.lp[me === 0 ? 'p1' : 'p2'];
    const again = () => search(r.container, r.game, r.localStart);
    const detail = reason === 'forfait' ? (result === 'win' ? `${esc(r.opp.pseudo)} a quitté la partie` : 'Tu as quitté la partie')
      : reason === 'abandon' ? 'Plus personne ne jouait' : `${s.scores[me]} à ${s.scores[opp]} contre ${esc(r.opp.pseudo)}`;
    let pre;
    if (reason === 'abandon') pre = { error: 'Partie annulée, aucun point en jeu.' };
    else if (!lp) pre = { error: 'Tu as déjà joué 10 fois contre ce joueur aujourd\'hui : pas de points cette fois.' };
    else pre = League.applyResult(d.game, lp, result);
    GameUI.showResult(screen, d.game, reason === 'abandon' ? 'draw' : result, detail, again, pre);
    screen.querySelector('[data-mg-back]')?.addEventListener('click', () => stopAll());
    stopAll();
  }

  return { chooser, search, watch, available, stopAll, GAME_IDS };
})();

if (typeof window !== 'undefined') window.Online = Online;
