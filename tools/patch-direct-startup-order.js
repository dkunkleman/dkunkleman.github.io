#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-4";
const TO = "3.13.0-home-test.5.1-safari-direct-5";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

let app = fs.readFileSync(appPath, "utf8");
let index = fs.readFileSync(indexPath, "utf8");
let sw = fs.readFileSync(swPath, "utf8");

app = replaceOnce(app, `const APP_VERSION = "${FROM}";`, `const APP_VERSION = "${TO}";`, "version");

// The visible GPS control reads `data`. It must never be installed before `data`
// has been initialized or Safari will stop startup on a temporal-dead-zone error.
app = replaceOnce(
  app,
  "\n  installVisibleGpsControl();\n\n  function captureAutomaticContext",
  "\n\n  function captureAutomaticContext",
  "remove premature GPS-control install"
);

app = replaceOnce(
  app,
  "  let data = emptyInspection();",
  "  let data = emptyInspection();\n  installVisibleGpsControl();",
  "install GPS control after inspection data exists"
);

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(
  sw,
  "property-inspector-home-test-313-direct-ed42-v4",
  "property-inspector-home-test-313-direct-ed42-v5",
  "cache version"
);

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Fixed startup ordering and built ${TO}`);
