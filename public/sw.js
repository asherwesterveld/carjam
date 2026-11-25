/* Car Jam service worker
 * - Hashed /assets/* files: cache-first (immutable, content-hashed filenames)
 * - Pages (navigations): network-first, falling back to cache for offline play
 * - Other same-origin static files: stale-while-revalidate
 */
const CACHE = 'carjam-v1';
const SHELL = ['/', '/print', '/logo.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network-first so deploys show up immediately; cache fallback when offline
  if (req.mode === 'navigate') {
    const cacheKey = url.pathname.replace(/\/+$/, '').endsWith('/print') ? '/print' : '/';
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(cacheKey, copy));
          }
          return res;
        })
        .catch(() => caches.match(cacheKey).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Content-hashed build assets never change: serve from cache instantly
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Everything else (icons, manifest): stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
