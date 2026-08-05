"use strict";

const assert = require("node:assert/strict");
const review = require("../field-simple-test/property-review.js");

const inspection = {};
const model = review.ensureModel(inspection);
assert.equal(model.aerial_interpretations.length, 1);
const apple = model.aerial_interpretations[0];
assert(apple.selections.includes("MULTIPLE PROBABLE CREEK OR DRAINAGE CHANNELS"));
assert(apple.selections.includes("BRANCHING DRAINAGE NETWORK"));
assert.equal(apple.field_confirmation_status, "NOT_FIELD_CONFIRMED");
assert(apple.warning.includes("not open ground"));
assert.equal(apple.source_image.sha256, "304b8e025d7ef0d17437028b4282b8f55c67a4c579ca73027a1556badf8c6f46");
assert.equal(model.aerial_calibrations[0].status, "FIELD_CALIBRATED_PATTERN_NOT_UNIVERSALLY_CONFIRMED");
assert(model.aerial_calibrations[0].pattern_rule.includes("LIKELY_DENSE_2_TO_3_INCH_BRUSH"));
assert(model.aerial_calibrations[0].inspector_confirmation.includes("10–12-foot canopy"));
assert(model.aerial_pattern_classes.LIKELY_DENSE_2_TO_3_INCH_BRUSH.likely_field_meaning.includes("difficult to walk through"));
assert(model.aerial_pattern_classes.LIKELY_LARGER_TREES.travel_rule.includes("Do not infer travel difficulty"));
assert(model.aerial_pattern_classes.LIKELY_MIXED_BRUSH_AND_LARGER_TREES.likely_field_meaning.includes("large trees with dense small-brush understory"));
assert(model.controlling_inspector_observations.some(item => item.includes("can be easier to travel through")));
assert(model.controlling_inspector_observations.some(item => item.includes("would not resolve standing-water")));
assert.equal(model.interpretation_corrections[0].original_label, "TRAIL");
assert.equal(model.interpretation_corrections[0].current_label, "MARSHY CLEARING / WET LOW-VEGETATION AREA");
assert.equal(model.interpretation_corrections[0].original_label_status, "SUPERSEDED_AUDIT_ONLY");
assert.equal(model.aerial_area_interpretations.find(item => item.area_id === "AUGUST4-MARSHY-TRANSITION").field_confirmation_status, "CONFIRMED_BY_INSPECTOR");
assert.equal(model.aerial_area_interpretations.find(item => item.area_id === "EAST-OF-MAIN-CREEK").field_confirmation_status, "NOT_FIELD_CONFIRMED");
assert(model.report_conclusion.includes("does not establish dry or usable land"));
assert(model.aerial_pattern_classes.PROBABLE_CREEK_OR_DRAINAGE.primary_rule.includes("shape and continuity"));
assert(model.what_to_expect_today.some(item => item.includes("several winding creek or drainage channels")));
assert(model.what_to_expect_today.some(item => item.includes("No dry ground was reached")));

const trace = review.addAerialTrace(inspection, {
  trace_type: "PROBABLE CREEK BRANCH", confidence: "probable",
  coordinates: [[-87.09, 30.49], [-87.088, 30.491]]
});
assert.equal(trace.trace_id, "AERIAL-TRACE-001");
assert.equal(trace.source, "inspector-supplied Apple Maps screenshot");
assert.equal(trace.field_confirmation_status, "NOT_FIELD_CONFIRMED");
assert.equal(trace.not_a_survey, true);
assert.equal(trace.not_a_regulatory_wetland_determination, true);
assert.equal(trace.prediction_label, "PREDICTED FROM AERIAL IMAGE — CHECK ON THE GROUND");

const check = review.confirmPrediction(inspection, {
  aerial_trace_id: trace.trace_id,
  aerial_prediction: "LIKELY SMALLER BRUSH",
  answer: "YES — MOSTLY SMALL BRUSH",
  details: ["MOSTLY 2–3 INCHES", "NO BRUSH LARGER THAN 3 INCHES OBSERVED"],
  position: { lat: 30.49, lon: -87.09, accuracy_m: 4 }
});
assert.equal(check.agreement_status, "AGREES");
assert.equal(check.field_details.length, 2);
let immediate = review.addPredictionFieldChoice(inspection, { aerial_trace_id: trace.trace_id, choice: "DENSE 2–3-INCH TANGLED BRUSH", position: { lat: 30.49, lon: -87.09, accuracy_m: 4 } });
immediate = review.addPredictionFieldChoice(inspection, { field_prediction_check_id: immediate.field_prediction_check_id, aerial_trace_id: trace.trace_id, choice: "ABOUT 10–12 FOOT BRUSH CANOPY", position: { lat: 30.49, lon: -87.09, accuracy_m: 4 } });
immediate = review.addPredictionFieldChoice(inspection, { field_prediction_check_id: immediate.field_prediction_check_id, aerial_trace_id: trace.trace_id, choice: "VERY DIFFICULT", position: { lat: 30.49, lon: -87.09, accuracy_m: 4 } });
assert.equal(immediate.selection_events.length, 3, "each field choice saves as an append-only event");
assert.equal(immediate.agreement_status, "AGREES_OR_PARTLY_AGREES");
const eastern = review.addPredictionFieldChoice(inspection, { aerial_trace_id: trace.trace_id, aerial_prediction: "THINNER TREE CANOPY / LIKELY LOW BRUSH OR MARSH", choice: "MARSH / WET FLAT", position: { lat: 30.491, lon: -87.088, accuracy_m: 5 } });
assert.equal(eastern.agreement_status, "AGREES_OR_PARTLY_AGREES");

const stop = review.markStoppingPoint(inspection, { lat: 30.49, lon: -87.09, accuracy_m: 6 });
assert.equal(stop.condition_beyond, "UNKNOWN");
const later = review.addReturnObservation(inspection, "NO WATER BUT STILL SOFT", { lat: 30.49, lon: -87.09, accuracy_m: 5 });
assert.equal(later.comparison_route_date, "2026-08-04");

process.stdout.write("PASS: branching creek interpretation, uncertain light areas, separate traces, stopping point, and return comparison are verified.\n");
