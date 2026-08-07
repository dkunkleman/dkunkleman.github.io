"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "field-simple-test", "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "field-simple-test", "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "field-simple-test", "sw.js"), "utf8");
const idb = fs.readFileSync(path.join(root, "field-simple-test", "idb-recovery.js"), "utf8");
const frontage = fs.readFileSync(path.join(root, "field-simple-test", "frontage-workflow.js"), "utf8");
const sections = fs.readFileSync(path.join(root, "field-simple-test", "section-mapping.js"), "utf8");

new Function(app);
new Function(sw);
new Function(idb);
new Function(frontage);
new Function(sections);

assert.match(app, /const APP_VERSION = "3\.13\.0-home-test\.5\.1-safari-direct-6"/);
assert.match(app, /DIRECT_BASELINE_COMMIT = "ed42ca2df4f6ca01fc05f52a652c3821a2007da7"/);
assert.match(app, /DIRECT_APP_FILE_NO_RUNTIME_SOURCE_PATCH/);
assert.match(app, /const stateKey = "propertyInspectorHomeTest313V1"/);
assert.match(app, /const photoDbName = "property-inspector-home-test-313-evidence"/);
assert.doesNotMatch(app, /propertyInspectorFixedTest313V1|property-inspector-fixed-test-313-evidence/);

assert.match(app, /gpsWatchGeneration/);
assert.match(app, /generation !== gpsWatchGeneration/);
assert.match(app, /GPS_STALE_MS = 90000/);
assert.match(app, /GPS_FIRST_FIX_GRACE_MS = 30000/);
assert.match(app, /GPS_MANUAL_HARD_TIMEOUT_MS = 20000/);
assert.match(app, /gpsWatchStartedAt/);
assert.match(app, /gpsManualFallbackTimer/);
assert.match(app, /gpsPermissionState/);
assert.match(app, /navigator\.permissions\.query\(\{ name: "geolocation" \}\)/);
assert.match(app, /gps_manual_request_hard_timeout/);
assert.match(app, /simpleGpsControlWrap/);
assert.match(app, /RECONNECT GPS/);
assert.match(app, /GPS REQUEST SENT — waiting for Safari location/);
assert.doesNotMatch(app, /GPS RECONNECTING — LOCATION PENDING/);
assert.match(app, /button\.id === "simpleGpsControl"/);
assert.match(app, /function gpsRecoveryWatchdog\(\)/);
assert.match(app, /setInterval\(gpsRecoveryWatchdog, 15000\)/);

const dataInit = app.indexOf("let data = emptyInspection();");
const gpsInstall = app.indexOf("installVisibleGpsControl();");
assert.ok(dataInit >= 0, "inspection data initialization exists");
assert.ok(gpsInstall > dataInit, "GPS control must install only after inspection data exists");
assert.equal(app.indexOf("installVisibleGpsControl();", gpsInstall + 1), -1, "GPS control installs exactly once");

assert.match(app, /PENDING_GPS/);
assert.match(app, /FEATURE SAVED - \$\{featureId\} - LOCATION PENDING/);
assert.match(app, /section\.location_status = tapPosition \? "CAPTURED_WITH_RECORD" : "PENDING_GPS"/);
assert.match(app, /SECTION_FIRST_GPS_RECOVERED/);
assert.doesNotMatch(app, /WAIT HERE - GPS is not ready\. Nothing was recorded yet\./);
assert.match(app, /const sectionAtFix = sectionMappingTools \? sectionMappingTools\.activeSection\(data\) : null/);
assert.match(app, /point\.section_id = sectionAtFix\.section_id/);
assert.match(app, /const canonicalPointForWrite = Object\.assign\(\{\}, point\)/);
assert.match(app, /pending_browser_geolocation|location_source: position \?/);
assert.doesNotMatch(app, /No GPS position was available for the photograph/);
assert.match(app, /inspection_copy_created/);
assert.match(app, /await gpsWriteQueue/);
assert.match(app, /EXPORT VERIFIED/);
assert.match(app, /INSPECTION STILL ACTIVE/);

