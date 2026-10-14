// ============================================================
// THE ASHTRAY KING — Pierre-Briquet-Clope (contre l'ordinateur)
// La pierre casse le briquet, le briquet allume la clope, la clope enfume la pierre.
// Premier à 3 points. Plus il est haut classé, plus l'ordi lit tes habitudes.
// ============================================================

const PBC = (() => {
  const GAME = 'pbc';
  const MOVES = {
    pierre:  { name: 'Pierre',  beats: 'briquet', verb: 'La pierre casse le briquet' },
    briquet: { name: 'Briquet', beats: 'clope',   verb: 'Le briquet allume la clope' },
    clope:   { name: 'Clope',   beats: 'pierre',  verb: 'La clope enfume la pierre' },
  };
  const KEYS = Object.keys(MOVES);
  let st = null;

  // Icônes dessinées (pas d'emoji)
  const ICONS = {
    pierre: `<svg viewBox="0 0 64 64"><path d="M12 42c-4-8 2-20 12-24 6-8 18-8 24-1 8 3 11 13 7 21-2 9-11 13-22 12-10 1-18-1-21-8z" fill="#9b948a" stroke="#120a04" stroke-width="4" stroke-linejoin="round"/><path d="M24 28c4-3 9-3 12 0M36 40c3 1 6 0 8-2" fill="none" stroke="#6f685f" stroke-width="3" stroke-linecap="round"/></svg>`,
    briquet: `<svg viewBox="0 0 64 64"><rect x="18" y="24" width="28" height="34" rx="5" fill="#e2322b" stroke="#120a04" stroke-width="4"/><rect x="22" y="16" width="20" height="10" rx="2" fill="#c9c2b4" stroke="#120a04" stroke-width="4"/><path d="M32 4c6 6 6 10 0 12-6-2-6-6 0-12z" fill="#ffc43a" stroke="#120a04" stroke-width="3" stroke-linejoin="round"/><path d="M24 34h16" stroke="#ff8a7e" stroke-width="3" stroke-linecap="round"/></svg>`,
    clope: `<svg viewBox="0 0 64 64"><g transform="rotate(-30 32 34)"><rect x="6" y="28" width="46" height="12" rx="2" fill="#fbf0d8" stroke="#120a04" stroke-width="4"/><rect x="6" y="28" width="15" height="12" rx="2" fill="#ff9d1c" stroke="#120a04" stroke-width="4"/><rect x="52" y="28" width="6" height="12" rx="1" fill="#ff3b1f" stroke="#120a04" stroke-width="4"/></g><path d="M52 16c-4-4 4-8 0-12" fill="none" stroke="#e8dcc2" stroke-width="4" stroke-linecap="round"/></svg>`,
  };

  function start(container) {
    st = { container, score: [0, 0], history: [], phase: 'choose', last: null, roundStreak: 0, d: League.difficulty(GAME) };
    render();
  }

  // L'ordi cherche ce que tu joues le plus souvent après ton coup précédent
  function aiChoice() {
    if (st.history.length >= 2 && Math.random() < 0.15 + st.d * 0.65) {
      const prev = st.history[st.history.length - 1].me;
      const next = {};
      for (let i = 1; i < st.history.length; i++) {
        if (st.history[i - 1].me === prev) next[st.history[i].me] = (next[st.history[i].me] || 0) + 1;
      }
      let guess = Object.keys(next).sort((a, b) => next[b] - next[a])[0];
      if (!guess) {
        const freq = {};
        st.history.forEach(h => freq[h.me] = (freq[h.me] || 0) + 1);
        guess = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
      }
      return KEYS.find(k => MOVES[k].beats === guess);
    }
    return KEYS[Math.floor(Math.random() * 3)];
  }

  function render() {
    const { container } = st;
    const last = st.last;
    container.innerHTML = `
      <div class="mg-screen mg-pbc">
        ${GameUI.header(GAME, 'Premier à 3 points')}
        <div class="mg-scoreboard">
          <div class="mg-score-side"><span>Toi</span><strong>${st.score[0]}</strong></div>
          <div class="mg-round">Manche ${st.history.length + 1}</div>
          <div class="mg-score-side"><span>L'ordi</span><strong>${st.score[1]}</strong></div>
        </div>
        <div class="pbc-arena">
          <div class="pbc-hand pbc-hand-ai ${last ? 'is-shown' : ''}">${last ? ICONS[last.ai] : '<span class="pbc-q">?</span>'}</div>
          <div class="pbc-verdict ${last ? 'is-' + last.outcome : ''}">${last ? last.text : 'Choisis ton coup'}</div>
          <div class="pbc-hand pbc-hand-me ${last ? 'is-shown' : ''}">${last ? ICONS[last.me] : '<span class="pbc-q">?</span>'}</div>
        </div>
        <div class="pbc-choices">
          ${KEYS.map(k => `
            <button class="pbc-choice" data-move="${k}" ${st.phase !== 'choose' ? 'disabled' : ''}>
              ${ICONS[k]}<span>${MOVES[k].name}</span>
            </button>`).join('')}
        </div>
        <p class="mg-hint">La pierre casse le briquet · le briquet allume la clope · la clope enfume la pierre</p>
      </div>`;
    GameUI.bindBack(container);
    container.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => play(b.dataset.move)));
  }

  async function play(me) {
    if (st.phase !== 'choose') return;
    st.phase = 'reveal';
    const ai = aiChoice();
    // Petit suspense
    const arena = st.container.querySelector('.pbc-verdict');
    st.container.querySelectorAll('.pbc-choice').forEach(b => b.disabled = true);
    for (const w of ['Pierre…', 'Briquet…', 'Clope !']) {
      if (arena) arena.textContent = w;
      if (window.SoundFX && SoundFX.click) SoundFX.click();
      await GameUI.sleep(330);
    }
    let outcome = 'draw';
    let text = 'Égalité';
    if (MOVES[me].beats === ai) { outcome = 'win'; text = MOVES[me].verb; st.score[0]++; st.roundStreak++; }
    else if (MOVES[ai].beats === me) { outcome = 'loss'; text = MOVES[ai].verb; st.score[1]++; st.roundStreak = 0; }
    st.history.push({ me, ai });
    st.last = { me, ai, outcome, text };
    st.phase = 'choose';
    render();

    if (st.score[0] >= 3 || st.score[1] >= 3) {
      st.phase = 'over';
      const win = st.score[0] > st.score[1];
      if (win && st.score[1] === 0) Prestige.emit('perfect', { game: GAME });
      await GameUI.sleep(700);
      GameUI.showResult(st.container.querySelector('.mg-screen'), GAME, win ? 'win' : 'loss', `${st.score[0]} à ${st.score[1]}`, () => start(st.container));
    }
  }

  return { start, ICONS };
})();

if (typeof window !== 'undefined') window.PBC = PBC;
