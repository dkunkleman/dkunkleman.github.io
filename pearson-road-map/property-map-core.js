(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PropertyMapCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const METERS_PER_DEGREE_LAT = 111320;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  function createModel(propertyId) {
    return {
      schema_name: "property-intelligence-map",
      schema_version: "1.2",
      property_id: propertyId,
      source_evidence: { immutable: true, feature_collections: [] },
      interpretation: { features: [], current_version: 0 },
      proposals: { features: [], current_version: 0 },
      proposal_versions: [],
      accepted_proposals: [],
      work_orders: [],
      production_tests: [],
      market_benchmarks: [],
      pricing_crew_models: [],
      service_timeline: {
        lead_received_at: null,
        first_response_at: null,
        site_visit_at: null,
        proposal_delivered_at: null,
        work_started_at: null,
        work_completed_at: null
      },
      customer_engagement: { questions: [], change_requests: [], zone_interest: [] },
      recurring_opportunities: [],
      presentation: {
        profile: "INTERNAL_EDITABLE",
        visible_layers: ["parcel", "walks", "photos", "findings", "interpretation", "proposal"],
        photo_metadata: [],
        customer_favorites: []
      },
      property_assets: [],
      context_records: [],
      edit_history: []
    };
  }

  function recordEdit(model, action, layer, before, after, details) {
    if (layer !== "interpretation" && layer !== "proposals" && layer !== "presentation" && layer !== "property_assets") {
      throw new Error("Source evidence cannot be edited.");
    }
    const target = layer === "property_assets" ? model : model[layer];
    const previousVersion = Number(target.current_version || model.interpretation.current_version || 0);
    const version = previousVersion + 1;
    if (layer !== "property_assets") target.current_version = version;
    else model.asset_version = version;
    const event = {
      edit_id: uid("map-edit"), version, action, layer,
      recorded_at: nowIso(), before: clone(before), after: clone(after),
      details: details || {}, source_evidence_modified: false
    };
    model.edit_history.push(event);
    return event;
  }

  function addFeature(model, layer, feature, action) {
    if (layer !== "interpretation" && layer !== "proposals") throw new Error("Only editable layers accept features.");
    const before = clone(model[layer].features);
    model[layer].features.push(clone(feature));
    recordEdit(model, action || "DRAW_AREA", layer, before, model[layer].features, { feature_id: feature.id });
    return feature;
  }

  function replaceFeature(model, layer, featureId, patch, action) {
    if (layer !== "interpretation" && layer !== "proposals") throw new Error("Only editable layers may change.");
    const before = clone(model[layer].features);
    const feature = model[layer].features.find((item) => item.id === featureId);
    if (!feature) throw new Error(`Feature not found: ${featureId}`);
    Object.assign(feature.properties || (feature.properties = {}), clone(patch));
    recordEdit(model, action || "ADD_CORRECTION", layer, before, model[layer].features, { feature_id: featureId });
    return feature;
  }

  function replaceFeatureGeometry(model, layer, featureId, geometry, propertiesPatch, action) {
    if (layer !== "interpretation" && layer !== "proposals") throw new Error("Only editable layers may change.");
    const before = clone(model[layer].features);
    const feature = model[layer].features.find((item) => item.id === featureId);
    if (!feature) throw new Error(`Feature not found: ${featureId}`);
    feature.geometry = clone(geometry);
    Object.assign(feature.properties || (feature.properties = {}), clone(propertiesPatch || {}));
    recordEdit(model, action || "RESHAPE", layer, before, model[layer].features, { feature_id: featureId });
    return feature;
  }

  function undo(model) {
    const prior = [...model.edit_history].reverse().find((event) => event.action !== "UNDO" && !event.undone_by);
    if (!prior) return null;
    const current = clone(model[prior.layer].features || []);
    model[prior.layer].features = clone(prior.before);
    const event = recordEdit(model, "UNDO", prior.layer, current, model[prior.layer].features, { undoes_edit_id: prior.edit_id });
    prior.undone_by = event.edit_id;
    return event;
  }

  function setFeatured(model, photoId, featured, reason, by) {
    const before = clone(model.presentation.photo_metadata);
    let metadata = model.presentation.photo_metadata.find((item) => item.photo_id === photoId);
    if (!metadata) {
      metadata = { photo_id: photoId };
      model.presentation.photo_metadata.push(metadata);
    }
    metadata.featured = Boolean(featured);
    metadata.featured_reason = reason || "Selected for property story";
    metadata.featured_by = by || "David";
    metadata.featured_at = featured ? nowIso() : null;
    const active = model.presentation.photo_metadata.filter((item) => item.featured);
    if (featured && !Number.isFinite(metadata.featured_rank)) metadata.featured_rank = active.length;
    recordEdit(model, featured ? "FEATURE_PHOTO" : "REMOVE_FEATURE", "presentation", before, model.presentation.photo_metadata, { photo_id: photoId });
    return metadata;
  }

  function reorderFeatured(model, orderedPhotoIds) {
    const before = clone(model.presentation.photo_metadata);
    orderedPhotoIds.forEach((photoId, index) => {
      const metadata = model.presentation.photo_metadata.find((item) => item.photo_id === photoId);
      if (metadata && metadata.featured) metadata.featured_rank = index + 1;
    });
    recordEdit(model, "REORDER_FEATURED", "presentation", before, model.presentation.photo_metadata, { ordered_photo_ids: orderedPhotoIds });
  }

  function toggleFavorite(model, photoId, proposalId, viewerSessionId) {
    const before = clone(model.presentation.customer_favorites);
    const match = model.presentation.customer_favorites.find((item) => item.photo_id === photoId && item.viewer_or_session_id === viewerSessionId);
    if (match) model.presentation.customer_favorites = model.presentation.customer_favorites.filter((item) => item !== match);
    else model.presentation.customer_favorites.push({ favorite_id: uid("favorite"), photo_id: photoId, proposal_id: proposalId || null, viewer_or_session_id: viewerSessionId, created_at: nowIso() });
    recordEdit(model, match ? "REMOVE_FAVORITE" : "FAVORITE_PHOTO", "presentation", before, model.presentation.customer_favorites, { photo_id: photoId, viewer_or_session_id: viewerSessionId });
    return !match;
  }

  function haversineMeters(a, b) {
    if (!a || !b) return Infinity;
    const rad = Math.PI / 180;
    const dLat = (b[1] - a[1]) * rad;
    const dLon = (b[0] - a[0]) * rad;
    const lat1 = a[1] * rad, lat2 = b[1] * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function rankPhotos(photos, cursor, metadata, favorites, limit) {
    const meta = new Map((metadata || []).map((item) => [item.photo_id, item]));
    const favoriteIds = new Set((favorites || []).map((item) => item.photo_id));
    return photos.map((photo) => {
      const id = photo.properties.photo_id;
      const distance_m = haversineMeters(cursor, photo.geometry.coordinates);
      const presentation = meta.get(id) || {};
      const featured = Boolean(presentation.featured);
      const rank = Number(presentation.featured_rank || 999);
      const score = distance_m - (featured ? 55 : 0) + Math.min(rank, 20);
      return { photo, distance_m, featured, favorite: favoriteIds.has(id), score };
    }).sort((a, b) => a.score - b.score).slice(0, limit || 5);
  }

  function polygonAreaAcres(coordinates) {
    const ring = coordinates && coordinates[0];
    if (!ring || ring.length < 4) return null;
    const avgLat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const xScale = METERS_PER_DEGREE_LAT * Math.cos(avgLat * Math.PI / 180);
    let twiceArea = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const a = ring[i], b = ring[i + 1];
      twiceArea += (a[0] * xScale) * (b[1] * METERS_PER_DEGREE_LAT) - (b[0] * xScale) * (a[1] * METERS_PER_DEGREE_LAT);
    }
    return Math.abs(twiceArea / 2) / 4046.8564224;
  }

  function polygonMetrics(coordinates) {
    const ring = coordinates && coordinates[0];
    if (!ring || ring.length < 4) return null;
    const avgLat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const xScale = METERS_PER_DEGREE_LAT * Math.cos(avgLat * Math.PI / 180);
    const local = ring.map((point) => [point[0] * xScale, point[1] * METERS_PER_DEGREE_LAT]);
    let perimeterMeters = 0;
    for (let index = 0; index < local.length - 1; index += 1) perimeterMeters += Math.hypot(local[index + 1][0] - local[index][0], local[index + 1][1] - local[index][1]);
    const xs = local.map((point) => point[0]);
    const ys = local.map((point) => point[1]);
    const spansFeet = [(Math.max(...xs) - Math.min(...xs)) * 3.28084, (Math.max(...ys) - Math.min(...ys)) * 3.28084].sort((a, b) => b - a);
    return {
      acreage: Number(polygonAreaAcres(coordinates).toFixed(2)),
      perimeter_ft: Math.round(perimeterMeters * 3.28084),
      approx_length_ft: Math.round(spansFeet[0]),
      approx_width_ft: Math.round(spansFeet[1]),
      basis: "APPROXIMATE FROM DRAFT MAP GEOMETRY - NOT A SURVEY"
    };
  }

  function rectangleBoundsFromCorners(first, second) {
    if (!first || !second || first.length < 2 || second.length < 2) return null;
    const west = Math.min(Number(first[0]), Number(second[0]));
    const east = Math.max(Number(first[0]), Number(second[0]));
    const south = Math.min(Number(first[1]), Number(second[1]));
    const north = Math.max(Number(first[1]), Number(second[1]));
    if (![west, east, south, north].every(Number.isFinite) || west === east || south === north) return null;
    return { west, east, south, north };
  }

  function rectangleRing(bounds) {
    if (!bounds) return null;
    return [[
      [bounds.west, bounds.south],
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.east, bounds.south],
      [bounds.west, bounds.south]
    ]];
  }

  function rectangleBoundsFromGeometry(geometry) {
    const ring = geometry && geometry.type === "Polygon" && geometry.coordinates && geometry.coordinates[0];
    if (!ring || ring.length < 4) return null;
    const xs = ring.map((point) => Number(point[0]));
    const ys = ring.map((point) => Number(point[1]));
    if (![...xs, ...ys].every(Number.isFinite)) return null;
    const bounds = { west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys) };
    const expected = rectangleRing(bounds)[0];
    const unique = new Set(ring.slice(0, -1).map((point) => `${point[0]}:${point[1]}`));
    const expectedSet = new Set(expected.slice(0, -1).map((point) => `${point[0]}:${point[1]}`));
    if (unique.size !== 4 || [...unique].some((point) => !expectedSet.has(point))) return null;
    return bounds;
  }

  function money(value) {
    if (value === null || value === undefined || value === "" || value === "UNKNOWN") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
  }

  function estimateZone(zone, productionTest) {
    const props = zone.properties || {};
    const test = productionTest || {};
    const componentNames = ["labor_cost", "fuel", "consumables", "transportation", "debris_handling", "other_direct_cost"];
    const known = {};
    const unknown = [];
    componentNames.forEach((name) => {
      const value = money(test[name]);
      if (value === null) unknown.push(name);
      else known[name] = value;
    });
    const knownDirectCost = Object.values(known).reduce((sum, value) => sum + value, 0);
    const proposedSellPrice = money(props.price);
    return {
      proposal_zone_id: props.proposal_zone_id || zone.id,
      known_direct_cost: Math.round(knownDirectCost * 100) / 100,
      known_cost_components: known,
      unknown_cost_components: unknown,
      cost_floor: unknown.length ? null : Math.round(knownDirectCost * 100) / 100,
      cost_floor_status: unknown.length ? "NEEDS_PRODUCTION_TEST" : "COMPLETE",
      market_alternative_reference: props.market_alternative_reference || "UNKNOWN",
      proposed_sell_price: proposedSellPrice,
      expected_gross_dollars: proposedSellPrice === null || unknown.length ? null : Math.round((proposedSellPrice - knownDirectCost) * 100) / 100,
      production_rate: test.production_rate === undefined || test.production_rate === null ? "UNKNOWN" : test.production_rate,
      price_status: props.price_status || "DRAFT"
    };
  }

  function createPricingCrewModel(model, input) {
    const record = {
      pricing_crew_model_id: (input && input.pricing_crew_model_id) || uid("pricing-crew"),
      name: (input && input.name) || "David + 1 helper",
      crew_lead_count: 1,
      helper_count: 1,
      crew_lead_labor_allowance: null,
      helper_labor_allowance: null,
      payroll_employer_burden: null,
      equipment: null,
      fuel: null,
      consumables: null,
      transportation: null,
      debris_handling: null,
      map_proposal_report_time: null,
      known_direct_expense: null,
      contingency: null,
      status: "NEEDS_PRODUCTION_TEST",
      ...(input || {})
    };
    model.pricing_crew_models.push(record);
    return record;
  }

  function addMarketBenchmark(model, input) {
    const required = ["market", "service_category", "competitor_or_source", "source_url", "checked_at"];
    required.forEach((name) => { if (!input || !input[name]) throw new Error(`Market benchmark requires ${name}.`); });
    const record = {
      benchmark_id: input.benchmark_id || uid("benchmark"),
      market: input.market,
      service_category: input.service_category,
      competitor_or_source: input.competitor_or_source,
      source_url: input.source_url,
      checked_at: input.checked_at,
      geographic_scope: input.geographic_scope || "UNKNOWN",
      price_min: money(input.price_min),
      price_max: money(input.price_max),
      pricing_unit: input.pricing_unit || "UNKNOWN",
      minimum_charge: money(input.minimum_charge),
      included_scope: input.included_scope || "UNKNOWN",
      excluded_scope: input.excluded_scope || "UNKNOWN",
      turnaround_claim: input.turnaround_claim || "UNKNOWN",
      quality_or_finish_claim: input.quality_or_finish_claim || "UNKNOWN",
      source_reliability: input.source_reliability || "UNREVIEWED",
      notes: input.notes || ""
    };
    model.market_benchmarks.push(record);
    return record;
  }

  function proposalTotal(zones) {
    const selected = (zones || []).filter((zone) => (zone.properties || {}).customer_selected !== false);
    const missing = selected.filter((zone) => money((zone.properties || {}).price) === null).map((zone) => (zone.properties || {}).proposal_zone_id || zone.id);
    return {
      selected_zone_ids: selected.map((zone) => (zone.properties || {}).proposal_zone_id || zone.id),
      priced_total: selected.reduce((sum, zone) => sum + (money((zone.properties || {}).price) || 0), 0),
      unpriced_zone_ids: missing,
      complete: missing.length === 0 && selected.length > 0
    };
  }

  function setZoneSelection(model, zoneId, selected, viewerSessionId) {
    const zone = model.proposals.features.find((feature) => feature.id === zoneId || (feature.properties || {}).proposal_zone_id === zoneId);
    if (!zone) throw new Error(`Proposal zone not found: ${zoneId}`);
    const before = clone(model.proposals.features);
    zone.properties.customer_selected = Boolean(selected);
    model.customer_engagement.zone_interest.push({
      interest_id: uid("zone-interest"), proposal_zone_id: zoneId, selected: Boolean(selected),
      viewer_or_session_id: viewerSessionId || "customer-session", created_at: nowIso()
    });
    recordEdit(model, selected ? "SELECT_PROPOSAL_ZONE" : "DESELECT_PROPOSAL_ZONE", "proposals", before, model.proposals.features, { proposal_zone_id: zoneId });
    return zone;
  }

  function addCustomerMessage(model, kind, message, proposalId, zoneId, viewerSessionId) {
    const target = kind === "QUESTION" ? model.customer_engagement.questions : model.customer_engagement.change_requests;
    const saved = {
      interaction_id: uid(kind === "QUESTION" ? "question" : "change"), kind,
      proposal_id: proposalId || null, proposal_zone_id: zoneId || null,
      viewer_or_session_id: viewerSessionId || "customer-session", message: String(message || "").trim(), created_at: nowIso()
    };
    if (!saved.message) throw new Error("A message is required.");
    target.push(saved);
    return saved;
  }

  function acceptProposal(model, acceptedBy, viewerSessionId) {
    const total = proposalTotal(model.proposals.features);
    if (!total.complete) throw new Error("Every selected zone needs a price before acceptance.");
    const selected = model.proposals.features.filter((zone) => total.selected_zone_ids.includes((zone.properties || {}).proposal_zone_id || zone.id));
    const unvalidated = selected.filter((zone) => (zone.properties || {}).price_status !== "VALIDATED");
    if (unvalidated.length) throw new Error("David must validate every selected zone price before acceptance.");
    const proposalId = uid("accepted-proposal");
    const acceptedAt = nowIso();
    const snapshot = clone(selected);
    const version = {
      proposal_version_id: uid("proposal-version"), proposal_id: proposalId,
      property_id: model.property_id, accepted_at: acceptedAt, accepted_by: acceptedBy || "Customer",
      viewer_or_session_id: viewerSessionId || "customer-session", total_price: total.priced_total,
      selected_zone_ids: total.selected_zone_ids, frozen_zones: snapshot, status: "ACCEPTED", immutable: true
    };
    model.proposal_versions.push(version);
    model.accepted_proposals.push({ proposal_id: proposalId, proposal_version_id: version.proposal_version_id, accepted_at: acceptedAt, total_price: total.priced_total, status: "ACCEPTED" });
    const workOrder = {
      work_order_id: uid("work-order"), property_id: model.property_id, proposal_id: proposalId,
      proposal_version_id: version.proposal_version_id, created_at: acceptedAt, status: "NOT_STARTED",
      payment: { scheduling_payment_enabled: false, status: "NOT_ACTIVATED" },
      work_phases: snapshot.map((zone, index) => ({
        work_phase_id: uid(`work-phase-${index + 1}`), proposal_zone_id: (zone.properties || {}).proposal_zone_id || zone.id,
        status: "NOT_STARTED", before_photo_ids: clone((zone.properties || {}).before_photo_ids || []),
        actual_labor_hours: "UNKNOWN", actual_direct_cost: "UNKNOWN", after_photo_ids: [], outcome: "UNPERFORMED"
      }))
    };
    model.work_orders.push(workOrder);
    return { version, work_order: workOrder };
  }

  function createRecurringOpportunity(model, sourceWorkOrderId, type) {
    const allowed = ["MAINTENANCE_VISIT", "POST_STORM_INSPECTION", "PRE_TOUR_REFRESH", "GUIDED_TOUR", "ADDITIONAL_REVEAL_WORK"];
    if (!allowed.includes(type)) throw new Error(`Unsupported recurring opportunity: ${type}`);
    const record = { recurring_opportunity_id: uid("recurring"), property_id: model.property_id, source_work_order_id: sourceWorkOrderId || null, type, status: "PROPOSED", created_at: nowIso() };
    model.recurring_opportunities.push(record);
    return record;
  }

  function createAsset(model, asset) {
    const before = clone(model.property_assets);
    const stored = clone(asset);
    stored.asset_id = stored.asset_id || uid("asset");
    stored.observations = stored.observations || [];
    model.property_assets.push(stored);
    recordEdit(model, "CREATE_ASSET", "property_assets", before, model.property_assets, { asset_id: stored.asset_id });
    return stored;
  }

  function addAssetObservation(model, assetId, observation) {
    const asset = model.property_assets.find((item) => item.asset_id === assetId);
    if (!asset) throw new Error(`Asset not found: ${assetId}`);
    const before = clone(model.property_assets);
    const saved = { ...clone(observation), observation_id: observation.observation_id || uid("asset-observation"), recorded_at: observation.recorded_at || nowIso() };
    asset.observations.push(saved);
    recordEdit(model, "ADD_ASSET_OBSERVATION", "property_assets", before, model.property_assets, { asset_id: assetId, observation_id: saved.observation_id });
    return saved;
  }

  return { clone, createModel, recordEdit, addFeature, replaceFeature, replaceFeatureGeometry, undo, setFeatured, reorderFeatured, toggleFavorite, haversineMeters, rankPhotos, polygonAreaAcres, polygonMetrics, rectangleBoundsFromCorners, rectangleBoundsFromGeometry, rectangleRing, money, estimateZone, createPricingCrewModel, addMarketBenchmark, proposalTotal, setZoneSelection, addCustomerMessage, acceptProposal, createRecurringOpportunity, createAsset, addAssetObservation };
});
