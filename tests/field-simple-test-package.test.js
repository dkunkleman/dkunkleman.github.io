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
  .replace('"AI_ANALYSIS_REPORT_PACKAGE_export_report_test.zip"', '"HOME_TEST_3_13_AI_ANALYSIS_REPORT_PACKAGE_export_report_test.zip"')
  .replace(
    'assert(reportFiles.has("SMALL_TRACT_WATER_MAP.json")',
    'assert(reportFiles.has("subject-parcel.geojson") && reportFiles.has("photo-points.geojson") && reportFiles.has("feature-points.geojson") && reportFiles.has("property-field-map.html") && reportFiles.has("printable-property-field-map.html"), "package contains standalone parcel, photo, feature, and print-ready map files");\n  assert(reportFiles.has("AUTOMATIC_CONTEXT.json") && reportFiles.has("FACTS_BY_CLASS.json") && reportFiles.has("SITE_SOUND_EXPERIENCE.json"), "package contains automatic context, exact fact classes, and site-sound evidence");\n  assert(reportFiles.has("MAPPED_SECTIONS.json") && reportFiles.has("mapped-sections.geojson"), "package contains section evidence and geometry");\n  assert(reportFiles.has("SMALL_TRACT_WATER_MAP.json")'
  );

const isolatedTest = new Module(filename, module);
isolatedTest.filename = filename;
isolatedTest.paths = Module._nodeModulePaths(path.dirname(filename));
isolatedTest._compile(source, filename);
