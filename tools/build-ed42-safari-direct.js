#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const APP_PATH = path.join(ROOT, "field-simple-test", "app.js");
const INDEX_PATH = path.join(ROOT, "field-simple-test", "index.html");
const SW_PATH = path.join(ROOT, "field-simple-test", "sw.js");
const FRONTAGE_PATH = path.join(ROOT, "field-simple-test", "frontage-workflow.js");
const SECTION_PATH = path.join(ROOT, "field-simple-test", "section-mapping.js");

const BASELINE_COMMIT = "ed42ca2df4f6ca01fc05f52a652c3821a2007da7";
const BASELINE_VERSION = "3.13.0-home-test.5.1";
const RELEASE = "3.13.0-home-test.5.1-safari-direct-1";
const CACHE_NAME = "property-inspector-home-test-313-direct-ed42-v1";

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function replaceExact(source, before, after, label) {
  const count = countOccurrences(source, before);
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before, after);
}

function findFunctionRange(source, name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = re.exec(source);
  if (!match) throw new Error(`Function ${name} not found`);
  const start = match.index;
  const open = source.indexOf("{", start);
  if (open < 0) throw new Error(`Function ${name} has no opening brace`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error(`Function ${name} is not closed`);
}

function replaceFunction(source, name, replacement) {
  const range = findFunctionRange(source, name);
  return source.slice(0, range.start) + replacement + source.slice(range.end);
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`${label}: missing ${needle}`);
}

let app = fs.readFileSync(APP_PATH, "utf8");
let index = fs.readFileSync(INDEX_PATH, "utf8");
let sw = fs.readFileSync(SW_PATH, "utf8");
let frontage = fs.readFileSync(FRONTAGE_PATH, "utf8");
let section = fs.readFileSync(SECTION_PATH, "utf8");

assertContains(app, `const APP_VERSION = "${BASELINE_VERSION}";`, "baseline app version");
assertContains(app, 'const stateKey = "propertyInspectorHomeTest313V1";', "baseline localStorage");
assertContains(app, 'const photoDbName = "property-inspector-home-test-313-evidence";', "baseline IndexedDB");
assertContains(index, `./app.js?v=${BASELINE_VERSION}`, "baseline direct app script");
if (sw.includes("patchFieldAppSource") || sw.includes("recoveredAppResponse")) {
  throw new Error("Baseline service worker unexpectedly contains runtime app-source patching.");
}

app = replaceExact(
  app,
  `const APP_VERSION = "${BASELINE_VERSION}";`,
  `const APP_VERSION = "${RELEASE}";\n  const DIRECT_BASELINE_COMMIT = "${BASELINE_COMMIT}";\n  const DIRECT_APP_MODE = "DIRECT_APP_FILE_NO_RUNTIME_SOURCE_PATCH";`,
  "release identity"
);

app = replaceExact(
  app,
  "  let fieldGpsFixPromise = null;",
  `  let fieldGpsFixPromise = null;
  let gpsWatchGeneration = 0;
  let gpsRestartTimer = null;
  let gpsRestartAttempt = 0;
  let gpsPermissionDenied = false;
  let lastGpsFixReceivedAt = 0;
  const GPS_STALE_MS = 90000;

  const simpleShell = document.getElementById("simpleShell");
  if (simpleShell) {
    simpleShell.addEventListener("click", event => {
      const button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button || button.disabled || !simpleShell.contains(button)) return;
      const label = String(button.textContent || "FIELD ACTION").trim().replace(/\\s+/g, " ");
      simpleSetStatus(\`TAP SAVED — \${label}\`, "warning");
    }, true);
  }`,
  "direct GPS state and immediate tap feedback"
);

app = replaceFunction(app, "renderSimpleHeader", `  function renderSimpleHeader() {
    const gps = document.getElementById("simpleGpsStatus");
    const counts = document.getElementById("simpleCounts");
    const fresh = freshFieldPosition();
    if (gps) {
      if (fresh) gps.textContent = \`GPS +/-\${Math.round(fresh.accuracy_m || 0)} m\`;
      else if (gpsPermissionDenied) gps.textContent = "GPS PERMISSION OFF — RECORDS STILL SAVE";
      else if (data.started) gps.textContent = "GPS RECONNECTING — LOCATION PENDING";
      else gps.textContent = "NOT STARTED";
    }
    if (counts) {
      const appPath = location.pathname.replace(/\\/?$/, "/") + "app.js";
      counts.textContent = \`\${data.photos.length} photos | \${data.markers.length} records | \${data.voice_notes.length} voice · \${APP_VERSION} · DIRECT \${appPath}\`;
    }
  }`);

