#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-7";
const TO = "3.13.0-home-test.5.1-safari-direct-8";

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
  '  const gpsStoreName = "gpsPoints";',
  '  const gpsStoreName = "gpsPoints";\n  const stateStoreName = "inspectionState";',
  "state store name"
);
app = replaceOnce(app,
  '  let gpsWriteQueue = Promise.resolve();',
  '  let gpsWriteQueue = Promise.resolve();\n  let stateWriteQueue = Promise.resolve();\n  let stateStorageFailed = false;\n  let stateStorageErrorMessage = "";\n  let loadedCompactRecovery = false;\n  let canonicalStateRestored = false;\n  let canonicalStateLastQueuedAt = null;',
  "canonical state variables"
);

app = replaceFunction(app, "loadState", `  function normalizeLoadedState() {
    data.points = Array.isArray(data.points) ? data.points : [];
    data.markers = Array.isArray(data.markers) ? data.markers : [];
    data.photos = Array.isArray(data.photos) ? data.photos : [];
    data.voice_notes = Array.isArray(data.voice_notes) ? data.voice_notes : [];
    data.lifecycle_events = Array.isArray(data.lifecycle_events) ? data.lifecycle_events : [];
    data.orientation_samples = Array.isArray(data.orientation_samples) ? data.orientation_samples : [];
    data.build_mode = SIMPLE_TEST_BUILD;
    data.simple_sessions = Array.isArray(data.simple_sessions) ? data.simple_sessions : [];
    data.simple_counters = data.simple_counters && typeof data.simple_counters === "object" ? data.simple_counters : {};
    data.active_simple_session_id = data.active_simple_session_id || null;
    simpleActiveSessionId = data.active_simple_session_id;
    if (frontageTools) frontageTools.ensureModel(data);
    if (automaticContextTools) automaticContextTools.ensureModel(data);
    if (sectionMappingTools) sectionMappingTools.ensureModel(data);
    if (wetEdgeTools) wetEdgeTools.ensureModel(data);
    if (previsitTools) previsitTools.ensureModel(data);
    data.conditions = Object.assign(emptyInspection().conditions, data.conditions || {});
    data.weather_context = Object.assign(emptyInspection().weather_context, data.weather_context || {});
    data.water_observation_rule = Object.assign(emptyInspection().water_observation_rule, data.water_observation_rule || {});
    if (coachingTools) coachingTools.ensureInspectionModel(data);
    if (governanceTools) governanceTools.ensureGovernanceModel(data);
    if (evidenceSetTools) {
      evidenceSetTools.ensureEvidenceSetModel(data);
      evidenceSetTools.addPearsonSuggestions(data);
    }
    if (timberTools) timberTools.ensureModel(data);
    if (synthesisTools) synthesisTools.ensureModel(data);
  }

  function loadState() {
    try {
      const current = localStorage.getItem(stateKey);
      const legacy = localStorage.getItem(legacyStateKey);
      const parsed = JSON.parse(current || legacy || "null");
      loadedCompactRecovery = Boolean(parsed && parsed.local_recovery_compact === true);
      if (parsed && Array.isArray(parsed.points)) data = Object.assign(emptyInspection(), parsed);
    } catch (error) {
      setStatus("Saved inspection metadata could not be read. Do not begin until the record is recovered from durable storage.", "error");
    }
    normalizeLoadedState();
  }`);

