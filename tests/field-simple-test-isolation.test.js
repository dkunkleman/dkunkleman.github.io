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
assert(worker.includes('"property-inspector-home-test-313-offline-v1"'));
assert(!worker.includes('startsWith("property-inspector-field-")'), "test worker cannot delete production caches");
assert(html.includes("SIMPLE FIELD TEST - PRODUCTION EVIDENCE IS SAFE"));
assert(html.includes("SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS"));
assert(html.includes("height: 120px"), "compact locator is capped at 120 pixels");
for (const file of ["subject-parcel.geojson", "photo-points.geojson", "feature-points.geojson", "property-field-map.html", "printable-property-field-map.html"])
  assert(packageCode.includes(`zip.add("${file}"`), `${file} must be independently packaged`);

process.stdout.write("PASS: isolated storage, permanent escape, compact locator, explicit package maps, and production-cache protection are verified.\n");

