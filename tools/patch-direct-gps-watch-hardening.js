#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-5";
const TO = "3.13.0-home-test.5.1-safari-direct-6";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

function findFunctionRange(source, name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = re.exec(source);
  if (!match) throw new Error(`Function ${name} not found`);
  const start = match.index;
  const open = source.indexOf("{", start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
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
    else if (ch === "}") { depth -= 1; if (depth === 0) return { start, end: i + 1 }; }
  }
  throw new Error(`Function ${name} not closed`);
}

function replaceFunction(source, name, replacement) {
  const range = findFunctionRange(source, name);
  return source.slice(0, range.start) + replacement + source.slice(range.end);
}

let app = fs.readFileSync(appPath, "utf8");
let index = fs.readFileSync(indexPath, "utf8");
let sw = fs.readFileSync(swPath, "utf8");

app = replaceOnce(app, `const APP_VERSION = "${FROM}";`, `const APP_VERSION = "${TO}";`, "version");
app = replaceOnce(app,
  '  let gpsRecoveryReason = "";',
  `  let gpsRecoveryReason = "";\n  let gpsWatchStartedAt = 0;\n  let gpsManualFallbackTimer = null;\n  let gpsPermissionState = "unknown";\n  const GPS_FIRST_FIX_GRACE_MS = 30000;\n  const GPS_MANUAL_HARD_TIMEOUT_MS = 20000;`,
  "GPS hardening state"
);

app = replaceOnce(app,
  "\n\n  function captureAutomaticContext(reason, position) {",
  `\n\n  function clearManualGpsFallback() {\n    if (gpsManualFallbackTimer) clearTimeout(gpsManualFallbackTimer);\n    gpsManualFallbackTimer = null;\n  }\n\n  function refreshGpsPermissionState() {\n    if (!navigator.permissions || typeof navigator.permissions.query !== "function") {\n      gpsPermissionState = "unsupported";\n      return Promise.resolve(gpsPermissionState);\n    }\n    const query = navigator.permissions.query({ name: "geolocation" })\n      .then(status => {\n        gpsPermissionState = status && status.state ? status.state : "unknown";\n        if (status) status.onchange = () => {\n          gpsPermissionState = status.state || "unknown";\n          if (gpsPermissionState !== "denied") gpsPermissionDenied = false;\n          updateVisibleGpsControl();\n        };\n        return gpsPermissionState;\n      })\n      .catch(() => "unknown");\n    return Promise.race([query, new Promise(resolve => setTimeout(() => resolve("unknown"), 1200))])\n      .then(state => {\n        if (state && state !== "unknown") gpsPermissionState = state;\n        if (gpsPermissionState === "denied") {\n          gpsPermissionDenied = true;\n          lastGpsErrorCode = 1;\n        }\n        updateVisibleGpsControl();\n        return gpsPermissionState;\n      });\n  }\n\n  function armManualGpsFallback(generation) {\n    clearManualGpsFallback();\n    gpsManualFallbackTimer = setTimeout(() => {\n      gpsManualFallbackTimer = null;\n      if (!gpsManualRequestInFlight || generation !== gpsWatchGeneration || freshFieldPosition()) return;\n      gpsManualRequestInFlight = false;\n      lastGpsErrorAt = new Date().toISOString();\n      if (gpsPermissionState === "denied") {\n        gpsPermissionDenied = true;\n        lastGpsErrorCode = 1;\n        lastGpsErrorMessage = "Location permission is denied";\n        gpsRecoveryReason = "LOCATION PERMISSION OFF — Safari is not allowed to provide this site a location.";\n      } else {\n        lastGpsErrorCode = 3;\n        lastGpsErrorMessage = "Safari did not return either a location or a geolocation error";\n        gpsRecoveryReason = gpsPermissionState === "prompt"\n          ? "SAFARI HAS NOT FINISHED THE LOCATION REQUEST — tap RECONNECT GPS again after responding to any location prompt."\n          : "SAFARI DID NOT RETURN A LOCATION — the watcher is still alive; tap RECONNECT GPS to replace it immediately.";\n      }\n      data.lifecycle_events.push({ type: "gps_manual_request_hard_timeout", time: lastGpsErrorAt, permission_state: gpsPermissionState, generation });\n      try { saveState(); } catch (error) { /* evidence stores remain authoritative */ }\n      simpleSetStatus(gpsRecoveryReason, "warning");\n      setStatus(gpsRecoveryReason, gpsPermissionDenied ? "error" : "warning");\n      updateVisibleGpsControl();\n    }, GPS_MANUAL_HARD_TIMEOUT_MS);\n  }\n\n  function captureAutomaticContext(reason, position) {`,
  "GPS diagnostic helpers"
);