app = replaceFunction(app, "saveState", `  function durableInspectionStateSnapshot() {
    const recovery = Object.assign({}, data, {
      points: data.points.slice(-500),
      points_total: data.points.length,
      gps_storage: "IndexedDB gpsPoints is canonical; inspectionState stores complete inspection metadata plus the latest 500 fixes",
      state_storage: "IndexedDB canonical inspectionState",
      state_saved_at: new Date().toISOString()
    });
    return typeof structuredClone === "function" ? structuredClone(recovery) : JSON.parse(JSON.stringify(recovery));
  }

  function compactLocalRecoverySnapshot() {
    const activeSection = sectionMappingTools ? sectionMappingTools.activeSection(data) : null;
    const activeSectionSummary = activeSection ? {
      section_id: activeSection.section_id,
      started_at: activeSection.started_at,
      completion_status: activeSection.completion_status,
      method: activeSection.method,
      location_status: activeSection.location_status || null,
      raw_edge_point_count: Array.isArray(activeSection.raw_walked_edge_points) ? activeSection.raw_walked_edge_points.length : 0
    } : null;
    return {
      schema_name: data.schema_name,
      schema_version: data.schema_version,
      build_mode: data.build_mode,
      property_id: data.property_id,
      inspection_id: data.inspection_id,
      started: data.started,
      stopped: data.stopped,
      local_recovery_compact: true,
      canonical_state_store: stateStoreName,
      canonical_state_key: "active",
      canonical_state_last_queued_at: canonicalStateLastQueuedAt,
      points: data.points.slice(-20),
      points_total: data.points.length,
      markers: data.markers.slice(-3),
      photos: data.photos.slice(-3),
      voice_notes: data.voice_notes.slice(-3),
      lifecycle_events: data.lifecycle_events.slice(-10),
      simple_sessions: data.simple_sessions.slice(-5),
      simple_counters: Object.assign({}, data.simple_counters || {}),
      active_simple_session_id: data.active_simple_session_id || null,
      active_section_summary: activeSectionSummary,
      conditions: Object.assign({}, data.conditions || {}),
      recovery_counts: {
        records: data.markers.length,
        photos: data.photos.length,
        voice: data.voice_notes.length,
        sections: sectionMappingTools ? sectionMappingTools.ensureModel(data).sections.length : 0
      }
    };
  }

  function queueCanonicalStateSnapshot(snapshot) {
    canonicalStateLastQueuedAt = snapshot.state_saved_at || new Date().toISOString();
    stateWriteQueue = stateWriteQueue
      .catch(() => {})
      .then(() => inspectionStatePut(snapshot))
      .then(() => {
        stateStorageFailed = false;
        stateStorageErrorMessage = "";
        canonicalStateRestored = true;
      })
      .catch(error => {
        stateStorageFailed = true;
        stateStorageErrorMessage = error && error.message ? error.message : "canonical state write failed";
        setStatus("DURABLE INSPECTION STATE SAVE FAILED: " + stateStorageErrorMessage + ". Existing photos and GPS remain preserved; stop adding new field records until storage recovers.", "error");
      });
    return stateWriteQueue;
  }

  function saveState(options) {
    const settings = options || {};
    if (!settings.gpsOnly && (!loadedCompactRecovery || canonicalStateRestored)) {
      queueCanonicalStateSnapshot(durableInspectionStateSnapshot());
    }
    const compact = compactLocalRecoverySnapshot();
    try {
      localStorage.setItem(stateKey, JSON.stringify(compact));
    } catch (error) {
      try {
        localStorage.setItem(stateKey, JSON.stringify({
          schema_name: data.schema_name,
          schema_version: data.schema_version,
          build_mode: data.build_mode,
          property_id: data.property_id,
          inspection_id: data.inspection_id,
          started: data.started,
          stopped: data.stopped,
          local_recovery_compact: true,
          canonical_state_store: stateStoreName,
          canonical_state_key: "active",
          canonical_state_last_queued_at: canonicalStateLastQueuedAt,
          points: data.points.slice(-2),
          points_total: data.points.length,
          recovery_counts: { records: data.markers.length, photos: data.photos.length, voice: data.voice_notes.length }
        }));
      } catch (fallbackError) {
        setStatus("LOCAL RECOVERY POINTER IS FULL. IndexedDB remains the canonical inspection store; do not clear website data.", "warning");
      }
    }
  }`);

app = replaceOnce(app,
  "      const request = indexedDB.open(photoDbName, 3);",
  "      const request = indexedDB.open(photoDbName, 4);",
  "upgrade evidence database to v4"
);
app = replaceOnce(app,
  `        if (!db.objectStoreNames.contains(gpsStoreName)) {
          const gps = db.createObjectStore(gpsStoreName, { keyPath: "key" });
          gps.createIndex("inspection_id", "inspection_id", { unique: false });
        }`,
  `        if (!db.objectStoreNames.contains(gpsStoreName)) {
          const gps = db.createObjectStore(gpsStoreName, { keyPath: "key" });
          gps.createIndex("inspection_id", "inspection_id", { unique: false });
        }
        if (!db.objectStoreNames.contains(stateStoreName)) db.createObjectStore(stateStoreName, { keyPath: "key" });`,
  "create canonical state store"
);

