(function (root, factory) {
  "use strict";
  const water = typeof module === "object" && module.exports ? require("./water-intelligence.js") : (root && root.WaterIntelligence);
  const api = factory(water);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ReviewedPropertySynthesis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (waterTools) {
  "use strict";

  const PROPERTY_ID = "parcel:221S280000001010000";
  const PEARSON_REVIEW_DATE = "2026-08-03";
  const ROUTE_RULES = Object.freeze({ maximum_gap_seconds: 120, maximum_walk_speed_mps: 5, maximum_accepted_accuracy_m: 30, materially_different_photo_location_m: 75 });
  const CREEK_WARNING = "Observed flowing-water corridor. Permanence, ordinary high-water limits, wetlands status, drainage rights and building setbacks remain unverified.";
  const HOMESITE_WARNING = "Inspector concept only. Buildability, lot legality, setbacks, septic suitability, wetlands, access, utilities, drainage and permitting remain unverified.";
  const WATER_SCOPE_RULE = "Within the actually walked and visually observed corridor, absence of water evidence may support 'no standing water observed on the inspection date' only when the inspector confirmed every personally observed standing-water location was photographed. It does not prove year-round dryness and does not apply to visually obstructed or unwalked land.";

  const PEARSON_PHASES = Object.freeze([
    { id: "pearson-phase-p3-p11", from: 3, to: 11, area: "Large tract - limited context only", title: "Survey marker, road berm and roadside water", meaning: "North survey-flag and road area; survey marker, road berm, roadside water, wooded-side water and shallow roadside swale. The Entrance button is voided. The inspector thinks the road berm traps water; any drainage modification remains an interpretation requiring professional verification.", classification: "Observed facts plus Inspector interpretation / Needs Professional Verification", confidence: "High for photographed conditions; professional verification required for cause and remedy" },
    { id: "pearson-phase-p12-p43", from: 12, to: 43, area: "Small tract - primary inspection subject", title: "Central/eastern-middle water and dry transitions", meaning: "Localized shallow puddle clusters, some larger pooled spots and dry transitions. These photographs do not establish that the entire small tract was wet.", classification: "Observed", confidence: "High at photographed points; limited outside the observed corridor" },
    { id: "pearson-phase-p44", from: 44, to: 44, area: "Small tract - primary inspection subject", title: "Shallow-water measurement", meaning: "P44 is shallow-water measurement evidence. The nearby Homesite button is voided and must remain a separate audit record.", classification: "Measured / reviewed correction", confidence: "High after inspector confirmation of the measurement" },
    { id: "pearson-phase-p45-p67", from: 45, to: 67, area: "Small tract - primary inspection subject", title: "Mature trees, canopy, spacing and walkability", meaning: "Mature hardwoods and pines beneath established canopy, with naturally spaced trees and generally traversable woodland.", classification: "Observed; species identification remains preliminary", confidence: "Moderate to high for woodland character" },
    { id: "pearson-phase-p68-p72", from: 68, to: 72, area: "Small tract - primary inspection subject", title: "One localized shallow-water area", meaning: "P68-P72 document one water subject, including a measurement, rather than five separate wet areas.", classification: "Observed / Measured", confidence: "High after the evidence set and exact measurement are approved" },
    { id: "pearson-phase-p73", from: 73, to: 73, area: "Small tract - primary inspection subject", title: "Dry transition", meaning: "Transition back to ground with no visible standing water on the inspection date.", classification: "Observed", confidence: "High at the photographed point only" },
    { id: "pearson-phase-p74-p94", from: 74, to: 94, area: "Small tract - primary inspection subject", title: "Mixed mature woodland", meaning: "Magnolia/bay-like grouping, mature mixed trees, established canopy and generally traversable woodland.", classification: "Observed; tree identification incomplete", confidence: "Moderate" },
    { id: "pearson-phase-p95-p146", from: 95, to: 146, area: "Small tract - primary inspection subject", title: "Northwest creek corridor and adjacent wooded ground", meaning: "Flowing-water corridor, bank-tree context, adjacent wooded ground and scenic context. Legal and year-round water classifications remain unverified.", classification: "Observed plus conservative interpretation", confidence: "High at confirmed photo points; lower between points" },
    { id: "pearson-phase-p147-p163", from: 147, to: 163, area: "Small tract - primary inspection subject", title: "Northern trees and two localized puddles", meaning: "Northern mature-tree area with two separate localized shallow puddles at P158-P159 and P162-P163.", classification: "Observed; exact depths require inspector confirmation", confidence: "Moderate to high" },
    { id: "pearson-phase-p164-p190", from: 164, to: 190, area: "Small tract - primary inspection subject", title: "Northern/eastern mixed forest", meaning: "Mixed forest, small isolated puddles, mature pines, hardwoods and magnolia/bay-like vegetation.", classification: "Observed", confidence: "Moderate to high within the photographed corridor" },
    { id: "pearson-phase-p191-p195", from: 191, to: 195, area: "Small tract - primary inspection subject", title: "Eastern/southeastern road frontage", meaning: "Brush and smaller stems, scattered mature pines and nearby overhead lines along the road-oriented eastern area.", classification: "Observed", confidence: "Moderate to high at photographed locations" },
    { id: "pearson-phase-p196", from: 196, to: 196, area: "Small tract - primary inspection subject", title: "Curved-road roadside swale", meaning: "Small roadside swale along the curved Pearson Road frontage.", classification: "Observed", confidence: "High at the photographed point" }
  ]);

  const LAND_USE_CONCEPTS = Object.freeze([
    { id: "premium-western-homestead", label: "Premium western homestead concept", area: "Western approximately 3 to 3.5 acres", ratios: [0.02, 0.62, 0.04, 0.96], meaning: "Place a home on adjacent higher ground; orient living space and a wraparound porch toward creek and bay views; preserve mature pines, hardwoods and magnolia-like trees; selectively clear views and understory; avoid the actual creek corridor." },
    { id: "eastern-builder-parcel", label: "Eastern builder parcel concept", area: "Eastern approximately 2 acres", ratios: [0.62, 0.98, 0.05, 0.95], meaning: "Road-oriented builder area where brush and smaller stems may reduce initial large-tree clearing. One or multiple homes remain subject to lot legality, frontage, septic, utilities, drainage and approvals." },
    { id: "horse-pasture-alternative", label: "Horse-pasture alternative", area: "Eastern approximately 2 acres", ratios: [0.62, 0.98, 0.08, 0.92], meaning: "Conceptually fence the eastern area for horses while retaining the western wooded homestead." },
    { id: "entire-small-tract-homestead", label: "Entire 5.48-acre premium private homesite", area: "Entire small tract", ratios: [0.02, 0.98, 0.03, 0.97], meaning: "One private homestead with creek and bay-view orientation plus workshop, pole barn, trails or recreational use." },
    { id: "two-premium-homesites", label: "Two premium homesite concept", area: "East and west", ratios: [0.03, 0.97, 0.08, 0.92], meaning: "Two conceptual homesites, with the western homesite treated as the premium scenic tract." }
  ]);

  const AUDIENCES = Object.freeze([
    { id: "buyer", label: "Buyer Report", emphasis: ["decision risk", "unknowns", "lowest-cost next investigations", "water and buildability"] },
    { id: "seller", label: "Seller Transparency Report", emphasis: ["documented conditions", "corrections", "limitations", "records a buyer may request"] },
    { id: "builder", label: "Builder Reconnaissance Report", emphasis: ["access", "clearing", "drainage", "conceptual pads", "utilities and approvals"] },
    { id: "forester", label: "Forester Handoff", emphasis: ["tree evidence", "species confidence", "DBH and plot methods", "retention and clearing"] },
    { id: "drainage_engineer", label: "Drainage Engineer Handoff", emphasis: ["creek", "swales", "pooled water", "berm hypothesis", "measurements and unknowns"] },
    { id: "internal", label: "Internal Inspector Report", emphasis: ["complete audit trail", "pending approvals", "collection critique", "return-visit priorities"] }
  ]);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function photoNumber(photo) { const n = Number(String(photo && photo.photo_number || "").replace(/\D/g, "")); return Number.isFinite(n) ? n : null; }
  function recordId(record) { return record && (record.photo_id || record.id || record.voice_note_id || record.observation_id) || null; }
  function pointOf(record) {
    const location = record && record.location || record || {};
    const lat = Number(location.latitude == null ? location.lat : location.latitude);
    const lon = Number(location.longitude == null ? location.lon : location.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }
  function haversine(a, b) {
    const left = pointOf(a), right = pointOf(b);
    if (!left || !right) return null;
    const rad = Math.PI / 180, lat1 = left.lat * rad, lat2 = right.lat * rad;
    const dLat = (right.lat - left.lat) * rad, dLon = (right.lon - left.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function inspectionTime(record) { const t = Date.parse(record && (record.time || record.recorded_at || record.observed_at || record.started_at) || ""); return Number.isFinite(t) ? t : null; }
  function photosInRange(inspection, from, to) { return (inspection.photos || []).filter(photo => { const n = photoNumber(photo); return n != null && n >= from && n <= to; }); }

  function ensureModel(inspection) {
    const data = inspection || {};
    data.review_phase_suggestions = Array.isArray(data.review_phase_suggestions) ? data.review_phase_suggestions : [];
    data.review_synthesis_events = Array.isArray(data.review_synthesis_events) ? data.review_synthesis_events : [];
    data.land_use_concepts = Array.isArray(data.land_use_concepts) ? data.land_use_concepts : [];
    data.reviewed_map_status = Object.assign({ water: "pending_inspector_confirmation", creek: "pending_inspector_confirmation", vegetation: "pending_inspector_confirmation", homesite: "pending_inspector_confirmation" }, data.reviewed_map_status || {});
    data.imported_chat_review_annotations = Array.isArray(data.imported_chat_review_annotations) ? data.imported_chat_review_annotations : [];
    addPearsonReviewSuggestions(data);
    return data;
  }

  function addPearsonReviewSuggestions(inspection) {
    const data = inspection || {};
    const photos = data.photos || [];
    const p3 = photos.find(photo => photoNumber(photo) === 3);
    const inspectionDate = String(data.conditions && data.conditions.inspection_date || data.started || p3 && (p3.recorded_at || p3.time) || "").slice(0, 10);
    if (String(data.property_id || "") !== PROPERTY_ID || inspectionDate !== PEARSON_REVIEW_DATE || !photos.some(photo => photoNumber(photo) === 196)) return data.review_phase_suggestions || [];
    data.review_phase_suggestions = Array.isArray(data.review_phase_suggestions) ? data.review_phase_suggestions : [];
    for (const definition of PEARSON_PHASES) {
      if (data.review_phase_suggestions.some(item => item.review_item_id === definition.id)) continue;
      const phasePhotos = photosInRange(data, definition.from, definition.to);
      data.review_phase_suggestions.push(Object.assign(clone(definition), {
        schema_name: "property-intelligence-reviewed-phase",
        schema_version: "1.0",
        review_item_id: definition.id,
        photo_ids: phasePhotos.map(recordId).filter(Boolean),
        photo_numbers: phasePhotos.map(photo => photo.photo_number),
        status: "pending_inspector_confirmation",
        inspector_approval_required: true,
        activation_rule: "This reviewed phase is not an active finding until the inspector approves it in Review and Build Report.",
        created_at: new Date().toISOString(),
        source: "Inspector-directed Pearson Road photo-by-photo review"
      }));
    }
    data.land_use_concepts = Array.isArray(data.land_use_concepts) ? data.land_use_concepts : [];
    for (const concept of LAND_USE_CONCEPTS) {
      if (!data.land_use_concepts.some(item => item.concept_id === concept.id)) data.land_use_concepts.push(Object.assign(clone(concept), { concept_id: concept.id, status: "pending_inspector_confirmation", inspector_approval_required: true, warning: HOMESITE_WARNING }));
    }
    return data.review_phase_suggestions;
  }

  function reviewItem(inspection, itemId, decision, inspectorIdentity, note) {
    const data = ensureModel(inspection);
    const item = data.review_phase_suggestions.find(row => row.review_item_id === itemId) || data.land_use_concepts.find(row => row.concept_id === itemId);
    if (!item) throw new Error("Review item was not found.");
    if (!['approved', 'rejected', 'pending_inspector_confirmation'].includes(decision)) throw new Error("Unsupported review decision.");
    const at = new Date().toISOString();
    item.status = decision;
    item.reviewed_at = at;
    item.reviewed_by = inspectorIdentity || data.inspector_identity || "Field Inspector";
    item.review_note = note || "";
    data.review_synthesis_events.push({ event_id: `review-event-${Date.now()}-${Math.random().toString(16).slice(2)}`, review_item_id: itemId, decision, recorded_at: at, recorded_by: item.reviewed_by, note: note || "", immutable: true });
    return item;
  }

  function setMapReview(inspection, mapId, decision, inspectorIdentity) {
    const data = ensureModel(inspection);
    if (!Object.prototype.hasOwnProperty.call(data.reviewed_map_status, mapId)) throw new Error("Unknown reviewed map.");
    if (!['approved', 'rejected', 'pending_inspector_confirmation'].includes(decision)) throw new Error("Unsupported map decision.");
    data.reviewed_map_status[mapId] = decision;
    data.review_synthesis_events.push({ event_id: `map-review-${Date.now()}-${Math.random().toString(16).slice(2)}`, map_id: mapId, decision, recorded_at: new Date().toISOString(), recorded_by: inspectorIdentity || data.inspector_identity || "Field Inspector", immutable: true });
    return decision;
  }

  function importChatReview(inspection, payload) {
    const data = ensureModel(inspection);
    const rows = Array.isArray(payload) ? payload : (payload && (payload.review_annotations || payload.annotations || payload.proposed_annotations));
    if (!Array.isArray(rows) || !rows.length) throw new Error("The selected review file contains no proposed annotations.");
    let added = 0;
    for (const source of rows) {
      const id = String(source.annotation_id || source.review_item_id || `chat-review-${Date.now()}-${added}`);
      if (data.imported_chat_review_annotations.some(item => item.annotation_id === id)) continue;
      data.imported_chat_review_annotations.push(Object.assign({}, clone(source), { annotation_id: id, status: "pending_inspector_confirmation", approved_by_inspector: false, imported_at: new Date().toISOString(), activation_rule: "Imported ChatGPT language cannot become a finding until the inspector approves it." }));
      added += 1;
    }
    return added;
  }

  function breakEventsBetween(events, fromTime, toTime) {
    if (fromTime == null || toTime == null) return [];
    return (events || []).filter(event => {
      const time = inspectionTime(event);
      return time != null && time > fromTime && time <= toTime && ["inspection_paused", "inspection_finished", "inspection_area_selected", "explicit_relocation", "relocation", "relocation_hidden", "driving", "new_inspection_phase"].includes(String(event.type || ""));
    });
  }

  function photoResumeBreaks(photos, threshold) {
    const result = [];
    const ordered = (photos || []).filter(pointOf).slice().sort((a, b) => (inspectionTime(a) || 0) - (inspectionTime(b) || 0));
    for (let index = 1; index < ordered.length; index += 1) {
      const prior = ordered[index - 1], current = ordered[index], gap = ((inspectionTime(current) || 0) - (inspectionTime(prior) || 0)) / 1000;
      const distance = haversine(prior, current);
      if (gap > ROUTE_RULES.maximum_gap_seconds && distance != null && distance > threshold) result.push({ time: inspectionTime(current), reason: "photograph_sequence_resumed_materially_different_location", from_photo_id: recordId(prior), to_photo_id: recordId(current), distance_m: distance });
    }
    return result;
  }

  function segmentRoute(points, inspection, options) {
    const settings = Object.assign({}, ROUTE_RULES, options || {});
    const source = points || [];
    const events = inspection && inspection.lifecycle_events || [];
    const photoBreaks = photoResumeBreaks(inspection && inspection.photos || [], settings.materially_different_photo_location_m);
    const allPoints = source.map((point, index) => Object.assign({ source_sequence: index + 1 }, clone(point)));
    const segments = [], relocations = [], rejected = [];
    let current = [], priorAccepted = null, lastArea = null;
    const close = () => { if (current.length) segments.push({ segment_id: `route-segment-${String(segments.length + 1).padStart(3, "0")}`, status: "confirmed_walked_route", point_count: current.length, started_at: current[0].time || null, ended_at: current[current.length - 1].time || null, points: current }); current = []; };
    for (const point of allPoints) {
      const location = pointOf(point), time = inspectionTime(point), accuracy = Number(point.accuracy_m == null ? point.gps_accuracy_m : point.accuracy_m);
      const sourceRejected = point.quality_rejected === true || point.use_for_distance === false || ["poor_accuracy", "gap_or_implausible_segment", "rejected"].includes(String(point.quality_flag || "").toLowerCase());
      if (!location || (Number.isFinite(accuracy) && accuracy > settings.maximum_accepted_accuracy_m) || sourceRejected) {
        point.route_status = "rejected_quality";
        point.rejection_reason = !location ? "invalid_coordinates" : (point.quality_rejection_reason || (sourceRejected ? point.quality_flag || "source_quality_filter_rejected" : `accuracy_exceeds_${settings.maximum_accepted_accuracy_m}_m`));
        rejected.push({ source_sequence: point.source_sequence, reason: point.rejection_reason });
        close();
        continue;
      }
      const priorTime = inspectionTime(priorAccepted), distance = priorAccepted ? haversine(priorAccepted, point) : null;
      const gapSeconds = priorTime != null && time != null ? (time - priorTime) / 1000 : null;
      const speed = gapSeconds > 0 && distance != null ? distance / gapSeconds : null;
      const eventBreaks = breakEventsBetween(events, priorTime, time);
      const phaseBreak = photoBreaks.find(item => priorTime != null && item.time > priorTime && item.time <= time);
      const area = point.area_id || null;
      const reasons = [];
      if (eventBreaks.length) reasons.push(...eventBreaks.map(event => event.type));
      if (priorAccepted && lastArea && area && lastArea !== area) reasons.push("inspection_area_changed");
      if (gapSeconds != null && gapSeconds > settings.maximum_gap_seconds) reasons.push("time_gap_greater_than_120_seconds");
      if (speed != null && speed > settings.maximum_walk_speed_mps) reasons.push("implied_speed_greater_than_5_mps");
      if (phaseBreak) reasons.push(phaseBreak.reason);
      if (priorAccepted && reasons.length) {
        close();
        const hidden = eventBreaks.some(event => event.hide_relocation === true || event.type === "relocation_hidden");
        relocations.push({ relocation_id: `route-relocation-${String(relocations.length + 1).padStart(3, "0")}`, from_source_sequence: priorAccepted.source_sequence, to_source_sequence: point.source_sequence, reasons: Array.from(new Set(reasons)), distance_m: distance, elapsed_seconds: gapSeconds, geometry: { type: "LineString", coordinates: [[pointOf(priorAccepted).lon, pointOf(priorAccepted).lat], [location.lon, location.lat]] }, display: hidden ? "no_connector" : "dashed_gray_unverified_relocation", walked_route_claim: false });
      }
      point.route_status = "accepted_in_walked_segment";
      current.push(point);
      priorAccepted = point;
      if (area) lastArea = area;
    }
    close();
    let distanceWalked = 0;
    segments.forEach(segment => { for (let index = 1; index < segment.points.length; index += 1) distanceWalked += haversine(segment.points[index - 1], segment.points[index]) || 0; });
    return { schema_name: "property-intelligence-segmented-route", schema_version: "1.0", rules: settings, exact_source_point_count: allPoints.length, exact_points_preserved: true, all_points: allPoints, segments, relocations, rejected_points: rejected, distance_walked_m: distanceWalked, distance_walked_miles: distanceWalked / 1609.344, display_rules: { confirmed_walked_route: "solid line", unverified_relocation: "dashed gray line", intentionally_hidden_relocation: "no connector" }, warning: "No straight jump between segments is represented as physically walked." };
  }

  function boundsForRing(ring) {
    const xs = (ring || []).map(point => Number(point[0])).filter(Number.isFinite), ys = (ring || []).map(point => Number(point[1])).filter(Number.isFinite);
    return xs.length && ys.length ? { west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys) } : null;
  }
  function ratioPolygon(bounds, ratios) {
    if (!bounds) return null;
    const width = bounds.east - bounds.west, height = bounds.north - bounds.south;
    const west = bounds.west + width * ratios[0], east = bounds.west + width * ratios[1], south = bounds.south + height * ratios[2], north = bounds.south + height * ratios[3];
    return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]], spatial_status: "CONCEPTUAL_INSPECTOR_INTERPRETATION_NOT_SURVEYED" };
  }
  function ratioLine(bounds, ratios) {
    if (!bounds) return null;
    const width = bounds.east - bounds.west, height = bounds.north - bounds.south;
    return { type: "LineString", coordinates: [[bounds.west + width * ratios[0], bounds.south + height * ratios[1]], [bounds.west + width * ratios[2], bounds.south + height * ratios[3]]], spatial_status: "CONCEPTUAL_INSPECTOR_INTERPRETATION_NOT_SURVEYED" };
  }
  function photoPoints(photos) { return (photos || []).map(photo => { const point = pointOf(photo); return point ? { photo_id: recordId(photo), photo_number: photo.photo_number || null, latitude: point.lat, longitude: point.lon, recorded_at: photo.recorded_at || photo.time || null, explanation_voice_note_ids: photo.explanation_voice_note_ids || (photo.explanation_voice_note_id ? [photo.explanation_voice_note_id] : []) } : null; }).filter(Boolean); }

  function createCreekMap(options) {
    const inspection = options.inspection, small = options.smallTractWaterMap || {}, boundary = small.small_tract && small.small_tract.boundary || [];
    const confirmed = options.flowingWaterModel && options.flowingWaterModel.corridors || [];
    const pending = (inspection.evidence_set_suggestions || []).filter(item => item.suggestion_id === "pearson-northwest-creek-corridor" && item.status === "pending_inspector_confirmation").map(item => ({ suggestion_id: item.suggestion_id, status: item.status, label: item.suggested_label, exact_candidate_photo_points: photoPoints((item.photo_ids || []).map(id => (options.photos || []).find(photo => String(recordId(photo)) === String(id))).filter(Boolean)), conservative_centerline: null, activation_rule: "No centerline or finding becomes active until the inspector approves the evidence set." }));
    const points = photoPoints((options.photos || []).filter(photo => { const n = photoNumber(photo); return n != null && ((n >= 107 && n <= 118) || (n >= 121 && n <= 125) || (n >= 132 && n <= 136) || (n >= 143 && n <= 145) || n === 139); }));
    points.forEach(point => {
      const n = Number(String(point.photo_number || "").replace(/\D/g, ""));
      point.map_roles = n === 145 ? ["Measurement", "Flow Evidence"] : n === 135 || n === 136 ? ["Scenic Context"] : n === 139 ? ["Adjacent Higher-Ground", "Tree Context"] : n === 143 ? ["Upstream Context - pending inspector confirmation"] : n === 144 ? ["Downstream Context - pending inspector confirmation"] : ["Creek Corridor Context"];
      point.evidence_classification = n === 145 ? "Measured / Observed" : "Observed at exact photo point";
      const corridor = confirmed.find(item => (item.exact_photographed_points || []).some(photo => String(photo.photo_id) === String(point.photo_id)));
      if (corridor && !(point.explanation_voice_note_ids || []).length) point.explanation_voice_note_ids = (corridor.voice_note_ids || []).slice();
    });
    return { schema_name: "property-intelligence-creek-corridor-map", schema_version: "1.0", title: "Northwest Creek / Flowing-Water Corridor", property_id: inspection.property_id || null, inspection_id: inspection.inspection_id || null, small_tract_boundary: boundary, review_status: inspection.reviewed_map_status && inspection.reviewed_map_status.creek || "pending_inspector_confirmation", confirmed_corridors: confirmed, pending_corridor_suggestions: pending, photo_points: points, adjacent_ground_rule: "Ground may be described as having no visible standing water only at photographed or walked and visually observed locations.", preliminary_building_avoidance: confirmed.map(corridor => ({ corridor_id: corridor.corridor_id, status: "PRELIMINARY_NOT_REGULATORY", basis: corridor.exact_photographed_points, warning: CREEK_WARNING })), warning: CREEK_WARNING };
  }

  function createVegetationMap(options) {
    const inspection = options.inspection, small = options.smallTractWaterMap || {}, boundary = small.small_tract && small.small_tract.boundary || [], bounds = boundsForRing(boundary);
    const status = inspection.reviewed_map_status && inspection.reviewed_map_status.vegetation || "pending_inspector_confirmation";
    const zones = [
      { zone_id: "western-northern-woodland", label: "Western/northern wooded area", categories: ["mature tree retention area", "magnolia/bay-like grouping", "naturally spaced woodland", "localized fallen/deadwood", "tree identification incomplete"], description: "Established canopy, mature pines and hardwoods, naturally spaced rather than planted rows, generally traversable, with localized understory, vines, deadwood and small stems. Larger trees become more common toward the northern boundary.", supporting_photo_numbers: ["P45-P67", "P74-P94", "P147-P190"], geometry: ratioPolygon(bounds, [0.01, 0.66, 0.03, 0.98]) },
      { zone_id: "eastern-road-frontage", label: "Eastern third / curved-road frontage", categories: ["brush/small-stem clearing area", "low-clearing-cost candidate area", "mature tree retention area", "tree identification incomplete"], description: "Generally high and dry during the inspection; primarily brush, saplings and small crooked stems, with comparatively few large trees in apparent building-pad areas. Approximately five larger pines were noted in the southern portion; additional mature trees farther north may remain as backyard or landscape trees.", supporting_photo_numbers: ["P164-P196"], geometry: ratioPolygon(bounds, [0.64, 0.99, 0.03, 0.98]) }
    ].map(zone => Object.assign(zone, { status, evidence_classification: "Inspector-reviewed vegetation interpretation", cost_rule: "No clearing cost is claimed without contractor pricing." }));
    return { schema_name: "property-intelligence-vegetation-clearing-map", schema_version: "1.0", title: "Vegetation and Clearing Reconnaissance", property_id: inspection.property_id || null, inspection_id: inspection.inspection_id || null, small_tract_boundary: boundary, review_status: status, zones, photo_points: photoPoints((options.photos || []).filter(photo => { const n = photoNumber(photo); return n != null && n >= 45 && n <= 196; })), categories: ["mature tree retention area", "magnolia/bay-like grouping", "brush/small-stem clearing area", "naturally spaced woodland", "localized fallen/deadwood", "low-clearing-cost candidate area", "tree identification incomplete", "uninspected vegetation"], limitation: "Vegetation zones are inspector interpretations based on reviewed field evidence. Species, merchantability, removal feasibility and actual clearing cost remain unverified." };
  }

  function createHomesiteMap(options) {
    const inspection = options.inspection, small = options.smallTractWaterMap || {}, boundary = small.small_tract && small.small_tract.boundary || [], bounds = boundsForRing(boundary);
    const layouts = {
      "premium-western-homestead": { pads: [[0.13, 0.35, 0.44, 0.64]], drives: [[0.98, 0.52, 0.24, 0.54]], privacy: [[0.01, 0.62, 0.03, 0.98]] },
      "eastern-builder-parcel": { pads: [[0.72, 0.90, 0.42, 0.66]], drives: [[0.99, 0.54, 0.81, 0.54]], privacy: [[0.62, 0.99, 0.03, 0.98]] },
      "horse-pasture-alternative": { pads: [[0.13, 0.35, 0.44, 0.64]], drives: [[0.98, 0.52, 0.24, 0.54]], privacy: [[0.01, 0.62, 0.03, 0.98]], pasture: ratioPolygon(bounds, [0.64, 0.98, 0.08, 0.92]) },
      "entire-small-tract-homestead": { pads: [[0.38, 0.58, 0.43, 0.64]], drives: [[0.99, 0.54, 0.48, 0.54]], privacy: [[0.02, 0.98, 0.03, 0.97]] },
      "two-premium-homesites": { pads: [[0.14, 0.34, 0.43, 0.63], [0.72, 0.90, 0.43, 0.64]], drives: [[0.99, 0.54, 0.81, 0.54], [0.81, 0.54, 0.24, 0.54]], privacy: [[0.02, 0.48, 0.03, 0.97], [0.54, 0.98, 0.03, 0.97]] }
    };
    const concepts = (inspection.land_use_concepts || []).map(concept => {
      const layout = layouts[concept.concept_id] || { pads: [], drives: [], privacy: [] };
      return Object.assign({}, clone(concept), {
        geometry: ratioPolygon(bounds, concept.ratios || [0.05, 0.95, 0.05, 0.95]),
        potential_building_pad_areas: layout.pads.map((ratios, index) => ({ pad_id: `${concept.concept_id}-pad-${index + 1}`, geometry: ratioPolygon(bounds, ratios), status: "CONCEPTUAL_NOT_TESTED" })),
        possible_drive_access_directions: layout.drives.map((ratios, index) => ({ access_id: `${concept.concept_id}-access-${index + 1}`, geometry: ratioLine(bounds, ratios), status: "CONCEPTUAL_ROUTE_NOT_FIELD_VERIFIED" })),
        privacy_buffer_options: layout.privacy.map((ratios, index) => ({ buffer_id: `${concept.concept_id}-privacy-${index + 1}`, geometry: ratioPolygon(bounds, ratios), status: "CONCEPTUAL_RETENTION_OPTION" })),
        pasture_option: layout.pasture || null,
        layer_enabled: concept.status === "approved",
        warning: HOMESITE_WARNING
      });
    });
    return { schema_name: "property-intelligence-homesite-opportunity-map", schema_version: "1.0", title: "Homesite and Land-Use Opportunities", property_id: inspection.property_id || null, inspection_id: inspection.inspection_id || null, small_tract_boundary: boundary, review_status: inspection.reviewed_map_status && inspection.reviewed_map_status.homesite || "pending_inspector_confirmation", concepts, potential_building_pad_rule: "All pads are conceptual inspector interpretations, not surveyed footprints or approved building sites.", possible_drive_access_rule: "Arrows show possible approach direction only; grade, crossings, frontage, ownership and permits remain unverified.", privacy_buffer_rule: "Buffers are optional retention concepts, not legal setbacks.", water_evidence: small.water_photographs || [], creek_avoidance: small.preliminary_building_avoidance_areas || [], roadside_swale_photos: photoPoints((options.photos || []).filter(photo => photoNumber(photo) === 196)), mature_tree_photos: photoPoints((options.photos || []).filter(photo => { const n = photoNumber(photo); return n != null && ((n >= 45 && n <= 67) || (n >= 74 && n <= 94) || (n >= 147 && n <= 190)); })), photo_points: photoPoints((options.photos || []).filter(photo => { const n = photoNumber(photo); return n != null && n >= 12 && n <= 196; })), inspected_vs_unknown: small.uninspected_unknown || null, warning: HOMESITE_WARNING };
  }

  function observationsForPhotos(inspection, photos) {
    const ids = new Set((photos || []).map(recordId).filter(Boolean).map(String));
    return (inspection.markers || inspection.observations || []).filter(item => ids.has(String(item.photo_id || "")) || ids.has(String(item.associated_photo_id || ""))).map(item => item.observation_id || item.id).filter(Boolean);
  }

  function reportSection(title, meaning, photos, observations, classification, confidence, limitations) {
    return { title, plain_english_meaning: meaning, supporting_photo_numbers: photos || [], supporting_observation_ids: observations || [], evidence_classification: classification || "Observed / reviewed synthesis", confidence: confidence || "Moderate within the inspected corridor", limitations: Array.isArray(limitations) ? limitations : [limitations || "Conditions outside the walked and visually observed corridor remain unknown."] };
  }

  function createPropertyReport(options) {
    const inspection = options.inspection, phases = (inspection.review_phase_suggestions || []).filter(item => item.status === "approved"), pending = (inspection.review_phase_suggestions || []).filter(item => item.status === "pending_inspector_confirmation");
    const phase = id => phases.find(item => item.review_item_id === id);
    const photos = ids => ids.flatMap(id => phase(id) ? phase(id).photo_numbers : []);
    const obs = ids => observationsForPhotos(inspection, ids.flatMap(id => phase(id) ? photosInRange(inspection, phase(id).from, phase(id).to) : []));
    const sections = [
      reportSection("1. What was inspected", "The approximately 81.20-acre large tract received limited context documentation at P3-P11. Nearly all field time and P12-P196 concern the approximately 5.48-acre small tract. Combined property area is approximately 86.68 acres.", photos(["pearson-phase-p3-p11", "pearson-phase-p12-p43", "pearson-phase-p164-p190", "pearson-phase-p196"]), obs(["pearson-phase-p3-p11", "pearson-phase-p12-p43"]), "Observed inspection scope", "High after phase approval", ["Large-tract conclusions must remain limited to P3-P11 context."]),
      reportSection("2. What was not inspected", "Most of the large tract was not comprehensively walked. Small-tract ground outside the walked and visually observed corridor remains unknown.", [], [], "Coverage interpretation", "High for route extent; no condition conclusion for unvisited land", ["Never infer dryness, access or buildability from missing evidence in unvisited acreage."]),
      reportSection("3. Weather and storm context", "Weather records explain the context in which conditions were observed; they do not prove why water was present or establish year-round conditions.", [], [], "Observed conditions plus Public Data when supplied", "Depends on station distance and entered source", ["Keep station rainfall, inspector-reported local rain, site observations and causal interpretations separate."]),
      reportSection("4. Small-tract overview", "The small tract contains localized water evidence, a northwest creek corridor, established western/northern woodland and a more road-oriented eastern area. It should not be described as uniformly wet or uniformly impassable.", photos(["pearson-phase-p12-p43", "pearson-phase-p45-p67", "pearson-phase-p74-p94", "pearson-phase-p164-p190", "pearson-phase-p191-p195"]), obs(["pearson-phase-p12-p43", "pearson-phase-p191-p195"]), "Inspector-reviewed synthesis", "Moderate to high within the observed corridor", [WATER_SCOPE_RULE]),
      reportSection("5. What the water map shows", "The map separates photographed creek points, roadside swale, isolated puddles, larger pools, connected clusters, observed no-standing-water corridor and uninspected ground.", photos(["pearson-phase-p12-p43", "pearson-phase-p68-p72", "pearson-phase-p147-p163", "pearson-phase-p164-p190", "pearson-phase-p196"]), obs(["pearson-phase-p12-p43", "pearson-phase-p68-p72"]), "Observed points plus conservative inferred extents", "High at exact points; lower for inferred extents", [WATER_SCOPE_RULE, "One small puddle never supports a broad wet-area polygon."]),
      reportSection("6. Northwest creek", "The northwest sequence documents an observed flowing-water corridor and adjacent wooded ground. It may be a scenic amenity and a building-avoidance consideration.", photos(["pearson-phase-p95-p146"]), obs(["pearson-phase-p95-p146"]), "Observed plus conservative interpretation", "High at confirmed photos; lower between them", [CREEK_WARNING]),
      reportSection("7. Isolated puddles and larger pooled areas", "Several photographs may document one localized water subject. Small puddles, larger pools and connected clusters are counted by confirmed subject, not by photograph count.", photos(["pearson-phase-p12-p43", "pearson-phase-p68-p72", "pearson-phase-p147-p163", "pearson-phase-p164-p190"]), obs(["pearson-phase-p12-p43", "pearson-phase-p68-p72"]), "Observed / Measured / Inspector Estimate", "Moderate to high after group and measurement approval", ["Common 3 by 5 foot surfaces and a one-foot soft-ground margin are inspector estimates unless individually measured."]),
      reportSection("8. Woodland, canopy and tree character", "Much of the western and northern small tract was traversable beneath established canopy with mature pines, hardwoods and magnolia/bay-like vegetation.", photos(["pearson-phase-p45-p67", "pearson-phase-p74-p94", "pearson-phase-p147-p163", "pearson-phase-p164-p190"]), obs(["pearson-phase-p45-p67"]), "Observed; species identification preliminary", "Moderate", ["This is not a certified timber cruise, appraisal or species determination."]),
      reportSection("9. Eastern lower-clearing-cost area", "The eastern third appeared generally high and dry during the inspection and contained more brush, saplings and smaller crooked stems than the western woodland. It may require fewer large-tree removals, but actual clearing cost needs contractor pricing.", photos(["pearson-phase-p164-p190", "pearson-phase-p191-p195", "pearson-phase-p196"]), obs(["pearson-phase-p191-p195"]), "Observed plus preliminary cost interpretation", "Moderate", ["No clearing-cost figure is supported without contractor pricing; seasonal water and soils remain unverified."]),
      reportSection("10. Candidate land-use concepts", "The package shows western homestead, eastern builder, horse-pasture, single-estate and two-homesite concepts as separate optional layers.", [], [], "Inspector concept", "Conceptual only", [HOMESITE_WARNING]),
      reportSection("11. What a buyer should know", "The strongest current evidence concerns the small tract. Water, clearing, access and scenic value are documented enough to guide targeted due diligence, not to replace it.", photos(["pearson-phase-p12-p43", "pearson-phase-p95-p146", "pearson-phase-p191-p195"]), obs(["pearson-phase-p12-p43"]), "Decision synthesis", "Moderate", ["Price, title, lot legality, septic, utilities and regulatory constraints are outside this inspection unless separately documented."]),
      reportSection("12. What a seller can transparently provide", "Provide this immutable inspection record, survey and parcel information, drainage history, utility information and any septic, wetland or access records without presenting interpretations as approvals.", photos(["pearson-phase-p3-p11", "pearson-phase-p95-p146"]), obs(["pearson-phase-p3-p11"]), "Transparency recommendation", "High as a records request", ["The report does not make legal disclosure determinations."]),
      reportSection("13. What a builder may care about", "A builder will likely focus on road access, the eastern brush/small-stem area, creek and swale avoidance, drainage, utilities, septic and legal lot configuration.", photos(["pearson-phase-p95-p146", "pearson-phase-p191-p195", "pearson-phase-p196"]), obs(["pearson-phase-p191-p195"]), "Reconnaissance interpretation", "Moderate", [HOMESITE_WARNING]),
      reportSection("14. What a forester may care about", "The retained tree evidence can guide a forester to representative mature pines, hardwoods, canopy character, defects and potential retention areas.", photos(["pearson-phase-p45-p67", "pearson-phase-p74-p94", "pearson-phase-p147-p163", "pearson-phase-p164-p190"]), obs(["pearson-phase-p45-p67"]), "Preliminary timber reconnaissance", "Low to moderate until species and measurements are verified", ["Not a certified cruise, appraisal, sale valuation or merchantable-volume estimate."]),
      reportSection("15. What an engineer may need to answer", "An engineer may need elevations, lawful outlet, downstream capacity, right-of-way constraints, creek limits, swale function and effects of modifying the large-tract road berm.", photos(["pearson-phase-p3-p11", "pearson-phase-p95-p146", "pearson-phase-p196"]), obs(["pearson-phase-p3-p11"]), "Professional verification question", "Not established by inspection", ["No drainage modification is recommended as workable until verified."]),
      reportSection("16. Questions answered", "Approved review phases answer what was photographed, where the primary inspection occurred, and which broad water and vegetation conditions were observed that day.", phases.flatMap(item => item.photo_numbers), [], "Inspector-approved synthesis", phases.length ? "Moderate to high" : "Pending approval", ["Only approved review phases are used as active answers."]),
      reportSection("17. Questions remaining", "Unvisited acreage, year-round water behavior, creek regulation, septic suitability, legal lots, utilities, exact clearing cost and professional tree identification remain unresolved.", [], [], "Unknown / Needs Professional Verification", "High that these remain unknown", ["Do not fill these gaps by inference."]),
      reportSection("18. Cheapest next investigations", "Start with existing-record review, utility availability calls, a targeted boundary/topographic survey, septic screening, a dry-period return visit and contractor clearing quotes before commissioning broader studies.", [], [], "Recommended next steps", "Moderate", ["Sequence work by the decision each answer could change."]),
      reportSection("19. Main-report photographs", "Critical and approved phase photographs should carry the report narrative; repeated reference views remain in the appendix.", phases.flatMap(item => item.photo_numbers), [], "Curated evidence", phases.length ? "High for inclusion after approval" : "Pending approval", ["Photo value is not the same as factual certainty."]),
      reportSection("20. Evidence appendix", "The appendix retains every active photo, observation, voice note, exact GPS point, segmented route, measurement, correction and audit-only original record.", (inspection.photos || []).map(photo => photo.photo_number).filter(Boolean), (inspection.markers || []).map(item => item.id).filter(Boolean), "Immutable evidence index", "High for record completeness when package integrity checks pass", ["Voided records remain recoverable but do not support current findings."])
    ];
    return { schema_name: "property-intelligence-understandable-report", schema_version: "1.0", title: "Pearson Road Property Intelligence Report", property_scope: { large_tract_acres_approx: 81.20, small_tract_acres_approx: 5.48, combined_acres_approx: 86.68, large_tract_scope: "LIMITED CONTEXT ONLY - P3-P11", small_tract_scope: "PRIMARY INSPECTION SUBJECT - P12-P196" }, approval_summary: { approved_phase_count: phases.length, pending_phase_count: pending.length, pending_phase_ids: pending.map(item => item.review_item_id), rule: "Pending review annotations are not active findings." }, sections };
  }

  function propertyReportMarkdown(report) {
    return `# ${report.title}\n\n## Inspection scope\n\n- Large tract: approximately ${report.property_scope.large_tract_acres_approx.toFixed(2)} acres - limited context only (P3-P11)\n- Small tract: approximately ${report.property_scope.small_tract_acres_approx.toFixed(2)} acres - primary inspection subject (P12-P196)\n- Combined: approximately ${report.property_scope.combined_acres_approx.toFixed(2)} acres\n- Approval status: ${report.approval_summary.approved_phase_count} reviewed phases approved; ${report.approval_summary.pending_phase_count} still pending.\n\n${report.sections.map(section => `## ${section.title}\n\n${section.plain_english_meaning}\n\n- Supporting photographs: ${section.supporting_photo_numbers.join(", ") || "None specifically assigned"}\n- Supporting observations: ${section.supporting_observation_ids.join(", ") || "None specifically assigned"}\n- Evidence classification: ${section.evidence_classification}\n- Confidence: ${section.confidence}\n- Limitations: ${section.limitations.join(" ")}\n`).join("\n")}\n`;
  }
  function esc(value) { return String(value == null ? "" : value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
  function propertyReportHtml(report) {
    const sections = report.sections.map(section => `<section><h2>${esc(section.title)}</h2><p class="meaning">${esc(section.plain_english_meaning)}</p><dl><dt>Supporting photographs</dt><dd>${esc(section.supporting_photo_numbers.join(", ") || "None specifically assigned")}</dd><dt>Supporting observations</dt><dd>${esc(section.supporting_observation_ids.join(", ") || "None specifically assigned")}</dd><dt>Evidence classification</dt><dd>${esc(section.evidence_classification)}</dd><dt>Confidence</dt><dd>${esc(section.confidence)}</dd><dt>Limitations</dt><dd>${esc(section.limitations.join(" "))}</dd></dl></section>`).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.title)}</title><style>@page{size:letter portrait;margin:.55in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#171717;max-width:900px;margin:auto;padding:20px;line-height:1.4}header{border:4px solid #183f5f;padding:18px}section{border-top:2px solid #777;padding:14px 0;break-inside:avoid}h1{margin:.1em 0}.meaning{font-size:1.08rem}dt{font-weight:800;margin-top:7px}dd{margin-left:0}.warning{background:#fff4d6;border:3px solid #8a4400;padding:12px;font-weight:800}@media print{body{max-width:none;padding:0}section{break-inside:avoid}}</style></head><body><header><h1>${esc(report.title)}</h1><p>Large tract: approximately 81.20 acres, limited context only. Small tract: approximately 5.48 acres, primary inspection subject. Combined: approximately 86.68 acres.</p><p class="warning">${esc(report.approval_summary.rule)} ${report.approval_summary.pending_phase_count} phase(s) remain pending.</p></header>${sections}</body></html>`;
  }

  function audienceReports(report) {
    const rule = "Every audience version uses the same immutable evidence and audit history. Only emphasis changes.";
    return { schema_name: "property-intelligence-audience-reports", schema_version: "1.0", immutable_evidence_rule: rule, reports: AUDIENCES.map(audience => {
      const filename = `${audience.id.replaceAll("_", "-")}-report.md`;
      const markdown = `# ${audience.label}\n\n${rule}\n\n## This version emphasizes\n\n${audience.emphasis.map(item => `- ${item}`).join("\n")}\n\n${report.sections.map(section => `## ${section.title}\n\n${section.plain_english_meaning}\n\n- Evidence: ${section.supporting_photo_numbers.join(", ") || "No photographs specifically assigned"}; ${section.supporting_observation_ids.join(", ") || "no observations specifically assigned"}\n- Classification: ${section.evidence_classification}\n- Confidence: ${section.confidence}\n- Limitations: ${section.limitations.join(" ")}\n`).join("\n")}\n`;
      return { audience_id: audience.id, title: audience.label, emphasis: audience.emphasis, source_report: "PROPERTY_INTELLIGENCE_REPORT.md", source_sections: report.sections.map(section => section.title), filename: `audience-reports/${filename}`, markdown, prohibited_change: "Do not add, remove or strengthen facts for an audience." };
    }) };
  }

  function mapHtml(model, manifest) {
    const boundary = model.small_tract_boundary || [], bounds = boundsForRing(boundary) || { west: -87.1, east: -87.083, south: 30.4825, north: 30.497 }, width = 1000, height = 700;
    const sx = lon => ((Number(lon) - bounds.west) / Math.max(1e-9, bounds.east - bounds.west)) * width;
    const sy = lat => height - ((Number(lat) - bounds.south) / Math.max(1e-9, bounds.north - bounds.south)) * height;
    const path = ring => (ring || []).map((point, index) => `${index ? "L" : "M"}${sx(point[0]).toFixed(1)} ${sy(point[1]).toFixed(1)}`).join(" ") + (ring && ring.length ? " Z" : "");
    const zoneSource = model.zones || model.concepts || [];
    const zones = zoneSource.map((zone, index) => {
      const layer = `layer-${esc(zone.zone_id || zone.concept_id)}`, ring = zone.geometry && zone.geometry.coordinates && zone.geometry.coordinates[0];
      const base = ring ? `<path class="zone ${layer}" d="${path(ring)}" fill="${index % 2 ? "rgba(255,181,71,.25)" : "rgba(74,160,95,.24)"}" stroke="#7a4a00" stroke-width="3" stroke-dasharray="10 7"><title>${esc(zone.label)} - ${esc(zone.status)}</title></path>` : "";
      const privacy = (zone.privacy_buffer_options || []).filter(item => item.geometry && item.geometry.coordinates).map(item => `<path class="${layer}" d="${path(item.geometry.coordinates[0])}" fill="none" stroke="#2f6f3e" stroke-width="10" stroke-dasharray="5 7"><title>Conceptual privacy/tree-retention buffer - not a legal setback</title></path>`).join("");
      const pads = (zone.potential_building_pad_areas || []).filter(item => item.geometry && item.geometry.coordinates).map(item => `<path class="${layer}" d="${path(item.geometry.coordinates[0])}" fill="rgba(255,238,88,.5)" stroke="#7a5200" stroke-width="4"><title>Conceptual potential building-pad area - untested and unapproved</title></path>`).join("");
      const drives = (zone.possible_drive_access_directions || []).filter(item => item.geometry && item.geometry.coordinates).map(item => `<line class="${layer}" x1="${sx(item.geometry.coordinates[0][0]).toFixed(1)}" y1="${sy(item.geometry.coordinates[0][1]).toFixed(1)}" x2="${sx(item.geometry.coordinates[1][0]).toFixed(1)}" y2="${sy(item.geometry.coordinates[1][1]).toFixed(1)}" stroke="#a63c00" stroke-width="5" stroke-dasharray="12 8" marker-end="url(#arrow)"><title>Possible drive/access direction - not field verified</title></line>`).join("");
      const pasture = zone.pasture_option && zone.pasture_option.coordinates ? `<path class="${layer}" d="${path(zone.pasture_option.coordinates[0])}" fill="rgba(138,210,93,.24)" stroke="#356f18" stroke-width="4"><title>Conceptual horse-pasture area</title></path>` : "";
      return `${base}${privacy}${pads}${drives}${pasture}`;
    }).join("");
    const photoRows = model.photo_points || [];
    const photoById = new Map((manifest.photographs || []).map(photo => [String(photo.photo_id), photo]));
    const voiceById = new Map((manifest.voice_notes || []).map(voice => [String(voice.voice_note_id), voice]));
    const markers = photoRows.map(point => { const photo = photoById.get(String(point.photo_id)) || {}, voiceIds = point.explanation_voice_note_ids || photo.explanation_voice_note_ids || [], voice = voiceById.get(String(voiceIds[0] || "")), roles = (point.map_roles || []).join(" / "); return `<circle class="photo" cx="${sx(point.longitude).toFixed(1)}" cy="${sy(point.latitude).toFixed(1)}" r="9" tabindex="0" data-label="${esc(point.photo_number || point.photo_id)}${roles ? ` - ${esc(roles)}` : ""}" data-photo="${esc(photo.analysis && photo.analysis.path || "")}" data-voice="${esc(voice && voice.audio && voice.audio.path || "")}"><title>${esc(point.photo_number || point.photo_id)} - actual photograph${roles ? ` - ${esc(roles)}` : ""}</title></circle>`; }).join("");
    const creekOverlays = (model.confirmed_corridors || []).map(corridor => {
      const coordinates = corridor.conservative_centerline && corridor.conservative_centerline.coordinates || [];
      const line = coordinates.length > 1 ? `<polyline points="${coordinates.map(point => `${sx(point[0]).toFixed(1)},${sy(point[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="#006cff" stroke-width="6" stroke-dasharray="13 9"><title>Conservative inferred creek centerline - not surveyed</title></polyline>` : "";
      const avoidance = coordinates.length > 1 ? `<polyline points="${coordinates.map(point => `${sx(point[0]).toFixed(1)},${sy(point[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="rgba(190,20,20,.28)" stroke-width="30"><title>Preliminary building-avoidance corridor - not regulatory</title></polyline>` : "";
      const arrows = (corridor.flow_direction_arrows || []).map(arrow => `<line x1="${sx(arrow.from[0]).toFixed(1)}" y1="${sy(arrow.from[1]).toFixed(1)}" x2="${sx(arrow.to[0]).toFixed(1)}" y2="${sy(arrow.to[1]).toFixed(1)}" stroke="#001f5b" stroke-width="4" marker-end="url(#arrow)"><title>Inspector-confirmed flow direction: ${esc(arrow.direction_reported)}</title></line>`).join("");
      const measurements = [...(corridor.measured_depth_points || []), ...(corridor.measured_width_points || [])].map(point => `<rect x="${(sx(point.longitude) - 8).toFixed(1)}" y="${(sy(point.latitude) - 8).toFixed(1)}" width="16" height="16" fill="#fff" stroke="#003f8f" stroke-width="4"><title>${point.depth_in != null ? `${esc(point.depth_in)} in depth` : `${esc(point.width_ft)} ft width`} - measured</title></rect>`).join("");
      return `${avoidance}${line}${arrows}${measurements}`;
    }).join("");
    const routeSegments = model.route && model.route.segments || [];
    const routes = routeSegments.map(segment => `<polyline points="${segment.points.map(point => `${sx(point.lon).toFixed(1)},${sy(point.lat).toFixed(1)}`).join(" ")}" fill="none" stroke="#263238" stroke-width="4"/>`).join("");
    const relocations = (model.route && model.route.relocations || []).filter(item => item.display !== "no_connector").map(item => `<polyline points="${item.geometry.coordinates.map(point => `${sx(point[0]).toFixed(1)},${sy(point[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="#888" stroke-width="3" stroke-dasharray="8 8"><title>Unverified relocation - not a walked route</title></polyline>`).join("");
    const toggles = zoneSource.map(zone => `<label><input type="checkbox" data-layer="${esc(zone.zone_id || zone.concept_id)}" ${zone.layer_enabled || zone.status === "approved" ? "checked" : ""}>${esc(zone.label)} (${esc(zone.status)})</label>`).join("");
    const warning = model.warning || model.limitation || "Interpretive map; exact photographed points remain the controlling field evidence.";
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(model.title)}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:#eef2ed;color:#111}header,.controls,.warning{padding:12px}header{background:#173f5f;color:#fff}.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.controls label{background:#fff;border:2px solid #555;padding:10px;font-weight:800}svg{display:block;width:100%;height:auto;background:#dce8d6;border:4px solid #111}.boundary{fill:rgba(255,255,255,.18);stroke:#d00000;stroke-width:5}.photo{fill:#006cff;stroke:#fff;stroke-width:3;cursor:pointer}.warning{background:#fff4d6;border:3px solid #8a4400;font-weight:800}dialog{width:min(92vw,760px)}dialog img{max-width:100%;max-height:65vh}button{min-height:52px;font-size:17px;font-weight:800}audio{width:100%}</style></head><body><header><h1>${esc(model.title)}</h1><p>Solid blue markers open actual photographs. Dashed gray route links are unverified relocations and are not represented as walked.</p></header><div class="controls">${toggles || "<strong>No optional conceptual layers are active.</strong>"}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(model.title)}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#001f5b"/></marker></defs><path class="boundary" d="${path(boundary)}"/>${zones}${routes}${relocations}${creekOverlays}${markers}</svg><p class="warning">${esc(warning)}</p><dialog id="evidence"><button id="close">Close</button><h2 id="label"></h2><img id="image" alt="Inspection photograph"><audio id="audio" controls hidden></audio><p id="missing"></p></dialog><script>(()=>{const d=document.getElementById('evidence'),img=document.getElementById('image'),audio=document.getElementById('audio'),missing=document.getElementById('missing');function open(e){const n=e.currentTarget,p=n.dataset.photo,v=n.dataset.voice;document.getElementById('label').textContent=n.dataset.label;if(p){img.src=p;img.hidden=false;missing.textContent=''}else{img.hidden=true;missing.textContent='Photograph path is not available in this package.'}if(v){audio.src=v;audio.hidden=false}else{audio.hidden=true;audio.removeAttribute('src')}d.showModal()}document.querySelectorAll('.photo').forEach(n=>{n.addEventListener('click',open);n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(e)}})});document.getElementById('close').onclick=()=>d.close();document.querySelectorAll('[data-layer]').forEach(c=>c.onchange=()=>document.querySelectorAll('.layer-'+c.dataset.layer).forEach(n=>n.style.display=c.checked?'':'none'));document.querySelectorAll('[data-layer]').forEach(c=>c.onchange())})()</script></body></html>`;
  }

  function buildSynthesis(options) {
    const settings = options || {}, source = ensureModel(settings.inspection || {}), photos = settings.photos || source.photos || [], voices = settings.voiceNotes || source.voice_notes || [];
    const route = segmentRoute(source.points || source.gps_track || [], Object.assign({}, source, { photos }), settings.routeOptions);
    const smallWater = settings.smallTractWaterMap || { status: "NOT_AVAILABLE" };
    const flowing = settings.flowingWaterModel || { corridors: [] };
    const creek = createCreekMap({ inspection: source, photos, voiceNotes: voices, smallTractWaterMap: smallWater, flowingWaterModel: flowing });
    creek.route = route;
    const vegetation = createVegetationMap({ inspection: source, photos, smallTractWaterMap: smallWater }); vegetation.route = route;
    const homesite = createHomesiteMap({ inspection: source, photos, smallTractWaterMap: smallWater }); homesite.route = route;
    const report = createPropertyReport({ inspection: Object.assign({}, source, { photos }) });
    return { schema_name: "property-intelligence-reviewed-synthesis", schema_version: "1.0", property_scope: report.property_scope, route, review: { phases: source.review_phase_suggestions, events: source.review_synthesis_events, imported_chat_review_annotations: source.imported_chat_review_annotations, map_status: source.reviewed_map_status, rule: "Nothing inferred becomes active until inspector approval." }, creek_corridor_map: creek, vegetation_clearing_map: vegetation, homesite_opportunity_map: homesite, property_report: report, property_report_markdown: propertyReportMarkdown(report), property_report_html: propertyReportHtml(report), audience_reports: audienceReports(report), map_html: { creek: mapHtml(creek, settings.manifest || { photographs: photos, voice_notes: voices }), vegetation: mapHtml(vegetation, settings.manifest || { photographs: photos, voice_notes: voices }), homesite: mapHtml(homesite, settings.manifest || { photographs: photos, voice_notes: voices }) }, warnings: [CREEK_WARNING, HOMESITE_WARNING, WATER_SCOPE_RULE] };
  }

  return { PROPERTY_ID, ROUTE_RULES, CREEK_WARNING, HOMESITE_WARNING, WATER_SCOPE_RULE, PEARSON_PHASES, LAND_USE_CONCEPTS, AUDIENCES, ensureModel, addPearsonReviewSuggestions, reviewItem, setMapReview, importChatReview, segmentRoute, createCreekMap, createVegetationMap, createHomesiteMap, createPropertyReport, propertyReportMarkdown, propertyReportHtml, audienceReports, mapHtml, buildSynthesis };
});
