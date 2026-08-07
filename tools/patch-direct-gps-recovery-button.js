#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-3";
const TO = "3.13.0-home-test.5.1-safari-direct-4";

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
  "  let lastGpsErrorAt = null;",
  `  let lastGpsErrorAt = null;\n  let gpsManualRequestInFlight = false;\n  let gpsRecoveryReason = \"\";`,
  "GPS recovery state"
);

app = replaceOnce(app,
  '      if (!button || button.disabled || !simpleShell.contains(button)) return;\n      const label = String(button.textContent || "FIELD ACTION").trim().replace(/\\s+/g, " ");',
  '      if (!button || button.disabled || !simpleShell.contains(button)) return;\n      if (button.id === "simpleGpsControl") return;\n      const label = String(button.textContent || "FIELD ACTION").trim().replace(/\\s+/g, " ");',
  "GPS button bypasses generic tap banner"
);

app = replaceFunction(app, "visibleGpsMessage", `  function visibleGpsMessage() {
    const fresh = freshFieldPosition();
    if (fresh) return \`GPS ACTIVE — accuracy +/-\${Math.round(fresh.accuracy_m || 0)} m\`;
    if (gpsManualRequestInFlight) return "GPS REQUEST SENT — waiting for Safari location.";
    if (gpsPermissionDenied || lastGpsErrorCode === 1) return "GPS PERMISSION OFF — Safari is not allowed to use location.";
    if (lastGpsErrorCode === 2) return "GPS POSITION UNAVAILABLE — automatic recovery is trying; tap RECONNECT GPS if needed.";
    if (lastGpsErrorCode === 3) return "GPS TIMEOUT — automatic recovery is trying; tap RECONNECT GPS if needed.";
    if (gpsRecoveryReason) return gpsRecoveryReason;
    if (watchId !== null) return "GPS STARTING — waiting for Safari location.";
    if (data.started) return "GPS IS NOT CONNECTED — tap RECONNECT GPS.";
    return "GPS has not started yet.";
  }`);

app = replaceFunction(app, "updateVisibleGpsControl", `  function updateVisibleGpsControl() {
    const wrap = document.getElementById("simpleGpsControlWrap");
    const button = document.getElementById("simpleGpsControl");
    const message = document.getElementById("simpleGpsControlStatus");
    if (!wrap || !button || !message) return;
    const fresh = freshFieldPosition();
    const stale = data.started && !data.stopped && watchId !== null && gpsWatcherIsStale();
    const needsRecovery = Boolean(data.started && !data.stopped && !fresh && (gpsManualRequestInFlight || lastGpsErrorCode != null || gpsRecoveryReason || watchId === null || stale));
    wrap.hidden = !needsRecovery;
    button.disabled = gpsManualRequestInFlight;
    button.textContent = gpsManualRequestInFlight ? "GPS REQUEST IN PROGRESS" : "RECONNECT GPS";
    message.textContent = visibleGpsMessage();
  }`);

app = replaceFunction(app, "requestGpsFromVisibleControl", `  function requestGpsFromVisibleControl() {
    gpsUserActivatedThisPage = true;
    gpsManualRequestInFlight = true;
    gpsRecoveryReason = "";
    gpsPermissionDenied = false;
    lastGpsErrorCode = null;
    lastGpsErrorMessage = "";
    lastGpsErrorAt = null;
    if (!("geolocation" in navigator)) {
      gpsManualRequestInFlight = false;
      lastGpsErrorCode = 0;
      lastGpsErrorMessage = "geolocation unavailable";
      updateVisibleGpsControl();
      simpleSetStatus("GPS UNAVAILABLE ON THIS PHONE. Field records still save.", "warning");
      return;
    }

    const now = new Date().toISOString();
    if (!data.inspection_id) data.inspection_id = makeId("inspection");
    if (!data.started) {
      data.started = now;
      if (!data.conditions.inspection_date) data.conditions.inspection_date = now.slice(0, 10);
      data.lifecycle_events.push({ type: "inspection_started", time: now, source: "visible_gps_button" });
    } else if (data.stopped) {
      data.stopped = null;
      data.lifecycle_events.push({ type: "inspection_resumed", time: now, source: "visible_gps_button" });
    } else {
      data.lifecycle_events.push({ type: "gps_restart_requested", time: now, source: "visible_gps_button" });
    }
    saveState();
    clearActiveGpsWatch();
    simpleSetStatus("GPS REQUEST SENT — waiting for Safari location.", "warning");
    setStatus("GPS REQUEST SENT — waiting for Safari location.", "active");
    updateVisibleGpsControl();

    // Keep the Safari geolocation request directly inside the user's tap handler.
    navigator.geolocation.getCurrentPosition(position => {
      gpsManualRequestInFlight = false;
      gpsRecoveryReason = "";
      onPosition(position);
      if (watchId === null) startGpsWatcher();
      keepAwake();
      updateControls();
      updateVisibleGpsControl();
    }, error => {
      gpsManualRequestInFlight = false;
      onGpsError(error, gpsWatchGeneration);
      updateVisibleGpsControl();
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  }`);

