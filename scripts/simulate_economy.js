// Simulation de la progression d'un joueur sur un an avec le VRAI code du jeu (tirage des paquets, cartes, niveaux,
// pièces débloquées par niveau). Usage : lancer le jeu (python3 -m http.server 8799 dans le dossier du jeu) puis
//   node scripts/simulate_economy.js '[[1,1,1]]' '[1,3]'
// 1er argument : liste de réglages [_, _, multiplicateur de prix en plus de js/balance.js] ; 2e : heures de jeu par jour.
// Hypothèses : 5 clics/s à 80 % d'efficacité pendant le jeu, tout l'argent va dans les paquets, 80 % des doublons revendus
// à 33 % du prix du paquet, talents approchés par le niveau. Il faut Playwright (npm i playwright).
const { chromium } = require('playwright');
const grid = JSON.parse(process.argv[2]);
const hoursList = JSON.parse(process.argv[3] || '[1]');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHR || undefined });
  const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8799/?t=' + Date.now()); await p.waitForTimeout(2500);
  for (const hours of hoursList) for (const [cs, ck, cp] of grid) {
    const rows = await p.evaluate(([hoursPerDay, cs, ck, cp]) => {
      const xpFor = lvl => { const early = Math.min(lvl, 12) - 1, late = Math.max(0, lvl - 12); return Math.round(300 * Math.pow(1.35, early) * Math.pow(1.06, late) / 5) * 5; };
      const SLOTS = [[1, 3], [3, 3], [5, 2], [8, 3], [15, 5]];
      const packs = Object.values(EMPIRE_PACKS).filter(pk => pk.price > 0).map(pk => ({ ...pk, price: Math.round(pk.price * cp) })).sort((a, b) => b.price - a.price);
      const pity = {}; const owned = new Set(); let cash = 0, xp = 0, level = 1, need = xpFor(1), opened = 0, uniq = 0, bestCps = [], bestClk = [], passive = 0, clickPow = 1;
      const add = it => { let dup = owned.has(it.id); if (!dup) { owned.add(it.id); uniq++; bestCps.push(it.cashPerSec); bestClk.push(it.clickBoost || 0); } return dup; };
      const slotsFor = lvl => SLOTS.filter(([l]) => lvl >= l).reduce((a, [, s]) => a + s, 0);
      const recalc = () => { bestCps.sort((a, b) => b - a); bestClk.sort((a, b) => b - a); if (bestCps.length > 40) bestCps.length = 40; if (bestClk.length > 8) bestClk.length = 8; passive = bestCps.slice(0, slotsFor(level)).reduce((a, b) => a + b, 0); const tl = Math.min(1, level / 55); clickPow = Math.max(1, Math.round((1 + bestClk.slice(0, 3).reduce((a, b) => a + b, 0)) * (1 + 3.5 * tl))); passive *= (1 + 1.2 * tl); };
      const gain = x => { xp += x; while (xp >= need) { xp -= need; level++; need = xpFor(level); } };
      for (let i = 0; i < 3; i++) drawEmpirePack('gratuit', pity).forEach(add); recalc();
      const rows = []; const STEP = 30; let target = null;
      for (let day = 1; day <= 365; day++) {
        for (let s = 0; s < hoursPerDay * 3600; s += STEP) {
          const clicks = 5 * 0.8 * STEP; cash += clicks * clickPow + passive * STEP; gain(clicks);
          for (let n = 0; n < 60; n++) {
            if (!target || (target.price > cash * 6 && packs[packs.length - 1].price <= cash)) {
              // choisit un paquet visé : plutôt abordable (<= 8x le cash), sinon le moins cher
              const reach = packs.filter(q => q.price <= Math.max(cash * 8, packs[packs.length - 1].price));
              target = reach[Math.floor(Math.random() * reach.length)];
            }
            if (target.price > cash) break;
            const pk = target; target = null;
            cash -= pk.price; opened++; gain(Balance.xpForPack(pk.price / cp));
            const items = drawEmpirePack(pk.id, pity); let dups = 0; items.forEach(it => { if (add(it)) dups++; });
            cash += 0.33 * pk.price * (dups / items.length) * 0.8;
          }
          recalc();
        }
        if ([1, 3, 7, 14, 30, 90, 180, 365].includes(day)) rows.push({ j: day, paq: opened, niv: level, uniq, passif: +passive.toFixed(1), clic: +clickPow.toFixed(1) });
      }
      return rows;
    }, [hours, cs, ck, cp]);
    console.log(`\n### ${hours} h/jour | cps×${cs} clic×${ck} prix×${cp}`);
    console.log(rows.map(r => `j${r.j}: ${r.paq}p niv${r.niv} ${r.uniq}u ${r.passif}€/s c${r.clic}`).join(' | '));
  }
  await b.close();
})();