function extractFunction(name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = re.exec(app);
  assert.ok(match, `${name} exists`);
  const open = app.indexOf("{", match.index);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < app.length; i += 1) {
    const ch = app[i], next = app[i + 1];
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
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(match.index, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

for (const name of ["finishInspection", "exportBackupNow"]) {
  const body = extractFunction(name);
  assert.doesNotMatch(body, /stopTracking\s*\(/, `${name} cannot stop GPS`);
  assert.doesNotMatch(body, /data\.stopped\s*=/, `${name} cannot end inspection`);
}

const manualGps = extractFunction("requestGpsFromVisibleControl");
assert.doesNotMatch(manualGps, /\bawait\b/, "RECONNECT GPS must not await before starting location");
assert.doesNotMatch(manualGps, /getCurrentPosition\s*\(/, "RECONNECT GPS must not use one-shot geolocation as its gate");
assert.match(manualGps, /startGpsWatcher\(\)/, "RECONNECT GPS must start the continuous watcher directly");
assert.match(manualGps, /armManualGpsFallback\(generation\)/, "RECONNECT GPS must have an independent hard timeout");

const watcher = extractFunction("startGpsWatcher");
assert.match(watcher, /watchPosition\s*\(/, "field GPS must use continuous watchPosition");
assert.match(watcher, /gpsWatchStartedAt = Date\.now\(\)/, "watcher records its own start time");
assert.match(watcher, /generation !== gpsWatchGeneration/, "stale watcher callbacks are ignored");

const stale = extractFunction("gpsWatcherIsStale");
assert.match(stale, /GPS_FIRST_FIX_GRACE_MS/, "new watcher receives a first-fix grace period");
assert.match(stale, /gpsWatchStartedAt/, "stale decision is based on watcher start when no fix exists");

const scheduled = extractFunction("scheduleGpsRestart");
assert.match(scheduled, /startGpsWatcher\(\)/, "automatic retry starts GPS directly");
assert.doesNotMatch(scheduled, /startTracking\s*\(/, "automatic retry must not run heavyweight inspection startup");

const fieldReady = extractFunction("ensureFieldGpsReady");
assert.match(fieldReady, /startGpsWatcher\(\)/, "field actions may trigger nonblocking watcher recovery");
assert.doesNotMatch(fieldReady, /getCurrentPosition\s*\(/, "field actions must not block on one-shot geolocation");
assert.doesNotMatch(fieldReady, /await\s+startTracking\s*\(/, "field actions must not await heavyweight inspection startup");

const returned = extractFunction("revalidateGpsAfterReturn");
assert.match(returned, /startGpsWatcher\(\)/, "return from background directly restores watcher");
assert.doesNotMatch(returned, /startTracking\s*\(/, "return recovery must not run heavyweight inspection startup");

const watchdog = extractFunction("gpsRecoveryWatchdog");
assert.match(watchdog, /watchId === null \|\| gpsWatcherIsStale\(\)/, "watchdog handles disconnected or stale watcher");
assert.match(watchdog, /startGpsWatcher\(\)/, "watchdog starts a fresh watcher directly");
assert.doesNotMatch(watchdog, /startTracking\s*\(/, "watchdog must not run heavyweight inspection startup");

const hardTimeout = extractFunction("armManualGpsFallback");
assert.match(hardTimeout, /GPS_MANUAL_HARD_TIMEOUT_MS/, "manual reconnect cannot hang indefinitely");
assert.match(hardTimeout, /gpsManualRequestInFlight = false/, "hard timeout releases the reconnect UI");

const initializeBody = extractFunction("initialize");
assert.match(initializeBody, /startGpsWatcher\(\)/, "active inspection restores continuous GPS after safe startup");
assert.doesNotMatch(initializeBody, /await\s+startTracking\s*\(/, "page startup must not await heavyweight GPS startup");

assert.match(index, /app\.js\?v=3\.13\.0-home-test\.5\.1-safari-direct-6/);
assert.match(sw, /property-inspector-home-test-313-direct-ed42-v6/);
assert.match(sw, /ignoreSearch:\s*true/);
assert.doesNotMatch(sw, /patchFieldAppSource|recoveredAppResponse|safari-geolocation-recovery/);
assert.doesNotMatch(sw, /startsWith\("property-inspector-home-test-313-"\)/);
assert.match(idb, /database\.onversionchange/);
assert.match(idb, /databasePromise = null/);
assert.match(idb, /isRetryableConnectionError/);
assert.match(frontage, /location_status: hasPosition \? "CAPTURED_WITH_RECORD" : "PENDING_GPS"/);
assert.match(sections, /PLANNED_LOCATION_PENDING/);

console.log("PASS: ed42 Safari-direct v6 starts cleanly, uses a continuous watcher with first-fix grace, hard-times out a silent Safari reconnect, auto-recovers without heavyweight startup, preserves storage, and keeps pending-location recovery.");
