"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Governance = require("../field/evidence-governance.js");
const EvidenceSets = require("../field/evidence-sets.js");

function photo(number, seconds, lat, lon) {
  return { id: `photo-${number}`, photo_number: `P${number}`, recorded_at: `2026-08-03T14:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.000Z`, time: `2026-08-03T14:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.000Z`, lat, lon, category: number >= 68 && number <= 72 ? "Wet" : "Tree" };
}

const photos = [];
for (let number = 44; number <= 163; number += 1) photos.push(photo(number, number, 30.4900 + (number - 68) * 0.000005, -87.0900 + (number - 68) * 0.000005));
photos.find(item => item.photo_number === "P44").associated_observation_id = "homesite-p44";
photos.find(item => item.photo_number === "P72").water = { water_type: "standing", water_depth_exact_in: 3, measurement_basis: "Measured", water_length_ft: 18, water_width_ft: 6 };
for (const number of [...Array.from({ length: 12 }, (_, index) => 107 + index), ...Array.from({ length: 5 }, (_, index) => 121 + index), ...Array.from({ length: 5 }, (_, index) => 132 + index), 143, 144, 145]) photos.find(item => item.photo_number === `P${number}`).water = { water_type: "creek_stream", water_behavior: "apparent_creek_channel", measurement_basis: number === 145 ? "Measured" : "Estimated", water_depth_exact_in: number === 145 ? 9 : null, water_width_ft: number === 145 ? 7 : null };

const inspection = {
  property_id: "property-pearson", inspection_id: "inspection-20260803", started: "2026-08-03T12:00:00.000Z", inspector_identity: "Daniel Kunkleman",
  markers: [
    { id: "entrance-p3", type: "entrance", button_label: "Road / Entrance", time: Governance.PEARSON_ENTRANCE_TIME, lat: 30.49, lon: -87.09 },
    { id: "homesite-p44", type: "homesite", button_label: "Potential Homesite", time: "2026-08-03T14:00:52.000Z", lat: photos[0].lat, lon: photos[0].lon }
  ],
  photos, voice_notes: [], corrections: [], evidence_sets: [], evidence_set_events: [], evidence_set_suggestions: []
};

Governance.ensureGovernanceModel(inspection, "2026-08-03T18:00:00.000Z");
const effective = Governance.buildEffectiveInspection(inspection);
assert(!effective.active.markers.some(item => item.id === "entrance-p3"), "accidental Entrance is excluded");
assert(!effective.active.markers.some(item => item.id === "homesite-p44"), "accidental Homesite near P44 is excluded");
const p44 = effective.active.photos.find(item => item.photo_number === "P44");
assert.equal(p44.category, "Water Measurement");
assert.equal(p44.associated_observation_id, null, "P44 is separated from the nearby Homesite source record");
assert.equal(p44.photo_meaning.measurement_status, "Measured");
assert.equal(inspection.photos.find(item => item.photo_number === "P44").category, "Tree", "P44 source metadata remains unchanged");

