"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Water = require("../field/water-intelligence.js");

function main() {
  const root = path.resolve(__dirname, "..");
  const parcels = JSON.parse(fs.readFileSync(path.join(root, "field/assets/parcels.json"), "utf8"));
  const subject = parcels.features.find(feature => String(feature.attributes.PAR_NUM) === "221S280000001010000");
  const sections = Water.identifyParcelSections(subject);
  assert.equal(sections.length, 2, "the verified subject parcel has two separate mapped sections");
  assert.equal(sections[0].name, "Large Tract");
  assert.equal(sections[1].name, "Small Tract");
  assert(Math.abs(sections[0].calculated_acres - 81.26) < 0.5, "large tract agrees with the verified approximately 81.26 acres");
  assert(Math.abs(sections[1].calculated_acres - 5.49) < 0.1, "small tract agrees with the verified approximately 5.49 acres");

  const inspection = {
    property_id: "parcel:221S280000001010000",
    inspection_id: "water-map-regression",
    water_observation_rule: { all_observed_standing_water_photographed: true },
    points: [
      { sequence: 1, time: "2026-08-03T14:00:00Z", lat: 30.4900, lon: -87.0924 },
      { sequence: 2, time: "2026-08-03T14:01:00Z", lat: 30.4902, lon: -87.0922 },
      { sequence: 3, time: "2026-08-03T14:02:00Z", lat: 30.4904, lon: -87.0920 }
    ],
    observations: [
      { observation_id: "obs-wet-1", observation_type: "field.wet", observed_at: "2026-08-03T14:01:00Z", gps: { latitude: 30.4902, longitude: -87.0922 }, attributes: {} },
      { observation_id: "obs-dry-1", observation_type: "field.dry", observed_at: "2026-08-03T14:02:00Z", gps: { latitude: 30.4904, longitude: -87.0920 }, attributes: {} }
    ],
    photos: [
      {
        photo_id: "small-minor-1", photo_number: "P10", associated_observation_id: "obs-wet-1", recorded_at: "2026-08-03T14:01:05Z",
        location: { latitude: 30.49020, longitude: -87.09220 }, water_confirmation: "yes",
        water: { water_type: "standing", water_depth_band: "3-7_inches", measurement_basis: "Estimated", water_width_ft: 3, water_length_ft: 5, water_behavior: "isolated_depression" },
        explanation_voice_note_ids: ["voice-p10"], analysis: { path: "photos/010_analysis.jpg" }
      },
      {
        photo_id: "small-minor-2", photo_number: "P11", recorded_at: "2026-08-03T14:01:30Z",
        location: { latitude: 30.49022, longitude: -87.09218 }, water_confirmation: "yes",
        water: { water_type: "standing", water_depth_band: "3-7_inches", measurement_basis: "Estimated", water_width_ft: 3, water_length_ft: 5, water_behavior: "isolated_depression" },
        analysis: { path: "photos/011_analysis.jpg" }
      },
      {
        photo_id: "small-flow", photo_number: "P12", recorded_at: "2026-08-03T14:03:00Z",
        location: { latitude: 30.49105, longitude: -87.09245 }, water_confirmation: "yes",
        water: { water_type: "creek_stream", water_depth_band: "8-12_inches", measurement_basis: "Estimated", water_width_ft: 6, water_length_ft: 30, water_behavior: "apparent_creek_channel" },
        analysis: { path: "photos/012_analysis.jpg" }
      },
      {
        photo_id: "small-single-no-dimensions", photo_number: "P13", recorded_at: "2026-08-03T14:05:00Z",
        location: { latitude: 30.49070, longitude: -87.09160 }, water_confirmation: "yes",
        water: { water_type: "standing", water_depth_band: "unknown", measurement_basis: "Unknown", water_width_ft: null, water_length_ft: null, water_behavior: "unknown" },
        analysis: { path: "photos/013_analysis.jpg" }
      },
      {
        photo_id: "large-tract-water", photo_number: "P1", recorded_at: "2026-08-03T13:00:00Z",
        location: { latitude: 30.4875, longitude: -87.0870 }, water_confirmation: "yes",
        water: { water_type: "standing", water_depth_band: "3-7_inches", measurement_basis: "Estimated", water_width_ft: 20, water_length_ft: 20, water_behavior: "connected_pooling" },
        analysis: { path: "photos/001_analysis.jpg" }
      }
    ]
  };

  const model = Water.buildSmallTractWaterMapModel({ inspection, subjectFeature: subject, statedSmallTractAcres: 5.49, generatedAt: "2026-08-03T18:00:00Z" });
  assert.equal(model.status, "GENERATED");
  assert.equal(model.small_tract.ring_index, 1, "only the smaller verified parcel ring is mapped");
  assert.equal(model.water_photographs.length, 4, "every small-tract water photo is retained");
  assert.deepEqual(model.excluded_large_tract.excluded_water_photo_ids, ["large-tract-water"], "initial large-tract water evidence is excluded geometrically");
  assert.equal(model.route_segments.length, 1, "small-tract route is retained without a line to the large tract");
  assert(model.high_dry_observations.some(item => item.observation_id === "obs-dry-1"), "high/dry evidence remains a separate layer");
  assert.equal(model.inspected_no_standing_water.enabled, true, "the inspector's explicit all-water-photographed rule enables the inspected-dry corridor");
  assert(model.inspected_no_standing_water.limitation.includes("does not establish year-round dryness"));

  const minorCluster = model.water_area_clusters.find(cluster => cluster.supporting_photo_ids.includes("small-minor-1"));
  assert.equal(minorCluster.evidence_count, 2, "nearby compatible puddle photographs form one evidence cluster");
  assert.equal(minorCluster.significance, "Minor localized depression");
  assert(minorCluster.estimated_outline, "two nearby consistent observations receive a conservative estimated outline");
  const minorOutlineSpanMeters = Math.max(...minorCluster.estimated_outline.map(point => Water.haversine(
    { lat: minorCluster.center.latitude, lon: minorCluster.center.longitude },
    { lat: point[1], lon: point[0] }
  )));
  assert(minorOutlineSpanMeters < 15, "3-by-5-foot depressions never become an enormous inferred polygon");

  const flowingCluster = model.water_area_clusters.find(cluster => cluster.supporting_photo_ids.includes("small-flow"));
  assert.equal(flowingCluster.significance, "Flowing-water corridor", "northwest flowing water is not merged with standing puddles");
  assert.equal(flowingCluster.classification, "Observed flowing-water corridor — permanence and legal classification unknown.");
  assert(model.preliminary_building_avoidance_areas.some(area => area.water_area_id === flowingCluster.water_area_id), "flowing water receives a separately reasoned preliminary avoidance area");

  const pointOnly = model.water_area_clusters.find(cluster => cluster.supporting_photo_ids.includes("small-single-no-dimensions"));
  assert.equal(pointOnly.estimated_outline, null, "one water photo without dimensions stays a point instead of becoming a broad area");
  assert.equal(pointOnly.outline_basis, "No outline was inferred because a single observation lacked dimensions.");
  assert(model.limitations.every(text => /not|does not|unknown/i.test(text)), "limitations prevent unsupported surveyed or year-round conclusions");

  const source = fs.readFileSync(path.join(root, "field/app.js"), "utf8");
  assert(source.includes("Why did you take this picture?"), "photo save immediately launches the voice-explanation workflow");
  assert(source.includes("openWaterClassification(metadata.photo_id)"), "water confirmation follows the saved photo explanation");
  assert(source.includes("attachExplanationToPhoto"), "voice notes are permanently linked back to photographs");
  const html = fs.readFileSync(path.join(root, "field/index.html"), "utf8");
  assert(html.includes("SMALL TRACT — OBSERVED WATER CONDITIONS"));
  assert(html.includes("I photographed every standing-water location I personally observed."));
  assert(html.includes('data-water-choice="creek_stream"'));
  assert(html.includes('data-water-layer="unknown"'));

  process.stdout.write("PASS: verified exact small-tract isolation, conservative water clustering, flowing-water separation, inspected-dry limitations, photo-linked voice workflow, and water-map controls.\n");
}

main();
