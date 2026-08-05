(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinishSend = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FOUR_MIB = 4 * 1024 * 1024;
  const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
  const CHECKPOINT_KEY = "propertyInspectorHomeTest313FinishSendV1";
  const AUTH_KEY = "propertyInspectorHomeTest313DropboxAuthV1";
  const OAUTH_KEY = "propertyInspectorHomeTest313DropboxOauthV1";
  const DROPBOX_API = "https://api.dropboxapi.com/2";
  const DROPBOX_CONTENT = "https://content.dropboxapi.com/2";
  const DROPBOX_AUTH = "https://www.dropbox.com/oauth2/authorize";
  const DROPBOX_TOKEN = "https://api.dropboxapi.com/oauth2/token";
  const UPLOAD_FOLDER = "/Property Inspector Uploads";

  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);

  function rotr(value, count) { return (value >>> count) | (value << (32 - count)); }
  function hex(bytes) { return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join(""); }
  function base64Url(bytes) {
    let binary = "";
    bytes.forEach(value => { binary += String.fromCharCode(value); });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }
  function randomText(length) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => alphabet[value % alphabet.length]).join("");
  }
  function safeFilename(value) {
    const cleaned = String(value || "PROPERTY_INSPECTION_FULL_ARCHIVE.zip").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
    return cleaned.endsWith(".zip") ? cleaned : `${cleaned}.zip`;
  }
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  class Sha256 {
    constructor() {
      this.state = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalBytes = 0;
      this.finished = false;
    }
    update(input) {
      if (this.finished) throw new Error("SHA-256 has already been finalized.");
      const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
      this.totalBytes += bytes.length;
      let offset = 0;
      while (offset < bytes.length) {
        const take = Math.min(64 - this.bufferLength, bytes.length - offset);
        this.buffer.set(bytes.subarray(offset, offset + take), this.bufferLength);
        this.bufferLength += take;
        offset += take;
        if (this.bufferLength === 64) {
          this.compress(this.buffer);
          this.bufferLength = 0;
        }
      }
      return this;
    }
    compress(block) {
      const w = new Uint32Array(64);
      for (let index = 0; index < 16; index += 1) {
        const base = index * 4;
        w[index] = ((block[base] << 24) | (block[base + 1] << 16) | (block[base + 2] << 8) | block[base + 3]) >>> 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const s0 = rotr(w[index - 15], 7) ^ rotr(w[index - 15], 18) ^ (w[index - 15] >>> 3);
        const s1 = rotr(w[index - 2], 17) ^ rotr(w[index - 2], 19) ^ (w[index - 2] >>> 10);
        w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
      }
      let [a,b,c,d,e,f,g,h] = this.state;
      for (let index = 0; index < 64; index += 1) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + s1 + ch + K[index] + w[index]) >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (s0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      const next = [a,b,c,d,e,f,g,h];
      for (let index = 0; index < 8; index += 1) this.state[index] = (this.state[index] + next[index]) >>> 0;
    }
    digestBytes() {
      if (!this.finished) {
        const length = this.totalBytes;
        this.buffer[this.bufferLength++] = 0x80;
        if (this.bufferLength > 56) {
          this.buffer.fill(0, this.bufferLength);
          this.compress(this.buffer);
          this.bufferLength = 0;
        }
        this.buffer.fill(0, this.bufferLength, 56);
        const high = Math.floor(length / 0x20000000);
        const low = (length << 3) >>> 0;
        this.buffer[56] = (high >>> 24) & 255; this.buffer[57] = (high >>> 16) & 255;
        this.buffer[58] = (high >>> 8) & 255; this.buffer[59] = high & 255;
        this.buffer[60] = (low >>> 24) & 255; this.buffer[61] = (low >>> 16) & 255;
        this.buffer[62] = (low >>> 8) & 255; this.buffer[63] = low & 255;
        this.compress(this.buffer);
        this.finished = true;
      }
      const output = new Uint8Array(32);
      this.state.forEach((value, index) => {
        const base = index * 4;
        output[base] = value >>> 24; output[base + 1] = value >>> 16;
        output[base + 2] = value >>> 8; output[base + 3] = value;
      });
      return output;
    }
    digestHex() { return hex(this.digestBytes()); }
  }

  async function hashArchive(blob, onProgress) {
    const total = new Sha256();
    const dropboxBlocks = new Sha256();
    const size = Number(blob.size) || 0;
    for (let offset = 0; offset < size; offset += FOUR_MIB) {
      const bytes = new Uint8Array(await blob.slice(offset, Math.min(size, offset + FOUR_MIB)).arrayBuffer());
      total.update(bytes);
      dropboxBlocks.update(new Sha256().update(bytes).digestBytes());
      if (onProgress) onProgress(Math.min(size, offset + bytes.length), size);
    }
    if (!size) dropboxBlocks.update(new Sha256().digestBytes());
    return { sha256: total.digestHex(), dropboxContentHash: dropboxBlocks.digestHex(), byteSize: size };
  }

  function jsonStorage(storage, key) {
    return {
      get() { try { return JSON.parse(storage.getItem(key) || "null"); } catch (error) { return null; } },
      set(value) { storage.setItem(key, JSON.stringify(value)); },
      clear() { storage.removeItem(key); }
    };
  }

  function createDropboxPkceAuth(options) {
    const settings = options || {};
    const storage = settings.storage || localStorage;
    const fetchImpl = settings.fetch || fetch.bind(globalThis);
    const tokenStore = jsonStorage(storage, settings.authKey || AUTH_KEY);
    const oauthStore = jsonStorage(storage, settings.oauthKey || OAUTH_KEY);
    const clientId = String(settings.clientId || "").trim();
    const redirectUri = settings.redirectUri || `${location.origin}${location.pathname}`;

    async function completeRedirect() {
      const params = new URLSearchParams(location.search);
      const code = params.get("code");
      if (!code) return false;
      const pending = oauthStore.get();
      if (!pending || params.get("state") !== pending.state || !pending.codeVerifier) throw new Error("Dropbox authorization could not be verified.");
      const body = new URLSearchParams({ code, grant_type: "authorization_code", client_id: clientId, redirect_uri: redirectUri, code_verifier: pending.codeVerifier });
      const response = await fetchImpl(DROPBOX_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      if (!response.ok) throw new Error(`Dropbox authorization failed (${response.status}).`);
      const token = await response.json();
      tokenStore.set({ accessToken: token.access_token, refreshToken: token.refresh_token || null, expiresAt: Date.now() + (Number(token.expires_in) || 14400) * 1000, accountId: token.account_id || null });
      oauthStore.clear();
      history.replaceState({}, document.title, redirectUri);
      return true;
    }

    async function beginAuthorization() {
      if (!clientId) throw new Error("Dropbox send setup is incomplete. The inspection remains safe on this phone.");
      const codeVerifier = randomText(96);
      const challenge = base64Url(new Sha256().update(new TextEncoder().encode(codeVerifier)).digestBytes());
      const state = randomText(48);
      oauthStore.set({ state, codeVerifier, createdAt: new Date().toISOString() });
      const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, state, code_challenge_method: "S256", code_challenge: challenge, token_access_type: "offline", scope: "files.metadata.read files.content.write" });
      location.assign(`${DROPBOX_AUTH}?${params}`);
      return new Promise(() => {});
    }

    async function refresh(token) {
      if (!token || !token.refreshToken) return beginAuthorization();
      const body = new URLSearchParams({ refresh_token: token.refreshToken, grant_type: "refresh_token", client_id: clientId });
      const response = await fetchImpl(DROPBOX_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      if (!response.ok) return beginAuthorization();
      const next = await response.json();
      const saved = Object.assign({}, token, { accessToken: next.access_token, expiresAt: Date.now() + (Number(next.expires_in) || 14400) * 1000 });
      tokenStore.set(saved);
      return saved.accessToken;
    }

    async function getAccessToken() {
      const token = tokenStore.get();
      if (token && token.accessToken && Number(token.expiresAt) > Date.now() + 60000) return token.accessToken;
      if (token) return refresh(token);
      return beginAuthorization();
    }

    return {
      configured: () => Boolean(clientId),
      completeRedirect,
      getAccessToken,
      invalidateAccessToken() {
        const token = tokenStore.get();
        if (token) tokenStore.set(Object.assign({}, token, { accessToken: null, expiresAt: 0 }));
      }
    };
  }

  function dropboxError(payload, status) {
    const error = new Error(`Dropbox transfer failed (${status}).`);
    error.status = status;
    error.payload = payload;
    const correct = payload && payload.error && payload.error.incorrect_offset && payload.error.incorrect_offset.correct_offset;
    if (Number.isFinite(Number(correct))) error.correctOffset = Number(correct);
    return error;
  }

  function createUploader(options) {
    const settings = options || {};
    const storage = settings.storage || localStorage;
    const fetchImpl = settings.fetch || fetch.bind(globalThis);
    const auth = settings.auth;
    const checkpointStore = jsonStorage(storage, settings.checkpointKey || CHECKPOINT_KEY);
    const chunkSize = Number(settings.chunkSize) || DEFAULT_CHUNK_SIZE;
    const maxRetries = settings.maxRetries == null ? 5 : Number(settings.maxRetries);
    if (!auth || typeof auth.getAccessToken !== "function") throw new Error("Dropbox authorization provider is required.");

    async function request(url, apiArg, body, tokenRetry) {
      const token = await auth.getAccessToken();
      let response;
      try {
        response = await fetchImpl(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream", "Dropbox-API-Arg": JSON.stringify(apiArg || {}) }, body: body || new Uint8Array(0) });
      } catch (error) {
        error.networkFailure = true;
        throw error;
      }
      if (response.status === 401 && !tokenRetry && auth.invalidateAccessToken) {
        auth.invalidateAccessToken();
        return request(url, apiArg, body, true);
      }
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : {}; } catch (error) { payload = { message: text }; }
      if (!response.ok) throw dropboxError(payload, response.status);
      return payload;
    }

    async function rpc(route, body) {
      const token = await auth.getAccessToken();
      const response = await fetchImpl(`${DROPBOX_API}/${route}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : {}; } catch (error) { payload = { message: text }; }
      if (!response.ok) throw dropboxError(payload, response.status);
      return payload;
    }

    async function withRetry(operation) {
      let error;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try { return await operation(); }
        catch (caught) {
          error = caught;
          if (caught && Number.isFinite(caught.correctOffset)) throw caught;
          if (attempt >= maxRetries || (caught && caught.status && caught.status < 500 && caught.status !== 429)) throw caught;
          await sleep(Math.min(16000, 1000 * (2 ** attempt)));
        }
      }
      throw error;
    }

    async function verify(checkpoint) {
      const metadata = await withRetry(() => rpc("files/get_metadata", { path: checkpoint.dropboxPath, include_deleted: false }));
      if (Number(metadata.size) !== Number(checkpoint.byteSize)) throw new Error("Dropbox byte-size verification failed. The local inspection remains safe.");
      if (!metadata.content_hash || metadata.content_hash !== checkpoint.dropboxContentHash) throw new Error("Dropbox content verification failed. The local inspection remains safe.");
      const receipt = {
        filename: checkpoint.filename,
        dropbox_path: metadata.path_display || checkpoint.dropboxPath,
        byte_size: Number(metadata.size),
        sha256: checkpoint.sha256,
        dropbox_content_hash: metadata.content_hash,
        completion_time: new Date().toISOString(),
        verification: "Remote byte size and Dropbox content hash match the locally SHA-256-hashed archive byte-for-byte.",
        remote_file_id: metadata.id || null,
        remote_revision: metadata.rev || null
      };
      checkpoint.stage = "RECEIVED";
      checkpoint.receipt = receipt;
      checkpoint.updatedAt = receipt.completion_time;
      checkpointStore.set(checkpoint);
      return receipt;
    }

    async function upload(blob, details, onState) {
      const info = details || {};
      const filename = safeFilename(info.filename);
      const byteSize = Number(blob.size);
      const dropboxPath = `${UPLOAD_FOLDER}/${filename}`;
      let checkpoint = checkpointStore.get();
      const same = checkpoint && checkpoint.filename === filename && Number(checkpoint.byteSize) === byteSize && checkpoint.sha256 === info.sha256 && checkpoint.dropboxContentHash === info.dropboxContentHash;
      if (!same) {
        checkpoint = { schema: "property-inspector-finish-send-checkpoint", version: 1, inspectionId: info.inspectionId || null, filename, dropboxPath, byteSize, sha256: info.sha256, dropboxContentHash: info.dropboxContentHash, sessionId: null, offset: 0, stage: "UPLOADING", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), receipt: null };
        checkpointStore.set(checkpoint);
      }
      if (checkpoint.stage === "RECEIVED" && checkpoint.receipt) return checkpoint.receipt;
      if (onState) onState("UPLOADING", checkpoint.offset, byteSize);
      if (!checkpoint.sessionId) {
        const started = await withRetry(() => request(`${DROPBOX_CONTENT}/files/upload_session/start`, { close: false }, new Uint8Array(0)));
        checkpoint.sessionId = started.session_id;
        checkpoint.offset = 0;
        checkpoint.updatedAt = new Date().toISOString();
        checkpointStore.set(checkpoint);
      }
      while (checkpoint.offset < byteSize) {
        const end = Math.min(byteSize, checkpoint.offset + chunkSize);
        const chunk = blob.slice(checkpoint.offset, end);
        try {
          await withRetry(() => request(`${DROPBOX_CONTENT}/files/upload_session/append_v2`, { cursor: { session_id: checkpoint.sessionId, offset: checkpoint.offset }, close: end === byteSize }, chunk));
          checkpoint.offset = end;
        } catch (error) {
          if (Number.isFinite(error.correctOffset) && error.correctOffset >= 0 && error.correctOffset <= byteSize) checkpoint.offset = error.correctOffset;
          else {
            checkpoint.updatedAt = new Date().toISOString();
            checkpointStore.set(checkpoint);
            throw error;
          }
        }
        checkpoint.updatedAt = new Date().toISOString();
        checkpointStore.set(checkpoint);
        if (onState) onState("UPLOADING", checkpoint.offset, byteSize);
      }
      checkpoint.stage = "VERIFYING";
      checkpointStore.set(checkpoint);
      if (onState) onState("VERIFYING", byteSize, byteSize);
      try {
        const committed = await withRetry(() => request(`${DROPBOX_CONTENT}/files/upload_session/finish`, { cursor: { session_id: checkpoint.sessionId, offset: byteSize }, commit: { path: dropboxPath, mode: "add", autorename: false, mute: false, strict_conflict: true } }, new Uint8Array(0)));
        checkpoint.dropboxPath = committed.path_display || dropboxPath;
        checkpointStore.set(checkpoint);
      } catch (error) {
        try {
          const existing = await rpc("files/get_metadata", { path: dropboxPath, include_deleted: false });
          if (Number(existing.size) !== byteSize || existing.content_hash !== checkpoint.dropboxContentHash) throw error;
        } catch (lookupError) {
          throw error;
        }
      }
      const receipt = await verify(checkpoint);
      if (onState) onState("RECEIVED", byteSize, byteSize, receipt);
      return receipt;
    }

    return { upload, verify, getCheckpoint: checkpointStore.get, clearCheckpoint: checkpointStore.clear };
  }

  return {
    FOUR_MIB,
    DEFAULT_CHUNK_SIZE,
    CHECKPOINT_KEY,
    UPLOAD_FOLDER,
    Sha256,
    hashArchive,
    createDropboxPkceAuth,
    createUploader
  };
});
