#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-1";
const TO = "3.13.0-home-test.5.1-safari-direct-2";

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
app = replaceOnce(app, "  const GPS_STALE_MS = 90000;", `  const GPS_STALE_MS = 90000;
  let gpsUserActivatedThisPage = false;
  let lastGpsErrorCode = null;
  let lastGpsErrorMessage = "";
  let lastGpsErrorAt = null;`, "explicit GPS state");

app = replaceFunction(app, "renderSimpleHeader", `  function renderSimpleHeader() {
    const gps = document.getElementById("simpleGpsStatus");
    const counts = document.getElementById("simpleCounts");
    const fresh = freshFieldPosition();
    if (gps) {
      if (fresh) gps.textContent = \`GPS ACTIVE +/-\${Math.round(fresh.accuracy_m || 0)} m\`;
      else if (gpsPermissionDenied || lastGpsErrorCode === 1) gps.textContent = "GPS PERMISSION OFF — TAP START / RESTART GPS AFTER FIXING LOCATION SETTINGS";
      else if (lastGpsErrorCode === 2) gps.textContent = "GPS POSITION UNAVAILABLE — TAP START / RESTART GPS";
      else if (lastGpsErrorCode === 3) gps.textContent = "GPS TIMEOUT — TAP START / RESTART GPS";
      else if (watchId !== null) gps.textContent = "GPS STARTING — WAITING FOR FIRST LOCATION";
      else if (data.started) gps.textContent = "GPS OFF — TAP START / RESTART GPS";
      else gps.textContent = "NOT STARTED — TAP START INSPECTION";
    }
    if (counts) {
      const appPath = location.pathname.replace(/\\/?$/, "/") + "app.js";
      counts.textContent = \`\${data.photos.length} photos | \${data.markers.length} records | \${data.voice_notes.length} voice · \${APP_VERSION} · DIRECT \${appPath}\`;
    }
  }`);

app = replaceFunction(app, "updateControls", `  function updateControls() {
    const tracking = watchId !== null;
    const recordingVoice = Boolean(mediaRecorder && mediaRecorder.state === "recording");
    startBtn.textContent = data.started ? (tracking ? "GPS ACTIVE" : "START / RESTART GPS") : "START INSPECTION";
    startBtn.disabled = !offlineReady || tracking || photoBusy || packageBusy || recordingVoice;
    stopBtn.disabled = !tracking || photoBusy || packageBusy || recordingVoice;
    markerButtons.forEach(button => { button.disabled = photoBusy || packageBusy || recordingVoice; });
    voiceBtn.disabled = photoBusy || packageBusy;
    finishBtn.disabled = !data.started || photoBusy || packageBusy || recordingVoice;
    clearBtn.disabled = photoBusy || packageBusy || recordingVoice;
    document.getElementById("backup").disabled = !data.started || photoBusy || packageBusy || recordingVoice;
    fullArchiveBtn.disabled = !data.started || photoBusy || packageBusy || recordingVoice;
    retryPendingPhotoBtn.disabled = photoBusy || packageBusy || recordingVoice;
    correctRecordBtn.disabled = photoBusy || packageBusy || recordingVoice || !(data.markers.length || data.photos.length || data.voice_notes.length);
    undoLastBtn.disabled = photoBusy || packageBusy || recordingVoice || !governanceTools || !governanceTools.recordsForCorrection(data).some(item => governanceTools.recordStatus(data, item.record_type, item.record_id) !== "voided");
    document.getElementById("startPhotoGroup").disabled = !tracking || photoBusy || packageBusy || recordingVoice || Boolean(data.active_evidence_set_id);
    document.getElementById("finishEvidenceSet").disabled = photoBusy || packageBusy || recordingVoice || !data.active_evidence_set_id;
    const activeSet = activeEvidenceSet();
    document.getElementById("addPlotTree").disabled = photoBusy || packageBusy || recordingVoice || !activeSet || activeSet.set_type !== "Timber Sample Plot";
    renderSimpleHeader();
    updateNextStep();
  }`);

app = replaceFunction(app, "explainGpsProblem", `  function explainGpsProblem(error) {
    const code = error && Number(error.code);
    lastGpsErrorCode = Number.isFinite(code) ? code : 0;
    lastGpsErrorMessage = error && error.message ? String(error.message) : "unknown error";
    lastGpsErrorAt = new Date().toISOString();
    if (code === 1) {
      gpsPermissionDenied = true;
      return "GPS PERMISSION OFF. Safari cannot use location until Location access is allowed. Field records still save.";
    }
    if (code === 2) return "GPS POSITION UNAVAILABLE. Safari has not produced a location. Field records still save.";
    if (code === 3) return "GPS TIMEOUT. Safari did not return a location before the timeout. Field records still save.";
    return \`GPS ERROR: \${lastGpsErrorMessage}. Field records still save.\`;
  }`);