app = replaceFunction(app, "markerFromPosition", `  function markerFromPosition(type, note, photoId, time, positionOverride, details) {
    const position = positionOverride !== undefined ? positionOverride : freshFieldPosition();
    const settings = details || {};
    const context = currentEvidenceContext();
    const recordedAt = time || new Date().toISOString();
    return {
      id: makeId("event"),
      source: settings.source || "button_press",
      record_class: settings.recordClass || "evidence_observation",
      type,
      observation_type: \`field.\${type}\`,
      taxonomy_version: "property-observation-1.0",
      button_label: buttonLabels[type] || type,
      note: note || "",
      evidence_classification: settings.evidenceClassification || "Observed",
      information_class: settings.informationClass || (settings.recordClass === "inspector_thought" ? "INSPECTOR_INTERPRETATION" : "OBSERVED_ON_SITE"),
      automatic_context_id: automaticContextTools ? automaticContextTools.ensureModel(data).last_device_snapshot_id : null,
      attributes: Object.assign({}, settings.attributes || {}),
      area_id: settings.areaId || context.area_id,
      question_ids: Array.isArray(settings.questionIds) ? settings.questionIds.slice() : context.question_ids,
      question_links: Array.isArray(settings.questionLinks) ? settings.questionLinks.map(link => Object.assign({}, link)) : context.question_links,
      time: recordedAt,
      lat: position && Number.isFinite(Number(position.lat)) ? Number(position.lat) : null,
      lon: position && Number.isFinite(Number(position.lon)) ? Number(position.lon) : null,
      gps_accuracy_m: position && Number.isFinite(Number(position.accuracy_m)) ? Number(position.accuracy_m) : null,
      gps_position_at: position && position.time ? position.time : null,
      gps_capture_delay_ms: position && position.time ? Math.max(0, Date.parse(position.time) - Date.parse(recordedAt)) : null,
      location_status: position ? "CAPTURED_WITH_RECORD" : "PENDING_GPS",
      location_requested_at: recordedAt,
      compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : (position && position.heading_deg != null ? position.heading_deg : null),
      device_orientation: latestOrientation ? {
        alpha_deg: latestOrientation.alpha_deg,
        beta_deg: latestOrientation.beta_deg,
        gamma_deg: latestOrientation.gamma_deg,
        absolute: latestOrientation.absolute
      } : null,
      photo_id: photoId || null
    };
  }`);

const gpsHelpersAndError = `  function freshFieldPosition(maxAgeMs) {
    if (!lastPosition) return null;
    const ageLimit = Number.isFinite(Number(maxAgeMs)) ? Number(maxAgeMs) : 120000;
    const recordedAt = Date.parse(lastPosition.time || "");
    if (!Number.isFinite(recordedAt) || Date.now() - recordedAt > ageLimit) return null;
    return lastPosition;
  }

  function clearActiveGpsWatch() {
    gpsWatchGeneration += 1;
    if (watchId !== null) {
      try { navigator.geolocation.clearWatch(watchId); } catch (error) { /* Safari may already have dropped it. */ }
    }
    watchId = null;
  }

  function gpsWatcherIsStale() {
    if (watchId === null) return true;
    if (!lastGpsFixReceivedAt) return !freshFieldPosition();
    return Date.now() - lastGpsFixReceivedAt > GPS_STALE_MS;
  }

  function scheduleGpsRestart(delayMs) {
    if (gpsPermissionDenied || !data.started || data.stopped) return;
    if (gpsRestartTimer) return;
    const delay = Math.max(500, Math.min(Number(delayMs) || 1000, 10000));
    gpsRestartTimer = setTimeout(() => {
      gpsRestartTimer = null;
      if (gpsPermissionDenied || !data.started || data.stopped) return;
      startTracking({ recovery: true, skipReconcile: true }).catch(error => {
        setStatus(\`GPS reconnect failed: \${error.message}. Records still save with location pending.\`, "warning");
      });
    }, delay);
  }

  function startGpsWatcher() {
    clearActiveGpsWatch();
    const generation = gpsWatchGeneration;
    const id = navigator.geolocation.watchPosition(position => {
      if (generation !== gpsWatchGeneration) return;
      onPosition(position);
    }, error => {
      if (generation !== gpsWatchGeneration) return;
      onGpsError(error, generation);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    if (generation !== gpsWatchGeneration) {
      try { navigator.geolocation.clearWatch(id); } catch (error) { /* superseded immediately */ }
      return null;
    }
    watchId = id;
    return id;
  }

  function explainGpsProblem(error) {
    const code = error && Number(error.code);
    if (code === 1) {
      gpsPermissionDenied = true;
      return "SAFARI LOCATION PERMISSION IS OFF. Open iPhone Settings > Privacy & Security > Location Services > Safari Websites, choose While Using the App, and turn Precise Location ON. Your field taps still save with location pending.";
    }
    if (code === 2) return "Safari cannot get a location right now. Your field tap is saved with location pending; GPS will reconnect automatically.";
    if (code === 3) return "Safari location timed out. Your field tap is saved with location pending; GPS will reconnect automatically.";
    return \`Safari GPS problem: \${error && error.message ? error.message : "unknown error"}. Your field tap is saved with location pending.\`;
  }

  function onGpsError(error, generation) {
    if (generation != null && generation !== gpsWatchGeneration) return;
    clearActiveGpsWatch();
    stopOrientationCapture();
    releaseWakeLock();
    updateControls();
    const message = explainGpsProblem(error);
    setStatus(message, Number(error && error.code) === 1 ? "error" : "warning");
    simpleSetStatus(message, "warning");
    if (gpsPermissionDenied) {
      clearTimeout(gpsRestartTimer);
      gpsRestartTimer = null;
      gpsRestartAttempt = 0;
      return;
    }
    const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(gpsRestartAttempt, 3)));
    gpsRestartAttempt += 1;
    scheduleGpsRestart(delay);
  }`;
app = replaceFunction(app, "onGpsError", gpsHelpersAndError);