EvidenceSets.ensureEvidenceSetModel(inspection);
EvidenceSets.addPearsonSuggestions(inspection);
const subjectChange = EvidenceSets.detectSubjectChange({ photos: [photos.find(item => item.photo_number === "P67"), photos.find(item => item.photo_number === "P68")] });
assert.equal(subjectChange.prompt, "Are you starting a new subject?", "tree-to-water transition produces an inspector-confirmation prompt");
assert.equal(EvidenceSets.buildEffectiveEvidenceSets(inspection).length, 0, "suggestions never activate silently");
for (const id of ["pearson-p45-p47-hardwood", "pearson-p48-p50-hardwood", "pearson-p51-p53-pine", "pearson-p57-p59-pine-canopy", "pearson-p64-p65-pine", "pearson-p66-p67-hardwood", "pearson-p68-p72-water", "pearson-p73-transition"]) assert(inspection.evidence_set_suggestions.some(item => item.suggestion_id === id), `${id} is suggested`);
const creekSuggestion = inspection.evidence_set_suggestions.find(item => item.suggestion_id === "pearson-northwest-creek-corridor");
assert(creekSuggestion, "Northwest Creek / Flowing-Water Corridor is created as a pending suggestion");
assert.equal(creekSuggestion.status, "pending_inspector_confirmation", "Pearson creek candidates never activate silently");
assert.equal(creekSuggestion.photo_ids.length, 25, "only the requested P107-P118, P121-P125, P132-P136 and P143-P145 candidate sequence is proposed");
assert.deepEqual(creekSuggestion.suggested_photo_roles.find(item => item.photo_number === "P145").roles, ["Measurement", "Flow Evidence"]);
assert.deepEqual(creekSuggestion.suggested_photo_roles.find(item => item.photo_number === "P135").roles, ["Scenic Context"]);
assert.equal(creekSuggestion.suggested_photo_roles.find(item => item.photo_number === "P143").role, "Upstream view");
assert.equal(creekSuggestion.suggested_photo_roles.find(item => item.photo_number === "P144").role, "Downstream view");
assert.equal(creekSuggestion.suggested_context_photo_roles[0].photo_number, "P139");
assert.equal(creekSuggestion.suggested_context_photo_roles[0].role, "Adjacent Higher-Ground / Tree Context");
const puddleOneSuggestion = inspection.evidence_set_suggestions.find(item => item.suggestion_id === "pearson-p158-p159-shallow-puddle");
const puddleTwoSuggestion = inspection.evidence_set_suggestions.find(item => item.suggestion_id === "pearson-p162-p163-shallow-puddle");
assert.equal(puddleOneSuggestion.status, "pending_inspector_confirmation");
assert.deepEqual(puddleOneSuggestion.suggested_subject_details.preliminary_depth_range_in, { minimum: 3, maximum: 4 });
assert.deepEqual(puddleTwoSuggestion.suggested_subject_details.preliminary_depth_range_in, { minimum: 4, maximum: 5 });
assert.equal((inspection.measurements || []).length, 0, "approximate Pearson review ranges do not silently become measurements");
assert.throws(() => EvidenceSets.confirmSuggestion(inspection, puddleOneSuggestion.suggestion_id, "Daniel Kunkleman"), /inspector-confirmed exact measurement/, "exact depth is required before activating the first water group");
const confirmedPuddleOne = EvidenceSets.confirmSuggestion(inspection, puddleOneSuggestion.suggestion_id, "Daniel Kunkleman", { exact_value: 3.5, reached_true_endpoint: "Yes", approximately_aligned: "Yes", water_bottom_type: "Firm bottom" });
assert.equal(confirmedPuddleOne.subject_details.inspector_confirmed_depth_in, 3.5);
assert.equal(inspection.measurements[0].authoritative_value, 3.5);
assert.equal(inspection.measurements[0].photo_id, photos.find(item => item.photo_number === "P159").id);
assert.equal(photos.find(item => item.photo_number === "P159").water.structured_measurement_id, inspection.measurements[0].measurement_id);
assert.equal(puddleTwoSuggestion.status, "pending_inspector_confirmation", "the second puddle remains separate and pending");

const waterSet = EvidenceSets.confirmSuggestion(inspection, "pearson-p68-p72-water", "Daniel Kunkleman");
const waterSummary = EvidenceSets.summarizeEvidenceSet(inspection, waterSet);
assert.equal(waterSummary.photograph_count, 5, "five views describe one water subject");
assert.equal(waterSummary.photographs.find(item => item.photo_number === "P72").role, "Measurement");
assert(waterSummary.maximum_photo_separation_m <= 10, "water points remain within the reviewed local area");
assert.deepEqual(waterSummary.water.measured_depths, [{ depth_band: null, depth_exact_in: 3, basis: "Measured" }]);
assert.match(waterSummary.report_rule, /one subject/);

