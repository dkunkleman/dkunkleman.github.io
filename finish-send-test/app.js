(function () {
  "use strict";

  const STATE_KEY = "propertyInspectorHomeTest313V1";
  const LEGACY_STATE_KEY = "propertyInspectorHomeTest313LegacyDisabled";
  const DB_NAME = "property-inspector-home-test-313-evidence";
  const PENDING_CACHE = "property-inspector-home-test-313-pending-v1";
  const SEND_STATE_KEY = "propertyInspectorFinishSendTestStateV1";
  const UPLOAD_STATE_KEY = "propertyInspectorFinishSendTestUploadV1";
  const AUTH_STATE_KEY = "propertyInspectorFinishSendTestDropboxAuthV1";
  const OAUTH_STATE_KEY = "propertyInspectorFinishSendTestDropboxOauthV1";
  const FORMAT_VERSION = "raw-recovery-finish-send-1.0";
  const button = document.getElementById("finishSend");
  const evidenceInventory = document.getElementById("evidenceInventory");
  const stage = document.getElementById("stage");
  const detail = document.getElementById("detail");
  const appKey = (document.querySelector('meta[name="dropbox-app-key"]') || {}).content || "";
  let running = null;
  let inventoryConfirmed = false;
  const EXPECTED_BINARY_FILES = 133;

  function readState() {
    try { return JSON.parse(localStorage.getItem(SEND_STATE_KEY) || "null"); }
    catch (error) { return null; }
  }

  function writeState(value) {
    localStorage.setItem(SEND_STATE_KEY, JSON.stringify(value));
    return value;
  }

  function createState() {
    const existing = readState();
    if (existing) return existing;
    const now = new Date().toISOString();
    return writeState({ schema_name: "property-inspector-finish-send-test-state", schema_version: "1.0", stage: "CREATING_PACKAGE", package_created_at: now, filename: `PROPERTY_INSPECTOR_RAW_RECOVERY_${now.replace(/[-:.]/g, "")}.zip`, byte_size: null, sha256: null, dropbox_content_hash: null, receipt: null, last_error: null, updated_at: now });
  }

  function show(nextStage, message, progress) {
    const state = readState();
    stage.textContent = nextStage === "RECEIVED" ? "RECEIVED AND VERIFIED" : nextStage.replace(/_/g, " ");
    if (message) detail.textContent = message;
    else if (nextStage === "CREATING_PACKAGE") detail.textContent = "Saving every original photograph, GPS point, voice note, measurement, observation, incomplete session, and storage record into one archive.";
    else if (nextStage === "UPLOADING") detail.textContent = progress && progress.total ? `${Math.floor((progress.loaded / progress.total) * 100)}% uploaded — ${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}. If Safari closes or service drops, reopen this same link. It will continue automatically.` : "Uploading the complete archive. It will continue automatically after weak service or reopening.";
    else if (nextStage === "VERIFYING") detail.textContent = "Checking the remote byte size and content hash before declaring success.";
    else if (nextStage === "RECEIVED" && state && state.receipt) detail.textContent = `${state.receipt.filename}\n${state.receipt.dropbox_path}\n${formatBytes(state.receipt.byte_size)}\nSHA-256: ${state.receipt.sha256}\nCompleted: ${state.receipt.completion_time}`;
    button.disabled = !inventoryConfirmed || Boolean(running) || nextStage === "RECEIVED";
    button.textContent = nextStage === "RECEIVED" ? "RECEIVED AND VERIFIED" : "FINISH & SEND";
  }

  function updateState(nextStage, additions) {
    const state = createState();
    Object.assign(state, additions || {}, { stage: nextStage, updated_at: new Date().toISOString() });
    writeState(state);
    show(nextStage);
    return state;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(Number(bytes))) return "unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function safeName(value, fallback) {
    const cleaned = String(value || fallback || "record").replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
    return cleaned || fallback || "record";
  }

  function extension(blob, fallback) {
    const type = String(blob && blob.type || "").toLowerCase();
    if (type.includes("jpeg")) return "jpg";
    if (type.includes("png")) return "png";
    if (type.includes("heic")) return "heic";
    if (type.includes("webp")) return "webp";
    if (type.includes("mp4")) return "m4a";
    if (type.includes("mpeg")) return "mp3";
    if (type.includes("wav")) return "wav";
    if (type.includes("ogg")) return "ogg";
    return fallback || "bin";
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onupgradeneeded = () => {
        request.transaction.abort();
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("The saved evidence database could not be opened."));
      request.onblocked = () => reject(new Error("Close other Property Inspector tabs, then reopen this page. Your evidence remains safe."));
    });
  }

  function readStore(database, storeName) {
    return new Promise((resolve, reject) => {
      const records = [];
      let transaction;
      try { transaction = database.transaction(storeName, "readonly"); }
      catch (error) { reject(error); return; }
      const request = transaction.objectStore(storeName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        records.push({ key: cursor.primaryKey, value: cursor.value });
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error(`${storeName} could not be read.`));
      transaction.oncomplete = () => resolve(records);
      transaction.onerror = () => reject(transaction.error || new Error(`${storeName} could not be read.`));
      transaction.onabort = () => reject(transaction.error || new Error(`${storeName} read was interrupted.`));
    });
  }

  function retryableDatabaseError(error) {
    const name = String(error && error.name || "");
    const message = String(error && error.message || error || "").toLowerCase();
    return ["InvalidStateError", "AbortError", "TransactionInactiveError", "UnknownError"].includes(name) || message.includes("closing") || message.includes("closed") || message.includes("connection");
  }

  async function databaseDescription() {
    let database;
    try {
      database = await openDatabase();
      return { version: database.version, storeNames: Array.from(database.objectStoreNames) };
    } finally {
      if (database) database.close();
    }
  }

  async function readStoreSafely(storeName) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let database;
      try {
        database = await openDatabase();
        return await readStore(database, storeName);
      } catch (error) {
        lastError = error;
        if (attempt > 0 || !retryableDatabaseError(error)) throw error;
      } finally {
        if (database) database.close();
      }
    }
    throw lastError;
  }

  function binarySummary(value, summary) {
    if (value instanceof Blob) {
      summary.count += 1;
      summary.bytes += value.size;
      return;
    }
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      summary.count += 1;
      summary.bytes += value.byteLength;
      return;
    }
    if (Array.isArray(value)) { value.forEach(item => binarySummary(item, summary)); return; }
    if (value && typeof value === "object" && !(value instanceof Date)) Object.values(value).forEach(item => binarySummary(item, summary));
  }

  async function inventorySavedEvidence() {
    const raw = localStorage.getItem(STATE_KEY);
    let local = {};
    try { local = JSON.parse(raw || "{}"); } catch (error) { local = {}; }
    const summary = { count: 0, bytes: 0 };
    const stores = {};
    const description = await databaseDescription();
    for (const storeName of description.storeNames) {
      const records = await readStoreSafely(storeName);
      stores[storeName] = records;
      records.forEach(record => binarySummary(record.value, summary));
    }
    if ("caches" in window) {
      const names = (await caches.keys()).filter(name => name === PENDING_CACHE || /pending/i.test(name));
      for (const name of names) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) { const blob = await response.blob(); summary.count += 1; summary.bytes += blob.size; }
        }
      }
    }
    const photos = stores.photos || [];
    const originalPhotos = photos.filter(record => record.value && record.value.originalBlob instanceof Blob && record.value.originalBlob.size > 0).length;
    const analysisPhotos = photos.filter(record => record.value && record.value.analysisBlob instanceof Blob && record.value.analysisBlob.size > 0).length;
    const voiceNotes = (stores.voiceNotes || []).filter(record => record.value && record.value.audioBlob instanceof Blob && record.value.audioBlob.size > 0).length;
    const gpsPoints = Math.max((stores.gpsPoints || []).length, Array.isArray(local.points) ? local.points.length : 0);
    const observations = Array.isArray(local.markers) ? local.markers.length : 0;
    const measurements = Array.isArray(local.measurements) ? local.measurements.length : 0;
    const sessions = Array.isArray(local.simple_sessions) ? local.simple_sessions.length : 0;
    const orientation = Array.isArray(local.orientation_samples) ? local.orientation_samples.length : 0;
    return { binaryFiles: summary.count, binaryBytes: summary.bytes, originalPhotos, analysisPhotos, voiceNotes, gpsPoints, observations, measurements, sessions, orientation, localStoragePresent: raw != null };
  }

  function displayInventory(found) {
    const matches = found.localStoragePresent && found.binaryFiles === EXPECTED_BINARY_FILES;
    evidenceInventory.textContent = `SAVED EVIDENCE FOUND\nOriginal photographs: ${found.originalPhotos}\nAnalysis photographs: ${found.analysisPhotos}\nVoice recordings: ${found.voiceNotes}\nGPS points: ${found.gpsPoints}\nObservations: ${found.observations}\nMeasurements: ${found.measurements}\nFeature sessions: ${found.sessions}\nOrientation samples: ${found.orientation}\nAll binary evidence files: ${found.binaryFiles} (${formatBytes(found.binaryBytes)})\n\nReference recovery count: ${EXPECTED_BINARY_FILES}\n${matches ? "COUNT MATCHES — READY TO SEND" : "COUNT DOES NOT MATCH — DO NOT SEND"}`;
    evidenceInventory.style.whiteSpace = "pre-wrap";
    inventoryConfirmed = matches;
    button.disabled = !matches || Boolean(running);
    if (!matches) show("COUNT_DOES_NOT_MATCH", "The phone count does not match the 133 files shown by the successful recovery screen. Nothing was changed or sent.");
    return matches;
  }

  async function extractBinary(value, path, zip, inventory, modifiedAt) {
    if (value instanceof Blob) {
      const filePath = `${path}.${extension(value)}`;
      const hash = await InspectionPackage.sha256Hex(value);
      zip.add(filePath, value, { modifiedAt });
      inventory.files.push({ path: filePath, byte_size: value.size, mime_type: value.type || "application/octet-stream", sha256: hash, read_back: true });
      return { binary_file: filePath, byte_size: value.size, mime_type: value.type || "application/octet-stream", sha256: hash };
    }
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const bytes = value instanceof ArrayBuffer ? value : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      return extractBinary(new Blob([bytes], { type: "application/octet-stream" }), path, zip, inventory, modifiedAt);
    }
    if (Array.isArray(value)) {
      const result = [];
      for (let index = 0; index < value.length; index += 1) result.push(await extractBinary(value[index], `${path}_${index + 1}`, zip, inventory, modifiedAt));
      return result;
    }
    if (value && typeof value === "object") {
      if (value instanceof Date) return value.toISOString();
      const result = {};
      for (const key of Object.keys(value)) result[key] = await extractBinary(value[key], `${path}_${safeName(key, "field")}`, zip, inventory, modifiedAt);
      return result;
    }
    return value;
  }

  async function exportPendingCache(zip, inventory, errors, modifiedAt) {
    if (!("caches" in window)) return [];
    const names = (await caches.keys()).filter(name => name === PENDING_CACHE || /pending/i.test(name));
    const records = [];
    for (const cacheName of names) {
      try {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        for (let index = 0; index < requests.length; index += 1) {
          const request = requests[index];
          const response = await cache.match(request);
          const blob = response ? await response.blob() : new Blob([]);
          const filePath = `cache-storage/${safeName(cacheName, "cache")}/${String(index + 1).padStart(4, "0")}.${extension(blob)}`;
          const hash = await InspectionPackage.sha256Hex(blob);
          zip.add(filePath, blob, { modifiedAt });
          inventory.files.push({ path: filePath, byte_size: blob.size, mime_type: blob.type || "application/octet-stream", sha256: hash, read_back: true });
          records.push({ cache_name: cacheName, request_url: request.url, response_status: response ? response.status : null, file: filePath, byte_size: blob.size, sha256: hash });
        }
      } catch (error) {
        errors.push({ storage_location: `Cache Storage/${cacheName}`, error: error.message, recorded_at: modifiedAt.toISOString() });
      }
    }
    return records;
  }

  async function createArchive(sendState) {
    if (!window.InspectionPackage || !InspectionPackage.ZipBuilder) throw new Error("Archive code did not load. Reopen this page with service.");
    const zip = new InspectionPackage.ZipBuilder();
    const generatedAt = sendState.package_created_at;
    const modifiedAt = new Date(generatedAt);
    const rawState = localStorage.getItem(STATE_KEY);
    const rawLegacy = localStorage.getItem(LEGACY_STATE_KEY);
    const inventory = { schema_name: "property-inspector-read-only-recovery-inventory", schema_version: FORMAT_VERSION, generated_at: generatedAt, source_origin: location.origin, local_storage_key: STATE_KEY, indexeddb_name: DB_NAME, destructive_actions_performed: false, records_by_store: {}, files: [] };
    const errors = [];
    zip.add("raw-localStorage/propertyInspectorHomeTest313V1.txt", rawState == null ? "" : rawState, { modifiedAt });
    zip.add("raw-localStorage/propertyInspectorHomeTest313LegacyDisabled.txt", rawLegacy == null ? "" : rawLegacy, { modifiedAt });
    zip.add("raw-localStorage/LOCAL_STORAGE_SNAPSHOT.json", JSON.stringify({ [STATE_KEY]: rawState, [LEGACY_STATE_KEY]: rawLegacy }, null, 2) + "\n", { modifiedAt });
    try {
      const description = await databaseDescription();
      inventory.indexeddb_version = description.version;
      inventory.object_store_names = description.storeNames;
      for (const storeName of inventory.object_store_names) {
        show("CREATING_PACKAGE", `Reading saved ${storeName} records…`);
        try {
          const records = await readStoreSafely(storeName);
          inventory.records_by_store[storeName] = records.length;
          const exported = [];
          for (let index = 0; index < records.length; index += 1) {
            const record = records[index];
            const id = safeName(record.value && (record.value.id || record.value.key) || record.key || index + 1, `record_${index + 1}`);
            exported.push({ key: record.key, value: await extractBinary(record.value, `indexeddb/${safeName(storeName)}/${id}`, zip, inventory, modifiedAt) });
            if (index % 5 === 0) show("CREATING_PACKAGE", `Reading ${storeName}: ${index + 1} of ${records.length}…`);
          }
          zip.add(`raw-indexeddb/${safeName(storeName)}.json`, JSON.stringify(exported, null, 2) + "\n", { modifiedAt });
        } catch (error) {
          errors.push({ storage_location: `IndexedDB/${storeName}`, error: error.message, recorded_at: generatedAt });
        }
      }
    } catch (error) {
      errors.push({ storage_location: `IndexedDB/${DB_NAME}`, error: error.message, recorded_at: generatedAt });
    }
    show("CREATING_PACKAGE", "Reading any pending evidence cache…");
    const cacheRecords = await exportPendingCache(zip, inventory, errors, modifiedAt);
    zip.add("raw-cache-storage/cache-records.json", JSON.stringify(cacheRecords, null, 2) + "\n", { modifiedAt });
    inventory.total_binary_files = inventory.files.length;
    inventory.total_binary_bytes = inventory.files.reduce((sum, item) => sum + item.byte_size, 0);
    inventory.local_storage_record_present = rawState != null;
    inventory.recovery_errors = errors.length;
    if (errors.length) throw new Error("The complete archive could not be read. Your inspection remains safe. Reopen this page and tap FINISH & SEND again.");
    if (inventory.total_binary_files !== EXPECTED_BINARY_FILES || inventory.files.some(file => !file.read_back)) throw new Error(`The archive read-back count is ${inventory.total_binary_files}, not ${EXPECTED_BINARY_FILES}. Nothing was sent and your inspection remains safe.`);
    zip.add("RECOVERY_INVENTORY.json", JSON.stringify(inventory, null, 2) + "\n", { modifiedAt });
    zip.add("RECOVERY_ERRORS.json", JSON.stringify(errors, null, 2) + "\n", { modifiedAt });
    zip.add("README.txt", "READ-ONLY RAW RECOVERY ARCHIVE\n\nThis ZIP is a byte-preserving export of the isolated Property Inspector storage. It does not imply that incomplete records are complete or that nearby evidence belongs together. The phone data was not cleared, migrated, renamed, or rewritten.\n", { modifiedAt });
    show("CREATING_PACKAGE", "Building the complete recovery archive. Keep Safari open…");
    const blob = await zip.build();
    return { blob, inventory, errors, filename: sendState.filename };
  }

  const auth = FinishSend.createDropboxPkceAuth({ clientId: appKey.trim(), authKey: AUTH_STATE_KEY, oauthKey: OAUTH_STATE_KEY });
  const uploader = FinishSend.createUploader({ auth, checkpointKey: UPLOAD_STATE_KEY });

  async function run() {
    if (running) return running;
    button.disabled = true;
    running = (async () => {
      try {
        if (!inventoryConfirmed) throw new Error("Saved evidence count has not been verified. Nothing was sent.");
        const sendState = createState();
        if (sendState.stage === "RECEIVED" && sendState.receipt) { show("RECEIVED"); return sendState.receipt; }
        button.disabled = true;
        updateState("CONNECTING_TO_DROPBOX", { last_error: null });
        show("CONNECTING_TO_DROPBOX", "Opening the secure Dropbox connection. Your inspection remains saved on this phone.");
        await auth.getAccessToken();
        updateState("CREATING_PACKAGE", { last_error: null });
        const result = await createArchive(sendState);
        show("CREATING_PACKAGE", "Hashing the archive before upload…");
        const hashes = await FinishSend.hashArchive(result.blob, (loaded, total) => show("CREATING_PACKAGE", `Hashing the complete archive: ${Math.floor((loaded / total) * 100)}%…`));
        updateState("UPLOADING", { filename: result.filename, byte_size: hashes.byteSize, sha256: hashes.sha256, dropbox_content_hash: hashes.dropboxContentHash, original_binary_file_count: result.inventory.total_binary_files, original_binary_read_back_count: result.inventory.files.filter(file => file.read_back).length, recovery_error_count: result.errors.length, last_error: null });
        const receipt = await uploader.upload(result.blob, { filename: result.filename, inspectionId: "property-inspector-saved-phone-evidence", sha256: hashes.sha256, dropboxContentHash: hashes.dropboxContentHash }, (nextStage, loaded, total, verifiedReceipt) => {
          show(nextStage, null, { loaded, total });
          if (nextStage !== "UPLOADING") updateState(nextStage, verifiedReceipt ? { receipt: verifiedReceipt } : null);
        });
        updateState("RECEIVED", { receipt, last_error: null });
        show("RECEIVED");
        return receipt;
      } catch (error) {
        const state = createState();
        state.last_error = error && error.message ? error.message : String(error);
        state.updated_at = new Date().toISOString();
        writeState(state);
        show(state.stage || "UPLOADING", `Your inspection is safe on this phone. Sending will resume automatically when possible.\n\n${state.last_error}`);
        throw error;
      } finally {
        running = null;
        const state = readState();
        if ((!state || state.stage !== "RECEIVED") && inventoryConfirmed) button.disabled = false;
      }
    })();
    return running;
  }

  button.addEventListener("click", event => {
    event.preventDefault();
    if (running) return;
    stage.textContent = "STARTING";
    detail.textContent = "Your tap was received. Starting FINISH & SEND now.";
    button.disabled = true;
    window.setTimeout(() => { run().catch(() => {}); }, 0);
  });
  window.addEventListener("online", () => { const state = readState(); if (state && state.stage !== "RECEIVED") run().catch(() => {}); });
  window.addEventListener("beforeunload", event => { if (running) { event.preventDefault(); event.returnValue = ""; } });

  (async () => {
    try { await auth.completeRedirect(); }
    catch (error) { show("CREATING_PACKAGE", `Your inspection is safe. Dropbox connection did not complete.\n\n${error.message}`); }
    let found;
    try { found = await inventorySavedEvidence(); if (!displayInventory(found)) return; }
    catch (error) { evidenceInventory.textContent = `SAVED EVIDENCE COULD NOT BE COUNTED\n${error.message}\nNothing was changed or sent.`; button.disabled = true; show("COUNT_DOES_NOT_MATCH", "The saved evidence could not be verified. Nothing was changed or sent."); return; }
    const state = readState();
    if (state && state.stage === "RECEIVED" && state.receipt) show("RECEIVED");
    else if (state) { show(state.stage || "CREATING_PACKAGE", state.last_error ? `Your inspection is safe on this phone.\n\n${state.last_error}` : null); if (navigator.onLine) run().catch(() => {}); }
    else show("READY", "Your saved photographs, GPS, voice notes, measurements, and records will remain on this phone.");
  })();
})();
