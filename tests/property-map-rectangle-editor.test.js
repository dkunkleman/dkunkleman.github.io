"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("../pearson-road-map/property-map-core.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "pearson-road-map", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "pearson-road-map", "app.js"), "utf8");

assert.match(html, /data-edit="DRAW_RECTANGLE"[^>]*>DRAW RECTANGLE</, "simple rectangle button is missing");
assert.match(html, /data-edit="RESIZE_RECTANGLE"[^>]*>MOVE \/ RESIZE RECTANGLE</, "rectangle resize button is missing");
assert.match(html, /id="saveRectangle"[^>]*>SAVE RECTANGLE</, "rectangle save control is missing");
assert.match(html, /id="cancelRectangle"[^>]*>CANCEL</, "rectangle cancel control is missing");
assert.match(app, /rectangleHandlePositions/, "corner, side, and center handles are not implemented");
assert.match(app, /rectangle-move-handle/, "rectangle center-move handle is missing");
assert.match(app, /Core\.replaceFeatureGeometry\(state\.model,"proposals"/, "saved rectangle does not update only the editable proposal layer");

const bounds = Core.rectangleBoundsFromCorners([-87.1, 30.4], [-87.09, 30.41]);
assert.deepEqual(bounds, { west: -87.1, east: -87.09, south: 30.4, north: 30.41 });
const ring = Core.rectangleRing(bounds);
assert.equal(ring[0].length, 5, "rectangle ring must close");
assert.deepEqual(ring[0][0], ring[0][4], "rectangle ring must end at its first point");
assert.deepEqual(Core.rectangleBoundsFromGeometry({ type: "Polygon", coordinates: ring }), bounds);

const model = Core.createModel("test-property");
model.proposals.features.push({
  type: "Feature",
  id: "PROPOSAL-ZONE-001",
  geometry: { type: "Polygon", coordinates: Core.rectangleRing({ west: -87.2, east: -87.19, south: 30.3, north: 30.31 }) },
  properties: { proposal_zone_id: "PROPOSAL-ZONE-001", name: "Original" }
});
const sourceEvidenceBefore = JSON.stringify(model.source_evidence);
Core.replaceFeatureGeometry(
  model,
  "proposals",
  "PROPOSAL-ZONE-001",
  { type: "Polygon", coordinates: ring },
  { geometry_shape: "RECTANGLE" },
  "DRAW_OR_RESIZE_RECTANGLE"
);
assert.deepEqual(model.proposals.features[0].geometry.coordinates, ring);
assert.equal(model.proposals.features[0].properties.name, "Original", "geometry editing must preserve proposal content");
assert.equal(model.edit_history.at(-1).action, "DRAW_OR_RESIZE_RECTANGLE");
assert.equal(model.edit_history.at(-1).source_evidence_modified, false);
assert.equal(JSON.stringify(model.source_evidence), sourceEvidenceBefore, "rectangle editing must not modify source evidence");

Core.undo(model);
assert.notDeepEqual(model.proposals.features[0].geometry.coordinates, ring, "undo must restore the prior proposal rectangle");
assert.equal(JSON.stringify(model.source_evidence), sourceEvidenceBefore, "undo must not modify source evidence");

console.log("PASS: proposal rectangles can be placed, moved, resized, saved, canceled, and undone without changing field evidence.");
