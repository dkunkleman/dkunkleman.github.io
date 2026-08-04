"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Package = require("../field/inspection-package.js");
const Repository = require("../repository/import-package.js");

function findEndOfCentralDirectory(bytes) {
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end-of-central-directory record not found.");
}

function extractStoredZip(bytes) {
  const eocd = findEndOfCentralDirectory(bytes);
  const count = bytes.readUInt16LE(eocd + 10);
  let centralOffset = bytes.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let index = 0; index < count; index += 1) {
    assert.equal(bytes.readUInt32LE(centralOffset), 0x02014b50, "central directory signature");
    const method = bytes.readUInt16LE(centralOffset + 10);
    const expectedCrc = bytes.readUInt32LE(centralOffset + 16);
    const size = bytes.readUInt32LE(centralOffset + 24);
    const nameLength = bytes.readUInt16LE(centralOffset + 28);
    const extraLength = bytes.readUInt16LE(centralOffset + 30);
    const commentLength = bytes.readUInt16LE(centralOffset + 32);
    const localOffset = bytes.readUInt32LE(centralOffset + 42);
    const name = bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString("utf8");
    assert.equal(method, 0, `${name} must use lossless ZIP store mode`);
    assert.equal(bytes.readUInt32LE(localOffset), 0x04034b50, `${name} local header signature`);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const payload = Buffer.from(bytes.subarray(dataOffset, dataOffset + size));
    assert.equal(Package.crc32(payload), expectedCrc, `${name} CRC-32`);
    files.set(name, payload);
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(files.size, count, "every central-directory member recovered");
  return files;
}

function distanceMeters(points) {
  const radians = Math.PI / 180;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const dLat = (b.lat - a.lat) * radians;
    const dLon = (b.lon - a.lon) * radians;
    const lat1 = a.lat * radians;
    const lat2 = b.lat * radians;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    total += 2 * 6371000 * Math.asin(Math.sqrt(h));
  }
  return total;
}

function jpegWithExifOrientation(value) {
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(value, 18);
  tiff.writeUInt32LE(0, 22);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(exif.length + 2, 0);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), length, exif, Buffer.from([0xff, 0xd9])]);
}

