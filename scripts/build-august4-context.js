"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
if (!sourcePath || !outputPath) throw new Error("Usage: node build-august4-context.js FIELD_TEST_FAILURE.json output.json");

const sourceBytes = fs.readFileSync(sourcePath);
const source = JSON.parse(sourceBytes.toString("utf8"));
const photos = (source.photographs || []).map(photo => ({
  photo_id: photo.photo_id, photo_number: photo.photo_number,
  recorded_at: photo.recorded_at,
  latitude: photo.location && photo.location.latitude,
  longitude: photo.location && photo.location.longitude,
  gps_accuracy_m: photo.location && photo.location.gps_accuracy_m,
  category: photo.category, direct_observation_id: photo.observation_id
}));
const output = {
  schema_name: "property-intelligence-august-4-reference-route", schema_version: "1.0",
  source_classification: source.classification,
  source_inspection_id: source.source_inspection_id,
  source_date: source.date,
  source_json_sha256: crypto.createHash("sha256").update(sourceBytes).digest("hex"),
  information_class: "CAPTURED_BY_DEVICE",
  display_status: "REFERENCE_ROUTE_FROM_PRIOR_FAILED_USABILITY_TEST",
  planning_measurements: {
    information_class: "DERIVED_FROM_PHONE_GPS_AND_COUNTY_PARCEL_GEOMETRY",
    label: "APPROXIMATE — PHONE GPS AND COUNTY PARCEL MAP, NOT A SURVEY",
    large_tract_acres: 81.2, small_tract_acres: 5.5,
    furthest_reliable_sample_east_of_large_tract_west_edge_ft: 800,
    approximate_percent_across_parcel_at_that_latitude: 31,
    approximate_distance_to_nearest_parcel_edge_ft: 410
  },
  limitations: [
    "The route shows only sampled locations and does not establish that the entire large tract was inspected.",
    "Much of the eastern large tract remains unvisited and unknown.",
    "Phone GPS and county parcel geometry are approximate and are not a survey."
  ],
  raw_gps_points: (source.gps_track || []).map(point => ({
    gps_point_id: point.gps_point_id, sequence: point.sequence, time: point.time,
    latitude: point.lat, longitude: point.lon, accuracy_m: point.accuracy_m,
    altitude_m: point.altitude_m, speed_mps: point.speed_mps, heading_deg: point.heading_deg
  })),
  photograph_points: photos
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output));
process.stdout.write(`${output.raw_gps_points.length} GPS points and ${photos.length} photograph points written to ${outputPath}\n`);
