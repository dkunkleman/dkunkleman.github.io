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
assert.equal(finish.section.inferred_edge.label, "APPROXIMATE INFERRED EDGE — NOT PHYSICALLY WALKED");
assert.equal(finish.section.walked_edge.length, 4, "raw walked points stay separate from the inferred edge");
assert(finish.section.approximate_acres > 2 && finish.section.approximate_acres < 4, "phone-GPS acreage is calculated");
assert.equal(finish.section.calculation_label, "APPROXIMATE — PHONE GPS, NOT A SURVEY");

const second = sections.startSection(inspection, {
  descriptions: ["MANY LARGE TREES"],
  method: "MARK_CORNERS",
  position: at(30.4920, -87.0900, 5)
});
assert.equal(second.section_id, "SECTION-002");
sections.markCorner(inspection, at(30.4920, -87.0895, 6));
sections.markCorner(inspection, at(30.4925, -87.0895, 7));
sections.markCorner(inspection, at(30.4925, -87.0900, 8));
finish = sections.finishSection(inspection, second.section_id, { completion: "CONNECT_BACK_TO_START" });
assert.equal(finish.section.marked_corners.length, 4);

const third = sections.startSection(inspection, {
  descriptions: ["UNSURE"], method: "WALK_REACHABLE_EDGE", position: at(30.4930, -87.0900, 9)
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

const app = fs.readFileSync(path.resolve(__dirname, "../field-simple-test/app.js"), "utf8");
for (const label of ["MAP THIS SECTION", "START WALKING THE EDGE", "LAND CHANGED HERE", "CANNOT WALK THE REST", "MAP THE NEXT SECTION", "ADD OR CORRECT DESCRIPTION"])
  assert(app.includes(label), `field UI must include ${label}`);
assert(!app.includes('simpleFieldButton("brush", "BRUSH", "brush")'), "repeated point-by-point Brush is removed from the default grid");

process.stdout.write("PASS: section IDs, raw GPS edges, explicit inference, acreage, corner/open methods, and append-only corrections are verified.\n");
