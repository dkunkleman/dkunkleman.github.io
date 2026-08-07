"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Package = require("../field-simple-test/inspection-package.js");

async function main() {
  const root = path.resolve(__dirname, "..");
  const photoBytes = fs.readFileSync(path.join(root, "icon-192.png"));
  const parcelsText = fs.readFileSync(path.join(root, "field-simple-test", "assets", "parcels.json"), "utf8");
  const recordedAt = "2026-08-06T18:00:10.000Z";
  const pointOne = { sequence: 1, time: "2026-08-06T18:00:00.000Z", lat: 30.489, lon: -87.091, accuracy_m: 4, heading_deg: 90 };
  const pointTwo = { sequence: 2, time: recordedAt, lat: 30.4891, lon: -87.0909, accuracy_m: 5, heading_deg: 92, section_id: "SECTION-001", section_capture_status: "ACTIVE_EDGE_CAPTURE" };
  const photoMetadata = {
    id: "photo-export-test",
    photo_number: "P1",
    associated_marker_id: "event-photo-export-test",
    category: "Section context",
    note: "Export survival test photograph",
    evidence_classification: "Observed",
    recorded_at: recordedAt,
    time: recordedAt,
    lat: pointTwo.lat,
    lon: pointTwo.lon,
    gps_accuracy_m: pointTwo.accuracy_m,
    gps_position_at: pointTwo.time,
    compass_heading_deg: pointTwo.heading_deg,
    original_filename: "field-export-test.png",
    original_mime_type: "image/png",
    original_size_bytes: photoBytes.length,
    width_px: 192,
    height_px: 192,
    pixel_orientation: "square",
    section_id: "SECTION-001"
  };
  const marker = {
    id: "event-photo-export-test",
    source: "button_press",
    type: "photo",
    observation_type: "field.photo",
    taxonomy_version: "property-observation-1.0",
    evidence_classification: "Observed",
    button_label: "Photo",
    note: "Export survival test photograph",
    attributes: { section_id: "SECTION-001" },
    time: recordedAt,
    lat: pointTwo.lat,
    lon: pointTwo.lon,
    gps_accuracy_m: pointTwo.accuracy_m,
    gps_position_at: pointTwo.time,
    compass_heading_deg: pointTwo.heading_deg,
    photo_id: photoMetadata.id,
    voice_note_id: null,
    area_id: null,
    question_ids: [],
    question_links: []
  };
  const inspection = {
    schema_name: "property-intelligence-inspection",
    schema_version: "1.1",
    property_id: "parcel:221S280000001010000",
    inspection_id: "inspection-export-survival-test",
    started: "2026-08-06T18:00:00.000Z",
    stopped: null,
    points: [pointOne, pointTwo],
    markers: [marker],
    photos: [photoMetadata],
    voice_notes: [],
    lifecycle_events: [{ type: "inspection_started", time: "2026-08-06T18:00:00.000Z", source: "button_press" }],
    orientation_samples: [],
    conditions: { inspection_date: "2026-08-06", evidence_classification: "Observed" },
    investigation_questions: [],
    inspection_areas: [],
    active_question_ids: [],
    section_mapping: {
      schema_name: "property-intelligence-simple-section-mapping",
      schema_version: "1.1",
      next_section_number: 2,
      active_section_id: "SECTION-001",
      planning_suggestions: [],
      open_and_reveal_lanes: [],
      inspector_interpretations: [],
      sections: [{
        section_id: "SECTION-001",
        information_class: "OBSERVED_ON_SITE",
        description_selections: ["OPEN UNDERNEATH"],
        conditions: { large_trees: null, underbrush: "OPEN UNDERNEATH", travel_difficulty: null, ground_and_water: null },
        method: "WALK_WHOLE_EDGE",
        method_label: "WALK THE WHOLE EDGE",
        started_at: "2026-08-06T18:00:05.000Z",
        finished_at: null,
        completion_status: "ACTIVE",
        start: { latitude: pointTwo.lat, longitude: pointTwo.lon, gps_accuracy_m: pointTwo.accuracy_m, gps_position_at: pointTwo.time, recorded_at: pointTwo.time, source_gps_sequence: 2 },
        raw_walked_edge_points: [], marked_corners: [], walked_edge: [], inferred_edge: null, outlined_section: null,
        distance_walked_m: 0, photo_ids: [photoMetadata.id], voice_note_ids: [], corrections: [], events: []
      }]
    }
  };
  const photoEntries = [{
    id: photoMetadata.id,
    originalBlob: new Blob([photoBytes], { type: "image/png" }),
    analysisBlob: new Blob([photoBytes], { type: "image/png" })
  }];
  const mapContext = { parcelsText };

  const result = await Package.createInspectionPackage({
    inspection,
    photoEntries,
    voiceEntries: [],
    mapContext,
    packageMode: "full_archive",
    packageKind: "backup",
    appVersion: "3.13.0-home-test.5.3-safari-recovery-5",
    sourceUrl: "https://www.livelikecharliechallenge.org/field-simple-test/",
    exportId: "field-survival-export-test",
    exportedAt: "2026-08-06T18:01:00.000Z"
  });

  assert(result.blob instanceof Blob && result.blob.size > photoBytes.length, "a non-empty ZIP must be built");
  assert.equal(result.manifest.summary.gps_track_point_count, 2, "all captured GPS points are counted");
  assert.equal(result.manifest.summary.field_event_count, 1, "all saved field records are counted");
  assert.equal(result.manifest.summary.photo_count, 1, "the saved photograph is counted");
  assert.equal(result.manifest.summary.voice_note_count, 0, "voice-note count is exact");
  assert.equal(result.manifest.summary.original_photo_count, 1, "full archive contains the original photograph");
  assert.equal(result.manifest.summary.analysis_photo_count, 1, "full archive contains the analysis photograph");
  assert.equal(inspection.stopped, null, "building a package must not mutate the active inspection into a stopped inspection");
  assert.equal(pointOne.section_id, undefined, "an earlier GPS point remains unassigned to a later section");
  assert.equal(pointTwo.section_id, "SECTION-001", "section id remains attached only to the fix captured during the section");

  process.stdout.write("PASS: current field-simple package builds with exact GPS/record/photo counts without ending or relabeling the active inspection.\n");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
