(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PropertyFrontageWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const WORK_CLASSES = Object.freeze({
    NO_CULVERT_APPARENTLY_NEEDED: "NO CULVERT APPARENTLY NEEDED",
    CULVERT_APPARENTLY_NEEDED: "CULVERT APPARENTLY NEEDED",
    EXISTING_CROSSING: "EXISTING CROSSING",
    MAJOR_VISIBLE_WORK: "MAJOR VISIBLE WORK"
  });

  const IDENTIFIERS = Object.freeze({
    frontage_end: "FRONTAGE-END",
    vehicle_crossing: "VEHICLE-CROSSING",
    ditch_change: "DITCH-CHANGE",
    frontage_trees_brush: "FRONTAGE-TREES-BRUSH",
    frontage_wet_soft: "FRONTAGE-WET-SOFT",
    frontage_steep_slope: "FRONTAGE-STEEP-SLOPE",
    frontage_photo: "FRONTAGE-PHOTO",
    parking_staging: "PARKING-STAGING"
  });

  function ensureModel(inspection) {
    inspection.simple_counters = inspection.simple_counters && typeof inspection.simple_counters === "object" ? inspection.simple_counters : {};
    const existing = inspection.frontage_workflow && typeof inspection.frontage_workflow === "object" ? inspection.frontage_workflow : {};
    const defaults = {
      schema_name: "property-intelligence-frontage-crossing-workflow",
      schema_version: "1.0",
      status: inspection.started ? "IN_PROGRESS" : "NOT_STARTED",
      screen: inspection.started ? "STEP_1" : "NOT_STARTED",
      created_at: inspection.started || null,
      updated_at: inspection.started || null,
      records: [],
      frontage_end_ids: [],
      vehicle_crossing_ids: [],
      ditch_change_ids: [],
      roadside_condition_ids: [],
      parking_staging_ids: [],
      frontage_walk: { active: false, started_at: null, ended_at: null, start_point_sequence: null, end_point_sequence: null, second_end_status: "UNKNOWN" },
      provisional_crossing_interpretation: null,
      parking_review_status: "NOT_STARTED"
    };
    Object.keys(defaults).forEach(key => { if (existing[key] === undefined || existing[key] === null) existing[key] = defaults[key]; });
    inspection.frontage_workflow = existing;
    const model = existing;
    model.records = Array.isArray(model.records) ? model.records : [];
    ["frontage_end_ids", "vehicle_crossing_ids", "ditch_change_ids", "roadside_condition_ids", "parking_staging_ids"].forEach(key => { model[key] = Array.isArray(model[key]) ? model[key] : []; });
    model.frontage_walk = Object.assign({ active: false, started_at: null, ended_at: null, start_point_sequence: null, end_point_sequence: null, second_end_status: "UNKNOWN" }, model.frontage_walk || {});
    return model;
  }

  function nextIdentifier(inspection, recordType) {
    const prefix = IDENTIFIERS[recordType];
    if (!prefix) throw new Error(`Unknown frontage record type: ${recordType}`);
    const next = Number(inspection.simple_counters[prefix] || 0) + 1;
    inspection.simple_counters[prefix] = next;
    return `${prefix}-${String(next).padStart(3, "0")}`;
  }

  function orientationSnapshot(orientation) {
    if (!orientation) return null;
    return {
      alpha_deg: orientation.alpha_deg == null ? null : orientation.alpha_deg,
      beta_deg: orientation.beta_deg == null ? null : orientation.beta_deg,
      gamma_deg: orientation.gamma_deg == null ? null : orientation.gamma_deg,
      absolute: Boolean(orientation.absolute)
    };
  }

  function createRecord(inspection, recordType, position, orientation, attributes, now) {
    if (!position || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lon))) throw new Error("A current GPS position is required.");
    const model = ensureModel(inspection);
    const recordId = nextIdentifier(inspection, recordType);
    const recordedAt = now || new Date().toISOString();
    const record = {
      record_id: recordId,
      record_type: recordType,
      recorded_at: recordedAt,
      latitude: Number(position.lat),
      longitude: Number(position.lon),
      gps_accuracy_m: position.accuracy_m == null ? null : Number(position.accuracy_m),
      gps_position_at: position.time || null,
      compass_heading_deg: orientation && orientation.compass_heading_deg != null ? orientation.compass_heading_deg : (position.heading_deg == null ? null : position.heading_deg),
      device_orientation: orientationSnapshot(orientation),
      information_class: "inspector_observation",
      completion_status: "BASIC_RECORD_SAVED",
      attributes: Object.assign({}, attributes || {})
    };
    model.records.push(record);
    if (recordType === "frontage_end") model.frontage_end_ids.push(recordId);
    else if (recordType === "vehicle_crossing") model.vehicle_crossing_ids.push(recordId);
    else if (recordType === "ditch_change") model.ditch_change_ids.push(recordId);
    else if (recordType === "parking_staging") model.parking_staging_ids.push(recordId);
    else model.roadside_condition_ids.push(recordId);
    model.updated_at = recordedAt;
    return record;
  }

  function beginFrontageWalk(inspection, pointSequence, now) {
    const model = ensureModel(inspection);
    model.frontage_walk = Object.assign({}, model.frontage_walk, {
      active: true,
      started_at: now || new Date().toISOString(),
      ended_at: null,
      start_point_sequence: pointSequence == null ? null : pointSequence,
      end_point_sequence: null,
      second_end_status: "UNKNOWN"
    });
    model.status = "FRONTAGE_WALK_ACTIVE";
    model.screen = "FRONTAGE_WALK";
    model.updated_at = model.frontage_walk.started_at;
    return model.frontage_walk;
  }

  function endFrontageWalk(inspection, pointSequence, secondEndStatus, now) {
    const model = ensureModel(inspection);
    model.frontage_walk.active = false;
    model.frontage_walk.ended_at = now || new Date().toISOString();
    model.frontage_walk.end_point_sequence = pointSequence == null ? null : pointSequence;
    model.frontage_walk.second_end_status = secondEndStatus || model.frontage_walk.second_end_status || "UNKNOWN";
    model.status = "FRONTAGE_REVIEW";
    model.screen = "FRONTAGE_REVIEW";
    model.updated_at = model.frontage_walk.ended_at;
    return model.frontage_walk;
  }

  function compareCrossings(inspection) {
    const model = ensureModel(inspection);
    const ranks = { NO_CULVERT_APPARENTLY_NEEDED: 1, EXISTING_CROSSING: 2, CULVERT_APPARENTLY_NEEDED: 3, MAJOR_VISIBLE_WORK: 4 };
    const crossings = model.records.filter(record => record.record_type === "vehicle_crossing").map(record => {
      const workClass = record.attributes.crossing_work_class || null;
      return Object.assign({}, record, {
        crossing_work_class: workClass,
        comparison_label: WORK_CLASSES[workClass] || "INSUFFICIENT EVIDENCE",
        visible_work_rank: ranks[workClass] || 99,
        limitations: workClass === "CULVERT_APPARENTLY_NEEDED"
          ? "Inspector's preliminary field observation: a culvert appears necessary for a vehicle crossing at this location. Culvert size, design, permitting, fill, elevation, drainage capacity, and approval remain unestablished."
          : "This field record does not establish permission, engineering feasibility, legal approval, structural condition, load capacity, or construction readiness."
      });
    });
    const bestRank = crossings.length ? Math.min(...crossings.map(item => item.visible_work_rank)) : 99;
    return crossings.map(item => Object.assign({}, item, {
      lowest_visible_work: item.visible_work_rank === bestRank && bestRank < 99,
      comparison_basis: "Recorded visible field evidence only; no permission, design, legal approval, or construction readiness is inferred."
    }));
  }

  function selectProvisionalCrossing(inspection, selectionType, crossingId, now) {
    const model = ensureModel(inspection);
    const validCrossing = crossingId && model.vehicle_crossing_ids.includes(crossingId) ? crossingId : null;
    model.provisional_crossing_interpretation = {
      information_class: "inspector_interpretation",
      interpretation_type: "PROVISIONAL VEHICLE-CROSSING INTERPRETATION",
      selection_type: selectionType,
      selected_crossing_id: validCrossing,
      recorded_at: now || new Date().toISOString(),
      does_not_overwrite_observations: true
    };
    model.status = "PARKING_REVIEW";
    model.screen = "PARKING_REVIEW";
    model.parking_review_status = "IN_PROGRESS";
    model.updated_at = model.provisional_crossing_interpretation.recorded_at;
    return model.provisional_crossing_interpretation;
  }

  function analysisModel(inspection) {
    const model = ensureModel(inspection);
    const start = model.frontage_walk.start_point_sequence;
    const end = model.frontage_walk.end_point_sequence;
    const rawRoute = (inspection.points || []).filter(point => {
      const sequence = Number(point.sequence);
      if (!Number.isFinite(sequence)) return false;
      return (start == null || sequence >= start) && (end == null || sequence <= end);
    });
    return {
      schema_name: model.schema_name,
      schema_version: model.schema_version,
      status: model.status,
      frontage_ends: model.records.filter(record => record.record_type === "frontage_end"),
      raw_frontage_walk_route: rawRoute,
      raw_route_limitation: "The walked GPS route is approximate and does not establish a surveyed frontage or boundary.",
      unwalked_frontage: model.frontage_walk.second_end_status === "MARKED" ? "No unwalked frontage section was identified by the workflow; completeness still depends on GPS and inspector coverage." : "UNKNOWN",
      vehicle_crossing_options: compareCrossings(inspection),
      ditch_changes: model.records.filter(record => record.record_type === "ditch_change"),
      roadside_conditions: model.records.filter(record => ["frontage_trees_brush", "frontage_wet_soft", "frontage_steep_slope", "frontage_photo"].includes(record.record_type)),
      provisional_crossing_interpretation: model.provisional_crossing_interpretation,
      parking_and_staging: model.records.filter(record => record.record_type === "parking_staging"),
      limitations: [
        "Vehicle-crossing records describe visible work apparently required; they do not establish permission, engineering, legal approval, or construction readiness.",
        "Existing crossings are not assigned structural condition or load capacity without direct professional evidence.",
        "Parking and staging records apply only to the ground actually inspected and recorded."
      ]
    };
  }

  return { WORK_CLASSES, IDENTIFIERS, ensureModel, nextIdentifier, createRecord, beginFrontageWalk, endFrontageWalk, compareCrossings, selectProvisionalCrossing, analysisModel };
});
