"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Synthesis = require("../field/reviewed-property-synthesis.js");

function point(time, lat, lon, extra) { return Object.assign({ time, lat, lon, accuracy_m: 4, area_id: "area-a" }, extra || {}); }

const routeInspection = {
  lifecycle_events: [
    { type: "inspection_paused", time: "2026-08-03T14:01:00.000Z" },
    { type: "relocation_hidden", time: "2026-08-03T14:03:50.000Z" },
    { type: "new_inspection_phase", time: "2026-08-03T14:06:00.000Z", label: "Drove to small tract" }
  ],
  photos: [
    { id: "photo-a", photo_number: "P1", recorded_at: "2026-08-03T14:00:05.000Z", lat: 30.49, lon: -87.095 },
    { id: "photo-b", photo_number: "P2", recorded_at: "2026-08-03T14:08:00.000Z", lat: 30.494, lon: -87.087 }
  ]
};
const routePoints = [
  point("2026-08-03T14:00:00.000Z", 30.49, -87.095),
  point("2026-08-03T14:00:20.000Z", 30.4901, -87.0949),
  point("2026-08-03T14:00:40.000Z", 30.4902, -87.0948, { accuracy_m: 90 }),
  point("2026-08-03T14:01:20.000Z", 30.4903, -87.0947),
  point("2026-08-03T14:04:00.000Z", 30.4904, -87.0946),
  point("2026-08-03T14:04:05.000Z", 30.494, -87.087),
  point("2026-08-03T14:06:20.000Z", 30.4941, -87.0869, { area_id: "area-b" }),
  point("2026-08-03T14:06:40.000Z", 30.4942, -87.0868, { area_id: "area-b" })
];

const route = Synthesis.segmentRoute(routePoints, routeInspection);
assert.equal(route.exact_source_point_count, 8, "every raw GPS point remains present");
assert.equal(route.all_points.length, 8);
assert.equal(route.rejected_points.length, 1, "poor-accuracy point is retained but rejected from walked geometry");
assert(route.segments.length >= 4, "pause, time gap, speed, area and phase changes split the route");
assert(route.relocations.some(item => item.reasons.includes("time_gap_greater_than_120_seconds")));
assert(route.relocations.some(item => item.reasons.includes("implied_speed_greater_than_5_mps")));
assert(route.relocations.every(item => item.walked_route_claim === false));
assert(route.relocations.some(item => item.display === "no_connector"), "an intentionally hidden relocation has no map connector");
assert.match(route.warning, /No straight jump/);
const sourceFiltered = Synthesis.segmentRoute([
  point("2026-08-03T15:00:00.000Z", 30.49, -87.09),
  point("2026-08-03T15:00:10.000Z", 30.49001, -87.09001, { use_for_distance: false, quality_flag: "gap_or_implausible_segment" }),
  point("2026-08-03T15:00:20.000Z", 30.49002, -87.09002)
], {});
assert.equal(sourceFiltered.rejected_points.length, 1, "a source quality-filter rejection breaks the walked route even when its raw accuracy value looks acceptable");