app = replaceFunction(app, "startTracking", `  async function startTracking(options) {
    const trackingOptions = options || {};
    if (gpsStorageFailed) {
      setStatus("GPS storage previously failed. Do not resume; finish and preserve the current inspection now.", "error");
      return;
    }
    if (!offlineReady) {
      setStatus("Offline preparation is not complete. Inspection cannot begin safely.", "error");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("This browser does not provide GPS. Field records can still be preserved, but locations cannot be captured.", "error");
      return;
    }
    if (gpsPermissionDenied && trackingOptions.recovery) return;
    const orientationPermission = requestOrientationAccess();
    try {
      await revalidatePhotoDb();
    } catch (error) {
      setStatus("Durable photograph storage is unavailable. Inspection cannot begin safely in this browser.", "error");
      return;
    }
    await requestDurableStorage();
    await orientationPermission;
    if (!data.inspection_id) data.inspection_id = makeId("inspection");
    const startedAt = new Date().toISOString();
    const resuming = Boolean(data.started);
    data.started = data.started || startedAt;
    if (!data.conditions.inspection_date) {
      data.conditions.inspection_date = startedAt.slice(0, 10);
      renderConditions();
    }
    if (!trackingOptions.recovery) {
      data.stopped = null;
      data.lifecycle_events.push({ type: resuming ? "inspection_resumed" : "inspection_started", time: startedAt, source: "button_press" });
      automaticContextGpsCapturedForRun = false;
      captureAutomaticContext(resuming ? "inspection_resumed" : "inspection_started", null);
      lastPosition = null;
      saveState();
      updateTimeMetrics();
    }
    if (!trackingOptions.skipReconcile) await reconcileGpsPoints();
    startGpsWatcher();
    if (SIMPLE_AUTOMATION_MODE) {
      lastPosition = { lat: 30.489, lon: -87.091, accuracy_m: 3, altitude_m: 20, altitude_accuracy_m: 2, heading_deg: 90, speed_mps: 0, time: new Date().toISOString(), sequence: 1 };
      renderSimpleHeader();
    }
    updateControls();
    await keepAwake();
    if (!trackingOptions.recovery) setStatus("GPS starting. Field buttons remain usable while location connects.", "active");
    refreshAuthoritativeWeather({ silent: true }).catch(() => { renderAuthoritativeWeather(); });
  }`);

app = replaceFunction(app, "ensureFieldGpsReady", `  async function ensureFieldGpsReady() {
    const fresh = freshFieldPosition();
    if (fresh) return fresh;
    if (gpsPermissionDenied) {
      simpleSetStatus("LOCATION PERMISSION IS OFF — field records still save with location pending.", "warning");
      return null;
    }
    if (fieldGpsFixPromise) return fieldGpsFixPromise;
    fieldGpsFixPromise = (async () => {
      if (!("geolocation" in navigator)) {
        simpleSetStatus("LOCATION IS NOT AVAILABLE ON THIS PHONE. Field records still save with location pending.", "warning");
        return null;
      }
      if (gpsWatcherIsStale()) {
        clearActiveGpsWatch();
        await startTracking({ recovery: true, skipReconcile: true });
      }
      simpleSetStatus("GPS RECONNECTING — your field record is already saved; location will attach when Safari provides it.", "warning");
      const attempt = options => new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(position => {
          onPosition(position);
          resolve(freshFieldPosition());
        }, error => resolve({ __gps_error: error }), options);
      });
      let result = await attempt({ enableHighAccuracy: true, maximumAge: 0, timeout: 8000 });
      if (result && !result.__gps_error) return result;
      const firstError = result && result.__gps_error;
      if (firstError && Number(firstError.code) === 1) {
        onGpsError(firstError, gpsWatchGeneration);
        return null;
      }
      result = await attempt({ enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 });
      if (result && !result.__gps_error) return result;
      const finalError = result && result.__gps_error || firstError;
      if (finalError) onGpsError(finalError, gpsWatchGeneration);
      return null;
    })().finally(() => { fieldGpsFixPromise = null; });
    return fieldGpsFixPromise;
  }`);

app = replaceExact(
  app,
  "    point.sequence = data.points.length ? (data.points[data.points.length - 1].sequence || data.points.length) + 1 : 1;\n    data.points.push(point);",
  `    point.sequence = data.points.length ? (data.points[data.points.length - 1].sequence || data.points.length) + 1 : 1;
    const sectionAtFix = sectionMappingTools ? sectionMappingTools.activeSection(data) : null;
    if (sectionAtFix && !sectionAtFix.capture_paused) {
      point.section_id = sectionAtFix.section_id;
      point.section_capture_status = "ACTIVE_EDGE_CAPTURE";
    }
    data.points.push(point);`,
  "new GPS point section identity"
);

app = replaceExact(
  app,
  "    coverageDirty = true;\n    gpsWriteQueue = gpsWriteQueue\n      .then(() => gpsPointPut(data.inspection_id, point))",
  `    coverageDirty = true;
    const canonicalPointForWrite = Object.assign({}, point);
    gpsWriteQueue = gpsWriteQueue
      .then(() => gpsPointPut(data.inspection_id, canonicalPointForWrite))`,
  "immutable queued GPS point"
);

app = replaceExact(
  app,
  "    if (sectionMappingTools) sectionMappingTools.appendWalkPoint(data, point, point.time);\n    if (wetEdgeTools) wetEdgeTools.appendWalkPoint(data, point, point.time);",
  `    if (sectionMappingTools) sectionMappingTools.appendWalkPoint(data, point, point.time);
    if (wetEdgeTools) wetEdgeTools.appendWalkPoint(data, point, point.time);
    resolvePendingLocationRecords(point);`,
  "pending location resolution"
);

