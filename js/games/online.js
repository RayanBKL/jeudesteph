// ============================================================
// THE ASHTRAY KING — Parties en ligne contre de vrais joueurs
// Pierre-Briquet-Clope, 421 et Quiz. Le serveur arbitre tout (dés, coups cachés,
// chrono, forfait) : cet écran ne fait qu'afficher l'état et envoyer les coups.
// ============================================================

const Online = (() => {
  const TOTAL_TIME = { pbc: 25, des421: 45, quiz: 10, bataille: 30 };
  const GAME_IDS = ['pbc', 'des421', 'quiz', 'bataille'];
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

  // ── Entrée dans un jeu : reprise d'une partie en cours, sinon recherche d'un vrai joueur (il n'y a plus de mode « ordi ») ──
  async function go(container, game) {
    stopAll();
    if (!available()) {
      container.innerHTML = `<div class="mg-screen">${GameUI.header(game, 'Connexion requise')}<p class="mg-hint">Connecte-toi pour jouer contre de vrais joueurs.</p></div>`;
      GameUI.bindBack(container);
      return;
    }
    const { data } = await sb().rpc('my_active_match', { p_game: game });
    if (data) return watch(container, data, game);
    search(container, game);
  }

  // ── Recherche d'un adversaire ──────────────────────────────
  function search(container, game) {
    stopAll();
    const t0 = Date.now();
    container.innerHTML = `
      <div class="mg-screen mg-search">
        ${GameUI.header(game, 'Recherche d\'un adversaire')}
        <div class="on-searching">
          <div class="on-spinner"></div>
          <strong>On cherche quelqu'un au comptoir…</strong>
          <span id="on-wait">0 s</span>
          <p class="mg-hint" id="on-hint">Si personne n'arrive en 10 secondes, un bot de ton niveau joue contre toi.</p>
          <div class="mg-actions">
            <button class="btn-empire btn-empire-secondary" id="on-cancel">Annuler</button>
            <button class="btn-empire btn-empire-primary hidden" id="on-invite">Inviter un ami</button>
          </div>
        </div>
      </div>`;
    GameUI.bindBack(container);
    const leave = async () => { clearInterval(searchTimer); searchTimer = null; try { await sb().rpc('mm_cancel'); } catch (e) {} };
    container.querySelector('#on-cancel').addEventListener('click', async () => { await leave(); GameHub.render(); });
    container.querySelector('#on-invite').addEventListener('click', async () => { await leave(); if (window.Social) Social.openTab('amis'); });
    container.querySelector('[data-mg-back]').addEventListener('click', leave);

    const step = async () => {
      if (!container.querySelector('.mg-search')) { await leave(); return; }
      const secs = Math.floor((Date.now() - t0) / 1000);
      const w = container.querySelector('#on-wait'); if (w) w.textContent = `${secs} s`;
      if (secs >= 25) {
        container.querySelector('#on-invite')?.classList.remove('hidden');
        const h = container.querySelector('#on-hint'); if (h && !h.dataset.late) { h.dataset.late = '1'; h.textContent = 'Peu de monde en ligne pour l\'instant. On continue de chercher : tu peux aussi inviter un ami pour jouer tout de suite.'; }
      }
      const { data, error } = await sb().rpc('mm_join', { p_game: game });
      if (error) {
        const h = container.querySelector('#on-hint'); if (h) h.textContent = 'Connexion au serveur impossible, on réessaie…';
        return;
      }
      if (data && data.match_id) { clearInterval(searchTimer); searchTimer = null; watch(container, data.match_id, game); return; }
      // Personne au bout de 10 s : un bot de ton niveau prend la place
      if (secs >= 10) {
        const h = container.querySelector('#on-hint'); if (h && !h.dataset.bot) { h.dataset.bot = '1'; h.textContent = 'Personne en ligne pour l\'instant : un bot de ton niveau arrive.'; }
        const b = await sb().rpc('mm_bot', { p_game: game });
        if (b.data && b.data.match_id) { clearInterval(searchTimer); searchTimer = null; watch(container, b.data.match_id, game); }
      }
    };
    step();
    searchTimer = setInterval(step, 2000);
  }

  // ── Partie en direct ───────────────────────────────────────
  async function watch(container, matchId, game) {
    stopAll();
    run = { container, id: matchId, game, sig: '', data: null, offset: 0, held: [false, false, false], myChoice: null, prevQ: null, prevI: -1, notice: '', over: false, checking: false, pending: false };
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
    if (data.game === 'course' && typeof RaceEngine !== 'undefined' && RaceEngine.pvp) {
      if (data.status !== 'active') { RaceEngine.stop(); backToHub(); } else RaceEngine.setGhost(data.state.progress[opp]);
    }
    const sig = JSON.stringify([data.state, data.mine, data.status, r.held, r.myChoice, r.notice, data.game === 'course' ? Math.floor((Date.now() + r.offset) / 1000) : 0]);
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
    if (fill && TOTAL_TIME[r.game]) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, left / TOTAL_TIME[r.game]))})`;
    const t = r.container.querySelector('.on-time'); if (t && TOTAL_TIME[r.game]) t.textContent = `${Math.max(0, Math.ceil(left))} s`;
    if (r.game === 'course') courseTick(r);
    if (left < -1.2 && !r.checking && !(r.game === 'course' && typeof RaceEngine !== 'undefined' && RaceEngine.pvp)) {
      r.checking = true;
      sb().rpc('match_timeout_check', { p_match: r.id }).then(({ data }) => { if (run === r && data) apply(data); }).finally(() => { if (run === r) r.checking = false; });
    }
  }

  function head(r, subtitle) {
    const s = r.data.state, me = r.data.me, opp = 1 - me, sc = s.scores || ['', ''];
    return `
      ${GameUI.header(r.game, subtitle)}
      <div class="mg-scoreboard on-board">
        <div class="mg-score-side">${avatar(r.me)}<span>Toi</span><strong>${sc[me]}</strong></div>
        <div class="mg-round"><span class="on-time"></span></div>
        <div class="mg-score-side">${avatar(r.opp)}<span>${esc(r.opp.pseudo)}</span><strong>${sc[opp]}</strong></div>
      </div>
      ${TOTAL_TIME[r.game] ? '<div class="qz-timer"><div class="qz-timer-fill" style="animation:none"></div></div>' : ''}`;
  }

  function render() {
    const r = run, d = r.data, c = r.container;
    const body = d.game === 'pbc' ? bodyPbc(r) : d.game === 'des421' ? bodyDes(r) : d.game === 'bataille' ? bodyBataille(r) : d.game === 'course' ? bodyCourse(r) : bodyQuiz(r);
    const sub = d.game === 'pbc' ? 'Premier à 3 points' : d.game === 'des421' ? 'Premier à 2 manches' : d.game === 'bataille' ? 'Premier à 3 manches' : d.game === 'course' ? '500 m · le plus rapide gagne' : 'Question ' + (d.state.i + 1) + '/' + d.state.total;
    c.innerHTML = `<div class="mg-screen mg-online mg-${d.game === 'des421' ? '421' : d.game}">${head(r, sub)}${body}${r.notice ? `<p class="mg-hint">${esc(r.notice)}</p>` : ''}</div>`;
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
      <div class="qz-photo"><img src="${esc(typeof withImgRev === 'function' ? withImgRev(q.img) : q.img)}" alt="" /></div>
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

  // ── Bataille de Comptoir ──
  const BT_STAT = {
    cps: { name: 'Passif', field: 'cashPerSec', fmt: v => '+' + btNum(v) + '/s' },
    clk: { name: 'Clic', field: 'clickBoost', fmt: v => '+' + btNum(v) },
    val: { name: 'Cote', field: 'value', fmt: v => btNum(v) + ' €' },
  };
  function btNum(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + ' k';
    return n >= 10 ? Math.round(n).toString() : n.toFixed(2).replace('.', ',');
  }
  function btCard(id, stat, o = {}) {
    const c = (typeof getEmpireItemById === 'function' && getEmpireItemById(id)) || { name: 'Carte', rarity: 'commune' };
    const img = (typeof CardsRenderer !== 'undefined') ? CardsRenderer.resolveCardPhoto(c) : '';
    const st = BT_STAT[stat];
    return `
      <button class="bt-card rv-r-${esc(c.rarity)} ${o.cls || ''}" ${o.idx !== undefined ? `data-bidx="${o.idx}"` : ''} ${o.disabled ? 'disabled' : ''}>
        <span class="bt-card-art" data-initial="${esc((c.name || '?').slice(0, 1))}"><img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()" /></span>
        <span class="bt-card-name">${esc(c.name)}</span>
        <span class="bt-card-stat">${st.fmt(o.value !== undefined ? o.value : (c[st.field] || 0))}</span>
      </button>`;
  }
  function bodyBataille(r) {
    const d = r.data, s = d.state, me = d.me, opp = 1 - me, last = s.last, locked = s.locked[me];
    const hand = (d.mine && d.mine.hand) || [];
    let board = '<div class="bt-slot"><span class="bt-slot-label">Toi</span><span class="bt-slot-empty">Ta carte</span></div><div class="bt-vs">VS</div><div class="bt-slot"><span class="bt-slot-label">' + esc(r.opp.pseudo) + '</span><span class="bt-slot-empty">?</span></div>';
    if (last) {
      const res = last.result === 0 ? 'draw' : (last.result - 1 === me ? 'win' : 'loss');
      board = `<div class="bt-slot"><span class="bt-slot-label">Toi · ${BT_STAT[last.stat].name}</span>${btCard(last.cards[me], last.stat, { cls: res === 'win' ? 'is-winner' : '', value: last.values[me], disabled: true })}</div>
        <div class="bt-vs is-${res}">${res === 'win' ? 'Gagné' : res === 'loss' ? 'Perdu' : 'Égalité'}</div>
        <div class="bt-slot"><span class="bt-slot-label">${esc(r.opp.pseudo)}</span>${btCard(last.cards[opp], last.stat, { cls: res === 'loss' ? 'is-winner' : '', value: last.values[opp], disabled: true })}</div>`;
    }
    return `
      <div class="bt-ai-hand">${Array.from({ length: s.sizes[opp] }, () => '<span class="bt-back"></span>').join('')}</div>
      <div class="bt-stat-banner">Manche ${s.round} sur : <strong>${BT_STAT[s.stat].name}</strong></div>
      <div class="bt-board">${board}</div>
      <div class="bt-hand">${hand.map((id, i) => btCard(id, s.stat, { idx: i, disabled: locked })).join('')}</div>
      <p class="mg-hint">${locked ? 'Carte posée. ' + esc(r.opp.pseudo) + ' réfléchit…' : `Pose ta carte la plus forte en <strong>${BT_STAT[s.stat].name}</strong>, ou garde-la pour plus tard`}</p>`;
  }

  // ── Course Clandestine (duel) ──
  function courseTimes(r) { const s = r.data.state, me = r.data.me; return { mine: s.times[me], his: s.times[1 - me], myDone: s.done[me], hisDone: s.done[1 - me] }; }
  function fmtT(t) { return t == null ? '—' : Number(t).toFixed(2).replace('.', ',') + ' s'; }
  function bodyCourse(r) {
    const d = r.data, s = d.state, me = d.me, opp = 1 - me, t = courseTimes(r);
    const dist = Number(s.distance) || 500;
    const bar = (label, pct) => `<div class="cr-lane"><span>${label}</span><div class="cr-track"><i style="width:${Math.max(0, Math.min(100, pct * 100))}%"></i></div></div>`;
    const untilStart = (Date.parse(s.start_at) - (Date.now() + r.offset)) / 1000;
    let main;
    if (t.myDone) {
      main = `<strong class="cr-big">Ton chrono : ${fmtT(t.mine)}</strong><p class="mg-hint">${t.hisDone ? 'Résultat…' : esc(r.opp.pseudo) + ' est encore sur la piste…'}</p>`;
    } else if (untilStart > 0) {
      main = `<strong class="cr-big">Départ dans ${Math.ceil(untilStart)} s</strong><p class="mg-hint">Prépare ton pouce : bouton Sprint ou barre espace. Tire sur ta clope quand l'énergie est basse, mais pas trop souvent : sinon Stéphane tousse.</p>`;
    } else {
      main = `<strong class="cr-big">La course est lancée !</strong><div class="mg-actions"><button class="btn-empire btn-empire-primary" data-launch>Rejoindre la piste</button></div>`;
    }
    return `
      <div class="cr-lobby">
        ${main}
        ${bar('Toi', t.myDone ? 1 : (RaceEngine && RaceEngine.pvp ? RaceEngine.distance / dist : 0))}
        ${bar(esc(r.opp.pseudo), t.hisDone ? 1 : (Number(s.progress[opp]) || 0) / dist)}
      </div>`;
  }

  function courseTick(r) {
    const d = r.data; if (!d || d.status !== 'active') return;
    const s = d.state, serverNow = Date.now() + r.offset, start = Date.parse(s.start_at);
    if (!r.raceLaunched && !s.done[d.me] && serverNow >= start - 400 && serverNow < start + 90000) launchRace(r);
    // décompte affiché dans le salon
    const big = r.container.querySelector('.cr-big');
    if (big && !s.done[d.me] && serverNow < start) big.textContent = 'Départ dans ' + Math.ceil((start - serverNow) / 1000) + ' s';
  }

  function launchRace(r) {
    if (typeof RaceEngine !== 'undefined' && RaceEngine.pvp && RaceEngine.active && RaceEngine.pvp.matchId === r.id) { r.raceLaunched = true; return; }   // course déjà en cours : on ne la relance pas (les coups déjà joués seraient perdus)
    if (r.raceLaunched && typeof RaceEngine !== 'undefined' && RaceEngine.pvp) return;
    r.raceLaunched = true;
    const s = r.data.state, id = r.id;
    RaceEngine.startPvp({
      matchId: id, startAt: Date.parse(s.start_at) - r.offset, trackId: s.track, oppName: r.opp.pseudo,
      onProgress: dist => { sb().rpc('race_progress', { p_match: id, p_dist: Math.round(dist * 10) / 10 }).then(() => {}); },
      onFinish: (time, taps) => submitRace(r, taps),
    });
  }

  // Retour à l'écran de la salle de jeux SANS relancer l'accueil (ça coupe la partie en cours)
  function backToHub() { if (window.GameHub) GameHub.keepScreenOnce = true; showPage('multi'); }

  async function submitRace(r, taps, tries = 0) {
    backToHub();
    const { data, error } = await sb().rpc('race_submit', { p_match: r.id, p_taps: taps });
    if (run !== r) return;
    if (error && /trop rapide/i.test(error.message) && tries < 4) { await GameUI.sleep(1500); return submitRace(r, taps, tries + 1); }
    if (error) { setNotice(error.message.replace(/^.*?:\s*/, '')); }
    if (data) { r.sig = ''; apply(data); }
  }

  async function abandonRace() {
    const r = run; if (!r) { RaceEngine.stop(); backToHub(); return; }
    RaceEngine.stop();
    backToHub();
    const { data } = await sb().rpc('match_forfeit', { p_match: r.id });
    if (run === r && data) { r.sig = ''; apply(data); }
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
    c.querySelectorAll('[data-bidx]').forEach(b => b.addEventListener('click', () => {
      c.querySelectorAll('[data-bidx]').forEach(x => x.disabled = true);
      b.classList.add('is-picked');
      if (window.SoundFX && SoundFX.click) SoundFX.click();
      send(sb().rpc('bat_play', { p_match: id, p_idx: +b.dataset.bidx }));
    }));
    c.querySelector('[data-launch]')?.addEventListener('click', () => { r.raceLaunched = false; launchRace(r); });
    c.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
      r.myChoice = +b.dataset.k;
      c.querySelectorAll('[data-k]').forEach(x => x.disabled = true);
      b.classList.add('is-picked');
      send(sb().rpc('quiz_answer', { p_match: id, p_i: r.data.state.i, p_choice: +b.dataset.k }));
    }));
  }

  // ── Fin de partie ──
  // Dernière manche, gardée à l'écran après la fin du match (pour voir ce que l'autre avait)
  function lastRoundHtml(r) {
    const d = r.data, s = d.state, me = d.me, opp = 1 - me, last = s.last;
    if (!last) return '';
    const who = (i) => i === me ? 'Toi' : esc(r.opp.pseudo);
    let inner = '';
    if (d.game === 'des421' && last.dice) {
      inner = [me, opp].map(i => `<div class="lr-side"><span>${who(i)}</span><div class="d421-dice d421-dice-sm">${last.dice[i].map(v => Des421.diceSVG(v)).join('')}</div><em>${esc(Des421.evaluate(last.dice[i]).name)}</em></div>`).join('');
    } else if (d.game === 'pbc' && last.moves) {
      const nm = { pierre: 'Pierre', briquet: 'Briquet', clope: 'Clope' };
      inner = [me, opp].map(i => `<div class="lr-side"><span>${who(i)}</span><strong>${last.moves[i] ? nm[last.moves[i]] : 'n\'a pas joué'}</strong></div>`).join('');
    } else if (d.game === 'bataille' && last.cards) {
      const nm = id => { const it = typeof getEmpireItemById === 'function' ? getEmpireItemById(id) : null; return it ? it.name : 'Carte'; };
      inner = [me, opp].map(i => `<div class="lr-side"><span>${who(i)}</span><strong>${esc(nm(last.cards[i]))}</strong><em>${esc(last.stat)} ${last.values[i]}</em></div>`).join('');
    } else return '';
    return `<div class="lr-box"><div class="lr-title">Dernière manche</div><div class="lr-row">${inner}</div></div>`;
  }

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
    const again = () => search(r.container, r.game);
    const detail = reason === 'forfait' ? (result === 'win' ? `${esc(r.opp.pseudo)} a quitté la partie` : 'Tu as quitté la partie')
      : reason === 'abandon' ? 'Plus personne ne jouait'
      : d.game === 'course' ? `${fmtT(s.times[me])} contre ${fmtT(s.times[opp])} pour ${esc(r.opp.pseudo)}`
      : `${s.scores[me]} à ${s.scores[opp]} contre ${esc(r.opp.pseudo)}`;
    let pre;
    if (reason === 'abandon') pre = { error: 'Partie annulée, aucun point en jeu.' };
    else if (!lp) pre = { error: 'Tu as déjà joué 10 fois contre ce joueur aujourd\'hui : pas de points cette fois.' };
    else pre = League.applyResult(d.game, lp, result);
    GameUI.showResult(screen, d.game, reason === 'abandon' ? 'draw' : result, detail, again, pre);
    const recap = lastRoundHtml(r);
    if (recap) { const box = screen.querySelector('.mg-result') || screen; box.insertAdjacentHTML('beforeend', recap); }
    screen.querySelector('[data-mg-back]')?.addEventListener('click', () => stopAll());
    stopAll();
  }

  // Une partie est à l'écran : on ne la remplace pas quand on revient sur l'onglet Jeux
  function inMatch() { return !!(run && run.data && run.data.status === 'active' && run.container && run.container.isConnected); }

  // Reprise d'une partie en cours (retour sur l'onglet, rechargement de la page)
  async function resume(container, matchId) {
    const { data } = await sb().rpc('match_get', { p_match: matchId });
    if (data && data.status === 'active') watch(container, matchId, data.game);
  }

  // Quitter l'onglet pendant une partie en cours : la partie est abandonnée (le serveur donne la victoire à l'adversaire)
  async function forfeitCurrent() {
    const r = run; if (!r) return;
    const id = r.id; stopAll();
    try { await sb().rpc('match_forfeit', { p_match: id }); } catch (e) {}
  }

  return { go, search, watch, available, stopAll, abandonRace, inMatch, resume, forfeitCurrent, GAME_IDS };
})();

if (typeof window !== 'undefined') window.Online = Online;
