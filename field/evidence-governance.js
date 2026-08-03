(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EvidenceGovernance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CORRECTION_REASONS = [
    "Correct",
    "Accidental button press",
    "Wrong category",
    "Wrong inspection area",
    "Duplicate",
    "Needs clarification",
    "Withdrawn"
  ];
  const VOID_REASONS = new Set(["Accidental button press", "Duplicate", "Withdrawn"]);
  const PROFESSIONAL_AUDIENCES = ["builder", "civil/drainage engineer", "surveyor", "forester", "soil/septic professional", "buyer", "seller"];
  const PHOTO_EVIDENCE_ROLES = ["context", "evidence", "measurement", "relationship"];
  const PEARSON_ENTRANCE_TIME = "2026-08-03T13:04:01.864Z";
  const PEARSON_HYPOTHESIS_ID = "hypothesis-pearson-road-drainage-berm-20260803";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function idOf(record, recordType) {
    if (!record) return null;
    if (recordType === "photo") return record.id || record.photo_id || null;
    if (recordType === "voice_note") return record.id || record.voice_note_id || null;
    return record.id || record.observation_id || null;
  }

  function ensureGovernanceModel(inspection, now) {
    const data = inspection || {};
    data.corrections = Array.isArray(data.corrections) ? data.corrections : [];
    data.inspector_hypotheses = Array.isArray(data.inspector_hypotheses) ? data.inspector_hypotheses : [];
    data.inspector_identity = data.inspector_identity || "Field Inspector";
    const markers = Array.isArray(data.markers) ? data.markers : [];
    const pearsonEntrance = markers.find(item =>
      String(item.time || item.observed_at || "") === PEARSON_ENTRANCE_TIME &&
      String(item.type || item.observation_type || "").toLowerCase().includes("entrance")
    );
    if (pearsonEntrance && !data.corrections.some(item => item.correction_id === "correction-pearson-entrance-20260803")) {
      data.corrections.push({
        correction_id: "correction-pearson-entrance-20260803",
        target: { record_type: "observation", record_id: idOf(pearsonEntrance, "observation") },
        correction_time: now || new Date().toISOString(),
        correction_reason: "Accidental button press",
        corrected_value: null,
        inspector_identity: data.inspector_identity,
        resulting_status: "voided",
        original_entry: clone(pearsonEntrance),
        source: "inspector-directed Pearson Road correction",
        immutable: true
      });
    }
    const inspectionDate = String(data.started || (data.conditions && data.conditions.inspection_date) || "");
    if (inspectionDate.startsWith("2026-08-03") && markers.length && !data.inspector_hypotheses.some(item => item.hypothesis_id === PEARSON_HYPOTHESIS_ID)) {
      data.inspector_hypotheses.push({
        hypothesis_id: PEARSON_HYPOTHESIS_ID,
        recorded_at: now || new Date().toISOString(),
        statement: "If a drainage ditch were constructed along the road from the western property line toward the north/south Pearson ditch, and the existing berm were removed or modified, the large tract may drain substantially better.",
        evidence_classification: "Interpretation / Needs Professional Verification",
        factual_status: "NOT_AN_OBSERVED_FACT",
        triggering_observation_ids: markers.filter(item => {
          const text = `${item.type || ""} ${item.note || ""} ${item.button_label || ""}`.toLowerCase();
          return /water|wet|ditch|berm|road|blocked/.test(text);
        }).map(item => item.id).filter(Boolean),
        supporting_photo_ids: (data.photos || []).filter(item => {
          const number = Number(String(item.photo_number || "").replace(/\D/g, ""));
          return number >= 3 && number <= 11;
        }).map(item => item.id).filter(Boolean),
        contradicting_evidence_ids: [],
        verification_question: "What are the existing elevations, lawful outlet, downstream capacity, right-of-way constraints, permitting requirements, and potential effects on neighboring property if the road berm and roadside drainage path are modified?",
        professional_type: "civil/drainage engineer and surveyor",
        cheapest_next_evidence_step: "Obtain a boundary/topographic survey or targeted elevation shots and confirm the lawful outlet and right-of-way constraints before evaluating any drainage modification.",
        prohibition: "Do not recommend construction or state that this idea will work without professional verification.",
        immutable: true
      });
    }
    return data;
  }

  function recordsForCorrection(inspection) {
    const data = inspection || {};
    const rows = [];
    (data.markers || []).forEach(record => rows.push({
      record_type: "observation",
      record_id: record.id,
      recorded_at: record.time,
      label: `${record.button_label || record.type || "Observation"}${record.note ? ` — ${record.note}` : ""}`,
      original_entry: clone(record)
    }));
    (data.photos || []).forEach(record => rows.push({
      record_type: "photo",
      record_id: record.id,
      recorded_at: record.recorded_at || record.time,
      label: `${record.photo_number || "Photo"} — ${record.category || "Other"}`,
      original_entry: clone(record)
    }));
    (data.voice_notes || []).forEach(record => rows.push({
      record_type: "voice_note",
      record_id: record.id,
      recorded_at: record.started_at || record.recorded_at,
      label: `${record.purpose === "photo_explanation" ? "Photo explanation" : "Voice note"}${record.photo_id ? ` for ${record.photo_id}` : ""}`,
      original_entry: clone(record)
    }));
    return rows.filter(item => item.record_id).sort((a, b) => String(b.recorded_at || "").localeCompare(String(a.recorded_at || "")));
  }

  function addCorrection(inspection, request) {
    const data = ensureGovernanceModel(inspection);
    const settings = request || {};
    if (!CORRECTION_REASONS.includes(settings.correction_reason)) throw new Error("Choose a recognized correction reason.");
    const record = recordsForCorrection(data).find(item => item.record_type === settings.record_type && String(item.record_id) === String(settings.record_id));
    if (!record) throw new Error("The selected original record could not be found.");
    const correction = {
      correction_id: settings.correction_id || `correction-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      target: { record_type: record.record_type, record_id: record.record_id },
      correction_time: settings.correction_time || new Date().toISOString(),
      correction_reason: settings.correction_reason,
      corrected_value: settings.corrected_value ? clone(settings.corrected_value) : null,
      inspector_identity: String(settings.inspector_identity || data.inspector_identity || "Field Inspector").trim() || "Field Inspector",
      resulting_status: VOID_REASONS.has(settings.correction_reason) ? "voided" : (settings.correction_reason === "Correct" ? "active" : "corrected"),
      original_entry: record.original_entry,
      source: "field correction control",
      immutable: true
    };
    data.corrections.push(correction);
    data.inspector_identity = correction.inspector_identity;
    return correction;
  }

  function correctionsFor(inspection, recordType, recordId) {
    return (inspection.corrections || []).filter(item => item.target && item.target.record_type === recordType && String(item.target.record_id) === String(recordId)).sort((a, b) => String(a.correction_time || "").localeCompare(String(b.correction_time || "")));
  }

  function applyCorrectedValue(record, correction) {
    const result = clone(record);
    const value = correction && correction.corrected_value || {};
    if (value.category) result.category = value.category;
    if (value.type) {
      result.type = value.type;
      result.observation_type = `field.${value.type}`;
      result.button_label = value.label || value.type;
    }
    if (Object.prototype.hasOwnProperty.call(value, "area_id")) result.area_id = value.area_id || null;
    if (value.note) result.note = value.note;
    if (value.clarification) result.correction_clarification = value.clarification;
    return result;
  }

  function effectiveRecord(inspection, recordType, record) {
    const history = correctionsFor(inspection, recordType, idOf(record, recordType));
    let result = clone(record);
    let status = "active";
    history.forEach(correction => {
      status = correction.resulting_status || (VOID_REASONS.has(correction.correction_reason) ? "voided" : "corrected");
      if (status !== "voided") result = applyCorrectedValue(result, correction);
    });
    result.record_status = status;
    result.excluded_from_findings = status === "voided";
    result.correction_ids = history.map(item => item.correction_id);
    return result;
  }

  function recordStatus(inspection, recordType, recordId) {
    const history = correctionsFor(inspection || {}, recordType, recordId);
    return history.length ? history[history.length - 1].resulting_status : "active";
  }

  function buildEffectiveInspection(inspection) {
    const raw = ensureGovernanceModel(clone(inspection || {}));
    const allMarkers = (raw.markers || []).map(item => effectiveRecord(raw, "observation", item));
    const allPhotos = (raw.photos || []).map(item => effectiveRecord(raw, "photo", item));
    const allVoices = (raw.voice_notes || []).map(item => effectiveRecord(raw, "voice_note", item));
    const voidPhotoIds = new Set(allPhotos.filter(item => item.excluded_from_findings).map(item => String(item.id)));
    const voidVoiceIds = new Set(allVoices.filter(item => item.excluded_from_findings).map(item => String(item.id)));
    const activePhotoById = new Map(allPhotos.filter(item => !item.excluded_from_findings).map(item => [String(item.id), item]));
    const activeVoiceById = new Map(allVoices.filter(item => !item.excluded_from_findings).map(item => [String(item.id), item]));
    const markers = allMarkers.filter(item => !item.excluded_from_findings && !voidPhotoIds.has(String(item.photo_id || "")) && !voidVoiceIds.has(String(item.voice_note_id || ""))).map(item => {
      const linkedPhoto = activePhotoById.get(String(item.photo_id || ""));
      const linkedVoice = activeVoiceById.get(String(item.voice_note_id || ""));
      if (linkedPhoto) {
        item.area_id = linkedPhoto.area_id || item.area_id || null;
        item.attributes = Object.assign({}, item.attributes || {}, { category: linkedPhoto.category || null });
      }
      if (linkedVoice) item.area_id = linkedVoice.area_id || item.area_id || null;
      return item;
    });
    const active = Object.assign({}, raw, {
      markers,
      photos: allPhotos.filter(item => !item.excluded_from_findings),
      voice_notes: allVoices.filter(item => !item.excluded_from_findings)
    });
    return {
      active,
      all_records: { observations: allMarkers, photographs: allPhotos, voice_notes: allVoices },
      audit_history: {
        schema_name: "property-intelligence-evidence-audit",
        schema_version: "1.0",
        immutable_source_rule: "Original entries are never rewritten or deleted. Reports use the effective active view; voided records remain here.",
        corrections: clone(raw.corrections || []),
        source_record_counts: { observations: allMarkers.length, photographs: allPhotos.length, voice_notes: allVoices.length },
        voided_record_ids: [...allMarkers, ...allPhotos, ...allVoices].filter(item => item.excluded_from_findings).map(item => idOf(item, item.photo_number ? "photo" : (item.started_at ? "voice_note" : "observation")))
      }
    };
  }

  function photoPattern(photo) {
    const meaning = photo && photo.photo_meaning || {};
    const roles = Array.isArray(meaning.evidence_roles) ? meaning.evidence_roles : [];
    const present = PHOTO_EVIDENCE_ROLES.filter(role => roles.includes(role));
    return { present, missing: PHOTO_EVIDENCE_ROLES.filter(role => !present.includes(role)), complete: present.length === PHOTO_EVIDENCE_ROLES.length };
  }

  function createFieldEvidenceReview(inspection) {
    const data = inspection || {};
    const photos = data.photos || [];
    const hypotheses = data.inspector_hypotheses || [];
    const patterns = photos.map(photo => ({ photo_id: photo.id, photo_number: photo.photo_number, pattern: photoPattern(photo) }));
    const lowValueCandidates = [];
    let currentRun = [];
    photos.slice().sort((a, b) => String(a.recorded_at || a.time || "").localeCompare(String(b.recorded_at || b.time || ""))).forEach(photo => {
      if (["Duplicate", "Reference"].includes(photo.photo_value)) currentRun.push(photo);
      else {
        if (currentRun.length >= 3) lowValueCandidates.push(currentRun.slice());
        currentRun = [];
      }
    });
    if (currentRun.length >= 3) lowValueCandidates.push(currentRun);
    return {
      schema_name: "property-intelligence-field-evidence-review",
      schema_version: "1.0",
      strongest_evidence: photos.filter(photo => photo.photo_value === "Critical").map(photo => photo.id),
      repetitive_photographs: photos.filter(photo => photo.photo_value === "Duplicate").map(photo => photo.id),
      missing_context_photographs: patterns.filter(item => item.pattern.missing.includes("context")).map(item => item.photo_id),
      missing_measurements: patterns.filter(item => item.pattern.missing.includes("measurement")).map(item => item.photo_id),
      four_photo_pattern_by_photo: patterns,
      unsupported_conclusions: hypotheses.filter(item => !(item.supporting_photo_ids || []).length && !(item.triggering_observation_ids || []).length).map(item => item.hypothesis_id),
      professional_questions_ready: hypotheses.filter(item => item.verification_question).map(item => ({ hypothesis_id: item.hypothesis_id, professional_type: item.professional_type, exact_question: item.verification_question })),
      field_time_with_possible_low_additional_value: lowValueCandidates.map(run => ({
        started_at: run[0].recorded_at || run[0].time,
        ended_at: run[run.length - 1].recorded_at || run[run.length - 1].time,
        photograph_ids: run.map(item => item.id),
        basis: "Three or more consecutive photographs were marked Reference or Duplicate.",
        review_required: "Ask whether the sequence added new context, measurement, or relationship evidence before calling the time unnecessary."
      })),
      low_additional_value_rule: "Review long stopped/documenting periods and consecutive Duplicate/Reference photographs; do not infer wasted time without inspector confirmation.",
      training_prompts: [
        "What decision will this evidence help someone make?",
        "What fact would a professional otherwise have to visit the site to collect?",
        "Can I measure it rather than merely describe it?",
        "Have I shown context as well as the close-up?",
        "Am I recording a fact, estimate, or hypothesis?",
        "Is another photograph adding information or merely repeating the last one?"
      ]
    };
  }

  function createProfessionalHandoffCards(inspection, mapPath) {
    const data = inspection || {};
    const observations = data.markers || [];
    const photos = data.photos || [];
    const cards = [];
    (data.inspector_hypotheses || []).forEach(hypothesis => {
      const supportingObservations = observations.filter(item => (hypothesis.triggering_observation_ids || []).includes(item.id));
      const supportingPhotos = photos.filter(item => (hypothesis.supporting_photo_ids || []).includes(item.id));
      const locationSource = supportingObservations[0] || supportingPhotos[0] || {};
      PROFESSIONAL_AUDIENCES.forEach(audience => cards.push({
        card_id: `handoff-${hypothesis.hypothesis_id}-${audience.replace(/[^a-z0-9]+/g, "-")}`,
        audience,
        exact_question: hypothesis.verification_question,
        gps_location: Number.isFinite(Number(locationSource.lat)) && Number.isFinite(Number(locationSource.lon)) ? { latitude: Number(locationSource.lat), longitude: Number(locationSource.lon), accuracy_m: locationSource.gps_accuracy_m || null } : null,
        relevant_map: mapPath || "printable-report.html",
        photograph_ids: supportingPhotos.map(item => item.id),
        measurements: supportingObservations.map(item => item.attributes || item.observation_attributes || {}).filter(value => Object.keys(value).length),
        weather_and_rainfall_context: data.conditions || {},
        inspector_observation_ids: supportingObservations.map(item => item.id),
        inspector_hypothesis: { hypothesis_id: hypothesis.hypothesis_id, statement: hypothesis.statement, factual_status: hypothesis.factual_status },
        unknowns: [hypothesis.verification_question],
        why_answer_matters: "The answer could materially change conclusions about drainage risk, usable land, access, site work, cost, permitting, or neighboring-property exposure.",
        expected_decision_change: audience === "buyer" ? "Purchase terms, contingencies, price, or decision to proceed." : (audience === "seller" ? "Disclosure, records to provide, or corrective-work discussions." : "Scope, feasibility, cost, or need for additional licensed analysis."),
        limitation: "This field record is reconnaissance evidence. It does not replace licensed professional work and does not recommend construction."
      }));
    });
    observations.filter(item => /needs professional verification/i.test(String(item.evidence_classification || ""))).forEach(observation => {
      const linkedPhotos = photos.filter(photo => String(photo.associated_observation_id || "") === String(observation.id));
      const attributes = observation.attributes || {};
      const exactQuestion = attributes.professional_question || `What is the professionally verified nature, extent, cause, and decision significance of ${observation.button_label || observation.type || observation.id} recorded at this location?`;
      PROFESSIONAL_AUDIENCES.forEach(audience => cards.push({
        card_id: `handoff-${observation.id}-${audience.replace(/[^a-z0-9]+/g, "-")}`,
        audience,
        exact_question: exactQuestion,
        gps_location: Number.isFinite(Number(observation.lat)) && Number.isFinite(Number(observation.lon)) ? { latitude: Number(observation.lat), longitude: Number(observation.lon), accuracy_m: observation.gps_accuracy_m || null } : null,
        relevant_map: mapPath || "printable-report.html",
        photograph_ids: linkedPhotos.map(item => item.id),
        measurements: Object.keys(attributes).length ? [attributes] : [],
        weather_and_rainfall_context: data.conditions || {},
        inspector_observation_ids: [observation.id],
        inspector_hypothesis: { hypothesis_id: null, statement: "No inspector hypothesis is asserted; the field observation is flagged for professional verification.", factual_status: "OBSERVATION_REQUIRING_PROFESSIONAL_VERIFICATION" },
        unknowns: [exactQuestion],
        why_answer_matters: "The verified answer could change access, buildability, economic potential, cost/risk, or the significance of the site condition.",
        expected_decision_change: audience === "buyer" ? "Purchase terms, contingencies, price, or decision to proceed." : (audience === "seller" ? "Disclosure, records to provide, or corrective-work discussions." : "Scope, feasibility, cost, or need for additional licensed analysis."),
        limitation: "This field record is reconnaissance evidence. It does not replace licensed professional work and does not recommend construction."
      }));
    });
    return { schema_name: "property-intelligence-professional-handoff-cards", schema_version: "1.0", cards };
  }

  function handoffCardsMarkdown(bundle) {
    const cards = bundle && bundle.cards || [];
    if (!cards.length) return "# Professional Handoff Cards\n\nNo issue requiring a professional handoff card was recorded.\n";
    return `# Professional Handoff Cards\n\nThese cards orient a professional; they do not replace licensed work.\n\n${cards.map(card => `## ${card.audience.toUpperCase()} — ${card.card_id}\n\n- Exact question: ${card.exact_question}\n- GPS: ${card.gps_location ? `${card.gps_location.latitude}, ${card.gps_location.longitude} (accuracy ${card.gps_location.accuracy_m || "unknown"} m)` : "No single verified point; use linked evidence"}\n- Relevant map: ${card.relevant_map}\n- Photographs: ${card.photograph_ids.join(", ") || "None specifically linked"}\n- Observations: ${card.inspector_observation_ids.join(", ") || "None specifically linked"}\n- Inspector hypothesis: ${card.inspector_hypothesis.statement}\n- What remains unknown: ${card.unknowns.join("; ")}\n- Why it matters: ${card.why_answer_matters}\n- Decision it could change: ${card.expected_decision_change}\n- Limitation: ${card.limitation}\n`).join("\n---\n\n")}`;
  }

  return {
    CORRECTION_REASONS,
    PROFESSIONAL_AUDIENCES,
    PHOTO_EVIDENCE_ROLES,
    PEARSON_ENTRANCE_TIME,
    PEARSON_HYPOTHESIS_ID,
    ensureGovernanceModel,
    recordsForCorrection,
    addCorrection,
    correctionsFor,
    recordStatus,
    effectiveRecord,
    buildEffectiveInspection,
    photoPattern,
    createFieldEvidenceReview,
    createProfessionalHandoffCards,
    handoffCardsMarkdown
  };
});
