/* Alright Planner — service worker (offline-capable PWA).
 *
 * Strategy:
 *  - Precaches the app shell on install.
 *  - Navigations (HTML documents): network-first, falling back to the cache
 *    (so the user always gets the newest bundle when online, and the app
 *    still opens offline).
 *  - Same-origin static assets (JS/CSS/PNG bundles): stale-while-revalidate —
 *    serve from cache immediately, refresh it in the background.
 *  - Everything else (cross-origin, non-GET): pass through untouched.
 */

const CACHE = 'alright-v1';
// Relative paths: the SW lives next to the app shell, so './x' resolves
// correctly whether the app is hosted at a domain root or a subpath
// (e.g. GitHub Pages project sites).
const PRECACHE = ['./', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  const cachePromise = caches.open(CACHE);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          cachePromise.then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./'))
        )
    );
    return;
  }

  event.respondWith(
    cachePromise.then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              cache.put(req, copy);
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
