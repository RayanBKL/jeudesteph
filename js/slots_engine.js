// ============================================================
// THE ASHTRAY KING — Machine à sous : moteur (sans affichage), testable en Node (scripts/sim_slots.js)
// UNE seule machine, « Le Grand Cendrier » : grille 6×5, 8 symboles identiques ou plus = gain, les gagnants disparaissent et le reste tombe.
// 4 étoiles ou plus = tours gratuits ; pendant les tours gratuits les bombes s'additionnent et multiplient chaque gain jusqu'à la fin du bonus.
// Les gains sont des multiples de la MISE TOTALE du tour (mise de base ; la « mise renforcée » coûte plus cher mais double les étoiles).
// ============================================================
const SlotEngine = (() => {
  const MAX_WIN = 5000;                       // gain maximum d'un tour (ou d'un bonus entier), en multiple de la mise
  const rnd = () => Math.random();
  const countSym = (grid, sym) => grid.reduce((a, col) => a + col.filter(s => s === sym).length, 0);
  const capWin = mult => Math.min(MAX_WIN, mult);
  function pickWeighted(weights) {
    let total = 0; for (const k in weights) total += weights[k];
    let r = rnd() * total; for (const k in weights) { r -= weights[k]; if (r < 0) return k; }
    return Object.keys(weights)[0];
  }

  // ── Tables CALIBRÉES : node scripts/sim_slots.js recalcule le retour au joueur (≈ 95 %) et réécrit ce bloc ──
  /*BAKED-START*/
  const BAKED = {"pay":{"verre":[0.15,0.4,1.05],"cig":[0.15,0.55,1.35],"briquet":[0.3,0.55,1.6],"paquet":[0.3,0.8,2.15],"des":[0.4,1.35,4.3],"cerise":[0.55,2.7,8.05],"cloche":[1.05,5.35,13.4],"sept":[2.7,13.4,53.5]},"scatterPay":{"4":1.6,"5":2.7,"6":53.5},"buy":{"bonus":82,"super":225,"ante":2.7}};
  /*BAKED-END*/

  const GRAND = {
    id: 'cendrier', name: 'Le Grand Cendrier', cols: 6, rows: 5,
    reg: { verre: 20, cig: 18, briquet: 16, paquet: 14, des: 12, cerise: 9, cloche: 6, sept: 4 },
    pay: BAKED.pay, scatterPay: BAKED.scatterPay, buy: BAKED.buy,
    fsCount: 10, retrigger: 5, scatterW: 2.0, anteScatter: 1.5, bombW: 3.2, superBombW: 5,
    bombs: { 2: 30, 3: 24, 4: 18, 5: 12, 8: 8, 10: 5, 15: 2, 25: 1 },
    // prix d'achat des bonus en multiples de la mise de base
    price(kind) { return this.buy[kind] || 0; },
    _total(o) { return Object.values(this.reg).reduce((a, b) => a + b, 0) + this.scatterW * (o.ante ? this.anteScatter : 1) + (o.free ? (o.sup ? this.superBombW : this.bombW) : 0); },
    _pick(o) {
      let r = rnd() * this._total(o);
      for (const k in this.reg) { r -= this.reg[k]; if (r < 0) return k; }
      r -= this.scatterW * (o.ante ? this.anteScatter : 1); if (r < 0) return 'etoile';
      return o.free ? 'bombe' : 'etoile';
    },
    // Un tour. o = { free, ante, sup, acc } ; acc = somme des bombes déjà tombées pendant ce bonus.
    // Renvoie { grid, steps, mult, bombs: [valeurs], acc, fs, scatters }
    spin(o = {}) {
      const free = !!o.free; const opt = { free, ante: !free && !!o.ante, sup: !!o.sup };
      let grid = Array.from({ length: this.cols }, () => Array.from({ length: this.rows }, () => this._pick(opt)));
      const steps = []; let mult = 0, scatters = countSym(grid, 'etoile'), guard = 0;
      while (guard++ < 40) {
        const counts = {}; grid.forEach(col => col.forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
        const hit = Object.entries(counts).filter(([s, n]) => this.pay[s] && n >= 8);
        if (!hit.length) break;
        let stepMult = 0; const removed = [];
        hit.forEach(([s, n]) => { stepMult += this.pay[s][n >= 12 ? 2 : n >= 10 ? 1 : 0]; removed.push(s); });
        mult += stepMult; steps.push({ grid: grid.map(c => c.slice()), removed, mult: stepMult });
        grid = grid.map(col => { const keep = col.filter(s => !removed.includes(s)); return Array.from({ length: this.rows - keep.length }, () => this._pick(opt)).concat(keep); });
        scatters = Math.max(scatters, countSym(grid, 'etoile'));
      }
      // bombes : leur valeur est tirée à la fin du tour, s'additionne au multiplicateur du bonus et s'applique à tout le gain du tour
      const bombs = []; let acc = o.acc || 0;
      if (free) {
        grid.forEach(col => col.forEach(s => { if (s === 'bombe') bombs.push(Number(pickWeighted(this.bombs))); }));
        acc += bombs.reduce((a, b) => a + b, 0);
        if (mult > 0 && acc > 0) mult *= acc;
      }
      let fs = 0;
      if (scatters >= 4) { mult += this.scatterPay[Math.min(6, scatters)]; fs = free ? this.retrigger : this.fsCount; }
      return { grid, steps, mult: mult, bombs, acc, fs, scatters };
    },
    // Un bonus entier (achat ou déclenchement) : renvoie le gain total en multiples de la mise
    bonus(sup, first) {
      let left = sup ? 15 : this.fsCount, acc = 0, total = 0, spins = 0;
      if (first) total += first;
      while (left-- > 0 && spins++ < 300) { const r = this.spin({ free: true, sup, acc }); acc = r.acc; total += r.mult; if (r.fs) left += r.fs; if (total >= MAX_WIN) break; }
      return Math.min(MAX_WIN, total);
    },
  };

  const GAMES = { cendrier: GRAND };

  // Simulation : retour au joueur (RTP) du jeu normal, de la mise renforcée et des deux bonus achetés
  function simulate(n, mode) {
    const g = GRAND; let total = 0, hits = 0, big = 0, fsTriggers = 0;
    for (let i = 0; i < n; i++) {
      const r = g.spin({ ante: mode === 'ante' });
      let w = r.mult; if (r.mult > 0) hits++;
      if (r.fs) { fsTriggers++; w = g.bonus(false, r.mult); }
      w = Math.min(w, MAX_WIN); total += w; if (w >= 100) big++;
    }
    return { rtp: total / n, hitRate: hits / n, fsEvery: fsTriggers ? n / fsTriggers : 0, big: big / n };
  }
  function bonusEV(sup, n) {   // gain moyen d'un bonus acheté (déclenchement garanti par l'achat : on paie 3 pour les 4 étoiles de départ, voir prix)
    let t = 0; for (let i = 0; i < n; i++) t += GRAND.bonus(sup, 0); return t / n;
  }

  return { GAMES, simulate, bonusEV, MAX_WIN };
})();
if (typeof module !== 'undefined') module.exports = SlotEngine;
if (typeof window !== 'undefined') window.SlotEngine = SlotEngine;
