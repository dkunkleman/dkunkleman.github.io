"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const recovery = fs.readFileSync(path.join(root, "field-simple-test", "safari-geolocation-recovery.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "field-simple-test", "sw.js"), "utf8");
const restore = fs.readFileSync(path.join(root, "restore-working-field-app", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "field-simple-test", "app.js"), "utf8");
const idbRecovery = fs.readFileSync(path.join(root, "field-simple-test", "idb-recovery.js"), "utf8");

new Function(recovery);
new Function(worker);
new Function(idbRecovery);

assert.match(recovery, /nativeGetCurrentPosition/);
assert.match(recovery, /nativeWatchPosition/);
assert.match(recovery, /nativeClearWatch/);
assert.match(recovery, /cancelOtherWatches\(null\)/, "starting a watcher must cancel every older watcher");
assert.match(recovery, /generation:\s*0/);
assert.match(recovery, /record\.generation \+= 1/);
assert.match(recovery, /record\.generation !== generation/);
assert.match(recovery, /permissionDenied:\s*false/);
assert.match(recovery, /record\.permissionDenied = true/);
assert.doesNotMatch(recovery, /scheduleRestart/, "the wrapper must not run a second retry loop");

{
  let nextNativeId = 1;
  const nativeCallbacks = new Map();
  const activeNative = new Set();
  const clearCalls = [];
  const documentHandlers = {};
  const windowHandlers = {};
  const nativeGeo = {
    getCurrentPosition(success) {
      success({ timestamp: Date.now(), coords: { latitude: 30.49, longitude: -87.09, accuracy: 5 } });
    },
    watchPosition(success, failure) {
      const id = nextNativeId++;
      nativeCallbacks.set(id, { success, failure });
      activeNative.add(id);
      return id;
    },
    clearWatch(id) {
      clearCalls.push(id);
      activeNative.delete(id);
    }
  };
  const recoveryContext = {
    navigator: { geolocation: nativeGeo },
    document: { visibilityState: "visible", addEventListener: (name, callback) => { documentHandlers[name] = callback; } },
    window: { addEventListener: (name, callback) => { windowHandlers[name] = callback; } },
    Object,
    Number,
    Boolean,
    Date,
    Math,
    Set,
    Map,
    Array,
    String
  };
  vm.createContext(recoveryContext);
  vm.runInContext(recovery, recoveryContext);

  let firstDelivered = 0;
  let secondDelivered = 0;
  let secondErrors = 0;
  nativeGeo.watchPosition(() => { firstDelivered += 1; }, () => {});
  assert.equal(activeNative.size, 1, "first virtual watcher owns one native watcher");
  const firstNativeId = Math.max(...activeNative);

  nativeGeo.watchPosition(() => { secondDelivered += 1; }, () => { secondErrors += 1; });
  assert.equal(activeNative.size, 1, "starting a replacement leaves exactly one native watcher");
  const secondNativeId = Math.max(...activeNative);
  assert.notEqual(secondNativeId, firstNativeId);
  assert(clearCalls.includes(firstNativeId), "replacement clears the old native watcher");

  nativeCallbacks.get(firstNativeId).success({ timestamp: Date.now(), coords: { latitude: 1, longitude: 1, accuracy: 5 } });
  assert.equal(firstDelivered, 0, "late callback from old watcher generation is ignored");

  nativeCallbacks.get(secondNativeId).success({ timestamp: Date.now(), coords: { latitude: 2, longitude: 2, accuracy: 5 } });
  assert.equal(secondDelivered, 1, "current watcher callback is delivered");

  nativeCallbacks.get(secondNativeId).failure({ code: 1, message: "denied" });
  assert.equal(secondErrors, 1, "permission denial is reported once");
  assert.equal(activeNative.size, 0, "permission denial clears the active native watcher");
  const nativeCountBeforeFocus = nextNativeId;
  windowHandlers.focus();
  assert.equal(nextNativeId, nativeCountBeforeFocus, "permission denial does not automatically retry on focus");
}

const workerContext = {
  console,
  URL,
  Request,
  Response,
  Headers,
  setTimeout,
  clearTimeout,
  fetch: async () => { throw new Error("network disabled in regression test"); },
  caches: {
    open: async () => ({ put: async () => {}, addAll: async () => {}, add: async () => {} }),
    match: async () => null,
    keys: async () => []
  },
  self: {
    location: { href: "https://www.livelikecharliechallenge.org/field-simple-test/sw.js", origin: "https://www.livelikecharliechallenge.org" },
    addEventListener: () => {},
    skipWaiting: async () => {},
    clients: { claim: async () => {} }
  }
};
vm.createContext(workerContext);
vm.runInContext(worker, workerContext);
assert.equal(typeof workerContext.patchFieldAppSource, "function", "worker patch function must be executable");
const patchedApp = workerContext.patchFieldAppSource(app);
new Function(patchedApp);

