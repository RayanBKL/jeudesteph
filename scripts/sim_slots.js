// Calibre la machine à sous « Le Grand Cendrier » : cherche l'échelle des gains qui donne ~95 % de retour au joueur (RTP),
// calcule le prix des bonus achetés et de la mise renforcée, puis réécrit le bloc BAKED de js/slots_engine.js.
// Usage : node scripts/sim_slots.js [tours] [--write]
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'js', 'slots_engine.js');
const S = require(file), g = S.GAMES.cendrier;
const n = +process.argv.find(a => /^\d+$/.test(a)) || 300000, target = +(process.env.RTP || 0.95), write = process.argv.includes('--write');
const round = v => v >= 100 ? Math.round(v / 5) * 5 : v >= 20 ? Math.round(v * 2) / 2 : Math.round(v * 20) / 20;
const mapNums = (o, f) => Array.isArray(o) ? o.map(f) : typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? f(v) : mapNums(v, f)])) : o;
const keys = ['pay', 'scatterPay'];
const orig = Object.fromEntries(keys.map(k => [k, JSON.parse(JSON.stringify(g[k]))]));
const apply = (f, rnd) => keys.forEach(k => { const t = mapNums(orig[k], v => rnd ? round(v * f) : v * f); Object.keys(g[k]).forEach(x => delete g[k][x]); Object.assign(g[k], t); });
let lo = 0.1, hi = 80, f = 1;
for (let i = 0; i < 10; i++) { f = Math.sqrt(lo * hi); apply(f, false); const r = S.simulate(n, 'normal'); if (r.rtp < target) lo = f; else hi = f; }
apply(f, true);
const r = S.simulate(n * 2, 'normal'), ra = S.simulate(n * 2, 'ante');
const evB = S.bonusEV(false, n / 3), evS = S.bonusEV(true, n / 3);
const price = v => { const p = v / target; return p >= 100 ? Math.round(p / 5) * 5 : Math.round(p); };
const buy = { bonus: price(evB), super: price(evS), ante: Math.round(ra.rtp / target * 100) / 100 };
console.log('échelle', f.toFixed(3), '| RTP normal', (r.rtp * 100).toFixed(1) + ' %', '| gain 1 tour sur', Math.round(1 / r.hitRate), '| bonus 1/' + Math.round(r.fsEvery), '| ≥100× :', (r.big * 100).toFixed(2) + ' %');
console.log('mise renforcée : RTP brut', (ra.rtp * 100).toFixed(1) + ' % → coût ×' + buy.ante, '| bonus moyen ×' + evB.toFixed(1), '→ prix ×' + buy.bonus, '| super bonus moyen ×' + evS.toFixed(1), '→ prix ×' + buy.super);
if (write) {
  let src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf('/*BAKED-START*/'), b = src.indexOf('/*BAKED-END*/');
  const baked = { pay: g.pay, scatterPay: g.scatterPay, buy };
  src = src.slice(0, a) + '/*BAKED-START*/\n  const BAKED = ' + JSON.stringify(baked) + ';\n  ' + src.slice(b);
  fs.writeFileSync(file, src);
  console.log('Tables écrites dans js/slots_engine.js');
}
