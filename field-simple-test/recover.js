(function () {
  "use strict";

  const STATE_KEY = "propertyInspectorHomeTest313V1";
  const LEGACY_STATE_KEY = "propertyInspectorHomeTest313LegacyDisabled";
  const DB_NAME = "property-inspector-home-test-313-evidence";
  const PENDING_CACHE = "property-inspector-home-test-313-pending-v1";
  const PACKAGE_VERSION = "raw-recovery-1.0";
  const exportButton = document.getElementById("export");
  const status = document.getElementById("status");
  const download = document.getElementById("download");
  let archiveUrl = null;

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
    if (type.includes("json")) return "json";
    return fallback || "bin";
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("The evidence database could not be opened."));
      request.onblocked = () => reject(new Error("The evidence database is blocked. Close other Property Inspector tabs and reopen this recovery page."));
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

  async function extractBinary(value, path, zip, inventory) {
    if (value instanceof Blob) {
      const filePath = `${path}.${extension(value)}`;
      const hash = await InspectionPackage.sha256Hex(value);
      zip.add(filePath, value, { modifiedAt: new Date() });
      inventory.files.push({ path: filePath, byte_size: value.size, mime_type: value.type || "application/octet-stream", sha256: hash, read_back: true });
      return { binary_file: filePath, byte_size: value.size, mime_type: value.type || "application/octet-stream", sha256: hash };
    }
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const blob = new Blob([value instanceof ArrayBuffer ? value : value.buffer], { type: "application/octet-stream" });
      return extractBinary(blob, path, zip, inventory);
    }
    if (Array.isArray(value)) {
      const result = [];
      for (let index = 0; index < value.length; index += 1) result.push(await extractBinary(value[index], `${path}_${index + 1}`, zip, inventory));
      return result;
    }
    if (value && typeof value === "object") {
      if (value instanceof Date) return value.toISOString();
      const result = {};
      for (const key of Object.keys(value)) result[key] = await extractBinary(value[key], `${path}_${safeName(key, "field")}`, zip, inventory);
      return result;
    }
    return value;
  }

  async function exportCache(zip, inventory, errors) {
    if (!("caches" in window)) return [];
    const names = await caches.keys();
    const selected = names.filter(name => name === PENDING_CACHE || /pending/i.test(name));
    const records = [];
    for (const cacheName of selected) {
      try {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        for (let index = 0; index < requests.length; index += 1) {
          const request = requests[index];
          const response = await cache.match(request);
          const blob = response ? await response.blob() : new Blob([]);
          const filePath = `cache-storage/${safeName(cacheName, "cache")}/${String(index + 1).padStart(4, "0")}.${extension(blob)}`;
          const hash = await InspectionPackage.sha256Hex(blob);
          zip.add(filePath, blob, { modifiedAt: new Date() });
          inventory.files.push({ path: filePath, byte_size: blob.size, mime_type: blob.type || "application/octet-stream", sha256: hash, read_back: true });
          records.push({ cache_name: cacheName, request_url: request.url, request_method: request.method, response_status: response ? response.status : null, response_headers: response ? Object.fromEntries(response.headers.entries()) : {}, file: filePath, byte_size: blob.size, sha256: hash });
        }
      } catch (error) {
        errors.push({ storage_location: `Cache Storage/${cacheName}`, error: error.message, recorded_at: new Date().toISOString() });
      }
    }
    return records;
  }

  async function createArchive() {
    if (!window.InspectionPackage || !InspectionPackage.ZipBuilder) throw new Error("Recovery ZIP code did not load. Reopen this page while connected to the internet.");
    const zip = new InspectionPackage.ZipBuilder();
    const generatedAt = new Date().toISOString();
    const rawState = localStorage.getItem(STATE_KEY);
    const rawLegacy = localStorage.getItem(LEGACY_STATE_KEY);
    const inventory = { schema_name: "property-inspector-read-only-recovery-inventory", schema_version: PACKAGE_VERSION, generated_at: generatedAt, source_origin: location.origin, local_storage_key: STATE_KEY, indexeddb_name: DB_NAME, destructive_actions_performed: false, records_by_store: {}, files: [] };
    const errors = [];
    zip.add("raw-localStorage/propertyInspectorHomeTest313V1.txt", rawState == null ? "" : rawState, { modifiedAt: new Date() });
    zip.add("raw-localStorage/propertyInspectorHomeTest313LegacyDisabled.txt", rawLegacy == null ? "" : rawLegacy, { modifiedAt: new Date() });
    zip.add("raw-localStorage/LOCAL_STORAGE_SNAPSHOT.json", JSON.stringify({ [STATE_KEY]: rawState, [LEGACY_STATE_KEY]: rawLegacy }, null, 2) + "\n", { modifiedAt: new Date() });

    let database;
    try {
      database = await openDatabase();
      inventory.indexeddb_version = database.version;
      inventory.object_store_names = Array.from(database.objectStoreNames);
      for (const storeName of inventory.object_store_names) {
        status.textContent = `Reading saved ${storeName} records…`;
        try {
          const records = await readStore(database, storeName);
          inventory.records_by_store[storeName] = records.length;
          const exported = [];
          for (let index = 0; index < records.length; index += 1) {
            const record = records[index];
            const id = safeName(record.value && (record.value.id || record.value.key) || record.key || index + 1, `record_${index + 1}`);
            exported.push({ key: record.key, value: await extractBinary(record.value, `indexeddb/${safeName(storeName)}/${id}`, zip, inventory) });
            if (index % 5 === 0) status.textContent = `Reading ${storeName}: ${index + 1} of ${records.length}…`;
          }
          zip.add(`raw-indexeddb/${safeName(storeName)}.json`, JSON.stringify(exported, null, 2) + "\n", { modifiedAt: new Date() });
        } catch (error) {
          errors.push({ storage_location: `IndexedDB/${storeName}`, error: error.message, recorded_at: new Date().toISOString() });
        }
      }
    } catch (error) {
      errors.push({ storage_location: `IndexedDB/${DB_NAME}`, error: error.message, recorded_at: new Date().toISOString() });
    } finally {
      if (database) database.close();
    }

    status.textContent = "Reading any pending evidence cache…";
    const cacheRecords = await exportCache(zip, inventory, errors);
    zip.add("raw-cache-storage/cache-records.json", JSON.stringify(cacheRecords, null, 2) + "\n", { modifiedAt: new Date() });
    inventory.total_binary_files = inventory.files.length;
    inventory.total_binary_bytes = inventory.files.reduce((sum, item) => sum + item.byte_size, 0);
    inventory.local_storage_record_present = rawState != null;
    inventory.recovery_errors = errors.length;
    zip.add("RECOVERY_INVENTORY.json", JSON.stringify(inventory, null, 2) + "\n", { modifiedAt: new Date() });
    zip.add("RECOVERY_ERRORS.json", JSON.stringify(errors, null, 2) + "\n", { modifiedAt: new Date() });
    zip.add("README.txt", "READ-ONLY RAW RECOVERY ARCHIVE\n\nThis ZIP is a byte-preserving export of the isolated Property Inspector test storage. It does not imply that incomplete records are complete or that nearby evidence belongs together. The phone data was not cleared, migrated, renamed, or rewritten.\n", { modifiedAt: new Date() });
    status.textContent = "Building the recovery ZIP. Keep Safari open…";
    const blob = await zip.build();
    const hash = await InspectionPackage.sha256Hex(blob);
    return { blob, hash, inventory, errors, filename: `PROPERTY_INSPECTOR_RAW_RECOVERY_${generatedAt.replace(/[-:.]/g, "").replace("Z", "Z")}.zip` };
  }

  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    download.style.display = "none";
    status.textContent = "Opening the saved inspection without changing it…";
    try {
      const result = await createArchive();
      if (archiveUrl) URL.revokeObjectURL(archiveUrl);
      archiveUrl = URL.createObjectURL(result.blob);
      download.href = archiveUrl;
      download.download = result.filename;
      download.style.display = "block";
      status.textContent = `RECOVERY ZIP IS READY\n${result.filename}\n${(result.blob.size / 1048576).toFixed(1)} MB\n${result.inventory.total_binary_files} binary evidence files\nSHA-256: ${result.hash}\n\nTap the yellow DOWNLOAD RECOVERY ZIP button.`;
    } catch (error) {
      status.textContent = `RECOVERY ZIP WAS NOT CREATED\nYour inspection is still saved.\n${error.message}\n\nDo not press Clear.`;
      exportButton.disabled = false;
    }
  });
})();
