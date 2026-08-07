"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "field-simple-test-direct-v10");
const targetDir = path.join(root, "field-simple-test-direct-v10-section-pause");

function mustReplace(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

const appPath = path.join(targetDir, "app.js");
let app = fs.readFileSync(appPath, "utf8");

app = mustReplace(
  app,
  'const APP_VERSION = "3.13.0-home-test.5.1-safari-direct-10";',
  'const APP_VERSION = "3.13.0-home-test.5.1-safari-direct-10-section-pause-1";',
  "candidate version"
);

app = mustReplace(
  app,
  '    data.points.push(point);\n    if (sectionMappingTools) sectionMappingTools.appendWalkPoint(data, point, point.time);',
  '    data.points.push(point);\n    // A canonical GPS point is always saved, but it becomes section-edge evidence only\n    // while the inspector has explicitly resumed that unfinished section.\n    if (sectionMappingTools && sectionAtFix && !sectionAtFix.capture_paused) sectionMappingTools.appendWalkPoint(data, point, point.time);',
  "section GPS gate"
);

app = mustReplace(
  app,
  '      await restoreCanonicalInspectionState();\n      saveState();',
  '      await restoreCanonicalInspectionState();\n      // A browser reload / full Safari restart always returns to the field buttons.\n      // Therefore an unfinished section must reopen PAUSED. Reconnecting GPS alone\n      // must never resume section-edge capture.\n      const restoredActiveSection = sectionMappingTools.activeSection(data);\n      if (restoredActiveSection && restoredActiveSection.completion_status === "ACTIVE" && !restoredActiveSection.capture_paused) {\n        restoredActiveSection.capture_paused = true;\n        restoredActiveSection.events = Array.isArray(restoredActiveSection.events) ? restoredActiveSection.events : [];\n        restoredActiveSection.events.push({ event_type: "SECTION_AUTO_PAUSED_AFTER_APP_RESTART", recorded_at: new Date().toISOString() });\n      }\n      saveState();',
  "restart pause"
);

app = app.replaceAll("START / SAVE THIS SECTION", "START MAPPING THIS SECTION");

app = mustReplace(
  app,
  '<button id="sectionPause" type="button">${section.capture_paused ? "RESUME" : "PAUSE"}</button>',
  '<button id="sectionPause" type="button">${section.capture_paused ? "RESUME EDGE MAPPING" : "PAUSE EDGE MAPPING"}</button>',
  "pause button wording"
);

app = mustReplace(
  app,
  '<button id="sectionReturn" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button>',
  '<button id="sectionReturn" class="simple-return" type="button">SAVE & PAUSE SECTION — RETURN TO FIELD BUTTONS</button>',
  "section return wording"
);

app = mustReplace(
  app,
  '<button id="sectionFinishReturn" class="simple-return" type="button">SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS</button>',
  '<button id="sectionFinishReturn" class="simple-return" type="button">SAVE & PAUSE SECTION — RETURN TO FIELD BUTTONS</button>',
  "finish-choice return wording"
);

app = mustReplace(
  app,
  '    document.getElementById("sectionReturn").addEventListener("click", () => { section.capture_paused = true; section.events.push({ event_type: "SECTION_PAUSED_RETURNED_TO_FIELD_BUTTONS", recorded_at: new Date().toISOString() }); simpleReturnToFieldButtons(); });',
  '    document.getElementById("sectionReturn").addEventListener("click", simpleReturnToFieldButtons);',
  "single pause event on return"
);

app = mustReplace(
  app,
  'const resumeSection = activeSection ? `<button id="simpleResumeSection" class="simple-feature map-section" style="display:block;width:100%;max-width:620px;margin:0 auto 8px;min-height:74px" type="button">CONTINUE ${activeSection.section_id}</button>` : "";',
  'const resumeSection = activeSection ? `<button id="simpleResumeSection" class="simple-feature map-section" style="display:block;width:100%;max-width:620px;margin:0 auto 8px;min-height:74px" type="button">RESUME MAPPING ${activeSection.section_id}</button>` : "";',
  "resume wording"
);

app = mustReplace(
  app,
  '      activeSection.events.push({ event_type: "SECTION_RESUMED_FROM_FIELD_BUTTONS", recorded_at: new Date().toISOString() });\n      activateSectionSession(activeSection, "FIELD_BUTTONS");',
  '      activeSection.events.push({ event_type: "SECTION_RESUMED_FROM_FIELD_BUTTONS", recorded_at: new Date().toISOString() });\n      saveState();\n      activateSectionSession(activeSection, "FIELD_BUTTONS");',
  "durable explicit resume"
);

fs.writeFileSync(appPath, app);

const indexPath = path.join(targetDir, "index.html");
let index = fs.readFileSync(indexPath, "utf8");
index = index.replaceAll("3.13.0-home-test.5.1-safari-direct-10", "3.13.0-home-test.5.1-safari-direct-10-section-pause-1");
fs.writeFileSync(indexPath, index);

const swPath = path.join(targetDir, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");
sw = sw.replaceAll("property-inspector-home-test-313-direct-ed42-v10", "property-inspector-home-test-313-direct-ed42-v10-section-pause-1");
sw = sw.replaceAll("3.13.0-home-test.5.1-safari-direct-10", "3.13.0-home-test.5.1-safari-direct-10-section-pause-1");
fs.writeFileSync(swPath, sw);

console.log("Built v10 section-pause candidate from frozen v10 files.");