app = replaceExact(
  app,
  '    document.getElementById("pointCount").textContent = data.points.length;',
  `    lastGpsFixReceivedAt = Date.now();
    gpsRestartAttempt = 0;
    gpsPermissionDenied = false;
    document.getElementById("pointCount").textContent = data.points.length;`,
  "GPS recovery reset after fix"
);

const pendingHelpers = `
  function applyRecoveredLocation(record, point, recordedAt) {
    if (!record || record.location_status !== "PENDING_GPS") return false;
    const originalTime = recordedAt || record.location_requested_at || record.recorded_at || record.started_at || record.time;
    const originalMs = Date.parse(originalTime || "");
    const pointMs = Date.parse(point.time || "");
    if (Number.isFinite(originalMs) && Number.isFinite(pointMs) && pointMs < originalMs) return false;
    record.lat = point.lat;
    record.lon = point.lon;
    record.latitude = point.lat;
    record.longitude = point.lon;
    record.gps_accuracy_m = point.accuracy_m;
    record.gps_position_at = point.time;
    record.gps_capture_delay_ms = Number.isFinite(originalMs) && Number.isFinite(pointMs) ? Math.max(0, pointMs - originalMs) : null;
    record.location_status = "RECOVERED_AFTER_PENDING";
    return true;
  }

  function resolvePendingLocationRecords(point) {
    let changed = false;
    (data.markers || []).forEach(record => { if (applyRecoveredLocation(record, point, record.time)) changed = true; });
    (data.simple_sessions || []).forEach(record => { if (applyRecoveredLocation(record, point, record.started_at)) changed = true; });
    (data.voice_notes || []).forEach(record => { if (applyRecoveredLocation(record, point, record.started_at || record.recorded_at)) changed = true; });
    if (data.pending_voice_note && applyRecoveredLocation(data.pending_voice_note, point, data.pending_voice_note.started_at)) changed = true;
    (data.site_sound_records || []).forEach(record => { if (applyRecoveredLocation(record, point, record.recorded_at)) changed = true; });
    if (frontageTools) {
      const records = frontageTools.ensureModel(data).records || [];
      records.forEach(record => { if (applyRecoveredLocation(record, point, record.recorded_at)) changed = true; });
    }
    if (sectionMappingTools) {
      const activeSection = sectionMappingTools.activeSection(data);
      if (activeSection && !activeSection.start && activeSection.completion_status === "ACTIVE") {
        const recoveredStart = {
          information_class: "CAPTURED_BY_DEVICE",
          latitude: Number(point.lat),
          longitude: Number(point.lon),
          gps_accuracy_m: point.accuracy_m == null ? null : Number(point.accuracy_m),
          gps_position_at: point.time,
          recorded_at: point.time,
          heading_deg: point.heading_deg == null ? null : Number(point.heading_deg),
          source_gps_sequence: point.sequence
        };
        activeSection.start = recoveredStart;
        activeSection.gps_start_delay_ms = Math.max(0, Date.parse(point.time) - Date.parse(activeSection.started_at));
        activeSection.events = Array.isArray(activeSection.events) ? activeSection.events : [];
        activeSection.events.push({
          event_type: "SECTION_FIRST_GPS_RECOVERED",
          recorded_at: point.time,
          original_section_tap_at: activeSection.started_at,
          gps_start_delay_ms: activeSection.gps_start_delay_ms,
          gps_accuracy_m: point.accuracy_m,
          source_gps_sequence: point.sequence
        });
        changed = true;
      }
    }
    (data.photos || []).forEach(photo => {
      if (!applyRecoveredLocation(photo, point, photo.recorded_at || photo.time)) return;
      changed = true;
      photoStoreGet(photo.id).then(stored => {
        if (!stored || !stored.metadata || stored.metadata.location_status !== "PENDING_GPS") return;
        applyRecoveredLocation(stored.metadata, point, stored.metadata.recorded_at || stored.metadata.time);
        if (stored.event) applyRecoveredLocation(stored.event, point, stored.event.time);
        return photoStorePut(stored);
      }).catch(() => {});
    });
    if (changed) {
      try { saveState(); } catch (error) { /* canonical stores remain authoritative */ }
      renderSimpleHeader();
    }
  }
`;
app = replaceExact(app, "\n  function addMarker(type, options) {", pendingHelpers + "\n  function addMarker(type, options) {", "pending GPS helper insertion");

app = replaceExact(
  app,
  `  function addMarker(type, options) {
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Marker was not recorded.", "warning");
      return;
    }`,
  `  function addMarker(type, options) {`,
  "observations save without GPS"
);

app = replaceExact(
  app,
  `  function openObservationDialog(type) {
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Observation was not recorded.", "warning");
      return;
    }`,
  `  function openObservationDialog(type) {`,
  "observation dialog opens without GPS"
);

app = replaceExact(
  app,
  "    if (!activeObservationType || !lastPosition) return;",
  "    if (!activeObservationType) return;",
  "structured observation can save pending GPS"
);

app = replaceExact(
  app,
  '    markerButtons.forEach(button => { button.disabled = !tracking || photoBusy || packageBusy || recordingVoice; });',
  '    markerButtons.forEach(button => { button.disabled = photoBusy || packageBusy || recordingVoice; });',
  "field buttons stay enabled while GPS recovers"
);
app = replaceExact(
  app,
  '    voiceBtn.disabled = !tracking || photoBusy || packageBusy;',
  '    voiceBtn.disabled = photoBusy || packageBusy;',
  "voice button stays enabled while GPS recovers"
);

