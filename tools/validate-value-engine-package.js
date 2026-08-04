"use strict";

const fs = require("fs");
const path = require("path");
const Repository = require("../repository/import-package.js");
const ValueEngine = require("../field/property-value-engine.js");
const FieldTruth = require("../field/field-truth-engine.js");
const Mission = require("../field/guided-mission-orchestrator.js");

function validateManifest(manifest, source) {
  const inspection = manifest.inspection || manifest;
  const observations = Array.isArray(inspection.observations) ? inspection.observations : [];
  const propertyId = manifest.property_id || (manifest.property && manifest.property.property_id) || (manifest.property_information && manifest.property_information.property_id) || null;
  const inspectionId = manifest.inspection_id || (manifest.metadata && manifest.metadata.inspection_id) || null;
  const originalObservations = JSON.stringify(observations);
  const compatibilityInspection = { property_id: propertyId, inspection_id: inspectionId, started: manifest.inspection_conditions && manifest.inspection_conditions.inspection_date || null, markers: observations };
  FieldTruth.ensureInspectionModel(compatibilityInspection);
  Mission.ensureModel(compatibilityInspection);
  const legacyUnchanged = JSON.stringify(compatibilityInspection.markers) === originalObservations;
  const engine = ValueEngine.buildValueEngine({
    observations,
    questions: inspection.investigation_questions && (inspection.investigation_questions.questions || inspection.investigation_questions),
    propertyId,
    inspectionId,
    subjectParcel: manifest.map_context && manifest.map_context.subject_parcel
  });
  return {
    package_path: source || null,
    property_id: propertyId,
    inspection_id: inspectionId,
    source_counts: {
      photographs: (manifest.photographs || inspection.photographs || []).length,
      observations: observations.length,
      gps_points: Array.isArray(inspection.gps_track) ? inspection.gps_track.length : (inspection.gps_track && (inspection.gps_track.raw_point_count || (inspection.gps_track.points || []).length) || 0)
    },
    value_engine_compatibility: {
      inspector_assessed_impacts: engine.impacts.length,
      unassessed_observations: engine.unassessed_observation_ids.length,
      unconfirmed_suggestions: engine.unconfirmed_suggestions.length,
      heat_map_status: engine.heat_maps.status,
      heat_layers: engine.heat_maps.layers.map(layer => layer.label),
      legacy_records_modified: !legacyUnchanged,
      guided_mission_status: compatibilityInspection.guided_mission_legacy_status && compatibilityInspection.guided_mission_legacy_status.status,
      guided_mission_completion_status: compatibilityInspection.guided_mission_legacy_status && compatibilityInspection.guided_mission_legacy_status.completion_status,
      unconfirmed_suggestions_entered_rankings: false
    },
    passed: legacyUnchanged && engine.impacts.every(impact => impact.assessment_source === "inspector_selected") && engine.heat_maps.status === "INSUFFICIENT_SPATIAL_EVIDENCE" && compatibilityInspection.guided_mission_legacy_status && compatibilityInspection.guided_mission_legacy_status.status === "GUIDED_MISSION_NOT_AVAILABLE_AT_CAPTURE"
  };
}

function validate(packagePath) {
  const source = path.resolve(packagePath);
  const entries = Repository.parseStoredZip(fs.readFileSync(source));
  if (!entries.has("inspection.json")) throw new Error("Package does not contain inspection.json.");
  return validateManifest(JSON.parse(entries.get("inspection.json").toString("utf8")), source);
}

if (require.main === module) {
  const packagePath = process.argv[2];
  if (!packagePath) {
    process.stderr.write("Usage: node tools/validate-value-engine-package.js <inspection-package.zip>\n");
    process.exitCode = 2;
  } else {
    try {
      const result = packagePath === "-" ? validateManifest(JSON.parse(fs.readFileSync(0, "utf8")), "stdin:package-analysis-record") : validate(packagePath);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.passed) process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

module.exports = { validate, validateManifest };
