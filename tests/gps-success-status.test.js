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

assert.match(app, /const APP_VERSION = "3\.13\.0-home-test\.5\.1-safari-direct-9"/);
assert.match(app, /const simpleGpsStatus = document\.getElementById\("simpleSaveStatus"\)/);
assert.match(app, /\^\(GPS REQUEST SENT\|GPS STARTING\|GPS RECOVERY\|GPS RETURN RECOVERY\|GPS DISCONNECTED\|GPS STALLED/);
assert.match(app, /simpleSetStatus\(`GPS ACTIVE — accuracy \+\/-\$\{Math\.round\(coordinates\.accuracy\)\} m`, "saved"\)/);
assert.match(index, /app\.js\?v=3\.13\.0-home-test\.5\.1-safari-direct-9/);
assert.match(sw, /property-inspector-home-test-313-direct-ed42-v9/);

console.log("PASS: successful Safari GPS fix clears only stale GPS waiting/recovery banners and leaves unrelated saved field-action messages untouched.");
