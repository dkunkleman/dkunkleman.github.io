#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-9";
const TO = "3.13.0-home-test.5.1-safari-direct-10";

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

// Safari already performs a structured clone when IndexedDB.put() runs.
// Do not make a second deep copy of the entire inspection in JavaScript first.
app = replaceOnce(
  app,
  '    return typeof structuredClone === "function" ? structuredClone(recovery) : JSON.parse(JSON.stringify(recovery));',
  '    return recovery;',
  "remove duplicate whole-inspection deep clone"
);

// Section-start currently saves inside activateSectionSession(), then the click
// handler saves the entire inspection again immediately afterward. Keep the UI
// mutation/redraw here; the click handler owns the single durable save.
const activateRange = findFunctionRange(app, "activateSectionSession");
let activateBody = app.slice(activateRange.start, activateRange.end);
activateBody = replaceOnce(
  activateBody,
  "    saveState(); redraw();\n    return session;",
  "    redraw();\n    return session;",
  "remove first of two section-start saves"
);
app = app.slice(0, activateRange.start) + activateBody + app.slice(activateRange.end);

// Give the inspector immediate visible confirmation before any durable-store
// work is queued. Then make exactly one state save for this section start.
app = replaceOnce(
  app,
  `        activateSectionSession(section, "FIELD_BUTTONS", tapPosition);\n        saveState();\n        simpleSetStatus(tapPosition ? \`${'${section.section_id}'} STARTED — GPS, time, accuracy, and heading saved\` : \`${'${section.section_id}'} SAVED — LOCATION PENDING; GPS is reconnecting\`, tapPosition ? "saved" : "warning");\n        renderSectionActive(section);`,
  `        activateSectionSession(section, "FIELD_BUTTONS", tapPosition);\n        simpleSetStatus(tapPosition ? \`${'${section.section_id}'} STARTED — GPS, time, accuracy, and heading saved\` : \`${'${section.section_id}'} SAVED — LOCATION PENDING; GPS is reconnecting\`, tapPosition ? "saved" : "warning");\n        renderSectionActive(section);\n        saveState();`,
  "show section result before single durable save"
);

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v9", "property-inspector-home-test-313-direct-ed42-v10", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Removed section-start memory spike and built ${TO}`);
