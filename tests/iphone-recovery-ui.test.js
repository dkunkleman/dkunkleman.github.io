"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "field/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "field/index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "field/sw.js"), "utf8");

assert(html.includes('id="finish" disabled>SEND THIS INSPECTION TO CHATGPT'));
assert(html.includes('id="recoveryHome" aria-label="Saved inspection recovery" hidden'));
assert(html.includes('id="recoverySend" type="button">SEND THIS INSPECTION TO CHATGPT'));
assert(html.includes('id="recoveryFull" type="button">DOWNLOAD FULL PRESERVATION ARCHIVE'));
assert(app.includes("if (data.started) {") && app.includes("recoveryHome.hidden = false;"), "a saved inspection must open directly into the unobstructed recovery screen");
assert(app.includes('finishInspection({ reviewed: true })'), "recovery export must not require unfinished forms or sessions to be completed");
assert(html.includes('<h2>READY TO SEND</h2>'));
assert(html.includes('id="sharePackage" hidden>SEND ZIP NOW'));
assert(html.includes('id="packageLink" class="button-link" hidden>SAVE A BACKUP TO FILES'));
assert(html.includes('id="copyPackageFilename" type="button" hidden>COPY FILENAME'));
assert(html.includes('<details id="packageOtherOptions">'), "backup and filename controls stay available without competing with the primary send action");
assert(html.includes('id="returnFromPackage" type="button" hidden>RETURN TO INSPECTION'));
assert(html.includes('#packageReady:not([hidden]) { position: fixed; inset: 0; z-index: 500;'), "completed-package actions must cover the obstructing field workflow on iPhone");
assert(html.includes('id="clear" disabled>Clear unavailable until both packages are verified'));
assert(app.includes("clearBtn.disabled = true;"));
assert(app.includes('const photoDbName = "pearson-road-field-photos"'));
assert(app.includes("indexedDB.open(photoDbName, 3)"));
assert(!app.includes("indexedDB.deleteDatabase"));
assert(app.includes('const APP_VERSION = "3.16.3"'));
assert(worker.includes('property-inspector-field-2026-08-04-v25-simple-send'));
assert(app.includes('NEXT: Tap SEND ZIP NOW. On the next screen, tap Save to Dropbox. That is all.'), "the completed package gives one plain next step");

process.stdout.write("PASS: the iPhone recovery export is one tap, full-screen, non-destructive, and Clear remains disabled.\n");
