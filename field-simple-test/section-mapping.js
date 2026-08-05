(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SimpleSectionMapping = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DESCRIPTIONS = Object.freeze([
    "SMALL BRUSH", "MOSTLY 2–3-INCH BRUSH", "BRUSH LARGER THAN 3 INCHES",
    "NO LARGE TREES OBSERVED", "SCATTERED LARGE TREES", "MANY LARGE TREES",
    "MIXED BRUSH AND TREES", "OPEN UNDER LARGE TREES", "WET / SOFT GROUND",
    "FIRM GROUND", "TOO THICK TO WALK", "OTHER", "UNSURE"
  ]);

  const METHODS = Object.freeze({
    WALK_WHOLE_EDGE: "WALK THE WHOLE EDGE",
    WALK_REACHABLE_EDGE: "WALK ONLY THE EDGE I CAN REACH",
    MARK_CORNERS: "MARK CORNERS",
    DRAW_LATER: "DRAW IT LATER FROM THE MAP",
    PHOTO_VOICE_ONLY: "PHOTO AND OPTIONAL VOICE NOTE ONLY"
  });

  function ensureModel(inspection) {
    inspection.section_mapping = inspection.section_mapping && typeof inspection.section_mapping === "object" ? inspection.section_mapping : {};
    const model = inspection.section_mapping;
    model.schema_name = "property-intelligence-simple-section-mapping";
    model.schema_version = "1.0";
    model.sections = Array.isArray(model.sections) ? model.sections : [];
    model.next_section_number = Math.max(Number(model.next_section_number) || 1, model.sections.length + 1);
    model.active_section_id = model.active_section_id || null;
    model.planning_suggestions = Array.isArray(model.planning_suggestions) && model.planning_suggestions.length ? model.planning_suggestions : [
      { suggestion_id: "small-parcel-east", area_label: "Small parcel — eastern portion", descriptions: ["MOSTLY 2–3-INCH BRUSH", "NO LARGE TREES OBSERVED"], status: "INSPECTOR_SUPPLIED_STARTING_INFORMATION_NOT_FIELD_CONFIRMED" },
      { suggestion_id: "small-parcel-west", area_label: "Small parcel — western portion", descriptions: ["MANY LARGE TREES"], prompt: "Select the applicable brush condition during field confirmation.", status: "INSPECTOR_SUPPLIED_STARTING_INFORMATION_NOT_FIELD_CONFIRMED" },
      { suggestion_id: "large-parcel-curved-road", area_label: "Large parcel near the small curved road", descriptions: ["MOSTLY 2–3-INCH BRUSH"], status: "INSPECTOR_SUPPLIED_STARTING_INFORMATION_NOT_FIELD_CONFIRMED" },
      { suggestion_id: "large-parcel-pearson", area_label: "Large parcel along north–south Pearson", descriptions: ["MIXED BRUSH AND TREES"], status: "INSPECTOR_SUPPLIED_STARTING_INFORMATION_NOT_FIELD_CONFIRMED" }
    ];
    return model;
  }

  function pointFrom(position, time) {
    if (!position) return null;
    return {
      information_class: "CAPTURED_BY_DEVICE",
      latitude: Number(position.lat), longitude: Number(position.lon),
      gps_accuracy_m: position.accuracy_m == null ? null : Number(position.accuracy_m),
      gps_position_at: position.time || time || new Date().toISOString(),
      recorded_at: time || new Date().toISOString(),
      heading_deg: position.heading_deg == null ? null : Number(position.heading_deg),
      source_gps_sequence: position.sequence == null ? null : Number(position.sequence)
    };
  }

  function distanceMeters(a, b) {
    if (!a || !b) return 0;
    const toRad = value => Number(value) * Math.PI / 180;
    const dLat = toRad(b.latitude - a.latitude), dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude), lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function pathDistance(points) {
    return (points || []).slice(1).reduce((sum, point, index) => sum + distanceMeters(points[index], point), 0);
  }

  function areaSquareMeters(points) {
    if (!Array.isArray(points) || points.length < 3) return null;
    const origin = points[0];
    const latScale = 111132;
    const lonScale = 111320 * Math.cos(Number(origin.latitude) * Math.PI / 180);
    const projected = points.map(point => ({ x: (Number(point.longitude) - Number(origin.longitude)) * lonScale, y: (Number(point.latitude) - Number(origin.latitude)) * latScale }));
    let twiceArea = 0;
    for (let i = 0; i < projected.length; i += 1) {
      const next = projected[(i + 1) % projected.length];
      twiceArea += projected[i].x * next.y - next.x * projected[i].y;
    }
    return Math.abs(twiceArea) / 2;
  }

  function startSection(inspection, options) {
    const model = ensureModel(inspection);
    const settings = options || {};
    const descriptions = Array.from(new Set((settings.descriptions || []).filter(item => DESCRIPTIONS.includes(item))));
    if (!descriptions.length) throw new Error("Choose at least one general description, or choose UNSURE.");
    if (!Object.prototype.hasOwnProperty.call(METHODS, settings.method)) throw new Error("Choose how you will map this section.");
    const number = Number(model.next_section_number) || 1;
    model.next_section_number = number + 1;
    const sectionId = `SECTION-${String(number).padStart(3, "0")}`;
    const now = settings.recorded_at || new Date().toISOString();
    const startPoint = pointFrom(settings.position, now);
    const section = {
      section_id: sectionId,
      information_class: "OBSERVED_ON_SITE",
      description_selections: descriptions,
      field_confirmation_status: "CONFIRMED_BY_INSPECTOR_AT_SECTION_START",
      source_planning_suggestion_id: settings.source_planning_suggestion_id || null,
      method: settings.method,
      method_label: METHODS[settings.method],
      started_at: now,
      finished_at: null,
      completion_status: "ACTIVE",
      start: startPoint,
      raw_walked_edge_points: startPoint ? [startPoint] : [],
      marked_corners: settings.method === "MARK_CORNERS" && startPoint ? [Object.assign({ corner_number: 1 }, startPoint)] : [],
      walked_edge: [], inferred_edge: null, outlined_section: null,
      distance_walked_m: 0, approximate_perimeter_m: null,
      approximate_square_feet: null, approximate_acres: null,
      calculation_label: "APPROXIMATE — PHONE GPS, NOT A SURVEY",
      photo_ids: [], voice_note_ids: [], corrections: [], events: [
        { event_type: "SECTION_STARTED", recorded_at: now, information_class: "OBSERVED_ON_SITE", method: settings.method, descriptions }
      ]
    };
    model.sections.push(section);
    model.active_section_id = sectionId;
    return section;
  }

  function sectionById(inspection, sectionId) {
    return ensureModel(inspection).sections.find(section => String(section.section_id) === String(sectionId)) || null;
  }

  function activeSection(inspection) {
    const model = ensureModel(inspection);
    return model.active_section_id ? sectionById(inspection, model.active_section_id) : null;
  }

  function appendWalkPoint(inspection, position, recordedAt) {
    const section = activeSection(inspection);
    if (!section || section.completion_status !== "ACTIVE" || section.capture_paused || section.method === "MARK_CORNERS" || section.method === "DRAW_LATER" || section.method === "PHOTO_VOICE_ONLY") return section;
    const point = pointFrom(position, recordedAt);
    if (!point) return section;
    const prior = section.raw_walked_edge_points[section.raw_walked_edge_points.length - 1];
    if (!prior || distanceMeters(prior, point) >= 1) section.raw_walked_edge_points.push(point);
    section.distance_walked_m = pathDistance(section.raw_walked_edge_points);
    return section;
  }

  function markCorner(inspection, position, recordedAt) {
    const section = activeSection(inspection);
    if (!section || section.method !== "MARK_CORNERS") throw new Error("No corner-marking section is active.");
    const point = pointFrom(position, recordedAt);
    point.corner_number = section.marked_corners.length + 1;
    section.marked_corners.push(point);
    section.events.push({ event_type: "CORNER_MARKED", recorded_at: point.recorded_at, corner_number: point.corner_number, gps_accuracy_m: point.gps_accuracy_m });
    return point;
  }

  function closureState(section) {
    const points = section.method === "MARK_CORNERS" ? section.marked_corners : section.raw_walked_edge_points;
    const first = points[0], last = points[points.length - 1];
    const gap = first && last ? distanceMeters(first, last) : null;
    const tolerance = Math.max(15, Number(first && first.gps_accuracy_m || 0) + Number(last && last.gps_accuracy_m || 0));
    return { point_count: points.length, gap_m: gap, tolerance_m: tolerance, reasonably_close: points.length >= 3 && gap <= tolerance };
  }

  function finishSection(inspection, sectionId, options) {
    const model = ensureModel(inspection);
    const section = sectionById(inspection, sectionId);
    if (!section) throw new Error("Section was not found.");
    const settings = options || {};
    const source = section.method === "MARK_CORNERS" ? section.marked_corners : section.raw_walked_edge_points;
    const points = source.map(point => Object.assign({}, point));
    const closure = closureState(section);
    const completion = settings.completion || (closure.reasonably_close ? "AUTO_CLOSE_NEAR_START" : null);
    if (!completion) return { needs_finish_choice: true, closure };
    if (completion === "CONTINUE_WALKING") return { needs_finish_choice: false, continued: true, section };
    section.walked_edge = points;
    section.inferred_edge = null;
    section.outlined_section = null;
    const canClose = points.length >= 3 && ["AUTO_CLOSE_NEAR_START", "CONNECT_BACK_TO_START", "COULD_NOT_WALK_MISSING_EDGE"].includes(completion);
    if (canClose) {
      const first = points[0], last = points[points.length - 1];
      const same = distanceMeters(first, last) < 0.25;
      const ring = same ? points : [...points, Object.assign({}, first)];
      section.outlined_section = { type: "Polygon", coordinates: [ring.map(point => [point.longitude, point.latitude])], information_class: "CALCULATED" };
      if (!closure.reasonably_close || completion !== "AUTO_CLOSE_NEAR_START") {
        section.inferred_edge = {
          label: "APPROXIMATE INFERRED EDGE — NOT PHYSICALLY WALKED",
          information_class: "CALCULATED",
          reason: completion,
          from: last,
          to: first,
          distance_m: distanceMeters(last, first)
        };
      }
      const areaM2 = areaSquareMeters(points);
      section.approximate_square_feet = areaM2 == null ? null : Math.round(areaM2 * 10.7639104167);
      section.approximate_acres = areaM2 == null ? null : Math.round((areaM2 / 4046.8564224) * 100) / 100;
      section.approximate_perimeter_m = Math.round((pathDistance(points) + (same ? 0 : distanceMeters(last, first))) * 10) / 10;
    }
    section.distance_walked_m = Math.round(pathDistance(points) * 10) / 10;
    section.finished_at = settings.recorded_at || new Date().toISOString();
    section.completion_status = completion === "SAVE_OPEN_PARTIAL_EDGE" || !canClose ? "SAVED_OPEN_PARTIAL_EDGE" : (section.inferred_edge ? "SAVED_WITH_INFERRED_EDGE" : "SAVED_CLOSED");
    section.events.push({ event_type: "SECTION_FINISHED", recorded_at: section.finished_at, completion, closure, completion_status: section.completion_status });
    model.active_section_id = null;
    return { needs_finish_choice: false, continued: false, section, closure };
  }

  function addCorrection(inspection, sectionId, descriptions, reason, recordedAt) {
    const section = sectionById(inspection, sectionId);
    if (!section) throw new Error("Section was not found.");
    const corrected = Array.from(new Set((descriptions || []).filter(item => DESCRIPTIONS.includes(item))));
    if (!corrected.length) throw new Error("Choose at least one corrected description.");
    const correction = {
      correction_id: `${sectionId}-CORRECTION-${String(section.corrections.length + 1).padStart(3, "0")}`,
      information_class: "INSPECTOR_INTERPRETATION",
      prior_description_selections: section.corrections.length ? section.corrections[section.corrections.length - 1].corrected_description_selections : section.description_selections.slice(),
      corrected_description_selections: corrected,
      reason: reason || "Inspector corrected the section description.",
      recorded_at: recordedAt || new Date().toISOString(),
      append_only: true
    };
    section.corrections.push(correction);
    return correction;
  }

  function effectiveDescriptions(section) {
    return section.corrections && section.corrections.length ? section.corrections[section.corrections.length - 1].corrected_description_selections.slice() : (section.description_selections || []).slice();
  }

  function analysisModel(inspection) {
    const model = ensureModel(inspection);
    const sections = model.sections.map(section => Object.assign({}, section, { effective_description_selections: effectiveDescriptions(section) }));
    const totals = {};
    DESCRIPTIONS.forEach(description => {
      const matching = sections.filter(section => section.approximate_acres != null && section.effective_description_selections.includes(description));
      if (matching.length) totals[description] = { approximate_acres: Math.round(matching.reduce((sum, section) => sum + section.approximate_acres, 0) * 100) / 100, section_ids: matching.map(section => section.section_id), label: "APPROXIMATE — PHONE GPS, NOT A SURVEY" };
    });
    return {
      schema_name: model.schema_name,
      schema_version: model.schema_version,
      sections,
      approximate_totals_by_description: totals,
      planning_suggestions: model.planning_suggestions,
      interpretation_rules: [
        "The walked edge is device-captured evidence.",
        "An inferred closing edge is calculated and was not physically walked.",
        "A section description is an on-site observation only after inspector confirmation.",
        "Approximate acreage is phone-GPS calculation, not a survey.",
        "Section acreage must not be converted into a clearing price without a separate documented estimating method."
      ]
    };
  }

  return { DESCRIPTIONS, METHODS, ensureModel, startSection, sectionById, activeSection, appendWalkPoint, markCorner, closureState, finishSection, addCorrection, effectiveDescriptions, analysisModel, distanceMeters, pathDistance, areaSquareMeters };
});