app = replaceExact(
  app,
  `    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Voice note was not started.", "warning");
      return false;
    }`,
  "",
  "voice note can start with pending GPS"
);
app = replaceExact(app, "        lat: lastPosition.lat,\n        lon: lastPosition.lon,\n        gps_accuracy_m: lastPosition.accuracy_m,\n        gps_position_at: lastPosition.time,", `        lat: freshFieldPosition() ? freshFieldPosition().lat : null,
        lon: freshFieldPosition() ? freshFieldPosition().lon : null,
        gps_accuracy_m: freshFieldPosition() ? freshFieldPosition().accuracy_m : null,
        gps_position_at: freshFieldPosition() ? freshFieldPosition().time : null,
        location_status: freshFieldPosition() ? "CAPTURED_WITH_RECORD" : "PENDING_GPS",
        location_requested_at: startedAt,`, "voice pending location metadata");

app = replaceExact(
  app,
  `  async function takePhoto(context) {
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Camera was not opened.", "warning");
      return;
    }`,
  `  async function takePhoto(context) {`,
  "camera opens while GPS recovers"
);
app = replaceExact(app, '      if (!position) throw new Error("No GPS position was available for the photograph.");\n', "", "photo does not fail for missing GPS");
app = replaceExact(app, "        lat: position.lat,\n        lon: position.lon,\n        gps_accuracy_m: position.accuracy_m,\n        gps_position_at: position.time,\n        gps_position_age_ms: Math.max(0, new Date(recordedAt) - new Date(position.time)),\n        location_source: \"live_browser_geolocation\",\n        compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : position.heading_deg,", `        lat: position ? position.lat : null,
        lon: position ? position.lon : null,
        gps_accuracy_m: position ? position.accuracy_m : null,
        gps_position_at: position ? position.time : null,
        gps_position_age_ms: position && position.time ? Math.max(0, new Date(recordedAt) - new Date(position.time)) : null,
        location_source: position ? "live_browser_geolocation" : "pending_browser_geolocation",
        location_status: position ? "CAPTURED_WITH_RECORD" : "PENDING_GPS",
        location_requested_at: recordedAt,
        compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : (position ? position.heading_deg : null),`, "photo pending location metadata");

app = replaceFunction(app, "activateSectionSession", `  function activateSectionSession(section, returnScreen, positionOverride) {
    if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE");
    const now = new Date().toISOString();
    const position = positionOverride !== undefined ? positionOverride : freshFieldPosition();
    let observationId = section.observation_id || null;
    if (!observationId) {
      const marker = markerFromPosition("other", "Mapped land section", null, now, position, {
        informationClass: "OBSERVED_ON_SITE",
        attributes: { section_id: section.section_id, section_method: section.method, descriptions: section.description_selections }
      });
      observationId = marker.id;
      section.observation_id = observationId;
      data.markers.push(marker);
    }
    const session = {
      schema_name: "property-inspector-simple-capture-session", schema_version: "1.0",
      simple_session_id: makeId("simple-session"), feature_id: section.section_id, feature_type: "map_section", section_id: section.section_id,
      started_at: now, updated_at: now, finished_at: null, completion_status: "ACTIVE", information_class: "OBSERVED_ON_SITE",
      return_screen: returnScreen || "FIELD_BUTTONS", details: { section_id: section.section_id }, observation_id: observationId,
      lat: position ? position.lat : null, lon: position ? position.lon : null, gps_accuracy_m: position ? position.accuracy_m : null, gps_position_at: position ? position.time : null,
      location_status: position ? "CAPTURED_WITH_RECORD" : "PENDING_GPS", location_requested_at: now
    };
    data.simple_sessions.push(session);
    data.active_simple_session_id = session.simple_session_id;
    simpleActiveSessionId = session.simple_session_id;
    saveState(); redraw();
    return session;
  }`);

const oldSectionHandler = `    document.getElementById("sectionStartWalking").addEventListener("click", () => {
      if (!lastPosition) { simpleSetStatus("WAIT HERE - GPS is not ready. Nothing was recorded yet.", "warning"); return; }
      const descriptions = Array.from(content.querySelectorAll('.section-description-list input:checked')).map(input => input.value);
      const conditions = {};
      Object.keys(sectionMappingTools.CONDITION_GROUPS || {}).forEach(group => { const chosen = content.querySelector(\`input[name="section-\${group}"]:checked\`); conditions[group] = chosen ? chosen.value : null; });
      const methodInput = content.querySelector('input[name="sectionMethod"]:checked');
      try {
        const section = sectionMappingTools.startSection(data, { descriptions, conditions, method: methodInput && methodInput.value, position: lastPosition, source_planning_suggestion_id: selectedSuggestionId || settings.source || null });
        activateSectionSession(section, "FIELD_BUTTONS");
        simpleSetStatus(\`\${section.section_id} STARTED - descriptions, GPS, time, accuracy, and heading saved\`, "saved");
        renderSectionActive(section);
      } catch (error) { simpleSetStatus(error.message, "warning"); }
    });`;
