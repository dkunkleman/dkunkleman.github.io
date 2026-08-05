"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..", "finish-send-test");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const referenceCount = JSON.parse(fs.readFileSync(path.join(root, "reference-count.json"), "utf8"));
const finishSend = require(path.join(root, "finish-send.js"));

assert(html.includes("FINISH &amp; SEND"));
assert(html.includes("CURRENT FIELD APP IS UNCHANGED"));
assert(!html.includes("DOWNLOAD"));
assert(!html.includes("Dropbox app"));
assert(!app.includes("dropbox.com/request"));
assert(!app.includes("indexedDB.deleteDatabase"));
assert(!app.includes("localStorage.clear"));
assert(!app.includes(".clear()"));
assert(app.includes('database.transaction(storeName, "readonly")'));
assert(app.includes("request.onupgradeneeded"));
assert(app.includes("request.transaction.abort()"), "a missing database must not be created or migrated");
assert(app.includes('const STATE_KEY = "propertyInspectorHomeTest313V1"'));
assert(app.includes('const DB_NAME = "property-inspector-home-test-313-evidence"'));
assert(app.includes("All binary evidence files"));
assert(app.includes("EXPECTED_BINARY_FILES = 133"));
assert(!app.includes("serviceWorker.register"), "the test page must not register or replace a service worker");
assert(!fs.existsSync(path.join(root, "sw.js")), "the isolated test must not ship a service worker");
assert.equal(referenceCount.binary_evidence_files, 133);
assert(html.includes('name="dropbox-app-key" content="mg83gg2bw9pv9rs"'));
assert(html.includes('./finish-send.js?v=2'));
assert(html.includes('./app.js?v=2'));
assert(finishSend.createDropboxPkceAuth);
assert(fs.readFileSync(path.join(root, "finish-send.js"), "utf8").includes('scope: "files.metadata.read files.content.write"'));
assert(!fs.readFileSync(path.join(root, "finish-send.js"), "utf8").includes("new Promise(() => {})"));
assert(app.includes('stage.textContent = "STARTING"'));
assert(app.includes("Your tap was received"));
assert(app.includes("RECEIVED"));
assert.equal(new finishSend.Sha256().update(Buffer.from("abc")).digestHex(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

class Storage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
class VirtualArchive {
  constructor(size) { this.size = size; }
  slice(start, end) { return { size: end - start }; }
}
function response(status, value) { return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(value); } }; }

(async () => {
  const size = Math.ceil(417.8 * 1024 * 1024);
  const archive = new VirtualArchive(size);
  const storage = new Storage();
  const auth = { async getAccessToken() { return "token"; }, invalidateAccessToken() {} };
  const sha256 = "a".repeat(64);
  const contentHash = "b".repeat(64);
  let remoteOffset = 0;
  let interrupted = false;
  let resume = false;
  const offsets = [];
  const stages = [];
  async function fetchMock(url, options) {
    if (url.endsWith("/files/upload_session/start")) return response(200, { session_id: "large-session" });
    if (url.endsWith("/files/upload_session/append_v2")) {
      const arg = JSON.parse(options.headers["Dropbox-API-Arg"]);
      offsets.push(arg.cursor.offset);
      if (!resume && arg.cursor.offset >= 16 * 1024 * 1024) { interrupted = true; throw new Error("weak service"); }
      assert.equal(arg.cursor.offset, remoteOffset);
      remoteOffset += options.body.size;
      return response(200, {});
    }
    if (url.endsWith("/files/upload_session/finish")) {
      const arg = JSON.parse(options.headers["Dropbox-API-Arg"]);
      assert.equal(arg.cursor.offset, size);
      assert.equal(arg.commit.path.startsWith("/Property Inspector Uploads/"), true);
      return response(200, { id: "id:archive", rev: "rev1", size, content_hash: contentHash, path_display: arg.commit.path });
    }
    if (url.endsWith("/files/get_metadata")) return response(200, { id: "id:archive", rev: "rev1", size, content_hash: contentHash, path_display: "/Property Inspector Uploads/TEST_FULL_ARCHIVE.zip" });
    throw new Error(`Unexpected request ${url}`);
  }
  const first = finishSend.createUploader({ storage, auth, fetch: fetchMock, maxRetries: 0, checkpointKey: "test" });
  await assert.rejects(first.upload(archive, { filename: "TEST_FULL_ARCHIVE.zip", inspectionId: "test", sha256, dropboxContentHash: contentHash }), /weak service/);
  assert(interrupted);
  assert.equal(first.getCheckpoint().offset, 16 * 1024 * 1024);
  resume = true;
  const second = finishSend.createUploader({ storage, auth, fetch: fetchMock, maxRetries: 0, checkpointKey: "test" });
  const receipt = await second.upload(archive, { filename: "TEST_FULL_ARCHIVE.zip", inspectionId: "test", sha256, dropboxContentHash: contentHash }, stage => stages.push(stage));
  assert.equal(offsets.filter(offset => offset === 0).length, 1);
  assert.equal(remoteOffset, size);
  assert.equal(receipt.byte_size, size);
  assert.equal(receipt.sha256, sha256);
  assert(stages.includes("VERIFYING") && stages.includes("RECEIVED"));
  assert.equal(second.getCheckpoint().stage, "RECEIVED");
  console.log("PASS: separate one-button app, non-destructive storage access, >417.7 MB resume, remote verification, and permanent receipt");
})().catch(error => { console.error(error); process.exitCode = 1; });
