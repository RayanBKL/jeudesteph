// Service worker minimal : rend le jeu installable sur téléphone. Aucune mise en cache (le jeu doit toujours être à jour).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
