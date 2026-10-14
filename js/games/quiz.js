// ============================================================
// THE ASHTRAY KING — Quiz du Comptoir
// 10 photos de cartes, 4 noms proposés, 8 secondes par question.
// Bonne réponse = 100 points + bonus de rapidité. L'ordi répond en même temps,
// plus il est haut classé, plus il est rapide et juste.
// ============================================================

const QuizComptoir = (() => {
  const GAME = 'quiz';
  const QUESTIONS = 10;
  const TIME = 8000;
  let st = null;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Questions : une carte + 3 mauvaises réponses de la même famille (pour que ce soit dur)
  function buildQuestions() {
    const all = getAllBaseItemsList();
    const byCat = {};
    all.forEach(c => (byCat[c.cat] = byCat[c.cat] || []).push(c));
    const cats = Object.keys(byCat);
    const out = [];
    const used = new Set();
    while (out.length < QUESTIONS + 6) {
      const cat = cats[Math.floor(Math.random() * cats.length)];
      // On préfère les cartes connues (raretés hautes) : plus drôle à deviner
      const pool = byCat[cat].filter(c => c.rarity !== 'commune' || Math.random() < 0.25);
      const answer = pool[Math.floor(Math.random() * pool.length)];
      if (!answer || used.has(answer.id)) continue;
      used.add(answer.id);
      const wrong = shuffle(byCat[cat].filter(c => c.id !== answer.id)).slice(0, 3);
      out.push({ answer, choices: shuffle([answer, ...wrong]) });
    }
    return out;
  }

  function start(container) {
    st = { container, d: League.difficulty(GAME), q: buildQuestions(), i: 0, score: [0, 0], phase: 'ask', timer: null };
    ask();
  }

  function ask() {
    const { container } = st;
    clearTimeout(st.timer);
    if (st.i >= QUESTIONS) return finish();
    const q = st.q[st.i];
    const img = CardsRenderer.resolveCardPhoto(q.answer);
    st.phase = 'ask';
    st.t0 = performance.now();
    container.innerHTML = `
      <div class="mg-screen mg-quiz">
        ${GameUI.header(GAME, 'Devine la carte à partir de la photo')}
        <div class="mg-scoreboard">
          <div class="mg-score-side"><span>Toi</span><strong>${st.score[0]}</strong></div>
          <div class="mg-round">Question ${st.i + 1}/${QUESTIONS}</div>
          <div class="mg-score-side"><span>L'ordi</span><strong>${st.score[1]}</strong></div>
        </div>
        <div class="qz-timer"><div class="qz-timer-fill" style="animation-duration:${TIME}ms"></div></div>
        <div class="qz-photo rv-r-${q.answer.rarity}">
          <img src="${img}" alt="" />
          <span class="qz-cat">${(CardsRenderer.CAT_CONFIG[q.answer.cat] || {}).label || ''}</span>
        </div>
        <div class="qz-choices">
          ${q.choices.map((c, k) => `<button class="qz-choice" data-k="${k}">${c.name}</button>`).join('')}
        </div>
      </div>`;
    GameUI.bindBack(container);
    // Photo manquante : on passe à une autre question de réserve
    container.querySelector('.qz-photo img').addEventListener('error', () => {
      if (st.q.length > QUESTIONS) { st.q.splice(st.i, 1); ask(); }
    });
    container.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => answer(+b.dataset.k)));
    st.timer = setTimeout(() => answer(-1), TIME);
  }

  async function answer(k) {
    if (st.phase !== 'ask') return;
    st.phase = 'reveal';
    clearTimeout(st.timer);
    const q = st.q[st.i];
    const elapsed = performance.now() - st.t0;
    const good = k >= 0 && q.choices[k].id === q.answer.id;
    if (good) st.score[0] += 100 + Math.round(Math.max(0, TIME - elapsed) / TIME * 50);

    // L'ordi : juste à 45 % au rang Mégot, 90 % au rang Roi
    const aiGood = Math.random() < 0.45 + st.d * 0.45;
    const aiTime = (0.35 + Math.random() * 0.5) * TIME * (1 - st.d * 0.4);
    if (aiGood) st.score[1] += 100 + Math.round(Math.max(0, TIME - aiTime) / TIME * 50);

    st.container.querySelectorAll('.qz-choice').forEach((b, i) => {
      b.disabled = true;
      if (q.choices[i].id === q.answer.id) b.classList.add('is-good');
      else if (i === k) b.classList.add('is-bad');
    });
    const fill = st.container.querySelector('.qz-timer-fill');
    if (fill) fill.style.animationPlayState = 'paused';
    const sides = st.container.querySelectorAll('.mg-score-side strong');
    if (sides[0]) sides[0].textContent = st.score[0];
    if (sides[1]) sides[1].textContent = st.score[1];
    const hint = document.createElement('p');
    hint.className = 'mg-hint';
    hint.textContent = `${good ? 'Bien vu !' : k < 0 ? 'Trop tard !' : 'Raté…'} L'ordi ${aiGood ? 'a trouvé' : 's\'est planté'}.`;
    st.container.querySelector('.mg-screen').appendChild(hint);
    if (window.SoundFX) (good && SoundFX.upgrade ? SoundFX.upgrade() : SoundFX.click && SoundFX.click());
    if (good && typeof Prestige !== 'undefined') Prestige.emit('quiz_good');
    await GameUI.sleep(1300);
    st.i++;
    ask();
  }

  function finish() {
    const [me, ai] = st.score;
    const result = me > ai ? 'win' : me < ai ? 'loss' : 'draw';
    st.container.querySelector('.qz-choices')?.remove();
    GameUI.showResult(st.container.querySelector('.mg-screen'), GAME, result, `${me} points contre ${ai}`, () => start(st.container));
  }

  return { start };
})();

if (typeof window !== 'undefined') window.QuizComptoir = QuizComptoir;
