#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-1";
const TO = "3.13.0-home-test.5.1-safari-direct-3";

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

app = replaceOnce(app,
`  const simpleShell = document.getElementById("simpleShell");
  if (simpleShell) {
    simpleShell.addEventListener("click", event => {
      const button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button || button.disabled || !simpleShell.contains(button)) return;
      const label = String(button.textContent || "FIELD ACTION").trim().replace(/\\s+/g, " ");
      simpleSetStatus(\`TAP SAVED — \${label}\`, "warning");
    }, true);
  }`,
`  const simpleShell = document.getElementById("simpleShell");
  if (simpleShell) {
    simpleShell.addEventListener("click", event => {
      const button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button || button.disabled || !simpleShell.contains(button)) return;
      const label = String(button.textContent || "FIELD ACTION").trim().replace(/\\s+/g, " ");
      simpleSetStatus(\`TAP SAVED — \${label}\`, "warning");
    }, true);
  }

  function visibleGpsMessage() {
    const fresh = freshFieldPosition();
    if (fresh) return \`GPS ACTIVE — accuracy +/-\${Math.round(fresh.accuracy_m || 0)} m\`;
    if (gpsPermissionDenied || lastGpsErrorCode === 1) return "GPS PERMISSION OFF — Safari is not allowed to use location.";
    if (lastGpsErrorCode === 2) return "GPS POSITION UNAVAILABLE — Safari did not produce a location.";
    if (lastGpsErrorCode === 3) return "GPS TIMEOUT — Safari did not return a location in time.";
    if (watchId !== null) return "GPS STARTING — waiting for Safari location.";
    return "GPS OFF — tap the green button below.";
  }

  function updateVisibleGpsControl() {
    const button = document.getElementById("simpleGpsControl");
    const message = document.getElementById("simpleGpsControlStatus");
    if (!button || !message) return;
    const fresh = freshFieldPosition();
    button.disabled = Boolean(fresh);
    button.textContent = fresh ? "GPS ACTIVE" : "START / RESTART GPS";
    message.textContent = visibleGpsMessage();
  }

  function requestGpsFromVisibleControl() {
    gpsUserActivatedThisPage = true;
    gpsPermissionDenied = false;
    lastGpsErrorCode = null;
    lastGpsErrorMessage = "";
    lastGpsErrorAt = null;
    if (!("geolocation" in navigator)) {
      lastGpsErrorCode = 0;
      lastGpsErrorMessage = "geolocation unavailable";
      updateVisibleGpsControl();
      simpleSetStatus("GPS UNAVAILABLE ON THIS PHONE. Field records still save.", "warning");
      return;
    }

    const now = new Date().toISOString();
    const wasStarted = Boolean(data.started);
    if (!data.inspection_id) data.inspection_id = makeId("inspection");
    if (!data.started) {
      data.started = now;
      if (!data.conditions.inspection_date) data.conditions.inspection_date = now.slice(0, 10);
      data.lifecycle_events.push({ type: "inspection_started", time: now, source: "visible_gps_button" });
    } else if (data.stopped) {
      data.stopped = null;
      data.lifecycle_events.push({ type: "inspection_resumed", time: now, source: "visible_gps_button" });
    } else if (wasStarted) {
      data.lifecycle_events.push({ type: "gps_restart_requested", time: now, source: "visible_gps_button" });
    }
    saveState();
    clearActiveGpsWatch();
    simpleSetStatus("GPS REQUEST SENT TO SAFARI — waiting for location.", "warning");
    setStatus("GPS REQUEST SENT TO SAFARI — waiting for location.", "active");
    updateControls();
    updateVisibleGpsControl();

    // This call is intentionally made synchronously inside the user's click handler.
    navigator.geolocation.getCurrentPosition(position => {
      onPosition(position);
      if (watchId === null) startGpsWatcher();
      keepAwake();
      updateControls();
      updateVisibleGpsControl();
    }, error => {
      onGpsError(error, gpsWatchGeneration);
      updateVisibleGpsControl();
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  }

  function installVisibleGpsControl() {
    if (!simpleShell || document.getElementById("simpleGpsControlWrap")) return;
    const wrap = document.createElement("section");
    wrap.id = "simpleGpsControlWrap";
    wrap.setAttribute("aria-label", "GPS control");
    wrap.style.cssText = "margin:10px;padding:12px;border:4px solid #0b5d2a;border-radius:10px;background:#fff;position:relative;z-index:30";
    wrap.innerHTML = '<div id="simpleGpsControlStatus" style="font-weight:900;font-size:17px;line-height:1.3;margin-bottom:8px">GPS OFF — tap the green button below.</div><button id="simpleGpsControl" type="button" style="width:100%;min-height:68px;background:#087a32;color:#fff;font-size:20px;font-weight:900;border:0;border-radius:9px">START / RESTART GPS</button>';
    simpleShell.insertBefore(wrap, simpleShell.firstChild);
    document.getElementById("simpleGpsControl").addEventListener("click", requestGpsFromVisibleControl);
    updateVisibleGpsControl();
  }

  installVisibleGpsControl();`,
"visible GPS control");

app = replaceFunction(app, "renderSimpleHeader", `  function renderSimpleHeader() {
    const gps = document.getElementById("simpleGpsStatus");
    const counts = document.getElementById("simpleCounts");
    const fresh = freshFieldPosition();
    if (gps) gps.textContent = visibleGpsMessage();
    if (counts) {
      const appPath = location.pathname.replace(/\\/?$/, "/") + "app.js";
      counts.textContent = \`\${data.photos.length} photos | \${data.markers.length} records | \${data.voice_notes.length} voice · \${APP_VERSION} · DIRECT \${appPath}\`;
    }
    updateVisibleGpsControl();
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
    updateVisibleGpsControl();
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
  '      setStatus(pendingPhotoQueue.length ? "Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo." : (data.started ? "Saved inspection loaded. Use the green GPS button at the top of the field screen." : "Ready. Use the green GPS button at the top of the field screen."), pendingPhotoQueue.length ? "warning" : "normal");',
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
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v1", "property-inspector-home-test-313-direct-ed42-v3", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Patched direct Safari GPS behavior to ${TO}`);
