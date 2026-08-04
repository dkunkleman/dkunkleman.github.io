(function () {
  "use strict";

  const APP_VERSION = "3.16.3";
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
  const synthesisTools = window.ReviewedPropertySynthesis;
  const weatherTools = window.AuthoritativeWeather;
  const valueTools = window.PropertyValueEngine;
  const fieldTruthTools = window.FieldTruthEngine;
  const missionTools = window.GuidedMissionOrchestrator;
  const treeIdentificationTools = window.TreeIdentificationEngine;
  const fieldCoachTools = window.FieldCaptureCoach;
  const measurementTools = window.FieldMeasurementEngine;
  const treeNetworkTools = window.TreeNetworkEngine;
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
  const copyPackageFilenameBtn = document.getElementById("copyPackageFilename");
  const returnFromPackageBtn = document.getElementById("returnFromPackage");
  const recoveryHome = document.getElementById("recoveryHome");
  const recoverySendBtn = document.getElementById("recoverySend");
  const recoveryFullBtn = document.getElementById("recoveryFull");
  const recoveryProgress = document.getElementById("recoveryProgress");
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
  const featureCaptureDialog = document.getElementById("featureCaptureDialog");
  const inspectionMissionDialog = document.getElementById("inspectionMissionDialog");
  const missionProgressButton = document.getElementById("missionProgressButton");
  const correctRecordBtn = document.getElementById("correctRecord");
  const undoLastBtn = document.getElementById("undoLast");
  const markerButtons = ["wet", "dry", "blocked", "high", "homesite", "culvert", "tree", "entrance", "wildlife", "thick", "open", "ditch", "timber", "hazard", "soilProbe", "utility", "boundary", "sensory", "other", "note", "thought", "hypothesis", "photo", "startPhotoGroup", "voice", "more"].map(id => document.getElementById(id));
  const buttonLabels = {
    wet: "Wet", dry: "Dry", blocked: "Blocked Access", high: "High Ground", homesite: "Potential Homesite",
    culvert: "Culvert", tree: "Tree", entrance: "Road or Entrance", wildlife: "Wildlife",
    thick: "Thick Brush", open: "Open Area", ditch: "Ditch", timber: "Timber Sample",
    hazard: "Hazard", soilProbe: "Soil Probe", utility: "Utility or Infrastructure", boundary: "Boundary Evidence", sensory: "Sensory or Marketability", other: "Other",
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
  let activeFeatureSessionId = null;
  let routeDisplayCache = { key: "", model: null };

  function emptyInspection() {
    return {
      schema_name: "property-intelligence-inspection",
      schema_version: "1.3",
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
      active_value_driver_ids: [],
      active_value_effects: [],
      active_value_effect: "",
      active_value_magnitude: 3,
      active_value_confidence: "medium",
      active_value_reason: "",
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
    if (recoveryHome && !recoveryHome.hidden) recoveryProgress.textContent = message;
    updateNextStep();
  }

  function updateNextStep() {
    if (pendingPhotoQueue.length) {
      nextStep.textContent = "NEXT: Tap Retry Pending Photo. Keep this page open.";
    } else if (data.active_feature_session_id && fieldTruthTools) {
      const active = fieldTruthTools.activeSession(data);
      nextStep.textContent = `NEXT: Finish or safely defer ${active ? active.feature_label : "the active Feature Capture Session"}.`;
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
      nextStep.textContent = "NEXT: Tap SEND THIS INSPECTION TO CHATGPT. Unfinished answers will remain marked incomplete; no evidence will be deleted.";
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

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
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
    if (valueTools) valueTools.ensureInspectionModel(data);
    if (fieldTruthTools) fieldTruthTools.ensureInspectionModel(data);
    if (missionTools) missionTools.ensureModel(data);
    if (treeIdentificationTools) treeIdentificationTools.ensureModel(data);
    if (fieldCoachTools) fieldCoachTools.ensureModel(data);
    if (measurementTools) measurementTools.ensureModel(data);
    if (treeNetworkTools) treeNetworkTools.ensureModel(data);
    if (governanceTools) governanceTools.ensureGovernanceModel(data);
    if (evidenceSetTools) {
      evidenceSetTools.ensureEvidenceSetModel(data);
      evidenceSetTools.addPearsonSuggestions(data);
    }
    if (timberTools) timberTools.ensureModel(data);
    if (synthesisTools) synthesisTools.ensureModel(data);
  }

  function sa÷}ôöÚ$z{-®éÜj×–B‚'F–Ö&W%Æ÷D7W7FöÔ7&W2"’æFDWfVçDÆ—7FVæW"‚&–çWB"Â&VæFW%F–Ö&W%Æ÷E&F—W2“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÄWf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFö7VÖVçBævWDVÆVÖVçD'”–B‚&Wf–FVæ6U6WDF–Æör"’æ6Æ÷6R‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&7&VFTWf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â7&VFTWf–FVæ6U6WDg&öÔF–Æör“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF–çVTWf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6ö×ÆWFTw&÷W†÷Fô6†ö–6R‚&6öçF–çVR"’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&f–æ—6„gFW$w&÷W†÷Fò"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6ö×ÆWFTw&÷W†÷Fô6†ö–6R‚&f–æ—6‚"’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&æWtgFW$w&÷W†÷Fò"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6ö×ÆWFTw&÷W†÷Fô6†ö–6R‚&æWr"’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'&VÖ÷fTg&öÔWf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6ö×ÆWFTw&÷W†÷Fô6†ö–6R‚'&VÖ÷fR"’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&w&÷W†÷FôF–Æör"’æFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&w&÷W†÷Fõ&öÆR"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÆVe&÷fVææ6TÆ&VÂ"’æ†–FFVâÒ²$ÆVbWW"7W&f6R"Â$ÆVbVæFW'6–FR%Òæ–æ6ÇVFW2†WfVçBçF&vWBçfÇVR“°Ð¢Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÖV7W&VÖVçEG—R"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWFFTÖV7W&VÖVçDf–VÆG2“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÖV7W&VÖVçEVæ—B"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ²Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÖV7W&VÖVçD÷F†W%Væ—DÆ&VÂ"’æ†–FFVâÒWfVçBçF&vWBçfÇVRÓÒ&÷F†W"#²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fU7G'V7GW&VDÖV7W&VÖVçB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fU7G'V7GW&VDÖV7W&VÖVçB“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÅ7G'V7GW&VDÖV7W&VÖVçB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ð¢6öç7B†÷Fô–BÒVæF–ætÖV7W&VÖVçE†÷Fô–C°Ð¢7G'V7GW&VDÖV7W&VÖVçDF–Æöræ6Æ÷6R‚“²VæF–ætÖV7W&VÖVçE†÷Fô–BÒçVÆÃ°Ð¢6WE7FGW2‚$ÖV7W&VÖVçBæ÷B6fVBâ6†ævRF†RÖV7W&–ærÖFWf–6Rç7vW"÷"VçFW"F†RWF†÷&—FF—fRfÇVR&Vf÷&R6öçF–çV–ærâ"Â'v&æ–ær"“°Ð¢–b‡†÷Fô–B’÷Vå†÷FôÖVæ–ær‡†÷Fô–B“°Ð¢Ò“°Ð¢7G'V7GW&VDÖV7W&VÖVçDF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fUÆ÷EG&VR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fUÆ÷EG&VR“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÅÆ÷EG&VR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²VæF–æuÆ÷EG&VT–BÒçVÆÃ²Æ÷EG&VTF–Æöræ6Æ÷6R‚“²Ò“°Ð¢Æ÷EG&VTF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&Ö÷&R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ð¢Ö÷&T6FVv÷&–W2æ†–FFVâÒÖ÷&T6FVv÷&–W2æ†–FFVã°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&Ö÷&R"’çFW‡D6öçFVçBÒÖ÷&T6FVv÷&–W2æ†–FFVâò$Ö÷&R6FVv÷&–W2"¢$†–FR6FVv÷&–W2#°Ð¢Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fTö'6W'fF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fU7G'V7GW&VDö'6W'fF–öâ“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÄö'6W'fF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²7F—fTö'6W'fF–öåG—RÒçVÆÃ²Ò“°Ð¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚v–çWE¶æÖSÒ'vWDFWF‚%Òr’æf÷$V6‚†–çWBÓâ–çWBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'vWDW†7DÆ&VÂ"’æ†–FFVâÒ6VÆV7FVE&F–õfÇVR‚'vWDFWF‚"’ÓÒ&W†7B#°Ð¢Ò’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&fVGW&TvVöÖWG'”&6—2"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWFFTfVGW&U6W76–öävVöÖWG'’“°Ð¢²&fVGW&Töfg6WD&V&–ær"Â&fVGW&Töfg6WDF—7Fæ6R"Â&fVGW&Töfg6WDÖWF†öB"Â&fVGW&Töfg6WDÆ–Ö—FF–öâ%Òæf÷$V6‚†–BÓâFö7VÖVçBævWDVÆVÖVçD'”–B†–B’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWFFTfVGW&U6W76–öävVöÖWG'’’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&fVGW&Tæ÷FR"’æFDWfVçDÆ—7FVæW"‚&–çWB"Â6fTfVGW&TG&gB“°Ð¢²'G&VU&V6÷&EG—R"Â'G&VU†÷Fõ&öÆR"Â'G&VTÖFW&–Ä76ö6–F–öâ"Â'G&VT÷fW&Æ”wV–Fæ6R"Â'G&VTÖV7W&VÖVçDÖöFR"Â'G&VT6—&7VÖfW&Væ6R"Â'G&VT6—&7VÖfW&Væ6UVæ—B"Â'G&VT6—&7VÖfW&Væ6UFööÂ"Â'G&VT6—&7VÖfW&Væ6T6Æ72"Â'G&VTÖV7W&VÖVçD†V–v‡B"Â'G&VTÖV7W&VÖVçD†V–v‡EVæ—B"Â'G&VTÖV7W&VÖVçD†V–v‡D&6—2"Â'G&VU7FVÔ–B"Â'G&VTf÷&´&VÆ÷r"Â'G&VT÷fW&ÆÄÆVb"Â'G&VTÆVe7G'V7GW&R"Â'G&VTÆVd'&ævVÖVçB"Â'G&VT&&µFW‡GW&R"Â'G&VTæöç7FæF&E&V6öâ"Â'FT6†V6µ&VfW&Væ6R"Â'FT6†V6µ&VF–ær"Â'FT6†V6µVæ—B"Â'G&VUVWVTæÇ—6—2"Â'–&G7F–6µvFW$FWF‚"Â'–&G7F–6µvFW%Væ—B"Â'–&G7F–6´&÷GFöÒ"Â'–&G7F–6µVæWG&F–öâ"Â'–&G7F–6µ&öÆR"Â'–&G7F–6´6Æ72"Â'–&G7F–6´æ÷FR"Â&6æF–FFUG—R"Â&6æF–FFTÆVæwF‚"Â&6æF–FFUv–GF‚"Â&6æF–FFUVæ—B"Â&6æF–FFTÖWF†öB"Â&6æF–FFU†÷FôF—&V7F–öâ%Òæf÷$V6‚†–BÓâ²6öç7BVÆVÖVçBÒFö7VÖVçBævWDVÆVÖVçD'”–B†–B“²VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â6fTfVGW&TG&gB“²–b…²$”åUB"Â%DU…D$T%Òæ–æ6ÇVFW2†VÆVÖVçBçFtæÖR’’VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&–çWB"Â6fTfVGW&TG&gB“²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&f–VÆD6GW&TÖöFR"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ²–b†f–VÆD6ö6…FööÇ2’f–VÆD6ö6…FööÇ2ç6WDÖöFR†FFÂWfVçBçF&vWBçfÇVRÂ7F—fTfVGW&U6W76–öä–B“²6fU7FFR‚“²6öç7B6W76–öâÒf–VÆEG'WF…FööÇ2ç6W76–öä'”–B†FFÂ7F—fTfVGW&U6W76–öä–B“²–b‡6W76–öâ’&VæFW$fVGW&Tf–VÆG2‡6W76–öâ“²6WE7FGW2†G¶WfVçBçF&vWBæ÷F–öç5¶WfVçBçF&vWBç6VÆV7FVD–æFW…ÒçFW‡GÒ6VÆV7FVBâWf–FVæ6R&WV—&VÖVçG2æB6fWG’Æ–Ö—G2&RVæ6†ævVBæÂ&7F—fR"“²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&fVGW&U7GV6²"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â&V6÷&DfVGW&T†VÇ“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&fVGW&U7v—F6‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6fTfVGW&U6W76–öâ‚&FVfW""’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VU†÷Fõ&öÆR"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ²Fö7VÖVçBævWDVÆVÖVçD'”–B‚&fVGW&U†÷Fõ&öÆR"’çfÇVRÒWfVçBçF&vWBçfÇVS²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VTWf–FVæ6UVæf–Æ&ÆR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²6öç7BG&VRÒ7F—fUG&VU6W76–öâ‚“²–b‚G&VR’&WGW&ã²6öç7B&öÆRÒFö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VU†÷Fõ&öÆR"’çfÇVS²6öç7B&V6öâÒ&ö×B‚%v‡’—2F†—2f–WrVæf–Æ&ÆSòFöò†–v‚ÂæòÆVfW2&W6VçBÂVç6fRÂFVç6RfVvWFF–öâÂö÷"Æ–v‡F–ærÂfVGW&R'6VçBÂG&VRFVBÂWV—ÖVçBVæf–Æ&ÆRÂ÷F†W"Â÷"Væ¶æ÷vâ"Â$FVç6RfVvWFF–öâ"’ÇÂ%Væ¶æ÷vâ#²G'’²G&VT–FVçF–f–6F–öåFööÇ2æÖ&´Wf–FVæ6UVæf–Æ&ÆR†FFÂG&VRçG&VUö–FVçF–f–6F–öå÷6W76–öåö–BÂ&öÆRÂ&V6öâÂFö7VÖVçBævWDVÆVÖVçD'”–B‚&fVGW&Tæ÷FR"’çfÇVRçG&–Ò‚’“²6fU7FFR‚“²&VæFW%7V6–Æ—¦VDfVGW&UæVÂ†f–VÆEG'WF…FööÇ2ç6W76–öä'”–B†FFÂ7F—fTfVGW&U6W76–öä–B’“²Ò6F6‚†W'&÷"’²6WE7FGW2†W'&÷"æÖW76vRÂ&W'&÷""“²ÒÒ“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&÷VåG&VTæWGv÷&²"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â÷VåG&VTæWGv÷&´F–Æör“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'FövvÆT6æF–FFUW&–ÖWFW""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂFövvÆT6æF–FFUW&–ÖWFW"“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æF–FFU†÷FôF—&V7F–öâ"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ²6öç7B&öÆW2ÒFö7VÖVçBævWDVÆVÖVçD'”–B‚&fVGW&U†÷Fõ&öÆR"“²–b‚²ââç&öÆW2æ÷F–öç5Òç6öÖR†÷F–öâÓâ÷F–öâçfÇVRÓÓÒWfVçBçF&vWBçfÇVR’’²6öç7B÷F–öâÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&÷F–öâ"“²÷F–öâçfÇVRÒWfVçBçF&vWBçfÇVS²÷F–öâçFW‡D6öçFVçBÒWfVçBçF&vWBçfÇVS²&öÆW2æVæD6†–ÆB†÷F–öâ“²Ò&öÆW2çfÇVRÒWfVçBçF&vWBçfÇVS²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6Æ÷6UG&VTæWGv÷&²"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VTæWGv÷&´F–Æör"’æ6Æ÷6R‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fUG&VTF—7Fæ6R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fUG&VTæWGv÷&´F—7Fæ6R“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VTæWGv÷&´F–Æör"’æFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâ²WfVçBç&WfVçDFVfVÇB‚“²Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VTæWGv÷&´F–Æör"’æ6Æ÷6R‚“²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fTÖ–æ–×VÔfVGW&R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6fTfVGW&U6W76–öâ‚&Ö–æ–×VÒ"’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6ö×ÆWFTfVGW&R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6fTfVGW&U6W76–öâ‚&6ö×ÆWFR"’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&FVfW$fVGW&R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6fTfVGW&U6W76–öâ‚&FVfW""’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'&W7VÖTfVGW&U6W76–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²6öç7B6W76–öâÒf–VÆEG'WF…FööÇ2æ7F—fU6W76–öâ†FF“²–b‡6W76–öâ’6†÷tfVGW&U6W76–öâ‡6W76–öâ“²Ò“°Ð¢fVGW&T6GW&TF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâ²WfVçBç&WfVçDFVfVÇB‚“²6WE7FGW2‚%W6R6fRÖ–æ–×VÒ&V6÷&B÷"f–æ—6‚FWF–Ç2GW&–ær&Wf–Wr6òF†R6GW&VBf–VÆB÷6—F–öâ&VÖ–ç2&V6÷fW&&ÆRâ"Â'v&æ–ær"“²Ò“°Ð¢fö–6T'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂFövvÆUfö–6Tæ÷FR“°Ð¢†÷Fô–çWBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â†æFÆU†÷Fôf–ÆR“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'7F÷†÷FôW‡ÆæF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ð¢–b†ÖVF–&V6÷&FW"bbÖVF–&V6÷&FW"ç7FFRÓÓÒ'&V6÷&F–ær"’°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FôW‡ÆæF–öå7FFR"’çFW‡D6öçFVçBÒ%6f–ærF†RW‡ÆæF–öî(
b#°Ð¢ÖVF–&V6÷&FW"ç7F÷‚“°Ð¢ÐÐ¢Ò“°Ð¢†÷FôW‡ÆæF–öäF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢vFW$6Æ76–f–6F–öäF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'&WG'•†÷FôW‡ÆæF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ð¢–b‡VæF–æu†÷FôW‡ÆæF–öä–B’&Vv–å†÷FôW‡ÆæF–öâ‡VæF–æu†÷FôW‡ÆæF–öä–B“°Ð¢Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6¶—†÷FôW‡ÆæF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ&WVW7E†÷FôW‡ÆæF–öäF—7÷6—F–öâ‚'6¶—VB"’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÆFW%†÷FôW‡ÆæF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ&WVW7E†÷FôW‡ÆæF–öäF—7÷6—F–öâ‚&W‡Æ–åöÆFW""’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fU†÷FôÖVæ–ær"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâW'6—7E†÷FôÖVæ–ær‚&6ö×ÆWFR"’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FôÖVæ–ætÆFW""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâW'6—7E†÷FôÖVæ–ær‚&W‡Æ–åöÆFW""’“°Ð¢†÷FôÖVæ–ætF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷Fõ6†÷w4ÖV7W&–ætFWf–6R"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ°Ð¢–b†WfVçBçF&vWBçfÇVRÓÓÒ%–W2"’Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FôÖVæ–ætÖV7W&VÖVçB"’çfÇVRÒ%66ÆRf—6–&ÆR–â†÷Föw&‚#°Ð¢Ò“°Ð¢6÷'&V7E&V6÷&D'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ÷Vä6÷'&V7F–öäF–Æör‚’“°Ð¢VæFôÆ7D'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â÷VåVæFôÆ7B“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&¶VWÆ7D7F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²VæF–æuVæFõF&vWBÒçVÆÃ²Fö7VÖVçBævWDVÆVÖVçD'”–B‚'VæFôF–Æör"’æ6Æ÷6R‚“²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öæf—&ÕVæFôÆ7B"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6öæf—&ÕVæFôÆ7B“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'VæFôF–Æör"’æFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÄ6÷'&V7F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6÷'&V7F–öäF–Æöræ6Æ÷6R‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fT6÷'&V7F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fUW&ÖæVçD6÷'&V7F–öâ“°Ð¢6÷'&V7F–öäF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÄ‡—÷F†W6—2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ‡—÷F†W6—4F–Æöræ6Æ÷6R‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fT‡—÷F†W6—2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fT–ç7V7F÷$‡—÷F†W6—2“°Ð¢‡—÷F†W6—4F–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°Ð¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×vFW"Ö6†ö–6UÒ"’æf÷$V6‚†'WGFöâÓâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6†ö÷6UvFW%G—R†'WGFöâæFF6WBçvFW$6†ö–6R’’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fUvFW$6Æ76–f–6F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fT6öæf—&ÖVEvFW$6Æ76–f–6F–öâ“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FõvFW$FWF‚"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FõvFW$W†7DÆ&VÂ"’æ†–FFVâÒWfVçBçF&vWBçfÇVRÓÒ&W†7B#°Ð¢Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6Æ÷6UvFW%†÷Fò"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâvFW%†÷FôF–Æöræ6Æ÷6R‚’“°Ð¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×vFW"ÖÆ–W%Ò"’æf÷$V6‚†6öçG&öÂÓâ6öçG&öÂæFDWfVçDÆ—7FVæW"‚&6†ævR"Â&VæFW%6ÖÆÅG&7EvFW$Ö’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÆÅvFW%†÷Föw&†VB"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ°Ð¢FFçvFW%öö'6W'fF–öå÷'VÆRÒ°Ð¢ÆÅöö'6W'fVE÷7FæF–æu÷vFW%÷†÷Föw&†VC¢WfVçBçF&vWBæ6†V6¶VBÀÐ¢6öæf—&ÖVEöC¢WfVçBçF&vWBæ6†V6¶VBòæWrFFR‚’çFô•4õ7G&–ær‚’¢çVÆÂÀÐ¢66÷S¢'vÆ¶VEöæE÷f—7VÆÇ•öö'6W'fVEö6÷'&–F÷%öEö–ç7V7F–öå÷F–ÖR Ð¢Ó°Ð¢6fU7FFR‚“°Ð¢&VG&r‚“°Ð¢6WE7FGW2†WfVçBçF&vWBæ6†V6¶VBò$f–VÆB'VÆR6fVC¢v—F†–âF†RvÆ¶VBæBf—7VÆÇ’ö'6W'fVB6÷'&–F÷"ÂVç†÷Föw&†VBÆö6F–öç2Ö’7W÷'B(	†æò7FæF–ærvFW"ö'6W'fVBB–ç7V7F–öâF–ÖRî(	’"¢$f–VÆB'VÆR&VÖ÷fVBâF†R&W÷'Bv–ÆÂæ÷B–æfW"–ç7V7FVBG'’w&÷VæBg&öÒÖ—76–ærvFW"†÷Föw&‡2â"Â&7F—fR"“°Ð¢Ò“°Ð¢6†&U6¶vT'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6†&TÆ7E6¶vR“°¢6÷•6¶vTf–ÆVæÖT'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â7–æ2‚’Óâ°¢G'’°¢v—Bæf–vF÷"æ6Æ—&ö&Bçw&—FUFW‡B‡6¶vTf–ÆVæÖRçFW‡D6öçFVçBÇÂ""“°¢6WE7FGW2‚$f–ÆVæÖR6÷–VBâ"Â'7V66W72"“°¢Ò6F6‚†W'&÷"’°¢6WE7FGW2‚$6÷VÆBæ÷B6÷’F†Rf–ÆVæÖRâ—B&VÖ–ç2f—6–&ÆRöâF†R6¶vR67&VVââ"Â'v&æ–ær"“°¢Ð¢Ò“°¢&WGW&äg&öÕ6¶vT'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°¢6¶vU&VG’æ†–FFVâÒG'VS°¢WFFTæW‡E7FW‚“°¢Ò“°¢6ÆV$'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6ÆV$–ç7V7F–öâ“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&6·W"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂW‡÷'D&6·Wæ÷r“°Ð¢gVÆÄ&6†—fT'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂW‡÷'D&6·Wæ÷r“°Ð¢&WG'•VæF–æu†÷Fô'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ&WG'•VæF–æu†÷F÷2‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÆÆW'•&Wf–÷W2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²vÆÆW'•vRÒÖF‚æÖ‚ƒÂvÆÆW'•vRÒ“²&VæFW$vÆÆW'’‚“²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÆÆW'”æW‡B"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²vÆÆW'•vR³Ò²&VæFW$vÆÆW'’‚“²Ò“°Ð¢ö&¦V7Bæ¶W—2†6öæF—F–öä&–æF–æw2’æf÷$V6‚†–BÓâ°Ð¢6öç7BVÆVÖVçBÒFö7VÖVçBævWDVÆVÖVçD'”–B†–B“°Ð¢VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â6fT6öæF—F–öç4g&öÕV’“°Ð¢VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&&ÇW""Â6fT6öæF—F–öç4g&öÕV’“°Ð¢Ò“°Ð¢ö&¦V7Bæ¶W—2‡vVF†W$6öçFW‡D&–æF–æw2’æf÷$V6‚†–BÓâ°Ð¢6öç7BVÆVÖVçBÒFö7VÖVçBævWDVÆVÖVçD'”–B†–B“°Ð¢VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â6fT6öæF—F–öç4g&öÕV’“°Ð¢VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&&ÇW""Â6fT6öæF—F–öç4g&öÕV’“°Ð¢Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'&Vg&W6„WF†÷&—FF—fUvVF†W""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ&Vg&W6„WF†÷&—FF—fUvVF†W"‚’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&77b"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâF÷væÆöEFW‡B‚%V'6öåõ&öEôf–VÆEõG&6²æ77b"Â'FW‡Bö77b"Â6¶vUFööÇ2æ7&VFT77b†FFÂµÒ’’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vVö§6öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâF÷væÆöEFW‡B‚%V'6öåõ&öEôf–VÆEõG&6²ævVö§6öâ"Â&Æ–6F–öâövVò¶§6öâ"Â6¶vUFööÇ2æ7&VFTvVô¥4ôâ†FFÂµÒ’’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&w‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâF÷væÆöEFW‡B‚%V'6öåõ&öEôf–VÆEõG&6²æw‚"Â&Æ–6F–öâöw‚·†ÖÂ"Â6¶vUFööÇ2æ7&VFTw‚†FFÂµÒ’’“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF÷W$÷6—G’"’æFDWfVçDÆ—7FVæW"‚&–çWB"ÂWfVçBÓâ²Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF÷W'2"’ç7G–ÆRæ÷6—G’ÒWfVçBçF&vWBçfÇVS²Ò“°Ð¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'FW'&–ä÷6—G’"’æFDWfVçDÆ—7FVæW"‚&–çWB"ÂWfVçBÓâ²Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†–ÆÇ6†FR"’ç7G–ÆRæ÷6—G’ÒWfVçBçF&vWBçfÇVS²Ò“°Ð¢¶Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†–ÆÇ6†FR"’ÂFö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF÷W'2"•Òæf÷$V6‚†–ÖvRÓâ–ÖvRæFDWfVçDÆ—7FVæW"‚&W'&÷""Â‚’Óâ°Ð¢–ÖvRæ†–FFVâÒG'VS°Ð¢6WE7FGW2‚$&6¶w&÷VæBÖ–ÖvR—2Væf–Æ&ÆRâu2Âö'6W'fF–öç2Â†÷F÷2ÂæBæ÷FW27F–ÆÂv÷&³²6öçF–çVRW6–ærF†R&6VÂæB&÷WFR÷fW&Æ’â"Â'v&æ–ær"“°Ð¢Ò’“°Ð¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'f—6–&–Æ—G–6†ævR"Â‚’Óâ°Ð¢–b†Fö7VÖVçBçf—6–&–Æ—G•7FFRÓÓÒ'f—6–&ÆR"’°Ð¢–b‡vF6„–BÓÒçVÆÂbbv¶TÆö6²’¶VWv¶R‚“°Ð¢&W&U†÷Fõ7F÷&vR‚“°Ð¢ÐÐ¢Ò“°Ð¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&&Vf÷&WVæÆöB"ÂWfVçBÓâ°Ð¢–b‡†÷Fô'W7’ÇÂ6¶vT'W7’’°Ð¢WfVçBç&WfVçDFVfVÇB‚“°Ð¢WfVçBç&WGW&åfÇVRÒ"#°Ð¢ÐÐ¢Ò“°Ð¢6WD–çFW'fÂ‡WFFUF–ÖTÖWG&–72Â3“°Ð Ð¢–æ—F–Æ—¦R‚“°Ð§Ò’‚“°Ð 