const photos = Array.from({ length: 196 }, (_, index) => ({
  id: `photo-${index + 1}`,
  photo_id: `photo-${index + 1}`,
  photo_number: `P${index + 1}`,
  recorded_at: new Date(Date.parse("2026-08-03T13:00:00.000Z") + index * 10000).toISOString(),
  lat: 30.49 + index * 0.000005,
  lon: -87.092 + index * 0.000004,
  location: { latitude: 30.49 + index * 0.000005, longitude: -87.092 + index * 0.000004 },
  analysis: { path: `photos/${String(index + 1).padStart(3, "0")}_analysis.jpg` },
  explanation_voice_note_ids: index === 106 ? ["voice-creek"] : []
}));
const inspection = {
  property_id: Synthesis.PROPERTY_ID,
  inspection_id: "inspection-pearson-real",
  inspector_identity: "Test Inspector",
  photos,
  voice_notes: [{ id: "voice-creek", voice_note_id: "voice-creek", audio: { path: "voice-notes/voice-creek.m4a" } }],
  markers: [{ id: "obs-p44", photo_id: "photo-44" }],
  points: routePoints,
  lifecycle_events: routeInspection.lifecycle_events,
  evidence_set_suggestions: [{ suggestion_id: "pearson-northwest-creek-corridor", suggested_label: "Northwest Creek / Flowing-Water Corridor", status: "pending_inspector_confirmation", photo_ids: ["photo-107", "photo-108"] }]
};
Synthesis.ensureModel(inspection);
assert.equal(inspection.review_phase_suggestions.length, 12, "all reviewed P3-P196 phases are present");
assert(inspection.review_phase_suggestions.every(item => item.status === "pending_inspector_confirmation"), "review phases never activate silently");
assert.equal(inspection.land_use_concepts.length, 5);
assert(inspection.land_use_concepts.every(item => item.status === "pending_inspector_confirmation"));
const laterInspection = { property_id: Synthesis.PROPERTY_ID, started: "2026-09-01T12:00:00.000Z", photos: [{ photo_number: "P3" }, { photo_number: "P196" }] };
Synthesis.ensureModel(laterInspection);
assert.equal(laterInspection.review_phase_suggestions.length, 0, "Pearson August 3 review assumptions never leak into a later inspection");

Synthesis.reviewItem(inspection, "pearson-phase-p3-p11", "approved", "Test Inspector");
Synthesis.reviewItem(inspection, "premium-western-homestead", "approved", "Test Inspector");
Synthesis.setMapReview(inspection, "homesite", "approved", "Test Inspector");
assert.equal(inspection.review_synthesis_events.length, 3, "approval decisions append immutable review events");

const imported = Synthesis.importChatReview(inspection, { proposed_annotations: [{ annotation_id: "chat-one", concise_approved_finding: "Draft assistant proposal" }] });
assert.equal(imported, 1);
assert.equal(inspection.imported_chat_review_annotations[0].status, "pending_inspector_confirmation");
assert.equal(inspection.imported_chat_review_annotations[0].approved_by_inspector, false);

