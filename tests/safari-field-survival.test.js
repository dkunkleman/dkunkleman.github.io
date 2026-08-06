"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const recovery = fs.readFileSync(path.join(root, "field-simple-test", "safari-geolocation-recovery.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "field-simple-test", "sw.js"), "utf8");
const restore = fs.readFileSync(path.join(root, "restore-working-field-app", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "field-simple-test", "app.js"), "utf8");
const idbRecovery = fs.readFileSync(path.join(root, "field-simple-test", "idb-recovery.js"), "utf8");

new Function(recovery);
new Function(worker);
new Function(idbRecovery);

function extractFunctionSource(text, name) {
  const signature = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(");
  const match = signature.exec(text);
  assert.ok(match, `${name} must exist`);
  const open = text.indexOf("{", match.index);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let cursor = open; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(match.index, cursor + 1);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

assert.match(recovery, /nativeGetCurrentPosition/);
assert.match(recovery, /nativeWatchPosition/);
assert.match(recovery, /nativeClearWatch/);
assert.match(recovery, /enableHighAccuracy:\s*false/);
assert.match(recovery, /maximumAge:[\s\S]*30000/);
assert.match(recovery, /virtualWatches/);
assert.match(recovery, /scheduleRestart/);
assert.match(recovery, /visibilitychange/);
assert.match(recovery, /pageshow/);
assert.match(recovery, /focus/);
assert.match(recovery, /Date\.now\(\)[\s\S]*120000/);

const releaseMatch = worker.match(/const RELEASE = "([^"]+)"/);
assert.ok(releaseMatch, "worker release must be declared");
const release = releaseMatch[1];
assert.equal(release, "3.13.0-home-test.5.3-safari-recovery-3");
const patchSource = extractFunctionSource(worker, "patchFieldAppSource");
const patchFieldAppSource = new Function("RELEASE", `return (${patchSource});`)(release);
const patchedApp = patchFieldAppSource(app);
new Function(patchedApp);

assert.match(patchedApp, /const APP_VERSION = "3\.13\.0-home-test\.5\.3-safari-recovery-3"/);
assert.match(patchedApp, /SECTION SAVED — Safari GPS is reconnecting/);
assert.match(patchedApp, /SECTION_FIRST_GPS_RECOVERED/);
assert.match(patchedApp, /original_section_tap_at/);
assert.match(patchedApp, /gps_start_delay_ms/);
assert.match(patchedApp, /GPS INTERRUPTED — RECONNECTING AUTOMATICALLY/);
assert.match(patchedApp, /Settings > Privacy & Security > Location Services > Safari Websites/);
assert.match(patchedApp, /GPS_RECOVERY_SNAPSHOT_INTERVAL_MS = 10000/);
assert.match(patchedApp, /startTracking\(\{ skipReconcile: true \}\)/);
assert.match(patchedApp, /if \(!trackingOptions\.skipReconcile\) await reconcileGpsPoints\(\)/);
assert.match(patchedApp, /lastPosition \? lastPosition\.lat : null/);
assert.match(patchedApp, /WAITING FOR FIRST GPS POINT/);
assert.doesNotMatch(patchedApp, /SECTION NOT STARTED — move into open sky/);
assert.match(patchedApp, /Offline ready · \$\{APP_VERSION\}/);

assert.match(worker, /safari-geolocation-recovery\.js/);
assert.match(worker, /recoveredAppResponse/);
assert.match(worker, /window\.__FIELD_CACHE_NAME/);
assert.match(worker, /field-simple-test\/app\.js/);
assert.match(worker, /ignoreSearch:\s*true/);
assert.match(worker, /skipWaiting/);
assert.match(worker, /clients\.claim/);

assert.match(restore, /3\.13\.0-home-test\.5\.3-safari-recovery-3/);
assert.match(restore, /serviceWorker\.register\("\/field-simple-test\/sw\.js/);
assert.match(restore, /await waitForActivation\(registration\)/);
assert.ok(restore.indexOf("await waitForActivation(registration)") < restore.indexOf("location.replace(target)"), "restore must activate recovery before opening field app");
assert.doesNotMatch(restore, /localStorage\.clear|indexedDB\.deleteDatabase/);

assert.match(idbRecovery, /database\.onversionchange = \(\) =>/);
assert.match(idbRecovery, /disconnect\(database, generation, false\)/);
assert.match(idbRecovery, /databasePromise = null/);
assert.match(idbRecovery, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
assert.match(idbRecovery, /isRetryableConnectionError\(error\)/);
assert.match(idbRecovery, /invalidate\(database\)/);

function functionBody(name) {
  return extractFunctionSource(app, name);
}

for (const name of ["finishInspection", "exportBackupNow"]) {
  const body = functionBody(name);
  assert.doesNotMatch(body, /stopTracking\s*\(/, `${name} must never stop field GPS`);
  assert.doesNotMatch(body, /data\.stopped\s*=/, `${name} must never end the inspection`);
}

assert.match(app, /const stateKey = "propertyInspectorHomeTest313V1"/);
assert.match(app, /const photoDbName = "property-inspector-home-test-313-evidence"/);

console.log("safari-field-survival.test.js: PASS");
