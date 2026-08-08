"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appPath = path.join(__dirname, "..", "pearson-road-map", "app.js");
const source = fs.readFileSync(appPath, "utf8");

assert.match(source, /const HIGH_RESOLUTION_MAX_ZOOM = 22;/, "authorized high-resolution imagery must permit close review zooms");
assert.match(source, /const USGS_NATIVE_MAX_ZOOM = 16;/, "the native USGS tile ceiling must be explicit");
assert.match(source, /maxZoom: applicationMaxZoom/, "the map and tile layers must share the active provider's useful zoom ceiling");
assert.match(source, /maxNativeZoom: imageryNativeMaxZoom/, "base imagery must distinguish native tile zoom from application zoom");
assert.match(source, /maxNativeZoom: USGS_NATIVE_MAX_ZOOM/, "topography must overzoom its final native tile instead of disappearing");
assert.match(source, /authorizedImageryUrl/, "authorized higher-resolution imagery must be configurable without removing the USGS fallback");
assert.match(source, /World_Imagery\/MapServer\/tile/, "the close-review fallback must use a high-resolution aerial source");
assert.match(source, /developmentImageryNativeMaxZoom \|\| 19/, "the imagery fallback must preserve native tiles through close-review zoom");
assert.match(source, /zoomSnap: \.25/, "map zoom must support small quarter-step increments");
assert.match(source, /zoomDelta: \.25/, "buttons and double-click must zoom by only one quarter-step");
assert.match(source, /wheelPxPerZoomLevel: 240/, "mouse-wheel zoom must be slowed for precise property review");

process.stdout.write("PASS: aerial imagery remains visible and zoom controls move in precise quarter-step increments.\n");
