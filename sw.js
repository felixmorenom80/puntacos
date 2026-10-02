const CACHE_NAME = 'puntacos-v3';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/shell.css',
  './css/games/anotador-universal.css',
  './css/games/sushi-go.css',
  './css/games/flip-7.css',
  './js/shell.js',
  './js/games/anotador-universal.js',
  './js/games/sushi-go.js',
  './js/games/flip-7.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // App code and the entry HTML must prefer the network so that a new
  // deployment is visible immediately, while still working offline.
  const isAppResource =
    event.request.mode === 'navigate' ||
    /\.(?:html|js|css)$/.test(url.pathname);

  if (isAppResource) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Other assets use cache-first for fast repeat loads, with network
  // fallback when they are not cached yet.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