app = replaceFunction(app, "visibleGpsMessage", `  function visibleGpsMessage() {
    const fresh = freshFieldPosition();
    if (fresh) return \`GPS ACTIVE — accuracy +/-\${Math.round(fresh.accuracy_m || 0)} m\`;
    if (gpsManualRequestInFlight) return "GPS REQUEST SENT — waiting for Safari location.";
    if (gpsPermissionDenied || lastGpsErrorCode === 1 || gpsPermissionState === "denied") return "LOCATION PERMISSION OFF — Safari is not allowed to provide this site a location.";
    if (lastGpsErrorCode === 2) return "GPS POSITION UNAVAILABLE — automatic recovery is trying; tap RECONNECT GPS if needed.";
    if (lastGpsErrorCode === 3) return gpsRecoveryReason || "GPS TIMEOUT — Safari did not return a location; tap RECONNECT GPS.";
    if (gpsRecoveryReason) return gpsRecoveryReason;
    if (watchId !== null) return "GPS STARTING — waiting for Safari location.";
    if (data.started) return "GPS IS NOT CONNECTED — tap RECONNECT GPS.";
    return "GPS has not started yet.";
  }`);

app = replaceFunction(app, "requestGpsFromVisibleControl", `  function requestGpsFromVisibleControl() {
    gpsUserActivatedThisPage = true;
    gpsManualRequestInFlight = true;
    gpsRecoveryReason = "";
    gpsPermissionDenied = false;
    lastGpsErrorCode = null;
    lastGpsErrorMessage = "";
    lastGpsErrorAt = null;
    clearManualGpsFallback();
    refreshGpsPermissionState().catch(() => {});
    if (!("geolocation" in navigator)) {
      gpsManualRequestInFlight = false;
      lastGpsErrorCode = 0;
      lastGpsErrorMessage = "geolocation unavailable";
      updateVisibleGpsControl();
      simpleSetStatus("GPS UNAVAILABLE ON THIS PHONE. Field records still save.", "warning");
      return;
    }

    const now = new Date().toISOString();
    if (!data.inspection_id) data.inspection_id = makeId("inspection");
    if (!data.started) {
      data.started = now;
      if (!data.conditions.inspection_date) data.conditions.inspection_date = now.slice(0, 10);
      data.lifecycle_events.push({ type: "inspection_started", time: now, source: "visible_gps_button" });
    } else if (data.stopped) {
      data.stopped = null;
      data.lifecycle_events.push({ type: "inspection_resumed", time: now, source: "visible_gps_button" });
    }
    data.lifecycle_events.push({ type: "gps_reconnect_tapped", time: now, source: "visible_gps_button" });
    saveState();

    // Use the same continuous watchPosition mechanism that records the field track.
    // It is started synchronously inside the user's tap; there are no awaits first.
    try {
      startGpsWatcher();
      const generation = gpsWatchGeneration;
      armManualGpsFallback(generation);
      simpleSetStatus("GPS REQUEST SENT — waiting for Safari location.", "warning");
      setStatus("GPS REQUEST SENT — waiting for Safari location.", "active");
      updateVisibleGpsControl();
    } catch (error) {
      gpsManualRequestInFlight = false;
      clearManualGpsFallback();
      lastGpsErrorCode = 0;
      lastGpsErrorMessage = error && error.message ? error.message : "watchPosition failed to start";
      lastGpsErrorAt = new Date().toISOString();
      gpsRecoveryReason = \`GPS WATCH COULD NOT START — \${lastGpsErrorMessage}.\`;
      simpleSetStatus(gpsRecoveryReason, "warning");
      setStatus(gpsRecoveryReason, "error");
      updateVisibleGpsControl();
    }
  }`);

