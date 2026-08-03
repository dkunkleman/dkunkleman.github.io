(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WaterIntelligence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EARTH_RADIUS_M = 6371000;
  const SQM_PER_ACRE = 4046.8564224;
  const WATER_TYPES = ["standing", "flowing", "ditch", "creek_stream", "other", "unknown"];
  const WATER_BEHAVIORS = ["isolated_depression", "connected_pooling", "flowing", "apparent_creek_channel", "ditch", "unknown"];
  const DISCLAIMER = "Estimated from field photographs, route, observations, and terrain context. This is not a surveyed wetland boundary, drainage study, or year-round water determination.";
  const DRY_RULE_LIMITATION = "Within the actually walked and visually observed corridor, the absence of water evidence supports only ‘no standing water observed at inspection time.’ It does not establish year-round dryness, soils, wetlands, septic suitability, or groundwater conditions and does not apply to unwalked or visually obstructed acreage.";

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function pointCoordinates(item) {
    if (!item) return null;
    const location = item.location || item.gps || {};
    const lat = finite(item.lat != null ? item.lat : (location.latitude != null ? location.latitude : location.lat));
    const lon = finite(item.lon != null ? item.lon : (location.longitude != null ? location.longitude : location.lon));
    return lat == null || lon == null ? null : { lat, lon };
  }

  function haversine(a, b) {
    const left = pointCoordinates(a);
    const right = pointCoordinates(b);
    if (!left || !right) return Infinity;
    const toRadians = value => value * Math.PI / 180;
    const dLat = toRadians(right.lat - left.lat);
    const dLon = toRadians(right.lon - left.lon);
    const lat1 = toRadians(left.lat);
    const lat2 = toRadians(right.lat);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  function ringAreaAcres(ring) {
    if (!Array.isArray(ring) || ring.length < 4) return 0;
    let sum = 0;
    for (let index = 0; index < ring.length - 1; index += 1) {
      const lon1 = finite(ring[index][0]) * Math.PI / 180;
      const lat1 = finite(ring[index][1]) * Math.PI / 180;
      const lon2 = finite(ring[index + 1][0]) * Math.PI / 180;
      const lat2 = finite(ring[index + 1][1]) * Math.PI / 180;
      sum += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return Math.abs(sum * EARTH_RADIUS_M * EARTH_RADIUS_M / 2) / SQM_PER_ACRE;
  }

  function pointInRing(point, ring) {
    const target = pointCoordinates(point);
    if (!target || !Array.isArray(ring)) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = finite(ring[i][0]);
      const yi = finite(ring[i][1]);
      const xj = finite(ring[j][0]);
      const yj = finite(ring[j][1]);
      const crosses = ((yi > target.lat) !== (yj > target.lat)) &&
        (target.lon < ((xj - xi) * (target.lat - yi) / ((yj - yi) || Number.EPSILON)) + xi);
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function ringBounds(ring) {
    return (ring || []).reduce((bounds, point) => ({
      west: Math.min(bounds.west, finite(point[0])),
      south: Math.min(bounds.south, finite(point[1])),
      east: Math.max(bounds.east, finite(point[0])),
      north: Math.max(bounds.north, finite(point[1]))
    }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity });
  }

  function distanceToRingMeters(point, ring) {
    const target = pointCoordinates(point);
    if (!target || !Array.isArray(ring) || ring.length < 2) return Infinity;
    const cosLat = Math.cos(target.lat * Math.PI / 180);
    let minimum = Infinity;
    for (let index = 1; index < ring.length; index += 1) {
      const ax = (ring[index - 1][0] - target.lon) * 111320 * cosLat;
      const ay = (ring[index - 1][1] - target.lat) * 111320;
      const bx = (ring[index][0] - target.lon) * 111320 * cosLat;
      const by = (ring[index][1] - target.lat) * 111320;
      const dx = bx - ax, dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
      minimum = Math.min(minimum, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return minimum;
  }

  function identifyParcelSections(subjectFeature) {
    const rings = subjectFeature && subjectFeature.geometry && Array.isArray(subjectFeature.geometry.rings)
      ? subjectFeature.geometry.rings
      : [];
    const sections = rings.map((ring, index) => ({
      section_id: `parcel-section-${index + 1}`,
      ring_index: index,
      ring,
      calculated_acres: Math.round(ringAreaAcres(ring) * 100) / 100,
      bounds: ringBounds(ring)
    })).sort((a, b) => b.calculated_acres - a.calculated_acres);
    if (sections.length) sections[0].name = "Large Tract";
    if (sections.length > 1) sections[sections.length - 1].name = "Small Tract";
    sections.slice(1, -1).forEach((section, index) => { section.name = `Parcel Section ${index + 2}`; });
    return sections;
  }

  function normalizeChoice(value) {
    return String(value == null ? "" : value).trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, "_");
  }

  function depthRange(attributes) {
    const raw = normalizeChoice(attributes.water_depth_band || attributes.water_depth || "");
    const exact = finite(attributes.water_depth_exact_in != null ? attributes.water_depth_exact_in : attributes.water_depth_in);
    if (exact != null) return { minimum_in: exact, maximum_in: exact, label: `${exact} inches` };
    if (raw.includes("less_than_1")) return { minimum_in: 0, maximum_in: 1, label: "less than 1 inch" };
    if (raw.includes("1-3")) return { minimum_in: 1, maximum_in: 3, label: "1–3 inches" };
    if (raw.includes("3-7") || raw.includes("4-6")) return { minimum_in: raw.includes("4-6") ? 4 : 3, maximum_in: raw.includes("4-6") ? 6 : 7, label: raw.replaceAll("_", " ") };
    if (raw.includes("8-12") || raw.includes("7-12")) return { minimum_in: raw.includes("7-12") ? 7 : 8, maximum_in: 12, label: raw.replaceAll("_", " ") };
    if (raw.includes("more_than_12")) return { minimum_in: 12, maximum_in: null, label: "more than 12 inches" };
    return { minimum_in: null, maximum_in: null, label: "unknown" };
  }

  function normalizeWaterType(attributes, photo) {
    const explicit = normalizeChoice(attributes.water_type || attributes.water_condition || attributes.water_confirmation_type || "");
    if (explicit.includes("flow")) return "flowing";
    if (explicit.includes("creek") || explicit.includes("stream")) return "creek_stream";
    if (explicit.includes("ditch")) return "ditch";
    if (explicit.includes("stand") || explicit.includes("still") || explicit.includes("pool")) return "standing";
    if (WATER_TYPES.includes(explicit)) return explicit;
    const category = normalizeChoice(photo && (photo.category || photo.label));
    return category.includes("wet") || category.includes("water") ? "unknown" : null;
  }

  function waterSignificance(type, behavior, dimensions, depth) {
    const area = dimensions.width_ft != null && dimensions.length_ft != null ? dimensions.width_ft * dimensions.length_ft : null;
    if (type === "flowing" || type === "creek_stream" || behavior === "flowing" || behavior === "apparent_creek_channel") return "Flowing-water corridor";
    if (area != null && area <= 80 && depth.maximum_in != null && depth.maximum_in <= 7 && behavior !== "connected_pooling") return "Minor localized depression";
    if ((area != null && area >= 400) || (depth.minimum_in != null && depth.minimum_in >= 12)) return "Larger connected wet area";
    if (behavior === "connected_pooling" || (area != null && area > 80)) return "Moderate pooled area";
    return "Unknown significance";
  }

  function waterEvidenceFromPhoto(photo, observations) {
    const attributes = Object.assign({}, photo && photo.observation_attributes || {}, photo && photo.water || {});
    const linked = (observations || []).find(item => String(item.observation_id || item.id) === String(photo && photo.associated_observation_id));
    Object.assign(attributes, linked && linked.attributes || {});
    const confirmation = normalizeChoice(photo && photo.water_confirmation || attributes.water_confirmation || "");
    const observationType = normalizeChoice(linked && (linked.observation_type || linked.type));
    const category = normalizeChoice(photo && photo.category);
    const legacyWet = observationType.includes("wet") || category === "wet" || category.includes("water");
    if (confirmation === "no") return null;
    if (confirmation !== "yes" && !legacyWet) return null;
    const coordinates = pointCoordinates(photo);
    if (!coordinates) return null;
    const type = normalizeWaterType(attributes, photo) || "unknown";
    const behavior = WATER_BEHAVIORS.includes(normalizeChoice(attributes.water_behavior))
      ? normalizeChoice(attributes.water_behavior)
      : (type === "flowing" ? "flowing" : (type === "creek_stream" ? "apparent_creek_channel" : (type === "ditch" ? "ditch" : "unknown")));
    const dimensions = {
      width_ft: finite(attributes.water_width_ft != null ? attributes.water_width_ft : attributes.width_ft),
      length_ft: finite(attributes.water_length_ft != null ? attributes.water_length_ft : attributes.length_ft),
      basis: String(attributes.measurement_basis || attributes.water_depth_basis || "Unknown")
    };
    const depth = depthRange(attributes);
    return {
      evidence_id: `water-photo:${photo.photo_id || photo.id}`,
      photo_id: photo.photo_id || photo.id,
      photo_number: photo.photo_number || null,
      observation_id: photo.associated_observation_id || (linked && (linked.observation_id || linked.id)) || null,
      voice_note_ids: Array.isArray(photo.explanation_voice_note_ids) ? photo.explanation_voice_note_ids.slice() : (photo.explanation_voice_note_id ? [photo.explanation_voice_note_id] : []),
      recorded_at: photo.recorded_at || photo.time || null,
      latitude: coordinates.lat,
      longitude: coordinates.lon,
      heading_deg: finite(photo.compass_heading_deg),
      water_type: type,
      water_behavior: behavior,
      depth,
      dimensions,
      significance: waterSignificance(type, behavior, dimensions, depth),
      confirmation: confirmation === "yes" ? "user_confirmed" : "legacy_wet_evidence",
      analysis_photo_path: photo.analysis && photo.analysis.path || null,
      area_id: photo.area_id || null,
      note: photo.note || ""
    };
  }

  function convexHull(points) {
    if (points.length < 3) return points.slice();
    const sorted = points.slice().sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude);
    const cross = (o, a, b) => (a.longitude - o.longitude) * (b.latitude - o.latitude) - (a.latitude - o.latitude) * (b.longitude - o.longitude);
    const lower = [];
    sorted.forEach(point => { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop(); lower.push(point); });
    const upper = [];
    sorted.slice().reverse().forEach(point => { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop(); upper.push(point); });
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  function outlineForCluster(evidence) {
    const maximumEnteredDimensionFt = evidence.reduce((maximum, item) => Math.max(maximum, item.dimensions.width_ft || 0, item.dimensions.length_ft || 0), 0);
    if (evidence.length === 1 && !maximumEnteredDimensionFt) return null;
    const points = evidence.map(item => ({ latitude: item.latitude, longitude: item.longitude }));
    const center = points.reduce((sum, point) => ({ latitude: sum.latitude + point.latitude / points.length, longitude: sum.longitude + point.longitude / points.length }), { latitude: 0, longitude: 0 });
    const bufferM = Math.min(15, Math.max(maximumEnteredDimensionFt * 0.3048 / 2, evidence.length > 1 ? 2.5 : 1));
    if (points.length === 1) {
      const latDelta = bufferM / 111320;
      const lonDelta = bufferM / (111320 * Math.cos(center.latitude * Math.PI / 180));
      return Array.from({ length: 12 }, (_, index) => {
        const angle = index * Math.PI * 2 / 12;
        return [center.longitude + Math.cos(angle) * lonDelta, center.latitude + Math.sin(angle) * latDelta];
      }).concat([[center.longitude + lonDelta, center.latitude]]);
    }
    const hull = convexHull(points);
    return hull.map(point => {
      const dLat = point.latitude - center.latitude;
      const dLon = point.longitude - center.longitude;
      const lengthM = Math.max(0.5, Math.hypot(dLat * 111320, dLon * 111320 * Math.cos(center.latitude * Math.PI / 180)));
      const factor = (lengthM + bufferM) / lengthM;
      return [center.longitude + dLon * factor, center.latitude + dLat * factor];
    }).concat(hull.length ? [[hull[0].longitude, hull[0].latitude]] : []);
  }

  function compatibleForCluster(left, right) {
    const leftFlowing = left.significance === "Flowing-water corridor";
    const rightFlowing = right.significance === "Flowing-water corridor";
    if (leftFlowing !== rightFlowing) return false;
    const distance = haversine({ lat: left.latitude, lon: left.longitude }, { lat: right.latitude, lon: right.longitude });
    const enteredExtentM = Math.max(left.dimensions.length_ft || 0, left.dimensions.width_ft || 0, right.dimensions.length_ft || 0, right.dimensions.width_ft || 0) * 0.3048;
    const threshold = leftFlowing ? 35 : Math.min(25, Math.max(8, enteredExtentM * 0.75));
    if (distance > threshold) return false;
    const leftTime = Date.parse(left.recorded_at || "");
    const rightTime = Date.parse(right.recorded_at || "");
    return !Number.isFinite(leftTime) || !Number.isFinite(rightTime) || Math.abs(leftTime - rightTime) <= 45 * 60 * 1000;
  }

  function clusterWaterEvidence(evidence) {
    const parent = evidence.map((_, index) => index);
    const find = index => parent[index] === index ? index : (parent[index] = find(parent[index]));
    const unite = (left, right) => { const a = find(left); const b = find(right); if (a !== b) parent[b] = a; };
    for (let left = 0; left < evidence.length; left += 1) {
      for (let right = left + 1; right < evidence.length; right += 1) if (compatibleForCluster(evidence[left], evidence[right])) unite(left, right);
    }
    const groups = new Map();
    evidence.forEach((item, index) => { const root = find(index); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(item); });
    return Array.from(groups.values()).map((items, index) => {
      const flowing = items.some(item => item.significance === "Flowing-water corridor");
      const depths = items.flatMap(item => [item.depth.minimum_in, item.depth.maximum_in]).filter(value => value != null);
      const significanceRank = { "Minor localized depression": 1, "Unknown significance": 2, "Moderate pooled area": 3, "Larger connected wet area": 4, "Flowing-water corridor": 5 };
      const significance = items.slice().sort((a, b) => significanceRank[b.significance] - significanceRank[a.significance])[0].significance;
      const center = items.reduce((sum, item) => ({ latitude: sum.latitude + item.latitude / items.length, longitude: sum.longitude + item.longitude / items.length }), { latitude: 0, longitude: 0 });
      const outline = outlineForCluster(items);
      return {
        water_area_id: `WA-${index + 1}`,
        classification: flowing ? "Observed flowing-water corridor — permanence and legal classification unknown." : significance,
        significance,
        center,
        supporting_photo_ids: items.map(item => item.photo_id),
        supporting_photo_numbers: items.map(item => item.photo_number).filter(Boolean),
        supporting_observation_ids: items.map(item => item.observation_id).filter(Boolean),
        supporting_voice_note_ids: [...new Set(items.flatMap(item => item.voice_note_ids))],
        evidence_count: items.length,
        water_types: [...new Set(items.map(item => item.water_type))],
        minimum_depth_in: depths.length ? Math.min(...depths) : null,
        maximum_depth_in: depths.length ? Math.max(...depths) : null,
        estimated_outline: outline,
        outline_basis: outline ? DISCLAIMER : "No outline was inferred because a single observation lacked dimensions.",
        confidence: items.length >= 3 ? "moderate" : (items.length === 2 || outline ? "limited" : "point_observation_only")
      };
    });
  }

  function splitTrack(points, ring) {
    const segments = [];
    let current = [];
    (points || []).forEach((point, index) => {
      const inside = pointInRing(point, ring) || distanceToRingMeters(point, ring) <= 25;
      if (!inside) { if (current.length) segments.push(current); current = []; return; }
      const previous = current[current.length - 1];
      if (previous && (haversine(previous, point) > 90 || (Date.parse(point.time || "") - Date.parse(previous.time || "")) > 120000)) {
        if (current.length) segments.push(current);
        current = [];
      }
      current.push(Object.assign({ source_sequence: index + 1 }, point));
    });
    if (current.length) segments.push(current);
    return segments;
  }

  function buildSmallTractWaterMapModel(options) {
    const settings = options || {};
    const inspection = settings.inspection || {};
    const sections = identifyParcelSections(settings.subjectFeature);
    const small = sections.length > 1 ? sections[sections.length - 1] : null;
    if (!small) return { status: "NOT_AVAILABLE", reason: "The subject parcel does not contain a distinct small-tract ring." };
    const observations = inspection.observations || inspection.markers || [];
    const allWater = (inspection.photos || []).map(photo => waterEvidenceFromPhoto(photo, observations)).filter(Boolean);
    const waterEvidence = allWater.filter(item => pointInRing({ lat: item.latitude, lon: item.longitude }, small.ring));
    const excludedWaterEvidence = allWater.filter(item => !pointInRing({ lat: item.latitude, lon: item.longitude }, small.ring));
    const wetObservations = observations.filter(item => {
      const type = normalizeChoice(item.observation_type || item.type);
      return type.includes("wet") && pointInRing(item, small.ring);
    }).map(item => ({
      observation_id: item.observation_id || item.id,
      recorded_at: item.observed_at || item.time,
      location: pointCoordinates(item),
      attributes: item.attributes || {},
      photo_id: item.attachments && item.attachments.photo_id || item.photo_id || null
    }));
    const highDryObservations = observations.filter(item => {
      const type = normalizeChoice(item.observation_type || item.type);
      return (type.includes("dry") || type.includes("high") || type.includes("homesite")) && pointInRing(item, small.ring);
    }).map(item => ({ observation_id: item.observation_id || item.id, type: item.observation_type || item.type, recorded_at: item.observed_at || item.time, location: pointCoordinates(item) }));
    const clusters = clusterWaterEvidence(waterEvidence);
    const avoidanceAreas = clusters.filter(cluster => cluster.significance === "Flowing-water corridor" || cluster.significance === "Larger connected wet area" || cluster.significance === "Moderate pooled area").map(cluster => ({
      avoidance_id: `BA-${cluster.water_area_id.slice(3)}`,
      water_area_id: cluster.water_area_id,
      significance: cluster.significance,
      outline: cluster.estimated_outline,
      supporting_photo_numbers: cluster.supporting_photo_numbers,
      reason: cluster.significance === "Flowing-water corridor" ? "Observed flowing water is unsuitable as a building pad pending drainage and legal classification." : "Connected or materially sized pooled water may affect a preliminary building pad or access route.",
      confidence: cluster.confidence,
      cheapest_next_verification: cluster.significance === "Flowing-water corridor" ? "Revisit after a dry period and trace the channel inlet and outlet; then obtain a drainage or wetland screening if the location affects a proposed improvement." : "Measure the pooled perimeter and depth after a dry period and after meaningful rainfall."
    }));
    const standingWaterRule = Boolean(inspection.water_observation_rule && inspection.water_observation_rule.all_observed_standing_water_photographed);
    return {
      schema_name: "property-intelligence-small-tract-water-map",
      schema_version: "1.0",
      status: "GENERATED",
      title: "SMALL TRACT — OBSERVED WATER CONDITIONS",
      generated_at: settings.generatedAt || new Date().toISOString(),
      property_id: inspection.property_id || null,
      inspection_id: inspection.inspection_id || null,
      small_tract: {
        section_id: small.section_id,
        ring_index: small.ring_index,
        calculated_acres: small.calculated_acres,
        stated_acres: finite(settings.statedSmallTractAcres) || 5.49,
        boundary: small.ring,
        bounds: small.bounds,
        selection_rule: "Smallest separate exterior ring in the verified subject parcel geometry."
      },
      excluded_large_tract: {
        calculated_acres: sections[0].calculated_acres,
        excluded_water_photo_ids: excludedWaterEvidence.map(item => item.photo_id),
        rule: "Evidence outside the small-tract ring is excluded from this map, even when close in time."
      },
      route_segments: splitTrack(inspection.points || inspection.gps_track || [], small.ring),
      water_photographs: waterEvidence,
      wet_observations: wetObservations,
      high_dry_observations: highDryObservations,
      water_area_clusters: clusters,
      preliminary_building_avoidance_areas: avoidanceAreas,
      inspected_no_standing_water: {
        enabled: standingWaterRule,
        route_corridor_width_m: standingWaterRule ? 20 : null,
        statement: standingWaterRule ? "No standing water observed at inspection time within the actually walked and visually observed corridor except where water evidence is mapped." : "Not asserted because the inspector did not confirm that every observed standing-water location was photographed.",
        limitation: DRY_RULE_LIMITATION
      },
      uninspected_unknown: {
        statement: "Small-tract acreage beyond the walked and visually observed corridor remains not adequately inspected / unknown.",
        limitation: "No dry, buildability, wetland, soil, septic, or groundwater conclusion may be drawn from unvisited acreage."
      },
      map_layers: ["small_tract_boundary", "route", "all_water_photographs", "standing_water", "flowing_water", "minor_depressions", "larger_pooled_areas", "estimated_wet_area_outlines", "preliminary_building_avoidance_areas", "high_and_dry_observations", "candidate_homesites", "terrain", "two_foot_contours", "uninspected_unknown"],
      limitations: [DISCLAIMER, DRY_RULE_LIMITATION, "Observed water conditions apply to the inspection date and recent weather context; they are not a wetland delineation, drainage study, survey, or year-round determination."]
    };
  }

  return {
    WATER_TYPES,
    WATER_BEHAVIORS,
    DISCLAIMER,
    DRY_RULE_LIMITATION,
    finite,
    pointCoordinates,
    haversine,
    ringAreaAcres,
    pointInRing,
    distanceToRingMeters,
    identifyParcelSections,
    waterEvidenceFromPhoto,
    clusterWaterEvidence,
    buildSmallTractWaterMapModel
  };
});
