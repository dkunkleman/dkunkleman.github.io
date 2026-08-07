"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dir = path.join(root, "field-simple-test-direct-v10-section-pause");
const app = fs.readFileSync(path.join(dir, "app.js"), "utf8");
const index = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(app.includes('const APP_VERSION = "3.13.0-home-test.5.1-safari-direct-10-section-pause-1";'), "candidate version missing");
assert(app.includes('const stateKey = "propertyInspectorHomeTest313V1";'), "state key changed");
assert(app.includes('const photoDbName = "property-inspector-home-test-313-evidence";'), "evidence DB changed");

assert(app.includes('START MAPPING THIS SECTION'), "section start wording not fixed");
assert(!app.includes('START / SAVE THIS SECTION'), "old ambiguous section start wording remains");
assert(app.includes('SAVE & PAUSE SECTION — RETURN TO FIELD BUTTONS'), "pause-and-return wording missing");
assert(app.includes('RESUME MAPPING ${activeSection.section_id}'), "resume mapping wording missing");
assert(!app.includes('>CONTINUE ${activeSection.section_id}</button>'), "old continue-section wording remains");
assert(app.includes('RESUME EDGE MAPPING'), "resume edge wording missing");
assert(app.includes('PAUSE EDGE MAPPING'), "pause edge wording missing");

assert(app.includes('if (sectionMappingTools && sectionAtFix && !sectionAtFix.capture_paused) sectionMappingTools.appendWalkPoint(data, point, point.time);'), "GPS callback can still append section edge while paused");
assert(!app.includes('if (sectionMappingTools) sectionMappingTools.appendWalkPoint(data, point, point.time);'), "unguarded section append remains");

assert(app.includes('SECTION_AUTO_PAUSED_AFTER_APP_RESTART'), "app restart does not force unfinished section paused");
assert(app.includes('restoredActiveSection.capture_paused = true;'), "restart pause assignment missing");
assert(app.includes('SECTION_RESUMED_FROM_FIELD_BUTTONS'), "explicit resume event missing");

const returnHandler = 'document.getElementById("sectionReturn").addEventListener("click", simpleReturnToFieldButtons);';
assert(app.includes(returnHandler), "section return is not using the centralized pause/save path");

const centralizedPause = 'if (section && section.completion_status === "ACTIVE") {\n        section.capture_paused = true;';
assert(app.includes(centralizedPause), "centralized return path does not pause active section");

assert(index.includes('safari-direct-10-section-pause-1'), "index cache-busting version missing");
assert(sw.includes('property-inspector-home-test-313-direct-ed42-v10-section-pause-1'), "service worker cache is not isolated");
assert(sw.includes('safari-direct-10-section-pause-1'), "service worker URLs are not version-isolated");

console.log("v10 section-pause regression test passed.");
