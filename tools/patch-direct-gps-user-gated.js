#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-6";
const TO = "3.13.0-home-test.5.1-safari-direct-7";

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

app = replaceFunction(app, "requestGpsFromVisibleControl", `  function requestGpsFromVisibleControl() {
    gpsUserActivatedThisPage = true;
    gpsManualRequestInFlight = true;
    gpsRecoveryReason = "";
    gpsPermissionDenied = false;
    lastGpsErrorCode = null;
    lastGpsErrorMessage = "";
    lastGpsErrorAt = null;
    clearManualGpsFallback();

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

    // The first browser API call from this tap is the same watchPosition API used
    // for the continuous field track. No await, promise, permission query, or
    // storage operation is allowed before it.
    try {
      startGpsWatcher();
      const generation = gpsWatchGeneration;
      data.lifecycle_events.push({ type: "gps_reconnect_tapped", time: now, source: "visible_gps_button", generation });
      try { saveState(); } catch (error) { /* canonical evidence stores remain authoritative */ }
      armManualGpsFallback(generation);
      refreshGpsPermissionState().catch(() => {});
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

app = replaceFunction(app, "ensureFieldGpsReady", `  async function ensureFieldGpsReady() {
    const fresh = freshFieldPosition();
    if (fresh) return fresh;
    if (!gpsUserActivatedThisPage) {
      simpleSetStatus("LOCATION PENDING — tap RECONNECT GPS when you want Safari to restart location tracking.", "warning");
      updateVisibleGpsControl();
      return null;
    }
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
    if (!gpsUserActivatedThisPage || !data.started || data.stopped || gpsPermissionDenied || gpsPermissionState === "denied") {
      renderSimpleHeader();
      return;
    }
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
    if (!gpsUserActivatedThisPage || !data.started || data.stopped || gpsPermissionDenied || gpsPermissionState === "denied" || gpsManualRequestInFlight) {
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
  `    if (data.started && !data.stopped && !SIMPLE_AUTOMATION_MODE) {\n      gpsUserActivatedThisPage = true;\n      refreshGpsPermissionState().catch(() => {});\n      try {\n        gpsRecoveryReason = "GPS STARTING — restoring field location tracking.";\n        startGpsWatcher();\n      } catch (error) {\n        lastGpsErrorCode = 0;\n        lastGpsErrorMessage = error && error.message ? error.message : "watcher start failed";\n        lastGpsErrorAt = new Date().toISOString();\n        gpsRecoveryReason = \`GPS STARTUP RECOVERY FAILED: \${lastGpsErrorMessage}. Tap RECONNECT GPS.\`;\n      }\n      updateControls();\n      renderSimpleHeader();\n    }`,
  `    if (data.started && !data.stopped && !SIMPLE_AUTOMATION_MODE) {\n      // A page refresh must never make David the debugger or silently start a\n      // Safari geolocation request. The visible RECONNECT GPS button is the\n      // explicit user gesture. Once he taps it, background/return recovery is automatic.\n      gpsUserActivatedThisPage = false;\n      gpsRecoveryReason = "";\n      gpsManualRequestInFlight = false;\n      clearManualGpsFallback();\n      clearActiveGpsWatch();\n      refreshGpsPermissionState().catch(() => {});\n      updateControls();\n      renderSimpleHeader();\n    }`,
  "do not auto-start GPS after page refresh"
);

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v6", "property-inspector-home-test-313-direct-ed42-v7", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`User-gated Safari GPS recovery built ${TO}`);
