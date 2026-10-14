// ============================================================
// THE ASHTRAY KING — Bataille de Comptoir (avec tes cartes)
// Chacun reçoit 5 cartes. À chaque manche une stat est tirée (Passif, Clic ou Cote) :
// chacun pose une carte, la plus forte sur cette stat gagne. Premier à 3 manches.
// Plus l'ordi est haut classé, plus son jeu est rare et mieux il joue.
// ============================================================

const Bataille = (() => {
  const GAME = 'bataille';
  const STATS = {
    cashPerSec: { name: 'Passif', fmt: v => '+' + fmtNum(v) + '/s' },
    clickBoost: { name: 'Clic',   fmt: v => '+' + fmtNum(v) },
    value:      { name: 'Cote',   fmt: v => fmtNum(v) + ' €' },
  };
  const RARITY_ORDER = ['commune', 'peu-commune', 'rare', 'epique', 'legendaire', 'mythique'];
  let st = null;

  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + ' k';
    return n >= 10 ? Math.round(n).toString() : Number(n).toFixed(2).replace('.', ',');
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Ta main : 5 cartes tirées dans ta collection (complétée par des cartes « prêtées » si besoin)
  function playerHand(all) {
    const inv = (typeof EmpireManager !== 'undefined') ? EmpireManager.getInventory() : {};
    const owned = Object.keys(inv).filter(id => inv[id] > 0).map(id => getEmpireItemById(id)).filter(Boolean);
    const hand = shuffle(owned.slice()).slice(0, 5).map(c => ({ ...c, lent: false }));
    const commons = all.filter(c => c.rarity === 'commune');
    while (hand.length < 5) hand.push({ ...commons[Math.floor(Math.random() * commons.length)], lent: true });
    return hand;
  }

  // Main de l'ordi : rareté qui monte avec son rang
  function aiHand(all, d) {
    const weights = RARITY_ORDER.map((r, i) => Math.max(0.02, Math.pow(1 - Math.abs(i / 5 - d * 0.85), 3)));
    const sum = weights.reduce((a, b) => a + b, 0);
    const byR = {};
    all.forEach(c => (byR[c.rarity] = byR[c.rarity] || []).push(c));
    const hand = [];
    while (hand.length < 5) {
      let x = Math.random() * sum, k = 0;
      while (x > weights[k]) { x -= weights[k]; k++; }
      const pool = byR[RARITY_ORDER[Math.min(k, 5)]] || all;
      hand.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return hand;
  }

  function start(container) {
    const all = getAllBaseItemsList();
    const d = League.difficulty(GAME);
    st = {
      container, d, score: [0, 0], round: 1,
      me: playerHand(all), ai: aiHand(all, d),
      stat: null, played: null, phase: 'choose',
    };
    nextStat();
    render();
  }

  function nextStat() {
    const keys = Object.keys(STATS);
    st.stat = keys[Math.floor(Math.random() * keys.length)];
  }

  function miniCard(c, opts = {}) {
    const img = (typeof CardsRenderer !== 'undefined') ? CardsRenderer.resolveCardPhoto(c) : '';
    return `
      <button class="bt-card rv-r-${c.rarity} ${opts.cls || ''}" ${opts.idx !== undefined ? `data-idx="${opts.idx}"` : ''} ${opts.disabled ? 'disabled' : ''}>
        <span class="bt-card-art" data-initial="${(c.name || '?').slice(0, 1).replace(/"/g, '')}"><img src="${img}" alt="" loading="lazy" onerror="this.remove()" /></span>
        <span class="bt-card-name">${c.name}</span>
        <span class="bt-card-stat">${STATS[st.stat].fmt(c[st.stat] || 0)}</span>
        ${c.lent ? '<span class="bt-lent">prêtée</span>' : ''}
      </button>`;
  }

  function render() {
    const { container } = st;
    const p = st.played;
    container.innerHTML = `
      <div class="mg-screen mg-bataille">
        ${GameUI.header(GAME, 'Premier à 3 manches')}
        <div class="mg-scoreboard">
          <div class="mg-score-side"><span>Toi</span><strong>${st.score[0]}</strong></div>
          <div class="mg-round">Manche ${st.round}</div>
          <div class="mg-score-side"><span>L'ordi</span><strong>${st.score[1]}</strong></div>
        </div>
        <div class="bt-ai-hand">${st.ai.map(() => '<span class="bt-back"></span>').join('')}</div>
        <div class="bt-stat-banner">Manche jouée sur : <strong>${STATS[st.stat].name}</strong></div>
        <div class="bt-board">
          <div class="bt-slot"><span class="bt-slot-label">Toi</span>${p ? miniCard(p.me, { cls: p.outcome === 'win' ? 'is-winner' : '' }) : '<span class="bt-slot-empty">Ta carte</span>'}</div>
          <div class="bt-vs ${p ? 'is-' + p.outcome : ''}">${p ? (p.outcome === 'win' ? 'Gagné' : p.outcome === 'loss' ? 'Perdu' : 'Égalité') : 'VS'}</div>
          <div class="bt-slot"><span class="bt-slot-label">L'ordi</span>${p ? miniCard(p.ai, { cls: p.outcome === 'loss' ? 'is-winner' : '' }) : '<span class="bt-slot-empty">?</span>'}</div>
        </div>
        <div class="bt-hand">${st.me.map((c, i) => miniCard(c, { idx: i, disabled: st.phase !== 'choose' })).join('')}</div>
        <p class="mg-hint">${st.phase === 'choose' ? `Pose la carte la plus forte en <strong>${STATS[st.stat].name}</strong>… ou garde-la pour plus tard` : '&nbsp;'}</p>
      </div>`;
    GameUI.bindBack(container);
    container.querySelectorAll('.bt-hand [data-idx]').forEach(b => b.addEventListener('click', () => play(+b.dataset.idx)));
  }

  // L'ordi : plus il est fort, plus il pose juste ce qu'il faut (sans gaspiller ses meilleures cartes)
  function aiPick() {
    const stat = st.stat;
    const sorted = st.ai.map((c, i) => ({ c, i })).sort((a, b) => (b.c[stat] || 0) - (a.c[stat] || 0));
    if (Math.random() > 0.3 + st.d * 0.7) return sorted[Math.floor(Math.random() * sorted.length)].i;
    return Math.random() < 0.5 ? sorted[0].i : sorted[Math.min(1, sorted.length - 1)].i;
  }

  async function play(idx) {
    if (st.phase !== 'choose') return;
    st.phase = 'reveal';
    const me = st.me.splice(idx, 1)[0];
    const ai = st.ai.splice(aiPick(), 1)[0];
    const a = me[st.stat] || 0, b = ai[st.stat] || 0;
    const outcome = a > b ? 'win' : a < b ? 'loss' : 'draw';
    if (outcome === 'win') st.score[0]++;
    if (outcome === 'loss') st.score[1]++;
    st.played = { me, ai, outcome };
    if (window.SoundFX && SoundFX.click) SoundFX.click();
    render();
    await GameUI.sleep(1300);

    const over = st.score[0] >= 3 || st.score[1] >= 3 || st.me.length === 0;
    if (over) {
      const result = st.score[0] > st.score[1] ? 'win' : st.score[0] < st.score[1] ? 'loss' : 'draw';
      if (result === 'win' && st.score[1] === 0) Prestige.emit('perfect', { game: GAME });
      GameUI.showResult(st.container.querySelector('.mg-screen'), GAME, result, `${st.score[0]} manche${st.score[0] > 1 ? 's' : ''} à ${st.score[1]}`, () => start(st.container));
      return;
    }
    st.round++;
    st.played = null;
    st.phase = 'choose';
    nextStat();
    render();
  }

  return { start };
})();

if (typeof window !== 'undefined') window.Bataille = Bataille;