const treeSet = EvidenceSets.startEvidenceSet(inspection, { set_type: "Individual Tree", created_by: "Daniel Kunkleman", subject_details: { likely_species: "pine", species_confidence: "medium", dbh_in: 28, dbh_basis: "Measured" } });
assert(treeSet.tree_id.startsWith("tree:property-pearson:"), "individual tree receives a permanent property-level tree ID");
[[60, "Lower trunk to first fork"], [61, "Bark"], [62, "Base / ground"], [63, "Visible crown segment"]].forEach(([number, role]) => EvidenceSets.attachRecord(inspection, treeSet.evidence_set_id, "photo", `photo-${number}`, { photo_role: role }));
const finishedTree = EvidenceSets.finishEvidenceSet(inspection, treeSet.evidence_set_id);
assert.deepEqual(EvidenceSets.summarizeEvidenceSet(inspection, finishedTree).missing_high_value_views, []);

const obstructedPlan = EvidenceSets.treeEvidencePlan({ whole_tree_visibility: "No — canopy blocks it", purpose: "species identification" });
assert(!obstructedPlan.required_roles.includes("Whole tree"), "canopy obstruction never keeps whole-tree photography as a requirement");
assert(obstructedPlan.required_roles.includes("Connected branch") && obstructedPlan.required_roles.includes("Twig / terminal bud"), "adaptive sequence prioritizes safely obtainable identification evidence");
assert.equal(obstructedPlan.do_not_repeat_whole_tree_prompt, true, "the app does not repeatedly ask for an impossible whole-tree view");
assert.match(obstructedPlan.safety_rule, /Never cross water.*leave authorized property.*traffic/, "evidence coaching preserves field safety");

const obstructedTree = EvidenceSets.startEvidenceSet(inspection, { set_type: "Individual Tree", created_by: "Daniel Kunkleman", subject_details: { likely_species: "live oak", whole_tree_visibility: "No — canopy blocks it", whole_tree_visibility_reason: "No — canopy blocks it", purpose: "species identification" } });
EvidenceSets.addAiSpeciesSuggestion(inspection, obstructedTree.evidence_set_id, { likely_species: "live oak", alternative_species: ["laurel oak"], confidence_level: "medium", identifying_features_visible: ["bark", "leaf"], important_features_missing: ["fruit"] });
EvidenceSets.recordSpeciesDetermination(inspection, obstructedTree.evidence_set_id, "Possible", "live oak", "Daniel Kunkleman");
EvidenceSets.attachRecord(inspection, obstructedTree.evidence_set_id, "photo", "photo-64", { photo_role: "Leaf upper surface" });
EvidenceSets.recordLeafProvenance(inspection, obstructedTree.evidence_set_id, "photo-64", "Unsure", "Daniel Kunkleman");
const obstructedSummary = EvidenceSets.summarizeEvidenceSet(inspection, EvidenceSets.finishEvidenceSet(inspection, obstructedTree.evidence_set_id));
assert.equal(obstructedSummary.tree_identification.ai_species_suggestions[0].status, "AI suggestion — not confirmed", "AI never confirms its own species suggestion");
assert.equal(obstructedSummary.tree_identification.inspector_determinations[0].status, "Possible", "the inspector's explicit determination is distinct from AI output");
assert.equal(obstructedSummary.tree_identification.leaf_provenance[0].confidence, "Unsure", "unverified leaf provenance remains visible");
assert.match(obstructedSummary.tree_identification.confidence_limit, /whole-tree view was not safely obtainable/, "report explains the obtainable evidence and confidence limit without criticizing the inspector");

const forestPlan = EvidenceSets.treeEvidencePlan({ whole_tree_visibility: "No — nearby trees block it", purpose: "forest character" });
assert.deepEqual(forestPlan.required_roles, ["Lower trunk to first fork", "Context", "Surrounding canopy", "Relationship to surroundings"], "tree-group coaching captures forest character instead of demanding an impossible whole-tree photograph");