app = replaceOnce(app,
  "  function photoStorePut(record) {",
  `  function inspectionStatePut(snapshot) {
    const record = {
      key: "active",
      inspection_id: snapshot && snapshot.inspection_id || null,
      saved_at: snapshot && snapshot.state_saved_at || new Date().toISOString(),
      app_version: APP_VERSION,
      state: snapshot
    };
    return withEvidenceTransaction(stateStoreName, "readwrite", transaction => {
      const request = transaction.objectStore(stateStoreName).put(record);
      return transactionRequest(transaction, request, "Inspection state could not be stored.");
    });
  }

  function inspectionStateGet() {
    return withEvidenceTransaction(stateStoreName, "readonly", transaction => {
      const request = transaction.objectStore(stateStoreName).get("active");
      return transactionRequest(transaction, request, "Inspection state could not be read.", result => result || null);
    });
  }

  async function restoreCanonicalInspectionState() {
    await stateWriteQueue.catch(() => {});
    const record = await inspectionStateGet();
    if (record && record.state) {
      const currentInspectionId = data.inspection_id == null ? null : String(data.inspection_id);
      const storedInspectionId = record.inspection_id == null ? null : String(record.inspection_id);
      if (!currentInspectionId || !storedInspectionId || currentInspectionId === storedInspectionId || loadedCompactRecovery) {
        data = Object.assign(emptyInspection(), record.state);
        canonicalStateRestored = true;
        loadedCompactRecovery = false;
        normalizeLoadedState();
        return true;
      }
    }
    if (loadedCompactRecovery) throw new Error("The compact recovery pointer exists but the canonical inspectionState record is missing. Do not clear Safari data.");
    const snapshot = durableInspectionStateSnapshot();
    await inspectionStatePut(snapshot);
    canonicalStateRestored = true;
    loadedCompactRecovery = false;
    return false;
  }

  function photoStorePut(record) {`,
  "canonical state store helpers"
);

app = replaceOnce(app,
  `    return withEvidenceTransaction([photoStoreName, voiceStoreName, voiceChunkStoreName, gpsStoreName], "readwrite", transaction => {
      transaction.objectStore(photoStoreName).clear();
      transaction.objectStore(voiceStoreName).clear();
      transaction.objectStore(voiceChunkStoreName).clear();
      transaction.objectStore(gpsStoreName).clear();`,
  `    return withEvidenceTransaction([photoStoreName, voiceStoreName, voiceChunkStoreName, gpsStoreName, stateStoreName], "readwrite", transaction => {
      transaction.objectStore(photoStoreName).clear();
      transaction.objectStore(voiceStoreName).clear();
      transaction.objectStore(voiceChunkStoreName).clear();
      transaction.objectStore(gpsStoreName).clear();
      transaction.objectStore(stateStoreName).clear();`,
  "clear canonical state only on explicit clear"
);

app = replaceOnce(app,
  `    try {
      saveState();
    } catch (error) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);`,
  `    try {
      saveState({ gpsOnly: true });
    } catch (error) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);`,
  "keep August 3 local save rhythm without full-state write per GPS fix"
);

app = replaceOnce(app,
  `      await openPhotoDb();
      await revalidatePhotoDb();
      await loadPendingPhotos();`,
  `      await openPhotoDb();
      await revalidatePhotoDb();
      await restoreCanonicalInspectionState();
      saveState();
      await stateWriteQueue;
      await loadPendingPhotos();`,
  "restore canonical state before evidence reconciliation"
);

app = replaceOnce(app,
  `        await gpsWriteQueue;
        await voiceChunkWrites;`,
  `        await stateWriteQueue;
        if (stateStorageFailed) throw new Error("Durable inspection state is not current: " + stateStorageErrorMessage);
        await gpsWriteQueue;
        await voiceChunkWrites;`,
  "flush canonical state before package creation"
);

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v7", "property-inspector-home-test-313-direct-ed42-v8", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Moved inspection metadata out of localStorage quota path and built ${TO}`);
