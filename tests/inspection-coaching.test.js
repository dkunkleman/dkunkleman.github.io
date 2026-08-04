"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Coaching = require("../field/inspection-coaching.js");

function near(value, expected, tolerance) {
  assert(Math.abs(value - expected) <= tolerance, `${value} should be within ${tolerance} of ${expected}`);
}

function main() {
  const started = "2026-08-03T13:00:00.000Z";
  const question = { question_id: "q-berm", text: "Does the road berm trap water?", created_at: started, status: "partially_answered", answer_summary: "Water is present behind the berm; outlet remains unknown.", confidence: 55 };
  const inspection = {
    inspection_id: "inspection-coaching-test",
    started,
    stopped: "2026-08-03T14:00:00.000Z",
    inspection_areas: [
      { area_id: "area-road", name: "Road Frontage", created_at: started },
      { area_id: "area-ridge", name: "South Ridge", created_at: started }
    ],
    active_area_id: "area-road",
    investigation_questions: [question],
    active_question_ids: [question.question_id],
    next_evidence_relationship: "supports",
    next_photo_value: "Critical",
    points: [
      { time: "2026-08-03T13:00:00.000Z", lat: 30.49, lon: -87.095, accuracy_m: 4 },
      { time: "2026-08-03T13:05:00.000Z", lat: 30.491, lon: -87.095, accuracy_m: 5 },
      { time: "2026-08-03T13:10:00.000Z", lat: 30.492, lon: -87.095, accuracy_m: 5 }
    ],
    markers: [
      { id: "obs-water", type: "wet", time: "2026-08-03T13:04:00.000Z", lat: 30.4908, lon: -87.095, evidence_classification: "Measured", attributes: { water_depth: "6", water_depth_unit: "inches" }, area_id: "area-road", question_ids: ["q-berm"], question_links: [{ question_id: "q-berm", relationship: "supports" }] },
      { id: "obs-dry", type: "dry", time: "2026-08-03T13:06:00.000Z", lat: 30.4912, lon: -87.095, evidence_classification: "Observed", attributes: {}, area_id: "area-road", question_ids: ["q-berm"], question_links: [{ question_id: "q-berm", relationship: "contradicts" }] }
    ],
    photos: [
      { id: "photo-water", recorded_at: "2026-08-03T13:04:05.000Z", lat: 30.4908, lon: -87.095, photo_value: "Critical", area_id: "area-road", question_ids: ["q-berm"], question_links: [{ question_id: "q-berm", relationship: "supports" }] }
    ],
    voice_notes: [
      { id: "voice-outlet", started_at: "2026-08-03T13:07:00.000Z", lat: 30.4914, lon: -87.095, area_id: "area-road", question_ids: ["q-berm"], question_links: [{ question_id: "q-berm", relationship: "context" }] }
    ]
  };

  const normalized = Coaching.ensureInspectionModel(inspection, started);
  assert.equal(normalized.markers.length, 2, "existing observations survive model initialization");
  assert.equal(normalized.photos.length, 1, "existing photographs survive model initialization");
  assert.equal(normalized.inspection_areas.length, 2, "named areas survive model initialization");
  assert.deepEqual(Coaching.evidenceContext(normalized), {
    area_id: "area-road",
    question_ids: ["q-berm"],
    question_links: [{ question_id: "q-berm", relationship: "supports" }]
  }, "new evidence inherits the selected area and question");

  const evidence = Coaching.evidenceForQuestion(normalized, "q-berm");
  assert.deepEqual(evidence.supporting_evidence_ids.sort(), ["obs-water", "photo-water"].sort());
  assert.deepEqual(evidence.contradicting_evidence_ids, ["obs-dry"]);
  assert.deepEqual(evidence.context_evidence_ids, ["voice-outlet"]);

  const rings = [[
    [-87.096, 30.489], [-87.09, 30.489], [-87.09, 30.495], [-87.096, 30.495], [-87.096, 30.489]
  ]];
  const coverage = Coaching.calculateCoverage({ points: normalized.points, rings, recordedAcres: 86.7, cellSizeM: 30 });
  assert.equal(coverage.status, "ESTIMATED");
  assert(coverage.well_inspected.percent > 0, "walked corridor is recognized");
  assert(coverage.not_inspected.percent > 0, "unvisited acreage is not implied inspected");
  near(coverage.well_inspected.percent + coverage.lightly_inspected.percent + coverage.not_inspected.percent, 100, 0.2);
  assert(coverage.unvisited_zone_centers.length > 0, "return route receives unvisited targets");
  assert(coverage.method.includes("does not prove visibility"), "coverage limitation is explicit");

  const brief = Coaching.createQuestionBrief(normalized);
  assert.equal(brief.questions.length, 1);
  assert.deepEqual(brief.questions[0].photo_ids, ["photo-water"]);
  assert.deepEqual(brief.questions[0].contradicting_evidence_ids, ["obs-dry"]);
  assert(brief.questions[0].conclusion_contract.includes("cheapest_next_investigation"));

  const review = Coaching.reviewMissingEvidence(normalized, coverage);
  assert.equal(review.measurements_still_missing.length, 0, "linked measured water depth satisfies the measurement prompt");
  assert(review.areas_without_evidence.some(area => area.area_id === "area-ridge"), "an area with no evidence is reported before leaving");
  assert.equal(review.ready_to_leave, false, "large unvisited coverage prevents false completion confidence");

  const efficiency = Coaching.calculateFieldEfficiency(normalized, 86.7);
  assert.equal(efficiency.questions_answered, 0);
  assert.equal(efficiency.questions_remaining, 1);
  assert.equal(efficiency.photographs_per_acre, 0.01);
  assert(Number.isFinite(efficiency.average_spacing_between_observations_m));
  assert(efficiency.methodology.includes("estimates"));

  const returnPlan = Coaching.createReturnVisitPlan(normalized, coverage, review);
  assert.equal(returnPlan.schema_name, "property-intelligence-return-visit-plan");
  assert(returnPlan.suggested_walking_route.waypoints.length > 0);
  assert(returnPlan.inspection_areas.some(area => area.name === "South Ridge"));

  const legacy = { points: [{ lat: 1, lon: 2 }], markers: [{ id: "old" }], photos: [{ id: "old-photo" }], voice_notes: [] };
  Coaching.ensureInspectionModel(legacy, started);
  assert.equal(legacy.markers[0].id, "old", "legacy records are never cleared or rewritten");
  assert.equal(legacy.photos[0].id, "old-photo", "legacy photo metadata survives coaching upgrade");
  assert.equal(legacy.inspection_areas[0].name, "Whole Property", "legacy inspections receive a non-destructive default area");

  const appSource = fs.readFileSync(path.resolve(__dirname, "../field/app.js"), "utf8");
  const indexSource = fs.readFileSync(path.resolve(__dirname, "../field/index.html"), "utf8");
  const workerSource = fs.readFileSync(path.resolve(__dirname, "../field/sw.js"), "utf8");
  assert(appSource.includes("question_links") && appSource.includes("area_id") && appSource.includes("photo_value"), "capture paths retain question, area, and photo-value metadata");
  assert(appSource.includes("showDepartureReview") && indexSource.includes("Before you leave the property"), "Finish Inspection runs the field-coaching review");
  assert(indexSource.includes("Well inspected") && indexSource.includes("Lightly inspected") && indexSource.includes("Not inspected"), "coverage modes are visible in the field UI");
  assert(workerSource.includes("field-truth-engine.js?v=3.16.0") && workerSource.includes("inspection-coaching.js?v=3.16.0") && workerSource.includes("water-intelligence.js?v=3.16.0") && workerSource.includes("evidence-governance.js?v=3.16.0") && workerSource.includes("evidence-sets.js?v=3.16.0") && workerSource.includes("timber-reconnaissance.js?v=3.16.0") && workerSource.includes("reviewed-property-synthesis.js?v=3.16.0") && workerSource.includes("authoritative-weather.js?v=3.16.0") && workerSource.includes("property-value-engine.js?v=3.16.0") && workerSource.includes("tree-identification-engine.js?v=3.16.0") && workerSource.includes("tree-network-engine.js?v=3.16.0"), "Field Truth, coaching, water intelligence, governance, Evidence Sets, timber reconnaissance, reviewed synthesis, authoritative weather, value, tree identification, and tree network work offline from the service-worker cache");

  process.stdout.write("PASS: inspection questions, named areas, evidence relationships, photo value, conservative coverage, missing-evidence review, return planning, and field-efficiency metrics are verified.\n");
}

main();
