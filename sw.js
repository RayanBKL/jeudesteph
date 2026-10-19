// Service worker : rend le jeu installable sur téléphone et reçoit les notifications push (amis, paquet gratuit prêt).
// Aucune mise en cache : le jeu doit toujours être à jour.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'The Ashtray King', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'The Ashtray King', {
    body: d.body || '', tag: d.tag || 'ak', icon: 'assets/icon-192.png', badge: 'assets/favicon-32.png', data: { url: d.url || '/' }, renotify: true,
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
