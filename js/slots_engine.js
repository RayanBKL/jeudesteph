// ============================================================
// THE ASHTRAY KING — Machines à sous : moteur (sans affichage), testable en Node (scripts/sim_slots.js)
// 4 machines : Tiroir-Caisse (3 rouleaux), Bar PMU (5×3, 20 lignes, tours gratuits), Cascade du Cendrier (6×5, gains en grappes),
// Le Livre du Buraliste (5×3, symbole qui s'étend). Les gains sont des multiples de la MISE TOTALE du tour.
// ============================================================
const SlotEngine = (() => {
  const MAX_WIN = 5000;
  const SCALE = { classic: 1, pmu: 1, livre: 1, cascade: 1 };   // calibrage du retour au joueur (voir scripts/sim_slots.js)                       // gain maximum d'un tour, en multiple de la mise
  const rnd = () => Math.random();
  const pickIdx = n => Math.floor(rnd() * n);

  // Bande d'un rouleau : symboles répartis selon leur poids puis mélangés avec une graine fixe (les rouleaux sont toujours les mêmes)
  let seedCounter = 1;
  function strip(weights) {
    const s = []; Object.entries(weights).forEach(([sym, n]) => { for (let i = 0; i < n; i++) s.push(sym); });
    let x = (seedCounter++ * 2654435761) >>> 0;
    const next = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  }
  function pickWeighted(weights) {
    let total = 0; for (const k in weights) total += weights[k];
    let r = rnd() * total; for (const k in weights) { r -= weights[k]; if (r < 0) return k; }
    return Object.keys(weights)[0];
  }

  // Rouleaux à bande : 3 lignes visibles par rouleau, grille[rouleau][ligne]
  function spinStrips(strips, rows) {
    return strips.map(st => { const stop = pickIdx(st.length); return Array.from({ length: rows }, (_, r) => st[(stop + r) % st.length]); });
  }

  // Paiement sur lignes (de gauche à droite). pay[symbole][nombre] = multiple de la mise d'une ligne
  function evalLines(grid, lines, pay, wild) {
    const wins = []; const nR = grid.length;
    lines.forEach((line, li) => {
      const syms = line.map((row, r) => grid[r][row]);
      let base = null;
      for (const s of syms) { if (s !== wild) { base = s; break; } }
      let best = null;
      const tryCount = (sym) => {
        let n = 0;
        for (let r = 0; r < nR; r++) { if (syms[r] === sym || (wild && syms[r] === wild)) n++; else break; }
        // un symbole « sauvage » ne remplace pas lui-même dans le calcul du symbole de base
        const m = pay[sym] && pay[sym][n];
        if (m) return { line: li, sym, count: n, mult: m };
        return null;
      };
      if (base) best = tryCount(base);
      if (wild) { const w = tryCount(wild); if (w && (!best || w.mult > best.mult)) best = w; }
      // 1 ou 2 symboles qui paient dès le premier rouleau (cerises…)
      if (!best && base && pay[base]) { const w = tryCount(base); if (w) best = w; }
      if (best) wins.push(best);
    });
    return wins;
  }
  const countSym = (grid, sym) => grid.reduce((a, col) => a + col.filter(s => s === sym).length, 0);
  const capWin = mult => Math.min(MAX_WIN, mult);


  // ── Tables de gains CALIBRÉES : node scripts/sim_slots.js recalcule le retour au joueur (≈ 95 %) et réécrit ce bloc ──
  /*BAKED-START*/
  const BAKED = {
    "classic": {
      "pay": {
        "sept": {
          "3": 175
        },
        "cloche": {
          "3": 52
        },
        "fer": {
          "3": 26
        },
        "cerise": {
          "1": 1.75,
          "2": 5,
          "3": 17.5
        },
        "verre": {
          "3": 10.5
        },
        "cig": {
          "3": 5
        }
      }
    },
    "pmu": {
      "pay": {
        "verre": {
          "3": 11,
          "4": 33,
          "5": 110
        },
        "cig": {
          "3": 11,
          "4": 44,
          "5": 130
        },
        "briquet": {
          "3": 17.5,
          "4": 55,
          "5": 175
        },
        "paquet": {
          "3": 22,
          "4": 66,
          "5": 220
        },
        "des": {
          "3": 33,
          "4": 110,
          "5": 330
        },
        "fer": {
          "3": 44,
          "4": 165,
          "5": 550
        },
        "cerise": {
          "3": 66,
          "4": 220,
          "5": 875
        },
        "cloche": {
          "3": 110,
          "4": 440,
          "5": 1755
        },
        "sept": {
          "3": 220,
          "4": 1095,
          "5": 4385
        },
        "couronne": {
          "3": 330,
          "4": 1645,
          "5": 6580
        }
      },
      "scatterPay": {
        "3": 4.5,
        "4": 22,
        "5": 110
      }
    },
    "livre": {
      "pay": {
        "des": {
          "3": 1,
          "4": 5,
          "5": 19.5
        },
        "fer": {
          "3": 1.5,
          "4": 7.5,
          "5": 30
        },
        "cerise": {
          "3": 2,
          "4": 10,
          "5": 49
        },
        "cloche": {
          "3": 3.75,
          "4": 19.5,
          "5": 99
        },
        "verre": {
          "3": 7.5,
          "4": 37,
          "5": 195
        },
        "cig": {
          "3": 10,
          "4": 62,
          "5": 295
        },
        "sept": {
          "2": 2.5,
          "3": 15,
          "4": 99,
          "5": 495
        },
        "livre": {
          "3": 12.5,
          "4": 74,
          "5": 370
        }
      },
      "expandPay": {
        "des": {
          "2": 1.25,
          "3": 5,
          "4": 25,
          "5": 99
        },
        "fer": {
          "2": 1.25,
          "3": 7.5,
          "4": 37,
          "5": 150
        },
        "cerise": {
          "2": 2.5,
          "3": 12.5,
          "4": 62,
          "5": 245
        },
        "cloche": {
          "2": 2.5,
          "3": 15,
          "4": 74,
          "5": 370
        },
        "verre": {
          "2": 5,
          "3": 25,
          "4": 150,
          "5": 740
        },
        "cig": {
          "2": 5,
          "3": 37,
          "4": 245,
          "5": 1235
        },
        "sept": {
          "2": 7.5,
          "3": 62,
          "4": 495,
          "5": 2465
        }
      },
      "bookPay": {
        "3": 5,
        "4": 49,
        "5": 245
      }
    },
    "cascade": {
      "pay": {
        "verre": [
          0.25,
          0.75,
          2
        ],
        "cig": [
          0.25,
          1,
          2.5
        ],
        "briquet": [
          0.5,
          1,
          3
        ],
        "paquet": [
          0.5,
          1.5,
          4
        ],
        "des": [
          0.75,
          2.5,
          8
        ],
        "cerise": [
          1,
          5,
          15
        ],
        "cloche": [
          2,
          10,
          25
        ],
        "sept": [
          5,
          25,
          100
        ]
      },
      "scatterPay": {
        "4": 3,
        "5": 5,
        "6": 100
      }
    }
  };
  /*BAKED-END*/

  // ── Lignes de paiement (indices de ligne par rouleau) ──
  const LINES_3 = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  const LINES_20 = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 2, 2, 0],
  ];
  const LINES_10 = LINES_20.slice(0, 10);

  // ════════ 1. TIROIR-CAISSE : 3 rouleaux, 5 lignes ════════
  const CLASSIC = {
    id: 'classic', name: 'Le Tiroir-Caisse', reels: 3, rows: 3, lines: LINES_3,
    strips: Array(3).fill(strip({ sept: 2, cloche: 4, fer: 6, cerise: 8, verre: 10, cig: 12 })),
    pay: BAKED.classic.pay,
    spin() {
      const grid = spinStrips(this.strips, 3), wins = evalLines(grid, this.lines, this.pay, null);
      const mult = capWin(SCALE.classic * wins.reduce((a, w) => a + w.mult, 0) / this.lines.length);
      return { grid, wins, mult };
    },
  };

  // ════════ 2. BAR PMU : 5×3, 20 lignes, joker et tours gratuits ════════
  const PMU = {
    id: 'pmu', name: 'Le Bar PMU', reels: 5, rows: 3, lines: LINES_20,
    reg: { verre: 14, cig: 13, briquet: 12, paquet: 11, des: 9, fer: 8, cerise: 6, cloche: 4, sept: 3 },
    pay: BAKED.pmu.pay,
    scatterPay: BAKED.pmu.scatterPay, fsCount: { 3: 8, 4: 12, 5: 20 },
    init() { this.strips = [0, 1, 2, 3, 4].map(r => strip({ ...this.reg, ...(r >= 1 && r <= 3 ? { couronne: 2 } : {}), etoile: 3 })); return this; },
    spin(free) {
      const grid = spinStrips(this.strips, 3), wins = evalLines(grid, this.lines, this.pay, 'couronne');
      let mult = wins.reduce((a, w) => a + w.mult, 0) / this.lines.length;
      const sc = countSym(grid, 'etoile'); let fs = 0;
      if (sc >= 3) { mult += this.scatterPay[Math.min(5, sc)]; if (!free) fs = this.fsCount[Math.min(5, sc)]; else fs = 5; }
      if (free) mult *= 2;
      return { grid, wins, scatters: sc, mult: capWin(mult * SCALE.pmu), fs };
    },
  }.init();

  // ════════ 3. LE LIVRE DU BURALISTE : 5×3, 10 lignes, symbole qui s'étend ════════
  const LIVRE = {
    id: 'livre', name: 'Le Livre du Buraliste', reels: 5, rows: 3, lines: LINES_10,
    reg: { des: 16, fer: 13, cerise: 11, cloche: 9, verre: 6, cig: 6, sept: 4 },
    pay: BAKED.livre.pay,
    bookPay: BAKED.livre.bookPay,
    expandPay: BAKED.livre.expandPay,
    init() { this.strips = Array(5).fill(strip({ ...this.reg, livre: 2 })); return this; },
    spin(freeSymbol) {
      const grid = spinStrips(this.strips, 3); let expanded = [];
      if (freeSymbol) {
        grid.forEach((col, r) => { if (col.includes(freeSymbol)) { grid[r] = [freeSymbol, freeSymbol, freeSymbol]; expanded.push(r); } });
      }
      const wins = evalLines(grid, this.lines, this.pay, 'livre');
      let mult = wins.reduce((a, w) => a + w.mult, 0) / this.lines.length;
      const books = countSym(grid, 'livre'); let fs = 0, special = null;
      if (books >= 3) { mult += this.bookPay[Math.min(5, books)]; if (!freeSymbol) { fs = 10; special = pickWeighted({ des: 5, fer: 5, cerise: 5, cloche: 4, verre: 3, cig: 3, sept: 2 }); } else fs = 10; }
      if (freeSymbol && expanded.length >= 2) {
        // le symbole étendu paie partout (même sans être aligné) : on enlève les gains de lignes déjà comptés pour lui, puis on paie la formule globale
        mult = mult - wins.filter(w => w.sym === freeSymbol).reduce((a, w) => a + w.mult, 0) / this.lines.length;
        mult += this.expandPay[freeSymbol][Math.min(5, expanded.length)];
      }
      return { grid, wins, books, expanded, mult: capWin(mult * SCALE.livre), fs, special };
    },
  }.init();

  // ════════ 4. CASCADE DU CENDRIER : 6×5, grappes de 8+, chutes, multiplicateurs ════════
  const CASCADE = {
    id: 'cascade', name: 'La Cascade du Cendrier', cols: 6, rows: 5,
    reg: { verre: 20, cig: 18, briquet: 16, paquet: 14, des: 12, cerise: 9, cloche: 6, sept: 4 },
    // multiple de la mise totale pour 8-9 / 10-11 / 12+ symboles identiques
    pay: BAKED.cascade.pay,
    scatterPay: BAKED.cascade.scatterPay, fsCount: 10, scatterW: 2.4, bombW: 2.2, bombs: { 2: 30, 3: 24, 4: 18, 5: 12, 8: 8, 10: 5, 15: 2, 25: 1 },
    cell(free) {
      const r = rnd() * (this.total(free));
      return this._pick(free);
    },
    total(free) { return Object.values(this.reg).reduce((a, b) => a + b, 0) * 1 + this.scatterW + (free ? this.bombW : 0); },
    _pick(free) {
      let t = this.total(free), r = rnd() * t;
      for (const k in this.reg) { r -= this.reg[k]; if (r < 0) return k; }
      r -= 0; if (r < this.scatterW) return 'etoile';
      return free ? 'bombe' : 'etoile';
    },
    spin(free) {
      let grid = Array.from({ length: this.cols }, () => Array.from({ length: this.rows }, () => this._pick(free)));
      const steps = []; let mult = 0, bombsMult = 0, fs = 0, scatters = countSym(grid, 'etoile');
      let guard = 0;
      while (guard++ < 40) {
        const counts = {}; grid.forEach(col => col.forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
        const hit = Object.entries(counts).filter(([s, n]) => this.pay[s] && n >= 8);
        if (!hit.length) break;
        let stepMult = 0; const removed = [];
        hit.forEach(([s, n]) => { const band = n >= 12 ? 2 : n >= 10 ? 1 : 0; stepMult += this.pay[s][band]; removed.push(s); });
        mult += stepMult; steps.push({ grid: grid.map(c => c.slice()), removed, mult: stepMult });
        grid = grid.map(col => { const keep = col.filter(s => !removed.includes(s)); const fresh = Array.from({ length: this.rows - keep.length }, () => this._pick(free)); return fresh.concat(keep); });
        scatters = Math.max(scatters, countSym(grid, 'etoile'));
      }
      if (free) { grid.forEach(col => col.forEach(s => { if (s === 'bombe') bombsMult += Number(pickWeighted(this.bombs)); })); steps.push({ grid: grid.map(c => c.slice()), removed: [], mult: 0 }); }
      if (free && mult > 0 && bombsMult > 0) mult *= bombsMult;
      if (scatters >= 4) { mult += this.scatterPay[Math.min(6, scatters)]; fs = free ? 5 : this.fsCount; }
      return { grid, steps, mult: capWin(mult * SCALE.cascade), bombs: bombsMult, fs, scatters };
    },
  };

  const GAMES = { classic: CLASSIC, pmu: PMU, livre: LIVRE, cascade: CASCADE };

  // Simulation : retour au joueur (RTP) d'une machine, tours gratuits compris
  function simulate(id, n) {
    const g = GAMES[id]; let total = 0, hits = 0, big = 0, fsTriggers = 0;
    for (let i = 0; i < n; i++) {
      let r = id === 'livre' ? g.spin() : g.spin(false);
      let w = r.mult; if (w > 0) hits++;
      if (r.fs) {
        fsTriggers++; let left = r.fs, special = r.special;
        while (left-- > 0) { const f = id === 'livre' ? g.spin(special) : g.spin(true); w += f.mult; if (f.fs) left += (id === 'cascade' ? 5 : f.fs); if (left > 400) break; }
      }
      w = Math.min(w, 20000); total += w; if (w >= 100) big++;
    }
    return { rtp: total / n, hitRate: hits / n, fsEvery: fsTriggers ? n / fsTriggers : 0, big: big / n };
  }

  return { GAMES, simulate, MAX_WIN, SCALE };
})();
if (typeof module !== 'undefined') module.exports = SlotEngine;
if (typeof window !== 'undefined') window.SlotEngine = SlotEngine;
