"use strict";

const RELEASE = "3.13.0-home-test.5.3-safari-recovery-2";
const CACHE_NAME = "property-inspector-home-test-313-offline-v5-3-safari-recovery-2";
const INDEX_URL = `./index.html?v=${RELEASE}`;
const APP_URL = `./app.js?v=${RELEASE}`;
const RECOVERY_URL = `./safari-geolocation-recovery.js?v=${RELEASE}`;
const CORE_OFFLINE_FILES = [
  INDEX_URL,
  `./inspection-coaching.js?v=${RELEASE}`,
  `./water-intelligence.js?v=${RELEASE}`,
  `./evidence-governance.js?v=${RELEASE}`,
  `./evidence-sets.js?v=${RELEASE}`,
  `./timber-reconnaissance.js?v=${RELEASE}`,
  `./reviewed-property-synthesis.js?v=${RELEASE}`,
  `./authoritative-weather.js?v=${RELEASE}`,
  `./frontage-workflow.js?v=${RELEASE}`,
  `./automatic-context.js?v=${RELEASE}`,
  `./section-mapping.js?v=${RELEASE}`,
  `./wet-edge-mapping.js?v=${RELEASE}`,
  `./property-review.js?v=${RELEASE}`,
  APP_URL,
  RECOVERY_URL,
  `./idb-recovery.js?v=${RELEASE}`,
  `./inspection-package.js?v=${RELEASE}`,
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

function cachePut(cacheName, request, response) {
  if (!response || !response.ok) return Promise.resolve();
  return caches.open(cacheName).then(cache => cache.put(request, response.clone())).catch(() => {});
}

async function matchIgnoringVersion(request) {
  return caches.match(request, { ignoreSearch: true });
}

async function bestResponse(request, fallbackRequest) {
  try {
    const network = await fetch(request);
    if (network && network.ok) {
      cachePut(CACHE_NAME, request, network);
      return network;
    }
  } catch (error) {
    // Offline or transient network failure. Use the immutable app shell below.
  }
  return (await matchIgnoringVersion(request)) || (fallbackRequest ? await matchIgnoringVersion(fallbackRequest) : null);
}

async function recoveryText() {
  const absolute = new URL(RECOVERY_URL, self.location.href).href;
  const request = new Request(absolute, { cache: "no-cache" });
  const response = await bestResponse(request, RECOVERY_URL);
  return response ? await response.text() : "";
}

function patchFieldAppSource(source) {
  let patched = source;

  const abortSection = [
    "        if (!startPosition) {",
    "          startButton.disabled = false;",
    "          startButton.textContent = \"GPS NOT READY — TAP HERE TO TRY AGAIN\";",
    "          simpleSetStatus(\"SECTION NOT STARTED — move into open sky and tap the large button again. Nothing was lost.\", \"warning\");",
    "          return;",
    "        }"
  ].join("\n");
  const savePendingSection = [
    "        if (!startPosition) {",
    "          simpleSetStatus(\"SECTION SAVED — Safari GPS is reconnecting. Wait for the first GPS point before walking the edge.\", \"warning\");",
    "        }"
  ].join("\n");
  patched = patched.replace(abortSection, savePendingSection);

  patched = patched.replace(
    "    if (!observationId) {\n      const marker = markerFromPosition(\"other\", \"Mapped land section\"",
    "    if (!observationId && lastPosition) {\n      const marker = markerFromPosition(\"other\", \"Mapped land section\""
  );

  patched = patched.replace(
    "      return_screen: returnScreen || \"FIELD_BUTTONS\", details: { section_id: section.section_id }, observation_id: observationId,\n      lat: lastPosition.lat, lon: lastPosition.lon, gps_accuracy_m: lastPosition.accuracy_m, gps_position_at: lastPosition.time\n    };",
    "      return_screen: returnScreen || \"FIELD_BUTTONS\", details: { section_id: section.section_id }, observation_id: observationId,\n      lat: lastPosition ? lastPosition.lat : null, lon: lastPosition ? lastPosition.lon : null, gps_accuracy_m: lastPosition ? lastPosition.accuracy_m : null, gps_position_at: lastPosition ? lastPosition.time : null\n    };"
  );

  patched = patched.replace(
    '        simpleSetStatus(`${section.section_id} STARTED — GPS, time, accuracy, and heading saved`, "saved");',
    '        simpleSetStatus(startPosition ? `${section.section_id} STARTED — GPS, time, accuracy, and heading saved` : `${section.section_id} STARTED — WAITING FOR FIRST GPS POINT; section is safely started`, startPosition ? "saved" : "warning");'
  );

  return patched;
}

async function recoveredAppResponse(request) {
  const app = await bestResponse(request, APP_URL);
  if (!app) return new Response("Field app unavailable offline.", { status: 503, headers: { "content-type": "text/plain" } });
  const [recovery, originalAppText] = await Promise.all([recoveryText(), app.text()]);
  const appText = patchFieldAppSource(originalAppText);
  const headers = new Headers(app.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(`${recovery}\n\n${appText}`, { status: 200, statusText: "OK", headers });
}

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
      .then(keys => Promise.all(keys.filter(key => key.startsWith("property-inspector-home-test-313-offline-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/field-simple-test/app.js")) {
    event.respondWith(recoveredAppResponse(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(INDEX_URL)
        .then(response => {
          cachePut(CACHE_NAME, INDEX_URL, response);
          return response;
        })
        .catch(() => matchIgnoringVersion(INDEX_URL))
    );
    return;
  }

  const appShellRequest = url.pathname.endsWith(".js") || url.pathname.endsWith(".html") || url.pathname.endsWith(".webmanifest");
  if (appShellRequest) {
    event.respondWith(
      fetch(request)
        .then(response => {
          cachePut(CACHE_NAME, request, response);
          return response;
        })
        .catch(async () => (await matchIgnoringVersion(request)) || (url.pathname.endsWith("/safari-geolocation-recovery.js") ? matchIgnoringVersion(RECOVERY_URL) : null))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request).then(response => {
      cachePut(CACHE_NAME, request, response);
      return response;
    }))
  );
});
