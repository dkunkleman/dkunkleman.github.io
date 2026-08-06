(function () {
  "use strict";
  const geo = navigator && navigator.geolocation;
  if (!geo || geo.__propertyInspectorGpsFallbackInstalled) return;
  const nativeGetCurrentPosition = geo.getCurrentPosition.bind(geo);
  const original = geo.getCurrentPosition;
  geo.getCurrentPosition = function (success, error, options) {
    const requested = Object.assign({}, options || {});
    if (!requested.enableHighAccuracy) return nativeGetCurrentPosition(success, error, requested);
    let settled = false;
    const succeed = position => {
      if (settled) return;
      settled = true;
      success(position);
    };
    const fail = firstError => {
      if (settled) return;
      const fallback = {
        enableHighAccuracy: false,
        maximumAge: Math.max(Number(requested.maximumAge) || 0, 15000),
        timeout: 8000
      };
      nativeGetCurrentPosition(succeed, secondError => {
        if (settled) return;
        settled = true;
        if (typeof error === "function") error(secondError || firstError);
      }, fallback);
    };
    requested.timeout = Math.min(Number(requested.timeout) || 8000, 8000);
    nativeGetCurrentPosition(succeed, fail, requested);
  };
  try { Object.defineProperty(geo, "__propertyInspectorGpsFallbackInstalled", { value: true }); }
  catch (error) { geo.__propertyInspectorGpsFallbackInstalled = true; }
})();

(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.IndexedDbRecovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RETRYABLE_NAMES = new Set(["InvalidStateError", "AbortError", "TransactionInactiveError"]);

  function isRetryableConnectionError(error) {
    if (!error) return false;
    if (RETRYABLE_NAMES.has(String(error.name || ""))) return true;
    return /(?:connection|database|transaction).*(?:closing|closed)|(?:closing|closed).*(?:connection|database|transaction)/i.test(String(error.message || error));
  }

  function createConnectionManager(options) {
    const settings = options || {};
    if (typeof settings.openConnection !== "function") throw new TypeError("openConnection is required.");

    let databasePromise = null;
    let activeDatabase = null;
    let activeGeneration = 0;

    function disconnect(database, generation, closeFirst) {
      if (closeFirst && database) {
        try { database.close(); } catch (error) { /* The connection is already closing or closed. */ }
      }
      if (database && database !== activeDatabase) return;
      if (generation != null && generation !== activeGeneration) return;
      activeDatabase = null;
      databasePromise = null;
      activeGeneration += 1;
    }

    function installLifecycleHandlers(database, generation) {
      database.onversionchange = () => {
        try { database.close(); } finally { disconnect(database, generation, false); }
      };
      if (typeof database.addEventListener === "function") {
        database.addEventListener("close", () => disconnect(database, generation, false));
      } else if ("onclose" in database) {
        database.onclose = () => disconnect(database, generation, false);
      }
    }

    function open() {
      if (databasePromise) return databasePromise;
      const generation = activeGeneration + 1;
      activeGeneration = generation;
      const opening = Promise.resolve()
        .then(() => settings.openConnection())
        .then(database => {
          if (!database || typeof database.transaction !== "function") throw new Error("IndexedDB returned an unusable database connection.");
          if (generation !== activeGeneration) {
            try { database.close(); } catch (error) { /* A newer generation already owns the connection. */ }
            throw new DOMException("IndexedDB connection was superseded while opening.", "AbortError");
          }
          activeDatabase = database;
          installLifecycleHandlers(database, generation);
          return database;
        });
      databasePromise = opening;
      opening.catch(() => {
        if (databasePromise === opening && generation === activeGeneration) disconnect(activeDatabase, generation, false);
      });
      return opening;
    }

    function invalidate(database) {
      disconnect(database || activeDatabase, null, true);
    }

    async function transaction(storeNames, mode, operation) {
      if (typeof operation !== "function") throw new TypeError("A transaction operation is required.");
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        let database = null;
        try {
          database = await open();
          const tx = database.transaction(storeNames, mode);
          return await operation(tx, database, attempt);
        } catch (error) {
          lastError = error;
          if (attempt === 0 && isRetryableConnectionError(error)) {
            invalidate(database);
            continue;
          }
          throw error;
        }
      }
      throw lastError || new Error("IndexedDB transaction failed after one recovery attempt.");
    }

    function healthCheck(storeName) {
      return transaction(storeName, "readwrite", tx => new Promise((resolve, reject) => {
        let request;
        try {
          request = tx.objectStore(storeName).get("__property_inspector_health_check__");
        } catch (error) {
          reject(error);
          return;
        }
        request.onerror = () => reject(request.error || new Error("IndexedDB health check failed."));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("IndexedDB health check failed."));
        tx.onabort = () => reject(tx.error || new DOMException("IndexedDB health check was aborted.", "AbortError"));
      }));
    }

    return {
      open,
      transaction,
      healthCheck,
      invalidate,
      getGeneration: () => activeGeneration,
      getActiveDatabase: () => activeDatabase
    };
  }

  function validateStoredPhoto(record, stored) {
    if (!stored || String(stored.id) !== String(record.id)) throw new Error("Photograph read-back did not return the saved record.");
    if (!stored.metadata || !stored.event) throw new Error("Photograph metadata or associated marker did not survive read-back.");
    if (!stored.originalBlob || !Number(stored.originalBlob.size)) throw new Error("Original photograph bytes did not survive read-back.");
    if (!stored.analysisBlob || !Number(stored.analysisBlob.size)) throw new Error("Analysis photograph bytes did not survive read-back.");
    if (Number(stored.originalBlob.size) !== Number(record.originalBlob.size)) throw new Error("Original photograph byte size changed during storage.");
    if (Number(stored.analysisBlob.size) !== Number(record.analysisBlob.size)) throw new Error("Analysis photograph byte size changed during storage.");
    return stored;
  }

  async function commitPhotoEvidence(record, services) {
    const settings = services || {};
    if (typeof settings.put !== "function" || typeof settings.get !== "function") throw new TypeError("Photo put and get services are required.");
    try {
      await settings.put(record);
      const stored = validateStoredPhoto(record, await settings.get(record.id));
      if (typeof settings.onCommitted === "function") await settings.onCommitted(stored);
      return stored;
    } catch (error) {
      if (typeof settings.queueOnFailure === "function") await settings.queueOnFailure(record, error);
      throw error;
    }
  }

  return { createConnectionManager, isRetryableConnectionError, validateStoredPhoto, commitPhotoEvidence };
});
