"use strict";

const assert = require("node:assert/strict");
const wet = require("../field-simple-test/wet-edge-mapping.js");

const inspection = {};
const model = wet.ensureModel(inspection);
assert(model.inspector_confirmations.some(item => item.statement.includes("Most observed standing water was approximately 2–4 inches")));
assert(model.inspector_confirmations.some(item => item.statement.includes("localized places were approximately 8 inches")));
assert(!model.inspector_confirmations.some(item => item.statement.includes("2–8 inches of standing water")), "superseded depth language must not survive");
assert(model.report_language.includes("Conditions beyond the inspected route remain unknown"));
assert(model.same_day_instruction.includes("do not repeat"));

const position = { lat: 30.49, lon: -87.09, accuracy_m: 4, heading_deg: 90, sequence: 1, time: "2026-08-04T12:00:00Z" };
const area = wet.startWetArea(inspection, { position });
assert.equal(area.wet_area_id, "WET-AREA-001");
const quick = wet.recordObservation(inspection, "DEPTH_4_IN", position);
const exact = wet.addExactDepth(inspection, { value_in: 3.5, measurement_tool: "Yardstick", bottom_reached: "Yes", position });
assert.equal(quick.quick_depth.label, "4 IN");
assert.equal(exact.exact_value, 3.5);
assert.equal(quick.exact_measurement_id, null, "exact and quick depth stay separate");
const stopped = wet.stopWithoutDryEdge(inspection, { position, reason: "Too deep or unsafe" });
assert.equal(stopped.conclusion, "DRY EDGE NOT FOUND WITHIN INSPECTED AREA");
assert.equal(stopped.open_boundary, true);
assert.equal(stopped.inferred_edge, null);
assert.equal(stopped.unvisited_extent_classification, "UNKNOWN");

const routeContext = { source_json_sha256: "abc", raw_gps_points: [{}, {}] };
const routeArea = wet.createAugust4ObservedSection(inspection, routeContext);
assert.equal(routeArea.completion_status, "SAVED_OPEN_OBSERVED_ROUTE_SECTION");
assert(routeArea.descriptions.includes("STANDING WATER MOSTLY 2–4 INCHES"));
assert(routeArea.descriptions.includes("LOCAL WATER APPROXIMATELY 8 INCHES"));
assert.equal(routeArea.open_boundary, true);
assert.equal(routeArea.source_reference_gps_point_count, 2);

process.stdout.write("PASS: corrected August 4 findings, separate exact/quick depth, open wet extent, and no repeated dry-ground search are verified.\n");
