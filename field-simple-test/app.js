(function () {
  "use strict";

  const APP_VERSION = "3.13.0-home-test.5.2";
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
    data.simple_counters ×_=ã»h‘éì¶»§q«^tWÚYHXİ]™P\™XTÙ[Xİ˜[YNÃBˆÛÛœİ\™XHH]Kš[œÜXİ[Û—Ø\™X\Ë™š[™
][HOˆ][K˜\™XWÚYOOH]K˜Xİ]™WØ\™XWÚY
NÃBˆ]K›Y™XŞXÛWÙ]™[Ëœ\Ú
È\Nˆš[œÜXİ[Û—Ø\™XWÜÙ[XİY‹[YNˆ™]È]J
KÒTÓÔİš[™Ê
K\™XWÚYˆ]K˜Xİ]™WØ\™XWÚY\™XWÛ˜[YNˆ\™XHÈ\™XK›˜[YHˆ[Ûİ\˜ÙNˆ™šY[ØÛÛ›ÛˆJNÃBˆØ]™Tİ]J
NÈ™[™\ÛØXÚ[™Ê
NÃBˆÙ]İ]\Êİ\œ™[\™XH\È	Ø\™XHÈ\™XK›˜[YHˆœÙ[XİYŸKˆ™]È]šY[˜ÙHÚ[]XÚ]]ÛX]XØ[K˜˜Xİ]™HŠNÃBˆJNÃBˆ]šY[˜ÙT™[][ÛœÚ\Ù[Xİ˜Y]™[\İ[™\Š˜Ú[™ÙH‹

HOˆÈ]K›™^Ù]šY[˜ÙWÜ™[][ÛœÚ\H]šY[˜ÙT™[][ÛœÚ\Ù[Xİ˜[YNÈØ]™Tİ]J
NÈ™[™\ÛØXÚ[™Ê
NÈJNÃBˆ™^İÕ˜[YTÙ[Xİ˜Y]™[\İ[™\Š˜Ú[™ÙH‹

HOˆÈ]K›™^Üİ×İ˜[YHH™^İÕ˜[YTÙ[Xİ˜[YNÈØ]™Tİ]J
NÈ™[™\ÛØXÚ[™Ê
NÈJNÃBˆØİ[Y[™Ù][[Y[RY
œ™]šY]Ñ]šY[˜ÙHŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹ÚİÑ\\\™T™]šY]ÊNÃBˆØİ[Y[™Ù][[Y[RY
œ™]šY]ĞÛÜœ™Xİ[ÛœÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆØİ[Y[œ]Y\TÙ[XİÜŠ‹˜]Y]XØ\™ŠKœØÜ›Û[ÕšY]ÊÈ™Z]š[ÜˆœÛ[Ûİ‹›ØÚÎˆœİ\ˆJJNÃBˆØİ[Y[™Ù][[Y[RY
œ™]šY]ÔX\œÛÛ”\Ù\ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™[™\”™]šY]ÙYŞ[\Ú\Êœ\Ù\ÈŠJNÃBˆØİ[Y[™Ù][[Y[RY
˜\›İ™Q]šY[˜ÙTÙ]ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÈ™[™\‘]šY[˜ÙTÙ]Ê
NÈØİ[Y[™Ù][[Y[RY
™]šY[˜ÙK\Ù]ËZXY[™ÈŠKœØÜ›Û[ÕšY]ÊÈ™Z]š[ÜˆœÛ[Ûİ‹›ØÚÎˆœİ\ˆJNÈJNÃBˆØİ[Y[™Ù][[Y[RY
œ™]šY]ÕØ]\“X\ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™[™\”™]šY]ÙYŞ[\Ú\ÊØ]\ˆŠJNÃBˆØİ[Y[™Ù][[Y[RY
œ™]šY]ĞÜ™YZÓX\ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™[™\”™]šY]ÙYŞ[\Ú\Ê˜Ü™YZÈŠJNÃBˆØİ[Y[™Ù][[Y[RY
œ™]šY]Õ™YÙ]][Û“X\ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™[™\”™]šY]ÙYŞ[\Ú\Ê™YÙ]][ÛˆŠJNÃBˆØİ[Y[™Ù][[Y[RY
œ™]šY]ÒÛY\Ú]PÛÛ˜Ù\ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™[™\”™]šY]ÙYŞ[\Ú\ÊšÛY\Ú]HŠJNÃBˆØİ[Y[™Ù][[Y[RY
š[\ÜÚ]Ô™]šY]ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆØİ[Y[™Ù][[Y[RY
˜Ú]™]šY]Ò[œ]ŠK˜ÛXÚÊ
JNÃBˆØİ[Y[™Ù][[Y[RY
˜Ú]™]šY]Ò[œ]ŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹[\ÜÚ]™]šY]Ñš[JNÃBˆØİ[Y[™Ù][[Y[RY
™Ù[™\˜]T›Ü\T™\ÜŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆš[š\Ú[œÜXİ[ÛŠÈ™]šY]ÙYˆYHJJNÃBˆØİ[Y[™Ù][[Y[RY
˜ÛÛ[YR[œÜXİ[™ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ\\\™QX[ÙË˜ÛÜÙJ
JNÃBˆØİ[Y[™Ù][[Y[RY
™š[š\ÚY\”™]šY]ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÈ\\\™QX[ÙË˜ÛÜÙJ
NÈš[š\Ú[œÜXİ[ÛŠÈ™]šY]ÙYˆYHJNÈJNÃBˆØİ[Y[™Ù][[Y[RY
Ù]ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÜ[“ØœÙ\˜][Û‘X[ÙÊÙ]ŠJNÃBˆØİ[Y[™Ù][[Y[RY
™HŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÜ[“ØœÙ\˜][Û‘X[ÙÊ™HŠJNÃBˆØİ[Y[™Ù][[Y[RY
˜›ØÚÙYŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÜ[“ØœÙ\˜][Û‘X[ÙÊ˜›ØÚÙYŠJNÃBˆØİ[Y[™Ù][[Y[RY
šYÚŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\ŠšYÚŠJNÃBˆØİ[Y[™Ù][[Y[RY
šÛY\Ú]HŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\ŠšÛY\Ú]HŠJNÃBˆØİ[Y[™Ù][[Y[RY
˜İ[™\ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Š˜İ[™\ŠJNÃBˆØİ[Y[™Ù][[Y[RY
™YHŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Š™YHŠJNÃBˆØİ[Y[™Ù][[Y[RY
™[˜[˜ÙHŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Š™[˜[˜ÙHŠJNÃBˆØİ[Y[™Ù][[Y[RY
Ú[Y™HŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\ŠÚ[Y™HŠJNÃBˆØİ[Y[™Ù][[Y[RY
XÚÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\ŠXÚÈŠJNÃBˆØİ[Y[™Ù][[Y[RY
›Ü[ˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Š›Ü[ˆŠJNÃBˆØİ[Y[™Ù][[Y[RY
™]ÚŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Š™]ÚŠJNÃBˆØİ[Y[™Ù][[Y[RY
[X™\ˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Š[X™\ˆŠJNÃBˆØİ[Y[™Ù][[Y[RY
š^˜\™ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Šš^˜\™ŠJNÃBˆØİ[Y[™Ù][[Y[RY
›İ\ˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Š›İ\ˆŠJNÃBˆØİ[Y[™Ù][[Y[RY
››İHŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\Š››İHŠJNÃBˆØİ[Y[™Ù][[Y[RY
İYÚŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆYX\šÙ\ŠİYÚŠJNÃBˆØİ[Y[™Ù][[Y[RY
š\İ\Ú\ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ü[’\İ\Ú\ÑX[ÙÊNÃBˆØİ[Y[™Ù][[Y[RY
œİÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆZÙTİÊ[
JNÃBˆØİ[Y[™Ù][[Y[RY
œİÈŠK˜Y]™[\İ[™\ŠœÚ[\™İÛˆ‹™\\™TİÔİÜ˜YÙJNÃBˆØİ[Y[™Ù][[Y[RY
œİ\İÑÜ›İ\ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ü[‘]šY[˜ÙTÙ]X[ÙÊNÃBˆØİ[Y[™Ù][[Y[RY
œİ\İÑÜ›İ\ŠK˜Y]™[\İ[™\ŠœÚ[\™İÛˆ‹™\\™TİÔİÜ˜YÙJNÃBˆØİ[Y[™Ù][[Y[RY
™š[š\Ú]šY[˜ÙTÙ]ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹š[š\ÚXİ]™Q]šY[˜ÙTÙ]
NÃBˆØİ[Y[™Ù][[Y[RY
˜Yİ™YHŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ü[”İ™YQX[ÙÊNÃBˆØİ[Y[™Ù][[Y[RY
™]šY[˜ÙTÙ]\HŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹ÚİÑ]šY[˜ÙTÙ]šY[ÊNÃBˆØİ[Y[™Ù][[Y[RY
™YUš\ÚXš[]HŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹™[™\•™YQ]šY[˜ÙT[ŠNÃBˆØİ[Y[™Ù][[Y[RY
™YT\œÜÙHŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹™[™\•™YQ]šY[˜ÙT[ŠNÃBˆØİ[Y[™Ù][[Y[RY
[X™\”İÚ^™HŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹™[™\•[X™\”İ˜Y]\ÊNÃBˆØİ[Y[™Ù][[Y[RY
[X™\”İİ\İÛPXÜ™\ÈŠK˜Y]™[\İ[™\Šš[œ]‹™[™\•[X™\”İ˜Y]\ÊNÃBˆØİ[Y[™Ù][[Y[RY
˜Ø[˜Ù[]šY[˜ÙTÙ]ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆØİ[Y[™Ù][[Y[RY
™]šY[˜ÙTÙ]X[ÙÈŠK˜ÛÜÙJ
JNÃBˆØİ[Y[™Ù][[Y[RY
˜Ü™X]Q]šY[˜ÙTÙ]ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ü™X]Q]šY[˜ÙTÙ]œ›ÛQX[ÙÊNÃBˆØİ[Y[™Ù][[Y[RY
˜ÛÛ[YQ]šY[˜ÙTÙ]ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÛÛ\]QÜ›İ\İĞÚÚXÙJ˜ÛÛ[YHŠJNÃBˆØİ[Y[™Ù][[Y[RY
™š[š\ÚY\‘Ü›İ\İÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÛÛ\]QÜ›İ\İĞÚÚXÙJ™š[š\ÚŠJNÃBˆØİ[Y[™Ù][[Y[RY
›™]ĞY\‘Ü›İ\İÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÛÛ\]QÜ›İ\İĞÚÚXÙJ›™]ÈŠJNÃBˆØİ[Y[™Ù][[Y[RY
œ™[[İ™Qœ›ÛQ]šY[˜ÙTÙ]ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÛÛ\]QÜ›İ\İĞÚÚXÙJœ™[[İ™HŠJNÃBˆØİ[Y[™Ù][[Y[RY
™Ü›İ\İÑX[ÙÈŠK˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØİ[Y[™Ù][[Y[RY
™Ü›İ\İÔ›ÛHŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹]™[OˆÃBˆØİ[Y[™Ù][[Y[RY
›XY”›İ™[˜[˜ÙSX™[ŠKšY[ˆHVÈ“XYˆ\\ˆİ\™˜XÙH‹“XYˆ[™\œÚYH—Kš[˜ÛY\Ê]™[\™Ù]˜[YJNÃBˆJNÃBˆØİ[Y[™Ù][[Y[RY
›YX\İ\™[Y[\HŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹\]SYX\İ\™[Y[šY[ÊNÃBˆØİ[Y[™Ù][[Y[RY
›YX\İ\™[Y[[š]ŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹]™[OˆÈØİ[Y[™Ù][[Y[RY
›YX\İ\™[Y[İ\•[š]X™[ŠKšY[ˆH]™[\™Ù]˜[YHOOH›İ\ˆÈJNÃBˆØİ[Y[™Ù][[Y[RY
œØ]™TİXİ\™YYX\İ\™[Y[ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ø]™TİXİ\™YYX\İ\™[Y[
NÃBˆØİ[Y[™Ù][[Y[RY
˜Ø[˜Ù[İXİ\™YYX\İ\™[Y[ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÃBˆÛÛœİİÒYH[™[™ÓYX\İ\™[Y[İÒYÃBˆİXİ\™YYX\İ\™[Y[X[ÙË˜ÛÜÙJ
NÈ[™[™ÓYX\İ\™[Y[İÒYH[ÃBˆÙ]İ]\Ê“YX\İ\™[Y[›İØ]™YˆÚ[™ÙHHYX\İ\š[™ËY]šXÙH[œİÙ\ˆÜˆ[\ˆH]]Üš]]]™H˜[YH™Y›Ü™HÛÛ[Z[™Ëˆ‹Ø\›š[™ÈŠNÃBˆYˆ
İÒY
HÜ[”İÓYX[š[™ÊİÒY
NÃBˆJNÃBˆİXİ\™YYX\İ\™[Y[X[ÙË˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØİ[Y[™Ù][[Y[RY
œØ]™Tİ™YHŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ø]™Tİ™YJNÃBˆØİ[Y[™Ù][[Y[RY
˜Ø[˜Ù[İ™YHŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÈ[™[™Ôİ™YRYH[Èİ™YQX[ÙË˜ÛÜÙJ
NÈJNÃBˆİ™YQX[ÙË˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØİ[Y[™Ù][[Y[RY
›[Ü™HŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÃBˆ[Ü™PØ]YÛÜšY\ËšY[ˆH[[Ü™PØ]YÛÜšY\ËšY[ÃBˆØİ[Y[™Ù][[Y[RY
›[Ü™HŠK^ÛÛ[H[Ü™PØ]YÛÜšY\ËšY[ˆÈ“[Ü™HØ]YÛÜšY\Èˆˆ’YHØ]YÛÜšY\ÈÃBˆJNÃBˆØİ[Y[™Ù][[Y[RY
œØ]™SØœÙ\˜][ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ø]™TİXİ\™YØœÙ\˜][ÛŠNÃBˆØİ[Y[™Ù][[Y[RY
˜Ø[˜Ù[ØœÙ\˜][ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÈXİ]™SØœÙ\˜][Û•\HH[ÈJNÃBˆØİ[Y[œ]Y\TÙ[XİÜ[
	Ú[œ]Û˜[YOHÙ]\—IÊK™›Ü‘XXÚ
[œ]Oˆ[œ]˜Y]™[\İ[™\Š˜Ú[™ÙH‹

HOˆÃBˆØİ[Y[™Ù][[Y[RY
Ù]^XİX™[ŠKšY[ˆHÙ[XİY˜Y[Õ˜[YJÙ]\ŠHOOH™^XİÃBˆJJNÃBˆ›ÚXÙP‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹ÙÙÛU›ÚXÙS›İJNÃBˆİÒ[œ]˜Y]™[\İ[™\Š˜Ú[™ÙH‹[™TİÑš[JNÃBˆØİ[Y[™Ù][[Y[RY
œİÜİÑ^[˜][ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÃBˆYˆ
YYXT™XÛÜ™\ˆ	‰ˆYYXT™XÛÜ™\‹œİ]HOOHœ™XÛÜ™[™ÈŠHÃBˆØİ[Y[™Ù][[Y[RY
œİÑ^[˜][Û”İ]HŠK^ÛÛ[H”Ø]š[™ÈH^[˜][Û¸ )ˆÃBˆYYXT™XÛÜ™\‹œİÜ

NÃBˆCBˆJNÃBˆİÑ^[˜][Û‘X[ÙË˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØ]\Û\ÜÚYšXØ][Û‘X[ÙË˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØİ[Y[™Ù][[Y[RY
œ™]TİÑ^[˜][ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÃBˆYˆ
[™[™ÔİÑ^[˜][Û’Y
H™YÚ[”İÑ^[˜][ÛŠ[™[™ÔİÑ^[˜][Û’Y
NÃBˆJNÃBˆØİ[Y[™Ù][[Y[RY
œÚÚ\İÑ^[˜][ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™\]Y\İİÑ^[˜][Û‘\ÜÜÚ][ÛŠœÚÚ\YŠJNÃBˆØİ[Y[™Ù][[Y[RY
›]\”İÑ^[˜][ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™\]Y\İİÑ^[˜][Û‘\ÜÜÚ][ÛŠ™^Z[—Û]\ˆŠJNÃBˆØİ[Y[™Ù][[Y[RY
œØ]™TİÓYX[š[™ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ\œÚ\İİÓYX[š[™Ê˜ÛÛ\]HŠJNÃBˆØİ[Y[™Ù][[Y[RY
œİÓYX[š[™Ó]\ˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ\œÚ\İİÓYX[š[™Ê™^Z[—Û]\ˆŠJNÃBˆİÓYX[š[™ÑX[ÙË˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØİ[Y[™Ù][[Y[RY
œİÔÚİÜÓYX\İ\š[™Ñ]šXÙHŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹]™[OˆÃBˆYˆ
]™[\™Ù]˜[YHOOH–Y\ÈŠHØİ[Y[™Ù][[Y[RY
œİÓYX[š[™ÓYX\İ\™[Y[ŠK˜[YHH”ØØ[Hš\ÚX›H[ˆİÙÜ˜\ÃBˆJNÃBˆÛÜœ™Xİ™XÛÜ™‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÜ[ÛÜœ™Xİ[Û‘X[ÙÊ
JNÃBˆ[™Ó\İ‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ü[•[™Ó\İ
NÃBˆØİ[Y[™Ù][[Y[RY
šÙY\\İXİ[ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÈ[™[™Õ[™Õ\™Ù]H[ÈØİ[Y[™Ù][[Y[RY
[™ÑX[ÙÈŠK˜ÛÜÙJ
NÈJNÃBˆØİ[Y[™Ù][[Y[RY
˜ÛÛ™š\›U[™Ó\İŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹ÛÛ™š\›U[™Ó\İ
NÃBˆØİ[Y[™Ù][[Y[RY
[™ÑX[ÙÈŠK˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØİ[Y[™Ù][[Y[RY
˜Ø[˜Ù[ÛÜœ™Xİ[ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÛÜœ™Xİ[Û‘X[ÙË˜ÛÜÙJ
JNÃBˆØİ[Y[™Ù][[Y[RY
œØ]™PÛÜœ™Xİ[ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ø]™T\›X[™[ÛÜœ™Xİ[ÛŠNÃBˆÛÜœ™Xİ[Û‘X[ÙË˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØİ[Y[™Ù][[Y[RY
˜Ø[˜Ù[\İ\Ú\ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ\İ\Ú\ÑX[ÙË˜ÛÜÙJ
JNÃBˆØİ[Y[™Ù][[Y[RY
œØ]™R\İ\Ú\ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ø]™R[œÜXİÜ’\İ\Ú\ÊNÃBˆ\İ\Ú\ÑX[ÙË˜Y]™[\İ[™\Š˜Ø[˜Ù[‹]™[Oˆ]™[œ™]™[Y˜][

JNÃBˆØİ[Y[œ]Y\TÙ[XİÜ[
–Ù]K]Ø]\‹XÚÚXÙWHŠK™›Ü‘XXÚ
]ÛˆOˆ]Û‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÚÛÜÙUØ]\•\J]Û‹™]\Ù]Ø]\ÚÚXÙJJJNÃBˆØİ[Y[™Ù][[Y[RY
œØ]™UØ]\Û\ÜÚYšXØ][ÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ø]™PÛÛ™š\›YYØ]\Û\ÜÚYšXØ][ÛŠNÃBˆØİ[Y[™Ù][[Y[RY
œİÕØ]\‘\ŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹]™[OˆÃBˆØİ[Y[™Ù][[Y[RY
œİÕØ]\‘^XİX™[ŠKšY[ˆH]™[\™Ù]˜[YHOOH™^XİÃBˆJNÃBˆØİ[Y[™Ù][[Y[RY
˜ÛÜÙUØ]\”İÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆØ]\”İÑX[ÙË˜ÛÜÙJ
JNÃBˆØİ[Y[œ]Y\TÙ[XİÜ[
–Ù]K]Ø]\‹[^Y\—HŠK™›Ü‘XXÚ
ÛÛ›ÛOˆÛÛ›Û˜Y]™[\İ[™\Š˜Ú[™ÙH‹™[™\”ÛX[˜XİØ]\“X\
JNÃBˆØİ[Y[™Ù][[Y[RY
˜[Ø]\”İÙÜ˜\YŠK˜Y]™[\İ[™\Š˜Ú[™ÙH‹]™[OˆÃBˆ]KØ]\—ÛØœÙ\˜][Û—Ü[HHÃBˆ[ÛØœÙ\™YÜİ[™[™×İØ]\—ÜİÙÜ˜\Yˆ]™[\™Ù]˜ÚXÚÙYBˆÛÛ™š\›YYØ]ˆ]™[\™Ù]˜ÚXÚÙYÈ™]È]J
KÒTÓÔİš[™Ê
Hˆ[BˆØÛÜNˆØ[ÙYØ[™İš\İX[WÛØœÙ\™YØÛÜœšYÜ—Ø]Ú[œÜXİ[Û—İ[YHƒBˆNÃBˆØ]™Tİ]J
NÃBˆ™Y˜]Ê
NÃBˆÙ]İ]\Ê]™[\™Ù]˜ÚXÚÙYÈ‘šY[[HØ]™YˆÚ][ˆHØ[ÙY[™š\İX[HØœÙ\™YÛÜœšYÜ‹[œİÙÜ˜\YØØ][ÛœÈX^Hİ\Ü8 &›Èİ[™[™ÈØ]\ˆØœÙ\™Y][œÜXİ[Ûˆ[YK¸ &Hˆˆ‘šY[[H™[[İ™YˆH™\ÜÚ[›İ[™™\ˆ[œÜXİYHÜ›İ[™œ›ÛHZ\ÜÚ[™ÈØ]\ˆİÙÜ˜\Ëˆ‹˜Xİ]™HŠNÃBˆJNÃBˆÚ\™TXÚØYÙP‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹Ú\™S\İXÚØYÙJNÃBˆÛX\‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹ÛX\’[œÜXİ[ÛŠNÃBˆØİ[Y[™Ù][[Y[RY
˜˜XÚİ\ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹^Ü˜XÚİ\›İÊNÃBˆ[\˜Ú]™P‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹^Ü˜XÚİ\›İÊNÃBˆ™]T[™[™ÔİĞ‹˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™]T[™[™ÔİÜÊ
JNÃBˆØİ[Y[™Ù][[Y[RY
™Ø[\T™]š[İ\ÈŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÈØ[\TYÙHHX]›X^
Ø[\TYÙHHJNÈ™[™\‘Ø[\J
NÈJNÃBˆØİ[Y[™Ù][[Y[RY
™Ø[\S™^ŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆÈØ[\TYÙH
ÏHNÈ™[™\‘Ø[\J
NÈJNÃBˆØš™XİšÙ^\ÊÛÛ™][Ûš[™[™ÜÊK™›Ü‘XXÚ
YOˆÃBˆÛÛœİ[[Y[HØİ[Y[™Ù][[Y[RY
Y
NÃBˆ[[Y[˜Y]™[\İ[™\Š˜Ú[™ÙH‹Ø]™PÛÛ™][ÛœÑœ›ÛUZJNÃBˆ[[Y[˜Y]™[\İ[™\Š˜›\ˆ‹Ø]™PÛÛ™][ÛœÑœ›ÛUZJNÃBˆJNÃBˆØš™XİšÙ^\ÊÙX]\ÛÛ^š[™[™ÜÊK™›Ü‘XXÚ
YOˆÃBˆÛÛœİ[[Y[HØİ[Y[™Ù][[Y[RY
Y
NÃBˆ[[Y[˜Y]™[\İ[™\Š˜Ú[™ÙH‹Ø]™PÛÛ™][ÛœÑœ›ÛUZJNÃBˆ[[Y[˜Y]™[\İ[™\Š˜›\ˆ‹Ø]™PÛÛ™][ÛœÑœ›ÛUZJNÃBˆJNÃBˆØİ[Y[™Ù][[Y[RY
œ™Yœ™\Ú]]Üš]]]™UÙX]\ˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆ™Yœ™\Ú]]Üš]]]™UÙX]\Š
JNÃBˆØİ[Y[™Ù][[Y[RY
˜ÜİˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆİÛ›ØY^
”X\œÛÛ—Ô›ØYÑšY[Õ˜XÚË˜Üİˆ‹^ØÜİˆ‹XÚØYÙUÛÛË˜Ü™X]PÜİŠ]K×JJJNÃBˆØİ[Y[™Ù][[Y[RY
™Ù[ÚœÛÛˆŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆİÛ›ØY^
”X\œÛÛ—Ô›ØYÑšY[Õ˜XÚË™Ù[ÚœÛÛˆ‹˜\XØ][Û‹ÙÙ[ÊÚœÛÛˆ‹XÚØYÙUÛÛË˜Ü™X]QÙ[Ò”ÓÓŠ]K×JJJNÃBˆØİ[Y[™Ù][[Y[RY
™ÜŠK˜Y]™[\İ[™\Š˜ÛXÚÈ‹

HOˆİÛ›ØY^
”X\œÛÛ—Ô›ØYÑšY[Õ˜XÚË™Ü‹˜\XØ][Û‹ÙÜ
Ş[‹XÚØYÙUÛÛË˜Ü™X]QÜ
]K×JJJNÃBˆØİ[Y[™Ù][[Y[RY
˜ÛÛİ\“ÜXÚ]HŠK˜Y]™[\İ[™\Šš[œ]‹]™[OˆÈØİ[Y[™Ù][[Y[RY
˜ÛÛİ\œÈŠKœİ[K›ÜXÚ]HH]™[\™Ù]˜[YNÈJNÃBˆØİ[Y[™Ù][[Y[RY
\œ˜Z[“ÜXÚ]HŠK˜Y]™[\İ[™\Šš[œ]‹]™[OˆÈØİ[Y[™Ù][[Y[RY
š[ÚYHŠKœİ[K›ÜXÚ]HH]™[\™Ù]˜[YNÈJNÃBˆÙØİ[Y[™Ù][[Y[RY
š[ÚYHŠKØİ[Y[™Ù][[Y[RY
˜ÛÛİ\œÈŠWK™›Ü‘XXÚ
[XYÙHOˆ[XYÙK˜Y]™[\İ[™\Š™\œ›Üˆ‹

HOˆÃBˆ[XYÙKšY[ˆHYNÃBˆÙ]İ]\ÊH˜XÚÙÜ›İ[™X\[XYÙH\È[˜]˜Z[X›KˆÔËØœÙ\˜][ÛœËİÜË[™›İ\Èİ[ÛÜšÎÈÛÛ[YH\Ú[™ÈH\˜Ù[[™›İ]Hİ™\›^Kˆ‹Ø\›š[™ÈŠNÃBˆJJNÃBˆØİ[Y[˜Y]™[\İ[™\Šš\ÚXš[]XÚ[™ÙH‹

HOˆÃBˆYˆ
Øİ[Y[š\ÚXš[]Tİ]HOOHš\ÚX›HŠHÃBˆYˆ
Ø]ÚYOOH[	‰ˆ]ØZÙSØÚÊHÙY\]ØZÙJ
NÃBˆYˆ
]Kœİ\Y	‰ˆY]KœİÜY	‰ˆØ]ÚYOOH[
Hİ\˜XÚÚ[™Ê
NÃBˆ™\\™TİÔİÜ˜YÙJ
NÃBˆCBˆJNÃBˆÚ[™İË˜Y]™[\İ[™\Š˜™Y›Ü™][›ØY‹]™[OˆÃBˆYˆ
İĞ\ŞHXÚØYÙP\ŞJHÃBˆ]™[œ™]™[Y˜][

NÃBˆ]™[œ™]\›•˜[YHHˆÃBˆCBˆJNÃBˆÙ][\˜[
\]U[YSY]šXÜËÌ
NÃBƒBˆ[š]X[^™J
NÃBŸJJ
NÃB