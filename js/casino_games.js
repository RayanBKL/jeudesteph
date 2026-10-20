// ============================================================
// THE ASHTRAY KING — Casino : jeux instantanés (Ticket à gratter, Crash « La Cendre qui monte »)
// ============================================================
const InstantGames = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (typeof formatCash === 'function' ? formatCash(n) : Math.round(n).toLocaleString('fr-FR'));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rec = (win, bet, text) => {
    if (typeof Casino === 'undefined') return;
    const net = Math.round(win - bet);
    Casino.recordResult(net > 0 ? 'win' : net < 0 ? 'lose' : 'push', Math.abs(net), `${text} : ${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))}`);
  };
  let live = null;     // jeu à l'écran (pour arrêter les animations en changeant d'écran)

  // ════════ TICKET À GRATTER ════════
  const PRICES = [5, 25, 100, 500, 2500, 10000];
  // multiple du prix du ticket et probabilité (retour ≈ 91 %)
  const PRIZES = [[1, 0.20], [2, 0.10], [5, 0.04], [10, 0.013], [25, 0.004], [100, 0.0006], [1000, 0.00002]];
  const SC = { price: 1, cells: [], opened: [], win: 0, state: 'buy' };

  function drawTicket() {
    let r = Math.random(), mult = 0;
    for (const [m, p] of PRIZES) { if (r < p) { mult = m; break; } r -= p; }
    const pool = [0.5, 1, 2, 5, 10, 25, 100, 1000, 3, 7, 15, 50];      // montants affichés (multiples du prix)
    const cells = [];
    if (mult > 0) {
      cells.push(mult, mult, mult);
      const others = pool.filter(x => x !== mult);
      while (cells.length < 9) { const v = others[Math.floor(Math.random() * others.length)]; if (cells.filter(c => c === v).length < 2) cells.push(v); }
    } else {
      while (cells.length < 9) { const v = pool[Math.floor(Math.random() * pool.length)]; if (cells.filter(c => c === v).length < 2) cells.push(v); }
    }
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    return { cells, mult };
  }

  function renderScratch(content) {
    stop(); live = 'scratch';
    if (SC.state === 'buy') {
      content.innerHTML = `
        <div class="casino-felt-table ig-table">
          <div class="sl-head"><span class="ig-sub">Trois montants identiques : tu gagnes ce montant</span></div>
          <div class="ig-ticket ig-ticket-empty"><div class="ig-ticket-title">TICKET À GRATTER</div><div class="ig-ticket-note">Choisis un ticket</div></div>
          <div class="ig-prices">${PRICES.map((p, i) => `<button class="btn-secondary ${SC.price === i ? 'active' : ''}" data-p="${i}">${fmt(p)} €</button>`).join('')}</div>
          <button class="btn-primary pk-main-btn" id="sc-buy">Acheter un ticket (${fmt(PRICES[SC.price])} €)</button>
          <p class="ig-small">Jusqu'à ×1 000 le prix du ticket · retour théorique ≈ 91 %</p>
        </div>`;
      content.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { SC.price = +b.dataset.p; renderScratch(content); }));
      content.querySelector('#sc-buy').addEventListener('click', () => {
        const price = PRICES[SC.price];
        if (!spendMoney(price)) return showToast('Solde insuffisant pour ce ticket.', 'error');
        if (typeof Casino !== 'undefined') Casino.recordBet();
        const t = drawTicket(); SC.cells = t.cells; SC.win = Math.round(t.mult * price); SC.opened = Array(9).fill(false); SC.state = 'play'; SC.bought = price;
        if (window.SoundFX) SoundFX.click();
        renderScratch(content);
      });
      return;
    }
    const price = SC.bought, done = SC.opened.every(Boolean);
    content.innerHTML = `
      <div class="casino-felt-table ig-table">
        <div class="sl-head"><span class="ig-sub">Ticket à ${fmt(price)} €</span></div>
        <div class="ig-ticket">
          <div class="ig-ticket-title">${done ? (SC.win ? 'GAGNÉ !' : 'PERDU') : 'GRATTE LES CASES'}</div>
          <div class="ig-grid">${SC.cells.map((c, i) => `<button class="ig-cell ${SC.opened[i] ? 'is-open' : ''} ${done && SC.win && c * price === SC.win ? 'is-hit' : ''}" data-i="${i}" ${SC.opened[i] ? 'disabled' : ''}>${SC.opened[i] ? fmt(Math.round(c * price * 100) / 100) + ' €' : ''}</button>`).join('')}</div>
        </div>
        <div class="pk-msg ${done ? (SC.win ? 'win' : 'lose') : ''}">${done ? (SC.win ? `Trois fois ${fmt(SC.win)} € : tu encaisses ${fmt(SC.win)} €` : 'Pas de trois identiques cette fois') : 'Touche une case pour la gratter'}</div>
        <div class="pk-controls">${done ? '<button class="btn-primary pk-main-btn" id="sc-again">Un autre ticket</button>' : '<button class="btn-secondary pk-main-btn" id="sc-all">Tout gratter</button>'}</div>
      </div>`;
    const finish = () => {
      if (!SC.opened.every(Boolean) || SC.paid) return; SC.paid = true;
      if (SC.win > 0) { earnMoney(SC.win); if (window.SoundFX) SoundFX.win(); }
      rec(SC.win, price, 'Ticket à gratter');
      if (typeof saveGame === 'function') saveGame();
    };
    SC.paid = SC.paid && done;
    if (done) finish();
    content.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { SC.opened[+b.dataset.i] = true; if (window.SoundFX) SoundFX.click(); SC.paid = false; renderScratch(content); }));
    content.querySelector('#sc-all')?.addEventListener('click', () => { SC.opened = Array(9).fill(true); SC.paid = false; renderScratch(content); });
    content.querySelector('#sc-again')?.addEventListener('click', () => { SC.state = 'buy'; SC.paid = false; renderScratch(content); });
  }

  // ════════ LA CENDRE QUI MONTE (crash) ════════
  // Le multiplicateur grimpe tant que la cigarette se consume ; la cendre finit toujours par tomber : encaisse avant !
  // Retour théorique 96 % : probabilité d'atteindre ×x = 0,96 / x.
  const CB = [5, 10, 25, 50, 100, 500, 1000, 5000, 25000, 100000];
  const crash = { bet: 2, phase: 'idle', mult: 1, point: 1, t0: 0, raf: 0, running: false, auto: 0, history: [], gain: 0, staked: 0, ash: [] };

  function crashPoint() { const r = Math.random(); return Math.min(1000, Math.max(1, Math.floor((0.96 / Math.max(r, 0.00096)) * 100) / 100)); }
  const multAt = t => Math.exp(0.15 * t);
  const timeAt = m => Math.log(Math.max(1, m)) / 0.15;

  function renderCrash(content) {
    stopLoop(); live = 'crash';
    const c = crash, idle = c.phase !== 'run';
    const hist = c.history.slice(0, 14).map(h => `<span class="${h >= 10 ? 'vh' : h >= 2 ? 'hi' : 'lo'}">${h.toFixed(2)}×</span>`).join('');
    content.innerHTML = `
      <div class="casino-felt-table ig-table ig-crash">
        <div class="sl-head"><span class="ig-sub">Encaisse avant que la cendre tombe · retour 96 %</span><button class="btn-secondary pk-mini" id="cr-rules">Règles</button></div>
        <div class="ig-hist">${hist || '<span class="lo">pas encore de partie</span>'}</div>
        <div class="ig-screen ${c.phase}"><canvas id="cr-canvas" width="360" height="170"></canvas>
          <div class="ig-mult" id="cr-mult">${c.phase === 'idle' ? '1.00×' : c.mult.toFixed(2) + '×'}</div>
          <div class="ig-cig" id="cr-cig"><i class="ig-cig-body"></i><i class="ig-cig-ember"></i></div></div>
        <div class="pk-msg ${c.phase === 'cashed' ? 'win' : c.phase === 'crashed' ? 'lose' : ''}" id="cr-msg">${c.phase === 'cashed' ? `Encaissé à ${c.mult.toFixed(2)}× : +${fmt(c.gain)} € (la cendre serait tombée à ${c.point.toFixed(2)}×)` : c.phase === 'crashed' ? `La cendre est tombée à ${c.point.toFixed(2)}× : mise perdue` : c.phase === 'run' ? `Mise ${fmt(c.staked)} € · encaisse quand tu veux` : 'Choisis ta mise puis lance la cigarette'}</div>
        <div class="sl-controls">
          <div class="sl-bet"><button class="btn-secondary" id="cr-minus" ${idle ? '' : 'disabled'}>−</button><span id="cr-betv"><small>Mise</small><b>${fmt(CB[c.bet])} €</b></span><button class="btn-secondary" id="cr-plus" ${idle ? '' : 'disabled'}>+</button></div>
          <button class="btn-primary sl-spin" id="cr-go">${idle ? 'Lancer' : 'Encaisser ' + fmt(Math.round(c.staked * c.mult)) + ' €'}</button>
          <div class="sl-side"><select class="game-select-empire" id="cr-auto" ${idle ? '' : 'disabled'}><option value="0">Sans auto</option>${[1.5, 2, 3, 5, 10, 25, 100].map(v => `<option value="${v}" ${c.auto === v ? 'selected' : ''}>Auto ${v}×</option>`).join('')}</select></div>
        </div>
      </div>`;
    const $ = q => content.querySelector(q);
    $('#cr-minus')?.addEventListener('click', () => { c.bet = Math.max(0, c.bet - 1); $('#cr-betv').innerHTML = `<small>Mise</small><b>${fmt(CB[c.bet])} €</b>`; });
    $('#cr-plus')?.addEventListener('click', () => { c.bet = Math.min(CB.length - 1, c.bet + 1); $('#cr-betv').innerHTML = `<small>Mise</small><b>${fmt(CB[c.bet])} €</b>`; });
    $('#cr-auto')?.addEventListener('change', e => { c.auto = +e.target.value; });
    $('#cr-rules')?.addEventListener('click', () => rulesModal('La Cendre qui monte', '<p>Tu mises, la cigarette se consume et le multiplicateur grimpe. Tu touches <b>mise × multiplicateur</b> si tu encaisses avant que la cendre tombe.</p><p>La chute peut arriver très tôt (×1,00 : perdu d\'un coup) ou très tard (jusqu\'à ×1 000). Chaque ×x a 0,96 / x de chances d\'être atteint : retour 96 %.</p><p>« Auto » encaisse tout seul quand le multiplicateur atteint la valeur choisie.</p>'));
    $('#cr-go').addEventListener('click', () => { if (c.phase === 'run') cashOut(content); else startCrash(content); });
    drawCurve(content, c.phase === 'idle' ? 0 : timeAt(c.mult));
    if (c.phase === 'crashed') ashRain(content);
  }

  function startCrash(content) {
    const c = crash, bet = CB[c.bet];
    if (!spendMoney(bet)) return showToast('Solde insuffisant pour cette mise.', 'error');
    if (typeof Casino !== 'undefined') Casino.recordBet();
    c.point = crashPoint(); c.mult = 1; c.staked = bet; c.gain = 0; c.phase = 'run';
    if (window.SoundFX) SoundFX.click();
    renderCrash(content);                    // (renderCrash arrête toute boucle : on lance la nôtre ensuite)
    c.running = true; c.t0 = performance.now();
    const tick = () => {
      if (!c.running || live !== 'crash' || !content.isConnected) return;
      const t = (performance.now() - c.t0) / 1000, m = multAt(t);
      if (m >= c.point) { c.mult = c.point; return endCrash(content, false); }
      c.mult = m;
      const el = content.querySelector('#cr-mult'); if (el) el.textContent = m.toFixed(2) + '×';
      const go = content.querySelector('#cr-go'); if (go) go.textContent = 'Encaisser ' + fmt(Math.round(c.staked * m)) + ' €';
      const cig = content.querySelector('#cr-cig'); if (cig) cig.style.setProperty('--burn', Math.min(0.92, Math.log(m) / Math.log(60)));
      drawCurve(content, t);
      if (c.auto && m >= c.auto) return cashOut(content);
      c.raf = requestAnimationFrame(tick);
    };
    c.raf = requestAnimationFrame(tick);
  }
  function cashOut(content) {
    const c = crash; if (c.phase !== 'run' || !c.running) return;
    c.mult = Math.max(1, Math.floor(c.mult * 100) / 100);
    endCrash(content, true);
  }
  function endCrash(content, cashed) {
    const c = crash; c.running = false; cancelAnimationFrame(c.raf);
    c.history.unshift(c.point);
    if (cashed) { c.gain = Math.round(c.staked * c.mult); earnMoney(c.gain); c.phase = 'cashed'; if (window.SoundFX) SoundFX.win(); rec(c.gain, c.staked, 'La Cendre'); }
    else { c.phase = 'crashed'; if (window.SoundFX) SoundFX.cough(); rec(0, c.staked, 'La Cendre'); }
    if (typeof saveGame === 'function') saveGame();
    if (content.isConnected && live === 'crash') renderCrash(content);
  }
  function drawCurve(content, tNow) {
    const cv = content.querySelector('#cr-canvas'); if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, H * i / 5); ctx.lineTo(W, H * i / 5); ctx.stroke(); }
    if (tNow <= 0) return;
    const maxM = Math.max(2.2, multAt(tNow) * 1.2), tMax = Math.max(7, tNow * 1.08);
    const col = crash.phase === 'crashed' ? '#ff5a4d' : crash.phase === 'cashed' ? '#3fcf7a' : '#ffc43a';
    const pts = []; for (let x = 0; x <= W; x += 3) { const t = x / W * tMax; if (t > tNow) break; pts.push([x, H - (multAt(t) - 1) / (maxM - 1) * (H - 16) - 8]); }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); const last = pts[pts.length - 1] || [0, H];
    ctx.lineTo(last[0], H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(last[0], last[1], 5, 0, 6.3); ctx.fillStyle = '#fff'; ctx.fill();
  }
  // La cendre qui tombe quand la partie est perdue
  function ashRain(content) {
    const scr = content.querySelector('.ig-screen'); if (!scr) return;
    for (let i = 0; i < 18; i++) { const f = document.createElement('i'); f.className = 'ig-flake'; f.style.cssText = `left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.4}s;animation-duration:${0.9 + Math.random() * 0.8}s`; scr.appendChild(f); setTimeout(() => f.remove(), 1900); }
  }

  // ════════ LES MÉGOTS PIÉGÉS (mines) ════════
  // 25 paquets, certains cachent un briquet piégé. Chaque paquet sûr fait monter le gain ; tu encaisses quand tu veux.
  const MB = [5, 10, 25, 50, 100, 500, 1000, 5000, 25000];
  const MINES = [1, 3, 5, 8, 12, 18, 24];
  const mn = { bet: 2, traps: 3, phase: 'idle', open: [], bombs: [], hit: -1, staked: 0, gain: 0 };
  const mineMult = (k, m) => { let v = 0.97; for (let i = 0; i < k; i++) v *= (25 - i) / (25 - m - i); return v; };

  function renderMines(content) {
    stopLoop(); live = 'mines';
    const g = mn, run = g.phase === 'run', safe = g.open.length;
    const cur = run ? mineMult(safe, g.traps) : 1, next = (safe + 1 <= 25 - g.traps) ? mineMult(safe + 1, g.traps) : cur;
    const cells = Array.from({ length: 25 }, (_, i) => {
      const o = g.open.includes(i), b = g.bombs.includes(i), shownBomb = g.phase === 'lost' && b || g.phase === 'cashed' && b;
      return `<button class="mn-cell ${o ? 'is-safe' : ''} ${shownBomb ? 'is-bomb' : ''} ${g.hit === i ? 'is-hit' : ''} ${(g.phase === 'lost' || g.phase === 'cashed') && !o && !b ? 'is-dim' : ''}" data-i="${i}" ${run && !o ? '' : 'disabled'}><span>${o ? '<svg viewBox="0 0 40 40"><rect x="4" y="16" width="26" height="8" rx="2" fill="#fbf0d8" stroke="#120a04" stroke-width="2.5"/><rect x="4" y="16" width="9" height="8" rx="2" fill="#d9822b" stroke="#120a04" stroke-width="2.5"/><rect x="30" y="16" width="6" height="8" rx="2" fill="#ff6a2b" stroke="#120a04" stroke-width="2.5"/></svg>' : shownBomb ? '<svg viewBox="0 0 40 40"><rect x="12" y="14" width="16" height="22" rx="4" fill="#e2322b" stroke="#120a04" stroke-width="2.5"/><rect x="12" y="8" width="16" height="8" rx="2" fill="#bfbfbf" stroke="#120a04" stroke-width="2.5"/><path d="M20 2l3 4-3 3-3-3z" fill="#ffc43a"/></svg>' : ''}</span></button>`;
    }).join('');
    content.innerHTML = `
      <div class="casino-felt-table ig-table ig-mines">
        <div class="sl-head"><span class="ig-sub">Évite les briquets piégés · retour 97 %</span><button class="btn-secondary pk-mini" id="mn-rules">Règles</button></div>
        <div class="mn-grid">${cells}</div>
        <div class="pk-msg ${g.phase === 'cashed' ? 'win' : g.phase === 'lost' ? 'lose' : ''}">${g.phase === 'run' ? `Gain actuel <b>${fmt(Math.round(g.staked * cur))} €</b> (×${cur.toFixed(2)}) · prochain ×${next.toFixed(2)}` : g.phase === 'cashed' ? `Encaissé : +${fmt(g.gain)} € (×${(g.gain / g.staked).toFixed(2)})` : g.phase === 'lost' ? 'Boum ! Un briquet piégé : mise perdue' : 'Choisis ta mise et le nombre de pièges'}</div>
        <div class="sl-controls">
          <div class="sl-bet"><button class="btn-secondary" id="mn-minus" ${run ? 'disabled' : ''}>−</button><span id="mn-betv"><small>Mise</small><b>${fmt(MB[g.bet])} €</b></span><button class="btn-secondary" id="mn-plus" ${run ? 'disabled' : ''}>+</button></div>
          <button class="btn-primary sl-spin" id="mn-go">${run ? (safe ? 'Encaisser ' + fmt(Math.round(g.staked * cur)) + ' €' : 'Choisis un paquet') : 'Jouer'}</button>
          <div class="sl-side"><select class="game-select-empire" id="mn-traps" ${run ? 'disabled' : ''}>${MINES.map(m => `<option value="${m}" ${g.traps === m ? 'selected' : ''}>${m} piège${m > 1 ? 's' : ''}</option>`).join('')}</select><button class="btn-secondary pk-mini" id="mn-rand" ${run ? '' : 'disabled'}>Au hasard</button></div>
        </div>
      </div>`;
    const $ = q => content.querySelector(q);
    $('#mn-minus')?.addEventListener('click', () => { g.bet = Math.max(0, g.bet - 1); $('#mn-betv').innerHTML = `<small>Mise</small><b>${fmt(MB[g.bet])} €</b>`; });
    $('#mn-plus')?.addEventListener('click', () => { g.bet = Math.min(MB.length - 1, g.bet + 1); $('#mn-betv').innerHTML = `<small>Mise</small><b>${fmt(MB[g.bet])} €</b>`; });
    $('#mn-traps')?.addEventListener('change', e => { g.traps = +e.target.value; });
    $('#mn-rules')?.addEventListener('click', () => rulesModal('Les Mégots Piégés', '<p>25 paquets. Tu choisis combien de <b>briquets piégés</b> sont cachés (1 à 24). Chaque paquet sûr que tu ouvres augmente ton gain ; tu peux <b>encaisser à tout moment</b>.</p><p>Si tu tombes sur un piège, tu perds ta mise. Plus il y a de pièges, plus le gain monte vite (mais plus c\'est risqué).</p><p>Le multiplicateur est calculé avec les vraies probabilités, moins 3 % : retour 97 %.</p>'));
    $('#mn-go').addEventListener('click', () => { if (g.phase === 'run') { if (g.open.length) mineCash(content); } else mineStart(content); });
    $('#mn-rand')?.addEventListener('click', () => { const free = [...Array(25).keys()].filter(i => !g.open.includes(i)); minePick(content, free[Math.floor(Math.random() * free.length)]); });
    content.querySelectorAll('.mn-cell').forEach(b => b.addEventListener('click', () => minePick(content, +b.dataset.i)));
  }
  function mineStart(content) {
    const g = mn, bet = MB[g.bet];
    if (!spendMoney(bet)) return showToast('Solde insuffisant pour cette mise.', 'error');
    if (typeof Casino !== 'undefined') Casino.recordBet();
    const ids = [...Array(25).keys()]; for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    g.bombs = ids.slice(0, g.traps); g.open = []; g.hit = -1; g.staked = bet; g.gain = 0; g.phase = 'run';
    if (window.SoundFX) SoundFX.click();
    renderMines(content);
  }
  function minePick(content, i) {
    const g = mn; if (g.phase !== 'run' || g.open.includes(i)) return;
    if (g.bombs.includes(i)) { g.phase = 'lost'; g.hit = i; if (window.SoundFX) SoundFX.cough(); rec(0, g.staked, 'Mégots piégés'); if (typeof saveGame === 'function') saveGame(); return renderMines(content); }
    g.open.push(i); if (window.SoundFX) SoundFX.click();
    if (g.open.length >= 25 - g.traps) return mineCash(content);       // tout est ouvert : encaissement automatique
    renderMines(content);
  }
  function mineCash(content) {
    const g = mn; if (g.phase !== 'run') return;
    g.gain = Math.round(g.staked * mineMult(g.open.length, g.traps)); earnMoney(g.gain); g.phase = 'cashed';
    if (window.SoundFX) SoundFX.win(); rec(g.gain, g.staked, 'Mégots piégés'); if (typeof saveGame === 'function') saveGame();
    renderMines(content);
  }

  function rulesModal(title, html) {
    const el = document.createElement('div'); el.className = 'soc-modal';
    el.innerHTML = `<div class="soc-modal-card pp-card"><h3>${esc(title)}</h3><div class="bj-hist-list">${html}</div><button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button></div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); });
    document.body.appendChild(el);
  }

  // On quitte l'écran en pleine partie : la cigarette est encaissée au multiplicateur du moment (jamais de mise « perdue » à cause d'un changement d'onglet)
  function stopLoop() { if (crash.raf) cancelAnimationFrame(crash.raf); }
  function stop() {
    if (crash.phase === 'run' && crash.running) {
      crash.running = false; cancelAnimationFrame(crash.raf);
      crash.mult = Math.max(1, Math.min(crash.mult, crash.point - 0.01)); crash.gain = Math.round(crash.staked * crash.mult);
      earnMoney(crash.gain); crash.phase = 'cashed'; crash.history.unshift(crash.point); rec(crash.gain, crash.staked, 'La Cendre');
    }
    live = null;
  }

  return { renderScratch, renderCrash, renderMines, stop };
})();
if (typeof window !== 'undefined') window.InstantGames = InstantGames;
