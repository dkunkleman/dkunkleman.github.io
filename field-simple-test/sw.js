"use strict";

const RELEASE = "3.13.0-home-test.5.3-safari-recovery-3";
const CACHE_NAME = "property-inspector-home-test-313-offline-v5-3-safari-recovery-3";
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

  patched = patched.replace(
    /const APP_VERSION = "[^"]+";/,
    `const APP_VERSION = "${RELEASE}";`
  );

  patched = patched.replace(
    "  let fieldGpsFixPromise = null;",
    "  let fieldGpsFixPromise = null;\n  let gpsRestartTimer = null;\n  let gpsRestartAttempt = 0;\n  let lastGpsRecoverySnapshotAt = 0;\n  const GPS_RECOVERY_SNAPSHOT_INTERVAL_MS = 10000;"
  );

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

  patched = patched.replace(
    "    if (sectionMappingTools) sectionMappingTools.appendWalkPoint(data, point, point.time);",
    "    if (sectionMappingTools) {\n      sectionMappingTools.appendWalkPoint(data, point, point.time);\n      const recoveringSection = sectionMappingTools.activeSection(data);\n      if (recoveringSection && !recoveringSection.start && recoveringSection.raw_walked_edge_points && recoveringSection.raw_walked_edge_points.length) {\n        const recoveredStart = recoveringSection.raw_walked_edge_points[0];\n        recoveringSection.start = Object.assign({}, recoveredStart);\n        recoveringSection.gps_start_delay_ms = Math.max(0, Date.parse(recoveredStart.recorded_at || recoveredStart.gps_position_at || point.time) - Date.parse(recoveringSection.started_at));\n        recoveringSection.events = Array.isArray(recoveringSection.events) ? recoveringSection.events : [];\n        recoveringSection.events.push({ event_type: \"SECTION_FIRST_GPS_RECOVERED\", recorded_at: point.time, original_section_tap_at: recoveringSection.started_at, gps_start_delay_ms: recoveringSection.gps_start_delay_ms, gps_accuracy_m: point.accuracy_m, source_gps_sequence: point.sequence });\n        const recoveringSession = currentSimpleSession();\n        if (recoveringSession && recoveringSession.feature_type === \"map_section\" && String(recoveringSession.section_id || recoveringSession.feature_id) === String(recoveringSection.section_id)) {\n          recoveringSession.lat = point.lat; recoveringSession.lon = point.lon; recoveringSession.gps_accuracy_m = point.accuracy_m; recoveringSession.gps_position_at = point.time;\n          if (!recoveringSession.observation_id) {\n            const recoveredMarker = markerFromPosition(\"other\", \"Mapped land section — first GPS recovered after section tap\", null, point.time, point, { informationClass: \"OBSERVED_ON_SITE\", attributes: { section_id: recoveringSection.section_id, section_method: recoveringSection.method, gps_start_delay_ms: recoveringSection.gps_start_delay_ms } });\n            recoveringSession.observation_id = recoveredMarker.id; recoveringSection.observation_id = recoveredMarker.id; data.markers.push(recoveredMarker);\n          }\n        }\n      }\n    }"
  );

  patched = patched.replace(
    "  function onGpsError(error) {\n    setStatus(`GPS error: ${error.message}. Allow location access and Precise Location.`, \"error\");\n  }",
    "  function onGpsError(error) {\n    if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (clearError) { /* already gone */ } }\n    watchId = null;\n    stopOrientationCapture();\n    releaseWakeLock();\n    updateControls();\n    if (error && Number(error.code) === 1) {\n      clearTimeout(gpsRestartTimer); gpsRestartTimer = null; gpsRestartAttempt = 0;\n      setStatus(\"SAFARI LOCATION PERMISSION IS OFF. On iPhone open Settings > Privacy & Security > Location Services > Safari Websites, choose While Using the App, and turn Precise Location ON. Your inspection remains saved.\", \"error\");\n      simpleSetStatus(\"LOCATION PERMISSION IS OFF — inspection remains saved\", \"warning\");\n      return;\n    }\n    const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(gpsRestartAttempt, 3)));\n    gpsRestartAttempt += 1;\n    setStatus(`GPS interrupted: ${error && error.message ? error.message : \"position unavailable\"}. Reconnecting automatically…`, \"warning\");\n    simpleSetStatus(\"GPS INTERRUPTED — RECONNECTING AUTOMATICALLY\", \"warning\");\n    clearTimeout(gpsRestartTimer);\n    gpsRestartTimer = setTimeout(() => {\n      gpsRestartTimer = null;\n      if (data.started && !data.stopped && watchId === null) ensureFieldGpsReady().catch(() => {});\n    }, delay);\n  }"
  );

  patched = patched.replace(
    "  async function startTracking() {",
    "  async function startTracking(options) {\n    const trackingOptions = options || {};"
  );
  patched = patched.replace(
    "    await reconcileGpsPoints();\n    watchId = navigator.geolocation.watchPosition",
    "    if (!trackingOptions.skipReconcile) await reconcileGpsPoints();\n    watchId = navigator.geolocation.watchPosition"
  );
  patched = patched.replace(
    "      await startTracking();\n      return new Promise(resolve => {",
    "      await startTracking({ skipReconcile: true });\n      return new Promise(resolve => {"
  );

  const everyFixSave = [
    "    try {",
    "      saveState();",
    "    } catch (error) {",
    "      if (watchId !== null) navigator.geolocation.clearWatch(watchId);",
    "      watchId = null;",
    "      stopOrientationCapture();",
    "      releaseWakeLock();",
    "      updateControls();",
    "      return;",
    "    }"
  ].join("\n");
  const throttledSave = [
    "    if (Date.now() - lastGpsRecoverySnapshotAt >= GPS_RECOVERY_SNAPSHOT_INTERVAL_MS) {",
    "      try { saveState(); lastGpsRecoverySnapshotAt = Date.now(); }",
    "      catch (error) { setStatus(\"LOCAL RECOVERY SNAPSHOT IS FULL. Canonical GPS and photographs remain in IndexedDB; continue carefully and make a preservation archive when convenient.\", \"warning\"); }",
    "    }"
  ].join("\n");
  patched = patched.replace(everyFixSave, throttledSave);

  patched = patched.replace(
    "    document.getElementById(\"pointCount\").textContent = data.points.length;",
    "    gpsRestartAttempt = 0;\n    document.getElementById(\"pointCount\").textContent = data.points.length;"
  );

  patched = patched.replace(
    "      offlineState.textContent = \"Offline ready\";",
    "      offlineState.textContent = `Offline ready · ${APP_VERSION} · ${window.__FIELD_CACHE_NAME || \"cache active\"}`;"
  );

  patched = patched.replace(
    "  document.addEventListener(\"visibilitychange\", () => {\n    if (document.visibilityState === \"visible\") {",
    "  document.addEventListener(\"visibilitychange\", () => {\n    if (document.visibilityState !== \"visible\") {\n      try { saveState(); lastGpsRecoverySnapshotAt = Date.now(); } catch (error) { /* canonical IndexedDB evidence remains */ }\n      return;\n    }\n    if (document.visibilityState === \"visible\") {"
  );

  const required = [
    `const APP_VERSION = \"${RELEASE}\";`,
    "SECTION SAVED — Safari GPS is reconnecting",
    "SECTION_FIRST_GPS_RECOVERED",
    "GPS INTERRUPTED — RECONNECTING AUTOMATICALLY",
    "GPS_RECOVERY_SNAPSHOT_INTERVAL_MS = 10000",
    "startTracking({ skipReconcile: true })",
    "Offline ready · ${APP_VERSION}"
  ];
  if (!required.every(text => patched.includes(text))) throw new Error("Safari recovery source patch did not apply completely.");
  return patched;
}

async function recoveredAppResponse(request) {
  const app = await bestResponse(request, APP_URL);
  if (!app) return new Response("Field app unavailable offline.", { status: 503, headers: { "content-type": "text/plain" } });
  const [recovery, originalAppText] = await Promise.all([recoveryText(), app.text()]);
  let appText;
  try { appText = patchFieldAppSource(originalAppText); }
  catch (error) { return new Response(`throw new Error(${JSON.stringify("FIELD RECOVERY BUILD ERROR: " + error.message)});`, { status: 200, headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } }); }
  const boot = `window.__FIELD_RELEASE=${JSON.stringify(RELEASE)};window.__FIELD_CACHE_NAME=${JSON.stringify(CACHE_NAME)};`;
  const headers = new Headers(app.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(`${boot}\n${recovery}\n\n${appText}`, { status: 200, statusText: "OK", headers });
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
