(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.InspectionCoaching = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_AREA_ID = "area-whole-property";
  const PHOTO_VALUES = ["Critical", "Helpful", "Reference", "Duplicate"];
  const QUESTION_STATUSES = ["open", "partially_answered", "answered"];
  const RELATIONSHIPS = ["supports", "contradicts", "context"];
  const EARTH_RADIUS_M = 6371000;
  const ACRES_PER_SQUARE_METER = 0.000247105381;

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeDefaultArea(createdAt) {
    return {
      area_id: DEFAULT_AREA_ID,
      name: "Whole Property",
      created_at: createdAt || new Date().toISOString(),
      description: "Default inspection area. Create a more specific area before collecting evidence when useful."
    };
  }

  function ensureInspectionModel(inspection, now) {
    const data = inspection || {};
    const createdAt = now || new Date().toISOString();
    data.investigation_questions = Array.isArray(data.investigation_questions) ? data.investigation_questions : [];
    data.inspection_areas = Array.isArray(data.inspection_areas) ? data.inspection_areas : [];
    if (!data.inspection_areas.length) data.inspection_areas.push(makeDefaultArea(createdAt));
    data.inspection_areas = data.inspection_areas.map((area, index) => ({
      area_id: String(area.area_id || area.id || `area-${index + 1}`),
      name: String(area.name || `Area ${index + 1}`),
      created_at: area.created_at || createdAt,
      description: String(area.description || "")
    }));
    const areaIds = new Set(data.inspection_areas.map(area => area.area_id));
    if (!areaIds.has(data.active_area_id)) data.active_area_id = data.inspection_areas[0].area_id;
    data.active_question_ids = Array.isArray(data.active_question_ids)
      ? data.active_question_ids.filter(id => data.investigation_questions.some(question => String(question.question_id || question.id) === String(id)))
      : [];
    data.next_evidence_relationship = RELATIONSHIPS.includes(data.next_evidence_relationship) ? data.next_evidence_relationship : "supports";
    data.next_photo_value = PHOTO_VALUES.includes(data.next_photo_value) ? data.next_photo_value : "Helpful";
    data.investigation_questions = data.investigation_questions.map((question, index) => ({
      question_id: String(question.question_id || question.id || `question-${index + 1}`),
      text: String(question.text || question.question || "").trim(),
      created_at: question.created_at || createdAt,
      status: QUESTION_STATUSES.includes(question.status) ? question.status : "open",
      answer_summary: String(question.answer_summary || ""),
      confidence: finite(question.confidence),
      decision_categories: Array.isArray(question.decision_categories) ? question.decision_categories.slice() : []
    })).filter(question => question.text);
    return data;
  }

  function evidenceContext(inspection) {
    const data = ensureInspectionModel(inspection);
    return {
      area_id: data.active_area_id,
      question_ids: data.active_question_ids.slice(),
      question_links: data.active_question_ids.map(questionId => ({
        question_id: questionId,
        relationship: data.next_evidence_relationship
      }))
    };
  }

  function haversine(a, b) {
    const lat1 = finite(a && (a.lat != null ? a.lat : a.latitude));
    const lon1 = finite(a && (a.lon != null ? a.lon : a.longitude));
    const lat2 = finite(b && (b.lat != null ? b.lat : b.latitude));
    const lon2 = finite(b && (b.lon != null ? b.lon : b.longitude));
    if ([lat1, lon1, lat2, lon2].some(value => value == null)) return Infinity;
    const radians = Math.PI / 180;
    const dLat = (lat2 - lat1) * radians;
    const dLon = (lon2 - lon1) * radians;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }

  function pointInRing(point, ring) {
    let inside = false;
    const x = point[0];
    const y = point[1];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = Number(ring[i][0]);
      const yi = Number(ring[i][1]);
      const xj = Number(ring[j][0]);
      const yj = Number(ring[j][1]);
      const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function pointInRings(point, rings) {
    let inside = false;
    (rings || []).forEach(ring => {
      if (Array.isArray(ring) && ring.length >= 3 && pointInRing(point, ring)) inside = !inside;
    });
    return inside;
  }

  function validTrackPoints(points) {
    return (Array.isArray(points) ? points : []).filter(point => {
      const lat = finite(point.lat != null ? point.lat : point.latitude);
      const lon = finite(point.lon != null ? point.lon : point.longitude);
      const accuracy = finite(point.accuracy_m != null ? point.accuracy_m : point.gps_accuracy_m);
      return lat != null && lon != null && (accuracy == null || accuracy <= 65);
    });
  }

  function calculateCoverage(options) {
    const settings = options || {};
    const rings = (settings.rings || []).filter(ring => Array.isArray(ring) && ring.length >= 3);
    const points = validTrackPoints(settings.points);
    const empty = {
      status: "NOT_AVAILABLE",
      method: "Route-proximity estimate; it does not prove line of sight or conditions outside the walked route.",
      thresholds_m: { well_inspected: 20, lightly_inspected: 60 },
      cell_count: 0,
      well_inspected: { cells: 0, percent: 0, estimated_acres: 0 },
      lightly_inspected: { cells: 0, percent: 0, estimated_acres: 0 },
      not_inspected: { cells: 0, percent: 100, estimated_acres: finite(settings.recordedAcres) },
      cells: [],
      unvisited_zone_centers: []
    };
    if (!rings.length || !points.length) return empty;
    const coordinates = rings.flat();
    const lons = coordinates.map(point => Number(point[0])).filter(Number.isFinite);
    const lats = coordinates.map(point => Number(point[1])).filter(Number.isFinite);
    if (!lons.length || !lats.length) return empty;
    const west = Math.min(...lons);
    const east = Math.max(...lons);
    const south = Math.min(...lats);
    const north = Math.max(...lats);
    const centerLat = (south + north) / 2;
    const metersPerLon = 111320 * Math.cos(centerLat * Math.PI / 180);
    const metersPerLat = 110540;
    const desiredCellM = Math.max(15, finite(settings.cellSizeM) || 30);
    const columns = Math.max(1, Math.min(50, Math.ceil((east - west) * metersPerLon / desiredCellM)));
    const rows = Math.max(1, Math.min(50, Math.ceil((north - south) * metersPerLat / desiredCellM)));
    const lonStep = (east - west) / columns;
    const latStep = (north - south) / rows;
    const wellThreshold = Math.max(5, finite(settings.wellThresholdM) || 20);
    const lightThreshold = Math.max(wellThreshold, finite(settings.lightThresholdM) || 60);
    const stride = Math.max(1, Math.ceil(points.length / 1600));
    const route = points.filter((point, index) => index % stride === 0 || index === points.length - 1);
    const routeMeters = route.map(point => ({
      x: (Number(point.lon != null ? point.lon : point.longitude) - west) * metersPerLon,
      y: (Number(point.lat != null ? point.lat : point.latitude) - south) * metersPerLat
    }));
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const lon = west + (column + 0.5) * lonStep;
        const lat = south + (row + 0.5) * latStep;
        if (!pointInRings([lon, lat], rings)) continue;
        const cellX = (lon - west) * metersPerLon;
        const cellY = (lat - south) * metersPerLat;
        let minimumSquared = Infinity;
        routeMeters.forEach(point => {
          const dx = cellX - point.x;
          const dy = cellY - point.y;
          minimumSquared = Math.min(minimumSquared, dx * dx + dy * dy);
        });
        const minimum = Math.sqrt(minimumSquared);
        const classification = minimum <= wellThreshold ? "well_inspected" : (minimum <= lightThreshold ? "lightly_inspected" : "not_inspected");
        cells.push({ row, column, west: west + column * lonStep, east: west + (column + 1) * lonStep, south: south + row * latStep, north: south + (row + 1) * latStep, center: { latitude: lat, longitude: lon }, nearest_route_m: Math.round(minimum * 10) / 10, classification });
      }
    }
    if (!cells.length) return empty;
    const counts = { well_inspected: 0, lightly_inspected: 0, not_inspected: 0 };
    cells.forEach(cell => { counts[cell.classification] += 1; });
    const recordedAcres = finite(settings.recordedAcres);
    const cellArea = ((lonStep * metersPerLon) * (latStep * metersPerLat)) * ACRES_PER_SQUARE_METER;
    const acresPerCell = recordedAcres != null ? recordedAcres / cells.length : cellArea;
    const result = {
      status: "ESTIMATED",
      method: "Subject parcel divided into approximately 30-meter cells. Well inspected means the cell center is within 20 meters of an accepted GPS point; lightly inspected means 20–60 meters; not inspected means more than 60 meters. This route-proximity model does not prove visibility or ground conditions.",
      thresholds_m: { well_inspected: wellThreshold, lightly_inspected: lightThreshold },
      cell_count: cells.length,
      well_inspected: {}, lightly_inspected: {}, not_inspected: {},
      cells,
      unvisited_zone_centers: []
    };
    Object.keys(counts).forEach(key => {
      result[key] = {
        cells: counts[key],
        percent: Math.round((counts[key] / cells.length) * 1000) / 10,
        estimated_acres: Math.round(counts[key] * acresPerCell * 100) / 100
      };
    });
    const candidates = cells.filter(cell => cell.classification === "not_inspected").sort((a, b) => b.nearest_route_m - a.nearest_route_m);
    candidates.forEach(cell => {
      if (result.unvisited_zone_centers.length >= 12) return;
      if (result.unvisited_zone_centers.every(existing => haversine(existing, cell.center) >= 90)) {
        result.unvisited_zone_centers.push({ latitude: cell.center.latitude, longitude: cell.center.longitude, distance_from_route_m: cell.nearest_route_m });
      }
    });
    return result;
  }

  function evidenceForQuestion(inspection, questionId) {
    const markers = (inspection.markers || []).filter(item => (item.question_ids || []).includes(questionId) || (item.question_links || []).some(link => link.question_id === questionId));
    const photos = (inspection.photos || []).filter(item => (item.question_ids || []).includes(questionId) || (item.question_links || []).some(link => link.question_id === questionId));
    const voiceNotes = (inspection.voice_notes || []).filter(item => (item.question_ids || []).includes(questionId) || (item.question_links || []).some(link => link.question_id === questionId));
    const support = [];
    const contradict = [];
    const context = [];
    [...markers, ...photos, ...voiceNotes].forEach(item => {
      const links = (item.question_links || []).filter(link => link.question_id === questionId);
      const relationship = links[0] ? links[0].relationship : "supports";
      const id = item.id || item.photo_id || item.voice_note_id;
      if (relationship === "contradicts") contradict.push(id);
      else if (relationship === "context") context.push(id);
      else support.push(id);
    });
    return { markers, photos, voice_notes: voiceNotes, supporting_evidence_ids: support, contradicting_evidence_ids: contradict, context_evidence_ids: context };
  }

  function hasMeasurement(items) {
    return items.some(item => {
      if (String(item.evidence_classification || "").toLowerCase() === "measured") return true;
      const attributes = item.attributes || item.observation_attributes || {};
      return Object.entries(attributes).some(([key, value]) => /depth|width|height|diameter|dbh|slope|distance|extent|count|measurement/i.test(key) && value !== "" && value != null && String(value).toLowerCase() !== "unknown");
    });
  }

  function questionNeedsMeasurement(text) {
    return /berm|water|drain|leave|flow|road|equipment|reach|high ground|homesite|build|culvert|creek|slope|tree|timber|diameter|depth|width|distance/i.test(text || "");
  }

  function createQuestionBrief(inspection) {
    const data = ensureInspectionModel(clone(inspection || {}));
    return {
      schema_name: "property-intelligence-investigation-questions",
      schema_version: "1.0",
      inspection_id: data.inspection_id || null,
      instructions: "Answer every question from its linked evidence. Never treat absence of evidence in an unvisited area as evidence of absence. Every answer must cite supporting and contradicting evidence, remaining uncertainty, and the cheapest next investigation.",
      questions: data.investigation_questions.map(question => {
        const evidence = evidenceForQuestion(data, question.question_id);
        return {
          question_id: question.question_id,
          question: question.text,
          inspector_status: question.status,
          inspector_answer_summary: question.answer_summary || "",
          inspector_confidence_0_to_100: question.confidence,
          answer_status: question.answer_summary ? "REVIEW_INSPECTOR_ANSWER_AGAINST_EVIDENCE" : "GENERATE_FROM_LINKED_EVIDENCE",
          supporting_evidence_ids: evidence.supporting_evidence_ids,
          contradicting_evidence_ids: evidence.contradicting_evidence_ids,
          context_evidence_ids: evidence.context_evidence_ids,
          observation_ids: evidence.markers.map(item => item.id),
          photo_ids: evidence.photos.map(item => item.id),
          voice_note_ids: evidence.voice_notes.map(item => item.id),
          area_ids: [...new Set([...evidence.markers, ...evidence.photos, ...evidence.voice_notes].map(item => item.area_id).filter(Boolean))],
          remaining_uncertainty: "IDENTIFY_FROM_COVERAGE, CONTRADICTIONS, AND MISSING EVIDENCE",
          cheapest_next_investigation: "RECOMMEND_THE_LOWEST_COST_RELIABLE_ACTION",
          conclusion_contract: ["answer", "supporting_observations", "supporting_photographs", "contradicting_evidence", "remaining_uncertainty", "confidence_0_to_100_with_explanation", "cheapest_next_investigation"]
        };
      })
    };
  }

  function reviewMissingEvidence(inspection, coverage) {
    const data = ensureInspectionModel(clone(inspection || {}));
    const gaps = [];
    data.investigation_questions.forEach(question => {
      const evidence = evidenceForQuestion(data, question.question_id);
      const all = [...evidence.markers, ...evidence.photos, ...evidence.voice_notes];
      const missing = [];
      if (!all.length) missing.push("No linked evidence");
      if (!evidence.photos.length) missing.push("No linked photograph");
      if (questionNeedsMeasurement(question.text) && !hasMeasurement(all)) missing.push("No linked measurement");
      if (!evidence.contradicting_evidence_ids.length) missing.push("No contradicting evidence recorded");
      if (question.status !== "answered" || !question.answer_summary) missing.push("Question not answered by inspector");
      if (missing.length) gaps.push({ question_id: question.question_id, question: question.text, missing, linked_evidence_count: all.length, cheapest_action: !all.length ? "Visit the relevant area and record one context observation plus one photograph." : (!evidence.photos.length ? "Take one representative photograph linked to this question." : (questionNeedsMeasurement(question.text) && !hasMeasurement(all) ? "Collect the simplest field measurement that could change the answer." : "Record a short answer and the remaining uncertainty.")) });
    });
    const areas = data.inspection_areas.map(area => {
      const evidenceCount = [...(data.markers || []), ...(data.photos || []), ...(data.voice_notes || [])].filter(item => item.area_id === area.area_id).length;
      return { area_id: area.area_id, name: area.name, evidence_count: evidenceCount, missing: evidenceCount === 0 };
    });
    const unvisitedPercent = coverage && coverage.status === "ESTIMATED" ? coverage.not_inspected.percent : null;
    const priorities = gaps.slice().sort((a, b) => a.linked_evidence_count - b.linked_evidence_count).slice(0, 5).map(gap => ({ action: gap.cheapest_action, question_id: gap.question_id, question: gap.question, uncertainty_removed: gap.missing.join("; ") }));
    if (unvisitedPercent != null && unvisitedPercent > 0) priorities.unshift({ action: "Walk the highest-value unvisited zone shown on the map before leaving.", question_id: null, question: "Parcel coverage", uncertainty_removed: `${unvisitedPercent}% of parcel cells are estimated not inspected.` });
    return {
      generated_at: new Date().toISOString(),
      important_questions_remaining: gaps,
      photographs_still_missing: gaps.filter(gap => gap.missing.includes("No linked photograph")).map(gap => gap.question_id),
      measurements_still_missing: gaps.filter(gap => gap.missing.includes("No linked measurement")).map(gap => gap.question_id),
      areas_without_evidence: areas.filter(area => area.missing),
      highest_value_next_actions: priorities.slice(0, 5),
      ready_to_leave: gaps.length === 0 && !(unvisitedPercent != null && unvisitedPercent > 25)
    };
  }

  function calculateFieldEfficiency(inspection, acres) {
    const data = ensureInspectionModel(clone(inspection || {}));
    const points = validTrackPoints(data.points).slice().sort((a, b) => new Date(a.time || a.recorded_at) - new Date(b.time || b.recorded_at));
    let walkingMs = 0;
    let distanceM = 0;
    for (let index = 1; index < points.length; index += 1) {
      const duration = new Date(points[index].time || points[index].recorded_at) - new Date(points[index - 1].time || points[index - 1].recorded_at);
      const distance = haversine(points[index - 1], points[index]);
      if (!(duration > 0 && duration <= 120000 && distance <= 250)) continue;
      distanceM += distance;
      const speed = distance / (duration / 1000);
      if (speed >= 0.45) walkingMs += duration;
    }
    const start = data.started ? new Date(data.started).valueOf() : (points[0] ? new Date(points[0].time).valueOf() : NaN);
    const end = data.stopped ? new Date(data.stopped).valueOf() : (points.length ? new Date(points[points.length - 1].time).valueOf() : NaN);
    const totalMs = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
    const evidence = [...(data.markers || []), ...(data.photos || []), ...(data.voice_notes || [])];
    const evidenceTimes = [...new Set(evidence.map(item => new Date(item.time || item.recorded_at || item.started_at).valueOf()).filter(Number.isFinite))].sort((a, b) => a - b);
    const intervals = evidenceTimes.map(time => [time - 15000, time + 45000]);
    let documentingMs = 0;
    let current = null;
    intervals.forEach(interval => {
      if (!current) current = interval.slice();
      else if (interval[0] <= current[1]) current[1] = Math.max(current[1], interval[1]);
      else { documentingMs += current[1] - current[0]; current = interval.slice(); }
    });
    if (current) documentingMs += current[1] - current[0];
    documentingMs = Math.min(totalMs, documentingMs);
    const stoppedMs = Math.max(0, totalMs - walkingMs - documentingMs);
    const observationPoints = (data.markers || []).filter(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));
    const spacings = [];
    for (let index = 1; index < observationPoints.length; index += 1) {
      const distance = haversine(observationPoints[index - 1], observationPoints[index]);
      if (Number.isFinite(distance) && distance < 1000) spacings.push(distance);
    }
    const parcelAcres = finite(acres);
    const answered = data.investigation_questions.filter(question => question.status === "answered").length;
    return {
      methodology: "Walking/stopped/documenting times are estimates from GPS movement and one-minute evidence-capture windows; they may overlap real activity and are not billing records.",
      total_time_ms: totalMs,
      time_walking_ms: walkingMs,
      time_documenting_ms: documentingMs,
      time_stopped_ms: stoppedMs,
      corrected_route_distance_m: Math.round(distanceM * 10) / 10,
      average_spacing_between_observations_m: spacings.length ? Math.round((spacings.reduce((sum, value) => sum + value, 0) / spacings.length) * 10) / 10 : null,
      photographs_per_acre: parcelAcres ? Math.round(((data.photos || []).length / parcelAcres) * 100) / 100 : null,
      observations_per_acre: parcelAcres ? Math.round(((data.markers || []).length / parcelAcres) * 100) / 100 : null,
      questions_answered: answered,
      questions_remaining: data.investigation_questions.length - answered
    };
  }

  function createReturnVisitPlan(inspection, coverage, review) {
    const data = ensureInspectionModel(clone(inspection || {}));
    const questions = (review && review.important_questions_remaining) || [];
    return {
      schema_name: "property-intelligence-return-visit-plan",
      schema_version: "1.0",
      generated_at: new Date().toISOString(),
      objective: "Remove the most decision-important uncertainty with the least unnecessary walking and documentation.",
      unvisited_areas: coverage && coverage.status === "ESTIMATED" ? {
        estimated_percent: coverage.not_inspected.percent,
        estimated_acres: coverage.not_inspected.estimated_acres,
        zone_centers: coverage.unvisited_zone_centers,
        limitation: coverage.method
      } : { status: "NOT_AVAILABLE", limitation: "A subject boundary and accepted GPS track are required." },
      highest_value_unanswered_questions: questions.slice(0, 5),
      suggested_walking_route: coverage && coverage.unvisited_zone_centers && coverage.unvisited_zone_centers.length ? {
        instruction: "Visit these approximate centers in the displayed order, adjusting for safety, legal access, terrain, and visible barriers. This is a coverage aid, not turn-by-turn navigation.",
        waypoints: coverage.unvisited_zone_centers.slice(0, 8)
      } : { instruction: "No route generated because coverage geometry is unavailable or no unvisited cell center was identified.", waypoints: [] },
      suggested_measurements: (review && review.measurements_still_missing || []).map(questionId => ({ question_id: questionId, instruction: "Collect the simplest repeatable measurement that could change the answer." })),
      suggested_photographs: (review && review.photographs_still_missing || []).map(questionId => ({ question_id: questionId, instruction: "Take one context view and one decision-relevant detail view, both linked to the question and active area." })),
      inspection_areas: data.inspection_areas
    };
  }

  return {
    DEFAULT_AREA_ID,
    PHOTO_VALUES,
    QUESTION_STATUSES,
    RELATIONSHIPS,
    ensureInspectionModel,
    evidenceContext,
    haversine,
    pointInRings,
    calculateCoverage,
    evidenceForQuestion,
    createQuestionBrief,
    reviewMissingEvidence,
    calculateFieldEfficiency,
    createReturnVisitPlan
  };
});
