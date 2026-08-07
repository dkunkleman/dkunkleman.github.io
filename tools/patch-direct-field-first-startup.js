#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "field-simple-test", "app.js");
const indexPath = path.join(root, "field-simple-test", "index.html");
const swPath = path.join(root, "field-simple-test", "sw.js");
const FROM = "3.13.0-home-test.5.1-safari-direct-10";
const TO = "3.13.0-home-test.5.1-safari-direct-11";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

let app = fs.readFileSync(appPath, "utf8");
let index = fs.readFileSync(indexPath, "utf8");
let sw = fs.readFileSync(swPath, "utf8");

app = replaceOnce(app, `const APP_VERSION = "${FROM}";`, `const APP_VERSION = "${TO}";`, "version");

app = replaceOnce(app,
`      await restoreCanonicalInspectionState();
      saveState();
      await stateWriteQueue;
      await loadPendingPhotos();`,
`      await restoreCanonicalInspectionState();
      saveState();
      await stateWriteQueue;
      // Show the authoritative restored counts immediately. The tiny localStorage
      // pointer must never look like the real inspection while slower startup work runs.
      renderSimpleHeader();
      simpleSetStatus(\`FULL SAVED INSPECTION RESTORED — \${data.photos.length} photos | \${data.markers.length} records | \${data.voice_notes.length} voice\`, "saved");
      await loadPendingPhotos();`,
"show canonical counts immediately after restore"
);

app = replaceOnce(app,
`    redraw();
    renderConditions();
    renderAuthoritativeWeather();
    await renderGallery();
    await Promise.all([loadParcels(), registerOfflineWorker()]);`,
`    redraw();
    renderConditions();
    renderAuthoritativeWeather();
    // Field controls must not wait for gallery thumbnails, parcel downloads, or
    // service-worker installation. Those are useful background work, not startup gates.
    renderGallery().catch(error => setStatus(\`Gallery will load later: \${error.message}\`, "warning"));
    Promise.allSettled([loadParcels(), registerOfflineWorker()]).then(() => {
      renderSimpleHeader();
    });`,
"make nonessential startup work nonblocking"
);

app = replaceOnce(app,
`      offlineReady = true;
      updateControls();
      updateNextStep();
      renderSimpleHome();`,
`      offlineReady = true;
      updateControls();
      updateNextStep();
      // Never yank the inspector out of an active field screen when offline setup finishes.
      renderSimpleHeader();`,
"offline completion cannot replace active field screen"
);

sw = replaceOnce(sw,
`  if (request.mode === "navigate") {
    event.respondWith(
      fetch(INDEX_URL)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
          return response;
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }`,
`  if (request.mode === "navigate") {
    event.respondWith(
      // Always ask the network for the actual navigation URL first. This prevents
      // an older worker from pinning Safari to an older index.html after a deployment.
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
          return response;
        })
        .catch(() => caches.match(INDEX_URL, { ignoreSearch: true }))
    );
    return;
  }`,
"navigation must be network-first for the requested page"
);

index = index.split(FROM).join(TO);
sw = sw.split(FROM).join(TO);
sw = replaceOnce(sw, "property-inspector-home-test-313-direct-ed42-v10", "property-inspector-home-test-313-direct-ed42-v11", "cache version");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
fs.writeFileSync(swPath, sw);
console.log(`Field-first startup and update-safe navigation built ${TO}`);
