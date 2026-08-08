const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "pearson-road-map", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "pearson-road-map", "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "pearson-road-map", "app.js"), "utf8");

function requireText(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

for (const panel of ["layers", "visits", "photos", "proposal"]) {
  requireText(html, new RegExp(`data-open-panel="${panel}"`), `Missing ${panel.toUpperCase()} floating control.`);
}

requireText(html, /id="controlDrawer"[^>]+aria-hidden="true"/, "The technical drawer must start closed.");
requireText(html, /id="customerViewToggle"/, "Customer-view control is missing.");
requireText(html, /id="photoFilmstrip"/, "Geographic photo tray is missing.");
requireText(html, /id="previousPhoto"[\s\S]*id="nextPhoto"/, "Photo viewer Previous/Next controls are missing.");
requireText(html, /data-layer="gps" type="checkbox">/, "Raw GPS must be off by default.");
requireText(html, /data-layer="photos" type="checkbox">/, "Photo pins must be off by default to avoid marker clutter.");
requireText(html, /data-layer="sections" type="checkbox">/, "Mapped-section diagnostics must be off by default.");
requireText(html, /id="allFindingsToggle" type="checkbox">/, "Every field-record marker must remain an opt-in forensic view.");

requireText(css, /\.map-wrap\{position:absolute;inset:0;[^}]*height:100vh/, "Map is not full-screen.");
requireText(css, /#controlDrawer\{[^}]*transform:translateX/, "Desktop options are not hidden in an off-canvas drawer.");
requireText(css, /@media\(max-width:780px\)[\s\S]*#controlDrawer\{[^}]*transform:translateY/, "Mobile options are not presented as a bottom sheet.");
requireText(css, /body\[data-profile="CUSTOMER_REVIEW"\]/, "Customer presentation profile is missing.");

requireText(app, /state\.map\.on\("mousemove",[^;]+updateFilmstrip/, "Desktop map hover does not update nearby photos.");
requireText(app, /function showTemporaryPhotoLocation\(photo\)/, "Photo selection does not pulse its exact location when photo pins are hidden.");
requireText(app, /function openControlPanel\(panel\)/, "Temporary map-control panels are not wired.");
requireText(app, /function closeControlPanel\(\)/, "Map-control drawer cannot be closed.");
requireText(app, /IMPORTANT_FINDING_CLASSES/, "Default feature-marker display is not restrained to important findings.");
requireText(app, /touchstart[\s\S]*touchend[\s\S]*movePhoto/, "Mobile photo swiping is missing.");

console.log("PASS: property map opens as a human-first, full-screen, photo-led experience.");
