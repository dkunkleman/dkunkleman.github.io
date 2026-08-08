(function () {
  "use strict";
  const Core = window.PropertyPhotoPoints;
  const Store = window.RepeatPhotoStore;
  const ACTIVE_DRAFT = "active-repeat-photo-session";
  const state = {
    points: [], selectedPoint: null, currentPosition: null, currentOrientation: null,
    locationWatchId: null, cameraStream: null, ghostUsed: false, imageUrls: new Map()
  };

  const $ = (id) => document.getElementById(id);

  function immediateStatus(message, tone = "working") {
    const bar = $("tapStatus");
    bar.textContent = message;
    bar.dataset.tone = tone;
  }

  function showView(id) {
    document.querySelectorAll(".view").forEach((view) => {
      const active = view.id === id;
      view.hidden = !active;
      view.classList.toggle("active", active);
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function readingText(reading, suffix = "") {
    return reading && reading.availability === "AVAILABLE" ? `${reading.value}${suffix}` : "UNAVAILABLE";
  }

  function pointPosition(point) {
    const capture = point.captures[0];
    if (capture.position.availability !== "AVAILABLE") return null;
    return { latitude: Number(capture.position.latitude.value), longitude: Number(capture.position.longitude.value) };
  }

  async function sha256Hex(blob) {
    const buffer = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(base64, mimeType) {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: mimeType || "application/octet-stream" });
  }

  async function imageUrlFor(capture) {
    if (!capture) return "";
    if (state.imageUrls.has(capture.image.blob_id)) return state.imageUrls.get(capture.image.blob_id);
    const record = await Store.getBlob(capture.image.blob_id);
    if (!record || !record.blob) return "";
    const url = URL.createObjectURL(record.blob);
    state.imageUrls.set(capture.image.blob_id, url);
    return url;
  }

  async function reloadPoints() {
    state.points = (await Store.getAllPoints()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    await renderPointList();
  }

  async function renderPointList() {
    const list = $("pointList");
    list.innerHTML = "";
    if (!state.points.length) {
      list.innerHTML = '<div class="empty-state"><strong>No photo points yet.</strong><span>Create one without waiting for GPS.</span></div>';
      return;
    }
    for (const point of state.points) {
      const template = $("pointCardTemplate").content.cloneNode(true);
      const card = template.querySelector("article");
      const reference = point.captures[0];
      const image = template.querySelector("img");
      image.src = await imageUrlFor(reference);
      image.alt = point.target_description || point.photo_point_id;
      template.querySelector(".eyebrow").textContent = point.property_id;
      template.querySelector("h3").textContent = point.photo_point_id;
      template.querySelector("p").textContent = point.target_description || "No target description recorded";
      template.querySelector("small").textContent = `${point.captures.length} capture${point.captures.length === 1 ? "" : "s"} · original preserved`;
      template.querySelector("button").addEventListener("click", () => {
        immediateStatus("Tap received. Opening this permanent photo point.");
        openPoint(point.photo_point_id);
      });
      card.dataset.pointId = point.photo_point_id;
      list.appendChild(template);
    }
  }

  async function openPoint(id) {
    const point = await Store.getPoint(id);
    if (!point) { immediateStatus("That photo point could not be opened.", "error"); return; }
    state.selectedPoint = point;
    await Store.putDraft(ACTIVE_DRAFT, { photo_point_id: id, stage: "POINT_OPEN" });
    await renderSelectedPoint();
    showView("pointView");
    immediateStatus("Photo point open. Start location guidance when you are ready.", "success");
  }

  async function renderSelectedPoint() {
    const point = state.selectedPoint;
    if (!point) return;
    const reference = point.captures[0];
    const latest = point.captures[point.captures.length - 1];
    const referenceUrl = await imageUrlFor(reference);
    $("pointProperty").textContent = point.property_id;
    $("pointHeading").textContent = point.photo_point_id;
    $("pointTarget").textContent = point.target_description || "No target description recorded";
    $("captureCount").textContent = `${point.captures.length} CAPTURE${point.captures.length === 1 ? "" : "S"}`;
    $("referenceImage").src = referenceUrl;
    $("ghostImage").src = referenceUrl;
    $("beforeReview").src = referenceUrl;
    $("referenceHeading").textContent = readingText(reference.orientation.heading_deg, "°");
    $("referenceHeight").textContent = reference.camera.operator_camera_height.availability === "AVAILABLE" ? String(reference.camera.operator_camera_height.value) : "NOT RECORDED";
    if (point.captures.length > 1) {
      $("afterReview").src = await imageUrlFor(latest);
      $("afterReview").hidden = false;
      $("afterCaption").textContent = `${latest.capture_purpose} — ${new Date(latest.captured_at).toLocaleString()}`;
    } else {
      $("afterReview").removeAttribute("src");
      $("afterReview").hidden = true;
      $("afterCaption").textContent = "NO REPEAT CAPTURE YET";
    }
    $("captureTimeline").innerHTML = point.captures.map((capture, index) => `<div><strong>${index === 0 ? "REFERENCE" : capture.capture_purpose}</strong><span>${new Date(capture.captured_at).toLocaleString()}</span><small>${capture.position.availability === "AVAILABLE" ? "GPS recorded" : "GPS unavailable"} · ${capture.orientation.availability === "UNAVAILABLE" ? "orientation unavailable" : "orientation partly recorded"}</small></div>`).join("");
    updateGuidance();
  }

  function sensorSnapshot() {
    const position = state.currentPosition ? {
      latitude: Core.measured(state.currentPosition.latitude, "BROWSER_GEOLOCATION", "REPORTED"),
      longitude: Core.measured(state.currentPosition.longitude, "BROWSER_GEOLOCATION", "REPORTED"),
      accuracy_m: Core.measured(state.currentPosition.accuracy, "BROWSER_GEOLOCATION", "REPORTED")
    } : {};
    const orientation = state.currentOrientation ? {
      heading_deg: Number.isFinite(state.currentOrientation.heading) ? Core.measured(state.currentOrientation.heading, "BROWSER_DEVICE_ORIENTATION", "BROWSER_REPORTED") : Core.unavailable("HEADING_NOT_AVAILABLE"),
      pitch_deg: Number.isFinite(state.currentOrientation.pitch) ? Core.measured(state.currentOrientation.pitch, "BROWSER_DEVICE_ORIENTATION", "DEVICE_TILT_ESTIMATE") : Core.unavailable("PITCH_NOT_AVAILABLE"),
      roll_deg: Number.isFinite(state.currentOrientation.roll) ? Core.measured(state.currentOrientation.roll, "BROWSER_DEVICE_ORIENTATION", "DEVICE_TILT_ESTIMATE") : Core.unavailable("ROLL_NOT_AVAILABLE")
    } : {};
    return { position, orientation };
  }

  function updateGuidance() {
    const point = state.selectedPoint;
    if (!point) return;
    const target = pointPosition(point);
    if (!state.currentPosition || !target) {
      $("distanceValue").textContent = target ? "CURRENT GPS UNAVAILABLE" : "REFERENCE GPS UNAVAILABLE";
      $("directionValue").textContent = "UNKNOWN";
      $("accuracyValue").textContent = state.currentPosition ? `${Math.round(state.currentPosition.accuracy)} m` : "UNKNOWN";
    } else {
      const current = { latitude: state.currentPosition.latitude, longitude: state.currentPosition.longitude };
      const distance = Core.distanceMeters(current, target);
      const bearing = Core.bearingDegrees(current, target);
      $("distanceValue").textContent = distance < 6 ? "AT APPROXIMATE POINT" : `${Math.round(distance)} m`;
      $("directionValue").textContent = `${Math.round(bearing)}°`;
      $("accuracyValue").textContent = `${Math.round(state.currentPosition.accuracy)} m`;
      $("guidanceLimit").textContent = distance <= state.currentPosition.accuracy ? "You are within the current GPS uncertainty. Use the reference photograph and visible landmarks for final placement." : "Walk approximately toward the displayed bearing. Phone GPS is approximate, not surveyed.";
    }
    const heading = state.currentOrientation && state.currentOrientation.heading;
    $("currentHeading").textContent = Number.isFinite(heading) ? `${Math.round(heading)}°` : "UNAVAILABLE";
    $("sensorHeading").textContent = Number.isFinite(heading) ? `${Math.round(heading)}°` : "UNAVAILABLE";
    $("sensorPitch").textContent = Number.isFinite(state.currentOrientation && state.currentOrientation.pitch) ? `${Math.round(state.currentOrientation.pitch)}°` : "UNAVAILABLE";
    $("sensorRoll").textContent = Number.isFinite(state.currentOrientation && state.currentOrientation.roll) ? `${Math.round(state.currentOrientation.roll)}°` : "UNAVAILABLE";
    const referenceHeading = point.captures[0].orientation.heading_deg;
    if (Number.isFinite(heading) && referenceHeading.availability === "AVAILABLE") {
      const difference = Core.angularDifference(heading, Number(referenceHeading.value));
      $("turnDirection").textContent = Math.abs(difference) <= 5 ? "ALIGNED" : `${Math.abs(Math.round(difference))}° ${difference > 0 ? "RIGHT" : "LEFT"}`;
    } else $("turnDirection").textContent = "USE VISIBLE LANDMARKS";
  }

  async function requestOrientation() {
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") throw new Error("Orientation permission was not granted.");
      }
      window.addEventListener("deviceorientation", (event) => {
        const heading = Number.isFinite(event.webkitCompassHeading) ? event.webkitCompassHeading : (Number.isFinite(event.alpha) ? (360 - event.alpha) % 360 : null);
        state.currentOrientation = { heading, pitch: Number.isFinite(event.beta) ? event.beta : null, roll: Number.isFinite(event.gamma) ? event.gamma : null };
        updateGuidance();
      }, { passive: true });
    } catch (error) {
      immediateStatus("Orientation is unavailable. The photo can still be saved.", "warning");
    }
  }

  async function startGuidance() {
    immediateStatus("Tap received. Starting available location and orientation guidance now.");
    await Store.putDraft(ACTIVE_DRAFT, { photo_point_id: state.selectedPoint.photo_point_id, stage: "GUIDANCE_STARTED" });
    requestOrientation();
    if (!navigator.geolocation) { immediateStatus("GPS is unavailable. Continue with the reference photograph and landmarks.", "warning"); return; }
    if (state.locationWatchId !== null) navigator.geolocation.clearWatch(state.locationWatchId);
    state.locationWatchId = navigator.geolocation.watchPosition((position) => {
      state.currentPosition = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, captured_at: new Date(position.timestamp).toISOString() };
      updateGuidance();
      immediateStatus("Location updated. Use the reference photograph for final placement.", "success");
    }, (error) => {
      state.locationWatchId = null;
      immediateStatus(`GPS unavailable (${error.message}). Continue without it; your photo will still save.`, "warning");
      updateGuidance();
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  }

  async function openAlignment() {
    immediateStatus("Tap received. Opening the reference overlay and camera alignment.");
    state.ghostUsed = true;
    $("alignmentPanel").hidden = false;
    await Store.putDraft(ACTIVE_DRAFT, { photo_point_id: state.selectedPoint.photo_point_id, stage: "ALIGNMENT_OPEN" });
    $("alignmentPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      $("cameraPreview").srcObject = state.cameraStream;
      $("cameraUnavailable").hidden = true;
    } catch (error) {
      $("cameraUnavailable").hidden = false;
      immediateStatus("Live camera preview is unavailable. TAKE REPEAT PHOTO still works and saving does not require sensors.", "warning");
    }
  }

  function stopCamera() {
    if (state.cameraStream) state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
    $("cameraPreview").srcObject = null;
  }

  async function saveCaptureFile(file, kind) {
    if (!file) return;
    immediateStatus("Photograph received. Saving the original bytes now.");
    const blobId = `BLOB-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
    const hash = await sha256Hex(file);
    await Store.putBlob({ blob_id: blobId, blob: file, mime_type: file.type, byte_size: file.size, sha256: hash, immutable: true });
    const readBack = await Store.getBlob(blobId);
    if (!readBack || readBack.blob.size !== file.size || readBack.sha256 !== hash) throw new Error("Photograph read-back verification failed.");
    const sensors = sensorSnapshot();
    if (kind === "REFERENCE") {
      const propertyId = $("newPropertyId").value.trim();
      if (!propertyId) throw new Error("Property ID is required.");
      const cameraHeight = $("newCameraHeight").value.trim();
      const point = Core.createPhotoPoint({
        property_id: propertyId,
        target_description: $("newTarget").value.trim(),
        notes: $("newNotes").value.trim(),
        provenance: { source: "FIELD_CAPTURE", created_with: "REPEAT_PHOTO_POC_V1" },
        original_capture: {
          capture_purpose: "BEFORE",
          image: { blob_id: blobId, original_file_name: file.name, mime_type: file.type, byte_size: file.size, sha256: hash, source: "USER_CAPTURED" },
          ...sensors,
          camera: { operator_camera_height: cameraHeight ? Core.measured(`${cameraHeight} ${$("newCameraHeightUnit").value}`, "OPERATOR_ENTRY", "OPERATOR_REPORTED") : Core.unavailable("CAMERA_HEIGHT_NOT_ENTERED") },
          target_description: $("newTarget").value.trim(),
          notes: $("newNotes").value.trim(),
          provenance: { created_by: "FIELD_OPERATOR", created_with: "REPEAT_PHOTO_POC_V1", captured_offline: !navigator.onLine }
        }
      });
      await Store.putPoint(point);
      state.selectedPoint = point;
    } else {
      const updated = Core.addRepeatCapture(state.selectedPoint, {
        capture_purpose: $("repeatPurpose").value,
        image: { blob_id: blobId, original_file_name: file.name, mime_type: file.type, byte_size: file.size, sha256: hash, source: "USER_CAPTURED" },
        ...sensors,
        camera: {},
        target_description: state.selectedPoint.target_description,
        framing: { reference_capture_id: state.selectedPoint.reference_capture_id, ghost_overlay_used: state.ghostUsed, operator_alignment_notes: $("alignmentNote").value.trim() },
        provenance: { created_by: "FIELD_OPERATOR", created_with: "REPEAT_PHOTO_POC_V1", captured_offline: !navigator.onLine }
      });
      await Store.putPoint(updated);
      state.selectedPoint = updated;
    }
    await Store.removeDraft(ACTIVE_DRAFT);
    await reloadPoints();
    await renderSelectedPoint();
    showView("pointView");
    stopCamera();
    $("alignmentPanel").hidden = true;
    immediateStatus("Saved and verified. Original reference photograph was not changed.", "success");
  }

  async function exportAll() {
    immediateStatus("Tap received. Creating a copy of the photo-point records.");
    const points = await Store.getAllPoints();
    const blobs = await Store.getAllBlobs();
    const attachments = [];
    for (const record of blobs) attachments.push({ blob_id: record.blob_id, mime_type: record.mime_type, byte_size: record.byte_size, sha256: record.sha256, base64: await blobToBase64(record.blob), immutable: true });
    const bundle = Core.exportBundle(points, attachments);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PROPERTY_INTELLIGENCE_PHOTO_POINTS_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    immediateStatus("Photo-point copy is ready. Active field work was not ended.", "success");
  }

  async function importAll(file) {
    immediateStatus("File received. Validating every record before importing.");
    const parsed = JSON.parse(await file.text());
    const imported = Core.importBundle(parsed);
    for (const attachment of imported.attachments) {
      if (!attachment.blob_id || !attachment.base64 || !attachment.sha256) throw new Error("Malformed attachment in import.");
      const blob = base64ToBlob(attachment.base64, attachment.mime_type);
      const hash = await sha256Hex(blob);
      if (hash !== attachment.sha256) throw new Error(`Attachment hash mismatch: ${attachment.blob_id}`);
      await Store.putBlob({ ...attachment, blob });
    }
    for (const point of imported.photo_points) {
      const existing = await Store.getPoint(point.photo_point_id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(point)) throw new Error(`Conflicting existing photo point: ${point.photo_point_id}`);
      if (!existing) await Store.putPoint(point);
    }
    await reloadPoints();
    immediateStatus("Import complete. Existing immutable records were not overwritten.", "success");
  }

  function bindEvents() {
    $("createPoint").addEventListener("click", () => { immediateStatus("Tap received. Ready to establish a new reference photograph."); showView("createView"); });
    document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", () => { immediateStatus("Returning to photo points."); stopCamera(); showView("pointsView"); }));
    $("takeReferencePhoto").addEventListener("click", () => { immediateStatus("Tap received. Opening the camera for the reference photograph."); $("referenceFile").click(); });
    $("referenceFile").addEventListener("change", async (event) => { try { await saveCaptureFile(event.target.files[0], "REFERENCE"); } catch (error) { immediateStatus(`Reference photo is still safe on your phone. ${error.message}`, "error"); } finally { event.target.value = ""; } });
    $("startGuidance").addEventListener("click", startGuidance);
    $("openAlignment").addEventListener("click", openAlignment);
    $("closeAlignment").addEventListener("click", () => { immediateStatus("Alignment closed. Nothing was deleted."); stopCamera(); $("alignmentPanel").hidden = true; });
    $("takeRepeatPhoto").addEventListener("click", () => { immediateStatus("Tap received. Opening the camera for a new immutable repeat photograph."); $("repeatFile").click(); });
    $("repeatFile").addEventListener("change", async (event) => { try { await saveCaptureFile(event.target.files[0], "REPEAT"); } catch (error) { immediateStatus(`Repeat photo was not committed. Keep this page open and try again. ${error.message}`, "error"); } finally { event.target.value = ""; } });
    $("ghostOpacity").addEventListener("input", (event) => { const opacity = Number(event.target.value); $("ghostImage").style.opacity = String(opacity / 100); $("opacityValue").textContent = `${opacity}%`; });
    $("resumeSession").addEventListener("click", async () => { immediateStatus("Tap received. Resuming the unfinished photo point."); const draft = await Store.getDraft(ACTIVE_DRAFT); if (draft && draft.value && draft.value.photo_point_id) openPoint(draft.value.photo_point_id); });
    $("exportPoints").addEventListener("click", () => exportAll().catch((error) => immediateStatus(`Export failed; records remain saved. ${error.message}`, "error")));
    $("importPoints").addEventListener("click", () => { immediateStatus("Tap received. Choose the photo-point backup file."); $("importFile").click(); });
    $("importFile").addEventListener("change", async (event) => { try { await importAll(event.target.files[0]); } catch (error) { immediateStatus(`Import rejected without changing existing records. ${error.message}`, "error"); } finally { event.target.value = ""; } });
    window.addEventListener("online", updateConnectionBadge);
    window.addEventListener("offline", updateConnectionBadge);
    document.addEventListener("visibilitychange", () => { if (document.hidden && state.selectedPoint) Store.putDraft(ACTIVE_DRAFT, { photo_point_id: state.selectedPoint.photo_point_id, stage: $("alignmentPanel").hidden ? "POINT_OPEN" : "ALIGNMENT_OPEN" }); });
  }

  function updateConnectionBadge() {
    $("offlineBadge").textContent = navigator.onLine ? "OFFLINE STORAGE READY" : "OFFLINE — SAVING LOCALLY";
    $("offlineBadge").dataset.offline = navigator.onLine ? "false" : "true";
  }

  async function initialize() {
    bindEvents();
    immediateStatus("Opening isolated photo-point storage.");
    await Store.healthCheck();
    await reloadPoints();
    const draft = await Store.getDraft(ACTIVE_DRAFT);
    $("resumeBanner").hidden = !(draft && draft.value && draft.value.photo_point_id);
    updateConnectionBadge();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
    immediateStatus("Ready. Choose a permanent photo point.", "success");
  }

  initialize().catch((error) => immediateStatus(`Prototype could not open its isolated storage. ${error.message}`, "error"));
})();