assert.match(patchedApp, /const APP_VERSION = "3\.13\.0-home-test\.5\.3-safari-recovery-5"/);
assert.match(patchedApp, /SECTION SAVED — Safari GPS is reconnecting/);
assert.match(patchedApp, /SECTION_FIRST_GPS_RECOVERED/);
assert.match(patchedApp, /original_section_tap_at/);
assert.match(patchedApp, /gps_start_delay_ms/);
assert.match(patchedApp, /point\.section_id = sectionAtFix\.section_id/);
assert.match(patchedApp, /point\.section_capture_status = "ACTIVE_EDGE_CAPTURE"/);
assert.match(patchedApp, /const canonicalPointForWrite = Object\.assign\(\{\}, point\)/);
assert.match(patchedApp, /gpsPointPut\(data\.inspection_id, canonicalPointForWrite\)/);
assert.match(patchedApp, /GPS INTERRUPTED — RECONNECTING AUTOMATICALLY/);
assert.match(patchedApp, /Settings > Privacy & Security > Location Services > Safari Websites/);
assert.match(patchedApp, /startTracking\(\{ skipReconcile: true \}\)/);
assert.match(patchedApp, /if \(!trackingOptions\.skipReconcile\) await reconcileGpsPoints\(\)/);
assert.match(patchedApp, /lastPosition \? lastPosition\.lat : null/);
assert.match(patchedApp, /WAITING FOR FIRST GPS POINT/);
assert.doesNotMatch(patchedApp, /SECTION NOT STARTED — move into open sky/);
assert.doesNotMatch(patchedApp, /GPS_RECOVERY_SNAPSHOT_INTERVAL_MS/, "release 5 keeps the proven save-every-fix recovery snapshot rhythm");

const onPositionStart = patchedApp.indexOf("  function onPosition(position) {");
const onPositionEnd = patchedApp.indexOf("  function onGpsError(error) {", onPositionStart);
assert(onPositionStart >= 0 && onPositionEnd > onPositionStart);
const onPositionSource = patchedApp.slice(onPositionStart, onPositionEnd);
assert.match(onPositionSource, /saveState\(\)/, "every GPS fix still makes the bounded local recovery snapshot, as on August 3");
assert(onPositionSource.indexOf("point.section_id = sectionAtFix.section_id") < onPositionSource.indexOf("const canonicalPointForWrite = Object.assign({}, point)"), "section id is captured before the immutable queued GPS copy");

const reconcileStart = patchedApp.indexOf("  async function reconcileGpsPoints() {");
const reconcileEnd = patchedApp.indexOf("  function", reconcileStart + 10);
const reconcileSource = patchedApp.slice(reconcileStart, reconcileEnd > reconcileStart ? reconcileEnd : reconcileStart + 8000);
assert.doesNotMatch(reconcileSource, /section_id\s*=/, "existing GPS reconciliation never assigns or migrates section_id");

assert.match(patchedApp, /function exactFieldEvidenceCounts\(\)/);
assert.match(patchedApp, /function verifyExportCounts\(/);
assert.match(patchedApp, /EXPORT STARTING —/);
assert.match(patchedApp, /EXPORT VERIFIED —/);
assert.match(patchedApp, /INSPECTION STILL ACTIVE:/);
assert.match(patchedApp, /if \(inspectionWasActive && data\.stopped\) throw new Error\("Export ended the active inspection\."\)/);
assert.match(patchedApp, /await gpsWriteQueue;/, "GPS write queue must be flushed before packaging");
assert.match(patchedApp, /Offline ready · \$\{APP_VERSION\}/);
assert.match(patchedApp, /extra snapshot only; captured evidence is already committed/);

assert.match(worker, /3\.13\.0-home-test\.5\.3-safari-recovery-5/);
assert.match(worker, /ignoreSearch:\s*true/);
assert.match(worker, /window\.__FIELD_CACHE_NAME/);
assert.match(worker, /skipWaiting/);
assert.match(worker, /clients\.claim/);

assert.match(restore, /3\.13\.0-home-test\.5\.3-safari-recovery-5/);
assert.match(restore, /serviceWorker\.register\("\/field-simple-test\/sw\.js/);
assert.match(restore, /await waitForActivation\(registration\)/);
assert.ok(restore.indexOf("await waitForActivation(registration)") < restore.indexOf("location.replace(target)"), "restore must activate recovery before opening field app");
assert.doesNotMatch(restore, /localStorage\.clear|indexedDB\.deleteDatabase/);

assert.doesNotMatch(idbRecovery, /geolocation|GpsFallback|GPS fallback/, "IndexedDB recovery must not also wrap GPS");
assert.match(idbRecovery, /database\.onversionchange = \(\) =>/);
assert.match(idbRecovery, /disconnect\(database, generation, false\)/);
assert.match(idbRecovery, /databasePromise = null/);
assert.match(idbRecovery, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
assert.match(idbRecovery, /isRetryableConnectionError\(error\)/);
assert.match(idbRecovery, /invalidate\(database\)/);

for (const name of ["finishInspection", "exportBackupNow"]) {
  const start = app.indexOf(`  async function ${name}`);
  const end = app.indexOf("\n  function ", start + 5) > start ? app.indexOf("\n  function ", start + 5) : app.indexOf("\n  async function ", start + 5);
  const body = app.slice(start, end > start ? end : start + 6000);
  assert.doesNotMatch(body, /stopTracking\s*\(/, `${name} must never stop field GPS`);
  assert.doesNotMatch(body, /data\.stopped\s*=/, `${name} must never end the inspection`);
}

assert.match(app, /const stateKey = "propertyInspectorHomeTest313V1"/);
assert.match(app, /const photoDbName = "property-inspector-home-test-313-evidence"/);

console.log("safari-field-survival.test.js: PASS");
