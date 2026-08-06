(function () {
  "use strict";

  const APP_VERSION = "3.13.0-home-test.5.4";
  const SIMPLE_TEST_BUILD = "field-simple-test-fixed-313";
  const BUILD_ID = new URLSearchParams(location.search).get("deploy") || "FIELD-FIX-5.4-CANDIDATE";
  const SIMPLE_AUTOMATION_MODE = ["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).get("automation") === "1";
  const W = 1800;
  const H = 1500;
  const xmin = -87.1;
  const ymin = 30.4825;
  const xmax = -87.083;
  const ymax = 30.497;
  const stateKey = "propertyInspectorFixedTest313V1";
  const legacyStateKey = "propertyInspectorFixedTest313LegacyDisabled";
  const noteDraftKey = "propertyInspectorFixedTest313NoteDraftV1";
  const photoDbName = "property-inspector-fixed-test-313-evidence";
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
  const pendingPhotoCacheName = "property-inspector-fixed-test-313-pending-v1";

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
  let fieldButtonCheckPassed = sessionStorage.getItem("propertyInspectorFixedButtonCheck") === APP_VERSION;

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
      section_notes: [],
      ui_action_log: [],
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
      nextStep.textContent = offlineState.dataset.ready === "true" ? "NEXT: Tap Start Inspection." : "NEXT: Wait for â€œOffline ready,â€ then tap Start Inspection.";
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
    data.section_notes = Array.isArray(data.section_notes) ? data.section_notes : [];
    data.ui_action_log = Array.isArray(data.ui_action_log) ? data.ui_action_log : [];
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
      missing_evidence_rev…90616 tokens truncated…opped && watchId === null && !SIMPLE_AUTOMATION_MODE) {
      await startTracking();
    }
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
    installSimpleReturnButtons();
    const simpleShell = document.getElementById("simpleShell");
    simpleShell.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      const details = { action_name: (button.textContent || button.id || "BUTTON").trim(), button_id: button.id || null };
      button.dataset.tapState = "received";
      recordUiAction("UI_ACTION_ATTEMPT", details);
      if (button.id !== "simpleButtonCheck") simpleSetStatus(`${details.action_name} â€” TAP RECEIVED`, "normal");
      setTimeout(() => {
        if (button.isConnected) delete button.dataset.tapState;
        recordUiAction("UI_ACTION_SUCCEEDED", details);
      }, 0);
    }, true);
    document.getElementById("simpleTopReturn").addEventListener("click", simpleReturnToFieldButtons);
    document.getElementById("simpleTopFinish").addEventListener("click", renderSimpleFinish);
    document.getElementById("simpleAdvancedReturn").addEventListener("click", simpleReturnFromAdvanced);
    document.getElementById("reloadLatestApp").addEventListener("click", async () => {
      simpleSetStatus("CHECKING FOR THE LATEST VERIFIED APP â€” saved evidence is unchanged.", "normal");
      try {
        const registration = await navigator.serviceWorker.getRegistration("./");
        if (registration) await registration.update();
      } catch (error) { recordUiAction("UI_ACTION_FAILED", { action_name: "RELOAD_LATEST_APP", button_id: "reloadLatestApp", error_message: error.message }); }
      location.reload();
    });
    document.getElementById("reportButtonFailure").addEventListener("click", () => {
      recordUiAction("UI_ACTION_FAILED", { action_name: "USER_REPORTED_BUTTON_FAILURE", button_id: null, error_message: "Inspector reported that a visible control failed." });
      simpleSetStatus("BUTTON FAILURE SAVED IN THIS INSPECTION. Continue if safe; the diagnostic will export.", "warning");
    });
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
      document.getElementById("photoExplanationState").textContent = "Saving the explanationâ€¦";
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
    setStatus(event.target.checked ? "Field rule saved: within the walked and visually observed corridor, unphotographed locations may support â€˜no standing water observed at inspection time.â€™" : "Field rule removed. The report will not infer inspected dry ground from missing water photographs.", "active");
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
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (watchId !== null && !wakeLock) keepAwake();
      if (data.started && !data.stopped && watchId === null) startTracking();
      preparePhotoStorage();
    }
  });
  window.addEventListener("pageshow", () => {
    restoreSimplePageScrolling();
    simpleCloseDialogs();
    if (data.started && !data.stopped && watchId === null && !SIMPLE_AUTOMATION_MODE) startTracking();
    const session = currentSimpleSession();
    if (session && session.feature_type === "map_section") renderActiveSimpleSession();
    simpleSetStatus(data.started ? "APP RESTORED â€” saved work is still here. GPS is resuming." : "LATEST VERIFIED BUILD LOADED", "saved");
  });
  window.addEventListener("error", event => {
    recordUiAction("UI_ACTION_FAILED", { action_name: "UNHANDLED_APP_ERROR", button_id: null, error_message: event.message || "Unknown app error" });
    const report = document.getElementById("reportButtonFailure");
    if (report) report.hidden = false;
  });
  window.addEventListener("unhandledrejection", event => {
    const message = event.reason && event.reason.message ? event.reason.message : String(event.reason || "Unknown app error");
    recordUiAction("UI_ACTION_FAILED", { action_name: "UNHANDLED_PROMISE_ERROR", button_id: null, error_message: message });
    const report = document.getElementById("reportButtonFailure");
    if (report) report.hidden = false;
    simpleSetStatus(`ACTION FAILED â€” ${message}. Your saved evidence remains on this phone.`, "warning");
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

