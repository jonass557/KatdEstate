/*
 * RentFlow Africa — service worker (fondation PWA).
 *
 * Stratégie volontairement minimale et sûre :
 *  - navigation : réseau d'abord, repli sur le shell en cache (démarrage hors ligne) ;
 *  - assets statiques versionnés (/assets/*, polices, images) : cache d'abord,
 *    revalidation en arrière-plan ;
 *  - API : JAMAIS mise en cache. Les réponses contiennent des données
 *    multi-tenant sensibles ; un cache partagé serait une fuite d'isolation.
 *
 * Incrémenter CACHE_VERSION invalide l'ancien cache au prochain déploiement.
 */
const CACHE_VERSION = 'rentflow-shell-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    /\.(?:css|js|mjs|svg|png|jpe?g|webp|avif|ico|woff2?)$/i.test(pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Les données métier ne transitent jamais par le cache.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  if (!isStaticAsset(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) void cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
