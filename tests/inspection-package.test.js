"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Package = require("../field/inspection-package.js");

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
  const types = ["wet", "dry", "blocked", "high", "homesite", "culvert", "tree", "entrance", "wildlife", "note"];
  const markers = types.map((type, index) => ({
    id: `event-${index + 1}`,
    source: "button_press",
    type,
    observation_type: `field.${type}`,
    taxonomy_version: "property-observation-1.0",
    button_label: type === "tree" ? "Specimen Tree" : type,
    note: type === "note" ? "Standing water reaches the flagged pine." : "",
    attributes: type === "tree" ? { species: "live_oak", diameter_in: 38 } : {},
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
    id: "event-photo-1", source: "button_press", type: "photo", observation_type: "field.photo",
    taxonomy_version: "property-observation-1.0", button_label: "Photo", note: "", attributes: {},
    time: "2026-08-02T14:03:00.000Z", lat: 30.4895, lon: -87.0932, gps_accuracy_m: 2.9,
    gps_position_at: points[1].time, compass_heading_deg: 88, device_orientation: { alpha_deg: 272, beta_deg: 1, gamma_deg: -2 },
    photo_id: "photo-1", voice_note_id: null
  });
  markers.push({
    id: "event-photo-2", source: "button_press", type: "photo", observation_type: "field.photo",
    taxonomy_version: "property-observation-1.0", button_label: "Photo", note: "", attributes: {},
    time: "2026-08-02T14:04:00.000Z", lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5,
    gps_position_at: points[2].time, compass_heading_deg: 44, device_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0 },
    photo_id: "photo-2", voice_note_id: null
  });
  markers.push({
    id: "event-voice-1", source: "button_press", type: "voice_note", observation_type: "field.voice_note",
    taxonomy_version: "property-observation-1.0", button_label: "Voice Note", note: "", attributes: { duration_ms: 4500 },
    time: "2026-08-02T14:05:00.000Z", lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5,
    gps_position_at: points[2].time, compass_heading_deg: 44, device_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0 },
    photo_id: null, voice_note_id: "voice-1"
  });

  const inspection = {
    schema_name: "property-intelligence-inspection",
    schema_version: "1.0",
    property_id: "parcel:221S280000001010000",
    inspection_id: "inspection-acceptance-test",
    started,
    stopped: "2026-08-02T15:00:00.000Z",
    lifecycle_events: [
      { type: "inspection_started", time: "2026-08-02T14:00:00.000Z", source: "button_press" },
      { type: "inspection_finished", time: "2026-08-02T15:00:00.000Z", source: "button_press" }
    ],
    points,
    markers,
    orientation_samples: [{ time: "2026-08-02T14:00:05.000Z", alpha_deg: 270, beta_deg: 1, gamma_deg: -1, absolute: true, compass_heading_deg: 90, compass_accuracy_deg: 5, lat: 30.4891, lon: -87.0941, gps_accuracy_m: 3.2 }],
    photos: [
      { id: "photo-1", camera_opened_at: "2026-08-02T14:02:55.000Z", recorded_at: "2026-08-02T14:03:00.000Z", source_file_last_modified_at: "2026-08-02T14:03:00.000Z", lat: 30.4895, lon: -87.0932, gps_accuracy_m: 2.9, gps_position_at: points[1].time, gps_position_age_ms: 100, location_source: "live_browser_geolocation", compass_heading_deg: 88, sensor_orientation: { alpha_deg: 272, beta_deg: 1, gamma_deg: -2, absolute: true }, device_screen_orientation: "portrait-primary", device_screen_angle_deg: 0, width_px: 192, height_px: 192, pixel_orientation: "square", exif_orientation: 1, exif_orientation_description: "normal", original_filename: "field-one.png", original_mime_type: "image/png", original_size_bytes: photoOneBytes.length },
      { id: "photo-2", camera_opened_at: "2026-08-02T14:03:55.000Z", recorded_at: "2026-08-02T14:04:00.000Z", source_file_last_modified_at: "2026-08-02T14:04:00.000Z", lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5, gps_position_at: points[2].time, gps_position_age_ms: 150, location_source: "live_browser_geolocation", compass_heading_deg: 44, sensor_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0, absolute: true }, device_screen_orientation: "landscape-primary", device_screen_angle_deg: 90, width_px: 512, height_px: 512, pixel_orientation: "square", exif_orientation: 6, exif_orientation_description: "rotated 90 degrees clockwise", original_filename: "field-two.png", original_mime_type: "image/png", original_size_bytes: photoTwoBytes.length }
    ],
    voice_notes: [{ id: "voice-1", started_at: "2026-08-02T14:05:00.000Z", finished_at: "2026-08-02T14:05:04.500Z", duration_ms: 4500, mime_type: "audio/mp4", size_bytes: voiceBytes.length, lat: 30.4901, lon: -87.0922, gps_accuracy_m: 3.5, gps_position_at: points[2].time, compass_heading_deg: 44, sensor_orientation: { alpha_deg: 316, beta_deg: 3, gamma_deg: 0, absolute: true }, recovered_after_interruption: false }]
  };

  const result = await Package.createInspectionPackage({
    inspection,
    photoEntries: [
      { id: "photo-1", originalBlob: new Blob([photoOneBytes], { type: "image/png" }), analysisBlob: new Blob([photoOneBytes], { type: "image/png" }) },
      { id: "photo-2", originalBlob: new Blob([photoTwoBytes], { type: "image/png" }), analysisBlob: new Blob([photoTwoBytes], { type: "image/png" }) }
    ],
    voiceEntries: [{ id: "voice-1", audioBlob: new Blob([voiceBytes], { type: "audio/mp4" }) }],
    mapContext: {
      terrainBlob: new Blob([terrainBytes], { type: "image/png" }),
      contourBlob: new Blob([contourBytes], { type: "image/png" }),
      parcelsText
    },
    appVersion: "test",
    sourceUrl: "https://example.test/field/",
    exportedAt: "2026-08-02T15:00:01.000Z"
  });

  assert.equal(result.blob.type, "application/zip");
  assert.match(result.fileName, /^Property_Inspection_.*\.zip$/);
  const zipBytes = Buffer.from(await result.blob.arrayBuffer());
  const files = extractStoredZip(zipBytes);
  const requiredFiles = [
    "README.txt", "schema.json", "inspection.json", "events.csv", "photos.csv", "voice-notes.csv",
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
  assert.equal(manifest.summary.gps_track_point_count, points.length);
  assert.equal(manifest.summary.field_event_count, markers.length);
  assert.equal(manifest.summary.photo_count, 2);
  assert.equal(manifest.summary.original_photo_count, 2);
  assert.equal(manifest.summary.analysis_photo_count, 2);
  assert.equal(manifest.summary.voice_note_count, 1);
  assert.equal(manifest.summary.device_orientation_sample_count, 1);
  assert.equal(manifest.summary.lifecycle_event_count, 2);
  assert.equal(manifest.property.recorded_acres, 86.7464918);
  assert.equal(manifest.inspection.gps_track.length, points.length);
  assert(manifest.inspection.gps_track.every(point => point.time && Number.isFinite(point.accuracy_m)), "every GPS point has time and accuracy");
  assert(types.every(type => manifest.inspection.observations.some(observation => observation.observation_type === `field.${type}`)), "all field-button observation types reconstruct");
  assert.equal(manifest.photographs[0].location.latitude, inspection.photos[0].lat);
  assert.equal(manifest.photographs[0].compass_heading_deg, 88);
  assert.equal(manifest.photographs[1].orientation.exif_value, 6);
  assert.equal(manifest.voice_notes[0].audio.path, "voice-notes/001_voice-note.m4a");
  manifest.photographs.forEach(photo => {
    assert(files.has(photo.original.path), `${photo.photo_id} original path resolves`);
    assert(files.has(photo.analysis.path), `${photo.photo_id} analysis path resolves`);
    assert.equal(files.get(photo.original.path).length, photo.original.size_bytes, `${photo.photo_id} original byte count`);
  });
  assert(files.has(manifest.map_context.layers.parcels.path), "parcel geometry path resolves");
  assert(files.has(manifest.map_context.layers.terrain.path), "terrain path resolves");
  assert(files.has(manifest.map_context.layers.contours.path), "contour path resolves");
  assert(distanceMeters(manifest.inspection.gps_track) > 100, "walking distance can be reconstructed from the package alone");

  const parcelGeoJson = JSON.parse(files.get("context/parcels.geojson").toString("utf8"));
  assert(parcelGeoJson.features.some(feature => String(feature.properties.PAR_NUM) === "221S280000001010000"), "subject parcel supports inspected/missed-area analysis");
  assert(files.get("events.csv").toString("utf8").includes("Standing water reaches the flagged pine."), "free note is recoverable");

  await assert.rejects(
    () => Package.createInspectionPackage({ inspection, photoEntries: [], voiceEntries: [], mapContext: { terrainBlob: new Blob([terrainBytes]), contourBlob: new Blob([contourBytes]), parcelsText } }),
    /Photo storage mismatch/,
    "package creation fails closed when actual photograph files are missing"
  );

  const missingAnalysis = [
    { id: "photo-1", originalBlob: new Blob([photoOneBytes], { type: "image/png" }), analysisBlob: null },
    { id: "photo-2", originalBlob: new Blob([photoTwoBytes], { type: "image/png" }), analysisBlob: new Blob([photoTwoBytes], { type: "image/png" }) }
  ];
  await assert.rejects(
    () => Package.createInspectionPackage({ inspection, photoEntries: missingAnalysis, voiceEntries: [{ id: "voice-1", audioBlob: new Blob([voiceBytes], { type: "audio/mp4" }) }], mapContext: { terrainBlob: new Blob([terrainBytes]), contourBlob: new Blob([contourBytes]), parcelsText } }),
    /analysis-safe image copy/,
    "package creation fails closed when a photo cannot be displayed for analysis"
  );

  process.stdout.write(`PASS: recovered ${manifest.summary.photo_count} originals, ${manifest.summary.photo_count} analysis copies, ${manifest.summary.voice_note_count} voice note, ${manifest.summary.gps_track_point_count} GPS points, ${manifest.summary.field_event_count} observations, and all offline map context from one ${zipBytes.length}-byte ZIP.\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