app = replaceFunction(app, "installVisibleGpsControl", `  function installVisibleGpsControl() {
    if (!simpleShell || document.getElementById("simpleGpsControlWrap")) return;
    const wrap = document.createElement("section");
    wrap.id = "simpleGpsControlWrap";
    wrap.hidden = true;
    wrap.setAttribute("aria-label", "GPS recovery control");
    wrap.style.cssText = "margin:10px;padding:12px;border:4px solid #b33a00;border-radius:10px;background:#fff7ed;position:relative;z-index:30";
    wrap.innerHTML = '<div id="simpleGpsControlStatus" style="font-weight:900;font-size:17px;line-height:1.3;margin-bottom:8px"></div><button id="simpleGpsControl" type="button" style="width:100%;min-height:68px;background:#b33a00;color:#fff;font-size:20px;font-weight:900;border:0;border-radius:9px">RECONNECT GPS</button>';
    simpleShell.insertBefore(wrap, simpleShell.firstChild);
    document.getElementById("simpleGpsControl").addEventListener("click", requestGpsFromVisibleControl);
    updateVisibleGpsControl();
  }`);

app = replaceFunction(app, "onGpsError", `  function onGpsError(error, generation) {
    if (generation != null && generation !== gpsWatchGeneration) return;
    gpsManualRequestInFlight = false;
    gpsRecoveryReason = "GPS LOST — automatic recovery is trying. You can tap RECONNECT GPS now.";
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
  "    lastGpsFixReceivedAt = Date.now();\n    gpsRestartAttempt = 0;",
  "    lastGpsFixReceivedAt = Date.now();\n    gpsManualRequestInFlight = false;\n    gpsRecoveryReason = \"\";\n    gpsRestartAttempt = 0;",
  "clear recovery state on GPS fix"
);

const watchdog = `
  function gpsRecoveryWatchdog() {
    if (!data.started || data.stopped || !gpsUserActivatedThisPage || gpsPermissionDenied || gpsManualRequestInFlight) {
      updateVisibleGpsControl();
      return;
    }
    if (freshFieldPosition()) {
      gpsRecoveryReason = "";
      updateVisibleGpsControl();
      return;
    }
    if (watchId !== null && gpsWatcherIsStale()) {
      gpsRecoveryReason = "GPS STALLED — automatic recovery started. Tap RECONNECT GPS if it does not recover.";
      clearActiveGpsWatch();
      updateVisibleGpsControl();
      startTracking({ recovery: true, skipReconcile: true }).catch(error => {
        gpsRecoveryReason = \`GPS AUTOMATIC RECOVERY FAILED: \${error && error.message ? error.message : "unknown error"}. Tap RECONNECT GPS.\`;
        updateVisibleGpsControl();
      });
    } else {
      updateVisibleGpsControl();
    }
  }

  setInterval(gpsRecoveryWatchdog, 15000);
`;
app = replaceOnce(app, "\n  initialize();\n})();", watchdog + "\n  initialize();\n})();", "GPS recovery watchdog");

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v3", "property-inspector-home-test-313-direct-ed42-v4", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Patched GPS recovery button behavior to ${TO}`);
