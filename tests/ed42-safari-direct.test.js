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

assert.match(app, /const APP_VERSION = "3\.13\.0-home-test\.5\.1-safari-direct-4"/);
assert.match(app, /DIRECT_BASELINE_COMMIT = "ed42ca2df4f6ca01fc05f52a652c3821a2007da7"/);
assert.match(app, /DIRECT_APP_FILE_NO_RUNTIME_SOURCE_PATCH/);
assert.match(app, /const stateKey = "propertyInspectorHomeTest313V1"/);
assert.match(app, /const photoDbName = "property-inspector-home-test-313-evidence"/);
assert.doesNotMatch(app, /propertyInspectorFixedTest313V1|property-inspector-fixed-test-313-evidence/);

assert.match(app, /gpsWatchGeneration/);
assert.match(app, /generation !== gpsWatchGeneration/);
assert.match(app, /clearActiveGpsWatch\(\)/);
assert.match(app, /GPS_STALE_MS = 90000/);
assert.match(app, /gpsUserActivatedThisPage/);
assert.match(app, /gpsManualRequestInFlight/);
assert.match(app, /gpsRecoveryReason/);
assert.match(app, /simpleGpsControlWrap/);
assert.match(app, /simpleGpsControl/);
assert.match(app, /RECONNECT GPS/);
assert.match(app, /GPS POSITION UNAVAILABLE/);
assert.match(app, /GPS TIMEOUT/);
assert.match(app, /GPS PERMISSION OFF/);
assert.match(app, /GPS REQUEST SENT — waiting for Safari location/);
assert.doesNotMatch(app, /GPS RECONNECTING — LOCATION PENDING/);
assert.match(app, /button\.id === "simpleGpsControl"/);
assert.match(app, /function gpsRecoveryWatchdog\(\)/);
assert.match(app, /setInterval\(gpsRecoveryWatchdog, 15000\)/);
assert.match(app, /GPS STALLED — automatic recovery started/);

assert.match(app, /function requestGpsFromVisibleControl\(\)/);
assert.doesNotMatch(app, /async function requestGpsFromVisibleControl/);
assert.match(app, /navigator\.geolocation\.getCurrentPosition\(position =>/);
assert.match(app, /Keep the Safari geolocation request directly inside the user's tap handler/);

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
  let depth = 0, quote = null, escaped = false;
  for (let i = open; i < app.length; i += 1) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
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
const initializeBody = extractFunction("initialize");
assert.doesNotMatch(initializeBody, /await startTracking\(\)/, "page load must not request GPS automatically");
const returnBody = extractFunction("revalidateGpsAfterReturn");
assert.match(returnBody, /!gpsUserActivatedThisPage/, "background recovery only starts after user activated GPS on this page");

assert.match(index, /app\.js\?v=3\.13\.0-home-test\.5\.1-safari-direct-4/);
assert.match(sw, /property-inspector-home-test-313-direct-ed42-v4/);
assert.match(sw, /ignoreSearch:\s*true/);
assert.doesNotMatch(sw, /patchFieldAppSource|recoveredAppResponse|safari-geolocation-recovery/);
assert.doesNotMatch(sw, /startsWith\("property-inspector-home-test-313-"\)/);
assert.match(idb, /database\.onversionchange/);
assert.match(idb, /databasePromise = null/);
assert.match(idb, /isRetryableConnectionError/);
assert.match(frontage, /location_status: hasPosition \? "CAPTURED_WITH_RECORD" : "PENDING_GPS"/);
assert.match(sections, /PLANNED_LOCATION_PENDING/);

console.log("PASS: ed42 Safari-direct candidate auto-recovers dead GPS, exposes a direct RECONNECT GPS fallback, preserves storage, and keeps pending-location recovery.");