const smallWater = {
  status: "GENERATED",
  small_tract: { stated_acres: 5.48, boundary: [[-87.093, 30.489], [-87.086, 30.489], [-87.086, 30.496], [-87.093, 30.496], [-87.093, 30.489]] },
  water_photographs: [{ photo_id: "photo-44", photo_number: "P44", latitude: photos[43].lat, longitude: photos[43].lon }],
  preliminary_building_avoidance_areas: [],
  uninspected_unknown: { statement: "Unvisited ground remains unknown." }
};
const flowing = {
  corridors: [{ corridor_id: "creek-1", exact_photographed_points: [{ photo_id: "photo-107" }], conservative_centerline: { coordinates: [[-87.0916, 30.4905], [-87.0912, 30.491]] }, flow_direction_arrows: [{ from: [-87.0916, 30.4905], to: [-87.0912, 30.491], direction_reported: "north" }], measured_depth_points: [{ longitude: -87.0912, latitude: 30.491, depth_in: 4 }], measured_width_points: [], voice_note_ids: ["voice-creek"] }]
};
const bundle = Synthesis.buildSynthesis({ inspection, photos, voiceNotes: inspection.voice_notes, smallTractWaterMap: smallWater, flowingWaterModel: flowing, manifest: { photographs: photos, voice_notes: inspection.voice_notes } });
assert.equal(bundle.property_scope.large_tract_acres_approx, 81.20);
assert.equal(bundle.property_scope.small_tract_acres_approx, 5.48);
assert.equal(bundle.property_scope.combined_acres_approx, 86.68);
assert.equal(bundle.property_report.sections.length, 20);
bundle.property_report.sections.forEach(section => {
  for (const field of ["plain_english_meaning", "supporting_photo_numbers", "supporting_observation_ids", "evidence_classification", "confidence", "limitations"]) assert(Object.prototype.hasOwnProperty.call(section, field), `${section.title} includes ${field}`);
});
assert.equal(bundle.property_report.approval_summary.approved_phase_count, 1);
assert.equal(bundle.property_report.approval_summary.pending_phase_count, 11);
assert.match(bundle.property_report_markdown, /What was inspected/);
assert.match(bundle.property_report_html, /nontechnical|Property Intelligence Report/i);
assert.equal(bundle.audience_reports.reports.length, 6);
assert(bundle.audience_reports.reports.some(item => item.title === "Buyer Report"));
assert(bundle.audience_reports.reports.some(item => item.title === "Drainage Engineer Handoff"));
assert.match(bundle.map_html.creek, /photos\/107_analysis\.jpg/);
assert.match(bundle.map_html.creek, /voice-notes\/voice-creek\.m4a/);
assert.match(bundle.map_html.creek, /Conservative inferred creek centerline/);
assert.deepEqual(bundle.creek_corridor_map.photo_points.find(item => item.photo_number === "P145").map_roles, ["Measurement", "Flow Evidence"]);
assert.match(bundle.map_html.vegetation, /Western\/northern wooded area/);
assert.match(bundle.vegetation_clearing_map.zones.find(item => item.zone_id === "eastern-road-frontage").description, /Approximately five larger pines/);
assert.match(bundle.map_html.homesite, /Premium western homestead concept/);
assert.equal(bundle.homesite_opportunity_map.concepts.find(item => item.concept_id === "premium-western-homestead").layer_enabled, true);
assert(bundle.homesite_opportunity_map.concepts.filter(item => item.status !== "approved").every(item => !item.layer_enabled));
assert(bundle.homesite_opportunity_map.concepts.every(item => item.potential_building_pad_areas.length > 0), "each homesite or land-use concept shows its conceptual pad area");
assert(bundle.homesite_opportunity_map.concepts.every(item => item.possible_drive_access_directions.length > 0), "each concept shows a possible access direction");
assert.match(bundle.map_html.homesite, /Conceptual potential building-pad area/);
assert.match(bundle.map_html.homesite, /Possible drive\/access direction/);
assert(bundle.audience_reports.reports.every(item => item.markdown.includes("Every audience version uses the same immutable evidence")));
const unavailableHomesite = Synthesis.createHomesiteMap({ inspection, photos, smallTractWaterMap: { status: "NOT_AVAILABLE" } });
assert.doesNotThrow(() => Synthesis.mapHtml(unavailableHomesite, { photographs: photos, voice_notes: inspection.voice_notes }), "a missing parcel ring never prevents report packaging");

const root = path.resolve(__dirname, "..");
const indexSource = fs.readFileSync(path.join(root, "field/index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "field/app.js"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "field/sw.js"), "utf8");
for (const label of ["Review Corrections", "Approve Evidence Sets", "Review Water Map", "Review Creek Map", "Review Vegetation Map", "Review Homesite Concepts", "Import ChatGPT Review", "Generate Property Report"]) assert(indexSource.includes(label), `${label} is present`);
assert(indexSource.includes("NEW INSPECTION PHASE / RELOCATION"));
assert(appSource.includes('const APP_VERSION = "3.16.3"'));
assert(appSource.includes("pearsonAugust3ReviewCutoff") && appSource.includes('inspectionDate === "2026-08-03"') && appSource.includes("p3Time"), "display-only Pearson cleanup begins at the real P3 field sequence and cannot alter a later visit");
assert(workerSource.includes("property-inspector-field-2026-08-04-v25-simple-send"));
assert(workerSource.includes("reviewed-property-synthesis.js?v=3.16.3"));

process.stdout.write("PASS: segmented routes, confirmation-gated Pearson phases, reviewed maps, conceptual homesites, six audience views, and the 20-section understandable report are verified.\n");
