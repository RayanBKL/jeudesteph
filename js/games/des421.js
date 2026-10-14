// ============================================================
// THE ASHTRAY KING — 421 du Bistrot (contre l'ordinateur)
// 3 lancers maximum par manche, on garde les dés qu'on veut.
// La meilleure combinaison gagne la manche. Premier à 2 manches.
// ============================================================

const Des421 = (() => {
  const GAME = 'des421';
  let st = null;

  // Valeur d'une combinaison (plus c'est haut, mieux c'est)
  function evaluate(dice) {
    const s = dice.slice().sort((a, b) => b - a);
    const key = s.join('');
    if (key === '421') return { score: 1000, name: '421 !', combo: '421' };
    if (key === '111') return { score: 900, name: 'Mac (trois as)', combo: 'mac' };
    if (s[0] === s[1] && s[1] === s[2]) return { score: 800 + s[0], name: `Brelan de ${s[0]}`, combo: 'brelan' };
    if (s[1] === 1 && s[2] === 1) return { score: 700 + s[0], name: `Deux as et un ${s[0]}`, combo: 'as' };
    if (s[0] - s[1] === 1 && s[1] - s[2] === 1) return { score: 600 + s[0], name: `Suite ${s[2]}-${s[1]}-${s[0]}`, combo: 'suite' };
    if (key === '221') return { score: 0, name: 'Nénette (2-2-1)', combo: 'nenette' };
    return { score: Number(key) / 10, name: `${s.join('-')}`, combo: 'points' };
  }

  function roll() { return 1 + Math.floor(Math.random() * 6); }

  function diceSVG(v, held) {
    const pips = { 1: [[16, 16]], 2: [[9, 9], [23, 23]], 3: [[9, 9], [16, 16], [23, 23]], 4: [[9, 9], [23, 9], [9, 23], [23, 23]],
      5: [[9, 9], [23, 9], [16, 16], [9, 23], [23, 23]], 6: [[9, 8], [23, 8], [9, 16], [23, 16], [9, 24], [23, 24]] }[v] || [];
    return `<svg viewBox="0 0 32 32" class="die-svg ${held ? 'is-held' : ''}">
      <rect x="2" y="2" width="28" height="28" rx="6" class="die-body"/>
      ${pips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" class="die-pip ${v === 1 || (v === 4) ? 'pip-red' : ''}"/>`).join('')}
    </svg>`;
  }

  // Stratégie de l'ordinateur : plus il est haut classé, mieux il garde ses dés
  function aiKeep(dice, rollsLeft, d) {
    const ev = evaluate(dice);
    if (ev.score >= 800 || (ev.score >= 700 && Math.random() < 0.5 + d / 2)) return [true, true, true];
    if (Math.random() > 0.35 + d * 0.6) return dice.map(() => Math.random() < 0.3); // joue « au feeling »
    const keep = [false, false, false];
    const want = [4, 2, 1];
    // Vise le 421
    const used = new Set();
    want.forEach(w => {
      const i = dice.findIndex((v, idx) => v === w && !used.has(idx));
      if (i >= 0) used.add(i);
    });
    if (used.size >= 2) { used.forEach(i => keep[i] = true); return keep; }
    // Sinon garde les as ou la paire la plus forte
    const counts = {};
    dice.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const pair = Object.keys(counts).find(k => counts[k] >= 2);
    dice.forEach((v, i) => { if (v === 1 || (pair && v === Number(pair))) keep[i] = true; });
    return keep;
  }

  function start(container) {
    st = { container, round: 1, score: [0, 0], dice: [0, 0, 0], held: [false, false, false], rollsLeft: 3, phase: 'player', ai: null, d: League.difficulty(GAME), history: [] };
    render();
  }

  function render() {
    const { container } = st;
    const ev = st.dice[0] ? evaluate(st.dice) : null;
    container.innerHTML = `
      <div class="mg-screen mg-421">
        ${GameUI.header(GAME, 'Premier à 2 manches')}
        <div class="mg-scoreboard">
          <div class="mg-score-side"><span>Toi</span><strong>${st.score[0]}</strong></div>
          <div class="mg-round">Manche ${st.round}</div>
          <div class="mg-score-side"><span>L'ordi</span><strong>${st.score[1]}</strong></div>
        </div>
        <div class="d421-ai ${st.ai ? '' : 'is-waiting'}">
          <span class="d421-label">L'ordi</span>
          <div class="d421-dice d421-dice-sm">${(st.ai ? st.ai.dice : [0, 0, 0]).map(v => v ? diceSVG(v) : '<div class="die-empty"></div>').join('')}</div>
          <span class="d421-combo">${st.ai ? evaluate(st.ai.dice).name : 'attend son tour'}</span>
        </div>
        <div class="d421-table">
          <div class="d421-dice">${st.dice.map((v, i) => v ? `<button class="die-btn" data-die="${i}" ${st.phase !== 'player' || st.rollsLeft === 3 ? 'disabled' : ''}>${diceSVG(v, st.held[i])}</button>` : '<div class="die-empty die-empty-lg"></div>').join('')}</div>
          <div class="d421-combo d421-combo-lg">${ev ? ev.name : 'Lance les dés'}</div>
          <p class="mg-hint">${st.phase === 'player' && st.rollsLeft < 3 && st.rollsLeft > 0 ? 'Touche un dé pour le garder, puis relance les autres' : '&nbsp;'}</p>
        </div>
        <div class="mg-actions">
          ${st.phase === 'player' ? `
            <button class="btn-empire btn-empire-secondary" data-act="stop" ${st.rollsLeft === 3 ? 'disabled' : ''}>Je garde</button>
            <button class="btn-empire btn-empire-primary" data-act="roll" ${st.rollsLeft === 0 ? 'disabled' : ''}>Lancer (${st.rollsLeft})</button>
          ` : `<div class="mg-wait">${st.phase === 'ai' ? 'L\'ordi lance…' : ''}</div>`}
        </div>
      </div>`;
    GameUI.bindBack(container);
    container.querySelectorAll('[data-die]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.die;
      st.held[i] = !st.held[i];
      if (window.SoundFX && SoundFX.click) SoundFX.click();
      render();
    }));
    container.querySelector('[data-act="roll"]')?.addEventListener('click', playerRoll);
    container.querySelector('[data-act="stop"]')?.addEventListener('click', endPlayerTurn);
  }

  async function animateRoll(target, keep) {
    for (let k = 0; k < 6; k++) {
      target.forEach((v, i) => { if (!keep[i]) target[i] = roll(); });
      render();
      await GameUI.sleep(55);
    }
  }

  async function playerRoll() {
    if (st.phase !== 'player' || st.rollsLeft <= 0) return;
    st.phase = 'rolling';
    if (window.SoundFX && SoundFX.click) SoundFX.click();
    await animateRoll(st.dice, st.held);
    st.rollsLeft--;
    st.phase = 'player';
    const ev = evaluate(st.dice);
    if (ev.combo === '421' || ev.combo === 'mac' || ev.combo === 'brelan') Prestige.emit('dice_combo', { combo: ev.combo });
    if (st.rollsLeft === 0) return endPlayerTurn();
    render();
  }

  async function endPlayerTurn() {
    st.phase = 'ai';
    const maxRolls = 3 - st.rollsLeft; // l'ordi n'a pas plus de lancers que toi
    st.ai = { dice: [0, 0, 0] };
    render();
    let keep = [false, false, false];
    for (let r = 0; r < maxRolls; r++) {
      await GameUI.sleep(450);
      await animateRoll(st.ai.dice, keep);
      if (r < maxRolls - 1) {
        keep = aiKeep(st.ai.dice, maxRolls - r - 1, st.d);
        if (keep.every(Boolean)) break;
      }
    }
    await GameUI.sleep(500);
    endRound();
  }

  function endRound() {
    const me = evaluate(st.dice).score;
    const ai = evaluate(st.ai.dice).score;
    if (me > ai) st.score[0]++;
    else if (ai > me) st.score[1]++;
    const roundText = me > ai ? 'Manche pour toi' : ai > me ? 'Manche pour l\'ordi' : 'Manche nulle, on rejoue';
    if (typeof showToast === 'function') showToast(roundText, me > ai ? 'success' : ai > me ? 'error' : 'info');

    if (st.score[0] >= 2 || st.score[1] >= 2) {
      const win = st.score[0] > st.score[1];
      render();
      GameUI.showResult(st.container.querySelector('.mg-screen'), GAME, win ? 'win' : 'loss',
        `${st.score[0]} manche${st.score[0] > 1 ? 's' : ''} à ${st.score[1]}`, () => start(st.container));
      return;
    }
    st.round++;
    st.dice = [0, 0, 0];
    st.held = [false, false, false];
    st.rollsLeft = 3;
    st.ai = null;
    st.phase = 'player';
    render();
  }

  return { start, evaluate, diceSVG };
})();

if (typeof window !== 'undefined') window.Des421 = Des421;
