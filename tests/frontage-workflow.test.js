"use strict";

const assert = require("node:assert/strict");
const frontage = require("../field-simple-test/frontage-workflow.js");

const inspection = {
  started: "2026-08-04T14:00:00.000Z",
  simple_counters: {},
  points: [
    { sequence: 1, lat: 30.4900, lon: -87.0900, time: "2026-08-04T14:00:00.000Z" },
    { sequence: 2, lat: 30.4901, lon: -87.0899, time: "2026-08-04T14:01:00.000Z" },
    { sequence: 3, lat: 30.4902, lon: -87.0898, time: "2026-08-04T14:02:00.000Z" }
  ]
};
const position = { lat: 30.4900, lon: -87.0900, accuracy_m: 4, time: "2026-08-04T14:00:00.000Z", heading_deg: 90 };
const orientation = { compass_heading_deg: 92, alpha_deg: 2, beta_deg: 3, gamma_deg: 4, absolute: true };

const model = frontage.ensureModel(inspection);
assert.equal(model.screen, "STEP_1");
assert.equal(model.parking_review_status, "NOT_STARTED", "parking cannot precede frontage review");

const firstEnd = frontage.createRecord(inspection, "frontage_end", position, orientation, { boundary_confidence: "APPROXIMATE_END_MARKED" }, "2026-08-04T14:00:10.000Z");
assert.equal(firstEnd.record_id, "FRONTAGE-END-001");
assert.equal(firstEnd.gps_accuracy_m, 4);
assert.equal(firstEnd.compass_heading_deg, 92);

frontage.beginFrontageWalk(inspection, 1, "2026-08-04T14:00:20.000Z");
const culvert = frontage.createRecord(inspection, "vehicle_crossing", position, orientation, { crossing_work_class: "CULVERT_APPARENTLY_NEEDED" }, "2026-08-04T14:01:00.000Z");
const noCulvert = frontage.createRecord(inspection, "vehicle_crossing", { ...position, lon: -87.0899 }, orientation, { crossing_work_class: "NO_CULVERT_APPARENTLY_NEEDED" }, "2026-08-04T14:01:30.000Z");
const major = frontage.createRecord(inspection, "vehicle_crossing", { ...position, lon: -87.0898 }, orientation, { crossing_work_class: "MAJOR_VISIBLE_WORK" }, "2026-08-04T14:02:00.000Z");
assert.deepEqual([culvert.record_id, noCulvert.record_id, major.record_id], ["VEHICLE-CROSSING-001", "VEHICLE-CROSSING-002", "VEHICLE-CROSSING-003"]);
assert.equal(culvert.attributes.crossing_work_class, "CULVERT_APPARENTLY_NEEDED", "the pressed button is the first saved answer");

frontage.createRecord(inspection, "ditch_change", position, orientation, {}, "2026-08-04T14:02:10.000Z");
frontage.createRecord(inspection, "frontage_end", { ...position, lon: -87.0897 }, orientation, { opposite_end: true }, "2026-08-04T14:03:00.000Z");
frontage.endFrontageWalk(inspection, 3, "MARKED", "2026-08-04T14:03:10.000Z");
const comparison = frontage.compareCrossings(inspection);
assert.equal(comparison.find(item => item.record_id === noCulvert.record_id).lowest_visible_work, true);
assert.match(comparison.find(item => item.record_id === culvert.record_id).limitations, /permitting/);
assert.match(comparison.find(item => item.record_id === major.record_id).limitations, /does not establish permission/);

const selection = frontage.selectProvisionalCrossing(inspection, "SELECTED_RECORDED_CROSSING", noCulvert.record_id, "2026-08-04T14:04:00.000Z");
assert.equal(selection.information_class, "INSPECTOR_INTERPRETATION");
assert.equal(selection.selected_crossing_id, "VEHICLE-CROSSING-002");
assert.equal(model.screen, "PARKING_REVIEW", "parking appears only after provisional comparison");

const parking = frontage.createRecord(inspection, "parking_staging", position, orientation, { classification: "PICKUP_PARKING", related_vehicle_crossing_id: noCulvert.record_id }, "2026-08-04T14:05:00.000Z");
assert.equal(parking.record_id, "PARKING-STAGING-001");
const analysis = frontage.analysisModel(inspection);
assert.equal(analysis.raw_frontage_walk_route.length, 3);
assert.equal(analysis.vehicle_crossing_options.length, 3);
assert.equal(analysis.parking_and_staging.length, 1);
assert.match(analysis.raw_route_limitation, /does not establish a surveyed frontage/);
assert(!JSON.stringify(analysis).includes("construction-ready"));

process.stdout.write("PASS: frontage-first arrival, immediate permanent crossing classes, evidence-only comparison, provisional interpretation, delayed parking, and route limitations are verified.\n");
