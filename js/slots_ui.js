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

  const ID = 'cendrier';
  const REELS = [...REG_ORDER.slice(0, 8), 'etoile'];
  const META = { cendrier: { cols: 6, rows: 5, sample: ['sept', 'cloche', 'etoile'] } };
  const BETS = [5, 10, 25, 50, 100, 250, 500, 1000, 5000, 25000, 100000];
  const st = { bet: 2, spinning: false, fsLeft: 0, fsWin: 0, acc: 0, sup: false, turbo: false, auto: 0, last: 0, grid: null };
  const sleep = ms => new Promise(r => setTimeout(r, st.turbo ? Math.max(40, ms / 3.5) : ms));
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  let alive = false;     // l'écran est affiché (sert à arrêter les animations quand on quitte)
  const G = () => SlotEngine.GAMES[ID];

  function tile() { return `<span class="sl-tile-art">${META[ID].sample.map(symSvg).join('')}</span>`; }
  const randomGrid = () => Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => rnd(REELS)));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t); };
  const cashNow = () => (window.ClickerEngine && ClickerEngine.getCash) ? ClickerEngine.getCash() : 0;

  function render(content) {
    stop(); alive = true; st.spinning = false; st.auto = 0;
    if (!st.grid) st.grid = randomGrid();
    const g = G();
    content.innerHTML = `
      <div class="casino-felt-table sl-machine sl-cendrier">
        <div class="sl-marquee"><span>Le Grand Cendrier</span><button class="btn-secondary pk-mini" id="sl-pay">Gains</button></div>
        <div class="sl-fs hidden" id="sl-fs"></div>
        <div class="sl-board"><div class="sl-grid" id="sl-grid">${gridHtml(st.grid)}</div><div class="sl-big hidden" id="sl-big"></div></div>
        <div class="sl-win" id="sl-win">${st.last ? 'Dernier gain : ' + fmt(st.last) + ' €' : 'Fais tourner la machine'}</div>
        <div class="sl-controls">
          <div class="sl-bet"><button class="btn-secondary" id="sl-minus" aria-label="Moins">−</button><span id="sl-betv"><small>Mise</small><b>${fmt(BETS[st.bet])} €</b></span><button class="btn-secondary" id="sl-plus" aria-label="Plus">+</button></div>
          <button class="btn-primary sl-spin" id="sl-spin">Tourner</button>
          <div class="sl-side"><button class="btn-secondary pk-mini ${st.turbo ? 'is-on' : ''}" id="sl-turbo">Turbo</button><select class="game-select-empire" id="sl-auto"><option value="0">Auto</option><option value="10">10 tours</option><option value="25">25 tours</option><option value="50">50 tours</option><option value="100">100 tours</option></select></div>
        </div>
        <div class="sl-buy">
          <button class="btn-secondary sl-buy-btn" id="sl-buy1"><b>Acheter le bonus</b><small id="sl-buy1p"></small></button>
          <button class="btn-secondary sl-buy-btn sl-buy-super" id="sl-buy2"><b>Super bonus</b><small id="sl-buy2p"></small></button>
        </div>
      </div>`;
    bind(content); updatePrices(content); updateFs(content);
  }
  function updatePrices(content) {
    const g = G(), bet = BETS[st.bet], q = s => content.querySelector(s);
    if (q('#sl-buy1p')) q('#sl-buy1p').textContent = `10 tours · ${fmt(g.price('bonus') * bet)} € (×${g.price('bonus')})`;
    if (q('#sl-buy2p')) q('#sl-buy2p').textContent = `15 tours, bombes en folie · ${fmt(g.price('super') * bet)} € (×${g.price('super')})`;
  }
  // Cellule : en tombant, elle garde une animation de chute
  const SPARKS = [0, 60, 120, 180, 240, 300].map(a => `<b class="sl-sp" style="--a:${a}deg"></b>`).join('');
  function cellHtml(s, cls, val) { return `<div class="sl-cell ${cls || ''}">${symSvg(s)}${val ? `<i class="sl-bv">×${val}</i>` : ''}${cls && cls.includes('is-pop') ? SPARKS : ''}</div>`; }
  function gridHtml(grid, opt = {}) {
    // opt.win = Set 'c:r' qui clignotent ; opt.pop = Set qui éclatent ; opt.drop = { c: nbDeCellulesNeuves } ; opt.vals = { 'c:r': valeur }
    return grid.map((col, c) => `<div class="sl-col">${col.map((s, r) => {
      const k = c + ':' + r, cls = [opt.win && opt.win.has(k) ? 'is-win' : '', opt.pop && opt.pop.has(k) ? 'is-pop' : '', opt.drop && opt.drop[c] !== undefined ? (r < opt.drop[c] ? 'is-fall' : 'is-shift') : '', opt.drop && opt.drop[c] !== undefined ? 'd' + Math.min(r, 4) : ''].join(' ');
      return cellHtml(s, cls, opt.vals && opt.vals[k]);
    }).join('')}</div>`).join('');
  }
  function stop() { alive = false; }

  function bind(content) {
    const $ = s => content.querySelector(s);
    const setBet = d => { st.bet = Math.max(0, Math.min(BETS.length - 1, st.bet + d)); $('#sl-betv').innerHTML = `<small>Mise</small><b>${fmt(BETS[st.bet])} €</b>`; updatePrices(content); if (window.SoundFX) SoundFX.click(); };
    $('#sl-minus').addEventListener('click', () => !st.spinning && setBet(-1));
    $('#sl-plus').addEventListener('click', () => !st.spinning && setBet(1));
    $('#sl-spin').addEventListener('click', () => { if (st.spinning) { st.auto = 0; return; } play(content); });
    $('#sl-turbo').addEventListener('click', e => { st.turbo = !st.turbo; e.currentTarget.classList.toggle('is-on', st.turbo); });
    $('#sl-auto').addEventListener('change', e => { const n = +e.target.value; e.target.value = '0'; if (!n || st.spinning) return; st.auto = n; play(content); });
    $('#sl-pay').addEventListener('click', showPaytable);
    $('#sl-buy1').addEventListener('click', () => buyBonus(content, false));
    $('#sl-buy2').addEventListener('click', () => buyBonus(content, true));
  }

  async function buyBonus(content, sup) {
    if (st.spinning || st.fsLeft > 0) return;
    const g = G(), bet = BETS[st.bet], cost = g.price(sup ? 'super' : 'bonus') * bet;
    const ok = await GameDialog.confirm(`${sup ? 'Super bonus : 15 tours gratuits avec beaucoup plus de bombes' : 'Bonus : 10 tours gratuits'} pour ${fmt(cost)} € ?`, { title: 'Acheter un bonus', ok: 'Acheter', cancel: 'Non' });
    if (!ok || !alive) return;
    if (!spendMoney(cost)) return toast('Solde insuffisant pour acheter ce bonus.', 'error');
    if (typeof Casino !== 'undefined') Casino.recordBet();
    st.bought = cost; st.fsLeft = sup ? 15 : g.fsCount; st.sup = sup; st.acc = 0; st.fsWin = 0;
    updateFs(content); await bonusIntro(content, st.fsLeft, sup); if (alive) play(content);
  }

  async function play(content) {
    if (st.spinning) return;
    const g = G(), free = st.fsLeft > 0, bet = BETS[st.bet];
    if (!free) {
      if (!spendMoney(bet)) { st.auto = 0; return toast('Solde insuffisant pour cette mise. Baisse la mise.', 'error'); }
      if (typeof Casino !== 'undefined') Casino.recordBet();
    } else st.fsLeft--;
    st.spinning = true;
    const spinBtn = content.querySelector('#sl-spin'); if (spinBtn) { spinBtn.textContent = st.auto ? 'Stop auto' : free ? 'Tour gratuit…' : '…'; if (!st.auto) spinBtn.disabled = true; }
    if (window.SoundFX) SoundFX.click();
    const res = g.spin({ free, sup: st.sup, acc: st.acc });
    const startAcc = st.acc;
    await animate(content, res, free);
    if (!alive) { st.spinning = false; return; }
    st.acc = res.acc;
    const win = Math.round(res.mult * bet);
    if (win > 0) earnMoney(win);
    st.last = win; st.grid = res.grid;
    if (free || res.fs) st.fsWin += (free ? win : 0);
    const el = content.querySelector('#sl-win');
    if (el && win > 0) tick(el, win, res.mult, bet, free);
    else if (el) { el.className = 'sl-win'; el.textContent = free ? 'Rien sur ce tour gratuit' : 'Rien. La machine fait semblant de réfléchir.'; }
    if (win > 0 && window.SoundFX) SoundFX.win();
    if (win >= bet * 20) await bigWin(content, win, win / bet);
    // bilan de la partie (hors bonus)
    if (!free && !res.fs) {
      const net = win - bet;
      if (typeof Casino !== 'undefined') Casino.recordResult(net > 0 ? 'win' : 'lose', Math.abs(net), `${g.name} : ${net > 0 ? '+' : '−'}${fmt(Math.abs(net))}`);
    }
    // déclenchement du bonus par 4 étoiles ou plus
    if (res.fs && !free) { st.fsLeft += res.fs; st.sup = false; st.acc = 0; st.fsWin = win; st.bought = bet; await bonusIntro(content, res.fs, false); }
    else if (res.fs && free) { st.fsLeft += res.fs; toast(`+${res.fs} tours gratuits`, 'gold'); }
    updateFs(content);
    if (typeof saveGame === 'function') saveGame();
    st.spinning = false; if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = st.auto ? 'Stop auto' : 'Tourner'; }
    if (st.fsLeft > 0) { await sleep(900); if (alive) return play(content); return; }
    if (free) {
      // fin du bonus
      const total = st.fsWin, paid = st.bought || 0; st.fsWin = 0; st.acc = 0; st.sup = false; updateFs(content);
      if (typeof Casino !== 'undefined') Casino.recordResult(total > paid ? 'win' : 'lose', Math.abs(total - paid), `${g.name} bonus : ${total >= paid ? '+' : '−'}${fmt(Math.abs(total - paid))}`);
      await endBonus(content, total, total / bet);
    }
    if (st.auto > 0) { st.auto--; if (st.auto > 0 && !res.fs) { await sleep(450); if (alive) return play(content); } else st.auto = 0; }
    const sb = content.querySelector('#sl-spin'); if (sb) sb.textContent = 'Tourner';
  }

  // Le gain défile jusqu'à sa valeur
  function tick(el, win, mult, bet, free) {
    el.className = 'sl-win' + (win >= bet * 20 ? ' is-big' : ' is-ok');
    const t0 = performance.now(), dur = st.turbo ? 200 : 600;
    const f = now => { const p = Math.min(1, (now - t0) / dur); el.textContent = `Gain : +${fmt(Math.round(win * p))} €${mult >= 20 && p === 1 ? ' (×' + Math.round(mult) + ')' : ''}`; if (p < 1 && alive) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }

  function updateFs(content) {
    const el = content.querySelector('#sl-fs'); if (!el) return;
    if (st.fsLeft > 0 || st.acc > 0) { el.classList.remove('hidden'); el.innerHTML = `<span>Tours gratuits <b>${st.fsLeft}</b></span><span class="sl-fs-mult">Multiplicateur <b>×${st.acc || 0}</b></span><span>Gain du bonus <b>${fmt(st.fsWin)} €</b></span>`; }
    else el.classList.add('hidden');
  }

  // Animation : les colonnes tombent de gauche à droite ; puis chaque grappe gagnante éclate et le reste retombe
  async function animate(content, res, free) {
    const grid = content.querySelector('#sl-grid'); if (!grid) return;
    const first = res.steps.length ? res.steps[0].grid : res.grid, stars0 = first.reduce((a, c) => a + c.filter(x => x === 'etoile').length, 0);
    grid.innerHTML = gridHtml(first, { drop: Object.fromEntries([0, 1, 2, 3, 4, 5].map(c => [c, 5])) });
    grid.classList.add('is-dropping');
    if (window.SoundFX) { SoundFX.thud(); setTimeout(() => SoundFX.thud(), 250); }
    await sleep(650); grid.classList.remove('is-dropping');
    if (!alive) return;
    // suspense : 3 étoiles ou plus sur la première grille, on les fait briller avant de continuer
    if (stars0 >= 3 && !free) {
      const win = new Set(first.flatMap((col, c) => col.map((s, r) => s === 'etoile' ? c + ':' + r : null)).filter(Boolean));
      grid.innerHTML = gridHtml(first, { win }); grid.classList.add('is-tense');
      if (window.SoundFX) SoundFX.rise();
      await sleep(stars0 >= 4 ? 700 : 1100); grid.classList.remove('is-tense'); if (!alive) return;
    }
    for (let i = 0; i < res.steps.length; i++) {
      const step = res.steps[i];
      const win = new Set(step.grid.flatMap((col, c) => col.map((s, r) => step.removed.includes(s) ? c + ':' + r : null)).filter(Boolean));
      grid.innerHTML = gridHtml(step.grid, { win }); if (window.SoundFX) SoundFX.click();
      await sleep(600); if (!alive) return;
      grid.innerHTML = gridHtml(step.grid, { pop: win }); if (window.SoundFX) SoundFX.pop();
      showTumbleGain(content, step.mult, step.cm);
      await sleep(300); if (!alive) return;
      // nouvelle grille après la chute : colonnes touchées = cellules neuves en haut, les autres glissent
      const next = res.steps[i + 1] ? res.steps[i + 1].grid : res.grid, drop = {};
      step.grid.forEach((col, c) => { const n = col.filter(s => step.removed.includes(s)).length; if (n) drop[c] = n; });
      grid.innerHTML = gridHtml(next, { drop }); if (window.SoundFX) SoundFX.thud();
      await sleep(520);
    }
    if (!alive) return;
    if (free && res.bombs.length) {
      // les bombes explosent l'une après l'autre : chaque valeur s'ajoute au multiplicateur du bonus
      const pos = []; res.grid.forEach((col, c) => col.forEach((s, r) => { if (s === 'bombe') pos.push(c + ':' + r); }));
      const vals = {}; let run = st.acc - res.bombs.reduce((a, b) => a + b, 0);
      for (let k = 0; k < pos.length; k++) {
        vals[pos[k]] = res.bombs[k]; run += res.bombs[k];
        grid.innerHTML = gridHtml(res.grid, { vals }); if (window.SoundFX) SoundFX.boom();
        const fs = content.querySelector('.sl-fs-mult b'); if (fs) { fs.textContent = '×' + run; fs.classList.remove('bump'); void fs.offsetWidth; fs.classList.add('bump'); }
        await sleep(450); if (!alive) return;
      }
    } else grid.innerHTML = gridHtml(res.grid);
    if (res.scatters >= 4 && alive) {
      const win = new Set(res.grid.flatMap((col, c) => col.map((s, r) => s === 'etoile' ? c + ':' + r : null)).filter(Boolean));
      grid.innerHTML = gridHtml(res.grid, { win }); if (window.SoundFX) SoundFX.fanfare(); await sleep(900);
    }
  }
  // Petit gain flottant à chaque chute
  function showTumbleGain(content, mult, cm) {
    const board = content.querySelector('.sl-board'); if (!board || !(mult > 0)) return;
    const bet = BETS[st.bet], el = document.createElement('div'); el.className = 'sl-float'; el.textContent = '+' + fmt(Math.round(mult * bet)) + ' €' + (cm > 1 ? '  ×' + cm : '');
    board.appendChild(el); setTimeout(() => el.remove(), 1100);
  }
  // Annonce du bonus
  async function bonusIntro(content, n, sup) {
    const el = content.querySelector('#sl-big'); if (!el) return;
    el.className = 'sl-big sl-intro'; el.innerHTML = `<div class="sl-rays"></div><small>${sup ? 'Super bonus' : 'Bonus'}</small><b>${n} tours gratuits</b><em>Les bombes s'additionnent !</em>`;
    if (window.SoundFX) SoundFX.fanfare();
    await sleep(2000); el.className = 'sl-big hidden';
  }

  // Écran de gros gain
  async function bigWin(content, win, x) {
    const el = content.querySelector('#sl-big'); if (!el) return;
    const label = x >= 500 ? 'Jackpot du comptoir' : x >= 150 ? 'Gain monstre' : x >= 60 ? 'Très gros gain' : 'Gros gain';
    el.className = 'sl-big'; el.innerHTML = `<div class="sl-rays"></div>${Array.from({ length: 22 }, (_, i) => `<i class="sl-coin" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 1.2}s;animation-duration:${1 + Math.random() * 0.8}s"></i>`).join('')}<small>${label}</small><b>0 €</b><em>×${Math.round(x)}</em>`;
    const brd = content.querySelector('.sl-board'); if (brd) { brd.classList.add('is-shake'); setTimeout(() => brd.classList.remove('is-shake'), 700); }
    if (window.SoundFX) { SoundFX.fanfare(); setTimeout(() => SoundFX.coin(), 400); setTimeout(() => SoundFX.coin(), 700); }
    const b = el.querySelector('b'), t0 = performance.now(), dur = st.turbo ? 500 : 1500;
    await new Promise(res => { const f = now => { if (!alive) return res(); const p = Math.min(1, (now - t0) / dur); b.textContent = fmt(Math.round(win * p)) + ' €'; p < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
    await sleep(900); el.className = 'sl-big hidden';
  }
  async function endBonus(content, total, x) {
    const el = content.querySelector('#sl-big'); if (!el) return;
    el.className = 'sl-big'; el.innerHTML = `<small>Bonus terminé</small><b>${fmt(total)} €</b><em>×${Math.round(x * 10) / 10} la mise</em>`;
    await sleep(2200); el.className = 'sl-big hidden';
  }

  function showPaytable() {
    const g = G(), tbl = g.pay;
    const rows = Object.keys(tbl).reverse().map(sym => { const v = tbl[sym]; return `<div class="sl-pt-row">${symSvg(sym)}<div class="sl-pt-vals"><span>8-9 : ×${v[0]}</span><span>10-11 : ×${v[1]}</span><span>12+ : ×${v[2]}</span></div></div>`; }).join('');
    const sc = g.scatterPay;
    const extra = `<p>Les gains se paient sur <b>8 symboles identiques ou plus</b>, n'importe où sur la grille. Les gagnants disparaissent, les autres tombent, et ça recommence tant qu'il y a des grappes. Chaque chute d'affilée paie plus : ×1, puis ×2, ×3, ×4 et ×5 au maximum.</p>
      <p><b>4 étoiles ou plus</b> : gain immédiat (4 : ×${sc[4]}, 5 : ×${sc[5]}, 6 : ×${sc[6]}) et <b>10 tours gratuits</b>. Chaque nouvelle série de 4 étoiles pendant le bonus redonne ${g.retrigger} tours.</p>
      <p>Pendant les tours gratuits, des <b>bombes</b> (×2 à ×25) tombent : leurs valeurs <b>s'additionnent jusqu'à la fin du bonus</b> et multiplient chaque gain.</p>
      <p><b>Acheter le bonus</b> : tu paies ×${g.price('bonus')} ta mise et tu lances directement les 10 tours gratuits. <b>Super bonus</b> : ×${g.price('super')}, 15 tours et beaucoup plus de bombes. Un bonus acheté te rend en moyenne environ 90 % de son prix : plus cher qu'un tour normal, mais le bonus est garanti.</p>`;
    const el = document.createElement('div');
    el.className = 'soc-modal';
    el.innerHTML = `<div class="soc-modal-card pp-card"><h3>${esc(g.name)}</h3><p class="soc-empty">Gains en multiples de ta mise · retour théorique ≈ 93 % · gain max ×${SlotEngine.MAX_WIN}</p>${extra}<div class="bj-hist-list">${rows}</div><button class="btn-empire btn-empire-secondary soc-wide" data-x>Fermer</button></div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); });
    document.body.appendChild(el);
  }

  return { render, stop, tile, META, symSvg };
})();
if (typeof window !== 'undefined') window.Slots = Slots;