app = replaceFunction(app, "onGpsError", `  function onGpsError(error, generation) {
    if (generation != null && generation !== gpsWatchGeneration) return;
    clearActiveGpsWatch();
    stopOrientationCapture();
    releaseWakeLock();
    const message = explainGpsProblem(error);
    updateControls();
    setStatus(message, Number(error && error.code) === 1 ? "error" : "warning");
    simpleSetStatus(message, "warning");
    renderSimpleHeader();
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

app = replaceOnce(app,
  "    if (gpsPermissionDenied && trackingOptions.recovery) return;\n    const orientationPermission = requestOrientationAccess();",
  `    if (gpsPermissionDenied && trackingOptions.recovery) return;
    if (!trackingOptions.recovery) {
      gpsUserActivatedThisPage = true;
      gpsPermissionDenied = false;
      lastGpsErrorCode = null;
      lastGpsErrorMessage = "";
      lastGpsErrorAt = null;
    }
    const orientationPermission = requestOrientationAccess();`,
  "manual GPS activation");

app = replaceOnce(app,
  "    startGpsWatcher();\n    if (SIMPLE_AUTOMATION_MODE) {",
  `    startGpsWatcher();
    if (!trackingOptions.recovery) {
      setStatus("GPS STARTING — waiting for Safari to return the first location.", "active");
      simpleSetStatus("GPS STARTING — waiting for Safari to return the first location.", "warning");
      renderSimpleHeader();
    }
    if (SIMPLE_AUTOMATION_MODE) {`,
  "manual starting feedback");

app = replaceOnce(app,
  "    lastGpsFixReceivedAt = Date.now();\n    gpsRestartAttempt = 0;\n    gpsPermissionDenied = false;",
  `    lastGpsFixReceivedAt = Date.now();
    gpsRestartAttempt = 0;
    gpsPermissionDenied = false;
    lastGpsErrorCode = null;
    lastGpsErrorMessage = "";
    lastGpsErrorAt = null;`,
  "clear error on fix");

app = replaceOnce(app,
  `    if (data.started && !data.stopped && watchId === null && !SIMPLE_AUTOMATION_MODE) {
      await startTracking();
    }`,
  `    if (data.started && !data.stopped && watchId === null && !SIMPLE_AUTOMATION_MODE) {
      gpsUserActivatedThisPage = false;
      clearActiveGpsWatch();
      updateControls();
      renderSimpleHeader();
    }`,
  "no automatic GPS request on page load");

app = replaceOnce(app,
  '      setStatus(pendingPhotoQueue.length ? "Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo." : (data.started ? "Saved inspection loaded. Tap Resume Existing Inspection to continue, or Finish Inspection to create the package." : "Ready. Confirm Offline ready, then tap Start Inspection and allow Precise Location."), pendingPhotoQueue.length ? "warning" : "normal");',
  '      setStatus(pendingPhotoQueue.length ? "Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo." : (data.started ? "Saved inspection loaded. Tap START / RESTART GPS to turn location on." : "Ready. Confirm Offline ready, then tap START INSPECTION."), pendingPhotoQueue.length ? "warning" : "normal");',
  "plain startup instruction");

app = replaceFunction(app, "revalidateGpsAfterReturn", `  function revalidateGpsAfterReturn() {
    if (!gpsUserActivatedThisPage || !data.started || data.stopped || gpsPermissionDenied) {
      renderSimpleHeader();
      return;
    }
    if (!freshFieldPosition() || gpsWatcherIsStale()) {
      clearActiveGpsWatch();
      startTracking({ recovery: true, skipReconcile: true }).catch(error => {
        lastGpsErrorCode = 0;
        lastGpsErrorMessage = error && error.message ? error.message : "reconnect failed";
        lastGpsErrorAt = new Date().toISOString();
        renderSimpleHeader();
      });
    } else if (watchId !== null && !wakeLock) keepAwake();
  }`);

app = replaceOnce(app, "GPS RECONNECTING — your field record is already saved; location will attach when Safari provides it.", "GPS CHECK — requesting a current Safari location now.", "remove generic reconnecting message");

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v1", "property-inspector-home-test-313-direct-ed42-v2", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Patched direct Safari GPS behavior to ${TO}`);