const newSectionHandler = `    document.getElementById("sectionStartWalking").addEventListener("click", () => {
      const tapPosition = freshFieldPosition();
      const tappedAt = new Date().toISOString();
      const descriptions = Array.from(content.querySelectorAll('.section-description-list input:checked')).map(input => input.value);
      const conditions = {};
      Object.keys(sectionMappingTools.CONDITION_GROUPS || {}).forEach(group => { const chosen = content.querySelector(\`input[name="section-\${group}"]:checked\`); conditions[group] = chosen ? chosen.value : null; });
      const methodInput = content.querySelector('input[name="sectionMethod"]:checked');
      try {
        const section = sectionMappingTools.startSection(data, { descriptions, conditions, method: methodInput && methodInput.value, position: tapPosition, recorded_at: tappedAt, source_planning_suggestion_id: selectedSuggestionId || settings.source || null });
        section.location_status = tapPosition ? "CAPTURED_WITH_RECORD" : "PENDING_GPS";
        section.location_requested_at = tappedAt;
        activateSectionSession(section, "FIELD_BUTTONS", tapPosition);
        saveState();
        simpleSetStatus(tapPosition ? \`\${section.section_id} STARTED — GPS, time, accuracy, and heading saved\` : \`\${section.section_id} SAVED — LOCATION PENDING; GPS is reconnecting\`, tapPosition ? "saved" : "warning");
        renderSectionActive(section);
        if (!tapPosition) ensureFieldGpsReady().catch(() => {});
      } catch (error) { simpleSetStatus(\`SECTION NOT SAVED — \${error.message}\`, "warning"); }
    });`;
app = replaceExact(app, oldSectionHandler, newSectionHandler, "section starts immediately with pending GPS");

app = replaceFunction(app, "openSimpleCapture", `  async function openSimpleCapture(type, returnScreen) {
    const tapPosition = freshFieldPosition();
    if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE");
    simpleCloseDialogs();
    const featureId = simpleNextIdentifier(type);
    const now = new Date().toISOString();
    const session = {
      schema_name: "property-inspector-simple-capture-session", schema_version: "1.0",
      simple_session_id: makeId("simple-session"), feature_id: featureId, feature_type: type,
      started_at: now, updated_at: now, finished_at: null,
      completion_status: "ACTIVE", information_class: "OBSERVED_ON_SITE", return_screen: returnScreen || "FIELD_BUTTONS", details: type === "water" ? { depth_tool: "Yardstick", surface_unit: "in" } : {},
      lat: tapPosition ? tapPosition.lat : null, lon: tapPosition ? tapPosition.lon : null, gps_accuracy_m: tapPosition ? tapPosition.accuracy_m : null,
      gps_position_at: tapPosition ? tapPosition.time : null, compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : (tapPosition ? tapPosition.heading_deg : null),
      device_orientation: latestOrientation ? { alpha_deg: latestOrientation.alpha_deg, beta_deg: latestOrientation.beta_deg, gamma_deg: latestOrientation.gamma_deg, absolute: latestOrientation.absolute } : null,
      location_status: tapPosition ? "CAPTURED_WITH_RECORD" : "PENDING_GPS", location_requested_at: now
    };
    if (type === "tree") session.details = { tree_kind: "Unknown", measurement_tool: "Flexible hospital/baby tape", measurement_height_in: 54, ground_basis: "Uphill side" };
    const marker = markerFromPosition(simpleMarkerType(type), "", null, now, tapPosition, { attributes: { simple_session_id: session.simple_session_id, feature_id: featureId, simple_feature_type: type, completion_status: "ACTIVE" } });
    session.observation_id = marker.id;
    data.markers.push(marker);
    data.simple_sessions.push(session);
    data.active_simple_session_id = session.simple_session_id;
    simpleActiveSessionId = session.simple_session_id;
    saveState(); redraw();
    simpleLastSavedMessage = tapPosition ? \`FEATURE SAVED - \${featureId}\` : \`FEATURE SAVED - \${featureId} - LOCATION PENDING\`;
    simpleSetStatus(simpleLastSavedMessage, tapPosition ? "saved" : "warning");
    if (!tapPosition) ensureFieldGpsReady().catch(() => {});
    if (type === "photo") { simpleTakePhoto(); return; }
    renderSimpleCapture();
  }`);

app = replaceFunction(app, "saveFrontageRecord", `  async function saveFrontageRecord(recordType, attributes) {
    const tapPosition = freshFieldPosition();
    const now = new Date().toISOString();
    const record = frontageTools.createRecord(data, recordType, tapPosition, latestOrientation, attributes || {}, now);
    const marker = markerFromPosition(frontageMarkerType(recordType), "", null, now, tapPosition, {
      evidenceClassification: "Observed",
      attributes: Object.assign({ frontage_record_id: record.record_id, frontage_record_type: recordType }, record.attributes)
    });
    record.observation_id = marker.id;
    data.markers.push(marker);
    data.lifecycle_events.push({ type: "frontage_record_saved", time: now, record_id: record.record_id, record_type: recordType, source: "button_press" });
    saveState();
    redraw();
    simpleSetStatus(tapPosition ? \`\${record.record_id} SAVED\` : \`\${record.record_id} SAVED — LOCATION PENDING\`, tapPosition ? "saved" : "warning");
    if (!tapPosition) ensureFieldGpsReady().catch(() => {});
    return record;
  }`);

