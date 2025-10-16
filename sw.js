// Service Worker for LiveLikeCharlieChallenge.org
const CACHE_NAME = 'llc-v1';
const OFFLINE_FALLBACK_PAGE = '/';
const ASSETS = [
  '/', '/index.html',
  '/app.js',
  '/share.html', '/about.html', '/actions.html', '/privacy.html', '/Propose.html', '/admin.html', '/proofs.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png',
  '/data/actions.json',
  '/share_image.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS.filter(Boolean));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) && caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // HTML: network-first, fallback to cache, then to root
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match(OFFLINE_FALLBACK_PAGE));
      }
    })());
    return;
  }

  // Others: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      cache.put(request, fresh.clone());
      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
