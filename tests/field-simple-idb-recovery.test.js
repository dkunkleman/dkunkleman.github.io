"use strict";

const assert = require("node:assert/strict");
const Recovery = require("../field-simple-test/idb-recovery.js");

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
    forceClose() { this.close(); },
    lateCloseEvent() { listeners.close.forEach(listener => listener()); },
    get closed() { return closed; }
  };
}

async function main() {
  assert(Recovery.isRetryableConnectionError(namedError("InvalidStateError", "closed")));
  assert(Recovery.isRetryableConnectionError(namedError("AbortError", "aborted")));
  assert(Recovery.isRetryableConnectionError(namedError("TransactionInactiveError", "inactive")));

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
    assert.equal(result, "photo-db-2", "closing connection must reopen exactly once");
    assert.equal(opened.length, 2);
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
    assert.equal(reopened, "cached-db-2", "stale cached connection must be invalidated and reopened");
    stale.lateCloseEvent();
    const stillCurrent = await manager.transaction("photos", "readonly", (transaction, database) => database.name);
    assert.equal(stillCurrent, "cached-db-2", "old-generation close callback must not invalidate the current database");
  }

  {
    const originalBytes = Uint8Array.from([1, 2, 3, 4, 5]);
    const analysisBytes = Uint8Array.from([9, 8, 7]);
    const record = {
      id: "photo-1",
      metadata: { id: "photo-1", photo_number: "P1" },
      event: { id: "event-1", type: "photo", photo_id: "photo-1" },
      originalBlob: new Blob([originalBytes], { type: "image/jpeg" }),
      analysisBlob: new Blob([analysisBytes], { type: "image/jpeg" })
    };
    const stored = new Map();
    let failFirstPut = true;
    const manager = Recovery.createConnectionManager({ openConnection: async () => fakeDatabase("photo-db") });
    const put = item => manager.transaction("photos", "readwrite", async () => {
      if (failFirstPut) {
        failFirstPut = false;
        throw namedError("AbortError", "connection closing");
      }
      stored.set(item.id, item);
    });
    const get = id => manager.transaction("photos", "readonly", async () => stored.get(id) || null);
    const committed = await Recovery.commitPhotoEvidence(record, { put, get });
    assert.equal(committed.originalBlob.size, originalBytes.length);
    assert.equal(committed.analysisBlob.size, analysisBytes.length);
  }

  process.stdout.write("PASS: field-simple IndexedDB lifecycle reopens stale connections and preserves photo bytes.\n");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
