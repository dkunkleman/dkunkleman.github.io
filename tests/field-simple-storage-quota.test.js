"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.resolve(__dirname, "../field-simple-test/app.js"), "utf8");
new Function(app);

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
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
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

assert.match(app, /const APP_VERSION = "3\.13\.0-home-test\.5\.1-safari-direct-8"/);
assert.match(app, /const stateStoreName = "inspectionState"/);
assert.match(app, /indexedDB\.open\(photoDbName, 4\)/);
assert.match(app, /createObjectStore\(stateStoreName, \{ keyPath: "key" \}\)/);
assert.match(app, /local_recovery_compact: true/);
assert.match(app, /canonical_state_store: stateStoreName/);
assert.match(app, /state_storage: "IndexedDB canonical inspectionState"/);
assert.match(app, /saveState\(\{ gpsOnly: true \}\)/);
assert.match(app, /await restoreCanonicalInspectionState\(\)/);
assert.match(app, /await stateWriteQueue/);
assert.match(app, /Durable inspection state is not current/);
assert.match(app, /transaction\.objectStore\(stateStoreName\)\.clear\(\)/);

const saveStateBody = extractFunction("saveState");
assert.doesNotMatch(saveStateBody, /throw\s+error/, "localStorage quota must never throw out of saveState");
assert.match(saveStateBody, /localStorage\.setItem/);
assert.match(saveStateBody, /LOCAL RECOVERY POINTER IS FULL/);

const restoreBody = extractFunction("restoreCanonicalInspectionState");
assert.match(restoreBody, /loadedCompactRecovery/);
assert.match(restoreBody, /canonical inspectionState record is missing/);

const initializeBody = extractFunction("initialize");
const restoreIndex = initializeBody.indexOf("await restoreCanonicalInspectionState();");
const gpsReconcileIndex = initializeBody.indexOf("await reconcileGpsPoints();");
assert.ok(restoreIndex >= 0 && gpsReconcileIndex > restoreIndex, "canonical state restores before GPS reconciliation");

const packageBody = extractFunction("buildPackageWithRecovery");
assert.match(packageBody, /await stateWriteQueue/);
assert.match(packageBody, /stateStorageFailed/);

const compactFn = extractFunction("compactLocalRecoverySnapshot");
const saveFn = extractFunction("saveState");
const harness = new Function(`
  let data = {
    schema_name: "property-intelligence-inspection",
    schema_version: "1.2",
    build_mode: "field-simple-test-313",
    property_id: "parcel:test",
    inspection_id: "inspection-test",
    started: "2026-08-07T00:00:00.000Z",
    stopped: null,
    points: Array.from({length: 5000}, (_, i) => ({sequence:i+1, lat:30+i/1e6, lon:-87-i/1e6, time:String(i)})),
    markers: Array.from({length: 4000}, (_, i) => ({id:"m"+i, note:"x".repeat(1000)})),
    photos: Array.from({length: 500}, (_, i) => ({id:"p"+i, note:"y".repeat(1000)})),
    voice_notes: Array.from({length: 100}, (_, i) => ({id:"v"+i, note:"z".repeat(1000)})),
    lifecycle_events: Array.from({length: 2000}, (_, i) => ({type:"event", i})),
    simple_sessions: Array.from({length: 200}, (_, i) => ({simple_session_id:"s"+i})),
    simple_counters: {SECTION: 12},
    active_simple_session_id: null,
    conditions: {inspection_date:"2026-08-07"}
  };
  const sectionMappingTools = { activeSection: () => null, ensureModel: () => ({sections:[]}) };
  const stateStoreName = "inspectionState";
  let canonicalStateLastQueuedAt = null;
  let loadedCompactRecovery = true;
  let canonicalStateRestored = false;
  const stateKey = "propertyInspectorHomeTest313V1";
  let writes = [];
  let calls = 0;
  const localStorage = { setItem: (key, value) => { calls += 1; if (calls === 1) throw new DOMException("The quota has been exceeded.", "QuotaExceededError"); writes.push({key,value}); } };
  function queueCanonicalStateSnapshot() { throw new Error("must not queue while only compact recovery is loaded"); }
  function durableInspectionStateSnapshot() { return {}; }
  let status = null;
  function setStatus(message, kind) { status = {message,kind}; }
  ${compactFn}
  ${saveFn}
  saveState();
  return { writes, status };
`);
const result = harness();
assert.equal(result.writes.length, 1, "fallback local recovery pointer is written after quota error");
assert.ok(result.writes[0].value.length < 20000, "fallback pointer stays tiny even when inspection metadata is huge");
const parsedFallback = JSON.parse(result.writes[0].value);
assert.equal(parsedFallback.local_recovery_compact, true);
assert.equal(parsedFallback.canonical_state_store, "inspectionState");
assert.equal(parsedFallback.recovery_counts.records, 4000);

console.log("PASS: localStorage quota cannot block a field save; canonical inspection metadata is in IndexedDB and GPS-only fixes keep the lightweight save rhythm.");
