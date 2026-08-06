"use strict";

const CACHE_NAME = "property-inspector-home-test-313-offline-v5-2";
const INDEX_URL = "./index.html?v=3.13.0-home-test.5.2";
const CORE_OFFLINE_FILES = [
  INDEX_URL,
  "./inspection-coaching.js?v=3.13.0-home-test.5.1",
  "./water-intelligence.js?v=3.13.0-home-test.5.1",
  "./evidence-governance.js?v=3.13.0-home-test.5.1",
  "./evidence-sets.js?v=3.13.0-home-test.5.1",
  "./timber-reconnaissance.js?v=3.13.0-home-test.5.1",
  "./reviewed-property-synthesis.js?v=3.13.0-home-test.5.1",
  "./authoritative-weather.js?v=3.13.0-home-test.5.1",
  "./frontage-workflow.js?v=3.13.0-home-test.5.1",
  "./automatic-context.js?v=3.13.0-home-test.5.1",
  "./section-mapping.js?v=3.13.0-home-test.5.1",
  "./wet-edge-mapping.js?v=3.13.0-home-test.5.1",
  "./property-review.js?v=3.13.0-home-test.5.1",
  "./app.js?v=3.13.0-home-test.5.2",
  "./idb-recovery.js?v=3.13.0-home-test.5.1",
  "./inspection-package.js?v=3.13.0-home-test.5.1",
  "./manifest.webmanifest",
  "./assets/parcels.json",
  "./assets/august-4-route-context.json"
];
const OPTIONAL_MAP_FILES = [
  "./assets/usgs-terrain.png",
  "./assets/usgs-contours-2ft.png",
  "../icon-192.png",
  "../icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await cache.addAll(CORE_OFFLINE_FILES);
        await Promise.allSettled(OPTIONAL_MAP_FILES.map(path => cache.add(path)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("property-inspector-home-test-313-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(INDEX_URL)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
          return response;
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  const appShellRequest = url.pathname.endsWith(".js") || url.pathname.endsWith(".html") || url.pathname.endsWith(".webmanifest");
  if (appShellRequest) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
