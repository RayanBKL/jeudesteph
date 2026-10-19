// Écrit la liste de toutes les cartes du jeu (id, cat, rarity, name, wd, stats) dans un fichier JSON.  Usage : node scripts/dump_cards.js <fichier>
const fs = require('fs'), path = require('path'), vm = require('vm');
const base = path.resolve(__dirname, '..');
const ctx = { console: { log() {} } }; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['js/cigarettes_db.js', 'js/empire_db_expansion.js', 'js/cards_extra.js', 'js/cards_season.js', 'js/empire_db.js', 'js/rarity_fix.js']) vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctx);
fs.writeFileSync(process.argv[2], JSON.stringify(ctx.getAllBaseItemsList().map(i => ({ id: i.id, cat: i.cat, rarity: i.rarity, name: i.name, wd: i.wd || null, value: i.value, cps: i.cashPerSec, clk: i.clickBoost }))));
