// Audit des cartes : charge la vraie base du jeu et vérifie que chaque carte a son image WebP.
// Usage : node scripts/audit_cards.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.resolve(__dirname, '..');
const cardsDir = path.join(baseDir, 'assets', 'cards');

const ctx = { console: { log() {} } };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/cigarettes_db.js', 'js/empire_db_expansion.js', 'js/cards_extra.js', 'js/empire_db.js']) {
  vm.runInContext(fs.readFileSync(path.join(baseDir, f), 'utf8'), ctx, { filename: f });
}
const items = ctx.getAllBaseItemsList();

// Même logique que resolveCardPhoto() dans js/cards.js
function resolve(item) {
  if (item.img && item.img.startsWith('assets/cards/')) return item.img;
  if (item.image && item.image.startsWith('assets/cards/')) return item.image;
  const cat = item.cat || 'cigarette';
  const prefix = cat === 'cigarette' ? 'cig' : cat === 'alcool' ? 'alc' : cat === 'briquet' ? 'acc' : cat === 'beauf' ? 'ter' : cat === 'actrice' ? 'act' : cat === 'foot' ? 'fbl' : cat === 'refs' ? 'ref' : cat === 'chanteur' ? 'mus' : cat === 'culte' ? 'cul' : 'drg';
  return `assets/cards/${prefix}_${item.id}.webp`;
}

const used = new Set();
const missing = [];
const byCat = {};
for (const it of items) {
  const p = resolve(it);
  used.add(path.basename(p));
  byCat[it.cat] = (byCat[it.cat] || 0) + 1;
  if (!fs.existsSync(path.join(baseDir, p))) missing.push(`${it.cat}  ${it.id}  ->  ${p}`);
}

const files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.webp'));
const orphans = files.filter(f => !used.has(f));
const totalBytes = files.reduce((s, f) => s + fs.statSync(path.join(cardsDir, f)).size, 0);

console.log('============================================================');
console.log('THE ASHTRAY KING — Audit des cartes');
console.log('Cartes en base       :', items.length, JSON.stringify(byCat));
console.log('Fichiers WebP        :', files.length, `(${(totalBytes / 1048576).toFixed(1)} Mo)`);
console.log('Images manquantes    :', missing.length);
missing.forEach(m => console.log('  - ' + m));
console.log('Images orphelines    :', orphans.length);
orphans.forEach(o => console.log('  - ' + o));
console.log('============================================================');
process.exitCode = missing.length ? 1 : 0;
