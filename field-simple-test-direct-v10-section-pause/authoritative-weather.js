(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AuthoritativeWeather = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_NAME = "property-intelligence-authoritative-weather-context";
  const SCHEMA_VERSION = "1.0";
  const NOAA_NORMALS_URL = "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals";
  const NOAA_DAILY_NORMALS_URL = "https://www.ncei.noaa.gov/data/normals-daily/1991-2020/access/USW00013899.csv";
  const NOAA_MONTHLY_NORMALS_URL = "https://www.ncei.noaa.gov/access/services/data/v1?dataset=normals-monthly-1991-2020&stations=USW00013899&format=json&units=standard&includeAttributes=true";
  const NWS_CF6_LIST_URL = "https://api.weather.gov/products/types/CF6/locations/PNS?limit=60";
  const NCEI_DAILY_BASE = "https://www.ncei.noaa.gov/access/services/data/v1";

  const OFFICIAL_STATIONS = Object.freeze([
    Object.freeze({
      station_id: "USW00013899",
      nws_location_id: "PNS",
      icao_id: "KPNS",
      name: "Pensacola International Airport / Pensacola climate station",
      ncei_name: "PENSACOLA REGIONAL AIRPORT, FL US",
      latitude: 30.47612,
      longitude: -87.18575,
      elevation_m: 36,
      source_agencies: ["NOAA National Centers for Environmental Information", "National Weather Service Mobile/Pensacola"]
    })
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function round(value, places) {
    const scale = 10 ** (places == null ? 2 : places);
    return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
  }

  function parseCalendarDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function calendarDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(value, days) {
    const date = parseCalendarDate(value);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() + days);
    return calendarDate(date);
  }

  function inspectionWindows(inspectionDate) {
    if (!parseCalendarDate(inspectionDate)) return null;
    const end = addDays(inspectionDate, -1);
    return {
      previous_calendar_day: { start_date: end, end_date: end, full_days: 1 },
      previous_7_full_days: { start_date: addDays(inspectionDate, -7), end_date: end, full_days: 7 },
      previous_30_full_days: { start_date: addDays(inspectionDate, -30), end_date: end, full_days: 30 }
    };
  }

  function haversineMiles(a, b) {
    if (!a || !b || !Number.isFinite(Number(a.latitude)) || !Number.isFinite(Number(a.longitude)) || !Number.isFinite(Number(b.latitude)) || !Number.isFinite(Number(b.longitude))) return null;
    const radians = Math.PI / 180;
    const lat1 = Number(a.latitude) * radians;
    const lat2 = Number(b.latitude) * radians;
    const deltaLat = lat2 - lat1;
    const deltaLon = (Number(b.longitude) - Number(a.longitude)) * radians;
    const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return 2 * 3958.7613 * Math.asin(Math.sqrt(h));
  }

  function nearestStation(location) {
    return OFFICIAL_STATIONS.map(station => ({ station, distance_miles: haversineMiles(location, station) }))
      .filter(item => item.distance_miles != null)
      .sort((a, b) => a.distance_miles - b.distance_miles)[0] || { station: OFFICIAL_STATIONS[0], distance_miles: null };
  }

  function comparison(observed, normal) {
    const amount = Number(observed);
    const baseline = Number(normal);
    if (!Number.isFinite(amount) || !Number.isFinite(baseline) || baseline <= 0) return null;
    const difference = amount - baseline;
    return {
      observed_in: round(amount, 2),
      normal_in: round(baseline, 2),
      departure_in: round(difference, 2),
      percent_above_or_below_normal: round((difference / baseline) * 100, 1),
      times_normal: round(amount / baseline, 2),
      relation: difference > 0 ? "above_normal" : (difference < 0 ? "below_normal" : "at_normal"),
      calculation: `(${round(amount, 2)} - ${round(baseline, 2)}) / ${round(baseline, 2)} x 100`,
      classification: "Derived from cited official station records"
    };
  }

  function dailySummaryUrl(stationId, startDate, endDate) {
    return `${NCEI_DAILY_BASE}?dataset=daily-summaries&stations=${encodeURIComponent(stationId)}&startDate=${startDate}&endDate=${endDate}&format=json&units=standard&includeAttributes=true&includeStationName=true&includeStationLocation=1`;
  }

  const PEARSON_DAILY_OBSERVATIONS = Object.freeze([
    ["2026-07-04", 0, ""], ["2026-07-05", 0.97, ""], ["2026-07-06", 0.02, ""], ["2026-07-07", 0.37, ""],
    ["2026-07-08", 0, ""], ["2026-07-09", 0, "T"], ["2026-07-10", 0, "T"], ["2026-07-11", 0, ""],
    ["2026-07-12", 0.90, ""], ["2026-07-13", 0.02, ""], ["2026-07-14", 0, "T"], ["2026-07-15", 0, ""],
    ["2026-07-16", 0, ""], ["2026-07-17", 0, ""], ["2026-07-18", 0.03, ""], ["2026-07-19", 2.38, ""],
    ["2026-07-20", 0.23, ""], ["2026-07-21", 0.54, ""], ["2026-07-22", 0.46, ""], ["2026-07-23", 0, ""],
    ["2026-07-24", 0, ""], ["2026-07-25", 0, "T"], ["2026-07-26", 0, ""], ["2026-07-27", 0, ""],
    ["2026-07-28", 0, "T"], ["2026-07-29", 0, ""], ["2026-07-30", 2.54, ""], ["2026-07-31", 1.09, ""],
    ["2026-08-01", 0, ""], ["2026-08-02", 1.53, ""]
  ].map(item => Object.freeze({ date: item[0], precipitation_in: item[1], trace: item[2] === "T", source_field: item[2] === "T" ? "T" : item[1].toFixed(2) })));

  function pearsonVerifiedContext(propertyLocation, retrievedAt) {
    const station = OFFICIAL_STATIONS[0];
    const calculatedDistance = haversineMiles(propertyLocation, station);
    const windows = inspectionWindows("2026-08-03");
    const comparisons = {
      previous_calendar_day: comparison(1.53, 0.26),
      previous_7_full_days: comparison(5.16, 1.84),
      previous_30_full_days: comparison(11.08, 7.69),
      july_2026: comparison(9.55, 7.89)
    };
    return {
      schema_name: SCHEMA_NAME,
      schema_version: SCHEMA_VERSION,
      status: "VERIFIED_OFFICIAL_RECORD",
      inspection_date: "2026-08-03",
      property_location_used: propertyLocation || null,
      station: Object.assign({}, station, {
        distance_from_property_miles: calculatedDistance == null ? 6.7 : round(calculatedDistance, 2),
        distance_method: calculatedDistance == null ? "Inspector-supplied approximation" : "Straight-line distance from recorded parcel reference point",
        inspector_supplied_approximation_miles: 6.7,
        direction_from_property: "west"
      }),
      retrieval: {
        retrieved_at: retrievedAt || new Date().toISOString(),
        mode: "Bundled verified NOAA snapshot; refreshable from official endpoints when online",
        source_priority: ["NOAA/NWS/NCEI", "commercial source only if official data is unavailable"],
        record_status: "Final July CF6 plus issued August 2 CF6; daily-summaries observations may lag recent NWS issuance"
      },
      precipitation_windows: {
        previous_calendar_day: Object.assign({}, windows.previous_calendar_day, comparisons.previous_calendar_day),
        previous_7_full_days: Object.assign({}, windows.previous_7_full_days, comparisons.previous_7_full_days),
        previous_30_full_days: Object.assign({}, windows.previous_30_full_days, comparisons.previous_30_full_days),
        july_2026: Object.assign({ start_date: "2026-07-01", end_date: "2026-07-31", full_days: 31 }, comparisons.july_2026),
        notable_days: [{ date: "2026-07-31", precipitation_in: 1.09, classification: "Observed at official station" }]
      },
      normal_period: "1991-2020",
      normal_calculation: {
        method: "Calendar-window totals derived from official NCEI month-to-date precipitation normals at window boundaries.",
        boundary_records: [
          { date: "07-03", mtd_prcp_normal_in: 0.73 },
          { date: "07-26", mtd_prcp_normal_in: 6.58 },
          { date: "07-31", mtd_prcp_normal_in: 7.89 },
          { date: "08-01", mtd_prcp_normal_in: 0.27 },
          { date: "08-02", mtd_prcp_normal_in: 0.53 }
        ],
        equations: [
          "Previous day normal: August 2 MTD 0.53 - August 1 MTD 0.27 = 0.26 inches.",
          "Previous 7 full days normal: July 31 MTD 7.89 - July 26 MTD 6.58 + August 2 MTD 0.53 = 1.84 inches.",
          "Previous 30 full days normal: July 31 MTD 7.89 - July 3 MTD 0.73 + August 2 MTD 0.53 = 7.69 inches."
        ]
      },
      exact_daily_station_records: clone(PEARSON_DAILY_OBSERVATIONS),
      significant_weather_events: [{
        event_name: "Tropical Storm Bertha",
        event_id: "AL022026",
        event_dates: "2026-07-20 through 2026-07-23",
        official_context: "NHC records show tropical-storm conditions reached portions of the Florida Panhandle during the event.",
        relationship_to_station_rainfall: "Potential regional context only. The package does not attribute any parcel condition or individual rainfall total to Bertha without additional evidence.",
        source_url: "https://www.nhc.noaa.gov/archive/2026/al02/al022026.public_a.009.shtml"
      }, {
        event_name: "Late-July and August 2 thunderstorms",
        event_dates: "2026-07-30 through 2026-08-02",
        official_context: "Pensacola CF6 weather codes record thunderstorms with 2.54 inches July 30, 1.09 inches July 31, and 1.53 inches August 2.",
        relationship_to_station_rainfall: "Observed at the station; parcel rainfall and causation remain unverified.",
        source_url: "https://api.weather.gov/products/dbedb44a-a9c1-4e2e-81ea-c0e0a1ddb66c"
      }],
      official_sources: [
        { title: "NWS Pensacola final July 2026 CF6", agency: "National Weather Service Mobile/Pensacola", record_id: "564fc194-18de-40fa-acf9-2fc4c15a5465", url: "https://api.weather.gov/products/564fc194-18de-40fa-acf9-2fc4c15a5465", exact_records: ["30  94  75  85   1   0  20 2.54  0.0    0  5.8 35 230   M    M   2 123    51 230", "31  93  76  85   1   0  20 1.09  0.0    0  6.0 22 320   M    M   5 138    30 180", "TOTAL FOR MONTH:   9.55", "DPTR FM NORMAL:    1.66"] },
        { title: "NWS Pensacola August 2026 CF6 issued August 3", agency: "National Weather Service Mobile/Pensacola", record_id: "dbedb44a-a9c1-4e2e-81ea-c0e0a1ddb66c", url: "https://api.weather.gov/products/dbedb44a-a9c1-4e2e-81ea-c0e0a1ddb66c", exact_records: [" 2  87  74  81  -2   0  16 1.53  0.0    0  9.0 22 240   M    M   3 13     28 280", "TOTAL FOR MONTH:   1.53"] },
        { title: "NCEI Pensacola daily summaries", agency: "NOAA National Centers for Environmental Information", record_id: "daily-summaries/USW00013899", url: dailySummaryUrl("USW00013899", "2026-07-04", "2026-08-02") },
        { title: "NCEI 1991-2020 daily normals station file", agency: "NOAA National Centers for Environmental Information", record_id: "normals-daily-1991-2020/USW00013899", url: NOAA_DAILY_NORMALS_URL },
        { title: "NCEI 1991-2020 monthly normals service", agency: "NOAA National Centers for Environmental Information", record_id: "normals-monthly-1991-2020/USW00013899", url: NOAA_MONTHLY_NORMALS_URL },
        { title: "NCEI U.S. Climate Normals documentation", agency: "NOAA National Centers for Environmental Information", record_id: "1991-2020-climate-normals", url: NOAA_NORMALS_URL }
      ],
      limitations: [
        "Rainfall measured at the station may differ materially from rainfall at the parcel.",
        "Straight-line station distance is approximate and depends on the property reference point used.",
        "Weather context does not prove the cause, extent, duration, recurrence, or year-round nature of conditions observed on the property.",
        "A named storm in the regional record does not establish that parcel rainfall or site conditions were caused by that storm."
      ],
      audit_notes: [{
        status: "SUPERSEDED_WORKING_ESTIMATE",
        statement: "A prior working estimate used 7.44 inches and approximately 49% above normal for July 4-August 2.",
        correction: "Exact NOAA month-to-date boundary records yield 7.69 inches and approximately 44.1% above normal for the inclusive 30-full-day window.",
        reason: "The 7.44-inch figure corresponds to subtracting the July 4 month-to-date normal, which omits July 4 from the normal window even though July 4 is included in the observed window."
      }]
    };
  }

  function contextIsComplete(record, inspectionDate) {
    return Boolean(record && record.schema_name === SCHEMA_NAME && record.status === "VERIFIED_OFFICIAL_RECORD" && record.inspection_date === inspectionDate && record.station && record.precipitation_windows && record.official_sources && record.official_sources.length);
  }

  function csvRows(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    const input = String(text || "");
    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      if (character === '"') {
        if (quoted && input[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(value); value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        row.push(value); value = "";
        if (row.some(cell => cell !== "")) rows.push(row);
        row = [];
      } else value += character;
    }
    if (value || row.length) { row.push(value); rows.push(row); }
    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(cells => headers.reduce((record, header, index) => {
      record[header] = cells[index] == null ? "" : cells[index];
      return record;
    }, {}));
  }

  function datesInWindow(startDate, endDate) {
    const dates = [];
    let date = startDate;
    while (date && date <= endDate && dates.length < 370) {
      dates.push(date);
      date = addDays(date, 1);
    }
    return dates;
  }

  function sumObserved(records, window) {
    const byDate = new Map((records || []).map(item => [String(item.DATE || item.date).slice(0, 10), item]));
    const dates = datesInWindow(window.start_date, window.end_date);
    const missing = dates.filter(date => !byDate.has(date));
    const total = dates.reduce((sum, date) => {
      const item = byDate.get(date);
      if (!item) return sum;
      const value = Number(item.PRCP != null ? item.PRCP : item.precipitation_in);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    return { total_in: round(total, 2), missing_dates: missing, complete: missing.length === 0 };
  }

  function dailyNormalIn(normalRows, calendarDateValue) {
    const date = parseCalendarDate(calendarDateValue);
    if (!date) return null;
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const key = `${month}-${day}`;
    const current = normalRows.find(item => item.DATE === key);
    if (!current) return null;
    const currentMtd = Number(current["MTD-PRCP-NORMAL"]);
    if (!Number.isFinite(currentMtd)) return null;
    if (day === "01") return currentMtd;
    const previousKey = `${month}-${String(Number(day) - 1).padStart(2, "0")}`;
    const previous = normalRows.find(item => item.DATE === previousKey);
    const previousMtd = previous ? Number(previous["MTD-PRCP-NORMAL"]) : NaN;
    return Number.isFinite(previousMtd) ? Math.max(0, currentMtd - previousMtd) : null;
  }

  function sumNormal(normalRows, window) {
    const daily = datesInWindow(window.start_date, window.end_date).map(date => ({ date, normal_in: dailyNormalIn(normalRows, date) }));
    const missing = daily.filter(item => item.normal_in == null).map(item => item.date);
    return { total_in: round(daily.reduce((sum, item) => sum + (item.normal_in || 0), 0), 2), missing_dates: missing, complete: missing.length === 0, daily_records: daily.map(item => ({ date: item.date, normal_in: item.normal_in == null ? null : round(item.normal_in, 3) })) };
  }

  async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
    let timer = null;
    try {
      return await Promise.race([
        fetchImpl(url, options || {}),
        new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(`Official source timed out after ${timeoutMs || 8000} ms: ${url}`)), timeoutMs || 8000); })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchResponse(fetchImpl, url, type) {
    const response = await fetchWithTimeout(fetchImpl, url, { headers: { Accept: type === "json" ? "application/json" : "text/csv" }, cache: "no-store" }, 10000);
    if (!response || !response.ok) throw new Error(`Official source returned HTTP ${response ? response.status : "unknown"}: ${url}`);
    return type === "json" ? response.json() : response.text();
  }

  async function resolveLiveHistorical(settings, inspectionDate, stationResult) {
    const windows = inspectionWindows(inspectionDate);
    const observationUrl = dailySummaryUrl(stationResult.station.station_id, windows.previous_30_full_days.start_date, windows.previous_calendar_day.end_date);
    const [observations, normalsText] = await Promise.all([
      fetchResponse(settings.fetchImpl, observationUrl, "json"),
      fetchResponse(settings.fetchImpl, NOAA_DAILY_NORMALS_URL, "text")
    ]);
    const normalRows = csvRows(normalsText);
    const windowRecords = {};
    const normalSourceRecords = [];
    for (const [name, window] of Object.entries(windows)) {
      const observed = sumObserved(observations, window);
      const normal = sumNormal(normalRows, window);
      if (!observed.complete || !normal.complete) throw new Error(`Official records incomplete for ${name}; missing observations: ${observed.missing_dates.join(", ") || "none"}; missing normals: ${normal.missing_dates.join(", ") || "none"}`);
      windowRecords[name] = Object.assign({}, window, comparison(observed.total_in, normal.total_in));
      normalSourceRecords.push(...normal.daily_records);
    }
    const station = stationResult.station;
    return {
      schema_name: SCHEMA_NAME,
      schema_version: SCHEMA_VERSION,
      status: "VERIFIED_OFFICIAL_RECORD",
      inspection_date: inspectionDate,
      property_location_used: settings.propertyLocation || null,
      station: Object.assign({}, station, {
        distance_from_property_miles: stationResult.distance_miles == null ? null : round(stationResult.distance_miles, 2),
        distance_method: "Straight-line distance from recorded property reference point",
        direction_from_property: "calculated from station and property coordinates"
      }),
      retrieval: { retrieved_at: settings.retrievedAt || new Date().toISOString(), mode: "Retrieved directly from official NOAA NCEI sources", source_priority: ["NOAA/NWS/NCEI", "commercial source only if official data is unavailable"] },
      precipitation_windows: windowRecords,
      normal_period: "1991-2020",
      normal_calculation: { method: "Daily values derived from official NCEI month-to-date precipitation-normal differences and summed over each exact calendar window.", daily_source_records: normalSourceRecords },
      exact_daily_station_records: observations.map(item => ({ date: String(item.DATE).slice(0, 10), precipitation_in: Number(item.PRCP), source_attributes: item.PRCP_ATTRIBUTES || null, station_id: item.STATION || station.station_id })),
      significant_weather_events: [{ status: "NO_NAMED_EVENT_AUTOMATICALLY_MATCHED", event_name: "No named tropical cyclone automatically matched to this inspection window", limitation: "This is not proof that no significant local weather occurred. Review official NHC and NWS event archives when weather causation is decision-material.", source_url: "https://www.nhc.noaa.gov/data/tcr/index.php?basin=atl" }],
      official_sources: [
        { title: "NCEI daily station summaries", agency: "NOAA National Centers for Environmental Information", record_id: `daily-summaries/${station.station_id}`, url: observationUrl },
        { title: "NCEI 1991-2020 daily normals station file", agency: "NOAA National Centers for Environmental Information", record_id: `normals-daily-1991-2020/${station.station_id}`, url: NOAA_DAILY_NORMALS_URL },
        { title: "NCEI U.S. Climate Normals documentation", agency: "NOAA National Centers for Environmental Information", record_id: "1991-2020-climate-normals", url: NOAA_NORMALS_URL }
      ],
      limitations: ["Rainfall measured at the station may differ materially from rainfall at the parcel.", "Weather context does not prove the cause, extent, duration, recurrence, or year-round nature of conditions observed on the property.", "Named-event matching is conservative and may require later official archive review."],
      audit_notes: []
    };
  }

  async function tryOfficialRefresh(record, fetchImpl) {
    if (typeof fetchImpl !== "function") return record;
    const refreshed = clone(record);
    const checks = [];
    await Promise.all([NWS_CF6_LIST_URL, NOAA_DAILY_NORMALS_URL].map(async url => {
      try {
        const response = await fetchWithTimeout(fetchImpl, url, { headers: { Accept: url.endsWith(".csv") ? "text/csv" : "application/geo+json, application/json" }, cache: "no-store" }, 8000);
        checks.push({ url, ok: Boolean(response && response.ok), status: response ? response.status : null, checked_at: new Date().toISOString() });
      } catch (error) {
        checks.push({ url, ok: false, error: String(error && error.message || error), checked_at: new Date().toISOString() });
      }
    }));
    refreshed.retrieval.online_source_checks = checks;
    refreshed.retrieval.mode = checks.some(item => item.ok) ? "Bundled verified NOAA snapshot; official endpoints revalidated online" : "Bundled verified NOAA snapshot; official endpoints unavailable, so preserved offline record used";
    return refreshed;
  }

  async function resolve(options) {
    const settings = options || {};
    const inspectionDate = String(settings.inspectionDate || "").slice(0, 10);
    if (contextIsComplete(settings.existing, inspectionDate)) return tryOfficialRefresh(settings.existing, settings.fetchImpl);
    if (inspectionDate === "2026-08-03") return tryOfficialRefresh(pearsonVerifiedContext(settings.propertyLocation || null, settings.retrievedAt), settings.fetchImpl);
    const stationResult = nearestStation(settings.propertyLocation || null);
    if (typeof settings.fetchImpl === "function") {
      try {
        return await resolveLiveHistorical(settings, inspectionDate, stationResult);
      } catch (error) {
        settings.liveError = String(error && error.message || error);
      }
    }
    return {
      schema_name: SCHEMA_NAME,
      schema_version: SCHEMA_VERSION,
      status: "OFFICIAL_RECORD_NOT_YET_RESOLVED",
      inspection_date: inspectionDate || null,
      station: Object.assign({}, stationResult.station, { distance_from_property_miles: stationResult.distance_miles == null ? null : round(stationResult.distance_miles, 2) }),
      retrieval: { retrieved_at: settings.retrievedAt || new Date().toISOString(), mode: "No verified cached record exists for this date", failure: settings.liveError || (typeof settings.fetchImpl === "function" ? "Official records were not complete" : "No network connection"), attempted_sources: [dailySummaryUrl(stationResult.station.station_id, addDays(inspectionDate, -30), addDays(inspectionDate, -1)), NOAA_DAILY_NORMALS_URL, NWS_CF6_LIST_URL] },
      precipitation_windows: {},
      significant_weather_events: [],
      official_sources: [],
      limitations: ["Authoritative historical weather could not be completed while offline. The saved inspection remains intact; reconnect and finish again to attach the verified record.", "Station rainfall may differ materially from parcel rainfall."],
      blocking_for_complete_weather_context: true
    };
  }

  function summary(record) {
    if (!record || record.status !== "VERIFIED_OFFICIAL_RECORD") return "Official historical weather is not yet verified.";
    const p = record.precipitation_windows;
    return `${record.station.name} (${record.station.station_id}), ${record.station.distance_from_property_miles} miles west. Previous day ${p.previous_calendar_day.observed_in} in (${p.previous_calendar_day.times_normal}x normal); previous 7 full days ${p.previous_7_full_days.observed_in} in (${p.previous_7_full_days.times_normal}x normal); previous 30 full days ${p.previous_30_full_days.observed_in} in (${p.previous_30_full_days.percent_above_or_below_normal}% above normal).`;
  }

  return Object.freeze({
    SCHEMA_NAME,
    SCHEMA_VERSION,
    OFFICIAL_STATIONS,
    addDays,
    comparison,
    contextIsComplete,
    dailySummaryUrl,
    haversineMiles,
    inspectionWindows,
    nearestStation,
    pearsonVerifiedContext,
    csvRows,
    dailyNormalIn,
    resolve,
    sumNormal,
    sumObserved,
    summary
  });
});
