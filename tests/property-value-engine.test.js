"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ValueEngine = require("../field/property-value-engine.js");

function observation(id, type, latitude, longitude, links) {
  return {
    observation_id: id,
    observation_type: `field.${type}`,
    label: type,
    observed_at: "2026-08-03T14:00:00.000Z",
    evidence_classification: "Observed",
    gps_point_id: `gps-${id}`,
    gps: { latitude, longitude, accuracy_m: 4 },
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    value_driver_links: links,
    value_assessment_status: links.length ? "INSPECTOR_ASSESSED" : "NOT_ASSESSED",
    attachments: {
      nearest_photographs: [{ photo_id: `photo-${id}`, relationship: "direct" }],
      nearest_voice_notes: [{ voice_note_id: `voice-${id}`, relationship: "direct" }]
    }
  };
}

const inspection = {};
ValueEngine.ensureInspectionModel(inspection);
inspection.active_intended_use_scenario_id = "scenario-homesite";
inspection.active_value_driver_ids = ["water", "buildability"];
inspection.active_value_effect = "increase_cost";
inspection.active_value_magnitude = 4;
inspection.active_value_confidence = "high";
inspection.active_value_reason = "Standing water may require drainage and reduce usable building area.";
const links = ValueEngine.linksFromContext(ValueEngine.activeContext(inspection), "2026-08-03T14:00:00.000Z");
assert.equal(links.length, 2);
assert(links.every(link => link.assessment_source === "inspector_selected"));
const tradeoffLinks = ValueEngine.linksFromContext({ driver_ids: ["water"], effects: ["increase_value", "increase_cost"], magnitude: 4, confidence: "medium", reason: "The creek is an amenity that may also add constraints.", intended_use_scenario_id: "scenario-homesite" });
assert.deepEqual(tradeoffLinks.map(link => link.effect), ["increase_value", "increase_cost"], "one observation may preserve opposing value and cost effects");

const observations = [
  observation("wet-1", "wet", 30.49, -87.09, links),
  observation("homesite-1", "homesite", 30.4903, -87.0897, [{
    value_driver_id: "buildability", effect: "increase_value", magnitude: 5, confidence: "medium",
    inspector_reason: "The inspector identified a plausible candidate homesite.", assessment_source: "inspector_selected", intended_use_scenario_id: "scenario-homesite"
  }]),
  observation("tree-1", "tree", 30.4905, -87.0895, [{
    value_driver_id: "tree_preservation", effect: "increase_value", magnitude: 3, confidence: "high",
    inspector_reason: "A mature tree could strengthen homesite character if safely preserved.", assessment_source: "inspector_selected", intended_use_scenario_id: "scenario-homesite"
  }]),
  observation("legacy-1", "entrance", 30.4907, -87.0893, [])
];

const result = ValueEngine.buildValueEngine({
  observations,
  questions: [{ question_id: "q1", text: "Where can drainage leave the property?", status: "open", value_driver_ids: ["water"] }],
  propertyId: "Property-17",
  inspectionId: "inspection-value-test",
  activeIntendedUseScenarioId: "scenario-homesite",
  intendedUseScenarios: [{ scenario_id: "scenario-homesite", name: "Single-family homesite" }],
  heatMapEligibility: { eligible: true, status: "EVIDENCE_SUPPORTED", scenario_id: "scenario-homesite", evidence_density: { spatial_feature_count: 3, derived_effect_count: 3, coverage_classification_count: 1 } }
});

assert.equal(ValueEngine.VALUE_DRIVERS.length, 18, "the full value-driver vocabulary is stable");
assert.deepEqual(ValueEngine.EFFECTS.map(item => item.effect_id), ["increase_value", "decrease_value", "increase_cost", "decrease_cost", "increase_uncertainty", "reduce_uncertainty"]);
assert.equal(result.impacts.length, 4, "one impact is created for each confirmed observation-driver relationship");
assert.deepEqual(result.unassessed_observation_ids, ["legacy-1"]);
assert.deepEqual(result.unconfirmed_suggestions[0].suggested_value_driver_ids, ["access", "development_potential", "investment"]);
assert(!result.impacts.some(item => item.observation_id === "legacy-1"), "unconfirmed suggestions never enter findings");
assert.equal(result.rankings.top_10_cost_drivers[0].value_driver_id, "water");
assert(result.rankings.top_10_value_drivers.some(item => item.value_driver_id === "buildability"));
assert(result.rankings.top_10_risks.every(item => item.why && item.supporting_observation_ids.length));
assert(result.rankings.top_10_opportunities.every(item => item.remaining_uncertainty));
assert(result.rankings.top_10_unanswered_questions[0].cheapest_next_investigation);
assert(result.rankings.top_10_cheapest_next_investigations.every(item => item.why && item.decision_change));
assert.deepEqual(result.heat_maps.layers.map(layer => layer.label), [
  "Value Heat Map", "Cost Heat Map", "Risk Heat Map", "Opportunity Heat Map", "Beauty Heat Map",
  "Buildability Heat Map", "Tree Preservation Heat Map", "Water Heat Map"
]);
assert(result.heat_maps.layers.find(layer => layer.layer_id === "water").points.every(point => point.observation_id === "wet-1"));
assert.match(result.heat_maps.method, /No interpolation/);
assert(result.heat_maps.limitations.some(item => /unvisited/i.test(item)));

const html = ValueEngine.createHeatMapHtml(result.heat_maps);
assert.match(html, /Property Value Driver Heat Maps/);
assert.match(html, /evidence influence zones/);
assert.match(html, /Buildability Heat Map/);

const app = fs.readFileSync(path.join(__dirname, "../field/app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "../field/index.html"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../field/sw.js"), "utf8");
assert(app.includes('const APP_VERSION = "3.15.0"'));
assert(app.includes("value_driver_links") && app.includes("value_assessment_status"));
assert(index.includes('id="valueLens"') && index.includes('id="valueDriverChoices"'));
assert(worker.includes("property-value-engine.js?v=3.15.0") && worker.includes("v21"), "the value engine is available completely offline");

process.stdout.write("PASS: inspector-confirmed value impacts, six effect types, evidence rankings, uncertainty rules, all eight heat maps, and offline field controls are verified.\n");
