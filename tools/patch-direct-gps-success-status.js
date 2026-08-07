#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-8";
const TO = "3.13.0-home-test.5.1-safari-direct-9";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

let app = fs.readFileSync(appPath, "utf8");
let index = fs.readFileSync(indexPath, "utf8");
let sw = fs.readFileSync(swPath, "utf8");

app = replaceOnce(app, `const APP_VERSION = "${FROM}";`, `const APP_VERSION = "${TO}";`, "version");

app = replaceOnce(
  app,
  '    setStatus(`GPS active · accuracy ±${Math.round(coordinates.accuracy)} m · ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`, "active");\n    renderSimpleHeader();',
  '    setStatus(`GPS active · accuracy ±${Math.round(coordinates.accuracy)} m · ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`, "active");\n    const simpleGpsStatus = document.getElementById("simpleSaveStatus");\n    const simpleGpsText = simpleGpsStatus ? String(simpleGpsStatus.textContent || "") : "";\n    if (/^(GPS REQUEST SENT|GPS STARTING|GPS RECOVERY|GPS RETURN RECOVERY|GPS DISCONNECTED|GPS STALLED|SAFARI DID NOT RETURN A LOCATION|SAFARI HAS NOT FINISHED THE LOCATION REQUEST)/.test(simpleGpsText)) {\n      simpleSetStatus(`GPS ACTIVE — accuracy +/-${Math.round(coordinates.accuracy)} m`, "saved");\n    }\n    renderSimpleHeader();',
  "clear stale GPS waiting banner on first recovered fix"
);

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v8", "property-inspector-home-test-313-direct-ed42-v9", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Cleared stale GPS waiting banner and built ${TO}`);
