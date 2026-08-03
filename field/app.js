(function () {
  "use strict";

  const APP_VERSION = "3.9.0";
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
    data.conditions = Object.assign(emptyInspection().conditions, data.conditions || {});
    data.weather_context = Object.assign(emptyInspection().weather_context, data.weather_context || {});
    data.water_observation_rule = Object.assign(emptyInspection().water_observation_rule, data.water_observation_rule || {});
    if (coachingTools) coachingTools.ensureInspectionModel(data);
    if (governanceTools) governanceTools.ensureGovernanceModel(data);
    if (evidenceSetTools) {
      evidenceSetTools.ensureEvidenceSetModel(data);
      evidenceSetTools.addPearsonSuggestions(data);
    }
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
    return value !== null && value !== "" && Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${suffix || ""}` : "â€”";
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
      : "Staç]=îÚ$z{-®éÜj×Ò“°¢Ò“°¢Ð¢öffÆ–æU7FFRçFW‡D6öçFVçBÒ$öffÆ–æR&VG’#°¢öffÆ–æU7FFRæFF6WBç&VG’Ò'G'VR#°¢öffÆ–æU&VG’ÒG'VS°¢WFFT6öçG&öÇ2‚“°¢WFFTæW‡E7FW‚“°¢Ò6F6‚†W'&÷"’°¢öffÆ–æU7FFRçFW‡D6öçFVçBÒ$öffÆ–æR6WGWf–ÆVB#°¢öffÆ–æU7FFRæFF6WBç&VG’Ò&fÇ6R#°¢WFFTæW‡E7FW‚“°¢6WE7FGW2‚$ôddÄ”äR4UEUd”ÄTC¢&VÆöBv—F‚6W'f–6R&Vf÷&RVçFW&–ærF†RvööG2â"Â&W'&÷""“°¢Ð¢Ð ¢7–æ2gVæ7F–öâ–æ—F–Æ—¦R‚’°¢–b‚6¶vUFööÇ2ÇÂF%&V6÷fW'•FööÇ2ÇÂ6ö6†–æuFööÇ2ÇÂvFW%FööÇ2ÇÂv÷fW&ææ6UFööÇ2ÇÂWf–FVæ6U6WEFööÇ2’°¢6WE7FGW2‚$–ç7V7F–öâ6¶vR6öFRf–ÆVBFòÆöBâFòæ÷B&Vv–ââ–ç7V7F–öââ"Â&W'&÷""“°¢7F'D'FâæF—6&ÆVBÒG'VS°¢&WGW&ã°¢Ð¢–b‚v–æF÷ræ—56V7W&T6öçFW‡B’°¢6WE7FGW2‚$u2Â6ÖW&7F÷&vRÂæBöffÆ–æR&V6÷fW'’&WV—&RF†R6V7W&R…EE2fW'6–öâöbF†—2vRâFòæ÷B&Vv–âg&öÒâ–ç6V7W&RFG&W72â"Â&W'&÷""“°¢7F'D'FâæF—6&ÆVBÒG'VS°¢&WGW&ã°¢Ð¢ÆöE7FFR‚“°¢v÷fW&ææ6UFööÇ2æVç7W&Tv÷fW&ææ6TÖöFVÂ†FF“°¢6fU7FFR‚“°¢Æ7E6fVD÷&–VçFF–öâÒFFæ÷&–VçFF–öå÷6×ÆW2æÆVæwF‚òFFæ÷&–VçFF–öå÷6×ÆW5¶FFæ÷&–VçFF–öå÷6×ÆW2æÆVæwF‚ÒÒ¢çVÆÃ°¢–b†FFç7F'FVBbbFFæ–ç7V7F–öåö–B’FFæ–ç7V7F–öåö–BÒÖ¶T–B‚&–ç7V7F–öâ"“°¢G'’°¢v—B÷Vå†÷FôF"‚“°¢v—B&WfÆ–FFU†÷FôF"‚“°¢v—BÆöEVæF–æu†÷F÷2‚“°¢v—B&V6öæ6–ÆTw5ö–çG2‚“°¢v—BÖ–w&FTÆVv7•†÷F÷2‚“°¢v—B&V6öæ6–ÆU7F÷&VE†÷F÷2‚“°¢v—B&V6öæ6–ÆU7F÷&VEfö–6Tæ÷FW2‚“°¢v—B&V6÷fW$–çFW''WFVEfö–6Tæ÷FR‚“°¢Wf–FVæ6U6WEFööÇ2æFEV'6öå7VvvW7F–öç2†FF“°¢Ò6F6‚†W'&÷"’°¢6WE7FGW2†GW&&ÆRWf–FVæ6R7F÷&vR—2Væf–Æ&ÆS¢G¶W'&÷"æÖW76vWÒFòæ÷B&Vv–ââ–ç7V7F–öâ–âF†—2'&÷w6W"æÂ&W'&÷""“°¢7F'D'FâæF—6&ÆVBÒG'VS°¢Ð¢&VG&r‚“°¢&VæFW$6öæF—F–öç2‚“°¢v—B&VæFW$vÆÆW'’‚“°¢v—B&öÖ—6RæÆÂ…¶ÆöE&6VÇ2‚’Â&Vv—7FW$öffÆ–æUv÷&¶W"‚•Ò“°¢6÷fW&vU6æ6†÷BÒçVÆÃ°¢6ö6†–æu7FFU6æ6†÷BÒçVÆÃ°¢6÷fW&vTF—'G’ÒG'VS°¢&VG&r‚“°¢&VæFW$6ö6†–ær‚“°¢&VæFW$VF—D†—7F÷'’‚“°¢&VæFW$Wf–FVæ6U6WG2‚“°¢–b‡7FGW4VÂæFF6WBæ¶–æBÓÒ&W'&÷""’°¢6WE7FGW2‡VæF–æu†÷FõVWVRæÆVæwF‚ò%†÷Fò—2v—F–ærFò&R6fVBâ¶VWF†—2vR÷VâæBF&WG'’VæF–ær†÷Fòâ"¢†FFç7F'FVBò%6fVB–ç7V7F–öâÆöFVBâF&W7VÖRW†—7F–ær–ç7V7F–öâFò6öçF–çVRÂ÷"f–æ—6‚–ç7V7F–öâFò7&VFRF†R6¶vRâ"¢%&VG’â6öæf—&ÒöffÆ–æR&VG’ÂF†VâF7F'B–ç7V7F–öâæBÆÆ÷r&V6—6RÆö6F–öââ"’ÂVæF–æu†÷FõVWVRæÆVæwF‚ò'v&æ–ær"¢&æ÷&ÖÂ"“°¢Ð¢66†VGVÆU6¶vTW7F–ÖFU&Vg&W6‚‚“°¢Ð ¢7F'D'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â7F'EG&6¶–ær“°¢7F÷'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ7F÷G&6¶–ær‚’“°¢f–æ—6„'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâf–æ—6„–ç7V7F–öâ‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&FD&V"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂFD–ç7V7F–öä&V“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&æWt&V"’æFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"ÂWfVçBÓâ²–b†WfVçBæ¶W’ÓÓÒ$VçFW""’²WfVçBç&WfVçDFVfVÇB‚“²FD–ç7V7F–öä&V‚“²ÒÒ“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&FEVW7F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂFD–çfW7F–vF–öåVW7F–öâ“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&æWuVW7F–öâ"’æFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"ÂWfVçBÓâ²–b†WfVçBæ¶W’ÓÓÒ$VçFW""’²WfVçBç&WfVçDFVfVÇB‚“²FD–çfW7F–vF–öåVW7F–öâ‚“²ÒÒ“°¢7F—fT&V6VÆV7BæFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ°¢FFæ7F—fUö&Vö–BÒ7F—fT&V6VÆV7BçfÇVS°¢6öç7B&VÒFFæ–ç7V7F–öåö&V2æf–æB†—FVÒÓâ—FVÒæ&Vö–BÓÓÒFFæ7F—fUö&Vö–B“°¢FFæÆ–fV7–6ÆUöWfVçG2çW6‚‡²G—S¢&–ç7V7F–öåö&V÷6VÆV7FVB"ÂF–ÖS¢æWrFFR‚’çFô•4õ7G&–ær‚’Â&Vö–C¢FFæ7F—fUö&Vö–BÂ&VöæÖS¢&Vò&VææÖR¢çVÆÂÂ6÷W&6S¢&f–VÆEö6öçG&öÂ"Ò“°¢6fU7FFR‚“²&VæFW$6ö6†–ær‚“°¢6WE7FGW2†7W'&VçB&V—2G¶&Vò&VææÖR¢'6VÆV7FVB'ÒâæWrWf–FVæ6Rv–ÆÂGF6‚WFöÖF–6ÆÇ’æÂ&7F—fR"“°¢Ò“°¢Wf–FVæ6U&VÆF–öç6†—6VÆV7BæFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ²FFææW‡EöWf–FVæ6U÷&VÆF–öç6†—ÒWf–FVæ6U&VÆF–öç6†—6VÆV7BçfÇVS²6fU7FFR‚“²&VæFW$6ö6†–ær‚“²Ò“°¢æW‡E†÷FõfÇVU6VÆV7BæFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ²FFææW‡E÷†÷Fõ÷fÇVRÒæW‡E†÷FõfÇVU6VÆV7BçfÇVS²6fU7FFR‚“²&VæFW$6ö6†–ær‚“²Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'&Wf–WtWf–FVæ6R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6†÷tFW'GW&U&Wf–Wr“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF–çVT–ç7V7F–ær"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFW'GW&TF–Æöræ6Æ÷6R‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&f–æ—6„gFW%&Wf–Wr"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²FW'GW&TF–Æöræ6Æ÷6R‚“²f–æ—6„–ç7V7F–öâ‡²&Wf–WvVC¢G'VRÒ“²Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'vWB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ÷Väö'6W'fF–öäF–Æör‚'vWB"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&G'’"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ÷Väö'6W'fF–öäF–Æör‚&G'’"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&Æö6¶VB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ÷Väö'6W'fF–öäF–Æör‚&&Æö6¶VB"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†–v‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&†–v‚"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†öÖW6—FR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&†öÖW6—FR"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&7VÇfW'B"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&7VÇfW'B"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚'G&VR"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&VçG&æ6R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&VçG&æ6R"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'v–ÆFÆ–fR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚'v–ÆFÆ–fR"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'F†–6²"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚'F†–6²"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&÷Vâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&÷Vâ"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&F—F6‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&F—F6‚"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'F–Ö&W""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚'F–Ö&W""’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†¦&B"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&†¦&B"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&÷F†W""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&÷F†W""’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&æ÷FR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚&æ÷FR"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'F†÷Vv‡B"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÖ&¶W"‚'F†÷Vv‡B"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&‡—÷F†W6—2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â÷Vä‡—÷F†W6—4F–Æör“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷Fò"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâF¶U†÷Fò†çVÆÂ’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷Fò"’æFDWfVçDÆ—7FVæW"‚'ö–çFW&F÷vâ"Â&W&U†÷Fõ7F÷&vR“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'7F'E†÷Fôw&÷W"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â÷VäWf–FVæ6U6WDF–Æör“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'7F'E†÷Fôw&÷W"’æFDWfVçDÆ—7FVæW"‚'ö–çFW&F÷vâ"Â&W&U†÷Fõ7F÷&vR“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&f–æ—6„Wf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Âf–æ—6„7F—fTWf–FVæ6U6WB“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&Wf–FVæ6U6WEG—R"’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â6†÷tWf–FVæ6U6WDf–VÆG2“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VUf—6–&–Æ—G’"’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â&VæFW%G&VTWf–FVæ6UÆâ“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'G&VUW'÷6R"’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â&VæFW%G&VTWf–FVæ6UÆâ“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÄWf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFö7VÖVçBævWDVÆVÖVçD'”–B‚&Wf–FVæ6U6WDF–Æör"’æ6Æ÷6R‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&7&VFTWf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â7&VFTWf–FVæ6U6WDg&öÔF–Æör“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF–çVTWf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6ö×ÆWFTw&÷W†÷Fô6†ö–6R‚&6öçF–çVR"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&f–æ—6„gFW$w&÷W†÷Fò"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6ö×ÆWFTw&÷W†÷Fô6†ö–6R‚&f–æ—6‚"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&æWtgFW$w&÷W†÷Fò"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6ö×ÆWFTw&÷W†÷Fô6†ö–6R‚&æWr"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'&VÖ÷fTg&öÔWf–FVæ6U6WB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6ö×ÆWFTw&÷W†÷Fô6†ö–6R‚'&VÖ÷fR"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&w&÷W†÷FôF–Æör"’æFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&w&÷W†÷Fõ&öÆR"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÆVe&÷fVææ6TÆ&VÂ"’æ†–FFVâÒ²$ÆVbWW"7W&f6R"Â$ÆVbVæFW'6–FR%Òæ–æ6ÇVFW2†WfVçBçF&vWBçfÇVR“°¢Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&Ö÷&R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°¢Ö÷&T6FVv÷&–W2æ†–FFVâÒÖ÷&T6FVv÷&–W2æ†–FFVã°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&Ö÷&R"’çFW‡D6öçFVçBÒÖ÷&T6FVv÷&–W2æ†–FFVâò$Ö÷&R6FVv÷&–W2"¢$†–FR6FVv÷&–W2#°¢Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fTö'6W'fF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fU7G'V7GW&VDö'6W'fF–öâ“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÄö'6W'fF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²7F—fTö'6W'fF–öåG—RÒçVÆÃ²Ò“°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚v–çWE¶æÖSÒ'vWDFWF‚%Òr’æf÷$V6‚†–çWBÓâ–çWBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'vWDW†7DÆ&VÂ"’æ†–FFVâÒ6VÆV7FVE&F–õfÇVR‚'vWDFWF‚"’ÓÒ&W†7B#°¢Ò’“°¢fö–6T'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂFövvÆUfö–6Tæ÷FR“°¢†÷Fô–çWBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â†æFÆU†÷Fôf–ÆR“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'7F÷†÷FôW‡ÆæF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°¢–b†ÖVF–&V6÷&FW"bbÖVF–&V6÷&FW"ç7FFRÓÓÒ'&V6÷&F–ær"’°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FôW‡ÆæF–öå7FFR"’çFW‡D6öçFVçBÒ%6f–ærF†RW‡ÆæF–öî(
b#°¢ÖVF–&V6÷&FW"ç7F÷‚“°¢Ð¢Ò“°¢†÷FôW‡ÆæF–öäF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°¢vFW$6Æ76–f–6F–öäF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'&WG'•†÷FôW‡ÆæF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°¢–b‡VæF–æu†÷FôW‡ÆæF–öä–B’&Vv–å†÷FôW‡ÆæF–öâ‡VæF–æu†÷FôW‡ÆæF–öä–B“°¢Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6¶—†÷FôW‡ÆæF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ&WVW7E†÷FôW‡ÆæF–öäF—7÷6—F–öâ‚'6¶—VB"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÆFW%†÷FôW‡ÆæF–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ&WVW7E†÷FôW‡ÆæF–öäF—7÷6—F–öâ‚&W‡Æ–åöÆFW""’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fU†÷FôÖVæ–ær"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâW'6—7E†÷FôÖVæ–ær‚&6ö×ÆWFR"’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FôÖVæ–ætÆFW""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâW'6—7E†÷FôÖVæ–ær‚&W‡Æ–åöÆFW""’“°¢†÷FôÖVæ–ætF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°¢6÷'&V7E&V6÷&D'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ÷Vä6÷'&V7F–öäF–Æör‚’“°¢VæFôÆ7D'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â÷VåVæFôÆ7B“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&¶VWÆ7D7F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²VæF–æuVæFõF&vWBÒçVÆÃ²Fö7VÖVçBævWDVÆVÖVçD'”–B‚'VæFôF–Æör"’æ6Æ÷6R‚“²Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öæf—&ÕVæFôÆ7B"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6öæf—&ÕVæFôÆ7B“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'VæFôF–Æör"’æFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÄ6÷'&V7F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6÷'&V7F–öäF–Æöræ6Æ÷6R‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fT6÷'&V7F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fUW&ÖæVçD6÷'&V7F–öâ“°¢6÷'&V7F–öäF–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6æ6VÄ‡—÷F†W6—2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ‡—÷F†W6—4F–Æöræ6Æ÷6R‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fT‡—÷F†W6—2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fT–ç7V7F÷$‡—÷F†W6—2“°¢‡—÷F†W6—4F–ÆöræFDWfVçDÆ—7FVæW"‚&6æ6VÂ"ÂWfVçBÓâWfVçBç&WfVçDFVfVÇB‚’“°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×vFW"Ö6†ö–6UÒ"’æf÷$V6‚†'WGFöâÓâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6†ö÷6UvFW%G—R†'WGFöâæFF6WBçvFW$6†ö–6R’’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'6fUvFW$6Æ76–f–6F–öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fT6öæf—&ÖVEvFW$6Æ76–f–6F–öâ“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FõvFW$FWF‚"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'†÷FõvFW$W†7DÆ&VÂ"’æ†–FFVâÒWfVçBçF&vWBçfÇVRÓÒ&W†7B#°¢Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6Æ÷6UvFW%†÷Fò"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâvFW%†÷FôF–Æöræ6Æ÷6R‚’“°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×vFW"ÖÆ–W%Ò"’æf÷$V6‚†6öçG&öÂÓâ6öçG&öÂæFDWfVçDÆ—7FVæW"‚&6†ævR"Â&VæFW%6ÖÆÅG&7EvFW$Ö’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&ÆÅvFW%†÷Föw&†VB"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWfVçBÓâ°¢FFçvFW%öö'6W'fF–öå÷'VÆRÒ°¢ÆÅöö'6W'fVE÷7FæF–æu÷vFW%÷†÷Föw&†VC¢WfVçBçF&vWBæ6†V6¶VBÀ¢6öæf—&ÖVEöC¢WfVçBçF&vWBæ6†V6¶VBòæWrFFR‚’çFô•4õ7G&–ær‚’¢çVÆÂÀ¢66÷S¢'vÆ¶VEöæE÷f—7VÆÇ•öö'6W'fVEö6÷'&–F÷%öEö–ç7V7F–öå÷F–ÖR ¢Ó°¢6fU7FFR‚“°¢&VG&r‚“°¢6WE7FGW2†WfVçBçF&vWBæ6†V6¶VBò$f–VÆB'VÆR6fVC¢v—F†–âF†RvÆ¶VBæBf—7VÆÇ’ö'6W'fVB6÷'&–F÷"ÂVç†÷Föw&†VBÆö6F–öç2Ö’7W÷'B(	†æò7FæF–ærvFW"ö'6W'fVBB–ç7V7F–öâF–ÖRî(	’"¢$f–VÆB'VÆR&VÖ÷fVBâF†R&W÷'Bv–ÆÂæ÷B–æfW"–ç7V7FVBG'’w&÷VæBg&öÒÖ—76–ærvFW"†÷Föw&‡2â"Â&7F—fR"“°¢Ò“°¢6†&U6¶vT'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6†&TÆ7E6¶vR“°¢6ÆV$'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6ÆV$–ç7V7F–öâ“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&&6·W"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂW‡÷'D&6·Wæ÷r“°¢gVÆÄ&6†—fT'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂW‡÷'D&6·Wæ÷r“°¢&WG'•VæF–æu†÷Fô'FâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ&WG'•VæF–æu†÷F÷2‚’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÆÆW'•&Wf–÷W2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²vÆÆW'•vRÒÖF‚æÖ‚ƒÂvÆÆW'•vRÒ“²&VæFW$vÆÆW'’‚“²Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vÆÆW'”æW‡B"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ²vÆÆW'•vR³Ò²&VæFW$vÆÆW'’‚“²Ò“°¢ö&¦V7Bæ¶W—2†6öæF—F–öä&–æF–æw2’æf÷$V6‚†–BÓâ°¢6öç7BVÆVÖVçBÒFö7VÖVçBævWDVÆVÖVçD'”–B†–B“°¢VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â6fT6öæF—F–öç4g&öÕV’“°¢VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&&ÇW""Â6fT6öæF—F–öç4g&öÕV’“°¢Ò“°¢ö&¦V7Bæ¶W—2‡vVF†W$6öçFW‡D&–æF–æw2’æf÷$V6‚†–BÓâ°¢6öç7BVÆVÖVçBÒFö7VÖVçBævWDVÆVÖVçD'”–B†–B“°¢VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&6†ævR"Â6fT6öæF—F–öç4g&öÕV’“°¢VÆVÖVçBæFDWfVçDÆ—7FVæW"‚&&ÇW""Â6fT6öæF—F–öç4g&öÕV’“°¢Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&77b"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâF÷væÆöEFW‡B‚%V'6öåõ&öEôf–VÆEõG&6²æ77b"Â'FW‡Bö77b"Â6¶vUFööÇ2æ7&VFT77b†FFÂµÒ’’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&vVö§6öâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâF÷væÆöEFW‡B‚%V'6öåõ&öEôf–VÆEõG&6²ævVö§6öâ"Â&Æ–6F–öâövVò¶§6öâ"Â6¶vUFööÇ2æ7&VFTvVô¥4ôâ†FFÂµÒ’’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&w‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâF÷væÆöEFW‡B‚%V'6öåõ&öEôf–VÆEõG&6²æw‚"Â&Æ–6F–öâöw‚·†ÖÂ"Â6¶vUFööÇ2æ7&VFTw‚†FFÂµÒ’’“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF÷W$÷6—G’"’æFDWfVçDÆ—7FVæW"‚&–çWB"ÂWfVçBÓâ²Fö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF÷W'2"’ç7G–ÆRæ÷6—G’ÒWfVçBçF&vWBçfÇVS²Ò“°¢Fö7VÖVçBævWDVÆVÖVçD'”–B‚'FW'&–ä÷6—G’"’æFDWfVçDÆ—7FVæW"‚&–çWB"ÂWfVçBÓâ²Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†–ÆÇ6†FR"’ç7G–ÆRæ÷6—G’ÒWfVçBçF&vWBçfÇVS²Ò“°¢¶Fö7VÖVçBævWDVÆVÖVçD'”–B‚&†–ÆÇ6†FR"’ÂFö7VÖVçBævWDVÆVÖVçD'”–B‚&6öçF÷W'2"•Òæf÷$V6‚†–ÖvRÓâ–ÖvRæFDWfVçDÆ—7FVæW"‚&W'&÷""Â‚’Óâ°¢–ÖvRæ†–FFVâÒG'VS°¢6WE7FGW2‚$&6¶w&÷VæBÖ–ÖvR—2Væf–Æ&ÆRâu2Âö'6W'fF–öç2Â†÷F÷2ÂæBæ÷FW27F–ÆÂv÷&³²6öçF–çVRW6–ærF†R&6VÂæB&÷WFR÷fW&Æ’â"Â'v&æ–ær"“°¢Ò’“°¢Fö7VÖVçBæFDWfVçDÆ—7FVæW"‚'f—6–&–Æ—G–6†ævR"Â‚’Óâ°¢–b†Fö7VÖVçBçf—6–&–Æ—G•7FFRÓÓÒ'f—6–&ÆR"’°¢–b‡vF6„–BÓÒçVÆÂbbv¶TÆö6²’¶VWv¶R‚“°¢&W&U†÷Fõ7F÷&vR‚“°¢Ð¢Ò“°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&&Vf÷&WVæÆöB"ÂWfVçBÓâ°¢–b‡†÷Fô'W7’ÇÂ6¶vT'W7’’°¢WfVçBç&WfVçDFVfVÇB‚“°¢WfVçBç&WGW&åfÇVRÒ"#°¢Ð¢Ò“°¢6WD–çFW'fÂ‡WFFUF–ÖTÖWG&–72Â3“° ¢–æ—F–Æ—¦R‚“°§Ò’‚“° 