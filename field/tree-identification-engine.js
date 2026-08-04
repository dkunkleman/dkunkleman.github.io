(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TreeIdentificationEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = "1.0";
  const SESSION_STATUSES = Object.freeze(["STARTED", "MINIMUM_EVIDENCE_CAPTURED", "AWAITING_ADDITIONAL_EVIDENCE", "READY_FOR_ANALYSIS", "ANALYSIS_QUEUED_OFFLINE", "ANALYZED", "NEEDS_REVIEW", "EXPERT_REVIEW_REQUESTED", "EXPERT_VERIFIED", "UNRESOLVED"]);
  const IDENTIFICATION_STATUSES = Object.freeze(["UNRESOLVED", "FAMILY_PROBABLE", "GENUS_PROBABLE", "SPECIES_CANDIDATE", "SPECIES_PROBABLE", "SPECIES_HIGH_CONFIDENCE_PROVISIONAL", "EXPERT_VERIFIED", "IDENTIFICATION_REJECTED", "IDENTIFICATION_SUPERSEDED"]);
  const RECORD_TYPES = Object.freeze(["Representative tree", "Specimen or notable tree", "Timber sample tree", "Access obstruction", "Possible hazard", "Dead tree", "Preserve candidate", "Unknown"]);
  const PHOTO_ROLES = Object.freeze(["Whole tree", "Crown", "Trunk from base upward", "Bark at breast height", "Bark close-up", "Lower-trunk bark", "Upper-trunk bark", "Tree base and root flare", "Leaf upper surface", "Leaf lower surface", "Leaf edge", "Leaf attached to twig", "Needle bundle", "Scale foliage", "Twig tip", "Terminal bud", "Axillary bud", "Leaf scar", "Flower", "Fruit", "Seed", "Acorn", "Acorn cap", "Cone side", "Cone base", "Thorn", "Sap or resin observed naturally", "Visible defect", "DBH measurement", "Habitat overview", "Associated vegetation", "Tree identifier", "Other diagnostic feature"]);
  const ASSOCIATION_STATUSES = Object.freeze(["ATTACHED_TO_TARGET_TREE", "REACHABLE_BRANCH_OF_TARGET_TREE", "NATURALLY_FALLEN_DIRECTLY_BENEATH_TARGET", "FOUND_IN_MIXED_GROUND_MATERIAL", "ASSOCIATION_UNCERTAIN"]);
  const UNAVAILABLE_REASONS = Object.freeze(["Too high", "No leaves present", "Unsafe", "Dense vegetation", "Poor lighting", "Feature absent", "Tree dead", "Equipment unavailable", "Other", "Unknown"]);
  const PROVIDER_ADAPTERS = Object.freeze({
    plantnet: { adapter_id: "plantnet", label: "Pl@ntNet", endpoint_contract: "documented single-species identification endpoint through a configured secure proxy", maximum_images: 5, organs: ["leaf", "flower", "fruit", "bark", "auto"], credential_location: "server_side_only", works_without_credentials: true }
  });
  const REGIONAL_SOURCES = Object.freeze([
    { source_id: "USDA_PLANTS", label: "USDA PLANTS", geographic_scope: "United States distribution", limitation: "Distribution is supporting evidence, not an absolute county-level exclusion." },
    { source_id: "UF_IFAS", label: "UF/IFAS tree-identification resources", geographic_scope: "Florida", limitation: "A regional resource does not establish the identity of this individual tree." },
    { source_id: "FNAI", label: "Florida Natural Areas Inventory", geographic_scope: "Florida natural communities", limitation: "Natural-community context is a hypothesis until supported by site evidence." },
    { source_id: "FL_PROTECTED_PLANTS", label: "Florida protected-plant records", geographic_scope: "Florida", limitation: "A provisional image identification does not establish regulatory status." }
  ]);

  function list(value) { return Array.isArray(value) ? value : []; }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function now(value) { return value || new Date().toISOString(); }
  function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function finite(value) { const result = Number(value); return Number.isFinite(result) ? result : null; }
  function ensureModel(inspection) {
    const data = inspection || {};
    data.tree_identification_sessions = list(data.tree_identification_sessions);
    data.tree_identification_events = list(data.tree_identification_events);
    data.tree_provider_queue = list(data.tree_provider_queue);
    data.tree_expert_verifications = list(data.tree_expert_verifications);
    data.tree_regulatory_flags = list(data.tree_regulatory_flags);
    data.tree_legacy_relationship_reviews = list(data.tree_legacy_relationship_reviews);
    data.tree_identifier_counter = Number.isFinite(Number(data.tree_identifier_counter)) ? Number(data.tree_identifier_counter) : data.tree_identification_sessions.length;
    data.tree_identification_legacy_status = data.tree_identification_legacy_status || {
      status: "LEGACY_TREE_OBSERVATION", structured_status: "STRUCTURED_ID_EVIDENCE_NOT_COLLECTED", relationship_status: "DIRECT_TREE_MEDIA_LINKS_NOT_AVAILABLE_AT_CAPTURE", migration: "NON_DESTRUCTIVE_NO_RETROSPECTIVE_ATTRIBUTES"
    };
    return data;
  }
  function event(data, sessionId, type, details) { const record = Object.assign({ tree_identification_event_id: id("tree-event"), tree_identification_session_id: sessionId || null, event_type: type, recorded_at: now(), append_only: true }, copy(details || {})); data.tree_identification_events.push(record); return record; }
  function sessionById(inspection, sessionId) { return ensureModel(inspection).tree_identification_sessions.find(item => String(item.tree_identification_session_id) === String(sessionId)) || null; }
  function sessionForFeature(inspection, featureSessionId) { return ensureModel(inspection).tree_identification_sessions.find(item => String(item.feature_capture_session_id) === String(featureSessionId)) || null; }
  function nextTreeIdentifier(data) {
    const used = new Set(data.tree_identification_sessions.map(item => item.tree_identifier));
    let value;
    do { data.tree_identifier_counter += 1; value = `TREE-${String(data.tree_identifier_counter).padStart(3, "0")}`; } while (used.has(value));
    return value;
  }
  function createSession(inspection, input) {
    const data = ensureModel(inspection); const source = input || {};
    if (!source.feature_capture_session_id || !source.tree_observation_id || !source.phone_gps) throw new Error("Tree session requires its Feature Capture Session, tree observation, and current GPS.");
    const existing = sessionForFeature(data, source.feature_capture_session_id); if (existing) return existing;
    const treeIdentifier = nextTreeIdentifier(data);
    const session = {
      tree_identification_session_id: id("tree-identification"), feature_capture_session_id: source.feature_capture_session_id, property_id: data.property_id || null, inspection_id: data.inspection_id || null,
      tree_observation_id: source.tree_observation_id, tree_identifier: treeIdentifier, tree_id: source.tree_id || `tree:${data.property_id || "property"}:${treeIdentifier}`,
      session_status: "STARTED", started_at: now(source.started_at), completed_at: null, phone_gps: copy(source.phone_gps), gps_accuracy: finite(source.gps_accuracy != null ? source.gps_accuracy : source.phone_gps.accuracy_m),
      tree_geometry_basis: source.tree_geometry_basis || "phone_location_only", tree_target_coordinate: source.tree_target_coordinate || null,
      tree_record_type: RECORD_TYPES.includes(source.tree_record_type) ? source.tree_record_type : "Unknown", habitat_context: copy(source.habitat_context || {}), active_value_lens_at_start: copy(source.active_value_lens || {}),
      direct_media_relationships: [], field_traits: {}, measurements: [], unavailable_evidence: [], image_quality_results: [], provider_results: [], regional_candidates: [], combined_candidates: [], adaptive_requests: [],
      identification_status: "UNRESOLVED", provisional_identification: null, supporting_evidence: [], contradicting_evidence: [], remaining_uncertainty: ["Species identity has not been established."], expert_verifications: [], later_corrections: [],
      analysis_status: "NOT_REQUESTED", provider_upload_consent: null, scale_card: { optional: true, calibration_limitation: "The field card supports scale and exposure comparison; it is not laboratory-grade color calibration." },
      crash_recovery: { durable_local_state: true, last_saved_at: now(source.started_at), current_prompt: "record_type" }, schema_version: SCHEMA_VERSION
    };
    data.tree_identification_sessions.push(session); event(data, session.tree_identification_session_id, "TREE_IDENTIFICATION_SESSION_STARTED", { tree_identifier: treeIdentifier, feature_capture_session_id: source.feature_capture_session_id, tree_observation_id: source.tree_observation_id }); return session;
  }
  function applyDraft(inspection, sessionId, changes) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = changes || {};
    if (source.tree_record_type != null) session.tree_record_type = RECORD_TYPES.includes(source.tree_record_type) ? source.tree_record_type : "Unknown";
    if (source.habitat_context) session.habitat_context = Object.assign({}, session.habitat_context, copy(source.habitat_context));
    if (source.field_traits) session.field_traits = Object.assign({}, session.field_traits, copy(source.field_traits));
    if (source.identification_status && IDENTIFICATION_STATUSES.includes(source.identification_status)) session.identification_status = source.identification_status;
    if (source.current_prompt != null) session.crash_recovery.current_prompt = source.current_prompt;
    session.crash_recovery.last_saved_at = now(); event(data, sessionId, "TREE_DRAFT_SAVED", { changed_fields: Object.keys(source) }); return session;
  }
  function markEvidenceUnavailable(inspection, sessionId, role, reason, note) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found.");
    const unavailable = { unavailable_evidence_id: id("tree-unavailable"), media_role: role, reason: UNAVAILABLE_REASONS.includes(reason) ? reason : "Other", note: note || null, recorded_at: now(), stop_repeating_prompt: true };
    session.unavailable_evidence.push(unavailable); session.crash_recovery.last_saved_at = unavailable.recorded_at; event(data, sessionId, "TREE_EVIDENCE_UNAVAILABLE", unavailable); return unavailable;
  }
  function normalizeCircumference(value, unit) {
    const amount = finite(value); if (!(amount > 0)) throw new Error("Enter a positive circumference value.");
    const factors = { in: 1, inch: 1, inches: 1, ft: 12, feet: 12, cm: 1 / 2.54, m: 100 / 2.54 }; const factor = factors[String(unit || "").toLowerCase()];
    if (!factor) throw new Error("A supported circumference unit is required."); return { amount, inches: amount * factor, unit };
  }
  function recordCircumference(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    const normalized = normalizeCircumference(source.original_circumference_value, source.original_circumference_unit);
    if (!source.circumference_tool) throw new Error("The circumference measurement tool is required.");
    if (!source.measurement_classification) throw new Error("Classify the circumference as measured or estimated.");
    const height = finite(source.measurement_height == null ? 54 : source.measurement_height); const heightUnit = source.measurement_height_unit || "in";
    if (source.measurement_height_basis === "NONSTANDARD_EXPLAINED" && (!source.nonstandard_height_reason || height == null)) throw new Error("A nonstandard tree measurement requires the actual height and reason.");
    const exactDiameterOriginalUnit = normalized.amount / Math.PI; const exactRadiusOriginalUnit = normalized.amount / (2 * Math.PI);
    const stemId = source.stem_id || `STEM-${session.measurements.filter(item => item.measurement_type === "TREE_CIRCUMFERENCE").length + 1}`;
    const measurement = {
      tree_measurement_id: id("tree-measurement"), tree_identification_session_id: sessionId, tree_identifier: session.tree_identifier, stem_id: stemId, measurement_type: "TREE_CIRCUMFERENCE",
      original_circumference_value: normalized.amount, original_circumference_unit: source.original_circumference_unit, circumference_tool: source.circumference_tool,
      measurement_height: height, measurement_height_unit: heightUnit, measurement_height_basis: source.measurement_height_basis || "UPHILL_SIDE", measurement_classification: source.measurement_classification,
      tape_check_status: source.tape_check_status || "Not checked", measurement_photo_ids: list(source.measurement_photo_ids), measurement_notes: source.measurement_notes || null,
      fork_below_measurement_height: source.fork_below_measurement_height || "Unsure", nonstandard_height_reason: source.nonstandard_height_reason || null,
      calculation: { formula_diameter: "calculated_dbh = original_circumference / pi", formula_radius: "calculated_radius = original_circumference / (2 * pi)", exact_calculated_dbh_original_unit: exactDiameterOriginalUnit, exact_calculated_radius_original_unit: exactRadiusOriginalUnit, exact_calculated_dbh_in: normalized.inches / Math.PI, exact_calculated_radius_in: normalized.inches / (2 * Math.PI), display_dbh_original_unit: Math.round(exactDiameterOriginalUnit * 100) / 100, display_radius_original_unit: Math.round(exactRadiusOriginalUnit * 100) / 100, calculated_at: now(), schema_version: SCHEMA_VERSION, classification: "CALCULATED_FROM_CIRCUMFERENCE_NOT_DIRECTLY_MEASURED" },
      recorded_at: now(source.recorded_at), correction_status: "ACTIVE", limitations: [source.measurement_classification === "Estimated" ? "Circumference was estimated; calculated diameter and radius remain estimates." : "Calculated diameter and radius derive from the preserved circumference and are not directly measured."], schema_version: SCHEMA_VERSION
    };
    session.measurements.push(measurement); session.crash_recovery.last_saved_at = measurement.recorded_at; event(data, sessionId, "TREE_CIRCUMFERENCE_RECORDED", { tree_measurement_id: measurement.tree_measurement_id, stem_id: stemId }); return measurement;
  }
  function recordDirectDiameter(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    const value = finite(source.original_diameter_value); if (!(value > 0) || !source.original_diameter_unit) throw new Error("Direct diameter requires a positive value and unit.");
    if (!source.measurement_method || !source.measurement_classification) throw new Error("Direct diameter requires its method and measured/estimated classification.");
    const measurement = { tree_measurement_id: id("tree-measurement"), tree_identification_session_id: sessionId, tree_identifier: session.tree_identifier, stem_id: source.stem_id || `STEM-${session.measurements.length + 1}`, measurement_type: "TREE_DIAMETER", original_diameter_value: value, original_diameter_unit: source.original_diameter_unit, measurement_method: source.measurement_method, measurement_height: finite(source.measurement_height == null ? 54 : source.measurement_height), measurement_height_unit: source.measurement_height_unit || "in", measurement_height_basis: source.measurement_height_basis || "UPHILL_SIDE", measurement_classification: source.measurement_classification, fork_below_measurement_height: source.fork_below_measurement_height || "Unsure", nonstandard_height_reason: source.nonstandard_height_reason || null, measurement_photo_ids: list(source.measurement_photo_ids), measurement_notes: source.measurement_notes || null, directly_measured_diameter: source.measurement_classification === "Measured", recorded_at: now(), schema_version: SCHEMA_VERSION };
    if (measurement.measurement_height_basis === "NONSTANDARD_EXPLAINED" && !measurement.nonstandard_height_reason) throw new Error("A nonstandard measurement height requires a reason.");
    session.measurements.push(measurement); event(data, sessionId, "TREE_DIRECT_DIAMETER_RECORDED", { tree_measurement_id: measurement.tree_measurement_id }); return measurement;
  }
  function attachDirectMedia(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    if (!source.media_id || !source.original_file_hash) throw new Error("Direct tree media requires the media ID and original file hash.");
    if (session.direct_media_relationships.some(item => String(item.media_id) === String(source.media_id))) return session.direct_media_relationships.find(item => String(item.media_id) === String(source.media_id));
    const association = ASSOCIATION_STATUSES.includes(source.material_association) ? source.material_association : "ASSOCIATION_UNCERTAIN";
    const relationship = { relationship_type: "DIRECT", tree_identification_session_id: sessionId, tree_observation_id: session.tree_observation_id, tree_identifier: session.tree_identifier, media_id: source.media_id, media_type: source.media_type || "photograph", media_role: PHOTO_ROLES.includes(source.media_role) ? source.media_role : "Other diagnostic feature", captured_at: now(source.captured_at), original_file_hash: source.original_file_hash, source_relationship_status: "DIRECT_AT_CAPTURE", material_association: association, association_proves_target_material: !["FOUND_IN_MIXED_GROUND_MATERIAL", "ASSOCIATION_UNCERTAIN"].includes(association), annotated_derivative_id: source.annotated_derivative_id || null };
    session.direct_media_relationships.push(relationship); session.crash_recovery.last_saved_at = relationship.captured_at; event(data, sessionId, "TREE_DIRECT_MEDIA_ATTACHED", { media_id: source.media_id, media_role: relationship.media_role, material_association: association }); return relationship;
  }
  function recordImageQuality(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    const result = { image_quality_result_id: id("tree-image-quality"), media_id: source.media_id, checks: copy(source.checks || {}), retake_recommended: Boolean(source.retake_recommended), prompt: source.prompt || null, inspector_disposition: source.inspector_disposition || "PENDING", limitation: source.limitation || null, checked_at: now(), local_check_only: true };
    session.image_quality_results.push(result); event(data, sessionId, "TREE_IMAGE_QUALITY_CHECKED", result); return result;
  }
  function minimumEvidence(inspection, sessionId) {
    const session = sessionById(inspection, sessionId); if (!session) return null; const roles = new Set(session.direct_media_relationships.map(item => item.media_role)); const unavailable = new Set(session.unavailable_evidence.map(item => item.media_role));
    const groups = [{ key: "whole_tree_crown", roles: ["Whole tree", "Crown"], label: "Whole tree and crown" }, { key: "bark", roles: ["Bark at breast height", "Bark close-up", "Lower-trunk bark"], label: "Bark" }, { key: "foliage", roles: ["Leaf attached to twig", "Needle bundle", "Scale foliage"], label: "Attached foliage" }];
    const status = groups.map(group => ({ key: group.key, label: group.label, captured: group.roles.some(role => roles.has(role)), unavailable_with_reason: group.roles.some(role => unavailable.has(role)), roles: group.roles }));
    return { status, sufficient_for_honest_minimum: status.every(item => item.captured || item.unavailable_with_reason), missing: status.filter(item => !item.captured && !item.unavailable_with_reason).map(item => item.label) };
  }
  function saveMinimum(inspection, sessionId) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const minimum = minimumEvidence(data, sessionId);
    if (!RECORD_TYPES.includes(session.tree_record_type)) throw new Error("Choose why this tree is being recorded.");
    session.session_status = minimum.sufficient_for_honest_minimum ? "MINIMUM_EVIDENCE_CAPTURED" : "AWAITING_ADDITIONAL_EVIDENCE"; session.remaining_uncertainty = minimum.missing.map(item => `${item} evidence is missing without a recorded reason.`); session.crash_recovery.last_saved_at = now(); event(data, sessionId, "TREE_MINIMUM_SAVED", { sufficient: minimum.sufficient_for_honest_minimum, missing: minimum.missing }); return minimum;
  }
  function completeSession(inspection, sessionId, options) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const minimum = saveMinimum(data, sessionId); const settings = options || {};
    session.session_status = settings.end_unresolved ? "UNRESOLVED" : (minimum.sufficient_for_honest_minimum ? "READY_FOR_ANALYSIS" : "NEEDS_REVIEW"); session.completed_at = now(); session.crash_recovery.current_prompt = null; event(data, sessionId, "TREE_SESSION_COMPLETED", { session_status: session.session_status }); return session;
  }
  function queueProviderAnalysis(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {}; const adapter = PROVIDER_ADAPTERS[source.adapter_id || "plantnet"]; if (!adapter) throw new Error("Configured tree provider adapter is not supported.");
    const selected = list(source.selected_images).slice(0, adapter.maximum_images); const allowedIds = new Set(session.direct_media_relationships.filter(item => item.media_type === "photograph").map(item => String(item.media_id)));
    if (!selected.length || selected.some(item => !allowedIds.has(String(item.media_id)))) throw new Error("Every provider image must be directly attached to this one tree session.");
    const existing = data.tree_provider_queue.find(item => item.tree_identification_session_id === sessionId && item.adapter_id === adapter.adapter_id && item.request_fingerprint === selected.map(item => item.media_id).sort().join("|")); if (existing) return existing;
    const queued = { provider_queue_id: id("tree-provider-queue"), tree_identification_session_id: sessionId, adapter_id: adapter.adapter_id, proxy_url: source.proxy_url || null, selected_images: selected.map(item => ({ media_id: item.media_id, organ: adapter.organs.includes(item.organ) ? item.organ : "auto" })), request_fingerprint: selected.map(item => item.media_id).sort().join("|"), status: source.online && source.consent === true && source.proxy_url ? "READY_FOR_SECURE_PROXY" : "ANALYSIS_PENDING_CONNECTION", consent_status: source.consent === true ? "EXPLICIT_CONSENT" : "NOT_GRANTED", retry_count: 0, maximum_retries: 3, next_retry_at: null, created_at: now(), credential_rule: "No provider credential is stored in client JavaScript, the repository, or the package.", schema_version: SCHEMA_VERSION };
    data.tree_provider_queue.push(queued); session.analysis_status = queued.status; session.session_status = "ANALYSIS_QUEUED_OFFLINE"; event(data, sessionId, "TREE_PROVIDER_ANALYSIS_QUEUED", { provider_queue_id: queued.provider_queue_id, status: queued.status }); return queued;
  }
  function recordProviderResult(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    const result = { tree_provider_result_id: id("tree-provider-result"), adapter_id: source.adapter_id, provider_name: source.provider_name || source.adapter_id, provider_model_version: source.provider_model_version || "NOT_RETURNED", request_time: source.request_time || now(), response_time: now(source.response_time), selected_input_image_ids: list(source.selected_input_image_ids), organ_labels: copy(source.organ_labels || {}), complete_candidate_list: copy(source.complete_candidate_list || []), family_results: copy(source.family_results || []), genus_results: copy(source.genus_results || []), related_reference_images: copy(source.related_reference_images || []), provider_errors: copy(source.provider_errors || []), limitations: copy(source.limitations || []), provider_scores_are_not_platform_confidence: true, provenance_complete: true };
    session.provider_results.push(result); session.analysis_status = "PROVIDER_RESULT_RECEIVED"; session.session_status = "ANALYZED"; event(data, sessionId, "TREE_PROVIDER_RESULT_APPENDED", { tree_provider_result_id: result.tree_provider_result_id }); return result;
  }
  function addRegionalCandidates(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    const record = { regional_candidate_record_id: id("tree-regional"), candidates: copy(source.candidates || []), sources: copy(source.sources || REGIONAL_SOURCES), county: source.county || null, state: source.state || null, season: source.season || null, retrieved_at: now(source.retrieved_at), taxonomy_version: source.taxonomy_version || "source-reported", rule: "Regional distribution is evidence, not an absolute exclusion.", limitations: list(source.limitations) };
    session.regional_candidates.push(record); event(data, sessionId, "TREE_REGIONAL_CANDIDATES_APPENDED", { regional_candidate_record_id: record.regional_candidate_record_id }); return record;
  }
  function synthesizeCandidates(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    const candidates = list(source.candidates).map(candidate => ({ common_name: candidate.common_name || "Unknown", scientific_name: candidate.scientific_name || "Unknown", identification_status: IDENTIFICATION_STATUSES.includes(candidate.identification_status) && candidate.identification_status !== "EXPERT_VERIFIED" ? candidate.identification_status : "SPECIES_CANDIDATE", image_provider_assessment: candidate.image_provider_assessment || null, multimodal_trait_assessment: candidate.multimodal_trait_assessment || null, regional_plausibility: candidate.regional_plausibility || "unknown", habitat_consistency: candidate.habitat_consistency || "unknown", season_consistency: candidate.season_consistency || "unknown", measurement_consistency: candidate.measurement_consistency || "unknown", supporting_evidence: list(candidate.supporting_evidence), contradicting_evidence: list(candidate.contradicting_evidence), missing_discriminating_traits: list(candidate.missing_discriminating_traits), image_quality: candidate.image_quality || "unknown", material_association_confidence: candidate.material_association_confidence || "unknown", confidence_explanation: candidate.confidence_explanation || "No scientific-precision score is asserted.", cheapest_next_identification_step: candidate.cheapest_next_identification_step || "Collect the highest-value missing diagnostic trait.", professional_verification_recommended: candidate.professional_verification_recommended !== false, source_taxonomy: candidate.source_taxonomy || "source-reported", analysis_date: now(source.analysis_date), platform_confidence_is_separate_from_provider_score: true }));
    session.combined_candidates.push({ combined_candidate_assessment_id: id("tree-combined"), candidates, created_at: now(), components_kept_separate: true });
    if (candidates[0]) { session.provisional_identification = copy(candidates[0]); session.identification_status = candidates[0].identification_status; session.supporting_evidence = list(candidates[0].supporting_evidence); session.contradicting_evidence = list(candidates[0].contradicting_evidence); session.remaining_uncertainty = list(candidates[0].missing_discriminating_traits); }
    event(data, sessionId, "TREE_CANDIDATE_SYNTHESIS_APPENDED", { candidate_count: candidates.length }); return candidates;
  }
  function createAdaptiveRequests(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {}; const compared = list(source.candidate_species_compared);
    const unavailable = new Set(session.unavailable_evidence.map(item => item.media_role)); const captured = new Set(session.direct_media_relationships.map(item => item.media_role));
    const priorities = list(source.priorities).length ? source.priorities : [
      { requested_trait: "attached foliage", role: "Leaf attached to twig", instruction: "Photograph one leaf or needle group while it is visibly attached to the target tree.", reason: "Attached foliage usually distinguishes leading broadleaf or conifer candidates." },
      { requested_trait: "leaf underside", role: "Leaf lower surface", instruction: "Turn one attached or traceable leaf over and photograph its underside.", reason: "Hair, color and vein detail on the underside can separate similar candidates." },
      { requested_trait: "terminal bud", role: "Terminal bud", instruction: "Photograph the twig tip and terminal bud in focus.", reason: "Bud form can distinguish otherwise similar trees." },
      { requested_trait: "reproductive material", role: "Fruit", instruction: "Photograph an acorn, cone, fruit, flower or seed with its attachment when available.", reason: "Reproductive structures often provide the highest information gain." }
    ];
    const selected = priorities.filter(item => !captured.has(item.role) && !unavailable.has(item.role)).slice(0, 2).map((item, index) => ({ adaptive_request_id: id("tree-adaptive"), tree_identification_session_id: sessionId, candidate_species_compared: compared, requested_trait: item.requested_trait, plain_language_instruction: item.instruction, reason_requested: item.reason, expected_information_gain: index === 0 ? "highest available" : "second-highest available", created_at: now(), status: "OPEN", response_evidence_ids: [], resolved_at: null }));
    selected.forEach(request => session.adaptive_requests.push(request)); if (selected.length) session.session_status = "AWAITING_ADDITIONAL_EVIDENCE"; event(data, sessionId, "TREE_ADAPTIVE_REQUESTS_CREATED", { adaptive_request_ids: selected.map(item => item.adaptive_request_id) }); return selected;
  }
  function resolveAdaptiveRequest(inspection, sessionId, requestId, status, evidenceIds) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); const request = session && session.adaptive_requests.find(item => item.adaptive_request_id === requestId); if (!request) throw new Error("Adaptive Evidence Request was not found.");
    request.status = status; request.response_evidence_ids = list(evidenceIds); request.resolved_at = now(); event(data, sessionId, "TREE_ADAPTIVE_REQUEST_RESOLVED", { adaptive_request_id: requestId, status }); return request;
  }
  function appendExpertVerification(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    if (!source.reviewer_name || !source.qualification || !source.determination) throw new Error("Expert verification requires reviewer, qualification, and determination.");
    const verification = { tree_expert_verification_id: id("tree-expert"), tree_identification_session_id: sessionId, reviewer_name: source.reviewer_name, qualification: source.qualification, organization: source.organization || null, review_date: source.review_date || now(), determination: source.determination, confidence: source.confidence || "not stated", evidence_reviewed: list(source.evidence_reviewed), additional_evidence_requested: list(source.additional_evidence_requested), corrected_taxonomy: source.corrected_taxonomy || null, supporting_document: source.supporting_document || null, append_only: true };
    data.tree_expert_verifications.push(verification); session.expert_verifications.push(verification.tree_expert_verification_id); session.identification_status = "EXPERT_VERIFIED"; session.session_status = "EXPERT_VERIFIED"; event(data, sessionId, "TREE_EXPERT_VERIFICATION_APPENDED", { tree_expert_verification_id: verification.tree_expert_verification_id }); return verification;
  }
  function addRegulatoryFlag(inspection, sessionId, input) {
    const data = ensureModel(inspection); const session = sessionById(data, sessionId); if (!session) throw new Error("Tree Identification Session was not found."); const source = input || {};
    const flag = { tree_regulatory_flag_id: id("tree-regulatory"), tree_identification_session_id: sessionId, candidate_name: source.candidate_name || "Unknown candidate", jurisdiction: source.jurisdiction || "Federal or Florida", source: source.source || "Source not supplied", source_date: source.source_date || null, source_url: source.source_url || null, status: "PROVISIONAL_WARNING", warning: "Do not cut, collect, disturb or remove based on a provisional image identification. Obtain professional or agency verification first.", legal_status_established: false, created_at: now() };
    data.tree_regulatory_flags.push(flag); event(data, sessionId, "TREE_REGULATORY_WARNING_APPENDED", { tree_regulatory_flag_id: flag.tree_regulatory_flag_id }); return flag;
  }
  function createLegacyRelationshipSuggestions(inspection, options) {
    const data = ensureModel(inspection); const settings = options || {}; const timeWindowMs = Number(settings.time_window_ms) || 120000; const distanceLimitM = Number(settings.distance_limit_m) || 20; const photos = list(data.photos); const trees = list(data.markers).filter(item => ["tree", "timber"].includes(item.type));
    function meters(a, b) { const y = (Number(b.lat) - Number(a.lat)) * 111320; const x = (Number(b.lon) - Number(a.lon)) * 111320 * Math.cos(Number(a.lat) * Math.PI / 180); return Math.sqrt(x * x + y * y); }
    const results = trees.map(tree => ({ legacy_tree_review_id: id("legacy-tree-review"), tree_observation_id: tree.id, status: "LEGACY_TREE_OBSERVATION", structured_status: "STRUCTURED_ID_EVIDENCE_NOT_COLLECTED", relationship_status: "DIRECT_TREE_MEDIA_LINKS_NOT_AVAILABLE_AT_CAPTURE", proposed_relationships: photos.map(photo => ({ media_id: photo.id, time_delta_ms: Math.abs(new Date(photo.recorded_at || photo.time) - new Date(tree.time)), distance_m: meters(tree, photo) })).filter(item => item.time_delta_ms <= timeWindowMs && item.distance_m <= distanceLimitM).map(item => Object.assign(item, { source_relationship_status: "LEGACY_PROXIMITY_SUGGESTION", activation_requires_manual_confirmation: true })), created_at: now(), original_tree_record_unchanged: true }));
    results.forEach(result => { if (!data.tree_legacy_relationship_reviews.some(item => item.tree_observation_id === result.tree_observation_id)) data.tree_legacy_relationship_reviews.push(result); }); return results;
  }
  function reviewLegacyRelationship(inspection, reviewId, mediaId, action) {
    const data = ensureModel(inspection); const review = data.tree_legacy_relationship_reviews.find(item => item.legacy_tree_review_id === reviewId); const relationship = review && review.proposed_relationships.find(item => String(item.media_id) === String(mediaId)); if (!relationship) throw new Error("Legacy relationship suggestion was not found.");
    relationship.source_relationship_status = action === "confirm" ? "MANUALLY_CONFIRMED_RELATIONSHIP" : (action === "reject" ? "REJECTED_RELATIONSHIP" : "UNRESOLVED_RELATIONSHIP"); relationship.reviewed_at = now(); relationship.inspector_action = true; return relationship;
  }
  function reportMarkdown(inspection) {
    const data = ensureModel(inspection); const lines = ["# Tree Identification Report", "", "AI-only identifications are provisional. Provider scores are not platform confidence. Expert findings append to rather than overwrite earlier analysis.", ""];
    data.tree_identification_sessions.forEach(session => { const leading = session.provisional_identification; lines.push(`## ${session.tree_identifier}`, "", `- Location basis: ${session.tree_geometry_basis}; phone accuracy ${session.gps_accuracy == null ? "unknown" : `${session.gps_accuracy} m`}`, `- Status: ${session.identification_status}`, `- Leading candidate: ${leading ? `${leading.common_name} (${leading.scientific_name})` : "Unresolved"}`, `- Direct diagnostic media: ${session.direct_media_relationships.length}`, `- Measurements: ${session.measurements.length}`, `- Remaining uncertainty: ${session.remaining_uncertainty.join("; ") || "None recorded"}`, `- Expert verification: ${session.expert_verifications.length ? "Appended" : "Not obtained"}`, ""); });
    return lines.join("\n") + "\n";
  }
  function packageModel(inspection) {
    const data = ensureModel(inspection); return { schema_name: "property-intelligence-tree-identification", schema_version: SCHEMA_VERSION, property_id: data.property_id || null, inspection_id: data.inspection_id || null, sessions: copy(data.tree_identification_sessions), direct_media: data.tree_identification_sessions.flatMap(item => copy(item.direct_media_relationships)), field_traits: data.tree_identification_sessions.map(item => ({ tree_identification_session_id: item.tree_identification_session_id, tree_identifier: item.tree_identifier, field_traits: copy(item.field_traits) })), measurements: data.tree_identification_sessions.flatMap(item => copy(item.measurements)), regional_candidates: data.tree_identification_sessions.flatMap(item => copy(item.regional_candidates)), provider_results: data.tree_identification_sessions.flatMap(item => copy(item.provider_results)), combined_candidates: data.tree_identification_sessions.flatMap(item => copy(item.combined_candidates)), adaptive_requests: data.tree_identification_sessions.flatMap(item => copy(item.adaptive_requests)), expert_verifications: copy(data.tree_expert_verifications), regulatory_flags: copy(data.tree_regulatory_flags), provider_queue: copy(data.tree_provider_queue), legacy_relationship_reviews: copy(data.tree_legacy_relationship_reviews), provider_adapters: copy(PROVIDER_ADAPTERS), regional_source_contracts: copy(REGIONAL_SOURCES), legacy_status: copy(data.tree_identification_legacy_status) };
  }

  return { SCHEMA_VERSION, SESSION_STATUSES, IDENTIFICATION_STATUSES, RECORD_TYPES, PHOTO_ROLES, ASSOCIATION_STATUSES, UNAVAILABLE_REASONS, PROVIDER_ADAPTERS, REGIONAL_SOURCES, ensureModel, createSession, sessionById, sessionForFeature, applyDraft, markEvidenceUnavailable, recordCircumference, recordDirectDiameter, attachDirectMedia, recordImageQuality, minimumEvidence, saveMinimum, completeSession, queueProviderAnalysis, recordProviderResult, addRegionalCandidates, synthesizeCandidates, createAdaptiveRequests, resolveAdaptiveRequest, appendExpertVerification, addRegulatoryFlag, createLegacyRelationshipSuggestions, reviewLegacyRelationship, reportMarkdown, packageModel };
});