const exportHelpers = `  function exactFieldEvidenceCounts() {
    const sectionModel = sectionMappingTools ? sectionMappingTools.ensureModel(data) : { sections: [] };
    return {
      gps_points: data.points.length,
      records: data.markers.length,
      photos: data.photos.length,
      voice: data.voice_notes.length,
      sections: Array.isArray(sectionModel.sections) ? sectionModel.sections.length : 0
    };
  }

  function formatFieldEvidenceCounts(counts) {
    return counts.gps_points + " GPS | " + counts.records + " records | " + counts.photos + " photos | " + counts.voice + " voice | " + counts.sections + " sections";
  }

  function verifyExportPreservedInspection(before, result, wasActive) {
    const after = exactFieldEvidenceCounts();
    const summary = result && result.manifest && result.manifest.summary || {};
    if ((Number(summary.gps_track_point_count) || 0) < before.gps_points) throw new Error("Export omitted GPS points.");
    if ((Number(summary.field_event_count) || 0) < before.records) throw new Error("Export omitted field records.");
    if ((Number(summary.photo_count) || 0) !== before.photos) throw new Error("Export photo count mismatch.");
    if ((Number(summary.voice_note_count) || 0) !== before.voice) throw new Error("Export voice-note count mismatch.");
    if (after.records < before.records || after.photos < before.photos || after.voice < before.voice || after.sections < before.sections) throw new Error("Saved evidence count decreased during export.");
    if (wasActive && data.stopped) throw new Error("Export ended the active inspection.");
    return { before, after };
  }

`;
const newFinish = exportHelpers + `  async function finishInspection(options) {
    const settings = options || {};
    if (packageBusy || photoBusy) return;
    if (!data.started || !data.points.length) {
      setStatus("INSPECTION INCOMPLETE: at least one recorded GPS point is required.", "error");
      return;
    }
    if (!data.photos.length && !pendingPhotoQueue.length) {
      setStatus("INSPECTION INCOMPLETE: at least one photograph is required. Photo markers alone are unacceptable.", "error");
      return;
    }
    if (!settings.reviewed) {
      showDepartureReview();
      return;
    }
    if (!(await confirmLargePackage("report"))) return;
    const before = exactFieldEvidenceCounts();
    const wasActive = Boolean(data.started && !data.stopped);
    packageBusy = true;
    updateControls();
    data.lifecycle_events.push({ type: "inspection_copy_created", time: new Date().toISOString(), source: "button_press" });
    saveState();
    setStatus(\`EXPORT STARTING — \${formatFieldEvidenceCounts(before)}\`, "active");
    try {
      await gpsWriteQueue;
      const result = await buildPackageWithRecovery("report", null);
      const verification = verifyExportPreservedInspection(before, result, wasActive);
      await presentPackage(result.fileName, result.blob, result.manifest);
      setStatus(\`EXPORT VERIFIED — BEFORE: \${formatFieldEvidenceCounts(verification.before)} | AFTER: \${formatFieldEvidenceCounts(verification.after)} | INSPECTION STILL ACTIVE: \${data.started && !data.stopped ? "YES" : "NO"}\`, "success");
    } catch (error) {
      setStatus(\`EXPORT NOT VERIFIED: \${error.message}. Your inspection remains saved. Do not press Clear.\`, "error");
    } finally {
      packageBusy = false;
      updateControls();
    }
  }`;
app = replaceFunction(app, "finishInspection", newFinish);

app = replaceFunction(app, "exportBackupNow", `  async function exportBackupNow() {
    if (packageBusy || photoBusy || !data.started) return;
    if (!(await confirmLargePackage("full_archive"))) return;
    const before = exactFieldEvidenceCounts();
    const wasActive = Boolean(data.started && !data.stopped);
    packageBusy = true;
    updateControls();
    setStatus(\`BACKUP STARTING — \${formatFieldEvidenceCounts(before)}\`, "active");
    try {
      await gpsWriteQueue;
      const result = await buildPackageWithRecovery("full_archive", wasActive ? "backup" : null);
      const verification = verifyExportPreservedInspection(before, result, wasActive);
      await presentPackage(result.fileName, result.blob, result.manifest);
      setStatus(\`BACKUP VERIFIED — BEFORE: \${formatFieldEvidenceCounts(verification.before)} | AFTER: \${formatFieldEvidenceCounts(verification.after)} | INSPECTION STILL ACTIVE: \${data.started && !data.stopped ? "YES" : "NO"}\`, "success");
    } catch (error) {
      setStatus(\`BACKUP NOT VERIFIED: \${error.message}. Your inspection remains saved. Do not press Clear.\`, "error");
    } finally {
      packageBusy = false;
      updateControls();
    }
  }`);

app = replaceExact(
  app,
  '    if (watchId !== null) stopTracking({ silent: true, reason: "clear" });',
  '    if (data.started && !data.stopped) { setStatus("ACTIVE INSPECTION CANNOT BE CLEARED. End the inspection first. Nothing was changed.", "warning"); return; }',
  "clear cannot erase active inspection"
);

const oldVisibility = `  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (watchId !== null && !wakeLock) keepAwake();
      if (data.started && !data.stopped && watchId === null) startTracking();
      preparePhotoStorage();
    }
  });`;
const newVisibility = `  function revalidateGpsAfterReturn() {
    if (!data.started || data.stopped || gpsPermissionDenied) return;
    if (!freshFieldPosition() || gpsWatcherIsStale()) {
      clearActiveGpsWatch();
      startTracking({ recovery: true, skipReconcile: true }).catch(() => {});
    } else if (watchId !== null && !wakeLock) keepAwake();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      try { saveState(); } catch (error) { /* background save is only an extra snapshot */ }
      return;
    }
    revalidateGpsAfterReturn();
    preparePhotoStorage();
  });
  window.addEventListener("pageshow", revalidateGpsAfterReturn);`;
