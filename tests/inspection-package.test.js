"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Package = require("../field/inspection-package.js");
const Timber = require("../field/timber-reconnaissance.js");
const Weather = require("../field/authoritative-weather.js");
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
    { time: "2026-08-02T14:00:31.000Z", lat: 30.4895, lon: -87.0932, accuracy_m: 2.9, altitude_m: 18.8, altitude_accuracy_m: 4.0, speed_mps: 1.2, heading_deg: 88, device_orientation: { alpha_deg: 272, beta_deg: 1, gamma_deg: -2 } },
    { time: "2026-08-02T14:01:01.000Z", lat: 30.4901, lon: -87.0922, accuracy_m: 3.5, altitude_m: 20.1, altitude_accuracy_m: 4.3, speed_mps: 1.0, heading_deg: 44, device_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0 } }
  ];
  const types = ["wet", "dry", "blocked", "high", "homesite", "culvert", "tree", "entrance", "thick", "open", "ditch", "timber", "hazard", "other", "wildlife", "note"];
  const markers = types.map((type, index) => ({
    id: `event-${index + 1}`,
    source: "button_press",
    type,
    observation_type: `field.${type}`,
    taxonomy_version: "property-observation-1.0",
    evidence_classification: type === "tree" ? "Measured" : "Observed",
    value_driver_links: type === "wet" ? [{ value_driver_id: "water", effect: "increase_cost", magnitude: 4, confidence: "high", inspector_reason: "Standing water may require drainage work.", assessment_source: "inspector_selected", intended_use_scenario_id: "scenario-test" }] : (type === "homesite" ? [{ value_driver_id: "buildability", effect: "increase_value", magnitude: 4, confidence: "medium", inspector_reason: "Candidate building area was observed.", assessment_source: "inspector_selected", intended_use_scenario_id: "scenario-test" }] : []),
    value_assessment_status: ["wet", "homesite"].includes(type) ? "INSPECTOR_ASSESSED" : "NOT_ASSESSED",
    button_label: type === "tree" ? "Specimen Tree" : type,
    note: type === "note" ? "Standing water reaches the flagged pine." : "",
    attributes: type === "tree" ? { species: "live_oak", diameter_in: 38 } : (type === "wet" ? { water_depth: "1â€“3 inches", water_depth_basis: "Estimated", water_condition: "Still" } : {}),
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
    intended_use_scenarios: [{ scenario_id: "scenario-test", name: "Single-family homesite", customer_type: "Buyer", created_at: started }],
    active_intended_use_scenario_id: "scenario-test",
    started,
    stopped: "2026-08-02T15:00:00.000Z",
    inspection_areas: [
      { area_id: "area-northwest", name: "Large Tract â€“ Northwest", created_at: started },
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
    authoritative_weather: Weather.pearsonVerifiedContext({ latitude: 30.48987, longitude: -87.09007 }, "2026-08-04T12:00:00.000Z"),
    photos: [
      { id: "photo-1", photo_number: "P1", associated_marker_id: "event-photo-1", associated_observation_id: "event-1", category: "Wet", note: "Standing water at wet marker", evidence_classification: "Observed", observation_attributes: { water_depth: "1â€“3 inches", water_depth_basis: "Estimated" }, explanation_voice_note_id: "voice-1", explanation_voice_note_ids: ["voice-1"], water_confirmation: "yes", water: { water_type: "standing", water_depth_band: "1-3_inches", measurement_basis: "Estimated", water_width_ft: 3, water_length_ft: 5, water_behavior: "isolated_depression", significance: "Minor localized depression" }, camera_opened_at: "2026-08-02T14:02:55.000Z", recorded_at: "2026-08-02T14:03:00.000Z", source_file_last_modified_at: "2026-08-02T14:03:00.000Z", lat: 30.4895, lon: -87.0932, gps_accuracy_m: 2.9, gps_position_at: points[1].time, gps_position_age_ms: 100, location_source: "live_browser_geolocation", compass_heading_deg: 88, sensor_orientation: { alpha_deg: 272, beta_deg: 1, gamma_deg: -2, absolute: true }, device_screen_orientation: "portrait-primary", device_screen_angle_deg: 0, width_px: 192, height_px: 192, pixel_orientation: "square", exif_orientation: 1, exif_orientation_description: "normal", original_filename: "field-one.png", original_mime_type: "image/png", original_size_bytes: photoOneBytes.length },
      { id: "photo-2", photo_number: "P2", associated_marker_id: "event-photo-2", associated_observation_id: "event-4", category: "High Ground", note: "High-ground view", evidence_classification: "Observed", observation_attributes: {}, camera_opened_at: "2026-08-02T14:03:55.000Z", recorded_at: "2026-08-02T14:04:00.000Z", source_file_last_modified_at: "2026-08-02T14:04:00.000Z", lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5, gps_position_at: points[2].time, gps_position_age_ms: 150, location_source: "live_browser_geolocation", compass_heading_deg: 44, sensor_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0, absolute: true }, device_screen_orientation: "landscape-primary", device_screen_angle_deg: 90, width_px: 512, height_px: 512, pixel_orientation: "square", exif_orientation: 6, exif_orientation_description: "rotated 90 degrees clockwise", original_filename: "field-two.png", original_mime_type: "image/png", original_size_bytes: photoTwoBytes.length }
    ],
    voice_notes: [{ id: "voice-1", purpose: "photo_explanation", photo_id: "photo-1", prompt: "Why did you take this picture?", started_at: "2026-08-02T14:05:00.000Z", finished_at: "2026-08-02T14:05:04.500Z", duration_ms: 4500, mime_type: "audio/mp4", size_bytes: voiceBytes.length, lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5, gps_position_at: points[2].time, compass_heading_deg: 44, sensor_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0, absolute: true }, recovered_after_interruption: false }]
  };
  inspection.markers.forEach(marker => {
    marker.area×´âÚ$z{-®éÜj×FW‚Â’ò$G&–ævR÷"vFW""¢$vVæW&Â6öçFW‡B"ÂÖV7W&VÖVçE÷7FGW3¢$æ÷BÖV7W&VB"Â&W&W6VçFVEöW‡FVçC¢%6ÖÆÂÆö6Æ—¦VB&V"ÂFV6—6–öåö–×÷'Fæ6S¢%&öfW76–öæÂfW&–f–6F–öâ"ÂWf–FVæ6U÷&öÆW3¢–æFW‚ÓÓÒò²&6öçFW‡B"Â&Wf–FVæ6R"Â&ÖV7W&VÖVçB"Â'&VÆF–öç6†—%Ò¢²&Wf–FVæ6R%ÒÒÀÐ¢&V6÷&FVEöC¢æWrFFR„FFRç'6R‚###bÓ‚Ó5C3£S£ã¢"’²–æFW‚¢c’çFô•4õ7G&–ær‚’ÀÐ¢ÆC¢3ãCƒ“"²–æFW‚¢ã"ÂÆöã¢Óƒrã“B²–æFW‚¢ã"Âw5ö67W&7•öÓ¢BÀÐ¢w5÷÷6—F–öåöC¢###bÓ‚Ó5C3£C£ã¢"Â6ö×75ö†VF–æuöFVs¢“ÀÐ¢v–GF…÷ƒ¢“"Â†V–v‡E÷ƒ¢“"Â—†VÅö÷&–VçFF–öã¢'7V&R"Â÷&–v–æÅöf–ÆVæÖS¢G·†÷FôçVÖ&W'ÒçævÀÐ¢÷&–v–æÅöÖ–ÖU÷G—S¢&–ÖvR÷ær"Â÷&–v–æÅ÷6—¦Uö'—FW3¢†÷FôöæT'—FW2æÆVæwF€Ð¢Ó°Ð¢Ò“°Ð¢6öç7BV'6öå†÷FôÖ&¶W'2ÒV'6öå†÷F÷2ç6Æ–6RƒÂ’’æÖ‡†÷FòÓâ‡°Ð¢–C¢†÷Fòæ76ö6–FVEöÖ&¶W%ö–BÂ6÷W&6S¢&'WGFöå÷&W72"ÂG—S¢'†÷Fò"Âö'6W'fF–öå÷G—S¢&f–VÆBç†÷Fò"ÀÐ¢F†öæö×•÷fW'6–öã¢'&÷W'G’Öö'6W'fF–öâÓã"ÂWf–FVæ6Uö6Æ76–f–6F–öã¢$ö'6W'fVB"Â'WGFöåöÆ&VÃ¢%†÷Fò"ÀÐ¢æ÷FS¢†÷Fòææ÷FRÂGG&–'WFW3¢²†÷FõöçVÖ&W#¢†÷Fòç†÷FõöçVÖ&W"ÒÂF–ÖS¢†÷Fòç&V6÷&FVEöBÀÐ¢ÆC¢†÷FòæÆBÂÆöã¢†÷FòæÆöâÂw5ö67W&7•öÓ¢†÷Fòæw5ö67W&7•öÒÂw5÷÷6—F–öåöC¢†÷Fòæw5÷÷6—F–öåöBÀÐ¢6ö×75ö†VF–æuöFVs¢†÷Fòæ6ö×75ö†VF–æuöFVrÂ†÷Fõö–C¢†÷Fòæ–BÂfö–6Uöæ÷FUö–C¢çVÆÀÐ¢Ò’“°Ð¢6öç7BV'6öä–ç7V7F–öâÒ°Ð¢66†VÖöæÖS¢–ç7V7F–öâç66†VÖöæÖRÂ66†VÖ÷fW'6–öã¢–ç7V7F–öâç66†VÖ÷fW'6–öâÂ&÷W'G•ö–C¢–ç7V7F–öâç&÷W'G•ö–BÀÐ¢–ç7V7F–öåö–C¢&–ç7V7F–öâ×V'6öâ×&öB×&VÂ×&Vw&W76–öâ"Â7F'FVC¢###bÓ‚Ó5C#£3£ã¢"Â7F÷VC¢###bÓ‚Ó5CS£3£ã¢"ÀÐ¢ö–çG2ÂÆ–fV7–6ÆUöWfVçG3¢·²G—S¢&–ç7V7F–öå÷7F'FVB"ÂF–ÖS¢###bÓ‚Ó5C#£3£ã¢"ÒÂ²G—S¢&–ç7V7F–öåöf–æ—6†VB"ÂF–ÖS¢###bÓ‚Ó5CS£3£ã¢"ÕÒÀÐ¢Ö&¶W'3¢°Ð¢²–C¢'V'6öâÖ66–FVçFÂÖVçG&æ6R"Â6÷W&6S¢&'WGFöå÷&W72"ÂG—S¢&VçG&æ6R"Âö'6W'fF–öå÷G—S¢&f–VÆBæVçG&æ6R"ÂF†öæö×•÷fW'6–öã¢'&÷W'G’Öö'6W'fF–öâÓã"ÂWf–FVæ6Uö6Æ76–f–6F–öã¢$ö'6W'fVB"Â'WGFöåöÆ&VÃ¢%&öBòVçG&æ6R"Âæ÷FS¢""ÂGG&–'WFW3¢·ÒÂF–ÖS¢###bÓ‚Ó5C3£C£ãƒcE¢"ÂÆC¢3ãCƒ“ÂÆöã¢Óƒrã“CÂw5ö67W&7•öÓ¢BÂw5÷÷6—F–öåöC¢ö–çG5³ÒçF–ÖRÂ6ö×75ö†VF–æuöFVs¢“ÒÀÐ¢²–C¢'V'6öâ×vFW"×G&–vvW""Â6÷W&6S¢&'WGFöå÷&W72"ÂG—S¢'vWB"Âö'6W'fF–öå÷G—S¢&f–VÆBçvWB"ÂF†öæö×•÷fW'6–öã¢'&÷W'G’Öö'6W'fF–öâÓã"ÂWf–FVæ6Uö6Æ76–f–6F–öã¢$ö'6W'fVB"Â'WGFöåöÆ&VÃ¢%vWB"Âæ÷FS¢%vFW"&V†–æB&VçB&öB&W&Ò"ÂGG&–'WFW3¢·ÒÂF–ÖS¢###bÓ‚Ó5C3£C£3ã¢"ÂÆC¢3ãCƒ“"ÂÆöã¢Óƒrã“BÂw5ö67W&7•öÓ¢BÂw5÷÷6—F–öåöC¢ö–çG5³ÒçF–ÖRÂ6ö×75ö†VF–æuöFVs¢“ÒÀÐ¢ââçV'6öå†÷FôÖ&¶W'0Ð¢ÒÀÐ¢†÷F÷3¢V'6öå†÷F÷2Âfö–6Uöæ÷FW3¢µÒÂ÷&–VçFF–öå÷6×ÆW3¢µÒÂ–ç7V7F–öåö&V3¢·²&Vö–C¢&Æ&vR×G&7B"ÂæÖS¢$Æ&vRG&7B"ÕÒÀÐ¢–çfW7F–vF–öå÷VW7F–öç3¢µÒÂ7F—fU÷VW7F–öåö–G3¢µÒÂ6öæF—F–öç3¢ö&¦V7Bæ76–vâ‡·ÒÂ–ç7V7F–öâæ6öæF—F–öç2Â²–ç7V7F–öåöFFS¢###bÓ‚Ó2"ÒÐ¢Ó°Ð¢6öç7BV'6öå&W7VÇBÒv—B6¶vRæ7&VFT–ç7V7F–öå6¶vR‡°Ð¢–ç7V7F–öã¢V'6öä–ç7V7F–öâÀÐ¢†÷FôVçG&–W3¢V'6öå†÷F÷2æÖ‡†÷FòÓâ‡²–C¢†÷Fòæ–BÂ÷&–v–æÄ&Æö#¢V'6öå†÷Fô'—FW2ÂæÇ—6—4&Æö#¢V'6öå†÷Fô'—FW2Ò’’ÀÐ¢fö–6TVçG&–W3¢µÒÂÖ6öçFW‡C¢&6TÖ6öçFW‡BÂ6¶vTÖöFS¢'&W÷'B"ÂW‡÷'FVDC¢###bÓ‚Ó5Cc££ã¢ Ð¢Ò“°Ð¢6öç7BV'6öäf–ÆW2ÒW‡G&7E7F÷&VE¦—„'VffW"æg&öÒ†v—BV'6öå&W7VÇBæ&Æö"æ'&”'VffW"‚’’“°Ð¢6öç7BV'6öäÖæ–fW7BÒ¥4ôâç'6R‡V'6öäf–ÆW2ævWB‚&–ç7V7F–öâæ§6öâ"’çFõ7G&–ær‚'WFc‚"’“°Ð¢6öç7BV'6öäVF—BÒ¥4ôâç'6R‡V'6öäf–ÆW2ævWB‚$Ud”DTä4UôTD•Eô„•5Dõ%’æ§6öâ"’çFõ7G&–ær‚'WFc‚"’“°Ð¢76W'B‚V'6öäÖæ–fW7Bæ–ç7V7F–öâæö'6W'fF–öç2ç6öÖR†—FVÒÓâ—FVÒæö'6W'fF–öåö–BÓÓÒ'V'6öâÖ66–FVçFÂÖVçG&æ6R"’Â&66–FVçFÂVçG&æ6R—2W†6ÇVFVBg&öÒf–æF–æw2"“°Ð¢76W'B‡V'6öäVF—Bæ6÷'&V7F–öç2ç6öÖR†—FVÒÓâ—FVÒçF&vWBç&V6÷&Eö–BÓÓÒ'V'6öâÖ66–FVçFÂÖVçG&æ6R"bb—FVÒæ6÷'&V7F–öå÷&V6öâÓÓÒ$66–FVçFÂ'WGFöâ&W72"bb—FVÒæ÷&–v–æÅöVçG'’çF–ÖRÓÓÒ###bÓ‚Ó5C3£C£ãƒcE¢"’Â$VçG&æ6R6÷'&V7F–öâ&WF–ç2F†RW†7B÷&–v–æÂ–âVF—B†—7F÷'’"“°Ð¢76W'BæWVÂ‡V'6öäÖæ–fW7Bæ–ç7V7F–öâçV'6öå÷&öEöWf–FVæ6U÷6WVVæ6Rç†÷FõöçVÖ&W'2æ¦ö–â‚"Â"’Â%2ÅBÅRÅbÅrÅ‚Å’ÅÅ"Â%2Õ&VÖ–âöæR–ç7V7F÷"ÖF—&V7FVBÆ&vR×G&7B6WVVæ6R"“°Ð¢76W'BæWVÂ‡V'6öäÖæ–fW7Bç†÷Föw&‡2æf–æB‡†÷FòÓâ†÷Fòç†÷FõöçVÖ&W"ÓÓÒ%""’æö'6W'fF–öåö–BÂçVÆÂÂ&ÆFW"VæÆ–æ¶VB†÷Fò—2æ÷B76–væVBFòæV&'’'WGFöâ&W72"“°Ð¢76W'B‡V'6öäÖæ–fW7Bç†÷Föw&‡2æf–æB‡†÷FòÓâ†÷Fòç†÷FõöçVÖ&W"ÓÓÒ%""’ææV&W7Eöö'6W'fF–öç2æWfW'’†Æ–æ²ÓâÆ–æ²ç&VÆF–öç6†—ÓÓÒ&æV&W7Eö'•öÆö6F–öå÷Væ6öæf—&ÖVB"’Â'&÷†–Ö—G’—2W‡Æ–6—FÇ’Væ6öæf—&ÖVB"“°Ð¢76W'B‡V'6öäÖæ–fW7Bæ–ç7V7F–öâæö'6W'fF–öç2æfÆDÖ†—FVÒÓâ²âââ†—FVÒæGF6†ÖVçG2ææV&W7E÷†÷Föw&‡2ÇÂµÒ’Ââââ†—FVÒæGF6†ÖVçG2ææV&W7E÷fö–6Uöæ÷FW2ÇÂµÒ•Ò’æWfW'’†Æ–æ²ÓâÆ–æ²ç&VÆF–öç6†—ÓÓÒ&F—&V7B"ÇÂÆ–æ²ç&VÆF–öç6†—ÓÓÒ&æV&W7Eö'•öÆö6F–öå÷Væ6öæf—&ÖVB"’Â&ö'6W'fF–öâ×6–FR&÷†–Ö—G’Æ–æ·2&RÇ6òW‡Æ–6—FÇ’Væ6öæf—&ÖVB"“°Ð¢76W'BæWVÂ‡V'6öäÖæ–fW7Bæ–ç7V7F–öâæ–ç7V7F÷%ö‡—÷F†W6W5³ÒæWf–FVæ6Uö6Æ76–f–6F–öâÂ$–çFW'&WFF–öâòæVVG2&öfW76–öæÂfW&–f–6F–öâ"“°Ð¢76W'B‡V'6öäÖæ–fW7Bæ–ç7V7F–öâæ–ç7V7F÷%ö‡—÷F†W6W5³Òç&ö†–&—F–öâæ–æ6ÇVFW2‚$Fòæ÷B&V6öÖÖVæB6öç7G'V7F–öâ"’“°Ð¢76W'BæWVÂ‡V'6öäÖæ–fW7Bæ–ç7V7F–öâç&öfW76–öæÅö†æFöfeö6&G2æ6&G2æÆVæwF‚ÂrÂ&ÆÂ6WfVâ&öfW76–öæÂVF–Væ6R6&G2&RvVæW&FVB"“°Ð¢76W'B‡V'6öäÖæ–fW7Bæ–ç7V7F–öâç&öfW76–öæÅö†æFöfeö6&G2æ6&G2æWfW'’†6&BÓâ6&BæW†7E÷VW7F–öâæ–æ6ÇVFW2‚&ÆvgVÂ÷WFÆWB"’bb6&BæÆ–Ö—FF–öâæ–æ6ÇVFW2‚&FöW2æ÷B&WÆ6RÆ–6Vç6VB&öfW76–öæÂv÷&²"’’Â&†æFöfg26²F†RW†7BVW7F–öâv—F†÷WBâVæÆ–6Vç6VB6öæ6ÇW6–öâ"“°Ð¢76W'B‡V'6öäf–ÆW2æ†2‚'&öfW76–öæÂÖ†æFöfbÖ6&G2æ‡FÖÂ"’bb²ââçV'6öäf–ÆW2æ¶W—2‚•Òæf–ÇFW"†æÖRÓâæÖRç7F'G5v—F‚‚'&öfW76–öæÂÖ†æFöfbò"’’æÆVæwF‚ÓÓÒrÂ&öæR&–çF&ÆR†æFöfb—26¶vVBf÷"WfW'’VF–Væ6R"“°Ð¢76W'BæWVÂ„¥4ôâç'6R‡V'6öäf–ÆW2ævWB‚$d”TÄEôUd”DTä4Uõ$Ud”Uræ§6öâ"’çFõ7G&–ær‚'WFc‚"’’æf÷W%÷†÷Fõ÷GFW&åö'•÷†÷Fòæf–æB†—FVÒÓâ—FVÒç†÷FõöçVÖ&W"ÓÓÒ%2"’çGFW&âæ6ö×ÆWFRÂG'VRÂ&f÷W"×†÷FòWf–FVæ6R6ö×ÆWFVæW72—2&W÷'FVB"“°Ð Ð¢6öç7Bæô–ÖvW'’Òv—B6¶vRæ7&VFT–ç7V7F–öå6¶vR‡°Ð¢–ç7V7F–öâÀÐ¢†÷FôVçG&–W3¢°Ð¢²–C¢'†÷FòÓ"Â÷&–v–æÄ&Æö#¢æWr&Æö"…·†÷FôöæT'—FW5ÒÂ²G—S¢&–ÖvR÷ær"Ò’ÂæÇ—6—4&Æö#¢æWr&Æö"…·†÷FôöæT'—FW5ÒÂ²G—S¢&–ÖvR÷ær"Ò’ÒÀÐ¢²–C¢'†÷FòÓ""Â÷&–v–æÄ&Æö#¢æWr&Æö"…·†÷FõGvô'—FW5ÒÂ²G—S¢&–ÖvR÷ær"Ò’ÂæÇ—6—4&Æö#¢æWr&Æö"…·†÷FõGvô'—FW5ÒÂ²G—S¢&–ÖvR÷ær"Ò’ÐÐ¢ÒÀÐ¢fö–6TVçG&–W3¢·²–C¢'fö–6RÓ"ÂVF–ô&Æö#¢æWr&Æö"…·fö–6T'—FW5ÒÂ²G—S¢&VF–òö×B"Ò’ÕÒÀÐ¢Ö6öçFW‡C¢²FW'&–ä&Æö#¢çVÆÂÂ6öçF÷W$&Æö#¢çVÆÂÂ&6VÇ5FW‡BÒÀÐ¢6¶vT¶–æC¢&&6·W"ÀÐ¢W‡÷'FVDC¢###bÓ‚Ó%CS££ã¢ Ð¢Ò“°Ð¢76W'BæÖF6‚†æô–ÖvW'’æf–ÆTæÖRÂõåV'6öåõ&öEô–ç7V7F–öåôeTÄÅô$4„•dUô&6·Wòò“°Ð¢6öç7Bæô–ÖvW'”f–ÆW2ÒW‡G&7E7F÷&VE¦—„'VffW"æg&öÒ†v—Bæô–ÖvW'’æ&Æö"æ'&”'VffW"‚’’“°Ð¢76W'B†æô–ÖvW'”f–ÆW2æ†2‚'&–çF&ÆR×&W÷'Bæ‡FÖÂ"’Â'&–çF&ÆR&W÷'B7F–ÆÂW†—7G2v†Vâ&7FW"–ÖvW'’f–Ç2"“°Ð¢76W'B‚æô–ÖvW'”f–ÆW2æ†2‚&6öçFW‡B÷W6w2×FW'&–âçær"’Â&Ö—76–ærFW'&–â—2†öæW7FÇ’öÖ—GFVB"“°Ð¢76W'B‚æô–ÖvW'”f–ÆW2æ†2‚&6öçFW‡B÷W6w2Ö6öçF÷W'2Ó&gBçær"’Â&Ö—76–ær6öçF÷W'2&R†öæW7FÇ’öÖ—GFVB"“°Ð Ð¢6öç7BÖ—76–ætæÇ—6—2Ò°Ð¢²–C¢'†÷FòÓ"Â÷&–v–æÄ&Æö#¢æWr&Æö"…·†÷FôöæT'—FW5ÒÂ²G—S¢&–ÖvR÷ær"Ò’ÂæÇ—6—4&Æö#¢çVÆÂÒÀÐ¢²–C¢'†÷FòÓ""Â÷&–v–æÄ&Æö#¢æWr&Æö"…·†÷FõGvô'—FW5ÒÂ²G—S¢&–ÖvR÷ær"Ò’ÂæÇ—6—4&Æö#¢æWr&Æö"…·†÷FõGvô'—FW5ÒÂ²G—S¢&–ÖvR÷ær"Ò’ÐÐ¢Ó°Ð¢v—B76W'Bç&V¦V7G2€Ð¢‚’Óâ6¶vRæ7&VFT–ç7V7F–öå6¶vR‡²–ç7V7F–öâÂ†÷FôVçG&–W3¢Ö—76–ætæÇ—6—2Âfö–6TVçG&–W3¢·²–C¢'fö–6RÓ"ÂVF–ô&Æö#¢æWr&Æö"…·fö–6T'—FW5ÒÂ²G—S¢&VF–òö×B"Ò’ÕÒÂÖ6öçFW‡C¢²FW'&–ä&Æö#¢æWr&Æö"…·FW'&–ä'—FW5Ò’Â6öçF÷W$&Æö#¢æWr&Æö"…¶6öçF÷W$'—FW5Ò’Â&6VÇ5FW‡BÒÒ’ÀÐ¢öæÇ—6—2×6fR–ÖvR6÷’òÀÐ¢'6¶vR7&VF–öâf–Ç26Æ÷6VBv†Vâ†÷Fò6ææ÷B&RF—7Æ–VBf÷"æÇ—6—2 Ð¢“°Ð Ð¢6öç7BÆ&vT÷&–v–æÂÒæWr&Æö"…´'VffW"æÆÆö2ƒ#BÂƒFb•ÒÂ²G—S¢&–ÖvRö§Vr"Ò“°Ð¢6öç7BÆ&vTæÇ—6—2ÒæWr&Æö"…´'VffW"æÆÆö2ƒ3ƒBÂƒC•ÒÂ²G—S¢&–ÖvRö§Vr"Ò“°Ð¢6öç7BÆ&vU†÷F÷2Ò'&’æg&öÒ‡²ÆVæwFƒ¢“bÒÂ…òÂ–æFW‚’Óâ‡°Ð¢–C¢Æ&vR×†÷FòÒG¶–æFW‚²ÖÀÐ¢†÷FõöçVÖ&W#¢G¶–æFW‚²ÖÀÐ¢76ö6–FVEöÖ&¶W%ö–C¢Æ&vRÖWfVçBÒG¶–æFW‚²ÖÀÐ¢6FVv÷'“¢–æFW‚R2ÓÓÒò%vWB"¢$÷F†W""ÀÐ¢æ÷FS¢66ÆR×FW7B†÷Föw&‚G¶–æFW‚²ÖÀÐ¢Wf–FVæ6Uö6Æ76–f–6F–öã¢$ö'6W'fVB"ÀÐ¢ö'6W'fF–öåöGG&–'WFW3¢·ÒÀÐ¢&V6÷&FVEöC¢æWrFFR„FFRç'6R‚###bÓ‚Ó%CC££ã¢"’²–æFW‚¢3’çFô•4õ7G&–ær‚’ÀÐ¢ÆC¢3ãCƒb²†–æFW‚R’’¢ãBÀÐ¢Æöã¢Óƒrã“‚²ÖF‚æfÆö÷"†–æFW‚ò’’¢ãRÀÐ¢w5ö67W&7•öÓ¢BÀÐ¢w5÷÷6—F–öåöC¢7F'FVBÀÐ¢6ö×75ö†VF–æuöFVs¢–æFW‚R3cÀÐ¢v–GF…÷ƒ¢“ÀÐ¢†V–v‡E÷ƒ¢C#RÀÐ¢—†VÅö÷&–VçFF–öã¢&ÆæG66R"ÀÐ¢÷&–v–æÅöf–ÆVæÖS¢”ÔuòGµ7G&–ær†–æFW‚²’çE7F'BƒBÂ#"—Òä¥vÀÐ¢÷&–v–æÅöÖ–ÖU÷G—S¢&–ÖvRö§Vr"ÀÐ¢÷&–v–æÅ÷6—¦Uö'—FW3¢Æ&vT÷&–v–æÂç6—¦RÀÐ¢æÇ—6—5÷6—¦Uö'—FW3¢Æ&vTæÇ—6—2ç6—¦PÐ¢Ò’“°Ð¢6öç7BÆ&vTÖ&¶W'2Ò'&’æg&öÒ‡²ÆVæwFƒ¢#S"ÒÂ…òÂ–æFW‚’Óâ‡°Ð¢–C¢Æ&vRÖWfVçBÒG¶–æFW‚²ÖÀÐ¢G—S¢–æFW‚Â“bò'†÷Fò"¢&æ÷FR"ÀÐ¢ö'6W'fF–öå÷G—S¢–æFW‚Â“bò&f–VÆBç†÷Fò"¢&f–VÆBææ÷FR"ÀÐ¢'WGFöåöÆ&VÃ¢–æFW‚Â“bò%†÷Fò"¢$g&VRæ÷FR"ÀÐ¢Wf–FVæ6Uö6Æ76–f–6F–öã¢$ö'6W'fVB"ÀÐ¢æ÷FS¢ö'6W'fF–öâG¶–æFW‚²ÖÀÐ¢GG&–'WFW3¢–æFW‚Â“bò²†÷FõöçVÖ&W#¢G¶–æFW‚²ÖÒ¢·ÒÀÐ¢F–ÖS¢æWrFFR„FFRç'6R‡7F'FVB’²–æFW‚¢#’çFô•4õ7G&–ær‚’ÀÐ¢ÆC¢3ãCƒb²†–æFW‚R#’¢ã3RÀÐ¢Æöã¢Óƒrã“‚²ÖF‚æfÆö÷"†–æFW‚ò#’¢ãBÀÐ¢w5ö67W&7•öÓ¢BÀÐ¢w5÷÷6—F–öåöC¢7F'FVBÀÐ¢†÷Fõö–C¢–æFW‚Â“bòÆ&vR×†÷FòÒG¶–æFW‚²Ö¢çVÆÂÀÐ¢fö–6Uöæ÷FUö–C¢çVÆÀÐ¢Ò’“°Ð¢6öç7BÆ&vUö–çG2Ò'&’æg&öÒ‡²ÆVæwFƒ¢C“cBÒÂ…òÂ–æFW‚’Óâ‡°Ð¢6WVVæ6S¢–æFW‚²ÀÐ¢F–ÖS¢æWrFFR„FFRç'6R‡7F'FVB’²–æFW‚¢’çFô•4õ7G&–ær‚’ÀÐ¢ÆC¢3ãCƒR²†–æFW‚RS’¢ãRÀÐ¢Æöã¢Óƒrã“’²ÖF‚æfÆö÷"†–æFW‚òS’¢ãRÀÐ¢67W&7•öÓ¢BÀÐ¢7VVEö×3¢ÀÐ¢†VF–æuöFVs¢–æFW‚R3c Ð¢Ò’“°Ð¢6öç7BÆ&vT–ç7V7F–öâÒ°Ð¢66†VÖöæÖS¢–ç7V7F–öâç66†VÖöæÖRÀÐ¢66†VÖ÷fW'6–öã¢–ç7V7F–öâç66†VÖ÷fW'6–öâÀÐ¢&÷W'G•ö–C¢–ç7V7F–öâç&÷W'G•ö–BÀÐ¢–ç7V7F–öåö–C¢&–ç7V7F–öâÓ“b×†÷Fò×66ÆR"ÀÐ¢7F'FVBÀÐ¢7F÷VC¢###bÓ‚Ó%Cc££ã¢"ÀÐ¢Æ–fV7–6ÆUöWfVçG3¢–ç7V7F–öâæÆ–fV7–6ÆUöWfVçG2ÀÐ¢ö–çG3¢Æ&vUö–çG2ÀÐ¢Ö&¶W'3¢Æ&vTÖ&¶W'2ÀÐ¢÷&–VçFF–öå÷6×ÆW3¢'&’æg&öÒ‡²ÆVæwFƒ¢“CBÒÂ…òÂ–æFW‚’Óâ‡²F–ÖS¢æWrFFR„FFRç'6R‡7F'FVB’²–æFW‚¢S’çFô•4õ7G&–ær‚’ÂÇ†öFVs¢–æFW‚R3cÂ&WFöFVs¢"ÂvÖÖöFVs¢ÓÒ’’ÀÐ¢6öæF—F–öç3¢–ç7V7F–öâæ6öæF—F–öç2ÀÐ¢†÷F÷3¢Æ&vU†÷F÷2ÀÐ¢fö–6Uöæ÷FW3¢°Ð¢ö&¦V7Bæ76–vâ‡·ÒÂ–ç7V7F–öâçfö–6Uöæ÷FW5³ÒÂ²–C¢&Æ&vR×fö–6RÓ"Â6—¦Uö'—FW3¢fö–6T'—FW2æÆVæwF‚Ò’ÀÐ¢ö&¦V7Bæ76–vâ‡·ÒÂ–ç7V7F–öâçfö–6Uöæ÷FW5³ÒÂ²–C¢&Æ&vR×fö–6RÓ""Â6—¦Uö'—FW3¢fö–6T'—FW2æÆVæwF‚ÒÐ¢ÐÐ¢Ó°Ð¢6öç7BÆ&vU†÷FôVçG&–W2ÒÆ&vU†÷F÷2æÖ‡†÷FòÓâ‡²–C¢†÷Fòæ–BÂ÷&–v–æÄ&Æö#¢Æ&vT÷&–v–æÂÂæÇ—6—4&Æö#¢Æ&vTæÇ—6—2Ò’“°Ð¢6öç7BÆ&vUfö–6TVçG&–W2ÒÆ&vT–ç7V7F–öâçfö–6Uöæ÷FW2æÖ†æ÷FRÓâ‡²–C¢æ÷FRæ–BÂVF–ô&Æö#¢æWr&Æö"…·fö–6T'—FW5ÒÂ²G—S¢&VF–òö×B"Ò’Ò’“°Ð¢6öç7B6–×VÆFVE66ÆTVçG&–W2ÒÆ&vU†÷F÷2æÖ‡†÷FòÓâ‡²–C¢†÷Fòæ–BÂ÷&–v–æÄ&Æö#¢²6—¦S¢rã"¢#B¢#BÒÂæÇ—6—4&Æö#¢²6—¦S¢ã‚¢#B¢#BÒÒ’“°Ð¢6öç7B6–×VÆFVE6—¦W2Ò6¶vRæW7F–ÖFT–ç7V7F–öå6¶vU6—¦W2‡°Ð¢–ç7V7F–öã¢Æ&vT–ç7V7F–öâÀÐ¢†÷FôVçG&–W3¢6–×VÆFVE66ÆTVçG&–W2ÀÐ¢fö–6TVçG&–W3¢·²VF–ô&Æö#¢²6—¦S¢#B¢#BÒÒÂ²VF–ô&Æö#¢²6—¦S¢#B¢#BÒÕÒÀÐ¢Ö6öçFW‡C¢²FW'&–ä&Æö#¢²6—¦S¢FW'&–ä'—FW2æÆVæwF‚ÒÂ6öçF÷W$&Æö#¢²6—¦S¢6öçF÷W$'—FW2æÆVæwF‚ÒÂ&6VÇ5FW‡BÐÐ¢Ò“°Ð¢76W'B‡6–×VÆFVE6—¦W2ç&W÷'D'—FW2Â#¢#B¢#BÂ#“b×†÷Fò&W÷'BW7F–ÖFR7F—2&VfW&&Ç’&VÆ÷r#Ô"Bã‚Ô"W"æÇ—6—2–ÖvR"“°Ð¢76W'B‡6–×VÆFVE6—¦W2ægVÆÄ&6†—fT'—FW2âC¢#B¢#BÂ#“b×†÷FògVÆÂ&6†—fRW7F–ÖFR†öæW7FÇ’&VfÆV7G2&÷†–ÖFVÇ’ãBt"öb÷&–v–æÇ2"“°Ð Ð¢6öç7BÆ&vU&W÷'BÒv—B6¶vRæ7&VFT–ç7V7F–öå6¶vR‡°Ð¢–ç7V7F–öã¢Æ&vT–ç7V7F–öâÀÐ¢†÷FôVçG&–W3¢Æ&vU†÷FôVçG&–W2ÀÐ¢fö–6TVçG&–W3¢Æ&vUfö–6TVçG&–W2ÀÐ¢Ö6öçFW‡C¢²FW'&–ä&Æö#¢çVÆÂÂ6öçF÷W$&Æö#¢çVÆÂÂ&6VÇ5FW‡BÒÀÐ¢6¶vTÖöFS¢'&W÷'B"ÀÐ¢W‡÷'FVDC¢###bÓ‚Ó%Cc££ã¢ Ð¢Ò“°Ð¢6öç7BÆ&vU&W÷'Df–ÆW2ÒW‡G&7E7F÷&VE¦—„'VffW"æg&öÒ†v—BÆ&vU&W÷'Bæ&Æö"æ'&”'VffW"‚’’“°Ð¢76W'BæWVÂ…²ââæÆ&vU&W÷'Df–ÆW2æ¶W—2‚•Òæf–ÇFW"†æÖRÓâõöæÇ—6—5Âæ§rBòçFW7B†æÖR’’æÆVæwF‚Â“bÂ#“b×†÷Fò&W÷'B6¶vR6öçF–ç2WfW'’æÇ—6—2×VÆ—G’†÷Föw&‚"“°Ð¢76W'BæWVÂ…²ââæÆ&vU&W÷'Df–ÆW2æ¶W—2‚•Òæf–ÇFW"†æÖRÓâõö÷&–v–æÅÂæ§rBòçFW7B†æÖR’’æÆVæwF‚ÂÂ#“b×†÷Fò&W÷'B6¶vR6öçF–ç2æòGWÆ–6FR÷&–v–æÇ2"“°Ð¢6öç7BÆ&vU&W÷'DÖæ–fW7BÒ¥4ôâç'6R†Æ&vU&W÷'Df–ÆW2ævWB‚&–ç7V7F–öâæ§6öâ"’çFõ7G&–ær‚'WFc‚"’“°Ð¢76W'BæWVÂ†Æ&vU&W÷'DÖæ–fW7Bç7VÖÖ'’æw5÷G&6µ÷ö–çEö6÷VçBÂC“cB“°Ð¢76W'BæWVÂ†Æ&vU&W÷'DÖæ–fW7Bç7VÖÖ'’æf–VÆEöWfVçEö6÷VçBÂ#S"“°Ð¢76W'BæWVÂ†Æ&vU&W÷'DÖæ–fW7Bç7VÖÖ'’æFWf–6Uö÷&–VçFF–öå÷6×ÆUö6÷VçBÂ“CB“°Ð¢76W'BæWVÂ†Æ&vU&W÷'DÖæ–fW7Bç7VÖÖ'’ç†÷Fõö6÷VçBÂ“b“°Ð¢76W'BæWVÂ†Æ&vU&W÷'DÖæ–fW7Bç7VÖÖ'’çfö–6Uöæ÷FUö6÷VçBÂ"“°Ð¢6öç7BÆ&vU&–çF&ÆU&W÷'BÒÆ&vU&W÷'Df–ÆW2ævWB‚'&–çF&ÆR×&W÷'Bæ‡FÖÂ"’çFõ7G&–ær‚'WFc‚"“°Ð¢76W'B†Æ&vU&–çF&ÆU&W÷'Bæ–æ6ÇVFW2‚w7&3Ò'†÷F÷2ó“eöæÇ—6—2æ§r"r’Â#“gF‚†÷Föw&‚&W6öÇfW2–âF†R&–çF&ÆR&W÷'B"“°Ð¢76W'B†Æ&vU&–çF&ÆU&W÷'Bæ–æ6ÇVFW2‚vÆöF–æsÒ&Æ§’"r’Â&Æ&vR&–çF&ÆR†÷FòvÆÆW'’W6W2'&÷w6W"Æ§’ÆöF–ær"“°Ð Ð¢6öç7BÆ&vTgVÆÄ&6†—fRÒv—B6¶vRæ7&VFT–ç7V7F–öå6¶vR‡°Ð¢–ç7V7F–öã¢Æ&vT–ç7V7F–öâÀÐ¢†÷FôVçG&–W3¢Æ&vU†÷FôVçG&–W2ÀÐ¢fö–6TVçG&–W3¢Æ&vUfö–6TVçG&–W2ÀÐ¢Ö6öçFW‡C¢²FW'&–ä&Æö#¢çVÆÂÂ6öçF÷W$&Æö#¢çVÆÂÂ&6VÇ5FW‡BÒÀÐ¢6¶vTÖöFS¢&gVÆÅö&6†—fR"ÀÐ¢W‡÷'FVDC¢###bÓ‚Ó%Cc£#£ã¢ Ð¢Ò“°Ð¢6öç7BÆ&vTgVÆÄf–ÆW2ÒW‡G&7E7F÷&VE¦—„'VffW"æg&öÒ†v—BÆ&vTgVÆÄ&6†—fRæ&Æö"æ'&”'VffW"‚’’“°Ð¢76W'BæWVÂ…²ââæÆ&vTgVÆÄf–ÆW2æ¶W—2‚•Òæf–ÇFW"†æÖRÓâõö÷&–v–æÅÂæ§rBòçFW7B†æÖR’’æÆVæwF‚Â“bÂ#“b×†÷FògVÆÂ&6†—fR6öçF–ç2WfW'’÷&–v–æÂ†÷Föw&‚"“°Ð¢76W'BæWVÂ…²ââæÆ&vTgVÆÄf–ÆW2æ¶W—2‚•Òæf–ÇFW"†æÖRÓâõöæÇ—6—5Âæ§rBòçFW7B†æÖR’’æÆVæwF‚Â“bÂ#“b×†÷FògVÆÂ&6†—fR6öçF–ç2WfW'’æÇ—6—26÷’"“°Ð¢76W'B†Æ&vTgVÆÄ&6†—fRæ&Æö"ç6—¦RâÆ&vU&W÷'Bæ&Æö"ç6—¦RÂ&gVÆÂ&6†—fR—2Æ&vW"&V6W6R—B&W6W'fW2W†7B÷&–v–æÇ2"“°Ð Ð¢&ö6W72ç7FF÷WBçw&—FR†53¢fW&–f–VBf—fRÖFV6—6–öâæÇ—6—2Â6öæf–FVæ6RæBVæ6W'F–çG’×&VGV7F–öâ'VÆW2Â7F¶V†öÆFW"VW7F–öç2Â’×&VG’&VÆF–öç6†—2ÂW†7B†÷Fò&V6÷fW'’ÂVæBÖöæÇ’–ævW7F–öâÂæB“b×†÷Fò66ÆRåÆæ“°Ð§ÐÐ Ð¦Ö–â‚’æ6F6‚†W'&÷"Óâ°Ð¢6öç6öÆRæW'&÷"†W'&÷"“°Ð¢&ö6W72æW†—D6öFRÒ°Ð§Ò“°Ð 