const creekPlan = EvidenceSets.flowingWaterEvidencePlan();
assert.deepEqual(creekPlan.required_roles, ["Upstream view", "Downstream view", "Across-channel view", "Creek / homesite or road relationship"]);
assert.match(creekPlan.safety_rule, /Do not cross the channel.*Do not stand in moving water/);
const confirmedCreek = EvidenceSets.confirmSuggestion(inspection, "pearson-northwest-creek-corridor", "Daniel Kunkleman");
const creekSummary = EvidenceSets.summarizeEvidenceSet(inspection, confirmedCreek);
assert.equal(creekSummary.photograph_count, 26, "the 25 candidate creek photos plus separately identified P139 context become one confirmed subject only after approval");
assert.deepEqual(creekSummary.photographs.find(item => item.photo_number === "P145").roles, ["Measurement", "Flow Evidence"]);
assert.equal(creekSummary.flowing_water_corridor.measured_depth_points[0].depth_in, 9);
assert.equal(creekSummary.flowing_water_corridor.measured_width_points[0].width_ft, 7);
assert.equal(creekSummary.flowing_water_corridor.report_classification, "Observed flowing-water corridor. Permanence, ordinary high-water limits, wetlands status, drainage rights and building setbacks remain unverified.");
assert(creekSummary.missing_high_value_views.includes("Across-channel view") && creekSummary.missing_high_value_views.includes("Voice explanation: why this water feature matters"), "missing high-value but safely optional evidence remains explicit");

const latestMarker = { id: "accidental-late", type: "homesite", button_label: "Potential Homesite", time: "2026-08-03T18:01:00.000Z", lat: 30.49, lon: -87.09 };
inspection.markers.push(latestMarker);
const undo = Governance.undoLastAction(inspection, { record_type: "observation", record_id: latestMarker.id, inspector_identity: "Daniel Kunkleman", corrected_at: "2026-08-03T18:01:12.000Z" });
assert.equal(undo.correction_reason, "user_undo");
assert.equal(undo.status, "voided");
assert.equal(undo.original_record_preserved, true);
assert.equal(Governance.recordStatus(inspection, "observation", latestMarker.id), "voided");
assert.equal(inspection.markers.at(-1), latestMarker, "undo does not delete or rewrite the source record");

const indexSource = fs.readFileSync(path.resolve(__dirname, "../field/index.html"), "utf8");
const appSource = fs.readFileSync(path.resolve(__dirname, "../field/app.js"), "utf8");
const workerSource = fs.readFileSync(path.resolve(__dirname, "../field/sw.js"), "utf8");
assert(indexSource.includes("UNDO LAST") && indexSource.includes("REVIEW / CORRECT RECORDS"), "large permanent undo and older-record controls are present");
assert(indexSource.includes("START PHOTO GROUP") && indexSource.includes("FINISH THIS SUBJECT") && indexSource.includes("Same subject?"), "glove-sized Evidence Set workflow is present");
assert(indexSource.includes("Can most of the tree be photographed safely and clearly?") && indexSource.includes("Leaf underside") && indexSource.includes("Professional identification requested"), "adaptive tree-identification controls are present");
assert(indexSource.includes("Flowing Water / Creek Corridor") && indexSource.includes("Do not cross the channel or stand in moving water") && indexSource.includes("Direction of flow"), "safe flowing-water corridor controls are present");
assert(appSource.includes("suggestRecentGroup") && appSource.includes("confirmSuggestion") && appSource.includes("Select which photos"), "automatic grouping remains a confirmable suggestion");
assert(workerSource.includes("evidence-sets.js?v=3.16.2"), "Evidence Sets are available offline");

process.stdout.write("PASS: Pearson standing-water, P158-P163 measurement, tree, and P107-P145 creek suggestions remain confirmation-gated; adaptive summaries, safety rules, permanent tree IDs, and append-only undo are verified.\n");
