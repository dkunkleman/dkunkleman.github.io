"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const data = (name) => JSON.parse(fs.readFileSync(path.join(root, "pearson-road-map", "data", name), "utf8"));

const parcels = data("PEARSON_LARGE_SMALL_PARCELS.geojson");
const allPhotos = data("ALL_PHOTO_POINTS.geojson");
const waterPhotos = data("ALL_WATER_PHOTO_REVIEW.geojson");
const waterFindings = data("ALL_SUBJECT_WATER_FINDINGS.geojson");
const waterSections = data("ALL_WET_DRY_SECTION_LINES.geojson");
const sourceSections = data("ALL_MAPPED_SECTIONS.geojson");
const app = fs.readFileSync(path.join(root, "pearson-road-map", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "pearson-road-map", "index.html"), "utf8");

assert.equal(parcels.features.length, 2, "both county parcel components must be displayed");
assert.deepEqual(parcels.features.map((feature) => feature.properties.display_name), ["LARGE PARCEL", "SMALL PARCEL"]);
assert.deepEqual(parcels.features.map((feature) => feature.properties.source_ring_index), [0, 1]);

const sourcePhotoById = new Map(allPhotos.features.map((feature) => [feature.properties.photo_id, feature]));
const counts = {};
for (const reviewed of waterPhotos.features) {
  const source = sourcePhotoById.get(reviewed.properties.photo_id);
  assert.ok(source, `reviewed photograph ${reviewed.properties.photo_id} must exist in immutable source evidence`);
  assert.deepEqual(reviewed.geometry.coordinates, source.geometry.coordinates, "visual review must preserve exact photo coordinates");
  assert.equal(reviewed.properties.original_recorded_category, source.properties.recorded_category, "visual review must preserve the original category");
  assert.equal(reviewed.properties.original_evidence_modified, false);
  assert.ok(fs.existsSync(path.join(root, "pearson-road-map", reviewed.properties.thumbnail_path)), `reviewed photograph ${reviewed.properties.photo_id} must open from the published map package`);
  counts[reviewed.properties.water_review_class] = (counts[reviewed.properties.water_review_class] || 0) + 1;
}
assert.deepEqual(counts, { VISIBLE_WATER_IN_PHOTO: 114, POSSIBLE_WATER_IN_PHOTO: 9, RECORDED_WATER: 12 });
assert.equal(waterPhotos.features.length, 135);
assert.equal(waterFindings.features.length, 39);
assert.equal(waterSections.features.length, 13);

for (const displayed of waterSections.features) {
  const source = sourceSections.features.find((candidate) =>
    candidate.geometry.type === "LineString" &&
    candidate.properties.section_id === displayed.properties.section_id &&
    candidate.properties.source_file === displayed.properties.source_file &&
    candidate.properties.display_status === displayed.properties.display_status &&
    JSON.stringify(candidate.geometry.coordinates) === JSON.stringify(displayed.geometry.coordinates)
  );
  assert.ok(source, `displayed section ${displayed.properties.section_id} must have a source feature`);
  assert.deepEqual(displayed.geometry.coordinates, source.geometry.coordinates, "section display must preserve every source coordinate");
  assert.equal(displayed.properties.original_section_evidence_modified, false);
}

assert.match(html, /data-layer="waterPhotos" type="checkbox" checked/, "water photographs must be visible by default");
assert.match(html, /data-layer="waterSections" type="checkbox" checked/, "wet\/dry section lines must be visible by default");
assert.match(html, /id="waterReviewFilter" class="active"/, "water-photo gallery must be the initial photo collection");
assert.match(app, /function renderWaterPhotos\(\)/, "water-photo marker rendering is missing");
assert.match(app, /state\.map\.on\("mousemove", \(event\) => updateFilmstrip/, "desktop hover must update the geographic photo gallery");
assert.match(app, /pointFallsInsideSubjectParcel/, "both parcel components must drive subject-evidence visibility");

console.log("PASS: both parcel components, every reviewed water photograph, recorded water findings, and wet/dry section lines are preserved and interactive.");
