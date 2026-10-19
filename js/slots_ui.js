// ============================================================
// THE ASHTRAY KING — Machines à sous : affichage et animation (moteur : js/slots_engine.js)
// ============================================================
const Slots = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (typeof formatCash === 'function' ? formatCash(n) : Math.round(n).toLocaleString('fr-FR'));
  const INK = '#120a04';
  const sw = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const SYM = {
    sept: `<text x="32" y="50" font-size="54" font-family="Cendrier,Impact,sans-serif" fill="#e2322b" stroke="${INK}" stroke-width="5" paint-order="stroke" text-anchor="middle">7</text>`,
    cerise: `<path d="M34 12c-8 6-12 16-12 28M34 12c4 8 10 18 12 28" fill="none" ${sw} stroke="#2e8b3d"/><circle cx="22" cy="44" r="10" fill="#e2322b" ${sw}/><circle cx="46" cy="44" r="10" fill="#e2322b" ${sw}/>`,
    cloche: `<path d="M12 46c0-4 4-6 4-16 0-10 6-18 16-18s16 8 16 18c0 10 4 12 4 16z" fill="#ffc43a" ${sw}/><circle cx="32" cy="52" r="5" fill="#ffc43a" ${sw}/>`,
    verre: `<rect x="14" y="20" width="28" height="34" rx="4" fill="#ffc43a" ${sw}/><path d="M42 28h6a6 6 0 0 1 0 16h-6" fill="none" ${sw}/><path d="M13 22c2-10 12-10 15-5 4-5 12-3 14 5z" fill="#fff" ${sw}/>`,
    cig: `<rect x="6" y="28" width="38" height="10" rx="2" fill="#fbf0d8" ${sw}/><rect x="6" y="28" width="13" height="10" rx="2" fill="#d9822b" ${sw}/><rect x="44" y="28" width="8" height="10" rx="2" fill="#ff6a2b" ${sw}/><path d="M54 24c6-6-4-10 2-16" fill="none" stroke="#9b948a" stroke-width="3" stroke-linecap="round"/>`,
    briquet: `<rect x="20" y="26" width="24" height="30" rx="5" fill="#e2322b" ${sw}/><rect x="20" y="18" width="24" height="10" rx="3" fill="#bfbfbf" ${sw}/><path d="M32 16c8-8 6-12 0-14-6 2-8 6 0 14z" fill="#ffc43a" ${sw}/>`,
    paquet: `<rect x="16" y="10" width="32" height="44" rx="4" fill="#c43b2d" ${sw}/><rect x="16" y="10" width="32" height="14" rx="4" fill="#fbf0d8" ${sw}/><circle cx="32" cy="38" r="8" fill="#ffc43a" ${sw}/>`,
    des: `<rect x="12" y="12" width="40" height="40" rx="8" fill="#fbf0d8" ${sw}/><g fill="${INK}"><circle cx="22" cy="22" r="3.5"/><circle cx="42" cy="22" r="3.5"/><circle cx="32" cy="32" r="3.5"/><circle cx="22" cy="42" r="3.5"/><circle cx="42" cy="42" r="3.5"/></g>`,
    fer: `<path d="M16 54V30a16 16 0 0 1 32 0v24h-9V30a7 7 0 0 0-14 0v24z" fill="#cfd3d8" ${sw}/>`,
    couronne: `<path d="M8 48 12 18l14 14 6-18 6 18 14-14 4 30z" fill="#ffc43a" ${sw}/><text x="32" y="45" font-size="13" font-family="Cendrier,Impact,sans-serif" fill="${INK}" text-anchor="middle">WILD</text>`,
    etoile: `<path d="M32 6l7.5 17 18.5 1.6-14 12.2 4.3 18.2L32 45.8 15.7 55l4.3-18.2L6 24.6 24.5 23z" fill="#ffc43a" ${sw}/><text x="32" y="38" font-size="11" font-family="Cendrier,Impact,sans-serif" fill="${INK}" text-anchor="middle">BONUS</text>`,
    livre: `<rect x="12" y="8" width="40" height="48" rx="4" fill="#7a4a21" ${sw}/><rect x="18" y="14" width="28" height="36" rx="3" fill="none" stroke="#ffc43a" stroke-width="3"/><circle cx="32" cy="32" r="8" fill="#ffc43a" ${sw}/>`,
    bombe: `<circle cx="32" cy="34" r="20" fill="#3b1d52" ${sw}/><text x="32" y="42" font-size="24" font-family="Cendrier,Impact,sans-serif" fill="#ffc43a" stroke="${INK}" stroke-width="3" paint-order="stroke" text-anchor="middle">×?</text>`,
  };
  const symSvg = id => `<svg viewBox="0 0 64 64" class="sl-sym sl-sym-${id}" aria-hidden="true">${SYM[id] || ''}</svg>`;
  const REG_ORDER = ['verre', 'cig', 'briquet', 'paquet', 'des', 'fer', 'cerise', 'cloche', 'sept'];

  const META = {
    classic: { cols: 3, rows: 3, lines: 5, tag: 'Trois rouleaux, cinq lignes. Le classique du bar.', sample: ['sept', 'cloche', 'cerise'], reels: ['verre', 'cig', 'cerise', 'fer', 'cloche', 'sept'] },
    pmu: { cols: 5, rows: 3, lines: 20, tag: '20 lignes, joker couronne et tours gratuits doublés.', sample: ['couronne', 'sept', 'etoile'], reels: [...REG_ORDER, 'couronne', 'etoile'] },
    livre: { cols: 5, rows: 3, lines: 10, tag: 'Le livre déclenche 10 tours gratuits avec un symbole qui s\'étend.', sample: ['livre', 'cig', 'sept'], reels: ['des', 'fer', 'cerise', 'cloche', 'verre', 'cig', 'sept', 'livre'] },
    cascade: { cols: 6, rows: 5, lines: 0, tag: '8 symboles identiques ou plus : ça paie, ça tombe, ça recommence.', sample: ['sept', 'cloche', 'etoile'], reels: [...REG_ORDER.slice(0, 8), 'etoile', 'bombe'] },
  };
  const BETS = [5, 10, 25, 50, 100, 250, 500, 1000, 5000, 25000, 100000];
  const S = {};     // état par machine : { bet, spinning, fsLeft, fsWin, special, auto }
  const state = id => (S[id] = S[id] || { bet: 2, spinning: false, fsLeft: 0, fsWin: 0, special: null, auto: 0, last: 0, grid: null });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  let alive = null;      // machine affichée (sert à arrêter les animations quand on quitte)

  function tile(id) { const m = META[id]; return `<span class="sl-tile-art">${m.sample.map(symSvg).join('')}</span>`; }

  function randomGrid(id) { const m = META[id]; return Array.from({ length: m.cols }, () => Array.from({ length: m.rows }, () => rnd(m.reels))); }

  function render(content, id) {
    stop();
    const g = SlotEngine.GAMES[id], m = META[id], st = state(id);
    alive = id; st.spinning = false; st.auto = 0;
    if (!st.grid) st.grid = randomGrid(id);
    content.innerHTML = `
      <div class="casino-felt-table sl-machine sl-${id}">
        <div class="sl-head"><span class="ig-sub">${esc(m.tag)}</span><button class="btn-secondary pk-mini" id="sl-pay">Gains</button></div>
        <div class="sl-fs hidden" id="sl-fs"></div>
        <div class="sl-grid" id="sl-grid" style="--cols:${m.cols};--rows:${m.rows}">${gridHtml(st.grid)}</div>
        <div class="sl-win" id="sl-win">${st.last ? 'Dernier gain : ' + fmt(st.last) + ' €' : 'Fais tourner les rouleaux'}</div>
        <div class="sl-controls">
          <div class="sl-bet"><button class="btn-secondary" id="sl-minus" aria-label="Moins">−</button><span id="sl-betv"><small>Mise</small><b>${fmt(BETS[st.bet])} €</b></span><button class="btn-secondary" id="sl-plus" aria-label="Plus">+</button></div>
          <button class="btn-primary sl-spin" id="sl-spin">Tourner</button>
          <div class="sl-side"><button class="btn-secondary pk-mini" id="sl-max">Max</button><button class="btn-secondary pk-mini" id="sl-auto">Auto ×10</button></div>
        </div>
      </div>`;
    bind(content, id);
  }
  function gridHtml(grid, win) {
    // grille[colonne][ligne] affichée en colonnes
    return grid.map((col, c) => `<div class="sl-col" data-c="${c}">${col.map((s, r) => `<div class="sl-cell ${win && win.has(c + ':' + r) ? 'is-win' : ''}">${symSvg(s)}</div>`).join('')}</div>`).join('');
  }
  function stop() { alive = null; }

  function bind(content, id) {
    const st = state(id), $ = s => content.querySelector(s);
    const setBet = d => { st.bet = Math.max(0, Math.min(BETS.length - 1, st.bet + d)); $('#sl-betv').innerHTML = `<small>Mise</small><b>${fmt(BETS[st.bet])} €</b>`; if (window.SoundFX) SoundFX.click(); };
    $('#sl-minus').addEventListener('click', () => !st.spinning && setBet(-1));
    $('#sl-plus').addEventListener('click', () => !st.spinning && setBet(1));
    $('#sl-max').addEventListener('click', () => { if (st.spinning) return; const cash = cashNow(); let i = 0; BETS.forEach((b, k) => { if (b <= cash) i = k; }); st.bet = i; setBet(0); });
    $('#sl-spin').addEventListener('click', () => { if (!st.spinning) play(content, id); });
    $('#sl-auto').addEventListener('click', () => { if (st.spinning) { st.auto = 0; return; } st.auto = 10; play(content, id); });
    $('#sl-pay').addEventListener('click', () => showPaytable(id));
  }
  const cashNow = () => (window.ClickerEngine && ClickerEngine.getCash) ? ClickerEngine.getCash() : 0;

  async function play(content, id) {
    const st = state(id), g = SlotEngine.GAMES[id];
    if (st.spinning) return;
    const free = st.fsLeft > 0;
    const bet = BETS[st.bet];
    if (!free) {
      if (!spendMoney(bet)) { st.auto = 0; return toast('Solde insuffisant pour cette mise. Baisse la mise ou utilise l\'avance bancaire.', 'error'); }
      if (typeof Casino !== 'undefined') Casino.recordBet();
    } else { st.fsLeft--; }
    st.spinning = true;
    const spinBtn = content.querySelector('#sl-spin'); if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = free ? 'Tour gratuit…' : '…'; }
    if (window.SoundFX) SoundFX.click();
    const res = id === 'livre' ? g.spin(free ? st.special : undefined) : g.spin(free);
    await animate(content, id, res);
    if (alive !== id) { st.spinning = false; return; }
    let win = Math.round(res.mult * bet);
    if (win > 0) earnMoney(win);
    st.last = win; st.grid = res.grid; if (free) st.fsWin += win;
    const el = content.querySelector('#sl-win');
    if (el) { el.className = 'sl-win' + (win >= bet * 10 ? ' is-big' : win > 0 ? ' is-ok' : ''); el.textContent = win > 0 ? `Gain : +${fmt(win)} €${win >= bet * 10 ? ' · Gros gain !' : ''}` : (free ? 'Rien sur ce tour gratuit' : 'Perdu, la machine se tait'); }
    if (win > 0 && window.SoundFX) SoundFX.win();
    const net = win - (free ? 0 : bet);
    if (!free && typeof Casino !== 'undefined') Casino.recordResult(net > 0 ? 'win' : 'lose', Math.abs(net), `${g.name} : ${net > 0 ? '+' : '−'}${fmt(Math.abs(net))}`);
    // tours gratuits gagnés
    if (res.fs) {
      st.fsLeft += res.fs; if (id === 'livre' && res.special) st.special = res.special;
      toast(`${res.fs} tours gratuits${id === 'livre' && res.special ? ' · symbole spécial : ' + res.special : ''} !`, 'gold');
      if (id === 'livre' && res.special) showSpecial(content, res.special);
      st.fsWin = free ? st.fsWin : 0;
    }
    updateFs(content, id);
    if (typeof saveGame === 'function') saveGame();
    st.spinning = false; if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = 'Tourner'; }
    if (st.fsLeft > 0) { await sleep(900); if (alive === id) return play(content, id); }
    else if (free && st.fsWin >= 0 && !res.fs && st.fsLeft === 0 && st.fsWin > 0) { toast(`Tours gratuits terminés : +${fmt(st.fsWin)} € au total`, 'gold'); st.fsWin = 0; updateFs(content, id); }
    if (st.auto > 1 && !free) { st.auto--; if (win < bet * 20) { await sleep(450); if (alive === id) return play(content, id); } else st.auto = 0; } else st.auto = 0;
  }
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t); };

  function updateFs(content, id) {
    const st = state(id), el = content.querySelector('#sl-fs'); if (!el) return;
    if (st.fsLeft > 0) { el.classList.remove('hidden'); el.innerHTML = `Tours gratuits : <b>${st.fsLeft}</b> restants · gains du bonus : <b>${fmt(st.fsWin)} €</b>${id === 'livre' && st.special ? ` · symbole spécial ${symSvg(st.special)}` : ''}${id === 'pmu' ? ' · gains ×2' : ''}`; }
    else el.classList.add('hidden');
  }
  function showSpecial() { /* l'info est dans le bandeau des tours gratuits */ }

  // Animation : les rouleaux tournent puis s'arrêtent un par un ; puis les lignes gagnantes s'allument
  async function animate(content, id, res) {
    const m = META[id], grid = content.querySelector('#sl-grid'); if (!grid) return;
    const cols = [...grid.querySelectorAll('.sl-col')];
    cols.forEach(c => c.classList.add('is-spin'));
    const timer = setInterval(() => { cols.forEach(c => { if (c.classList.contains('is-spin')) c.querySelectorAll('.sl-cell').forEach(cell => { cell.innerHTML = symSvg(rnd(m.reels)); }); }); }, 70);
    const stopAt = id === 'cascade' ? 500 : 420;
    for (let c = 0; c < cols.length; c++) {
      await sleep(c === 0 ? stopAt : (id === 'cascade' ? 70 : 230));
      if (alive !== id) { clearInterval(timer); return; }
      const col = cols[c]; col.classList.remove('is-spin');
      col.querySelectorAll('.sl-cell').forEach((cell, r) => { cell.innerHTML = symSvg(res.grid[c][r]); });
    }
    clearInterval(timer);
    if (id === 'cascade' && res.steps && res.steps.length) {
      // chutes : on montre chaque grille, les gagnants clignotent, puis tout retombe
      for (const step of res.steps) {
        if (alive !== id) return;
        if (!step.removed.length) continue;
        grid.innerHTML = gridHtml(step.grid, new Set(step.grid.flatMap((col, c) => col.map((s, r) => step.removed.includes(s) ? c + ':' + r : null)).filter(Boolean)));
        await sleep(650);
      }
      if (alive === id) grid.innerHTML = gridHtml(res.grid);
      return;
    }
    if (res.expanded && res.expanded.length) {
      grid.innerHTML = gridHtml(res.grid, new Set(res.expanded.flatMap(c => [c + ':0', c + ':1', c + ':2'])));
      await sleep(900);
    }
    if (res.wins && res.wins.length) {
      const g = SlotEngine.GAMES[id], hit = new Set();
      res.wins.forEach(w => { const line = g.lines[w.line]; for (let c = 0; c < w.count; c++) hit.add(c + ':' + line[c]); });
      grid.innerHTML = gridHtml(res.grid, hit);
      await sleep(550);
    }
  }

  function showPaytable(id) {
    const g = SlotEngine.GAMES[id], m = META[id];
    const per = m.lines || 1, tbl = g.pay;
    const rows = Object.keys(tbl).map(sym => {
      const v = tbl[sym];
      const cells = Array.isArray(v) ? `<span>8-9 : ×${v[0]}</span><span>10-11 : ×${v[1]}</span><span>12+ : ×${v[2]}</span>`
        : Object.keys(v).map(n => `<span>${n} : ×${Math.round(v[n] / per * 100) / 100}</span>`).join('');
      return `<div class="sl-pt-row">${symSvg(sym)}<div class="sl-pt-vals">${cells}</div></div>`;
    }).join('');
    const extra = id === 'pmu' ? '<p>La couronne est un joker (sauf bonus). 3 étoiles ou plus : gain et tours gratuits (8, 12 ou 20) à gains doublés.</p>'
      : id === 'livre' ? '<p>Le livre est joker et bonus : 3 livres ou plus = 10 tours gratuits. Un symbole spécial est tiré : il s\'étend sur tout le rouleau et paie partout.</p>'
      : id === 'cascade' ? '<p>Les symboles gagnants disparaissent et les autres tombent. 4 étoiles ou plus : 10 tours gratuits, avec des bombes ×2 à ×25 qui multiplient le gain.</p>'
      : '<p>Cinq lignes : trois horizontales et deux diagonales. Les cerises paient dès la première.</p>';
    const el = document.createElement('div');
    el.className = 'soc-modal';
    el.innerHTML = `<div class="soc-modal-card pp-card"><h3>${esc(g.name)}</h3><p class="soc-empty">Gains en multiples de ta mise totale · retour théorique ≈ 95 %</p>${extra}<div class="bj-hist-list">${rows}</div><button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button></div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); });
    document.body.appendChild(el);
  }

  return { render, stop, tile, META, symSvg };
})();
if (typeof window !== 'undefined') window.Slots = Slots;
