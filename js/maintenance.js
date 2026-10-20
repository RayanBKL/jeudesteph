// ============================================================
// THE ASHTRAY KING — Maintenance du site + repère de la version de test
// • Site en ligne : si le fichier « maintenance.on » (contenu : maintenance) existe à la racine, un écran bloque le jeu
//   (même pour les joueurs qui avaient déjà la page ouverte). scripts/maintenance.sh on|off l'ajoute / le retire.
// • Version de test (le jeu servi depuis un sous-dossier caché) : jamais bloquée, avec un bandeau « VERSION TEST ».
// Rien dans ce fichier ne contient l'adresse du dossier de test.
// ============================================================
(function () {
  const sub = location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '');
  if (sub !== '') {
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex, nofollow'; document.head.appendChild(meta);
    const bar = document.createElement('div');
    bar.textContent = 'VERSION TEST : mêmes comptes et même base que le vrai jeu';
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483000;background:#e2322b;color:#fff;font:700 11px/16px Rubik,sans-serif;text-align:center;padding:1px 6px;pointer-events:none;letter-spacing:.04em';
    (document.body || document.documentElement).appendChild(bar);
    return;
  }

  let shown = false;
  function show() {
    if (shown) return; shown = true;
    const el = document.createElement('div');
    el.id = 'maintenance-screen';
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#150c07;color:#f3e6c8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font-family:Rubik,sans-serif';
    el.innerHTML = '<img src="assets/logo.jpg" alt="" style="width:110px;height:110px;border-radius:50%;border:4px solid #ffc43a">'
      + '<h1 style="margin:0;font-size:1.6rem;color:#ffc43a;font-family:Cendrier,Rubik,sans-serif">Le bar est fermé</h1>'
      + '<p style="margin:0;max-width:320px;line-height:1.45">Stéphane passe un coup de balai et change deux ou trois choses. Ta partie est en sécurité, reviens dans un petit moment.</p>';
    document.body.appendChild(el);
  }
  async function check() {
    try {
      const r = await fetch('maintenance.on?' + Date.now(), { cache: 'no-store' });
      if (r.ok && (await r.text()).trim() === 'maintenance') show();
    } catch (e) { /* hors ligne : on ne bloque pas */ }
  }
  check();
  setInterval(check, 60000);
})();