app = replaceExact(app, oldVisibility, newVisibility, "Safari return recovery");

frontage = replaceFunction(frontage, "createRecord", `  function createRecord(inspection, recordType, position, orientation, attributes, now) {
    const model = ensureModel(inspection);
    const recordId = nextIdentifier(inspection, recordType);
    const recordedAt = now || new Date().toISOString();
    const hasPosition = Boolean(position && Number.isFinite(Number(position.lat)) && Number.isFinite(Number(position.lon)));
    const record = {
      record_id: recordId,
      record_type: recordType,
      recorded_at: recordedAt,
      latitude: hasPosition ? Number(position.lat) : null,
      longitude: hasPosition ? Number(position.lon) : null,
      gps_accuracy_m: hasPosition && position.accuracy_m != null ? Number(position.accuracy_m) : null,
      gps_position_at: hasPosition ? (position.time || null) : null,
      location_status: hasPosition ? "CAPTURED_WITH_RECORD" : "PENDING_GPS",
      location_requested_at: recordedAt,
      compass_heading_deg: orientation && orientation.compass_heading_deg != null ? orientation.compass_heading_deg : (hasPosition && position.heading_deg != null ? position.heading_deg : null),
      device_orientation: orientationSnapshot(orientation),
      information_class: "OBSERVED_ON_SITE",
      completion_status: "BASIC_RECORD_SAVED",
      attributes: Object.assign({}, attributes || {})
    };
    model.records.push(record);
    if (recordType === "frontage_end") model.frontage_end_ids.push(recordId);
    else if (recordType === "vehicle_crossing") model.vehicle_crossing_ids.push(recordId);
    else if (recordType === "ditch_change") model.ditch_change_ids.push(recordId);
    else if (recordType === "parking_staging") model.parking_staging_ids.push(recordId);
    else model.roadside_condition_ids.push(recordId);
    model.updated_at = recordedAt;
    return record;
  }`);

section = replaceExact(
  section,
  '    if (!settings.position) throw new Error("WAIT HERE — GPS is not ready. Nothing was recorded yet.");\n',
  "",
  "Open-and-Reveal start can be pending GPS"
);
section = replaceExact(
  section,
  '      lane_type: laneType, started_at: now, finished_at: null, status: "PLANNED_FROM_START_POINT",\n      start: pointFrom(settings.position, now), end: null,',
  '      lane_type: laneType, started_at: now, finished_at: null, status: settings.position ? "PLANNED_FROM_START_POINT" : "PLANNED_LOCATION_PENDING",\n      start: pointFrom(settings.position, now), end: null,\n      location_status: settings.position ? "CAPTURED_WITH_RECORD" : "PENDING_GPS", location_requested_at: now,',
  "Open-and-Reveal pending location metadata"
);

index = index.replaceAll(BASELINE_VERSION, RELEASE);
if (!index.includes(`./app.js?v=${RELEASE}`)) throw new Error("index did not update the direct app query string");

sw = sw.replaceAll(BASELINE_VERSION, RELEASE);
sw = replaceExact(sw, 'const CACHE_NAME = "property-inspector-home-test-313-offline-v5-1";', `const CACHE_NAME = "${CACHE_NAME}";`, "direct cache name");
sw = replaceExact(
  sw,
  'keys.filter(key => key.startsWith("property-inspector-home-test-313-") && key !== CACHE_NAME)',
  'keys.filter(key => key.startsWith("property-inspector-home-test-313-direct-") && key !== CACHE_NAME)',
  "direct cache cleanup isolation"
);
sw = sw.replaceAll("caches.match(request)", 'caches.match(request, { ignoreSearch: true })');
if (sw.includes("patchFieldAppSource") || sw.includes("recoveredAppResponse")) throw new Error("Runtime source patching is forbidden in the direct candidate.");

new Function(app);
new Function(frontage);
new Function(section);
new Function(sw);

assertContains(app, 'const stateKey = "propertyInspectorHomeTest313V1";', "preserved localStorage");
assertContains(app, 'const photoDbName = "property-inspector-home-test-313-evidence";', "preserved IndexedDB");
assertContains(app, "DIRECT_APP_FILE_NO_RUNTIME_SOURCE_PATCH", "direct build mode");
assertContains(app, "PENDING_GPS", "pending GPS persistence");
assertContains(app, "SECTION_FIRST_GPS_RECOVERED", "section delayed GPS attribution");
assertContains(app, "canonicalPointForWrite", "immutable queued GPS point");
assertContains(app, "gpsWatchGeneration", "watch generation token");
assertContains(app, "INSPECTION STILL ACTIVE", "export active proof");
if (app.includes("propertyInspectorFixedTest313V1") || app.includes("property-inspector-fixed-test-313-evidence")) {
  throw new Error("Alternate test storage leaked into the direct candidate.");
}

fs.writeFileSync(APP_PATH, app);
fs.writeFileSync(INDEX_PATH, index);
fs.writeFileSync(SW_PATH, sw);
fs.writeFileSync(FRONTAGE_PATH, frontage);
fs.writeFileSync(SECTION_PATH, section);

process.stdout.write(`Built ${RELEASE} directly from ${BASELINE_COMMIT}\n`);
