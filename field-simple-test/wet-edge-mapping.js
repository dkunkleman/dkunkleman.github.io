(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WetEdgeMapping = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const OBSERVATION_CHOICES = Object.freeze({
    STANDING_WATER_CONTINUES: "STANDING WATER CONTINUES",
    SOFT_NO_STANDING_WATER: "SOFT WITH NO STANDING WATER",
    FIRM_GROUND_BEGINS: "FIRM GROUND BEGINS",
    DEPTH_2_IN: "2 INCHES",
    DEPTH_4_IN: "4 INCHES",
    DEPTH_6_IN: "6 INCHES",
    DEPTH_8_PLUS_IN: "8 INCHES OR MORE",
    BOTTOM_NOT_REACHED: "BOTTOM NOT REACHED",
    TOO_DEEP_UNSAFE: "TOO DEEP / UNSAFE"
  });

  const QUICK_DEPTHS = Object.freeze({
    DEPTH_2_IN: { label: "2 IN", minimum_in: 2, maximum_in: 2 },
    DEPTH_4_IN: { label: "4 IN", minimum_in: 4, maximum_in: 4 },
    DEPTH_6_IN: { label: "6 IN", minimum_in: 6, maximum_in: 6 },
    DEPTH_8_PLUS_IN: { label: "MORE THAN 8 IN", minimum_in: 8, maximum_in: null },
    UNKNOWN: { label: "UNKNOWN", minimum_in: null, maximum_in: null }
  });

  const INSPECTOR_CONFIRMATIONS = Object.freeze([
    { confirmation_id: "AUG4-LARGE-SOFT-ROUTE", subject: "large_tract", statement: "All ground reached during the August 4 inspection was soft." },
    { confirmation_id: "AUG4-LARGE-WATER-MOSTLY-2-4", subject: "large_tract", statement: "Most observed standing water was approximately 2–4 inches deep." },
    { confirmation_id: "AUG4-LARGE-WATER-LOCAL-8", subject: "large_tract", statement: "Some localized places were approximately 8 inches deep." },
    { confirmation_id: "AUG4-LARGE-DRY-SEARCH-ATTEMPTED", subject: "large_tract", statement: "The inspector attempted to find drier ground." },
    { confirmation_id: "AUG4-LARGE-NO-DRY-OPEN", subject: "large_tract", statement: "No dry or firm ground was found along the inspected route." },
    { confirmation_id: "AUG4-LARGE-WET-BEYOND-STOP", subject: "large_tract", statement: "Wet conditions continued beyond the point where the inspector stopped." },
    { confirmation_id: "AUG4-LARGE-SAMPLED-ONLY", subject: "large_tract", statement: "The inspection did not cover the entire large tract." },
    { confirmation_id: "AUG4-LARGE-EAST-UNVISITED", subject: "large_tract", statement: "Unvisited acreage remains unknown and must not be labeled dry." },
    { confirmation_id: "AUG4-SMALL-MOSTLY-DRY", subject: "small_tract", statement: "Most of the inspected small tract was dry." },
    { confirmation_id: "AUG4-VEGETATION-UP-TO-3-IN", subject: "inspected_areas", statement: "No brush larger than approximately 3 inches in diameter was observed in the areas inspected so far.", limitation: "Do not extrapolate this statement to unvisited acreage." }
  ]);

  function nowIso(value) { return value || new Date().toISOString(); }

  function pointFrom(position, recordedAt) {
    if (!position || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lon))) return null;
    return {
      information_class: "CAPTURED_BY_DEVICE",
      latitude: Number(position.lat), longitude: Number(position.lon),
      gps_accuracy_m: position.accuracy_m == null ? null : Number(position.accuracy_m),
      gps_position_at: position.time || recordedAt || new Date().toISOString(),
      recorded_at: nowIso(recordedAt),
      heading_deg: position.heading_deg == null ? null : Number(position.heading_deg),
      source_gps_sequence: position.sequence == null ? null : Number(position.sequence)
    };
  }

  function ensureModel(inspection) {
    inspection.wet_edge_mapping = inspection.wet_edge_mapping && typeof inspection.wet_edge_mapping === "object" ? inspection.wet_edge_mapping : {};
    const model = inspection.wet_edge_mapping;
    model.schema_name = "property-intelligence-wet-edge-mapping";
    model.schema_version = "1.0";
    model.wet_areas = Array.isArray(model.wet_areas) ? model.wet_areas : [];
    model.next_wet_area_number = Math.max(Number(model.next_wet_area_number) || 1, model.wet_areas.length + 1);
    model.active_wet_area_id = model.active_wet_area_id || null;
    model.inspector_confirmations = Array.isArray(model.inspector_confirmations) ? model.inspector_confirmations : [];
    const existing = new Set(model.inspector_confirmations.map(item => item.confirmation_id));
    INSPECTOR_CONFIRMATIONS.forEach(source => {
      if (!existing.has(source.confirmation_id)) model.inspector_confirmations.push(Object.assign({
        information_class: "INSPECTOR_CONFIRMED_OBSERVATION",
        observation_date: "2026-08-04",
        recorded_in_app_at: new Date().toISOString(),
        append_only: true
      }, source));
    });
    model.reference_route = model.reference_route || {
      source_date: "2026-08-04",
      source_asset: "assets/august-4-route-context.json",
      information_class: "CAPTURED_BY_DEVICE",
      status: "REFERENCE_ROUTE_NOT_A_CURRENT_INSPECTION",
      limitation: "The route shows sampled locations only. Unvisited acreage remains unknown."
    };
    model.report_language = "Within the portion of the large tract physically inspected on August 4, 2026, all reached ground was soft. Most standing water observed along the route was approximately 2–4 inches deep, with localized depths of approximately 8 inches. The inspector attempted to locate drier ground but did not reach dry or firm ground before ending the inspection. Conditions beyond the inspected route remain unknown.";
    model.decision_language = "Large tract: high wetness and access risk. The only physically tested interior route remained soft and under standing water, primarily 2–4 inches deep with localized depths near 8 inches. No dry or firm ground was reached. Visible creek or drainage features appear to cross other parts of the tract. The extent of dry, usable acreage remains unestablished.";
    model.same_day_instruction = "AUGUST 4 WET-WEATHER WALK COMPLETE — do not repeat the failed dry-ground search during the same wet-weather inspection.";
    return model;
  }

  function wetAreaById(inspection, wetAreaId) {
    return ensureModel(inspection).wet_areas.find(item => String(item.wet_area_id) === String(wetAreaId)) || null;
  }

  function activeWetArea(inspection) {
    const model = ensureModel(inspection);
    return model.active_wet_area_id ? wetAreaById(inspection, model.active_wet_area_id) : null;
  }

  function startWetArea(inspection, options) {
    const model = ensureModel(inspection);
    if (activeWetArea(inspection)) throw new Error("Finish or save the active wet-area edge first.");
    const settings = options || {};
    const number = Number(model.next_wet_area_number) || 1;
    model.next_wet_area_number = number + 1;
    const recordedAt = nowIso(settings.recorded_at);
    const start = pointFrom(settings.position, recordedAt);
    if (!start) throw new Error("WAIT HERE — GPS is not ready. Nothing was recorded yet.");
    const wetArea = {
      wet_area_id: `WET-AREA-${String(number).padStart(3, "0")}`,
      information_class: "OBSERVED_ON_SITE",
      source_reference_route_date: "2026-08-04",
      started_at: recordedAt, finished_at: null,
      completion_status: "ACTIVE", conclusion: null,
      start, endpoint: null,
      raw_walked_edge_points: [start],
      observations: [], measurements: [], events: [],
      photo_ids: [], voice_note_ids: [],
      open_boundary: true, inferred_edge: null,
      unvisited_extent_classification: "UNKNOWN"
    };
    wetArea.events.push({ event_type: "WET_AREA_STARTED", recorded_at: recordedAt, point: start });
    model.wet_areas.push(wetArea);
    model.active_wet_area_id = wetArea.wet_area_id;
    return wetArea;
  }

  function appendWalkPoint(inspection, position, recordedAt) {
    const wetArea = activeWetArea(inspection);
    if (!wetArea || wetArea.completion_status !== "ACTIVE") return wetArea;
    const point = pointFrom(position, recordedAt);
    if (!point) return wetArea;
    const prior = wetArea.raw_walked_edge_points[wetArea.raw_walked_edge_points.length - 1];
    if (!prior || prior.latitude !== point.latitude || prior.longitude !== point.longitude) wetArea.raw_walked_edge_points.push(point);
    return wetArea;
  }

  function recordObservation(inspection, choice, position, recordedAt) {
    if (!Object.prototype.hasOwnProperty.call(OBSERVATION_CHOICES, choice)) throw new Error("Unknown wet-edge observation.");
    const wetArea = activeWetArea(inspection);
    if (!wetArea) throw new Error("Start Mapping the Wet Edge first.");
    const time = nowIso(recordedAt);
    const point = pointFrom(position, time);
    if (!point) throw new Error("WAIT HERE — GPS is not ready. Nothing was recorded yet.");
    const quickDepth = QUICK_DEPTHS[choice] || null;
    const observation = {
      wet_observation_id: `${wetArea.wet_area_id}-OBS-${String(wetArea.observations.length + 1).padStart(3, "0")}`,
      wet_area_id: wetArea.wet_area_id,
      information_class: "OBSERVED_ON_SITE",
      observation_code: choice,
      observation_label: OBSERVATION_CHOICES[choice],
      recorded_at: time,
      location: point,
      quick_depth: quickDepth ? Object.assign({ information_class: "INSPECTOR_QUICK_ESTIMATE" }, quickDepth) : null,
      exact_measurement_id: null
    };
    wetArea.observations.push(observation);
    wetArea.events.push({ event_type: "WET_OBSERVATION_SAVED", recorded_at: time, wet_observation_id: observation.wet_observation_id, observation_code: choice, location: point });
    wetArea.endpoint = point;
    return observation;
  }

  function addExactDepth(inspection, options) {
    const wetArea = activeWetArea(inspection);
    if (!wetArea) throw new Error("Start Mapping the Wet Edge first.");
    const settings = options || {};
    const value = Number(settings.value_in);
    if (!Number.isFinite(value) || value < 0) throw new Error("Enter the measured depth in inches.");
    const time = nowIso(settings.recorded_at);
    const point = pointFrom(settings.position, time);
    const measurement = {
      measurement_id: `${wetArea.wet_area_id}-DEPTH-${String(wetArea.measurements.length + 1).padStart(3, "0")}`,
      wet_area_id: wetArea.wet_area_id,
      information_class: "DIRECT_FIELD_MEASUREMENT",
      measurement_type: "Water depth",
      exact_value: value, unit: "in",
      measurement_tool: settings.measurement_tool || "Yardstick",
      bottom_reached: settings.bottom_reached || "Unknown",
      recorded_at: time, location: point,
      authority_rule: "This inspector-entered exact value is authoritative. A quick depth category does not replace it."
    };
    wetArea.measurements.push(measurement);
    wetArea.events.push({ event_type: "EXACT_DEPTH_SAVED", recorded_at: time, measurement_id: measurement.measurement_id, location: point });
    wetArea.endpoint = point || wetArea.endpoint;
    return measurement;
  }

  function stopWithoutDryEdge(inspection, options) {
    const model = ensureModel(inspection);
    const wetArea = activeWetArea(inspection);
    if (!wetArea) throw new Error("Start Mapping the Wet Edge first.");
    const settings = options || {};
    const time = nowIso(settings.recorded_at);
    wetArea.endpoint = pointFrom(settings.position, time) || wetArea.endpoint;
    wetArea.finished_at = time;
    wetArea.completion_status = "SAVED_OPEN_EDGE_DRY_EDGE_NOT_FOUND";
    wetArea.conclusion = "DRY EDGE NOT FOUND WITHIN INSPECTED AREA";
    wetArea.stop_reason = settings.reason || "Inspector ended the reachable or safe wet-edge walk before finding firm dry ground.";
    wetArea.endpoint_ground_condition = settings.ground_condition || "UNKNOWN";
    wetArea.endpoint_quick_depth = settings.quick_depth || null;
    wetArea.open_boundary = true;
    wetArea.inferred_edge = null;
    wetArea.unvisited_extent_classification = "UNKNOWN";
    wetArea.events.push({ event_type: "WET_AREA_CONTINUES_BEYOND_INSPECTED_EXTENT", recorded_at: time, endpoint: wetArea.endpoint, conclusion: wetArea.conclusion, reason: wetArea.stop_reason });
    model.active_wet_area_id = null;
    return wetArea;
  }

  function finishWetArea(inspection, options) {
    const model = ensureModel(inspection);
    const wetArea = activeWetArea(inspection);
    if (!wetArea) throw new Error("Start Mapping the Wet Edge first.");
    const settings = options || {};
    const time = nowIso(settings.recorded_at);
    wetArea.endpoint = pointFrom(settings.position, time) || wetArea.endpoint;
    wetArea.finished_at = time;
    wetArea.completion_status = "SAVED_OBSERVED_EDGE";
    wetArea.conclusion = settings.conclusion || "OBSERVED WET-AREA EDGE SAVED";
    wetArea.open_boundary = true;
    wetArea.inferred_edge = null;
    wetArea.events.push({ event_type: "WET_AREA_EDGE_FINISHED", recorded_at: time, endpoint: wetArea.endpoint, conclusion: wetArea.conclusion });
    model.active_wet_area_id = null;
    return wetArea;
  }

  function createAugust4ObservedSection(inspection, referenceContext, recordedAt) {
    const model = ensureModel(inspection);
    const existing = model.wet_areas.find(item => item.source_reference_route_date === "2026-08-04" && item.record_type === "OBSERVED_ROUTE_SECTION");
    if (existing) return existing;
    const number = Number(model.next_wet_area_number) || 1;
    model.next_wet_area_number = number + 1;
    const time = nowIso(recordedAt);
    const wetArea = {
      wet_area_id: `WET-AREA-${String(number).padStart(3, "0")}`,
      record_type: "OBSERVED_ROUTE_SECTION",
      information_class: "INSPECTOR_CONFIRMED_OBSERVATION",
      source_reference_route_date: "2026-08-04",
      source_reference_route_file: "AUGUST_4_REFERENCE_ROUTE.json",
      source_reference_route_sha256: referenceContext && referenceContext.source_json_sha256 || null,
      source_reference_gps_point_count: referenceContext && Array.isArray(referenceContext.raw_gps_points) ? referenceContext.raw_gps_points.length : null,
      descriptions: ["SOFT GROUND", "STANDING WATER MOSTLY 2–4 INCHES", "LOCAL WATER APPROXIMATELY 8 INCHES", "DRY EDGE NOT FOUND", "AREA CONTINUES BEYOND INSPECTION", "EXTENT UNKNOWN"],
      started_at: "2026-08-04",
      finished_at: time,
      completion_status: "SAVED_OPEN_OBSERVED_ROUTE_SECTION",
      conclusion: "DRY EDGE NOT FOUND WITHIN INSPECTED AREA",
      geometry_basis: "AUGUST_4_PHYSICALLY_WALKED_ROUTE_AND_DIRECT_OBSERVATIONS",
      observed_geometry: { type: "REFERENCE_LINE", reference: "AUGUST_4_REFERENCE_ROUTE.json > raw_gps_points" },
      inferred_edge: null,
      open_boundary: true,
      unvisited_extent_classification: "UNKNOWN",
      append_only: true,
      events: [{ event_type: "AUGUST_4_OBSERVED_WET_SECTION_CONFIRMED", recorded_at: time }],
      photo_ids: [], voice_note_ids: [], observations: [], measurements: []
    };
    model.wet_areas.push(wetArea);
    return wetArea;
  }

  function analysisModel(inspection) {
    const model = ensureModel(inspection);
    return {
      schema_name: model.schema_name, schema_version: model.schema_version,
      report_language: model.report_language,
      decision_language: model.decision_language,
      same_day_instruction: model.same_day_instruction,
      inspector_confirmations: model.inspector_confirmations,
      reference_route: model.reference_route,
      wet_areas: model.wet_areas,
      interpretation_rules: [
        "Observed wetness applies only to the sampled route and exact confirmed locations.",
        "Unvisited acreage remains unknown.",
        "An open wet-area edge must not be rendered as a closed wet polygon.",
        "Phone GPS and county parcel geometry are approximate and are not a survey.",
        "Storm-related causation, persistent wetness, wetlands status, soil suitability, drainage rights, and access costs remain separate questions."
      ]
    };
  }

  return { OBSERVATION_CHOICES, QUICK_DEPTHS, INSPECTOR_CONFIRMATIONS, ensureModel, wetAreaById, activeWetArea, startWetArea, appendWalkPoint, recordObservation, addExactDepth, stopWithoutDryEdge, finishWetArea, createAugust4ObservedSection, analysisModel };
});
