(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FieldTruthEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = "1.0";
  const INFORMATION_CLASSES = Object.freeze([
    "desktop_source_fact", "desktop_screening_hypothesis", "field_observation", "field_measurement",
    "inspector_interpretation", "ai_suggestion", "professional_determination", "remaining_unknown"
  ]);
  const GEOMETRY_BASES = Object.freeze(["at_feature", "phone_location_only", "measured_offset", "mapped_polygon", "walked_line"]);
  const UNKNOWN_VALUES = Object.freeze(["Unknown", "Not measured", "Not applicable", "Unsafe to measure"]);
  const PREFIELD_ADAPTERS = Object.freeze([
    ["parcel_identity", "Parcel identity and acreage"], ["parcel_map", "Parcel-map context"], ["recorded_documents", "Recorded document index"], ["road_frontage", "Public road frontage screening"],
    ["zoning_future_land_use", "Zoning and future land use"], ["fema_flood", "FEMA flood information"], ["nwi_wetlands", "National Wetlands Inventory"], ["nrcs_ssurgo", "NRCS SSURGO / Web Soil Survey"],
    ["usgs_3dep", "USGS 3DEP elevation, hillshade, contours and probable drainage"], ["hydrography", "Authoritative hydrography"], ["aerial_imagery", "Licensed current / historical aerial imagery"],
    ["permits_enforcement", "Public permits and code enforcement"], ["utility_infrastructure", "Public utility infrastructure / service areas"], ["wildfire_conservation_environment", "Authoritative wildfire, conservation and environmental layers"]
  ].map(([adapter_id, label]) => ({ adapter_id, label, contract: "Preserve source identity, retrieval time, exact URL, source date, geometry, raw record and limitations. Return unavailable rather than inventing data." })));
  const FIELD_TEMPLATES = Object.freeze({
    wet: {
      label: "Wet / Water", feature_type: "water", minimum: ["water_feature_type", "visible_water", "depth_status"],
      photo_roles: ["Overview", "Depth measurement with visible scale", "Upstream", "Downstream", "Connection or outlet", "High-water or erosion indicator"],
      fields: [
        ["water_feature_type", "Water feature type", "select", ["Puddle", "Ponded area", "Saturated soil", "Mud", "Seep", "Swale", "Roadside ditch", "Creek", "Pond", "Flood evidence", "Other", "Unknown"]],
        ["visible_water", "Visible water", "select", ["Yes", "No", "Uncertain"]],
        ["depth_status", "Depth status", "select", ["Measured", "Estimated", "Unknown", "Unsafe to measure"]],
        ["water_depth", "Water depth or range", "text"], ["water_depth_unit", "Depth unit", "select", ["in", "ft", "cm", "m", "Unknown"]],
        ["measurement_method", "Depth measurement method", "text"], ["measurement_basis", "Measurement basis", "select", ["Direct field measurement", "Field estimate", "Unknown"]],
        ["flow_status", "Visible flow", "select", ["None", "Slow", "Moderate", "Fast", "Unknown"]], ["flow_direction", "Flow direction", "text"],
        ["extent_status", "Extent status", "select", ["Point only", "Measured dimensions", "Walked perimeter", "Estimated", "Unknown"]],
        ["length", "Length", "number"], ["width", "Width", "number"], ["extent_unit", "Length / width unit", "select", ["ft", "yd", "m", "Unknown"]],
        ["surface_substrate", "Surface / substrate", "text"], ["nearby_ground_condition", "Nearby-ground condition", "text"],
        ["apparent_connection", "Apparent connection", "select", ["Isolated", "Ditch", "Creek", "Pond", "Off parcel", "Unknown"]],
        ["follow_water_mode", "Follow Water mode", "select", ["Off", "Walk upstream", "Walk downstream", "Walk perimeter"]],
        ["water_indicators", "Clarity, odor, sediment, erosion, marks, debris, algae, roots, staining or saturated-soil indicators", "textarea"],
        ["safety_limitation", "Safety limitation", "textarea"]
      ]
    },
    culvert: {
      label: "Culvert / Drainage Structure", feature_type: "drainage_structure", minimum: ["structure_type"], photo_roles: ["Inlet", "Outlet", "Side", "Roadway above"],
      fields: [["structure_type", "Structure type", "select", ["Culvert", "Pipe", "Box culvert", "Bridge", "Unknown"]], ["shape", "Shape", "text"], ["material", "Material", "text"],
        ["diameter_dimensions", "Diameter or dimensions", "text"], ["length", "Length", "text"], ["barrel_count", "Number of barrels", "number"],
        ["blockage_percent", "Approximate blockage (%)", "number"], ["sediment_depth", "Sediment depth", "text"], ["flow_present", "Flow present", "select", ["Yes", "No", "Unknown"]],
        ["erosion", "Erosion", "text"], ["road_condition_above", "Road / driveway condition above", "text"], ["headwall_end_treatment", "Headwall / end treatment", "text"], ["measurement_method", "Measurement method", "text"]]
    },
    tree: {
      label: "Tree", feature_type: "tree", minimum: ["tree_capture_type", "live_status", "species_status"], photo_roles: ["Whole tree", "Trunk / bark", "Crown", "Leaf / needle", "Fruit / cone"],
      fields: [["tree_capture_type", "Tree record type", "select", ["Individual tree", "Specimen tree", "Hazard observation", "Timber-sample tree", "Unknown tree"]],
        ["live_status", "Condition", "select", ["Live", "Dead", "Uncertain"]], ["species_status", "Species status", "select", ["Inspector confirmed", "Probable", "Possible", "Unknown", "Professional identification requested"]],
        ["inspector_species", "Inspector species identification", "text"], ["dbh", "DBH", "number"], ["dbh_unit", "DBH unit", "select", ["in", "cm", "Not measured"]],
        ["dbh_method", "DBH method", "select", ["Diameter tape", "Circumference conversion", "Caliper", "Photo scale", "Estimate", "Unknown", "Not measured"]],
        ["measurement_height", "Measurement height", "text"], ["measurement_height_exception", "Exception reason", "text"], ["total_height", "Total height and method", "text"],
        ["merchantable_height", "Merchantable height and method", "text"], ["crown_condition", "Crown condition", "text"], ["lean", "Lean direction / degrees", "text"],
        ["defects", "Forks, sweep, cavities, top, deadwood, fire, lightning, insect, disease, roots, defect / cull", "textarea"]]
    },
    soil_probe: {
      label: "Soil Probe", feature_type: "soil_profile", minimum: ["owner_authorized", "utility_safety_acknowledged", "purpose", "tool_used"], photo_roles: ["Profile beside scale", "Extracted material beside scale"],
      fields: [["owner_authorized", "Owner authorization", "select", ["Acknowledged", "Not authorized"]], ["utility_safety_acknowledged", "Underground-utility safety", "select", ["Acknowledged", "Not acknowledged"]],
        ["purpose", "Purpose", "text"], ["tool_used", "Tool used", "text"], ["probe_depth", "Probe / auger depth", "text"], ["refusal_depth_type", "Refusal depth and type", "text"],
        ["water_encountered", "Water encountered", "select", ["Yes", "No", "Unknown"]], ["depth_to_water", "Depth to water", "text"], ["time_to_water_entry", "Time to water entry", "text"],
        ["horizons", "Horizons: depths, color, texture, moisture, roots, fragments, organic material, mottling/redox, odor", "textarea"], ["sample_retained", "Sample retained / identifier", "text"]]
    },
    entrance: {
      label: "Entrance / Access", feature_type: "access", minimum: ["public_road_surface", "existing_entrance"], photo_roles: ["Approach", "Road-facing", "Interior-facing", "Obstacle"],
      fields: [["public_road_surface", "Public road surface", "select", ["Paved", "Gravel", "Dirt", "Unknown"]], ["existing_entrance", "Existing entrance", "select", ["Yes", "No", "Uncertain"]],
        ["shoulder_ditch", "Shoulder and roadside ditch", "textarea"], ["culvert_gate", "Culvert and gate width", "text"], ["surface_material", "Surface material", "text"],
        ["clear_width_height", "Current clear width / height", "text"], ["slope", "Slope", "text"], ["surface_problems", "Rutting, soft spots, washout or erosion", "textarea"],
        ["passability", "Observed current passability", "select", ["Person", "ATV", "Pickup", "Two-wheel-drive vehicle", "Trailer", "Heavy equipment", "Unknown"]],
        ["blockage", "Blockage type", "text"], ["work_distance", "Distance requiring clearing, widening, filling or surfacing", "text"], ["turning_unloading", "Turning and trailer unloading area", "textarea"]]
    },
    blocked: { label: "Route Obstacle / Clearing", feature_type: "route_obstacle", minimum: ["obstacle_type"], photo_roles: ["Approach", "Obstacle", "Opposite side", "Relationship"], fields: [["obstacle_type", "Obstacle type", "text"], ["geometry_kind", "Record geometry", "select", ["Point", "Line", "Polygon"]], ["segment_length", "Segment length", "text"], ["desired_current_width", "Desired and current width", "text"], ["vegetation_density", "Brush, vegetation, vine / briar severity", "textarea"], ["counts", "Saplings by class, larger trees, downed trees, stumps", "textarea"], ["surface_obstruction", "Debris, rock or buried obstruction", "textarea"], ["equipment_staging", "Equipment access and staging", "textarea"], ["probable_treatment", "Inspector-observed probable treatment", "select", ["Hand cut", "Brush cutter", "Mower", "Mulcher", "Chainsaw / tree removal", "Earthwork", "Unknown"]]] },
    route_condition: { label: "Route Condition Segment", feature_type: "route_segment", minimum: ["route_mode", "passability"], photo_roles: ["Direction of travel", "Surface", "Narrow point", "Low clearance", "Cross-slope"], fields: [["route_mode", "Route mode", "select", ["Walking", "2WD vehicle", "4WD vehicle", "ATV / UTV", "Equipment", "Emergency access", "Other", "Unknown"]], ["current_width", "Current usable width", "text"], ["vertical_clearance", "Vertical clearance", "text"], ["grade", "Approximate grade", "text"], ["surface", "Surface", "text"], ["wetness", "Wetness", "select", ["Dry", "Damp", "Soft", "Muddy", "Standing water", "Mixed", "Unknown"]], ["cross_slope", "Cross-slope", "text"], ["passability", "Passability", "select", ["Passable now", "Passable with caution", "Impassable", "Not tested", "Unknown"]], ["limitations", "Limitations or change point", "textarea"]] },
    high: { label: "Terrain / High Ground", feature_type: "terrain", minimum: ["terrain_type"], photo_roles: ["Context", "Direction of fall", "Cross-section"], fields: [["terrain_type", "Terrain feature", "select", ["High", "Low", "Ridge", "Depression", "Slope break", "Erosion", "Embankment", "Cut", "Fill", "Unknown"]], ["grade", "Grade percent or angle", "text"], ["measurement_method", "Measurement method / device", "text"], ["fall_direction", "Direction of fall", "text"], ["segment_length", "Segment length", "text"], ["surface_stability", "Surface stability", "text"], ["erosion_evidence", "Erosion evidence", "textarea"], ["cross_section", "Approximate cross-section", "text"]] },
    homesite: { label: "Candidate Use Area", feature_type: "homesite", minimum: ["candidate_use", "candidate_center", "inspector_explanation"], photo_roles: ["North", "East", "South", "West", "Access direction", "Ground", "Water relationship"], fields: [["candidate_use", "Candidate use", "select", ["Homesite", "Shop", "Barn", "Parking", "Equipment staging", "Timber landing", "Pond", "Trailhead", "Recreation", "Other"]], ["candidate_center", "Candidate-area center", "select", ["Current phone position", "Measured offset", "Mapped area"]], ["footprint_outline", "Estimated footprint or outline", "text"], ["slope", "Slope", "text"], ["route_distance", "Route distance", "text"], ["view_direction", "View direction", "text"], ["access_direction", "Access direction", "text"], ["ground_observations", "Ground observations", "textarea"], ["trees_preserve", "Mature trees to preserve", "textarea"], ["clearing", "Clearing burden", "textarea"], ["nearby_water", "Nearby water evidence", "textarea"], ["utilities", "Observed utilities", "textarea"], ["views_privacy_noise", "Views, privacy and noise", "textarea"], ["remaining_unknowns", "Remaining unknowns", "textarea"], ["inspector_explanation", "Why this location was selected", "textarea"]] },
    utility: { label: "Utility / Infrastructure", feature_type: "infrastructure", minimum: ["infrastructure_type"], photo_roles: ["Context", "Identifier / marking", "Relationship"], fields: [["infrastructure_type", "Observed infrastructure", "select", ["Pole", "Transformer", "Pedestal", "Meter", "Hydrant", "Valve", "Utility marker", "Well evidence", "Septic evidence", "Drainage structure", "Road structure", "Unknown infrastructure"]], ["identifiers_markings", "Visible identifiers / markings", "textarea"], ["observed_condition", "Observed condition", "textarea"]] },
    boundary: { label: "Boundary / Occupation Evidence", feature_type: "boundary_evidence", minimum: ["boundary_evidence_type"], photo_roles: ["Context", "Close-up marking", "Parcel-map relationship"], fields: [["boundary_evidence_type", "Observed evidence", "select", ["Rod", "Pipe", "Cap", "Monument", "Blaze", "Fence", "Sign", "Ditch", "Old road", "Occupation line", "Encroachment concern", "Unknown"]], ["appearance", "Exact observed appearance", "textarea"], ["markings", "Text or markings", "textarea"], ["parcel_map_relationship", "Relationship to approximate parcel-map line", "textarea"]] },
    sensory: { label: "Sensory / Marketability", feature_type: "sensory_marketability", minimum: ["sensory_type"], photo_roles: ["Context", "Source", "Relationship"], fields: [["sensory_type", "Condition", "select", ["Noise", "Odor", "Privacy", "View", "Cellular", "Litter / dumping", "Trespass", "Wildlife", "Insects", "Night light", "Other"]], ["source_duration", "Source and duration", "textarea"], ["device_reading", "Optional uncalibrated device reading", "text"], ["wind_direction", "Wind direction", "text"], ["view_privacy", "View / privacy relationship", "textarea"], ["cellular_test", "Call or data-test result", "textarea"]] },
    dry: { label: "Dry Ground", feature_type: "ground_condition", minimum: ["ground_condition"], photo_roles: ["Context", "Surface", "Relationship"], fields: [["ground_condition", "Observed ground condition", "select", ["Dry surface", "Firm", "Soft / spongy", "Pine-needle floor", "Unknown"]], ["extent", "Observed extent", "text"], ["limitations", "Visibility or coverage limitations", "textarea"]] },
    generic: { label: "Field Feature", feature_type: "other", minimum: ["observed_feature"], photo_roles: ["Context", "Close-up", "Relationship", "Measurement"], fields: [["observed_feature", "What did you observe?", "textarea"], ["measurement_status", "Measurement status", "select", ["Measured", "Estimated", "Not measured", "Not applicable", "Unsafe to measure", "Unknown"]], ["field_limitations", "Limitations", "textarea"]] }
  });

  const TEMPLATE_ALIASES = Object.freeze({ ditch: "wet", timber: "tree", wildlife: "sensory", hazard: "generic", thick: "blocked", open: "dry", route: "route_condition", routeCondition: "route_condition", soilProbe: "soil_probe", other: "generic" });
  const PROFESSIONAL_WARNINGS = Object.freeze({
    soil_profile: "Nonprofessional field reconnaissance. Not a septic site evaluation, percolation test, wetland delineation, geotechnical investigation, bearing-capacity determination or engineering conclusion.",
    boundary_evidence: "Unverified physical evidence. Not a property corner, boundary location or survey determination.",
    access: "Passability is an observed field condition, not a guarantee. This record does not establish legal access.",
    infrastructure: "Observed infrastructure does not establish service availability, ownership, capacity, permission to connect or cost.",
    terrain: "Phone-derived grade is device reconnaissance, not survey elevation.",
    water: "Observed water does not establish causation, permanence, wetlands status, drainage rights, ordinary high-water limits or building setbacks.",
    tree: "Tree and timber records are field reconnaissance, not certified identification, cruise, appraisal or purchase offer.",
    sensory_marketability: "Phone sound measurements are uncalibrated unless a separate calibration record is attached."
  });

  function id(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function now(value) { return value || new Date().toISOString(); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function list(value) { return Array.isArray(value) ? value : []; }
  function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
  function templateFor(type) { return FIELD_TEMPLATES[TEMPLATE_ALIASES[type] || type] || FIELD_TEMPLATES.generic; }
  function recordEvent(data, event) { data.feature_session_events.push(Object.assign({ event_id: id("feature-event"), recorded_at: now(), information_class: "field_observation" }, event)); }

  function ensureInspectionModel(inspection) {
    const data = inspection || {};
    data.field_truth_schema_version = data.field_truth_schema_version || SCHEMA_VERSION;
    data.intended_use_scenarios = list(data.intended_use_scenarios);
    data.active_intended_use_scenario_id = data.active_intended_use_scenario_id || null;
    data.field_missions = list(data.field_missions);
    data.feature_capture_sessions = list(data.feature_capture_sessions);
    data.feature_session_events = list(data.feature_session_events);
    data.active_feature_session_id = data.active_feature_session_id || null;
    data.derived_findings = list(data.derived_findings);
    data.derived_value_effects = list(data.derived_value_effects);
    data.professional_determinations = list(data.professional_determinations);
    data.remaining_unknowns = list(data.remaining_unknowns);
    data.next_investigations = list(data.next_investigations);
    data.repeat_stations = list(data.repeat_stations);
    data.prefield_dossiers = list(data.prefield_dossiers);
    data.public_data_records = list(data.public_data_records);
    data.coverage_classifications = list(data.coverage_classifications);
    data.field_truth_settings = Object.assign({ voice_prompts_enabled: false, numeric_voice_entry_enabled: false }, data.field_truth_settings || {});
    data.field_truth_migration = data.field_truth_migration || {
      strategy: "NON_DESTRUCTIVE_NO_INVENTION", migrated_at: now(),
      legacy_observation_count: list(data.markers).length,
      rule: "Legacy events remain byte-for-byte unchanged. Missing structured attributes are unknown and are not inferred or copied into Feature Capture Sessions."
    };
    return data;
  }

  function createScenario(inspection, input) {
    const data = ensureInspectionModel(inspection); const source = input || {};
    if (!String(source.name || "").trim()) throw new Error("Name the intended use before deriving value effects.");
    const scenario = { scenario_id: source.scenario_id || id("scenario"), name: String(source.name).trim(), customer_type: source.customer_type || "Owner", description: source.description || "", created_at: now(source.created_at), information_class: "inspector_interpretation", status: "active" };
    data.intended_use_scenarios.push(scenario); data.active_intended_use_scenario_id = scenario.scenario_id; return scenario;
  }

  function addPublicDataRecord(inspection, input) {
    const data = ensureInspectionModel(inspection); const source = input || {};
    if (!source.source_name || !source.retrieved_at || !source.exact_url) throw new Error("Public data requires source identity, retrieval time, and exact URL.");
    const record = Object.assign({ public_data_id: id("public"), information_class: "desktop_source_fact", source_date: null, geometry: null, raw_record: null, limitations: [], adapter_id: null }, copy(source));
    data.public_data_records.push(record); return record;
  }

  function createPrefieldDossier(inspection, input) {
    const data = ensureInspectionModel(inspection); const source = input || {};
    const dossier = { prefield_dossier_id: id("prefield"), property_id: data.property_id || null, inspection_id: data.inspection_id || null, created_at: now(), information_class: "desktop_source_fact", adapter_status: PREFIELD_ADAPTERS.map(adapter => ({ adapter_id: adapter.adapter_id, status: "not_retrieved", public_data_ids: [], limitation: "No authoritative record was attached." })), screening_hypotheses: [], field_mission_ids: [], limitations: ["Remote screening does not establish legal access, surveyed boundaries, buildability, septic suitability, wetlands status, utility availability or capacity, timber value, engineering sufficiency, or construction cost."] };
    list(source.public_data_records).forEach(recordInput => { const record = addPublicDataRecord(data, recordInput); const status = dossier.adapter_status.find(item => item.adapter_id === record.adapter_id); if (status) { status.status = "retrieved"; status.public_data_ids.push(record.public_data_id); status.limitation = list(record.limitations).join("; ") || "Review source resolution and date."; } });
    list(source.screening_hypotheses).forEach(hypothesis => dossier.screening_hypotheses.push(Object.assign({ hypothesis_id: id("desktop-hypothesis"), information_class: "desktop_screening_hypothesis", status: "unverified", created_at: now(), supporting_public_data_ids: [], limitation: "Field verification required." }, copy(hypothesis))));
    data.prefield_dossiers.push(dossier); return dossier;
  }

  function createFieldMission(inspection, input) {
    const data = ensureInspectionModel(inspection); const source = input || {};
    if (!source.question) throw new Error("A Field Mission requires an exact question.");
    const mission = { mission_id: id("mission"), decision: source.decision || "Reduce property uncertainty", question: source.question, intended_use_scenario_id: source.intended_use_scenario_id || data.active_intended_use_scenario_id || null, source_hypothesis_ids: list(source.source_hypothesis_ids), requested_feature_types: list(source.requested_feature_types), required_media_roles: list(source.required_media_roles), requested_measurements: list(source.requested_measurements), professional_handoff: source.professional_handoff || null, status: "open", created_at: now(), information_class: "desktop_screening_hypothesis" };
    data.field_missions.push(mission); return mission;
  }

  function destinationFromOffset(phone, bearingDeg, distanceM) {
    const latitude = finite(phone && (phone.latitude != null ? phone.latitude : phone.lat)); const longitude = finite(phone && (phone.longitude != null ? phone.longitude : phone.lon));
    const bearing = finite(bearingDeg); const distance = finite(distanceM);
    if (latitude == null || longitude == null || bearing == null || distance == null) return null;
    const radius = 6371008.8, angular = distance / radius, heading = bearing * Math.PI / 180, lat1 = latitude * Math.PI / 180, lon1 = longitude * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(heading));
    const lon2 = lon1 + Math.atan2(Math.sin(heading) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
    return { latitude: lat2 * 180 / Math.PI, longitude: ((lon2 * 180 / Math.PI + 540) % 360) - 180 };
  }

  function geometryRecord(source) {
    const basis = GEOMETRY_BASES.includes(source.geometry_basis) ? source.geometry_basis : "phone_location_only";
    const phone = copy(source.phone_location || {}); const result = { geometry_basis: basis, phone_location: phone, feature_geometry: source.feature_geometry || null, limitation: "Phone GPS is not survey-grade and may represent the inspector rather than the feature." };
    if (basis === "at_feature") result.feature_geometry = { type: "Point", coordinates: [finite(phone.longitude != null ? phone.longitude : phone.lon), finite(phone.latitude != null ? phone.latitude : phone.lat)] };
    if (basis === "measured_offset") {
      const calculated = destinationFromOffset(phone, source.bearing_to_feature_deg, source.distance_to_feature_m);
      result.measured_offset = { bearing_to_feature_deg: finite(source.bearing_to_feature_deg), distance_to_feature_m: finite(source.distance_to_feature_m), distance_method: source.distance_method || "Unknown", calculated_target_coordinate: calculated, accuracy_and_limitation: source.offset_limitation || "Calculated from phone GPS, field bearing and field distance; not a survey determination." };
      if (calculated) result.feature_geometry = { type: "Point", coordinates: [calculated.longitude, calculated.latitude] };
    }
    return result;
  }

  function startFeatureSession(inspection, input) {
    const data = ensureInspectionModel(inspection); const source = input || {}; const template = templateFor(source.button_type || source.feature_type);
    if (!source.phone_location) throw new Error("A current GPS fix is required to start a Feature Capture Session.");
    const session = {
      feature_session_id: source.feature_session_id || id("feature"), inspection_id: data.inspection_id || null, property_id: data.property_id || null,
      button_type: source.button_type || "other", feature_type: source.feature_type || template.feature_type, feature_label: source.feature_label || template.label,
      status: "draft", opened_at: now(source.opened_at), saved_at: null, completed_at: null, information_class: "field_observation",
      question_ids: list(source.question_ids), exact_question: source.exact_question || "", mission_ids: list(source.mission_ids), area_id: source.area_id || null,
      geometry: geometryRecord(source), gps_accuracy_m: finite(source.phone_location.accuracy_m), compass_heading_deg: finite(source.compass_heading_deg), device_orientation: source.device_orientation || null,
      weather_context_id: source.weather_context_id || null, structured_attributes: {}, skipped_fields: [], direct_photographs: [], direct_voice_notes: [], direct_observation_ids: [], measurements: [],
      ai_suggestions: [], corrections: [], professional_determination_ids: [], repeat_station_id: null, required_photo_roles: template.photo_roles.slice(), warning: PROFESSIONAL_WARNINGS[template.feature_type] || null,
      crash_recovery: { durable_local_state: true, last_saved_at: now(source.opened_at) }
    };
    data.feature_capture_sessions.push(session); data.active_feature_session_id = session.feature_session_id;
    recordEvent(data, { event_type: "feature_session_opened", feature_session_id: session.feature_session_id, information_class: "field_observation", phone_location: copy(source.phone_location) });
    return session;
  }

  function sessionById(inspection, sessionId) { return ensureInspectionModel(inspection).feature_capture_sessions.find(item => String(item.feature_session_id) === String(sessionId)) || null; }
  function activeSession(inspection) { const data = ensureInspectionModel(inspection); return sessionById(data, data.active_feature_session_id); }
  function applySessionDraft(inspection, sessionId, attributes, skippedFields) {
    const data = ensureInspectionModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Feature Capture Session was not found.");
    session.structured_attributes = Object.assign({}, session.structured_attributes, copy(attributes || {}));
    list(skippedFields).forEach(item => { if (item && item.field && !session.skipped_fields.some(existing => existing.field === item.field)) session.skipped_fields.push({ field: item.field, reason: item.reason || "Unknown", recorded_at: now() }); });
    session.crash_recovery.last_saved_at = now(); recordEvent(data, { event_type: "feature_session_draft_saved", feature_session_id: sessionId, changed_fields: Object.keys(attributes || {}) }); return session;
  }

  function updateSessionGeometry(inspection, sessionId, input) {
    const data = ensureInspectionModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Feature Capture Session was not found.");
    const previous = session.geometry || {};
    session.geometry = geometryRecord(Object.assign({}, input || {}, { phone_location: (input && input.phone_location) || previous.phone_location, feature_geometry: (input && input.feature_geometry) || previous.feature_geometry }));
    if (session.geometry.geometry_basis === "walked_line") {
      session.geometry.walked_points = list(previous.walked_points);
      session.geometry.feature_geometry = previous.feature_geometry || { type: "LineString", coordinates: session.geometry.walked_points.map(item => [item.longitude, item.latitude]) };
      session.geometry.limitation = previous.limitation || "Walked phone-GPS centerline for this route-condition segment; it is not a surveyed road edge, right-of-way, or passable-width boundary.";
    }
    session.crash_recovery.last_saved_at = now(); recordEvent(data, { event_type: "feature_geometry_updated", feature_session_id: sessionId, geometry_basis: session.geometry.geometry_basis }); return session;
  }

  function appendWalkedLinePoint(inspection, sessionId, point) {
    const data = ensureInspectionModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Feature Capture Session was not found.");
    if (session.geometry.geometry_basis !== "walked_line") return session;
    const latitude = finite(point && (point.latitude != null ? point.latitude : point.lat)); const longitude = finite(point && (point.longitude != null ? point.longitude : point.lon));
    if (latitude == null || longitude == null) return session;
    session.geometry.walked_points = list(session.geometry.walked_points);
    const candidate = { latitude, longitude, recorded_at: now(point.time || point.recorded_at), accuracy_m: finite(point.accuracy_m), gps_sequence: finite(point.sequence) };
    const previous = session.geometry.walked_points[session.geometry.walked_points.length - 1];
    if (!previous || previous.latitude !== candidate.latitude || previous.longitude !== candidate.longitude || previous.recorded_at !== candidate.recorded_at) session.geometry.walked_points.push(candidate);
    session.geometry.feature_geometry = { type: "LineString", coordinates: session.geometry.walked_points.map(item => [item.longitude, item.latitude]) };
    session.geometry.limitation = "Walked phone-GPS centerline for this route-condition segment; it is not a surveyed road edge, right-of-way, or passable-width boundary.";
    session.crash_recovery.last_saved_at = candidate.recorded_at; return session;
  }

  function validateSession(session, minimumOnly) {
    const template = templateFor(session.button_type); const attrs = session.structured_attributes || {}; const errors = [];
    template.minimum.forEach(field => { if (attrs[field] == null || String(attrs[field]).trim() === "") errors.push(`${field} is required for the minimum record.`); });
    if (session.feature_type === "water" && ["Measured", "Estimated"].includes(attrs.depth_status)) {
      ["water_depth", "water_depth_unit", "measurement_method", "measurement_basis"].forEach(field => { if (!attrs[field] || attrs[field] === "Unknown") errors.push(`${field} is required when depth is ${String(attrs.depth_status).toLowerCase()}.`); });
    }
    if (session.feature_type === "soil_profile" && (attrs.owner_authorized !== "Acknowledged" || attrs.utility_safety_acknowledged !== "Acknowledged")) errors.push("Soil Probe requires both authorization and underground-utility safety acknowledgments.");
    if (!GEOMETRY_BASES.includes(session.geometry.geometry_basis)) errors.push("Choose a valid geometry basis.");
    if (session.geometry.geometry_basis === "measured_offset" && !(session.geometry.measured_offset && session.geometry.measured_offset.calculated_target_coordinate)) errors.push("Measured offset requires bearing, distance, and method.");
    if (!minimumOnly && !session.direct_observation_ids.length) errors.push("The session must retain its original field observation relationship.");
    return { valid: errors.length === 0, errors };
  }

  function saveMinimumSession(inspection, sessionId, attributes, skippedFields) {
    const data = ensureInspectionModel(inspection); const session = applySessionDraft(data, sessionId, attributes, skippedFields); const validation = validateSession(session, true);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    session.status = "minimum_saved"; session.saved_at = now(); session.crash_recovery.last_saved_at = session.saved_at;
    recordEvent(data, { event_type: "feature_session_minimum_saved", feature_session_id: sessionId }); return session;
  }

  function attachDirectEvidence(inspection, sessionId, recordType, recordId, options) {
    const data = ensureInspectionModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Feature Capture Session was not found.");
    const settings = options || {}; const recordedAt = now(settings.recorded_at); let target;
    if (recordType === "photo") { target = session.direct_photographs; if (!target.some(item => String(item.photo_id) === String(recordId))) target.push({ photo_id: recordId, photo_role: settings.role || "Context", directly_attached: true, attached_at: recordedAt }); }
    else if (recordType === "voice_note") { target = session.direct_voice_notes; if (!target.some(item => String(item.voice_note_id) === String(recordId))) target.push({ voice_note_id: recordId, role: settings.role || "Feature explanation", directly_attached: true, attached_at: recordedAt }); }
    else if (recordType === "observation") { target = session.direct_observation_ids; if (!target.some(item => String(item) === String(recordId))) target.push(recordId); }
    else if (recordType === "measurement") { target = session.measurements; if (!target.some(item => String(item.measurement_id || item) === String(recordId))) target.push(settings.measurement || recordId); }
    else throw new Error("Unsupported direct evidence type.");
    recordEvent(data, { event_type: "direct_evidence_attached", feature_session_id: sessionId, record_type: recordType, record_id: recordId, role: settings.role || null }); return session;
  }

  function addAiSuggestion(inspection, sessionId, suggestion) {
    const data = ensureInspectionModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Feature Capture Session was not found.");
    const record = Object.assign({ suggestion_id: id("ai-suggestion"), information_class: "ai_suggestion", status: "unconfirmed", created_at: now(), must_not_overwrite_original: true }, copy(suggestion || {}));
    session.ai_suggestions.push(record); recordEvent(data, { event_type: "ai_suggestion_appended", feature_session_id: sessionId, suggestion_id: record.suggestion_id, information_class: "ai_suggestion" }); return record;
  }

  function completeSession(inspection, sessionId) {
    const data = ensureInspectionModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Feature Capture Session was not found.");
    const validation = validateSession(session, false); if (!validation.valid) throw new Error(validation.errors.join(" "));
    session.status = "complete"; session.completed_at = now(); data.active_feature_session_id = null;
    recordEvent(data, { event_type: "feature_session_completed", feature_session_id: sessionId }); return session;
  }

  function abandonDraftForLater(inspection, sessionId, reason) {
    const data = ensureInspectionModel(inspection); const session = sessionById(data, sessionId); if (!session) return null;
    session.status = session.status === "minimum_saved" ? "minimum_saved_review_pending" : "draft_review_pending"; session.review_reason = reason || "Complete during review"; data.active_feature_session_id = null;
    recordEvent(data, { event_type: "feature_session_deferred", feature_session_id: sessionId, reason: session.review_reason }); return session;
  }

  function makeRepeatStation(inspection, sessionId, input) {
    const data = ensureInspectionModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Feature Capture Session was not found."); const source = input || {};
    const station = { repeat_station_id: id("repeat"), source_feature_session_id: sessionId, target_location: copy(session.geometry), camera_direction_deg: finite(source.camera_direction_deg), camera_height: source.camera_height || null, photo_role_template: list(source.photo_role_template).length ? list(source.photo_role_template) : session.required_photo_roles.slice(), measurement_template: list(source.measurement_template), desired_trigger: source.desired_trigger || "Scheduled date", scheduled_date: source.scheduled_date || null, created_at: now(), information_class: "inspector_interpretation" };
    data.repeat_stations.push(station); session.repeat_station_id = station.repeat_station_id; return station;
  }

  function appendProfessionalDetermination(inspection, input) {
    const data = ensureInspectionModel(inspection); const source = input || {}; if (!source.professional_name || !source.professional_type || !source.determination) throw new Error("Professional identity, type, and determination are required.");
    const record = Object.assign({ professional_determination_id: id("professional"), information_class: "professional_determination", recorded_at: now(), feature_session_ids: [], supporting_record_ids: [], source_document: null }, copy(source));
    data.professional_determinations.push(record); list(record.feature_session_ids).forEach(sessionId => { const session = sessionById(data, sessionId); if (session && !session.professional_determination_ids.includes(record.professional_determination_id)) session.professional_determination_ids.push(record.professional_determination_id); }); return record;
  }

  function appendDerivedValueEffect(inspection, input) {
    const data = ensureInspectionModel(inspection); const source = input || {}; const scenarioId = source.intended_use_scenario_id || data.active_intended_use_scenario_id;
    if (!scenarioId || !data.intended_use_scenarios.some(item => item.scenario_id === scenarioId)) throw new Error("An Intended Use Scenario is required before assigning a value effect.");
    if (!list(source.supporting_evidence_ids).length) throw new Error("A derived value effect requires supporting evidence.");
    const record = Object.assign({ value_effect_id: id("value-effect"), information_class: "inspector_interpretation", intended_use_scenario_id: scenarioId, effect_type: "neutral", supporting_evidence_ids: [], contradicting_evidence_ids: [], confidence: "low", consequence_if_wrong: "Unknown", cheapest_next_investigation: "Unknown", professional_determination_required: false, created_at: now(), monetary_amount: null, monetary_source: null }, copy(source));
    data.derived_value_effects.push(record); return record;
  }

  function heatMapEligibility(inspection, scenarioId) {
    const data = ensureInspectionModel(inspection); const selected = scenarioId || data.active_intended_use_scenario_id;
    if (!selected) return { eligible: false, status: "INSUFFICIENT_SPATIAL_EVIDENCE", reason: "Specify an Intended Use Scenario before generating a heat map." };
    const spatial = data.feature_capture_sessions.filter(item => item.status !== "draft" && item.geometry && item.geometry.feature_geometry);
    const effects = data.derived_value_effects.filter(item => item.intended_use_scenario_id === selected && item.supporting_evidence_ids.length);
    const coverage = data.coverage_classifications.filter(item => item.status !== "not_inspected");
    if (spatial.length < 3 || effects.length < 3 || !coverage.length) return { eligible: false, status: "INSUFFICIENT_SPATIAL_EVIDENCE", reason: "At least three spatial Feature Capture Sessions, three evidence-linked effects, and recorded coverage are required. Unknown areas remain unknown." };
    return { eligible: true, status: "EVIDENCE_SUPPORTED", scenario_id: selected, evidence_density: { spatial_feature_count: spatial.length, derived_effect_count: effects.length, coverage_classification_count: coverage.length }, unknown_areas_visible: true };
  }

  function packageModel(inspection) {
    const data = ensureInspectionModel(inspection); const eligibility = heatMapEligibility(data);
    return {
      schema_name: "property-field-truth-layer", schema_version: SCHEMA_VERSION, property_id: data.property_id || null, inspection_id: data.inspection_id || null,
      information_classes: INFORMATION_CLASSES, hierarchy: ["Property", "Intended Use Scenario", "Decision", "Field Mission", "Question", "Feature Capture Session", "Original Evidence", "Measurement", "Derived Finding", "Value/Cost/Risk Effect", "Remaining Uncertainty", "Next Investigation"],
      intended_use_scenarios: copy(data.intended_use_scenarios), field_missions: copy(data.field_missions), feature_capture_sessions: copy(data.feature_capture_sessions), feature_session_events: copy(data.feature_session_events),
      derived_findings: copy(data.derived_findings), derived_value_effects: copy(data.derived_value_effects), professional_determinations: copy(data.professional_determinations), remaining_unknowns: copy(data.remaining_unknowns), next_investigations: copy(data.next_investigations), repeat_stations: copy(data.repeat_stations),
      prefield_dossiers: copy(data.prefield_dossiers), public_data_provenance: copy(data.public_data_records), coverage_classifications: copy(data.coverage_classifications), heat_map_eligibility: eligibility,
      migration: copy(data.field_truth_migration), warnings: Object.values(PROFESSIONAL_WARNINGS),
      rules: ["Original evidence is immutable.", "Corrections, interpretations, AI suggestions, derived effects and professional determinations are append-only.", "Public facts, screening hypotheses, field evidence, interpretations, AI suggestions, professional determinations and unknowns must never be blended.", "Phone GPS is not survey-grade.", "No monetary amount may be invented."]
    };
  }

  return { SCHEMA_VERSION, INFORMATION_CLASSES, GEOMETRY_BASES, UNKNOWN_VALUES, PREFIELD_ADAPTERS, FIELD_TEMPLATES, PROFESSIONAL_WARNINGS, templateFor, ensureInspectionModel, createScenario, addPublicDataRecord, createPrefieldDossier, createFieldMission, destinationFromOffset, startFeatureSession, sessionById, activeSession, applySessionDraft, updateSessionGeometry, appendWalkedLinePoint, validateSession, saveMinimumSession, attachDirectEvidence, addAiSuggestion, completeSession, abandonDraftForLater, makeRepeatStation, appendProfessionalDetermination, appendDerivedValueEffect, heatMapEligibility, packageModel };
});
