"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const recovery = fs.readFileSync(path.join(root, "field-simple-test", "safari-geolocation-recovery.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "field-simple-test", "sw.js"), "utf8");
const restore = fs.readFileSync(path.join(root, "restore-working-field-app", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "field-simple-test", "app.js"), "utf8");

new Function(recovery);
new Function(worker);

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

assert.match(worker, /3\.13\.0-home-test\.5\.3-safari-recovery-2/);
assert.match(worker, /safari-geolocation-recovery\.js/);
assert.match(worker, /recoveredAppResponse/);
assert.match(worker, /patchFieldAppSource/);
assert.match(worker, /SECTION SAVED — Safari GPS is reconnecting/);
assert.match(worker, /!observationId && lastPosition/);
assert.match(worker, /lastPosition \? lastPosition\.lat : null/);
assert.match(worker, /WAITING FOR FIRST GPS POINT/);
assert.match(worker, /field-simple-test\/app\.js/);
assert.match(worker, /ignoreSearch:\s*true/);
assert.match(worker, /skipWaiting/);
assert.match(worker, /clients\.claim/);

assert.match(restore, /3\.13\.0-home-test\.5\.3-safari-recovery-2/);
assert.match(restore, /serviceWorker\.register\("\/field-simple-test\/sw\.js/);
assert.match(restore, /await waitForActivation\(registration\)/);
assert.ok(restore.indexOf("await waitForActivation(registration)") < restore.indexOf("location.replace(target)"), "restore must activate recovery before opening field app");
assert.doesNotMatch(restore, /localStorage\.clear|indexedDB\.deleteDatabase/);

function functionBody(name) {
  const signature = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(");
  const match = signature.exec(app);
  assert.ok(match, `${name} must exist`);
  const open = app.indexOf("{", match.index);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let cursor = open; cursor < app.length; cursor += 1) {
    const char = app[cursor];
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
      if (depth === 0) return app.slice(match.index, cursor + 1);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

for (const name of ["finishInspection", "exportBackupNow"]) {
  const body = functionBody(name);
  assert.doesNotMatch(body, /stopTracking\s*\(/, `${name} must never stop field GPS`);
  assert.doesNotMatch(body, /data\.stopped\s*=/, `${name} must never end the inspection`);
}

assert.match(app, /const stateKey = "propertyInspectorHomeTest313V1"/);
assert.match(app, /const photoDbName = "property-inspector-home-test-313-evidence"/);

console.log("safari-field-survival.test.js: PASS");
