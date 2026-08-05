"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Context = require("../field-simple-test/automatic-context.js");

(async () => {
  const inspection = { property_id: "PROPERTY-000001", markers: [], measurements: [], photos: [], voice_notes: [], orientation_samples: [], inspector_hypotheses: [] };
  const position = { lat: 30.489, lon: -87.091, accuracy_m: 4, altitude_m: 12, heading_deg: 90, speed_mps: 1.1, time: "2026-08-04T15:00:00.000Z", sequence: 4 };
  const snapshot = Context.captureDeviceSnapshot(inspection, { position, reason: "test", app_version: "test" });
  assert.equal(snapshot.information_class, "CAPTURED_BY_DEVICE");
  assert.equal(snapshot.gps.breadcrumb_sequence, 4);
  assert(Context.FACT_CLASSES.includes("REPORTED_BY_EXTERNAL_SOURCE"));

  const fakeFetch = async url => {
    let body = {};
    if (url.includes("api.weather.gov/points/")) body = { properties: { gridId: "MOB", forecast: "https://api.weather.gov/gridpoints/MOB/1,1/forecast", forecastHourly: "https://api.weather.gov/gridpoints/MOB/1,1/hourly", observationStations: "https://api.weather.gov/gridpoints/MOB/1,1/stations" } };
    else if (url.endsWith("/stations")) body = { features: [{ id: "https://api.weather.gov/stations/KPNS", geometry: { coordinates: [-87.187, 30.473] }, properties: { stationIdentifier: "KPNS" } }] };
    else if (url.includes("observations/latest")) body = { properties: { timestamp: "2026-08-04T15:00:00Z", temperature: { value: 30, unitCode: "wmoUnit:degC" } } };
    else if (url.includes("mdapi")) body = { stations: [{ id: "8729840", lat: 30.4, lng: -87.2, name: "Test station" }] };
    else if (url.includes("datagetter")) body = { data: [{ t: "2026-08-04 15:00", v: "1.2" }] };
    else if (url.includes("alerts/active")) body = { features: [] };
    else if (url.includes("forecast") || url.includes("hourly")) body = { properties: { generatedAt: "2026-08-04T15:00:00Z", periods: [] } };
    else if (url.includes("waterservices.usgs.gov")) body = { value: { timeSeries: [] } };
    else if (url.includes("wetlandsmapservice")) body = { features: [] };
    else if (url.includes("SDMDataAccess")) body = { Table: [] };
    return { ok: true, status: 200, json: async () => body };
  };
  await Context.retrieveOfficialContext(inspection, { position, fetchImpl: fakeFetch, retrieved_at: "2026-08-04T15:01:00.000Z" });
  assert(inspection.automatic_context.external_source_records.some(item => item.product === "Latest station observation"));
  assert(inspection.automatic_context.external_source_records.every(item => item.information_class === "REPORTED_BY_EXTERNAL_SOURCE"));
  assert(inspection.automatic_context.external_source_records.every(item => item.agency && item.product && item.source_url && item.retrieved_at && item.status && item.limitations));

  const failureInspection = { markers: [], measurements: [], photos: [], voice_notes: [], orientation_samples: [], inspector_hypotheses: [] };
  await Context.retrieveOfficialContext(failureInspection, { position, fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(failureInspection.automatic_context.external_refresh_status, "OFFLINE_OR_UNAVAILABLE");
  assert(failureInspection.automatic_context.retrieval_attempts.every(item => item.status === "FAILED_NONBLOCKING"));

  const app = fs.readFileSync(path.join(__dirname, "../field-simple-test/app.js"), "utf8");
  assert(app.includes("TAKE ONE PICTURE STRAIGHT ACROSS THE DITCH"));
  assert(app.includes("PICTURE WOULD NOT SHOW IT"));
  assert(app.includes("IS THERE WATER IN THE DITCH?"));
  assert(app.includes("IS THE GROUND BEHIND THE DITCH REASONABLY PASSABLE?"));
  assert(app.includes("SITE SOUND / EXPERIENCE"));
  assert(app.includes("RECORD 10-SECOND AMBIENT SOUND"));
  assert(app.includes("SOUND CHANGED"));

  console.log("automatic context and optional field-question tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
