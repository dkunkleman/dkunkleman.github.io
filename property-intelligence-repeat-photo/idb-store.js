(function (root) {
  "use strict";
  const DB_NAME = "property-intelligence-repeat-photo-poc-v1";
  const DB_VERSION = 1;
  let dbPromise = null;
  let generation = 0;

  function isClosingError(error) {
    const name = error && error.name || "";
    const message = String(error && error.message || error || "").toLowerCase();
    return name === "InvalidStateError" || name === "AbortError" || message.includes("closing") || message.includes("closed");
  }

  function invalidate() { generation += 1; dbPromise = null; }

  function openDb() {
    if (dbPromise) return dbPromise;
    const openingGeneration = generation;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("photo_points")) db.createObjectStore("photo_points", { keyPath: "photo_point_id" });
        if (!db.objectStoreNames.contains("image_blobs")) db.createObjectStore("image_blobs", { keyPath: "blob_id" });
        if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts", { keyPath: "draft_id" });
      };
      request.onerror = () => { if (openingGeneration === generation) dbPromise = null; reject(request.error); };
      request.onsuccess = () => {
        const db = request.result;
        if (openingGeneration !== generation) { db.close(); reject(new DOMException("Superseded database generation", "AbortError")); return; }
        db.onversionchange = () => { db.close(); if (openingGeneration === generation) invalidate(); };
        if ("onclose" in db) db.onclose = () => { if (openingGeneration === generation) invalidate(); };
        resolve(db);
      };
    });
    return dbPromise;
  }

  async function transaction(storeNames, mode, operation) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const db = await openDb();
        const tx = db.transaction(storeNames, mode);
        const result = await operation(tx);
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
          tx.onabort = () => reject(tx.error || new DOMException("IndexedDB transaction aborted.", "AbortError"));
        });
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === 0 && isClosingError(error)) { invalidate(); continue; }
        throw error;
      }
    }
    throw lastError;
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const store = {
    DB_NAME,
    async healthCheck() {
      await transaction(["drafts"], "readonly", async (tx) => requestValue(tx.objectStore("drafts").count()));
      return true;
    },
    async putPoint(point) {
      return transaction(["photo_points"], "readwrite", async (tx) => requestValue(tx.objectStore("photo_points").put(point)));
    },
    async getPoint(id) {
      return transaction(["photo_points"], "readonly", async (tx) => requestValue(tx.objectStore("photo_points").get(id)));
    },
    async getAllPoints() {
      return transaction(["photo_points"], "readonly", async (tx) => requestValue(tx.objectStore("photo_points").getAll()));
    },
    async putBlob(blobRecord) {
      return transaction(["image_blobs"], "readwrite", async (tx) => requestValue(tx.objectStore("image_blobs").put(blobRecord)));
    },
    async getBlob(id) {
      return transaction(["image_blobs"], "readonly", async (tx) => requestValue(tx.objectStore("image_blobs").get(id)));
    },
    async getAllBlobs() {
      return transaction(["image_blobs"], "readonly", async (tx) => requestValue(tx.objectStore("image_blobs").getAll()));
    },
    async putDraft(id, value) {
      return transaction(["drafts"], "readwrite", async (tx) => requestValue(tx.objectStore("drafts").put({ draft_id: id, value, saved_at: new Date().toISOString() })));
    },
    async getDraft(id) {
      const record = await transaction(["drafts"], "readonly", async (tx) => requestValue(tx.objectStore("drafts").get(id)));
      return record || null;
    },
    async removeDraft(id) {
      return transaction(["drafts"], "readwrite", async (tx) => requestValue(tx.objectStore("drafts").delete(id)));
    }
  };

  root.RepeatPhotoStore = store;
})(typeof globalThis !== "undefined" ? globalThis : this);
