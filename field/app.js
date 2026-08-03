(function () {
  "use strict";

  const APP_VERSION = "3.1.0";
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
  const observationDialog = document.getElementById("observationDialog");
  const moreCategories = document.getElementById("moreCategories");
  const markerButtons = ["wet", "dry", "blocked", "high", "homesite", "culvert", "tree", "entrance", "wildlife", "thick", "open", "ditch", "timber", "hazard", "other", "note", "photo", "voice", "more"].map(id => document.getElementById(id));
  const buttonLabels = {
    wet: "Wet", dry: "Dry", blocked: "Blocked Access", high: "High Ground", homesite: "Potential Homesite",
    culvert: "Culvert", tree: "Tree", entrance: "Road or Entrance", wildlife: "Wildlife",
    thick: "Thick Brush", open: "Open Area", ditch: "Ditch", timber: "Timber Sample",
    hazard: "Hazard", other: "Other",
    note: "Free Note", photo: "Photo", voice_note: "Voice Note"
  };

  let watchId = null;
  let wakeLock = null;
  let lastPosition = null;
  let latestOrientation = null;
  let lastOrientationProcessedAt = 0;
  let lastOrientationSavedAt = 0;
  let parcelFeatures = [];
  let photoDbPromise = null;
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
    if (!packageReady.hidden) {
      nextStep.textContent = sharePackageBtn.hidden ? "NEXT: Tap Download Inspection Package. Do not clear the inspection yet." : "NEXT: Tap Send Package to ChatGPT. Do not clear the inspection yet.";
    } else if (mediaRecorder && mediaRecorder.state === "recording") {
      nextStep.textContent = "NEXT: Speak now. Tap Stop Voice Note when you are finished.";
    } else if (!data.started) {
      nextStep.textContent = offlineState.dataset.ready === "true" ? "NEXT: Tap Start Inspection." : "NEXT: Wait for “Offline ready,” then tap Start Inspection.";
    } else if (watchId === null) {
      nextStep.textContent = "NEXT: Tap Resume Inspection to continue walking, or Finish Inspection if the property is complete.";
    } else if (!lastPosition) {
      nextStep.textContent = "NEXT: Wait here for the first precise GPS location.";
    } else {
      nextStep.textContent = "NEXT: Walk the property. Tap one field button whenever you observe it.";
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

  function openPhotoDb() {
    if (photoDbPromise) return photoDbPromise;
    photoDbPromise = new Promise((resolve, reject) => {
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
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error("Photo database could not be opened."));
      request.onblocked = () => reject(new Error("Photo database is blocked by another open app tab."));
    });
    photoDbPromise.catch(() => { photoDbPromise = null; });
    return photoDbPromise;
  }

  async function photoStorePut(record) {
    const db = await openPhotoDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(photoStoreName, "readwrite");
      transaction.objectStore(photoStoreName).put(record);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Photograph could not be stored."));
      transaction.onabort = () => reject(transaction.error || new Error("Photograph storage was aborted."));
    });
  }

  async function photoStoreGet(id) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(photoStoreName, "readonly");
      const request = transaction.objectStore(photoStoreName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Photograph could not be read."));
    });
  }

  async function photoStoreGetAll() {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(photoStoreName, "readonly").objectStore(photoStoreName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Stored photographs could not be inventoried."));
    });
  }

  async function photoStoreClear() {
    const db = await openPhotoDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([photoStoreName, voiceStoreName, voiceChunkStoreName, gpsStoreName], "readwrite");
      transaction.objectStore(photoStoreName).clear();
      transaction.objectStore(voiceStoreName).clear();
      transaction.objectStore(voiceChunkStoreName).clear();
      transaction.objectStore(gpsStoreName).clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Evidence attachments could not be cleared."));
    });
  }

  async function voiceStorePut(record) {
    const db = await openPhotoDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(voiceStoreName, "readwrite");
      transaction.objectStore(voiceStoreName).put(record);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Voice note could not be stored."));
    });
  }

  async function voiceStoreGet(id) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(voiceStoreName, "readonly").objectStore(voiceStoreName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Voice note could not be read."));
    });
  }

  async function voiceStoreGetAll() {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(voiceStoreName, "readonly").objectStore(voiceStoreName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Stored voice notes could not be inventoried."));
    });
  }

  async function voiceChunkPut(voiceId, sequence, chunk) {
    const db = await openPhotoDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(voiceChunkStoreName, "readwrite");
      transaction.objectStore(voiceChunkStoreName).put({ key: `${voiceId}:${String(sequence).padStart(8, "0")}`, voice_id: voiceId, sequence, chunk });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Voice-note recovery chunk could not be stored."));
    });
  }

  async function voiceChunksGet(voiceId) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const store = db.transaction(voiceChunkStoreName, "readonly").objectStore(voiceChunkStoreName);
      const index = store.index("voice_id");
      const request = index.getAll(IDBKeyRange.only(voiceId));
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => a.sequence - b.sequence));
      request.onerror = () => reject(request.error || new Error("Voice-note recovery chunks could not be read."));
    });
  }

  async function voiceChunksDelete(voiceId) {
    const db = await openPhotoDb();
    const chunks = await voiceChunksGet(voiceId);
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(voiceChunkStoreName, "readwrite");
      const store = transaction.objectStore(voiceChunkStoreName);
      chunks.forEach(chunk => store.delete(chunk.key));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Voice-note recovery chunks could not be cleared."));
    });
  }

  async function gpsPointPut(inspectionId, point) {
    const db = await openPhotoDb();
    const record = { key: `${inspectionId}:${String(point.sequence).padStart(10, "0")}`, inspection_id: inspectionId, point };
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(gpsStoreName, "readwrite");
      transaction.objectStore(gpsStoreName).put(record);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("GPS point could not be stored."));
    });
  }

  async function gpsPointsGet(inspectionId) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const index = db.transaction(gpsStoreName, "readonly").objectStore(gpsStoreName).index("inspection_id");
      const request = index.getAll(IDBKeyRange.only(inspectionId));
      request.onsuccess = () => resolve((request.result || []).map(record => record.point).sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || String(a.time).localeCompare(String(b.time))));
      request.onerror = () => reject(request.error || new Error("GPS recovery points could not be read."));
    });
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
    records.forEach(record => {
      if (!record.metadata || String(record.inspection_id || "") !== String(data.inspection_id)) return;
      if (!data.voice_notes.some(note => String(note.id) === String(record.id))) {
        data.voice_notes.push(record.metadata);
        changed = true;
      }
      if (record.event && !data.markers.some(marker => String(marker.id) === String(record.event.id))) {
        data.markers.push(record.event);
        changed = true;
      }
    });
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

  function renderConditions() {
    Object.entries(conditionBindings).forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (element) element.value = data.conditions[key] || "";
    });
  }

  function saveConditionsFromUi() {
    Object.entries(conditionBindings).forEach(([id, key]) => {
      const element = document.getElementById(id);
      if (element) data.conditions[key] = element.value.trim();
    });
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

  function redraw() {
    svg.innerHTML = "";
    drawPropertyLines();
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
    data.markers.forEach(marker => {
      if (marker.lon < xmin || marker.lon > xmax || marker.lat < ymin || marker.lat > ymax) return;
      const style = markerStyle(marker.type);
      const x = sx(marker.lon);
      const y = sy(marker.lat);
      addSvg("circle", { cx: x, cy: y, r: 20, fill: style.fill, stroke: "#fff", "stroke-width": 5 });
      addSvg("text", { x, y: y + 5, "text-anchor": "middle", "font-size": 12, "font-family": "Arial", "font-weight": 900, fill: "#fff", "paint-order": "stroke", stroke: "#000", "stroke-width": 2 }, style.label);
    });
    document.getElementById("pointCount").textContent = data.points.length;
    document.getElementById("photoCount").textContent = data.photos.length;
    document.getElementById("eventCount").textContent = data.markers.length;
    document.getElementById("voiceCount").textContent = data.voice_notes.length;
    const feet = totalDistance() * 3.280839895;
    document.getElementById("distance").textContent = feet < 5280 ? `${Math.round(feet)} ft` : `${(feet / 5280).toFixed(2)} mi`;
    updateTimeMetrics();
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
      return;
    }
    for (let index = 0; index < data.photos.length; index += 1) {
      const metadata = data.photos[index];
      const card = document.createElement("div");
      card.className = "thumb";
      const image = document.createElement("img");
      image.alt = `Inspection photograph ${index + 1}`;
      const caption = document.createElement("div");
      caption.textContent = `${metadata.photo_number || `P${index + 1}`} · ${metadata.category || "Other"} · ${new Date(metadata.recorded_at || metadata.time).toLocaleString()}`;
      const location = document.createElement("div");
      location.textContent = `${Number(metadata.lat).toFixed(6)}, ${Number(metadata.lon).toFixed(6)} · ±${Math.round(metadata.gps_accuracy_m)} m`;
      card.append(image, caption, location);
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
    updateNextStep();
  }

  function orientationNumber(value) {
    return Number.isFinite(value) ? value : null;
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
    if (now - lastOrientationSavedAt >= 5000) {
      lastOrientationSavedAt = now;
      data.orientation_samples.push(latestOrientation);
      saveState();
      document.getElementById("heading").textContent = compassHeading == null ? "—" : `${Math.round(compassHeading)}°`;
    }
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
      await openPhotoDb();
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
    return {
      id: makeId("event"),
      source: "button_press",
      type,
      observation_type: `field.${type}`,
      taxonomy_version: "property-observation-1.0",
      button_label: buttonLabels[type] || type,
      note: note || "",
      evidence_classification: settings.evidenceClassification || "Observed",
      attributes: Object.assign({}, settings.attributes || {}),
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
    } else if (type === "other" && !note) {
      const response = prompt("What did you observe?");
      if (response === null) return;
      note = response;
    }
    const marker = markerFromPosition(type, note, null, null, null, settings);
    data.markers.push(marker);
    saveState();
    redraw();
    setStatus(`${buttonLabels[type]} recorded at the current location.`, "active");
    return marker;
  }

  function openObservationDialog(type) {
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Observation was not recorded.", "warning");
      return;
    }
    activeObservationType = type;
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
        observationAttributes: attributes
      });
    }
  }

  function preferredAudioMimeType() {
    const candidates = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function toggleVoiceNote() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      setStatus("Stopping and saving the voice note…", "active");
      mediaRecorder.stop();
      return;
    }
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Voice note was not started.", "warning");
      return;
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
      setStatus("Voice note recording. Speak now, then tap Stop Voice Note.", "active");
    } catch (error) {
      setStatus(`VOICE NOTE NOT STARTED: ${error.message}`, "error");
      if (mediaRecorder && mediaRecorder.stream) mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;
      activeVoiceNote = null;
      data.pending_voice_note = null;
      saveState();
      updateControls();
    }
  }

  async function finalizeVoiceNote() {
    const recorder = mediaRecorder;
    const metadata = activeVoiceNote;
    try {
      await voiceChunkWrites;
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
        source: "button_press",
        type: "voice_note",
        observation_type: "field.voice_note",
        taxonomy_version: "property-observation-1.0",
        button_label: "Voice Note",
        note: "",
        attributes: { duration_ms: metadata.duration_ms },
        time: metadata.started_at,
        lat: metadata.lat,
        lon: metadata.lon,
        gps_accuracy_m: metadata.gps_accuracy_m,
        gps_position_at: metadata.gps_position_at,
        compass_heading_deg: metadata.compass_heading_deg,
        device_orientation: metadata.sensor_orientation,
        voice_note_id: metadata.id,
        photo_id: null
      };
      await voiceStorePut({ id: metadata.id, inspection_id: data.inspection_id, metadata, event: voiceEvent, audioBlob });
      data.voice_notes.push(metadata);
      data.pending_voice_note = null;
      data.markers.push(voiceEvent);
      saveState();
      await voiceChunksDelete(metadata.id);
      redraw();
      setStatus(`Voice note ${data.voice_notes.length} saved with audio, GPS, time, and heading.`, "active");
    } catch (error) {
      setStatus(`VOICE NOTE NOT SAVED: ${error.message} Record it again.`, "error");
    } finally {
      if (recorder && recorder.stream) recorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;
      activeVoiceNote = null;
      voiceBtn.textContent = "Start Voice Note";
      voiceBtn.classList.remove("recording");
      updateControls();
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
        button_label: "Voice Note", note: "", attributes: { duration_ms: pending.duration_ms, recovered_after_interruption: true },
        time: pending.started_at, lat: pending.lat, lon: pending.lon, gps_accuracy_m: pending.gps_accuracy_m,
        gps_position_at: pending.gps_position_at, compass_heading_deg: pending.compass_heading_deg,
        device_orientation: pending.sensor_orientation, voice_note_id: pending.id, photo_id: null
      };
    }
    await voiceStorePut({ id: pending.id, inspection_id: data.inspection_id, metadata: pending, event: voiceEvent, audioBlob });
    if (!data.voice_notes.some(note => String(note.id) === String(pending.id))) data.voice_notes.push(pending);
    if (!data.markers.some(marker => String(marker.voice_note_id) === String(pending.id))) data.markers.push(voiceEvent);
    data.pending_voice_note = null;
    saveState();
    await voiceChunksDelete(pending.id);
    setStatus("A voice note interrupted by the previous app close was recovered.", "warning");
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
      const maxDimension = 2048;
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
        canvas.toBlob(value => value ? resolve(value) : reject(new Error("The analysis JPEG could not be created.")), "image/jpeg", 0.9);
      });
      return { blob, width: decoded.width, height: decoded.height };
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

  function takePhoto(context) {
    if (!lastPosition) {
      setStatus("Waiting for the first current GPS location. Camera was not opened.", "warning");
      return;
    }
    pendingPhotoContext = context && context.category ? context : null;
    pendingPhotoRequestedAt = new Date().toISOString();
    photoInput.click();
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
        photo_number: `P${data.photos.length + 1}`,
        category: photoContext.category || "Other",
        note: photoContext.note || "",
        associated_observation_id: photoContext.associatedObservationId || null,
        evidence_classification: photoContext.evidenceClassification || "Observed",
        observation_attributes: Object.assign({}, photoContext.observationAttributes || {})
      };
      const photoEvent = markerFromPosition("photo", metadata.note, id, recordedAt, position, {
        evidenceClassification: metadata.evidence_classification,
        attributes: {
          photo_number: metadata.photo_number,
          category: metadata.category,
          associated_observation_id: metadata.associated_observation_id,
          observation_attributes: metadata.observation_attributes
        }
      });
      metadata.associated_marker_id = photoEvent.id;
      if (metadata.associated_observation_id) {
        const associatedObservation = data.markers.find(marker => String(marker.id) === String(metadata.associated_observation_id));
        if (associatedObservation) associatedObservation.photo_id = id;
      }
      await photoStorePut({
        id,
        inspection_id: data.inspection_id,
        metadata,
        event: photoEvent,
        originalBlob: file,
        analysisBlob: analysis.blob
      });
      data.photos.push(metadata);
      data.markers.push(photoEvent);
      saveState();
      redraw();
      await renderGallery();
      setStatus(`Photo ${data.photos.length} stored with original bytes, analysis copy, GPS, time, and orientation metadata.${storageEstimate.warning ? ` WARNING: only ${formatBytes(storageEstimate.remaining)} of browser storage remains.` : ""}`, storageEstimate.warning ? "warning" : "active");
    } catch (error) {
      setStatus(`PHOTO NOT RECORDED: ${error.message} Retake the photograph before continuing.`, "error");
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
        title: "Property inspection package",
        text: "Analyze this complete property inspection package. Reconstruct the inspection, map every observation and photo, identify uninspected areas, and summarize findings."
      });
      setStatus("Package handed to the selected app. Keep this inspection until ChatGPT confirms receipt.", "success");
      return true;
    } catch (error) {
      if (error && error.name !== "AbortError") setStatus("The share sheet did not accept the package. Tap Send Package to ChatGPT and try again.", "warning");
      return false;
    }
  }

  async function presentPackage(name, blob, manifest) {
    if (lastPackageUrl) URL.revokeObjectURL(lastPackageUrl);
    lastPackageUrl = URL.createObjectURL(blob);
    lastPackageFile = typeof File === "function" ? new File([blob], name, { type: "application/zip", lastModified: Date.now() }) : null;
    packageLink.href = lastPackageUrl;
    packageLink.download = name;
    packageLink.textContent = "Download Inspection Package";
    packageLink.hidden = false;
    packageFilename.textContent = name;
    packageInstruction.textContent = `Inspection package downloaded. In ChatGPT, tap +, tap Upload files, and select the file named ${name}.`;
    packageSummary.textContent = `One file contains ${countLabel(manifest.summary.gps_track_point_count, "GPS point")}, ${countLabel(manifest.summary.field_event_count, "observation")}, ${countLabel(manifest.summary.photo_count, "photograph")}, and ${countLabel(manifest.summary.voice_note_count, "voice note")}.`;
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

  async function recoverEveryPhoto() {
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
      entries.push({ id: metadata.id, originalBlob: stored.originalBlob, analysisBlob: stored.analysisBlob });
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

  async function finishInspection() {
    if (packageBusy || photoBusy) return;
    if (!data.started || !data.points.length) {
      setStatus("INSPECTION INCOMPLETE: at least one recorded GPS point is required.", "error");
      return;
    }
    if (!data.photos.length) {
      setStatus("INSPECTION INCOMPLETE: at least one photograph is required. Photo markers alone are unacceptable.", "error");
      return;
    }
    packageBusy = true;
    updateControls();
    if (watchId !== null) stopTracking({ silent: true, reason: "finish" });
    else {
      data.stopped = new Date().toISOString();
      data.lifecycle_events.push({ type: "inspection_finished", time: data.stopped, source: "button_press" });
      saveState();
    }
    try {
      await gpsWriteQueue;
      const [photoEntries, voiceEntries, mapContext] = await Promise.all([recoverEveryPhoto(), recoverEveryVoiceNote(), recoverMapContext()]);
      setStatus("Building the complete inspection package. Keep Safari open…", "active");
      const result = await packageTools.createInspectionPackage({
        inspection: data,
        photoEntries,
        voiceEntries,
        mapContext,
        appVersion: APP_VERSION,
        sourceUrl: location.href.split(/[?#]/)[0]
      });
      if (result.manifest.summary.original_photo_count !== data.photos.length || result.manifest.summary.analysis_photo_count !== data.photos.length) {
        throw new Error("Package photograph counts did not reconcile. No package was released.");
      }
      if (result.manifest.summary.voice_note_count !== data.voice_notes.length) throw new Error("Package voice-note counts did not reconcile. No package was released.");
      await presentPackage(result.fileName, result.blob, result.manifest);
      setStatus(`COMPLETE: one package created with ${countLabel(data.points.length, "GPS point")}, ${countLabel(data.markers.length, "observation")}, ${countLabel(data.orientation_samples.length, "orientation sample")}, all ${countLabel(data.photos.length, "photograph")}, and all ${countLabel(data.voice_notes.length, "voice note")} (${formatBytes(result.blob.size)}).`, "success");
    } catch (error) {
      setStatus(`PACKAGE NOT CREATED: ${error.message} The inspection remains saved on this phone.`, "error");
    } finally {
      packageBusy = false;
      updateControls();
    }
  }

  async function exportBackupNow() {
    if (packageBusy || photoBusy || !data.started) return;
    packageBusy = true;
    updateControls();
    try {
      await gpsWriteQueue;
      const [photoEntries, voiceEntries, mapContext] = await Promise.all([recoverEveryPhoto(), recoverEveryVoiceNote(), recoverMapContext()]);
      setStatus("Building a complete recovery package without stopping GPS…", "active");
      const result = await packageTools.createInspectionPackage({
        inspection: data,
        photoEntries,
        voiceEntries,
        mapContext,
        appVersion: APP_VERSION,
        sourceUrl: location.href.split(/[?#]/)[0],
        packageKind: "backup"
      });
      if (result.manifest.summary.original_photo_count !== data.photos.length || result.manifest.summary.analysis_photo_count !== data.photos.length) {
        throw new Error("Backup photograph counts did not reconcile. No backup was released.");
      }
      await presentPackage(result.fileName, result.blob, result.manifest);
      setStatus(`BACKUP READY: all saved evidence is in ${result.fileName}. GPS tracking was not stopped.`, "success");
    } catch (error) {
      setStatus(`BACKUP NOT CREATED: ${error.message} The inspection remains saved on this phone.`, "error");
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
      data = emptyInspection();
      lastPosition = null;
      latestOrientation = null;
      gpsWriteQueue = Promise.resolve();
      gpsStorageFailed = false;
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
    if (!packageTools) {
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
    if (data.started && !data.inspection_id) data.inspection_id = makeId("inspection");
    try {
      await openPhotoDb();
      await reconcileGpsPoints();
      await migrateLegacyPhotos();
      await reconcileStoredPhotos();
      await reconcileStoredVoiceNotes();
      await recoverInterruptedVoiceNote();
    } catch (error) {
      setStatus(`Durable evidence storage is unavailable: ${error.message} Do not begin an inspection in this browser.`, "error");
      startBtn.disabled = true;
    }
    redraw();
    renderConditions();
    await renderGallery();
    await Promise.all([loadParcels(), registerOfflineWorker()]);
    if (statusEl.dataset.kind !== "error") {
      setStatus(data.started ? "Saved inspection loaded. Tap Resume Existing Inspection to continue, or Finish Inspection to create the package." : "Ready. Confirm Offline ready, then tap Start Inspection and allow Precise Location.", "normal");
    }
  }

  startBtn.addEventListener("click", startTracking);
  stopBtn.addEventListener("click", () => stopTracking());
  finishBtn.addEventListener("click", finishInspection);
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
  document.getElementById("photo").addEventListener("click", () => takePhoto(null));
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
  sharePackageBtn.addEventListener("click", shareLastPackage);
  clearBtn.addEventListener("click", clearInspection);
  document.getElementById("backup").addEventListener("click", exportBackupNow);
  Object.keys(conditionBindings).forEach(id => {
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
    if (document.visibilityState === "visible" && watchId !== null && !wakeLock) keepAwake();
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
