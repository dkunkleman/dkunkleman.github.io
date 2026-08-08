(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PropertyPhotoPoints = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_NAME = "property-intelligence-photo-point";
  const SCHEMA_VERSION = 1;
  const EXPORT_SCHEMA = "property-intelligence-photo-point-export";
  const PURPOSES = new Set(["BEFORE", "WORK", "AFTER", "MONITORING"]);

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function nowIso() { return new Date().toISOString(); }

  function defaultId(prefix) {
    const uuid = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${uuid}`;
  }

  function unavailable(reason = "NOT_AVAILABLE_FROM_DEVICE_OR_OPERATOR") {
    return { availability: "UNAVAILABLE", value: null, source: null, reason };
  }

  function measured(value, source, reliability = "REPORTED") {
    if (value === null || value === undefined || value === "") return unavailable();
    return { availability: "AVAILABLE", value, source: source || "UNKNOWN_SOURCE", reliability };
  }

  function normalizeReading(reading, fallbackReason) {
    if (!reading || reading.availability !== "AVAILABLE") return unavailable(reading && reading.reason || fallbackReason);
    if (reading.value === null || reading.value === undefined || reading.value === "") return unavailable(fallbackReason);
    return {
      availability: "AVAILABLE",
      value: reading.value,
      source: reading.source || "UNKNOWN_SOURCE",
      reliability: reading.reliability || "REPORTED"
    };
  }

  function normalizePosition(position) {
    const latitude = normalizeReading(position && position.latitude, "GPS_NOT_AVAILABLE");
    const longitude = normalizeReading(position && position.longitude, "GPS_NOT_AVAILABLE");
    const available = latitude.availability === "AVAILABLE" && longitude.availability === "AVAILABLE";
    return {
      availability: available ? "AVAILABLE" : "UNAVAILABLE",
      latitude,
      longitude,
      accuracy_m: normalizeReading(position && position.accuracy_m, "GPS_ACCURACY_NOT_AVAILABLE")
    };
  }

  function normalizeOrientation(orientation) {
    const heading = normalizeReading(orientation && orientation.heading_deg, "HEADING_NOT_AVAILABLE");
    const pitch = normalizeReading(orientation && orientation.pitch_deg, "PITCH_NOT_AVAILABLE");
    const roll = normalizeReading(orientation && orientation.roll_deg, "ROLL_NOT_AVAILABLE");
    const any = [heading, pitch, roll].some((reading) => reading.availability === "AVAILABLE");
    return { availability: any ? "PARTIAL_OR_AVAILABLE" : "UNAVAILABLE", heading_deg: heading, pitch_deg: pitch, roll_deg: roll };
  }

  function normalizeCamera(camera) {
    const result = {
      camera_identifier: normalizeReading(camera && camera.camera_identifier, "CAMERA_IDENTIFIER_NOT_EXPOSED_BY_BROWSER"),
      lens_identifier: normalizeReading(camera && camera.lens_identifier, "LENS_IDENTIFIER_NOT_EXPOSED_BY_BROWSER"),
      zoom_ratio: normalizeReading(camera && camera.zoom_ratio, "ZOOM_NOT_EXPOSED_BY_BROWSER"),
      focal_length_35mm_equivalent: normalizeReading(camera && camera.focal_length_35mm_equivalent, "FOCAL_LENGTH_NOT_EXPOSED_BY_BROWSER"),
      operator_camera_height: normalizeReading(camera && camera.operator_camera_height, "CAMERA_HEIGHT_NOT_ENTERED")
    };
    result.availability = Object.values(result).some((reading) => reading && reading.availability === "AVAILABLE") ? "PARTIAL_OR_AVAILABLE" : "UNAVAILABLE";
    return result;
  }

  function createCapture(input, idFactory = defaultId) {
    if (!input || typeof input !== "object") throw new Error("Capture input is required.");
    if (!input.property_id) throw new Error("property_id is required.");
    if (!input.photo_point_id) throw new Error("photo_point_id is required.");
    const purpose = String(input.capture_purpose || "").toUpperCase();
    if (!PURPOSES.has(purpose)) throw new Error("capture_purpose must be BEFORE, WORK, AFTER, or MONITORING.");
    if (!input.image || !input.image.blob_id || !input.image.sha256) throw new Error("Immutable image blob_id and sha256 are required.");
    const capture = {
      schema_name: "property-intelligence-photo-capture",
      schema_version: SCHEMA_VERSION,
      capture_id: input.capture_id || idFactory("CAPTURE"),
      property_id: input.property_id,
      photo_point_id: input.photo_point_id,
      capture_purpose: purpose,
      captured_at: input.captured_at || nowIso(),
      source_inspection_id: input.source_inspection_id || null,
      source_session_id: input.source_session_id || null,
      work_zone_ids: Array.isArray(input.work_zone_ids) ? [...new Set(input.work_zone_ids.filter(Boolean))] : [],
      target_description: input.target_description || "",
      notes: input.notes || "",
      image: {
        blob_id: input.image.blob_id,
        original_file_name: input.image.original_file_name || "UNKNOWN",
        mime_type: input.image.mime_type || "application/octet-stream",
        byte_size: Number.isFinite(input.image.byte_size) ? input.image.byte_size : null,
        sha256: input.image.sha256,
        source: input.image.source || "USER_CAPTURED",
        immutable: true
      },
      position: normalizePosition(input.position),
      orientation: normalizeOrientation(input.orientation),
      camera: normalizeCamera(input.camera),
      framing: {
        reference_capture_id: input.framing && input.framing.reference_capture_id || null,
        ghost_overlay_used: Boolean(input.framing && input.framing.ghost_overlay_used),
        operator_alignment_notes: input.framing && input.framing.operator_alignment_notes || "",
        exact_framing_verified: false,
        limitation: "Framing similarity is operator-assisted and not survey-grade or optically verified."
      },
      provenance: {
        information_class: "FIELD_EVIDENCE",
        created_by: input.provenance && input.provenance.created_by || "FIELD_OPERATOR",
        created_with: input.provenance && input.provenance.created_with || "REPEAT_PHOTO_POC",
        source_record_ids: input.provenance && Array.isArray(input.provenance.source_record_ids) ? [...input.provenance.source_record_ids] : [],
        source_path: input.provenance && input.provenance.source_path || null,
        captured_offline: Boolean(input.provenance && input.provenance.captured_offline),
        immutable: true
      },
      immutable: true
    };
    return deepFreeze(capture);
  }

  function createPhotoPoint(input, idFactory = defaultId) {
    if (!input || !input.property_id) throw new Error("property_id is required.");
    const photoPointId = input.photo_point_id || idFactory("PHOTO-POINT");
    const originalInput = { ...(input.original_capture || {}), property_id: input.property_id, photo_point_id: photoPointId };
    const original = createCapture(originalInput, idFactory);
    const record = {
      schema_name: SCHEMA_NAME,
      schema_version: SCHEMA_VERSION,
      property_id: input.property_id,
      photo_point_id: photoPointId,
      created_at: input.created_at || nowIso(),
      status: "ACTIVE",
      source_inspection_id: input.source_inspection_id || original.source_inspection_id || null,
      source_session_id: input.source_session_id || original.source_session_id || null,
      reference_capture_id: original.capture_id,
      target_description: input.target_description || original.target_description || "",
      notes: input.notes || "",
      work_zone_ids: Array.isArray(input.work_zone_ids) ? [...new Set(input.work_zone_ids.filter(Boolean))] : [...original.work_zone_ids],
      captures: [original],
      provenance: {
        entity_class: "PERMANENT_PROPERTY_RECORD",
        created_with: input.provenance && input.provenance.created_with || "REPEAT_PHOTO_POC",
        source: input.provenance && input.provenance.source || "FIELD_CAPTURE",
        immutable_capture_history: true
      }
    };
    assertValid(record);
    return deepFreeze(record);
  }

  function addRepeatCapture(photoPoint, captureInput, idFactory = defaultId) {
    assertValid(photoPoint);
    const before = clone(photoPoint);
    const repeat = createCapture({
      ...captureInput,
      property_id: photoPoint.property_id,
      photo_point_id: photoPoint.photo_point_id,
      framing: {
        ...(captureInput && captureInput.framing || {}),
        reference_capture_id: photoPoint.reference_capture_id
      }
    }, idFactory);
    if (photoPoint.captures.some((capture) => capture.capture_id === repeat.capture_id)) throw new Error("capture_id already exists; immutable captures cannot be overwritten.");
    const updated = { ...clone(photoPoint), captures: [...clone(photoPoint.captures), repeat] };
    if (JSON.stringify(updated.captures[0]) !== JSON.stringify(before.captures[0])) throw new Error("Original capture changed; update rejected.");
    assertValid(updated);
    return deepFreeze(updated);
  }

  function assertValid(photoPoint) {
    const errors = validate(photoPoint);
    if (errors.length) throw new Error(`Invalid photo point: ${errors.join("; ")}`);
    return true;
  }

  function validate(photoPoint) {
    const errors = [];
    if (!photoPoint || typeof photoPoint !== "object") return ["record must be an object"];
    if (photoPoint.schema_name !== SCHEMA_NAME) errors.push("schema_name is invalid");
    if (photoPoint.schema_version !== SCHEMA_VERSION) errors.push("schema_version is unsupported");
    if (!photoPoint.property_id) errors.push("property_id is required");
    if (!photoPoint.photo_point_id) errors.push("photo_point_id is required");
    if (!Array.isArray(photoPoint.captures) || !photoPoint.captures.length) errors.push("at least one capture is required");
    const ids = new Set();
    (photoPoint.captures || []).forEach((capture, index) => {
      if (!capture.capture_id) errors.push(`capture ${index} has no capture_id`);
      if (ids.has(capture.capture_id)) errors.push(`duplicate capture_id ${capture.capture_id}`);
      ids.add(capture.capture_id);
      if (capture.property_id !== photoPoint.property_id) errors.push(`capture ${index} property_id mismatch`);
      if (capture.photo_point_id !== photoPoint.photo_point_id) errors.push(`capture ${index} photo_point_id mismatch`);
      if (!capture.image || capture.image.immutable !== true || !capture.image.sha256) errors.push(`capture ${index} immutable image metadata missing`);
      if (capture.immutable !== true) errors.push(`capture ${index} is not marked immutable`);
    });
    if (photoPoint.captures && photoPoint.captures[0] && photoPoint.reference_capture_id !== photoPoint.captures[0].capture_id) errors.push("reference_capture_id must identify the original capture");
    return errors;
  }

  function exportBundle(photoPoints, attachments = []) {
    const ids = new Set();
    const records = (photoPoints || []).map((point) => {
      assertValid(point);
      if (ids.has(point.photo_point_id)) throw new Error(`duplicate photo_point_id ${point.photo_point_id}`);
      ids.add(point.photo_point_id);
      return clone(point);
    });
    return {
      schema_name: EXPORT_SCHEMA,
      schema_version: SCHEMA_VERSION,
      exported_at: nowIso(),
      evidence_rule: "CAPTURES_ARE_IMMUTABLE; INTERPRETATION_AND_RESULT_CLAIMS_ARE_SEPARATE",
      photo_points: records,
      attachments: clone(attachments || [])
    };
  }

  function importBundle(bundle) {
    if (!bundle || bundle.schema_name !== EXPORT_SCHEMA || bundle.schema_version !== SCHEMA_VERSION) throw new Error("Unsupported or malformed photo-point export.");
    if (!Array.isArray(bundle.photo_points)) throw new Error("photo_points array is required.");
    const ids = new Set();
    const points = bundle.photo_points.map((point) => {
      assertValid(point);
      if (ids.has(point.photo_point_id)) throw new Error(`duplicate photo_point_id ${point.photo_point_id}`);
      ids.add(point.photo_point_id);
      return deepFreeze(clone(point));
    });
    return { photo_points: points, attachments: clone(bundle.attachments || []) };
  }

  function radians(degrees) { return degrees * Math.PI / 180; }
  function degrees(radiansValue) { return radiansValue * 180 / Math.PI; }

  function distanceMeters(a, b) {
    if (!a || !b || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return null;
    const earth = 6371008.8;
    const dLat = radians(b.latitude - a.latitude);
    const dLon = radians(b.longitude - a.longitude);
    const lat1 = radians(a.latitude); const lat2 = radians(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function bearingDegrees(a, b) {
    if (!a || !b || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return null;
    const lat1 = radians(a.latitude); const lat2 = radians(b.latitude); const dLon = radians(b.longitude - a.longitude);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (degrees(Math.atan2(y, x)) + 360) % 360;
  }

  function angularDifference(current, target) {
    if (!Number.isFinite(current) || !Number.isFinite(target)) return null;
    return ((target - current + 540) % 360) - 180;
  }

  function memoryRepository(snapshot) {
    let points = new Map((snapshot && snapshot.points || []).map((point) => [point.photo_point_id, clone(point)]));
    let drafts = new Map(Object.entries(snapshot && snapshot.drafts || {}));
    return {
      async putPoint(point) { assertValid(point); points.set(point.photo_point_id, clone(point)); },
      async getPoint(id) { return points.has(id) ? deepFreeze(clone(points.get(id))) : null; },
      async getAllPoints() { return [...points.values()].map((point) => deepFreeze(clone(point))); },
      async putDraft(key, value) { drafts.set(key, clone(value)); },
      async getDraft(key) { return drafts.has(key) ? clone(drafts.get(key)) : null; },
      snapshot() { return { points: [...points.values()].map(clone), drafts: Object.fromEntries([...drafts.entries()].map(([key, value]) => [key, clone(value)])) }; }
    };
  }

  return {
    SCHEMA_NAME, SCHEMA_VERSION, EXPORT_SCHEMA, PURPOSES,
    clone, deepFreeze, unavailable, measured, createCapture, createPhotoPoint, addRepeatCapture,
    validate, assertValid, exportBundle, importBundle, distanceMeters, bearingDegrees, angularDifference,
    memoryRepository
  };
});
