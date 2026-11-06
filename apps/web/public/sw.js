/*
 * KatdEstate — Service Worker Auto-Update & Cache Purge (v3)
 * Purge automatiquement tous les anciens caches PWA afin que les utilisateurs
 * sur mobile et desktop reçoivent immédiatement la dernière version déployée.
 */
const CACHE_VERSION = 'katdestate-shell-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        for (const client of clients) {
          if ('navigate' in client) {
            client.navigate(client.url);
          }
        }
      }),
  );
});
