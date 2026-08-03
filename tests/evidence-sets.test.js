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
for (let number = 44; number <= 73; number += 1) photos.push(photo(number, number, 30.4900 + (number - 68) * 0.000005, -87.0900 + (number - 68) * 0.000005));
photos.find(item => item.photo_number === "P44").associated_observation_id = "homesite-p44";
photos.find(item => item.photo_number === "P72").water = { water_type: "standing", water_depth_exact_in: 3, measurement_basis: "Measured", water_length_ft: 18, water_width_ft: 6 };

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
assert(indexSource.includes("Can you clearly photograph most of this tree from where you can safely stand?") && indexSource.includes("Leaf underside") && indexSource.includes("Professional identification requested"), "adaptive tree-identification controls are present");
assert(appSource.includes("suggestRecentGroup") && appSource.includes("confirmSuggestion") && appSource.includes("Select which photos"), "automatic grouping remains a confirmable suggestion");
assert(workerSource.includes("evidence-sets.js?v=3.9.0"), "Evidence Sets are available offline");

process.stdout.write("PASS: Pearson P44 correction, P45-P73 confirmation-gated suggestions, multi-photo summaries, permanent tree IDs, and append-only undo.\n");
