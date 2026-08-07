(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AutomaticFieldContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FACT_CLASSES = Object.freeze([
    "OBSERVED_ON_SITE",
    "MEASURED_ON_SITE",
    "CAPTURED_BY_DEVICE",
    "REPORTED_BY_EXTERNAL_SOURCE",
    "CALCULATED",
    "INSPECTOR_INTERPRETATION",
    "UNKNOWN"
  ]);

  function nowIso(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return date.toISOString();
  }

  function ensureModel(inspection) {
    const existing = inspection.automatic_context && typeof inspection.automatic_context === "object" ? inspection.automatic_context : {};
    inspection.automatic_context = Object.assign({
      schema_name: "property-intelligence-automatic-context",
      schema_version: "1.0",
      device_snapshots: [],
      external_source_records: [],
      retrieval_attempts: [],
      last_device_snapshot_id: null,
      last_external_refresh_at: null,
      external_refresh_status: "NOT_ATTEMPTED",
      classification_rule: "Keep on-site facts, device captures, external reports, calculations, interpretations, and unknowns separate."
    }, existing);
    inspection.automatic_context.device_snapshots = Array.isArray(inspection.automatic_context.device_snapshots) ? inspection.automatic_context.device_snapshots : [];
    inspection.automatic_context.external_source_records = Array.isArray(inspection.automatic_context.external_source_records) ? inspection.automatic_context.external_source_records : [];
    inspection.automatic_context.retrieval_attempts = Array.isArray(inspection.automatic_context.retrieval_attempts) ? inspection.automatic_context.retrieval_attempts : [];
    inspection.site_sound_records = Array.isArray(inspection.site_sound_records) ? inspection.site_sound_records : [];
    return inspection.automatic_context;
  }

  function safeTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (error) { return null; }
  }

  function captureDeviceSnapshot(inspection, options) {
    const settings = options || {};
    const model = ensureModel(inspection);
    const position = settings.position || null;
    const capturedAt = nowIso(settings.time);
    const snapshot = {
      context_id: settings.context_id || `DEVICE-${String(model.device_snapshots.length + 1).padStart(4, "0")}`,
      information_class: "CAPTURED_BY_DEVICE",
      capture_reason: settings.reason || "automatic",
      local_time: new Date(capturedAt).toLocaleString(),
      utc_time: capturedAt,
      timezone: safeTimeZone(),
      gps: position ? {
        latitude: position.lat == null ? null : Number(position.lat),
        longitude: position.lon == null ? null : Number(position.lon),
        accuracy_m: position.accuracy_m == null ? null : Number(position.accuracy_m),
        altitude_m: position.altitude_m == null ? null : Number(position.altitude_m),
        altitude_accuracy_m: position.altitude_accuracy_m == null ? null : Number(position.altitude_accuracy_m),
        heading_deg: position.heading_deg == null ? null : Number(position.heading_deg),
        speed_mps: position.speed_mps == null ? null : Number(position.speed_mps),
        position_at: position.time || null,
        breadcrumb_sequence: position.sequence == null ? null : Number(position.sequence)
      } : null,
      orientation: settings.orientation || null,
      property_id: inspection.property_id || null,
      parcel_position: settings.parcel_position || "UNKNOWN",
      app_version: settings.app_version || null,
      browser_recovery_context: Object.assign({
        online_at_capture: typeof navigator === "undefined" ? null : Boolean(navigator.onLine),
        visibility_state: typeof document === "undefined" ? null : document.visibilityState
      }, settings.browser_recovery_context || {})
    };
    model.device_snapshots.push(snapshot);
    model.last_device_snapshot_id = snapshot.context_id;
    return snapshot;
  }

  function classifiedFact(options) {
    const settings = options || {};
    const informationClass = FACT_CLASSES.includes(settings.information_class) ? settings.information_class : "UNKNOWN";
    return {
      fact_id: settings.fact_id || `FACT-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      field: settings.field || null,
      value: settings.value == null ? null : settings.value,
      unit: settings.unit || null,
      information_class: informationClass,
      recorded_at: nowIso(settings.recorded_at),
      gps: settings.gps || null,
      source_record_id: settings.source_record_id || null,
      limitation: settings.limitation || null
    };
  }

  function haversineMeters(a, b) {
    if (!a || !b) return null;
    const toRad = degrees => Number(degrees) * Math.PI / 180;
    const dLat = toRad(Number(b.latitude) - Number(a.latitude));
    const dLon = toRad(Number(b.longitude) - Number(a.longitude));
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function externalRecord(options) {
    const settings = options || {};
    const sourceCoordinates = settings.source_coordinates || null;
    const propertyCoordinates = settings.property_coordinates || null;
    return {
      external_record_id: settings.external_record_id || `EXT-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      information_class: "REPORTED_BY_EXTERNAL_SOURCE",
      agency: settings.agency,
      product: settings.product,
      source_url: settings.source_url,
      retrieved_at: nowIso(settings.retrieved_at),
      observed_at: settings.observed_at || null,
      station_or_dataset_id: settings.station_or_dataset_id || null,
      source_coordinates: sourceCoordinates,
      distance_from_property_m: settings.distance_from_property_m == null ? haversineMeters(propertyCoordinates, sourceCoordinates) : settings.distance_from_property_m,
      status: settings.status || "AVAILABLE",
      units: settings.units || null,
      values: settings.values == null ? null : settings.values,
      exact_source_record: settings.exact_source_record == null ? null : settings.exact_source_record,
      limitations: settings.limitations || ["External-source conditions may differ from conditions at the parcel and are not observations made on site."]
    };
  }

  async function fetchJson(fetchImpl, url, options, timeoutMs) {
    const controller = typeof AbortController === "undefined" ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || 12000) : null;
    try {
      const response = await fetchImpl(url, Object.assign({}, options || {}, controller ? { signal: controller.signal } : {}));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function retrievalAttempt(model, provider, url, status, error, retrievedAt) {
    model.retrieval_attempts.push({ provider, source_url: url, status, retrieved_at: retrievedAt, error: error || null });
  }

  async function retrieveOfficialContext(inspection, options) {
    const settings = options || {};
    const model = ensureModel(inspection);
    const fetchImpl = settings.fetchImpl || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    const position = settings.position;
    if (!fetchImpl || !position || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lon))) return model;
    const lat = Number(position.lat);
    const lon = Number(position.lon);
    const propertyCoordinates = { latitude: lat, longitude: lon };
    const retrievedAt = nowIso(settings.retrieved_at);
    const add = record => model.external_source_records.push(externalRecord(Object.assign({ property_coordinates: propertyCoordinates, retrieved_at: retrievedAt }, record)));
    const jobs = [];

    jobs.push((async () => {
      const pointUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
      try {
        const point = await fetchJson(fetchImpl, pointUrl, { headers: { Accept: "application/geo+json" } });
        retrievalAttempt(model, "NWS", pointUrl, "SUCCESS", null, retrievedAt);
        add({ agency: "National Weather Service", product: "Point metadata and forecast-office routing", source_url: pointUrl, station_or_dataset_id: point.properties && point.properties.gridId || null, exact_source_record: point });
        const stationsUrl = point.properties && point.properties.observationStations;
        if (stationsUrl) {
          try {
            const stations = await fetchJson(fetchImpl, stationsUrl, { headers: { Accept: "application/geo+json" } });
            const stationFeature = stations.features && stations.features[0];
            const stationUrl = stationFeature && stationFeature.id;
            if (stationUrl) {
              const observationUrl = `${stationUrl}/observations/latest`;
              const observation = await fetchJson(fetchImpl, observationUrl, { headers: { Accept: "application/geo+json" } });
              const coordinates = stationFeature.geometry && stationFeature.geometry.coordinates;
              add({ agency: "National Weather Service", product: "Latest station observation", source_url: observationUrl, station_or_dataset_id: stationFeature.properties && stationFeature.properties.stationIdentifier || stationUrl.split("/").pop(), source_coordinates: coordinates ? { longitude: coordinates[0], latitude: coordinates[1] } : null, observed_at: observation.properties && observation.properties.timestamp || null, units: "Provider units retained per observation property", exact_source_record: observation });
              retrievalAttempt(model, "NWS", observationUrl, "SUCCESS", null, retrievedAt);
            }
          } catch (error) { retrievalAttempt(model, "NWS", stationsUrl, "FAILED_NONBLOCKING", error.message, retrievedAt); }
        }
        const urls = [point.properties && point.properties.forecast, point.properties && point.properties.forecastHourly].filter(Boolean);
        for (const url of urls) {
          try {
            const result = await fetchJson(fetchImpl, url, { headers: { Accept: "application/geo+json" } });
            add({ agency: "National Weather Service", product: url === urls[0] ? "Forecast" : "Hourly forecast", source_url: url, observed_at: result.properties && result.properties.generatedAt || null, exact_source_record: result });
            retrievalAttempt(model, "NWS", url, "SUCCESS", null, retrievedAt);
          } catch (error) { retrievalAttempt(model, "NWS", url, "FAILED_NONBLOCKING", error.message, retrievedAt); }
        }
        const alertUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
        try {
          const alerts = await fetchJson(fetchImpl, alertUrl, { headers: { Accept: "application/geo+json" } });
          add({ agency: "National Weather Service", product: "Active weather alerts", source_url: alertUrl, exact_source_record: alerts });
          retrievalAttempt(model, "NWS", alertUrl, "SUCCESS", null, retrievedAt);
        } catch (error) { retrievalAttempt(model, "NWS", alertUrl, "FAILED_NONBLOCKING", error.message, retrievedAt); }
      } catch (error) { retrievalAttempt(model, "NWS", pointUrl, "FAILED_NONBLOCKING", error.message, retrievedAt); }
    })());

    jobs.push((async () => {
      const pad = 0.12;
      const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${(lon-pad).toFixed(4)},${(lat-pad).toFixed(4)},${(lon+pad).toFixed(4)},${(lat+pad).toFixed(4)}&parameterCd=00060,00065&period=P7D&siteStatus=all`;
      try {
        const result = await fetchJson(fetchImpl, url);
        add({ agency: "U.S. Geological Survey", product: "NWIS instantaneous streamflow and gauge height", source_url: url, station_or_dataset_id: "NWIS-IV", units: "Provider units retained in exact source record", exact_source_record: result, limitations: ["Nearest available gauges may be distant or hydrologically unrelated to the parcel.", "Gauge data is external context, not an on-site water measurement."] });
        retrievalAttempt(model, "USGS NWIS", url, "SUCCESS", null, retrievedAt);
      } catch (error) { retrievalAttempt(model, "USGS NWIS", url, "FAILED_NONBLOCKING", error.message, retrievedAt); }
    })());

    jobs.push((async () => {
      const url = `https://www.fws.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query?where=1%3D1&geometry=${encodeURIComponent(`${lon},${lat}`)}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&f=json`;
      try {
        const result = await fetchJson(fetchImpl, url);
        add({ agency: "U.S. Fish and Wildlife Service", product: "National Wetlands Inventory intersecting mapped features", source_url: url, station_or_dataset_id: "NWI Wetlands MapServer", exact_source_record: result, limitations: ["NWI mapping is external screening context and is not a wetland delineation, jurisdictional determination, or on-site observation."] });
        retrievalAttempt(model, "USFWS NWI", url, "SUCCESS", null, retrievedAt);
      } catch (error) { retrievalAttempt(model, "USFWS NWI", url, "FAILED_NONBLOCKING", error.message, retrievedAt); }
    })());

    jobs.push((async () => {
      const stationListUrl = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels&units=english";
      try {
        const stationList = await fetchJson(fetchImpl, stationListUrl);
        const stations = Array.isArray(stationList.stations) ? stationList.stations : [];
        const nearest = stations.map(station => ({ station, distance: haversineMeters(propertyCoordinates, { latitude: station.lat, longitude: station.lng }) })).filter(item => Number.isFinite(item.distance)).sort((a, b) => a.distance - b.distance)[0];
        if (!nearest) throw new Error("No NOAA water-level station was returned.");
        const dataUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=PropertyInspector&date=latest&datum=MLLW&station=${encodeURIComponent(nearest.station.id)}&time_zone=gmt&units=english&format=json`;
        const result = await fetchJson(fetchImpl, dataUrl);
        add({ agency: "NOAA Center for Operational Oceanographic Products and Services", product: "Nearest available coastal water-level observation", source_url: dataUrl, station_or_dataset_id: nearest.station.id, source_coordinates: { latitude: Number(nearest.station.lat), longitude: Number(nearest.station.lng) }, distance_from_property_m: nearest.distance, units: "feet relative to MLLW unless provider response states otherwise", exact_source_record: { station: nearest.station, response: result }, limitations: ["A coastal water-level station is external context and may not represent inland drainage, parcel water levels, storm surge, or rainfall at the property."] });
        retrievalAttempt(model, "NOAA CO-OPS", dataUrl, "SUCCESS", null, retrievedAt);
      } catch (error) { retrievalAttempt(model, "NOAA CO-OPS", stationListUrl, "FAILED_NONBLOCKING", error.message, retrievedAt); }
    })());

    jobs.push((async () => {
      const url = "https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest";
      const query = `SELECT TOP 20 mu.mukey, mu.musym, mu.muname, mu.muacres FROM mapunit mu INNER JOIN mupolygon mup ON mu.mukey=mup.mukey WHERE mup.mupolygongeo.STIntersects(geometry::STGeomFromText('POINT(${lon} ${lat})',4326))=1`;
      try {
        const result = await fetchJson(fetchImpl, url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, format: "JSON+COLUMNNAME" }) });
        add({ agency: "USDA Natural Resources Conservation Service", product: "Soil Data Access / SSURGO map unit at GPS point", source_url: url, station_or_dataset_id: "SSURGO", exact_source_record: result, limitations: ["Soil survey mapping is generalized and does not replace parcel-specific geotechnical or wetland investigation."] });
        retrievalAttempt(model, "USDA NRCS", url, "SUCCESS", null, retrievedAt);
      } catch (error) { retrievalAttempt(model, "USDA NRCS", url, "FAILED_NONBLOCKING", error.message, retrievedAt); }
    })());

    await Promise.allSettled(jobs);
    model.last_external_refresh_at = retrievedAt;
    model.external_refresh_status = model.external_source_records.length ? "PARTIAL_OR_COMPLETE" : "OFFLINE_OR_UNAVAILABLE";
    return model;
  }

  function reportByClass(inspection) {
    ensureModel(inspection);
    const groups = Object.fromEntries(FACT_CLASSES.map(name => [name, []]));
    const add = (value, fallback) => {
      if (!value) return;
      const type = FACT_CLASSES.includes(value.information_class) ? value.information_class : fallback;
      groups[type].push(value);
    };
    (inspection.markers || []).forEach(item => add(item, "OBSERVED_ON_SITE"));
    (inspection.measurements || []).forEach(item => add(item, "MEASURED_ON_SITE"));
    (inspection.photos || []).forEach(item => add(item, "CAPTURED_BY_DEVICE"));
    (inspection.voice_notes || []).forEach(item => add(item, "CAPTURED_BY_DEVICE"));
    (inspection.orientation_samples || []).forEach(item => add(item, "CAPTURED_BY_DEVICE"));
    (inspection.automatic_context.external_source_records || []).forEach(item => add(item, "REPORTED_BY_EXTERNAL_SOURCE"));
    if (inspection.authoritative_weather) add(Object.assign({ information_class: "REPORTED_BY_EXTERNAL_SOURCE" }, inspection.authoritative_weather), "REPORTED_BY_EXTERNAL_SOURCE");
    (inspection.inspector_hypotheses || []).forEach(item => add(item, "INSPECTOR_INTERPRETATION"));
    return { schema_name: "property-intelligence-facts-by-class", schema_version: "1.0", classes: groups };
  }

  return { FACT_CLASSES, ensureModel, captureDeviceSnapshot, classifiedFact, externalRecord, retrieveOfficialContext, reportByClass, haversineMeters };
});
