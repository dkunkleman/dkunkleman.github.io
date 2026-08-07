"use strict";

const RELEASE = "3.13.0-home-test.5.3-safari-recovery-5";
const CACHE_NAME = "property-inspector-home-test-313-offline-v5-3-safari-recovery-5";
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
    // Offline or transient network failure. Use the cached shell.
  }
  return (await matchIgnoringVersion(request)) || (fallbackRequest ? await matchIgnoringVersion(fallbackRequest) : null);
}

async function recoveryText() {
  const absolute = new URL(RECOVERY_URL, self.location.href).href;
  const request = new Request(absolute, { cache: "no-cache" });
  const response = await bestResponse(request, RECOVERY_URL);
  return response ? await response.text() : "";
}

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Required field repair did not match: ${label}`);
  return source.replace(needle, replacement);
}

function patchFieldAppSource(source) {
  let patched = source;

  patched = patched.replace(/const APP_VERSION = "[^"]+";/, `const APP_VERSION = "${RELEASE}";`);

  patched = replaceOnce(
    patched,
    "  let fieldGpsFixPromise = null;",
    "  let fieldGpsFixPromise = null;\n  let gpsRestartTimer = null;\n  let gpsRestartAttempt = 0;\n  let lastExportVerification = null;",
    "GPS recovery state"
  );

  const abortSection = [
    "        if (!startPosition) {",
    "          startButton.disabled = false;",
    "          startButton.textContent = \"GPS NOT READY — TAP HERE TO TRY AGAIN\";",
    "          simpleSetStatus(\"SECTION NOT STARTED — move into open sky and tap the large button again. Nothing was lost.\", \"warning\");",
    "          return;",
    "        }"
  ].join("\n");
  patched = replaceOnce(
    patched,
    abortSection,
    [
      "        if (!startPosition) {",
      "          simpleSetStatus(\"SECTION SAVED — Safari GPS is reconnecting. Wait for the first GPS point before walking the edge.\", \"warning\");",
      "        }"
    ].join("\n"),
    "section start without GPS"
  );

  patched = replaceOnce(
    patched,
    "    if (!observationId) {\n      const marker = markerFromPosition(\"other\", \"Mapped land section\"",
    "    if (!observationId && lastPosition) {\n      const marker = markerFromPosition(\"other\", \"Mapped land section\"",
    "section marker without GPS"
  );

  patched = replaceOnce(
    patched,
    "      return_screen: returnScreen || \"FIELD_BUTTONS\", details: { section_id: section.section_id }, observation_id: observationId,\n      lat: lastPosition.lat, lon: lastPosition.lon, gps_accuracy_m: lastPosition.accuracy_m, gps_position_at: lastPosition.time\n    };",
    "      return_screen: returnScreen || \"FIELD_BUTTONS\", details: { section_id: section.section_id }, observation_id: observationId,\n      lat: lastPosition ? lastPosition.lat : null, lon: lastPosition ? lastPosition.lon : null, gps_accuracy_m: lastPosition ? lastPosition.accuracy_m : null, gps_position_at: lastPosition ? lastPosition.time : null\n    };",
    "section session without GPS"
  );

  patched = replaceOnce(
    patched,
    '        simpleSetStatus(`${section.section_id} STARTED — GPS, time, accuracy, and heading saved`, "saved");',
    '        simpleSetStatus(startPosition ? `${section.section_id} STARTED — GPS, time, accuracy, and heading saved` : `${section.section_id} STARTED — WAITING FOR FIRST GPS POINT; section is safely started`, startPosition ? "saved" : "warning");',
    "section started status"
  );

  patched = replaceOnce(
    patched,
    "    point.sequence = data.points.length ? (data.points[data.points.length - 1].sequence || data.points.length) + 1 : 1;\n    data.points.push(point);",
    "    point.sequence = data.points.length ? (data.points[data.points.length - 1].sequence || data.points.length) + 1 : 1;\n    const sectionAtFix = sectionMappingTools ? sectionMappingTools.activeSection(data) : null;\n    if (sectionAtFix && !sectionAtFix.capture_paused) {\n      point.section_id = sectionAtFix.section_id;\n      point.section_capture_status = \"ACTIVE_EDGE_CAPTURE\";\n    }\n    data.points.push(point);",
    "capture section id on new GPS fix"
  );

  patched = replaceOnce(
    patched,
    "    if (sectionMappingTools) sectionMappingTools.appendWalkPoint(data, point, point.time);",
    [
      "    if (sectionMappingTools) {",
      "      sectionMappingTools.appendWalkPoint(data, point, point.time);",
      "      const recoveringSection = sectionMappingTools.activeSection(data);",
      "      if (recoveringSection && !recoveringSection.start && recoveringSection.raw_walked_edge_points && recoveringSection.raw_walked_edge_points.length) {",
      "        const recoveredStart = recoveringSection.raw_walked_edge_points[0];",
      "        recoveringSection.start = Object.assign({}, recoveredStart);",
      "        recoveringSection.gps_start_delay_ms = Math.max(0, Date.parse(recoveredStart.recorded_at || recoveredStart.gps_position_at || point.time) - Date.parse(recoveringSection.started_at));",
      "        recoveringSection.events = Array.isArray(recoveringSection.events) ? recoveringSection.events : [];",
      "        recoveringSection.events.push({ event_type: \"SECTION_FIRST_GPS_RECOVERED\", recorded_at: point.time, original_section_tap_at: recoveringSection.started_at, gps_start_delay_ms: recoveringSection.gps_start_delay_ms, gps_accuracy_m: point.accuracy_m, source_gps_sequence: point.sequence });",
      "        const recoveringSession = currentSimpleSession();",
      "        if (recoveringSession && recoveringSession.feature_type === \"map_section\" && String(recoveringSession.section_id || recoveringSession.feature_id) === String(recoveringSection.section_id)) {",
      "          recoveringSession.lat = point.lat;",
      "          recoveringSession.lon = point.lon;",
      "          recoveringSession.gps_accuracy_m = point.accuracy_m;",
      "          recoveringSession.gps_position_at = point.time;",
      "          if (!recoveringSession.observation_id) {",
      "            const recoveredMarker = markerFromPosition(\"other\", \"Mapped land section — first GPS recovered after section tap\", null, point.time, point, { informationClass: \"OBSERVED_ON_SITE\", attributes: { section_id: recoveringSection.section_id, section_method: recoveringSection.method, gps_start_delay_ms: recoveringSection.gps_start_delay_ms } });",
      "            recoveringSession.observation_id = recoveredMarker.id;",
      "            recoveringSection.observation_id = recoveredMarker.id;",
      "            data.markers.push(recoveredMarker);",
      "            saveState();",
      "          }",
      "        }",
      "      }",
      "    }"
    ].join("\n"),
    "attach first recovered section GPS"
  );

  patched = replaceOnce(
    patched,
    "    coverageDirty = true;\n    gpsWriteQueue = gpsWriteQueue\n      .then(() => gpsPointPut(data.inspection_id, point))",
    "    coverageDirty = true;\n    const canonicalPointForWrite = Object.assign({}, point);\n    gpsWriteQueue = gpsWriteQueue\n      .then(() => gpsPointPut(data.inspection_id, canonicalPointForWrite))",
    "capture immutable canonical GPS write"
  );

  patched = replaceOnce(
    patched,
    "  function onGpsError(error) {\n    setStatus(`GPS error: ${error.message}. Allow location access and Precise Location.`, \"error\");\n  }",
    [
      "  function onGpsError(error) {",
      "    if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch (clearError) { /* already gone */ } }",
      "    watchId = null;",
      "    stopOrientationCapture();",
      "    releaseWakeLock();",
      "    updateControls();",
      "    if (error && Number(error.code) === 1) {",
      "      clearTimeout(gpsRestartTimer);",
      "      gpsRestartTimer = null;",
      "      gpsRestartAttempt = 0;",
      "      setStatus(\"SAFARI LOCATION PERMISSION IS OFF. On iPhone open Settings > Privacy & Security > Location Services > Safari Websites, choose While Using the App, and turn Precise Location ON. Your inspection remains saved.\", \"error\");",
      "      simpleSetStatus(\"LOCATION PERMISSION IS OFF — inspection remains saved\", \"warning\");",
      "      return;",
      "    }",
      "    const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(gpsRestartAttempt, 3)));",
      "    gpsRestartAttempt += 1;",
      "    setStatus(`GPS interrupted: ${error && error.message ? error.message : \"position unavailable\"}. Reconnecting automatically…`, \"warning\");",
      "    simpleSetStatus(\"GPS INTERRUPTED — RECONNECTING AUTOMATICALLY\", \"warning\");",
      "    clearTimeout(gpsRestartTimer);",
      "    gpsRestartTimer = setTimeout(() => {",
      "      gpsRestartTimer = null;",
      "      if (data.started && !data.stopped && watchId === null) ensureFieldGpsReady().catch(() => {});",
      "    }, delay);",
      "  }"
    ].join("\n"),
    "GPS error recovery"
  );

  patched = replaceOnce(
    patched,
    "  async function startTracking() {",
    "  async function startTracking(options) {\n    const trackingOptions = options || {};",
    "tracking options"
  );

  patched = replaceOnce(
    patched,
    "    await reconcileGpsPoints();\n    watchId = navigator.geolocation.watchPosition",
    "    if (!trackingOptions.skipReconcile) await reconcileGpsPoints();\n    watchId = navigator.geolocation.watchPosition",
    "skip expensive reconcile on GPS reconnect"
  );

  patched = replaceOnce(
    patched,
    "      await startTracking();\n      return new Promise(resolve => {",
    "      await startTracking({ skipReconcile: true });\n      return new Promise(resolve => {",
    "GPS reconnect tracking"
  );

  patched = replaceOnce(
    patched,
    "    document.getElementById(\"pointCount\").textContent = data.points.length;",
    "    gpsRestartAttempt = 0;\n    document.getElementById(\"pointCount\").textContent = data.points.length;",
    "reset GPS retry after fix"
  );

  const packageHelpers = [
    "  function exactFieldEvidenceCounts() {",
    "    const sectionModel = sectionMappingTools ? sectionMappingTools.ensureModel(data) : { sections: [] };",
    "    return { gps_points: data.points.length, observations: data.markers.length, photographs: data.photos.length, voice_notes: data.voice_notes.length, sections: Array.isArray(sectionModel.sections) ? sectionModel.sections.length : 0 };",
    "  }",
    "",
    "  function formatFieldEvidenceCounts(counts) {",
    "    return counts.gps_points + \" GPS | \" + counts.observations + \" records | \" + counts.photographs + \" photos | \" + counts.voice_notes + \" voice | \" + counts.sections + \" sections\";",
    "  }",
    "",
    "  function packageEvidenceCounts(result, fallbackSections) {",
    "    const summary = result && result.manifest && result.manifest.summary || {};",
    "    return { gps_points: Number(summary.gps_track_point_count) || 0, observations: Number(summary.field_event_count) || 0, photographs: Number(summary.photo_count) || 0, voice_notes: Number(summary.voice_note_count) || 0, sections: Number(fallbackSections) || 0 };",
    "  }",
    "",
    "  function verifyExportCounts(before, result, inspectionWasActive) {",
    "    const after = exactFieldEvidenceCounts();",
    "    const packaged = packageEvidenceCounts(result, before.sections);",
    "    if (packaged.photographs !== before.photographs) throw new Error(\"Export photo count changed during packaging.\");",
    "    if (packaged.voice_notes !== before.voice_notes) throw new Error(\"Export voice-note count changed during packaging.\");",
    "    if (packaged.observations < before.observations) throw new Error(\"Export omitted saved field records.\");",
    "    if (packaged.gps_points < before.gps_points) throw new Error(\"Export omitted saved GPS points.\");",
    "    if (after.photographs < before.photographs || after.voice_notes < before.voice_notes || after.observations < before.observations || after.sections < before.sections) throw new Error(\"Saved evidence count decreased during export.\");",
    "    if (inspectionWasActive && data.stopped) throw new Error(\"Export ended the active inspection.\");",
    "    lastExportVerification = { before: before, packaged: packaged, after: after, inspection_active_before: inspectionWasActive, inspection_active_after: Boolean(data.started && !data.stopped) };",
    "    return lastExportVerification;",
    "  }",
    "",
    "  function exportVerificationText(verification) {",
    "    if (!verification) return \"\";",
    "    return \"BEFORE: \" + formatFieldEvidenceCounts(verification.before) + \" | PACKAGE: \" + formatFieldEvidenceCounts(verification.packaged) + \" | AFTER: \" + formatFieldEvidenceCounts(verification.after) + \" | INSPECTION STILL ACTIVE: \" + (verification.inspection_active_after ? \"YES\" : \"NO\");",
    "  }",
    ""
  ].join("\n");

  patched = replaceOnce(
    patched,
    "  async function confirmLargePackage(mode) {",
    packageHelpers + "\n  async function confirmLargePackage(mode) {",
    "export count helpers"
  );

  patched = replaceOnce(
    patched,
    "    if (!(await confirmLargePackage(\"report\"))) return;\n    packageBusy = true;",
    "    if (!(await confirmLargePackage(\"report\"))) return;\n    const exportCountsBefore = exactFieldEvidenceCounts();\n    const inspectionWasActive = Boolean(data.started && !data.stopped);\n    simpleSetStatus(\"EXPORT STARTING — \" + formatFieldEvidenceCounts(exportCountsBefore) + \" — inspection remains active\", \"warning\");\n    packageBusy = true;",
    "report export before counts"
  );

  patched = replaceOnce(
    patched,
    "      const result = await buildPackageWithRecovery(\"report\", null);\n      await presentPackage(result.fileName, result.blob, result.manifest);",
    "      const result = await buildPackageWithRecovery(\"report\", null);\n      const exportVerification = verifyExportCounts(exportCountsBefore, result, inspectionWasActive);\n      await presentPackage(result.fileName, result.blob, result.manifest);\n      simpleSetStatus(\"EXPORT VERIFIED — \" + exportVerificationText(exportVerification), \"saved\");",
    "report export verification"
  );

  patched = replaceOnce(
    patched,
    "    if (!(await confirmLargePackage(\"full_archive\"))) return;\n    packageBusy = true;",
    "    if (!(await confirmLargePackage(\"full_archive\"))) return;\n    const exportCountsBefore = exactFieldEvidenceCounts();\n    const inspectionWasActive = Boolean(data.started && !data.stopped);\n    simpleSetStatus(\"EXPORT STARTING — \" + formatFieldEvidenceCounts(exportCountsBefore) + \" — inspection remains active\", \"warning\");\n    packageBusy = true;",
    "full archive before counts"
  );

  patched = replaceOnce(
    patched,
    "      const result = await buildPackageWithRecovery(\"full_archive\", watchId !== null ? \"backup\" : null);\n      await presentPackage(result.fileName, result.blob, result.manifest);",
    "      const result = await buildPackageWithRecovery(\"full_archive\", watchId !== null ? \"backup\" : null);\n      const exportVerification = verifyExportCounts(exportCountsBefore, result, inspectionWasActive);\n      await presentPackage(result.fileName, result.blob, result.manifest);\n      simpleSetStatus(\"EXPORT VERIFIED — \" + exportVerificationText(exportVerification), \"saved\");",
    "full archive verification"
  );

  patched = replaceOnce(
    patched,
    "    document.getElementById(\"simpleShareZip\").addEventListener(\"click\", shareLastPackage);",
    "    document.getElementById(\"simpleShareZip\").addEventListener(\"click\", shareLastPackage);\n    if (lastExportVerification) {\n      const verification = document.createElement(\"p\");\n      verification.className = \"frontage-instruction\";\n      verification.textContent = exportVerificationText(lastExportVerification);\n      result.appendChild(verification);\n    }",
    "show export counts"
  );

  patched = replaceOnce(
    patched,
    "      offlineState.textContent = \"Offline ready\";",
    "      offlineState.textContent = `Offline ready · ${APP_VERSION} · ${window.__FIELD_CACHE_NAME || \"cache active\"}`;",
    "show executing release"
  );

  patched = replaceOnce(
    patched,
    "  document.addEventListener(\"visibilitychange\", () => {\n    if (document.visibilityState === \"visible\") {",
    "  document.addEventListener(\"visibilitychange\", () => {\n    if (document.visibilityState !== \"visible\") {\n      try { saveState(); } catch (error) { /* extra snapshot only; captured evidence is already committed */ }\n      return;\n    }\n    if (document.visibilityState === \"visible\") {",
    "background extra snapshot"
  );

  const required = [
    `const APP_VERSION = \"${RELEASE}\";`,
    "SECTION SAVED — Safari GPS is reconnecting",
    "SECTION_FIRST_GPS_RECOVERED",
    "point.section_id = sectionAtFix.section_id",
    "canonicalPointForWrite",
    "GPS INTERRUPTED — RECONNECTING AUTOMATICALLY",
    "startTracking({ skipReconcile: true })",
    "exactFieldEvidenceCounts",
    "verifyExportCounts",
    "EXPORT VERIFIED",
    "INSPECTION STILL ACTIVE",
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
  try {
    appText = patchFieldAppSource(originalAppText);
  } catch (error) {
    return new Response(`throw new Error(${JSON.stringify("FIELD RECOVERY BUILD ERROR: " + error.message)});`, { status: 200, headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
  }
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
