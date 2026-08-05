"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sections = require("../field-simple-test/section-mapping.js");

const inspection = {};
const at = (lat, lon, sequence) => ({ lat, lon, accuracy_m: 3, heading_deg: 90, sequence, time: `2026-08-04T12:00:${String(sequence).padStart(2, "0")}Z` });

const first = sections.startSection(inspection, {
  descriptions: ["MOSTLY 2–3-INCH BRUSH", "NO LARGE TREES OBSERVED"],
  method: "WALK_WHOLE_EDGE",
  position: at(30.4900, -87.0900, 1),
  source_planning_suggestion_id: "small-parcel-east"
});
assert.equal(first.section_id, "SECTION-001");
assert.equal(first.field_confirmation_status, "CONFIRMED_BY_INSPECTOR_AT_SECTION_START");
sections.appendWalkPoint(inspection, at(30.4900, -87.0890, 2));
sections.appendWalkPoint(inspection, at(30.4910, -87.0890, 3));
sections.appendWalkPoint(inspection, at(30.4910, -87.0900, 4));
let finish = sections.finishSection(inspection, first.section_id, { completion: "CONNECT_BACK_TO_START" });
assert.equal(finish.section.completion_status, "SAVED_WITH_INFERRED_EDGE");
assert(finish.section.inferred_edge, "an unwalked closing segment must remain explicit");
assert.equal(finish.section.inferred_edge.label, "INFERRED EDGE — NOT PHYSICALLY WALKED");
assert.equal(finish.section.walked_edge.length, 4, "raw walked points stay separate from the inferred edge");
assert(finish.section.approximate_acres > 2 && finish.section.approximate_acres < 4, "phone-GPS acreage is calculated");
assert.equal(finish.section.calculation_label, "APPROXIMATE — PHONE GPS, NOT A SURVEY");

const second = sections.startSection(inspection, {
  conditions: { large_trees: "MANY LARGE TREES", underbrush: "OPEN UNDERNEATH", travel_difficulty: "EASY TO WALK THROUGH", ground_and_water: "DRY AND FIRM" },
  method: "MARK_CORNERS",
  position: at(30.4920, -87.0900, 5)
});
assert.equal(second.section_id, "SECTION-002");
assert.deepEqual(second.conditions, { large_trees: "MANY LARGE TREES", underbrush: "OPEN UNDERNEATH", travel_difficulty: "EASY TO WALK THROUGH", ground_and_water: "DRY AND FIRM" });
sections.markCorner(inspection, at(30.4920, -87.0895, 6));
sections.markCorner(inspection, at(30.4925, -87.0895, 7));
sections.markCorner(inspection, at(30.4925, -87.0900, 8));
finish = sections.finishSection(inspection, second.section_id, { completion: "CONNECT_BACK_TO_START" });
assert.equal(finish.section.marked_corners.length, 4);

const third = sections.startSection(inspection, {
  descriptions: ["UNKNOWN"], method: "WALK_REACHABLE_EDGE", position: at(30.4930, -87.0900, 9)
});
sections.appendWalkPoint(inspection, at(30.4930, -87.0898, 10));
finish = sections.finishSection(inspection, third.section_id, { completion: "SAVE_OPEN_PARTIAL_EDGE" });
assert.equal(finish.section.completion_status, "SAVED_OPEN_PARTIAL_EDGE");
assert.equal(finish.section.outlined_section, null);

const correction = sections.addCorrection(inspection, first.section_id, ["MIXED BRUSH AND TREES", "FIRM GROUND"], "Inspector reviewed the boundary walk.");
assert.equal(correction.append_only, true);
assert.deepEqual(first.description_selections, ["MOSTLY 2–3-INCH BRUSH", "NO LARGE TREES OBSERVED"], "original descriptions remain unchanged");
assert.deepEqual(sections.effectiveDescriptions(first), ["MIXED BRUSH AND TREES", "FIRM GROUND"]);

const analysis = sections.analysisModel(inspection);
assert.equal(analysis.sections.length, 3);
assert(analysis.approximate_totals_by_description["MIXED BRUSH AND TREES"].approximate_acres > 0);
assert.equal(inspection.section_mapping.next_section_number, 4, "identifiers are never reused");

const separateConditions = {};
const brushOnly = sections.startSection(separateConditions, {
  conditions: { large_trees: "NO LARGE TREES OBSERVED", underbrush: "DENSE 2–3-INCH TANGLED BRUSH", travel_difficulty: "CANNOT TRAVEL WITHOUT CUTTING", ground_and_water: "GROUND UNKNOWN" },
  method: "PHOTO_VOICE_ONLY", position: at(30.4940, -87.0900, 11)
});
assert.equal(brushOnly.conditions.large_trees, "NO LARGE TREES OBSERVED");
assert.equal(brushOnly.conditions.travel_difficulty, "CANNOT TRAVEL WITHOUT CUTTING");
const mixedWet = sections.startSection({ section_mapping: { sections: [], next_section_number: 1 } }, {
  conditions: { large_trees: "MANY LARGE TREES", underbrush: "DENSE 2–3-INCH TANGLED BRUSH", travel_difficulty: "VERY DIFFICULT", ground_and_water: "STANDING WATER MOSTLY 2–4 INCHES" },
  method: "PHOTO_VOICE_ONLY", position: at(30.4941, -87.0901, 12)
});
assert.equal(mixedWet.conditions.ground_and_water, "STANDING WATER MOSTLY 2–4 INCHES");
const optionalGroups = sections.startSection({ section_mapping: { sections: [], next_section_number: 1 } }, { conditions: {}, method: "PHOTO_VOICE_ONLY", position: at(30.4942, -87.0902, 13) });
assert.equal(optionalGroups.description_selections.length, 0, "all four condition groups remain optional");

const laneInspection = {};
const lane = sections.startOpenAndRevealLane(laneInspection, { lane_type: "CREEK-INSPECTION LANE", position: at(30.49, -87.09, 14), planned_width_ft: 6, dominant_brush_diameter: "2–3 inches", standing_water: "present" });
assert.equal(lane.lane_id, "OPEN-REVEAL-001");
assert(lane.limitation.includes("does not drain"));
sections.finishOpenAndRevealLane(laneInspection, lane.lane_id, at(30.4901, -87.0899, 15));
assert.equal(lane.status, "START_AND_END_RECORDED");
assert(lane.approximate_length_ft > 0);

const app = fs.readFileSync(path.resolve(__dirname, "../field-simple-test/app.js"), "utf8");
for (const label of ["MAP THIS SECTION", "START / SAVE THIS SECTION", "LAND CHANGED HERE", "CANNOT WALK THE REST", "MAP THE NEXT SECTION", "ADD OR CORRECT DESCRIPTION", "OPEN AND REVEAL", "LARGE TREES", "UNDERBRUSH", "WALKING", "GROUND"])
  assert(app.includes(label), `field UI must include ${label}`);
assert(!app.includes('simpleFieldButton("brush", "BRUSH", "brush")'), "repeated point-by-point Brush is removed from the default grid");
assert(sectionMappingsHideLargeBrush(), "brush larger than 3 inches remains under Other rather than the primary property choices");

function sectionMappingsHideLargeBrush() {
  return !sections.PRIMARY_DESCRIPTIONS.includes("BRUSH LARGER THAN 3 INCHES") && sections.OTHER_DESCRIPTIONS.includes("BRUSH LARGER THAN 3 INCHES");
}

process.stdout.write("PASS: section IDs, raw GPS edges, explicit inference, acreage, corner/open methods, and append-only corrections are verified.\n");
