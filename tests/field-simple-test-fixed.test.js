"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../field-simple-test-fixed");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const packageCode = fs.readFileSync(path.join(root, "inspection-package.js"), "utf8");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "BUTTON_INVENTORY.json"), "utf8"));

assert(app.includes('const APP_VERSION = "3.13.0-home-test.5.4"'));
assert(html.includes('content="3.13.0-home-test.5.4"'));
assert(worker.includes('"property-inspector-fixed-test-313-offline-v5-4"'));
for (const file of ["inspection-coaching.js", "automatic-context.js", "section-mapping.js", "inspection-package.js", "idb-recovery.js", "app.js"])
  assert(html.includes(`${file}?v=3.13.0-home-test.5.4`), `${file} must use the atomic shell version`);

for (const forbidden of ["propertyInspectorHomeTest313V1", "property-inspector-home-test-313-evidence", "property-inspector-home-test-313-pending-v1"])
  assert(!app.includes(forbidden), `fixed candidate must not use production test storage ${forbidden}`);
assert(app.includes('"propertyInspectorFixedTest313V1"'));
assert(app.includes('"property-inspector-fixed-test-313-evidence"'));
assert(worker.includes('key.startsWith("property-inspector-fixed-test-313-")'));
assert(!worker.includes('key.startsWith("property-inspector-home-test-313-")'));

for (const label of ["ADD NOTE", "SAVE NOTE", "CANCEL", "NOT YET SAVED", "NOTE SAVED", "RETRY SAVE", "WHY I MAPPED THIS SECTION", "WHY DID YOU MAP THIS SECTION?", "SAVE NOTE AND SECTION", "SAVE SECTION WITHOUT NOTE"])
  assert(app.includes(label), `ordinary note workflow must include ${label}`);
for (const purpose of ["POTENTIAL HOUSE OPENING", "POSSIBLE ADDITIONAL HOMESITE", "POSSIBLE PASTURE OR OPEN AREA", "CREEK OR WATER FEATURE", "ACCESS OR ENTRANCE", "VEGETATION / CLEARING AREA", "OTHER"])
  assert(app.includes(purpose), `section purposes must include ${purpose}`);
assert(!app.includes("OPTIONAL VOICE NOTE"), "active fixed workflow cannot offer voice-note capture");
assert(app.includes("VOICE RECORDING IS OFF"), "stale or legacy voice triggers must be non-recording");
assert(html.includes("Legacy Voice Evidence â€” Read Only"), "historical voice evidence remains explicitly read only");

for (const eventName of ["UI_ACTION_ATTEMPT", "UI_ACTION_SUCCEEDED", "UI_ACTION_FAILED"])
  assert(app.includes(eventName), `button diagnostic must log ${eventName}`);
assert(app.includes("ALL REQUIRED BUTTONS RESPONDED"));
assert(app.includes("DO NOT ENTER FIELD"));
assert(app.includes("fieldButtonCheckPassed"));
assert(html.includes("RELOAD LATEST APP"));
assert(html.includes("APP VERSION: 3.13.0-home-test.5.4"));
assert(html.includes("touch-action: manipulation"));

assert(packageCode.includes('zip.add("SECTION_NOTES.json"'));
assert(packageCode.includes('zip.add("UI_ACTION_LOG.json"'));
assert(packageCode.includes("section_note_text"));
assert(inventory.buttons.length >= 20);
for (const button of inventory.buttons) {
  for (const field of ["button_id", "visible_label", "screen", "event_handler", "required_state", "expected_result", "saving_behavior", "failure_behavior", "automated_test_name"])
    assert(Object.prototype.hasOwnProperty.call(button, field), `${button.button_id} lacks ${field}`);
}

process.stdout.write(`PASS: fixed candidate has isolated storage, ordinary notes, section-purpose notes, atomic shell protection, and ${inventory.buttons.length} inventoried field controls.\n`);