app = replaceFunction(app, "clearActiveGpsWatch", `  function clearActiveGpsWatch() {
    gpsWatchGeneration += 1;
    if (watchId !== null) {
      try { navigator.geolocation.clearWatch(watchId); } catch (error) { /* Safari may already have dropped it. */ }
    }
    watchId = null;
    gpsWatchStartedAt = 0;
  }`);

app = replaceFunction(app, "gpsWatcherIsStale", `  function gpsWatcherIsStale() {
    if (watchId === null) return true;
    if (lastGpsFixReceivedAt) return Date.now() - lastGpsFixReceivedAt > GPS_STALE_MS;
    if (!gpsWatchStartedAt) return false;
    return Date.now() - gpsWatchStartedAt > GPS_FIRST_FIX_GRACE_MS;
  }`);

app = replaceFunction(app, "scheduleGpsRestart", `  function scheduleGpsRestart(delayMs) {
    if (gpsPermissionDenied || !data.started || data.stopped) return;
    if (gpsRestartTimer) return;
    const delay = Math.max(500, Math.min(Number(delayMs) || 1000, 10000));
    gpsRestartTimer = setTimeout(() => {
      gpsRestartTimer = null;
      if (gpsPermissionDenied || !data.started || data.stopped || gpsManualRequestInFlight) return;
      try {
        gpsRecoveryReason = "GPS LOST — starting a fresh Safari location watcher automatically.";
        startGpsWatcher();
        updateVisibleGpsControl();
      } catch (error) {
        gpsRecoveryReason = \`GPS AUTOMATIC RECOVERY FAILED: \${error && error.message ? error.message : "unknown error"}. Tap RECONNECT GPS.\`;
        updateVisibleGpsControl();
      }
    }, delay);
  }`);

app = replaceFunction(app, "startGpsWatcher", `  function startGpsWatcher() {
    clearActiveGpsWatch();
    const generation = gpsWatchGeneration;
    gpsWatchStartedAt = Date.now();
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
    data.lifecycle_events.push({ type: "gps_watch_started", time: new Date().toISOString(), generation });
    try { saveState(); } catch (error) { /* watcher may still recover location */ }
    return id;
  }`);

app = replaceOnce(app,
  "    lastGpsFixReceivedAt = Date.now();\n    gpsManualRequestInFlight = false;",
  "    lastGpsFixReceivedAt = Date.now();\n    gpsManualRequestInFlight = false;\n    clearManualGpsFallback();",
  "clear hard timeout on GPS fix"
);

app = replaceFunction(app, "onGpsError", `  function onGpsError(error, generation) {
    if (generation != null && generation !== gpsWatchGeneration) return;
    gpsManualRequestInFlight = false;
    clearManualGpsFallback();
    gpsRecoveryReason = "GPS LOST — automatic recovery is trying. You can tap RECONNECT GPS now.";
    clearActiveGpsWatch();
    stopOrientationCapture();
    releaseWakeLock();
    const message = explainGpsProblem(error);
    refreshGpsPermissionState().catch(() => {});
    updateControls();
    setStatus(message, Number(error && error.code) === 1 ? "error" : "warning");
    simpleSetStatus(message, "warning");
    renderSimpleHeader();
    updateVisibleGpsControl();
    if (gpsPermissionDenied) {
      clearTimeout(gpsRestartTimer);
      gpsRestartTimer = null;
      gpsRestartAttempt = 0;
      return;
    }
    const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(gpsRestartAttempt, 3)));
    gpsRestartAttempt += 1;
    scheduleGpsRestart(delay);
  }`);

