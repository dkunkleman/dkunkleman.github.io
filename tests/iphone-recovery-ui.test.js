"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "field/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "field/index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "field/sw.js"), "utf8");

assert(html.includes('id="finish" disabled>SEND THIS INSPECTION TO CHATGPT'));
assert(app.includes('finishInspection({ reviewed: true })'), "recovery export must not require unfinished forms or sessions to be completed");
assert(html.includes('id="sharePackage" hidden>SHARE ZIP'));
assert(html.includes('id="packageLink" class="button-link" hidden>SAVE TO FILES'));
assert(html.includes('id="copyPackageFilename" type="button" hidden>COPY FILENAME'));
assert(html.includes('id="returnFromPackage" type="button" hidden>RETURN TO INSPECTION'));
assert(html.includes('#packageReady:not([hidden]) { position: fixed; inset: 0; z-index: 500;'), "completed-package actions must cover the obstructing field workflow on iPhone");
assert(html.includes('id="clear" disabled>Clear unavailable until both packages are verified'));
assert(app.includes("clearBtn.disabled = true;"));
assert(app.includes('const photoDbName = "pearson-road-field-photos"'));
assert(app.includes("indexedDB.open(photoDbName, 3)"));
assert(!app.includes("indexedDB.deleteDatabase"));
assert(app.includes('const APP_VERSION = "3.16.1"'));
assert(worker.includes('property-inspector-field-2026-08-04-v23-recovery'));

process.stdout.write("PASS: the iPhone recovery export is one tap, full-screen, non-destructive, and Clear remains disabled.\n");
