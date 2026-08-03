"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Recovery = require("../field/idb-recovery.js");

function namedError(name, message) {
  const error = new Error(message || name);
  error.name = name;
  return error;
}

function fakeDatabase(name, options) {
  const settings = options || {};
  const listeners = { close: [] };
  let closed = false;
  let transactionCalls = 0;
  return {
    name,
    transaction() {
      transactionCalls += 1;
      if (closed) throw namedError("InvalidStateError", "The database connection is closed.");
      if (settings.throwTransactions && transactionCalls <= settings.throwTransactions) {
        throw namedError(settings.throwName || "InvalidStateError", settings.throwMessage || "The database connection is closing.");
      }
      return { databaseName: name, attempt: transactionCalls };
    },
    close() {
      if (closed) return;
      closed = true;
      listeners.close.forEach(listener => listener());
    },
    addEventListener(type, listener) {
      if (listeners[type]) listeners[type].push(listener);
    },
    forceClose() {
      this.close();
    },
    lateCloseEvent() {
      listeners.close.forEach(listener => listener());
    },
    get closed() { return closed; }
  };
}

async function main() {
  const appSource = fs.readFileSync(path.resolve(__dirname, "../field/app.js"), "utf8");
  const indexSource = fs.readFileSync(path.resolve(__dirname, "../field/index.html"), "utf8");
  const workerSource = fs.readFileSync(path.resolve(__dirname, "../field/sw.js"), "utf8");
  assert.equal((appSource.match(/\.transaction\(/g) || []).length, 1, "app.js routes every IndexedDB transaction through the shared manager");
  assert(appSource.includes("await gpsWriteQueue;") && appSource.includes("await voiceChunkWrites;") && appSource.includes("await revalidatePhotoDb();"), "package creation drains writes and revalidates IndexedDB before inventory");
  assert(appSource.includes("Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo."), "second photo failure exposes the required recoverable queue message");
  assert(appSource.includes("Your inspection is safe. Close all Property Inspector tabs, reopen the app, and tap Finish Inspection again. Do not press Clear."), "package failure exposes the required safe recovery instruction");
  assert(appSource.includes("const maxDimension = 1900") && appSource.includes('"image/jpeg", 0.8'), "analysis photographs use the requested 1600–2000px and 0.75–0.82 quality range");
  assert(appSource.includes("const galleryPageSize = 12") && appSource.includes('image.loading = "lazy"'), "large photo galleries are paginated and lazy-loaded");
  assert(appSource.includes("elapsedSinceSave >= 30000") && appSource.includes("headingChanged || tiltChanged"), "orientation samples are retained on meaningful change instead of every five seconds");
  assert(!appSource.includes("indexedDB.deleteDatabase"), "the repair never deletes the existing evidence database");
  assert(appSource.includes('const photoDbName = "pearson-road-field-photos"') && appSource.includes("indexedDB.open(photoDbName, 3)"), "database name and schema version remain unchanged for the existing field inspection");
  const appVersion = appSource.match(/APP_VERSION = "([^"]+)"/)[1];
  assert(indexSource.includes(`app.js?v=${appVersion}`) && indexSource.includes(`idb-recovery.js?v=${appVersion}`) && indexSource.includes(`inspection-package.js?v=${appVersion}`), "HTML loads versioned application assets so Safari cannot mix old code with a new shell");
  assert(workerSource.includes(`const INDEX_URL = "./index.html?v=${appVersion}"`) && workerSource.includes("fetch(INDEX_URL)") && workerSource.includes("caches.match(INDEX_URL)"), "the service worker installs and serves a versioned offline HTML shell");
  assert(Recovery.isRetryableConnectionError(namedError("InvalidStateError", "closed")));
  assert(Recovery.isRetryableConnectionError(namedError("AbortError", "aborted")));
  assert(Recovery.isRetryableConnectionError(namedError("TransactionInactiveError", "inactive")));
  assert(Recovery.isRetryableConnectionError(new Error("The database connection is closing.")));

  {
    const opened = [];
    const manager = Recovery.createConnectionManager({
      openConnection: async () => {
        const db = fakeDatabase(`photo-db-${opened.length + 1}`, opened.length ? {} : { throwTransactions: 1 });
        opened.push(db);
        return db;
      }
    });
    const result = await manager.transaction("photos", "readwrite", (transaction, database) => database.name);
    assert.equal(result, "photo-db-2", "a close before photoStorePut reopens and retries without retaking the photo");
    assert.equal(opened.length, 2, "transaction creation is retried exactly once on a closing connection");
  }

  {
    const opened = [];
    const manager = Recovery.createConnectionManager({
      openConnection: async () => {
        const db = fakeDatabase(`cached-db-${opened.length + 1}`);
        opened.push(db);
        return db;
      }
    });
    const stale = await manager.open();
    stale.forceClose();
    const reopened = await manager.transaction("photos", "readonly", (transaction, database) => database.name);
    assert.equal(reopened, "cached-db-2", "a cached connection close invalidates the resolved promise and reopens");
    stale.lateCloseEvent();
    const stillCurrent = await manager.transaction("photos", "readonly", (transaction, database) => database.name);
    assert.equal(stillCurrent, "cached-db-2", "an old-generation close callback cannot invalidate the new connection");
  }

  const originalBytes = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const analysisBytes = Uint8Array.from([9, 8, 7, 6]);
  const photoRecord = {
    id: "photo-recovered-1",
    inspection_id: "inspection-field",
    metadata: { id: "photo-recovered-1", photo_number: "P1", original_size_bytes: originalBytes.length },
    event: { id: "event-photo-recovered-1", type: "photo", photo_id: "photo-recovered-1" },
    originalBlob: new Blob([originalBytes], { type: "image/jpeg" }),
    analysisBlob: new Blob([analysisBytes], { type: "image/jpeg" })
  };

  {
    const stored = new Map();
    let openCount = 0;
    let abortBetweenCopies = true;
    let readBackCloses = true;
    const manager = Recovery.createConnectionManager({ openConnection: async () => fakeDatabase(`atomic-db-${++openCount}`) });
    const put = record => manager.transaction("photos", "readwrite", async () => {
      const staged = { originalBlob: record.originalBlob };
      if (abortBetweenCopies) {
        abortBetweenCopies = false;
        throw namedError("AbortError", "Connection closed between original and analysis serialization.");
      }
      staged.analysisBlob = record.analysisBlob;
      stored.set(record.id, Object.assign({}, record, staged));
    });
    const get = id => manager.transaction("photos", "readonly", async () => {
      if (readBackCloses) {
        readBackCloses = false;
        throw namedError("TransactionInactiveError", "Connection closed during read-back verification.");
      }
      return stored.get(id) || null;
    });
    const committed = await Recovery.commitPhotoEvidence(photoRecord, { put, get });
    assert.equal(openCount, 3, "put abort and read-back close each reopen once");
    assert.deepEqual(new Uint8Array(await committed.originalBlob.arrayBuffer()), originalBytes, "original bytes survive the automatic retry");
    assert.deepEqual(new Uint8Array(await committed.analysisBlob.arrayBuffer()), analysisBytes, "analysis bytes survive the automatic retry");
    assert.equal(committed.event.id, photoRecord.event.id, "photo marker is committed with the blobs and metadata");
  }

  {
    const pending = [];
    const failingManager = Recovery.createConnectionManager({ openConnection: async () => fakeDatabase("always-closing") });
    const failingPut = record => failingManager.transaction("photos", "readwrite", async () => {
      throw namedError("AbortError", "The database connection is closing.");
    });
    await assert.rejects(
      () => Recovery.commitPhotoEvidence(photoRecord, { put: failingPut, get: async () => null, queueOnFailure: async record => pending.push(record) }),
      /closing/,
      "a second transaction failure is reported only after the one allowed retry"
    );
    assert.equal(pending.length, 1, "the captured photo is retained in the pending-photo queue after both attempts fail");

    const durable = new Map();
    const recoveredManager = Recovery.createConnectionManager({ openConnection: async () => fakeDatabase("recovered-db") });
    const put = record => recoveredManager.transaction("photos", "readwrite", async () => { durable.set(record.id, record); });
    const get = id => recoveredManager.transaction("photos", "readonly", async () => durable.get(id) || null);
    const recovered = await Recovery.commitPhotoEvidence(pending[0], { put, get });
    pending.splice(0, 1);
    assert.equal(pending.length, 0, "Retry Pending Photo removes the queue item only after read-back verification");
    assert.equal(durable.get(recovered.id).metadata.photo_number, "P1", "recovered pending photo is available to later package inventory");
  }

  {
    const evidence = {
      photos: [photoRecord],
      voiceNotes: [{ id: "voice-1", audioBlob: new Blob([Uint8Array.from([3, 1, 4])]) }],
      gpsPoints: Array.from({ length: 4964 }, (_, sequence) => ({ sequence, lat: 30 + sequence / 1e6, lon: -87 })),
      observations: Array.from({ length: 252 }, (_, index) => ({ id: `observation-${index + 1}` })),
      orientationSamples: Array.from({ length: 944 }, (_, index) => ({ index }))
    };
    const opened = [];
    const manager = Recovery.createConnectionManager({
      openConnection: async () => {
        const db = fakeDatabase(`package-db-${opened.length + 1}`);
        opened.push(db);
        return db;
      }
    });
    const cached = await manager.open();
    cached.forceClose();
    const inventory = await manager.transaction(["photos", "voiceNotes", "gpsPoints"], "readonly", async () => evidence);
    assert.equal(opened.length, 2, "package request reopens after the cached connection closes");
    assert.equal(inventory.photos[0].originalBlob.size, originalBytes.length);
    assert.equal(inventory.photos[0].analysisBlob.size, analysisBytes.length);
    assert.equal(inventory.voiceNotes.length, 1);
    assert.equal(inventory.gpsPoints.length, 4964);
    assert.equal(inventory.observations.length, 252);
    assert.equal(inventory.orientationSamples.length, 944);
  }

  process.stdout.write("PASS: closing IndexedDB connections reopen once, atomic photo retries preserve both images, read-back is verified, pending evidence survives a second failure, and package inventory recovers.\n");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
