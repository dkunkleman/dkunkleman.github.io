(function () {
  "use strict";

  const APP_VERSION = "3.13.0-home-test.5.1-safari-direct-4";
  const DIRECT_BASELINE_COMMIT = "ed42ca2df4f6ca01fc05f52a652c3821a2007da7";
  const DIRECT_APP_MODE = "DIRECT_APP_FILE_NO_RUNTIME_SOURCE_PATCH";
  const SIMPLE_TEST_BUILD = "field-simple-test-313";
  const SIMPLE_AUTOMATION_MODE = ["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).get("automation") === "1";
  const W = 1800;
  const H = 1500;
  const xmin = -87.1;
  const ymin = 30.4825;
  const xmax = -87.083;
  const ymax = 30.497;
  const stateKey = "propertyInspectorHomeTest313V1";
  const legacyStateKey = "propertyInspectorHomeTest313LegacyDisabled";
  const photoDbName = "property-inspector-home-test-313-evidence";
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
  const synthesisTools = window.ReviewedPropertySynthesis;
  const weatherTools = window.AuthoritativeWeather;
  const frontageTools = window.PropertyFrontageWorkflow;
  const automaticContextTools = window.AutomaticFieldContext;
  const sectionMappingTools = window.SimpleSectionMapping;
  const wetEdgeTools = window.WetEdgeMapping;
  const previsitTools = window.PropertyPrevisitReview;
  const pendingPhotoCacheName = "property-inspector-home-test-313-pending-v1";

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
  let routeDisplayCache = { key: "", model: null };
  let simpleActiveSessionId = null;
  let simpleLastSavedMessage = "";
  let simplePreviewUrl = null;
  let ambientSoundStopTimer = null;
  let automaticContextGpsCapturedForRun = false;
  let automaticContextRefreshPromise = null;
  let august4RouteContext = null;
  let aerialTraceDraft = null;
  let fieldGpsFixPromise = null;
  let gpsWatchGeneration = 0;
  let gpsRestartTimer = null;
  let gpsRestartAttempt = 0;
  let gpsPermissionDenied = false;
  let lastGpsFixReceivedAt = 0;
  const GPS_STALE_MS = 90000;
  let gpsUserActivatedThisPage = false;
  let lastGpsErrorCode = null;
  let lastGpsErrorMessage = "";
  let lastGpsErrorAt = null;
  let gpsManualRequestInFlight = false;
  let gpsRecoveryReason = "";

  const simpleShell = document.getElementById("simpleShell");
  if (simpleShell) {
    simpleShell.addEventListener("click", event => {
      const button = event.target && event.target.closest ? event.target.closest("button") : null;
      if (!button || button.disabled || !simpleShell.contains(button)) return;
      if (button.id === "simpleGpsControl") return;
      const label = String(button.textContent || "FIELD ACTION").trim().replace(/\s+/g, " ");
      simpleSetStatus(`TAP SAVED — ${label}`, "warning");
    }, true);
  }

    function visibleGpsMessage() {
    const fresh = freshFieldPosition();
    if (fresh) return `GPS ACTIVE — accuracy +/-${Math.round(fresh.accuracy_m || 0)} m`;
    if (gpsManualRequestInFlight) return "GPS REQUEST SENT — waiting for Safari location.";
    if (gpsPermissionDenied || lastGpsErrorCode === 1) return "GPS PERMISSION OFF — Safari is not allowed to use location.";
    if (lastGpsErrorCode === 2) return "GPS POSITION UNAVAILABLE — automatic recovery is trying; tap RECONNECT GPS if needed.";
    if (lastGpsErrorCode === 3) return "GPS TIMEOUT — automatic recovery is trying; tap RECONNECT GPS if needed.";
    if (gpsRecoveryReason) return gpsRecoveryReason;
    if (watchId !== null) return "GPS STARTING — waiting for Safari location.";
    if (data.started) return "GPS IS NOT CONNECTED — tap RECONNECT GPS.";
    return "GPS has not started yet.";
  }

    function updateVisibleGpsControl() {
    const wrap = document.getElementById("simpleGpsControlWrap");
    const button = document.getElementById("simpleGpsControl");
    const message = document.getElementById("simpleGpsControlStatus");
    if (!wrap || !button || !message) return;
    const fresh = freshFieldPosition();
    const stale = data.started && !data.stopped && watchId !== null && gpsWatcherIsStale();
    const needsRecovery = Boolean(data.started && !data.stopped && !fresh && (gpsManualRequestInFlight || lastGpsErrorCode != null || gpsRecoveryReason || watchId === null || stale));
    wrap.hidden = !needsRecovery;
    button.disabled = gpsManualRequestInFlight;
    button.textContent = gpsManualRequestInFlight ? "GPS REQUEST IN PROGRESS" : "RECONNECT GPS";
    message.textContent = visibleGpsMessage();
  }

    function requestGpsFromVisibleControl() {
    gpsUserActivatedThisPage = true;
    gpsManualRequestInFlight = true;
    gpsRecoveryReason = "";
    gpsPermissionDenied = false;
    lastGpsErrorCode = null;
    lastGpsErrorMessage = "";
    lastGpsErrorAt = null;
    if (!("geolocation" in navigator)) {
      gpsManualRequestInFlight = false;
      lastGpsErrorCode = 0;
      lastGpsErrorMessage = "geolocation unavailable";
      updateVisibleGpsControl();
      simpleSetStatus("GPS UNAVAILABLE ON THIS PHONE. Field records still save.", "warning");
      return;
    }

    const now = new Date().toISOString();
    if (!data.inspection_id) data.inspection_id = makeId("inspection");
    if (!data.started) {
      data.started = now;
      if (!data.conditions.inspection_date) data.conditions.inspection_date = now.slice(0, 10);
      data.lifecycle_events.push({ type: "inspection_started", time: now, source: "visible_gps_button" });
    } else if (data.stopped) {
      data.stopped = null;
      data.lifecycle_events.push({ type: "inspection_resumed", time: now, source: "visible_gps_button" });
    } else {
      data.lifecycle_events.push({ type: "gps_restart_requested", time: now, source: "visible_gps_button" });
    }
    saveState();
    clearActiveGpsWatch();
    simpleSetStatus("GPS REQUEST SENT — waiting for Safari location.", "warning");
    setStatus("GPS REQUEST SENT — waiting for Safari location.", "active");
    updateVisibleGpsControl();

    // Keep the Safari geolocation request directly inside the user's tap handler.
    navigator.geolocation.getCurrentPosition(position => {
      gpsManualRequestInFlight = false;
      gpsRecoveryReason = "";
      onPosition(position);
      if (watchId === null) startGpsWatcher();
      keepAwake();
      updateControls();
      updateVisibleGpsControl();
    }, error => {
      gpsManualRequestInFlight = false;
      onGpsError(error, gpsWatchGeneration);
      updateVisibleGpsControl();
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  }

    function installVisibleGpsControl() {
    if (!simpleShell || document.getElementById("simpleGpsControlWrap")) return;
    const wrap = document.createElement("section");
    wrap.id = "simpleGpsControlWrap";
    wrap.hidden = true;
    wrap.setAttribute("aria-label", "GPS recovery control");
    wrap.style.cssText = "margin:10px;padding:12px;border:4px solid #b33a00;border-radius:10px;background:#fff7ed;position:relative;z-index:30";
    wrap.innerHTML = '<div id="simpleGpsControlStatus" style="font-weight:900;font-size:17px;line-height:1.3;margin-bottom:8px"></div><button id="simpleGpsControl" type="button" style="width:100%;min-height:68px;background:#b33a00;color:#fff;font-size:20px;font-weight:900;border:0;border-radius:9px">RECONNECT GPS</button>';
    simpleShell.insertBefore(wrap, simpleShell.firstChild);
    document.getElementById("simpleGpsControl").addEventListener("click", requestGpsFromVisibleControl);
    updateVisibleGpsControl();
  }

  installVisibleGpsControl();

  function captureAutomaticContext(reason, position) {
    if (!automaticContextTools) return null;
    const snapshot = automaticContextTools.captureDeviceSnapshot(data, {
      reason,
      position: position || null,
      orientation: latestOrientation,
      app_version: APP_VERSION,
      parcel_position: subjectParcel() ? "SUBJECT_PARCEL_CONTEXT_LOADED_POSITION_NOT_SURVEYED" : "UNKNOWN",
      browser_recovery_context: {
        indexeddb_name: photoDbName,
        local_storage_key: stateKey,
        service_worker_scope: "./",
        pending_photo_count: pendingPhotoQueue.length
      }
    });
    return snapshot && snapshot.context_id;
  }

  function refreshAutomaticExternalContext(position) {
    if (!automaticContextTools || !position) return Promise.resolve(null);
    if (automaticContextRefreshPromise) return automaticContextRefreshPromise;
    const existingModel = automaticContextTools.ensureModel(data);
    const refreshedAt = existingModel.last_external_refresh_at && new Date(existingModel.last_external_refresh_at).getTime();
    if (Number.isFinite(refreshedAt) && Date.now() - refreshedAt < 15 * 60 * 1000) return Promise.resolve(existingModel);
    automaticContextRefreshPromise = automaticContextTools.retrieveOfficialContext(data, { position })
      .then(model => { saveState(); return model; })
      .catch(error => {
        const model = automaticContextTools.ensureModel(data);
        model.external_refresh_status = "OFFLINE_OR_UNAVAILABLE";
        model.retrieval_attempts.push({ provider: "automatic_context", status: "FAILED_NONBLOCKING", retrieved_at: new Date().toISOString(), error: error.message });
        saveState();
        return model;
      })
      .finally(() => { automaticContextRefreshPromise = null; });
    return automaticContextRefreshPromise;
  }

  function emptyInspection() {
    return {
      schema_name: "property-intelligence-inspection",
      schema_version: "1.2",
      build_mode: SIMPLE_TEST_BUILD,
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
      review_phase_suggestions: [],
      review_synthesis_events: [],
      simple_sessions: [],
      simple_counters: {},
      active_simple_session_id: null,
      site_sound_records: [],
      automatic_context: null,
      section_mapping: null,
      wet_edge_mapping: null,
      property_previsit_review: null,
      frontage_workflow: null,
      land_use_concepts: [],
      reviewed_map_status: {},
      imported_chat_review_annotations: [],
      inspector_identity: "Field Inspector",
      weather_context: {
        named_event: "", event_dates: "", days_between_event_and_inspection: "", authoritative_rainfall_totals: "",
        weather_station_distance_from_parcel: "", inspector_reported_recent_local_rain: "", potentially_relevant_mechanism: "unknown",
        source_limit: "Weather context does not establish site causation or year-round conditions."
      },
      authoritative_weather: null,
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
    data.build_mode = SIMPLE_TEST_BUILD;
    data.simple_sessions = Array.isArray(data.simple_sessions) ? data.simple_sessions : [];
    data.simple_counters = data.simple_counters && typeof data.simple_counters === "object" ? data.simple_counters : {};
    data.active_simple_session_id = data.active_simple_session_id || null;
    simpleActiveSessionId = data.active_simple_session_id;
    if (frontageTools) frontageTools.ensureModel(data);
    if (automaticContextTools) automaticContextTools.ensureModel(data);
    if (sectionMappingTools) sectionMappingTools.ensureModel(data);
    if (wetEdgeTools) wetEdgeTools.ensureModel(data);
    if (previsitTools) previsitTools.ensureModel(data);
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
    if (synthesisTools) synthesisTools.ensureModel(data);
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

  function weatherPropertyLocation() {
    const rings = subjectRings();
    const points = rings.reduce((all, ring) => all.concat(Array.isArray(ring) ? ring : []), []);
    if (points.length) {
      return {
        longitude: points.reduce((sum, point) => sum + Number(point[0]), 0) / points.length,
        latitude: points.reduce((sum, point) => sum + Number(point[1]), 0) / points.length,
        method: "Recorded subject parcel geometry reference point"
      };
    }
    const gps = data.points[0] || lastPosition;
    return gps ? { longitude: Number(gps.lon), latitude: Number(gps.lat), method: "First recorded inspection GPS point" } : null;
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
    renderReviewedSynthesis();
    updateNextStep();
  }

  function recordIsActive(recordType, recordId) {
    return !governanceTools || governanceTools.recordStatus(data, recordType, recordId) !== "voided";
  }

  function pearsonAugust3ReviewCutoff() {
    const inspectionDate = String(data.conditions && data.conditions.inspection_date || data.started || "").slice(0, 10);
    const p3 = data.photos.find(item => Number(String(item.photo_number || "").replace(/\D/g, "")) === 3);
    const p3Time = Date.parse(p3 && (p3.recorded_at || p3.time) || "");
    return String(data.property_id || "") === "parcel:221S280000001010000" && inspectionDate === "2026-08-03" && Number.isFinite(p3Time) && data.photos.some(item => Number(String(item.photo_number || "").replace(/\D/g, "")) === 196) ? p3Time : null;
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
    const pearsonCutoff = pearsonAugust3ReviewCutoff();
    const points = pearsonCutoff != null ? data.points.filter(point => { const time = Date.parse(point.time || ""); return !Number.isFinite(time) || time >= pearsonCutoff; }) : data.points;
    return Object.assign({}, data, { points, markers, photos, voice_notes: voices });
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

  function renderReviewedSynthesis(mode) {
    if (!synthesisTools) return;
    synthesisTools.ensureModel(data);
    const panel = document.getElementById("reviewSynthesisPanel");
    const summary = document.getElementById("reviewSynthesisSummary");
    const phases = data.review_phase_suggestions || [];
    const approved = phases.filter(item => item.status === "approved").length;
    const pending = phases.filter(item => item.status === "pending_inspector_confirmation").length;
    summary.textContent = phases.length
      ? `${approved} Pearson review phase${approved === 1 ? "" : "s"} approved; ${pending} pending. Pending phases and concepts are excluded from active findings.`
      : "Pearson reviewed phases will appear after the complete P3-P196 inspection is present on this phone.";
    if (!mode) return;
    panel.hidden = false;
    panel.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = mode === "phases" ? "Reviewed Pearson photo phases" : mode === "homesite" ? "Conceptual homesite and land-use layers" : `${mode[0].toUpperCase()}${mode.slice(1)} map approval`;
    panel.appendChild(heading);

    const addDecisionRow = (item, id, label, description) => {
      const row = document.createElement("div");
      row.className = "review-synthesis-row";
      row.dataset.status = item.status;
      const title = document.createElement("strong");
      title.textContent = `${label} - ${item.status.replaceAll("_", " ")}`;
      const detail = document.createElement("p");
      detail.className = "small";
      detail.textContent = description;
      const actions = document.createElement("div");
      actions.className = "review-synthesis-actions";
      const approve = document.createElement("button");
      approve.type = "button";
      approve.textContent = item.status === "approved" ? "APPROVED" : "Approve";
      approve.disabled = item.status === "approved";
      approve.addEventListener("click", () => {
        synthesisTools.reviewItem(data, id, "approved", data.inspector_identity);
        saveState(); renderReviewedSynthesis(mode); setStatus(`${label} approved and available to the report.`, "success");
      });
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "cancel";
      reject.textContent = item.status === "rejected" ? "REJECTED" : "Reject / keep out";
      reject.disabled = item.status === "rejected";
      reject.addEventListener("click", () => {
        synthesisTools.reviewItem(data, id, "rejected", data.inspector_identity);
        saveState(); renderReviewedSynthesis(mode); setStatus(`${label} rejected. Original evidence remains unchanged.`, "active");
      });
      actions.append(approve, reject); row.append(title, detail, actions); panel.appendChild(row);
    };

    if (mode === "phases") {
      phases.forEach(item => addDecisionRow(item, item.review_item_id, `${item.from === item.to ? `P${item.from}` : `P${item.from}-P${item.to}`} - ${item.title}`, `${item.area}. ${item.meaning} Classification: ${item.classification}. Confidence: ${item.confidence}.`));
      if (!phases.length) panel.append(Object.assign(document.createElement("p"), { textContent: "The complete Pearson P3-P196 sequence is not present yet. Nothing was inferred." }));
      return;
    }
    if (mode === "homesite") {
      const mapStatus = data.reviewed_map_status.homesite;
      const note = document.createElement("p");
      note.className = "field-warning";
      note.textContent = synthesisTools.HOMESITE_WARNING;
      panel.appendChild(note);
      (data.land_use_concepts || []).forEach(item => addDecisionRow(item, item.concept_id, item.label, `${item.area}. ${item.meaning} ${item.warning}`));
      const mapButton = document.createElement("button");
      mapButton.type = "button";
      mapButton.textContent = mapStatus === "approved" ? "HOMESITE MAP APPROVED" : "Approve homesite map framework";
      mapButton.disabled = mapStatus === "approved";
      mapButton.addEventListener("click", () => { synthesisTools.setMapReview(data, "homesite", "approved", data.inspector_identity); saveState(); renderReviewedSynthesis(mode); });
      panel.appendChild(mapButton);
      return;
    }
    const mapId = mode;
    const status = data.reviewed_map_status[mapId] || "pending_inspector_confirmation";
    const row = document.createElement("div");
    row.className = "review-synthesis-row";
    row.dataset.status = status;
    const description = document.createElement("p");
    description.textContent = mapId === "water" ? synthesisTools.WATER_SCOPE_RULE : mapId === "creek" ? synthesisTools.CREEK_WARNING : "Vegetation zones are inspector interpretations. Actual clearing cost requires contractor pricing.";
    const approve = document.createElement("button");
    approve.type = "button";
    approve.textContent = status === "approved" ? "MAP REVIEW APPROVED" : "Approve this map interpretation";
    approve.disabled = status === "approved";
    approve.addEventListener("click", () => { synthesisTools.setMapReview(data, mapId, "approved", data.inspector_identity); saveState(); renderReviewedSynthesis(mode); setStatus(`${mapId} map review approved.`, "success"); });
    row.append(description, approve); panel.appendChild(row);
    if (mapId === "water") document.getElementById("smallWaterMapFrame").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function markNewInspectionPhase() {
    if (!data.started) { setStatus("Start the inspection before marking a new phase or relocation.", "warning"); return; }
    const label = prompt("Name the new inspection phase or relocation. Example: Drove to Small Tract.", "New inspection phase");
    if (label === null) return;
    data.lifecycle_events.push({ type: "new_inspection_phase", time: new Date().toISOString(), label: label.trim() || "New inspection phase", area_id: data.active_area_id || null, source: "button_press", route_break_required: true });
    saveState(); setStatus("New phase marked. The report route will start a separate walked segment and will not draw a false straight jump.", "success");
  }

  async function importChatReviewFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file || !synthesisTools) return;
    try {
      const parsed = JSON.parse(await file.text());
      const count = synthesisTools.importChatReview(data, parsed);
      saveState(); renderReviewedSynthesis("phases");
      setStatus(`${count} ChatGPT review annotation${count === 1 ? "" : "s"} imported as pending. Nothing was activated.`, "success");
    } catch (error) { setStatus(`CHATGPT REVIEW NOT IMPORTED: ${error.message}`, "error"); }
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

  function currentSegmentedRoute() {
    if (!synthesisTools) return null;
    const lastPoint = data.points[data.points.length - 1];
    const lastEvent = data.lifecycle_events[data.lifecycle_events.length - 1];
    const lastPhoto = data.photos[data.photos.length - 1];
    const key = [data.points.length, lastPoint && lastPoint.time, data.lifecycle_events.length, lastEvent && lastEvent.time, data.photos.length, lastPhoto && (lastPhoto.recorded_at || lastPhoto.time)].join("|");
    if (routeDisplayCache.key !== key) {
      const pearsonCutoff = pearsonAugust3ReviewCutoff();
      const activePoints = pearsonCutoff != null ? data.points.filter(point => { const time = Date.parse(point.time || ""); return !Number.isFinite(time) || time >= pearsonCutoff; }) : data.points;
      routeDisplayCache = { key, model: synthesisTools.segmentRoute(activePoints, data) };
    }
    return routeDisplayCache.model;
  }

  function totalDistance() {
    const segmented = currentSegmentedRoute();
    if (segmented) return segmented.distance_walked_m;
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

  function renderAuthoritativeWeather() {
    const panel = document.getElementById("authoritativeWeatherPanel");
    const status = document.getElementById("authoritativeWeatherStatus");
    const details = document.getElementById("authoritativeWeatherDetails");
    if (!panel || !status || !details) return;
    const record = data.authoritative_weather;
    if (!record || record.status !== "VERIFIED_OFFICIAL_RECORD") {
      panel.dataset.state = record ? "warning" : "pending";
      status.textContent = record ? "Official record not yet verified" : "Waiting for inspection date";
      details.textContent = record && record.limitations ? record.limitations[0] : "The app retrieves official historical weather automatically and preserves a verified offline copy.";
      return;
    }
    const windows = record.precipitation_windows;
    panel.dataset.state = "verified";
    status.textContent = "Official NOAA weather verified and saved";
    details.innerHTML = `<strong>${record.station.name} (${record.station.station_id})</strong><br>${record.station.distance_from_property_miles} miles west by ${record.station.distance_method.toLowerCase()}; inspector approximation ${record.station.inspector_supplied_approximation_miles} miles.<br><strong>Previous day:</strong> ${windows.previous_calendar_day.observed_in} in / ${windows.previous_calendar_day.normal_in} in normal (${windows.previous_calendar_day.times_normal}x).<br><strong>Previous 7 full days:</strong> ${windows.previous_7_full_days.observed_in} in / ${windows.previous_7_full_days.normal_in} in normal (${windows.previous_7_full_days.times_normal}x).<br><strong>Previous 30 full days:</strong> ${windows.previous_30_full_days.observed_in} in / ${windows.previous_30_full_days.normal_in} in normal (${windows.previous_30_full_days.percent_above_or_below_normal}% above).<br><span class="small">Station rainfall may differ from parcel rainfall. Weather context does not prove site causation or year-round conditions.</span>`;
  }

  function applyAuthoritativeWeatherToConditions(record) {
    if (!record || record.status !== "VERIFIED_OFFICIAL_RECORD") return;
    const windows = record.precipitation_windows;
    const assignOfficialIfNotManual = (key, value) => {
      const existing = String(data.conditions[key] || "");
      if (!existing || / at US[A-Z0-9]+; parcel rainfall may differ$/i.test(existing)) data.conditions[key] = value;
    };
    assignOfficialIfNotManual("rainfall_previous_24_hours", `${windows.previous_calendar_day.observed_in} in at ${record.station.station_id}; parcel rainfall may differ`);
    assignOfficialIfNotManual("rainfall_previous_7_days", `${windows.previous_7_full_days.observed_in} in at ${record.station.station_id}; parcel rainfall may differ`);
    assignOfficialIfNotManual("rainfall_previous_30_days", `${windows.previous_30_full_days.observed_in} in at ${record.station.station_id}; parcel rainfall may differ`);
    data.weather_context.authoritative_rainfall_totals = weatherTools.summary(record);
    data.weather_context.weather_station_distance_from_parcel = `${record.station.distance_from_property_miles} miles straight-line from recorded parcel reference point; inspector approximation ${record.station.inspector_supplied_approximation_miles} miles`;
    if (!data.weather_context.named_event) data.weather_context.named_event = (record.significant_weather_events || []).map(item => item.event_name).join("; ");
    if (!data.weather_context.event_dates) data.weather_context.event_dates = (record.significant_weather_events || []).map(item => item.event_dates).join("; ");
  }

  async function refreshAuthoritativeWeather(options) {
    const settings = options || {};
    if (!weatherTools) throw new Error("Authoritative weather tools did not load.");
    const inspectionDate = data.conditions.inspection_date || (data.started ? data.started.slice(0, 10) : "");
    if (!inspectionDate) {
      renderAuthoritativeWeather();
      return null;
    }
    const previousVerified = weatherTools.contextIsComplete(data.authoritative_weather, inspectionDate);
    if (!settings.silent) setStatus("Retrieving official NOAA historical weather and preserving its source record...", "active");
    const record = await weatherTools.resolve({
      inspectionDate,
      propertyLocation: weatherPropertyLocation(),
      existing: settings.force ? null : data.authoritative_weather,
      fetchImpl: navigator.onLine ? window.fetch.bind(window) : null,
      retrievedAt: new Date().toISOString()
    });
    data.authoritative_weather = record;
    applyAuthoritativeWeatherToConditions(record);
    if (!previousVerified && record.status === "VERIFIED_OFFICIAL_RECORD") {
      data.lifecycle_events.push({
        type: "authoritative_weather_context_attached",
        time: new Date().toISOString(),
        source: "automatic_finish_workflow",
        station_id: record.station.station_id,
        inspection_date: inspectionDate
      });
    }
    saveState();
    renderConditions();
    renderAuthoritativeWeather();
    if (!settings.silent) {
      setStatus(record.status === "VERIFIED_OFFICIAL_RECORD" ? "Official NOAA historical weather verified and saved with the inspection." : "Official weather could not yet be verified. The inspection remains safe; reconnect and retry before final repository storage.", record.status === "VERIFIED_OFFICIAL_RECORD" ? "success" : "warning");
    }
    return record;
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
    smallTractWaterModel = waterTools.buildSmallTractWaterMapModel({ inspection: waterInspection, subjectFeature: subject, statedSmallTractAcres: 5.48 });
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
    const segmentedRoute = currentSegmentedRoute();
    const routeDisplayPoints = segmentedRoute ? segmentedRoute.segments.flatMap(segment => segment.points) : data.points;
    const visiblePoints = routeDisplayPoints.filter(point => point.lon >= xmin && point.lon <= xmax && point.lat >= ymin && point.lat <= ymax);
    const routeSegments = segmentedRoute ? segmentedRoute.segments : [{ points: visiblePoints }];
    routeSegments.forEach(segment => {
      const inside = segment.points.filter(point => point.lon >= xmin && point.lon <= xmax && point.lat >= ymin && point.lat <= ymax);
      const pathStride = Math.max(1, Math.ceil(inside.length / 1500));
      const displayPoints = inside.filter((point, index) => index % pathStride === 0 || index === inside.length - 1);
      if (displayPoints.length < 2) return;
      const path = displayPoints.map((point, index) => `${index ? "L" : "M"}${sx(point.lon).toFixed(1)} ${sy(point.lat).toFixed(1)}`).join(" ");
      addSvg("path", { d: path, fill: "none", stroke: "#111", "stroke-width": 10, "vector-effect": "non-scaling-stroke", opacity: 0.82 });
      addSvg("path", { d: path, fill: "none", stroke: "#ffe54a", "stroke-width": 5, "vector-effect": "non-scaling-stroke" });
    });
    if (segmentedRoute) segmentedRoute.relocations.filter(item => item.display !== "no_connector").forEach(item => {
      const coordinates = item.geometry && item.geometry.coordinates || [];
      if (coordinates.length !== 2) return;
      const path = coordinates.map((point, index) => `${index ? "L" : "M"}${sx(point[0]).toFixed(1)} ${sy(point[1]).toFixed(1)}`).join(" ");
      const connector = addSvg("path", { d: path, fill: "none", stroke: "#8a8a8a", "stroke-width": 5, "stroke-dasharray": "14 12", "vector-effect": "non-scaling-stroke" });
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = "Unverified relocation - not a walked route";
      connector.appendChild(title);
    });
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
    document.getElementById("pointCount").textContent = routeDisplayPoints.length;
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
      renderSimpleLocator();
    } catch (error) {
      parcelFeatures = [];
      redraw();
      renderSimpleLocator();
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
    startBtn.textContent = data.started ? (tracking ? "GPS ACTIVE" : "START / RESTART GPS") : "START INSPECTION";
    startBtn.disabled = !offlineReady || tracking || photoBusy || packageBusy || recordingVoice;
    stopBtn.disabled = !tracking || photoBusy || packageBusy || recordingVoice;
    markerButtons.forEach(button => { button.disabled = photoBusy || packageBusy || recordingVoice; });
    voiceBtn.disabled = photoBusy || packageBusy;
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
    renderSimpleHeader();
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
      information_class: "CAPTURED_BY_DEVICE",
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
      information_class: "CAPTURED_BY_DEVICE",
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
    const sectionAtFix = sectionMappingTools ? sectionMappingTools.activeSection(data) : null;
    if (sectionAtFix && !sectionAtFix.capture_paused) {
      point.section_id = sectionAtFix.section_id;
      point.section_capture_status = "ACTIVE_EDGE_CAPTURE";
    }
    data.points.push(point);
    if (sectionMappingTools) sectionMappingTools.appendWalkPoint(data, point, point.time);
    if (wetEdgeTools) wetEdgeTools.appendWalkPoint(data, point, point.time);
    resolvePendingLocationRecords(point);
    if (!automaticContextGpsCapturedForRun) {
      captureAutomaticContext("first_precise_gps_after_start_or_resume", point);
      automaticContextGpsCapturedForRun = true;
      refreshAutomaticExternalContext(point);
    }
    coverageDirty = true;
    const canonicalPointForWrite = Object.assign({}, point);
    gpsWriteQueue = gpsWriteQueue
      .then(() => gpsPointPut(data.inspection_id, canonicalPointForWrite))
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
    lastGpsFixReceivedAt = Date.now();
    gpsManualRequestInFlight = false;
    gpsRecoveryReason = "";
    gpsRestartAttempt = 0;
    gpsPermissionDenied = false;
    lastGpsErrorCode = null;
    lastGpsErrorMessage = "";
    lastGpsErrorAt = null;
    document.getElementById("pointCount").textContent = data.points.length;
    if (data.points.length === 1 || data.points.length % 5 === 0) redraw();
    lastPosition = point;
    document.getElementById("accuracy").textContent = `${Math.round(coordinates.accuracy)} m`;
    document.getElementById("location").textContent = `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
    setStatus(`GPS active · accuracy ±${Math.round(coordinates.accuracy)} m · ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`, "active");
    renderSimpleHeader();
    renderSimpleLocator();
  }

    function freshFieldPosition(maxAgeMs) {
    if (!lastPosition) return null;
    const ageLimit = Number.isFinite(Number(maxAgeMs)) ? Number(maxAgeMs) : 120000;
    const recordedAt = Date.parse(lastPosition.time || "");
    if (!Number.isFinite(recordedAt) || Date.now() - recordedAt > ageLimit) return null;
    return lastPosition;
  }

  function clearActiveGpsWatch() {
    gpsWatchGeneration += 1;
    if (watchId !== null) {
      try { navigator.geolocation.clearWatch(watchId); } catch (error) { /* Safari may already have dropped it. */ }
    }
    watchId = null;
  }

  function gpsWatcherIsStale() {
    if (watchId === null) return true;
    if (!lastGpsFixReceivedAt) return !freshFieldPosition();
    return Date.now() - lastGpsFixReceivedAt > GPS_STALE_MS;
  }

  function scheduleGpsRestart(delayMs) {
    if (gpsPermissionDenied || !data.started || data.stopped) return;
    if (gpsRestartTimer) return;
    const delay = Math.max(500, Math.min(Number(delayMs) || 1000, 10000));
    gpsRestartTimer = setTimeout(() => {
      gpsRestartTimer = null;
      if (gpsPermissionDenied || !data.started || data.stopped) return;
      startTracking({ recovery: true, skipReconcile: true }).catch(error => {
        setStatus(`GPS reconnect failed: ${error.message}. Records still save with location pending.`, "warning");
      });
    }, delay);
  }

  function startGpsWatcher() {
    clearActiveGpsWatch();
    const generation = gpsWatchGeneration;
    const id = navigator.geolocation.watchPosition(position => {
      if (generation !== gpsWatchGeneration) return;
      onPosition(position);
    }, error => {
      if (generation !== gpsWatchGeneration) return;
      onGpsError(error, generation);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    if (generation !== gpsWatchGeneration) {
      try { navigator.geolocation.clearWatch(id); } catch (error) { /* superseded immediately */ }
      return null;
    }
    watchId = id;
    return id;
  }

    function explainGpsProblem(error) {
    const code = error && Number(error.code);
    lastGpsErrorCode = Number.isFinite(code) ? code : 0;
    lastGpsErrorMessage = error && error.message ? String(error.message) : "unknown error";
    lastGpsErrorAt = new Date().toISOString();
    if (code === 1) {
      gpsPermissionDenied = true;
      return "GPS PERMISSION OFF. Safari cannot use location until Location access is allowed. Field records still save.";
    }
    if (code === 2) return "GPS POSITION UNAVAILABLE. Safari has not produced a location. Field records still save.";
    if (code === 3) return "GPS TIMEOUT. Safari did not return a location before the timeout. Field records still save.";
    return `GPS ERROR: ${lastGpsErrorMessage}. Field records still save.`;
  }

      function onGpsError(error, generation) {
    if (generation != null && generation !== gpsWatchGeneration) return;
    gpsManualRequestInFlight = false;
    gpsRecoveryReason = "GPS LOST — automatic recovery is trying. You can tap RECONNECT GPS now.";
    clearActiveGpsWatch();
    stopOrientationCapture();
    releaseWakeLock();
    const message = explainGpsProblem(error);
    updateControls();
    setStatus(message, Number(error && error.code) === 1 ? "error" : "warning");
    simpleSetStatus(message, "warning");
    renderSimpleHeader();
    updateVisibleGpsControl();
    if (gpsPermissionDenied) {
      clearTimeout(gpsRestartTimer);
      gpsRestartTimer = null;
      gpsRestartAttempt = 0;
      return;
    }
    const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(gpsRestartAttempt, 3)));
    gpsRestartAttempt += 1;
    scheduleGpsRestart(delay);
  }

    async function startTracking(options) {
    const trackingOptions = options || {};
    if (gpsStorageFailed) {
      setStatus("GPS storage previously failed. Do not resume; finish and preserve the current inspection now.", "error");
      return;
    }
    if (!offlineReady) {
      setStatus("Offline preparation is not complete. Inspection cannot begin safely.", "error");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("This browser does not provide GPS. Field records can still be preserved, but locations cannot be captured.", "error");
      return;
    }
    if (gpsPermissionDenied && trackingOptions.recovery) return;
    if (!trackingOptions.recovery) {
      gpsUserActivatedThisPage = true;
      gpsPermissionDenied = false;
      lastGpsErrorCode = null;
      lastGpsErrorMessage = "";
      lastGpsErrorAt = null;
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
    if (!trackingOptions.recovery) {
      data.stopped = null;
      data.lifecycle_events.push({ type: resuming ? "inspection_resumed" : "inspection_started", time: startedAt, source: "button_press" });
      automaticContextGpsCapturedForRun = false;
      captureAutomaticContext(resuming ? "inspection_resumed" : "inspection_started", null);
      lastPosition = null;
      saveState();
      updateTimeMetrics();
    }
    if (!trackingOptions.skipReconcile) await reconcileGpsPoints();
    startGpsWatcher();
    if (!trackingOptions.recovery) {
      setStatus("GPS STARTING — waiting for Safari to return the first location.", "active");
      simpleSetStatus("GPS STARTING — waiting for Safari to return the first location.", "warning");
      renderSimpleHeader();
    }
    if (SIMPLE_AUTOMATION_MODE) {
      lastPosition = { lat: 30.489, lon: -87.091, accuracy_m: 3, altitude_m: 20, altitude_accuracy_m: 2, heading_deg: 90, speed_mps: 0, time: new Date().toISOString(), sequence: 1 };
      renderSimpleHeader();
    }
    updateControls();
    await keepAwake();
    if (!trackingOptions.recovery) setStatus("GPS starting. Field buttons remain usable while location connects.", "active");
    refreshAuthoritativeWeather({ silent: true }).catch(() => { renderAuthoritativeWeather(); });
  }

    async function ensureFieldGpsReady() {
    const fresh = freshFieldPosition();
    if (fresh) return fresh;
    if (gpsPermissionDenied) {
      simpleSetStatus("LOCATION PERMISSION IS OFF — field records still save with location pending.", "warning");
      return null;
    }
    if (fieldGpsFixPromise) return fieldGpsFixPromise;
    fieldGpsFixPromise = (async () => {
      if (!("geolocation" in navigator)) {
        simpleSetStatus("LOCATION IS NOT AVAILABLE ON THIS PHONE. Field records still save with location pending.", "warning");
        return null;
      }
      if (gpsWatcherIsStale()) {
        clearActiveGpsWatch();
        await startTracking({ recovery: true, skipReconcile: true });
      }
      simpleSetStatus("GPS CHECK — requesting a current Safari location now.", "warning");
      const attempt = options => new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(position => {
          onPosition(position);
          resolve(freshFieldPosition());
        }, error => resolve({ __gps_error: error }), options);
      });
      let result = await attempt({ enableHighAccuracy: true, maximumAge: 0, timeout: 8000 });
      if (result && !result.__gps_error) return result;
      const firstError = result && result.__gps_error;
      if (firstError && Number(firstError.code) === 1) {
        onGpsError(firstError, gpsWatchGeneration);
        return null;
      }
      result = await attempt({ enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 });
      if (result && !result.__gps_error) return result;
      const finalError = result && result.__gps_error || firstError;
      if (finalError) onGpsError(finalError, gpsWatchGeneration);
      return null;
    })().finally(() => { fieldGpsFixPromise = null; });
    return fieldGpsFixPromise;
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
    const position = positionOverride !== undefined ? positionOverride : freshFieldPosition();
    const settings = details || {};
    const context = currentEvidenceContext();
    const recordedAt = time || new Date().toISOString();
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
      information_class: settings.informationClass || (settings.recordClass === "inspector_thought" ? "INSPECTOR_INTERPRETATION" : "OBSERVED_ON_SITE"),
      automatic_context_id: automaticContextTools ? automaticContextTools.ensureModel(data).last_device_snapshot_id : null,
      attributes: Object.assign({}, settings.attributes || {}),
      area_id: settings.areaId || context.area_id,
      question_ids: Array.isArray(settings.questionIds) ? settings.questionIds.slice() : context.question_ids,
      question_links: Array.isArray(settings.questionLinks) ? settings.questionLinks.map(link => Object.assign({}, link)) : context.question_links,
      time: recordedAt,
      lat: position && Number.isFinite(Number(position.lat)) ? Number(position.lat) : null,
      lon: position && Number.isFinite(Number(position.lon)) ? Number(position.lon) : null,
      gps_accuracy_m: position && Number.isFinite(Number(position.accuracy_m)) ? Number(position.accuracy_m) : null,
      gps_position_at: position && position.time ? position.time : null,
      gps_capture_delay_ms: position && position.time ? Math.max(0, Date.parse(position.time) - Date.parse(recordedAt)) : null,
      location_status: position ? "CAPTURED_WITH_RECORD" : "PENDING_GPS",
      location_requested_at: recordedAt,
      compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : (position && position.heading_deg != null ? position.heading_deg : null),
      device_orientation: latestOrientation ? {
        alpha_deg: latestOrientation.alpha_deg,
        beta_deg: latestOrientation.beta_deg,
        gamma_deg: latestOrientation.gamma_deg,
        absolute: latestOrientation.absolute
      } : null,
      photo_id: photoId || null
    };
  }

  function applyRecoveredLocation(record, point, recordedAt) {
    if (!record || record.location_status !== "PENDING_GPS") return false;
    const originalTime = recordedAt || record.location_requested_at || record.recorded_at || record.started_at || record.time;
    const originalMs = Date.parse(originalTime || "");
    const pointMs = Date.parse(point.time || "");
    if (Number.isFinite(originalMs) && Number.isFinite(pointMs) && pointMs < originalMs) return false;
    record.lat = point.lat;
    record.lon = point.lon;
    record.latitude = point.lat;
    record.longitude = point.lon;
    record.gps_accuracy_m = point.accuracy_m;
    record.gps_position_at = point.time;
    record.gps_capture_delay_ms = Number.isFinite(originalMs) && Number.isFinite(pointMs) ? Math.max(0, pointMs - originalMs) : null;
    record.location_status = "RECOVERED_AFTER_PENDING";
    return true;
  }

  function resolvePendingLocationRecords(point) {
    let changed = false;
    (data.markers || []).forEach(record => { if (applyRecoveredLocation(record, point, record.time)) changed = true; });
    (data.simple_sessions || []).forEach(record => { if (applyRecoveredLocation(record, point, record.started_at)) changed = true; });
    (data.voice_notes || []).forEach(record => { if (applyRecoveredLocation(record, point, record.started_at || record.recorded_at)) changed = true; });
    if (data.pending_voice_note && applyRecoveredLocation(data.pending_voice_note, point, data.pending_voice_note.started_at)) changed = true;
    (data.site_sound_records || []).forEach(record => { if (applyRecoveredLocation(record, point, record.recorded_at)) changed = true; });
    if (frontageTools) {
      const records = frontageTools.ensureModel(data).records || [];
      records.forEach(record => { if (applyRecoveredLocation(record, point, record.recorded_at)) changed = true; });
    }
    if (sectionMappingTools) {
      const activeSection = sectionMappingTools.activeSection(data);
      if (activeSection && !activeSection.start && activeSection.completion_status === "ACTIVE") {
        const recoveredStart = {
          information_class: "CAPTURED_BY_DEVICE",
          latitude: Number(point.lat),
          longitude: Number(point.lon),
          gps_accuracy_m: point.accuracy_m == null ? null : Number(point.accuracy_m),
          gps_position_at: point.time,
          recorded_at: point.time,
          heading_deg: point.heading_deg == null ? null : Number(point.heading_deg),
          source_gps_sequence: point.sequence
        };
        activeSection.start = recoveredStart;
        activeSection.gps_start_delay_ms = Math.max(0, Date.parse(point.time) - Date.parse(activeSection.started_at));
        activeSection.events = Array.isArray(activeSection.events) ? activeSection.events : [];
        activeSection.events.push({
          event_type: "SECTION_FIRST_GPS_RECOVERED",
          recorded_at: point.time,
          original_section_tap_at: activeSection.started_at,
          gps_start_delay_ms: activeSection.gps_start_delay_ms,
          gps_accuracy_m: point.accuracy_m,
          source_gps_sequence: point.sequence
        });
        changed = true;
      }
    }
    (data.photos || []).forEach(photo => {
      if (!applyRecoveredLocation(photo, point, photo.recorded_at || photo.time)) return;
      changed = true;
      photoStoreGet(photo.id).then(stored => {
        if (!stored || !stored.metadata || stored.metadata.location_status !== "PENDING_GPS") return;
        applyRecoveredLocation(stored.metadata, point, stored.metadata.recorded_at || stored.metadata.time);
        if (stored.event) applyRecoveredLocation(stored.event, point, stored.event.time);
        return photoStorePut(stored);
      }).catch(() => {});
    });
    if (changed) {
      try { saveState(); } catch (error) { /* canonical stores remain authoritative */ }
      renderSimpleHeader();
    }
  }

  function addMarker(type, options) {
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
    if (!activeObservationType) return;
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
        lat: freshFieldPosition() ? freshFieldPosition().lat : null,
        lon: freshFieldPosition() ? freshFieldPosition().lon : null,
        gps_accuracy_m: freshFieldPosition() ? freshFieldPosition().accuracy_m : null,
        gps_position_at: freshFieldPosition() ? freshFieldPosition().time : null,
        location_status: freshFieldPosition() ? "CAPTURED_WITH_RECORD" : "PENDING_GPS",
        location_requested_at: startedAt,
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
        simple_session_id: settings.simple_session_id || null,
        prompt: settings.prompt || null,
        recovered_after_interruption: false
        ,information_class: "CAPTURED_BY_DEVICE"
        ,automatic_context_id: automaticContextTools ? automaticContextTools.ensureModel(data).last_device_snapshot_id : null
        ,site_sound_record_id: settings.site_sound_record_id || null
        ,section_id: settings.section_id || null
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
      if (Number(settings.auto_stop_ms) > 0) {
        clearTimeout(ambientSoundStopTimer);
        ambientSoundStopTimer = setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
        }, Number(settings.auto_stop_ms));
      }
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
      clearTimeout(ambientSoundStopTimer);
      ambientSoundStopTimer = null;
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
        information_class: "CAPTURED_BY_DEVICE",
        observation_type: "field.voice_note",
        taxonomy_version: "property-observation-1.0",
        button_label: "Voice Note",
        note: metadata.prompt || "",
        attributes: { duration_ms: metadata.duration_ms, purpose: metadata.purpose || "general_field_note", photo_id: metadata.photo_id || null, evidence_set_id: metadata.evidence_set_id || null, simple_session_id: metadata.simple_session_id || null, section_id: metadata.section_id || null },
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
        ,simple_session_id: metadata.simple_session_id || null
      };
      await voiceStorePut({ id: metadata.id, inspection_id: data.inspection_id, metadata, event: voiceEvent, audioBlob });
      if (metadata.photo_id) await attachExplanationToPhoto(metadata.photo_id, metadata.id);
      data.voice_notes.push(metadata);
      if (metadata.site_sound_record_id) {
        const soundRecord = (data.site_sound_records || []).find(item => String(item.sound_id) === String(metadata.site_sound_record_id));
        if (soundRecord) {
          if (metadata.purpose === "site_ambient_sound") soundRecord.ambient_audio_voice_note_id = metadata.id;
          else soundRecord.voice_note_ids = Array.from(new Set([...(soundRecord.voice_note_ids || []), metadata.id]));
          soundRecord.updated_at = new Date().toISOString();
        }
      }
      if (metadata.section_id && sectionMappingTools) {
        const section = sectionMappingTools.sectionById(data, metadata.section_id);
        if (section) section.voice_note_ids = Array.from(new Set([...(section.voice_note_ids || []), metadata.id]));
      }
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
      if (String(metadata.purpose || "").startsWith("simple_")) {
        const session = simpleSessionById(metadata.simple_session_id);
        const linkedPhoto = metadata.photo_id ? data.photos.find(item => String(item.id) === String(metadata.photo_id)) : null;
        if (session) session.voice_note_count = simpleSessionVoiceNotes(session).length;
        if (currentSimpleSession()) renderActiveSimpleSession(); else renderSimpleHeader();
        simpleSetStatus(linkedPhoto ? `VOICE NOTE SAVED FOR ${linkedPhoto.simple_photo_id || linkedPhoto.photo_number}` : `VOICE NOTE SAVED${session ? ` FOR ${session.feature_id}` : ""}`, "saved");
      }
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
      const canceledContext = pendingPhotoContext || {};
      const canceledSession = canceledContext.simple_session_id ? simpleSessionById(canceledContext.simple_session_id) : null;
      if (canceledSession) { canceledSession.pending_photo_id = null; saveState(); renderSimpleCapture(); }
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
      if (!analysis || !(analysis.blob instanceof Blob) || !analysis.blob.size) throw new Error("No analysis-safe image copy was created.");
      const id = makeId("photo");
      const screenState = currentScreenOrientation();
      const photoContext = pendingPhotoContext || {};
      const sourceModified = Number.isFinite(file.lastModified) && file.lastModified > 0 ? new Date(file.lastModified).toISOString() : null;
      const metadata = {
        id,
        information_class: "CAPTURED_BY_DEVICE",
        automatic_context_id: automaticContextTools ? automaticContextTools.ensureModel(data).last_device_snapshot_id : null,
        camera_opened_at: pendingPhotoRequestedAt,
        recorded_at: recordedAt,
        time: recordedAt,
        source_file_last_modified_at: sourceModified,
        lat: position ? position.lat : null,
        lon: position ? position.lon : null,
        gps_accuracy_m: position ? position.accuracy_m : null,
        gps_position_at: position ? position.time : null,
        gps_position_age_ms: position && position.time ? Math.max(0, new Date(recordedAt) - new Date(position.time)) : null,
        location_source: position ? "live_browser_geolocation" : "pending_browser_geolocation",
        location_status: position ? "CAPTURED_WITH_RECORD" : "PENDING_GPS",
        location_requested_at: recordedAt,
        compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : (position ? position.heading_deg : null),
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
        ,simple_capture: Boolean(photoContext.simple_capture)
        ,simple_session_id: photoContext.simple_session_id || null
        ,feature_id: photoContext.feature_id || null
        ,simple_photo_id: photoContext.simple_photo_id || null
        ,simple_feature_sequence: photoContext.simple_feature_sequence || null
        ,photo_role: photoContext.photo_role || null
        ,section_id: photoContext.section_id || (photoContext.feature_id && String(photoContext.feature_id).startsWith("SECTION-") ? photoContext.feature_id : null)
      };
      const photoEvent = markerFromPosition("photo", metadata.note, id, recordedAt, position, {
        evidenceClassification: metadata.evidence_classification,
        attributes: {
           photo_number: metadata.photo_number,
           category: metadata.category,
           associated_observation_id: metadata.associated_observation_id,
           observation_attributes: metadata.observation_attributes,
           section_id: metadata.section_id
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
      if (metadata.section_id && sectionMappingTools) {
        const section = sectionMappingTools.sectionById(data, metadata.section_id);
        if (section) section.photo_ids = Array.from(new Set([...(section.photo_ids || []), metadata.id]));
      }
      setStatus(`Photo ${data.photos.length} stored with original bytes, analysis copy, GPS, time, and orientation metadata.${storageEstimate.warning ? ` WARNING: only ${formatBytes(storageEstimate.remaining)} of browser storage remains.` : ""}`, storageEstimate.warning ? "warning" : "active");
      if (metadata.simple_capture) {
        const session = simpleSessionById(metadata.simple_session_id);
        if (session) {
          session.updated_at = new Date().toISOString();
          session.photo_count = simpleSessionPhotos(session).length;
          session.current_photo_id = metadata.id;
          session.current_simple_photo_id = metadata.simple_photo_id;
          session.pending_photo_id = null;
          if (culvertNeededSession(session) && culvertStep(session) === "PHOTO") session.details.culvert_sequence_step = "WATER";
        }
        saveState();
        renderActiveSimpleSession();
        simpleSetStatus(`PHOTO SAVED AND VERIFIED - ${metadata.simple_photo_id || metadata.photo_number} - ${metadata.feature_id || "general photo"}`, "saved");
      } else if (metadata.evidence_set_id && evidenceSetTools) {
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
    await refreshAuthoritativeWeather({ silent: true });
    if (lastPosition) await refreshAutomaticExternalContext(lastPosition);
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
          august4Context: august4RouteContext,
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

    function exactFieldEvidenceCounts() {
    const sectionModel = sectionMappingTools ? sectionMappingTools.ensureModel(data) : { sections: [] };
    return {
      gps_points: data.points.length,
      records: data.markers.length,
      photos: data.photos.length,
      voice: data.voice_notes.length,
      sections: Array.isArray(sectionModel.sections) ? sectionModel.sections.length : 0
    };
  }

  function formatFieldEvidenceCounts(counts) {
    return counts.gps_points + " GPS | " + counts.records + " records | " + counts.photos + " photos | " + counts.voice + " voice | " + counts.sections + " sections";
  }

  function verifyExportPreservedInspection(before, result, wasActive) {
    const after = exactFieldEvidenceCounts();
    const summary = result && result.manifest && result.manifest.summary || {};
    if ((Number(summary.gps_track_point_count) || 0) < before.gps_points) throw new Error("Export omitted GPS points.");
    if ((Number(summary.field_event_count) || 0) < before.records) throw new Error("Export omitted field records.");
    if ((Number(summary.photo_count) || 0) !== before.photos) throw new Error("Export photo count mismatch.");
    if ((Number(summary.voice_note_count) || 0) !== before.voice) throw new Error("Export voice-note count mismatch.");
    if (after.records < before.records || after.photos < before.photos || after.voice < before.voice || after.sections < before.sections) throw new Error("Saved evidence count decreased during export.");
    if (wasActive && data.stopped) throw new Error("Export ended the active inspection.");
    return { before, after };
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
    const before = exactFieldEvidenceCounts();
    const wasActive = Boolean(data.started && !data.stopped);
    packageBusy = true;
    updateControls();
    data.lifecycle_events.push({ type: "inspection_copy_created", time: new Date().toISOString(), source: "button_press" });
    saveState();
    setStatus(`EXPORT STARTING — ${formatFieldEvidenceCounts(before)}`, "active");
    try {
      await gpsWriteQueue;
      const result = await buildPackageWithRecovery("report", null);
      const verification = verifyExportPreservedInspection(before, result, wasActive);
      await presentPackage(result.fileName, result.blob, result.manifest);
      setStatus(`EXPORT VERIFIED — BEFORE: ${formatFieldEvidenceCounts(verification.before)} | AFTER: ${formatFieldEvidenceCounts(verification.after)} | INSPECTION STILL ACTIVE: ${data.started && !data.stopped ? "YES" : "NO"}`, "success");
    } catch (error) {
      setStatus(`EXPORT NOT VERIFIED: ${error.message}. Your inspection remains saved. Do not press Clear.`, "error");
    } finally {
      packageBusy = false;
      updateControls();
    }
  }

    async function exportBackupNow() {
    if (packageBusy || photoBusy || !data.started) return;
    if (!(await confirmLargePackage("full_archive"))) return;
    const before = exactFieldEvidenceCounts();
    const wasActive = Boolean(data.started && !data.stopped);
    packageBusy = true;
    updateControls();
    setStatus(`BACKUP STARTING — ${formatFieldEvidenceCounts(before)}`, "active");
    try {
      await gpsWriteQueue;
      const result = await buildPackageWithRecovery("full_archive", wasActive ? "backup" : null);
      const verification = verifyExportPreservedInspection(before, result, wasActive);
      await presentPackage(result.fileName, result.blob, result.manifest);
      setStatus(`BACKUP VERIFIED — BEFORE: ${formatFieldEvidenceCounts(verification.before)} | AFTER: ${formatFieldEvidenceCounts(verification.after)} | INSPECTION STILL ACTIVE: ${data.started && !data.stopped ? "YES" : "NO"}`, "success");
    } catch (error) {
      setStatus(`BACKUP NOT VERIFIED: ${error.message}. Your inspection remains saved. Do not press Clear.`, "error");
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
    if (data.started && !data.stopped) { setStatus("ACTIVE INSPECTION CANNOT BE CLEARED. End the inspection first. Nothing was changed.", "warning"); return; }
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

  const simpleFeatureNames = {
    water: "WATER", tree: "TREE", ditch: "DITCH / SWALE", culvert: "CULVERT",
    brush: "BRUSH", blocked: "BLOCKED", entrance: "ROAD / ENTRANCE",
    open: "OPEN AREA", highlow: "HIGH / LOW", other: "OTHER", photo: "PHOTO",
    frontage_end: "FRONTAGE END", vehicle_crossing: "VEHICLE CROSSING OPTION",
    ditch_change: "DITCH CHANGE", frontage_trees_brush: "TREES / BRUSH",
    frontage_wet_soft: "WET / SOFT", frontage_steep_slope: "STEEP SLOPE",
    frontage_photo: "FRONTAGE PHOTO", parking_staging: "PARKING / STAGING", site_sound: "SITE SOUND / EXPERIENCE", map_section: "MAP THIS SECTION", aerial_prediction_check: "AERIAL PREDICTION CHECK"
  };

  function simpleSessionById(id) {
    return (data.simple_sessions || []).find(item => String(item.simple_session_id) === String(id)) || null;
  }

  function currentSimpleSession() {
    return simpleSessionById(simpleActiveSessionId || data.active_simple_session_id);
  }

  function simpleSessionPhotos(session) {
    return session ? data.photos.filter(photo => String(photo.simple_session_id || "") === String(session.simple_session_id)) : [];
  }

  function simpleSessionVoiceNotes(session) {
    return session ? data.voice_notes.filter(note => String(note.simple_session_id || "") === String(session.simple_session_id)) : [];
  }

  function simpleCloseDialogs() {
    document.querySelectorAll("dialog[open]").forEach(dialog => {
      try { dialog.close(); } catch (error) { /* A stale dialog cannot block the field grid. */ }
    });
    activeObservationType = null;
    pendingPhotoExplanationId = null;
    pendingWaterPhotoId = null;
    pendingPhotoMeaningId = null;
    pendingMeasurementPhotoId = null;
    pendingGroupPhotoId = null;
  }

  function restoreSimplePageScrolling() {
    document.body.classList.remove("simple-advanced-open");
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflowY = "auto";
    document.body.style.position = "static";
    document.body.style.height = "auto";
  }

  function simpleFeaturePrefix(type) {
    const prefixes = { water: "WATER", tree: "TREE", ditch: "DITCH", culvert: "CULVERT", brush: "BRUSH", blocked: "BLOCKED", entrance: "ROAD", open: "OPEN", highlow: "GROUND", other: "OTHER", photo: "PHOTO", site_sound: "SOUND" };
    return prefixes[type] || "FEATURE";
  }

  function simpleNextIdentifier(type) {
    const prefix = simpleFeaturePrefix(type);
    const next = Number(data.simple_counters[prefix] || 0) + 1;
    data.simple_counters[prefix] = next;
    return `${prefix}-${String(next).padStart(3, "0")}`;
  }

  function simpleMarkerType(type) {
    return ({ water: "wet", ditch: "ditch", brush: "thick", entrance: "entrance", open: "open", highlow: "high", photo: "photo" })[type] || type;
  }

  function simpleDbh(circumference) {
    const value = Number(circumference);
    return Number.isFinite(value) && value > 0 ? Math.round((value / Math.PI) * 100) / 100 : null;
  }

  function simpleSaveDraft(options) {
    const settings = options || {};
    const session = currentSimpleSession();
    if (!session) return null;
    const form = document.getElementById("simpleCaptureForm");
    if (form) {
      const fields = form.querySelectorAll("input[name], select[name], textarea[name]");
      fields.forEach(field => {
        if (field.type === "radio" && !field.checked) return;
        session.details[field.name] = field.value;
        session.details_information_classes = session.details_information_classes || {};
        session.details_information_classes[field.name] = field.type === "number" && field.value !== "" ? "MEASURED_ON_SITE" : (field.value && !/^unknown$/i.test(field.value) ? "OBSERVED_ON_SITE" : "UNKNOWN");
      });
    }
    if (session.feature_type === "tree") {
      session.details.measurement_tool = "Flexible hospital/baby tape";
      session.details.measurement_height_in = 54;
      session.details.ground_basis = "Uphill side";
      session.details.calculated_dbh_in = simpleDbh(session.details.circumference_in);
      session.details_information_classes = Object.assign({}, session.details_information_classes || {}, { calculated_dbh_in: "CALCULATED" });
    }
    session.updated_at = new Date().toISOString();
    const marker = data.markers.find(item => String(item.id) === String(session.observation_id));
    if (marker) {
      marker.note = session.details.note || marker.note || "";
      marker.attributes = Object.assign({}, marker.attributes || {}, session.details, {
        simple_session_id: session.simple_session_id,
        feature_id: session.feature_id,
        completion_status: session.completion_status
      });
    }
    if (session.frontage_record_id && frontageTools) {
      const record = frontageModel().records.find(item => String(item.record_id) === String(session.frontage_record_id));
      if (record) {
        record.attributes = Object.assign({}, record.attributes || {}, session.details || {});
        record.completion_status = session.completion_status;
        record.updated_at = session.updated_at;
      }
    }
    saveState();
    if (settings.feedback) {
      simpleLastSavedMessage = `${settings.feedback} SAVED - ${session.feature_id}`;
      simpleSetStatus(simpleLastSavedMessage, "saved");
    }
    return session;
  }

  function simpleFinalizeActive(reason) {
    const session = simpleSaveDraft();
    if (!session) return null;
    session.completion_status = reason || "BASIC_RECORD_SAVED";
    session.finished_at = new Date().toISOString();
    session.photo_count = simpleSessionPhotos(session).length;
    session.voice_note_count = simpleSessionVoiceNotes(session).length;
    const marker = data.markers.find(item => String(item.id) === String(session.observation_id));
    if (marker) marker.attributes = Object.assign({}, marker.attributes || {}, { completion_status: session.completion_status, photo_count: session.photo_count, voice_note_count: session.voice_note_count });
    if (session.frontage_record_id && frontageTools) {
      const record = frontageModel().records.find(item => String(item.record_id) === String(session.frontage_record_id));
      if (record) {
        record.attributes = Object.assign({}, record.attributes || {}, session.details || {});
        record.completion_status = session.completion_status;
        record.photo_count = session.photo_count;
        record.voice_note_count = session.voice_note_count;
        record.updated_at = session.finished_at;
      }
    }
    data.active_simple_session_id = null;
    simpleActiveSessionId = null;
    saveState();
    return session;
  }

  function simpleSetStatus(message, kind) {
    const element = document.getElementById("simpleSaveStatus");
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind || "normal";
  }

      function renderSimpleHeader() {
    const gps = document.getElementById("simpleGpsStatus");
    const counts = document.getElementById("simpleCounts");
    const fresh = freshFieldPosition();
    if (gps) gps.textContent = visibleGpsMessage();
    if (counts) {
      const appPath = location.pathname.replace(/\/?$/, "/") + "app.js";
      counts.textContent = `${data.photos.length} photos | ${data.markers.length} records | ${data.voice_notes.length} voice · ${APP_VERSION} · DIRECT ${appPath}`;
    }
    updateVisibleGpsControl();
  }

  function simplePointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = Number(ring[i][0]), yi = Number(ring[i][1]);
      const xj = Number(ring[j][0]), yj = Number(ring[j][1]);
      if (((yi > lat) !== (yj > lat)) && lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi) inside = !inside;
    }
    return inside;
  }

  function simpleDistanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function simpleLocatorState(rings) {
    if (!lastPosition || !rings.length) return "LOCATION UNAVAILABLE";
    const inside = rings.some(ring => simplePointInRing(lastPosition.lon, lastPosition.lat, ring));
    const x = sx(lastPosition.lon), y = sy(lastPosition.lat);
    let nearest = Infinity;
    rings.forEach(ring => ring.forEach((point, index) => {
      const next = ring[(index + 1) % ring.length];
      nearest = Math.min(nearest, simpleDistanceToSegment(x, y, sx(point[0]), sy(point[1]), sx(next[0]), sy(next[1])));
    }));
    return nearest < 45 ? "NEAR APPROXIMATE PARCEL EDGE" : (inside ? "INSIDE APPROXIMATE PARCEL" : "OUTSIDE APPROXIMATE PARCEL");
  }

  function renderSimpleLocator() {
    const container = document.getElementById("simpleLocatorMap");
    const state = document.getElementById("simpleLocatorState");
    if (!container || !state) return;
    const rings = subjectRings();
    state.textContent = simpleLocatorState(rings);
    const ringPaths = rings.map((ring, ringIndex) => {
      const label = ringIndex === 0 ? "LARGE TRACT — APPROX. 81.2 AC" : "SMALL TRACT — APPROX. 5.5 AC";
      const center = ring.reduce((sum, point) => ({ x: sum.x + sx(point[0]), y: sum.y + sy(point[1]) }), { x: 0, y: 0 });
      center.x /= Math.max(1, ring.length); center.y /= Math.max(1, ring.length);
      return `<path d="${ring.map((point, index) => `${index ? "L" : "M"}${sx(point[0]).toFixed(1)} ${sy(point[1]).toFixed(1)}`).join(" ")} Z" fill="rgba(255,255,255,.08)" stroke="${ringIndex === 0 ? "#ff3030" : "#ff9e2f"}" stroke-width="14" vector-effect="non-scaling-stroke"/><text x="${center.x.toFixed(1)}" y="${center.y.toFixed(1)}" fill="#fff" stroke="#222" stroke-width="12" paint-order="stroke" text-anchor="middle" font-size="38" font-weight="900">${label}</text>`;
    }).join("");
    const priorPoints = august4RouteContext && Array.isArray(august4RouteContext.raw_gps_points) ? august4RouteContext.raw_gps_points : [];
    const priorStride = Math.max(1, Math.ceil(priorPoints.length / 900));
    const priorDisplay = priorPoints.filter((point, index) => index % priorStride === 0 || index === priorPoints.length - 1);
    const priorRoute = priorDisplay.length > 1 ? `<path d="${priorDisplay.map((point, index) => `${index ? "L" : "M"}${sx(point.longitude).toFixed(1)} ${sy(point.latitude).toFixed(1)}`).join(" ")}" fill="none" stroke="#9bd3ff" stroke-width="12" stroke-dasharray="24 14" vector-effect="non-scaling-stroke"/><text x="${sx(priorDisplay[0].longitude).toFixed(1)}" y="${(sy(priorDisplay[0].latitude) - 28).toFixed(1)}" fill="#fff" stroke="#17446d" stroke-width="12" paint-order="stroke" font-size="42" font-weight="900">AUGUST 4 WALKED ROUTE</text>` : "";
    const priorReachedPoint = priorPoints.reduce((best, point) => !best || Number(point.longitude) > Number(best.longitude) ? point : best, null);
    const marshyClearing = priorReachedPoint ? `<g><circle cx="${sx(priorReachedPoint.longitude).toFixed(1)}" cy="${sy(priorReachedPoint.latitude).toFixed(1)}" r="34" fill="#6b8f3d" stroke="#fff" stroke-width="8"/><text x="${sx(priorReachedPoint.longitude).toFixed(1)}" y="${(sy(priorReachedPoint.latitude) - 48).toFixed(1)}" fill="#fff" stroke="#33451c" stroke-width="12" paint-order="stroke" text-anchor="middle" font-size="38" font-weight="900">MARSHY CLEARING — APPROX. REACHED AREA</text></g>` : "";
    const priorPhotoDots = august4RouteContext && Array.isArray(august4RouteContext.photograph_points) ? august4RouteContext.photograph_points.map(point => `<circle cx="${sx(point.longitude).toFixed(1)}" cy="${sy(point.latitude).toFixed(1)}" r="18" fill="#fff" stroke="#7d3cff" stroke-width="8" vector-effect="non-scaling-stroke"><title>${point.photo_number || "August 4 photograph"}</title></circle>`).join("") : "";
    const routeStride = Math.max(1, Math.ceil(data.points.length / 600));
    const locatorRoutePoints = data.points.filter((point, index) => index % routeStride === 0 || index === data.points.length - 1);
    const route = locatorRoutePoints.length > 1 ? `<path d="${locatorRoutePoints.map((point, index) => `${index ? "L" : "M"}${sx(point.lon).toFixed(1)} ${sy(point.lat).toFixed(1)}`).join(" ")}" fill="none" stroke="#ffe54a" stroke-width="8" vector-effect="non-scaling-stroke"/>` : "";
    const featureDots = data.markers.filter(item => Number.isFinite(Number(item.lon)) && Number.isFinite(Number(item.lat))).slice(-80).map(item => `<circle cx="${sx(item.lon).toFixed(1)}" cy="${sy(item.lat).toFixed(1)}" r="16" fill="#ff8b21" stroke="#fff" stroke-width="5" vector-effect="non-scaling-stroke"/>`).join("");
    const mappedSections = sectionMappingTools ? sectionMappingTools.ensureModel(data).sections : [];
    const sectionLayers = mappedSections.map(section => {
      const ring = section.outlined_section && section.outlined_section.coordinates && section.outlined_section.coordinates[0];
      const walked = section.completion_status === "ACTIVE" ? section.raw_walked_edge_points : section.walked_edge;
      const polygon = Array.isArray(ring) && ring.length > 2 ? `<path d="${ring.map((point, index) => `${index ? "L" : "M"}${sx(point[0]).toFixed(1)} ${sy(point[1]).toFixed(1)}`).join(" ")} Z" fill="rgba(36,168,91,.20)" stroke="#1f8b4c" stroke-width="7" vector-effect="non-scaling-stroke"/>` : "";
      const walkedPath = Array.isArray(walked) && walked.length > 1 ? `<path d="${walked.map((point, index) => `${index ? "L" : "M"}${sx(point.longitude).toFixed(1)} ${sy(point.latitude).toFixed(1)}`).join(" ")}" fill="none" stroke="${section.completion_status === "ACTIVE" ? "#00e1ff" : "#39c96b"}" stroke-width="11" vector-effect="non-scaling-stroke"/>` : "";
      const inferred = section.inferred_edge ? `<line x1="${sx(section.inferred_edge.from.longitude).toFixed(1)}" y1="${sy(section.inferred_edge.from.latitude).toFixed(1)}" x2="${sx(section.inferred_edge.to.longitude).toFixed(1)}" y2="${sy(section.inferred_edge.to.latitude).toFixed(1)}" stroke="#ff6b35" stroke-width="9" stroke-dasharray="28 18" vector-effect="non-scaling-stroke"/>` : "";
      const labelPoint = section.start;
      const label = labelPoint ? `<text x="${sx(labelPoint.longitude).toFixed(1)}" y="${(sy(labelPoint.latitude) - 24).toFixed(1)}" fill="#fff" stroke="#173b24" stroke-width="10" paint-order="stroke" font-size="45" font-weight="900">${section.section_id}</text>` : "";
      return `${polygon}${walkedPath}${inferred}${label}`;
    }).join("");
    const reviewModel = previsitTools ? previsitTools.ensureModel(data) : { aerial_traces: [], stopping_points: [] };
    const aerialLayers = (reviewModel.aerial_traces || []).map(trace => {
      const coordinates = trace.geometry && trace.geometry.type === "Polygon" ? trace.geometry.coordinates[0] : trace.geometry && trace.geometry.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return "";
      const path = coordinates.map((point, index) => `${index ? "L" : "M"}${sx(point[0]).toFixed(1)} ${sy(point[1]).toFixed(1)}`).join(" ");
      const main = ["PROBABLE MAIN CREEK", "PROBABLE MAIN CHANNEL"].includes(trace.trace_type);
      const area = trace.geometry.type === "Polygon";
      const vegetationColor = trace.trace_type === "LIKELY DENSE 2–3 INCH BRUSH" ? "#ffe75a" : (["DENSER TREE CANOPY", "LIKELY LARGER TREES"].includes(trace.trace_type) ? "#136f3a" : (trace.trace_type === "THINNER TREE CANOPY" ? "#9fd66e" : (trace.trace_type === "POSSIBLE MARSHY CLEARING" ? "#87a84e" : (trace.trace_type === "LIKELY MIXED BRUSH AND LARGER TREES" ? "#ff9e32" : null))));
      const color = vegetationColor || (main ? "#4dd6ff" : "#b78cff");
      return `<path d="${path}${area ? " Z" : ""}" fill="${area ? `${color}2e` : "none"}" stroke="${color}" stroke-width="${main ? 12 : 8}" stroke-dasharray="${trace.trace_type === "UNKNOWN" ? "10 20" : "20 10"}" vector-effect="non-scaling-stroke"><title>${trace.trace_type} — PREDICTED FROM AERIAL IMAGE — CHECK ON THE GROUND</title></path>`;
    }).join("");
    const stoppingDots = (reviewModel.stopping_points || []).map(point => `<g><circle cx="${sx(point.longitude).toFixed(1)}" cy="${sy(point.latitude).toFixed(1)}" r="26" fill="#ff4b3a" stroke="#fff" stroke-width="8"/><text x="${sx(point.longitude).toFixed(1)}" y="${(sy(point.latitude) - 38).toFixed(1)}" fill="#fff" stroke="#64130b" stroke-width="10" paint-order="stroke" text-anchor="middle" font-size="38" font-weight="900">STOP</text></g>`).join("");
    let phone = "";
    if (lastPosition) {
      const x = sx(lastPosition.lon), y = sy(lastPosition.lat);
      const metersPerPixel = ((xmax - xmin) * 96000) / W;
      const accuracyRadius = Math.max(16, Math.min(150, Number(lastPosition.accuracy_m || 0) / metersPerPixel));
      const heading = Number(latestOrientation && latestOrientation.compass_heading_deg != null ? latestOrientation.compass_heading_deg : lastPosition.heading_deg);
      const angle = Number.isFinite(heading) ? heading * Math.PI / 180 : 0;
      const hx = x + Math.sin(angle) * 80, hy = y - Math.cos(angle) * 80;
      phone = `<circle cx="${x}" cy="${y}" r="${accuracyRadius}" fill="rgba(30,132,255,.22)" stroke="#62b4ff" stroke-width="5"/><line x1="${x}" y1="${y}" x2="${hx}" y2="${hy}" stroke="#0a57a6" stroke-width="16"/><circle cx="${x}" cy="${y}" r="24" fill="#1684ff" stroke="#fff" stroke-width="8"/>`;
    }
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Approximate large and small parcel boundaries, August 4 reference route, and current field locator">${ringPaths}${aerialLayers}${priorRoute}${priorPhotoDots}${marshyClearing}${sectionLayers}${route}${featureDots}${stoppingDots}${phone}</svg><p class="simple-map-warning">APPROXIMATE — PHONE GPS AND COUNTY PARCEL MAP, NOT A SURVEY. Blue dashed line: August 4 walked route. MARSHY CLEARING marks the approximate reached area; its boundary is not established. Aerial traces are predictions until field confirmed. Unvisited acreage: UNKNOWN.</p>`;
  }

  function simpleFieldButton(type, label, cssClass) {
    return `<button type="button" class="simple-feature ${cssClass || ""}" data-simple-feature="${type}">${label}</button>`;
  }

  function siteSoundRecordForSession(session) {
    return session ? (data.site_sound_records || []).find(item => String(item.sound_id) === String(session.site_sound_record_id || session.details && session.details.site_sound_record_id)) || null : null;
  }

    function openSiteSound(locationContext, returnScreen) {
    const tapPosition = freshFieldPosition();
    if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE");
    const soundId = simpleNextIdentifier("site_sound");
    const now = new Date().toISOString();
    const record = {
      schema_name: "property-intelligence-site-sound-experience",
      schema_version: "1.0",
      sound_id: soundId,
      information_class: "OBSERVED_ON_SITE",
      location_context: locationContext || "general_site",
      recorded_at: now,
      updated_at: now,
      latitude: tapPosition ? tapPosition.lat : null,
      longitude: tapPosition ? tapPosition.lon : null,
      gps_accuracy_m: tapPosition ? tapPosition.accuracy_m : null,
      gps_position_at: tapPosition ? tapPosition.time : null,
      location_status: tapPosition ? "CAPTURED_WITH_RECORD" : "PENDING_GPS",
      location_requested_at: now,
      selected_experiences: [],
      ambient_audio_voice_note_id: null,
      voice_note_ids: [],
      external_weather_context_id: automaticContextTools ? automaticContextTools.ensureModel(data).last_external_refresh_at : null,
      completion_status: "ACTIVE"
    };
    const marker = markerFromPosition("other", "Site sound / experience", null, now, tapPosition, {
      informationClass: "OBSERVED_ON_SITE",
      attributes: { sound_id: soundId, location_context: record.location_context }
    });
    const session = {
      schema_name: "property-inspector-simple-capture-session", schema_version: "1.0",
      simple_session_id: makeId("simple-session"), feature_id: soundId, feature_type: "site_sound", site_sound_record_id: soundId,
      started_at: now, updated_at: now, finished_at: null, completion_status: "ACTIVE",
      return_screen: returnScreen || "FIELD_BUTTONS", details: { site_sound_record_id: soundId }, observation_id: marker.id,
      lat: tapPosition ? tapPosition.lat : null, lon: tapPosition ? tapPosition.lon : null,
      gps_accuracy_m: tapPosition ? tapPosition.accuracy_m : null, gps_position_at: tapPosition ? tapPosition.time : null,
      location_status: tapPosition ? "CAPTURED_WITH_RECORD" : "PENDING_GPS", location_requested_at: now
    };
    data.site_sound_records.push(record);
    data.markers.push(marker);
    data.simple_sessions.push(session);
    data.active_simple_session_id = session.simple_session_id;
    simpleActiveSessionId = session.simple_session_id;
    saveState();
    simpleSetStatus(tapPosition ? `${soundId} SAVED - every choice below is optional` : `${soundId} SAVED — LOCATION PENDING; every choice below is optional`, tapPosition ? "saved" : "warning");
    if (!tapPosition) ensureFieldGpsReady().catch(() => {});
    renderSiteSoundCapture(session);
  }

  function finishSiteSound(session, status) {
    const record = siteSoundRecordForSession(session);
    if (record) {
      record.completion_status = status || "BASIC_RECORD_SAVED";
      record.updated_at = new Date().toISOString();
    }
    const target = session.return_screen || "FIELD_BUTTONS";
    simpleFinalizeActive(status || "BASIC_RECORD_SAVED");
    if (target && target !== "FIELD_BUTTONS") { setFrontageScreen(target); renderFrontageWorkflow(); }
    else renderSimpleHome();
  }

  function renderSiteSoundCapture(session) {
    const record = siteSoundRecordForSession(session);
    if (!record) { simpleSaveAndReturn(); return; }
    const choices = ["Traffic", "Aircraft", "Machinery", "People", "Dogs", "Gunfire", "Boats", "Flowing water", "Wildlife", "Wind", "Mostly quiet", "Other", "Unknown"];
    const content = document.getElementById("simpleContent");
    content.innerHTML = `<section class="simple-capture"><h2>${record.sound_id} - SITE SOUND / EXPERIENCE</h2><p class="frontage-instruction">What can you hear or experience here right now?</p><p class="simple-next-line">Optional. Save or skip at any time. The microphone never runs continuously.</p><div class="culvert-factor-list sound-choice-list">${choices.map(choice => `<label><input type="checkbox" value="${choice}" ${(record.selected_experiences || []).includes(choice) ? "checked" : ""}> ${choice}</label>`).join("")}</div><p id="soundConflict" class="frontage-warning" hidden>“Mostly quiet” conflicts with another selected sound. Both will remain saved for review.</p><div class="simple-capture-actions"><button id="soundAmbient" type="button">RECORD 10-SECOND AMBIENT SOUND</button><button id="soundVoice" type="button">OPTIONAL VOICE NOTE</button><button id="soundSave" class="simple-return" type="button">SAVE AND CONTINUE</button><button id="soundSkip" type="button">SKIP AND CONTINUE</button></div></section>`;
    const updateChoices = () => {
      record.selected_experiences = Array.from(content.querySelectorAll('.sound-choice-list input:checked')).map(input => input.value);
      record.updated_at = new Date().toISOString();
      const conflict = record.selected_experiences.includes("Mostly quiet") && record.selected_experiences.some(value => value !== "Mostly quiet" && value !== "Unknown");
      document.getElementById("soundConflict").hidden = !conflict;
      saveState();
    };
    content.querySelectorAll('.sound-choice-list input').forEach(input => input.addEventListener("change", updateChoices));
    document.getElementById("soundAmbient").addEventListener("click", async () => {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      else await startVoiceRecording({ purpose: "site_ambient_sound", simple_session_id: session.simple_session_id, site_sound_record_id: record.sound_id, auto_stop_ms: 10000, prompt: "Record the surrounding sound for ten seconds." });
    });
    document.getElementById("soundVoice").addEventListener("click", async () => {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      else await startVoiceRecording({ purpose: "site_sound_voice_note", simple_session_id: session.simple_session_id, site_sound_record_id: record.sound_id });
    });
    document.getElementById("soundSave").addEventListener("click", () => { updateChoices(); finishSiteSound(session, "BASIC_RECORD_SAVED"); });
    document.getElementById("soundSkip").addEventListener("click", () => finishSiteSound(session, "SKIPPED_OPTIONAL_DETAILS"));
    renderSimpleHeader();
  }

  function sectionRecordForSession(session) {
    return session && sectionMappingTools ? sectionMappingTools.sectionById(data, session.section_id || session.feature_id) : null;
  }

    function activateSectionSession(section, returnScreen, positionOverride) {
    if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE");
    const now = new Date().toISOString();
    const position = positionOverride !== undefined ? positionOverride : freshFieldPosition();
    let observationId = section.observation_id || null;
    if (!observationId) {
      const marker = markerFromPosition("other", "Mapped land section", null, now, position, {
        informationClass: "OBSERVED_ON_SITE",
        attributes: { section_id: section.section_id, section_method: section.method, descriptions: section.description_selections }
      });
      observationId = marker.id;
      section.observation_id = observationId;
      data.markers.push(marker);
    }
    const session = {
      schema_name: "property-inspector-simple-capture-session", schema_version: "1.0",
      simple_session_id: makeId("simple-session"), feature_id: section.section_id, feature_type: "map_section", section_id: section.section_id,
      started_at: now, updated_at: now, finished_at: null, completion_status: "ACTIVE", information_class: "OBSERVED_ON_SITE",
      return_screen: returnScreen || "FIELD_BUTTONS", details: { section_id: section.section_id }, observation_id: observationId,
      lat: position ? position.lat : null, lon: position ? position.lon : null, gps_accuracy_m: position ? position.accuracy_m : null, gps_position_at: position ? position.time : null,
      location_status: position ? "CAPTURED_WITH_RECORD" : "PENDING_GPS", location_requested_at: now
    };
    data.simple_sessions.push(session);
    data.active_simple_session_id = session.simple_session_id;
    simpleActiveSessionId = session.simple_session_id;
    saveState(); redraw();
    return session;
  }

  function sectionDescriptionChoices(selected) {
    const active = new Set(selected || []);
    const choices = sectionMappingTools.PRIMARY_DESCRIPTIONS || sectionMappingTools.DESCRIPTIONS;
    const primary = choices.map(description => `<label><input type="checkbox" value="${description}" ${active.has(description) ? "checked" : ""}> ${description}</label>`).join("");
    const other = (sectionMappingTools.OTHER_DESCRIPTIONS || []).map(description => `<label><input type="checkbox" value="${description}" ${active.has(description) ? "checked" : ""}> ${description}</label>`).join("");
    return `${primary}${other ? `<details><summary>OTHER — ONLY IF YOU ACTUALLY SEE IT</summary>${other}</details>` : ""}`;
  }

  function sectionConditionGroups(selectedConditions) {
    const selected = selectedConditions || {};
    const labels = { large_trees: "LARGE TREES", underbrush: "UNDERBRUSH", travel_difficulty: "WALKING", ground_and_water: "GROUND" };
    const short = {
      "NO LARGE TREES OBSERVED": "NONE", "SCATTERED LARGE TREES": "SCATTERED", "MANY LARGE TREES": "MANY", "NEARLY CONTINUOUS LARGE-TREE CANOPY": "CONTINUOUS",
      "OPEN UNDERNEATH": "OPEN UNDERNEATH", "LIGHT SMALL BRUSH": "LIGHT", "DENSE 1–2-INCH BRUSH": "DENSE 1–2 INCH", "DENSE 2–3-INCH TANGLED BRUSH": "DENSE 2–3 INCH TANGLED", "BRUSH DIAMETER UNKNOWN": "DIAMETER UNKNOWN",
      "EASY TO WALK THROUGH": "EASY", "MODERATELY DIFFICULT": "MODERATE", "VERY DIFFICULT": "VERY DIFFICULT", "CANNOT TRAVEL WITHOUT CUTTING": "NEEDS CUTTING",
      "DRY AND FIRM": "DRY / FIRM", "SOFT WITHOUT VISIBLE WATER": "SOFT", "STANDING WATER MOSTLY 2–4 INCHES": "WATER MOSTLY 2–4 INCHES", "LOCAL WATER APPROXIMATELY 8 INCHES": "WATER LOCALLY ABOUT 8 INCHES", "WATER DEPTH UNKNOWN": "WATER DEPTH UNKNOWN", "GROUND UNKNOWN": "UNKNOWN"
    };
    return Object.entries(sectionMappingTools.CONDITION_GROUPS || {}).map(([group, choices]) => `<fieldset class="section-condition-group"><legend>${labels[group] || group}</legend><p>Optional — choose one only if you know.</p>${choices.map(choice => `<label><input type="radio" name="section-${group}" value="${choice}" ${selected[group] === choice ? "checked" : ""}> ${short[choice] || choice}</label>`).join("")}<button type="button" data-clear-section-group="${group}">CLEAR THIS GROUP</button></fieldset>`).join("");
  }

  function renderSectionStart(message, options) {
    simpleCloseDialogs(); restoreSimplePageScrolling();
    const model = sectionMappingTools.ensureModel(data);
    const settings = options || {};
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture section-start"><h2>${settings.title || "NEXT: MAP AN AREA WHERE THE LAND LOOKS GENERALLY THE SAME"}</h2><p class="frontage-instruction">Record trees overhead, brush underneath, walking, and ground separately. Every group is optional. Then walk the outside edge, or save only the partial edge you can support.</p>${message ? `<p class="frontage-warning">${message}</p>` : ""}<div class="section-condition-groups">${sectionConditionGroups(settings.conditions || {})}</div><details><summary>OTHER DESCRIPTION — OPTIONAL</summary><div class="culvert-factor-list section-description-list">${(sectionMappingTools.OTHER_DESCRIPTIONS || []).map(description => `<label><input type="checkbox" value="${description}"> ${description}</label>`).join("")}</div></details><h3>How do you want to map it?</h3><div class="section-method-list">${Object.entries(sectionMappingTools.METHODS).map(([value, label], index) => `<label><input type="radio" name="sectionMethod" value="${value}" ${(settings.method ? settings.method === value : index === 0) ? "checked" : ""}> ${label}</label>`).join("")}</div><button id="sectionStartWalking" class="frontage-end" type="button">START / SAVE THIS SECTION</button><details><summary>PROPERTY STARTING SUGGESTIONS</summary><p>Planning suggestions only. They become observations only after you confirm them in the field.</p>${model.planning_suggestions.map(item => `<button type="button" data-section-suggestion="${item.suggestion_id}">${item.area_label}<br>${Object.values(item.conditions || {}).join(" + ") || "No condition preselected"}</button>`).join("")}</details><button id="sectionStartReturn" class="simple-return" type="button">RETURN TO FIELD BUTTONS</button></section>`;
    let selectedSuggestionId = null;
    content.querySelectorAll("[data-clear-section-group]").forEach(button => button.addEventListener("click", () => { const checked = content.querySelector(`input[name="section-${button.dataset.clearSectionGroup}"]:checked`); if (checked) checked.checked = false; }));
    content.querySelectorAll("[data-section-suggestion]").forEach(button => button.addEventListener("click", () => {
      const suggestion = model.planning_suggestions.find(item => item.suggestion_id === button.dataset.sectionSuggestion);
      if (!suggestion) return;
      selectedSuggestionId = suggestion.suggestion_id;
      Object.entries(sectionMappingTools.CONDITION_GROUPS || {}).forEach(([group]) => {
        const value = suggestion.conditions && suggestion.conditions[group];
        content.querySelectorAll(`input[name="section-${group}"]`).forEach(input => { input.checked = input.value === value; });
      });
      simpleSetStatus("STARTING SUGGESTION LOADED - confirm it from what you see before starting", "warning");
    }));
    document.getElementById("sectionStartWalking").addEventListener("click", () => {
      const tapPosition = freshFieldPosition();
      const tappedAt = new Date().toISOString();
      const descriptions = Array.from(content.querySelectorAll('.section-description-list input:checked')).map(input => input.value);
      const conditions = {};
      Object.keys(sectionMappingTools.CONDITION_GROUPS || {}).forEach(group => { const chosen = content.querySelector(`input[name="section-${group}"]:checked`); conditions[group] = chosen ? chosen.value : null; });
      const methodInput = content.querySelector('input[name="sectionMethod"]:checked');
      try {
        const section = sectionMappingTools.startSection(data, { descriptions, conditions, method: methodInput && methodInput.value, position: tapPosition, recorded_at: tappedAt, source_planning_suggestion_id: selectedSuggestionId || settings.source || null });
        section.location_status = tapPosition ? "CAPTURED_WITH_RECORD" : "PENDING_GPS";
        section.location_requested_at = tappedAt;
        activateSectionSession(section, "FIELD_BUTTONS", tapPosition);
        saveState();
        simpleSetStatus(tapPosition ? `${section.section_id} STARTED — GPS, time, accuracy, and heading saved` : `${section.section_id} SAVED — LOCATION PENDING; GPS is reconnecting`, tapPosition ? "saved" : "warning");
        renderSectionActive(section);
        if (!tapPosition) ensureFieldGpsReady().catch(() => {});
      } catch (error) { simpleSetStatus(`SECTION NOT SAVED — ${error.message}`, "warning"); }
    });
    document.getElementById("sectionStartReturn").addEventListener("click", renderSimpleHome);
    bindSimpleLocator(); renderSimpleHeader();
  }

  function sectionDistanceText(section) {
    const feet = Math.round(Number(section.distance_walked_m || 0) * 3.28084);
    return `${feet} feet walked`;
  }

  function renderSectionActive(section) {
    const session = currentSimpleSession() || activateSectionSession(section, "FIELD_BUTTONS");
    section.capture_paused = Boolean(section.capture_paused);
    const content = document.getElementById("simpleContent");
    const cornerButton = section.method === "MARK_CORNERS" ? `<button id="sectionMarkCorner" class="frontage-end" type="button">MARK NEXT CORNER</button>` : "";
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture"><h2>ACTIVE SECTION: ${section.section_id}</h2><p class="frontage-instruction">${section.capture_paused ? "SECTION EDGE PAUSED" : section.method_label}</p><p><strong>${sectionMappingTools.effectiveDescriptions(section).join(" + ")}</strong></p><div class="simple-calculation">${sectionDistanceText(section)}<br>${section.raw_walked_edge_points.length} GPS edge points | ${section.marked_corners.length} marked corners</div><div class="simple-capture-actions">${cornerButton}<button id="sectionAddPhoto" type="button">ADD PHOTO</button><button id="sectionVoice" type="button">OPTIONAL VOICE NOTE FOR ${section.section_id}</button><button id="sectionLandChanged" type="button">LAND CHANGED HERE</button><button id="sectionPause" type="button">${section.capture_paused ? "RESUME" : "PAUSE"}</button><button id="sectionFinish" class="frontage-end" type="button">FINISH SECTION</button><button id="sectionCannotWalk" type="button">CANNOT WALK THE REST</button><button id="sectionReturn" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    if (cornerButton) document.getElementById("sectionMarkCorner").addEventListener("click", () => {
      try { const corner = sectionMappingTools.markCorner(data, lastPosition); saveState(); redraw(); renderSectionActive(section); simpleSetStatus(`CORNER ${corner.corner_number} SAVED FOR ${section.section_id}`, "saved"); } catch (error) { simpleSetStatus(error.message, "warning"); }
    });
    document.getElementById("sectionAddPhoto").addEventListener("pointerdown", preparePhotoStorage);
    document.getElementById("sectionAddPhoto").addEventListener("click", () => simpleTakePhoto("Section context"));
    document.getElementById("sectionVoice").addEventListener("click", async () => {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      else await startVoiceRecording({ purpose: "section_voice_note", simple_session_id: session.simple_session_id, section_id: section.section_id });
    });
    document.getElementById("sectionPause").addEventListener("click", () => { section.capture_paused = !section.capture_paused; section.events.push({ event_type: section.capture_paused ? "SECTION_PAUSED" : "SECTION_RESUMED", recorded_at: new Date().toISOString() }); saveState(); renderSectionActive(section); });
    document.getElementById("sectionFinish").addEventListener("click", () => attemptFinishSection(section, false));
    document.getElementById("sectionLandChanged").addEventListener("click", () => attemptFinishSection(section, false, "Land materially changed here."));
    document.getElementById("sectionCannotWalk").addEventListener("click", () => renderSectionFinishChoice(section, true));
    document.getElementById("sectionReturn").addEventListener("click", () => { section.capture_paused = true; section.events.push({ event_type: "SECTION_PAUSED_RETURNED_TO_FIELD_BUTTONS", recorded_at: new Date().toISOString() }); simpleReturnToFieldButtons(); });
    bindSimpleLocator(); renderSimpleHeader();
  }

  function attemptFinishSection(section, cannotWalk, note) {
    const result = sectionMappingTools.finishSection(data, section.section_id, { completion: null });
    if (result.needs_finish_choice || cannotWalk) { renderSectionFinishChoice(section, cannotWalk); return; }
    if (note) section.events.push({ event_type: "LAND_CHANGED_HERE", recorded_at: new Date().toISOString(), note });
    finishSectionUi(section);
  }

  function renderSectionFinishChoice(section, cannotWalk) {
    section.capture_paused = true;
    saveState();
    const closure = sectionMappingTools.closureState(section);
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture"><h2>HOW SHOULD THIS SECTION BE FINISHED?</h2><p class="frontage-instruction">${section.section_id} is saved. ${cannotWalk ? "You said the rest cannot be walked." : `The end is about ${closure.gap_m == null ? "an unknown distance" : `${Math.round(closure.gap_m * 3.28084)} feet`} from the start.`}</p><div class="simple-capture-actions"><button data-section-finish="CONNECT_BACK_TO_START" type="button">CONNECT BACK TO THE START</button><button data-section-finish="COULD_NOT_WALK_MISSING_EDGE" type="button">I COULD NOT WALK THE MISSING EDGE</button><button data-section-finish="SAVE_OPEN_PARTIAL_EDGE" type="button">SAVE AS AN OPEN PARTIAL EDGE</button><button data-section-finish="CONTINUE_WALKING" class="frontage-end" type="button">CONTINUE WALKING</button><button id="sectionFinishReturn" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    content.querySelectorAll("[data-section-finish]").forEach(button => button.addEventListener("click", () => {
      const completion = button.dataset.sectionFinish;
      const result = sectionMappingTools.finishSection(data, section.section_id, { completion });
      if (result.continued) { section.capture_paused = false; saveState(); renderSectionActive(section); return; }
      finishSectionUi(section);
    }));
    document.getElementById("sectionFinishReturn").addEventListener("click", simpleReturnToFieldButtons);
    bindSimpleLocator(); renderSimpleHeader();
  }

  function finishSectionUi(section) {
    const session = currentSimpleSession();
    if (session) simpleFinalizeActive("BASIC_RECORD_SAVED");
    saveState(); redraw();
    simpleSetStatus(`${section.section_id} SAVED - ${section.calculation_label}`, "saved");
    renderSectionReview(section);
  }

  function reactivateSectionAttachments(section) {
    const session = activateSectionSession(section, "SECTION_REVIEW");
    return session;
  }

  function renderSectionCorrection(section) {
    const content = document.getElementById("simpleContent");
    content.innerHTML = `<section class="simple-capture"><h2>CORRECT ${section.section_id} DESCRIPTION</h2><p>Corrections are append-only. The original description will remain in the record.</p><div class="culvert-factor-list section-correction-list">${sectionDescriptionChoices(sectionMappingTools.effectiveDescriptions(section))}</div><label>Optional reason<textarea id="sectionCorrectionReason"></textarea></label><button id="saveSectionCorrection" class="frontage-end" type="button">SAVE CORRECTION</button><button id="cancelSectionCorrection" class="simple-return" type="button">RETURN TO SECTION</button></section>`;
    document.getElementById("saveSectionCorrection").addEventListener("click", () => {
      const descriptions = Array.from(content.querySelectorAll('.section-correction-list input:checked')).map(input => input.value);
      try { sectionMappingTools.addCorrection(data, section.section_id, descriptions, document.getElementById("sectionCorrectionReason").value); saveState(); renderSectionReview(section); simpleSetStatus(`CORRECTION SAVED FOR ${section.section_id} - original preserved`, "saved"); } catch (error) { simpleSetStatus(error.message, "warning"); }
    });
    document.getElementById("cancelSectionCorrection").addEventListener("click", () => renderSectionReview(section));
  }

  function renderSectionReview(section) {
    const photos = data.photos.filter(photo => String(photo.feature_id || photo.section_id || "") === String(section.section_id));
    const voices = data.voice_notes.filter(note => String(note.section_id || "") === String(section.section_id));
    section.photo_ids = photos.map(photo => photo.id);
    section.voice_note_ids = voices.map(note => note.id);
    const area = section.approximate_acres == null ? "Not calculated for an open or photo-only edge" : `${section.approximate_acres} acres (${section.approximate_square_feet} square feet)`;
    const inferred = section.inferred_edge ? `<p class="frontage-warning">APPROXIMATE INFERRED EDGE — NOT PHYSICALLY WALKED</p>` : `<p>Walked edge preserved separately. No inferred edge is being presented as walked.</p>`;
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture"><h2>${section.section_id} SAVED</h2><div class="simple-calculation">Approximate area: ${area}<br>Approximate perimeter: ${section.approximate_perimeter_m == null ? "not calculated" : `${Math.round(section.approximate_perimeter_m * 3.28084)} feet`}<br>${section.calculation_label}</div><p><strong>${sectionMappingTools.effectiveDescriptions(section).join(" + ")}</strong></p>${inferred}<p>${photos.length} photo | ${voices.length} optional voice note</p><div class="simple-capture-actions"><button id="sectionNext" class="frontage-end" type="button">MAP THE NEXT SECTION</button><button id="sectionCorrect" type="button">ADD OR CORRECT DESCRIPTION</button><button id="sectionReviewPhoto" type="button">ADD PHOTO</button><button id="sectionReviewVoice" type="button">OPTIONAL VOICE NOTE FOR ${section.section_id}</button><button id="sectionReviewReturn" class="simple-return" type="button">RETURN TO FIELD BUTTONS</button></div></section>`;
    document.getElementById("sectionNext").addEventListener("click", () => renderSectionStart("NEXT: MAP THE ADJOINING AREA WHERE THE BRUSH, TREES, OR GROUND CHANGES. Do not map tiny differences."));
    document.getElementById("sectionCorrect").addEventListener("click", () => renderSectionCorrection(section));
    document.getElementById("sectionReviewPhoto").addEventListener("pointerdown", preparePhotoStorage);
    document.getElementById("sectionReviewPhoto").addEventListener("click", () => { const session = reactivateSectionAttachments(section); simpleTakePhoto("Section follow-up"); });
    document.getElementById("sectionReviewVoice").addEventListener("click", async () => { const session = reactivateSectionAttachments(section); await startVoiceRecording({ purpose: "section_voice_note", simple_session_id: session.simple_session_id, section_id: section.section_id }); });
    document.getElementById("sectionReviewReturn").addEventListener("click", renderSimpleHome);
    bindSimpleLocator(); renderSimpleHeader();
  }

    function renderOpenRevealStart() {
    simpleCloseDialogs(); restoreSimplePageScrolling();
    const content = document.getElementById("simpleContent");
    const laneTypes = ["ROAD-TO-INTERIOR WALKING LANE", "WET-AREA VIEWING LANE", "CREEK-INSPECTION LANE", "SECTION-EDGE LANE", "CROSS-LANE", "CANDIDATE-AREA VIEWING LANE", "OTHER"];
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture"><h2>OPEN AND REVEAL — OPTIONAL PLAN</h2><p class="frontage-instruction">Plan selective cutting of smaller brush so you can see and walk the property before deciding on broader clearing.</p><p class="frontage-warning">Cutting brush does not drain or make soft or flooded ground usable.</p><form id="openRevealForm"><label>Lane type<select name="lane_type">${laneTypes.map(item => `<option>${item}</option>`).join("")}</select></label><div class="simple-fields two"><label>Planned width, feet<input name="planned_width_ft" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Approximate length, feet<input name="approximate_length_ft" type="number" step="1" inputmode="numeric" placeholder="optional"></label></div><label>Dominant brush diameter<input name="dominant_brush_diameter" placeholder="optional, for example 2–3 inches"></label><label>Large trees to preserve<input name="large_trees_to_preserve" placeholder="optional"></label><label>Standing water<input name="standing_water" placeholder="optional"></label><label>Soft ground<input name="soft_ground" placeholder="optional"></label><label>Equipment limitations<input name="equipment_limitations" placeholder="optional"></label></form><button id="openRevealStart" class="frontage-end" type="button">RECORD LANE START HERE</button><button id="openRevealReturn" class="simple-return" type="button">RETURN TO FIELD BUTTONS</button></section>`;
    document.getElementById("openRevealStart").addEventListener("click", () => {
      const tapPosition = freshFieldPosition();
      const values = Object.fromEntries(new FormData(document.getElementById("openRevealForm")).entries());
      try {
        const now = new Date().toISOString();
        const lane = sectionMappingTools.startOpenAndRevealLane(data, Object.assign({}, values, { position: tapPosition, recorded_at: now }));
        const marker = markerFromPosition("other", lane.lane_id, null, now, tapPosition, { informationClass: "INSPECTOR_PLANNING_INTERPRETATION", attributes: { open_and_reveal_lane_id: lane.lane_id, lane_type: lane.lane_type } });
        const session = {
          schema_name: "property-inspector-simple-capture-session", schema_version: "1.0", simple_session_id: makeId("simple-session"),
          feature_id: lane.lane_id, feature_type: "open_and_reveal", started_at: now, updated_at: now, completion_status: "ACTIVE",
          information_class: "INSPECTOR_PLANNING_INTERPRETATION", return_screen: "OPEN_AND_REVEAL", details: { lane_id: lane.lane_id },
          observation_id: marker.id, lat: tapPosition ? tapPosition.lat : null, lon: tapPosition ? tapPosition.lon : null,
          gps_accuracy_m: tapPosition ? tapPosition.accuracy_m : null, gps_position_at: tapPosition ? tapPosition.time : null,
          location_status: tapPosition ? "CAPTURED_WITH_RECORD" : "PENDING_GPS", location_requested_at: now
        };
        data.markers.push(marker); data.simple_sessions.push(session); data.active_simple_session_id = session.simple_session_id; simpleActiveSessionId = session.simple_session_id; saveState(); redraw();
        renderOpenRevealActive(lane);
        simpleSetStatus(tapPosition ? `${lane.lane_id} START SAVED` : `${lane.lane_id} START SAVED — LOCATION PENDING`, tapPosition ? "saved" : "warning");
        if (!tapPosition) ensureFieldGpsReady().catch(() => {});
      } catch (error) { simpleSetStatus(error.message, "warning"); }
    });
    document.getElementById("openRevealReturn").addEventListener("click", renderSimpleHome);
    bindSimpleLocator(); renderSimpleHeader();
  }

  function renderOpenRevealActive(lane) {
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture"><h2>${lane.lane_id}</h2><p><strong>${lane.lane_type}</strong></p><p class="frontage-warning">This is a planning lane. Cutting brush may improve visibility and walking access; it will not resolve wetness.</p><div class="simple-capture-actions"><button id="openRevealPhoto" type="button">ADD PHOTO</button><button id="openRevealVoice" type="button">OPTIONAL VOICE NOTE</button><button id="openRevealFinish" class="frontage-end" type="button">RECORD LANE END HERE</button><button id="openRevealStartOnly" class="simple-return" type="button">SAVE START ONLY & RETURN</button></div></section>`;
    document.getElementById("openRevealPhoto").addEventListener("pointerdown", preparePhotoStorage);
    document.getElementById("openRevealPhoto").addEventListener("click", () => simpleTakePhoto("Open-and-Reveal lane context"));
    document.getElementById("openRevealVoice").addEventListener("click", async () => { const session = currentSimpleSession(); await startVoiceRecording({ purpose: "open_and_reveal_lane", simple_session_id: session && session.simple_session_id }); });
    const finish = position => {
      sectionMappingTools.finishOpenAndRevealLane(data, lane.lane_id, position);
      lane.photo_ids = data.photos.filter(photo => String(photo.feature_id || "") === lane.lane_id).map(photo => photo.id);
      lane.voice_note_ids = data.voice_notes.filter(note => String(note.feature_id || note.simple_session_id || "") === lane.lane_id || String(note.simple_session_id || "") === String(simpleActiveSessionId || "")).map(note => note.id);
      if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED");
      saveState(); redraw(); renderSimpleHome(); simpleSetStatus(`${lane.lane_id} SAVED`, "saved");
    };
    document.getElementById("openRevealFinish").addEventListener("click", () => finish(lastPosition));
    document.getElementById("openRevealStartOnly").addEventListener("click", () => finish(null));
    bindSimpleLocator(); renderSimpleHeader();
  }

  function frontageModel() {
    return frontageTools.ensureModel(data);
  }

  function lastGpsSequence() {
    const last = data.points.length ? data.points[data.points.length - 1] : null;
    return last && last.sequence != null ? last.sequence : data.points.length;
  }

  function simpleLocatorMarkup() {
    return `<section class="simple-locator"><div><strong id="simpleLocatorState">LOCATION UNAVAILABLE</strong><span>Approximate field locator - not a survey or legal boundary determination.</span></div><div id="simpleLocatorMap"></div><div class="simple-locator-actions"><button id="simpleCenterMap" type="button">CENTER ON ME</button><button id="simpleExpandMap" type="button">EXPAND MAP</button></div></section>`;
  }

  function bindSimpleLocator() {
    const center = document.getElementById("simpleCenterMap");
    const expand = document.getElementById("simpleExpandMap");
    if (center) center.addEventListener("click", renderSimpleLocator);
    if (expand) expand.addEventListener("click", () => { document.body.classList.add("simple-advanced-open"); document.getElementById("mapFrame").scrollIntoView({ block: "start" }); });
    renderSimpleLocator();
  }

  function setFrontageScreen(screen) {
    const model = frontageModel();
    model.screen = screen;
    model.updated_at = new Date().toISOString();
    saveState();
  }

  function frontageMarkerType(recordType) {
    return ({ frontage_end: "frontage_end", vehicle_crossing: "vehicle_crossing", ditch_change: "ditch", frontage_trees_brush: "thick", frontage_wet_soft: "wet", frontage_steep_slope: "blocked", frontage_photo: "photo", parking_staging: "parking_staging" })[recordType] || "other";
  }

    async function saveFrontageRecord(recordType, attributes) {
    const tapPosition = freshFieldPosition();
    const now = new Date().toISOString();
    const record = frontageTools.createRecord(data, recordType, tapPosition, latestOrientation, attributes || {}, now);
    const marker = markerFromPosition(frontageMarkerType(recordType), "", null, now, tapPosition, {
      evidenceClassification: "Observed",
      attributes: Object.assign({ frontage_record_id: record.record_id, frontage_record_type: recordType }, record.attributes)
    });
    record.observation_id = marker.id;
    data.markers.push(marker);
    data.lifecycle_events.push({ type: "frontage_record_saved", time: now, record_id: record.record_id, record_type: recordType, source: "button_press" });
    saveState();
    redraw();
    simpleSetStatus(tapPosition ? `${record.record_id} SAVED` : `${record.record_id} SAVED — LOCATION PENDING`, tapPosition ? "saved" : "warning");
    if (!tapPosition) ensureFieldGpsReady().catch(() => {});
    return record;
  }

  function activateFrontageSession(record, returnScreen) {
    if (!record) return null;
    if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE");
    const session = {
      schema_name: "property-inspector-simple-capture-session", schema_version: "1.0",
      simple_session_id: makeId("simple-session"), feature_id: record.record_id, feature_type: record.record_type,
      frontage_record_id: record.record_id, return_screen: returnScreen,
      started_at: record.recorded_at, updated_at: record.recorded_at, finished_at: null,
      completion_status: "ACTIVE", details: Object.assign({}, record.attributes || {}),
      lat: record.latitude, lon: record.longitude, gps_accuracy_m: record.gps_accuracy_m,
      gps_position_at: record.gps_position_at, compass_heading_deg: record.compass_heading_deg,
      device_orientation: record.device_orientation, observation_id: record.observation_id
    };
    data.simple_sessions.push(session);
    data.active_simple_session_id = session.simple_session_id;
    simpleActiveSessionId = session.simple_session_id;
    saveState();
    return session;
  }

  function renderFrontageStepOne() {
    simpleCloseDialogs(); restoreSimplePageScrolling();
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="frontage-step"><h2>STEP 1 - GO TO ONE END OF THE ROAD FRONTAGE</h2><p class="frontage-instruction">Walk to the nearest approximate end of the property's road frontage. Use the parcel outline and blue location dot as a guide.</p><div class="frontage-grid"><button id="markFrontageEnd" class="frontage-end" type="button">MARK FRONTAGE END</button><button id="unknownFrontageEnd" class="frontage-condition" type="button">I CANNOT TELL WHERE THE END IS</button><button id="frontageImportant" type="button">MARK SOMETHING IMPORTANT</button><button id="frontageStepSound" type="button">OPTIONAL SITE SOUND</button><button id="frontageStepVoice" type="button">OPTIONAL VOICE NOTE</button><button id="frontageStepReturn" class="simple-return wide" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    document.getElementById("markFrontageEnd").addEventListener("click", () => saveFrontageEnd("APPROXIMATE_END_MARKED"));
    document.getElementById("unknownFrontageEnd").addEventListener("click", () => saveFrontageEnd("END_LOCATION_UNKNOWN"));
    document.getElementById("frontageImportant").addEventListener("click", () => openSimpleCapture("other", "STEP_1"));
    document.getElementById("frontageStepSound").addEventListener("click", () => openSiteSound("road_frontage_arrival", "STEP_1"));
    document.getElementById("frontageStepVoice").addEventListener("click", async () => {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      else await startVoiceRecording({ purpose: "frontage_step_1_voice_note", simple_session_id: null });
    });
    document.getElementById("frontageStepReturn").addEventListener("click", simpleReturnToFieldButtons);
    bindSimpleLocator(); renderSimpleHeader();
  }

  async function saveFrontageEnd(confidence) {
    const record = await saveFrontageRecord("frontage_end", { boundary_confidence: confidence, surveyed_boundary_claim: false });
    if (!record) return;
    activateFrontageSession(record, "STEP_2");
    setFrontageScreen("FRONTAGE_END_SAVED");
    renderFrontageEndSaved();
  }

  function renderFrontageEndSaved() {
    const session = currentSimpleSession();
    if (!session || session.feature_type !== "frontage_end") { renderFrontageStepTwo(); return; }
    const photos = simpleSessionPhotos(session);
    const currentPhoto = photos.length ? photos[photos.length - 1] : null;
    const content = document.getElementById("simpleContent");
    content.innerHTML = `<section class="frontage-step"><h2>${session.feature_id} SAVED</h2><p class="frontage-instruction">The approximate frontage-end point, GPS, time, accuracy, and heading are saved.</p><div id="simplePhotoPreview" class="simple-photo-preview"></div><div class="frontage-support-actions"><button id="frontageEndPhoto" type="button">OPTIONAL PHOTO</button><button id="frontageEndVoice" type="button">${currentPhoto ? `OPTIONAL VOICE NOTE FOR ${currentPhoto.simple_photo_id || currentPhoto.photo_number}` : `OPTIONAL VOICE NOTE FOR ${session.feature_id}`}</button><button id="frontageEndContinue" class="frontage-end" type="button">CONTINUE</button><button id="frontageEndReturn" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    document.getElementById("frontageEndPhoto").addEventListener("pointerdown", preparePhotoStorage);
    document.getElementById("frontageEndPhoto").addEventListener("click", () => simpleTakePhoto("Frontage end context"));
    document.getElementById("frontageEndVoice").addEventListener("click", () => toggleSimpleSessionVoice(session, currentPhoto));
    document.getElementById("frontageEndContinue").addEventListener("click", () => { simpleFinalizeActive("BASIC_RECORD_SAVED"); setFrontageScreen("STEP_2"); renderFrontageStepTwo(); });
    document.getElementById("frontageEndReturn").addEventListener("click", simpleReturnToFieldButtons);
    renderSimplePhotoPreview(session).catch(() => simpleSetStatus("The frontage end is saved. Photo preview is temporarily unavailable.", "warning"));
    renderSimpleHeader();
  }

  function renderFrontageStepTwo() {
    simpleCloseDialogs(); restoreSimplePageScrolling();
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="frontage-step"><h2>STEP 2 - WALK THE ROAD FRONTAGE</h2><p class="frontage-instruction">Walk toward the other frontage end. Mark locations where the visible work required for a vehicle crossing or the roadside conditions materially change.</p><div class="frontage-grid"><button id="startFrontageWalk" class="frontage-end wide" type="button">START FRONTAGE WALK</button><button id="frontageStepTwoReturn" class="simple-return wide" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    document.getElementById("startFrontageWalk").addEventListener("click", () => {
      frontageTools.beginFrontageWalk(data, lastGpsSequence(), new Date().toISOString()); saveState(); renderFrontageWalk();
    });
    document.getElementById("frontageStepTwoReturn").addEventListener("click", simpleReturnToFieldButtons);
    bindSimpleLocator(); renderSimpleHeader();
  }

  async function saveCrossing(workClass) {
    const record = await saveFrontageRecord("vehicle_crossing", { crossing_work_class: workClass, permission_established: false, engineered: false, legally_approved: false, construction_ready: false });
    if (!record) return;
    activateFrontageSession(record, "FRONTAGE_WALK");
    setFrontageScreen("FRONTAGE_SUPPORT");
    renderFrontageSupportCapture();
  }

  async function saveRoadsideCondition(recordType) {
    const record = await saveFrontageRecord(recordType, {});
    if (!record) return;
    activateFrontageSession(record, "FRONTAGE_WALK");
    setFrontageScreen("FRONTAGE_SUPPORT");
    renderFrontageSupportCapture();
  }

  function renderFrontageWalk() {
    simpleCloseDialogs(); restoreSimplePageScrolling();
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="frontage-step"><h2>FRONTAGE WALK ACTIVE</h2><p class="frontage-instruction">Walk toward the other frontage end. Tap the first answer that matches what you see. It saves immediately.</p><div class="frontage-grid"><button data-crossing-class="NO_CULVERT_APPARENTLY_NEEDED" class="frontage-crossing" type="button">CROSSING - NO CULVERT NEEDED</button><button data-crossing-class="CULVERT_APPARENTLY_NEEDED" class="frontage-crossing" type="button">CROSSING - CULVERT NEEDED</button><button data-crossing-class="EXISTING_CROSSING" class="frontage-crossing" type="button">EXISTING CULVERT / CROSSING</button><button data-crossing-class="MAJOR_VISIBLE_WORK" class="frontage-crossing" type="button">CROSSING - MAJOR WORK</button><button data-frontage-condition="ditch_change" class="frontage-condition" type="button">DITCH CHANGED</button><button data-frontage-condition="frontage_trees_brush" class="frontage-condition" type="button">TREES / BRUSH</button><button data-frontage-condition="frontage_wet_soft" class="frontage-condition" type="button">WET / SOFT</button><button data-frontage-condition="frontage_steep_slope" class="frontage-condition" type="button">STEEP SLOPE</button><button data-frontage-condition="frontage_photo" type="button">PHOTO</button><button id="frontageSoundChanged" type="button">SOUND CHANGED</button><button id="frontageWalkVoice" type="button">OPTIONAL VOICE NOTE</button><button id="markOtherFrontageEnd" class="frontage-end" type="button">MARK OTHER FRONTAGE END</button><button id="endFrontageWalk" type="button">END FRONTAGE WALK</button><button id="frontageWalkContinue" class="frontage-end wide" type="button">SAVE WHAT I HAVE & CONTINUE FRONTAGE WALK</button><button id="frontageWalkReturn" class="simple-return wide" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    content.querySelectorAll("[data-crossing-class]").forEach(button => button.addEventListener("click", () => saveCrossing(button.dataset.crossingClass)));
    content.querySelectorAll("[data-frontage-condition]").forEach(button => button.addEventListener("click", () => saveRoadsideCondition(button.dataset.frontageCondition)));
    document.getElementById("frontageWalkVoice").addEventListener("click", async () => {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      else await startVoiceRecording({ purpose: "simple_frontage_walk_voice_note", simple_session_id: null });
    });
    document.getElementById("frontageSoundChanged").addEventListener("click", () => openSiteSound("road_frontage_sound_changed", "FRONTAGE_WALK"));
    document.getElementById("markOtherFrontageEnd").addEventListener("click", async () => {
      const record = await saveFrontageRecord("frontage_end", { boundary_confidence: "APPROXIMATE_END_MARKED", surveyed_boundary_claim: false, opposite_end: true });
      if (!record) return;
      frontageTools.endFrontageWalk(data, lastGpsSequence(), "MARKED", new Date().toISOString()); saveState(); renderFrontageReview();
    });
    document.getElementById("endFrontageWalk").addEventListener("click", () => { frontageTools.endFrontageWalk(data, lastGpsSequence(), frontageModel().frontage_end_ids.length >= 2 ? "MARKED" : "UNKNOWN", new Date().toISOString()); saveState(); renderFrontageReview(); });
    document.getElementById("frontageWalkContinue").addEventListener("click", () => simpleSetStatus("FRONTAGE WALK CONTINUES - GPS BREADCRUMBS ARE SAVING", "saved"));
    document.getElementById("frontageWalkReturn").addEventListener("click", simpleReturnToFieldButtons);
    bindSimpleLocator(); renderSimpleHeader();
  }

  function toggleSimpleSessionVoice(session, currentPhoto) {
    if (mediaRecorder && mediaRecorder.state === "recording") { mediaRecorder.stop(); return; }
    return startVoiceRecording({ purpose: currentPhoto ? "simple_photo_note" : "simple_feature_note", photo_id: currentPhoto ? currentPhoto.id : null, simple_session_id: session.simple_session_id, evidence_set_id: null });
  }

  function frontageSupportFieldNames(session) {
    if (session.feature_type === "vehicle_crossing") return ["ditch_width", "ditch_depth", "clear_crossing_width"];
    if (session.feature_type === "ditch_change") return ["width", "depth"];
    if (session.feature_type === "parking_staging") return ["length", "width"];
    return [];
  }

  const culvertQuestionSteps = ["PHOTO", "WATER", "WIDTH", "DEPTH", "PASSABLE", "WORK_FACTORS", "DONE"];

  function culvertNeededSession(session) {
    return session && session.feature_type === "vehicle_crossing" && session.details.crossing_work_class === "CULVERT_APPARENTLY_NEEDED";
  }

  function culvertStep(session) {
    const step = session.details.culvert_sequence_step || "PHOTO";
    return culvertQuestionSteps.includes(step) ? step : "PHOTO";
  }

  function saveCulvertAnswer(session, field, value, informationClass, unit, limitation) {
    session.details.culvert_questions = session.details.culvert_questions || {};
    const fact = automaticContextTools ? automaticContextTools.classifiedFact({
      field, value, information_class: informationClass || "UNKNOWN", unit: unit || null,
      source_record_id: session.feature_id, limitation: limitation || null,
      gps: { latitude: session.lat, longitude: session.lon, accuracy_m: session.gps_accuracy_m, position_at: session.gps_position_at }
    }) : { field, value, information_class: informationClass || "UNKNOWN", unit: unit || null, recorded_at: new Date().toISOString() };
    session.details.culvert_questions[field] = fact;
    session.updated_at = new Date().toISOString();
    simpleSaveDraft({ feedback: "ANSWER" });
    return fact;
  }

  function advanceCulvertQuestion(session, nextStep) {
    session.details.culvert_sequence_step = nextStep;
    session.updated_at = new Date().toISOString();
    simpleSaveDraft();
    renderCulvertNeededSequence(session);
  }

  function culvertVoiceButton(session) {
    return `<button id="culvertOptionalVoice" type="button">OPTIONAL VOICE NOTE</button><button id="culvertReturnField" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button>`;
  }

  function bindCulvertCommon(session) {
    const voice = document.getElementById("culvertOptionalVoice");
    if (voice) voice.addEventListener("click", () => toggleSimpleSessionVoice(session, null));
    const back = document.getElementById("culvertReturnField");
    if (back) back.addEventListener("click", simpleReturnToFieldButtons);
    renderSimplePhotoPreview(session).catch(() => simpleSetStatus("The feature is saved. Its preview could not be shown right now.", "warning"));
    renderSimpleHeader();
  }

  function renderCulvertNeededSequence(session) {
    const content = document.getElementById("simpleContent");
    const step = culvertStep(session);
    const shell = (title, instruction, body) => `<section class="simple-capture culvert-guided"><h2>ACTIVE FEATURE</h2><h2>CROSSING - CULVERT NEEDED</h2><p class="frontage-instruction">FEATURE SAVED</p><h3>${title}</h3><p class="simple-next-line">${instruction}</p><div id="simplePhotoPreview" class="simple-photo-preview"></div><div class="frontage-support-actions">${body}${culvertVoiceButton(session)}</div></section>`;
    if (step === "PHOTO") {
      content.innerHTML = shell("TAKE ONE PICTURE STRAIGHT ACROSS THE DITCH", "Stand on the road side. Try to show the ditch and the ground behind it in one picture. The picture is optional.", `<button id="culvertTakeAcrossPhoto" type="button">TAKE PICTURE - ${simpleNextPhotoIdentifier()}</button><button data-photo-disposition="PICTURE_WOULD_NOT_SHOW_IT" type="button">PICTURE WOULD NOT SHOW IT</button><button data-photo-disposition="SKIPPED" type="button">SKIP AND CONTINUE</button><button id="culvertPhotoContinue" class="frontage-end" type="button">SAVE WHAT I HAVE & CONTINUE</button>`);
      const take = document.getElementById("culvertTakeAcrossPhoto");
      take.addEventListener("pointerdown", preparePhotoStorage);
      take.addEventListener("click", () => simpleTakePhoto("Straight across ditch"));
      content.querySelectorAll("[data-photo-disposition]").forEach(button => button.addEventListener("click", () => {
        saveCulvertAnswer(session, "straight_across_photo_disposition", button.dataset.photoDisposition, "OBSERVED_ON_SITE");
        advanceCulvertQuestion(session, "WATER");
      }));
      document.getElementById("culvertPhotoContinue").addEventListener("click", () => advanceCulvertQuestion(session, "WATER"));
    } else if (step === "WATER") {
      content.innerHTML = shell("IS THERE WATER IN THE DITCH?", "Tap what you can directly see. This is optional.", ["YES", "NO", "UNSURE", "PICTURE SHOWS IT", "SKIP"].map(value => `<button data-water-answer="${value}" type="button">${value}</button>`).join(""));
      content.querySelectorAll("[data-water-answer]").forEach(button => button.addEventListener("click", () => {
        const answer = button.dataset.waterAnswer;
        saveCulvertAnswer(session, "water_visible_in_ditch", answer, answer === "SKIP" || answer === "UNSURE" ? "UNKNOWN" : "OBSERVED_ON_SITE");
        advanceCulvertQuestion(session, "WIDTH");
      }));
    } else if (step === "WIDTH") {
      content.innerHTML = shell("OPTIONAL DITCH TOP WIDTH", "Enter the top width only if you measured or estimated it safely.", `<label>Width<input id="culvertWidthValue" type="number" min="0" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Unit<select id="culvertWidthUnit"><option value="in">inches</option><option value="ft">feet</option></select></label><button id="culvertSaveWidth" type="button">SAVE MEASUREMENT</button>${["UNABLE", "UNSAFE", "SKIP"].map(value => `<button data-width-answer="${value}" type="button">${value}</button>`).join("")}`);
      document.getElementById("culvertSaveWidth").addEventListener("click", () => {
        const value = Number(document.getElementById("culvertWidthValue").value);
        if (!(value >= 0)) { simpleSetStatus("Enter a width or tap Unable, Unsafe, or Skip.", "warning"); return; }
        saveCulvertAnswer(session, "ditch_top_width", value, "MEASURED_ON_SITE", document.getElementById("culvertWidthUnit").value);
        advanceCulvertQuestion(session, "DEPTH");
      });
      content.querySelectorAll("[data-width-answer]").forEach(button => button.addEventListener("click", () => { saveCulvertAnswer(session, "ditch_top_width", button.dataset.widthAnswer, "UNKNOWN"); advanceCulvertQuestion(session, "DEPTH"); }));
    } else if (step === "DEPTH") {
      content.innerHTML = shell("OPTIONAL DITCH DEPTH", "Measure from the road-side top edge to the bottom only if safe.", `<label>Depth<input id="culvertDepthValue" type="number" min="0" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Unit<select id="culvertDepthUnit"><option value="in">inches</option><option value="ft">feet</option></select></label><button id="culvertSaveDepth" type="button">SAVE MEASUREMENT</button>${["UNABLE", "UNSAFE", "BOTTOM NOT REACHED", "SKIP"].map(value => `<button data-depth-answer="${value}" type="button">${value}</button>`).join("")}`);
      document.getElementById("culvertSaveDepth").addEventListener("click", () => {
        const value = Number(document.getElementById("culvertDepthValue").value);
        if (!(value >= 0)) { simpleSetStatus("Enter a depth or tap Unable, Unsafe, Bottom Not Reached, or Skip.", "warning"); return; }
        saveCulvertAnswer(session, "ditch_depth_from_road_side_top_edge", value, "MEASURED_ON_SITE", document.getElementById("culvertDepthUnit").value);
        advanceCulvertQuestion(session, "PASSABLE");
      });
      content.querySelectorAll("[data-depth-answer]").forEach(button => button.addEventListener("click", () => { saveCulvertAnswer(session, "ditch_depth_from_road_side_top_edge", button.dataset.depthAnswer, "UNKNOWN", null, button.dataset.depthAnswer === "BOTTOM NOT REACHED" ? "The measuring device did not reach the true bottom." : null); advanceCulvertQuestion(session, "PASSABLE"); }));
    } else if (step === "PASSABLE") {
      content.innerHTML = shell("IS THE GROUND BEHIND THE DITCH REASONABLY PASSABLE?", "Record only what you can see from a safe, authorized position.", ["YES", "NO", "UNSURE", "TAKE PICTURE", "SKIP"].map(value => `<button data-passable-answer="${value}" type="button">${value}</button>`).join(""));
      content.querySelectorAll("[data-passable-answer]").forEach(button => button.addEventListener("click", () => {
        const answer = button.dataset.passableAnswer;
        if (answer === "TAKE PICTURE") { simpleTakePhoto("Ground behind ditch"); return; }
        saveCulvertAnswer(session, "ground_behind_ditch_reasonably_passable", answer, answer === "UNSURE" || answer === "SKIP" ? "UNKNOWN" : "OBSERVED_ON_SITE");
        advanceCulvertQuestion(session, "WORK_FACTORS");
      }));
    } else if (step === "WORK_FACTORS") {
      const factors = ["TREES", "BRUSH", "WET / SOFT", "STEEP RISE / DROP", "FILL", "EROSION", "LARGE DRAINAGE", "NOTHING OBVIOUS", "UNKNOWN"];
      content.innerHTML = shell("WHAT VISIBLE WORK FACTORS DO YOU SEE?", "Choose any that apply, or simply continue.", `<div class="culvert-factor-list">${factors.map(value => `<label><input type="checkbox" value="${value}"> ${value}</label>`).join("")}</div><button id="culvertSaveFactors" class="frontage-end" type="button">SAVE AND CONTINUE</button><button id="culvertSkipFactors" type="button">SKIP</button>`);
      const finish = skipped => {
        const values = skipped ? [] : Array.from(content.querySelectorAll('.culvert-factor-list input:checked')).map(input => input.value);
        saveCulvertAnswer(session, "visible_work_factors", values.length ? values : (skipped ? "SKIP" : "NONE SELECTED"), values.length ? "OBSERVED_ON_SITE" : "UNKNOWN");
        advanceCulvertQuestion(session, "DONE");
      };
      document.getElementById("culvertSaveFactors").addEventListener("click", () => finish(false));
      document.getElementById("culvertSkipFactors").addEventListener("click", () => finish(true));
    } else {
      content.innerHTML = shell("OPTIONAL CULVERT CHECK COMPLETE", "The crossing and every answer you chose are saved. Continue the frontage walk.", `<button id="culvertSequenceContinue" class="frontage-end" type="button">SAVE WHAT I HAVE & CONTINUE FRONTAGE WALK</button>`);
      document.getElementById("culvertSequenceContinue").addEventListener("click", () => { simpleFinalizeActive("BASIC_RECORD_SAVED"); setFrontageScreen(session.return_screen || "FRONTAGE_WALK"); renderFrontageWorkflow(); });
    }
    bindCulvertCommon(session);
  }

  function renderFrontageSupportCapture() {
    const session = currentSimpleSession();
    if (!session) { renderFrontageWalk(); return; }
    if (session.feature_type === "frontage_end") { renderFrontageEndSaved(); return; }
    if (culvertNeededSession(session)) { renderCulvertNeededSequence(session); return; }
    const photos = simpleSessionPhotos(session);
    const currentPhoto = photos.length ? photos[photos.length - 1] : null;
    const workClass = session.details.crossing_work_class;
    const workLabel = workClass && frontageTools.WORK_CLASSES[workClass] ? frontageTools.WORK_CLASSES[workClass] : null;
    const returnLabel = session.return_screen === "PARKING_REVIEW" ? "SAVE WHAT I HAVE & CONTINUE PARKING CHECK" : "SAVE WHAT I HAVE & CONTINUE FRONTAGE WALK";
    const photoButtons = session.feature_type === "vehicle_crossing"
      ? `<button data-frontage-photo-role="Road into property" type="button">TAKE PHOTO LOOKING FROM ROAD INTO PROPERTY</button><button data-frontage-photo-role="Along ditch" type="button">TAKE PHOTO LOOKING ALONG DITCH</button>`
      : `<button data-frontage-photo-role="Context" type="button">${photos.length ? "ADD ANOTHER PHOTO" : "OPTIONAL PHOTO"}</button>`;
    const measureButtons = frontageSupportFieldNames(session).map(name => `<button data-focus-field="${name}" type="button">MEASURE ${name.replace(/_/g, " ").toUpperCase()}</button>`).join("");
    const content = document.getElementById("simpleContent");
    content.innerHTML = `<section class="simple-capture"><h2>${session.feature_id} SAVED</h2>${workLabel ? `<p class="frontage-instruction">${workLabel}</p>` : ""}<p class="simple-next-line">GPS, time, accuracy, heading, and the selected answer are already saved. Everything below is optional.</p><div id="simplePhotoPreview" class="simple-photo-preview"></div><form id="simpleCaptureForm">${simpleFieldsFor(session.feature_type)}<label>Optional typed note<textarea name="note" placeholder="optional"></textarea></label></form><div class="frontage-support-actions">${photoButtons}${measureButtons}${currentPhoto ? `<button id="frontageSupportPhotoVoice" type="button">OPTIONAL VOICE NOTE FOR ${currentPhoto.simple_photo_id || currentPhoto.photo_number}</button>` : ""}<button id="frontageSupportFeatureVoice" type="button">OPTIONAL VOICE NOTE FOR ${session.feature_id}</button><button id="frontageSupportContinue" class="frontage-end" type="button">${returnLabel}</button><button id="frontageSupportReturn" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    const form = document.getElementById("simpleCaptureForm");
    Object.entries(session.details || {}).forEach(([name, value]) => { const field = form.elements.namedItem(name); if (field && value != null) field.value = value; });
    form.addEventListener("input", simpleSaveDraft);
    form.addEventListener("change", () => simpleSaveDraft({ feedback: "OPTIONAL DETAIL" }));
    content.querySelectorAll("[data-frontage-photo-role]").forEach(button => { button.addEventListener("pointerdown", preparePhotoStorage); button.addEventListener("click", () => simpleTakePhoto(button.dataset.frontagePhotoRole)); });
    content.querySelectorAll("[data-focus-field]").forEach(button => button.addEventListener("click", () => { const field = form.elements.namedItem(button.dataset.focusField); if (field) field.focus(); }));
    const photoVoice = document.getElementById("frontageSupportPhotoVoice");
    if (photoVoice) photoVoice.addEventListener("click", () => toggleSimpleSessionVoice(session, currentPhoto));
    document.getElementById("frontageSupportFeatureVoice").addEventListener("click", () => toggleSimpleSessionVoice(session, null));
    document.getElementById("frontageSupportContinue").addEventListener("click", () => {
      const target = session.return_screen || "FRONTAGE_WALK"; simpleFinalizeActive("BASIC_RECORD_SAVED"); setFrontageScreen(target); renderFrontageWorkflow();
    });
    document.getElementById("frontageSupportReturn").addEventListener("click", simpleReturnToFieldButtons);
    renderSimplePhotoPreview(session).catch(() => simpleSetStatus("The record is saved. Photo preview is temporarily unavailable.", "warning"));
    renderSimpleHeader();
  }

  function renderFrontageReview() {
    simpleCloseDialogs(); restoreSimplePageScrolling();
    const model = frontageModel();
    const comparisons = frontageTools.compareCrossings(data);
    const rows = comparisons.length ? comparisons.map(item => `<div class="frontage-review-row" data-lowest="${item.lowest_visible_work}"><strong>${item.record_id}</strong><span>${item.comparison_label}</span><span>${item.lowest_visible_work ? "LOWEST VISIBLE WORK BASED ON RECORDED EVIDENCE" : "Compared from recorded evidence"}</span><button data-select-crossing="${item.record_id}" type="button">SELECT ${item.record_id}</button></div>`).join("") : `<p class="frontage-warning">No vehicle-crossing option was recorded. Crossing conditions remain unknown.</p>`;
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="frontage-step"><h2>END FRONTAGE WALK REVIEW</h2><p>${model.frontage_end_ids.length} approximate frontage ends | ${comparisons.length} vehicle-crossing options | ${model.ditch_change_ids.length} ditch changes</p><p class="frontage-warning">The GPS route is approximate. Any frontage not walked remains UNKNOWN.</p>${rows}<h3>Which recorded crossing currently appears to require the least work or provide the most useful alignment with the property?</h3><div class="frontage-grid"><button data-selection-type="TWO_OR_MORE_REMAIN_SIMILAR" type="button">TWO OR MORE REMAIN SIMILAR</button><button data-selection-type="NEED_TO_INSPECT_BEHIND_THEM" type="button">NEED TO INSPECT BEHIND THEM</button><button data-selection-type="INSUFFICIENT_INFORMATION" type="button">INSUFFICIENT INFORMATION</button><button data-selection-type="SKIP_FOR_NOW" type="button">SKIP FOR NOW</button><button id="reviewReturnWalk" class="frontage-end wide" type="button">RETURN TO FRONTAGE WALK</button><button id="reviewReturnField" class="simple-return wide" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    content.querySelectorAll("[data-select-crossing]").forEach(button => button.addEventListener("click", () => chooseProvisionalCrossing("SELECTED_RECORDED_CROSSING", button.dataset.selectCrossing)));
    content.querySelectorAll("[data-selection-type]").forEach(button => button.addEventListener("click", () => {
      if (button.dataset.selectionType === "SKIP_FOR_NOW") { frontageTools.selectProvisionalCrossing(data, "SKIP_FOR_NOW", null); setFrontageScreen("FIELD_BUTTONS"); renderSimpleHome(); }
      else chooseProvisionalCrossing(button.dataset.selectionType, null);
    }));
    document.getElementById("reviewReturnWalk").addEventListener("click", () => { frontageTools.beginFrontageWalk(data, lastGpsSequence(), new Date().toISOString()); saveState(); renderFrontageWalk(); });
    document.getElementById("reviewReturnField").addEventListener("click", simpleReturnToFieldButtons);
    bindSimpleLocator(); renderSimpleHeader();
  }

  function chooseProvisionalCrossing(selectionType, crossingId) {
    frontageTools.selectProvisionalCrossing(data, selectionType, crossingId, new Date().toISOString());
    saveState(); renderParkingReview();
  }

  function renderParkingReview() {
    simpleCloseDialogs(); restoreSimplePageScrolling();
    const model = frontageModel();
    const selected = model.provisional_crossing_interpretation && model.provisional_crossing_interpretation.selected_crossing_id;
    const origin = selected || "the crossing area under review";
    const content = document.getElementById("simpleContent");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="frontage-step"><h2>STEP 3 - CHECK PARKING, UNLOADING, TURNING, OR STAGING</h2><p class="frontage-instruction">Starting from ${origin}, inspect nearby ground for enough usable space for a vehicle to stop, park, unload, turn, or stage equipment.</p><p class="frontage-warning">Do not assume one area serves every purpose. Record only ground actually inspected.</p><div class="frontage-grid">${["PASSENGER-VEHICLE PARKING","PICKUP PARKING","TRAILER UNLOADING","EQUIPMENT STAGING","TURNAROUND","NONE OBSERVED","UNKNOWN"].map(label => `<button data-parking-class="${label.replace(/ /g, "_")}" type="button">${label}</button>`).join("")}<button id="finishParkingReview" class="frontage-end wide" type="button">FINISH PARKING CHECK</button><button id="parkingReturnField" class="simple-return wide" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button></div></section>`;
    content.querySelectorAll("[data-parking-class]").forEach(button => button.addEventListener("click", async () => {
      const classification = button.dataset.parkingClass;
      const record = await saveFrontageRecord("parking_staging", { classification, related_vehicle_crossing_id: selected || null, capture_method: "POINT_PLUS_OPTIONAL_DIMENSIONS" });
      if (!record) return;
      if (["NONE_OBSERVED", "UNKNOWN"].includes(classification)) { simpleSetStatus(`${record.record_id} SAVED - ${classification.replace(/_/g, " ")}`, "saved"); renderParkingReview(); return; }
      activateFrontageSession(record, "PARKING_REVIEW"); setFrontageScreen("FRONTAGE_SUPPORT"); renderFrontageSupportCapture();
    }));
    document.getElementById("finishParkingReview").addEventListener("click", () => { model.parking_review_status = "COMPLETE"; model.status = "ARRIVAL_SEQUENCE_COMPLETE"; setFrontageScreen("FIELD_BUTTONS"); renderSimpleHome(); });
    document.getElementById("parkingReturnField").addEventListener("click", simpleReturnToFieldButtons);
    bindSimpleLocator(); renderSimpleHeader();
  }

  function renderFrontageWorkflow() {
    const screen = frontageModel().screen;
    if (screen === "STEP_1") renderFrontageStepOne();
    else if (screen === "FRONTAGE_END_SAVED") renderFrontageEndSaved();
    else if (screen === "STEP_2") renderFrontageStepTwo();
    else if (screen === "FRONTAGE_WALK") renderFrontageWalk();
    else if (screen === "FRONTAGE_SUPPORT") renderFrontageSupportCapture();
    else if (screen === "FRONTAGE_REVIEW") renderFrontageReview();
    else if (screen === "PARKING_REVIEW") renderParkingReview();
    else renderSimpleHome();
  }

  function simpleReturnToFieldButtons() {
    const session = currentSimpleSession();
    if (session && session.feature_type === "map_section") {
      const section = sectionRecordForSession(session);
      if (section && section.completion_status === "ACTIVE") {
        section.capture_paused = true;
        section.events.push({ event_type: "SECTION_PAUSED_RETURNED_TO_FIELD_BUTTONS", recorded_at: new Date().toISOString() });
      }
    }
    if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE");
    simpleCloseDialogs(); restoreSimplePageScrolling(); setFrontageScreen("FIELD_BUTTONS"); renderSimpleHome();
  }

  function renderAugust4Summary() {
    const content = document.getElementById("simpleContent");
    const routeCount = august4RouteContext && Array.isArray(august4RouteContext.raw_gps_points) ? august4RouteContext.raw_gps_points.length : 0;
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture august4-summary"><h2>AUGUST 4 WET-WEATHER WALK COMPLETE</h2><div class="simple-calculation"><strong>MOST WATER: 2–4 INCHES</strong><br>DEEPEST OBSERVED: ABOUT 8 INCHES<br>GROUND: SOFT THROUGHOUT THE INSPECTED ROUTE<br>DRY GROUND FOUND: NO<br>CONDITION BEYOND STOPPING POINT: UNKNOWN</div><p class="frontage-warning">Do not repeat the failed dry-ground search during the same wet-weather inspection. Do not walk into deeper water merely to complete the map.</p><p>${routeCount.toLocaleString()} prior GPS points are loaded as a reference route. Unvisited acreage remains UNKNOWN.</p><div class="simple-capture-actions"><button id="augViewRoute" type="button">VIEW TODAY'S ROUTE</button><button id="augViewPhotos" type="button">VIEW PHOTOS</button><button id="augListenVoice" type="button">LISTEN TO VOICE NOTES</button><button id="augMapObserved" type="button">MAP OBSERVED WET SECTION</button><button id="augMarkStop" type="button">MARK WHERE I STOPPED</button><button id="augAerialReview" type="button">REVIEW CREEKS / AERIAL IMAGE</button><button id="augDryReturn" type="button">PLAN DRY-WEATHER RETURN</button><button id="augFinish" class="frontage-end" type="button">FINISH AND EXPORT</button><button id="augReturn" class="simple-return" type="button">RETURN TO FIELD BUTTONS</button></div></section>`;
    document.getElementById("augViewRoute").addEventListener("click", () => { document.getElementById("simpleLocatorMap").scrollIntoView({ block: "center" }); simpleSetStatus("AUGUST 4 WALKED ROUTE SHOWN — unvisited acreage remains unknown", "saved"); });
    document.getElementById("augViewPhotos").addEventListener("click", renderAugust4PhotoIndex);
    document.getElementById("augListenVoice").addEventListener("click", renderAugust4VoiceIndex);
    document.getElementById("augMapObserved").addEventListener("click", () => { const section = wetEdgeTools.createAugust4ObservedSection(data, august4RouteContext); saveState(); renderAugust4Summary(); simpleSetStatus(`${section.wet_area_id} SAVED AS AN OPEN OBSERVED-ROUTE SECTION — unvisited acreage remains UNKNOWN`, "saved"); });
    document.getElementById("augMarkStop").addEventListener("click", renderMarkStoppingPoint);
    document.getElementById("augAerialReview").addEventListener("click", renderAerialReview);
    document.getElementById("augDryReturn").addEventListener("click", renderDryWeatherPlan);
    document.getElementById("augFinish").addEventListener("click", renderSimpleFinish);
    document.getElementById("augReturn").addEventListener("click", renderSimpleHome);
    bindSimpleLocator(); renderSimpleHeader();
  }

  function renderAugust4PhotoIndex() {
    const content = document.getElementById("simpleContent");
    const points = august4RouteContext && Array.isArray(august4RouteContext.photograph_points) ? august4RouteContext.photograph_points : [];
    const rows = points.map(point => `<li><strong>${point.photo_number}</strong> — ${point.recorded_at || "time unavailable"}<br>${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)} · ±${Math.round(point.gps_accuracy_m || 0)} m</li>`).join("");
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture"><h2>AUGUST 4 PHOTOGRAPH LOCATIONS</h2><p>${points.length} photograph locations from the read-only failure-analysis package are shown on the map.</p><p class="frontage-warning">The actual photograph files remain in the inspection archive and are not copied into this public test website.</p><ol class="plain-record-list">${rows || "<li>No prior photograph points loaded.</li>"}</ol><button id="augPhotoBack" class="simple-return" type="button">RETURN TO AUGUST 4 SUMMARY</button></section>`;
    document.getElementById("augPhotoBack").addEventListener("click", renderAugust4Summary); bindSimpleLocator(); renderSimpleHeader();
  }

  function renderAugust4VoiceIndex() {
    const content = document.getElementById("simpleContent");
    content.innerHTML = `<section class="simple-capture"><h2>AUGUST 4 VOICE NOTES</h2><p>The read-only August 4 failure-analysis package contains 8 intact voice notes.</p><p class="frontage-warning">They remain in the private inspection archive. They were not copied into this public test website, so this screen cannot play them.</p><button id="augVoiceBack" class="simple-return" type="button">RETURN TO AUGUST 4 SUMMARY</button></section>`;
    document.getElementById("augVoiceBack").addEventListener("click", renderAugust4Summary); renderSimpleHeader();
  }

  function renderMarkStoppingPoint() {
    const content = document.getElementById("simpleContent");
    const prior = august4RouteContext && Array.isArray(august4RouteContext.raw_gps_points) ? august4RouteContext.raw_gps_points : [];
    const eastmost = prior.reduce((best, point) => !best || Number(point.longitude) > Number(best.longitude) ? point : best, null);
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture"><h2>MARK WHERE I STOPPED</h2><p>Choose only what you personally know. This creates a new append-only confirmation and does not change the August 4 GPS evidence.</p><div class="simple-capture-actions"><button id="stopCurrent" type="button">I AM STANDING AT THE STOPPING POINT</button><button id="stopFurthest" type="button">THE FURTHEST AUGUST 4 POINT IS WHERE I STOPPED</button><button id="stopUnknown" type="button">I CANNOT CONFIRM THE EXACT POINT</button><button id="stopBack" class="simple-return" type="button">RETURN WITHOUT MARKING</button></div></section>`;
    document.getElementById("stopCurrent").addEventListener("click", () => { try { previsitTools.markStoppingPoint(data, lastPosition, null); saveState(); renderAugust4Summary(); simpleSetStatus("STOPPING POINT SAVED — condition beyond it remains UNKNOWN", "saved"); } catch (error) { simpleSetStatus(error.message, "warning"); } });
    document.getElementById("stopFurthest").addEventListener("click", () => { if (!eastmost) { simpleSetStatus("The August 4 route is unavailable. Nothing was marked.", "warning"); return; } const point = { lat: eastmost.latitude, lon: eastmost.longitude, accuracy_m: eastmost.accuracy_m, time: eastmost.time }; const saved = previsitTools.markStoppingPoint(data, point, "Inspector confirmed the furthest reliable August 4 sampled point as the stopping point.", new Date().toISOString()); saved.basis = "INSPECTOR_CONFIRMED_FROM_AUGUST_4_REFERENCE_ROUTE"; saveState(); renderAugust4Summary(); simpleSetStatus("STOPPING POINT CONFIRMED AND SAVED — original route unchanged", "saved"); });
    document.getElementById("stopUnknown").addEventListener("click", () => { const model = previsitTools.ensureModel(data); model.stopping_point_status = { status: "EXACT_POINT_NOT_CONFIRMED", recorded_at: new Date().toISOString(), append_only: true }; saveState(); renderAugust4Summary(); simpleSetStatus("EXACT STOPPING POINT LEFT UNKNOWN", "saved"); });
    document.getElementById("stopBack").addEventListener("click", renderAugust4Summary); bindSimpleLocator(); renderSimpleHeader();
  }

  function renderDryWeatherPlan() {
    const content = document.getElementById("simpleContent");
    const model = previsitTools.ensureModel(data);
    content.innerHTML = `<section class="simple-capture"><h2>PLAN DRY-WEATHER RETURN</h2><div class="simple-calculation">${model.dry_weather_return_plan.readiness_statement}</div><p>${model.dry_weather_return_plan.readiness_basis}</p><h3>When there has been a useful dry period, recheck only these useful locations:</h3><ul>${model.dry_weather_return_plan.recommended_repeat_locations.map(item => `<li>${item}</li>`).join("")}</ul><p class="frontage-warning">Do not answer at every GPS point. Do not assume higher mapped ground is dry. Do not enter unsafe water.</p><button id="dryExpect" type="button">WHAT TO EXPECT TODAY</button><button id="dryBack" class="simple-return" type="button">RETURN TO AUGUST 4 SUMMARY</button></section>`;
    document.getElementById("dryExpect").addEventListener("click", renderWhatToExpect);
    document.getElementById("dryBack").addEventListener("click", renderAugust4Summary); renderSimpleHeader();
  }

  function renderWhatToExpect() {
    const content = document.getElementById("simpleContent");
    const model = previsitTools.ensureModel(data);
    content.innerHTML = `<section class="simple-capture"><h2>WHAT TO EXPECT TODAY</h2><ul>${model.what_to_expect_today.map(item => `<li>${item}</li>`).join("")}</ul><p class="frontage-warning">These are planning warnings from prior observations, aerial interpretation, and external context. They are not proof of current conditions.</p><button id="expectBack" class="simple-return" type="button">RETURN TO DRY-WEATHER PLAN</button></section>`;
    document.getElementById("expectBack").addEventListener("click", renderDryWeatherPlan); renderSimpleHeader();
  }

  function renderAerialReview() {
    const content = document.getElementById("simpleContent");
    const model = previsitTools.ensureModel(data);
    const interpretation = model.aerial_interpretations[0];
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-capture"><h2>WHAT DOES THE AERIAL IMAGE APPEAR TO SHOW?</h2><p><strong>Apple Maps appears to show a prominent winding creek and several probable branches across the large tract.</strong></p><p>The western and central area appears to have denser large-tree canopy. The mature woods thin substantially toward the eastern side, especially after the main creek. The lighter eastern area appears to contain fewer large trees, but it may consist of marsh, wet flats, and dense lower brush rather than dry open land.</p><p><strong>The location reached during the August 4 walk was largely a marshy clearing, not a trail.</strong></p><p class="frontage-warning">Source: ${interpretation.source}. Planning prediction only except for the inspector-confirmed marshy clearing. Not a survey. Not a regulatory wetland determination. Never assume dry, easy, open, or buildable ground from color.</p><label>Trace type<select id="aerialTraceType">${previsitTools.TRACE_TYPES.map(type => `<option>${type}</option>`).join("")}</select></label><label>Confidence<select id="aerialTraceConfidence"><option>uncertain</option><option>possible</option><option>probable</option></select></label><p>Tap points on the parcel map to trace one creek, creek branch, canopy area, or possible marshy clearing. Trace each branch separately.</p><div class="simple-calculation" id="aerialTraceCount">0 trace points</div><div class="simple-capture-actions"><button id="aerialUndo" type="button">UNDO LAST POINT</button><button id="aerialSave" type="button">SAVE THIS TRACE</button><button id="aerialClear" type="button">CANCEL THIS TRACE</button><button id="aerialFieldCheck" class="frontage-end" type="button">CHECK THE LIGHTER EASTERN AREA</button><button id="aerialBack" class="simple-return" type="button">RETURN TO AUGUST 4 SUMMARY</button></div></section>`;
    aerialTraceDraft = [];
    bindSimpleLocator();
    const map = document.querySelector("#simpleLocatorMap svg");
    const update = () => { const count = document.getElementById("aerialTraceCount"); if (count) count.textContent = `${aerialTraceDraft.length} trace point${aerialTraceDraft.length === 1 ? "" : "s"}`; };
    if (map) map.addEventListener("click", event => { const rect = map.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width * W; const y = (event.clientY - rect.top) / rect.height * H; const lon = xmin + x / W * (xmax - xmin); const lat = ymax - y / H * (ymax - ymin); aerialTraceDraft.push([lon, lat]); update(); });
    document.getElementById("aerialUndo").addEventListener("click", () => { aerialTraceDraft.pop(); update(); });
    document.getElementById("aerialClear").addEventListener("click", () => { aerialTraceDraft = []; update(); });
    document.getElementById("aerialSave").addEventListener("click", () => { try { const trace = previsitTools.addAerialTrace(data, { trace_type: document.getElementById("aerialTraceType").value, confidence: document.getElementById("aerialTraceConfidence").value, coordinates: aerialTraceDraft }); saveState(); renderAerialReview(); simpleSetStatus(`${trace.trace_id} SAVED AS AERIAL INTERPRETATION — not field confirmed`, "saved"); } catch (error) { simpleSetStatus(error.message, "warning"); } });
    document.getElementById("aerialFieldCheck").addEventListener("click", renderPredictionCheck);
    document.getElementById("aerialBack").addEventListener("click", renderAugust4Summary); renderSimpleHeader();
  }

  function renderPredictionCheck() {
    const content = document.getElementById("simpleContent");
    const model = previsitTools.ensureModel(data);
    const traces = model.aerial_traces || [];
    const choices = ["MARSH / WET FLAT", "STANDING WATER", "SOFT WITHOUT VISIBLE WATER", "DENSE 2–3-INCH TANGLED BRUSH", "SCATTERED LARGE TREES", "MOSTLY OPEN UNDERBRUSH", "FIRM AND DRY", "CREEK OR CHANNEL", "CANNOT REACH", "AERIAL PREDICTION WRONG", "SKIP"];
    content.innerHTML = `<section class="simple-capture"><h2>WHAT IS THE LIGHTER EASTERN AREA ACTUALLY LIKE?</h2><label>Prediction being checked<select id="predictionTrace"><option value="">THINNER TREE CANOPY / LIKELY LOW BRUSH OR MARSH — NO TRACE SELECTED</option>${traces.map(trace => `<option value="${trace.trace_id}">${trace.trace_id} — ${trace.trace_type}</option>`).join("")}</select></label><p class="simple-next-line">Tap every answer that is true. Each tap saves immediately. Nothing is required.</p><div id="predictionSavedCount" class="simple-calculation">0 choices saved</div><div class="simple-capture-actions">${choices.map(choice => `<button type="button" data-prediction-choice="${choice}">${choice}</button>`).join("")}<button id="predictionPhoto" type="button">PHOTO</button><button id="predictionVoice" type="button">OPTIONAL VOICE NOTE</button><button id="predictionDone" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button><button id="predictionBack" class="simple-return" type="button">RETURN TO AERIAL REVIEW</button></div></section>`;
    let activeCheck = null;
    const updateCount = () => { const count = document.getElementById("predictionSavedCount"); if (count) count.textContent = `${activeCheck ? activeCheck.selection_events.length : 0} choice${activeCheck && activeCheck.selection_events.length === 1 ? "" : "s"} saved`; };
    content.querySelectorAll("[data-prediction-choice]").forEach(button => button.addEventListener("click", () => {
      const traceId = document.getElementById("predictionTrace").value;
      const trace = traces.find(item => item.trace_id === traceId);
      try {
        activeCheck = previsitTools.addPredictionFieldChoice(data, { field_prediction_check_id: activeCheck && activeCheck.field_prediction_check_id, aerial_trace_id: traceId || null, aerial_prediction: trace ? trace.trace_type : "THINNER TREE CANOPY / LIKELY LOW BRUSH OR MARSH", choice: button.dataset.predictionChoice, position: lastPosition });
        saveState(); updateCount(); button.dataset.saved = "true"; simpleSetStatus(`${button.dataset.predictionChoice} SAVED — ${activeCheck.field_prediction_check_id}`, "saved");
      } catch (error) { simpleSetStatus(error.message, "warning"); }
    }));
    document.getElementById("predictionPhoto").addEventListener("pointerdown", preparePhotoStorage);
    document.getElementById("predictionPhoto").addEventListener("click", () => { if (!activeCheck) { simpleSetStatus("Tap what is actually here first, or return without recording.", "warning"); return; } renderPredictionSaved(activeCheck); setTimeout(() => document.getElementById("predictionPhoto") && document.getElementById("predictionPhoto").click(), 0); });
    document.getElementById("predictionVoice").addEventListener("click", async () => { if (!activeCheck) { simpleSetStatus("Tap what is actually here first, or return without recording.", "warning"); return; } renderPredictionSaved(activeCheck); setTimeout(() => document.getElementById("predictionVoice") && document.getElementById("predictionVoice").click(), 0); });
    document.getElementById("predictionDone").addEventListener("click", () => { if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED"); renderSimpleHome(); });
    document.getElementById("predictionBack").addEventListener("click", renderAerialReview); renderSimpleHeader();
  }

  function renderPredictionSaved(check) {
    const content = document.getElementById("simpleContent");
    content.innerHTML = `<section class="simple-capture"><h2>${check.field_prediction_check_id} SAVED</h2><p>${check.field_observation}</p><p>GPS, time, accuracy, prediction, field answer, and agreement status are saved separately.</p><div class="simple-capture-actions"><button id="predictionPhoto" type="button">TAKE PICTURE</button><button id="predictionVoice" type="button">OPTIONAL VOICE NOTE</button><button id="predictionDone" class="simple-return" type="button">RETURN TO FIELD BUTTONS</button></div></section>`;
    const makeSession = () => {
      let session = simpleSessionById(check.simple_session_id);
      if (session) return session;
      const now = new Date().toISOString();
      const marker = markerFromPosition("other", check.field_observation, null, now, lastPosition, { attributes: { field_prediction_check_id: check.field_prediction_check_id, aerial_prediction: check.aerial_prediction } });
      session = { schema_name: "property-inspector-simple-capture-session", schema_version: "1.0", simple_session_id: makeId("simple-session"), feature_id: check.field_prediction_check_id, feature_type: "aerial_prediction_check", started_at: now, updated_at: now, completion_status: "ACTIVE", information_class: "OBSERVED_ON_SITE", return_screen: "FIELD_BUTTONS", details: { field_prediction_check_id: check.field_prediction_check_id, aerial_prediction: check.aerial_prediction, field_observation: check.field_observation }, observation_id: marker.id, lat: lastPosition.lat, lon: lastPosition.lon, gps_accuracy_m: lastPosition.accuracy_m, gps_position_at: lastPosition.time };
      data.markers.push(marker); data.simple_sessions.push(session); data.active_simple_session_id = session.simple_session_id; simpleActiveSessionId = session.simple_session_id; check.simple_session_id = session.simple_session_id; saveState(); return session;
    };
    document.getElementById("predictionPhoto").addEventListener("pointerdown", preparePhotoStorage);
    document.getElementById("predictionPhoto").addEventListener("click", () => { makeSession(); simpleTakePhoto("Field confirmation of aerial prediction"); });
    document.getElementById("predictionVoice").addEventListener("click", async () => { const session = makeSession(); await startVoiceRecording({ purpose: "aerial_prediction_field_confirmation", simple_session_id: session.simple_session_id }); });
    document.getElementById("predictionDone").addEventListener("click", simpleSaveAndReturn); renderSimpleHeader();
  }

  function renderSimpleHome() {
    const content = document.getElementById("simpleContent");
    if (!content) return;
    simpleCloseDialogs();
    restoreSimplePageScrolling();
    if (!data.started) {
      content.innerHTML = `<section class="simple-start"><h2>ONE THING TO DO NEXT</h2><p>Tap the green button. Allow precise location when asked.</p><button id="simpleStart" type="button" ${offlineReady ? "" : "disabled"}>${offlineReady ? "START TEST INSPECTION" : "PREPARING OFFLINE USE..."}</button><p class="simple-help">This home test uses separate storage. It cannot clear or change the saved production inspection.</p></section>`;
      const start = document.getElementById("simpleStart");
      if (start) start.addEventListener("click", async () => { await startTracking(); renderSimpleHome(); });
      renderSimpleHeader();
      return;
    }
    const arrival = frontageModel();
    if (["NOT_STARTED", null, undefined].includes(arrival.screen)) {
      arrival.status = "IN_PROGRESS";
      arrival.screen = "STEP_1";
      arrival.created_at = arrival.created_at || data.started || new Date().toISOString();
      saveState();
    }
    if (arrival.screen !== "FIELD_BUTTONS") { renderFrontageWorkflow(); return; }
    if (currentSimpleSession()) {
      const recovered = simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE");
      simpleLastSavedMessage = `${recovered.feature_id} SAVED - RETURNED TO FIELD BUTTONS`;
      simpleSetStatus(simpleLastSavedMessage, "saved");
    }
    const frontageResumeLabel = arrival.status === "ARRIVAL_SEQUENCE_COMPLETE" ? "REVIEW ROAD FRONTAGE" : (arrival.frontage_walk.active ? "CONTINUE FRONTAGE WALK" : "CONTINUE ROAD FRONTAGE");
    const activeSection = sectionMappingTools.activeSection(data);
    const resumeSection = activeSection ? `<button id="simpleResumeSection" class="simple-feature map-section" style="display:block;width:100%;max-width:620px;margin:0 auto 8px;min-height:74px" type="button">CONTINUE ${activeSection.section_id}</button>` : "";
    content.innerHTML = `${simpleLocatorMarkup()}<section class="simple-next"><strong>WHAT DO I DO NOW?</strong><span>Tap what you see. Take a photo or add a note if useful. Nothing else is required.</span></section><button id="simpleAugust4Review" class="simple-feature water" style="display:block;width:100%;max-width:620px;margin:0 auto 8px;min-height:82px" type="button">AUGUST 4 WET-WEATHER WALK COMPLETE</button>${resumeSection}<button id="simpleResumeFrontage" class="simple-feature entrance" style="display:block;width:100%;max-width:620px;margin:0 auto 8px;min-height:68px" type="button">${frontageResumeLabel}</button><div class="simple-grid">
      <button id="simpleMapSection" type="button" class="simple-feature map-section">MAP THIS SECTION</button>${simpleFieldButton("water", "WATER", "water")}${simpleFieldButton("tree", "TREE", "tree")}${simpleFieldButton("ditch", "DITCH / SWALE", "ditch")}${simpleFieldButton("culvert", "CULVERT", "culvert")}${simpleFieldButton("blocked", "BLOCKED", "blocked")}${simpleFieldButton("entrance", "ROAD / ENTRANCE", "entrance")}${simpleFieldButton("open", "OPEN AREA", "open")}${simpleFieldButton("highlow", "HIGH / LOW", "highlow")}${simpleFieldButton("other", "OTHER", "other")}${simpleFieldButton("photo", "PHOTO", "photo")}
      <button id="simpleSiteSound" type="button" class="simple-feature voice">SITE SOUND / EXPERIENCE</button>
      <button id="simpleVoice" type="button" class="simple-feature voice">${mediaRecorder && mediaRecorder.state === "recording" ? "STOP & SAVE VOICE NOTE" : "VOICE NOTE"}</button>
      <button id="simpleFinish" type="button" class="simple-feature finish">FINISH</button></div>
      <details class="simple-advanced"><summary>ADVANCED TOOLS</summary><p>Only open this if you deliberately need an optional planning tool or the original 3.13 detailed tools.</p><button id="simpleOpenReveal" type="button">OPEN AND REVEAL</button><button id="simpleOpenAdvanced" type="button">OPEN ORIGINAL DETAILED TOOLS</button></details>`;
    content.querySelectorAll("[data-simple-feature]").forEach(button => button.addEventListener("pointerdown", preparePhotoStorage));
    content.querySelectorAll("[data-simple-feature]").forEach(button => button.addEventListener("click", () => openSimpleCapture(button.dataset.simpleFeature)));
    document.getElementById("simpleVoice").addEventListener("click", async () => {
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      else await startVoiceRecording({ purpose: "simple_general_voice_note", simple_session_id: null });
      setTimeout(renderSimpleHome, 100);
    });
    document.getElementById("simpleSiteSound").addEventListener("click", () => openSiteSound("interior_or_current_location", "FIELD_BUTTONS"));
    document.getElementById("simpleAugust4Review").addEventListener("click", renderAugust4Summary);
    document.getElementById("simpleMapSection").addEventListener("click", () => renderSectionStart());
    if (activeSection) document.getElementById("simpleResumeSection").addEventListener("click", () => {
      activeSection.capture_paused = false;
      activeSection.events.push({ event_type: "SECTION_RESUMED_FROM_FIELD_BUTTONS", recorded_at: new Date().toISOString() });
      activateSectionSession(activeSection, "FIELD_BUTTONS");
      renderSectionActive(activeSection);
    });
    document.getElementById("simpleFinish").addEventListener("click", renderSimpleFinish);
    document.getElementById("simpleResumeFrontage").addEventListener("click", () => {
      if (arrival.status === "ARRIVAL_SEQUENCE_COMPLETE") arrival.screen = "FRONTAGE_REVIEW";
      else if (arrival.frontage_walk.active) arrival.screen = "FRONTAGE_WALK";
      else if (arrival.frontage_end_ids.length) arrival.screen = "STEP_2";
      else arrival.screen = "STEP_1";
      saveState(); renderFrontageWorkflow();
    });
    document.getElementById("simpleOpenAdvanced").addEventListener("click", () => document.body.classList.add("simple-advanced-open"));
    document.getElementById("simpleOpenReveal").addEventListener("click", renderOpenRevealStart);
    bindSimpleLocator();
    renderSimpleHeader();
  }

  function simpleFieldsFor(type) {
    if (type === "water") return `<div class="simple-fields three"><label>Length<input name="length" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Width<input name="width" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Depth<input name="depth" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label></div><div class="simple-fields two"><label>Measurement unit<select name="surface_unit"><option value="in">inches</option><option value="ft">feet</option><option value="yd">yards</option></select></label><label>Depth tool<select name="depth_tool"><option>Yardstick</option><option>Tape</option><option>Estimated</option><option>Other</option></select></label></div>`;
    if (type === "tree") return `<label class="simple-primary-input">Circumference in inches<input name="circumference_in" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Tree kind<select name="tree_kind"><option>Unknown</option><option>Longleaf pine</option><option>Slash pine</option><option>Loblolly pine</option><option>Other pine</option><option>Magnolia</option><option>Oak</option><option>Sweetgum</option><option>Cypress</option><option>Other</option></select></label><p class="simple-help">Tool: flexible hospital/baby tape | Height: 54 inches | Ground: uphill side. DBH is calculated automatically.</p>`;
    if (type === "ditch") return `<div class="simple-fields three"><label>Width<input name="width" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Depth<input name="depth" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Visible length<input name="visible_length" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label></div><label>Water present<select name="water_present"><option>Unknown</option><option>Yes</option><option>No</option></select></label>`;
    if (type === "brush") return `<label>Brush severity<select name="severity"><option>Unknown</option><option>Light</option><option>Medium</option><option>Heavy</option><option>Impassable</option></select></label><label>Approximate length or area<input name="approximate_extent" type="text" placeholder="optional"></label><label>Dominant obstruction<input name="dominant_obstruction" type="text" placeholder="optional"></label>`;
    if (type === "culvert") return `<div class="simple-fields two"><label>Barrel count<input name="barrel_count" type="number" min="1" step="1" inputmode="numeric" placeholder="optional"></label><label>Barrel diameter / width<input name="barrel_size" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Total crossing width<input name="crossing_width" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Visible blockage %<input name="blockage_percent" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="optional"></label></div><label>Water present<select name="water_present"><option>Unknown</option><option>Yes</option><option>No</option></select></label>`;
    if (type === "highlow") return `<label>Ground position<select name="ground_position"><option>Unknown</option><option>High</option><option>Low</option></select></label>`;
    if (type === "vehicle_crossing") return `<div class="simple-fields three"><label>Ditch width<input name="ditch_width" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Ditch depth<input name="ditch_depth" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Clear crossing width<input name="clear_crossing_width" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label></div><label>Measurement unit<select name="measurement_unit"><option value="in">inches</option><option value="ft">feet</option></select></label>`;
    if (type === "ditch_change") return `<div class="simple-fields two"><label>Width<input name="width" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Depth<input name="depth" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label></div><label>Water present<select name="water_present"><option>Unknown</option><option>Yes</option><option>No</option></select></label><label>Measurement unit<select name="measurement_unit"><option value="in">inches</option><option value="ft">feet</option></select></label>`;
    if (type === "frontage_trees_brush") return `<label>Visible clearing burden<select name="visible_clearing_burden"><option>Unknown</option><option>Light</option><option>Moderate</option><option>Heavy</option></select></label>`;
    if (type === "frontage_wet_soft") return `<label>Ground firmness<select name="ground_firmness"><option>Unknown</option><option>Firm</option><option>Soft</option><option>Very soft</option></select></label>`;
    if (type === "frontage_steep_slope") return `<label>Visible slope severity<select name="visible_slope_severity"><option>Unknown</option><option>Moderate</option><option>Steep</option><option>Very steep</option></select></label>`;
    if (type === "parking_staging") return `<div class="simple-fields two"><label>Approximate length<input name="length" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label><label>Approximate width<input name="width" type="number" step="0.1" inputmode="decimal" placeholder="optional"></label></div><label>Measurement unit<select name="measurement_unit"><option value="ft">feet</option><option value="yd">yards</option></select></label><label>Capture method<select name="capture_method"><option value="POINT_PLUS_OPTIONAL_DIMENSIONS">Point plus approximate dimensions</option><option value="PHOTO_AND_OPTIONAL_VOICE">Photo and optional voice note</option><option value="APPROXIMATE_WALKED_PERIMETER">Walked approximate usable perimeter</option></select></label>`;
    return "";
  }

  function simpleNextPhotoIdentifier() {
    return `PHOTO-${String(Number(data.simple_counters.PHOTO || 0) + 1).padStart(3, "0")}`;
  }

  async function renderSimplePhotoPreview(session) {
    const preview = document.getElementById("simplePhotoPreview");
    if (!preview || !session) return;
    const photos = simpleSessionPhotos(session);
    const current = photos.length ? photos[photos.length - 1] : null;
    if (!current) {
      preview.innerHTML = `<strong>ACTIVE FEATURE: ${session.feature_id}</strong><span>NEXT PHOTO: ${simpleNextPhotoIdentifier()}</span><span>This will be photo 1 for ${session.feature_id}.</span>`;
      return;
    }
    const record = await photoStoreGet(current.id);
    if (!document.getElementById("simplePhotoPreview")) return;
    if (simplePreviewUrl) URL.revokeObjectURL(simplePreviewUrl);
    simplePreviewUrl = record && record.analysisBlob instanceof Blob ? URL.createObjectURL(record.analysisBlob) : null;
    preview.innerHTML = `${simplePreviewUrl ? `<img src="${simplePreviewUrl}" alt="${current.simple_photo_id || current.photo_number} verified preview">` : ""}<div><strong>PHOTO SAVED AND VERIFIED</strong><span>ACTIVE FEATURE: ${session.feature_id}</span><span>CURRENT PHOTO: ${current.simple_photo_id || current.photo_number}</span><span>Photo ${current.simple_feature_sequence || photos.length} of ${photos.length}</span></div>`;
  }

  function renderSimpleCapture() {
    const session = currentSimpleSession();
    if (!session) { renderSimpleHome(); return; }
    if (session.feature_type === "site_sound") { renderSiteSoundCapture(session); return; }
    if (session.feature_type === "map_section") {
      const section = sectionRecordForSession(session);
      if (!section) { simpleReturnToFieldButtons(); return; }
      if (section.completion_status === "ACTIVE") renderSectionActive(section);
      else renderSectionReview(section);
      return;
    }
    if (session.frontage_record_id) { renderFrontageSupportCapture(); return; }
    const content = document.getElementById("simpleContent");
    const photos = simpleSessionPhotos(session);
    const voices = simpleSessionVoiceNotes(session);
    const currentPhoto = photos.length ? photos[photos.length - 1] : null;
    const voiceButtonText = mediaRecorder && mediaRecorder.state === "recording" ? "STOP & SAVE VOICE NOTE" : (currentPhoto ? `RECORD VOICE NOTE FOR ${currentPhoto.simple_photo_id || currentPhoto.photo_number}` : `RECORD ONE VOICE NOTE FOR ENTIRE ${session.feature_id}`);
    content.innerHTML = `<section class="simple-capture"><h2>${session.feature_id} - ${simpleFeatureNames[session.feature_type]}</h2><p class="simple-next-line">Optional details. You can save and leave now.</p><div id="simplePhotoPreview" class="simple-photo-preview"></div><form id="simpleCaptureForm">${simpleFieldsFor(session.feature_type)}<label>Typed note<textarea name="note" placeholder="optional"></textarea></label></form><div id="simpleDbh" class="simple-calculation"></div><div class="simple-item-count">${photos.length} photo${photos.length === 1 ? "" : "s"} | ${voices.length} voice note${voices.length === 1 ? "" : "s"}</div><div class="simple-capture-actions"><button id="simpleSaveReturn" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button><button id="simpleTakePhoto" type="button">${photos.length ? `ADD ANOTHER PHOTO - NEXT ${simpleNextPhotoIdentifier()}` : `TAKE ${simpleNextPhotoIdentifier()}`}</button><button id="simpleSpeak" type="button">${voiceButtonText}</button>${currentPhoto ? `<button id="simpleSpeakFeature" type="button">RECORD ONE VOICE NOTE FOR ENTIRE ${session.feature_id}</button>` : ""}<button id="simpleFocusNote" type="button">TYPE NOTE</button><button id="simpleQuickMeasurement" type="button">ADD QUICK MEASUREMENT</button><details><summary>ADVANCED DETAILS</summary><p>Advanced tools are optional and never required to save.</p><button id="simpleAdvancedFromCapture" type="button">OPEN ADVANCED TOOLS</button></details></div></section>`;
    const form = document.getElementById("simpleCaptureForm");
    Object.entries(session.details || {}).forEach(([name, value]) => { const field = form.elements.namedItem(name); if (field && value !== null && value !== undefined) field.value = value; });
    const updateDbh = () => {
      const display = document.getElementById("simpleDbh");
      if (!display || session.feature_type !== "tree") return;
      const circumference = Number(form.elements.namedItem("circumference_in").value);
      display.textContent = circumference > 0 ? `Calculated DBH: ${simpleDbh(circumference)} inches` : "Calculated DBH: not entered";
    };
    form.addEventListener("input", () => { simpleSaveDraft(); updateDbh(); });
    form.addEventListener("change", () => { simpleSaveDraft({ feedback: "MEASUREMENT" }); updateDbh(); });
    updateDbh();
    document.getElementById("simpleSaveReturn").addEventListener("click", simpleSaveAndReturn);
    document.getElementById("simpleTakePhoto").addEventListener("pointerdown", preparePhotoStorage);
    document.getElementById("simpleTakePhoto").addEventListener("click", simpleTakePhoto);
    document.getElementById("simpleSpeak").addEventListener("click", async () => {
      simpleSaveDraft();
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      else await startVoiceRecording({ purpose: currentPhoto ? "simple_photo_note" : "simple_feature_note", photo_id: currentPhoto ? currentPhoto.id : null, simple_session_id: session.simple_session_id, evidence_set_id: null });
      setTimeout(renderSimpleCapture, 100);
    });
    const featureVoiceButton = document.getElementById("simpleSpeakFeature");
    if (featureVoiceButton) featureVoiceButton.addEventListener("click", async () => {
      simpleSaveDraft();
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      else await startVoiceRecording({ purpose: "simple_feature_note", photo_id: null, simple_session_id: session.simple_session_id, evidence_set_id: null });
      setTimeout(renderSimpleCapture, 100);
    });
    document.getElementById("simpleFocusNote").addEventListener("click", () => form.elements.namedItem("note").focus());
    document.getElementById("simpleQuickMeasurement").addEventListener("click", () => { const target = form.querySelector('input[type="number"]'); if (target) target.focus(); else simpleSetStatus("This record has no quick number. Use the optional note.", "normal"); });
    document.getElementById("simpleAdvancedFromCapture").addEventListener("click", () => document.body.classList.add("simple-advanced-open"));
    renderSimplePhotoPreview(session).catch(() => { simpleSetStatus("Photo is saved. Its preview could not be displayed right now.", "warning"); });
    renderSimpleHeader();
  }

    async function openSimpleCapture(type, returnScreen) {
    const tapPosition = freshFieldPosition();
    if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED_DETAILS_INCOMPLETE");
    simpleCloseDialogs();
    const featureId = simpleNextIdentifier(type);
    const now = new Date().toISOString();
    const session = {
      schema_name: "property-inspector-simple-capture-session", schema_version: "1.0",
      simple_session_id: makeId("simple-session"), feature_id: featureId, feature_type: type,
      started_at: now, updated_at: now, finished_at: null,
      completion_status: "ACTIVE", information_class: "OBSERVED_ON_SITE", return_screen: returnScreen || "FIELD_BUTTONS", details: type === "water" ? { depth_tool: "Yardstick", surface_unit: "in" } : {},
      lat: tapPosition ? tapPosition.lat : null, lon: tapPosition ? tapPosition.lon : null, gps_accuracy_m: tapPosition ? tapPosition.accuracy_m : null,
      gps_position_at: tapPosition ? tapPosition.time : null, compass_heading_deg: latestOrientation ? latestOrientation.compass_heading_deg : (tapPosition ? tapPosition.heading_deg : null),
      device_orientation: latestOrientation ? { alpha_deg: latestOrientation.alpha_deg, beta_deg: latestOrientation.beta_deg, gamma_deg: latestOrientation.gamma_deg, absolute: latestOrientation.absolute } : null,
      location_status: tapPosition ? "CAPTURED_WITH_RECORD" : "PENDING_GPS", location_requested_at: now
    };
    if (type === "tree") session.details = { tree_kind: "Unknown", measurement_tool: "Flexible hospital/baby tape", measurement_height_in: 54, ground_basis: "Uphill side" };
    const marker = markerFromPosition(simpleMarkerType(type), "", null, now, tapPosition, { attributes: { simple_session_id: session.simple_session_id, feature_id: featureId, simple_feature_type: type, completion_status: "ACTIVE" } });
    session.observation_id = marker.id;
    data.markers.push(marker);
    data.simple_sessions.push(session);
    data.active_simple_session_id = session.simple_session_id;
    simpleActiveSessionId = session.simple_session_id;
    saveState(); redraw();
    simpleLastSavedMessage = tapPosition ? `FEATURE SAVED - ${featureId}` : `FEATURE SAVED - ${featureId} - LOCATION PENDING`;
    simpleSetStatus(simpleLastSavedMessage, tapPosition ? "saved" : "warning");
    if (!tapPosition) ensureFieldGpsReady().catch(() => {});
    if (type === "photo") { simpleTakePhoto(); return; }
    renderSimpleCapture();
  }

  function simpleTakePhoto(photoRole) {
    const session = simpleSaveDraft();
    if (!session) return;
    const photoNumber = Number(data.simple_counters.PHOTO || 0) + 1;
    data.simple_counters.PHOTO = photoNumber;
    const simplePhotoId = `PHOTO-${String(photoNumber).padStart(3, "0")}`;
    const sequence = simpleSessionPhotos(session).length + 1;
    session.pending_photo_id = simplePhotoId;
    saveState();
    simpleSetStatus(`ACTIVE FEATURE: ${session.feature_id} | NEXT PHOTO: ${simplePhotoId} | Photo ${sequence} for this feature`, "normal");
    takePhoto({
      category: simpleFeatureNames[session.feature_type] || "Other",
      note: session.details.note || "",
      associatedObservationId: session.observation_id,
      evidenceClassification: "Observed",
      observationAttributes: Object.assign({}, session.details, { simple_session_id: session.simple_session_id, feature_id: session.feature_id, photo_role: photoRole || "Context" }),
      simple_capture: true,
      simple_session_id: session.simple_session_id,
      feature_id: session.feature_id,
      section_id: session.section_id || null,
      simple_photo_id: simplePhotoId,
      simple_feature_sequence: sequence,
      evidence_set_id: null,
      photo_role: photoRole || "Context",
      question_ids: [], question_links: []
    });
  }

  function simpleSaveAndReturn() {
    try {
      const active = currentSimpleSession();
      const returnScreen = active && active.return_screen;
      const session = simpleFinalizeActive("BASIC_RECORD_SAVED");
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      simpleCloseDialogs();
      const summary = session ? `${session.feature_id} SAVED - ${simpleSessionPhotos(session).length} photos` : "EVERYTHING SAVED";
      if (returnScreen && returnScreen !== "FIELD_BUTTONS") { setFrontageScreen(returnScreen); renderFrontageWorkflow(); }
      else { setFrontageScreen("FIELD_BUTTONS"); renderSimpleHome(); }
      simpleSetStatus(summary, "saved");
    } catch (error) {
      simpleCloseDialogs();
      data.active_simple_session_id = null;
      simpleActiveSessionId = null;
      try { saveState(); } catch (saveError) { /* Existing durable records remain untouched. */ }
      renderSimpleHome();
      simpleSetStatus(`RETURNED TO BUTTONS. Saved evidence remains on this phone. ${error.message}`, "warning");
    }
  }

  function renderActiveSimpleSession() {
    const session = currentSimpleSession();
    if (!session) { renderSimpleHeader(); return; }
    if (session.frontage_record_id) renderFrontageSupportCapture();
    else renderSimpleCapture();
  }

  function simpleReturnFromAdvanced() {
    if (data.active_evidence_set_id && evidenceSetTools) {
      try { evidenceSetTools.finishEvidenceSet(data, data.active_evidence_set_id, { completion_status: "BASIC_RECORD_SAVED_DETAILS_INCOMPLETE", reason: "Inspector returned to simple field buttons" }); } catch (error) { data.active_evidence_set_id = null; }
    }
    simpleCloseDialogs();
    document.body.classList.remove("simple-advanced-open");
    simpleSaveAndReturn();
  }

  async function renderSimpleFinish() {
    if (currentSimpleSession()) simpleFinalizeActive("BASIC_RECORD_SAVED");
    simpleCloseDialogs();
    const content = document.getElementById("simpleContent");
    content.innerHTML = `<section class="simple-finish"><h2>FINISH TEST INSPECTION</h2><p>First make the ChatGPT package. Then make the full archive.</p><button id="simpleReportPackage" type="button">SEND THIS TEST INSPECTION TO CHATGPT</button><p>Contains every photo at analysis quality, GPS, notes, measurements, and voice records.</p><button id="simpleFullArchive" type="button">DOWNLOAD FULL PRESERVATION ARCHIVE</button><p>Contains every original photo byte-for-byte.</p><button id="simpleFinishReturn" class="simple-return" type="button">RETURN TO FIELD BUTTONS</button><div id="simplePackageResult"></div></section>`;
    document.getElementById("simpleReportPackage").addEventListener("click", async () => { await finishInspection({ reviewed: true, simple_test: true }); renderSimplePackageResult(); });
    document.getElementById("simpleFullArchive").addEventListener("click", async () => { await exportBackupNow(); renderSimplePackageResult(); });
    document.getElementById("simpleFinishReturn").addEventListener("click", renderSimpleHome);
    renderSimpleHeader();
  }

  function renderSimplePackageResult() {
    const result = document.getElementById("simplePackageResult");
    if (!result) return;
    if (!lastPackageUrl) { result.textContent = "Package was not created. Your test inspection is still saved."; return; }
    result.innerHTML = `<h3>INSPECTION ZIP IS READY</h3><strong class="simple-package-name"></strong><button id="simpleShareZip" type="button">SHARE ZIP</button><a id="simpleDownloadZip" class="button-link" download>DOWNLOAD ZIP</a><p>Do not clear this test until both packages are verified.</p>`;
    result.querySelector(".simple-package-name").textContent = lastPackageFile ? lastPackageFile.name : "Inspection package";
    const link = document.getElementById("simpleDownloadZip"); link.href = lastPackageUrl; link.download = lastPackageFile ? lastPackageFile.name : "HOME_TEST_3_13_INSPECTION.zip";
    document.getElementById("simpleShareZip").addEventListener("click", shareLastPackage);
  }

  function installSimpleReturnButtons() {
    document.querySelectorAll("dialog .dialog-actions").forEach(actions => {
      if (actions.querySelector(".simple-dialog-return")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "simple-dialog-return simple-return";
      button.textContent = "SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS";
      button.addEventListener("click", simpleReturnFromAdvanced);
      actions.prepend(button);
    });
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
      renderSimpleHome();
    } catch (error) {
      offlineState.textContent = "Offline setup failed";
      offlineState.dataset.ready = "false";
      updateNextStep();
      setStatus("OFFLINE SETUP FAILED: reload with service before entering the woods.", "error");
    }
  }

  async function initialize() {
    if (!packageTools || !dbRecoveryTools || !coachingTools || !waterTools || !governanceTools || !evidenceSetTools || !weatherTools || !frontageTools || !automaticContextTools || !sectionMappingTools || !wetEdgeTools || !previsitTools) {
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
    try {
      const response = await fetch("./assets/august-4-route-context.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      august4RouteContext = await response.json();
    } catch (error) {
      august4RouteContext = null;
      setStatus(`The August 4 reference route is unavailable: ${error.message}`, "warning");
    }
    if (SIMPLE_AUTOMATION_MODE && data.started) {
      lastPosition = { lat: 30.489, lon: -87.091, accuracy_m: 3, altitude_m: 20, altitude_accuracy_m: 2, heading_deg: 90, speed_mps: 0, time: new Date().toISOString(), sequence: 1 };
      if (!data.points.length) data.points.push(Object.assign({}, lastPosition));
    }
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
    renderAuthoritativeWeather();
    await renderGallery();
    await Promise.all([loadParcels(), registerOfflineWorker()]);
    if (data.started && !data.stopped && watchId === null && !SIMPLE_AUTOMATION_MODE) {
      gpsUserActivatedThisPage = false;
      clearActiveGpsWatch();
      updateControls();
      renderSimpleHeader();
    }
    coverageSnapshot = null;
    coachingStateSnapshot = null;
    coverageDirty = true;
    redraw();
    renderCoaching();
    renderAuditHistory();
    renderEvidenceSets();
    if (statusEl.dataset.kind !== "error") {
      setStatus(pendingPhotoQueue.length ? "Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo." : (data.started ? "Saved inspection loaded. Use the green GPS button at the top of the field screen." : "Ready. Use the green GPS button at the top of the field screen."), pendingPhotoQueue.length ? "warning" : "normal");
    }
    installSimpleReturnButtons();
    document.getElementById("simpleTopReturn").addEventListener("click", simpleReturnToFieldButtons);
    document.getElementById("simpleTopFinish").addEventListener("click", renderSimpleFinish);
    document.getElementById("simpleAdvancedReturn").addEventListener("click", simpleReturnFromAdvanced);
    renderSimpleHome();
    schedulePackageEstimateRefresh();
  }

  startBtn.addEventListener("click", startTracking);
  stopBtn.addEventListener("click", () => stopTracking());
  finishBtn.addEventListener("click", () => finishInspection());
  document.getElementById("addArea").addEventListener("click", addInspectionArea);
  document.getElementById("newInspectionPhase").addEventListener("click", markNewInspectionPhase);
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
  document.getElementById("reviewCorrections").addEventListener("click", () => document.querySelector(".audit-card").scrollIntoView({ behavior: "smooth", block: "start" }));
  document.getElementById("reviewPearsonPhases").addEventListener("click", () => renderReviewedSynthesis("phases"));
  document.getElementById("approveEvidenceSets").addEventListener("click", () => { renderEvidenceSets(); document.getElementById("evidence-sets-heading").scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.getElementById("reviewWaterMap").addEventListener("click", () => renderReviewedSynthesis("water"));
  document.getElementById("reviewCreekMap").addEventListener("click", () => renderReviewedSynthesis("creek"));
  document.getElementById("reviewVegetationMap").addEventListener("click", () => renderReviewedSynthesis("vegetation"));
  document.getElementById("reviewHomesiteConcepts").addEventListener("click", () => renderReviewedSynthesis("homesite"));
  document.getElementById("importChatGPTReview").addEventListener("click", () => document.getElementById("chatReviewInput").click());
  document.getElementById("chatReviewInput").addEventListener("change", importChatReviewFile);
  document.getElementById("generatePropertyReport").addEventListener("click", () => finishInspection({ reviewed: true }));
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
  document.getElementById("refreshAuthoritativeWeather").addEventListener("click", () => refreshAuthoritativeWeather());
  document.getElementById("csv").addEventListener("click", () => downloadText("Pearson_Road_Field_Track.csv", "text/csv", packageTools.createCsv(data, [])));
  document.getElementById("geojson").addEventListener("click", () => downloadText("Pearson_Road_Field_Track.geojson", "application/geo+json", packageTools.createGeoJSON(data, [])));
  document.getElementById("gpx").addEventListener("click", () => downloadText("Pearson_Road_Field_Track.gpx", "application/gpx+xml", packageTools.createGpx(data, [])));
  document.getElementById("contourOpacity").addEventListener("input", event => { document.getElementById("contours").style.opacity = event.target.value; });
  document.getElementById("terrainOpacity").addEventListener("input", event => { document.getElementById("hillshade").style.opacity = event.target.value; });
  [document.getElementById("hillshade"), document.getElementById("contours")].forEach(image => image.addEventListener("error", () => {
    image.hidden = true;
    setStatus("A background map image is unavailable. GPS, observations, photos, and notes still work; continue using the parcel and route overlay.", "warning");
  }));
    function revalidateGpsAfterReturn() {
    if (!gpsUserActivatedThisPage || !data.started || data.stopped || gpsPermissionDenied) {
      renderSimpleHeader();
      return;
    }
    if (!freshFieldPosition() || gpsWatcherIsStale()) {
      clearActiveGpsWatch();
      startTracking({ recovery: true, skipReconcile: true }).catch(error => {
        lastGpsErrorCode = 0;
        lastGpsErrorMessage = error && error.message ? error.message : "reconnect failed";
        lastGpsErrorAt = new Date().toISOString();
        renderSimpleHeader();
      });
    } else if (watchId !== null && !wakeLock) keepAwake();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      try { saveState(); } catch (error) { /* background save is only an extra snapshot */ }
      return;
    }
    revalidateGpsAfterReturn();
    preparePhotoStorage();
  });
  window.addEventListener("pageshow", revalidateGpsAfterReturn);
  window.addEventListener("beforeunload", event => {
    if (photoBusy || packageBusy) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  setInterval(updateTimeMetrics, 30000);

  function gpsRecoveryWatchdog() {
    if (!data.started || data.stopped || !gpsUserActivatedThisPage || gpsPermissionDenied || gpsManualRequestInFlight) {
      updateVisibleGpsControl();
      return;
    }
    if (freshFieldPosition()) {
      gpsRecoveryReason = "";
      updateVisibleGpsControl();
      return;
    }
    if (watchId !== null && gpsWatcherIsStale()) {
      gpsRecoveryReason = "GPS STALLED — automatic recovery started. Tap RECONNECT GPS if it does not recover.";
      clearActiveGpsWatch();
      updateVisibleGpsControl();
      startTracking({ recovery: true, skipReconcile: true }).catch(error => {
        gpsRecoveryReason = `GPS AUTOMATIC RECOVERY FAILED: ${error && error.message ? error.message : "unknown error"}. Tap RECONNECT GPS.`;
        updateVisibleGpsControl();
      });
    } else {
      updateVisibleGpsControl();
    }
  }

  setInterval(gpsRecoveryWatchdog, 15000);

  initialize();
})();
