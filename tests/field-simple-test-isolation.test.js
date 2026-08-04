"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "field-simple-test");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const packageCode = fs.readFileSync(path.join(root, "inspection-package.js"), "utf8");

for (const productionIdentifier of [
  "pearsonFieldTrackV3",
  "pearsonFieldTrackV2",
  "pearson-road-field-photos",
  "property-inspector-pending-photos-v1"
]) assert(!app.includes(productionIdentifier), `isolated app must not reference production storage ${productionIdentifier}`);

assert(app.includes('"propertyInspectorHomeTest313V1"'));
assert(app.includes('"property-inspector-home-test-313-evidence"'));
assert(app.includes('"property-inspector-home-test-313-pending-v1"'));
assert(worker.includes('"property-inspector-home-test-313-offline-v3"'));
assert(!worker.includes('startsWith("property-inspector-field-")'), "test worker cannot delete production caches");
assert(html.includes("SIMPLE FIELD TEST - PRODUCTION EVIDENCE IS SAFE"));
assert(html.includes("SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS"));
assert(html.includes("height: 120px"), "compact locator is capped at 120 pixels");
assert(html.includes("#simpleTopBar { position: static;"), "simple header must scroll away instead of covering the iPhone screen");
assert(!html.includes("body.simple-advanced-open #simpleAdvancedReturn { display: block; position: fixed;"), "simple return control must not float over content");
assert(app.includes('function restoreSimplePageScrolling()'), "simple workflow must repair any stale page scroll lock");
assert(app.includes('simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE")'), "an interrupted item must be preserved without trapping the inspector in its form");
assert(!app.includes('if (session.feature_type === "tree") setTimeout(() => { const field = form.elements.namedItem("circumference_in"); if (field) field.focus(); }, 0);'), "tree form must not force the iPhone keyboard over the screen");
for (const label of ["STEP 1 - GO TO ONE END OF THE ROAD FRONTAGE", "MARK FRONTAGE END", "START FRONTAGE WALK", "CROSSING - NO CULVERT NEEDED", "CROSSING - CULVERT NEEDED", "EXISTING CULVERT / CROSSING", "CROSSING - MAJOR WORK", "MARK OTHER FRONTAGE END", "STEP 3 - CHECK PARKING, UNLOADING, TURNING, OR STAGING"])
  assert(app.includes(label), `frontage workflow must show ${label}`);
assert(!app.includes("Are you safely stopped?"), "start must not ask a preliminary safety question");
assert(!app.includes("POSSIBLE VEHICLE ACCESS"), "generic possible-access terminology is prohibited");
assert(app.includes('surface_unit: "in"'), "Water must default to inches");
assert(packageCode.includes('zip.add("FRONTAGE_AND_CROSSING.json"'), "frontage and crossing analysis must be packaged");
for (const file of ["subject-parcel.geojson", "photo-points.geojson", "feature-points.geojson", "property-field-map.html", "printable-property-field-map.html"])
  assert(packageCode.includes(`zip.add("${file}"`), `${file} must be independently packaged`);

process.stdout.write("PASS: isolated storage, permanent escape, compact locator, explicit package maps, and production-cache protection are verified.\n");
