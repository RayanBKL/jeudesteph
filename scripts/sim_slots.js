// Calibre les machines à sous : cherche l'échelle des gains qui donne ~95 % de retour au joueur (RTP), arrondit les tables
// et réécrit le bloc BAKED de js/slots_engine.js. Usage : node scripts/sim_slots.js [classic,pmu,livre,cascade] [tours]  (--write pour réécrire)
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'js', 'slots_engine.js');
const S = require(file);
const ids = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'classic,pmu,livre,cascade').split(',');
const n = +process.argv.find(a => /^\d+$/.test(a)) || 300000, target = 0.95, write = process.argv.includes('--write');
const TABLES = ['pay', 'scatterPay', 'expandPay', 'bookPay'];
const round = v => v >= 100 ? Math.round(v / 5) * 5 : v >= 20 ? Math.round(v) : v >= 5 ? Math.round(v * 2) / 2 : Math.round(v * 4) / 4;
const mapNums = (o, f) => Array.isArray(o) ? o.map(f) : typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? f(v) : mapNums(v, f)])) : o;
const result = {};
for (const id of ids) {
  const g = S.GAMES[id], keys = TABLES.filter(k => g[k]);
  const orig = Object.fromEntries(keys.map(k => [k, JSON.parse(JSON.stringify(g[k]))]));
  const apply = (f, rnd) => keys.forEach(k => { const t = mapNums(orig[k], v => rnd ? round(v * f) : v * f); Object.keys(g[k]).forEach(x => delete g[k][x]); Object.assign(g[k], t); });
  let lo = 0.1, hi = 80, f = 1;
  for (let i = 0; i < 10; i++) { f = Math.sqrt(lo * hi); apply(f, false); const r = S.simulate(id, n); if (r.rtp < target) lo = f; else hi = f; }
  apply(f, true);
  const r = S.simulate(id, n * 2);
  console.log(id.padEnd(8), 'échelle', f.toFixed(3), '| RTP', (r.rtp * 100).toFixed(1) + ' %', '| gain 1 tour sur', Math.round(1 / r.hitRate), '| tours gratuits 1/' + Math.round(r.fsEvery || 0), '| ≥100× la mise :', (r.big * 100).toFixed(2) + ' %');
  result[id] = Object.fromEntries(keys.map(k => [k, JSON.parse(JSON.stringify(g[k]))]));
}
if (write) {
  let src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf('/*BAKED-START*/'), b = src.indexOf('/*BAKED-END*/');
  const cur = {}; // on garde les tables des machines non recalibrées
  const baked = Object.assign({}, ...['classic', 'pmu', 'livre', 'cascade'].map(id => ({ [id]: result[id] || Object.fromEntries(TABLES.filter(k => S.GAMES[id][k]).map(k => [k, S.GAMES[id][k]])) })));
  const block = '/*BAKED-START*/\n  const BAKED = ' + JSON.stringify(baked, null, 2).replace(/\n/g, '\n  ') + ';\n  ';
  src = src.slice(0, a) + block + src.slice(b);
  fs.writeFileSync(file, src);
  console.log('Tables écrites dans js/slots_engine.js');
}
