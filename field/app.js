(function () {
  "use strict";

  const APP_VERSION = "3.11.0";
  const W = 1800;
  const H = 1500;
  const xmin = -87.1;
  const ymin = 30.4825;
  const xmax = -87.083;
  const ymax = 30.497;
  const stateKey = "pearsonFieldTrackV3";
  const legacyStateKey = "pearsonFieldTrackV2";
  const photoDbName = "pearson-road-field-photos";
  const photoStoreName = "photos";
  const voiceStoreName = "voiceNotes";
  const voiceChunkStoreName = "voiceChunks";
  const gpsStoreName = "gpsPoints";
  const packageTools = window.InspectionPackage;
  const dbRecoveryTools = window.IndexedDbRecovery;
  const coachingTools = window.InspectionCoaching;
  const waterTools = window.WaterIntelligence;
  const governanceTools = window.EvidenceGovernance;
  const evidenceSetTools = window.EvidenceSets;
  const timberTools = window.TimberReconnaissance;
  const pendingPhotoCacheName = "property-inspector-pending-photos-v1";

  const svg = document.getElementById("overlay");
  const statusEl = document.getElementById("status");
  const startBtn = document.getElementById("start");
  const stopBtn = document.getElementById("stop");
  const finishBtn = document.getElementById("finish");
  const clearBtn = document.getElementById("clear");
  const photoInput = document.getElementById("photoInput");
  const gallery = document.getElementById("gallery");
  const packageLink = document.getElementById("packageLink");
  const sharePackageBtn = document.getElementById("sharePackage");
  const packageReady = document.getElementById("packageReady");
  const packageSummary = document.getElementById("packageSummary");
  const packageFilename = document.getElementById("packageFilename");
  const packageInstruction = document.getElementById("packageInstruction");
  const offlineState = document.getElementById("offlineState");
  const nextStep = document.getElementById("nextStep");
  const voiceBtn = document.getElementById("voice");
  const fullArchiveBtn = document.getElementById("fullArchive");
  const retryPendingPhotoBtn = document.getElementById("retryPendingPhoto");
  const observationDialog = document.getElementById("observationDialog");
  const moreCategories = document.getElementById("moreCategories");
  const activeAreaSelect = document.getElementById("activeArea");
  const questionList = document.getElementById("questionList");
  const evidenceRelationshipSelect = document.getElementById("evidenceRelationship");
  const nextPhotoValueSelect = document.getElementById("nextPhotoValue");
  const departureDialog = document.getElementById("departureDialog");
  const photoExplanationDialog = document.getElementById("photoExplanationDialog");
  const waterClassificationDialog = document.getElementById("waterClassificationDialog");
  const smallWaterMap = document.getElementById("smallWaterMap");
  const waterPhotoDialog = document.getElementById("waterPhotoDialog");
  const photoMeaningDialog = document.getElementById("photoMeaningDialog");
  const correctionDialog = document.getElementById("correctionDialog");
  const hypothesisDialog = document.getElementById("hypothesisDialog");
  const structuredMeasurementDialog = document.getElementById("structuredMeasurementDialog");
  const plotTreeDialog = document.getElementById("plotTreeDialog");
  const correctRecordBtn = document.getElementById("correctRecord");
  const undoLastBtn = document.getElementById("undoLast");
  const markerButtons = ["wet", "dry", "blocked", "high", "homesite", "culvert", "tree", "entrance", "wildlife", "thick", "open", "ditch", "timber", "hazard", "other", "note", "thought", "hypothesis", "photo", "startPhotoGroup", "voice", "more"].map(id => document.getElementById(id));
  const buttonLabels = {
    wet: "Wet", dry: "Dry", blocked: "Blocked Access", high: "High Ground", homesite: "Potential Homesite",
    culvert: "Culvert", tree: "Tree", entrance: "Road or Entrance", wildlife: "Wildlife",
    thick: "Thick Brush", open: "Open Area", ditch: "Ditch", timber: "Timber Sample",
    hazard: "Hazard", other: "Other",
    note: "Free Note", thought: "Inspector Thought", photo: "Photo", voice_note: "Voice Note"
  };

  let watchId = null;
  let wakeLock = null;
  let lastPosition = null;
  let latestOrientation = null;
  let lastOrientationProcessedAt = 0;
  let lastOrientationSavedAt = 0;
  let parcelFeatures = [];
  let evidenceDb = null;
  let pendingPhotoRequestedAt = null;
  let photoBusy = false;
  let packageBusy = false;
  let offlineReady = false;
  let lastPackageUrl = null;
  let lastPackageFile = null;
  let galleryUrls = [];
  let galleryRenderId = 0;
  let mediaRecorder = null;
  let activeVoiceNote = null;
  let voiceChunkSequence = 0;
  let voiceChunkWrites = Promise.resolve();
  let gpsWriteQueue = Promise.resolve();
  let gpsStorageFailed = false;
  let activeObservationType = null;
  let pendingPhotoContext = null;
  let pendingPhotoQueue = [];
  let galleryPage = 0;
  const galleryPageSize = 12;
  let packageEstimates = null;
  let estimateRefreshTimer = null;
  let lastSavedOrientation = null;
  let photoHealthPromise = null;
  let coverageSnapshot = null;
  let coachingReview = null;
  let coverageLastCalculatedAt = 0;
  let coverageDirty = true;
  let coachingStateSnapshot = null;
  let coachingStateLastCalculatedAt = 0;
  let pendingPhotoExplanationId = null;
  let pendingWaterPhotoId = null;
  let pendingPhotoMeaningId = null;
  let photoExplanationDisposition = null;
  let activeWaterType = null;
  let smallTractWaterModel = null;
  let waterPhotoObjectUrl = null;
  let waterVoiceObjectUrl = null;
  let pendingGroupPhotoId = null;
  let pendingUndoTarget = null;
  let openNewEvidenceSetAfterPhotoReview = false;
  let pendingSubjectChangePrompt = null;
  let pendingMeasurementPhotoId = null;
  let pendingPlotTreeId = null;

  function emptyInspection() {
    return {
      schema_name: "property-intelligence-inspection",
      schema_version: "1.1",
      property_id: "parcel:221S280000001010000",
      inspection_id: null,
      started: null,
      stopped: null,
      points: [],
      markers: [],
      photos: [],
      voice_notes: [],
      pending_voice_note: null,
      lifecycle_events: [],
      orientation_samples: [],
      investigation_questions: [],
      inspection_areas: [],
      active_area_id: null,
      active_question_ids: [],
      next_evidence_relationship: "supports",
      next_photo_value: "Helpful",
      water_observation_rule: {
        all_observed_standing_water_photographed: false,
        confirmed_at: null,
        scope: "walked_and_visually_observed_corridor_at_inspection_time"
      },
      corrections: [],
      inspector_hypotheses: [],
      review_annotations: [],
      evidence_sets: [],
      evidence_set_events: [],
      evidence_set_suggestions: [],
      active_evidence_set_id: null,
      evidence_set_counters: {},
      measurements: [],
      measurement_suggestions: [],
      timber_plots: [],
      timber_trees: [],
      timber_counters: {},
      inspector_identity: "Field Inspector",
      weather_context: {
        named_event: "", event_dates: "", days_between_event_and_inspection: "", authoritative_rainfall_totals: "",
        weather_station_distance_from_parcel: "", inspector_reported_recent_local_rain: "", potentially_relevant_mechanism: "unknown",
        source_limit: "Weather context does not establish site causation or year-round conditions."
      },
      conditions: {
        inspection_date: "",
        weather_summary: "",
        rainfall_previous_24_hours: "",
        rainfall_previous_7_days: "",
        rainfall_previous_30_days: "",
        temperature: "",
        ground_condition: "",
        rain_during_inspection: "",
        evidence_classification: "Observed"
      }
    };
  }

  let data = emptyInspection();

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind || "normal";
    updateNextStep();
  }

  function updateNextStep() {
    if (pendingPhotoQueue.length) {
      nextStep.textContent = "NEXT: Tap Retry Pending Photo. Keep this page open.";
    } else if (data.active_evidence_set_id && evidenceSetTools) {
      const activeSet = evidenceSetTools.effectiveEvidenceSet(data, data.active_evidence_set_id);
      nextStep.textContent = `NEXT: Photograph or explain ${activeSet ? activeSet.label : "the active subject"}, then tap Finish This Subject.`;
    } else if (!packageReady.hidden) {
      nextStep.textContent = sharePackageBtn.hidden ? "NEXT: Tap Save Inspection Package for the Property Intelligence Repository. Do not clear the inspection yet." : "NEXT: Tap Save to Property Intelligence Repository. Do not clear the inspection yet.";
    } else if (mediaRecorder && mediaRecorder.state === "recording") {
      nextStep.textContent = "NEXT: Speak now. Tap Stop Voice Note when you are finished.";
    } else if (!data.started) {
      nextStep.textContent = offlineState.dataset.ready === "true" ? "NEXT: Tap Start Inspection." : "NEXT: Wait for “Offline ready,” then tap Start Inspection.";
    } else if (watchId === null) {
      nextStep.textContent = "NEXT: Tap Resume Inspection to continue walking, or Finish Inspection if the property is complete.";
    } else if (!lastPosition) {
      nextStep.textContent = "NEXT: Wait here for the first precise GPS location.";
    } else if (coachingTools && !data.investigation_questions.length) {
      nextStep.textContent = "NEXT: Add the most important investigation question.";
    } else if (coachingTools && data.investigation_questions.length && !data.active_question_ids.length) {
      nextStep.textContent = "NEXT: Select the question your next evidence should answer.";
    } else {
      const activeArea = data.inspection_areas.find(area => area.area_id === data.active_area_id);
      nextStep.textContent = `NEXT: Collect the highest-value evidence in ${activeArea ? activeArea.name : "the current area"}.`;
    }
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadState() {
    try {
      const current = localStorage.getItem(stateKey);
      const legacy = localStorage.getItem(legacyStateKey);
      const parsed = JSON.parse(current || legacy || "null");
      if (parsed && Array.isArray(parsed.points)) data = Object.assign(emptyInspection(), parsed);
    } catch (error) {
      setStatus("Saved inspection metadata could not be read. Do not begin until the record is cleared or recovered.", "error");
    }
    data.points = Array.isArray(data.points) ? data.points : [];
    data.markers = Array.isArray(data.markers) ? data.markers : [];
    data.photos = Array.isArray(data.photos) ? data.photos : [];
    data.voice_notes = Array.isArray(data.voice_notes) ? data.voice_notes : [];
    data.lifecycle_events = Array.isArray(data.lifecycle_events) ? data.lifecycle_events : [];
    data.orientation_samples = Array.isArray(data.orientation_samples) ? data.orientation_samples : [];
    data.conditions = Object.assign(emptyInspection().conditions, data.conditions || {});
    data.weather_context = Object.assign(emptyInspection().weather_context, data.weather_context || {});
    data.water_observation_rule = Object.assign(emptyInspection().water_observation_rule, data.water_observation_rule || {});
    if (coachingTools) coachingTools.ensureInspectionModel(data);
    if (governanceTools) governanceTools.ensureGovernanceModel(data);
    if (evidenceSetTools) {
      evidenceSetTools.ensureEvidenceSetModel(data);
      evidenceSetTools.addPearsonSuggestions(data);
    }
    if (timberTools) timberTools.ensureModel(data);
  }

  function saveState() {
    try {
      const recoverySnapshot = Object.assign({}, data, {
        points: data.points.slice(-500),
        points_total: data.points.length,
        gps_storage: "IndexedDB canonical; localStorage carries the latest 500 fixes for immediate crash recovery"
      });
      localStorage.setItem(stateKey, JSON.stringify(recoverySnapshot));
    } catch (error) {
      setStatus("LOCAL RECOVERY STORAGE FAILED. Stop walking and finish the inspection now; new field data may not survive an app close.", "error");
      throw error;
    }
  }

  function subjectParcel() {
    return parcelFeatures.find(feature => String((feature.attributes || {}).PAR_NUM || "") === "221S280000001010000") || null;
  }

  function subjectRings() {
    const subject = subjectParcel();
    return subject && subject.geometry && Array.isArray(subject.geometry.rings) ? subject.geometry.rings : [];
  }

  function subjectAcres() {
    const subject = subjectParcel();
    const acres = subject && subject.attributes ? Number(subject.attributes.CALC_ACRE) : NaN;
    return Number.isFinite(acres) && acres > 0 ? acres : null;
  }

  function currentEvidenceContext() {
    return coachingTools ? coachingTools.evidenceContext(data) : { area_id: null, question_ids: [], question_links: [] };
  }

  function calculateCoachingState(force, forceCoverage) {
    if (!coachingTools) return null;
    const evidenceData = effectiveEvidenceData();
    const now = Date.now();
    let coverageChanged = false;
    const coverageForced = forceCoverage === undefined ? Boolean(force) : Boolean(forceCoverage);
    if (coverageForced || !coverageSnapshot || (coverageDirty && now - coverageLastCalculatedAt > 15000)) {
      coverageSnapshot = coachingTools.calculateCoverage({ points: data.points, rings: subjectRings(), recordedAcres: subjectAcres() });
      coverageLastCalculatedAt = now;
      coverageDirty = false;
      coverageChanged = true;
    }
    if (!force && !coverageChanged && coachingStateSnapshot && now - coachingStateLastCalculatedAt < 15000) return coachingStateSnapshot;
    coachingReview = coachingTools.reviewMissingEvidence(evidenceData, coverageSnapshot);
    coachingStateSnapshot = {
      schema_name: "property-intelligence-field-coaching",
      schema_version: "1.0",
      investigation_questions: coachingTools.createQuestionBrief(evidenceData),
      inspection_areas: data.inspection_areas.slice(),
      coverage: coverageSnapshot,
      missing_evidence_review: coachingReview,
      return_visit_plan: coachingTools.createReturnVisitPlan(evidenceData, coverageSnapshot, coachingReview),
      field_efficiency: coachingTools.calculateFieldEfficiency(evidenceData, subjectAcres())
    };
    coachingStateLastCalculatedAt = now;
    return coachingStateSnapshot;
  }

  function formatMetricNumber(value, suffix) {
    return value !== null && value !== "" && Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${suffix || ""}` : "—";
  }

  function renderCoverage() {
    const state = calculateCoachingState(false);
    if (!state) return;
    const coverage = state.coverage;
    document.getElementById("coverageWell").textContent = `${coverage.well_inspected.percent || 0}%`;
    document.getElementById("coverageLight").textContent = `${coverage.lightly_inspected.percent || 0}%`;
    document.getElementById("coverageNone").textContent = `${coverage.not_inspected.percent == null ? 100 : coverage.not_inspected.percent}%`;
    document.getElementById("coverageMethod").textContent = coverage.status === "ESTIMATED"
      ? `${coverage.method} Estimated not inspected: ${coverage.not_inspected.estimated_acres} acres.`
      : "Start GPS inside the subject parcel to calculate coverage. Unvisited acreage remains unknown.";
    const efficiency = state.field_efficiency;
    document.getElementById("documentingTime").textContent = formatDuration(efficiency.time_documenting_ms);
    document.getElementById("observationSpacing").textContent = formatMetricNumber(efficiency.average_spacing_between_observations_m, " m");
    document.getElementById("photosPerAcre").textContent = formatMetricNumber(efficiency.photographs_per_acre, "");
    document.getElementById("observationsPerAcre").textContent = formatMetricNumber(efficiency.observations_per_acre, "");
    document.getElementById("questionsAnswered").textContent = efficiency.questions_answered;
    document.getElementById("questionsRemaining").textContent = efficiency.questions_remaining;
  }

  function renderMissingEvidence() {
    if (!coachingTools) return;
    const state = calculateCoachingState(false);
    const list = document.getElementById("missingEvidenceList");
    list.innerHTML = "";
    const actions = state.missing_evidence_review.highest_value_next_actions;
    if (!data.investigation_questions.length) {
      const item = document.createElement("li");
      item.textContent = "Add the most important investigation question before collecting more evidence.";
      list.appendChild(item);
    } else if (!actions.length) {
      const item = document.createElement("li");
      item.textContent = "No obvious evidence gap was detected. Review each answer and the coverage map before leaving.";
      list.appendChild(item);
    } else {
      actions.slice(0, 4).forEach(action => {
        const item = document.createElement("li");
        item.textContent = `${action.action} ${action.question ? `Question: ${action.question}` : ""}`.trim();
        list.appendChild(item);
      });
    }
    const best = list.firstElementChild ? list.firstElementChild.textContent : "Review coverage and unanswered questions.";
    document.getElementById("coachNextAction").textContent = `NEXT BEST EVIDENCE: ${best}`;
  }

  function renderQuestionList() {
    if (!coachingTools) return;
    coachingTools.ensureInspectionModel(data);
    const previousArea = activeAreaSelect.value;
    activeAreaSelect.innerHTML = "";
    data.inspection_areas.forEach(area => {
      const option = document.createElement("option");
      option.value = area.area_id;
      option.textContent = area.name;
      activeAreaSelect.appendChild(option);
    });
    activeAreaSelect.value = data.inspection_areas.some(area => area.area_id === data.active_area_id) ? data.active_area_id : previousArea;
    questionList.innerHTML = "";
    if (!data.investigation_questions.length) {
      const empty = document.createElement("p");
      empty.className = "small";
      empty.textContent = "No investigation questions yet. Add the most important uncertainty before walking.";
      questionList.appendChild(empty);
    }
    data.investigation_questions.forEach(question => {
      const row = document.createElement("div");
      row.className = `question-row${data.active_question_ids.includes(question.question_id) ? " active" : ""}`;
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = data.active_question_ids.includes(question.question_id);
      checkbox.setAttribute("aria-label", `Attach new evidence to ${question.text}`);
      const text = document.createElement("span");
      text.textContent = question.text;
      label.append(checkbox, text);
      const controls = document.createElement("div");
      controls.className = "question-controls";
      const status = document.createElement("select");
      status.setAttribute("aria-label", `Answer status for ${question.text}`);
      [["open", "Unanswered"], ["partially_answered", "Partly answered"], ["answered", "Answered"]].forEach(([value, title]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = title; status.appendChild(option);
      });
      status.value = question.status;
      const answer = document.createElement("button");
      answer.type = "button";
      answer.textContent = question.answer_summary ? "Edit Answer" : "Record Answer";
      checkbox.addEventListener("change", () => {
        if (checkbox.checked && !data.active_question_ids.includes(question.question_id)) data.active_question_ids.push(question.question_id);
        if (!checkbox.checked) data.active_question_ids = data.active_question_ids.filter(id => id !== question.question_id);
        saveState(); renderCoaching();
      });
      status.addEventListener("change", () => { question.status = status.value; saveState(); renderCoaching(); });
      answer.addEventListener("click", () => {
        const response = prompt("What does the evidence currently support? Include what remains uncertain.", question.answer_summary || "");
        if (response === null) return;
        question.answer_summary = response.trim();
        if (question.answer_summary) question.status = "answered";
        saveState(); renderCoaching();
      });
      controls.append(status, answer);
      row.append(label, controls);
      questionList.appendChild(row);
    });
    evidenceRelationshipSelect.value = data.next_evidence_relationship;
    nextPhotoValueSelect.value = data.next_photo_value;
  }

  function renderCoaching() {
    calculateCoachingState(true, false);
    renderQuestionList();
    renderCoverage();
    renderMissingEvidence();
    updateNextStep();
  }

  function recordIsActive(recordType, recordId) {
    return !governanceTools || governanceTools.recordStatus(data, recordType, recordId) !== "voided";
  }

  function effectiveEvidenceData() {
    if (!governanceTools) return data;
    const photos = data.photos.map(item => governanceTools.effectiveRecord(data, "photo", item)).filter(item => !item.excluded_from_findings);
    const voices = data.voice_notes.map(item => governanceTools.effectiveRecord(data, "voice_note", item)).filter(item => !item.excluded_from_findings);
    const activePhotoById = new Map(photos.map(item => [String(item.id), item]));
    const activeVoiceById = new Map(voices.map(item => [String(item.id), item]));
    const voidPhotoIds = new Set(data.photos.filter(item => !recordIsActive("photo", item.id)).map(item => String(item.id)));
    const voidVoiceIds = new Set(data.voice_notes.filter(item => !recordIsActive("voice_note", item.id)).map(item => String(item.id)));
    const markers = data.markers.map(item => governanceTools.effectiveRecord(data, "observation", item)).filter(item => !item.excluded_from_findings && !voidPhotoIds.has(String(item.photo_id || "")) && !voidVoiceIds.has(String(item.voice_note_id || ""))).map(item => {
      const photo = activePhotoById.get(String(item.photo_id || ""));
      const voice = activeVoiceById.get(String(item.voice_note_id || ""));
      if (photo) { item.area_id = photo.area_id || item.area_id || null; item.attributes = Object.assign({}, item.attributes || {}, { category: photo.category || null }); }
      if (voice) item.area_id = voice.area_id || item.area_id || null;
      return item;
    });
    return Object.assign({}, data, { markers, photos, voice_notes: voices });
  }

  function renderAuditHistory() {
    const history = document.getElementById("auditHistory");
    const summary = document.getElementById("auditSummary");
    if (!history || !summary || !governanceTools) return;
    governanceTools.ensureGovernanceModel(data);
    const corrections = data.corrections || [];
    const voided = corrections.filter(item => item.resulting_status === "voided").length;
    summary.textContent = corrections.length ? `${corrections.length} permanent correction${corrections.length === 1 ? "" : "s"}; ${voided} record${voided === 1 ? "" : "s"} excluded from findings.` : "No corrections recorded.";
    history.innerHTML = "";
    corrections.slice().reverse().slice(0, 8).forEach(item => {
      const row = document.createElement("p");
      row.className = "small";
      row.textContent = `${item.resulting_status.toUpperCase()} · ${item.correction_reason} · ${item.target.record_type} ${item.target.record_id} · ${new Date(item.correction_time).toLocaleString()} · ${item.inspector_identity}`;
      history.appendChild(row);
    });
  }

  function activeEvidenceSet() {
    return evidenceSetTools && data.active_evidence_set_id ? evidenceSetTools.effectiveEvidenceSet(data, data.active_evidence_set_id) : null;
  }

  function renderEvidenceSets() {
    if (!evidenceSetTools) return;
    evidenceSetTools.ensureEvidenceSetModel(data);
    const active = activeEvidenceSet();
    const banner = document.getElementById("evidenceSetBanner");
    banner.hidden = !active;
    if (active) {
      document.getElementById("evidenceSetBannerName").textContent = active.label;
      document.getElementById("evidenceSetBannerCount").textContent = `${active.photo_links.length} photograph${active.photo_links.length === 1 ? "" : "s"} saved`;
    }
    document.getElementById("addPlotTree").hidden = !active || active.set_type !== "Timber Sample Plot";
    const container = document.getElementById("evidenceSetList");
    container.innerHTML = "";
    const summaries = evidenceSetTools.createEvidenceSetSummaries(data).sets;
    summaries.slice().reverse().forEach(set => {
      const row = document.createElement("div");
      row.className = "evidence-set-row";
      const title = document.createElement("strong");
      title.textContent = `${set.label} · ${set.photograph_count} photo${set.photograph_count === 1 ? "" : "s"}`;
      const detail = document.createElement("p");
      detail.className = "small";
      detail.textContent = `${set.status}. Roles: ${set.photographs.map(item => `${item.photo_number || item.photo_id} ${item.role}`).join(", ") || "none yet"}.${set.missing_high_value_views.length ? ` Missing: ${set.missing_high_value_views.join(", ")}.` : " High-value views complete."}`;
      row.append(title, detail);
      container.appendChild(row);
    });
    (data.evidence_set_suggestions || []).filter(item => item.status === "pending_inspector_confirmation").forEach(suggestion => {
      const row = document.createElement("div");
      row.className = "evidence-set-row";
      const title = document.createElement("strong");
      title.textContent = "GROUP SUGGESTION — inspector confirmation required";
      const detail = document.createElement("p");
      detail.className = "small";
      detail.textContent = `${suggestion.suggested_label}: ${(suggestion.suggested_photo_roles || []).map(item => item.photo_number || item.photo_id).join(", ")}. ${suggestion.basis}`;
      const actions = document.createElement("div");
      actions.className = "suggestion-actions";
      const yes = document.createElement("button"); yes.type = "button"; yes.textContent = "Yes, same subject";
      const no = document.createElement("button"); no.type = "button"; no.textContent = "No, separate subjects"; no.className = "cancel";
      const select = document.createElement("button"); select.type = "button"; select.textContent = "Select which photos";
      const later = document.createElement("button"); later.type = "button"; later.textContent = "Ask me later"; later.className = "cancel";
      yes.addEventListener("click", () => {
        try {
          let confirmation = null;
          if (suggestion.suggested_measurement && suggestion.suggested_measurement.inspector_confirmation_required) {
            const range = `${suggestion.suggested_measurement.approximate_minimum}–${suggestion.suggested_measurement.approximate_maximum} ${suggestion.suggested_measurement.unit}`;
            const entered = prompt(`Inspector confirmation required. Enter the exact measured value for ${suggestion.suggested_measurement.measurement_photo_number}. The review described approximately ${range}.`, "");
            if (entered === null) return;
            confirmation = { exact_value: Number(entered), reached_true_endpoint: "Unknown", approximately_aligned: "Unknown", water_bottom_type: "Unknown" };
          }
          evidenceSetTools.confirmSuggestion(data, suggestion.suggestion_id, data.inspector_identity, confirmation); saveState(); renderEvidenceSets(); redraw(); setStatus("Evidence set confirmed. The photos and inspector-entered measurement will be reported as one subject.", "success");
        }
        catch (error) { setStatus(error.message, "error"); }
      });
      no.addEventListener("click", () => { suggestion.status = "rejected_by_inspector"; suggestion.reviewed_at = new Date().toISOString(); saveState(); renderEvidenceSets(); setStatus("Grouping rejected. The photographs remain separate evidence.", "active"); });
      select.addEventListener("click", () => {
        try {
          const offered = (suggestion.suggested_photo_roles || []).map(item => item.photo_number || item.photo_id).join(", ");
          const response = prompt("Enter the photo numbers that belong together, separated by commas.", offered);
          if (response === null) return;
          const wanted = new Set(response.split(",").map(item => item.trim().toUpperCase()).filter(Boolean));
          suggestion.suggested_photo_roles = (suggestion.suggested_photo_roles || []).filter(item => wanted.has(String(item.photo_number || item.photo_id).toUpperCase()));
          if (suggestion.suggested_photo_roles.length < 2) { setStatus("Choose at least two photographs for a group.", "warning"); return; }
          let confirmation = null;
          if (suggestion.suggested_measurement && suggestion.suggested_measurement.inspector_confirmation_required) {
            const entered = prompt(`Enter the inspector-confirmed exact value for ${suggestion.suggested_measurement.measurement_photo_number} in ${suggestion.suggested_measurement.unit}.`, "");
            if (entered === null) return;
            confirmation = { exact_value: Number(entered), reached_true_endpoint: "Unknown", approximately_aligned: "Unknown", water_bottom_type: "Unknown" };
          }
          evidenceSetTools.confirmSuggestion(data, suggestion.suggestion_id, data.inspector_identity, confirmation); saveState(); renderEvidenceSets(); setStatus("Selected photographs confirmed as one subject.", "success");
        } catch (error) { setStatus(error.message, "error"); }
      });
      later.addEventListener("click", () => { suggestion.last_deferred_at = new Date().toISOString(); saveState(); setStatus("Suggestion kept for later review. Nothing was grouped.", "active"); });
      actions.append(yes, no, select, later); row.append(title, detail, actions); container.appendChild(row);
    });
    if (!container.children.length) container.innerHTML = '<p class="small">No evidence sets yet.</p>';
    updateNextStep();
  }

  function showEvidenceSetFields() {
    const type = document.getElementById("evidenceSetType").value;
    document.getElementById("treeSetFields").hidden = !["Individual Tree", "Tree Group / Canopy"].includes(type);
    document.getElementById("flowingWaterSetFields").hidden = type !== "Flowing Water / Creek Corridor";
    document.getElementById("forestSetFields").hidden = type !== "Tree Group / Canopy";
    document.getElementById("timberPlotFields").hidden = type !== "Timber Sample Plot";
    document.getElementById("homesiteSetFields").hidden = type !== "Potential Homesite";
    if (type === "Tree Group / Canopy" && document.getElementById("treePurpose").value === "species identification") document.getElementById("treePurpose").value = "forest character";
    renderTreeEvidencePlan();
    renderFlowingWaterEvidencePlan();
    renderTimberPlotRadius();
  }

  function checkedValues(containerId) {
    return [...document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)].map(input => input.value);
  }

  function renderTimberPlotRadius() {
    if (!timberTools) return;
    const selected = document.getElementById("timberPlotSize").value;
    const custom = selected === "custom";
    document.getElementById("timberPlotCustomLabel").hidden = !custom;
    const acres = custom ? Number(document.getElementById("timberPlotCustomAcres").value) : Number(selected);
    const radius = timberTools.plotRadiusFeet(acres);
    document.getElementById("timberPlotRadius").innerHTML = `<strong>Radius:</strong> ${radius == null ? "Enter custom acres" : `${radius} feet from the GPS center`}.`;
  }

  function renderFlowingWaterEvidencePlan() {
    const target = document.getElementById("flowingWaterEvidencePlan");
    if (!target || !evidenceSetTools) return;
    const plan = evidenceSetTools.flowingWaterEvidencePlan();
    target.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = "Safely obtainable creek evidence";
    const list = document.createElement("ol");
    plan.required_roles.forEach(role => { const item = document.createElement("li"); item.textContent = role; list.appendChild(item); });
    const voice = document.createElement("p");
    voice.textContent = `Voice explanation: ${plan.voice_prompt}`;
    const safety = document.createElement("p");
    safety.textContent = plan.safety_rule;
    target.append(heading, list, voice, safety);
  }

  function renderTreeEvidencePlan() {
    const target = document.getElementById("treeEvidencePlan");
    if (!target || !evidenceSetTools) return;
    const plan = evidenceSetTools.treeEvidencePlan({
      whole_tree_visibility: document.getElementById("treeVisibility").value,
      purpose: document.getElementById("treePurpose").value
    });
    target.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = plan.obstruction_is_valid_evidence ? "Safe alternative sequence" : "Best evidence sequence";
    const list = document.createElement("ol");
    plan.required_roles.forEach(role => { const item = document.createElement("li"); item.textContent = role; list.appendChild(item); });
    const safety = document.createElement("p");
    safety.textContent = plan.safety_rule;
    target.append(heading, list, safety);
  }

  function openEvidenceSetDialog() {
    if (!evidenceSetTools) return;
    if (data.active_evidence_set_id) { setStatus("Finish the active subject before starting a new one.", "warning"); return; }
    document.getElementById("evidenceSetName").value = "";
    document.getElementById("treeVisibility").value = "Yes";
    document.getElementById("treeSpeciesStatus").value = "Unknown";
    showEvidenceSetFields();
    document.getElementById("evidenceSetDialog").showModal();
  }

  function evidenceSetDetails(type) {
    const treeDetails = {
      likely_species: document.getElementById("treeSpecies").value.trim() || "unknown", alternative_species: document.getElementById("treeAlternativeSpecies").value.split(",").map(item => item.trim()).filter(Boolean), species_confidence: document.getElementById("treeSpeciesConfidence").value,
      species_determination: document.getElementById("treeSpeciesStatus").value,
      whole_tree_visibility: document.getElementById("treeVisibility").value,
      whole_tree_visibility_reason: document.getElementById("treeVisibility").value === "Yes" ? null : document.getElementById("treeVisibility").value,
      dbh_in: Number(document.getElementById("treeDbh").value) || null, circumference_in: Number(document.getElementById("treeCircumference").value) || null,
      dbh_method: document.getElementById("treeDbhMethod").value, dbh_instrument: document.getElementById("treeDbhInstrument").value.trim(), dbh_confidence: document.getElementById("treeDbhConfidence").value,
      dbh_complications: checkedValues("treeDbhComplications"),
      total_height_estimate_ft: Number(document.getElementById("treeHeight").value) || null, usable_log_estimate_ft: Number(document.getElementById("treeLogHeight").value) || null,
      usable_16ft_logs: Number(document.getElementById("treeUsableLogs").value) || null, height_method: document.getElementById("treeHeightMethod").value,
      usable_timber_end_reason: checkedValues("treeUsableEnd"), defects_and_quality: checkedValues("treeDefects"), purposes: checkedValues("treePurposes"),
      condition: document.getElementById("treeCondition").value, purpose: document.getElementById("treePurpose").value,
      creek_or_homesite_relationship: document.getElementById("treeCreekRelationship").value.trim(), inspector_explanation: document.getElementById("treeExplanation").value.trim()
    };
    if (type === "Individual Tree") return treeDetails;
    if (type === "Tree Group / Canopy") return Object.assign(treeDetails, { canopy: document.getElementById("forestCanopy").value, tree_spacing: document.getElementById("forestSpacing").value.trim(), dominant_trunk_size_class: document.getElementById("forestTrunkSize").value.trim(), understory: document.getElementById("forestUnderstory").value, walkability: document.getElementById("forestWalkability").value, mature_trees_to_preserve: document.getElementById("forestPreserve").value.trim(), brush_or_small_stems_to_clear: document.getElementById("forestClearing").value.trim() });
    if (type === "Flowing Water / Creek Corridor") return {
      visible_flow: document.getElementById("creekVisibleFlow").value,
      flow_direction: document.getElementById("creekFlowDirection").value.trim() || "unknown",
      channel_width_ft: Number(document.getElementById("creekWidth").value) || null,
      channel_width_basis: document.getElementById("creekWidthBasis").value,
      safe_point_depth_in: Number(document.getElementById("creekDepth").value) || null,
      safe_point_depth_basis: document.getElementById("creekDepthBasis").value,
      bank_condition: document.getElementById("creekBankCondition").value.trim() || "not recorded",
      adjacent_higher_ground: document.getElementById("creekHigherGround").value.trim() || "not recorded",
      preserve_features: document.getElementById("creekPreserve").value.trim() || "not recorded",
      homesite_or_road_relationship: document.getElementById("creekRelationship").value.trim() || "not recorded",
      inspector_explanation: document.getElementById("creekWhyMatters").value.trim() || "not recorded",
      safety_confirmation: "Evidence recorded from safe, authorized ground; no channel crossing or standing in moving water was required."
    };
    if (type === "Timber Sample Plot") {
      const selected = document.getElementById("timberPlotSize").value;
      const acres = selected === "custom" ? Number(document.getElementById("timberPlotCustomAcres").value) : Number(selected);
      return {
        plot_size: selected === "custom" ? "Custom" : document.getElementById("timberPlotSize").selectedOptions[0].textContent,
        plot_acres: acres || null, radius_ft: timberTools ? timberTools.plotRadiusFeet(acres) : null,
        sampling_method: document.getElementById("timberSamplingMethod").value,
        canopy: document.getElementById("timberPlotCanopy").value, understory: document.getElementById("timberPlotUnderstory").value,
        access_conditions: document.getElementById("timberPlotAccess").value.trim(), wet_ground_conditions: document.getElementById("timberPlotWetGround").value.trim(),
        inclusion_rule: document.getElementById("timberPlotInclusionRule").value.trim(), selected_volume_equation: document.getElementById("timberVolumeEquation").value.trim() || null,
        tree_ids: []
      };
    }
    if (type === "Potential Homesite") return { candidate_area_center: lastPosition ? { latitude: lastPosition.lat, longitude: lastPosition.lon, accuracy_m: lastPosition.accuracy_m } : null, estimated_footprint_or_outline: document.getElementById("homesiteFootprint").value.trim(), view_direction: document.getElementById("homesiteViewDirection").value.trim(), access_direction: document.getElementById("homesiteAccessDirection").value.trim(), ground_observations: document.getElementById("homesiteGround").value.trim(), mature_trees_to_preserve: document.getElementById("homesitePreserve").value.trim(), brush_or_trees_to_remove: document.getElementById("homesiteRemove").value.trim(), nearby_water_evidence: document.getElementById("homesiteWater").value.trim(), inspector_explanation: document.getElementById("homesiteExplanation").value.trim() };
    return {};
  }

  function createEvidenceSetFromDialog() {
    try {
      const type = document.getElementById("evidenceSetType").value;
      const detailsBeforeStart = evidenceSetDetails(type);
      if (type === "Timber Sample Plot" && (!Number.isFinite(Number(detailsBeforeStart.plot_acres)) || Number(detailsBeforeStart.plot_acres) <= 0)) throw new Error("Enter a valid fixed plot size before starting.");
      if (type === "Timber Sample Plot" && !lastPosition) throw new Error("Wait for a current GPS position before starting the sample plot.");
      const set = evidenceSetTools.startEvidenceSet(data, { set_type: type, label: document.getElementById("evidenceSetName").value.trim() || null, created_by: data.inspector_identity, subject_details: detailsBeforeStart });
      if (["Individual Tree", "Tree Group / Canopy"].includes(type)) evidenceSetTools.recordSpeciesDetermination(data, set.evidence_set_id, document.getElementById("treeSpeciesStatus").value, document.getElementById("treeSpecies").value.trim() || "Unknown", data.inspector_identity);
      if (type === "Individual Tree" && timberTools) {
        const details = set.subject_details || {};
        const timberTree = timberTools.createTimberTree(data, {
          tree_id: set.tree_id, evidence_set_id: set.evidence_set_id, location: lastPosition ? { latitude: lastPosition.lat, longitude: lastPosition.lon, accuracy_m: lastPosition.accuracy_m } : null,
          probable_species: details.likely_species, alternative_species: details.alternative_species, identification_confidence: details.species_confidence, identification_status: details.species_determination,
          dbh_in: details.dbh_in, circumference_in: details.circumference_in, dbh_method: details.dbh_method, dbh_instrument: details.dbh_instrument, dbh_confidence: details.dbh_confidence, dbh_complications: details.dbh_complications,
          total_height_ft: details.total_height_estimate_ft, merchantable_height_ft: details.usable_log_estimate_ft, usable_16ft_logs: details.usable_16ft_logs, height_method: details.height_method,
          usable_timber_end_reason: details.usable_timber_end_reason, defects_and_quality: details.defects_and_quality, purposes: details.purposes, inspector_explanation: details.inspector_explanation
        });
        set.subject_details.timber_tree_id = timberTree.tree_id;
      }
      if (type === "Timber Sample Plot" && timberTools) {
        const details = set.subject_details || {};
        const plot = timberTools.createSamplePlot(data, {
          evidence_set_id: set.evidence_set_id, plot_size: details.plot_size, plot_acres: details.plot_acres,
          center: lastPosition ? { latitude: lastPosition.lat, longitude: lastPosition.lon, accuracy_m: lastPosition.accuracy_m, recorded_at: lastPosition.time } : null,
          sampling_method: details.sampling_method, convenience_or_targeted_location: /targeted|convenience/i.test(details.sampling_method), canopy: details.canopy, understory: details.understory,
          access_conditions: details.access_conditions, wet_ground_conditions: details.wet_ground_conditions, inclusion_rule: details.inclusion_rule, selected_volume_equation: details.selected_volume_equation
        });
        set.subject_details.plot_id = plot.plot_id;
      }
      document.getElementById("evidenceSetDialog").close();
      saveState(); renderEvidenceSets(); updateControls();
      setStatus(`${set.label} started. Every photo and voice note now attaches to this subject until you finish it.`, "active");
      takePhoto({ evidence_set_id: set.evidence_set_id });
    } catch (error) { setStatus(error.message, "error"); }
  }

  function openPlotTreeDialog() {
    const active = activeEvidenceSet();
    if (!active || active.set_type !== "Timber Sample Plot" || !timberTools) return;
    const plot = data.timber_plots.find(item => item.evidence_set_id === active.evidence_set_id);
    if (!plot) { setStatus("The active timber plot record could not be found.", "error"); return; }
    pendingPlotTreeId = plot.plot_id;
    document.getElementById("plotTreePlotName").textContent = `${active.label}: record every qualifying tree rooted within ${plot.radius_ft} feet of the GPS center.`;
    ["plotTreeSpecies", "plotTreeAlternatives", "plotTreeDbh", "plotTreeCircumference", "plotTreeInstrument", "plotTreeMerchantableHeight", "plotTreeLogs", "plotTreeDefects", "plotTreePurposes", "plotTreeExplanation"].forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("plotTreeStatus").value = "Unknown";
    document.getElementById("plotTreeConfidence").value = "low";
    document.getElementById("plotTreeDbhMethod").value = "Not measured";
    document.getElementById("plotTreeDbhConfidence").value = "unknown";
    document.getElementById("plotTreeHeightMethod").value = "Unknown";
    document.getElementById("plotTreeProduct").value = "Unknown";
    document.getElementById("plotTreePhoto").checked = true;
    plotTreeDialog.showModal();
  }

  function commaValues(id) {
    return document.getElementById(id).value.split(",").map(item => item.trim()).filter(Boolean);
  }

  function savePlotTree() {
    const active = activeEvidenceSet();
    const plot = timberTools && data.timber_plots.find(item => item.plot_id === pendingPlotTreeId);
    if (!active || !plot) return;
    try {
      const method = document.getElementById("plotTreeDbhMethod").value;
      const tree = timberTools.createTimberTree(data, {
        plot_id: plot.plot_id, evidence_set_id: active.evidence_set_id,
        location: lastPosition ? { latitude: lastPosition.lat, longitude: lastPosition.lon, accuracy_m: lastPosition.accuracy_m, recorded_at: lastPosition.time } : null,
        probable_species: document.getElementById("plotTreeSpecies").value.trim() || "Unknown",
        alternative_species: commaValues("plotTreeAlternatives"), identification_status: document.getElementById("plotTreeStatus").value, identification_confidence: document.getElementById("plotTreeConfidence").value,
        dbh_method: method, dbh_in: document.getElementById("plotTreeDbh").value, circumference_in: document.getElementById("plotTreeCircumference").value,
        dbh_instrument: document.getElementById("plotTreeInstrument").value.trim(), dbh_confidence: document.getElementById("plotTreeDbhConfidence").value,
        merchantable_height_ft: document.getElementById("plotTreeMerchantableHeight").value, usable_16ft_logs: document.getElementById("plotTreeLogs").value,
        height_method: document.getElementById("plotTreeHeightMethod").value, product_category: document.getElementById("plotTreeProduct").value,
        defects_and_quality: commaValues("plotTreeDefects"), purposes: commaValues("plotTreePurposes"), inspector_explanation: document.getElementById("plotTreeExplanation").value.trim()
      });
      const sourceSet = data.evidence_sets.find(item => item.evidence_set_id === active.evidence_set_id);
      if (sourceSet) sourceSet.subject_details.tree_ids = plot.tree_ids.slice();
      plot.active_tree_id = tree.tree_id;
      if (tree.dbh && tree.dbh.dbh_in && tree.dbh.basis !== "Not measured") {
        const measurement = timberTools.recordMeasurement(data, {
          measurement_type: "Tree diameter", value: tree.dbh.dbh_in, unit: "in", basis: tree.dbh.basis === "Estimated" ? "Estimated" : "Measured",
          instrument: tree.dbh.instrument, reached_true_endpoint: "Yes", approximately_aligned: "Not applicable",
          subject_id: tree.tree_id, evidence_set_id: active.evidence_set_id, timber_tree_id: tree.tree_id, timber_plot_id: plot.plot_id,
          location: tree.location, recorded_by: data.inspector_identity
        });
        evidenceSetTools.attachRecord(data, active.evidence_set_id, "measurement", measurement.measurement_id, { created_by: data.inspector_identity });
      }
      const takeSupportingPhoto = document.getElementById("plotTreePhoto").checked;
      plotTreeDialog.close();
      pendingPlotTreeId = null;
      saveState(); renderEvidenceSets();
      setStatus(`${tree.tree_id} saved in ${active.label}. ${plot.tree_ids.length} qualifying tree${plot.tree_ids.length === 1 ? "" : "s"} recorded.`, "success");
      if (takeSupportingPhoto) takePhoto({ evidence_set_id: active.evidence_set_id, timber_tree_id: tree.tree_id, category: "Timber Sample", note: `Supporting photograph for ${tree.tree_id}` });
    } catch (error) { setStatus(`PLOT TREE NOT SAVED: ${error.message}`, "error"); }
  }

  function finishActiveEvidenceSet() {
    const active = activeEvidenceSet();
    if (!active) return;
    if (active.set_type === "Timber Sample Plot" && timberTools) {
      const plot = data.timber_plots.find(item => item.evidence_set_id === active.evidence_set_id || item.plot_id === (active.subject_details && active.subject_details.plot_id));
      if (plot) {
        timberTools.finishPlot(data, plot.plot_id);
        active.subject_details.tree_ids = plot.tree_ids.slice();
      }
    }
    const finished = evidenceSetTools.finishEvidenceSet(data, active.evidence_set_id, active.subject_details || {});
    saveState(); renderEvidenceSets(); updateControls();
    const summary = evidenceSetTools.summarizeEvidenceSet(data, finished);
    setStatus(summary.missing_high_value_views.length ? `${finished.label} saved. Missing useful views: ${summary.missing_high_value_views.join(", ")}.` : `${finished.label} saved as one complete subject.`, summary.missing_high_value_views.length ? "warning" : "success");
  }

  function attachToActiveEvidenceSet(recordType, record, role) {
    if (!evidenceSetTools || !data.active_evidence_set_id || !record) return null;
    const active = evidenceSetTools.effectiveEvidenceSet(data, data.active_evidence_set_id);
    if (!active) return null;
    if ((active.record_links || []).some(link => link.record_type === recordType && String(link.record_id) === String(record.id))) return null;
    return evidenceSetTools.attachRecord(data, active.evidence_set_id, recordType, record, { photo_role: role || "Context", created_by: data.inspector_identity });
  }

  function openUndoLast() {
    if (!governanceTools) return;
    const target = governanceTools.recordsForCorrection(data).find(item => governanceTools.recordStatus(data, item.record_type, item.record_id) !== "voided");
    if (!target) { setStatus("There is no active action to undo.", "warning"); return; }
    pendingUndoTarget = target;
    const seconds = Math.max(0, Math.round((Date.now() - new Date(target.recorded_at).getTime()) / 1000));
    document.getElementById("undoDescription").textContent = `Undo ${target.label} recorded ${seconds < 60 ? `${seconds} seconds` : `${Math.round(seconds / 60)} minutes`} ago? The original will remain in audit history.`;
    document.getElementById("undoDialog").showModal();
  }

  function confirmUndoLast() {
    if (!pendingUndoTarget) return;
    try {
      const correction = governanceTools.undoLastAction(data, { record_type: pendingUndoTarget.record_type, record_id: pendingUndoTarget.record_id, inspector_identity: data.inspector_identity });
      data.lifecycle_events.push({ type: "user_undo_recorded", time: correction.corrected_at, correction_id: correction.correction_id, target: correction.target, source: "field_control" });
      pendingUndoTarget = null; document.getElementById("undoDialog").close(); saveState(); redraw(); renderAuditHistory(); renderEvidenceSets(); renderCoaching();
      setStatus("Last action voided. The original remains permanently preserved in audit history.", "success");
    } catch (error) { setStatus(error.message, "error"); }
  }

  function completeGroupPhotoChoice(action) {
    const photoId = pendingGroupPhotoId;
    const active = activeEvidenceSet();
    if (!photoId || !active) { document.getElementById("groupPhotoDialog").close(); return; }
    try {
      const role = document.getElementById("groupPhotoRole").value;
      evidenceSetTools.setPhotoRole(data, active.evidence_set_id, photoId, role, { created_by: data.inspector_identity });
      const photo = data.photos.find(item => String(item.id) === String(photoId));
      if (photo && ["Measurement", "Water depth", "Channel width", "Scale photograph", "DBH tape position"].includes(role)) photo.structured_measurement_required = true;
      if (["Leaf upper surface", "Leaf underside"].includes(role)) evidenceSetTools.recordLeafProvenance(data, active.evidence_set_id, photoId, document.getElementById("leafProvenance").value, data.inspector_identity);
      if (photo && photo.timber_tree_id && timberTools) {
        const tree = timberTools.attachPhotoToTree(data, photo.timber_tree_id, photoId, role === "Visible defect");
        if (tree) {
          tree.identification_evidence = tree.identification_evidence || {};
          if (role === "Bark") tree.identification_evidence.bark = true;
          if (role === "Twig / terminal bud") tree.identification_evidence.twig_and_bud = true;
          if (role === "Fruit / seed / cone / flower") tree.identification_evidence.reproductive_material = true;
          if (role === "Connected branch" || (["Leaf upper surface", "Leaf underside"].includes(role) && document.getElementById("leafProvenance").value.startsWith("Yes"))) tree.identification_evidence.connected_leaf_or_needle = true;
          if (role === "DBH tape position") tree.dbh.tape_position_photo_id = photoId;
        }
      }
      if (action === "remove") evidenceSetTools.detachRecord(data, active.evidence_set_id, "photo", photoId, "inspector_removed_after_capture");
      if (["finish", "new"].includes(action)) evidenceSetTools.finishEvidenceSet(data, active.evidence_set_id, active.subject_details || {});
      document.getElementById("groupPhotoDialog").close(); pendingGroupPhotoId = null; saveState(); renderEvidenceSets();
      if (action === "new") openNewEvidenceSetAfterPhotoReview = true;
      beginPhotoExplanation(photoId);
    } catch (error) { setStatus(error.message, "error"); }
  }

  function completePostPhotoReviewFlow() {
    if (openNewEvidenceSetAfterPhotoReview) { openNewEvidenceSetAfterPhotoReview = false; pendingSubjectChangePrompt = null; openEvidenceSetDialog(); return; }
    if (pendingSubjectChangePrompt) {
      const promptData = pendingSubjectChangePrompt; pendingSubjectChangePrompt = null;
      if (window.confirm(`${promptData.prompt}\n\nPrevious: ${promptData.previous_subject}\nNow: ${promptData.current_subject}`)) openEvidenceSetDialog();
    }
  }

  function openCorrectionDialog(preferredTarget) {
    if (!governanceTools) return;
    const records = governanceTools.recordsForCorrection(data);
    if (!records.length) {
      setStatus("There is no saved record to correct yet.", "warning");
      return;
    }
    const target = document.getElementById("correctionTarget");
    target.innerHTML = "";
    records.forEach(record => {
      const option = document.createElement("option");
      option.value = JSON.stringify({ record_type: record.record_type, record_id: record.record_id });
      option.textContent = `${new Date(record.recorded_at).toLocaleTimeString()} · ${record.label}`;
      target.appendChild(option);
    });
    if (preferredTarget) {
      const preferredValue = JSON.stringify(preferredTarget);
      if ([...target.options].some(option => option.value === preferredValue)) target.value = preferredValue;
    }
    const area = document.getElementById("correctionArea");
    area.innerHTML = '<option value="">No area change</option>';
    data.inspection_areas.forEach(item => {
      const option = document.createElement("option");
      option.value = item.area_id;
      option.textContent = item.name;
      area.appendChild(option);
    });
    const question = document.getElementById("correctionQuestion");
    question.innerHTML = '<option value="">No question change</option>';
    data.investigation_questions.forEach(item => {
      const option = document.createElement("option"); option.value = item.question_id; option.textContent = item.text; question.appendChild(option);
    });
    document.getElementById("correctionReason").value = "Correct";
    document.getElementById("correctionCategory").value = "";
    document.getElementById("correctionClarification").value = "";
    document.getElementById("correctionInspector").value = data.inspector_identity || "Field Inspector";
    correctionDialog.showModal();
  }

  function savePermanentCorrection() {
    try {
      const target = JSON.parse(document.getElementById("correctionTarget").value);
      const category = document.getElementById("correctionCategory").value;
      const areaId = document.getElementById("correctionArea").value;
      const questionId = document.getElementById("correctionQuestion").value;
      const clarification = document.getElementById("correctionClarification").value.trim();
      const reason = document.getElementById("correctionReason").value;
      if (reason === "Wrong category" && !category) throw new Error("Choose the corrected category.");
      if (reason === "Wrong inspection area" && !areaId) throw new Error("Choose the corrected inspection area.");
      if (reason === "Wrong question" && !questionId) throw new Error("Choose the corrected investigation question.");
      if (reason === "Needs clarification" && !clarification) throw new Error("Enter the clarification.");
      const correctedValue = {};
      if (category) {
        if (target.record_type === "photo") correctedValue.category = buttonLabels[category] || category;
        else { correctedValue.type = category; correctedValue.label = buttonLabels[category] || category; }
      }
      if (areaId) correctedValue.area_id = areaId;
      if (questionId) correctedValue.question_ids = [questionId];
      if (clarification) correctedValue.clarification = clarification;
      const correction = governanceTools.addCorrection(data, {
        record_type: target.record_type,
        record_id: target.record_id,
        correction_reason: reason,
        corrected_value: correctedValue,
        inspector_identity: document.getElementById("correctionInspector").value
      });
      data.lifecycle_events.push({ type: "evidence_correction_recorded", time: correction.correction_time, correction_id: correction.correction_id, target: correction.target, resulting_status: correction.resulting_status, source: "field_control" });
      saveState();
      correctionDialog.close();
      renderAuditHistory();
      renderEvidenceSets();
      redraw();
      renderCoaching();
      renderGallery();
      setStatus(`${correction.correction_reason} saved. The original remains in the permanent audit history.`, correction.resulting_status === "voided" ? "warning" : "active");
    } catch (error) {
      setStatus(`CORRECTION NOT SAVED: ${error.message}`, "error");
    }
  }

  function populateHypothesisEvidence() {
    const observationSelect = document.getElementById("hypothesisObservations");
    const photoSelect = document.getElementById("hypothesisPhotos");
    const contradictionSelect = document.getElementById("hypothesisContradictions");
    [observationSelect, photoSelect, contradictionSelect].forEach(select => { select.innerHTML = ""; });
    data.markers.filter(item => recordIsActive("observation", item.id) && item.record_class !== "inspector_thought").slice().reverse().forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.button_label || item.type} · ${new Date(item.time).toLocaleTimeString()}`;
      observationSelect.appendChild(option);
      contradictionSelect.appendChild(option.cloneNode(true));
    });
    data.photos.filter(item => recordIsActive("photo", item.id)).slice().reverse().forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.photo_number || "Photo"} · ${item.category || "Other"}`;
      photoSelect.appendChild(option);
      const contradiction = option.cloneNode(true);
      contradiction.value = `photo:${item.id}`;
      contradictionSelect.appendChild(contradiction);
    });
  }

  function openHypothesisDialog() {
    populateHypothesisEvidence();
    ["hypothesisStatement", "hypothesisQuestion", "hypothesisNextStep", "hypothesisContradiction"].forEach(id => { document.getElementById(id).value = ""; });
    hypothesisDialog.showModal();
  }

  function selectedValues(id) {
    return [...document.getElementById(id).selectedOptions].map(option => option.value);
  }

  function saveInspectorHypothesis() {
    const statement = document.getElementById("hypothesisStatement").value.trim();
    const question = document.getElementById("hypothesisQuestion").value.trim();
    if (!statement || !question) {
      setStatus("A hypothesis statement and exact verification question are required.", "warning");
      return;
    }
    const context = currentEvidenceContext();
    const hypothesis = {
      hypothesis_id: makeId("hypothesis"),
      recorded_at: new Date().toISOString(),
      statement,
      evidence_classification: "Interpretation / Needs Professional Verification",
      factual_status: "NOT_AN_OBSERVED_FACT",
      triggering_observation_ids: selectedValues("hypothesisObservations"),
      supporting_photo_ids: selectedValues("hypothesisPhotos"),
      contradicting_evidence_ids: selectedValues("hypothesisContradictions"),
      contradicting_evidence_note: document.getElementById("hypothesisContradiction").value.trim(),
      verification_question: question,
      professional_type: document.getElementById("hypothesisProfessional").value,
      cheapest_next_evidence_step: document.getElementById("hypothesisNextStep").value.trim(),
      area_id: context.area_id,
      question_ids: context.question_ids,
      gps: lastPosition ? { latitude: lastPosition.lat, longitude: lastPosition.lon, accuracy_m: lastPosition.accuracy_m, position_at: lastPosition.time } : null,
      prohibition: "Do not recommend construction or state that the hypothesis will work without professional verification.",
      immutable: true
    };
    data.inspector_hypotheses.push(hypothesis);
    data.lifecycle_events.push({ type: "inspector_hypothesis_recorded", time: hypothesis.recorded_at, hypothesis_id: hypothesis.hypothesis_id, source: "field_control" });
    saveState();
    hypothesisDialog.close();
    setStatus("Inspector hypothesis saved separately from observed facts.", "active");
  }

  function addInspectionArea() {
    const input = document.getElementById("newArea");
    const name = input.value.trim();
    if (!name) {
      setStatus("Type a short area name, such as Road Frontage, Creek, or South Ridge.", "warning");
      input.focus();
      return;
    }
    const area = { area_id: makeId("area"), name, created_at: new Date().toISOString(), description: "" };
    data.inspection_areas.push(area);
    data.active_area_id = area.area_id;
    input.value = "";
    data.lifecycle_events.push({ type: "inspection_area_selected", time: new Date().toISOString(), area_id: area.area_id, area_name: area.name, source: "button_press" });
    saveState(); renderCoaching();
    setStatus(`Current area is now ${area.name}. New evidence will attach automatically.`, "active");
  }

  function addInvestigationQuestion() {
    const input = document.getElementById("newQuestion");
    const text = input.value.trim();
    if (!text) {
      setStatus("Type the uncertainty you want this inspection to answer.", "warning");
      input.focus();
      return;
    }
    const question = { question_id: makeId("question"), text, created_at: new Date().toISOString(), status: "open", answer_summary: "", confidence: null, decision_categories: [] };
    data.investigation_questions.push(question);
    data.active_question_ids.push(question.question_id);
    input.value = "";
    saveState(); renderCoaching();
    setStatus("Question added and selected. New evidence will attach to it automatically.", "active");
  }

  function showDepartureReview() {
    const state = calculateCoachingState(true);
    const review = state.missing_evidence_review;
    const coverage = state.coverage;
    document.getElementById("departureSummary").textContent = coverage.status === "ESTIMATED"
      ? `${coverage.not_inspected.percent}% of parcel cells are estimated not inspected. ${review.important_questions_remaining.length} investigation question(s) still have an evidence or answer gap.`
      : `${review.important_questions_remaining.length} investigation question(s) still have an evidence or answer gap. Coverage could not be estimated.`;
    const list = document.getElementById("departureActions");
    list.innerHTML = "";
    const actions = review.highest_value_next_actions.length ? review.highest_value_next_actions.slice() : [{ action: "Review the route, questions, and Critical photographs before creating the package." }];
    const missingExplanations = data.photos.filter(photo => !(photo.explanation_voice_note_ids || []).length && !photo.explanation_voice_note_id);
    const unreviewedWater = data.photos.filter(photo => !photo.water_confirmation);
    if (missingExplanations.length) actions.unshift({ action: `${missingExplanations.length} photograph${missingExplanations.length === 1 ? " lacks" : "s lack"} a voice explanation. Explain the Critical photographs before leaving when safe.` });
    if (unreviewedWater.length) actions.unshift({ action: `${unreviewedWater.length} photograph${unreviewedWater.length === 1 ? " has" : "s have"} not been reviewed for visible water. Confirm Water, No, or Unsure before leaving.` });
    actions.forEach(action => { const item = document.createElement("li"); item.textContent = action.action; list.appendChild(item); });
    departureDialog.showModal();
  }

  function openPhotoDbConnection() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is unavailable."));
        return;
      }
      const request = indexedDB.open(photoDbName, 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(photoStoreName)) db.createObjectStore(photoStoreName, { keyPath: "id" });
        if (!db.objectStoreNames.contains(voiceStoreName)) db.createObjectStore(voiceStoreName, { keyPath: "id" });
        if (!db.objectStoreNames.contains(voiceChunkStoreName)) {
          const chunks = db.createObjectStore(voiceChunkStoreName, { keyPath: "key" });
          chunks.createIndex("voice_id", "voice_id", { unique: false });
        }
        if (!db.objectStoreNames.contains(gpsStoreName)) {
          const gps = db.createObjectStore(gpsStoreName, { keyPath: "key" });
          gps.createIndex("inspection_id", "inspection_id", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Evidence database could not be opened."));
      request.onblocked = () => reject(new Error("Evidence database is blocked by another open Property Inspector tab."));
    });
  }

  function ensureEvidenceDbManager() {
    if (!dbRecoveryTools) throw new Error("IndexedDB recovery code failed to load.");
    if (!evidenceDb) evidenceDb = dbRecoveryTools.createConnectionManager({ openConnection: openPhotoDbConnection });
    return evidenceDb;
  }

  function openPhotoDb() {
    return ensureEvidenceDbManager().open();
  }

  function withEvidenceTransaction(storeNames, mode, operation) {
    return ensureEvidenceDbManager().transaction(storeNames, mode, operation);
  }

  function transactionRequest(transaction, request, message, transform) {
    return new Promise((resolve, reject) => {
      let value;
      request.onsuccess = () => { value = typeof transform === "function" ? transform(request.result) : request.result; };
      request.onerror = () => reject(request.error || new Error(message));
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error || new Error(message));
      transaction.onabort = () => reject(transaction.error || new DOMException(message, "AbortError"));
    });
  }

  function transactionCompletion(transaction, message) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error(message));
      transaction.onabort = () => reject(transaction.error || new DOMException(message, "AbortError"));
    });
  }

  function photoStorePut(record) {
    return withEvidenceTransaction(photoStoreName, "readwrite", transaction => {
      const request = transaction.objectStore(photoStoreName).put(record);
      return transactionRequest(transaction, request, "Photograph could not be stored.");
    });
  }

  function photoStoreGet(id) {
    return withEvidenceTransaction(photoStoreName, "readonly", transaction => {
      const request = transaction.objectStore(photoStoreName).get(id);
      return transactionRequest(transaction, request, "Photograph could not be read.", result => result || null);
    });
  }

  function photoStoreGetAll() {
    return withEvidenceTransaction(photoStoreName, "readonly", transaction => new Promise((resolve, reject) => {
      const records = [];
      const request = transaction.objectStore(photoStoreName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value || {};
        records.push({ id: value.id, inspection_id: value.inspection_id, metadata: value.metadata, event: value.event });
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error("Stored photographs could not be inventoried."));
      transaction.oncomplete = () => resolve(records);
      transaction.onerror = () => reject(transaction.error || new Error("Stored photographs could not be inventoried."));
      transaction.onabort = () => reject(transaction.error || new DOMException("Stored photograph inventory was aborted.", "AbortError"));
    }));
  }

  function photoStoreSizeInventory(inspectionId) {
    return withEvidenceTransaction(photoStoreName, "readonly", transaction => new Promise((resolve, reject) => {
      const records = [];
      const request = transaction.objectStore(photoStoreName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value || {};
        if (String(value.inspection_id || "") === String(inspectionId || "")) {
          records.push({
            id: value.id,
            originalBlob: { size: value.originalBlob ? Number(value.originalBlob.size) || 0 : 0 },
            analysisBlob: { size: value.analysisBlob ? Number(value.analysisBlob.size) || 0 : 0 }
          });
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error("Photograph sizes could not be inventoried."));
      transaction.oncomplete = () => resolve(records);
      transaction.onerror = () => reject(transaction.error || new Error("Photograph sizes could not be inventoried."));
      transaction.onabort = () => reject(transaction.error || new DOMException("Photograph size inventory was aborted.", "AbortError"));
    }));
  }

  function photoStoreClear() {
    return withEvidenceTransaction([photoStoreName, voiceStoreName, voiceChunkStoreName, gpsStoreName], "readwrite", transaction => {
      transaction.objectStore(photoStoreName).clear();
      transaction.objectStore(voiceStoreName).clear();
      transaction.objectStore(voiceChunkStoreName).clear();
      transaction.objectStore(gpsStoreName).clear();
      return transactionCompletion(transaction, "Evidence attachments could not be cleared.");
    });
  }

  function voiceStorePut(record) {
    return withEvidenceTransaction(voiceStoreName, "readwrite", transaction => {
      const request = transaction.objectStore(voiceStoreName).put(record);
      return transactionRequest(transaction, request, "Voice note could not be stored.");
    });
  }

  function voiceStoreGet(id) {
    return withEvidenceTransaction(voiceStoreName, "readonly", transaction => {
      const request = transaction.objectStore(voiceStoreName).get(id);
      return transactionRequest(transaction, request, "Voice note could not be read.", result => result || null);
    });
  }

  function voiceStoreGetAll() {
    return withEvidenceTransaction(voiceStoreName, "readonly", transaction => new Promise((resolve, reject) => {
      const records = [];
      const request = transaction.objectStore(voiceStoreName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value || {};
        records.push({ id: value.id, inspection_id: value.inspection_id, metadata: value.metadata, event: value.event });
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error("Stored voice notes could not be inventoried."));
      transaction.oncomplete = () => resolve(records);
      transaction.onerror = () => reject(transaction.error || new Error("Stored voice notes could not be inventoried."));
      transaction.onabort = () => reject(transaction.error || new DOMException("Stored voice-note inventory was aborted.", "AbortError"));
    }));
  }

  function voiceChunkPut(voiceId, sequence, chunk) {
    const record = { key: `${voiceId}:${String(sequence).padStart(8, "0")}`, voice_id: voiceId, sequence, chunk };
    return withEvidenceTransaction(voiceChunkStoreName, "readwrite", transaction => {
      const request = transaction.objectStore(voiceChunkStoreName).put(record);
      return transactionRequest(transaction, request, "Voice-note recovery chunk could not be stored.");
    });
  }

  function voiceChunksGet(voiceId) {
    return withEvidenceTransaction(voiceChunkStoreName, "readonly", transaction => {
      const index = transaction.objectStore(voiceChunkStoreName).index("voice_id");
      const request = index.getAll(IDBKeyRange.only(voiceId));
      return transactionRequest(transaction, request, "Voice-note recovery chunks could not be read.", result => (result || []).sort((a, b) => a.sequence - b.sequence));
    });
  }

  async function voiceChunksDelete(voiceId) {
    const chunks = await voiceChunksGet(voiceId);
    return withEvidenceTransaction(voiceChunkStoreName, "readwrite", transaction => {
      const store = transaction.objectStore(voiceChunkStoreName);
      chunks.forEach(chunk => store.delete(chunk.key));
      return transactionCompletion(transaction, "Voice-note recovery chunks could not be cleared.");
    });
  }

  function gpsPointPut(inspectionId, point) {
    const record = { key: `${inspectionId}:${String(point.sequence).padStart(10, "0")}`, inspection_id: inspectionId, point };
    return withEvidenceTransaction(gpsStoreName, "readwrite", transaction => {
      const request = transaction.objectStore(gpsStoreName).put(record);
      return transactionRequest(transaction, request, "GPS point could not be stored.");
    });
  }

  function gpsPointsGet(inspectionId) {
    return withEvidenceTransaction(gpsStoreName, "readonly", transaction => {
      const index = transaction.objectStore(gpsStoreName).index("inspection_id");
      const request = index.getAll(IDBKeyRange.only(inspectionId));
      return transactionRequest(transaction, request, "GPS recovery points could not be read.", result => (result || []).map(record => record.point).sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || String(a.time).localeCompare(String(b.time))));
    });
  }

  function revalidatePhotoDb() {
    return ensureEvidenceDbManager().healthCheck(photoStoreName);
  }

  async function reconcileGpsPoints() {
    if (!data.inspection_id) return;
    data.points.forEach((point, index) => { if (!Number.isFinite(point.sequence)) point.sequence = index + 1; });
    const stored = await gpsPointsGet(data.inspection_id);
    const storedIdentities = new Set(stored.map(point => `${point.sequence}|${point.time}|${point.lat}|${point.lon}`));
    data.points.filter(point => !storedIdentities.has(`${point.sequence}|${point.time}|${point.lat}|${point.lon}`)).forEach(point => {
      gpsWriteQueue = gpsWriteQueue.then(() => gpsPointPut(data.inspection_id, point));
    });
    const byIdentity = new Map();
    [...stored, ...data.points].forEach(point => byIdentity.set(`${point.sequence}|${point.time}|${point.lat}|${point.lon}`, point));
    data.points = Array.from(byIdentity.values()).sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || String(a.time).localeCompare(String(b.time)));
    data.points.forEach((point, index) => { point.sequence = index + 1; });
    await gpsWriteQueue;
    saveState();
  }

  async function requestDurableStorage() {
    try {
      if (navigator.storage && typeof navigator.storage.persist === "function") await navigator.storage.persist();
    } catch (error) {
      // IndexedDB remains usable even where persistent-storage requests are unsupported.
    }
  }

  async function migrateLegacyPhotos() {
    let changed = false;
    for (let index = 0; index < data.photos.length; index += 1) {
      const photo = data.photos[index];
      if (!photo || !photo.dataUrl) continue;
      const blob = packageTools.dataUrlToBlob(photo.dataUrl);
      const id = photo.id || makeId("photo");
      await photoStorePut({ id, originalBlob: blob, analysisBlob: blob });
      Object.assign(photo, {
        id,
        recorded_at: photo.time || new Date().toISOString(),
        original_filename: `legacy_photo_${String(index + 1).padStart(3, "0")}.jpg`,
        original_mime_type: blob.type || "image/jpeg",
        original_size_bytes: blob.size,
        legacy_resized_photo: true,
        pixel_orientation: null,
        exif_orientation: null,
        exif_orientation_description: null
      });
      delete photo.dataUrl;
      changed = true;
    }
    if (changed) saveState();
    if (localStorage.getItem(stateKey)) localStorage.removeItem(legacyStateKey);
  }

  async function reconcileStoredPhotos() {
    if (!data.inspection_id) return;
    const records = await photoStoreGetAll();
    let changed = false;
    records.forEach(record => {
      if (!record.metadata || String(record.inspection_id || "") !== String(data.inspection_id)) return;
      if (!data.photos.some(photo => String(photo.id) === String(record.id))) {
        data.photos.push(record.metadata);
        changed = true;
      }
      if (record.event && !data.markers.some(marker => String(marker.id) === String(record.event.id))) {
        data.markers.push(record.event);
        changed = true;
      }
    });
    if (changed) {
      data.photos.sort((a, b) => String(a.recorded_at || a.time).localeCompare(String(b.recorded_at || b.time)));
      data.markers.sort((a, b) => String(a.time).localeCompare(String(b.time)));
      saveState();
      setStatus("A photograph interrupted by the previous app close was recovered.", "warning");
    }
  }

  async function reconcileStoredVoiceNotes() {
    if (!data.inspection_id) return;
    const records = await voiceStoreGetAll();
    let changed = false;
    for (const record of records) {
      if (!record.metadata || String(record.inspection_id || "") !== String(data.inspection_id)) continue;
      if (!data.voice_notes.some(note => String(note.id) === String(record.id))) {
        data.voice_notes.push(record.metadata);
        changed = true;
      }
      if (record.event && !data.markers.some(marker => String(marker.id) === String(record.event.id))) {
        data.markers.push(record.event);
        changed = true;
      }
      if (record.metadata.photo_id) {
        try { await attachExplanationToPhoto(record.metadata.photo_id, record.id); changed = true; } catch (error) { /* Retry on the next safe startup reconciliation. */ }
      }
    }
    if (changed) {
      data.voice_notes.sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
      data.markers.sort((a, b) => String(a.time).localeCompare(String(b.time)));
      saveState();
      setStatus("A completed voice note interrupted by the previous app close was recovered.", "warning");
    }
  }

  function sx(lon) { return (lon - xmin) / (xmax - xmin) * W; }
  function sy(lat) { return H - ((lat - ymin) / (ymax - ymin) * H); }

  function addSvg(tag, attributes, text) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== undefined) element.textContent = text;
    svg.appendChild(element);
    return element;
  }

  function haversine(a, b) {
    const radius = 6371000;
    const radians = Math.PI / 180;
    const deltaLat = (b.lat - a.lat) * radians;
    const deltaLon = (b.lon - a.lon) * radians;
    const lat1 = a.lat * radians;
    const lat2 = b.lat * radians;
    const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(h));
  }

  function totalDistance() {
    let meters = 0;
    for (let i = 1; i < data.points.length; i += 1) meters += haversine(data.points[i - 1], data.points[i]);
    return meters;
  }

  function formatDuration(milliseconds) {
    if (milliseconds > 0 && milliseconds < 60000) return "<1 min";
    const totalMinutes = Math.max(0, Math.floor((milliseconds || 0) / 60000));
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hr ${minutes} min`;
  }

  function updateTimeMetrics() {
    const metrics = packageTools.calculateInspectionMetrics(data, watchId !== null ? new Date().toISOString() : null);
    document.getElementById("elapsedTime").textContent = formatDuration(metrics.elapsed_time_ms);
    document.getElementById("activeTime").textContent = formatDuration(metrics.active_movement_time_ms);
    document.getElementById("stoppedTime").textContent = formatDuration(metrics.stopped_time_ms);
  }

  const conditionBindings = {
    conditionDate: "inspection_date",
    conditionWeather: "weather_summary",
    conditionRain24: "rainfall_previous_24_hours",
    conditionRain7: "rainfall_previous_7_days",
    conditionRain30: "rainfall_previous_30_days",
    conditionTemperature: "temperature",
    conditionGround: "ground_condition",
    conditionRainDuring: "rain_during_inspection",
    conditionEvidence: "evidence_classification"
  };
  const weatherContextBindings = {
    weatherEventName: "named_event", weatherEventDates: "event_dates", weatherDaysSince: "days_between_event_and_inspection",
    weatherAuthoritativeRain: "authoritative_rainfall_totals", weatherStationDistance: "weather_station_distance_from_parcel",
    weatherLocalRain: "inspector_reported_recent_local_rain", weatherMechanism: "potentially_relevant_mechanism"
  };

  function renderConditions() {
    Object.entries(conditionBindings).forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (element) element.value = data.conditions[key] || "";
    });
    Object.entries(weatherContextBindings).forEach(([id, key]) => { const element = document.getElementById(id); if (element) element.value = data.weather_context[key] || (id === "weatherMechanism" ? "unknown" : ""); });
    document.getElementById("allWaterPhotographed").checked = Boolean(data.water_observation_rule && data.water_observation_rule.all_observed_standing_water_photographed);
  }

  function saveConditionsFromUi() {
    Object.entries(conditionBindings).forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (element) data.conditions[key] = element.value.trim();
    });
    Object.entries(weatherContextBindings).forEach(([id, key]) => { const element = document.getElementById(id); if (element) data.weather_context[key] = element.value.trim(); });
    saveState();
  }

  function markerStyle(type) {
    return {
      wet: { fill: "#1c6bd1", label: "WET" },
      dry: { fill: "#8a6b17", label: "DRY" },
      blocked: { fill: "#d62424", label: "BLOCK" },
      high: { fill: "#b34700", label: "HIGH" },
      homesite: { fill: "#177252", label: "HOME" },
      culvert: { fill: "#275975", label: "CULV" },
      tree: { fill: "#327019", label: "TREE" },
      entrance: { fill: "#75551c", label: "ENTRY" },
      wildlife: { fill: "#5b4d1b", label: "WILD" },
      thick: { fill: "#3d6424", label: "BRUSH" },
      open: { fill: "#758f35", label: "OPEN" },
      ditch: { fill: "#2e6684", label: "DITCH" },
      timber: { fill: "#214f16", label: "TIMBER" },
      hazard: { fill: "#aa1818", label: "HAZ" },
      other: { fill: "#555", label: "OTHER" },
      note: { fill: "#555", label: "NOTE" },
      photo: { fill: "#6a3fa0", label: "PIC" },
      voice_note: { fill: "#9b1e58", label: "VOICE" }
    }[type] || { fill: "#555", label: String(type || "").toUpperCase() };
  }

  function pointPath(coordinates) {
    return coordinates.map((point, index) => `${index ? "L" : "M"}${sx(point[0]).toFixed(1)} ${sy(point[1]).toFixed(1)}`).join(" ") + " Z";
  }

  function drawPropertyLines() {
    parcelFeatures.forEach(feature => {
      const geometry = feature.geometry || {};
      const properties = feature.attributes || {};
      const isSubject = String(properties.PAR_NUM || "") === "221S280000001010000";
      (geometry.rings || []).forEach(ring => {
        if (isSubject) {
          addSvg("path", { d: pointPath(ring), fill: "rgba(255,255,255,.01)", stroke: "#ff2020", "stroke-width": 8, "vector-effect": "non-scaling-stroke" });
        } else {
          addSvg("path", { d: pointPath(ring), fill: "none", stroke: "#111", "stroke-width": 5, "vector-effect": "non-scaling-stroke", opacity: 0.5 });
          addSvg("path", { d: pointPath(ring), fill: "none", stroke: "#fff", "stroke-width": 2, "vector-effect": "non-scaling-stroke" });
        }
      });
    });
  }

  function drawCoverageOverlay() {
    if (!coachingTools) return;
    const state = calculateCoachingState(false);
    if (!state || state.coverage.status !== "ESTIMATED") return;
    const styles = {
      well_inspected: { fill: "#35c759", opacity: 0.24 },
      lightly_inspected: { fill: "#ffe34f", opacity: 0.22 },
      not_inspected: { fill: "#666", opacity: 0.18 }
    };
    state.coverage.cells.forEach(cell => {
      const style = styles[cell.classification];
      addSvg("rect", {
        x: sx(cell.west), y: sy(cell.north), width: Math.max(1, sx(cell.east) - sx(cell.west)), height: Math.max(1, sy(cell.south) - sy(cell.north)),
        fill: style.fill, opacity: style.opacity, stroke: "none"
      });
    });
  }

  function waterLayerEnabled(name) {
    const control = document.querySelector(`[data-water-layer="${name}"]`);
    return !control || control.checked;
  }

  function addWaterSvg(tag, attributes, text) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== undefined) element.textContent = text;
    smallWaterMap.appendChild(element);
    return element;
  }

  function projectedRingPath(ring) {
    return (ring || []).map((point, index) => `${index ? "L" : "M"}${sx(point[0]).toFixed(1)} ${sy(point[1]).toFixed(1)}`).join(" ") + " Z";
  }

  function renderSmallTractWaterMap() {
    if (!waterTools || !smallWaterMap) return;
    smallWaterMap.innerHTML = "";
    const subject = subjectParcel();
    const waterInspection = effectiveEvidenceData();
    waterInspection.evidence_set_summaries = evidenceSetTools ? evidenceSetTools.createEvidenceSetSummaries(data) : { sets: [] };
    smallTractWaterModel = waterTools.buildSmallTractWaterMapModel({ inspection: waterInspection, subjectFeature: subject, statedSmallTractAcres: 5.49 });
    const summary = document.getElementById("smallWaterSummary");
    if (!smallTractWaterModel || smallTractWaterModel.status !== "GENERATED") {
      summary.textContent = "The verified small-tract parcel ring is unavailable. Evidence capture remains active.";
      return;
    }
    const bounds = smallTractWaterModel.small_tract.bounds;
    const left = sx(bounds.west);
    const right = sx(bounds.east);
    const top = sy(bounds.north);
    const bottom = sy(bounds.south);
    const padding = Math.max(28, Math.max(right - left, bottom - top) * 0.08);
    smallWaterMap.setAttribute("viewBox", `${left - padding} ${top - padding} ${right - left + padding * 2} ${bottom - top + padding * 2}`);
    if (waterLayerEnabled("terrain")) addWaterSvg("image", { href: "./assets/usgs-terrain.png", x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none" });
    if (waterLayerEnabled("contours")) addWaterSvg("image", { href: "./assets/usgs-contours-2ft.png", x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none", opacity: .78 });
    const boundaryPath = projectedRingPath(smallTractWaterModel.small_tract.boundary);
    addWaterSvg("path", { d: boundaryPath, fill: waterLayerEnabled("unknown") ? "rgba(75,75,75,.28)" : "rgba(255,255,255,.04)", stroke: "#d71920", "stroke-width": 8, "vector-effect": "non-scaling-stroke" });
    if (waterLayerEnabled("route")) {
      smallTractWaterModel.route_segments.forEach(segment => {
        const d = segment.map((point, index) => `${index ? "L" : "M"}${sx(point.lon).toFixed(1)} ${sy(point.lat).toFixed(1)}`).join(" ");
        if (!d) return;
        if (smallTractWaterModel.inspected_no_standing_water.enabled) addWaterSvg("path", { d, fill: "none", stroke: "rgba(73,180,96,.34)", "stroke-width": 44, "vector-effect": "non-scaling-stroke" });
        addWaterSvg("path", { d, fill: "none", stroke: "#111", "stroke-width": 11, "vector-effect": "non-scaling-stroke" });
        addWaterSvg("path", { d, fill: "none", stroke: "#ffe600", "stroke-width": 6, "vector-effect": "non-scaling-stroke" });
      });
    }
    (smallTractWaterModel.flowing_water_corridors || []).forEach(corridor => {
      const coordinates = corridor.conservative_centerline && corridor.conservative_centerline.coordinates || [];
      if (waterLayerEnabled("centerline") && coordinates.length > 1) {
        const d = coordinates.map((point, index) => `${index ? "L" : "M"}${sx(point[0]).toFixed(1)} ${sy(point[1]).toFixed(1)}`).join(" ");
        const line = addWaterSvg("path", { d, fill: "none", stroke: "#00b7ff", "stroke-width": 9, "stroke-dasharray": "18 10", "vector-effect": "non-scaling-stroke" });
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = corridor.classification;
        line.appendChild(title);
      }
      if (waterLayerEnabled("directions")) (corridor.flow_direction_arrows || []).forEach(arrow => {
        const x1 = sx(arrow.from[0]), y1 = sy(arrow.from[1]), x2 = sx(arrow.to[0]), y2 = sy(arrow.to[1]);
        addWaterSvg("line", { x1, y1, x2, y2, stroke: "#001f5b", "stroke-width": 8, "vector-effect": "non-scaling-stroke" });
        const angle = Math.atan2(y2 - y1, x2 - x1), size = 17;
        const points = [[x2, y2], [x2 - size * Math.cos(angle - .55), y2 - size * Math.sin(angle - .55)], [x2 - size * Math.cos(angle + .55), y2 - size * Math.sin(angle + .55)]].map(point => point.join(",")).join(" ");
        addWaterSvg("polygon", { points, fill: "#001f5b" });
      });
      if (waterLayerEnabled("measurements")) [...(corridor.measured_depth_points || []), ...(corridor.measured_width_points || [])].forEach(point => {
        addWaterSvg("circle", { cx: sx(point.longitude), cy: sy(point.latitude), r: 12, fill: "#fff", stroke: "#002b6f", "stroke-width": 5, "vector-effect": "non-scaling-stroke" });
        addWaterSvg("text", { x: sx(point.longitude), y: sy(point.latitude) + 5, "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: "#002b6f" }, point.depth_in != null ? "D" : "W");
      });
      if (waterLayerEnabled("amenity")) (corridor.amenity_photographs || []).forEach(point => {
        addWaterSvg("circle", { cx: sx(point.longitude), cy: sy(point.latitude), r: 25, fill: "none", stroke: "#e2bd00", "stroke-width": 7, "vector-effect": "non-scaling-stroke" });
      });
    });
    if (waterLayerEnabled("avoidance")) smallTractWaterModel.preliminary_building_avoidance_areas.forEach(area => {
      if (!area.outline) return;
      addWaterSvg("path", { d: projectedRingPath(area.outline), fill: "rgba(194,20,40,.16)", stroke: "#c21428", "stroke-width": 7, "stroke-dasharray": "18 10", "vector-effect": "non-scaling-stroke" });
    });
    if (waterLayerEnabled("outlines")) smallTractWaterModel.water_area_clusters.forEach(cluster => {
      if (!cluster.estimated_outline) return;
      addWaterSvg("path", { d: projectedRingPath(cluster.estimated_outline), fill: "rgba(30,115,220,.25)", stroke: "#1768c4", "stroke-width": 6, "stroke-dasharray": "15 10", "vector-effect": "non-scaling-stroke" });
      addWaterSvg("text", { x: sx(cluster.center.longitude), y: sy(cluster.center.latitude) - 24, "text-anchor": "middle", "font-size": 22, "font-weight": 900, fill: "#052f56", stroke: "#fff", "stroke-width": 5, "paint-order": "stroke" }, cluster.water_area_id);
    });
    if (waterLayerEnabled("dry")) smallTractWaterModel.high_dry_observations.forEach(item => {
      if (String(item.type || "").includes("homesite") && !waterLayerEnabled("homesites")) return;
      addWaterSvg("circle", { cx: sx(item.location.lon), cy: sy(item.location.lat), r: 12, fill: "#45a146", stroke: "#fff", "stroke-width": 4, "vector-effect": "non-scaling-stroke" });
    });
    if (waterLayerEnabled("standing")) smallTractWaterModel.wet_observations.forEach(item => {
      const x = sx(item.location.lon), y = sy(item.location.lat);
      addWaterSvg("rect", { x: x - 10, y: y - 10, width: 20, height: 20, transform: `rotate(45 ${x} ${y})`, fill: "#74c6ff", stroke: "#003f8f", "stroke-width": 4, "vector-effect": "non-scaling-stroke" });
    });
    smallTractWaterModel.water_photographs.forEach(item => {
      const flowing = item.significance === "Flowing-water corridor";
      if (flowing && !waterLayerEnabled("flowing")) return;
      if (!flowing && !waterLayerEnabled("standing")) return;
      if (item.significance === "Minor localized depression" && !waterLayerEnabled("minor")) return;
      if ((item.significance === "Moderate pooled area" || item.significance === "Larger connected wet area") && !waterLayerEnabled("larger")) return;
      const marker = addWaterSvg("g", { role: "button", tabindex: 0, "data-photo-id": item.photo_id, "aria-label": `${item.photo_number || "Water photo"}: ${item.significance}` });
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      Object.entries({ cx: sx(item.longitude), cy: sy(item.latitude), r: flowing ? 22 : 17, fill: flowing ? "#003f8f" : "#1687e0", stroke: "#fff", "stroke-width": 5, "vector-effect": "non-scaling-stroke" }).forEach(([key, value]) => circle.setAttribute(key, String(value)));
      marker.appendChild(circle);
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${item.photo_number || "Photo"} · ${item.significance} · ${item.depth.label}`;
      marker.appendChild(title);
      const open = () => openWaterPhoto(item.photo_id);
      marker.addEventListener("click", open);
      marker.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
    const mapped = smallTractWaterModel.water_photographs.length;
    const clusterCount = smallTractWaterModel.water_area_clusters.length;
    summary.textContent = `${smallTractWaterModel.small_tract.stated_acres.toFixed(2)} acres · ${mapped} confirmed or legacy water photograph${mapped === 1 ? "" : "s"} · ${clusterCount} conservative water-area cluster${clusterCount === 1 ? "" : "s"}. Evidence outside the small-tract boundary is excluded.`;
  }

  async function openWaterPhoto(photoId) {
    const metadata = data.photos.find(photo => String(photo.id) === String(photoId));
    if (!metadata) return;
    if (waterPhotoObjectUrl) URL.revokeObjectURL(waterPhotoObjectUrl);
    if (waterVoiceObjectUrl) URL.revokeObjectURL(waterVoiceObjectUrl);
    waterPhotoObjectUrl = null;
    waterVoiceObjectUrl = null;
    const stored = await photoStoreGet(photoId);
    if (!stored || !(stored.analysisBlob instanceof Blob)) return;
    waterPhotoObjectUrl = URL.createObjectURL(stored.analysisBlob);
    document.getElementById("waterPhotoImage").src = waterPhotoObjectUrl;
    document.getElementById("waterPhotoTitle").textContent = `${metadata.photo_number || "Photo"} — ${metadata.water && metadata.water.significance || "Water evidence"}`;
    const water = metadata.water || {};
    document.getElementById("waterPhotoDetails").textContent = `${water.water_type || "Unknown water type"} · depth ${water.water_depth_band || water.water_depth_exact_in || "unknown"} · ${water.water_width_ft || "unknown"} ft wide × ${water.water_length_ft || "unknown"} ft long · ${water.measurement_basis || "unknown basis"} · ${new Date(metadata.recorded_at).toLocaleString()}`;
    const voiceId = (metadata.explanation_voice_note_ids || [])[0] || metadata.explanation_voice_note_id;
    const audio = document.getElementById("waterPhotoAudio");
    audio.hidden = true;
    audio.removeAttribute("src");
    if (voiceId) {
      const voice = await voiceStoreGet(voiceId);
      if (voice && voice.audioBlob instanceof Blob) {
        waterVoiceObjectUrl = URL.createObjectURL(voice.audioBlob);
        audio.src = waterVoiceObjectUrl;
        audio.hidden = false;
      }
    }
    waterPhotoDialog.showModal();
  }

  function redraw() {
    svg.innerHTML = "";
    drawPropertyLines();
    drawCoverageOverlay();
    const visiblePoints = data.points.filter(point => point.lon >= xmin && point.lon <= xmax && point.lat >= ymin && point.lat <= ymax);
    const pathStride = Math.max(1, Math.ceil(visiblePoints.length / 1500));
    const displayPoints = visiblePoints.filter((point, index) => index % pathStride === 0 || index === visiblePoints.length - 1);
    if (displayPoints.length > 1) {
      const path = displayPoints.map((point, index) => `${index ? "L" : "M"}${sx(point.lon).toFixed(1)} ${sy(point.lat).toFixed(1)}`).join(" ");
      addSvg("path", { d: path, fill: "none", stroke: "#111", "stroke-width": 10, "vector-effect": "non-scaling-stroke", opacity: 0.82 });
      addSvg("path", { d: path, fill: "none", stroke: "#ffe54a", "stroke-width": 5, "vector-effect": "non-scaling-stroke" });
    }
    const dotStride = Math.max(5, Math.ceil(visiblePoints.length / 150));
    visiblePoints.forEach((point, index) => {
      if (index % dotStride !== 0 && index !== visiblePoints.length - 1) return;
      addSvg("circle", {
        cx: sx(point.lon), cy: sy(point.lat), r: index === visiblePoints.length - 1 ? 14 : 6,
        fill: index === visiblePoints.length - 1 ? "#00e0ff" : "#ffe54a", stroke: "#111", "stroke-width": 3
      });
    });
    const activeEvidence = effectiveEvidenceData();
    activeEvidence.markers.forEach(marker => {
      if (marker.lon < xmin || marker.lon > xmax || marker.lat < ymin || marker.lat > ymax) return;
      const style = markerStyle(marker.type);
      const x = sx(marker.lon);
      const y = sy(marker.lat);
      addSvg("circle", { cx: x, cy: y, r: 20, fill: style.fill, stroke: "#fff", "stroke-width": 5 });
      addSvg("text", { x, y: y + 5, "text-anchor": "middle", "font-size": 12, "font-family": "Arial", "font-weight": 900, fill: "#fff", "paint-order": "stroke", stroke: "#000", "stroke-width": 2 }, style.label);
    });
    document.getElementById("pointCount").textContent = data.points.length;
    document.getElementById("photoCount").textContent = data.photos.length;
    document.getElementById("eventCount").textContent = activeEvidence.markers.length;
    document.getElementById("voiceCount").textContent = activeEvidence.voice_notes.length;
    const feet = totalDistance() * 3.280839895;
    document.getElementById("distance").textContent = feet < 5280 ? `${Math.round(feet)} ft` : `${(feet / 5280).toFixed(2)} mi`;
    updateTimeMetrics();
    renderCoverage();
    renderSmallTractWaterMap();
    updateControls();
  }

  async function renderGallery() {
    const renderId = ++galleryRenderId;
    galleryUrls.forEach(url => URL.revokeObjectURL(url));
    galleryUrls = [];
    gallery.innerHTML = "";
    if (!data.photos.length) {
      const empty = document.createElement("p");
      empty.className = "small";
      empty.textContent = "No photographs recorded yet. At least one photograph is required to finish an inspection.";
      gallery.appendChild(empty);
      document.getElementById("galleryPager").hidden = true;
      return;
    }
    const totalPages = Math.ceil(data.photos.length / galleryPageSize);
    galleryPage = Math.max(0, Math.min(galleryPage, totalPages - 1));
    const start = galleryPage * galleryPageSize;
    const end = Math.min(data.photos.length, start + galleryPageSize);
    const pager = document.getElementById("galleryPager");
    pager.hidden = totalPages <= 1;
    document.getElementById("galleryPageInfo").textContent = `${start + 1}–${end} of ${data.photos.length}`;
    document.getElementById("galleryPrevious").disabled = galleryPage === 0;
    document.getElementById("galleryNext").disabled = galleryPage >= totalPages - 1;
    for (let index = start; index < end; index += 1) {
      const metadata = data.photos[index];
      const card = document.createElement("div");
      card.className = "thumb";
      const recordStatus = governanceTools ? governanceTools.recordStatus(data, "photo", metadata.id) : "active";
      if (recordStatus === "voided") card.classList.add("photo-error");
      const image = document.createElement("img");
      image.alt = `Inspection photograph ${index + 1}`;
      image.loading = "lazy";
      image.decoding = "async";
      const caption = document.createElement("div");
      caption.textContent = `${metadata.photo_number || `P${index + 1}`} · ${metadata.category || "Other"} · ${new Date(metadata.recorded_at || metadata.time).toLocaleString()}`;
      const location = document.createElement("div");
      location.textContent = `${Number(metadata.lat).toFixed(6)}, ${Number(metadata.lon).toFixed(6)} · ±${Math.round(metadata.gps_accuracy_m)} m`;
      const valueSelect = document.createElement("select");
      valueSelect.className = "photo-value-select";
      valueSelect.setAttribute("aria-label", `Evidence value for ${metadata.photo_number || `P${index + 1}`}`);
      (coachingTools ? coachingTools.PHOTO_VALUES : ["Critical", "Helpful", "Reference", "Duplicate"]).forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        valueSelect.appendChild(option);
      });
      valueSelect.value = metadata.photo_value || "Helpful";
      valueSelect.addEventListener("change", () => updatePhotoValue(metadata.id, valueSelect.value));
      const waterButton = document.createElement("button");
      waterButton.type = "button";
      waterButton.className = "review-water-photo";
      waterButton.textContent = metadata.water_confirmation === "yes" ? `Water: ${metadata.water && metadata.water.water_type ? metadata.water.water_type.replaceAll("_", " ") : "Confirmed"}` : (metadata.water_confirmation === "no" ? "Water: No" : (metadata.water_confirmation === "unsure" ? "Water: Unsure" : "Review for Water"));
      waterButton.addEventListener("click", () => openWaterClassification(metadata.id));
      const meaningButton = document.createElement("button");
      meaningButton.type = "button";
      const pattern = governanceTools ? governanceTools.photoPattern(metadata) : { missing: [] };
      meaningButton.textContent = metadata.photo_meaning && metadata.photo_meaning.status === "complete" ? `Photo meaning · ${pattern.missing.length ? `${pattern.missing.length} evidence roles missing` : "4-part pattern complete"}` : "Explain Photo Meaning";
      meaningButton.addEventListener("click", () => openPhotoMeaning(metadata.id));
      const correctButton = document.createElement("button");
      correctButton.type = "button";
      correctButton.textContent = recordStatus === "voided" ? "View / Correct Audit Status" : "Correct This Photo";
      correctButton.addEventListener("click", () => openCorrectionDialog({ record_type: "photo", record_id: metadata.id }));
      if (recordStatus === "voided") caption.textContent += " · VOIDED — audit only";
      card.append(image, caption, location, valueSelect, meaningButton, waterButton, correctButton);
      gallery.appendChild(card);
      try {
        const stored = await photoStoreGet(metadata.id);
        if (renderId !== galleryRenderId) return;
        if (!stored || !stored.originalBlob) throw new Error("Original bytes missing");
        const preview = stored.analysisBlob || stored.originalBlob;
        const url = URL.createObjectURL(preview);
        galleryUrls.push(url);
        image.src = url;
      } catch (error) {
        card.classList.add("photo-error");
        image.remove();
        const warning = document.createElement("strong");
        warning.textContent = "PHOTO BYTES MISSING — package export is blocked";
        card.prepend(warning);
      }
    }
  }

  async function updatePhotoValue(photoId, value) {
    if (coachingTools && !coachingTools.PHOTO_VALUES.includes(value)) return;
    try {
      const stored = await photoStoreGet(photoId);
      if (!stored || !stored.metadata) throw new Error("Photo record could not be read.");
      stored.metadata.photo_value = value;
      await photoStorePut(stored);
      const metadata = data.photos.find(photo => String(photo.id) === String(photoId));
      if (metadata) metadata.photo_value = value;
      saveState();
      renderCoaching();
      setStatus(`${metadata && metadata.photo_number ? metadata.photo_number : "Photo"} marked ${value}.`, "active");
    } catch (error) {
      setStatus(`PHOTO VALUE NOT SAVED: ${error.message}`, "error");
      await renderGallery();
    }
  }

  async function loadParcels() {
    try {
      const response = await fetch("./assets/parcels.json", { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parcelData = await response.json();
      if (!parcelData || !Array.isArray(parcelData.features)) throw new Error("Parcel response did not contain features.");
      parcelFeatures = parcelData.features;
      redraw();
    } catch (error) {
      parcelFeatures = [];
      redraw();
      setStatus("Parcel map could not be displayed. Evidence capture remains available, but restore the parcel data before Finish Inspection.", "warning");
    }
  }

  async function keepAwake() {
    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch (error) {
      // The page remains usable; the permanent field warning tells the operator to keep the screen awake.
    }
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    try { wakeLock.release(); } catch (error) { /* already released */ }
    wakeLock = null;
  }

  function updateControls() {
    const tracking = watchId !== null;
    const recordingVoice = Boolean(mediaRecorder && mediaRecorder.state === "recording");
    startBtn.textContent = data.started && !tracking ? "Resume Existing Inspection" : "Start Inspection";
    startBtn.disabled = !offlineReady || tracking || photoBusy || packageBusy || recordingVoice;
    stopBtn.disabled = !tracking || photoBusy || packageBusy || recordingVoice;
    markerButtons.forEach(button => { button.disabled = !tracking || photoBusy || packageBusy || recordingVoice; });
    voiceBtn.disabled = !tracking || photoBusy || packageBusy;
    finishBtn.disabled = !data.started || photoBusy || packageBusy || recordingVoice;
    clearBtn.disabled = photoBusy || packageBusy || recordingVoice;
    document.getElementById("backup").disabled = !data.started || photoBusy || packageBusy || recordingVoice;
    fullArchiveBtn.disabled = !data.started || photoBusy || packageBusy || recordingVoice;
    retryPendingPhotoBtn.disabled = photoBusy || packageBusy || recordingVoice;
    correctRecordBtn.disabled = photoBusy || packageBusy || recordingVoice || !(data.markers.length || data.photos.length || data.voice_notes.length);
    undoLastBtn.disabled = photoBusy || packageBusy || recordingVoice || !governanceTools || !governanceTools.recordsForCorrection(data).some(item => governanceTools.recordStatus(data, item.record_type, item.record_id) !== "voided");
    document.getElementById("startPhotoGroup").disabled = !tracking || photoBusy || packageBusy || recordingVoice || Boolean(data.active_evidence_set_id);
    document.getElementById("finishEvidenceSet").disabled = photoBusy || packageBusy || recordingVoice || !data.active_evidence_set_id;
    const activeSet = activeEvidenceSet();
    document.getElementById("addPlotTree").disabled = photoBusy || packageBusy || recordingVoice || !activeSet || activeSet.set_type !== "Timber Sample Plot";
    updateNextStep();
  }

  function orientationNumber(value) {
    return Number.isFinite(value) ? value : null;
  }

  function angularDifference(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    const difference = Math.abs(a - b) % 360;
    return Math.min(difference, 360 - difference);
  }

  function onDeviceOrientation(event) {
    const now = Date.now();
    if (now - lastOrientationProcessedAt < 1000) return;
    lastOrientationProcessedAt = now;
    const webkitHeading = orientationNumber(event.webkitCompassHeading);
    const alpha = orientationNumber(event.alpha);
    const compassHeading = webkitHeading != null ? webkitHeading : (event.absolute && alpha != null ? (360 - alpha + 360) % 360 : null);
    latestOrientation = {
      time: new Date().toISOString(),
      alpha_deg: alpha,
      beta_deg: orientationNumber(event.beta),
      gamma_deg: orientationNumber(event.gamma),
      absolute: Boolean(event.absolute),
      compass_heading_deg: compassHeading,
      compass_accuracy_deg: orientationNumber(event.webkitCompassAccuracy),
      lat: lastPosition ? lastPosition.lat : null,
      lon: lastPosition ? lastPosition.lon : null,
      gps_accuracy_m: lastPosition ? lastPosition.accuracy_m : null
    };
    const elapsedSinceSave = now - lastOrientationSavedAt;
    const headingChanged = lastSavedOrientation && angularDifference(compassHeading, lastSavedOrientation.compass_heading_deg) >= 15;
    const tiltChanged = lastSavedOrientation && (
      Math.abs((latestOrientation.beta_deg || 0) - (lastSavedOrientation.beta_deg || 0)) >= 20 ||
      Math.abs((latestOrientation.gamma_deg || 0) - (lastSavedOrientation.gamma_deg || 0)) >= 20
    );
    if (!lastSavedOrientation || elapsedSinceSave >= 30000 || (elapsedSinceSave >= 5000 && (headingChanged || tiltChanged))) {
      lastOrientationSavedAt = now;
      data.orientation_samples.push(latestOrientation);
      lastSavedOrientation = Object.assign({}, latestOrientation);
      saveState();
    }
    document.getElementById("heading").textContent = compassHeading == null ? "—" : `${Math.round(compassHeading)}°`;
  }

  async function requestOrientationAccess() {
    try {
      if (typeof DeviceOrientationEvent === "undefined") return false;
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") return false;
      }
      window.addEventListener("deviceorientation", onDeviceOrientation, true);
      return true;
    } catch (error) {
      return false;
    }
  }

  function stopOrientationCapture() {
    window.removeEventListener("deviceorientation", onDeviceOrientation, true);
  }

  function onPosition(position) {
    const coordinates = position.coords;
    const point = {
      time: new Date(position.timestamp).toISOString(),
      lat: coordinates.latitude,
      lon: coordinates.longitude,
      accuracy_m: coordinates.accuracy,
      altitude_m: Number.isFinite(coordinates.altitude) ? coordinates.altitude : null,
      altitude_accuracy_m: Number.isFinite(coordinates.altitudeAccuracy) ? coordinates.altitudeAccuracy : null,
      speed_mps: Number.isFinite(coordinates.speed) ? coordinates.speed : null,
      heading_deg: Number.isFinite(coordinates.heading) ? coordinates.heading : (latestOrientation ? latestOrientation.compass_heading_deg : null),
      device_orientation: latestOrientation ? {
        alpha_deg: latestOrientation.alpha_deg,
        beta_deg: latestOrientation.beta_deg,
        gamma_deg: latestOrientation.gamma_deg,
        compass_heading_deg: latestOrientation.compass_heading_deg
      } : null
    };
    point.sequence = data.points.length ? (data.points[data.points.length - 1].sequence || data.points.length) + 1 : 1;
    data.points.push(point);
    coverageDirty = true;
    gpsWriteQueue = gpsWriteQueue
      .then(() => gpsPointPut(data.inspection_id, point))
      .catch(error => {
        gpsStorageFailed = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        stopOrientationCapture();
        releaseWakeLock();
        setStatus(`GPS STORAGE FAILED: ${error.message} Stop the inspection and preserve the phone.`, "error");
        updateControls();
      });
    try {
      saveState();
    } catch (error) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      stopOrientationCapture();
      releaseWakeLock();
      updateControls();
      return;
    }
    document.getElementById("pointCount").textContent = data.points.length;
    if (data.points.length === 1 || data.points.length % 5 === 0) redraw();
    lastPosition = point;
    document.getElementById("accuracy").textContent = `${Math.round(coordinates.accuracy)} m`;
    document.getElementById("location").textContent = `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
    setStatus(`GPS active · accuracy ±${Math.round(coordinates.accuracy)} m · ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`, "active");
  }

  function onGpsError(error) {
    setStatus(`GPS error: ${error.message}. Allow location access and Precise Location.`, "error");
  }

  async function startTracking() {
    if (gpsStorageFailed) {
      setStatus("GPS storage previously failed. Do not resume; finish and preserve the current inspection now.", "error");
      return;
    }
    if (!offlineReady) {
      setStatus("Offline preparation is not complete. Inspection cannot begin safely.", "error");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("This browser does not provide GPS. Inspection cannot begin.", "error");
      return;
    }
    const orientationPermission = requestOrientationAccess();
    try {
      await revalidatePhotoDb();
    } catch (error) {
      setStatus("Durable photograph storage is unavailable. Inspection cannot begin safely in this browser.", "error");
      return;
    }
    await requestDurableStorage();
    await orientationPermission;
    if (!data.inspection_id) data.inspection_id = makeId("inspection");
    const startedAt = new Date().toISOString();
    const resuming = Boolean(data.started);
    data.started = data.started || startedAt;
    if (!data.conditions.inspection_date) {
      data.conditions.inspection_date = startedAt.slice(0, 10);
      renderConditions();
    }
    data.stopped = null;
    data.lifecycle_events.push({ type: resuming ? "inspection_resumed" : "inspection_started", time: startedAt, source: "button_press" });
    lastPosition = null;
    saveState();
    updateTimeMetrics();
    await reconcileGpsPoints();
    watchId = navigator.geolocation.watchPosition(onPosition, onGpsError, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    updateControls();
    await keepAwake();
    setStatus("GPS starting. Wait for the first precise location before adding evidence.", "active");
  }

  function stopTracking(options) {
    const settings = options || {};
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    stopOrientationCapture();
    releaseWakeLock();
    data.stopped = settings.time || new Date().toISOString();
    if (settings.reason !== "clear") data.lifecycle_events.push({ type: settings.reason === "finish" ? "inspection_finished" : "inspection_paused", time: data.stopped, source: "button_press" });
    saveState();
    updateControls();
    if (!settings.silent) setStatus("Tracking stopped. Use Finish Inspection to create the complete one-file package.", "normal");
  }

  function markerFromPosition(type, note, photoId, time, positionOverride, details) {
    const position = positionOverride || lastPosition;
    const settings = details || {};
    const context = currentEvidenceContext();
    return {
      id: makeId("event"),
      source: settings.source || "button_press",
      record_class: settings.recordClass || "evidence_observation",
      type,
      observation_type: `field.${type}`,
      taxonomy_version: "property-observation-1.0",
      button_label: buttonLabels[type] || type,
      note: note || "",
      evidence_classification: settings.evidenceClassification || "Observed",
      attributes: Object.assign({}, settings.attributes || {}),
      area_id: settings.areaId || context.area_id,
      question_ids: Array.isArray(settings.questionIds) ? settings.questionIds.slice() : context.question_ids,
      question_links: Array.isArray(settings.questionLinks) ? settings.questionLinks.map(link => Object.assign({}, link)) : context.question_links,
      time: time || new Date().toISOString(),
      lat: position.lat,
      lon: position.lon,
      gps_accuracy_m: position.accuracy_m,
      gps_position_at: position.time,
      compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : position.heading_deg,
      device_orientation: latestOrientation ? {
        alpha_deg: latestOrientation.alpha_deg,
        beta_deg: latestOrientation.beta_deg,
        gamma_deg: latestOrientation.gamma_deg,
        absolute: latestOrientation.absolute
      } : null,
      photo_id: photoId || null
    };
  }

  function addMarker(type, options) {
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Marker was not recorded.", "warning");
      return;
    }
    const settings = options || {};
    let note = settings.note || "";
    if (type === "note") {
      const response = prompt("Type the field note:");
      if (response === null) return;
      note = response;
    } else if (type === "thought") {
      const response = prompt("What are you thinking? Record your judgment, theory, concern, or preference. This will be kept separate from observed evidence.");
      if (response === null || !response.trim()) return;
      note = response.trim();
      settings.evidenceClassification = "Interpretation";
      settings.source = "inspector_reasoning";
      settings.recordClass = "inspector_thought";
    } else if (type === "other" && !note) {
      const response = prompt("What did you observe?");
      if (response === null) return;
      note = response;
    }
    const marker = markerFromPosition(type, note, null, null, null, settings);
    data.markers.push(marker);
    attachToActiveEvidenceSet(type === "thought" ? "inspector_thought" : "observation", marker);
    saveState();
    redraw();
    renderCoaching();
    setStatus(type === "thought" ? "Inspector thought saved separately from observed evidence." : `${buttonLabels[type]} recorded at the current location.`, "active");
    return marker;
  }

  function openObservationDialog(type) {
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Observation was not recorded.", "warning");
      return;
    }
    activeObservationType = type;
    preparePhotoStorage();
    document.getElementById("observationTitle").textContent = `Record ${buttonLabels[type]}`;
    document.getElementById("wetFields").hidden = type !== "wet";
    document.getElementById("dryFields").hidden = type !== "dry";
    document.getElementById("blockedFields").hidden = type !== "blocked";
    document.getElementById("observationNote").value = "";
    document.getElementById("observationEvidence").value = "Observed";
    document.getElementById("observationPhoto").checked = false;
    if (type === "wet") {
      const unknown = document.querySelector('input[name="wetDepth"][value="unknown"]');
      if (unknown) unknown.checked = true;
      document.getElementById("wetExactDepth").value = "";
      document.getElementById("wetExactLabel").hidden = true;
      document.getElementById("wetDepthBasis").value = "Unknown";
      document.getElementById("wetWaterType").value = "";
      document.getElementById("wetExtent").value = "";
    }
    if (type === "dry") document.getElementById("dryCondition").value = "";
    if (type === "blocked") document.getElementById("blockedReason").value = "";
    observationDialog.showModal();
  }

  function selectedRadioValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : "";
  }

  function saveStructuredObservation() {
    if (!activeObservationType || !lastPosition) return;
    const type = activeObservationType;
    const attributes = {};
    if (type === "wet") {
      const depthChoice = selectedRadioValue("wetDepth") || "unknown";
      attributes.water_depth = depthChoice === "exact" ? document.getElementById("wetExactDepth").value.trim() : depthChoice;
      attributes.water_depth_unit = depthChoice === "exact" ? "inch" : null;
      attributes.water_depth_basis = document.getElementById("wetDepthBasis").value;
      attributes.water_condition = document.getElementById("wetWaterType").value;
      attributes.extent_note = document.getElementById("wetExtent").value.trim();
    } else if (type === "dry") {
      attributes.dry_ground_condition = document.getElementById("dryCondition").value;
    } else if (type === "blocked") {
      attributes.blocked_by = document.getElementById("blockedReason").value;
    }
    const note = document.getElementById("observationNote").value.trim();
    const evidenceClassification = document.getElementById("observationEvidence").value;
    const takeAssociatedPhoto = document.getElementById("observationPhoto").checked;
    const marker = addMarker(type, { note, attributes, evidenceClassification });
    observationDialog.close();
    activeObservationType = null;
    if (takeAssociatedPhoto && marker) {
      takePhoto({
        category: buttonLabels[type],
        note,
        associatedObservationId: marker.id,
        evidenceClassification,
        observationAttributes: attributes,
        area_id: marker.area_id,
        question_ids: marker.question_ids,
        question_links: marker.question_links
      });
    }
  }

  function preferredAudioMimeType() {
    const candidates = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function startVoiceRecording(options) {
    const settings = options || {};
    if (mediaRecorder && mediaRecorder.state === "recording") {
      setStatus("Stopping and saving the voice note…", "active");
      mediaRecorder.stop();
      return false;
    }
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Voice note was not started.", "warning");
      return false;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function" || typeof MediaRecorder === "undefined") {
      setStatus("Voice recording is unavailable in this browser. Use Free Note instead.", "error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredAudioMimeType();
      mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const id = makeId("voice");
      const startedAt = new Date().toISOString();
      const coachingContext = currentEvidenceContext();
      activeVoiceNote = {
        id,
        started_at: startedAt,
        recorded_at: startedAt,
        mime_type: mediaRecorder.mimeType || mimeType || "audio/mp4",
        lat: lastPosition.lat,
        lon: lastPosition.lon,
        gps_accuracy_m: lastPosition.accuracy_m,
        gps_position_at: lastPosition.time,
        compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : lastPosition.heading_deg,
        sensor_orientation: latestOrientation ? {
          alpha_deg: latestOrientation.alpha_deg,
          beta_deg: latestOrientation.beta_deg,
          gamma_deg: latestOrientation.gamma_deg,
          absolute: latestOrientation.absolute
        } : null,
        area_id: settings.area_id || coachingContext.area_id,
        question_ids: Array.isArray(settings.question_ids) ? settings.question_ids.slice() : coachingContext.question_ids,
        question_links: Array.isArray(settings.question_links) ? settings.question_links.map(link => Object.assign({}, link)) : coachingContext.question_links,
        purpose: settings.purpose || "general_field_note",
        photo_id: settings.photo_id || null,
        evidence_set_id: settings.evidence_set_id || data.active_evidence_set_id || null,
        prompt: settings.prompt || null,
        recovered_after_interruption: false
      };
      data.pending_voice_note = activeVoiceNote;
      saveState();
      voiceChunkSequence = 0;
      voiceChunkWrites = Promise.resolve();
      mediaRecorder.addEventListener("dataavailable", event => {
        if (!event.data || !event.data.size || !activeVoiceNote) return;
        const sequence = voiceChunkSequence++;
        const voiceId = activeVoiceNote.id;
        voiceChunkWrites = voiceChunkWrites.then(() => voiceChunkPut(voiceId, sequence, event.data));
      });
      mediaRecorder.addEventListener("stop", finalizeVoiceNote, { once: true });
      mediaRecorder.addEventListener("error", event => {
        setStatus(`VOICE NOTE ERROR: ${event.error ? event.error.message : "recording failed"}.`, "error");
      });
      mediaRecorder.start(1000);
      voiceBtn.textContent = "Stop Voice Note";
      voiceBtn.classList.add("recording");
      updateControls();
      setStatus(settings.prompt ? `${settings.prompt} Speak now, then tap Stop & Save Explanation.` : "Voice note recording. Speak now, then tap Stop Voice Note.", "active");
      return true;
    } catch (error) {
      setStatus(`VOICE NOTE NOT STARTED: ${error.message}`, "error");
      if (mediaRecorder && mediaRecorder.stream) mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;
      activeVoiceNote = null;
      data.pending_voice_note = null;
      saveState();
      updateControls();
      return false;
    }
  }

  async function toggleVoiceNote() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      setStatus("Stopping and saving the voice note…", "active");
      mediaRecorder.stop();
      return;
    }
    await startVoiceRecording({ purpose: "general_field_note" });
  }

  async function beginPhotoExplanation(photoId) {
    pendingPhotoExplanationId = photoId;
    pendingWaterPhotoId = photoId;
    photoExplanationDisposition = null;
    const photo = data.photos.find(item => String(item.id) === String(photoId));
    const set = photo && photo.evidence_set_id && evidenceSetTools ? evidenceSetTools.effectiveEvidenceSet(data, photo.evidence_set_id) : null;
    const isFirstSetPhoto = set && set.photo_links && set.photo_links[0] && String(set.photo_links[0].record_id) === String(photoId);
    const explanationPrompt = isFirstSetPhoto && set && set.set_type === "Flowing Water / Creek Corridor"
      ? "Why does this water feature matter to access, homesites, cost, risk, or what makes the property special?"
      : (isFirstSetPhoto ? "Why are you documenting this subject?" : "Why did you take this picture?");
    document.getElementById("photoExplanationPrompt").textContent = explanationPrompt;
    document.getElementById("photoExplanationState").textContent = "Starting voice recording…";
    document.getElementById("retryPhotoExplanation").hidden = true;
    document.getElementById("stopPhotoExplanation").hidden = false;
    document.getElementById("skipPhotoExplanation").disabled = true;
    document.getElementById("laterPhotoExplanation").disabled = true;
    if (!photoExplanationDialog.open) photoExplanationDialog.showModal();
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(explanationPrompt));
      }
    } catch (error) {
      // The large visual prompt remains available when spoken prompts are unsupported.
    }
    const started = await startVoiceRecording({
      purpose: isFirstSetPhoto ? "evidence_set_explanation" : "photo_explanation", photo_id: photoId, evidence_set_id: photo && photo.evidence_set_id || null, prompt: explanationPrompt,
      area_id: photo && photo.area_id,
      question_ids: photo && photo.question_ids,
      question_links: photo && photo.question_links
    });
    document.getElementById("photoExplanationState").textContent = started ? "Recording. Explain what matters and why." : "Voice recording did not start. Tap Retry Voice Explanation.";
    document.getElementById("retryPhotoExplanation").hidden = started;
    document.getElementById("stopPhotoExplanation").hidden = !started;
    document.getElementById("skipPhotoExplanation").disabled = false;
    document.getElementById("laterPhotoExplanation").disabled = false;
    if (!started) setStatus("The photograph is safe. Its voice explanation is still missing; tap Retry Voice Explanation.", "warning");
  }

  async function finalizeVoiceNote() {
    const recorder = mediaRecorder;
    const metadata = activeVoiceNote;
    let voiceSaved = false;
    let explanationHandledWithoutAudio = false;
    try {
      await voiceChunkWrites;
      const isEvidenceExplanation = metadata && ["photo_explanation", "evidence_set_explanation"].includes(metadata.purpose);
      if (isEvidenceExplanation && photoExplanationDisposition) {
        await voiceChunksDelete(metadata.id);
        data.pending_voice_note = null;
        await savePhotoExplanationStatus(metadata.photo_id, photoExplanationDisposition);
        saveState();
        explanationHandledWithoutAudio = true;
        setStatus(photoExplanationDisposition === "explain_later" ? "Photograph is safe. Explanation marked for later." : "Photograph is safe. Voice explanation skipped.", "warning");
        return;
      }
      const chunks = await voiceChunksGet(metadata.id);
      if (!chunks.length) throw new Error("No audio bytes were recorded.");
      const mimeType = metadata.mime_type || (chunks[0].chunk && chunks[0].chunk.type) || "audio/mp4";
      const audioBlob = new Blob(chunks.map(item => item.chunk), { type: mimeType });
      if (!audioBlob.size) throw new Error("The saved voice note was empty.");
      metadata.finished_at = new Date().toISOString();
      metadata.duration_ms = Math.max(0, new Date(metadata.finished_at) - new Date(metadata.started_at));
      metadata.size_bytes = audioBlob.size;
      const voiceEvent = {
        id: makeId("event"),
        source: isEvidenceExplanation ? metadata.purpose : "button_press",
        type: "voice_note",
        observation_type: "field.voice_note",
        taxonomy_version: "property-observation-1.0",
        button_label: "Voice Note",
        note: metadata.prompt || "",
        attributes: { duration_ms: metadata.duration_ms, purpose: metadata.purpose || "general_field_note", photo_id: metadata.photo_id || null, evidence_set_id: metadata.evidence_set_id || null },
        area_id: metadata.area_id || null,
        question_ids: Array.isArray(metadata.question_ids) ? metadata.question_ids.slice() : [],
        question_links: Array.isArray(metadata.question_links) ? metadata.question_links.map(link => Object.assign({}, link)) : [],
        time: metadata.started_at,
        lat: metadata.lat,
        lon: metadata.lon,
        gps_accuracy_m: metadata.gps_accuracy_m,
        gps_position_at: metadata.gps_position_at,
        compass_heading_deg: metadata.compass_heading_deg,
        device_orientation: metadata.sensor_orientation,
        voice_note_id: metadata.id,
        photo_id: metadata.photo_id || null,
        evidence_set_id: metadata.evidence_set_id || null
      };
      await voiceStorePut({ id: metadata.id, inspection_id: data.inspection_id, metadata, event: voiceEvent, audioBlob });
      if (metadata.photo_id) await attachExplanationToPhoto(metadata.photo_id, metadata.id);
      data.voice_notes.push(metadata);
      if (metadata.evidence_set_id && evidenceSetTools) evidenceSetTools.attachRecord(data, metadata.evidence_set_id, "voice_note", metadata, { created_by: data.inspector_identity });
      data.pending_voice_note = null;
      data.markers.push(voiceEvent);
      saveState();
      await voiceChunksDelete(metadata.id);
      voiceSaved = true;
      redraw();
      renderCoaching();
      schedulePackageEstimateRefresh();
      setStatus(isEvidenceExplanation ? (metadata.purpose === "evidence_set_explanation" ? "Group explanation saved with this subject forever." : "Photo explanation saved with the photograph forever.") : `Voice note ${data.voice_notes.length} saved with audio, GPS, time, and heading.`, "active");
    } catch (error) {
      setStatus(`VOICE NOTE NOT SAVED: ${error.message} Record it again.`, "error");
    } finally {
      if (recorder && recorder.stream) recorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;
      activeVoiceNote = null;
      voiceBtn.textContent = "Start Voice Note";
      voiceBtn.classList.remove("recording");
      updateControls();
      if (voiceSaved && metadata && ["photo_explanation", "evidence_set_explanation"].includes(metadata.purpose)) {
        pendingPhotoExplanationId = null;
        if (photoExplanationDialog.open) photoExplanationDialog.close();
        openPhotoMeaning(metadata.photo_id);
      } else if (explanationHandledWithoutAudio && metadata && ["photo_explanation", "evidence_set_explanation"].includes(metadata.purpose)) {
        pendingPhotoExplanationId = null;
        photoExplanationDisposition = null;
        if (photoExplanationDialog.open) photoExplanationDialog.close();
        openPhotoMeaning(metadata.photo_id);
      } else if (metadata && ["photo_explanation", "evidence_set_explanation"].includes(metadata.purpose)) {
        document.getElementById("photoExplanationState").textContent = "The photograph is safe, but its explanation did not save. Tap Retry Voice Explanation.";
        document.getElementById("retryPhotoExplanation").hidden = false;
        document.getElementById("stopPhotoExplanation").hidden = true;
      }
    }
  }

  async function savePhotoExplanationStatus(photoId, status) {
    const stored = await photoStoreGet(photoId);
    if (!stored || !stored.metadata) throw new Error("The photograph could not be read.");
    stored.metadata.explanation_status = status;
    stored.metadata.explanation_status_at = new Date().toISOString();
    if (stored.event) stored.event.attributes = Object.assign({}, stored.event.attributes || {}, { explanation_status: status });
    await photoStorePut(stored);
    const metadata = data.photos.find(item => String(item.id) === String(photoId));
    if (metadata) {
      metadata.explanation_status = status;
      metadata.explanation_status_at = stored.metadata.explanation_status_at;
    }
    const event = data.markers.find(item => String(item.photo_id || "") === String(photoId));
    if (event) event.attributes = Object.assign({}, event.attributes || {}, { explanation_status: status });
  }

  async function requestPhotoExplanationDisposition(disposition) {
    if (!pendingPhotoExplanationId) return;
    photoExplanationDisposition = disposition;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      document.getElementById("photoExplanationState").textContent = disposition === "explain_later" ? "Saving Explain Later status…" : "Saving Skip status…";
      mediaRecorder.stop();
      return;
    }
    try {
      const photoId = pendingPhotoExplanationId;
      await savePhotoExplanationStatus(photoId, disposition);
      pendingPhotoExplanationId = null;
      photoExplanationDisposition = null;
      photoExplanationDialog.close();
      openPhotoMeaning(photoId);
    } catch (error) {
      setStatus(`PHOTO EXPLANATION STATUS NOT SAVED: ${error.message}`, "error");
    }
  }

  function openPhotoMeaning(photoId) {
    pendingPhotoMeaningId = photoId;
    const photo = data.photos.find(item => String(item.id) === String(photoId));
    const meaning = photo && photo.photo_meaning || {};
    document.getElementById("photoMeaningSubject").value = meaning.subject || "";
    document.getElementById("photoMeaningMeasurement").value = meaning.measurement_status || "Not measured";
    document.getElementById("photoShowsMeasuringDevice").value = meaning.measuring_device_visible || (photo && photo.structured_measurement_required ? "Yes" : "");
    document.getElementById("photoMeaningExtent").value = meaning.represented_extent || "Single point or object";
    document.getElementById("photoMeaningImportance").value = meaning.decision_importance || "General reference";
    document.getElementById("photoMeaningNote").value = meaning.clarification || "";
    document.querySelectorAll('input[name="photoEvidenceRole"]').forEach(input => { input.checked = (meaning.evidence_roles || []).includes(input.value); });
    if (!photoMeaningDialog.open) photoMeaningDialog.showModal();
  }

  async function persistPhotoMeaning(status) {
    if (!pendingPhotoMeaningId) return;
    const photoId = pendingPhotoMeaningId;
    try {
      const stored = await photoStoreGet(photoId);
      if (!stored || !stored.metadata) throw new Error("The photograph could not be read.");
      const meaning = {
        status,
        recorded_at: new Date().toISOString(),
        subject: document.getElementById("photoMeaningSubject").value || null,
        measurement_status: document.getElementById("photoMeaningMeasurement").value,
        measuring_device_visible: document.getElementById("photoShowsMeasuringDevice").value,
        represented_extent: document.getElementById("photoMeaningExtent").value,
        decision_importance: document.getElementById("photoMeaningImportance").value,
        evidence_roles: [...document.querySelectorAll('input[name="photoEvidenceRole"]:checked')].map(input => input.value),
        clarification: document.getElementById("photoMeaningNote").value.trim()
      };
      if (!meaning.measuring_device_visible) {
        setStatus("Answer whether a measuring device is visible before continuing.", "warning");
        return;
      }
      if (status === "complete" && !meaning.subject) {
        setStatus("Choose what the photograph shows before saving its meaning.", "warning");
        return;
      }
      stored.metadata.photo_meaning = meaning;
      if (stored.event) stored.event.attributes = Object.assign({}, stored.event.attributes || {}, { photo_meaning: meaning });
      await photoStorePut(stored);
      const metadata = data.photos.find(item => String(item.id) === String(photoId));
      if (metadata) metadata.photo_meaning = meaning;
      const event = data.markers.find(item => String(item.photo_id || "") === String(photoId));
      if (event) event.attributes = Object.assign({}, event.attributes || {}, { photo_meaning: meaning });
      saveState();
      if (!metadata || !metadata.evidence_set_id) pendingSubjectChangePrompt = evidenceSetTools && evidenceSetTools.detectSubjectChange(data);
      photoMeaningDialog.close();
      pendingPhotoMeaningId = null;
      await renderGallery();
      if (meaning.measuring_device_visible === "Yes") openStructuredMeasurement(photoId);
      else openWaterClassification(photoId);
    } catch (error) {
      setStatus(`PHOTO MEANING NOT SAVED: ${error.message}`, "error");
    }
  }

  function measurementTypeForPhoto(photo) {
    const set = photo && photo.evidence_set_id && evidenceSetTools ? evidenceSetTools.effectiveEvidenceSet(data, photo.evidence_set_id) : null;
    const link = set && (set.photo_links || []).find(item => String(item.record_id) === String(photo.id));
    const roles = link ? (link.photo_roles || [link.photo_role]) : [];
    if (roles.includes("Water depth") || (photo.photo_meaning && photo.photo_meaning.subject === "Drainage or water")) return "Water depth";
    if (roles.includes("Channel width")) return "Width";
    if (roles.includes("DBH tape position") || (photo.photo_meaning && photo.photo_meaning.subject === "Timber or tree")) return "Tree diameter";
    return "Other";
  }

  function updateMeasurementFields() {
    const type = document.getElementById("measurementType").value;
    document.getElementById("measurementWaterFields").hidden = type !== "Water depth";
    if (type === "Water depth") document.getElementById("measurementUnit").value = "in";
    if (["Width", "Length", "Distance"].includes(type) && document.getElementById("measurementUnit").value === "in") document.getElementById("measurementUnit").value = "ft";
    if (type === "Tree diameter") document.getElementById("measurementUnit").value = "in";
  }

  function openStructuredMeasurement(photoId) {
    pendingMeasurementPhotoId = photoId;
    const photo = data.photos.find(item => String(item.id) === String(photoId));
    document.getElementById("measurementType").value = measurementTypeForPhoto(photo);
    document.getElementById("measurementValue").value = "";
    document.getElementById("measurementOtherUnit").value = "";
    document.getElementById("measurementOtherUnitLabel").hidden = true;
    document.getElementById("measurementBasis").value = "Measured";
    document.getElementById("measurementInstrument").value = "";
    document.getElementById("measurementReachedEnd").value = "Unknown";
    document.getElementById("measurementAligned").value = "Unknown";
    document.getElementById("measurementWaterBottom").value = "Unknown";
    document.getElementById("measurementWaterContext").value = "";
    document.getElementById("measurementSurfaceLength").value = "";
    document.getElementById("measurementSurfaceWidth").value = "";
    const subject = document.getElementById("measurementSubject");
    subject.innerHTML = "";
    const selfOption = document.createElement("option");
    selfOption.value = `photo:${photoId}`;
    selfOption.textContent = `${photo && photo.photo_number || "This photograph"} — ungrouped subject`;
    subject.appendChild(selfOption);
    (data.evidence_sets || []).filter(set => set.status !== "voided").forEach(set => {
      const option = document.createElement("option");
      option.value = set.evidence_set_id;
      option.textContent = set.label;
      subject.appendChild(option);
    });
    if (photo && photo.evidence_set_id) subject.value = photo.evidence_set_id;
    updateMeasurementFields();
    structuredMeasurementDialog.showModal();
  }

  async function saveStructuredMeasurement() {
    if (!pendingMeasurementPhotoId || !timberTools) return;
    const photoId = pendingMeasurementPhotoId;
    const photo = data.photos.find(item => String(item.id) === String(photoId));
    const subjectId = document.getElementById("measurementSubject").value;
    const evidenceSetId = subjectId.startsWith("photo:") ? null : subjectId;
    const unitChoice = document.getElementById("measurementUnit").value;
    try {
      const measurement = timberTools.recordMeasurement(data, {
        measurement_type: document.getElementById("measurementType").value,
        value: document.getElementById("measurementValue").value,
        unit: unitChoice === "other" ? document.getElementById("measurementOtherUnit").value.trim() : unitChoice,
        basis: document.getElementById("measurementBasis").value,
        instrument: document.getElementById("measurementInstrument").value.trim(),
        reached_true_endpoint: document.getElementById("measurementReachedEnd").value,
        approximately_aligned: document.getElementById("measurementAligned").value,
        subject_id: subjectId, evidence_set_id: evidenceSetId, photo_id: photoId,
        timber_tree_id: photo && photo.timber_tree_id || null,
        water_bottom_type: document.getElementById("measurementWaterBottom").value,
        water_feature_type: document.getElementById("measurementWaterContext").value,
        surface_length: document.getElementById("measurementSurfaceLength").value,
        surface_width: document.getElementById("measurementSurfaceWidth").value,
        voice_note_ids: photo && photo.explanation_voice_note_ids || [],
        recorded_at: new Date().toISOString(), recorded_by: data.inspector_identity,
        location: photo ? { latitude: photo.lat, longitude: photo.lon, gps_accuracy_m: photo.gps_accuracy_m } : null
      });
      if (evidenceSetId && evidenceSetTools) evidenceSetTools.attachRecord(data, evidenceSetId, "measurement", measurement.measurement_id, { created_by: data.inspector_identity });
      const measurementIds = Array.from(new Set([...(photo && photo.structured_measurement_ids || []), measurement.measurement_id]));
      if (photo) {
        photo.structured_measurement_ids = measurementIds;
        photo.structured_measurement_required = false;
      }
      saveState();
      let reverseLinkWarning = false;
      try {
        const stored = await photoStoreGet(photoId);
        if (!stored || !stored.metadata) throw new Error("The supporting photograph could not be read back.");
        stored.metadata.structured_measurement_ids = Array.from(new Set([...(stored.metadata.structured_measurement_ids || []), measurement.measurement_id]));
        stored.metadata.structured_measurement_required = false;
        if (stored.event) stored.event.attributes = Object.assign({}, stored.event.attributes || {}, { structured_measurement_ids: stored.metadata.structured_measurement_ids });
        await photoStorePut(stored);
      } catch (error) {
        reverseLinkWarning = true;
      }
      if (measurement.measurement_type === "Tree diameter" && photo && photo.timber_tree_id) {
        const tree = data.timber_trees.find(item => item.tree_id === photo.timber_tree_id);
        if (tree) tree.dbh = Object.assign({}, tree.dbh || {}, { dbh_in: measurement.authoritative_value, method: measurement.instrument, basis: measurement.basis, confidence: "field-entered", tape_position_photo_id: photoId });
      }
      structuredMeasurementDialog.close();
      pendingMeasurementPhotoId = null;
      setStatus(`${measurement.measurement_type} saved as ${measurement.authoritative_value} ${measurement.unit}. The photograph is supporting evidence.${reverseLinkWarning ? " Its reverse index will be rebuilt from the saved measurement during packaging." : ""}`, reverseLinkWarning ? "warning" : "success");
      openWaterClassification(photoId);
    } catch (error) {
      setStatus(`MEASUREMENT NOT SAVED: ${error.message}`, "error");
    }
  }

  async function attachExplanationToPhoto(photoId, voiceId) {
    const stored = await photoStoreGet(photoId);
    if (!stored || !stored.metadata) throw new Error("The photograph for this explanation could not be read.");
    const ids = Array.isArray(stored.metadata.explanation_voice_note_ids) ? stored.metadata.explanation_voice_note_ids.slice() : [];
    if (!ids.some(id => String(id) === String(voiceId))) ids.push(voiceId);
    stored.metadata.explanation_voice_note_ids = ids;
    stored.metadata.explanation_voice_note_id = ids[0] || null;
    stored.metadata.explanation_status = "recorded";
    stored.metadata.explanation_status_at = new Date().toISOString();
    if (stored.event) {
      stored.event.voice_note_ids = ids.slice();
      stored.event.voice_note_id = stored.event.voice_note_id || voiceId;
    }
    await photoStorePut(stored);
    const metadata = data.photos.find(photo => String(photo.id) === String(photoId));
    if (metadata) {
      metadata.explanation_voice_note_ids = ids.slice();
      metadata.explanation_voice_note_id = ids[0] || null;
      metadata.explanation_status = "recorded";
      metadata.explanation_status_at = stored.metadata.explanation_status_at;
    }
    const event = data.markers.find(marker => String(marker.photo_id) === String(photoId));
    if (event) {
      event.voice_note_ids = ids.slice();
      event.voice_note_id = event.voice_note_id || voiceId;
    }
  }

  function resetWaterClassificationForm() {
    activeWaterType = null;
    document.getElementById("waterMeasurementFields").hidden = true;
    document.getElementById("photoWaterDepth").value = "unknown";
    document.getElementById("photoWaterExact").value = "";
    document.getElementById("photoWaterExactLabel").hidden = true;
    document.getElementById("photoWaterBasis").value = "Unknown";
    document.getElementById("photoWaterWidth").value = "";
    document.getElementById("photoWaterLength").value = "";
    document.getElementById("photoWaterBehavior").value = "unknown";
  }

  function openWaterClassification(photoId) {
    pendingWaterPhotoId = photoId;
    resetWaterClassificationForm();
    if (!waterClassificationDialog.open) waterClassificationDialog.showModal();
  }

  async function saveWaterMetadata(photoId, confirmation, water) {
    const stored = await photoStoreGet(photoId);
    if (!stored || !stored.metadata) throw new Error("The photograph could not be read for water classification.");
    stored.metadata.water_confirmation = confirmation;
    stored.metadata.water_reviewed_at = new Date().toISOString();
    stored.metadata.water = water || null;
    if (water && waterTools) {
      const normalized = waterTools.waterEvidenceFromPhoto(stored.metadata, data.markers);
      if (normalized) stored.metadata.water.significance = normalized.significance;
    }
    if (stored.event) {
      stored.event.attributes = Object.assign({}, stored.event.attributes || {}, {
        water_confirmation: confirmation,
        water: stored.metadata.water
      });
    }
    await photoStorePut(stored);
    const metadata = data.photos.find(photo => String(photo.id) === String(photoId));
    if (metadata) {
      metadata.water_confirmation = stored.metadata.water_confirmation;
      metadata.water_reviewed_at = stored.metadata.water_reviewed_at;
      metadata.water = stored.metadata.water;
    }
    const marker = data.markers.find(item => String(item.photo_id) === String(photoId));
    if (marker) marker.attributes = Object.assign({}, marker.attributes || {}, { water_confirmation: confirmation, water: stored.metadata.water });
    saveState();
    redraw();
    await renderGallery();
  }

  async function chooseWaterType(choice) {
    if (!pendingWaterPhotoId) return;
    if (choice === "no" || choice === "unsure") {
      try {
        await saveWaterMetadata(pendingWaterPhotoId, choice, null);
        waterClassificationDialog.close();
        setStatus(choice === "no" ? "Photograph confirmed as not showing water." : "Photograph marked Unsure; the report will not treat it as confirmed water.", "active");
        pendingWaterPhotoId = null;
        completePostPhotoReviewFlow();
      } catch (error) {
        setStatus(`WATER CLASSIFICATION NOT SAVED: ${error.message}`, "error");
      }
      return;
    }
    activeWaterType = choice;
    const behaviorDefaults = { flowing: "flowing", creek_stream: "apparent_creek_channel", ditch: "ditch", standing: "isolated_depression", other: "unknown" };
    document.getElementById("photoWaterBehavior").value = behaviorDefaults[choice] || "unknown";
    document.getElementById("waterMeasurementFields").hidden = false;
    document.getElementById("saveWaterClassification").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveConfirmedWaterClassification() {
    if (!pendingWaterPhotoId || !activeWaterType) return;
    const photoMetadata = data.photos.find(photo => String(photo.id) === String(pendingWaterPhotoId));
    const structuredDepth = (data.measurements || []).slice().reverse().find(item => item.photo_id === pendingWaterPhotoId && item.measurement_type === "Water depth" && item.inspector_confirmed !== false);
    const depthBand = document.getElementById("photoWaterDepth").value;
    const exact = Number(document.getElementById("photoWaterExact").value);
    const width = Number(document.getElementById("photoWaterWidth").value);
    const length = Number(document.getElementById("photoWaterLength").value);
    const water = {
      water_type: activeWaterType,
      water_depth_band: depthBand,
      water_depth_exact_in: structuredDepth ? structuredDepth.authoritative_value : (depthBand === "exact" && Number.isFinite(exact) ? exact : null),
      measurement_basis: structuredDepth ? structuredDepth.basis : document.getElementById("photoWaterBasis").value,
      water_width_ft: Number.isFinite(width) && width > 0 ? width : (structuredDepth && structuredDepth.water_context && structuredDepth.water_context.approximate_surface_width || null),
      water_length_ft: Number.isFinite(length) && length > 0 ? length : (structuredDepth && structuredDepth.water_context && structuredDepth.water_context.approximate_surface_length || null),
      water_behavior: document.getElementById("photoWaterBehavior").value,
      significance: null,
      structured_measurement_id: structuredDepth ? structuredDepth.measurement_id : null,
      bottom_type: structuredDepth && structuredDepth.water_context ? structuredDepth.water_context.bottom_type : null,
      authoritative_measurement_rule: structuredDepth ? structuredDepth.authority_rule : null
    };
    try {
      await saveWaterMetadata(pendingWaterPhotoId, "yes", water);
      const metadata = photoMetadata;
      waterClassificationDialog.close();
      setStatus(`${metadata && metadata.photo_number ? metadata.photo_number : "Photograph"} saved as ${water.water_type.replaceAll("_", " ")} water evidence.`, "active");
      pendingWaterPhotoId = null;
      completePostPhotoReviewFlow();
    } catch (error) {
      setStatus(`WATER CLASSIFICATION NOT SAVED: ${error.message}`, "error");
    }
  }

  async function recoverInterruptedVoiceNote() {
    const pending = data.pending_voice_note;
    if (!pending || !pending.id) return;
    const chunks = await voiceChunksGet(pending.id);
    if (!chunks.length) {
      data.pending_voice_note = null;
      saveState();
      return;
    }
    const audioBlob = new Blob(chunks.map(item => item.chunk), { type: pending.mime_type || chunks[0].chunk.type || "audio/mp4" });
    pending.finished_at = pending.finished_at || new Date().toISOString();
    pending.duration_ms = Math.max(0, new Date(pending.finished_at) - new Date(pending.started_at));
    pending.size_bytes = audioBlob.size;
    pending.recovered_after_interruption = true;
    let voiceEvent = data.markers.find(marker => String(marker.voice_note_id) === String(pending.id)) || null;
    if (!voiceEvent) {
      voiceEvent = {
        id: makeId("event"), source: "recovered_voice_note", type: "voice_note",
        observation_type: "field.voice_note", taxonomy_version: "property-observation-1.0",
        button_label: "Voice Note", note: pending.prompt || "", attributes: { duration_ms: pending.duration_ms, recovered_after_interruption: true, purpose: pending.purpose || "general_field_note", photo_id: pending.photo_id || null },
        area_id: pending.area_id || null, question_ids: Array.isArray(pending.question_ids) ? pending.question_ids.slice() : [],
        question_links: Array.isArray(pending.question_links) ? pending.question_links.map(link => Object.assign({}, link)) : [],
        time: pending.started_at, lat: pending.lat, lon: pending.lon, gps_accuracy_m: pending.gps_accuracy_m,
        gps_position_at: pending.gps_position_at, compass_heading_deg: pending.compass_heading_deg,
        device_orientation: pending.sensor_orientation, voice_note_id: pending.id, photo_id: pending.photo_id || null
      };
    }
    await voiceStorePut({ id: pending.id, inspection_id: data.inspection_id, metadata: pending, event: voiceEvent, audioBlob });
    if (pending.photo_id) await attachExplanationToPhoto(pending.photo_id, pending.id);
    if (!data.voice_notes.some(note => String(note.id) === String(pending.id))) data.voice_notes.push(pending);
    if (!data.markers.some(marker => String(marker.voice_note_id) === String(pending.id))) data.markers.push(voiceEvent);
    data.pending_voice_note = null;
    saveState();
    await voiceChunksDelete(pending.id);
    setStatus("A voice note interrupted by the previous app close was recovered.", "warning");
  }

  function pendingPhotoUrl(id, part) {
    return new URL(`./pending-photo/${encodeURIComponent(id)}/${part}`, location.href).href;
  }

  function updatePendingPhotoButton() {
    retryPendingPhotoBtn.hidden = pendingPhotoQueue.length === 0;
    retryPendingPhotoBtn.textContent = pendingPhotoQueue.length === 1 ? "Retry Pending Photo" : `Retry Pending Photos (${pendingPhotoQueue.length})`;
  }

  async function persistPendingPhoto(record) {
    pendingPhotoQueue = pendingPhotoQueue.filter(item => String(item.id) !== String(record.id));
    pendingPhotoQueue.push(record);
    updatePendingPhotoButton();
    if (!("caches" in window)) return false;
    try {
      const cache = await caches.open(pendingPhotoCacheName);
      const metadata = {
        id: record.id,
        inspection_id: record.inspection_id,
        metadata: record.metadata,
        event: record.event,
        original_type: record.originalBlob.type,
        analysis_type: record.analysisBlob.type
      };
      await Promise.all([
        cache.put(pendingPhotoUrl(record.id, "record.json"), new Response(JSON.stringify(metadata), { headers: { "content-type": "application/json" } })),
        cache.put(pendingPhotoUrl(record.id, "original"), new Response(record.originalBlob, { headers: { "content-type": record.originalBlob.type || "application/octet-stream" } })),
        cache.put(pendingPhotoUrl(record.id, "analysis"), new Response(record.analysisBlob, { headers: { "content-type": record.analysisBlob.type || "image/jpeg" } }))
      ]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function removePendingPhoto(id) {
    pendingPhotoQueue = pendingPhotoQueue.filter(item => String(item.id) !== String(id));
    updatePendingPhotoButton();
    if (!("caches" in window)) return;
    try {
      const cache = await caches.open(pendingPhotoCacheName);
      await Promise.all(["record.json", "original", "analysis"].map(part => cache.delete(pendingPhotoUrl(id, part))));
    } catch (error) {
      // The canonical IndexedDB record is already verified; stale fallback entries are harmless.
    }
  }

  async function loadPendingPhotos() {
    if (!("caches" in window)) {
      updatePendingPhotoButton();
      return;
    }
    try {
      const cache = await caches.open(pendingPhotoCacheName);
      const keys = await cache.keys();
      const metadataKeys = keys.filter(request => /\/pending-photo\/[^/]+\/record\.json$/.test(new URL(request.url).pathname));
      for (const key of metadataKeys) {
        const metadataResponse = await cache.match(key);
        const saved = metadataResponse && await metadataResponse.json();
        if (!saved || String(saved.inspection_id || "") !== String(data.inspection_id || "")) continue;
        const originalResponse = await cache.match(pendingPhotoUrl(saved.id, "original"));
        const analysisResponse = await cache.match(pendingPhotoUrl(saved.id, "analysis"));
        if (!originalResponse || !analysisResponse) continue;
        const record = Object.assign({}, saved, {
          originalBlob: await originalResponse.blob(),
          analysisBlob: await analysisResponse.blob()
        });
        if (!pendingPhotoQueue.some(item => String(item.id) === String(record.id))) pendingPhotoQueue.push(record);
      }
    } catch (error) {
      // Memory-only pending records can still be retried while this page remains open.
    }
    updatePendingPhotoButton();
  }

  async function finalizeCommittedPhoto(record) {
    const metadata = record.metadata;
    const event = record.event;
    if (!data.photos.some(photo => String(photo.id) === String(metadata.id))) data.photos.push(metadata);
    if (!data.markers.some(marker => String(marker.id) === String(event.id))) data.markers.push(event);
    if (metadata.evidence_set_id && evidenceSetTools) {
      const set = evidenceSetTools.effectiveEvidenceSet(data, metadata.evidence_set_id);
      if (set && !(set.photo_links || []).some(link => String(link.record_id) === String(metadata.id))) evidenceSetTools.attachRecord(data, metadata.evidence_set_id, "photo", metadata, { photo_role: "Context", created_by: data.inspector_identity });
    }
    if (metadata.associated_observation_id) {
      const associatedObservation = data.markers.find(marker => String(marker.id) === String(metadata.associated_observation_id));
      if (associatedObservation) associatedObservation.photo_id = metadata.id;
    }
    data.photos.sort((a, b) => String(a.recorded_at || a.time).localeCompare(String(b.recorded_at || b.time)));
    data.markers.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    await removePendingPhoto(record.id);
    saveState();
    redraw();
    galleryPage = Math.max(0, Math.ceil(data.photos.length / galleryPageSize) - 1);
    await renderGallery();
    renderCoaching();
    schedulePackageEstimateRefresh();
  }

  async function commitPhotoRecord(record, queueOnFailure) {
    try {
      await dbRecoveryTools.commitPhotoEvidence(record, {
        put: photoStorePut,
        get: photoStoreGet,
        queueOnFailure: queueOnFailure ? persistPendingPhoto : null
      });
      await finalizeCommittedPhoto(record);
      return true;
    } catch (error) {
      if (queueOnFailure && !pendingPhotoQueue.some(item => String(item.id) === String(record.id))) await persistPendingPhoto(record);
      throw error;
    }
  }

  async function retryPendingPhotos(options) {
    const settings = options || {};
    if (!pendingPhotoQueue.length) return true;
    photoBusy = true;
    updateControls();
    const queue = pendingPhotoQueue.slice();
    let savedCount = 0;
    try {
      await revalidatePhotoDb();
      for (let index = 0; index < queue.length; index += 1) {
        setStatus(`Retrying pending photograph ${index + 1} of ${queue.length}…`, "active");
        try {
          await commitPhotoRecord(queue[index], false);
          savedCount += 1;
        } catch (error) {
          if (!settings.silent) setStatus("Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo.", "error");
          if (settings.throwOnFailure) throw error;
          return false;
        }
      }
      if (!settings.silent) setStatus(`${countLabel(savedCount, "pending photograph")} recovered and verified.`, "success");
      return true;
    } finally {
      photoBusy = false;
      updateControls();
    }
  }

  function currentScreenOrientation() {
    const orientation = screen.orientation || screen.mozOrientation || screen.msOrientation;
    const type = orientation && orientation.type ? orientation.type : null;
    const fallbackAngle = Number.isFinite(window.orientation) ? window.orientation : null;
    const angle = orientation && Number.isFinite(orientation.angle) ? orientation.angle : fallbackAngle;
    return { type, angle };
  }

  async function readExifOrientation(file) {
    const header = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
    const value = packageTools.parseExifOrientation(header);
    return { value, description: packageTools.orientationDescription(value) };
  }

  function loadImageSource(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, { imageOrientation: "from-image" })
        .then(bitmap => ({ source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }))
        .catch(() => loadImageElement(file));
    }
    return loadImageElement(file);
  }

  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(url)
      });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The photograph could not be decoded."));
      };
      image.src = url;
    });
  }

  async function createAnalysisJpeg(file) {
    const decoded = await loadImageSource(file);
    try {
      const maxDimension = 1900;
      const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error("The analysis JPEG could not be created.")), "image/jpeg", 0.8);
      });
      return { blob, width: decoded.width, height: decoded.height, analysisWidth: width, analysisHeight: height, maxDimension, jpegQuality: 0.8 };
    } finally {
      decoded.close();
    }
  }

  function getFreshPositionForPhoto() {
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value || lastPosition);
      };
      navigator.geolocation.getCurrentPosition(position => {
        onPosition(position);
        finish(lastPosition);
      }, () => finish(lastPosition), { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
      setTimeout(() => finish(lastPosition), 13000);
    });
  }

  function preparePhotoStorage() {
    photoHealthPromise = revalidatePhotoDb();
    photoHealthPromise.catch(() => {});
    return photoHealthPromise;
  }

  async function takePhoto(context) {
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Camera was not opened.", "warning");
      return;
    }
    const coachingContext = currentEvidenceContext();
    const activeSetForPhoto = data.active_evidence_set_id && evidenceSetTools ? evidenceSetTools.effectiveEvidenceSet(data, data.active_evidence_set_id) : null;
    const activePlotForPhoto = activeSetForPhoto && activeSetForPhoto.set_type === "Timber Sample Plot" && timberTools ? data.timber_plots.find(item => item.evidence_set_id === activeSetForPhoto.evidence_set_id) : null;
    pendingPhotoContext = Object.assign({}, context || {}, {
      area_id: context && context.area_id ? context.area_id : coachingContext.area_id,
      question_ids: context && Array.isArray(context.question_ids) ? context.question_ids.slice() : coachingContext.question_ids,
      question_links: context && Array.isArray(context.question_links) ? context.question_links.map(link => Object.assign({}, link)) : coachingContext.question_links,
      photo_value: data.next_photo_value || "Helpful",
      evidence_set_id: context && context.evidence_set_id ? context.evidence_set_id : data.active_evidence_set_id,
      timber_tree_id: context && context.timber_tree_id ? context.timber_tree_id : (activeSetForPhoto && activeSetForPhoto.set_type === "Individual Tree" ? (activeSetForPhoto.subject_details && activeSetForPhoto.subject_details.timber_tree_id || activeSetForPhoto.tree_id) : (activePlotForPhoto && activePlotForPhoto.active_tree_id || null))
    });
    pendingPhotoRequestedAt = new Date().toISOString();
    try {
      await (photoHealthPromise || preparePhotoStorage());
      photoInput.click();
    } catch (error) {
      pendingPhotoRequestedAt = null;
      pendingPhotoContext = null;
      setStatus("Photo storage is reconnecting. Tap Take Photo again. No existing inspection data was changed.", "warning");
      try { await preparePhotoStorage(); } catch (retryError) { /* The next tap will report the health state again. */ }
    }
  }

  async function checkPhotoStorageCapacity(fileSize) {
    if (!navigator.storage || typeof navigator.storage.estimate !== "function") return { warning: false, remaining: null };
    try {
      const estimate = await navigator.storage.estimate();
      const quota = Number(estimate.quota);
      const usage = Number(estimate.usage || 0);
      if (!Number.isFinite(quota)) return { warning: false, remaining: null };
      const remaining = Math.max(0, quota - usage);
      const required = Math.max(fileSize * 2.25, 25 * 1024 * 1024);
      if (remaining < required) throw new Error(`Storage is nearly full (${formatBytes(remaining)} available). Free iPhone storage before taking more evidence photographs.`);
      return { warning: remaining < 250 * 1024 * 1024 || usage / quota > 0.85, remaining };
    } catch (error) {
      if (/Storage is nearly full/.test(error.message)) throw error;
      return { warning: false, remaining: null };
    }
  }

  async function handlePhotoFile() {
    const file = photoInput.files && photoInput.files[0];
    if (!file) {
      pendingPhotoRequestedAt = null;
      pendingPhotoContext = null;
      return;
    }
    const recordedAt = new Date().toISOString();
    photoBusy = true;
    updateControls();
    setStatus("Saving original photograph and analysis copy…", "active");
    let photoRecord = null;
    try {
      const storageEstimate = await checkPhotoStorageCapacity(file.size);
      const [position, exif, analysis] = await Promise.all([
        getFreshPositionForPhoto(),
        readExifOrientation(file),
        createAnalysisJpeg(file)
      ]);
      if (!position) throw new Error("No GPS position was available for the photograph.");
      if (!analysis || !(analysis.blob instanceof Blob) || !analysis.blob.size) throw new Error("No analysis-safe image copy was created.");
      const id = makeId("photo");
      const screenState = currentScreenOrientation();
      const photoContext = pendingPhotoContext || {};
      const sourceModified = Number.isFinite(file.lastModified) && file.lastModified > 0 ? new Date(file.lastModified).toISOString() : null;
      const metadata = {
        id,
        camera_opened_at: pendingPhotoRequestedAt,
        recorded_at: recordedAt,
        time: recordedAt,
        source_file_last_modified_at: sourceModified,
        lat: position.lat,
        lon: position.lon,
        gps_accuracy_m: position.accuracy_m,
        gps_position_at: position.time,
        gps_position_age_ms: Math.max(0, new Date(recordedAt) - new Date(position.time)),
        location_source: "live_browser_geolocation",
        compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : position.heading_deg,
        sensor_orientation: latestOrientation ? {
          alpha_deg: latestOrientation.alpha_deg,
          beta_deg: latestOrientation.beta_deg,
          gamma_deg: latestOrientation.gamma_deg,
          absolute: latestOrientation.absolute,
          compass_accuracy_deg: latestOrientation.compass_accuracy_deg
        } : null,
        device_screen_orientation: screenState.type,
        device_screen_angle_deg: screenState.angle,
        width_px: analysis.width,
        height_px: analysis.height,
        pixel_orientation: analysis.width === analysis.height ? "square" : (analysis.width > analysis.height ? "landscape" : "portrait"),
        exif_orientation: exif.value,
        exif_orientation_description: exif.description,
        original_filename: file.name || null,
        original_mime_type: file.type || "application/octet-stream",
        original_size_bytes: file.size,
        analysis_size_bytes: analysis.blob.size,
        analysis_width_px: analysis.analysisWidth,
        analysis_height_px: analysis.analysisHeight,
        analysis_profile: { format: "image/jpeg", max_dimension_px: analysis.maxDimension, jpeg_quality: analysis.jpegQuality },
        photo_number: `P${data.photos.length + pendingPhotoQueue.length + 1}`,
        category: photoContext.category || "Other",
        note: photoContext.note || "",
        associated_observation_id: photoContext.associatedObservationId || null,
        evidence_classification: photoContext.evidenceClassification || "Observed",
        observation_attributes: Object.assign({}, photoContext.observationAttributes || {}),
        area_id: photoContext.area_id || null,
        question_ids: Array.isArray(photoContext.question_ids) ? photoContext.question_ids.slice() : [],
        question_links: Array.isArray(photoContext.question_links) ? photoContext.question_links.map(link => Object.assign({}, link)) : [],
        photo_value: photoContext.photo_value || "Helpful"
        ,evidence_set_id: photoContext.evidence_set_id || null
        ,timber_tree_id: photoContext.timber_tree_id || null
      };
      const photoEvent = markerFromPosition("photo", metadata.note, id, recordedAt, position, {
        evidenceClassification: metadata.evidence_classification,
        attributes: {
          photo_number: metadata.photo_number,
          category: metadata.category,
          associated_observation_id: metadata.associated_observation_id,
          observation_attributes: metadata.observation_attributes
        },
        areaId: metadata.area_id,
        questionIds: metadata.question_ids,
        questionLinks: metadata.question_links
      });
      metadata.associated_marker_id = photoEvent.id;
      if (typeof packageTools.sha256Hex === "function") {
        const hashes = await Promise.all([packageTools.sha256Hex(file), packageTools.sha256Hex(analysis.blob)]);
        metadata.original_sha256 = hashes[0];
        metadata.analysis_sha256 = hashes[1];
      }
      photoRecord = {
        id,
        inspection_id: data.inspection_id,
        metadata,
        event: photoEvent,
        originalBlob: file,
        analysisBlob: analysis.blob
      };
      await commitPhotoRecord(photoRecord, true);
      if (metadata.timber_tree_id && timberTools) timberTools.attachPhotoToTree(data, metadata.timber_tree_id, metadata.id, false);
      setStatus(`Photo ${data.photos.length} stored with original bytes, analysis copy, GPS, time, and orientation metadata.${storageEstimate.warning ? ` WARNING: only ${formatBytes(storageEstimate.remaining)} of browser storage remains.` : ""}`, storageEstimate.warning ? "warning" : "active");
      if (metadata.evidence_set_id && evidenceSetTools) {
        pendingGroupPhotoId = id;
        const active = evidenceSetTools.effectiveEvidenceSet(data, metadata.evidence_set_id);
        document.getElementById("groupPhotoPrompt").textContent = `${metadata.photo_number} was saved in ${active ? active.label : "this subject"}. Is it the same subject, a new subject, or the end of this subject?`;
        let suggestedRole = "Context";
        if (active && ["Individual Tree", "Tree Group / Canopy"].includes(active.set_type)) {
          const usedRoles = new Set((active.photo_links || []).filter(link => String(link.record_id) !== String(id)).flatMap(link => link.photo_roles || [link.photo_role]));
          suggestedRole = evidenceSetTools.treeEvidencePlan(active.subject_details || {}).required_roles.find(role => !usedRoles.has(role)) || "Other";
        } else if (active && active.set_type === "Flowing Water / Creek Corridor") {
          const usedRoles = new Set((active.photo_links || []).filter(link => String(link.record_id) !== String(id)).flatMap(link => link.photo_roles || [link.photo_role]));
          suggestedRole = evidenceSetTools.flowingWaterEvidencePlan().required_roles.find(role => !usedRoles.has(role)) || "Flow Evidence";
        } else if (active && active.set_type === "Timber Sample Plot") {
          const usedRoles = new Set((active.photo_links || []).filter(link => String(link.record_id) !== String(id)).flatMap(link => link.photo_roles || [link.photo_role]));
          suggestedRole = (evidenceSetTools.REQUIRED_ROLES["Timber Sample Plot"] || []).find(role => !usedRoles.has(role)) || "Context";
        }
        document.getElementById("groupPhotoRole").value = suggestedRole;
        document.getElementById("leafProvenanceLabel").hidden = !["Leaf upper surface", "Leaf underside"].includes(suggestedRole);
        document.getElementById("groupPhotoDialog").showModal();
      } else {
        const suggestion = evidenceSetTools && evidenceSetTools.suggestRecentGroup(data);
        if (suggestion) renderEvidenceSets();
        await beginPhotoExplanation(id);
      }
    } catch (error) {
      if (photoRecord && pendingPhotoQueue.some(item => String(item.id) === String(photoRecord.id))) {
        setStatus("Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo.", "error");
      } else {
        setStatus(`PHOTO NOT RECORDED: ${error.message} The captured file could not be converted into recoverable evidence.`, "error");
      }
    } finally {
      photoBusy = false;
      pendingPhotoRequestedAt = null;
      pendingPhotoContext = null;
      photoInput.value = "";
      updateControls();
    }
  }

  async function shareLastPackage() {
    if (!lastPackageFile || !navigator.share) return false;
    try {
      await navigator.share({
        files: [lastPackageFile],
        title: "Save property inspection to repository",
        text: "Store this immutable inspection package in the Property Intelligence Repository. Use repository-import.json for its permanent property, inspection, and export paths."
      });
      setStatus("Package handed to the selected repository destination. Keep this inspection until the repository confirms receipt.", "success");
      return true;
    } catch (error) {
      if (error && error.name !== "AbortError") setStatus("The share sheet did not accept the package. Tap Save to Property Intelligence Repository and try again.", "warning");
      return false;
    }
  }

  async function presentPackage(name, blob, manifest) {
    const reportPackage = manifest.package_mode === "chatgpt_report_package";
    if (lastPackageUrl) URL.revokeObjectURL(lastPackageUrl);
    lastPackageUrl = URL.createObjectURL(blob);
    lastPackageFile = typeof File === "function" ? new File([blob], name, { type: "application/zip", lastModified: Date.now() }) : null;
    packageLink.href = lastPackageUrl;
    packageLink.download = name;
    packageLink.textContent = reportPackage ? "Download CHATGPT ANALYSIS PACKAGE" : "Download FULL EVIDENCE ARCHIVE";
    packageLink.hidden = false;
    packageFilename.textContent = name;
    packageInstruction.textContent = reportPackage ? `Save ${name} to the Property Intelligence Repository. It will be filed permanently at ${manifest.repository.inspection_path} without overwriting an older export.` : `Save ${name} to the Property Intelligence Repository as permanent original evidence. The saved inspection remains unchanged on this phone.`;
    packageSummary.textContent = `${reportPackage ? "CHATGPT ANALYSIS PACKAGE" : "FULL EVIDENCE ARCHIVE"}: one immutable repository export contains ${countLabel(manifest.summary.gps_track_point_count, "GPS point")}, ${countLabel(manifest.summary.field_event_count, "field event")}, ${countLabel(manifest.summary.photo_count, "viewable photograph")}, ${countLabel(manifest.summary.voice_note_count, "voice note")}, and ${countLabel(manifest.summary.inspector_thought_count, "inspector thought")}.`;
    packageReady.hidden = false;
    let canShareFile = false;
    try {
      canShareFile = Boolean(lastPackageFile && navigator.share && navigator.canShare && navigator.canShare({ files: [lastPackageFile] }));
    } catch (error) {
      canShareFile = false;
    }
    sharePackageBtn.hidden = !canShareFile;
    updateNextStep();
    if (canShareFile) {
      await shareLastPackage();
    } else {
      const anchor = document.createElement("a");
      anchor.href = lastPackageUrl;
      anchor.download = name;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }

  async function refreshPackageEstimates() {
    const reportEstimate = document.getElementById("reportEstimate");
    const fullEstimate = document.getElementById("fullEstimate");
    const warning = document.getElementById("estimateWarning");
    if (!data.started || !data.inspection_id || !data.photos.length) {
      packageEstimates = packageTools.estimateInspectionPackageSizes({ inspection: data, photoEntries: [], voiceEntries: [] });
    } else {
      try {
        const inventory = await photoStoreSizeInventory(data.inspection_id);
        const byId = new Map(inventory.map(entry => [String(entry.id), entry]));
        const photoEntries = data.photos.map(metadata => byId.get(String(metadata.id)) || {
          id: metadata.id,
          originalBlob: { size: Number(metadata.original_size_bytes) || 0 },
          analysisBlob: { size: Number(metadata.analysis_size_bytes) || 0 }
        });
        const voiceEntries = data.voice_notes.map(metadata => ({ id: metadata.id, audioBlob: { size: Number(metadata.size_bytes) || 0 } }));
        packageEstimates = packageTools.estimateInspectionPackageSizes({
          inspection: data,
          photoEntries,
          voiceEntries,
          mapContext: { terrainBlob: { size: 2500000 }, contourBlob: { size: 100000 }, parcelsText: " ".repeat(9000) }
        });
      } catch (error) {
        reportEstimate.textContent = "Estimate unavailable";
        fullEstimate.textContent = "Estimate unavailable";
        warning.hidden = false;
        warning.textContent = "Saved evidence is intact. Package size will be calculated during export.";
        return null;
      }
    }
    reportEstimate.textContent = `About ${formatBytes(packageEstimates.reportBytes)}`;
    fullEstimate.textContent = `About ${formatBytes(packageEstimates.fullArchiveBytes)}`;
    const overLimit = [];
    if (packageEstimates.reportBytes > 500 * 1024 * 1024) overLimit.push("CHATGPT ANALYSIS PACKAGE");
    if (packageEstimates.fullArchiveBytes > 500 * 1024 * 1024) overLimit.push("FULL EVIDENCE ARCHIVE");
    warning.hidden = overLimit.length === 0;
    warning.textContent = overLimit.length ? `WARNING: ${overLimit.join(" and ")} ${overLimit.length === 1 ? "is" : "are"} estimated to exceed 500 MB. Keep Safari open during creation and save directly to a destination with enough space.` : "";
    return packageEstimates;
  }

  function schedulePackageEstimateRefresh() {
    clearTimeout(estimateRefreshTimer);
    estimateRefreshTimer = setTimeout(() => { refreshPackageEstimates().catch(() => {}); }, 600);
  }

  async function recoverEveryPhoto(packageMode) {
    const entries = [];
    for (let index = 0; index < data.photos.length; index += 1) {
      setStatus(`Verifying photograph ${index + 1} of ${data.photos.length}…`, "active");
      const metadata = data.photos[index];
      const stored = await photoStoreGet(metadata.id);
      if (!stored || !(stored.originalBlob instanceof Blob) || !stored.originalBlob.size) {
        throw new Error(`Photograph ${index + 1} is missing its original bytes.`);
      }
      if (!(stored.analysisBlob instanceof Blob) || !stored.analysisBlob.size) {
        throw new Error(`Photograph ${index + 1} is missing its analysis copy.`);
      }
      if (metadata.original_size_bytes != null && stored.originalBlob.size !== Number(metadata.original_size_bytes)) {
        throw new Error(`Photograph ${index + 1} failed its stored byte-size check.`);
      }
      let analysisBlob = stored.analysisBlob;
      let analysisWidth = metadata.analysis_width_px || null;
      let analysisHeight = metadata.analysis_height_px || null;
      let analysisProfile = metadata.analysis_profile || null;
      const reportReady = analysisProfile && Number(analysisProfile.max_dimension_px) <= 2000 && Number(analysisProfile.jpeg_quality) >= 0.75 && Number(analysisProfile.jpeg_quality) <= 0.82;
      if (packageMode === "report" && !reportReady) {
        setStatus(`Optimizing report photograph ${index + 1} of ${data.photos.length} for upload…`, "active");
        try {
          const optimized = await createAnalysisJpeg(stored.analysisBlob);
          analysisBlob = optimized.blob;
          analysisWidth = optimized.analysisWidth;
          analysisHeight = optimized.analysisHeight;
          analysisProfile = { format: "image/jpeg", max_dimension_px: optimized.maxDimension, jpeg_quality: optimized.jpegQuality, generated_for_report_at: new Date().toISOString() };
        } catch (error) {
          analysisProfile = { retained_existing_analysis_copy: true, optimization_error: error.message };
        }
      }
      entries.push({ id: metadata.id, originalBlob: stored.originalBlob, analysisBlob, analysisWidth, analysisHeight, analysisProfile });
    }
    return entries;
  }

  async function recoverEveryVoiceNote() {
    const entries = [];
    for (let index = 0; index < data.voice_notes.length; index += 1) {
      setStatus(`Verifying voice note ${index + 1} of ${data.voice_notes.length}…`, "active");
      const metadata = data.voice_notes[index];
      const stored = await voiceStoreGet(metadata.id);
      if (!stored || !(stored.audioBlob instanceof Blob) || !stored.audioBlob.size) throw new Error(`Voice note ${index + 1} is missing its audio bytes.`);
      if (metadata.size_bytes != null && stored.audioBlob.size !== Number(metadata.size_bytes)) throw new Error(`Voice note ${index + 1} failed its stored byte-size check.`);
      entries.push({ id: metadata.id, audioBlob: stored.audioBlob });
    }
    return entries;
  }

  async function recoverMapContext() {
    const fetchBlob = async path => {
      try {
        const response = await fetch(path, { cache: "force-cache" });
        if (!response.ok) return null;
        const blob = await response.blob();
        return blob.size ? blob : null;
      } catch (error) {
        return null;
      }
    };
    const fetchParcels = async () => {
      try {
        const response = await fetch("./assets/parcels.json", { cache: "force-cache" });
        if (response.ok) return await response.text();
      } catch (error) {
        // Fall back to the already-loaded in-memory parcel record below.
      }
      return JSON.stringify({ features: parcelFeatures });
    };
    const [terrainBlob, contourBlob, parcelsText] = await Promise.all([
      fetchBlob("./assets/usgs-terrain.png"),
      fetchBlob("./assets/usgs-contours-2ft.png"),
      fetchParcels()
    ]);
    const parsed = JSON.parse(parcelsText);
    if (!Array.isArray(parsed.features)) throw new Error("Offline parcel geometry could not be recovered.");
    return { terrainBlob, contourBlob, parcelsText };
  }

  function validatePackageEvidence(result, packageMode) {
    if (result.manifest.summary.original_photo_evidence_count !== data.photos.length || result.manifest.summary.analysis_photo_count !== data.photos.length) {
      throw new Error("Package photograph counts did not reconcile. No package was released.");
    }
    const expectedOriginalFiles = packageMode === "full_archive" ? data.photos.length : 0;
    if (result.manifest.summary.original_photo_count !== expectedOriginalFiles) throw new Error("Package original-file count did not reconcile. No package was released.");
    if (result.manifest.summary.voice_note_count !== data.voice_notes.length) throw new Error("Package voice-note counts did not reconcile. No package was released.");
  }

  async function buildPackageWithRecovery(packageMode, packageKind) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await gpsWriteQueue;
        await voiceChunkWrites;
        await revalidatePhotoDb();
        if (pendingPhotoQueue.length) await retryPendingPhotos({ silent: true, throwOnFailure: true });
        await reconcileGpsPoints();
        await revalidatePhotoDb();
        const photoEntries = await recoverEveryPhoto(packageMode);
        const voiceEntries = await recoverEveryVoiceNote();
        const mapContext = await recoverMapContext();
        setStatus(packageMode === "full_archive" ? "Building the FULL EVIDENCE ARCHIVE. Keep Safari open…" : "Building the CHATGPT ANALYSIS PACKAGE. Keep Safari open…", "active");
        const coachingState = calculateCoachingState(true);
        const result = await packageTools.createInspectionPackage({
          inspection: Object.assign({}, data, { field_coaching: coachingState }),
          photoEntries,
          voiceEntries,
          mapContext,
          packageMode,
          packageKind,
          appVersion: APP_VERSION,
          sourceUrl: location.href.split(/[?#]/)[0]
        });
        validatePackageEvidence(result, packageMode);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === 0 && dbRecoveryTools.isRetryableConnectionError(error)) {
          ensureEvidenceDbManager().invalidate();
          await openPhotoDb();
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error("Package recovery failed.");
  }

  async function confirmLargePackage(mode) {
    const estimates = await refreshPackageEstimates();
    const bytes = estimates && (mode === "full_archive" ? estimates.fullArchiveBytes : estimates.reportBytes);
    if (!bytes || bytes <= 500 * 1024 * 1024) return true;
    return confirm(`${mode === "full_archive" ? "FULL EVIDENCE ARCHIVE" : "CHATGPT ANALYSIS PACKAGE"} is estimated at ${formatBytes(bytes)}, which exceeds 500 MB. Keep Safari open and confirm the destination has enough free space. Continue?`);
  }

  async function finishInspection(options) {
    const settings = options || {};
    if (packageBusy || photoBusy) return;
    if (!data.started || !data.points.length) {
      setStatus("INSPECTION INCOMPLETE: at least one recorded GPS point is required.", "error");
      return;
    }
    if (!data.photos.length && !pendingPhotoQueue.length) {
      setStatus("INSPECTION INCOMPLETE: at least one photograph is required. Photo markers alone are unacceptable.", "error");
      return;
    }
    if (!settings.reviewed) {
      showDepartureReview();
      return;
    }
    if (!(await confirmLargePackage("report"))) return;
    packageBusy = true;
    updateControls();
    if (watchId !== null) stopTracking({ silent: true, reason: "finish" });
    else if (!data.stopped) {
      data.stopped = new Date().toISOString();
      data.lifecycle_events.push({ type: "inspection_finished", time: data.stopped, source: "button_press" });
      saveState();
    }
    try {
      const result = await buildPackageWithRecovery("report", null);
      await presentPackage(result.fileName, result.blob, result.manifest);
      setStatus(`CHATGPT ANALYSIS PACKAGE COMPLETE: every photograph is viewable and the evidence is organized around the five property decisions, with ${countLabel(data.points.length, "GPS point")}, ${countLabel(data.markers.length, "field event")}, and all ${countLabel(data.voice_notes.length, "voice note")} (${formatBytes(result.blob.size)}). Full-resolution originals remain safely stored for the FULL EVIDENCE ARCHIVE.`, "success");
    } catch (error) {
      setStatus("Your inspection is safe. Close all Property Inspector tabs, reopen the app, and tap Finish Inspection again. Do not press Clear.", "error");
    } finally {
      packageBusy = false;
      updateControls();
    }
  }

  async function exportBackupNow() {
    if (packageBusy || photoBusy || !data.started) return;
    if (!(await confirmLargePackage("full_archive"))) return;
    packageBusy = true;
    updateControls();
    try {
      const result = await buildPackageWithRecovery("full_archive", watchId !== null ? "backup" : null);
      await presentPackage(result.fileName, result.blob, result.manifest);
      setStatus(`FULL ARCHIVE READY: every original photograph byte is in ${result.fileName}.${watchId !== null ? " GPS tracking was not stopped." : ""}`, "success");
    } catch (error) {
      setStatus("Your inspection is safe. Close all Property Inspector tabs, reopen the app, and tap Finish Inspection again. Do not press Clear.", "error");
    } finally {
      packageBusy = false;
      updateControls();
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function countLabel(count, singular, plural) {
    return `${count} ${count === 1 ? singular : (plural || `${singular}s`)}`;
  }

  function downloadText(name, mime, text) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function clearInspection() {
    if (!confirm("Erase the saved track, every marker, every note, and every stored photograph from this phone?")) return;
    if (watchId !== null) stopTracking({ silent: true, reason: "clear" });
    try {
      await gpsWriteQueue;
      await photoStoreClear();
      for (const pending of pendingPhotoQueue.slice()) await removePendingPhoto(pending.id);
      data = emptyInspection();
      coachingTools.ensureInspectionModel(data);
      lastPosition = null;
      latestOrientation = null;
      gpsWriteQueue = Promise.resolve();
      gpsStorageFailed = false;
      coverageSnapshot = null;
      coachingReview = null;
      coverageDirty = true;
      coachingStateSnapshot = null;
      coachingStateLastCalculatedAt = 0;
      localStorage.removeItem(stateKey);
      localStorage.removeItem(legacyStateKey);
      if (lastPackageUrl) URL.revokeObjectURL(lastPackageUrl);
      lastPackageUrl = null;
      lastPackageFile = null;
      packageLink.hidden = true;
      sharePackageBtn.hidden = true;
      packageReady.hidden = true;
      packageFilename.textContent = "";
      packageInstruction.textContent = "";
      redraw();
      renderConditions();
      await renderGallery();
      renderCoaching();
      renderAuditHistory();
      document.getElementById("accuracy").textContent = "—";
      document.getElementById("location").textContent = "—";
      document.getElementById("heading").textContent = "—";
      setStatus("Saved inspection and photographs cleared.", "normal");
    } catch (error) {
      setStatus(`CLEAR FAILED: ${error.message}`, "error");
    }
  }

  async function registerOfflineWorker() {
    if (!("serviceWorker" in navigator)) {
      offlineState.textContent = "Offline unavailable";
      offlineState.dataset.ready = "false";
      updateNextStep();
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      const worker = registration.installing || registration.waiting || registration.active;
      if (worker && worker.state !== "activated") {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Offline preparation timed out.")), 30000);
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") {
              clearTimeout(timeout);
              resolve();
            } else if (worker.state === "redundant") {
              clearTimeout(timeout);
              reject(new Error("Offline worker became redundant."));
            }
          });
        });
      }
      offlineState.textContent = "Offline ready";
      offlineState.dataset.ready = "true";
      offlineReady = true;
      updateControls();
      updateNextStep();
    } catch (error) {
      offlineState.textContent = "Offline setup failed";
      offlineState.dataset.ready = "false";
      updateNextStep();
      setStatus("OFFLINE SETUP FAILED: reload with service before entering the woods.", "error");
    }
  }

  async function initialize() {
    if (!packageTools || !dbRecoveryTools || !coachingTools || !waterTools || !governanceTools || !evidenceSetTools) {
      setStatus("Inspection package code failed to load. Do not begin an inspection.", "error");
      startBtn.disabled = true;
      return;
    }
    if (!window.isSecureContext) {
      setStatus("GPS, camera storage, and offline recovery require the secure HTTPS version of this page. Do not begin from an insecure address.", "error");
      startBtn.disabled = true;
      return;
    }
    loadState();
    governanceTools.ensureGovernanceModel(data);
    saveState();
    lastSavedOrientation = data.orientation_samples.length ? data.orientation_samples[data.orientation_samples.length - 1] : null;
    if (data.started && !data.inspection_id) data.inspection_id = makeId("inspection");
    try {
      await openPhotoDb();
      await revalidatePhotoDb();
      await loadPendingPhotos();
      await reconcileGpsPoints();
      await migrateLegacyPhotos();
      await reconcileStoredPhotos();
      await reconcileStoredVoiceNotes();
      await recoverInterruptedVoiceNote();
      evidenceSetTools.addPearsonSuggestions(data);
    } catch (error) {
      setStatus(`Durable evidence storage is unavailable: ${error.message} Do not begin an inspection in this browser.`, "error");
      startBtn.disabled = true;
    }
    redraw();
    renderConditions();
    await renderGallery();
    await Promise.all([loadParcels(), registerOfflineWorker()]);
    coverageSnapshot = null;
    coachingStateSnapshot = null;
    coverageDirty = true;
    redraw();
    renderCoaching();
    renderAuditHistory();
    renderEvidenceSets();
    if (statusEl.dataset.kind !== "error") {
      setStatus(pendingPhotoQueue.length ? "Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo." : (data.started ? "Saved inspection loaded. Tap Resume Existing Inspection to continue, or Finish Inspection to create the package." : "Ready. Confirm Offline ready, then tap Start Inspection and allow Precise Location."), pendingPhotoQueue.length ? "warning" : "normal");
    }
    schedulePackageEstimateRefresh();
  }

  startBtn.addEventListener("click", startTracking);
  stopBtn.addEventListener("click", () => stopTracking());
  finishBtn.addEventListener("click", () => finishInspection());
  document.getElementById("addArea").addEventListener("click", addInspectionArea);
  document.getElementById("newArea").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addInspectionArea(); } });
  document.getElementById("addQuestion").addEventListener("click", addInvestigationQuestion);
  document.getElementById("newQuestion").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addInvestigationQuestion(); } });
  activeAreaSelect.addEventListener("change", () => {
    data.active_area_id = activeAreaSelect.value;
    const area = data.inspection_areas.find(item => item.area_id === data.active_area_id);
    data.lifecycle_events.push({ type: "inspection_area_selected", time: new Date().toISOString(), area_id: data.active_area_id, area_name: area ? area.name : null, source: "field_control" });
    saveState(); renderCoaching();
    setStatus(`Current area is ${area ? area.name : "selected"}. New evidence will attach automatically.`, "active");
  });
  evidenceRelationshipSelect.addEventListener("change", () => { data.next_evidence_relationship = evidenceRelationshipSelect.value; saveState(); renderCoaching(); });
  nextPhotoValueSelect.addEventListener("change", () => { data.next_photo_value = nextPhotoValueSelect.value; saveState(); renderCoaching(); });
  document.getElementById("reviewEvidence").addEventListener("click", showDepartureReview);
  document.getElementById("continueInspecting").addEventListener("click", () => departureDialog.close());
  document.getElementById("finishAfterReview").addEventListener("click", () => { departureDialog.close(); finishInspection({ reviewed: true }); });
  document.getElementById("wet").addEventListener("click", () => openObservationDialog("wet"));
  document.getElementById("dry").addEventListener("click", () => openObservationDialog("dry"));
  document.getElementById("blocked").addEventListener("click", () => openObservationDialog("blocked"));
  document.getElementById("high").addEventListener("click", () => addMarker("high"));
  document.getElementById("homesite").addEventListener("click", () => addMarker("homesite"));
  document.getElementById("culvert").addEventListener("click", () => addMarker("culvert"));
  document.getElementById("tree").addEventListener("click", () => addMarker("tree"));
  document.getElementById("entrance").addEventListener("click", () => addMarker("entrance"));
  document.getElementById("wildlife").addEventListener("click", () => addMarker("wildlife"));
  document.getElementById("thick").addEventListener("click", () => addMarker("thick"));
  document.getElementById("open").addEventListener("click", () => addMarker("open"));
  document.getElementById("ditch").addEventListener("click", () => addMarker("ditch"));
  document.getElementById("timber").addEventListener("click", () => addMarker("timber"));
  document.getElementById("hazard").addEventListener("click", () => addMarker("hazard"));
  document.getElementById("other").addEventListener("click", () => addMarker("other"));
  document.getElementById("note").addEventListener("click", () => addMarker("note"));
  document.getElementById("thought").addEventListener("click", () => addMarker("thought"));
  document.getElementById("hypothesis").addEventListener("click", openHypothesisDialog);
  document.getElementById("photo").addEventListener("click", () => takePhoto(null));
  document.getElementById("photo").addEventListener("pointerdown", preparePhotoStorage);
  document.getElementById("startPhotoGroup").addEventListener("click", openEvidenceSetDialog);
  document.getElementById("startPhotoGroup").addEventListener("pointerdown", preparePhotoStorage);
  document.getElementById("finishEvidenceSet").addEventListener("click", finishActiveEvidenceSet);
  document.getElementById("addPlotTree").addEventListener("click", openPlotTreeDialog);
  document.getElementById("evidenceSetType").addEventListener("change", showEvidenceSetFields);
  document.getElementById("treeVisibility").addEventListener("change", renderTreeEvidencePlan);
  document.getElementById("treePurpose").addEventListener("change", renderTreeEvidencePlan);
  document.getElementById("timberPlotSize").addEventListener("change", renderTimberPlotRadius);
  document.getElementById("timberPlotCustomAcres").addEventListener("input", renderTimberPlotRadius);
  document.getElementById("cancelEvidenceSet").addEventListener("click", () => document.getElementById("evidenceSetDialog").close());
  document.getElementById("createEvidenceSet").addEventListener("click", createEvidenceSetFromDialog);
  document.getElementById("continueEvidenceSet").addEventListener("click", () => completeGroupPhotoChoice("continue"));
  document.getElementById("finishAfterGroupPhoto").addEventListener("click", () => completeGroupPhotoChoice("finish"));
  document.getElementById("newAfterGroupPhoto").addEventListener("click", () => completeGroupPhotoChoice("new"));
  document.getElementById("removeFromEvidenceSet").addEventListener("click", () => completeGroupPhotoChoice("remove"));
  document.getElementById("groupPhotoDialog").addEventListener("cancel", event => event.preventDefault());
  document.getElementById("groupPhotoRole").addEventListener("change", event => {
    document.getElementById("leafProvenanceLabel").hidden = !["Leaf upper surface", "Leaf underside"].includes(event.target.value);
  });
  document.getElementById("measurementType").addEventListener("change", updateMeasurementFields);
  document.getElementById("measurementUnit").addEventListener("change", event => { document.getElementById("measurementOtherUnitLabel").hidden = event.target.value !== "other"; });
  document.getElementById("saveStructuredMeasurement").addEventListener("click", saveStructuredMeasurement);
  document.getElementById("cancelStructuredMeasurement").addEventListener("click", () => {
    const photoId = pendingMeasurementPhotoId;
    structuredMeasurementDialog.close(); pendingMeasurementPhotoId = null;
    setStatus("Measurement not saved. Change the measuring-device answer or enter the authoritative value before continuing.", "warning");
    if (photoId) openPhotoMeaning(photoId);
  });
  structuredMeasurementDialog.addEventListener("cancel", event => event.preventDefault());
  document.getElementById("savePlotTree").addEventListener("click", savePlotTree);
  document.getElementById("cancelPlotTree").addEventListener("click", () => { pendingPlotTreeId = null; plotTreeDialog.close(); });
  plotTreeDialog.addEventListener("cancel", event => event.preventDefault());
  document.getElementById("more").addEventListener("click", () => {
    moreCategories.hidden = !moreCategories.hidden;
    document.getElementById("more").textContent = moreCategories.hidden ? "More Categories" : "Hide Categories";
  });
  document.getElementById("saveObservation").addEventListener("click", saveStructuredObservation);
  document.getElementById("cancelObservation").addEventListener("click", () => { activeObservationType = null; });
  document.querySelectorAll('input[name="wetDepth"]').forEach(input => input.addEventListener("change", () => {
    document.getElementById("wetExactLabel").hidden = selectedRadioValue("wetDepth") !== "exact";
  }));
  voiceBtn.addEventListener("click", toggleVoiceNote);
  photoInput.addEventListener("change", handlePhotoFile);
  document.getElementById("stopPhotoExplanation").addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      document.getElementById("photoExplanationState").textContent = "Saving the explanation…";
      mediaRecorder.stop();
    }
  });
  photoExplanationDialog.addEventListener("cancel", event => event.preventDefault());
  waterClassificationDialog.addEventListener("cancel", event => event.preventDefault());
  document.getElementById("retryPhotoExplanation").addEventListener("click", () => {
    if (pendingPhotoExplanationId) beginPhotoExplanation(pendingPhotoExplanationId);
  });
  document.getElementById("skipPhotoExplanation").addEventListener("click", () => requestPhotoExplanationDisposition("skipped"));
  document.getElementById("laterPhotoExplanation").addEventListener("click", () => requestPhotoExplanationDisposition("explain_later"));
  document.getElementById("savePhotoMeaning").addEventListener("click", () => persistPhotoMeaning("complete"));
  document.getElementById("photoMeaningLater").addEventListener("click", () => persistPhotoMeaning("explain_later"));
  photoMeaningDialog.addEventListener("cancel", event => event.preventDefault());
  document.getElementById("photoShowsMeasuringDevice").addEventListener("change", event => {
    if (event.target.value === "Yes") document.getElementById("photoMeaningMeasurement").value = "Scale visible in photograph";
  });
  correctRecordBtn.addEventListener("click", () => openCorrectionDialog());
  undoLastBtn.addEventListener("click", openUndoLast);
  document.getElementById("keepLastAction").addEventListener("click", () => { pendingUndoTarget = null; document.getElementById("undoDialog").close(); });
  document.getElementById("confirmUndoLast").addEventListener("click", confirmUndoLast);
  document.getElementById("undoDialog").addEventListener("cancel", event => event.preventDefault());
  document.getElementById("cancelCorrection").addEventListener("click", () => correctionDialog.close());
  document.getElementById("saveCorrection").addEventListener("click", savePermanentCorrection);
  correctionDialog.addEventListener("cancel", event => event.preventDefault());
  document.getElementById("cancelHypothesis").addEventListener("click", () => hypothesisDialog.close());
  document.getElementById("saveHypothesis").addEventListener("click", saveInspectorHypothesis);
  hypothesisDialog.addEventListener("cancel", event => event.preventDefault());
  document.querySelectorAll("[data-water-choice]").forEach(button => button.addEventListener("click", () => chooseWaterType(button.dataset.waterChoice)));
  document.getElementById("saveWaterClassification").addEventListener("click", saveConfirmedWaterClassification);
  document.getElementById("photoWaterDepth").addEventListener("change", event => {
    document.getElementById("photoWaterExactLabel").hidden = event.target.value !== "exact";
  });
  document.getElementById("closeWaterPhoto").addEventListener("click", () => waterPhotoDialog.close());
  document.querySelectorAll("[data-water-layer]").forEach(control => control.addEventListener("change", renderSmallTractWaterMap));
  document.getElementById("allWaterPhotographed").addEventListener("change", event => {
    data.water_observation_rule = {
      all_observed_standing_water_photographed: event.target.checked,
      confirmed_at: event.target.checked ? new Date().toISOString() : null,
      scope: "walked_and_visually_observed_corridor_at_inspection_time"
    };
    saveState();
    redraw();
    setStatus(event.target.checked ? "Field rule saved: within the walked and visually observed corridor, unphotographed locations may support ‘no standing water observed at inspection time.’" : "Field rule removed. The report will not infer inspected dry ground from missing water photographs.", "active");
  });
  sharePackageBtn.addEventListener("click", shareLastPackage);
  clearBtn.addEventListener("click", clearInspection);
  document.getElementById("backup").addEventListener("click", exportBackupNow);
  fullArchiveBtn.addEventListener("click", exportBackupNow);
  retryPendingPhotoBtn.addEventListener("click", () => retryPendingPhotos());
  document.getElementById("galleryPrevious").addEventListener("click", () => { galleryPage = Math.max(0, galleryPage - 1); renderGallery(); });
  document.getElementById("galleryNext").addEventListener("click", () => { galleryPage += 1; renderGallery(); });
  Object.keys(conditionBindings).forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener("change", saveConditionsFromUi);
    element.addEventListener("blur", saveConditionsFromUi);
  });
  Object.keys(weatherContextBindings).forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener("change", saveConditionsFromUi);
    element.addEventListener("blur", saveConditionsFromUi);
  });
  document.getElementById("csv").addEventListener("click", () => downloadText("Pearson_Road_Field_Track.csv", "text/csv", packageTools.createCsv(data, [])));
  document.getElementById("geojson").addEventListener("click", () => downloadText("Pearson_Road_Field_Track.geojson", "application/geo+json", packageTools.createGeoJSON(data, [])));
  document.getElementById("gpx").addEventListener("click", () => downloadText("Pearson_Road_Field_Track.gpx", "application/gpx+xml", packageTools.createGpx(data, [])));
  document.getElementById("contourOpacity").addEventListener("input", event => { document.getElementById("contours").style.opacity = event.target.value; });
  document.getElementById("terrainOpacity").addEventListener("input", event => { document.getElementById("hillshade").style.opacity = event.target.value; });
  [document.getElementById("hillshade"), document.getElementById("contours")].forEach(image => image.addEventListener("error", () => {
    image.hidden = true;
    setStatus("A background map image is unavailable. GPS, observations, photos, and notes still work; continue using the parcel and route overlay.", "warning");
  }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (watchId !== null && !wakeLock) keepAwake();
      preparePhotoStorage();
    }
  });
  window.addEventListener("beforeunload", event => {
    if (photoBusy || packageBusy) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  setInterval(updateTimeMetrics, 30000);

  initialize();
})();
