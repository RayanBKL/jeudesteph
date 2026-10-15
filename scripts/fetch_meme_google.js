// Récupère les 4 premières miniatures de Google Images pour chaque mème (outil local, navigateur automatisé).
// Usage : CHR=<chemin chrome> node scripts/fetch_meme_google.js <dossier> <queries.json>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [out, qfile] = process.argv.slice(2);
const queries = JSON.parse(fs.readFileSync(qfile, 'utf8'));
const metaP = path.join(out, 'meta.json');
const meta = fs.existsSync(metaP) ? JSON.parse(fs.readFileSync(metaP, 'utf8')) : {};
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHR || undefined, args: ['--disable-blink-features=AutomationControlled'] });
  const c = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' });
  const p = await c.newPage();
  let first = true;
  for (const it of queries) {
    if (meta[it.id]) continue;
    try {
      await p.goto('https://www.google.com/search?q=' + encodeURIComponent(it.q) + '&tbm=isch&hl=fr&safe=off', { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(first ? 2500 : 1500);
      const consent = p.locator('button:has-text("Tout accepter"), button:has-text("Accept all")');
      if (await consent.count()) { await consent.first().click(); await p.waitForTimeout(2000); }
      first = false;
      const thumbs = await p.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.naturalWidth >= 120 && i.naturalHeight >= 80 && i.src && !i.closest('header')).slice(0, 8).map(i => i.src));
      const files = [];
      for (const src of thumbs) {
        if (files.length >= 4) break;
        let buf = null;
        if (src.startsWith('data:image')) buf = Buffer.from(src.split(',')[1], 'base64');
        else if (src.startsWith('http')) { try { buf = await (await c.request.get(src, { timeout: 15000 })).body(); } catch (e) {} }
        if (!buf || buf.length < 1500) continue;
        const f = path.join(out, `${it.id}_${files.length + 1}.jpg`);
        fs.writeFileSync(f, buf); files.push(path.basename(f));
      }
      meta[it.id] = { name: it.name, q: it.q, files };
      fs.writeFileSync(metaP, JSON.stringify(meta));
      console.log(it.name, files.length);
    } catch (e) { console.log('échec', it.name, String(e).slice(0, 80)); }
    await p.waitForTimeout(1800 + Math.random() * 1500);
  }
  console.log('FINI');
  await b.close();
})();