async function main() {
  const exifJpeg = jpegWithExifOrientation(6);
  const exifBuffer = exifJpeg.buffer.slice(exifJpeg.byteOffset, exifJpeg.byteOffset + exifJpeg.byteLength);
  assert.equal(Package.parseExifOrientation(exifBuffer), 6, "JPEG EXIF orientation is preserved");
  assert.equal(Package.orientationDescription(6), "rotated 90 degrees clockwise");
  const root = path.resolve(__dirname, "..");
  const photoOneBytes = fs.readFileSync(path.join(root, "icon-192.png"));
  const photoTwoBytes = fs.readFileSync(path.join(root, "icon-512.png"));
  const terrainBytes = fs.readFileSync(path.join(root, "field/assets/usgs-terrain.png"));
  const contourBytes = fs.readFileSync(path.join(root, "field/assets/usgs-contours-2ft.png"));
  const parcelsText = fs.readFileSync(path.join(root, "field/assets/parcels.json"), "utf8");
  const voiceBytes = Buffer.from("real voice-note byte recovery test\n", "utf8");
  const started = "2026-08-02T14:00:00.000Z";
  const points = [
    { time: "2026-08-02T14:00:01.000Z", lat: 30.4891, lon: -87.0941, accuracy_m: 3.2, altitude_m: 18.4, altitude_accuracy_m: 4.1, speed_mps: 1.1, heading_deg: 91, device_orientation: { alpha_deg: 269, beta_deg: 2, gamma_deg: -1 } },
    { time: "2026-08-02T14:00:16.000Z", lat: 30.4895, lon: -87.0932, accuracy_m: 2.9, altitude_m: 18.8, altitude_accuracy_m: 4.0, speed_mps: 1.2, heading_deg: 88, device_orientation: { alpha_deg: 272, beta_deg: 1, gamma_deg: -2 } },
    { time: "2026-08-02T14:00:31.000Z", lat: 30.4901, lon: -87.0922, accuracy_m: 3.5, altitude_m: 20.1, altitude_accuracy_m: 4.3, speed_mps: 1.0, heading_deg: 44, device_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0 } }
  ];
  const types = ["wet", "dry", "blocked", "high", "homesite", "culvert", "tree", "entrance", "thick", "open", "ditch", "timber", "hazard", "other", "wildlife", "note"];
  const markers = types.map((type, index) => ({
    id: `event-${index + 1}`,
    source: "button_press",
    type,
    observation_type: `field.${type}`,
    taxonomy_version: "property-observation-1.0",
    evidence_classification: type === "tree" ? "Measured" : "Observed",
    button_label: type === "tree" ? "Specimen Tree" : type,
    note: type === "note" ? "Standing water reaches the flagged pine." : "",
    attributes: type === "tree" ? { species: "live_oak", diameter_in: 38 } : (type === "wet" ? { water_depth: "1–3 inches", water_depth_basis: "Estimated", water_condition: "Still" } : {}),
    time: `2026-08-02T14:01:${String(index).padStart(2, "0")}.000Z`,
    lat: 30.4892 + (index * 0.00005),
    lon: -87.094 + (index * 0.00005),
    gps_accuracy_m: 3 + (index / 10),
    gps_position_at: points[0].time,
    compass_heading_deg: 90 + index,
    device_orientation: { alpha_deg: 270 - index, beta_deg: 1, gamma_deg: -1 },
    photo_id: null,
    voice_note_id: null
  }));
  markers.push({
    id: "thought-1", source: "inspector_reasoning", record_class: "inspector_thought", type: "thought", observation_type: "field.thought",
    taxonomy_version: "property-observation-1.0", evidence_classification: "Interpretation", button_label: "Inspector Thought",
    note: "I think the road berm may be causing this standing water.", attributes: {},
    time: "2026-08-02T14:02:30.000Z", lat: 30.48945, lon: -87.0933, gps_accuracy_m: 3.0,
    gps_position_at: points[1].time, compass_heading_deg: 87, device_orientation: { alpha_deg: 273, beta_deg: 1, gamma_deg: -2 },
    photo_id: null, voice_note_id: null
  });
  markers.push({
    id: "event-photo-1", source: "button_press", type: "photo", observation_type: "field.photo",
    taxonomy_version: "property-observation-1.0", evidence_classification: "Observed", button_label: "Photo", note: "Standing water at wet marker", attributes: { photo_number: "P1", category: "Wet", associated_observation_id: "event-1" },
    time: "2026-08-02T14:03:00.000Z", lat: 30.4895, lon: -87.0932, gps_accuracy_m: 2.9,
    gps_position_at: points[1].time, compass_heading_deg: 88, device_orientation: { alpha_deg: 272, beta_deg: 1, gamma_deg: -2 },
    photo_id: "photo-1", voice_note_id: null
  });
  markers.push({
    id: "event-photo-2", source: "button_press", type: "photo", observation_type: "field.photo",
    taxonomy_version: "property-observation-1.0", evidence_classification: "Observed", button_label: "Photo", note: "High-ground view", attributes: { photo_number: "P2", category: "High Ground", associated_observation_id: "event-4" },
    time: "2026-08-02T14:04:00.000Z", lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5,
    gps_position_at: points[2].time, compass_heading_deg: 44, device_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0 },
    photo_id: "photo-2", voice_note_id: null
  });
  markers.push({
    id: "event-voice-1", source: "button_press", type: "voice_note", observation_type: "field.voice_note",
    taxonomy_version: "property-observation-1.0", evidence_classification: "Observed", button_label: "Voice Note", note: "", attributes: { duration_ms: 4500 },
    time: "2026-08-02T14:05:00.000Z", lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5,
    gps_position_at: points[2].time, compass_heading_deg: 44, device_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0 },
    photo_id: null, voice_note_id: "voice-1"
  });

  const inspection = {
    schema_name: "property-intelligence-inspection",
    schema_version: "1.1",
    property_id: "parcel:221S280000001010000",
    inspection_id: "inspection-acceptance-test",
    started,
    stopped: "2026-08-02T15:00:00.000Z",
    inspection_areas: [
      { area_id: "area-northwest", name: "Large Tract – Northwest", created_at: started },
      { area_id: "area-road", name: "Road Frontage", created_at: started }
    ],
    active_area_id: "area-northwest",
    investigation_questions: [
      { question_id: "question-berm", text: "Does the road berm trap water?", created_at: started, status: "partially_answered", answer_summary: "Water was observed behind the berm; outlet remains unknown.", confidence: 60 },
      { question_id: "question-homesite", text: "Where is the best homesite?", created_at: started, status: "open", answer_summary: "", confidence: null }
    ],
    active_question_ids: ["question-berm"],
    next_evidence_relationship: "supports",
    next_photo_value: "Critical",
    lifecycle_events: [
      { type: "inspection_started", time: "2026-08-02T14:00:00.000Z", source: "button_press" },
      { type: "inspection_finished", time: "2026-08-02T15:00:00.000Z", source: "button_press" }
    ],
    points,
    markers,
    orientation_samples: [{ time: "2026-08-02T14:00:05.000Z", alpha_deg: 270, beta_deg: 1, gamma_deg: -1, absolute: true, compass_heading_deg: 90, compass_accuracy_deg: 5, lat: 30.4891, lon: -87.0941, gps_accuracy_m: 3.2 }],
    conditions: { inspection_date: "2026-08-02", weather_summary: "Cloudy", rainfall_previous_24_hours: "2 inches", rainfall_previous_7_days: "3.1 inches", rainfall_previous_30_days: "6 inches", temperature: "84 F", ground_condition: "Mixed", rain_during_inspection: "no", evidence_classification: "Estimated" },
    weather_context: { named_event: "Test storm", event_dates: "2026-07-31 to 2026-08-01", days_between_event_and_inspection: "1", authoritative_rainfall_totals: "2.0 inches at Test Station", weather_station_distance_from_parcel: "8 miles", inspector_reported_recent_local_rain: "Heavy rain reported locally", potentially_relevant_mechanism: "rainfall" },
    photos: [
      { id: "photo-1", photo_number: "P1", associated_marker_id: "event-photo-1", associated_observation_id: "event-1", category: "Wet", note: "Standing water at wet marker", evidence_classification: "Observed", observation_attributes: { water_depth: "1–3 inches", water_depth_basis: "Estimated" }, explanation_voice_note_id: "voice-1", explanation_voice_note_ids: ["voice-1"], water_confirmation: "yes", water: { water_type: "standing", water_depth_band: "1-3_inches", measurement_basis: "Estimated", water_width_ft: 3, water_length_ft: 5, water_behavior: "isolated_depression", significance: "Minor localized depression" }, camera_opened_at: "2026-08-02T14:02:55.000Z", recorded_at: "2026-08-02T14:03:00.000Z", source_file_last_modified_at: "2026-08-02T14:03:00.000Z", lat: 30.4895, lon: -87.0932, gps_accuracy_m: 2.9, gps_position_at: points[1].time, gps_position_age_ms: 100, location_source: "live_browser_geolocation", compass_heading_deg: 88, sensor_orientation: { alpha_deg: 272, beta_deg: 1, gamma_deg: -2, absolute: true }, device_screen_orientation: "portrait-primary", device_screen_angle_deg: 0, width_px: 192, height_px: 192, pixel_orientation: "square", exif_orientation: 1, exif_orientation_description: "normal", original_filename: "field-one.png", original_mime_type: "image/png", original_size_bytes: photoOneBytes.length },
      { id: "photo-2", photo_number: "P2", associated_marker_id: "event-photo-2", associated_observation_id: "event-4", category: "High Ground", note: "High-ground view", evidence_classification: "Observed", observation_attributes: {}, camera_opened_at: "2026-08-02T14:03:55.000Z", recorded_at: "2026-08-02T14:04:00.000Z", source_file_last_modified_at: "2026-08-02T14:04:00.000Z", lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5, gps_position_at: points[2].time, gps_position_age_ms: 150, location_source: "live_browser_geolocation", compass_heading_deg: 44, sensor_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0, absolute: true }, device_screen_orientation: "landscape-primary", device_screen_angle_deg: 90, width_px: 512, height_px: 512, pixel_orientation: "square", exif_orientation: 6, exif_orientation_description: "rotated 90 degrees clockwise", original_filename: "field-two.png", original_mime_type: "image/png", original_size_bytes: photoTwoBytes.length }
    ],
    voice_notes: [{ id: "voice-1", purpose: "photo_explanation", photo_id: "photo-1", prompt: "Why did you take this picture?", started_at: "2026-08-02T14:05:00.000Z", finished_at: "2026-08-02T14:05:04.500Z", duration_ms: 4500, mime_type: "audio/mp4", size_bytes: voiceBytes.length, lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5, gps_position_at: points[2].time, compass_heading_deg: 44, sensor_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0, absolute: true }, recovered_after_interruption: false }]
  };
  inspection.markers.forEach(marker => {
    marker.area_id = marker.type === "entrance" ? "area-road" : "area-northwest";
    marker.question_ids = marker.type === "wet" || marker.type === "ditch" || marker.type === "photo" || marker.type === "voice_note" ? ["question-berm"] : [];
    marker.question_links = marker.question_ids.map(questionId => ({ question_id: questionId, relationship: marker.type === "dry" ? "contradicts" : "supports" }));
  });
  inspection.photos[0].area_id = "area-northwest";
  inspection.photos[0].question_ids = ["question-berm"];
  inspection.photos[0].question_links = [{ question_id: "question-berm", relationship: "supports" }];
  inspection.photos[0].photo_value = "Critical";
  inspection.photos[1].area_id = "area-northwest";
  inspection.photos[1].question_ids = ["question-homesite"];
  inspection.photos[1].question_links = [{ question_id: "question-homesite", relationship: "context" }];
  inspection.photos[1].photo_value = "Helpful";
  inspection.voice_notes[0].area_id = "area-northwest";
  inspection.voice_notes[0].question_ids = ["question-berm"];
  inspection.voice_notes[0].question_links = [{ question_id: "question-berm", relationship: "supports" }];
  inspection.evidence_sets = [{ schema_name: "property-intelligence-evidence-set", schema_version: "1.0", evidence_set_id: "evidence-set-test", property_id: inspection.property_id, inspection_id: inspection.inspection_id, set_type: "Other", label: "Test multi-view subject", created_at: started, created_by: "Field Inspector", status: "active", relationship_basis: "inspector_started_subject", inspector_confirmed: true, tree_id: null, subject_details: {}, original_definition_preserved: true }];
  inspection.evidence_set_events = [
    { event_id: "set-start", evidence_set_id: "evidence-set-test", event_type: "set_started", recorded_at: started, immutable: true },
    { event_id: "set-photo-1", evidence_set_id: "evidence-set-test", event_type: "record_attached", record_type: "photo", record_id: "photo-1", photo_role: "Context", inspector_confirmed: true, recorded_at: "2026-08-02T14:03:01.000Z", immutable: true },
    { event_id: "set-photo-2", evidence_set_id: "evidence-set-test", event_type: "record_attached", record_type: "photo", record_id: "photo-2", photo_role: "Relationship to surroundings", inspector_confirmed: true, recorded_at: "2026-08-02T14:04:01.000Z", immutable: true },
    { event_id: "set-finish", evidence_set_id: "evidence-set-test", event_type: "set_finished", finished_at: "2026-08-02T14:04:02.000Z", recorded_at: "2026-08-02T14:04:02.000Z", inspector_confirmed: true, immutable: true }
  ];
  inspection.evidence_set_suggestions = [];

  const basePhotoEntries = [
    { id: "photo-1", originalBlob: new Blob([photoOneBytes], { type: "image/png" }), analysisBlob: new Blob([photoOneBytes], { type: "image/png" }) },
    { id: "photo-2", originalBlob: new Blob([photoTwoBytes], { type: "image/png" }), analysisBlob: new Blob([photoTwoBytes], { type: "image/png" }) }
  ];
  const baseVoiceEntries = [{ id: "voice-1", audioBlob: new Blob([voiceBytes], { type: "audio/mp4" }) }];
  const baseMapContext = {
    terrainBlob: new Blob([terrainBytes], { type: "image/png" }),
    contourBlob: new Blob([contourBytes], { type: "image/png" }),
    parcelsText
  };
  const result = await Package.createInspectionPackage({
    inspection,
    photoEntries: basePhotoEntries,
    voiceEntries: baseVoiceEntries,
    mapContext: baseMapContext,
    appVersion: "test",
    sourceUrl: "https://example.test/field/",
    packageMode: "full_archive",
    exportId: "export-full-test",
    exportedAt: "2026-08-02T15:00:01.000Z"
  });

  assert.equal(result.blob.type, "application/zip");
  assert.match(result.fileName, /^Pearson_Road_Inspection_FULL_ARCHIVE_\d{4}-\d{2}-\d{2}_\d{6}_\d{3}_export_full_test\.zip$/);
  const zipBytes = Buffer.from(await result.blob.arrayBuffer());
  if (process.env.INSPECTION_TEST_OUTPUT) fs.writeFileSync(process.env.INSPECTION_TEST_OUTPUT, zipBytes);
  const files = extractStoredZip(zipBytes);
  const requiredFiles = [
    "AI_README.md", "AI_ANALYSIS.json", "DECISION_BRIEF.json", "QUESTION_BRIEF.json", "FIELD_COACHING.json", "FIELD_EVIDENCE_REVIEW.json", "EVIDENCE_AUDIT_HISTORY.json", "EVIDENCE_SETS.json", "POST_INSPECTION_REVIEW.json", "WEATHER_CONTEXT.json", "FLOWING_WATER_CORRIDORS.json", "CHAT_REVIEW_RETURN_INSTRUCTIONS.md", "schemas/property-intelligence-review-annotation.schema.json", "PROFESSIONAL_HANDOFF_CARDS.json", "PROFESSIONAL_HANDOFF_CARDS.md", "professional-handoff-cards.html", "RETURN_VISIT_PLAN.json", "REPORT_TEMPLATE.md", "INSPECTOR_THOUGHTS.md", "INSPECTOR_HYPOTHESES.md", "EVIDENCE_RELATIONSHIPS.json", "SUGGESTED_INSPECTION_QUESTIONS.md",
    "README.txt", "chatgpt-reconstruction.json", "repository-import.json", "repository-comparison.json", "schema.json", "inspection.json", "events.csv", "observations.csv", "photos.csv", "photo_index.json", "printable-report.html", "voice-notes.csv",
    "track.geojson", "track.gpx", "context/map-context.json", "context/parcels.geojson",
    "context/parcels.arcgis.json", "context/usgs-terrain.png", "context/usgs-contours-2ft.png",
    "photos/001_original.png", "photos/001_analysis.png", "photos/002_original.png",
    "photos/002_analysis.png", "voice-notes/001_voice-note.m4a"
  ];
  requiredFiles.forEach(name => assert(files.has(name), `${name} must be in the one-file package`));

  assert.deepEqual(files.get("photos/001_original.png"), photoOneBytes, "photo 1 original bytes recovered exactly");
  assert.deepEqual(files.get("photos/002_original.png"), photoTwoBytes, "photo 2 original bytes recovered exactly");
  assert.deepEqual(files.get("photos/001_analysis.png"), photoOneBytes, "photo 1 analysis bytes recovered");
  assert.deepEqual(files.get("photos/002_analysis.png"), photoTwoBytes, "photo 2 analysis bytes recovered");
  assert.deepEqual(files.get("voice-notes/001_voice-note.m4a"), voiceBytes, "voice-note bytes recovered exactly");
  assert.deepEqual(files.get("context/usgs-terrain.png"), terrainBytes, "offline terrain recovered exactly");
  assert.deepEqual(files.get("context/usgs-contours-2ft.png"), contourBytes, "offline contours recovered exactly");

  const manifest = JSON.parse(files.get("inspection.json").toString("utf8"));
  const repositoryImport = JSON.parse(files.get("repository-import.json").toString("utf8"));
  assert.equal(manifest.format_version, "2.0");
  assert.equal(manifest.summary.evidence_set_count, 1);
  assert.equal(manifest.inspection.weather_context.named_event, "Test storm");
  const weatherContext = JSON.parse(files.get("WEATHER_CONTEXT.json").toString("utf8"));
  assert.equal(weatherContext.weather_context.weather_station_distance_from_parcel, "8 miles");
  assert(weatherContext.interpretation_rules.some(rule => rule.includes("year-round")), "weather package prevents a one-day condition from becoming a year-round claim");
  const evidenceSets = JSON.parse(files.get("EVIDENCE_SETS.json").toString("utf8"));
  assert.equal(evidenceSets.summaries.sets[0].photograph_count, 2, "package explains two views as one subject");
  const flowingCorridors = JSON.parse(files.get("FLOWING_WATER_CORRIDORS.json").toString("utf8"));
  assert.equal(flowingCorridors.activation_rule, "Pending photo-group suggestions never create a corridor. Inspector approval is required.");
  assert.match(files.get("printable-report.html").toString("utf8"), /One confirmed subject:[\s\S]*Test multi-view subject|Test multi-view subject[\s\S]*One confirmed subject:/, "printable report presents the multi-photo set as one subject");
  assert.equal(manifest.repository.export_id, "export_full_test");
  assert.equal(manifest.repository.append_only, true);
  assert.equal(manifest.repository.overwrite_allowed, false);
  assert.equal(repositoryImport.repository_path, manifest.repository.inspection_path);
  assert.equal(repositoryImport.immutability.collision_policy, "REJECT_IF_EXPORT_ID_OR_ARTIFACT_PATH_ALREADY_EXISTS");
  assert.equal(repositoryImport.responsibilities.phone.startsWith("Collect"), true);
  assert(repositoryImport.future_comparison_dimensions.includes("standing_water"));
  const comparisonRecord = JSON.parse(files.get("repository-comparison.json").toString("utf8"));
  assert.equal(comparisonRecord.property_id, manifest.property_id);
  assert.equal(comparisonRecord.inspection_id, manifest.inspection_id);
  assert.equal(comparisonRecord.observation_counts_by_type["field.wet"], 1);
  assert.equal(comparisonRecord.recurring_observations.length, markers.length - 1, "inspector thoughts are excluded from factual recurring observations");
  assert.equal(comparisonRecord.inspector_thoughts.length, 1, "inspector reasoning remains available for later validation");
  assert.equal(comparisonRecord.inspector_thoughts[0].future_validation_status, "NOT_YET_EVALUATED");
  assert.equal(manifest.summary.gps_track_point_count, points.length);
  assert.equal(manifest.summary.field_event_count, markers.length);
  assert.equal(manifest.summary.observation_count, markers.length - 1);
  assert.equal(manifest.summary.inspector_thought_count, 1);
  assert.equal(manifest.summary.photo_count, 2);
  assert.equal(manifest.package_mode, "full_evidence_archive");
  assert.equal(manifest.summary.original_photo_evidence_count, 2);
  assert.equal(manifest.summary.original_photo_count, 2);
  assert.equal(manifest.summary.analysis_photo_count, 2);
  assert.equal(manifest.summary.voice_note_count, 1);
  assert.equal(manifest.summary.investigation_question_count, 2);
  assert.equal(manifest.summary.inspection_area_count, 2);
  assert.equal(manifest.summary.device_orientation_sample_count, 1);
  assert.equal(manifest.summary.lifecycle_event_count, 2);
  assert.equal(manifest.summary.elapsed_time_ms, 3600000);
  assert(manifest.summary.active_movement_time_ms > 0, "active movement time is calculated from GPS movement");
  assert(manifest.summary.distance_walked_m > 100, "distance summary is calculated");
  assert.equal(manifest.property.recorded_acres, 86.7464918);
  assert.equal(manifest.inspection.gps_track.length, points.length);
  assert(manifest.inspection.gps_track.every(point => point.time && Number.isFinite(point.accuracy_m)), "every GPS point has time and accuracy");
  assert(types.every(type => manifest.inspection.observations.some(observation => observation.observation_type === `field.${type}`)), "all field-button observation types reconstruct");
  assert.equal(manifest.photographs[0].location.latitude, inspection.photos[0].lat);
  assert.equal(manifest.photographs[0].photo_number, "P1");
  assert.equal(manifest.photographs[0].associated_marker_id, "event-photo-1");
  assert.equal(manifest.photographs[0].category, "Wet");
  assert.equal(manifest.photographs[0].photo_value, "Critical");
  assert.equal(manifest.photographs[0].area_id, "area-northwest");
  assert.deepEqual(manifest.photographs[0].question_ids, ["question-berm"]);
  assert.equal(manifest.photographs[0].compass_heading_deg, 88);
  assert.equal(manifest.photographs[1].orientation.exif_value, 6);
  assert.equal(manifest.voice_notes[0].audio.path, "voice-notes/001_voice-note.m4a");
  assert.equal(new Set(manifest.inspection.gps_track.map(point => point.gps_point_id)).size, points.length, "every GPS point has a unique AI-facing ID");
  manifest.inspection.observations.forEach(observation => {
    assert(observation.gps_point_id && observation.gps_point_reference, `${observation.observation_id} directly references a GPS point`);
    assert(Array.isArray(observation.attachments.nearest_photographs) && observation.attachments.nearest_photographs.length, `${observation.observation_id} references nearest photographs`);
    assert(Array.isArray(observation.attachments.nearest_voice_notes) && observation.attachments.nearest_voice_notes.length, `${observation.observation_id} references nearest voice notes`);
    assert(observation.observed_at && observation.compass_heading_deg != null && observation.evidence_classification, `${observation.observation_id} preserves timestamp, heading, and evidence classification`);
    assert(Array.isArray(observation.decision_relevance) && observation.decision_relevance.length, `${observation.observation_id} is routed to at least one property decision`);
    observation.decision_relevance.forEach(link => assert(link.decision_id && link.question && link.candidate_effect, `${observation.observation_id} has an explicit decision relationship`));
  });
  assert(!manifest.inspection.observations.some(observation => observation.observation_type === "field.thought"), "inspector thoughts are not represented as factual observations");
  assert.equal(manifest.inspection.inspector_thoughts[0].text, "I think the road berm may be causing this standing water.");
  assert.equal(manifest.inspection.inspector_thoughts[0].factual_status, "NOT_AN_OBSERVED_FACT");
  manifest.photographs.forEach(photo => {
    assert(photo.observation_id && photo.gps_point_id, `${photo.photo_number} directly references an observation and GPS point`);
    assert(photo.direction_faced && photo.direction_faced.cardinal, `${photo.photo_number} records direction faced`);
    assert.equal(photo.weather.weather_record_id, "weather-inspection-conditions", `${photo.photo_number} references inspection weather`);
    assert(photo.map_location && photo.map_location.parcel_boundary_path, `${photo.photo_number} references its map location`);
  });
  manifest.voice_notes.forEach(voice => {
    assert(voice.observation_id && voice.gps_point_id && voice.started_at, `${voice.voice_note_id} directly references an observation, GPS point, and timestamp`);
  });
  manifest.photographs.forEach(photo => {
    assert(files.has(photo.original.path), `${photo.photo_id} original path resolves`);
    assert(files.has(photo.analysis.path), `${photo.photo_id} analysis path resolves`);
    assert.equal(files.get(photo.original.path).length, photo.original.size_bytes, `${photo.photo_id} original byte count`);
  });
  assert(files.has(manifest.map_context.layers.parcels.path), "parcel geometry path resolves");
  assert(files.has(manifest.map_context.layers.terrain.path), "terrain path resolves");
  assert(files.has(manifest.map_context.layers.contours.path), "contour path resolves");
  assert(distanceMeters(manifest.inspection.gps_track) > 100, "walking distance can be reconstructed from the package alone");

  const aiAnalysis = JSON.parse(files.get("AI_ANALYSIS.json").toString("utf8"));
  const decisionBrief = JSON.parse(files.get("DECISION_BRIEF.json").toString("utf8"));
  const questionBrief = JSON.parse(files.get("QUESTION_BRIEF.json").toString("utf8"));
  const fieldCoaching = JSON.parse(files.get("FIELD_COACHING.json").toString("utf8"));
  const returnVisit = JSON.parse(files.get("RETURN_VISIT_PLAN.json").toString("utf8"));
  const relationships = JSON.parse(files.get("EVIDENCE_RELATIONSHIPS.json").toString("utf8"));
  const aiReadme = files.get("AI_README.md").toString("utf8");
  const reportTemplate = files.get("REPORT_TEMPLATE.md").toString("utf8");
  const thoughtDocument = files.get("INSPECTOR_THOUGHTS.md").toString("utf8");
  ["executive_summary", "decision_framework", "decision_brief", "investigation_questions", "inspection_areas", "coverage", "missing_evidence", "return_visit_plan", "field_efficiency", "stakeholder_questions", "property_information", "inspection_conditions", "weather_context", "inspection_statistics", "gps_track", "observations", "photographs", "voice_notes", "map_layers", "weather", "terrain", "contours", "parcel_boundary", "public_data", "evidence_relationships", "suggested_inspection_questions", "metadata"].forEach(section => assert(Object.hasOwn(aiAnalysis, section), `AI analysis exposes ${section}`));
  assert.equal(questionBrief.questions.length, 2, "every inspector question is packaged");
  assert(questionBrief.questions[0].photo_ids.includes("photo-1"), "question links directly to its photo evidence");
  assert.equal(fieldCoaching.coverage.status, "ESTIMATED", "coverage is explicitly estimated");
  assert(Number.isFinite(fieldCoaching.coverage.not_inspected.percent), "not-inspected percent is reported");
  assert.equal(returnVisit.schema_name, "property-intelligence-return-visit-plan");
  assert.equal(decisionBrief.decisions.length, 5, "decision brief contains the five rural-property decisions");
  assert.deepEqual(decisionBrief.decisions.map(decision => decision.question), ["Can I access it?", "Can I build here?", "Can I make money here?", "What might cost me money?", "What makes this property special?"]);
  decisionBrief.decisions.forEach(decision => {
    assert.equal(decision.estimated_confidence.scale, "0-100", `${decision.question} requires estimated confidence`);
    assert(decision.lowest_cost_next_investigation.rule.includes("Prefer a free record check"), `${decision.question} requires the cheapest investigation first`);
    assert(decision.professional_follow_up.rule.includes("exact question"), `${decision.question} prevents generic professional referrals`);
  });
  for (const stakeholder of ["buyer", "seller", "builder", "developer", "engineer", "forester"]) assert(aiAnalysis.stakeholder_questions[stakeholder].length, `${stakeholder} questions are provided`);
  assert.equal(aiAnalysis.photographs.length, 2);
  assert.equal(aiAnalysis.inspector_thoughts.length, 1);
  assert.equal(relationships.observations.length, manifest.summary.observation_count);
  assert.equal(relationships.photographs.length, 2);
  assert.equal(relationships.voice_notes.length, 1);
  assert(aiReadme.includes("Can I access it?") && aiReadme.includes("Every observation directly names its GPS point") && aiReadme.includes("not observed facts") && aiReadme.includes("Absence of an observation is not proof") && aiReadme.includes("0-100 confidence score"), "AI README explains decisions, relationships, thought boundaries, uncertainty, and confidence in plain English");
  ["Decision Summary", "Property Overview", "Inspection Conditions", "Decision Matrix", "Can I Access It?", "Can I Build Here?", "Can I Make Money Here?", "What Might Cost Me Money?", "What Makes This Property Special?", "Strengths", "Weaknesses", "Unknowns and Coverage Gaps", "What Changed the Assessment", "Inspection Statistics", "Questions Answered", "Questions Remaining", "Inspection Areas", "Coverage: Well Inspected, Lightly Inspected, Not Inspected", "Lowest-Cost Next Investigation", "Estimated Confidence", "Return Visit Plan", "Field Efficiency", "Buyer Questions", "Seller Transparency", "Builder Questions", "Developer Questions", "Engineer Questions", "Forester Questions", "Recommended Professional Follow-up", "Evidence Appendix"].forEach(heading => assert(reportTemplate.includes(`## ${heading}`), `report template includes ${heading}`));
  assert(thoughtDocument.includes("I think the road berm may be causing this standing water.") && thoughtDocument.includes("NOT AN OBSERVED FACT"), "inspector reasoning is preserved and explicitly separated from facts");

  const parcelGeoJson = JSON.parse(files.get("context/parcels.geojson").toString("utf8"));
  assert(parcelGeoJson.features.some(feature => String(feature.properties.PAR_NUM) === "221S280000001010000"), "subject parcel supports inspected/missed-area analysis");
  assert(files.get("events.csv").toString("utf8").includes("Standing water reaches the flagged pine."), "free note is recoverable");
  assert(files.get("observations.csv").toString("utf8").includes("evidence_classification"), "observation evidence classifications are tabular");
  const photoIndex = JSON.parse(files.get("photo_index.json").toString("utf8"));
  assert.deepEqual(photoIndex.photographs.map(photo => photo.photo_number), ["P1", "P2"], "photo index uses stable P numbers");
  const reconstruction = JSON.parse(files.get("chatgpt-reconstruction.json").toString("utf8"));
  assert.equal(reconstruction.user_questions_required_before_analysis, false, "reconstruction begins without asking the field user questions");
  ["Decision summary", "Strengths, weaknesses, and material unknowns", "Explained confidence for each of the five decisions", "Lowest-cost next investigation", "Buyer, seller, builder, developer, engineer, and forester questions", "Interactive map", "Printable report", "Inspection timeline", "Photo gallery", "Questions answered", "Questions remaining", "Suggested next visit", "Areas not yet inspected"].forEach(output => assert(reconstruction.required_outputs_in_order.includes(output), `${output} reconstruction output is required`));
  assert.equal(reconstruction.integrity_expectations.expected_photo_count, 2);
  const report = files.get("printable-report.html").toString("utf8");
  assert(report.includes('src="photos/001_analysis.png"'), "printable report resolves actual photo 1 from the package");
  assert(report.includes('src="photos/002_analysis.png"'), "printable report resolves actual photo 2 from the package");
  assert(report.includes("Decision Brief") && report.includes("Every next step must state what uncertainty it removes."), "printable evidence report leads the analyst into decision-focused uncertainty reduction");
  assert(report.includes("Inspection Coaching") && report.includes("Well inspected") && report.includes("Not inspected"), "printable report explains coaching and conservative coverage");
  assert(report.includes("Weather Context") && report.includes("Test storm") && report.includes("inferred causes are separate"), "printable report separates weather context, observed site conditions, inference, and year-round unknowns");
  assert(report.includes("Photo value") && report.includes("Critical") && report.includes("question-berm"), "printable report prioritizes and explains question-linked photo evidence");
  ["Complete Route", "Water and Drainage", "Dry Ground and Homesites", "Access and Obstacles", "Trees and Timber", "Photos", "Inspection Conditions"].forEach(section => assert(report.includes(section), `${section} report section exists`));
  assert(report.indexOf("Complete Route") < report.indexOf("Pearson Road Property Inspection"), "complete parcel route is report page 1");
  assert(report.includes("miles walked") && report.includes("elapsed") && report.includes("numbered detail zone"), "page 1 carries date, distance, duration, and numbered zones");
  assert(report.includes("not a boundary survey"), "required preliminary-field-report disclaimer exists");
  assert(report.includes("Neither the weather record nor one inspection establishes year-round conditions"), "conditions limitation statement exists");
  assert(!report.includes("â") && !report.includes("Â"), "printable report contains no mojibake text");
  assert(!/<(?:script|img)[^>]+src=["']https?:/i.test(report), "printable report has no live external dependencies");

  const reportResult = await Package.createInspectionPackage({
    inspection,
    photoEntries: basePhotoEntries,
    voiceEntries: baseVoiceEntries,
    mapContext: baseMapContext,
    packageMode: "report",
    appVersion: "test",
    exportId: "export-report-test",
    exportedAt: "2026-08-02T15:02:00.000Z"
  });
  assert.match(reportResult.fileName, /^Pearson_Road_Inspection_AI_ANALYSIS_REPORT_PACKAGE_/);
  const reportFiles = extractStoredZip(Buffer.from(await reportResult.blob.arrayBuffer()));
  assert(reportFiles.has("SMALL_TRACT_WATER_MAP.json"), "package includes the AI-readable small-tract water model");
  assert(reportFiles.has("FLOWING_WATER_CORRIDORS.json"), "package includes the AI-readable confirmed creek-corridor model");
  assert(reportFiles.has("small-tract-water-map.html"), "package includes the interactive human-readable small-tract water map");
  const reportImportContract = JSON.parse(reportFiles.get("repository-import.json").toString("utf8"));
  assert.equal(reportImportContract.artifact.repository_filename, "AI_ANALYSIS_REPORT_PACKAGE_export_report_test.zip", "repository retains the AI package identity after ingestion");
  assert(!reportFiles.has("photos/001_original.png") && !reportFiles.has("photos/002_original.png"), "report package does not duplicate full-resolution originals");
  assert.deepEqual(reportFiles.get("photos/001_analysis.png"), photoOneBytes, "report package contains actual viewable photo 1");
  assert.deepEqual(reportFiles.get("photos/002_analysis.png"), photoTwoBytes, "report package contains actual viewable photo 2");
  const reportManifest = JSON.parse(reportFiles.get("inspection.json").toString("utf8"));
  assert.equal(reportManifest.package_mode, "chatgpt_report_package");
  assert.equal(reportManifest.summary.original_photo_count, 0);
  assert.equal(reportManifest.summary.original_photo_evidence_count, 2);
  assert.equal(reportManifest.summary.analysis_photo_count, 2);
  assert.equal(reportManifest.summary.photo_explanation_count, 1, "photo-linked voice explanations are counted separately from general voice notes");
  assert.deepEqual(reportManifest.photographs[0].explanation_voice_note_ids, ["voice-1"], "the photograph permanently references its voice explanation");
  assert.equal(reportManifest.voice_notes[0].photo_id, "photo-1", "the explanation points back to the photograph");
  assert.equal(reportManifest.voice_notes[0].purpose, "photo_explanation");
  assert.equal(reportManifest.small_tract_water_map.small_tract.ring_index, 1, "package isolates the verified small-tract parcel ring");
  assert(reportManifest.small_tract_water_map.excluded_large_tract.excluded_water_photo_ids.includes("photo-1"), "large-tract Wet photograph is excluded from small-tract analysis");
  const interactiveWaterMap = reportFiles.get("small-tract-water-map.html").toString("utf8");
  assert(interactiveWaterMap.includes("SMALL TRACT — OBSERVED WATER CONDITIONS"));
  assert(interactiveWaterMap.includes("Actual photographed water"));
  assert(interactiveWaterMap.includes("Uninspected / unknown"));
  const packagedAiAnalysis = JSON.parse(reportFiles.get("AI_ANALYSIS.json").toString("utf8"));
  assert.equal(packagedAiAnalysis.small_tract_water_map.small_tract.stated_acres, 5.49);
  reportManifest.photographs.forEach(photo => {
    assert.equal(photo.original.path, null, `${photo.photo_number} original path is intentionally absent`);
    assert.equal(photo.original.included_in_package, false, `${photo.photo_number} records intentional omission`);
    assert.match(photo.original.sha256, /^[0-9a-f]{64}$/, `${photo.photo_number} omitted original retains SHA-256`);
    assert(photo.original.source_filename && photo.original.size_bytes && photo.original.width_px && photo.original.height_px && photo.original.recorded_at, `${photo.photo_number} omitted original retains filename, dimensions, size, and timestamp`);
    assert(reportFiles.has(photo.analysis.path), `${photo.photo_number} analysis image resolves inside report package`);
    assert.equal(photo.thumbnail.path, photo.analysis.path, `${photo.photo_number} reuses the analysis image as a no-duplication thumbnail`);
  });
  assert(reportResult.blob.size < result.blob.size, "report package is smaller than the full evidence archive");
  assert.throws(() => Repository.safeRelativePath("../outside"), /Unsafe repository path/, "repository paths cannot escape their root");
  assert.throws(() => Repository.safeComponent("photo/escape", "photo ID"), /Unsafe photo ID/, "evidence IDs cannot introduce repository subpaths");

  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "property-intelligence-repository-"));
  try {
    const incoming = path.join(repositoryRoot, "incoming");
    fs.mkdirSync(incoming);
    const reportPath = path.join(incoming, reportResult.fileName);
    const fullPath = path.join(incoming, result.fileName);
    fs.writeFileSync(reportPath, Buffer.from(await reportResult.blob.arrayBuffer()));
    fs.writeFileSync(fullPath, zipBytes);
    const reportReceipt = Repository.importInspectionPackage(reportPath, repositoryRoot, { ingestedAt: "2026-08-03T12:00:00.000Z" });
    const fullReceipt = Repository.importInspectionPackage(fullPath, repositoryRoot, { ingestedAt: "2026-08-03T12:01:00.000Z" });
    assert.equal(reportReceipt.repositoryPath, fullReceipt.repositoryPath, "report and full artifacts from one visit merge under one inspection folder");
    const storedInspection = path.join(repositoryRoot, ...reportReceipt.repositoryPath.split("/"));
    assert(fs.existsSync(path.join(storedInspection, "inspection.json")), "inspection folder has a canonical inspection record");
    assert(fs.existsSync(path.join(storedInspection, "versions", "export_report_test", "inspection.json")), "report export remains an immutable version");
    assert(fs.existsSync(path.join(storedInspection, "versions", "export_full_test", "inspection.json")), "full archive remains a separate immutable version");
    assert.equal(fs.readdirSync(path.join(storedInspection, "packages")).length, 2, "both source ZIP packages are permanently retained");
    assert.equal(fs.readdirSync(path.join(storedInspection, "photos", "analysis")).length, 2, "analysis photos are content-addressed without duplicate bytes");
    assert.equal(fs.readdirSync(path.join(storedInspection, "photos", "original")).length, 2, "full-resolution originals are retained separately");
    assert.equal(fs.readdirSync(path.join(storedInspection, "voice")).length, 1, "voice evidence is recovered into the repository");
    assert(fs.existsSync(path.join(storedInspection, "weather", "export_report_test", "WEATHER_CONTEXT.json")), "inspection weather context is preserved in its repository evidence folder per export");
    assert(fs.existsSync(path.join(storedInspection, "maps", "export_report_test", "FLOWING_WATER_CORRIDORS.json")), "confirmed creek-corridor intelligence is preserved with versioned maps");
    assert(fs.existsSync(path.join(storedInspection, "analysis", "export_report_test", "printable_report.pdf.pending.json")), "repository receives the printable-PDF derivation instruction");
    assert(fs.existsSync(path.join(storedInspection, "analysis", "export_report_test", "repository-comparison.json")), "repository receives a compact cross-inspection comparison record");
    for (const name of ["AI_README.md", "AI_ANALYSIS.json", "DECISION_BRIEF.json", "QUESTION_BRIEF.json", "FIELD_COACHING.json", "RETURN_VISIT_PLAN.json", "REPORT_TEMPLATE.md", "INSPECTOR_THOUGHTS.md", "EVIDENCE_RELATIONSHIPS.json", "SUGGESTED_INSPECTION_QUESTIONS.md"]) {
      assert(fs.existsSync(path.join(storedInspection, "analysis", "export_report_test", name)), `repository extracts ${name} for direct ChatGPT analysis`);
    }
    await assert.rejects(async () => Repository.importInspectionPackage(reportPath, repositoryRoot), /already exists/, "reimporting an export never overwrites its earlier version");

    const followupInspection = JSON.parse(JSON.stringify(inspection));
    followupInspection.inspection_id = "inspection-test-followup";
    followupInspection.started = "2026-09-02T15:00:00.000Z";
    followupInspection.stopped = "2026-09-02T16:00:00.000Z";
    followupInspection.conditions.inspection_date = "2026-09-02";
    const followupPackage = await Package.createInspectionPackage({
      inspection: followupInspection,
      photoEntries: basePhotoEntries,
      voiceEntries: baseVoiceEntries,
      mapContext: baseMapContext,
      packageMode: "report",
      exportId: "export-followup-test",
      exportedAt: "2026-09-02T16:01:00.000Z"
    });
    const followupPath = path.join(incoming, followupPackage.fileName);
    fs.writeFileSync(followupPath, Buffer.from(await followupPackage.blob.arrayBuffer()));
    const followupReceipt = Repository.importInspectionPackage(followupPath, repositoryRoot, { ingestedAt: "2026-09-02T16:02:00.000Z" });
    assert.notEqual(followupReceipt.repositoryPath, reportReceipt.repositoryPath, "a later visit receives its own immutable inspection folder");
    assert.equal(followupReceipt.repositoryPath.split("/")[0], reportReceipt.repositoryPath.split("/")[0], "inspection A and B join through the same property folder for comparison");
    const propertyFolder = path.join(repositoryRoot, reportReceipt.repositoryPath.split("/")[0]);
    assert.equal(fs.readdirSync(propertyFolder).filter(name => name.startsWith("Inspection_")).length, 2, "the property repository retains both inspection visits");
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
  }

  await assert.rejects(
    () => Package.createInspectionPackage({ inspection, photoEntries: [], voiceEntries: [], mapContext: { terrainBlob: new Blob([terrainBytes]), contourBlob: new Blob([contourBytes]), parcelsText } }),
    /Photo storage mismatch/,
    "package creation fails closed when actual photograph files are missing"
  );

  const correctedInspection = JSON.parse(JSON.stringify(inspection));
  correctedInspection.corrections = [{
    correction_id: "void-photo-2", target: { record_type: "photo", record_id: "photo-2" },
    correction_time: "2026-08-02T15:20:00.000Z", correction_reason: "Duplicate", corrected_value: null,
    inspector_identity: "Test Inspector", resulting_status: "voided", original_entry: JSON.parse(JSON.stringify(correctedInspection.photos[1])), immutable: true
  }];
  const correctedResult = await Package.createInspectionPackage({ inspection: correctedInspection, photoEntries: basePhotoEntries, voiceEntries: baseVoiceEntries, mapContext: baseMapContext, packageMode: "full_archive", exportedAt: "2026-08-02T15:21:00.000Z" });
  const correctedFiles = extractStoredZip(Buffer.from(await correctedResult.blob.arrayBuffer()));
  const correctedManifest = JSON.parse(correctedFiles.get("inspection.json").toString("utf8"));
  assert.equal(correctedManifest.summary.photo_count, 1, "voided photo is excluded from active report evidence");
  assert.equal(correctedManifest.audit_history.audit_only_photographs.length, 1, "voided photo remains indexed in audit history");
  assert(correctedFiles.has("audit/photos/002_original.png") && correctedFiles.has("audit/photos/002_analysis.png"), "voided original and analysis bytes remain physically recoverable in the full archive");
  assert(!correctedFiles.get("printable-report.html").toString("utf8").includes('id="photo-P2"'), "voided photo is excluded from the printable findings report");

  const pearsonPhotoBytes = new Blob([photoOneBytes], { type: "image/png" });
  const pearsonPhotos = Array.from({ length: 10 }, (_, index) => {
    const photoNumber = `P${index + 3}`;
    return {
      id: `pearson-photo-${index + 3}`, photo_number: photoNumber,
      associated_marker_id: index === 9 ? null : `pearson-photo-event-${index + 3}`,
      associated_observation_id: null, category: index < 9 ? "Water / Berm Sequence" : "Other",
      note: index < 9 ? "Large-tract survey flag, berm, and water sequence" : "Later independent photograph",
      evidence_classification: "Observed", observation_attributes: {}, explanation_status: "recorded",
      photo_meaning: { status: "complete", subject: index < 9 ? "Drainage or water" : "General context", measurement_status: "Not measured", represented_extent: "Small localized area", decision_importance: "Professional verification", evidence_roles: index === 0 ? ["context", "evidence", "measurement", "relationship"] : ["evidence"] },
      recorded_at: new Date(Date.parse("2026-08-03T13:05:00.000Z") + index * 60000).toISOString(),
      lat: 30.4892 + index * 0.00002, lon: -87.094 + index * 0.00002, gps_accuracy_m: 4,
      gps_position_at: "2026-08-03T13:04:00.000Z", compass_heading_deg: 90,
      width_px: 192, height_px: 192, pixel_orientation: "square", original_filename: `${photoNumber}.png`,
      original_mime_type: "image/png", original_size_bytes: photoOneBytes.length
    };
  });
  const pearsonPhotoMarkers = pearsonPhotos.slice(0, 9).map(photo => ({
    id: photo.associated_marker_id, source: "button_press", type: "photo", observation_type: "field.photo",
    taxonomy_version: "property-observation-1.0", evidence_classification: "Observed", button_label: "Photo",
    note: photo.note, attributes: { photo_number: photo.photo_number }, time: photo.recorded_at,
    lat: photo.lat, lon: photo.lon, gps_accuracy_m: photo.gps_accuracy_m, gps_position_at: photo.gps_position_at,
    compass_heading_deg: photo.compass_heading_deg, photo_id: photo.id, voice_note_id: null
  }));
  const pearsonInspection = {
    schema_name: inspection.schema_name, schema_version: inspection.schema_version, property_id: inspection.property_id,
    inspection_id: "inspection-pearson-road-real-regression", started: "2026-08-03T12:30:00.000Z", stopped: "2026-08-03T15:30:00.000Z",
    points, lifecycle_events: [{ type: "inspection_started", time: "2026-08-03T12:30:00.000Z" }, { type: "inspection_finished", time: "2026-08-03T15:30:00.000Z" }],
    markers: [
      { id: "pearson-accidental-entrance", source: "button_press", type: "entrance", observation_type: "field.entrance", taxonomy_version: "property-observation-1.0", evidence_classification: "Observed", button_label: "Road / Entrance", note: "", attributes: {}, time: "2026-08-03T13:04:01.864Z", lat: 30.4891, lon: -87.0941, gps_accuracy_m: 4, gps_position_at: points[0].time, compass_heading_deg: 90 },
      { id: "pearson-water-trigger", source: "button_press", type: "wet", observation_type: "field.wet", taxonomy_version: "property-observation-1.0", evidence_classification: "Observed", button_label: "Wet", note: "Water behind apparent road berm", attributes: {}, time: "2026-08-03T13:04:30.000Z", lat: 30.4892, lon: -87.094, gps_accuracy_m: 4, gps_position_at: points[0].time, compass_heading_deg: 90 },
      ...pearsonPhotoMarkers
    ],
    photos: pearsonPhotos, voice_notes: [], orientation_samples: [], inspection_areas: [{ area_id: "large-tract", name: "Large Tract" }],
    investigation_questions: [], active_question_ids: [], conditions: Object.assign({}, inspection.conditions, { inspection_date: "2026-08-03" })
  };
  const pearsonResult = await Package.createInspectionPackage({
    inspection: pearsonInspection,
    photoEntries: pearsonPhotos.map(photo => ({ id: photo.id, originalBlob: pearsonPhotoBytes, analysisBlob: pearsonPhotoBytes })),
    voiceEntries: [], mapContext: baseMapContext, packageMode: "report", exportedAt: "2026-08-03T16:00:00.000Z"
  });
  const pearsonFiles = extractStoredZip(Buffer.from(await pearsonResult.blob.arrayBuffer()));
  const pearsonManifest = JSON.parse(pearsonFiles.get("inspection.json").toString("utf8"));
  const pearsonAudit = JSON.parse(pearsonFiles.get("EVIDENCE_AUDIT_HISTORY.json").toString("utf8"));
  assert(!pearsonManifest.inspection.observations.some(item => item.observation_id === "pearson-accidental-entrance"), "accidental Entrance is excluded from findings");
  assert(pearsonAudit.corrections.some(item => item.target.record_id === "pearson-accidental-entrance" && item.correction_reason === "Accidental button press" && item.original_entry.time === "2026-08-03T13:04:01.864Z"), "Entrance correction retains the exact original in audit history");
  assert.equal(pearsonManifest.inspection.pearson_road_evidence_sequence.photo_numbers.join(","), "P3,P4,P5,P6,P7,P8,P9,P10,P11", "P3-P11 remain one inspector-directed large-tract sequence");
  assert.equal(pearsonManifest.photographs.find(photo => photo.photo_number === "P12").observation_id, null, "later unlinked photo is not assigned to a nearby button press");
  assert(pearsonManifest.photographs.find(photo => photo.photo_number === "P12").nearest_observations.every(link => link.relationship === "nearest_by_location_unconfirmed"), "proximity is explicitly unconfirmed");
  assert.equal(pearsonManifest.inspection.inspector_hypotheses[0].evidence_classification, "Interpretation / Needs Professional Verification");
  assert(pearsonManifest.inspection.inspector_hypotheses[0].prohibition.includes("Do not recommend construction"));
  assert.equal(pearsonManifest.inspection.professional_handoff_cards.cards.length, 7, "all seven professional audience cards are generated");
  assert(pearsonManifest.inspection.professional_handoff_cards.cards.every(card => card.exact_question.includes("lawful outlet") && card.limitation.includes("does not replace licensed professional work")), "handoffs ask the exact question without an unlicensed conclusion");
  assert(pearsonFiles.has("professional-handoff-cards.html") && [...pearsonFiles.keys()].filter(name => name.startsWith("professional-handoff/")).length === 7, "one printable handoff is packaged for every audience");
  assert.equal(JSON.parse(pearsonFiles.get("FIELD_EVIDENCE_REVIEW.json").toString("utf8")).four_photo_pattern_by_photo.find(item => item.photo_number === "P3").pattern.complete, true, "four-photo evidence completeness is reported");

  const noImagery = await Package.createInspectionPackage({
    inspection,
    photoEntries: [
      { id: "photo-1", originalBlob: new Blob([photoOneBytes], { type: "image/png" }), analysisBlob: new Blob([photoOneBytes], { type: "image/png" }) },
      { id: "photo-2", originalBlob: new Blob([photoTwoBytes], { type: "image/png" }), analysisBlob: new Blob([photoTwoBytes], { type: "image/png" }) }
    ],
    voiceEntries: [{ id: "voice-1", audioBlob: new Blob([voiceBytes], { type: "audio/mp4" }) }],
    mapContext: { terrainBlob: null, contourBlob: null, parcelsText },
    packageKind: "backup",
    exportedAt: "2026-08-02T15:10:00.000Z"
  });
  assert.match(noImagery.fileName, /^Pearson_Road_Inspection_FULL_ARCHIVE_Backup_/);
  const noImageryFiles = extractStoredZip(Buffer.from(await noImagery.blob.arrayBuffer()));
  assert(noImageryFiles.has("printable-report.html"), "printable report still exists when raster imagery fails");
  assert(!noImageryFiles.has("context/usgs-terrain.png"), "missing terrain is honestly omitted");
  assert(!noImageryFiles.has("context/usgs-contours-2ft.png"), "missing contours are honestly omitted");

  const missingAnalysis = [
    { id: "photo-1", originalBlob: new Blob([photoOneBytes], { type: "image/png" }), analysisBlob: null },
    { id: "photo-2", originalBlob: new Blob([photoTwoBytes], { type: "image/png" }), analysisBlob: new Blob([photoTwoBytes], { type: "image/png" }) }
  ];
  await assert.rejects(
    () => Package.createInspectionPackage({ inspection, photoEntries: missingAnalysis, voiceEntries: [{ id: "voice-1", audioBlob: new Blob([voiceBytes], { type: "audio/mp4" }) }], mapContext: { terrainBlob: new Blob([terrainBytes]), contourBlob: new Blob([contourBytes]), parcelsText } }),
    /analysis-safe image copy/,
    "package creation fails closed when a photo cannot be displayed for analysis"
  );

  const largeOriginal = new Blob([Buffer.alloc(1024, 0x4f)], { type: "image/jpeg" });
  const largeAnalysis = new Blob([Buffer.alloc(384, 0x41)], { type: "image/jpeg" });
  const largePhotos = Array.from({ length: 190 }, (_, index) => ({
    id: `large-photo-${index + 1}`,
    photo_number: `P${index + 1}`,
    associated_marker_id: `large-event-${index + 1}`,
    category: index % 3 === 0 ? "Wet" : "Other",
    note: `Scale-test photograph ${index + 1}`,
    evidence_classification: "Observed",
    observation_attributes: {},
    recorded_at: new Date(Date.parse("2026-08-02T14:00:00.000Z") + index * 30000).toISOString(),
    lat: 30.486 + (index % 19) * 0.0004,
    lon: -87.098 + Math.floor(index / 19) * 0.0005,
    gps_accuracy_m: 4,
    gps_position_at: started,
    compass_heading_deg: index % 360,
    width_px: 1900,
    height_px: 1425,
    pixel_orientation: "landscape",
    original_filename: `IMG_${String(index + 1).padStart(4, "0")}.JPG`,
    original_mime_type: "image/jpeg",
    original_size_bytes: largeOriginal.size,
    analysis_size_bytes: largeAnalysis.size
  }));
  const largeMarkers = Array.from({ length: 252 }, (_, index) => ({
    id: `large-event-${index + 1}`,
    type: index < 190 ? "photo" : "note",
    observation_type: index < 190 ? "field.photo" : "field.note",
    button_label: index < 190 ? "Photo" : "Free Note",
    evidence_classification: "Observed",
    note: `Observation ${index + 1}`,
    attributes: index < 190 ? { photo_number: `P${index + 1}` } : {},
    time: new Date(Date.parse(started) + index * 20000).toISOString(),
    lat: 30.486 + (index % 21) * 0.00035,
    lon: -87.098 + Math.floor(index / 21) * 0.0004,
    gps_accuracy_m: 4,
    gps_position_at: started,
    photo_id: index < 190 ? `large-photo-${index + 1}` : null,
    voice_note_id: null
  }));
  const largePoints = Array.from({ length: 4964 }, (_, index) => ({
    sequence: index + 1,
    time: new Date(Date.parse(started) + index * 1000).toISOString(),
    lat: 30.485 + (index % 500) * 0.000015,
    lon: -87.099 + Math.floor(index / 500) * 0.0005,
    accuracy_m: 4,
    speed_mps: 1,
    heading_deg: index % 360
  }));
  const largeInspection = {
    schema_name: inspection.schema_name,
    schema_version: inspection.schema_version,
    property_id: inspection.property_id,
    inspection_id: "inspection-190-photo-scale",
    started,
    stopped: "2026-08-02T16:00:00.000Z",
    lifecycle_events: inspection.lifecycle_events,
    points: largePoints,
    markers: largeMarkers,
    orientation_samples: Array.from({ length: 944 }, (_, index) => ({ time: new Date(Date.parse(started) + index * 5000).toISOString(), alpha_deg: index % 360, beta_deg: 2, gamma_deg: -1 })),
    conditions: inspection.conditions,
    photos: largePhotos,
    voice_notes: [
      Object.assign({}, inspection.voice_notes[0], { id: "large-voice-1", size_bytes: voiceBytes.length }),
      Object.assign({}, inspection.voice_notes[0], { id: "large-voice-2", size_bytes: voiceBytes.length })
    ]
  };
  const largePhotoEntries = largePhotos.map(photo => ({ id: photo.id, originalBlob: largeOriginal, analysisBlob: largeAnalysis }));
  const largeVoiceEntries = largeInspection.voice_notes.map(note => ({ id: note.id, audioBlob: new Blob([voiceBytes], { type: "audio/mp4" }) }));
  const simulatedScaleEntries = largePhotos.map(photo => ({ id: photo.id, originalBlob: { size: 7.2 * 1024 * 1024 }, analysisBlob: { size: 0.8 * 1024 * 1024 } }));
  const simulatedSizes = Package.estimateInspectionPackageSizes({
    inspection: largeInspection,
    photoEntries: simulatedScaleEntries,
    voiceEntries: [{ audioBlob: { size: 1024 * 1024 } }, { audioBlob: { size: 1024 * 1024 } }],
    mapContext: { terrainBlob: { size: terrainBytes.length }, contourBlob: { size: contourBytes.length }, parcelsText }
  });
  assert(simulatedSizes.reportBytes < 200 * 1024 * 1024, "190-photo report estimate stays preferably below 200 MB at 0.8 MB per analysis image");
  assert(simulatedSizes.fullArchiveBytes > 1400 * 1024 * 1024, "190-photo full archive estimate honestly reflects approximately 1.4 GB of originals");

  const largeReport = await Package.createInspectionPackage({
    inspection: largeInspection,
    photoEntries: largePhotoEntries,
    voiceEntries: largeVoiceEntries,
    mapContext: { terrainBlob: null, contourBlob: null, parcelsText },
    packageMode: "report",
    exportedAt: "2026-08-02T16:01:00.000Z"
  });
  const largeReportFiles = extractStoredZip(Buffer.from(await largeReport.blob.arrayBuffer()));
  assert.equal([...largeReportFiles.keys()].filter(name => /_analysis\.jpg$/.test(name)).length, 190, "190-photo report package contains every analysis-quality photograph");
  assert.equal([...largeReportFiles.keys()].filter(name => /_original\.jpg$/.test(name)).length, 0, "190-photo report package contains no duplicate originals");
  const largeReportManifest = JSON.parse(largeReportFiles.get("inspection.json").toString("utf8"));
  assert.equal(largeReportManifest.summary.gps_track_point_count, 4964);
  assert.equal(largeReportManifest.summary.field_event_count, 252);
  assert.equal(largeReportManifest.summary.device_orientation_sample_count, 944);
  assert.equal(largeReportManifest.summary.photo_count, 190);
  assert.equal(largeReportManifest.summary.voice_note_count, 2);
  const largePrintableReport = largeReportFiles.get("printable-report.html").toString("utf8");
  assert(largePrintableReport.includes('src="photos/190_analysis.jpg"'), "190th photograph resolves in the printable report");
  assert(largePrintableReport.includes('loading="lazy"'), "large printable photo gallery uses browser lazy loading");

  const largeFullArchive = await Package.createInspectionPackage({
    inspection: largeInspection,
    photoEntries: largePhotoEntries,
    voiceEntries: largeVoiceEntries,
    mapContext: { terrainBlob: null, contourBlob: null, parcelsText },
    packageMode: "full_archive",
    exportedAt: "2026-08-02T16:02:00.000Z"
  });
  const largeFullFiles = extractStoredZip(Buffer.from(await largeFullArchive.blob.arrayBuffer()));
  assert.equal([...largeFullFiles.keys()].filter(name => /_original\.jpg$/.test(name)).length, 190, "190-photo full archive contains every original photograph");
  assert.equal([...largeFullFiles.keys()].filter(name => /_analysis\.jpg$/.test(name)).length, 190, "190-photo full archive contains every analysis copy");
  assert(largeFullArchive.blob.size > largeReport.blob.size, "full archive is larger because it preserves exact originals");

  process.stdout.write(`PASS: verified five-decision analysis, confidence and uncertainty-reduction rules, stakeholder questions, AI-ready relationships, exact photo recovery, append-only ingestion, and 190-photo scale.\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
