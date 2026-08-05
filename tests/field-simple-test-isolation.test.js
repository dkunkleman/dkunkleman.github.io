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
assert(worker.includes('"property-inspector-home-test-313-offline-v5"'));
assert(worker.includes('"./automatic-context.js?v=3.13.0-home-test.5"'));
assert(worker.includes('"./section-mapping.js?v=3.13.0-home-test.5"'));
assert(worker.includes('"./wet-edge-mapping.js?v=3.13.0-home-test.5"'));
assert(worker.includes('"./property-review.js?v=3.13.0-home-test.5"'));
assert(worker.includes('"./assets/august-4-route-context.json"'));
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
for (const label of ["LARGE TREES", "UNDERBRUSH", "WALKING", "GROUND", "DENSE 2–3 INCH TANGLED", "OPEN AND REVEAL"])
  assert(app.includes(label), `simple section workflow must include ${label}`);
for (const label of ["MARSHY CLEARING — APPROX. REACHED AREA", "PROBABLE MAIN CREEK", "PROBABLE CREEK BRANCH", "THINNER TREE CANOPY", "WHAT IS THE LIGHTER EASTERN AREA ACTUALLY LIKE?"])
  assert(app.includes(label) || fs.readFileSync(path.join(root, "property-review.js"), "utf8").includes(label), `corrected aerial workflow must include ${label}`);
assert(app.includes("The location reached during the August 4 walk was largely a marshy clearing, not a trail."));
assert(app.includes("Cutting brush does not drain or make soft or flooded ground usable."), "Open and Reveal must preserve the wet-ground limitation");
assert(packageCode.includes('zip.add("FRONTAGE_AND_CROSSING.json"'), "frontage and crossing analysis must be packaged");
assert(packageCode.includes('zip.add("MAPPED_SECTIONS.json"'), "mapped section analysis must be packaged");
assert(packageCode.includes('zip.add("mapped-sections.geojson"'), "mapped section geometry must be packaged");
for (const file of ["subject-parcel.geojson", "photo-points.geojson", "feature-points.geojson", "property-field-map.html", "printable-property-field-map.html"])
  assert(packageCode.includes(`zip.add("${file}"`), `${file} must be independently packaged`);

process.stdout.write("PASS: isolated storage, permanent escape, compact locator, explicit package maps, and production-cache protection are verified.\n");
