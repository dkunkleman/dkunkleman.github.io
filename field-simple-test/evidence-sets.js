(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EvidenceSets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FLOWING_WATER_SET_TYPE = "Flowing Water / Creek Corridor";
  const FLOWING_WATER_REPORT_LIMIT = "Observed flowing-water corridor. Permanence, ordinary high-water limits, wetlands status, drainage rights and building setbacks remain unverified.";
  const SET_TYPES = ["Water Area", FLOWING_WATER_SET_TYPE, "Individual Tree", "Tree Group / Canopy", "Timber Sample Plot", "Potential Homesite", "Drainage Feature", "Road / Access", "Boundary Marker", "View", "Vegetation / Clearing", "Other"];
  const PHOTO_ROLES = ["Context", "Close-up", "Measurement", "Relationship to surroundings", "Opposite direction", "Whole subject", "Detail", "Before", "After", "Upstream view", "Downstream view", "Across-channel view", "Channel width", "Water depth", "Flow Evidence", "Adjacent Higher-Ground / Tree Context", "Scenic Context", "Building-Avoidance Context", "Creek / homesite or road relationship", "Whole tree", "Bark", "Base / ground", "Lower trunk to first fork", "Crown / canopy", "Visible crown segment", "Connected branch", "Leaf upper surface", "Leaf underside", "Twig / terminal bud", "Fruit / seed / cone / flower", "Scale photograph", "DBH tape position", "Visible defect", "Root condition", "Targets", "Surrounding canopy", "Plot center / radius", "Access / wet ground", "360-degree panorama", "Transition", "Other"];
  const PREFIXES = { "Water Area": "WG", [FLOWING_WATER_SET_TYPE]: "FW", "Individual Tree": "TR", "Tree Group / Canopy": "TG", "Timber Sample Plot": "TP", "Potential Homesite": "HS", "Drainage Feature": "DF", "Road / Access": "AC", "Boundary Marker": "BM", View: "VW", "Vegetation / Clearing": "VG", Other: "ES" };
  const REQUIRED_ROLES = {
    "Individual Tree": ["Bark", "Base / ground", "Crown / canopy"],
    "Tree Group / Canopy": ["Context", "Surrounding canopy"],
    "Potential Homesite": ["Context"],
    "Water Area": ["Context", "Measurement", "Transition"],
    [FLOWING_WATER_SET_TYPE]: ["Upstream view", "Downstream view", "Across-channel view", "Creek / homesite or road relationship"],
    "Timber Sample Plot": ["Plot center / radius", "Context", "Access / wet ground"]
  };
  const TREE_VISIBILITY = ["Yes", "No — canopy blocks it", "No — nearby trees block it", "No — brush blocks it", "No — water or unsafe ground blocks it", "No — property boundary or access prevents it", "Unsure"];
  const SPECIES_DETERMINATIONS = ["Inspector confirmed", "Probable", "Possible", "Unknown", "Professional identification requested"];
  const FALLEN_LEAF_CONFIDENCE = ["Yes — watched it fall or traced it to this tree", "Probably", "Unsure"];

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function nowIso(value) { return value || new Date().toISOString(); }
  function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function photoNumber(photo) { return Number(String(photo && photo.photo_number || "").replace(/\D/g, "")); }
  function recordId(recordType, record) {
    if (!record) return null;
    if (recordType === "photo") return record.id || record.photo_id || null;
    if (recordType === "voice_note") return record.id || record.voice_note_id || null;
    if (recordType === "gps_point") return record.id || record.gps_point_id || null;
    if (recordType === "measurement") return record.id || record.measurement_id || null;
    return record.id || record.observation_id || null;
  }

  function ensureEvidenceSetModel(inspection) {
    const data = inspection || {};
    data.evidence_sets = Array.isArray(data.evidence_sets) ? data.evidence_sets : [];
    data.evidence_set_events = Array.isArray(data.evidence_set_events) ? data.evidence_set_events : [];
    data.evidence_set_suggestions = Array.isArray(data.evidence_set_suggestions) ? data.evidence_set_suggestions : [];
    data.active_evidence_set_id = data.active_evidence_set_id || null;
    data.evidence_set_counters = data.evidence_set_counters && typeof data.evidence_set_counters === "object" ? data.evidence_set_counters : {};
    return data;
  }

  function appendEvent(inspection, event) {
    const data = ensureEvidenceSetModel(inspection);
    const row = Object.assign({
      event_id: makeId("evidence-set-event"),
      recorded_at: new Date().toISOString(),
      immutable: true
    }, clone(event || {}));
    data.evidence_set_events.push(row);
    return row;
  }

  function startEvidenceSet(inspection, request) {
    const data = ensureEvidenceSetModel(inspection);
    const input = request || {};
    if (!SET_TYPES.includes(input.set_type)) throw new Error("Choose what this evidence set documents.");
    if (data.active_evidence_set_id) throw new Error("Finish the active subject before starting another one.");
    const prefix = PREFIXES[input.set_type] || "ES";
    const next = Number(data.evidence_set_counters[prefix] || 0) + 1;
    data.evidence_set_counters[prefix] = next;
    const id = input.evidence_set_id || `evidence-set-${prefix.toLowerCase()}-${String(next).padStart(3, "0")}`;
    const label = input.label || `${input.set_type} ${prefix}-${next}`;
    const createdAt = nowIso(input.created_at);
    const set = {
      schema_name: "property-intelligence-evidence-set",
      schema_version: "1.1",
      evidence_set_id: id,
      property_id: data.property_id || null,
      inspection_id: data.inspection_id || null,
      set_type: input.set_type,
      label,
      created_at: createdAt,
      created_by: input.created_by || data.inspector_identity || "Field Inspector",
      status: "active",
      relationship_basis: input.relationship_basis || "inspector_started_subject",
      inspector_confirmed: input.inspector_confirmed !== false,
      tree_id: input.set_type === "Individual Tree" ? (input.tree_id || `tree:${data.property_id || "property"}:${String(next).padStart(6, "0")}`) : null,
      subject_details: clone(input.subject_details || {}),
      original_definition_preserved: true
    };
    data.evidence_sets.push(set);
    data.active_evidence_set_id = id;
    appendEvent(data, { evidence_set_id: id, event_type: "set_started", created_by: set.created_by, inspector_confirmed: set.inspector_confirmed });
    return set;
  }

  function attachRecord(inspection, evidenceSetId, recordType, record, options) {
    const data = ensureEvidenceSetModel(inspection);
    const set = data.evidence_sets.find(item => item.evidence_set_id === evidenceSetId);
    if (!set) throw new Error("The evidence set no longer exists.");
    const id = typeof record === "string" ? record : recordId(recordType, record);
    if (!id) throw new Error("The evidence record has no stable ID.");
    const settings = options || {};
    return appendEvent(data, {
      evidence_set_id: evidenceSetId,
      event_type: "record_attached",
      record_type: recordType,
      record_id: id,
      photo_role: recordType === "photo" ? (settings.photo_role || (settings.photo_roles || [])[0] || "Context") : null,
      photo_roles: recordType === "photo" ? Array.from(new Set((settings.photo_roles || [settings.photo_role || "Context"]).filter(Boolean))) : [],
      relationship_basis: settings.relationship_basis || "active_inspector_started_set",
      inspector_confirmed: settings.inspector_confirmed !== false,
      created_by: settings.created_by || data.inspector_identity || "Field Inspector"
    });
  }

  function setPhotoRole(inspection, evidenceSetId, photoId, role, options) {
    if (!PHOTO_ROLES.includes(role)) throw new Error("Choose a recognized photograph role.");
    return appendEvent(inspection, {
      evidence_set_id: evidenceSetId,
      event_type: "photo_role_assigned",
      record_type: "photo",
      record_id: photoId,
      photo_role: role,
      inspector_confirmed: !(options && options.inspector_confirmed === false),
      created_by: options && options.created_by || inspection.inspector_identity || "Field Inspector"
    });
  }

  function detachRecord(inspection, evidenceSetId, recordType, id, reason) {
    return appendEvent(inspection, {
      evidence_set_id: evidenceSetId,
      event_type: "record_detached",
      record_type: recordType,
      record_id: id,
      reason: reason || "inspector_removed_relationship",
      inspector_confirmed: true,
      created_by: inspection.inspector_identity || "Field Inspector"
    });
  }

  function finishEvidenceSet(inspection, evidenceSetId, details, at) {
    const data = ensureEvidenceSetModel(inspection);
    const set = data.evidence_sets.find(item => item.evidence_set_id === evidenceSetId);
    if (!set) throw new Error("The evidence set no longer exists.");
    appendEvent(data, { evidence_set_id: evidenceSetId, event_type: "set_finished", finished_at: nowIso(at), subject_details: clone(details || {}), inspector_confirmed: true, created_by: data.inspector_identity || "Field Inspector" });
    if (data.active_evidence_set_id === evidenceSetId) data.active_evidence_set_id = null;
    return effectiveEvidenceSet(data, evidenceSetId);
  }

  function effectiveEvidenceSet(inspection, evidenceSetId) {
    const data = ensureEvidenceSetModel(inspection);
    const source = data.evidence_sets.find(item => item.evidence_set_id === evidenceSetId);
    if (!source) return null;
    const result = clone(source);
    const links = new Map();
    const voidedEventIds = new Set((data.corrections || []).filter(item => item.target && item.target.record_type === "group_assignment" && (item.resulting_status === "voided" || item.status === "voided")).map(item => String(item.target.record_id)));
    const events = data.evidence_set_events.filter(item => item.evidence_set_id === evidenceSetId && !voidedEventIds.has(String(item.event_id))).sort((a, b) => String(a.recorded_at || "").localeCompare(String(b.recorded_at || "")));
    events.forEach(event => {
      const key = `${event.record_type || ""}:${event.record_id || ""}`;
      if (event.event_type === "record_attached") links.set(key, { record_type: event.record_type, record_id: event.record_id, photo_role: event.photo_role || null, photo_roles: Array.from(new Set((event.photo_roles || [event.photo_role]).filter(Boolean))), attached_by_event_id: event.event_id, inspector_confirmed: event.inspector_confirmed !== false });
      if (event.event_type === "photo_role_assigned" && links.has(key)) {
        links.get(key).photo_role = event.photo_role;
        links.get(key).photo_roles = Array.from(new Set([...(links.get(key).photo_roles || []), event.photo_role].filter(Boolean)));
      }
      if (event.event_type === "record_detached") links.delete(key);
      if (event.event_type === "set_finished") {
        result.status = "finished";
        result.finished_at = event.finished_at || event.recorded_at;
        result.subject_details = Object.assign({}, result.subject_details || {}, clone(event.subject_details || {}));
      }
      if (event.event_type === "set_voided") result.status = "voided";
    });
    result.record_links = Array.from(links.values());
    result.photo_links = result.record_links.filter(item => item.record_type === "photo");
    result.voice_note_ids = result.record_links.filter(item => item.record_type === "voice_note").map(item => item.record_id);
    result.observation_ids = result.record_links.filter(item => item.record_type === "observation").map(item => item.record_id);
    result.measurement_ids = result.record_links.filter(item => item.record_type === "measurement").map(item => item.record_id);
    result.event_ids = events.map(item => item.event_id);
    return result;
  }

  function buildEffectiveEvidenceSets(inspection) {
    const data = ensureEvidenceSetModel(inspection);
    return data.evidence_sets.map(item => effectiveEvidenceSet(data, item.evidence_set_id)).filter(item => item && item.status !== "voided" && item.inspector_confirmed);
  }

  function haversineMeters(a, b) {
    const lat1 = Number(a && a.lat), lon1 = Number(a && a.lon), lat2 = Number(b && b.lat), lon2 = Number(b && b.lon);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
    const r = 6371008.8, p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function maxSeparation(records) {
    let maximum = 0, known = false;
    for (let i = 0; i < records.length; i += 1) for (let j = i + 1; j < records.length; j += 1) {
      const distance = haversineMeters(records[i], records[j]);
      if (distance != null) { known = true; maximum = Math.max(maximum, distance); }
    }
    return known ? Math.round(maximum * 10) / 10 : null;
  }

  function summarizeEvidenceSet(inspection, set) {
    const data = inspection || {};
    const effective = typeof set === "string" ? effectiveEvidenceSet(data, set) : set;
    if (!effective) return null;
    const photoMap = new Map((data.photos || []).map(item => [String(item.id), item]));
    const photos = (effective.photo_links || []).map(link => ({ link, photo: photoMap.get(String(link.record_id)) })).filter(item => item.photo);
    const times = photos.map(item => item.photo.recorded_at || item.photo.time).filter(Boolean).sort();
    const roles = photos.flatMap(item => item.link.photo_roles || [item.link.photo_role]).filter(Boolean);
    const isTreeSet = ["Individual Tree", "Tree Group / Canopy"].includes(effective.set_type);
    const required = isTreeSet ? treeEvidencePlan(effective.subject_details || {}).required_roles : (REQUIRED_ROLES[effective.set_type] || ["Context"]);
    const missing = required.filter(role => !roles.includes(role));
    const summary = {
      schema_name: "property-intelligence-evidence-set-summary",
      schema_version: "1.0",
      evidence_set_id: effective.evidence_set_id,
      label: effective.label,
      set_type: effective.set_type,
      status: effective.status,
      inspector_confirmed: effective.inspector_confirmed === true,
      tree_id: effective.tree_id || null,
      first_timestamp: times[0] || null,
      last_timestamp: times[times.length - 1] || null,
      photograph_count: photos.length,
      photographs: photos.map(item => ({ photo_id: item.photo.id, photo_number: item.photo.photo_number || null, role: item.link.photo_role, roles: item.link.photo_roles || [item.link.photo_role].filter(Boolean), latitude: item.photo.lat, longitude: item.photo.lon, timestamp: item.photo.recorded_at || item.photo.time })),
      exact_photo_locations_preserved: true,
      maximum_photo_separation_m: maxSeparation(photos.map(item => item.photo)),
      observation_ids: effective.observation_ids || [],
      voice_note_ids: effective.voice_note_ids || [],
      measurement_ids: effective.measurement_ids || [],
      subject_details: clone(effective.subject_details || {}),
      missing_high_value_views: missing,
      report_rule: `Describe ${effective.label} as one subject; list its individual photographs and roles without counting them as separate subjects.`
    };
    if (isTreeSet) summary.tree_identification = {
      visibility: effective.subject_details && effective.subject_details.whole_tree_visibility || "Unsure",
      visibility_limitation: effective.subject_details && effective.subject_details.whole_tree_visibility_reason || null,
      purpose: effective.subject_details && effective.subject_details.purpose || "unknown",
      evidence_plan: treeEvidencePlan(effective.subject_details || {}),
      ai_species_suggestions: eventsForSet(data, effective.evidence_set_id).filter(item => item.event_type === "ai_species_suggestion").map(item => item.suggestion),
      inspector_determinations: eventsForSet(data, effective.evidence_set_id).filter(item => item.event_type === "species_determination").map(item => item.determination),
      leaf_provenance: eventsForSet(data, effective.evidence_set_id).filter(item => item.event_type === "leaf_provenance_recorded").map(item => ({ photo_id: item.record_id, confidence: item.confidence })),
      confidence_limit: effective.subject_details && effective.subject_details.whole_tree_visibility !== "Yes" ? "A complete whole-tree view was not safely obtainable. Identification confidence must reflect the missing view and rely only on captured bark, trunk, crown fragments, connected leaves, twig/bud, reproductive material, and habitat." : null
    };
    if (effective.set_type === "Water Area") {
      const water = photos.map(item => item.photo.water).filter(Boolean);
      summary.water = {
        measured_depths: water.map(item => ({ depth_band: item.water_depth_band || null, depth_exact_in: item.water_depth_exact_in == null ? null : item.water_depth_exact_in, basis: item.measurement_basis || null })),
        estimated_length_ft: water.map(item => Number(item.water_length_ft)).filter(Number.isFinite).sort((a, b) => b - a)[0] || null,
        estimated_width_ft: water.map(item => Number(item.water_width_ft)).filter(Number.isFinite).sort((a, b) => b - a)[0] || null,
        standing_or_flowing: Array.from(new Set(water.map(item => item.water_type || item.water_behavior).filter(Boolean))),
        transition_photo_ids: photos.filter(item => item.link.photo_role === "Transition").map(item => item.photo.id),
        boundary_rule: "All photographed points are observed. Any connecting outline is inferred and must be styled differently from observed points."
      };
    }
    if (effective.set_type === "Timber Sample Plot") {
      summary.preliminary_timber_plot = {
        plot_id: effective.subject_details && effective.subject_details.plot_id || null,
        plot_size: effective.subject_details && effective.subject_details.plot_size || null,
        plot_acres: effective.subject_details && effective.subject_details.plot_acres || null,
        radius_ft: effective.subject_details && effective.subject_details.radius_ft || null,
        sampling_method: effective.subject_details && effective.subject_details.sampling_method || "Fixed-radius field sample",
        tree_ids: effective.subject_details && effective.subject_details.tree_ids || [],
        report_rule: "Report this as preliminary fixed-radius reconnaissance. Do not imply that convenience, targeted, or sparse sampling is a formal statistically valid timber cruise."
      };
    }
    if (effective.set_type === FLOWING_WATER_SET_TYPE) {
      const water = photos.map(item => ({ photo: item.photo, roles: item.link.photo_roles || [item.link.photo_role], water: item.photo.water || {} }));
      const measured = item => String(item.water.measurement_basis || "").toLowerCase() === "measured" || item.roles.includes("Measurement");
      summary.flowing_water_corridor = {
        exact_photographed_points: water.map(item => ({ photo_id: item.photo.id, photo_number: item.photo.photo_number || null, latitude: item.photo.lat, longitude: item.photo.lon, timestamp: item.photo.recorded_at || item.photo.time, roles: item.roles })),
        visible_flow: effective.subject_details && effective.subject_details.visible_flow || "unknown",
        flow_direction: effective.subject_details && effective.subject_details.flow_direction || "unknown",
        channel_width_ft: effective.subject_details && effective.subject_details.channel_width_ft || null,
        channel_width_basis: effective.subject_details && effective.subject_details.channel_width_basis || "Unknown",
        measured_depth_points: water.filter(item => measured(item) && item.water.water_depth_exact_in != null).map(item => ({ photo_id: item.photo.id, photo_number: item.photo.photo_number || null, depth_in: Number(item.water.water_depth_exact_in), latitude: item.photo.lat, longitude: item.photo.lon })),
        measured_width_points: water.filter(item => measured(item) && item.water.water_width_ft != null).map(item => ({ photo_id: item.photo.id, photo_number: item.photo.photo_number || null, width_ft: Number(item.water.water_width_ft), latitude: item.photo.lat, longitude: item.photo.lon })),
        bank_condition: effective.subject_details && effective.subject_details.bank_condition || "not recorded",
        adjacent_higher_ground: effective.subject_details && effective.subject_details.adjacent_higher_ground || "not recorded",
        preserve_features: effective.subject_details && effective.subject_details.preserve_features || "not recorded",
        homesite_or_road_relationship: effective.subject_details && effective.subject_details.homesite_or_road_relationship || "not recorded",
        amenity_photo_ids: water.filter(item => item.roles.includes("Scenic Context")).map(item => item.photo.id),
        building_avoidance_photo_ids: water.filter(item => item.roles.includes("Building-Avoidance Context")).map(item => item.photo.id),
        voice_explanation_ids: effective.voice_note_ids || [],
        centerline_rule: "A centerline may be inferred only through connected inspector-confirmed flowing-water photo points. It is not a surveyed watercourse boundary.",
        report_classification: FLOWING_WATER_REPORT_LIMIT,
        uninspected_extent_rule: "Do not extend the corridor beyond the connected photographed evidence. Uninspected watercourse extent remains unknown.",
        safety_rule: "Do not cross the channel or stand in moving water to complete this evidence set."
      };
      if (!(effective.voice_note_ids || []).length) summary.missing_high_value_views.push("Voice explanation: why this water feature matters");
    }
    return summary;
  }

  function eventsForSet(inspection, evidenceSetId) {
    return (inspection.evidence_set_events || []).filter(item => item.evidence_set_id === evidenceSetId).sort((a, b) => String(a.recorded_at || "").localeCompare(String(b.recorded_at || "")));
  }

  function treeEvidencePlan(details) {
    const info = details || {};
    const visibility = TREE_VISIBILITY.includes(info.whole_tree_visibility) ? info.whole_tree_visibility : "Unsure";
    const purpose = String(info.purpose || "unknown").toLowerCase();
    let required;
    if (purpose === "timber sample") required = ["Measurement", "Bark", "Lower trunk to first fork", "Visible crown segment"];
    else if (purpose === "landscape" || purpose === "preserve") required = ["Base / ground", "Relationship to surroundings", "Visible crown segment"];
    else if (purpose === "hazard") required = ["Base / ground", "Visible defect", "Relationship to surroundings", "Targets"];
    else if (purpose === "species identification") required = ["Bark", "Connected branch", "Leaf upper surface", "Leaf underside", "Twig / terminal bud"];
    else if (purpose === "forest character") required = ["Context", "Surrounding canopy", "Relationship to surroundings"];
    else required = ["Bark", "Base / ground", "Visible crown segment"];
    const significantDefects = (info.defects_and_quality || []).filter(defect => !["Straight", "Unknown"].includes(defect));
    if (significantDefects.length && !required.includes("Visible defect")) required.push("Visible defect");
    if (visibility === "Yes") required.unshift("Whole tree");
    else required.unshift("Lower trunk to first fork");
    return {
      whole_tree_visibility: visibility,
      purpose: info.purpose || "unknown",
      required_roles: Array.from(new Set(required)),
      useful_when_available: ["Fruit / seed / cone / flower", "Scale photograph", "Opposite direction", "360-degree panorama"],
      obstruction_is_valid_evidence: visibility !== "Yes",
      do_not_repeat_whole_tree_prompt: visibility.startsWith("No —"),
      safety_rule: "Never cross water, climb, enter unsafe brush, leave authorized property, or stand in traffic to complete a checklist.",
      report_rule: visibility === "Yes" ? "Report the captured whole-tree context and other identifying views." : `Report that a whole-tree view was not safely obtainable (${visibility}) and explain how that limits confidence without criticizing the inspector.`
    };
  }

  function flowingWaterEvidencePlan() {
    return {
      required_roles: REQUIRED_ROLES[FLOWING_WATER_SET_TYPE].slice(),
      useful_when_safely_obtainable: ["Channel width", "Water depth", "Flow Evidence", "Adjacent Higher-Ground / Tree Context", "Scenic Context", "Building-Avoidance Context"],
      voice_prompt: "Why does this water feature matter to access, homesites, cost, risk, or what makes the property special?",
      safety_rule: "Do not cross the channel. Do not stand in moving water. Record only evidence obtainable from safe, authorized ground.",
      centerline_rule: "Only connected inspector-confirmed flowing-water observations may support a conservative inferred centerline. Never convert it into a surveyed boundary.",
      report_rule: FLOWING_WATER_REPORT_LIMIT
    };
  }

  function addAiSpeciesSuggestion(inspection, evidenceSetId, suggestion) {
    const data = ensureEvidenceSetModel(inspection);
    if (!data.evidence_sets.some(item => item.evidence_set_id === evidenceSetId && ["Individual Tree", "Tree Group / Canopy"].includes(item.set_type))) throw new Error("Species suggestions require a tree evidence set.");
    const input = suggestion || {};
    return appendEvent(data, { evidence_set_id: evidenceSetId, event_type: "ai_species_suggestion", suggestion: { likely_species: input.likely_species || "Unknown", alternative_species: Array.isArray(input.alternative_species) ? input.alternative_species : [], confidence_level: input.confidence_level || "low", identifying_features_visible: Array.isArray(input.identifying_features_visible) ? input.identifying_features_visible : [], important_features_missing: Array.isArray(input.important_features_missing) ? input.important_features_missing : [], status: "AI suggestion — not confirmed", disclaimer: "Never present this AI species suggestion as confirmed." }, inspector_confirmed: false, created_by: input.created_by || "AI review" });
  }

  function recordSpeciesDetermination(inspection, evidenceSetId, determination, species, createdBy) {
    if (!SPECIES_DETERMINATIONS.includes(determination)) throw new Error("Choose a recognized species-identification determination.");
    return appendEvent(inspection, { evidence_set_id: evidenceSetId, event_type: "species_determination", determination: { status: determination, species: species || "Unknown", recorded_by: createdBy || inspection.inspector_identity || "Field Inspector", factual_rule: determination === "Inspector confirmed" ? "Inspector-confirmed field identification; not a licensed professional determination unless stated." : "Not confirmed." }, inspector_confirmed: true, created_by: createdBy || inspection.inspector_identity || "Field Inspector" });
  }

  function recordLeafProvenance(inspection, evidenceSetId, photoId, confidence, createdBy) {
    if (!FALLEN_LEAF_CONFIDENCE.includes(confidence)) throw new Error("Choose how confidently the leaf came from this tree.");
    return appendEvent(inspection, { evidence_set_id: evidenceSetId, event_type: "leaf_provenance_recorded", record_type: "photo", record_id: photoId, confidence, association_status: confidence === FALLEN_LEAF_CONFIDENCE[0] ? "inspector_confirmed" : (confidence === "Probably" ? "probable" : "unverified"), activation_rule: "An unverified fallen leaf is never silently treated as belonging to the tree.", inspector_confirmed: true, created_by: createdBy || inspection.inspector_identity || "Field Inspector" });
  }

  function createEvidenceSetSummaries(inspection) {
    return { schema_name: "property-intelligence-evidence-set-index", schema_version: "1.0", sets: buildEffectiveEvidenceSets(inspection).map(set => summarizeEvidenceSet(inspection, set)) };
  }

  function addSuggestion(inspection, suggestion) {
    const data = ensureEvidenceSetModel(inspection);
    if (data.evidence_set_suggestions.some(item => item.suggestion_id === suggestion.suggestion_id)) return null;
    const row = Object.assign({ status: "pending_inspector_confirmation", created_at: new Date().toISOString(), activation_rule: "Never activate or group silently. Inspector confirmation is required." }, clone(suggestion));
    data.evidence_set_suggestions.push(row);
    return row;
  }

  function addPearsonSuggestions(inspection) {
    const data = ensureEvidenceSetModel(inspection);
    const photos = data.photos || [];
    const has = number => photos.some(photo => photoNumber(photo) === number);
    const addRange = (id, type, numbers, roles, label) => {
      if (!numbers.every(has)) return;
      addSuggestion(data, { suggestion_id: id, set_type: type, suggested_label: label, photo_ids: numbers.map(number => photos.find(photo => photoNumber(photo) === number).id), suggested_photo_roles: numbers.map((number, index) => ({ photo_id: photos.find(photo => photoNumber(photo) === number).id, photo_number: `P${number}`, role: roles[index] || "Context" })), basis: "Inspector-directed Pearson Road review" });
    };
    addRange("pearson-p45-p47-hardwood", "Individual Tree", [45, 46, 47], ["Bark", "Base / ground", "Whole tree"], "Mature hardwood P45-P47");
    addRange("pearson-p48-p50-hardwood", "Individual Tree", [48, 49, 50], ["Bark", "Base / ground", "Whole tree"], "Second hardwood P48-P50");
    addRange("pearson-p51-p53-pine", "Individual Tree", [51, 52, 53], ["Bark", "Base / ground", "Whole tree"], "Mature pine P51-P53");
    addRange("pearson-p57-p59-pine-canopy", "Tree Group / Canopy", [57, 58, 59], ["Whole tree", "Surrounding canopy", "Context"], "Pine and walkable canopy P57-P59");
    addRange("pearson-p64-p65-pine", "Individual Tree", [64, 65], ["Whole tree", "Bark"], "Mature pine P64-P65");
    addRange("pearson-p66-p67-hardwood", "Individual Tree", [66, 67], ["Whole tree", "Bark"], "Mature hardwood P66-P67");
    addRange("pearson-p68-p72-water", "Water Area", [68, 69, 70, 71, 72], ["Context", "Relationship to surroundings", "Close-up", "Detail", "Measurement"], "Localized water area P68-P72");
    if (has(73)) addSuggestion(data, { suggestion_id: "pearson-p73-transition", set_type: "Other", suggested_label: "Transition to ground without visible standing water", photo_ids: [photos.find(photo => photoNumber(photo) === 73).id], suggested_photo_roles: [{ photo_id: photos.find(photo => photoNumber(photo) === 73).id, photo_number: "P73", role: "Transition" }], basis: "Inspector-directed Pearson Road review; consider attaching to the confirmed P68-P72 water set." });
    const creekNumbers = [...Array.from({ length: 12 }, (_, index) => 107 + index), ...Array.from({ length: 5 }, (_, index) => 121 + index), ...Array.from({ length: 5 }, (_, index) => 132 + index), 143, 144, 145];
    if (creekNumbers.every(has)) {
      const roleFor = number => {
        if (number === 143) return ["Upstream view"];
        if (number === 144) return ["Downstream view"];
        if (number === 145) return ["Measurement", "Flow Evidence"];
        if (number === 135 || number === 136) return ["Scenic Context"];
        return ["Context"];
      };
      addSuggestion(data, {
        suggestion_id: "pearson-northwest-creek-corridor",
        set_type: FLOWING_WATER_SET_TYPE,
        suggested_label: "Northwest Creek / Flowing-Water Corridor",
        photo_ids: creekNumbers.map(number => photos.find(photo => photoNumber(photo) === number).id),
        suggested_photo_roles: creekNumbers.map(number => ({ photo_id: photos.find(photo => photoNumber(photo) === number).id, photo_number: `P${number}`, role: roleFor(number)[0], roles: roleFor(number) })),
        suggested_context_photo_roles: has(139) ? [{ photo_id: photos.find(photo => photoNumber(photo) === 139).id, photo_number: "P139", role: "Adjacent Higher-Ground / Tree Context", roles: ["Adjacent Higher-Ground / Tree Context"] }] : [],
        basis: "Inspector-directed Pearson Road review. P107-P118, P121-P125, P132-P136 and P143-P145 are candidate creek photographs; P139 is related adjacent higher-ground/tree context.",
        report_classification: FLOWING_WATER_REPORT_LIMIT
      });
    }
    addRange("pearson-p158-p159-shallow-puddle", "Water Area", [158, 159], ["Context", "Measurement"], "Localized shallow puddle P158-P159");
    addRange("pearson-p162-p163-shallow-puddle", "Water Area", [162, 163], ["Context", "Measurement"], "Second localized shallow puddle P162-P163");
    const firstPuddle = data.evidence_set_suggestions.find(item => item.suggestion_id === "pearson-p158-p159-shallow-puddle");
    if (firstPuddle) Object.assign(firstPuddle, {
      suggested_subject_details: { water_feature_type: "Isolated puddle", preliminary_depth_range_in: { minimum: 3, maximum: 4 }, description: "Localized shallow puddle, approximately 3–4 inches at the measured point" },
      suggested_measurement: { measurement_type: "Water depth", unit: "in", approximate_minimum: 3, approximate_maximum: 4, measurement_photo_number: "P159", exact_value: null, inspector_confirmation_required: true },
      basis: "Inspector-directed Pearson Road review. The photographs and approximate range are proposed; the exact depth remains inactive until inspector confirmation."
    });
    const secondPuddle = data.evidence_set_suggestions.find(item => item.suggestion_id === "pearson-p162-p163-shallow-puddle");
    if (secondPuddle) Object.assign(secondPuddle, {
      suggested_subject_details: { water_feature_type: "Isolated puddle", preliminary_depth_range_in: { minimum: 4, maximum: 5 }, description: "Second localized shallow puddle, approximately 4–5 inches at the measured point" },
      suggested_measurement: { measurement_type: "Water depth", unit: "in", approximate_minimum: 4, approximate_maximum: 5, measurement_photo_number: "P163", exact_value: null, inspector_confirmation_required: true },
      basis: "Inspector-directed Pearson Road review. The photographs and approximate range are proposed; the exact depth remains inactive until inspector confirmation."
    });
    return data.evidence_set_suggestions;
  }

  function suggestRecentGroup(inspection, options) {
    const data = ensureEvidenceSetModel(inspection);
    const settings = Object.assign({ max_seconds: 120, max_distance_m: 15, minimum_photos: 2 }, options || {});
    const assigned = new Set(buildEffectiveEvidenceSets(data).flatMap(set => (set.photo_links || []).map(link => String(link.record_id))));
    const photos = (data.photos || []).filter(item => !assigned.has(String(item.id))).slice().sort((a, b) => String(a.recorded_at || a.time || "").localeCompare(String(b.recorded_at || b.time || "")));
    if (photos.length < settings.minimum_photos) return null;
    const tail = [photos[photos.length - 1]];
    for (let index = photos.length - 2; index >= 0; index -= 1) {
      const candidate = photos[index], latest = tail[tail.length - 1];
      const seconds = Math.abs(new Date(latest.recorded_at || latest.time) - new Date(candidate.recorded_at || candidate.time)) / 1000;
      const distance = haversineMeters(candidate, latest);
      const sameSubject = String(candidate.photo_meaning && candidate.photo_meaning.subject || candidate.category || "") === String(latest.photo_meaning && latest.photo_meaning.subject || latest.category || "");
      const sceneMatch = candidate.scene_signature && latest.scene_signature && candidate.scene_signature === latest.scene_signature;
      if (seconds <= settings.max_seconds && (distance == null || distance <= settings.max_distance_m) && (sameSubject || sceneMatch)) tail.push(candidate); else break;
    }
    if (tail.length < settings.minimum_photos) return null;
    tail.reverse();
    const suggestionId = `auto-group-${tail.map(item => item.id).join("-")}`;
    const existing = data.evidence_set_suggestions.find(item => item.suggestion_id === suggestionId);
    if (existing) return existing;
    return addSuggestion(data, { suggestion_id: suggestionId, set_type: "Other", suggested_label: "Possible same subject", photo_ids: tail.map(item => item.id), suggested_photo_roles: tail.map((item, index) => ({ photo_id: item.id, photo_number: item.photo_number || null, role: index === 0 ? "Context" : "Detail" })), basis: `Taken within ${settings.max_seconds} seconds and ${settings.max_distance_m} meters with matching subject/category or scene signature.` });
  }

  function detectSubjectChange(inspection, options) {
    const data = ensureEvidenceSetModel(inspection);
    const settings = Object.assign({ max_seconds: 180, max_distance_m: 40 }, options || {});
    const photos = (data.photos || []).slice().sort((a, b) => String(a.recorded_at || a.time || "").localeCompare(String(b.recorded_at || b.time || "")));
    if (photos.length < 2) return null;
    const previous = photos[photos.length - 2], current = photos[photos.length - 1];
    const previousSubject = String(previous.photo_meaning && previous.photo_meaning.subject || previous.category || "");
    const currentSubject = String(current.photo_meaning && current.photo_meaning.subject || current.category || "");
    const seconds = Math.abs(new Date(current.recorded_at || current.time) - new Date(previous.recorded_at || previous.time)) / 1000;
    const distance = haversineMeters(previous, current);
    const sceneChanged = previous.scene_signature && current.scene_signature && previous.scene_signature !== current.scene_signature;
    if (seconds <= settings.max_seconds && (distance == null || distance <= settings.max_distance_m) && previousSubject && currentSubject && (previousSubject !== currentSubject || sceneChanged)) return { previous_photo_id: previous.id, current_photo_id: current.id, previous_subject: previousSubject, current_subject: currentSubject, time_delta_seconds: seconds, distance_m: distance, prompt: "Are you starting a new subject?", activation_rule: "Inspector confirmation required." };
    return null;
  }

  function confirmSuggestion(inspection, suggestionId, createdBy, confirmation) {
    const data = ensureEvidenceSetModel(inspection);
    const suggestion = data.evidence_set_suggestions.find(item => item.suggestion_id === suggestionId);
    if (!suggestion) throw new Error("The grouping suggestion was not found.");
    if (suggestion.status === "confirmed") return effectiveEvidenceSet(data, suggestion.evidence_set_id);
    const measurementRequest = suggestion.suggested_measurement || null;
    const exactValue = measurementRequest ? Number(confirmation && confirmation.exact_value) : null;
    if (measurementRequest && (!Number.isFinite(exactValue) || exactValue <= 0)) throw new Error("Enter the inspector-confirmed exact measurement before activating this water group.");
    const previousActive = data.active_evidence_set_id;
    data.active_evidence_set_id = null;
    const confirmedDetails = Object.assign({}, clone(suggestion.suggested_subject_details || {}), measurementRequest ? { inspector_confirmed_depth_in: exactValue, measurement_status: "inspector_confirmed" } : {});
    const set = startEvidenceSet(data, { set_type: suggestion.set_type, label: suggestion.suggested_label, created_by: createdBy, relationship_basis: `confirmed_suggestion:${suggestionId}`, inspector_confirmed: true, subject_details: confirmedDetails });
    [...(suggestion.suggested_photo_roles || []), ...(suggestion.suggested_context_photo_roles || [])].forEach(item => attachRecord(data, set.evidence_set_id, "photo", item.photo_id, { photo_role: item.role, photo_roles: item.roles || [item.role], created_by: createdBy, relationship_basis: `confirmed_suggestion:${suggestionId}` }));
    if (measurementRequest) {
      data.measurements = Array.isArray(data.measurements) ? data.measurements : [];
      const measurementPhoto = (suggestion.suggested_photo_roles || []).find(item => item.photo_number === measurementRequest.measurement_photo_number) || (suggestion.suggested_photo_roles || []).find(item => item.role === "Measurement");
      const measurement = {
        schema_name: "property-intelligence-structured-measurement", schema_version: "1.0",
        measurement_id: `measurement:${suggestionId}`,
        inspection_id: data.inspection_id || null, property_id: data.property_id || null,
        measurement_type: measurementRequest.measurement_type, authoritative_value: exactValue, unit: measurementRequest.unit,
        basis: "Measured", reached_true_endpoint: confirmation && confirmation.reached_true_endpoint || "Unknown",
        approximately_vertical_or_level: confirmation && confirmation.approximately_aligned || "Unknown",
        instrument: confirmation && confirmation.instrument || "Visible measuring device; instrument not specified",
        photo_id: measurementPhoto && measurementPhoto.photo_id || null, evidence_set_id: set.evidence_set_id, subject_id: set.evidence_set_id,
        voice_note_ids: [], recorded_at: new Date().toISOString(), recorded_by: createdBy || data.inspector_identity || "Field Inspector",
        water_context: { bottom_type: confirmation && confirmation.water_bottom_type || "Unknown", water_feature_type: "Isolated puddle", approximate_surface_length: Number(confirmation && confirmation.surface_length) || null, approximate_surface_width: Number(confirmation && confirmation.surface_width) || null, surface_unit: "ft" },
        authority_rule: "The inspector-confirmed numeric value is the authoritative field measurement. The photograph is supporting evidence and must not be re-read as the sole source of the number.",
        photograph_role: "supporting measurement evidence", inspector_confirmed: true, source_suggestion_id: suggestionId
      };
      data.measurements.push(measurement);
      attachRecord(data, set.evidence_set_id, "measurement", measurement.measurement_id, { created_by: createdBy, relationship_basis: `confirmed_suggestion:${suggestionId}` });
      const sourcePhoto = (data.photos || []).find(item => String(item.id) === String(measurement.photo_id));
      if (sourcePhoto) {
        sourcePhoto.water_confirmation = "yes";
        sourcePhoto.water = Object.assign({}, sourcePhoto.water || {}, { water_type: "standing", water_behavior: "isolated_depression", water_depth_exact_in: exactValue, water_depth_band: "exact", measurement_basis: "Measured", structured_measurement_id: measurement.measurement_id });
      }
    }
    finishEvidenceSet(data, set.evidence_set_id, Object.assign({ source_suggestion_id: suggestionId }, confirmedDetails));
    suggestion.status = "confirmed";
    suggestion.confirmed_at = new Date().toISOString();
    suggestion.confirmed_by = createdBy || data.inspector_identity || "Field Inspector";
    suggestion.evidence_set_id = set.evidence_set_id;
    data.active_evidence_set_id = previousActive;
    return effectiveEvidenceSet(data, set.evidence_set_id);
  }

  return {
    SET_TYPES, PHOTO_ROLES, REQUIRED_ROLES, TREE_VISIBILITY, SPECIES_DETERMINATIONS, FALLEN_LEAF_CONFIDENCE, FLOWING_WATER_SET_TYPE, FLOWING_WATER_REPORT_LIMIT,
    ensureEvidenceSetModel, startEvidenceSet, attachRecord, setPhotoRole, detachRecord, finishEvidenceSet,
    effectiveEvidenceSet, buildEffectiveEvidenceSets, summarizeEvidenceSet, createEvidenceSetSummaries,
    treeEvidencePlan, flowingWaterEvidencePlan, addAiSpeciesSuggestion, recordSpeciesDetermination, recordLeafProvenance,
    suggestRecentGroup, detectSubjectChange, addPearsonSuggestions, confirmSuggestion, haversineMeters, maxSeparation
  };
});
