"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "field-simple-test", "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "field-simple-test", "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "field-simple-test", "sw.js"), "utf8");

new Function(app);
new Function(sw);

assert.match(app, /const APP_VERSION = "3\.13\.0-home-test\.5\.1-safari-direct-11"/);
assert.match(index, /app\.js\?v=3\.13\.0-home-test\.5\.1-safari-direct-11/);
assert.match(sw, /property-inspector-home-test-313-direct-ed42-v11/);

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

const initialize = extractFunction("initialize");
const restoreIndex = initialize.indexOf("await restoreCanonicalInspectionState();");
const restoredHeaderIndex = initialize.indexOf("renderSimpleHeader();", restoreIndex);
const pendingPhotoIndex = initialize.indexOf("await loadPendingPhotos();");
assert.ok(restoreIndex >= 0, "canonical state restore exists");
assert.ok(restoredHeaderIndex > restoreIndex && restoredHeaderIndex < pendingPhotoIndex, "authoritative counts render immediately after canonical restore");
assert.match(initialize, /FULL SAVED INSPECTION RESTORED/);
assert.doesNotMatch(initialize, /await\s+renderGallery\s*\(/, "gallery cannot block field startup");
assert.match(initialize, /renderGallery\(\)\.catch/);
assert.doesNotMatch(initialize, /await\s+Promise\.all\(\[loadParcels\(\), registerOfflineWorker\(\)\]\)/, "parcel/offline setup cannot block field startup");
assert.match(initialize, /Promise\.allSettled\(\[loadParcels\(\), registerOfflineWorker\(\)\]\)/);

const offlineWorker = extractFunction("registerOfflineWorker");
assert.doesNotMatch(offlineWorker, /renderSimpleHome\s*\(/, "offline worker completion cannot yank the user to another screen");
assert.match(offlineWorker, /renderSimpleHeader\s*\(/);

assert.match(sw, /if \(request\.mode === "navigate"\)[\s\S]*fetch\(request, \{ cache: "no-store" \}\)/, "navigation must request the current page from network");
assert.doesNotMatch(sw, /if \(request\.mode === "navigate"\)[\s\S]{0,500}fetch\(INDEX_URL\)/, "navigation cannot be pinned to a worker-version index URL");

console.log("PASS: v11 restores authoritative counts before nonessential work, does not block field startup on gallery/maps/offline setup, and cannot pin future Safari navigations to an old index.");
