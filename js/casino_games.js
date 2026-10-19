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
  function stop() { live = null; if (crash && crash.raf) cancelAnimationFrame(crash.raf); if (crash) crash.running = false; }

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

  // ════════ CRASH : LA CENDRE QUI MONTE ════════
  const CB = [5, 10, 25, 50, 100, 500, 1000, 5000, 25000];
  const crash = { bet: 2, phase: 'idle', mult: 1, point: 1, t0: 0, raf: 0, running: false, auto: 0, history: [], cashed: 0 };

  function crashPoint() { const r = Math.random(); return Math.min(1000, Math.max(1, Math.floor((0.96 / Math.max(r, 0.00096)) * 100) / 100)); }
  const multAt = t => Math.exp(0.15 * t);

  function renderCrash(content) {
    stop(); live = 'crash';
    const c = crash, idle = c.phase === 'idle' || c.phase === 'crashed' || c.phase === 'cashed';
    content.innerHTML = `
      <div class="casino-felt-table ig-table ig-crash">
        <div class="sl-head"><span class="ig-sub">Encaisse avant que la cendre tombe</span></div>
        <div class="ig-hist">${c.history.slice(0, 12).map(h => `<span class="${h >= 2 ? 'hi' : 'lo'}">${h.toFixed(2)}×</span>`).join('')}</div>
        <div class="ig-screen ${c.phase}"><canvas id="cr-canvas" width="320" height="130"></canvas><div class="ig-mult" id="cr-mult">${c.phase === 'idle' ? '1.00×' : c.mult.toFixed(2) + '×'}</div></div>
        <div class="pk-msg ${c.phase === 'cashed' ? 'win' : c.phase === 'crashed' ? 'lose' : ''}" id="cr-msg">${c.phase === 'cashed' ? `Encaissé à ${c.mult.toFixed(2)}× : +${fmt(c.gain)} €` : c.phase === 'crashed' ? `Chute à ${c.mult.toFixed(2)}×${c.bet_lost ? ' : mise perdue' : ''}` : c.phase === 'run' ? 'La cendre monte…' : 'Choisis ta mise et lance la cendre'}</div>
        <div class="sl-controls">
          <div class="sl-bet"><button class="btn-secondary" id="cr-minus" ${idle ? '' : 'disabled'}>−</button><span id="cr-betv"><small>Mise</small><b>${fmt(CB[c.bet])} €</b></span><button class="btn-secondary" id="cr-plus" ${idle ? '' : 'disabled'}>+</button></div>
          <button class="btn-primary sl-spin" id="cr-go">${idle ? 'Lancer' : 'Encaisser'}</button>
          <div class="sl-side"><select class="game-select-empire" id="cr-auto" ${idle ? '' : 'disabled'}><option value="0">Sans auto</option>${[1.5, 2, 3, 5, 10].map(v => `<option value="${v}" ${c.auto === v ? 'selected' : ''}>Auto ${v}×</option>`).join('')}</select></div>
        </div>
      </div>`;
    const $ = s => content.querySelector(s);
    $('#cr-minus')?.addEventListener('click', () => { c.bet = Math.max(0, c.bet - 1); $('#cr-betv').innerHTML = `<small>Mise</small><b>${fmt(CB[c.bet])} €</b>`; });
    $('#cr-plus')?.addEventListener('click', () => { c.bet = Math.min(CB.length - 1, c.bet + 1); $('#cr-betv').innerHTML = `<small>Mise</small><b>${fmt(CB[c.bet])} €</b>`; });
    $('#cr-auto')?.addEventListener('change', e => { c.auto = +e.target.value; });
    $('#cr-go').addEventListener('click', () => { if (c.phase === 'run') cashOut(content); else startCrash(content); });
    drawCurve(content, c.phase === 'idle' ? 0 : Math.log(Math.max(1, c.mult)) / 0.15);
  }

  function startCrash(content) {
    const c = crash, bet = CB[c.bet];
    if (!spendMoney(bet)) return showToast('Solde insuffisant pour cette mise.', 'error');
    if (typeof Casino !== 'undefined') Casino.recordBet();
    c.phase = 'run'; c.point = crashPoint(); c.t0 = performance.now(); c.mult = 1; c.running = true; c.staked = bet; c.gain = 0; c.bet_lost = false;
    if (window.SoundFX) SoundFX.click();
    renderCrash(content);
    const tick = () => {
      if (!c.running || live !== 'crash' || !content.isConnected) return;
      const t = (performance.now() - c.t0) / 1000, m = multAt(t);
      if (m >= c.point) { c.mult = c.point; return endCrash(content, false); }
      c.mult = m;
      const el = content.querySelector('#cr-mult'); if (el) el.textContent = m.toFixed(2) + '×';
      drawCurve(content, t);
      if (c.auto && m >= c.auto) return cashOut(content);
      c.raf = requestAnimationFrame(tick);
    };
    c.raf = requestAnimationFrame(tick);
  }
  function cashOut(content) {
    const c = crash; if (c.phase !== 'run') return;
    c.mult = Math.max(1, Math.floor(c.mult * 100) / 100);
    endCrash(content, true);
  }
  function endCrash(content, cashed) {
    const c = crash; c.running = false; cancelAnimationFrame(c.raf);
    c.history.unshift(c.point);
    if (cashed) { c.gain = Math.round(c.staked * c.mult); earnMoney(c.gain); c.phase = 'cashed'; if (window.SoundFX) SoundFX.win(); rec(c.gain, c.staked, 'Crash'); }
    else { c.phase = 'crashed'; c.bet_lost = true; if (window.SoundFX) SoundFX.cough(); rec(0, c.staked, 'Crash'); }
    if (typeof saveGame === 'function') saveGame();
    if (live === 'crash' && content.isConnected) renderCrash(content);
  }
  function drawCurve(content, tNow) {
    const cv = content.querySelector('#cr-canvas'); if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, H * i / 4); ctx.lineTo(W, H * i / 4); ctx.stroke(); }
    if (tNow <= 0) return;
    const maxM = Math.max(2, multAt(tNow) * 1.15), tMax = Math.max(6, tNow * 1.05);
    ctx.beginPath(); ctx.lineWidth = 4; ctx.strokeStyle = crash.phase === 'crashed' ? '#e2322b' : '#ffc43a';
    for (let x = 0; x <= W; x += 3) { const t = x / W * tMax; if (t > tNow) break; const y = H - (multAt(t) - 1) / (maxM - 1) * (H - 14) - 6; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }

  return { renderScratch, renderCrash, stop };
})();
if (typeof window !== 'undefined') window.InstantGames = InstantGames;
