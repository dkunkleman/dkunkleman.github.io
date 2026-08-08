"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("../pearson-road-map/property-map-core.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "pearson-road-map", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "pearson-road-map", "app.js"), "utf8");

assert.match(html, /data-proposal-template="SMALL_CREEK_PATH"[^>]*>SMALL PARCEL [^<]*CREEK-SIDE PATH</, "small-parcel creek-side path choice is missing");
assert.match(html, /data-proposal-template="SMALL_CLEARING_PATHS"[^>]*>SMALL PARCEL [^<]*CLEARING &amp; TWO PATHS</, "small-parcel clearing and path choice is missing");
assert.match(html, /data-proposal-template="SMALL_EASTERN_HOMESITE"[^>]*>SMALL PARCEL [^<]*EASTERN HOMESITE AREA</, "small-parcel eastern homesite choice is missing");
assert.doesNotMatch(html, /data-proposal-template="LARGE_WESTERN_HOMESITE"/, "the removed large-parcel western frontage/homesite choice is still visible");
assert.match(html, /id="showHomesiteCorners"[^>]*>SHOW MY 4 HOMESITE CORNERS</, "four-corner homesite guidance button is missing");
assert.match(html, /data-proposal-template="LARGE_CLEARING"[^>]*>LARGE PARCEL [^<]*CLEARED AREA</, "large-parcel clearing choice is missing");
assert.match(html, /data-edit="DRAW_RECTANGLE"[^>]*>ADD ANOTHER BOX</, "generic add-box button is missing");
assert.match(html, /data-edit="RESIZE_RECTANGLE"[^>]*>MOVE \/ RESIZE SELECTED BOX</, "rectangle resize button is missing");
assert.match(html, /id="saveRectangle"[^>]*>SAVE RECTANGLE</, "rectangle save control is missing");
assert.match(html, /id="cancelRectangle"[^>]*>CANCEL</, "rectangle cancel control is missing");
assert.match(html, /id="drawCoach"/, "plain-language map drawing coach is missing");
assert.match(html, /id="keepRectangle"[^>]*>KEEP THIS BOX</, "map-level keep button is missing");
assert.match(html, /id="restartRectangle"[^>]*>START OVER</, "map-level restart button is missing");
assert.match(html, /id="savePictureAfterBox"[^>]*>SAVE PICTURE</, "post-save picture button is missing");
assert.match(html, /id="undoDrawPoint"[^>]*>UNDO LAST POINT</, "custom path drawing cannot undo a bad boundary point");
assert.match(html, /id="saveCurrentMapPicture"[^>]*>SAVE PICTURE OF THIS MAP</, "persistent map picture button is missing");
assert.match(html, /html2canvas@1\.4\.1/, "pinned map-picture renderer is missing");
assert.match(app, /rectangleHandlePositions/, "corner, side, and center handles are not implemented");
assert.match(app, /rectangle-move-handle/, "rectangle center-move handle is missing");
assert.match(app, /getContainer\(\)\.addEventListener\("click", handleRectangleClickCapture, true\)/, "rectangle taps are not captured above map markers and overlays");
assert.match(app, /function handleRectangleClickCapture\(event\)/, "marker-safe rectangle click handler is missing");
assert.match(app, /even on a photo or map symbol/, "second-corner instruction does not explain that map symbols are tappable");
assert.match(app, /templateKey==="SMALL_CREEK_PATH"\)return beginCreekPathEditor/, "creek-side path does not open the Codex-drawn editable corridor");
assert.match(app, /const CREEK_PATH_DEFAULT_WIDTH_FT = 5/, "creek-side path must begin at five feet for two people side by side");
assert.match(app, /universal_walking_path_width_ft:5/, "homesite proposal must preserve the universal five-foot path width");
assert.match(app, /house_opening_character:"SELECTIVE OPENING AMONG MATURE TREES - NOT CLEAR-CUT"/, "western homesite opening must preserve mature-tree character");
assert.match(app, /sunset_view_direction:"WESTWARD FROM THE CENTER OF THE CANDIDATE HOUSE OPENING"/, "western sunset-view intent is missing");
assert.match(app, /sunset_view_target_width_ft:40/, "western sunset-view planning width must begin at 40 feet");
assert.match(app, /sunset_view_geometry_status:"DIRECTIONAL SIGHTLINE ONLY - NOT INCLUDED AS CLEARING ACROSS THE CREEK"/, "sunset sightline must not be misrepresented as creek clearing");
assert.match(app, /component_measurements:Core\.clone\(editor\.components\)/, "homesite component dimensions are not exported");
assert.match(app, /ringsIntersect\(ring,protectedPath\)\|\|ringsIntersect\(ring,streamBuffer\)/, "homesite clearing is not prevented from covering the creek or protected path");
assert.match(app, /navigator\.geolocation\.watchPosition/, "homesite guidance does not show David's live blue location");
assert.match(app, /WESTERN_HOMESITE_CORNER_INDEXES = \[0,5,6,7\]/, "homesite guidance does not use the four candidate-opening corners");
assert.match(app, /Phone GPS ±/, "homesite guidance does not disclose phone-GPS uncertainty");
assert.match(app, /presentation_creek_centerline=Core\.clone\(CREEK_WATER_CENTERLINE\)/, "saved creek-side path does not preserve the separate blue creek interpretation line");
assert.match(app, /Water markers are now summarized by the blue creek line; the original evidence remains unchanged/, "saving the corridor does not explain the marker-to-line presentation change");
assert.match(html, />DRAW IT MYSELF</, "custom path drawing fallback is missing");
assert.match(app, /DRAW_CUSTOM_PROPOSAL_BOUNDARY/, "custom creek-path geometry is not versioned separately from evidence");
assert.match(app, /Core\.replaceFeatureGeometry\(state\.model,"proposals"/, "saved rectangle does not update only the editable proposal layer");
assert.match(app, /property-intelligence-experience-map-v0\.3/, "proposal reset must use a new presentation-storage version without altering older saved map edits");
assert.match(app, /const SEED_OLD_PROPOSAL = false/, "old western proposal must not seed into the new map");
assert.match(app, /if \(SEED_OLD_PROPOSAL &&/, "the old proposal seed must remain explicitly gated off");
assert.match(app, /SOUTHEAST CREEK-SIDE PATH/, "creek-side proposal metadata is missing");
assert.match(app, /WESTERN CANDIDATE HOMESITE CLEARING & TWO APPROACHES/, "two-approach clearing metadata is missing");
assert.match(app, /LARGE-PARCEL PROPOSED CLEARED AREA/, "large-parcel clearing metadata is missing");
assert.match(app, /LARGE-PARCEL WESTERN HOMESITE & ACCESS CONCEPT/, "large-parcel homesite proposal metadata is missing");
assert.match(app, /function proposalDraftGuides\(\)/, "the map does not assemble all unsaved proposal drafts for simultaneous display");
assert.match(app, /CREEK-SIDE PATH[\s\S]*WESTERN HOMESITE[\s\S]*EASTERN HOMESITE/, "the three current proposal drafts are not assembled together");
assert.doesNotMatch(app.match(/function proposalDraftGuides\(\)[\s\S]*?function fitAllVisibleProposals/)?.[0]||"", /templateKey:"LARGE_WESTERN_HOMESITE"/, "the removed large-parcel western frontage proposal is still rendered as a draft");
assert.match(app, /function visibleProposals\(\).*proposal_template!=="LARGE_WESTERN_HOMESITE"/, "saved copies of the removed large-parcel western proposal are not hidden from presentation");
assert.match(app, /!savedTemplates\.has\(guide\.templateKey\)/, "a saved proposal can be duplicated by its unsaved draft guide");
assert.match(app, /guide\.templateKey==="SMALL_CREEK_PATH"\?beginCreekPathEditor\(\):beginProposalShapeEditor\(guide\.templateKey\)/, "clicking a visible proposal draft does not open its correct editor");
assert.match(app, /function fitAllVisibleProposals\(\)/, "opening Proposal does not fit every visible proposal into the map");
assert.match(app, /if\(features\.length\)state\.map\.fitBounds/, "the proposal overview does not zoom to the combined proposal extent");
assert.match(app, /async function captureCurrentMapPicture/, "current map view cannot be saved as a picture");
assert.match(html, /id="mapDetailsPanel"/, "map record details do not have a panel outside the parcel map");
assert.match(app, /state\.map\.on\("popupopen"/, "Leaflet popups are not redirected outside the parcel map");
assert.match(app, /if\(dialog\.show&&!dialog\.open\)dialog\.show\(\)/, "the photo viewer still opens as a map-covering modal");
assert.match(app, /document\.body\.classList\.add\("drawing-panel-open"\)/, "drawing instructions are not moved outside the parcel map");
assert.match(app, /crossOrigin: "anonymous"/, "map imagery is not configured for safe picture capture");

const bounds = Core.rectangleBoundsFromCorners([-87.1, 30.4], [-87.09, 30.41]);
assert.deepEqual(bounds, { west: -87.1, east: -87.09, south: 30.4, north: 30.41 });
const ring = Core.rectangleRing(bounds);
assert.equal(ring[0].length, 5, "rectangle ring must close");
assert.deepEqual(ring[0][0], ring[0][4], "rectangle ring must end at its first point");
assert.deepEqual(Core.rectangleBoundsFromGeometry({ type: "Polygon", coordinates: ring }), bounds);

const model = Core.createModel("test-property");
model.proposals.features.push({
  type: "Feature",
  id: "PROPOSAL-ZONE-001",
  geometry: { type: "Polygon", coordinates: Core.rectangleRing({ west: -87.2, east: -87.19, south: 30.3, north: 30.31 }) },
  properties: { proposal_zone_id: "PROPOSAL-ZONE-001", name: "Original" }
});
const sourceEvidenceBefore = JSON.stringify(model.source_evidence);
Core.replaceFeatureGeometry(
  model,
  "proposals",
  "PROPOSAL-ZONE-001",
  { type: "Polygon", coordinates: ring },
  { geometry_shape: "RECTANGLE" },
  "DRAW_OR_RESIZE_RECTANGLE"
);
assert.deepEqual(model.proposals.features[0].geometry.coordinates, ring);
assert.equal(model.proposals.features[0].properties.name, "Original", "geometry editing must preserve proposal content");
assert.equal(model.edit_history.at(-1).action, "DRAW_OR_RESIZE_RECTANGLE");
assert.equal(model.edit_history.at(-1).source_evidence_modified, false);
assert.equal(JSON.stringify(model.source_evidence), sourceEvidenceBefore, "rectangle editing must not modify source evidence");

Core.undo(model);
assert.notDeepEqual(model.proposals.features[0].geometry.coordinates, ring, "undo must restore the prior proposal rectangle");
assert.equal(JSON.stringify(model.source_evidence), sourceEvidenceBefore, "undo must not modify source evidence");

console.log("PASS: proposal rectangles can be placed, moved, resized, saved, canceled, and undone without changing field evidence.");
