"use strict";

const assert = require("node:assert/strict");
const Governance = require("../field/evidence-governance.js");

const inspection = {
  started: "2026-08-03T12:00:00.000Z",
  conditions: { inspection_date: "2026-08-03" },
  inspector_identity: "Daniel Kunkleman",
  markers: [
    { id: "entrance-accidental", type: "entrance", observation_type: "field.entrance", button_label: "Road / Entrance", time: Governance.PEARSON_ENTRANCE_TIME, lat: 30.49, lon: -87.09 },
    { id: "wet-1", type: "wet", observation_type: "field.wet", button_label: "Wet", time: "2026-08-03T13:05:00.000Z", lat: 30.4901, lon: -87.0901 }
  ],
  photos: [
    { id: "photo-3", photo_number: "P3", category: "Other", recorded_at: "2026-08-03T13:05:05.000Z", lat: 30.4901, lon: -87.0901, photo_meaning: { evidence_roles: ["context", "evidence"] } },
    { id: "photo-4", photo_number: "P4", category: "Wet", recorded_at: "2026-08-03T13:05:10.000Z", lat: 30.4901, lon: -87.0901 }
  ],
  voice_notes: [{ id: "voice-1", started_at: "2026-08-03T13:05:15.000Z", lat: 30.4901, lon: -87.0901 }],
  inspection_areas: [{ area_id: "large", name: "Large Tract" }, { area_id: "road", name: "Road Frontage" }]
};

Governance.ensureGovernanceModel(inspection, "2026-08-03T16:00:00.000Z");
assert.equal(inspection.corrections.length, 1, "Pearson Entrance correction is added exactly once");
assert.equal(inspection.corrections[0].resulting_status, "voided");
assert.equal(inspection.corrections[0].original_entry.time, Governance.PEARSON_ENTRANCE_TIME);
assert.equal(inspection.inspector_hypotheses.length, 1, "Pearson drainage hypothesis is recorded separately");
assert.equal(inspection.inspector_hypotheses[0].factual_status, "NOT_AN_OBSERVED_FACT");
assert(inspection.inspector_hypotheses[0].verification_question.includes("right-of-way constraints"));

Governance.addCorrection(inspection, {
  correction_id: "correct-photo-category",
  record_type: "photo", record_id: "photo-3", correction_reason: "Wrong category",
  corrected_value: { category: "Wet", area_id: "road", clarification: "Shows pooled water beside the road." },
  inspector_identity: "Daniel Kunkleman", correction_time: "2026-08-03T16:01:00.000Z"
});
Governance.addCorrection(inspection, {
  correction_id: "void-voice",
  record_type: "voice_note", record_id: "voice-1", correction_reason: "Withdrawn",
  inspector_identity: "Daniel Kunkleman", correction_time: "2026-08-03T16:02:00.000Z"
});

const view = Governance.buildEffectiveInspection(inspection);
assert(!view.active.markers.some(item => item.id === "entrance-accidental"), "voided observation is excluded from active findings");
assert.equal(view.active.photos.find(item => item.id === "photo-3").category, "Wet", "corrected category is used by findings");
assert.equal(view.active.photos.find(item => item.id === "photo-3").area_id, "road", "corrected area is used by findings");
assert(!view.active.voice_notes.some(item => item.id === "voice-1"), "withdrawn voice note is excluded from findings");
assert.equal(view.audit_history.corrections.length, 3, "all corrections remain append-only in audit history");
assert.equal(inspection.photos[0].category, "Other", "original photo metadata was never rewritten");
assert.equal(inspection.photos[0].area_id, undefined, "original area assignment was never rewritten");

const pattern = Governance.photoPattern(view.active.photos.find(item => item.id === "photo-3"));
assert.deepEqual(pattern.present, ["context", "evidence"]);
assert.deepEqual(pattern.missing, ["measurement", "relationship"]);

const review = Governance.createFieldEvidenceReview(view.active);
assert(review.missing_measurements.includes("photo-3"));
assert(review.missing_context_photographs.includes("photo-4"));

const handoffs = Governance.createProfessionalHandoffCards(view.active, "printable-report.html");
assert.equal(handoffs.cards.length, 7);
assert(handoffs.cards.every(card => card.exact_question && card.expected_decision_change && card.limitation.includes("does not replace licensed professional work")));

const completedPearson = {
  property_id: "parcel:221S280000001010000", started: "2026-08-03T13:00:00.000Z", conditions: { inspection_date: "2026-08-03" }, inspector_identity: "Daniel Kunkleman", markers: [], voice_notes: [],
  photos: [
    { id: "prior-day-test-photo", photo_number: "TEST", recorded_at: "2026-08-02T20:00:00.000Z", lat: 30.49, lon: -87.09 },
    { id: "same-utc-day-local-prior-day-photo", photo_number: "P2", recorded_at: "2026-08-03T04:26:23.713Z", lat: 30.4902, lon: -87.0898 },
    { id: "photo-3", photo_number: "P3", recorded_at: "2026-08-03T13:00:00.000Z", lat: 30.4905, lon: -87.0895 },
    { id: "photo-196", photo_number: "P196", recorded_at: "2026-08-03T20:00:00.000Z", lat: 30.491, lon: -87.089 }
  ],
  points: [
    { time: "2026-08-02T20:00:00.000Z", lat: 30.49, lon: -87.09 },
    { time: "2026-08-03T04:26:23.713Z", lat: 30.4902, lon: -87.0898 },
    { time: "2026-08-03T20:00:00.000Z", lat: 30.491, lon: -87.089 }
  ]
};
Governance.ensureGovernanceModel(completedPearson, "2026-08-03T21:00:00.000Z");
const completedView = Governance.buildEffectiveInspection(completedPearson);
assert(!completedView.active.photos.some(photo => photo.id === "prior-day-test-photo"), "prior-day app-test photo is excluded from active findings");
assert(!completedView.active.photos.some(photo => photo.id === "same-utc-day-local-prior-day-photo"), "P3, not UTC midnight, separates the real field sequence from local-prior-day app testing");
assert.equal(completedView.active.points.length, 1, "prior-day app-test GPS is excluded from the active route");
assert.equal(completedView.audit_history.audit_only_gps_points.length, 2, "every pre-P3 GPS point remains permanently in audit history");
assert(completedView.audit_history.corrections.some(item => item.target.record_id === "prior-day-test-photo" && item.original_entry.id === "prior-day-test-photo"), "excluded photo original remains in immutable correction history");

process.stdout.write("PASS: immutable corrections, Pearson evidence correction/hypothesis, photo pattern review, and professional handoffs.\n");
