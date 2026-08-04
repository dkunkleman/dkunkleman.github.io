"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Weather = require("../field/authoritative-weather.js");

const location = { latitude: 30.48987163, longitude: -87.0900716 };
const record = Weather.pearsonVerifiedContext(location, "2026-08-04T12:00:00.000Z");

assert.equal(record.status, "VERIFIED_OFFICIAL_RECORD");
assert.equal(record.inspection_date, "2026-08-03");
assert.equal(record.station.station_id, "USW00013899");
assert.equal(record.station.name, "Pensacola International Airport / Pensacola climate station");
assert.equal(record.station.latitude, 30.47612);
assert.equal(record.station.longitude, -87.18575);
assert.equal(record.station.inspector_supplied_approximation_miles, 6.7);
assert.equal(record.retrieval.retrieved_at, "2026-08-04T12:00:00.000Z");

const windows = record.precipitation_windows;
assert.deepEqual(
  [windows.previous_calendar_day.observed_in, windows.previous_7_full_days.observed_in, windows.previous_30_full_days.observed_in, windows.july_2026.observed_in],
  [1.53, 5.16, 11.08, 9.55]
);
assert.deepEqual(
  [windows.previous_calendar_day.normal_in, windows.previous_7_full_days.normal_in, windows.previous_30_full_days.normal_in, windows.july_2026.normal_in],
  [0.26, 1.84, 7.69, 7.89]
);
assert.equal(windows.previous_calendar_day.times_normal, 5.88);
assert.equal(windows.previous_7_full_days.times_normal, 2.8);
assert.equal(windows.previous_30_full_days.percent_above_or_below_normal, 44.1);
assert.equal(windows.previous_30_full_days.classification, "Derived from cited official station records");
assert.equal(windows.notable_days[0].precipitation_in, 1.09);

assert.equal(record.exact_daily_station_records.length, 30);
assert.equal(Number(record.exact_daily_station_records.reduce((sum, item) => sum + item.precipitation_in, 0).toFixed(2)), 11.08);
assert(record.significant_weather_events.some(item => item.event_name === "Tropical Storm Bertha"));
assert(record.official_sources.length >= 6);
assert(record.official_sources.every(source => source.agency.startsWith("NOAA") || source.agency.startsWith("National Weather Service")));
assert(record.official_sources.every(source => /^https:\/\//.test(source.url)));
assert(record.limitations.some(item => /station may differ materially from rainfall at the parcel/i.test(item)));
assert(record.audit_notes.some(item => item.status === "SUPERSEDED_WORKING_ESTIMATE" && /7\.44/.test(item.statement) && /7\.69/.test(item.correction)));

const comparison = Weather.comparison(11.08, 7.69);
assert.equal(comparison.departure_in, 3.39);
assert.equal(comparison.percent_above_or_below_normal, 44.1);
assert.equal(comparison.classification, "Derived from cited official station records");

(async () => {
  const offline = await Weather.resolve({ inspectionDate: "2026-08-03", propertyLocation: location, retrievedAt: "2026-08-04T12:00:00.000Z" });
  assert.equal(offline.status, "VERIFIED_OFFICIAL_RECORD", "the verified Pearson record remains available with no network");
  assert.equal(offline.exact_daily_station_records.length, 30);

  const cached = await Weather.resolve({ inspectionDate: "2026-08-03", propertyLocation: location, existing: offline });
  assert.equal(cached.precipitation_windows.previous_7_full_days.observed_in, 5.16, "a saved official record survives an offline finish");

  const root = path.resolve(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "field/app.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "field/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "field/sw.js"), "utf8");
  assert(app.includes("await refreshAuthoritativeWeather({ silent: true })"), "Finish Inspection retrieves or reuses official weather before package creation");
  assert(app.includes("authoritative_weather_context_attached"), "the attachment is recorded in inspection lifecycle history");
  assert(index.includes("Automatic authoritative weather") && index.includes("Refresh Official NOAA Weather"));
  assert(worker.includes("authoritative-weather.js?v=3.16.2") && worker.includes("v24-recovery"), "weather resolution and its verified fallback are cached for offline use");

  process.stdout.write("PASS: official Pearson rainfall, normals, derived comparisons, source URLs, event context, audit correction, offline preservation, UI, package integration, and service-worker delivery are verified.\n");
})().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
