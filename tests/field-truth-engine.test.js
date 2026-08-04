"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const FieldTruth = require("../field/field-truth-engine.js");

function position(lat = 30.49, lon = -87.09) { return { latitude: lat, longitude: lon, accuracy_m: 4, recorded_at: "2026-08-04T12:00:00.000Z" }; }

const legacyMarker = { id: "legacy-wet-1", type: "wet", time: "2026-08-03T12:00:00.000Z", lat: 30.49, lon: -87.09, attributes: {} };
const inspection = { inspection_id: "inspection-field-truth", property_id: "Property-17", markers: [legacyMarker] };
const originalLegacyBytes = JSON.stringify(legacyMarker);
FieldTruth.ensureInspectionModel(inspection);
assert.equal(JSON.stringify(inspection.markers[0]), originalLegacyBytes, "legacy evidence is not rewritten during model migration");
assert.equal(inspection.field_truth_migration.strategy, "NON_DESTRUCTIVE_NO_INVENTION");
assert.equal(inspection.field_truth_migration.legacy_observation_count, 1);

const scenario = FieldTruth.createScenario(inspection, { name: "Single-family homesite", customer_type: "Buyer" });
assert.equal(inspection.active_intended_use_scenario_id, scenario.scenario_id);
const mission = FieldTruth.createFieldMission(inspection, { decision: "Can equipment reach the homesite?", question: "Can construction equipment cross the roadside ditch?", requested_feature_types: ["access", "drainage_structure"] });
assert.equal(mission.information_class, "desktop_screening_hypothesis");

const wet = FieldTruth.startFeatureSession(inspection, { button_type: "wet", phone_location: position(), geometry_basis: "phone_location_only", question_ids: ["q-water"] });
FieldTruth.attachDirectEvidence(inspection, wet.feature_session_id, "observation", "obs-wet-1");
assert.throws(() => FieldTruth.saveMinimumSession(inspection, wet.feature_session_id, { water_feature_type: "Puddle", visible_water: "Yes", depth_status: "Measured", water_depth: "3" }), /water_depth_unit.*measurement_method.*measurement_basis/i, "measured depth requires unit, method, and basis");
FieldTruth.saveMinimumSession(inspection, wet.feature_session_id, { water_feature_type: "Puddle", visible_water: "Yes", depth_status: "Unknown", flow_status: "None", apparent_connection: "Isolated" });
FieldTruth.attachDirectEvidence(inspection, wet.feature_session_id, "photo", "photo-wet-1", { role: "Overview" });
FieldTruth.attachDirectEvidence(inspection, wet.feature_session_id, "voice_note", "voice-wet-1", { role: "Feature explanation" });
assert(FieldTruth.completeSession(inspection, wet.feature_session_id).direct_photographs[0].directly_attached, "session media are direct, not proximity-inferred");

const measured = FieldTruth.startFeatureSession(inspection, { button_type: "wet", phone_location: position(30.4902, -87.0898), geometry_basis: "at_feature" });
FieldTruth.attachDirectEvidence(inspection, measured.feature_session_id, "observation", "obs-wet-2");
FieldTruth.saveMinimumSession(inspection, measured.feature_session_id, { water_feature_type: "Ponded area", visible_water: "Yes", depth_status: "Measured", water_depth: "4.5", water_depth_unit: "in", measurement_method: "Ruler", measurement_basis: "Direct field measurement" });
FieldTruth.completeSession(inspection, measured.feature_session_id);

const tree = FieldTruth.startFeatureSession(inspection, { button_type: "tree", phone_location: position(30.4904, -87.0896), geometry_basis: "measured_offset", bearing_to_feature_deg: 90, distance_to_feature_m: 10, distance_method: "Laser rangefinder" });
FieldTruth.attachDirectEvidence(inspection, tree.feature_session_id, "observation", "obs-tree-1");
FieldTruth.saveMinimumSession(inspection, tree.feature_session_id, { tree_capture_type: "Individual tree", live_status: "Live", species_status: "Unknown", dbh_method: "Not measured" });
const ai = FieldTruth.addAiSuggestion(inspection, tree.feature_session_id, { likely_species: ["loblolly pine", "slash pine"], confidence: "medium" });
assert.equal(ai.information_class, "ai_suggestion");
assert.equal(FieldTruth.sessionById(inspection, tree.feature_session_id).structured_attributes.inspector_species, undefined, "AI never overwrites inspector species");
FieldTruth.completeSession(inspection, tree.feature_session_id);

