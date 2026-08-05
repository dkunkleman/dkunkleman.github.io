"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const filename = path.resolve(__dirname, "inspection-package.test.js");
let source = fs.readFileSync(filename, "utf8");

source = source
  .replace('require("../field/inspection-package.js")', 'require("../field-simple-test/inspection-package.js")')
  .replace('require("../field/timber-reconnaissance.js")', 'require("../field-simple-test/timber-reconnaissance.js")')
  .replace('require("../field/authoritative-weather.js")', 'require("../field-simple-test/authoritative-weather.js")')
  .replace('/^Pearson_Road_Inspection_FULL_ARCHIVE_', '/^HOME_TEST_3_13_Pearson_Road_Inspection_FULL_ARCHIVE_')
  .replace('/^Pearson_Road_Inspection_AI_ANALYSIS_REPORT_PACKAGE_/', '/^HOME_TEST_3_13_Pearson_Road_Inspection_AI_ANALYSIS_REPORT_PACKAGE_/')
  .replace('/^Pearson_Road_Inspection_FULL_ARCHIVE_Backup_/', '/^HOME_TEST_3_13_Pearson_Road_Inspection_FULL_ARCHIVE_Backup_/')
  .replaceAll('"AI_ANALYSIS_REPORT_PACKAGE_export_report_test.zip"', '"HOME_TEST_3_13_AI_ANALYSIS_REPORT_PACKAGE_export_report_test.zip"')
  .replace(
    'mapContext: baseMapContext,\n    packageMode: "report"',
    'mapContext: baseMapContext,\n    august4Context: { schema_name: "property-intelligence-august-4-reference-route", source_json_sha256: "route-hash", raw_gps_points: [{ latitude: 30.49, longitude: -87.09 }] },\n    packageMode: "report"'
  )
  .replace(
    'assert(reportFiles.has("SMALL_TRACT_WATER_MAP.json")',
    'assert(reportFiles.has("subject-parcel.geojson") && reportFiles.has("photo-points.geojson") && reportFiles.has("feature-points.geojson") && reportFiles.has("property-field-map.html") && reportFiles.has("printable-property-field-map.html"), "package contains standalone parcel, photo, feature, and print-ready map files");\n  assert(reportFiles.has("AUTOMATIC_CONTEXT.json") && reportFiles.has("FACTS_BY_CLASS.json") && reportFiles.has("SITE_SOUND_EXPERIENCE.json"), "package contains automatic context, exact fact classes, and site-sound evidence");\n  assert(reportFiles.has("MAPPED_SECTIONS.json") && reportFiles.has("mapped-sections.geojson"), "package contains section evidence and geometry");\n  assert(reportFiles.has("WET_EDGE_MAPPING.json") && reportFiles.has("PROPERTY_PREVISIT_REVIEW.json") && reportFiles.has("AUGUST_4_REFERENCE_ROUTE.json"), "package contains corrected wet-route findings, aerial calibration, and August 4 route");\n  const isolatedWetReview = JSON.parse(reportFiles.get("WET_EDGE_MAPPING.json").toString("utf8"));\n  assert(isolatedWetReview.report_language.includes("Most standing water observed along the route was approximately 2–4 inches"));\n  assert(isolatedWetReview.same_day_instruction.includes("do not repeat"));\n  const isolatedPrevisitReview = JSON.parse(reportFiles.get("PROPERTY_PREVISIT_REVIEW.json").toString("utf8"));\n  assert.equal(isolatedPrevisitReview.aerial_calibrations[0].status, "FIELD_CALIBRATED_PATTERN_NOT_UNIVERSALLY_CONFIRMED");\n  assert(isolatedPrevisitReview.aerial_interpretations[0].warning.includes("not open ground"));\n  assert(isolatedPrevisitReview.aerial_pattern_classes.LIKELY_LARGER_TREES.travel_rule.includes("Do not infer travel difficulty"));\n  assert(isolatedPrevisitReview.controlling_inspector_observations.some(item => item.includes("would not resolve standing-water")));\n  const isolatedMappedSections = JSON.parse(reportFiles.get("MAPPED_SECTIONS.json").toString("utf8"));\n  assert(isolatedMappedSections.independent_condition_groups.large_trees.includes("MANY LARGE TREES"));\n  assert(isolatedMappedSections.interpretation_rules.includes("Selective brush cutting may improve visibility and foot access but does not resolve wetness."));\n  assert(reportFiles.has("SMALL_TRACT_WATER_MAP.json")'
  );

const isolatedTest = new Module(filename, module);
isolatedTest.filename = filename;
isolatedTest.paths = Module._nodeModulePaths(path.dirname(filename));
isolatedTest._compile(source, filename);
