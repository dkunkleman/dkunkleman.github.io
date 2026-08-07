"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "field-simple-test", "app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "field-simple-test", "index.html"), "utf8");
const sw = fs.readFileSync(path.join(__dirname, "..", "field-simple-test", "sw.js"), "utf8");

new Function(app);
new Function(sw);
assert.match(app, /const APP_VERSION = "3\.13\.0-home-test\.5\.1-safari-direct-10"/);
assert.match(index, /app\.js\?v=3\.13\.0-home-test\.5\.1-safari-direct-10/);
assert.match(sw, /property-inspector-home-test-313-direct-ed42-v10/);

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

const snapshot = extractFunction("durableInspectionStateSnapshot");
assert.doesNotMatch(snapshot, /structuredClone\s*\(/, "state save must not make an extra whole-inspection structured clone before IndexedDB");
assert.doesNotMatch(snapshot, /JSON\.parse\s*\(\s*JSON\.stringify/, "state save must not make an extra whole-inspection JSON clone");
assert.match(snapshot, /return recovery;/, "IndexedDB is allowed to perform the single required durable clone");

const activate = extractFunction("activateSectionSession");
assert.doesNotMatch(activate, /saveState\s*\(/, "activateSectionSession must not perform the first of two full section-start saves");
assert.match(activate, /redraw\(\)/, "section session still updates the visible map");

const renderStart = extractFunction("renderSectionStart");
const handlerNeedle = 'document.getElementById("sectionStartWalking").addEventListener("click"';
const handlerStart = renderStart.indexOf(handlerNeedle);
assert.ok(handlerStart >= 0, "section start tap handler exists");
const handler = renderStart.slice(handlerStart);
const statusIndex = handler.indexOf("simpleSetStatus(tapPosition ?");
const renderIndex = handler.indexOf("renderSectionActive(section);");
const saveIndex = handler.indexOf("saveState();");
assert.ok(statusIndex >= 0 && renderIndex > statusIndex && saveIndex > renderIndex, "visible SECTION STARTED result must appear before the one durable state save is queued");
assert.equal((handler.match(/saveState\(\);/g) || []).length, 1, "section-start tap performs exactly one state save");

console.log("PASS: section start no longer double-saves or deep-clones the entire inspection on the Safari tap path.");
