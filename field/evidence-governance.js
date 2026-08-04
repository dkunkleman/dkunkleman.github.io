(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EvidenceGovernance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CORRECTION_REASONS = [
    "Correct",
    "Corrected value",
    "Accidental button press",
    "Wrong category",
    "Wrong inspection area",
    "Wrong question",
    "Duplicate",
    "Needs clarification",
    "Withdrawn",
    "user_undo"
  ];
  const VOID_REASONS = new Set(["Accidental button press", "Duplicate", "Withdrawn", "user_undo"]);
  const PROFESSIONAL_AUDIENCES = ["builder", "civil/drainage engineer", "surveyor", "forester", "soil/septic professional", "buyer", "seller"];
  const PHOTO_EVIDENCE_ROLES = ["context", "evidence", "measurement", "relationship"];
  const PEARSON_ENTRANCE_TIME = "2026-08-03T13:04:01.864Z";
  const PEARSON_HYPOTHESIS_ID = "hypothesis-pearson-road-drainage-berm-20260803";
  const PEARSON_P44_HOMESITE_CORRECTION_ID = "correction-pearson-homesite-near-p44-20260803";
  const PEARSON_P44_PHOTO_CORRECTION_ID = "correction-pearson-p44-water-measurement-20260803";
  const PEARSON_REVIEW_DATE = "2026-08-03";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function idOf(record, recordType) {
    if (!record) return null;
    if (recordType === "photo") return record.id || record.photo_id || null;
    if (recordType === "voice_note") return record.id || record.voice_note_id || null;
    if (recordType === "area_assignment") return record.area_id || record.id || null;
    if (recordType === "question_assignment") return record.question_id || record.id || null;
    if (recordType === "inspector_hypothesis") return record.hypothesis_id || record.id || null;
    if (recordType === "group_assignment") return record.event_id || record.id || null;
    if (recordType === "photo_classification") return record.id || record.photo_id || null;
    return record.id || record.observation_id || null;
  }

  function isCompletePearsonReview(data) {
    const inspectionDate = String(data && data.conditions && data.conditions.inspection_date || data && data.started || "").slice(0, 10);
    const p3 = (data.photos || []).find(item => Number(String(item.photo_number || "").replace(/\D/g, "")) === 3);
    return String(data && data.property_id || "") === "parcel:221S280000001010000" &&
      inspectionDate === PEARSON_REVIEW_DATE &&
      Number.isFinite(Date.parse(p3 && (p3.recorded_at || p3.time) || "")) &&
      (data.photos || []).some(item => Number(String(item.photo_number || "").replace(/\D/g, "")) === 196);
  }

  function pearsonReviewStartTime(data) {
    if (!isCompletePearsonReview(data)) return null;
    const p3 = (data.photos || []).find(item => Number(String(item.photo_number || "").replace(/\D/g, "")) === 3);
    return Date.parse(p3.recorded_at || p3.time);
  }

  function ensureGovernanceModel(inspection, now) {
    const data = inspection || {};
    data.corrections = Array.isArray(data.corrections) ? data.corrections : [];
    data.inspector_hypotheses = Array.isArray(data.inspector_hypotheses) ? data.inspector_hypotheses : [];
    data.review_annotations = Array.isArray(data.review_annotations) ? data.review_annotations : [];
    data.review_annotation_events = Array.isArray(data.review_annotation_events) ? data.review_annotation_events : [];
    data.inspector_identity = data.inspector_identity || "Field Inspector";
    const hasCompletePearsonReview = isCompletePearsonReview(data);
    const appTestCutoff = pearsonReviewStartTime(data);
    if (hasCompletePearsonReview) {
      const excludePriorDay = (records, recordType) => (records || []).forEach(record => {
        const recordedAt = Date.parse(record.time || record.recorded_at || record.started_at || "");
        const recordId = idOf(record, recordType);
        if (!recordId || !Number.isFinite(recordedAt) || recordedAt >= appTestCutoff) return;
        const correctionId = `correction-pearson-app-test-${recordType}-${recordId}`;
        if (data.corrections.some(item => item.correction_id === correctionId)) return;
        data.corrections.push({ correction_id: correctionId, target: { record_type: recordType, record_id: recordId }, correction_time: now || new Date().toISOString(), correction_reason: "Excluded prior-day app-test record", corrected_value: null, inspector_identity: data.inspector_identity, resulting_status: "voided", status: "voided", corrected_at: now || new Date().toISOString(), original_entry: clone(record), original_record_preserved: true, source: "Inspector-approved Pearson Road post-inspection correction", immutable: true });
      });
      excludePriorDay(data.markers, "observation");
      excludePriorDay(data.photos, "photo");
      excludePriorDay(data.voice_notes, "voice_note");
    }
    data.review_annotations.filter(item => item.source_conversation_reference === "Inspector-directed Pearson Road post-inspection review" && item.status === "Active" && item.approval_method !== "explicit_in_app_or_repository_approval").forEach(item => {
      const eventId = `review-reset-pending:${item.annotation_id}`;
      if (!data.review_annotation_events.some(event => event.event_id === eventId)) data.review_annotation_events.push({ event_id: eventId, event_type: "automated_annotation_reset_to_pending", annotation_id: item.annotation_id, recorded_at: now || new Date().toISOString(), previous_state: clone(item), reason: "The reviewed Pearson phase now requires explicit inspector approval before it can affect findings.", immutable: true });
      item.status = "Draft";
      item.approved_by_inspector = false;
      item.approval_time = null;
      item.activation_rule = "Explicit inspector approval is required in Review and Build Report or repository review.";
    });
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
        status: "voided",
        corrected_at: now || new Date().toISOString(),
        original_entry: clone(pearsonEntrance),
        original_record_preserved: true,
        source: "inspector-directed Pearson Road correction",
        immutable: true
      });
    }
    const p44 = (data.photos || []).find(item => Number(String(item.photo_number || "").replace(/\D/g, "")) === 44);
    if (p44) {
      const p44Time = new Date(p44.recorded_at || p44.time || 0).getTime();
      const nearbyHomesite = markers.filter(item => /homesite/i.test(`${item.type || ""} ${item.observation_type || ""} ${item.button_label || ""}`)).map(item => ({ item, delta: Math.abs(new Date(item.time || item.observed_at || 0).getTime() - p44Time) })).filter(item => Number.isFinite(item.delta) && item.delta <= 30000).sort((a, b) => a.delta - b.delta)[0];
      if (nearbyHomesite && !data.corrections.some(item => item.correction_id === PEARSON_P44_HOMESITE_CORRECTION_ID)) {
        data.corrections.push({
          correction_id: PEARSON_P44_HOMESITE_CORRECTION_ID,
          target: { record_type: "observation", record_id: idOf(nearbyHomesite.item, "observation") },
          correction_time: now || new Date().toISOString(), correction_reason: "Accidental button press", corrected_value: null,
          inspector_identity: data.inspector_identity, resulting_status: "voided", status: "voided", corrected_at: now || new Date().toISOString(),
          original_entry: clone(nearbyHomesite.item), original_record_preserved: true,
          source: "inspector-directed Pearson Road P44 correction", immutable: true
        });
      }
      if (!data.corrections.some(item => item.correction_id === PEARSON_P44_PHOTO_CORRECTION_ID)) {
        data.corrections.push({
          correction_id: PEARSON_P44_PHOTO_CORRECTION_ID,
          target: { record_type: "photo", record_id: idOf(p44, "photo") },
          correction_time: now || new Date().toISOString(), correction_reason: "Corrected value",
          corrected_value: { category: "Water Measurement", associated_observation_id: null, photo_meaning: { status: "complete", subject: "Drainage or water", measurement_status: "Measured", evidence_roles: ["measurement"], clarification: "P44 documents shallow standing water measured at approximately 3 inches; it is not homesite evidence." } },
          inspector_identity: data.inspector_identity, resulting_status: "corrected", status: "corrected", corrected_at: now || new Date().toISOString(),
          original_entry: clone(p44), original_record_preserved: true,
          source: "inspector-directed Pearson Road P44 correction", immutable: true
        });
      }
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
    const hasPearsonReviewSequence = String(data.property_id || "") === "parcel:221S280000001010000" && (data.photos || []).some(item => Number(String(item.photo_number || "").replace(/\D/g, "")) === 43);
    if (hasPearsonReviewSequence) {
      const photoIds = (from, to) => (data.photos || []).filter(item => { const number = Number(String(item.photo_number || "").replace(/\D/g, "")); return number >= from && number <= to; }).map(item => item.id).filter(Boolean);
      const approvalTime = now || new Date().toISOString();
      const sessionId = "review-pearson-road-real-20260803";
      const areaBy = pattern => ((data.inspection_areas || []).find(item => pattern.test(String(item.name || ""))) || {}).area_id || null;
      const addReview = row => { if (!data.review_annotations.some(item => item.annotation_id === row.annotation_id)) data.review_annotations.push(Object.assign({ schema_name: "property-intelligence-review-annotation", schema_version: "1.0", property_id: data.property_id, inspection_id: data.inspection_id, review_session_id: sessionId, created_at: approvalTime, created_by: data.inspector_identity, approved_by_inspector: false, approval_time: null, source_conversation_reference: "Inspector-directed Pearson Road post-inspection review", voice_note_ids: [], gps_point_ids: [], status: "Draft", supersedes_annotation_id: null, contradicting_evidence: [], professional_verification_question: null, activation_rule: "Explicit inspector approval is required before this reviewed annotation affects a finding, map, or report." }, row)); };
      addReview({ annotation_id: "review-pearson-p3-p11-large-tract", photograph_ids: photoIds(3, 11), observation_ids: [], inspection_area_id: areaBy(/large tract|north survey|road/i), report_sections_affected: ["Inspection Scope", "Inspection Areas", "Drainage", "Photo captions"], exact_inspector_statement: "P3-P11 are in the large tract north survey-flag/road area. The Entrance button was accidental. The sequence documents survey marker, roadside water, wooded-side water, and the road/berm relationship. I think the road berm traps water.", concise_approved_finding: "P3-P11 document the large-tract north survey-flag and road/berm water sequence; the Entrance press is accidental and excluded.", record_type: "Inspector clarification", evidence_classification: "Observed fact and Inspector interpretation", confidence: "high for sequence and correction; interpretation requires professional verification", supporting_evidence: photoIds(3, 11), unanswered_questions: ["Would lawful drainage toward the north/south Pearson ditch and berm modification improve drainage without creating downstream, right-of-way, permitting, or neighbor impacts?"], professional_verification_question: "What are the existing elevations, lawful outlet, downstream capacity, right-of-way constraints, permitting requirements, and neighboring-property effects of a drainage path toward the north/south Pearson ditch and modification of the road berm?", main_report_or_appendix: "main-report" });
      addReview({ annotation_id: "review-pearson-p12-p43-small-tract", photograph_ids: photoIds(12, 43), observation_ids: [], inspection_area_id: areaBy(/small tract/i), report_sections_affected: ["Inspection Scope", "Inspection Areas", "Drainage", "Timber and vegetation", "Photo captions"], exact_inspector_statement: "P12-P43 are the small tract. The sequence contains shallow water depressions, some larger pooled areas, dry transitions, and generally walkable canopy. Do not describe the entire corridor as dense impassable brush. Separate small puddles, larger pools, and narrow runoff depressions.", concise_approved_finding: "P12-P43 document localized shallow depressions, some larger pools, dry transitions, and generally walkable canopy on the small tract; they do not establish that the entire corridor was wet or impassable.", record_type: "Inspector clarification", evidence_classification: "Observed", confidence: "high for photographed locations; limited outside inspected corridor", supporting_evidence: photoIds(12, 43), unanswered_questions: ["How do these localized water observations behave under other rainfall and seasonal conditions?"], main_report_or_appendix: "main-report" });
      addReview({ annotation_id: "review-pearson-inspection-scope", photograph_ids: photoIds(3, Math.max(43, (data.photos || []).length)), observation_ids: [], inspection_area_id: null, report_sections_affected: ["Executive Summary", "Inspection Scope", "Inspection Areas", "Inspection critique"], exact_inspector_statement: "The first few photographs concern the large tract. Nearly all remaining inspection activity concerns the 5.48-acre small tract. Do not summarize findings as though the 81.20-acre large tract was comprehensively inspected.", concise_approved_finding: "The large tract received limited early documentation; nearly all remaining inspection activity concerned the 5.48-acre small tract, so conclusions must not imply comprehensive inspection of the 81.20-acre large tract.", record_type: "Inspector clarification", evidence_classification: "Observed inspection scope", confidence: "high", supporting_evidence: photoIds(3, Math.max(43, (data.photos || []).length)), unanswered_questions: ["What conditions remain unknown across the unvisited large-tract acreage?"], main_report_or_appendix: "main-report" });
      addReview({ annotation_id: "review-pearson-small-tract-narrative", photograph_ids: photoIds(12, Math.max(43, (data.photos || []).length)), observation_ids: [], inspection_area_id: areaBy(/small tract/i), report_sections_affected: ["Executive Summary", "Inspection Areas", "Drainage", "Timber and vegetation", "Access"], exact_inspector_statement: "Small tract: northwest flowing-water corridor; small roadside ditch/swale along curved Pearson Road; eastern third generally high/dry and primarily brush; western portion generally more heavily wooded beneath canopy; no fence observed; most documented shallow puddles were localized rather than proof that the entire tract was wet.", concise_approved_finding: "The small tract includes a northwest flowing-water corridor and roadside swale; its eastern third was generally high/dry and brushy, its western portion more wooded beneath canopy, no fence was observed, and documented shallow puddles were generally localized.", record_type: "Inspector clarification", evidence_classification: "Observed", confidence: "moderate to high within the walked and photographed corridor", supporting_evidence: photoIds(12, Math.max(43, (data.photos || []).length)), unanswered_questions: ["Conditions outside the walked corridor and under different rainfall or seasonal conditions remain unknown."], main_report_or_appendix: "main-report" });
    }
    return data;
  }

  function recordsForCorrection(inspection) {
    const data = inspection || {};
    const rows = [];
    (data.markers || []).filter(record => !["photo", "voice_note"].includes(String(record.type || ""))).forEach(record => rows.push({
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
    (data.inspector_hypotheses || []).forEach(record => rows.push({ record_type: "inspector_hypothesis", record_id: record.hypothesis_id, recorded_at: record.recorded_at, label: `Inspector hypothesis — ${record.statement || record.hypothesis_id}`, original_entry: clone(record) }));
    (data.inspection_areas || []).forEach(record => rows.push({ record_type: "area_assignment", record_id: record.area_id, recorded_at: record.created_at || data.started, label: `Area assignment — ${record.name}`, original_entry: clone(record) }));
    (data.investigation_questions || []).forEach(record => rows.push({ record_type: "question_assignment", record_id: record.question_id, recorded_at: record.created_at || data.started, label: `Question assignment — ${record.text}`, original_entry: clone(record) }));
    (data.photos || []).filter(record => record.photo_meaning && record.photo_meaning.recorded_at).forEach(record => rows.push({ record_type: "photo_classification", record_id: record.id, recorded_at: record.photo_meaning.recorded_at, label: `Photo classification — ${record.photo_number || record.id}`, original_entry: clone(record.photo_meaning) }));
    (data.evidence_set_events || []).forEach(record => rows.push({ record_type: "group_assignment", record_id: record.event_id, recorded_at: record.recorded_at, label: `Group assignment — ${record.event_type} ${record.record_id || record.evidence_set_id}`, original_entry: clone(record) }));
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
    correction.status = correction.resulting_status;
    correction.corrected_at = correction.correction_time;
    correction.original_record_preserved = true;
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
    if (Object.prototype.hasOwnProperty.call(value, "question_ids")) result.question_ids = Array.isArray(value.question_ids) ? value.question_ids.slice() : [];
    if (Object.prototype.hasOwnProperty.call(value, "associated_observation_id")) result.associated_observation_id = value.associated_observation_id || null;
    if (value.photo_meaning) result.photo_meaning = Object.assign({}, result.photo_meaning || {}, clone(value.photo_meaning));
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
    const completePearsonReview = isCompletePearsonReview(raw);
    const reviewStartTime = pearsonReviewStartTime(raw);
    const priorDayGps = completePearsonReview ? (raw.points || []).filter(point => { const time = Date.parse(point.time || ""); return Number.isFinite(time) && time < reviewStartTime; }) : [];
    const allMarkers = (raw.markers || []).map(item => effectiveRecord(raw, "observation", item));
    const allPhotos = (raw.photos || []).map(item => {
      const photo = effectiveRecord(raw, "photo", item);
      if (recordStatus(raw, "photo_classification", item.id) === "voided") {
        photo.photo_meaning = Object.assign({}, photo.photo_meaning || {}, { status: "voided_by_correction", excluded_from_current_interpretation: true });
      }
      return photo;
    });
    const allVoices = (raw.voice_notes || []).map(item => effectiveRecord(raw, "voice_note", item));
    const allAreas = (raw.inspection_areas || []).map(item => effectiveRecord(raw, "area_assignment", item));
    const allQuestions = (raw.investigation_questions || []).map(item => effectiveRecord(raw, "question_assignment", item));
    const allHypotheses = (raw.inspector_hypotheses || []).map(item => effectiveRecord(raw, "inspector_hypothesis", item));
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
    const activeReviewAnnotations = (raw.review_annotations || []).filter(item => item.approved_by_inspector === true && item.status === "Active");
    const active = Object.assign({}, raw, {
      points: completePearsonReview ? (raw.points || []).filter(point => !priorDayGps.includes(point)) : (raw.points || []),
      markers,
      photos: allPhotos.filter(item => !item.excluded_from_findings),
      voice_notes: allVoices.filter(item => !item.excluded_from_findings),
      inspection_areas: allAreas.filter(item => !item.excluded_from_findings),
      investigation_questions: allQuestions.filter(item => !item.excluded_from_findings),
      inspector_hypotheses: allHypotheses.filter(item => !item.excluded_from_findings),
      review_annotations: activeReviewAnnotations
    });
    return {
      active,
      all_records: { observations: allMarkers, photographs: allPhotos, voice_notes: allVoices, inspection_areas: allAreas, investigation_questions: allQuestions, inspector_hypotheses: allHypotheses },
      audit_history: {
        schema_name: "property-intelligence-evidence-audit",
        schema_version: "1.0",
        immutable_source_rule: "Original entries are never rewritten or deleted. Reports use the effective active view; voided records remain here.",
        corrections: clone(raw.corrections || []),
        review_annotations: clone(raw.review_annotations || []),
        review_annotation_events: clone(raw.review_annotation_events || []),
        audit_only_gps_points: clone(priorDayGps),
        source_record_counts: { observations: allMarkers.length, photographs: allPhotos.length, voice_notes: allVoices.length },
        voided_record_ids: [...allMarkers, ...allPhotos, ...allVoices].filter(item => item.excluded_from_findings).map(item => idOf(item, item.photo_number ? "photo" : (item.started_at ? "voice_note" : "observation")))
      }
    };
  }

  function undoLastAction(inspection, options) {
    const data = ensureGovernanceModel(inspection);
    const settings = options || {};
    const candidates = recordsForCorrection(data).filter(item => recordStatus(data, item.record_type, item.record_id) !== "voided");
    const target = settings.record_type && settings.record_id ? candidates.find(item => item.record_type === settings.record_type && String(item.record_id) === String(settings.record_id)) : candidates[0];
    if (!target) throw new Error("There is no active action to undo.");
    return addCorrection(data, { correction_id: settings.correction_id, record_type: target.record_type, record_id: target.record_id, correction_reason: "user_undo", corrected_value: null, inspector_identity: settings.inspector_identity || data.inspector_identity, correction_time: settings.corrected_at || new Date().toISOString() });
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
    PEARSON_P44_HOMESITE_CORRECTION_ID,
    PEARSON_P44_PHOTO_CORRECTION_ID,
    ensureGovernanceModel,
    recordsForCorrection,
    addCorrection,
    undoLastAction,
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
