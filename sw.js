// Minimal service worker for LiveLikeCharlieChallenge.org
const VERSION = 'v1';
const CORE = [
  '/', '/index.html', '/actions.html', '/privacy.html', '/proofs.html',
  '/manifest.webmanifest', '/data/actions.json'
];
const CACHE_NAME = 'llc-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return; // passthrough for non-GET

  // cache-first for same-origin static assets
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/img/') ||
        url.pathname.startsWith('/data/') || url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.webmanifest')) {
      e.respondWith(
        caches.match(req).then(res => res || fetch(req).then(r => {
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return r;
        }))
      );
      return;
    }
  }
  // default: network-first
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