app = replaceFunction(app, "ensureFieldGpsReady", `  async function ensureFieldGpsReady() {
    const fresh = freshFieldPosition();
    if (fresh) return fresh;
    if (gpsPermissionDenied || gpsPermissionState === "denied") {
      simpleSetStatus("LOCATION PERMISSION IS OFF — field records still save with location pending.", "warning");
      updateVisibleGpsControl();
      return null;
    }
    if (!("geolocation" in navigator)) {
      simpleSetStatus("LOCATION IS NOT AVAILABLE ON THIS PHONE. Field records still save with location pending.", "warning");
      return null;
    }
    if (watchId === null || gpsWatcherIsStale()) {
      try {
        gpsRecoveryReason = "GPS RECOVERY STARTED — waiting for Safari location.";
        startGpsWatcher();
      } catch (error) {
        gpsRecoveryReason = \`GPS RECOVERY COULD NOT START: \${error && error.message ? error.message : "unknown error"}.\`;
      }
    }
    updateVisibleGpsControl();
    return null;
  }`);

app = replaceFunction(app, "revalidateGpsAfterReturn", `  function revalidateGpsAfterReturn() {
    if (!data.started || data.stopped || gpsPermissionDenied || gpsPermissionState === "denied") {
      renderSimpleHeader();
      return;
    }
    gpsUserActivatedThisPage = true;
    if (!freshFieldPosition() && (watchId === null || gpsWatcherIsStale())) {
      try {
        gpsRecoveryReason = "GPS RETURN RECOVERY — starting a fresh Safari location watcher.";
        startGpsWatcher();
        updateVisibleGpsControl();
      } catch (error) {
        lastGpsErrorCode = 0;
        lastGpsErrorMessage = error && error.message ? error.message : "reconnect failed";
        lastGpsErrorAt = new Date().toISOString();
        gpsRecoveryReason = \`GPS RETURN RECOVERY FAILED: \${lastGpsErrorMessage}. Tap RECONNECT GPS.\`;
        updateVisibleGpsControl();
      }
    } else if (watchId !== null && !wakeLock) keepAwake();
    renderSimpleHeader();
  }`);

app = replaceFunction(app, "gpsRecoveryWatchdog", `  function gpsRecoveryWatchdog() {
    if (!data.started || data.stopped || gpsPermissionDenied || gpsPermissionState === "denied" || gpsManualRequestInFlight) {
      updateVisibleGpsControl();
      return;
    }
    if (freshFieldPosition()) {
      gpsRecoveryReason = "";
      updateVisibleGpsControl();
      return;
    }
    if (watchId === null || gpsWatcherIsStale()) {
      gpsRecoveryReason = watchId === null
        ? "GPS DISCONNECTED — automatic recovery started. Tap RECONNECT GPS if it does not recover."
        : "GPS STALLED — automatic recovery started. Tap RECONNECT GPS if it does not recover.";
      try {
        startGpsWatcher();
      } catch (error) {
        gpsRecoveryReason = \`GPS AUTOMATIC RECOVERY FAILED: \${error && error.message ? error.message : "unknown error"}. Tap RECONNECT GPS.\`;
      }
    }
    updateVisibleGpsControl();
  }`);

app = replaceOnce(app,
  `    if (data.started && !data.stopped && watchId === null && !SIMPLE_AUTOMATION_MODE) {\n      gpsUserActivatedThisPage = false;\n      clearActiveGpsWatch();\n      updateControls();\n      renderSimpleHeader();\n    }`,
  `    if (data.started && !data.stopped && !SIMPLE_AUTOMATION_MODE) {\n      gpsUserActivatedThisPage = true;\n      refreshGpsPermissionState().catch(() => {});\n      try {\n        gpsRecoveryReason = "GPS STARTING — restoring field location tracking.";\n        startGpsWatcher();\n      } catch (error) {\n        lastGpsErrorCode = 0;\n        lastGpsErrorMessage = error && error.message ? error.message : "watcher start failed";\n        lastGpsErrorAt = new Date().toISOString();\n        gpsRecoveryReason = \`GPS STARTUP RECOVERY FAILED: \${lastGpsErrorMessage}. Tap RECONNECT GPS.\`;\n      }\n      updateControls();\n      renderSimpleHeader();\n    }`,
  "automatic GPS restore after safe startup"
);

app = replaceOnce(app,
  "        compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : lastPosition.heading_deg,",
  "        compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : (lastPosition ? lastPosition.heading_deg : null),",
  "voice note pending-GPS null safety"
);

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v5", "property-inspector-home-test-313-direct-ed42-v6", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Hardened Safari GPS watcher and built ${TO}`);