const soil = FieldTruth.startFeatureSession(inspection, { button_type: "soilProbe", phone_location: position(), geometry_basis: "at_feature" });
FieldTruth.attachDirectEvidence(inspection, soil.feature_session_id, "observation", "obs-soil-1");
assert.throws(() => FieldTruth.saveMinimumSession(inspection, soil.feature_session_id, { owner_authorized: "Acknowledged", utility_safety_acknowledged: "Not acknowledged", purpose: "Reconnaissance", tool_used: "Hand auger" }), /both authorization.*safety/i);
FieldTruth.abandonDraftForLater(inspection, soil.feature_session_id, "Unsafe to proceed until utility safety is acknowledged");

const entrance = FieldTruth.startFeatureSession(inspection, { button_type: "entrance", phone_location: position(), geometry_basis: "phone_location_only" });
FieldTruth.attachDirectEvidence(inspection, entrance.feature_session_id, "observation", "obs-entry-1");
FieldTruth.saveMinimumSession(inspection, entrance.feature_session_id, { public_road_surface: "Paved", existing_entrance: "Yes", passability: "Pickup" });
assert(!JSON.stringify(entrance).includes('"legal_access":true'), "entrance observations never establish legal access");

const boundary = FieldTruth.startFeatureSession(inspection, { button_type: "boundary", phone_location: position(), geometry_basis: "phone_location_only" });
assert.match(boundary.warning, /Not a property corner/);
assert(!JSON.stringify(boundary).includes("survey_determination"));

const route = FieldTruth.startFeatureSession(inspection, { button_type: "routeCondition", phone_location: position(), geometry_basis: "walked_line" });
FieldTruth.attachDirectEvidence(inspection, route.feature_session_id, "observation", "obs-route-1");
FieldTruth.appendWalkedLinePoint(inspection, route.feature_session_id, { lat: 30.49, lon: -87.09, accuracy_m: 4, sequence: 1, time: "2026-08-04T12:00:00.000Z" });
FieldTruth.appendWalkedLinePoint(inspection, route.feature_session_id, { lat: 30.4902, lon: -87.0898, accuracy_m: 5, sequence: 2, time: "2026-08-04T12:00:10.000Z" });
FieldTruth.updateSessionGeometry(inspection, route.feature_session_id, { geometry_basis: "walked_line" });
assert.equal(route.geometry.feature_geometry.type, "LineString");
assert.equal(route.geometry.walked_points.length, 2, "route condition retains its continuous GPS segment through draft saves");
assert.throws(() => FieldTruth.saveMinimumSession(inspection, route.feature_session_id, { route_mode: "Walking" }), /passability/);
FieldTruth.saveMinimumSession(inspection, route.feature_session_id, { route_mode: "Walking", passability: "Passable with caution", current_width: "8 ft", surface: "Dirt", wetness: "Soft", cross_slope: "Slight" });
FieldTruth.completeSession(inspection, route.feature_session_id);

assert.throws(() => FieldTruth.appendDerivedValueEffect({ intended_use_scenarios: [] }, { supporting_evidence_ids: ["x"] }), /Intended Use Scenario/);
FieldTruth.appendDerivedValueEffect(inspection, { intended_use_scenario_id: scenario.scenario_id, value_driver: "Access", effect_type: "increases cost", supporting_evidence_ids: [entrance.feature_session_id], contradicting_evidence_ids: [], confidence: "medium", cheapest_next_investigation: "Measure the narrowest point", professional_determination_required: false });
assert.equal(inspection.derived_value_effects.length, 1);

assert.equal(FieldTruth.heatMapEligibility(inspection).status, "INSUFFICIENT_SPATIAL_EVIDENCE", "heat maps refuse sparse spatial evidence");
inspection.coverage_classifications.push({ area_id: "area-1", status: "well_inspected" });
inspection.derived_value_effects.push({ intended_use_scenario_id: scenario.scenario_id, supporting_evidence_ids: [wet.feature_session_id] }, { intended_use_scenario_id: scenario.scenario_id, supporting_evidence_ids: [tree.feature_session_id] });
assert.equal(FieldTruth.heatMapEligibility(inspection).status, "EVIDENCE_SUPPORTED");

const model = FieldTruth.packageModel(inspection);
assert.equal(model.feature_capture_sessions.length, 7);
assert(model.information_classes.includes("professional_determination") && model.information_classes.includes("remaining_unknown"));
assert(model.warnings.some(item => /legal access/i.test(item)));

const app = fs.readFileSync(path.join(__dirname, "../field/app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "../field/index.html"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../field/sw.js"), "utf8");
assert(app.includes('const APP_VERSION = "3.16.0"') && app.includes('openFeatureCaptureSession("routeCondition")'));
assert(index.includes('id="featureCaptureDialog"') && index.includes("SAVE MINIMUM RECORD") && index.includes('id="soilProbe"'));
assert(worker.includes("field-truth-engine.js?v=3.16.0") && worker.includes("v22"));

process.stdout.write("PASS: Field Truth sessions, geometry basis, direct evidence, measurement gates, scenario effects, professional limits, migration safety, and heat-map refusal are verified.\n");
