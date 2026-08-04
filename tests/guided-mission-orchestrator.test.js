"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Mission = require("../field/guided-mission-orchestrator.js");

const inspection = {
  property_id: "Property-17", inspection_id: "inspection-guided", started: null,
  markers: [], photos: [], measurements: [], feature_capture_sessions: [], repeat_stations: [], investigation_questions: [], inspection_areas: [], coverage_classifications: [],
  active_value_driver_ids: [], active_value_effects: []
};
Mission.ensureModel(inspection);
inspection.started = "2026-08-04T12:00:00.000Z";
const plan = Mission.createPlan(inspection, { template_name: "General Land Reconnaissance", user_action: "Start Inspection" });
assert.equal(plan.steps.length, 14);
assert.equal(plan.steps[0].step_type, "arrival_frontage");
assert.equal(plan.steps.find(step => step.step_type === "access_route").default_feature_button, "routeCondition", "access route uses a continuous route-condition segment instead of an isolated blocked point");
assert.deepEqual(plan.steps[0].required_evidence.map(item => item.label), ["Property from road", "Road looking left", "Road looking right", "Apparent entrance"]);
assert.equal(Mission.currentStep(inspection).title, "Arrival and road frontage");

Mission.attachEvidence(inspection, plan.steps[0].mission_step_id, "photo-road", plan.steps[0].required_evidence[0].mission_evidence_requirement_id);
assert.equal(plan.steps[0].required_evidence[0].status, "complete");
Mission.answerQuestion(inspection, plan.steps[0].mission_step_id, plan.steps[0].questions[0].mission_question_id, "Yes — safe shoulder", ["photo-road"]);
assert.equal(plan.steps[0].questions[0].status, "answered");

const beforeUnexpected = Mission.currentStep(inspection).mission_step_id;
Mission.attachEvidence(inspection, beforeUnexpected, "feature-unexpected-water");
assert.equal(Mission.currentStep(inspection).mission_step_id, beforeUnexpected, "unexpected features do not lose the current mission");

assert.throws(() => Mission.skipStep(inspection, beforeUnexpected, "unsafe", ""), /reason is required/);
Mission.skipStep(inspection, beforeUnexpected, "unsafe", "Traffic made road-facing photographs unsafe.");
assert.equal(inspection.mission_skip_records[0].reason, "Traffic made road-facing photographs unsafe.");

Mission.startStep(inspection, plan.steps[1].mission_step_id);
Mission.completeStep(inspection, plan.steps[1].mission_step_id, { limitations: ["Gate width not measured; recorded Unknown."] });
assert.equal(plan.steps[1].status, "complete");

inspection.feature_capture_sessions.push({ feature_session_id: "feature-open", status: "draft" });
inspection.markers.push({ id: "obs-no-photo", type: "wet", attributes: { feature_session_id: "feature-open" } });
inspection.photos.push({ id: "photo-unassigned" });
inspection.measurements.push({ measurement_id: "measurement-bad", unit: "", instrument: "", measurement_method: "" });
inspection.active_value_driver_ids = ["water"];
inspection.investigation_questions.push({ question_id: "q-open", status: "open" });
inspection.inspection_areas.push({ area_id: "area-1" });
inspection.coverage_classifications.push({ area_id: "area-unknown", status: "unknown" });
const finish = Mission.buildFinishReview(inspection);
assert(finish.issues.some(item => item.issue_type === "measurements_missing_units"));
assert(finish.issues.some(item => item.issue_type === "measurements_missing_methods"));
assert(finish.issues.some(item => item.issue_type === "active_value_lens"));
assert(finish.issues.some(item => item.issue_type === "photographs_without_direct_feature_relationships"));
const issue = finish.issues.find(item => item.issue_type === "measurements_missing_units");
assert.throws(() => Mission.resolveFinishIssue(inspection, finish.inspection_finish_review_id, issue.finish_issue_id, "mark_unknown", ""), /State why/);
Mission.resolveFinishIssue(inspection, finish.inspection_finish_review_id, issue.finish_issue_id, "mark_unknown", "Measurement could not be safely repeated before departure.");
assert.equal(issue.status, "resolved_honestly");

inspection.mission_voice_state.silent = false;
const prompt = Mission.nextVoicePrompt(inspection);
assert(prompt && prompt.text);
Mission.markPromptCompleted(inspection, prompt.prompt_key);
const next = Mission.nextVoicePrompt(inspection);
assert(!next || next.prompt_key !== prompt.prompt_key, "completed voice prompts do not repeat");
inspection.mission_voice_state.paused_for_recording = true;
assert.equal(Mission.nextVoicePrompt(inspection), null, "voice guidance pauses during voice recording");

const legacyMarker = { id: "pearson-original", type: "wet", attributes: {} };
const legacy = { started: "2026-08-03T02:00:00.000Z", markers: [legacyMarker] };
const before = JSON.stringify(legacyMarker);
Mission.ensureModel(legacy);
assert.equal(JSON.stringify(legacy.markers[0]), before);
assert.equal(legacy.guided_mission_legacy_status.status, "GUIDED_MISSION_NOT_AVAILABLE_AT_CAPTURE");
assert.equal(legacy.guided_mission_legacy_status.completion_status, "NO_RETROSPECTIVE_MISSION_STATUS");
assert.match(Mission.guidedAppendix(legacy), /NO_RETROSPECTIVE_MISSION_STATUS/);

const app = fs.readFileSync(path.join(__dirname, "../field/app.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "../field/index.html"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../field/sw.js"), "utf8");
assert(app.includes("showMissionDialog") && app.includes("buildFinishReview") && app.includes("mission_voice_state.paused_for_recording"));
assert(index.includes('id="inspectionMissionDialog"') && index.includes("MARK ROUTE CONDITION") && index.includes("Five-step feature routine"));
assert(worker.includes("guided-mission-orchestrator.js?v=3.16.1"));

process.stdout.write("PASS: default guided plan, arrival roles, mission progress, unexpected capture, honest skips, voice state, Finish Review, recovery model, and legacy non-fabrication are verified.\n");
