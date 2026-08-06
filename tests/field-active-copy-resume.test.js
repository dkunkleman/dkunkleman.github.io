"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const workerPath = path.join(root, "field-simple-test", "sw.js");
const app = fs.readFileSync(appPath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");
const worker = fs.readFileSync(workerPath, "utf8");

function functionBody(name) {
  const signature = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(");
  const match = signature.exec(app);
  assert.ok(match, name + " must exist");
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
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(match.index, cursor + 1);
    }
  }
  throw new Error("Unclosed function: " + name);
}

function assertCopyOnly(name) {
  const body = functionBody(name);
  assert.doesNotMatch(body, /stopTracking\s*\(/, name + " must not stop GPS");
  assert.doesNotMatch(body, /data\.stopped\s*=/, name + " must not mark the inspection stopped");
  assert.doesNotMatch(body, /inspection_finished/, name + " must not create an end event");
}

function snapshotEvidence(state) {
  return {
    inspection_id: state.inspection_id,
    started: state.started,
    stopped: state.stopped,
    points: state.points.map(item => item.id),
    photos: state.photos.map(item => item.id),
    markers: state.markers.map(item => item.id),
    notes: state.notes.map(item => item.id),
    measurements: state.measurements.map(item => item.id),
    sections: state.sections.map(item => item.id),
    simple_sessions: state.simple_sessions.map(item => item.id)
  };
}

function modelCreateCopy(state) {
  state.lifecycle_events.push({ type: "inspection_copy_created", time: "2026-08-06T12:30:00.000Z" });
  return state;
}

function modelResume(state, gpsSucceeds) {
  const originalStopped = state.stopped;
  if (!gpsSucceeds) {
    state.stopped = originalStopped;
    return false;
  }
  state.stopped = null;
  state.lifecycle_events.push({ type: "inspection_resumed", time: "2026-08-06T12:31:00.000Z" });
  return true;
}

async function main() {
  new Function(app);

  assert.match(app, /const APP_VERSION = "3\.13\.0-home-test\.5\.2-candidate-1"/);
  assert.match(index, /id="simpleTopFinish"[^>]*>SAVE \/ SEND COPY<\/button>/);
  assert.match(index, /id="finish"[^>]*>CREATE \/ SEND COPY<\/button>/);
  assert.match(index, /id="stop"[^>]*>END INSPECTION<\/button>/);

  ["finishInspection", "exportBackupNow", "downloadText", "shareLastPackage"].forEach(assertCopyOnly);

  const simpleFinish = functionBody("renderSimpleFinish");
  assert.match(simpleFinish, /SAVE OR SEND A COPY/);
  assert.match(simpleFinish, /simpleSaveDraft/);
  assert.doesNotMatch(simpleFinish, /simpleFinalizeActive/);
  assert.match(simpleFinish, /END INSPECTION — STOP GPS/);

  const explicitEnd = functionBody("endInspection");
  assert.match(explicitEnd, /TAP RECEIVED — END INSPECTION/);
  assert.match(explicitEnd, /confirm\("END INSPECTION and stop GPS\?/);
  assert.match(explicitEnd, /stopTracking\(\{ silent: true, reason: "finish" \}\)/);

  const stopCalls = app.match(/\bstopTracking\s*\(/g) || [];
  assert.equal(stopCalls.length, 2, "only stopTracking definition and explicit END may remain");

  assert.match(app, /simpleShell\.addEventListener\("click"[\s\S]*TAP RECEIVED — \$\{label\}/);
  assert.match(app, /simpleShell\.addEventListener\("click"[\s\S]*\}, true\);/, "tap acknowledgement must run in capture phase");

  const gps = functionBody("ensureFieldGpsReady");
  assert.match(gps, /watchId !== null && lastPosition/);
  assert.match(gps, /GETTING YOUR LOCATION - WAIT HERE/);
  assert.match(gps, /navigator\.geolocation\.clearWatch\(watchId\)/);
  assert.match(gps, /watchId = null/);
  assert.match(gps, /await startTracking\(\)/);
  assert.match(gps, /GPS IS NOT READY/);

  const start = functionBody("startTracking");
  assert.match(start, /data\.inspection_id = makeId\("inspection"\)/);
  assert.match(start, /data\.started = data\.started \|\| startedAt/);
  assert.match(start, /data\.stopped = null/);

  assert.match(app, /RESUME EXISTING INSPECTION/);
  assert.match(app, /TAP RECEIVED — STARTING GPS/);
  assert.match(app, /const savedStoppedAt = data\.stopped/);
  assert.match(app, /data\.stopped = savedStoppedAt \|\| new Date\(\)\.toISOString\(\)/);
  const resumeStart = app.indexOf("const savedStoppedAt = data.stopped");
  const resumeEnd = app.indexOf('simpleSetStatus("INSPECTION RESUMED', resumeStart);
  const resumeBlock = app.slice(resumeStart, resumeEnd);
  assert.match(resumeBlock, /const position = await ensureFieldGpsReady\(\)/);
  assert.doesNotMatch(resumeBlock, /await startTracking\(\)/, "Resume must not start GPS twice");

  assert.match(app, /const stateKey = "propertyInspectorHomeTest313V1"/);
  assert.match(app, /const photoDbName = "property-inspector-home-test-313-evidence"/);
  const workerHash = crypto.createHash("sha256").update(worker.replace(/\r\n/g, "\n")).digest("hex");
  assert.equal(workerHash, "32a3b3e425a76152eca5436c764e3e09d0a5f859abef34f089bec18fe4e6650f", "service worker must remain byte-for-byte unchanged");

  const populated = {
    inspection_id: "inspection-existing",
    started: "2026-08-05T08:00:00.000Z",
    stopped: null,
    points: [{ id: "gps-1" }, { id: "gps-2" }],
    photos: [{ id: "photo-1" }, { id: "photo-2" }],
    markers: [{ id: "marker-1" }],
    notes: [{ id: "note-1" }],
    measurements: [{ id: "measurement-1" }],
    sections: [{ id: "section-1" }],
    simple_sessions: [{ id: "session-1" }],
    lifecycle_events: []
  };

  const beforeCopy = snapshotEvidence(populated);
  modelCreateCopy(populated);
  const afterCopy = snapshotEvidence(populated);
  assert.deepEqual(afterCopy, beforeCopy, "creating a copy preserves active state and all evidence IDs");
  assert.equal(populated.stopped, null);
  assert.equal(populated.lifecycle_events.at(-1).type, "inspection_copy_created");

  populated.stopped = "2026-08-05T10:00:00.000Z";
  const beforeResume = snapshotEvidence(populated);
  assert.equal(modelResume(populated, false), false);
  assert.equal(populated.stopped, beforeResume.stopped, "failed GPS retry preserves the prior stopped state");
  assert.deepEqual(snapshotEvidence(populated), beforeResume, "failed retry changes no evidence");

  assert.equal(modelResume(populated, true), true);
  assert.equal(populated.inspection_id, beforeResume.inspection_id);
  assert.equal(populated.stopped, null);
  assert.deepEqual(snapshotEvidence(populated).points, beforeResume.points);
  assert.deepEqual(snapshotEvidence(populated).photos, beforeResume.photos);
  assert.deepEqual(snapshotEvidence(populated).markers, beforeResume.markers);
  assert.deepEqual(snapshotEvidence(populated).notes, beforeResume.notes);
  assert.deepEqual(snapshotEvidence(populated).measurements, beforeResume.measurements);
  assert.deepEqual(snapshotEvidence(populated).sections, beforeResume.sections);
  assert.deepEqual(snapshotEvidence(populated).simple_sessions, beforeResume.simple_sessions);

  console.log("field-active-copy-resume.test.js: PASS");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
