(function (root, factory) {
  "use strict";
  const coaching = typeof module === "object" && module.exports ? require("./inspection-coaching.js") : (root && root.InspectionCoaching);
  const water = typeof module === "object" && module.exports ? require("./water-intelligence.js") : (root && root.WaterIntelligence);
  const governance = typeof module === "object" && module.exports ? require("./evidence-governance.js") : (root && root.EvidenceGovernance);
  const evidenceSets = typeof module === "object" && module.exports ? require("./evidence-sets.js") : (root && root.EvidenceSets);
  const api = factory(coaching, water, governance, evidenceSets);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.InspectionPackage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (coachingTools, waterTools, governanceTools, evidenceSetTools) {
  "use strict";

  const FORMAT = "pearson-road-inspection-package";
  const FORMAT_VERSION = "1.9";
  const textEncoder = new TextEncoder();
  const crcTable = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }

  function crc32Update(crc, bytes) {
    let value = crc;
    for (let i = 0; i < bytes.length; i += 1) value = crcTable[(value ^ bytes[i]) & 0xff] ^ (value >>> 8);
    return value >>> 0;
  }

  function crc32(bytes) {
    return (crc32Update(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
  }

  async function crc32Blob(blob) {
    let value = 0xffffffff;
    if (blob.stream && typeof blob.stream === "function") {
      const reader = blob.stream().getReader();
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        value = crc32Update(value, result.value);
      }
    } else {
      value = crc32Update(value, new Uint8Array(await blob.arrayBuffer()));
    }
    return (value ^ 0xffffffff) >>> 0;
  }

  function asBlob(value, mimeType) {
    if (value instanceof Blob) return value;
    if (typeof value === "string") return new Blob([value], { type: mimeType || "text/plain;charset=utf-8" });
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return new Blob([value], { type: mimeType || "application/octet-stream" });
    throw new TypeError("ZIP entries must be strings, Blobs, ArrayBuffers, or typed arrays.");
  }

  function safeZipPath(name) {
    const path = String(name || "").replaceAll("\\", "/");
    if (!path || path.startsWith("/") || path.split("/").some(part => !part || part === "." || part === "..")) {
      throw new Error("Unsafe ZIP entry path: " + name);
    }
    return path;
  }

  function dosDateTime(value) {
    const date = value instanceof Date && !Number.isNaN(value.valueOf()) ? value : new Date();
    const year = Math.max(1980, Math.min(2107, date.getFullYear()));
    return {
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
    };
  }

  function writeU16(view, offset, value) {
    view.setUint16(offset, value, true);
  }

  function writeU32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function localHeader(nameBytes, size, checksum, stamp) {
    const bytes = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(bytes.buffer);
    writeU32(view, 0, 0x04034b50);
    writeU16(view, 4, 20);
    writeU16(view, 6, 0x0800);
    writeU16(view, 8, 0);
    writeU16(view, 10, stamp.time);
    writeU16(view, 12, stamp.date);
    writeU32(view, 14, checksum);
    writeU32(view, 18, size);
    writeU32(view, 22, size);
    writeU16(view, 26, nameBytes.length);
    writeU16(view, 28, 0);
    bytes.set(nameBytes, 30);
    return bytes;
  }

  function centralHeader(nameBytes, size, checksum, stamp, localOffset) {
    const bytes = new Uint8Array(46 + nameBytes.length);
    const view = new DataView(bytes.buffer);
    writeU32(view, 0, 0x02014b50);
    writeU16(view, 4, 20);
    writeU16(view, 6, 20);
    writeU16(view, 8, 0x0800);
    writeU16(view, 10, 0);
    writeU16(view, 12, stamp.time);
    writeU16(view, 14, stamp.date);
    writeU32(view, 16, checksum);
    writeU32(view, 20, size);
    writeU32(view, 24, size);
    writeU16(view, 28, nameBytes.length);
    writeU16(view, 30, 0);
    writeU16(view, 32, 0);
    writeU16(view, 34, 0);
    writeU16(view, 36, 0);
    writeU32(view, 38, 0);
    writeU32(view, 42, localOffset);
    bytes.set(nameBytes, 46);
    return bytes;
  }

  class ZipBuilder {
    constructor() {
      this.entries = [];
    }

    add(name, value, options) {
      const settings = options || {};
      this.entries.push({
        name: safeZipPath(name),
        blob: asBlob(value, settings.mimeType),
        modifiedAt: settings.modifiedAt instanceof Date ? settings.modifiedAt : new Date()
      });
      return this;
    }

    async build() {
      if (this.entries.length > 0xffff) throw new Error("ZIP contains too many files for ZIP32.");
      const parts = [];
      const centralParts = [];
      let offset = 0;

      for (const entry of this.entries) {
        const size = entry.blob.size;
        if (size > 0xffffffff || offset > 0xffffffff) throw new Error("Inspection package exceeds the ZIP32 size limit.");
        const nameBytes = textEncoder.encode(entry.name);
        if (nameBytes.length > 0xffff) throw new Error("ZIP entry name is too long: " + entry.name);
        const checksum = await crc32Blob(entry.blob);
        const stamp = dosDateTime(entry.modifiedAt);
        const header = localHeader(nameBytes, size, checksum, stamp);
        parts.push(header, entry.blob);
        centralParts.push(centralHeader(nameBytes, size, checksum, stamp, offset));
        offset += header.length + size;
      }

      const centralOffset = offset;
      const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
      if (centralOffset > 0xffffffff || centralSize > 0xffffffff) throw new Error("Inspection package exceeds the ZIP32 size limit.");
      parts.push(...centralParts);

      const end = new Uint8Array(22);
      const view = new DataView(end.buffer);
      writeU32(view, 0, 0x06054b50);
      writeU16(view, 4, 0);
      writeU16(view, 6, 0);
      writeU16(view, 8, this.entries.length);
      writeU16(view, 10, this.entries.length);
      writeU32(view, 12, centralSize);
      writeU32(view, 16, centralOffset);
      writeU16(view, 20, 0);
      parts.push(end);
      return new Blob(parts, { type: "application/zip" });
    }
  }

  const orientationLabels = {
    1: "normal",
    2: "mirrored horizontally",
    3: "rotated 180 degrees",
    4: "mirrored vertically",
    5: "mirrored horizontally and rotated 270 degrees clockwise",
    6: "rotated 90 degrees clockwise",
    7: "mirrored horizontally and rotated 90 degrees clockwise",
    8: "rotated 270 degrees clockwise"
  };

  function orientationDescription(value) {
    return orientationLabels[value] || null;
  }

  function parseExifOrientation(buffer) {
    try {
      const view = new DataView(buffer);
      if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;
      let offset = 2;
      while (offset + 4 <= view.byteLength) {
        if (view.getUint8(offset) !== 0xff) break;
        const marker = view.getUint8(offset + 1);
        offset += 2;
        if (marker === 0xd8 || marker === 0x01) continue;
        if (marker === 0xd9 || marker === 0xda) break;
        if (offset + 2 > view.byteLength) break;
        const length = view.getUint16(offset, false);
        if (length < 2 || offset + length > view.byteLength) break;
        if (marker === 0xe1 && length >= 10 && view.getUint32(offset + 2, false) === 0x45786966 && view.getUint16(offset + 6, false) === 0) {
          const tiff = offset + 8;
          if (tiff + 8 > view.byteLength) return null;
          const byteOrder = view.getUint16(tiff, false);
          const little = byteOrder === 0x4949;
          if (!little && byteOrder !== 0x4d4d) return null;
          if (view.getUint16(tiff + 2, little) !== 42) return null;
          const ifd = tiff + view.getUint32(tiff + 4, little);
          if (ifd + 2 > view.byteLength) return null;
          const count = view.getUint16(ifd, little);
          for (let i = 0; i < count; i += 1) {
            const entry = ifd + 2 + (i * 12);
            if (entry + 12 > view.byteLength) return null;
            if (view.getUint16(entry, little) === 0x0112) {
              const type = view.getUint16(entry + 2, little);
              const itemCount = view.getUint32(entry + 4, little);
              if (type === 3 && itemCount >= 1) {
                const value = view.getUint16(entry + 8, little);
                return orientationLabels[value] ? value : null;
              }
            }
          }
          return null;
        }
        offset += length;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(dataUrl || ""));
    if (!match) throw new Error("Invalid legacy photo data URL.");
    const mime = match[1] || "application/octet-stream";
    if (match[2]) {
      const binary = atob(match[3]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(match[3])], { type: mime });
  }

  function extensionFor(filename, mimeType, fallback) {
    const match = /\.([a-zA-Z0-9]{1,10})$/.exec(String(filename || ""));
    if (match) return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
    const byMime = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/heic": "heic",
      "image/heif": "heif",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/tiff": "tif",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/aac": "aac",
      "audio/mpeg": "mp3",
      "audio/webm": "webm",
      "audio/wav": "wav"
    };
    return byMime[String(mimeType || "").toLowerCase()] || fallback || "bin";
  }

  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replaceAll('"', '""') + '"';
  }

  function createCsv(inspection, photos, voiceNotes) {
    const rows = [[
      "record_type", "time", "latitude", "longitude", "gps_accuracy_m", "altitude_m",
      "altitude_accuracy_m", "speed_mps", "heading_deg", "event_type", "button_label",
      "note", "photo_id", "photo_original_path", "photo_analysis_path", "voice_note_id",
      "voice_note_path", "device_alpha_deg", "device_beta_deg", "device_gamma_deg"
    ]];
    (inspection.points || []).forEach(point => rows.push([
      "track", point.time, point.lat, point.lon, point.accuracy_m, point.altitude_m,
      point.altitude_accuracy_m, point.speed_mps, point.heading_deg, "", "", "", "", "", "", "", "",
      point.device_orientation ? point.device_orientation.alpha_deg : "",
      point.device_orientation ? point.device_orientation.beta_deg : "",
      point.device_orientation ? point.device_orientation.gamma_deg : ""
    ]));
    (inspection.markers || []).forEach(event => {
      const photo = (photos || []).find(item => String(item.photo_id) === String(event.photo_id));
      const voice = (voiceNotes || []).find(item => String(item.voice_note_id) === String(event.voice_note_id));
      rows.push([
        "event", event.time, event.lat, event.lon, event.gps_accuracy_m, "", "", "", event.compass_heading_deg,
        event.type, event.button_label || event.type, event.note || "", event.photo_id || "",
        photo ? photo.original.path : "", photo && photo.analysis ? photo.analysis.path : "",
        event.voice_note_id || "", voice ? voice.audio.path : "",
        event.device_orientation ? event.device_orientation.alpha_deg : "",
        event.device_orientation ? event.device_orientation.beta_deg : "",
        event.device_orientation ? event.device_orientation.gamma_deg : ""
      ]);
    });
    (inspection.orientation_samples || []).forEach(sample => rows.push([
      "device_orientation", sample.time, sample.lat, sample.lon, sample.gps_accuracy_m, "", "", "",
      sample.compass_heading_deg, "", "", "", "", "", "", "", "",
      sample.alpha_deg, sample.beta_deg, sample.gamma_deg
    ]));
    (inspection.lifecycle_events || []).forEach(event => rows.push([
      "inspection_lifecycle", event.time, "", "", "", "", "", "", "",
      event.type, event.type, "", "", "", "", "", "", "", "", ""
    ]));
    return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function createPhotoCsv(photos) {
    const rows = [[
      "photo_number", "photo_id", "photo_value", "evidence_set_id", "area_id", "question_ids", "question_links", "observation_id", "associated_marker_id", "associated_observation_id", "gps_point_id", "direction_cardinal", "weather_record_id", "category", "note", "evidence_classification", "recorded_at", "source_file_last_modified_at", "latitude", "longitude",
      "gps_accuracy_m", "gps_position_at", "gps_position_age_ms", "original_path", "original_name",
      "original_mime_type", "original_size_bytes", "original_sha256", "analysis_path",
      "analysis_mime_type", "analysis_size_bytes", "analysis_sha256", "width_px", "height_px",
      "pixel_orientation", "exif_orientation", "exif_orientation_description",
      "device_screen_orientation", "device_screen_angle_deg", "compass_heading_deg",
      "sensor_alpha_deg", "sensor_beta_deg", "sensor_gamma_deg", "record_status", "correction_ids", "explanation_status", "explanation_voice_note_ids", "meaning_subject", "measurement_status", "represented_extent", "decision_importance", "evidence_roles", "water_confirmation", "water_type", "water_depth_band", "water_depth_exact_in", "water_measurement_basis", "water_width_ft", "water_length_ft", "water_behavior", "water_significance"
    ]];
    (photos || []).forEach(photo => rows.push([
      photo.photo_number, photo.photo_id, photo.photo_value, photo.evidence_set_id, photo.area_id, (photo.question_ids || []).join("|"), JSON.stringify(photo.question_links || []), photo.observation_id, photo.associated_marker_id, photo.associated_observation_id, photo.gps_point_id, photo.direction_faced && photo.direction_faced.cardinal, photo.weather && photo.weather.weather_record_id,
      photo.category, photo.note, photo.evidence_classification, photo.recorded_at, photo.source_file_last_modified_at,
      photo.location.latitude, photo.location.longitude, photo.location.gps_accuracy_m,
      photo.location.gps_position_at, photo.location.gps_position_age_ms,
      photo.original.path, photo.original.source_filename, photo.original.mime_type,
      photo.original.size_bytes, photo.original.sha256,
      photo.analysis ? photo.analysis.path : "", photo.analysis ? photo.analysis.mime_type : "",
      photo.analysis ? photo.analysis.size_bytes : "", photo.analysis ? photo.analysis.sha256 : "",
      photo.orientation.width_px, photo.orientation.height_px, photo.orientation.pixel_orientation,
      photo.orientation.exif_value, photo.orientation.exif_description,
      photo.orientation.device_screen_type, photo.orientation.device_screen_angle_deg,
      photo.compass_heading_deg,
      photo.orientation.sensor ? photo.orientation.sensor.alpha_deg : "",
      photo.orientation.sensor ? photo.orientation.sensor.beta_deg : "",
      photo.orientation.sensor ? photo.orientation.sensor.gamma_deg : "",
      photo.record_status, (photo.correction_ids || []).join("|"), photo.explanation_status,
      (photo.explanation_voice_note_ids || []).join("|"), photo.photo_meaning && photo.photo_meaning.subject,
      photo.photo_meaning && photo.photo_meaning.measurement_status, photo.photo_meaning && photo.photo_meaning.represented_extent,
      photo.photo_meaning && photo.photo_meaning.decision_importance, photo.photo_meaning && (photo.photo_meaning.evidence_roles || []).join("|"), photo.water_confirmation,
      photo.water && photo.water.water_type, photo.water && photo.water.water_depth_band, photo.water && photo.water.water_depth_exact_in,
      photo.water && photo.water.measurement_basis, photo.water && photo.water.water_width_ft, photo.water && photo.water.water_length_ft,
      photo.water && photo.water.water_behavior, photo.water && photo.water.significance
    ]));
    return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function createVoiceCsv(voiceNotes) {
    const rows = [[
      "voice_note_id", "evidence_set_id", "area_id", "question_ids", "question_links", "observation_id", "gps_point_id", "nearest_observation_ids", "started_at", "finished_at", "duration_ms", "latitude", "longitude",
      "gps_accuracy_m", "gps_position_at", "compass_heading_deg", "audio_path", "mime_type",
      "size_bytes", "sha256", "recovered_after_interruption", "sensor_alpha_deg",
      "sensor_beta_deg", "sensor_gamma_deg", "purpose", "photo_id", "prompt", "record_status", "correction_ids"
    ]];
    (voiceNotes || []).forEach(note => rows.push([
      note.voice_note_id, note.evidence_set_id, note.area_id, (note.question_ids || []).join("|"), JSON.stringify(note.question_links || []), note.observation_id, note.gps_point_id, (note.nearest_observations || []).map(item => item.observation_id).join("|"), note.started_at, note.finished_at, note.duration_ms,
      note.location.latitude, note.location.longitude, note.location.gps_accuracy_m,
      note.location.gps_position_at, note.compass_heading_deg, note.audio.path,
      note.audio.mime_type, note.audio.size_bytes, note.audio.sha256,
      note.recovered_after_interruption,
      note.device_orientation ? note.device_orientation.alpha_deg : "",
      note.device_orientation ? note.device_orientation.beta_deg : "",
      note.device_orientation ? note.device_orientation.gamma_deg : "",
      note.purpose, note.photo_id, note.prompt, note.record_status, (note.correction_ids || []).join("|")
    ]));
    return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function createGeoJSON(inspection, photos, voiceNotes) {
    const photoById = new Map((photos || []).map(photo => [String(photo.photo_id), photo]));
    const voiceById = new Map((voiceNotes || []).map(note => [String(note.voice_note_id), note]));
    const features = [];
    if ((inspection.points || []).length) {
      features.push({
        type: "Feature",
        properties: {
          record_type: "gps_track",
          name: "Pearson Road field track",
          started_at: inspection.started,
          finished_at: inspection.stopped,
          timestamps: inspection.points.map(point => point.time),
          gps_accuracy_m: inspection.points.map(point => point.accuracy_m),
          altitude_m: inspection.points.map(point => point.altitude_m),
          speed_mps: inspection.points.map(point => point.speed_mps),
          heading_deg: inspection.points.map(point => point.heading_deg)
        },
        geometry: { type: "LineString", coordinates: inspection.points.map(point => [point.lon, point.lat]) }
      });
    }
    (inspection.markers || []).forEach(event => {
      const photo = event.photo_id == null ? null : photoById.get(String(event.photo_id));
      const voice = event.voice_note_id == null ? null : voiceById.get(String(event.voice_note_id));
      features.push({
        type: "Feature",
        properties: {
          record_type: "field_event",
          event_type: event.type,
          button_label: event.button_label || event.type,
          evidence_classification: event.evidence_classification || "Observed",
          area_id: event.area_id || null,
          question_ids: Array.isArray(event.question_ids) ? event.question_ids : [],
          question_links: Array.isArray(event.question_links) ? event.question_links : [],
          attributes: event.attributes || {},
          note: event.note || "",
          time: event.time,
          gps_accuracy_m: event.gps_accuracy_m,
          compass_heading_deg: event.compass_heading_deg == null ? null : event.compass_heading_deg,
          device_orientation: event.device_orientation || null,
          photo_id: event.photo_id || null,
          photo_number: photo ? photo.photo_number : null,
          photo_category: photo ? photo.category : null,
          photo_value: photo ? photo.photo_value : null,
          photo_original_path: photo ? photo.original.path : null,
          photo_analysis_path: photo && photo.analysis ? photo.analysis.path : null,
          voice_note_id: event.voice_note_id || null,
          voice_note_path: voice ? voice.audio.path : null
        },
        geometry: { type: "Point", coordinates: [event.lon, event.lat] }
      });
    });
    return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
  }

  function xmlEscape(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
  }

  function createGpx(inspection, photos, voiceNotes) {
    const photoById = new Map((photos || []).map(photo => [String(photo.photo_id), photo]));
    const voiceById = new Map((voiceNotes || []).map(note => [String(note.voice_note_id), note]));
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<gpx version="1.1" creator="Pearson Road Field Tracker" xmlns="http://www.topografix.com/GPX/1/1" xmlns:inspection="https://livelikecharliechallenge.org/field/schema/1">\n';
    (inspection.markers || []).forEach(event => {
      const photo = event.photo_id == null ? null : photoById.get(String(event.photo_id));
      const voice = event.voice_note_id == null ? null : voiceById.get(String(event.voice_note_id));
      xml += `  <wpt lat="${event.lat}" lon="${event.lon}"><time>${xmlEscape(event.time)}</time><name>${xmlEscape((event.button_label || event.type).toUpperCase())}</name><desc>${xmlEscape(event.note || "")}</desc><extensions><inspection:gpsAccuracyMeters>${xmlEscape(event.gps_accuracy_m)}</inspection:gpsAccuracyMeters>`;
      if (event.compass_heading_deg != null) xml += `<inspection:compassHeadingDegrees>${xmlEscape(event.compass_heading_deg)}</inspection:compassHeadingDegrees>`;
      if (photo) xml += `<inspection:photoPath>${xmlEscape(photo.analysis ? photo.analysis.path : photo.original.path)}</inspection:photoPath>`;
      if (voice) xml += `<inspection:voiceNotePath>${xmlEscape(voice.audio.path)}</inspection:voiceNotePath>`;
      xml += '</extensions></wpt>\n';
    });
    xml += '  <trk><name>Pearson Road field track</name><trkseg>\n';
    (inspection.points || []).forEach(point => {
      xml += `    <trkpt lat="${point.lat}" lon="${point.lon}">`;
      if (point.altitude_m != null) xml += `<ele>${point.altitude_m}</ele>`;
      xml += `<time>${xmlEscape(point.time)}</time><extensions><inspection:gpsAccuracyMeters>${xmlEscape(point.accuracy_m)}</inspection:gpsAccuracyMeters>`;
      if (point.heading_deg != null) xml += `<inspection:compassHeadingDegrees>${xmlEscape(point.heading_deg)}</inspection:compassHeadingDegrees>`;
      xml += `</extensions></trkpt>\n`;
    });
    xml += '  </trkseg></trk>\n</gpx>\n';
    return xml;
  }

  function cloneWithoutBinary(value) {
    return JSON.parse(JSON.stringify(value, (key, item) => key === "dataUrl" ? undefined : item));
  }

  function createParcelGeoJSON(parcels) {
    return {
      type: "FeatureCollection",
      name: "Inspection parcel context",
      crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
      features: (parcels.features || []).map(feature => ({
        type: "Feature",
        properties: cloneWithoutBinary(feature.attributes || {}),
        geometry: {
          type: "Polygon",
          coordinates: cloneWithoutBinary((feature.geometry && feature.geometry.rings) || [])
        }
      }))
    };
  }

  async function sha256Hex(blob) {
    const cryptoObject = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (!cryptoObject || !cryptoObject.subtle || typeof cryptoObject.subtle.digest !== "function") return null;
    try {
      const digest = await cryptoObject.subtle.digest("SHA-256", await blob.arrayBuffer());
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      return null;
    }
  }

  function packageTimestamp(value) {
    const date = new Date(value || Date.now());
    const safe = Number.isNaN(date.valueOf()) ? new Date() : date;
    const pad = number => String(number).padStart(2, "0");
    return `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}_${pad(safe.getHours())}${pad(safe.getMinutes())}${pad(safe.getSeconds())}_${String(safe.getMilliseconds()).padStart(3, "0")}`;
  }

  function safeRepositoryName(value, fallback) {
    const normalized = String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    const safe = normalized.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96);
    return safe || fallback;
  }

  function repositoryDate(inspection, exportedAt) {
    const conditionDate = inspection && inspection.conditions && inspection.conditions.inspection_date;
    const candidate = /^\d{4}-\d{2}-\d{2}$/.test(String(conditionDate || "")) ? String(conditionDate) : String((inspection && inspection.started) || exportedAt || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "Date_Unknown";
  }

  function createExportId(settings) {
    if (settings.exportId) return safeRepositoryName(settings.exportId, "export");
    const randomPart = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function" ? globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 12) : Math.random().toString(16).slice(2, 14);
    return safeRepositoryName(`export_${settings.packageMode}_${packageTimestamp(settings.exportedAt)}_${randomPart}`, "export");
  }

  function createRepositoryImportManifest(manifest, fileName) {
    const repository = manifest.repository;
    const exportId = repository.export_id;
    const versionPath = `versions/${exportId}`;
    return {
      schema_name: "property-intelligence-repository-import",
      schema_version: "1.0",
      created_at: manifest.exported_at,
      property_id: manifest.property_id,
      inspection_id: manifest.inspection_id,
      export_id: exportId,
      repository_path: repository.inspection_path,
      artifact: {
        role: manifest.package_mode,
        source_filename: fileName,
        repository_filename: `${manifest.package_mode === "full_evidence_archive" ? "FULL_ARCHIVE" : "AI_ANALYSIS_REPORT_PACKAGE"}_${exportId}.zip`,
        package_sha256: "COMPUTE_DURING_INGESTION",
        package_size_bytes: "COMPUTE_DURING_INGESTION"
      },
      identity: {
        property_folder: repository.property_folder,
        inspection_folder: repository.inspection_folder,
        merge_key: manifest.inspection_id,
        comparison_key: manifest.property_id
      },
      immutability: {
        append_only: true,
        collision_policy: "REJECT_IF_EXPORT_ID_OR_ARTIFACT_PATH_ALREADY_EXISTS",
        allow_overwrite: false,
        preserve_source_package: true,
        preserve_every_version: true
      },
      extraction: {
        canonical_record: { source: "inspection.json", destination: `${versionPath}/inspection.json` },
        repository_contract: { source: "repository-import.json", destination: `${versionPath}/repository-import.json` },
        observations: { source: "observations.csv", destination: `${versionPath}/observations.csv` },
        gps_geojson: { source: "track.geojson", destination: `maps/${exportId}/track.geojson` },
        gps_gpx: { source: "track.gpx", destination: `maps/${exportId}/track.gpx` },
        map_context: { source: "context/map-context.json", destination: `maps/${exportId}/map-context.json` },
        property_boundary: { source: "context/parcels.geojson", destination: `property_boundary/${exportId}/parcels.geojson` },
        property_boundary_source: { source: "context/parcels.arcgis.json", destination: `property_boundary/${exportId}/parcels.arcgis.json` },
        terrain: { source: "context/usgs-terrain.png", destination: "terrain/content-addressed/" },
        contours: { source: "context/usgs-contours-2ft.png", destination: "contours/content-addressed/" },
        photos: { source: "photos/*", destination: "photos/content-addressed/" },
        audit_photos: { source: "audit/photos/*", destination: "photos/audit/content-addressed/" },
        voice: { source: "voice-notes/*", destination: "voice/content-addressed/" },
        audit_voice: { source: "audit/voice-notes/*", destination: "voice/audit/content-addressed/" },
        weather: { source: "WEATHER_CONTEXT.json", destination: `weather/${exportId}/WEATHER_CONTEXT.json` },
        reconstruction: { source: "chatgpt-reconstruction.json", destination: `analysis/${exportId}/chatgpt-reconstruction.json` },
        comparison_record: { source: "repository-comparison.json", destination: `analysis/${exportId}/repository-comparison.json` },
        ai_readme: { source: "AI_README.md", destination: `analysis/${exportId}/AI_README.md` },
        ai_analysis: { source: "AI_ANALYSIS.json", destination: `analysis/${exportId}/AI_ANALYSIS.json` },
        decision_brief: { source: "DECISION_BRIEF.json", destination: `analysis/${exportId}/DECISION_BRIEF.json` },
        question_brief: { source: "QUESTION_BRIEF.json", destination: `analysis/${exportId}/QUESTION_BRIEF.json` },
        field_coaching: { source: "FIELD_COACHING.json", destination: `analysis/${exportId}/FIELD_COACHING.json` },
        field_evidence_review: { source: "FIELD_EVIDENCE_REVIEW.json", destination: `analysis/${exportId}/FIELD_EVIDENCE_REVIEW.json` },
        evidence_audit_history: { source: "EVIDENCE_AUDIT_HISTORY.json", destination: `analysis/${exportId}/EVIDENCE_AUDIT_HISTORY.json` },
        evidence_sets: { source: "EVIDENCE_SETS.json", destination: `analysis/${exportId}/EVIDENCE_SETS.json` },
        post_inspection_review: { source: "POST_INSPECTION_REVIEW.json", destination: `analysis/${exportId}/POST_INSPECTION_REVIEW.json` },
        chat_review_return_instructions: { source: "CHAT_REVIEW_RETURN_INSTRUCTIONS.md", destination: `analysis/${exportId}/CHAT_REVIEW_RETURN_INSTRUCTIONS.md` },
        review_annotation_schema: { source: "schemas/property-intelligence-review-annotation.schema.json", destination: `analysis/${exportId}/schemas/property-intelligence-review-annotation.schema.json` },
        professional_handoff_cards: { source: "PROFESSIONAL_HANDOFF_CARDS.json", destination: `analysis/${exportId}/PROFESSIONAL_HANDOFF_CARDS.json` },
        professional_handoff_cards_markdown: { source: "PROFESSIONAL_HANDOFF_CARDS.md", destination: `analysis/${exportId}/PROFESSIONAL_HANDOFF_CARDS.md` },
        professional_handoff_printable: { source: "professional-handoff-cards.html", destination: `analysis/${exportId}/professional-handoff-cards.html` },
        return_visit_plan: { source: "RETURN_VISIT_PLAN.json", destination: `analysis/${exportId}/RETURN_VISIT_PLAN.json` },
        small_tract_water_map: { source: "SMALL_TRACT_WATER_MAP.json", destination: `maps/${exportId}/SMALL_TRACT_WATER_MAP.json` },
        small_tract_water_map_interactive: { source: "small-tract-water-map.html", destination: `maps/${exportId}/small-tract-water-map.html` },
        report_template: { source: "REPORT_TEMPLATE.md", destination: `analysis/${exportId}/REPORT_TEMPLATE.md` },
        inspector_thoughts: { source: "INSPECTOR_THOUGHTS.md", destination: `analysis/${exportId}/INSPECTOR_THOUGHTS.md` },
        inspector_hypotheses: { source: "INSPECTOR_HYPOTHESES.md", destination: `analysis/${exportId}/INSPECTOR_HYPOTHESES.md` },
        evidence_relationships: { source: "EVIDENCE_RELATIONSHIPS.json", destination: `analysis/${exportId}/EVIDENCE_RELATIONSHIPS.json` },
        suggested_questions: { source: "SUGGESTED_INSPECTION_QUESTIONS.md", destination: `analysis/${exportId}/SUGGESTED_INSPECTION_QUESTIONS.md` },
        printable_html: { source: "printable-report.html", destination: `analysis/${exportId}/printable-report.html` }
      },
      derived_artifacts: {
        printable_pdf: { destination: `analysis/${exportId}/printable_report.pdf`, status: "GENERATE_IN_REPOSITORY_FROM_PRINTABLE_HTML" },
        chatgpt_analysis: { destination: `analysis/${exportId}/`, status: "GENERATE_AFTER_INGESTION" }
      },
      responsibilities: {
        phone: "Collect and package complete immutable field evidence.",
        repository: "Store every source package and extracted revision permanently without overwriting.",
        chatgpt: "Analyze repository records, compare inspections, and create derived reports without modifying source evidence."
      },
      future_comparison_dimensions: ["standing_water", "tree_growth", "construction_progress", "property_improvements", "recurring_observations"]
    };
  }

  function createRepositoryComparisonRecord(manifest) {
    const observations = manifest.inspection.observations || [];
    const counts = {};
    observations.forEach(observation => {
      const key = observation.observation_type || "field.unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return {
      schema_name: "property-intelligence-comparison-record",
      schema_version: "1.0",
      property_id: manifest.property_id,
      inspection_id: manifest.inspection_id,
      export_id: manifest.repository.export_id,
      inspected_at: manifest.inspection.started_at,
      finished_at: manifest.inspection.finished_at,
      conditions: manifest.inspection.conditions,
      weather_context: manifest.inspection.weather_context || {},
      metrics: manifest.inspection.metrics,
      observation_counts_by_type: counts,
      recurring_observations: observations.map(observation => ({
        observation_id: observation.observation_id,
        observation_type: observation.observation_type,
        observed_at: observation.observed_at,
        geometry: observation.geometry,
        evidence_classification: observation.evidence_classification,
        area_id: observation.area_id,
        question_ids: observation.question_ids,
        question_links: observation.question_links,
        attributes: observation.attributes,
        decision_relevance: observation.decision_relevance,
        attachments: observation.attachments
      })),
      inspector_thoughts: (manifest.inspection.inspector_thoughts || []).map(thought => ({
        thought_id: thought.thought_id,
        thought_at: thought.thought_at,
        text: thought.text,
        geometry: thought.geometry,
        gps_point_id: thought.gps_point_id,
        factual_status: thought.factual_status,
        future_validation_status: "NOT_YET_EVALUATED"
      })),
      inspector_hypotheses: manifest.inspection.inspector_hypotheses || [],
      evidence_corrections: manifest.inspection.corrections || [],
      evidence_counts: {
        photographs: manifest.summary.photo_count,
        voice_notes: manifest.summary.voice_note_count,
        gps_points: manifest.summary.gps_track_point_count,
        inspector_thoughts: manifest.summary.inspector_thought_count,
        inspector_hypotheses: manifest.summary.inspector_hypothesis_count,
        corrections: manifest.summary.correction_count,
        investigation_questions: manifest.summary.investigation_question_count,
        inspection_areas: manifest.summary.inspection_area_count
      },
      inspection_areas: manifest.inspection.inspection_areas,
      investigation_questions: manifest.inspection.investigation_questions,
      coverage_estimate: manifest.inspection.field_coaching && manifest.inspection.field_coaching.coverage,
      comparison_rule: "Compare records by property_id across distinct inspection_id values. Preserve evidence classifications and never treat an unrecorded observation as proof of absence."
    };
  }

  function estimateInspectionPackageSizes(options) {
    const settings = options || {};
    const inspection = settings.inspection || {};
    const photoEntries = Array.isArray(settings.photoEntries) ? settings.photoEntries : [];
    const voiceEntries = Array.isArray(settings.voiceEntries) ? settings.voiceEntries : [];
    const photos = Array.isArray(inspection.photos) ? inspection.photos : [];
    const blobSize = value => value && Number.isFinite(Number(value.size)) ? Number(value.size) : 0;
    const originalBytes = photos.reduce((sum, metadata, index) => sum + (blobSize(photoEntries[index] && photoEntries[index].originalBlob) || Number(metadata.original_size_bytes) || 0), 0);
    const analysisBytes = photos.reduce((sum, metadata, index) => sum + (blobSize(photoEntries[index] && photoEntries[index].analysisBlob) || Number(metadata.analysis_size_bytes) || 0), 0);
    const voiceBytes = voiceEntries.reduce((sum, entry, index) => sum + (blobSize(entry && entry.audioBlob) || Number((inspection.voice_notes || [])[index] && inspection.voice_notes[index].size_bytes) || 0), 0);
    const mapContext = settings.mapContext || {};
    const mapBytes = blobSize(mapContext.terrainBlob) + blobSize(mapContext.contourBlob) + String(mapContext.parcelsText || "").length;
    const structuredBytes = 8 * 1024 * 1024 +
      (Array.isArray(inspection.points) ? inspection.points.length * 500 : 0) +
      (Array.isArray(inspection.markers) ? inspection.markers.length * 1400 : 0) +
      (Array.isArray(inspection.orientation_samples) ? inspection.orientation_samples.length * 450 : 0) +
      photos.length * 5000;
    const reportBytes = Math.ceil((analysisBytes + voiceBytes + mapBytes + structuredBytes) * 1.03);
    const fullArchiveBytes = Math.ceil((reportBytes + originalBytes) * 1.01);
    return { reportBytes, fullArchiveBytes, originalBytes, analysisBytes, voiceBytes, mapBytes, structuredBytes };
  }

  function distanceMeters(a, b) {
    const radius = 6371000;
    const radians = Math.PI / 180;
    const deltaLat = (Number(b.lat) - Number(a.lat)) * radians;
    const deltaLon = (Number(b.lon) - Number(a.lon)) * radians;
    const lat1 = Number(a.lat) * radians;
    const lat2 = Number(b.lat) * radians;
    const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(Math.max(0, h)));
  }

  function timeDifferenceMs(a, b) {
    const first = new Date(a || NaN).valueOf();
    const second = new Date(b || NaN).valueOf();
    return Number.isFinite(first) && Number.isFinite(second) ? Math.abs(first - second) : null;
  }

  function cardinalDirection(heading) {
    if (!Number.isFinite(Number(heading))) return null;
    const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return labels[Math.round((((Number(heading) % 360) + 360) % 360) / 45) % 8];
  }

  function normalizedGpsTrack(points) {
    return (points || []).map((point, index) => Object.assign({}, point, {
      gps_point_id: point.gps_point_id || `gps-${String(point.sequence || index + 1).padStart(6, "0")}`,
      sequence: point.sequence || index + 1
    }));
  }

  function nearestGpsReference(target, gpsTrack) {
    if (!target || !gpsTrack.length) return null;
    let candidates = gpsTrack;
    if (target.gps_position_at) {
      const exact = gpsTrack.filter(point => point.time === target.gps_position_at);
      if (exact.length) candidates = exact;
    }
    const ranked = candidates.map(point => ({
      point,
      time_delta_ms: timeDifferenceMs(target.time || target.recorded_at || target.started_at, point.time),
      distance_m: Number.isFinite(Number(target.lat)) && Number.isFinite(Number(target.lon)) ? distanceMeters(target, point) : null
    })).sort((left, right) => {
      const leftTime = left.time_delta_ms == null ? Number.POSITIVE_INFINITY : left.time_delta_ms;
      const rightTime = right.time_delta_ms == null ? Number.POSITIVE_INFINITY : right.time_delta_ms;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return (left.distance_m == null ? Number.POSITIVE_INFINITY : left.distance_m) - (right.distance_m == null ? Number.POSITIVE_INFINITY : right.distance_m);
    });
    const best = ranked[0];
    return best ? {
      gps_point_id: best.point.gps_point_id,
      sequence: best.point.sequence,
      recorded_at: best.point.time,
      time_delta_ms: best.time_delta_ms,
      distance_m: best.distance_m,
      path: `AI_ANALYSIS.json > gps_track[${Math.max(0, best.point.sequence - 1)}]`
    } : null;
  }

  function nearestEvidence(target, items, options) {
    const settings = options || {};
    const targetId = String(settings.targetId || "");
    const directIds = new Set((settings.directIds || []).filter(Boolean).map(String));
    return (items || []).map(item => {
      const itemId = String(item[settings.idField] || "");
      const direct = directIds.has(itemId) || (settings.linkField && String(item[settings.linkField] || "") === targetId);
      const location = item.location || item;
      return {
        item,
        itemId,
        direct,
        distance_m: Number.isFinite(Number(target.lat)) && Number.isFinite(Number(target.lon)) && Number.isFinite(Number(location.latitude == null ? location.lat : location.latitude)) && Number.isFinite(Number(location.longitude == null ? location.lon : location.longitude)) ? distanceMeters(target, { lat: location.latitude == null ? location.lat : location.latitude, lon: location.longitude == null ? location.lon : location.longitude }) : null,
        time_delta_ms: timeDifferenceMs(target.time || target.observed_at || target.recorded_at || target.started_at, item.recorded_at || item.started_at || item.time)
      };
    }).sort((left, right) => {
      if (left.direct !== right.direct) return left.direct ? -1 : 1;
      const leftDistance = left.distance_m == null ? Number.POSITIVE_INFINITY : left.distance_m;
      const rightDistance = right.distance_m == null ? Number.POSITIVE_INFINITY : right.distance_m;
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      return (left.time_delta_ms == null ? Number.POSITIVE_INFINITY : left.time_delta_ms) - (right.time_delta_ms == null ? Number.POSITIVE_INFINITY : right.time_delta_ms);
    }).slice(0, settings.limit || 3);
  }

  function calculateInspectionMetrics(inspection, liveEndTime) {
    const points = Array.isArray(inspection && inspection.points) ? inspection.points : [];
    const started = new Date(inspection && inspection.started ? inspection.started : NaN);
    const finished = new Date((inspection && inspection.stopped) || liveEndTime || NaN);
    const elapsed = Number.isNaN(started.valueOf()) || Number.isNaN(finished.valueOf()) ? 0 : Math.max(0, finished - started);
    let active = 0;
    let distance = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const segmentDistance = distanceMeters(previous, point);
      if (Number.isFinite(segmentDistance)) distance += segmentDistance;
      const delta = Math.max(0, new Date(point.time) - new Date(previous.time));
      if (!delta || delta > 120000) continue;
      const calculatedSpeed = segmentDistance / (delta / 1000);
      const reportedSpeed = Number(point.speed_mps);
      if ((Number.isFinite(reportedSpeed) && reportedSpeed >= 0.45) || calculatedSpeed >= 0.45) active += delta;
    }
    active = Math.min(active, elapsed || active);
    return {
      elapsed_time_ms: elapsed,
      active_movement_time_ms: active,
      stopped_time_ms: Math.max(0, elapsed - active),
      distance_walked_m: distance,
      distance_walked_miles: distance / 1609.344,
      gps_point_count: points.length,
      photograph_count: Array.isArray(inspection && inspection.photos) ? inspection.photos.length : 0,
      observation_count: Array.isArray(inspection && inspection.markers) ? inspection.markers.length : 0
    };
  }

  function createObservationsCsv(observations) {
    const rows = [[
      "observation_id", "inspection_id", "property_id", "area_id", "question_ids", "question_links", "gps_point_id", "decision_ids", "decision_candidate_effects", "nearest_photo_ids", "nearest_voice_note_ids", "observed_at", "observation_type", "label",
      "evidence_classification", "latitude", "longitude", "gps_accuracy_m", "compass_heading_deg",
      "note", "attributes_json", "photo_id", "voice_note_id"
    ]];
    (observations || []).forEach(item => rows.push([
      item.observation_id, item.inspection_id, item.property_id, item.area_id, (item.question_ids || []).join("|"), JSON.stringify(item.question_links || []), item.gps_point_id, (item.decision_relevance || []).map(link => link.decision_id).join("|"), (item.decision_relevance || []).map(link => `${link.decision_id}:${link.candidate_effect}`).join("|"), (item.attachments.nearest_photographs || []).map(photo => photo.photo_id).join("|"), (item.attachments.nearest_voice_notes || []).map(voice => voice.voice_note_id).join("|"), item.observed_at, item.observation_type,
      item.label, item.evidence_classification, item.gps.latitude, item.gps.longitude, item.gps.accuracy_m,
      item.compass_heading_deg, item.note, JSON.stringify(item.attributes || {}),
      item.attachments.photo_id, item.attachments.voice_note_id
    ]));
    return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function htmlEscape(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  function formatReportDuration(milliseconds) {
    if (milliseconds > 0 && milliseconds < 60000) return "<1 min";
    const totalMinutes = Math.max(0, Math.floor((milliseconds || 0) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
  }

  function reportProjection(lon, lat) {
    return {
      x: (Number(lon) + 87.1) / 0.017 * 1800,
      y: 1500 - ((Number(lat) - 30.4825) / 0.0145 * 1500)
    };
  }

  function reportPath(coordinates) {
    return (coordinates || []).map((point, index) => {
      const projected = reportProjection(point[0], point[1]);
      return `${index ? "L" : "M"}${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
    }).join(" ") + " Z";
  }

  function markerGroup(type) {
    if (["wet", "ditch", "culvert"].includes(type)) return "water";
    if (["dry", "high", "homesite", "open"].includes(type)) return "dry";
    if (["blocked", "thick", "entrance", "hazard"].includes(type)) return "access";
    if (["tree", "timber"].includes(type)) return "trees";
    if (type === "photo") return "photos";
    return "other";
  }

  function detailRegions(observations) {
    const points = (observations || []).map((item, index) => Object.assign({ index }, reportProjection(item.gps.longitude, item.gps.latitude)));
    const visited = new Set();
    const regions = [];
    points.forEach(point => {
      if (visited.has(point.index)) return;
      const queue = [point];
      const cluster = [];
      visited.add(point.index);
      while (queue.length) {
        const current = queue.shift();
        cluster.push(current);
        points.forEach(candidate => {
          if (visited.has(candidate.index)) return;
          if (Math.hypot(candidate.x - current.x, candidate.y - current.y) <= 190) {
            visited.add(candidate.index);
            queue.push(candidate);
          }
        });
      }
      if (cluster.length < 3) return;
      const minX = Math.max(0, Math.min(...cluster.map(item => item.x)) - 170);
      const minY = Math.max(0, Math.min(...cluster.map(item => item.y)) - 170);
      const maxX = Math.min(1800, Math.max(...cluster.map(item => item.x)) + 170);
      const maxY = Math.min(1500, Math.max(...cluster.map(item => item.y)) + 170);
      regions.push({ minX, minY, width: Math.max(350, maxX - minX), height: Math.max(300, maxY - minY), count: cluster.length });
    });
    return regions.sort((a, b) => b.count - a.count).slice(0, 6);
  }

  function createReportMapSvg(options) {
    const settings = options || {};
    const manifest = settings.manifest;
    const parcels = settings.parcels;
    const observations = manifest.inspection.observations || [];
    const acceptedGroups = settings.groups || null;
    let selected = acceptedGroups ? observations.filter(item => acceptedGroups.includes(markerGroup(String(item.observation_type || "").replace(/^field\./, "")))) : observations;
    const view = settings.view || { minX: 0, minY: 0, width: 1800, height: 1500 };
    const parcelPaths = (parcels.features || []).flatMap(feature => {
      const subject = String((feature.attributes || {}).PAR_NUM || "") === String(manifest.property.parcel_number);
      return ((feature.geometry || {}).rings || []).map(ring => `<path d="${reportPath(ring)}" fill="${subject ? "rgba(255,255,255,.05)" : "none"}" stroke="${subject ? "#e30000" : "#fff"}" stroke-width="${subject ? 10 : 3}" vector-effect="non-scaling-stroke"/>`);
    }).join("");
    const rawTrack = manifest.inspection.gps_track || [];
    const displayStride = Math.max(1, Math.ceil(rawTrack.length / 1500));
    const displayTrack = rawTrack.filter((point, index) => index % displayStride === 0 || index === rawTrack.length - 1);
    const track = displayTrack.map((point, index) => {
      const projected = reportProjection(point.lon, point.lat);
      return `${index ? "L" : "M"}${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
    }).join(" ");
    const photoIndex = new Map((manifest.photographs || []).map(photo => [String(photo.photo_id), photo]));
    const evidenceSets = manifest.inspection.evidence_set_summaries && manifest.inspection.evidence_set_summaries.sets || [];
    const setByPhotoId = new Map();
    evidenceSets.forEach(set => (set.photographs || []).forEach((photo, index) => setByPhotoId.set(String(photo.photo_id), { set, index })));
    if (acceptedGroups && acceptedGroups.length === 1 && acceptedGroups[0] === "photos") selected = selected.filter(item => {
      const relationship = item.attachments && item.attachments.photo_id ? setByPhotoId.get(String(item.attachments.photo_id)) : null;
      return !relationship || relationship.index === 0;
    });
    const markerSvg = selected.map((item, index) => {
      const projected = reportProjection(item.gps.longitude, item.gps.latitude);
      const type = String(item.observation_type || "").replace(/^field\./, "");
      const photo = item.attachments && item.attachments.photo_id ? photoIndex.get(String(item.attachments.photo_id)) : null;
      const setRelationship = photo ? setByPhotoId.get(String(photo.photo_id)) : null;
      const label = setRelationship ? `G${evidenceSets.indexOf(setRelationship.set) + 1}` : (photo ? photo.photo_number : String((manifest.inspection.observations || []).indexOf(item) + 1));
      const fill = { water: "#1768c4", dry: "#8b6a12", access: "#c92727", trees: "#2c6d1a", photos: "#67379a" }[markerGroup(type)] || "#555";
      const title = setRelationship ? `${setRelationship.set.label}: ${setRelationship.set.photograph_count} photographs. Expand the Evidence Sets section for individual locations.` : `${item.label} ${item.note || ""}`;
      return `<g class="${photo ? `photo-marker${setRelationship ? " evidence-set-marker" : ""}` : "map-marker"}"${photo ? ` data-photo-id="${htmlEscape(photo.photo_number)}" tabindex="0"` : ""}><circle cx="${projected.x}" cy="${projected.y}" r="22" fill="${fill}" stroke="#fff" stroke-width="5" vector-effect="non-scaling-stroke"/><text x="${projected.x}" y="${projected.y + 7}" text-anchor="middle" fill="#fff" stroke="#111" stroke-width="2" paint-order="stroke" font-size="18" font-weight="900">${htmlEscape(label)}</text><title>${htmlEscape(title)}</title></g>`;
    }).join("");
    const zones = (settings.zones || []).map((zone, index) => `<g><rect x="${zone.minX}" y="${zone.minY}" width="${zone.width}" height="${zone.height}" fill="none" stroke="#ffea00" stroke-width="8" stroke-dasharray="24 12"/><circle cx="${zone.minX + 35}" cy="${zone.minY + 35}" r="30" fill="#111"/><text x="${zone.minX + 35}" y="${zone.minY + 45}" text-anchor="middle" fill="#fff" font-size="30" font-weight="900">${index + 1}</text></g>`).join("");
    const baseImage = settings.terrainDataUrl ? `<use href="#reportTerrainRaster" x="0" y="0" width="1800" height="1500"/>` : `<rect width="1800" height="1500" fill="#d8d1bd"/>`;
    const contours = settings.contourDataUrl ? `<use href="#reportContourRaster" x="0" y="0" width="1800" height="1500" opacity=".8"/>` : "";
    return `<svg class="report-map" viewBox="${view.minX} ${view.minY} ${view.width} ${view.height}" role="img" aria-label="${htmlEscape(settings.title || "Inspection map")}" xmlns="http://www.w3.org/2000/svg">${baseImage}${contours}${parcelPaths}${track ? `<path d="${track}" fill="none" stroke="#111" stroke-width="13" vector-effect="non-scaling-stroke"/><path d="${track}" fill="none" stroke="#ffe600" stroke-width="7" vector-effect="non-scaling-stroke"/>` : ""}${markerSvg}${zones}<g transform="translate(${view.minX + 70} ${view.minY + 70})"><path d="M0 65 L28 0 L56 65 L28 50 Z" fill="#111"/><text x="28" y="-12" text-anchor="middle" font-size="34" font-weight="900">N</text></g><g transform="translate(${view.minX + 90} ${view.minY + view.height - 75})"><path d="M0 0 H336" stroke="#111" stroke-width="12"/><path d="M0 -16 V16 M336 -16 V16" stroke="#111" stroke-width="8"/><text x="168" y="-20" text-anchor="middle" font-size="28" font-weight="900">about 1,000 ft</text></g></svg>`;
  }

  async function createPrintableReport(manifest, parcels, mapContext, photoEntries) {
    const terrainDataUrl = mapContext.terrainBlob instanceof Blob && mapContext.terrainBlob.size ? manifest.map_context.layers.terrain.path : null;
    const contourDataUrl = mapContext.contourBlob instanceof Blob && mapContext.contourBlob.size ? manifest.map_context.layers.contours.path : null;
    const photoDataUrls = (manifest.photographs || []).map(photo => photo.analysis.path);
    const metrics = manifest.inspection.metrics;
    const conditions = manifest.inspection.conditions || {};
    const weatherContext = manifest.inspection.weather_context || {};
    const zones = detailRegions(manifest.inspection.observations);
    const decisionBrief = createDecisionBrief(manifest);
    const decisionRows = decisionBrief.decisions.map(decision => `<tr><th>${htmlEscape(decision.question)}</th><td>${decision.evidence_observation_ids.length}</td><td>${decision.possible_strength_observation_ids.length}</td><td>${decision.possible_weakness_observation_ids.length}</td><td>Analyze linked evidence; state material unknowns and explained 0-100 confidence.</td></tr>`).join("");
    const decisionPage = `<section class="page portrait"><h1>Decision Brief</h1><p>This field evidence is organized to answer five decisions. Counts route evidence for analysis; they are not conclusions and do not establish feasibility, value, or cost.</p><table><thead><tr><th>Decision</th><th>Relevant observations</th><th>Possible strengths</th><th>Possible weaknesses</th><th>Required analysis</th></tr></thead><tbody>${decisionRows}</tbody></table><h2>Required decision output</h2><p>For each decision: answer directly, cite material evidence, identify strengths and weaknesses, state material unknowns, explain confidence, and name the lowest-cost credible investigation. Every next step must state what uncertainty it removes.</p><div class="disclaimer">A recorded condition is not automatically a strength or weakness. Review its location, note, photographs, voice notes, inspection conditions, map context, and intended use.</div></section>`;
    const coaching = manifest.inspection.field_coaching || {};
    const coverage = coaching.coverage || {};
    const efficiency = coaching.field_efficiency || {};
    const questionRows = (manifest.inspection.investigation_questions || []).map(question => {
      const brief = coaching.question_brief && (coaching.question_brief.questions || []).find(item => item.question_id === question.question_id);
      return `<tr><td>${htmlEscape(question.text)}</td><td>${htmlEscape(question.status)}</td><td>${htmlEscape((brief && brief.observation_ids || []).length)}</td><td>${htmlEscape((brief && brief.photo_ids || []).length)}</td><td>${htmlEscape(question.answer_summary || "Generate from evidence")}</td></tr>`;
    }).join("") || `<tr><td colspan="5">No inspector-created investigation questions were recorded.</td></tr>`;
    const areaRows = (manifest.inspection.inspection_areas || []).map(area => {
      const evidence = [...(manifest.inspection.observations || []), ...(manifest.photographs || []), ...(manifest.voice_notes || [])].filter(item => item.area_id === area.area_id).length;
      return `<tr><td>${htmlEscape(area.name)}</td><td>${htmlEscape(area.area_id)}</td><td>${evidence}</td></tr>`;
    }).join("");
    const coachingPage = `<section class="page portrait"><h1>Inspection Coaching</h1><h2>Coverage estimate</h2><div class="summary"><div><span>Well inspected</span><strong>${htmlEscape(coverage.well_inspected && coverage.well_inspected.percent)}%</strong></div><div><span>Lightly inspected</span><strong>${htmlEscape(coverage.lightly_inspected && coverage.lightly_inspected.percent)}%</strong></div><div><span>Not inspected</span><strong>${htmlEscape(coverage.not_inspected && coverage.not_inspected.percent)}%</strong></div><div><span>Time walking</span><strong>${formatReportDuration(efficiency.time_walking_ms)}</strong></div><div><span>Time documenting</span><strong>${formatReportDuration(efficiency.time_documenting_ms)}</strong></div><div><span>Questions remaining</span><strong>${htmlEscape(efficiency.questions_remaining)}</strong></div></div><p>${htmlEscape(coverage.method || "Coverage could not be estimated.")}</p><h2>Investigation questions</h2><table><thead><tr><th>Question</th><th>Inspector status</th><th>Observations</th><th>Photos</th><th>Field answer</th></tr></thead><tbody>${questionRows}</tbody></table><h2>Inspection areas</h2><table><thead><tr><th>Area</th><th>Area ID</th><th>Linked evidence</th></tr></thead><tbody>${areaRows}</tbody></table><div class="disclaimer">Never imply conclusions about acreage classified Not Inspected. Every score and recommendation must identify supporting observations, supporting photographs, contradicting evidence, remaining uncertainty, and the cheapest next investigation.</div></section>`;
    const rasterDefinitions = `<svg aria-hidden="true" width="0" height="0" style="position:absolute"><defs>${terrainDataUrl ? `<image id="reportTerrainRaster" href="${terrainDataUrl}" width="1800" height="1500" preserveAspectRatio="none"/>` : ""}${contourDataUrl ? `<image id="reportContourRaster" href="${contourDataUrl}" width="1800" height="1500" preserveAspectRatio="none"/>` : ""}</defs></svg>`;
    const mapPage = (title, groups, extra) => `<section class="page landscape${extra && extra.summary ? " route-page" : ""}"><h1>${htmlEscape(title)}</h1>${extra && extra.summary ? `<div class="route-summary"><strong>${htmlEscape(conditions.inspection_date || manifest.inspection.started_at || "Date not recorded")}</strong><span>${metrics.distance_walked_miles.toFixed(2)} miles walked</span><span>${formatReportDuration(metrics.elapsed_time_ms)} elapsed</span><span>${zones.length} numbered detail zone${zones.length === 1 ? "" : "s"}</span></div>` : ""}${createReportMapSvg({ manifest, parcels, groups, terrainDataUrl, contourDataUrl, zones: extra && extra.zones ? zones : [], view: extra && extra.view, title })}<p class="map-note">Numbered symbols match the observation and photograph records. Red line: subject parcel. Yellow/black line: walked route.</p></section>`;
    const mapPages = [
      coachingPage,
      mapPage("Complete Route", null, { zones: true, summary: true }),
      mapPage("Water and Drainage", ["water"]),
      mapPage("Dry Ground and Homesites", ["dry"]),
      mapPage("Access and Obstacles", ["access"]),
      mapPage("Trees and Timber", ["trees"]),
      mapPage("Photos", ["photos"])
    ].join("");
    const waterModel = manifest.small_tract_water_map || {};
    const waterPage = (title, mode, note) => `<section class="page landscape"><h1>${htmlEscape(title)}</h1>${smallWaterMapSvg(manifest, mode)}<p class="map-note">${htmlEscape(note)} Solid blue points are actual photographed water. Dashed or shaded boundaries are estimates. Gray acreage outside the inspected corridor remains unknown.</p><div class="disclaimer">${htmlEscape((waterModel.limitations || []).join(" "))}</div></section>`;
    const smallWaterPages = waterModel.status === "GENERATED" ? [
      waterPage("SMALL TRACT — OBSERVED WATER CONDITIONS", "overview", "Complete 5.49-acre small-tract overview with route, water, dry evidence, estimated extents, and preliminary avoidance areas."),
      waterPage("Small Tract — Water Evidence Only", "all", "Every confirmed or legacy Wet-linked water photograph within the exact small-tract boundary."),
      waterPage("Small Tract — Larger Pooled and Flowing Water", "significant", "Minor isolated depressions are de-emphasized; flowing and materially pooled evidence remains."),
      waterPage("Small Tract — Preliminary Building Avoidance", "avoidance", "This preliminary decision layer does not establish engineering, wetland, soil, septic, or permitting conclusions.")
    ].join("") : "";
    const waterDetailPages = waterModel.status === "GENERATED" ? (waterModel.water_area_clusters || []).filter(cluster => cluster.evidence_count > 1).map(cluster => `<section class="page landscape"><h1>${htmlEscape(cluster.water_area_id)} — Enlarged Water Detail</h1>${smallWaterMapSvg(manifest, "all", cluster)}<p class="map-note"><strong>${htmlEscape(cluster.classification)}</strong> · Supporting photographs: ${htmlEscape(cluster.supporting_photo_numbers.join(", "))} · Evidence count: ${htmlEscape(cluster.evidence_count)} · Confidence: ${htmlEscape(cluster.confidence)}.</p><div class="disclaimer">${htmlEscape(cluster.outline_basis)} Review the indexed photo pages and attached voice explanations before relying on this interpretation.</div></section>`).join("") : "";
    const setPhotoById = new Map((manifest.photographs || []).map(photo => [String(photo.photo_id), photo]));
    const evidenceSetPages = (manifest.inspection.evidence_set_summaries && manifest.inspection.evidence_set_summaries.sets || []).map(set => {
      const rows = (set.photographs || []).map(link => {
        const photo = setPhotoById.get(String(link.photo_id));
        return `<tr><td>${htmlEscape(link.photo_number || link.photo_id)}</td><td>${htmlEscape(link.role || "Unassigned")}</td><td>${htmlEscape(link.timestamp || "Unknown")}</td><td>${htmlEscape(link.latitude)}, ${htmlEscape(link.longitude)}</td><td>${photo && photo.analysis ? `<a href="#photo-${htmlEscape(photo.photo_number)}">Open actual photograph</a>` : "Photo unavailable"}</td></tr>`;
      }).join("");
      return `<section class="page portrait"><h1>${htmlEscape(set.label)}</h1><p><strong>One confirmed subject:</strong> ${htmlEscape(set.set_type)}. The ${htmlEscape(set.photograph_count)} photographs below are different views of this subject, not separate findings.</p>${set.tree_id ? `<p><strong>Permanent tree ID:</strong> ${htmlEscape(set.tree_id)}</p>` : ""}<table><thead><tr><th>Photo</th><th>Role</th><th>Time</th><th>Exact photo location</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table><h2>Subject details</h2><pre>${htmlEscape(JSON.stringify(set.subject_details || {}, null, 2))}</pre><p><strong>Maximum photo separation:</strong> ${set.maximum_photo_separation_m == null ? "Unknown" : `${htmlEscape(set.maximum_photo_separation_m)} m`}.</p><div class="disclaimer">Photograph points are observed evidence. Any outline connecting them is inferred and must remain visually distinct. Missing high-value views: ${htmlEscape((set.missing_high_value_views || []).join(", ") || "none identified")}.</div></section>`;
    }).join("");
    const reviewAnnotations = manifest.inspection.post_inspection_review && manifest.inspection.post_inspection_review.active_annotations || [];
    const reviewRows = reviewAnnotations.map(annotation => `<tr><td>${htmlEscape(annotation.annotation_id)}</td><td>${htmlEscape(annotation.record_type)}</td><td>${htmlEscape(annotation.statement)}</td><td>${htmlEscape((annotation.supporting_photo_ids || []).join(", ") || "None")}</td><td>${htmlEscape(annotation.approved_by || "Inspector")} · ${htmlEscape(annotation.approved_at || "Time not recorded")}</td></tr>`).join("") || `<tr><td colspan="5">No inspector-approved post-inspection annotations were active at export.</td></tr>`;
    const reviewPage = `<section class="page portrait"><h1>Inspector-Approved Post-Inspection Review</h1><p>These findings are a derived review layer. Original photographs, observations, voice notes, and GPS records remain unchanged.</p><table><thead><tr><th>ID</th><th>Type</th><th>Approved finding</th><th>Supporting photos</th><th>Approval</th></tr></thead><tbody>${reviewRows}</tbody></table><div class="disclaimer">Draft, Rejected, and Superseded annotations are audit-only and do not change current findings.</div></section>`;
    const detailPages = reviewPage + zones.map((zone, index) => mapPage(`Detail Zone ${index + 1} — ${zone.count} nearby observations`, null, { view: zone })).join("");
    const photoValueRank = { Critical: 0, Helpful: 1, Reference: 2, Duplicate: 3 };
    const photoPages = (manifest.photographs || []).map((photo, index) => ({ photo, index })).sort((left, right) => {
      const leftRank = photoValueRank[left.photo.photo_value] == null ? 1 : photoValueRank[left.photo.photo_value];
      const rightRank = photoValueRank[right.photo.photo_value] == null ? 1 : photoValueRank[right.photo.photo_value];
      return (leftRank - rightRank) || (left.index - right.index);
    }).map(({ photo, index }) => {
      const linked = (manifest.inspection.observations || []).find(item => String(item.attachments && item.attachments.photo_id) === String(photo.photo_id));
      const attributes = photo.observation_attributes || (linked ? linked.attributes : {}) || {};
      return `<section class="page portrait photo-page"><h1>${htmlEscape(photo.photo_number || `P${index + 1}`)} — ${htmlEscape(photo.category || "Other")}</h1><img loading="lazy" decoding="async" id="photo-${htmlEscape(photo.photo_number || `P${index + 1}`)}" src="${photoDataUrls[index] || ""}" alt="Inspection photograph ${htmlEscape(photo.photo_number || `P${index + 1}`)}"><dl><dt>Photo value</dt><dd>${htmlEscape(photo.photo_value || "Helpful")}</dd><dt>What it shows</dt><dd>${htmlEscape(photo.photo_meaning && photo.photo_meaning.subject || "Not explicitly entered")}</dd><dt>Measurement status</dt><dd>${htmlEscape(photo.photo_meaning && photo.photo_meaning.measurement_status || "Not entered")}</dd><dt>Area represented</dt><dd>${htmlEscape(photo.photo_meaning && photo.photo_meaning.represented_extent || "Not entered")}</dd><dt>Why it matters</dt><dd>${htmlEscape(photo.photo_meaning && photo.photo_meaning.decision_importance || "Not entered")}</dd><dt>Four-photo roles</dt><dd>${htmlEscape(photo.photo_meaning && (photo.photo_meaning.evidence_roles || []).join(", ") || "Not entered")}</dd><dt>Inspection area</dt><dd>${htmlEscape(photo.area_id || "Unassigned legacy evidence")}</dd><dt>Investigation questions</dt><dd>${htmlEscape((photo.question_ids || []).join(", ") || "None")}</dd><dt>Date and time</dt><dd>${htmlEscape(photo.recorded_at || "Not recorded")}</dd><dt>Coordinates</dt><dd>${htmlEscape(photo.location.latitude)}, ${htmlEscape(photo.location.longitude)} (±${htmlEscape(photo.location.gps_accuracy_m)} m)</dd><dt>Direction faced</dt><dd>${photo.compass_heading_deg == null ? "Not available" : `${htmlEscape(Math.round(photo.compass_heading_deg))}°`}</dd><dt>Evidence classification</dt><dd>${htmlEscape(photo.evidence_classification || "Observed")}</dd><dt>Confirmed observation link</dt><dd>${htmlEscape(photo.observation_id || "None — do not infer from proximity")}</dd><dt>Category</dt><dd>${htmlEscape(photo.category || "Other")}</dd><dt>Water depth</dt><dd>${htmlEscape(attributes.water_depth || "Not applicable or not entered")}</dd><dt>Note</dt><dd>${htmlEscape(photo.note || "None")}</dd></dl></section>`;
    }).join("");
    const conditionRows = [
      ["Inspection date", conditions.inspection_date], ["Start", manifest.inspection.started_at], ["End", manifest.inspection.finished_at],
      ["Weather", conditions.weather_summary], ["Rain — previous 24 hours", conditions.rainfall_previous_24_hours],
      ["Rain — previous 7 days", conditions.rainfall_previous_7_days], ["Rain — previous 30 days", conditions.rainfall_previous_30_days],
      ["Temperature", conditions.temperature], ["Ground condition", conditions.ground_condition], ["Rain during inspection", conditions.rain_during_inspection]
    ].map(([label, value]) => `<tr><th>${htmlEscape(label)}</th><td>${htmlEscape(value || "Not entered")}</td><td>${htmlEscape(conditions.evidence_classification || "Observed")}</td></tr>`).join("");
    const weatherRows = [
      ["Named storm or major event", weatherContext.named_event], ["Event dates", weatherContext.event_dates],
      ["Days between event and inspection", weatherContext.days_between_event_and_inspection], ["Authoritative rainfall totals / source", weatherContext.authoritative_rainfall_totals],
      ["Weather-station distance limitation", weatherContext.weather_station_distance_from_parcel], ["Inspector-reported recent local rain", weatherContext.inspector_reported_recent_local_rain],
      ["Potentially relevant mechanism", weatherContext.potentially_relevant_mechanism]
    ].map(([label, value]) => `<tr><th>${htmlEscape(label)}</th><td>${htmlEscape(value || "Not entered")}</td></tr>`).join("");
    const observationRows = (manifest.inspection.observations || []).map((item, index) => `<tr><td>${index + 1}</td><td>${htmlEscape(item.observed_at)}</td><td>${htmlEscape(item.label)}</td><td>${htmlEscape(item.evidence_classification)}</td><td>${htmlEscape(item.gps.latitude)}, ${htmlEscape(item.gps.longitude)}</td><td>${htmlEscape(item.note || "")}</td></tr>`).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pearson Road Inspection Report</title><style>
      @page portrait{size:letter portrait;margin:.45in}@page landscape{size:letter landscape;margin:.35in}*{box-sizing:border-box}body{margin:0;color:#111;font-family:Arial,sans-serif;background:#ddd}.page{background:#fff;margin:16px auto;padding:.35in;page-break-after:always;break-after:page}.portrait{page:portrait;width:8.5in;min-height:11in}.landscape{page:landscape;width:11in;min-height:8.5in}h1{margin:0 0 10px;font-size:24px}h2{margin:18px 0 8px}.report-map{display:block;width:100%;height:6.75in;border:2px solid #111;background:#ddd}.route-page .report-map{height:6.2in}.route-summary{display:flex;gap:20px;align-items:center;margin:-3px 0 7px;padding:7px 10px;background:#eee;border:1px solid #777;font-size:13px}.map-note{margin:6px 0;font-size:12px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.summary div{border:1px solid #777;padding:9px}.summary strong{display:block;font-size:20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #777;padding:6px;text-align:left;vertical-align:top}.photo-page img{display:block;max-width:100%;max-height:7.1in;margin:0 auto 12px;object-fit:contain}.photo-page dl{display:grid;grid-template-columns:1.55in 1fr;margin:0}.photo-page dt,.photo-page dd{margin:0;border-top:1px solid #aaa;padding:6px}.photo-page dt{font-weight:bold}.disclaimer{border:3px solid #111;padding:12px;font-weight:bold}.photo-marker{cursor:pointer}.photo-marker:hover circle,.photo-marker:focus circle{stroke:#00ffff;stroke-width:12}#photoHover{position:fixed;z-index:20;display:none;width:280px;padding:7px;background:#fff;border:3px solid #111;box-shadow:0 4px 20px #0008}#photoHover img{display:block;width:100%;max-height:220px;object-fit:contain}dialog{max-width:min(92vw,760px);border:3px solid #111}dialog img{max-width:100%;max-height:75vh}@media print{body{background:#fff}.page{margin:0}#photoHover,dialog{display:none!important}}@media(max-width:800px){.page,.portrait,.landscape{width:100%;min-height:0;margin:0 0 12px;padding:12px}.report-map,.route-page .report-map{height:auto;aspect-ratio:6/5}.route-summary{display:grid;grid-template-columns:1fr 1fr}.summary{grid-template-columns:1fr 1fr}}
    </style></head><body>${rasterDefinitions}${smallWaterPages}${waterDetailPages}${mapPages}${decisionPage}<section class="page portrait"><h1>Pearson Road Property Inspection</h1><p><strong>Inspection ID:</strong> ${htmlEscape(manifest.inspection_id)}</p><div class="summary"><div><span>Distance walked</span><strong>${metrics.distance_walked_miles.toFixed(2)} mi</strong></div><div><span>Elapsed field time</span><strong>${formatReportDuration(metrics.elapsed_time_ms)}</strong></div><div><span>Active movement</span><strong>${formatReportDuration(metrics.active_movement_time_ms)}</strong></div><div><span>Stopped time</span><strong>${formatReportDuration(metrics.stopped_time_ms)}</strong></div><div><span>GPS points</span><strong>${metrics.gps_point_count}</strong></div><div><span>Photographs / observations</span><strong>${metrics.photograph_count} / ${metrics.observation_count}</strong></div></div><h2>Observed Inspection Conditions</h2><table><thead><tr><th>Condition</th><th>Recorded value</th><th>Evidence</th></tr></thead><tbody>${conditionRows}</tbody></table><h2>Weather Context</h2><table><thead><tr><th>Context</th><th>Recorded value</th></tr></thead><tbody>${weatherRows}</tbody></table><p><strong>Weather context, observed site conditions, and inferred causes are separate. Neither the weather record nor one inspection establishes year-round conditions.</strong></p><div class="disclaimer">This report is preliminary property intelligence and field reconnaissance. It is not a boundary survey, engineering report, appraisal, wetland delineation, septic approval, timber appraisal, or legal opinion. Items marked Interpretation or Needs Professional Verification are not presented as proven facts.</div></section>${detailPages}${evidenceSetPages}<section class="page portrait"><h1>Evidence Index</h1><table><thead><tr><th>#</th><th>Time</th><th>Observation</th><th>Evidence</th><th>Coordinates</th><th>Note</th></tr></thead><tbody>${observationRows}</tbody></table></section>${photoPages}<div id="photoHover"><strong id="photoHoverLabel"></strong><img id="photoHoverImage" alt="Photograph preview"></div><dialog id="photoDialog"><button id="closePhotoDialog">Close</button><h2 id="photoDialogLabel"></h2><img id="photoDialogImage" alt="Inspection photograph"></dialog><script>(()=>{const markers=[...document.querySelectorAll('.photo-marker')],hover=document.getElementById('photoHover'),hoverImage=document.getElementById('photoHoverImage'),hoverLabel=document.getElementById('photoHoverLabel'),dialog=document.getElementById('photoDialog'),dialogImage=document.getElementById('photoDialogImage'),dialogLabel=document.getElementById('photoDialogLabel');function source(id){return document.getElementById('photo-'+id)}function showHover(event){const id=event.currentTarget.dataset.photoId,img=source(id);if(!img)return;hoverImage.src=img.src;hoverLabel.textContent=id;hover.style.left=Math.min(innerWidth-300,event.clientX+12)+'px';hover.style.top=Math.max(8,event.clientY-240)+'px';hover.style.display='block'}function openPhoto(event){const id=event.currentTarget.dataset.photoId,img=source(id);if(!img)return;dialogImage.src=img.src;dialogLabel.textContent=id;dialog.showModal()}markers.forEach(marker=>{marker.addEventListener('mouseenter',showHover);marker.addEventListener('mousemove',showHover);marker.addEventListener('mouseleave',()=>hover.style.display='none');marker.addEventListener('click',openPhoto);marker.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openPhoto(event)}})});document.getElementById('closePhotoDialog').addEventListener('click',()=>dialog.close())})()</script></body></html>`;
  }

  function smallWaterMapSvg(manifest, mode, focusCluster) {
    const model = manifest.small_tract_water_map || {};
    if (model.status !== "GENERATED") return `<p>Small-tract water map unavailable: ${htmlEscape(model.reason || "parcel section could not be isolated")}</p>`;
    const boundary = model.small_tract.boundary || [];
    const projectedBoundary = boundary.map(point => reportProjection(point[0], point[1]));
    const focusEvidence = focusCluster ? (model.water_photographs || []).filter(item => (focusCluster.supporting_photo_ids || []).includes(item.photo_id)).map(item => reportProjection(item.longitude, item.latitude)) : [];
    const focusOutline = focusCluster && focusCluster.estimated_outline ? focusCluster.estimated_outline.map(point => reportProjection(point[0], point[1])) : [];
    const viewPoints = focusEvidence.length ? focusEvidence.concat(focusOutline) : projectedBoundary;
    const xs = viewPoints.map(point => point.x);
    const ys = viewPoints.map(point => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const minimumFocusSpan = focusCluster ? 180 : 0;
    const xCenter = (minX + maxX) / 2, yCenter = (minY + maxY) / 2;
    const xSpan = Math.max(maxX - minX, minimumFocusSpan), ySpan = Math.max(maxY - minY, minimumFocusSpan);
    const padding = Math.max(35, Math.max(xSpan, ySpan) * .12);
    const view = { minX: xCenter - xSpan / 2 - padding, minY: yCenter - ySpan / 2 - padding, width: xSpan + padding * 2, height: ySpan + padding * 2 };
    const pathFor = ring => (ring || []).map((point, index) => {
      const projected = reportProjection(point[0], point[1]);
      return `${index ? "L" : "M"}${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
    }).join(" ") + " Z";
    const route = (model.route_segments || []).map(segment => {
      const d = segment.map((point, index) => {
        const projected = reportProjection(point.lon, point.lat);
        return `${index ? "L" : "M"}${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
      }).join(" ");
      if (!d) return "";
      return `<g class="layer-route">${model.inspected_no_standing_water && model.inspected_no_standing_water.enabled ? `<path class="layer-inspected-dry" d="${d}" fill="none" stroke="rgba(65,155,74,.38)" stroke-width="48" vector-effect="non-scaling-stroke"/>` : ""}<path d="${d}" fill="none" stroke="#111" stroke-width="12" vector-effect="non-scaling-stroke"/><path d="${d}" fill="none" stroke="#ffe600" stroke-width="6" vector-effect="non-scaling-stroke"/></g>`;
    }).join("");
    const outlines = (model.water_area_clusters || []).filter(cluster => cluster.estimated_outline && (!focusCluster || cluster.water_area_id === focusCluster.water_area_id)).map(cluster => `<g class="layer-outlines"><path d="${pathFor(cluster.estimated_outline)}" fill="rgba(21,108,205,.25)" stroke="#1768c4" stroke-width="6" stroke-dasharray="16 10" vector-effect="non-scaling-stroke"/><title>${htmlEscape(cluster.water_area_id)}: ${htmlEscape(cluster.outline_basis)}</title></g>`).join("");
    const avoidance = (model.preliminary_building_avoidance_areas || []).filter(area => area.outline && (!focusCluster || area.water_area_id === focusCluster.water_area_id)).map(area => `<g class="layer-avoidance"><path d="${pathFor(area.outline)}" fill="rgba(190,20,38,.18)" stroke="#c21428" stroke-width="7" stroke-dasharray="22 10" vector-effect="non-scaling-stroke"/><title>${htmlEscape(area.avoidance_id)}: ${htmlEscape(area.reason)}</title></g>`).join("");
    const dry = (model.high_dry_observations || []).map(item => {
      const point = reportProjection(item.location.lon, item.location.lat);
      return `<circle class="layer-dry" cx="${point.x}" cy="${point.y}" r="15" fill="#45a146" stroke="#fff" stroke-width="5" vector-effect="non-scaling-stroke"><title>${htmlEscape(item.type)} ${htmlEscape(item.recorded_at)}</title></circle>`;
    }).join("");
    const wetObservations = (model.wet_observations || []).map(item => {
      const point = reportProjection(item.location.lon, item.location.lat);
      return `<rect class="layer-standing" x="${point.x - 12}" y="${point.y - 12}" width="24" height="24" transform="rotate(45 ${point.x} ${point.y})" fill="#74c6ff" stroke="#003f8f" stroke-width="5" vector-effect="non-scaling-stroke"><title>Wet observation ${htmlEscape(item.observation_id)} · ${htmlEscape(item.recorded_at)}</title></rect>`;
    }).join("");
    const photoById = new Map((manifest.photographs || []).map(photo => [String(photo.photo_id), photo]));
    const voiceById = new Map((manifest.voice_notes || []).map(voice => [String(voice.voice_note_id), voice]));
    const markers = (model.water_photographs || []).filter(item => {
      if (focusCluster && !(focusCluster.supporting_photo_ids || []).includes(item.photo_id)) return false;
      if (mode === "significant") return item.significance === "Flowing-water corridor" || item.significance === "Larger connected wet area" || item.significance === "Moderate pooled area";
      if (mode === "avoidance") return (model.preliminary_building_avoidance_areas || []).some(area => (area.supporting_photo_numbers || []).includes(item.photo_number));
      return true;
    }).map(item => {
      const point = reportProjection(item.longitude, item.latitude);
      const flowing = item.significance === "Flowing-water corridor";
      const significanceClass = item.significance === "Minor localized depression" ? "minor" : ((item.significance === "Moderate pooled area" || item.significance === "Larger connected wet area") ? "larger" : "other-water");
      const photo = photoById.get(String(item.photo_id));
      const voiceId = (item.voice_note_ids || [])[0];
      const voice = voiceById.get(String(voiceId));
      const detail = `${item.photo_number || "Photo"} · ${item.significance} · depth ${item.depth && item.depth.label || "unknown"} · ${item.dimensions && item.dimensions.width_ft || "unknown"} ft wide × ${item.dimensions && item.dimensions.length_ft || "unknown"} ft long · ${item.dimensions && item.dimensions.basis || "unknown basis"} · ${item.recorded_at || "time unknown"}`;
      return `<g class="water-photo layer-${flowing ? "flowing" : "standing"} layer-${significanceClass}" tabindex="0" role="button" data-photo-path="${htmlEscape(photo && photo.analysis && photo.analysis.path || "")}" data-voice-path="${htmlEscape(voice && voice.audio && voice.audio.path || "")}" data-photo-label="${htmlEscape(item.photo_number || "Photo")}" data-detail="${htmlEscape(detail)}"><circle cx="${point.x}" cy="${point.y}" r="23" fill="${flowing ? "#003f8f" : "#1687e0"}" stroke="#fff" stroke-width="6" vector-effect="non-scaling-stroke"/><text x="${point.x}" y="${point.y + 7}" text-anchor="middle" fill="#fff" stroke="#111" stroke-width="2" paint-order="stroke" font-size="17" font-weight="900">${htmlEscape(String(item.photo_number || "P").replace(/^P/, ""))}</text><title>${htmlEscape(detail)}</title></g>`;
    }).join("");
    const labels = (model.water_area_clusters || []).filter(cluster => !focusCluster || cluster.water_area_id === focusCluster.water_area_id).map(cluster => {
      const point = reportProjection(cluster.center.longitude, cluster.center.latitude);
      return `<text class="layer-outlines" x="${point.x}" y="${point.y - 30}" text-anchor="middle" fill="#052f56" stroke="#fff" stroke-width="5" paint-order="stroke" font-size="24" font-weight="900">${htmlEscape(cluster.water_area_id)}</text>`;
    }).join("");
    const showAvoidance = mode === "overview" || mode === "avoidance";
    const showDry = mode === "overview" || mode === "all";
    return `<svg class="small-water-map report-map" viewBox="${view.minX} ${view.minY} ${view.width} ${view.height}" role="img" aria-label="${htmlEscape(model.title)}" xmlns="http://www.w3.org/2000/svg"><use class="layer-terrain" href="#reportTerrainRaster" x="0" y="0" width="1800" height="1500"/><use class="layer-contours" href="#reportContourRaster" x="0" y="0" width="1800" height="1500" opacity=".8"/><path class="layer-unknown" d="${pathFor(boundary)}" fill="rgba(80,80,80,.27)" stroke="#d71920" stroke-width="9" vector-effect="non-scaling-stroke"/>${route}${showAvoidance ? avoidance : ""}${outlines}${showDry ? dry : ""}${wetObservations}${markers}${labels}<g transform="translate(${view.minX + 50} ${view.minY + 50})"><path d="M0 60 L26 0 L52 60 L26 46 Z" fill="#111"/><text x="26" y="-10" text-anchor="middle" font-size="30" font-weight="900">N</text></g></svg>`;
  }

  function createSmallTractWaterMapHtml(manifest) {
    const model = manifest.small_tract_water_map || {};
    const summaryRows = (model.water_area_clusters || []).map(cluster => `<tr><th>${htmlEscape(cluster.water_area_id)}</th><td>${htmlEscape(cluster.classification)}</td><td>${htmlEscape(cluster.supporting_photo_numbers.join(", "))}</td><td>${htmlEscape(cluster.minimum_depth_in == null ? "Unknown" : `${cluster.minimum_depth_in}–${cluster.maximum_depth_in == null ? "+" : cluster.maximum_depth_in} in`)}</td><td>${htmlEscape(cluster.confidence)}</td></tr>`).join("") || `<tr><td colspan="5">No confirmed small-tract water photographs were present.</td></tr>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(model.title || "Small Tract Water Map")}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:#ddd;color:#111}main{max-width:1200px;margin:auto;background:#fff;padding:16px}h1{margin:0 0 8px}.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;margin:10px 0}.controls label{padding:9px;border:2px solid #777;font-weight:800}.controls input{width:22px;height:22px;vertical-align:middle}.small-water-map{display:block;width:100%;height:70vh;min-height:500px;border:3px solid #164b75;background:#d5d5d5}.water-photo{cursor:pointer}.water-photo:hover circle,.water-photo:focus circle{stroke:#00ffff;stroke-width:12}.legend{display:flex;gap:12px;flex-wrap:wrap;padding:8px;background:#f3f3f3}.legend span{white-space:nowrap}.warning{border:3px solid #111;padding:10px;font-weight:800}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:6px;text-align:left}dialog{max-width:min(92vw,760px);border:3px solid #111}dialog img{display:block;max-width:100%;max-height:65vh;margin:auto}dialog audio{width:100%;margin-top:10px}@media print{@page{size:letter landscape;margin:.35in}body{background:#fff}main{max-width:none;padding:0}.controls,dialog{display:none!important}.small-water-map{height:6.4in}.warning{font-size:11px}}</style></head><body><main><h1>${htmlEscape(model.title || "SMALL TRACT — OBSERVED WATER CONDITIONS")}</h1><p><strong>Small tract:</strong> ${htmlEscape(model.small_tract && model.small_tract.stated_acres)} acres · <strong>Water photographs:</strong> ${htmlEscape((model.water_photographs || []).length)} · <strong>Clusters:</strong> ${htmlEscape((model.water_area_clusters || []).length)}</p><div class="controls"><label><input type="checkbox" data-layer="route" checked>Route / inspected corridor</label><label><input type="checkbox" data-layer="standing" checked>Standing water</label><label><input type="checkbox" data-layer="flowing" checked>Flowing water</label><label><input type="checkbox" data-layer="minor" checked>Minor depressions</label><label><input type="checkbox" data-layer="larger" checked>Larger pooled areas</label><label><input type="checkbox" data-layer="outlines" checked>Estimated outlines</label><label><input type="checkbox" data-layer="avoidance" checked>Building avoidance</label><label><input type="checkbox" data-layer="dry" checked>High / dry evidence</label><label><input type="checkbox" data-layer="terrain" checked>Terrain</label><label><input type="checkbox" data-layer="contours" checked>2-foot contours</label><label><input type="checkbox" data-layer="unknown" checked>Uninspected / unknown</label></div><svg aria-hidden="true" width="0" height="0" style="position:absolute"><defs><image id="reportTerrainRaster" href="context/usgs-terrain.png" width="1800" height="1500"/><image id="reportContourRaster" href="context/usgs-contours-2ft.png" width="1800" height="1500"/></defs></svg>${smallWaterMapSvg(manifest, "overview")}<div class="legend"><span>● Actual photographed water</span><span>◇ Wet observation</span><span>Blue dashed: estimated extent</span><span>Red dashed: preliminary avoidance</span><span>Green corridor: inspected with no standing water observed</span><span>Gray: unknown outside inspected corridor</span></div><p class="warning">${htmlEscape((model.limitations || []).join(" "))}</p><h2>Water-area clusters</h2><table><thead><tr><th>ID</th><th>Classification</th><th>Supporting photos</th><th>Depth</th><th>Confidence</th></tr></thead><tbody>${summaryRows}</tbody></table></main><dialog id="photoDialog"><button id="closeDialog">Close</button><h2 id="dialogTitle"></h2><img id="dialogImage" alt="Water evidence photograph"><p id="dialogDetail"></p><audio id="dialogAudio" controls hidden></audio></dialog><script>(()=>{const dialog=document.getElementById('photoDialog'),image=document.getElementById('dialogImage'),audio=document.getElementById('dialogAudio');function openMarker(event){const marker=event.currentTarget;document.getElementById('dialogTitle').textContent=marker.dataset.photoLabel;document.getElementById('dialogDetail').textContent=marker.dataset.detail;image.src=marker.dataset.photoPath;audio.hidden=!marker.dataset.voicePath;if(marker.dataset.voicePath)audio.src=marker.dataset.voicePath;dialog.showModal()}document.querySelectorAll('.water-photo').forEach(marker=>{marker.addEventListener('click',openMarker);marker.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openMarker(event)}})});document.getElementById('closeDialog').addEventListener('click',()=>dialog.close());document.querySelectorAll('[data-layer]').forEach(input=>input.addEventListener('change',()=>document.querySelectorAll('.layer-'+input.dataset.layer).forEach(item=>item.style.display=input.checked?'':'none')))})()</script></body></html>`;
  }

  function makeReadme(manifest) {
    const fullArchive = manifest.package_mode === "full_evidence_archive";
    return [
      fullArchive ? "PROPERTY INSPECTOR — FULL EVIDENCE ARCHIVE" : "PROPERTY INSPECTOR — CHATGPT ANALYSIS PACKAGE",
      "",
      "Save this ZIP as one immutable upload to the Property Intelligence Repository.",
      "The repository should start with repository-import.json, preserve the source ZIP, and reject any overwrite. ChatGPT should analyze the extracted repository record beginning with AI_README.md and DECISION_BRIEF.json.",
      "",
      "Contents:",
      "- AI_README.md: plain-English first instruction for ChatGPT, including relationships, classifications, maps, weather, reporting, and unanswered-question rules.",
      "- AI_ANALYSIS.json: analysis-first structure containing property, conditions, statistics, full GPS track, observations, photos, voice notes, thoughts, layers, public data, relationships, questions, and metadata.",
      "- DECISION_BRIEF.json: five-decision evidence routing, strengths/weaknesses/unknowns instructions, confidence rubric, and lowest-cost uncertainty-reduction rules.",
      "- QUESTION_BRIEF.json: every inspector-created investigation question with supporting, contradicting, and contextual evidence IDs.",
      "- FIELD_COACHING.json: inspection areas, route-proximity coverage, missing-evidence review, return priorities, and field-efficiency estimates.",
      "- FIELD_EVIDENCE_REVIEW.json: four-photo pattern completeness, missing context and measurements, repetitive evidence, unsupported hypotheses, and field-time review candidates.",
      "- EVIDENCE_AUDIT_HISTORY.json: immutable corrections and audit-only attachments; exclude voided records from findings.",
      "- PROFESSIONAL_HANDOFF_CARDS.json and professional-handoff-cards.html: exact audience questions, evidence, unknowns, and one-page printable handoffs.",
      "- RETURN_VISIT_PLAN.json: unvisited-zone waypoints and the highest-value remaining measurements and photographs.",
      "- SMALL_TRACT_WATER_MAP.json: exact small-tract ring, small-tract-only route and evidence, conservative water clusters, dry-corridor rule, unknown acreage, and preliminary building-avoidance reasoning.",
      "- small-tract-water-map.html: interactive human-readable map whose water markers open the actual photograph and attached voice explanation.",
      "- REPORT_TEMPLATE.md: required professional Property Intelligence Report structure.",
      "- INSPECTOR_THOUGHTS.md: inspector reasoning kept separate from observed evidence.",
      "- INSPECTOR_HYPOTHESES.md: interpretations, contradictions, exact verification questions, and prohibitions against unverified conclusions.",
      "- EVIDENCE_RELATIONSHIPS.json: direct GPS, observation, photo, voice, weather, map, and thought links.",
      "- repository-import.json: immutable property folder, inspection folder, export ID, extraction map, and responsibility contract for repository ingestion.",
      "- inspection.json: canonical record of the property, GPS track, observations, notes, photos, voice notes, headings, device orientation, and map context.",
      "- chatgpt-reconstruction.json: required automatic analysis outputs and exact relationships between track, observations, photographs, timeline, and parcel coverage.",
      "- schema.json: stable, extensible observation contract for future cross-property analysis.",
      "- events.csv: flat table of every GPS point, inspection start/pause/resume/finish event, observation, and device-orientation sample.",
      "- observations.csv: one row per field observation with evidence classification, structured attributes, coordinates, and attachment links.",
      "- photos.csv: flat photo index with coordinates, timestamps, orientation, paths, sizes, and SHA-256 hashes when available.",
      "- photo_index.json: machine-readable P1/P2 photo index linking every photograph to its marker and observation.",
      "- printable-report.html: self-contained interactive and printable report with embedded analysis photographs and maps.",
      "- voice-notes.csv and voice-notes/: voice-note index and the actual audio files.",
      "- track.geojson: GIS-ready route and event points.",
      "- track.gpx: GPS exchange copy of the route and waypoints.",
      fullArchive ? "- photos/NNN_original.ext: exact original bytes captured or selected on the phone." : "- Original photo bytes are intentionally omitted from this report package; inspection.json and photo_index.json retain the original filename, dimensions, size, timestamp, metadata, and SHA-256 hash.",
      "- photos/NNN_analysis.jpg: browser-rendered JPEG copy guaranteed for image analysis.",
      "- context/: subject and neighboring parcel geometry, USGS terrain, 2-foot contours, bounds, acreage, and source metadata.",
      "",
      `Inspection ID: ${manifest.inspection_id}`,
      `Repository path: ${manifest.repository.inspection_path}`,
      `Export ID: ${manifest.repository.export_id}`,
      `Started: ${manifest.inspection.started_at || "not recorded"}`,
      `Finished: ${manifest.inspection.finished_at || "not recorded"}`,
      `GPS points: ${manifest.summary.gps_track_point_count}`,
      `Field events: ${manifest.summary.field_event_count}`,
      `Photographs: ${manifest.summary.photo_count}`,
      `Voice notes: ${manifest.summary.voice_note_count}`,
      `Inspector thoughts: ${manifest.summary.inspector_thought_count}`,
      `Subject parcel: ${manifest.property.display_parcel_number || manifest.property.parcel_number}`,
      `Recorded acres: ${manifest.property.recorded_acres}`,
      "",
      "Integrity: ZIP CRC-32 protects every member. inspection.json and photos.csv also record photo byte sizes and SHA-256 hashes when the browser provided SHA-256.",
      fullArchive ? "Original photographs are never replaced by analysis copies. Both are included so the source evidence is preserved and each image remains easy to analyze." : "Every photograph is present as an analysis-quality JPEG. Exact original bytes remain safely stored on the inspection phone and can be exported separately in a FULL EVIDENCE ARCHIVE.",
      "This package is self-contained. The analyst should not need to ask the field user for separate photos, map layers, notes, audio, or GPS files."
    ].join("\r\n") + "\r\n";
  }

  function createReconstructionGuide(manifest) {
    return {
      mode: "chatgpt-property-inspection-reconstruction",
      version: "1.1",
      auto_start: true,
      user_questions_required_before_analysis: false,
      objective: "Reconstruct the field day from this ZIP alone, then reduce uncertainty about access, buildability, economic potential, cost/risk, and distinctive value without asking the field user to match evidence.",
      start_here: ["AI_README.md", "EVIDENCE_AUDIT_HISTORY.json", "DECISION_BRIEF.json", "SMALL_TRACT_WATER_MAP.json", "small-tract-water-map.html", "QUESTION_BRIEF.json", "FIELD_EVIDENCE_REVIEW.json", "FIELD_COACHING.json", "PROFESSIONAL_HANDOFF_CARDS.json", "professional-handoff-cards.html", "RETURN_VISIT_PLAN.json", "AI_ANALYSIS.json", "REPORT_TEMPLATE.md", "EVIDENCE_RELATIONSHIPS.json", "INSPECTOR_THOUGHTS.md", "INSPECTOR_HYPOTHESES.md", "inspection.json"],
      required_outputs_in_order: [
        "Decision summary",
        "Strengths, weaknesses, and material unknowns",
        "Explained confidence for each of the five decisions",
        "Lowest-cost next investigation",
        "Buyer, seller, builder, developer, engineer, and forester questions",
        "Interactive map",
        "Printable report",
        "Inspection timeline",
        "Photo gallery",
        "Questions answered",
        "Questions remaining",
        "Suggested next visit",
        "Areas not yet inspected",
        "Every inspector-created investigation question answered or explicitly unresolved",
        "Named inspection-area comparison",
        "Field-efficiency assessment"
      ],
      relationship_rules: {
        canonical_record: "inspection.json",
        gps_route: "inspection.json > inspection.gps_track, with track.geojson and track.gpx as portable copies",
        observations: "inspection.json > inspection.observations; preserve evidence_classification and structured attributes",
        photo_to_map: "Each photographs[] record contains location and photo_number; the matching field marker is associated_marker_id and the subject observation is associated_observation_id when present.",
        photo_bytes: manifest.package_mode === "full_evidence_archive" ? "Use each photographs[].analysis.path for display and analysis. Exact source bytes are available at photographs[].original.path." : "Use each photographs[].analysis.path for display and analysis. Original source bytes are intentionally omitted; photographs[].original retains the source filename, dimensions, byte size, timestamp, metadata, and SHA-256 hash.",
        timeline: "Merge inspection.lifecycle_events, gps_track timestamps, observations, photographs, and voice_notes by timestamp.",
        parcel_coverage: "Compare the GPS route and observation locations with the subject geometry in context/parcels.geojson. Clearly label coverage and missed-acre calculations as estimates unless measured by a GIS operation.",
        map_layers: "Use context/map-context.json for coordinate reference, bounds, acreage, terrain, contour, and parcel-layer provenance. Missing optional raster imagery must not prevent reconstruction.",
        corrections: "Read EVIDENCE_AUDIT_HISTORY.json first. Exclude voided records from findings while preserving and reporting the existence of the immutable correction.",
        proximity: "Relationships labeled nearest_by_location_unconfirmed are suggestions only; never use them as proof that a photograph depicts the nearby observation."
      },
      output_requirements: {
        interactive_map: ["subject and neighboring parcels", "complete route", "layer toggles by observation group", "numbered photo markers with actual photo previews", "clearly marked estimated uninspected areas"],
        printable_report: ["inspection conditions and disclaimer", "route and category maps", "timeline", "actual photographs", "evidence classifications", "findings and limitations"],
        inspection_timeline: ["start, resume, pause, finish", "GPS movement", "every observation", "every photograph", "every note and voice note"],
        photo_gallery: ["actual analysis image", "P number", "timestamp", "coordinates and GPS accuracy", "heading and orientation", "category, linked observation, structured attributes, and note"],
        questions_answered: "State only answers supported by package evidence and cite the relevant observation, photograph, GPS point, condition, or public-data layer.",
        questions_remaining: "List material unknowns or items needing professional verification. Do not interrupt reconstruction to ask the user; include them in the output.",
        suggested_next_visit: "Prioritize gaps, uncertain findings, uninspected areas, missing photographs, and evidence marked Needs Professional Verification.",
        areas_not_yet_inspected: "Estimate spatial gaps relative to the subject parcel and distinguish route-buffer assumptions from measured acreage."
      },
      integrity_expectations: {
        expected_photo_count: manifest.summary.photo_count,
        expected_original_photo_file_count: manifest.summary.original_photo_count,
        expected_original_photo_metadata_count: manifest.summary.original_photo_evidence_count,
        expected_analysis_photo_count: manifest.summary.analysis_photo_count,
        expected_gps_point_count: manifest.summary.gps_track_point_count,
        expected_observation_count: manifest.summary.observation_count,
        action_on_mismatch: "Report the exact corrupt or missing member. Never silently omit evidence."
      }
    };
  }

  const evidenceClassificationDefinitions = {
    Observed: "Directly seen, heard, or otherwise perceived by the inspector during this visit.",
    Measured: "Recorded using an instrument, scale, count, or explicit field measurement; report the method and precision when available.",
    Estimated: "A field estimate rather than a verified measurement. Preserve the estimate and its uncertainty.",
    "Public Data": "Taken from an identified external public source. Cite the source, retrieval date, and applicable limitations.",
    Interpretation: "Inspector reasoning, judgment, theory, concern, or preference. It is not an observed fact.",
    "Needs Professional Verification": "Potentially important but not established; recommend the appropriate qualified professional and explain what should be verified."
  };

  const propertyDecisionFramework = [
    {
      decision_id: "D1_ACCESS",
      question: "Can I access it?",
      title: "Access",
      purpose: "Determine whether people, passenger vehicles, construction equipment, emergency vehicles, and future users can reach and move through the property.",
      possible_strength_types: ["field.entrance", "field.open", "field.culvert", "field.dry"],
      possible_weakness_types: ["field.blocked", "field.thick", "field.wet", "field.ditch", "field.hazard", "field.culvert"]
    },
    {
      decision_id: "D2_BUILD",
      question: "Can I build here?",
      title: "Buildability",
      purpose: "Identify plausible building areas and the access, drainage, grade, utility, permitting, and site-work uncertainties that could prevent or burden construction.",
      possible_strength_types: ["field.homesite", "field.high", "field.dry", "field.open", "field.entrance"],
      possible_weakness_types: ["field.wet", "field.ditch", "field.hazard", "field.blocked", "field.thick", "field.culvert"]
    },
    {
      decision_id: "D3_ECONOMICS",
      question: "Can I make money here?",
      title: "Economic Potential",
      purpose: "Identify supported income, development, timber, resale, conservation, recreation, or improvement opportunities without inventing value or yield.",
      possible_strength_types: ["field.timber", "field.tree", "field.homesite", "field.open", "field.entrance", "field.wildlife", "field.high"],
      possible_weakness_types: ["field.blocked", "field.wet", "field.hazard", "field.thick"]
    },
    {
      decision_id: "D4_COST_RISK",
      question: "What might cost me money?",
      title: "Cost and Risk",
      purpose: "Surface conditions that may create acquisition, access, clearing, drainage, infrastructure, professional, maintenance, insurance, legal, or permitting cost.",
      possible_strength_types: ["field.dry", "field.high", "field.open", "field.entrance"],
      possible_weakness_types: ["field.wet", "field.blocked", "field.culvert", "field.ditch", "field.hazard", "field.thick"]
    },
    {
      decision_id: "D5_DISTINCTION",
      question: "What makes this property special?",
      title: "Distinctive Value",
      purpose: "Identify features that materially distinguish the property for use, enjoyment, marketability, conservation, identity, or long-term value.",
      possible_strength_types: ["field.tree", "field.wildlife", "field.high", "field.open", "field.homesite", "field.timber", "field.wet"],
      possible_weakness_types: []
    }
  ];

  function decisionRelevanceForObservation(observation) {
    const type = observation.observation_type || "field.other";
    const relationships = [];
    propertyDecisionFramework.forEach(decision => {
      const strength = decision.possible_strength_types.includes(type);
      const weakness = decision.possible_weakness_types.includes(type);
      if (!strength && !weakness) return;
      relationships.push({
        decision_id: decision.decision_id,
        question: decision.question,
        candidate_effect: strength && weakness ? "context_requires_analysis" : (strength ? "possible_strength" : "possible_weakness"),
        rule: "Review the note, location, photographs, voice notes, conditions, and map context before deciding whether this evidence helps or hurts the decision."
      });
    });
    if (!relationships.length) {
      relationships.push({
        decision_id: "D4_COST_RISK",
        question: "What might cost me money?",
        candidate_effect: "context_requires_analysis",
        rule: "Determine whether this general evidence reveals a cost, risk, or unresolved condition; if not, explain its decision relevance under Distinctive Value."
      });
      relationships.push({
        decision_id: "D5_DISTINCTION",
        question: "What makes this property special?",
        candidate_effect: "context_requires_analysis",
        rule: "Determine whether this general evidence identifies a distinctive feature or simply provides neutral context."
      });
    }
    return relationships;
  }

  function createEvidenceRelationships(manifest) {
    return {
      schema_name: "property-intelligence-evidence-relationships",
      schema_version: "1.0",
      inspection_id: manifest.inspection_id,
      gps_points: manifest.inspection.gps_track.map(point => ({ gps_point_id: point.gps_point_id, sequence: point.sequence, recorded_at: point.time })),
      observations: manifest.inspection.observations.map(observation => ({
        observation_id: observation.observation_id,
        gps_point_id: observation.gps_point_id,
        decision_relevance: observation.decision_relevance,
        photograph_links: observation.attachments.nearest_photographs,
        voice_note_links: observation.attachments.nearest_voice_notes,
        observed_at: observation.observed_at,
        heading_deg: observation.compass_heading_deg,
        evidence_classification: observation.evidence_classification,
        area_id: observation.area_id,
        question_ids: observation.question_ids,
        question_links: observation.question_links
      })),
      photographs: manifest.photographs.map(photo => ({
        photo_id: photo.photo_id,
        photo_number: photo.photo_number,
        observation_id: photo.observation_id,
        observation_link_status: photo.observation_link_status,
        nearest_observations: photo.nearest_observations,
        gps_point_id: photo.gps_point_id,
        direction_faced: photo.direction_faced,
        recorded_at: photo.recorded_at,
        weather: photo.weather,
        map_location: photo.map_location,
        analysis_path: photo.analysis && photo.analysis.path,
        photo_value: photo.photo_value,
        evidence_set_id: photo.evidence_set_id || null,
        photo_meaning: photo.photo_meaning,
        explanation_voice_note_ids: photo.explanation_voice_note_ids,
        water_confirmation: photo.water_confirmation,
        water: photo.water,
        area_id: photo.area_id,
        question_ids: photo.question_ids,
        question_links: photo.question_links
      })),
      voice_notes: manifest.voice_notes.map(voice => ({
        voice_note_id: voice.voice_note_id,
        observation_id: voice.observation_id,
        observation_link_status: voice.observation_link_status,
        nearest_observations: voice.nearest_observations,
        gps_point_id: voice.gps_point_id,
        recorded_at: voice.started_at,
        audio_path: voice.audio.path,
        purpose: voice.purpose,
        photo_id: voice.photo_id,
        evidence_set_id: voice.evidence_set_id || null,
        area_id: voice.area_id,
        question_ids: voice.question_ids,
        question_links: voice.question_links
      })),
      evidence_sets: manifest.inspection.evidence_set_summaries || { sets: [] },
      approved_review_annotations: manifest.inspection.post_inspection_review ? manifest.inspection.post_inspection_review.active_annotations : [],
      inspector_thoughts: manifest.inspection.inspector_thoughts.map(thought => ({
        thought_id: thought.thought_id,
        gps_point_id: thought.gps_point_id,
        thought_at: thought.thought_at,
        nearest_photographs: thought.nearest_photographs,
        nearest_voice_notes: thought.nearest_voice_notes,
        factual_status: thought.factual_status,
        area_id: thought.area_id,
        question_ids: thought.question_ids,
        question_links: thought.question_links
      }))
    };
  }

  function createReviewAnnotationSchema() {
    return {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "property-intelligence-review-annotation",
      title: "property-intelligence-review-annotation",
      type: "object",
      required: ["schema_name", "schema_version", "annotation_id", "property_id", "inspection_id", "review_session_id", "created_at", "created_by", "approved_by_inspector", "approval_time", "source_conversation_reference", "photograph_ids", "observation_ids", "voice_note_ids", "gps_point_ids", "inspection_area_id", "report_sections_affected", "exact_inspector_statement", "concise_approved_finding", "record_type", "evidence_classification", "confidence", "status", "supersedes_annotation_id", "supporting_evidence", "contradicting_evidence", "unanswered_questions", "professional_verification_question", "main_report_or_appendix"],
      properties: {
        schema_name: { const: "property-intelligence-review-annotation" }, schema_version: { const: "1.0" },
        record_type: { enum: ["Inspector clarification", "Correction", "Accidental button press", "Observed fact", "Measurement", "Estimate", "Inspector interpretation", "Personal preference", "Report wording", "Professional-verification item", "Unanswered question", "Photo-value classification", "Area assignment", "Inspection-phase assignment"] },
        status: { enum: ["Draft", "Inspector approved", "Rejected", "Superseded", "Active"] },
        main_report_or_appendix: { enum: ["main-report", "appendix"] }
      },
      activation_rule: "Nothing becomes an active report finding until the inspector explicitly approves the discrete annotation. Never ingest an entire conversation as fact."
    };
  }

  function createChatReviewInstructions(manifest) {
    return `# Post-Inspection Chat Review Return Package\n\nAfter reviewing photographs with the inspector, return exactly one file named \`CHAT_REVIEW_PACKAGE.zip\`.\n\nRequired members:\n\n- \`CHAT_REVIEW_ANNOTATIONS.json\`\n- \`PHOTO_REVIEW.md\`\n- \`REPORT_UPDATES.json\`\n- \`CORRECTIONS.json\`\n- \`QUESTIONS_REMAINING.json\`\n- \`PHOTO_SELECTION.json\`\n- \`REVIEW_SESSION_SUMMARY.md\`\n\nUse \`schemas/property-intelligence-review-annotation.schema.json\` for every discrete annotation. Do not submit a whole transcript as evidence. Assistant language, exploratory ideas, and automatic classifications are not observed facts. Preserve the inspector's exact statement. Default every annotation to Draft and \`approved_by_inspector: false\` unless the inspector explicitly approved that exact finding. Rejected and superseded statements remain in the audit but cannot update current findings.\n\nEvery material report update must cite its annotation ID, supporting photograph or observation IDs, and inspector approval time. Validate all IDs against this inspection. Do not reference another property or inspection.\n\nPhoto selections are exactly: Critical, Helpful, Reference, Duplicate, or Exclude from main report.\n\nProperty ID: \`${manifest.property_id}\`\n\nInspection ID: \`${manifest.inspection_id}\`\n`;
  }

  function createDecisionBrief(manifest) {
    const observations = manifest.inspection.observations || [];
    const decisions = propertyDecisionFramework.map(definition => {
      const relevant = observations.filter(observation => (observation.decision_relevance || []).some(link => link.decision_id === definition.decision_id));
      const strengthCandidates = relevant.filter(observation => (observation.decision_relevance || []).some(link => link.decision_id === definition.decision_id && link.candidate_effect === "possible_strength"));
      const weaknessCandidates = relevant.filter(observation => (observation.decision_relevance || []).some(link => link.decision_id === definition.decision_id && link.candidate_effect === "possible_weakness"));
      return {
        decision_id: definition.decision_id,
        question: definition.question,
        title: definition.title,
        purpose: definition.purpose,
        answer_status: "GENERATE_FROM_EVIDENCE",
        evidence_observation_ids: relevant.map(observation => observation.observation_id),
        possible_strength_observation_ids: strengthCandidates.map(observation => observation.observation_id),
        possible_weakness_observation_ids: weaknessCandidates.map(observation => observation.observation_id),
        supporting_photograph_ids: [...new Set(relevant.flatMap(observation => (observation.attachments.nearest_photographs || []).filter(link => link.relationship === "direct").map(link => link.photo_id)))],
        contradicting_evidence: { status: "IDENTIFY_EXPLICIT_CONFLICTS_OR_STATE_NONE_RECORDED", observation_ids: [] },
        strengths: { status: "CONFIRM_FROM_EVIDENCE", items: [] },
        weaknesses: { status: "CONFIRM_FROM_EVIDENCE", items: [] },
        unknowns: {
          status: relevant.length ? "IDENTIFY_GAPS_AND_CONFLICTS" : "INSUFFICIENT_DECISION_EVIDENCE",
          rule: "Name the missing fact, why it matters to this decision, and the least expensive reliable way to obtain it."
        },
        estimated_confidence: {
          status: "CALCULATE_AFTER_REVIEW",
          scale: "0-100",
          required_explanation: "State the evidence supporting the score, spatial or temporal gaps, conflicts, assumptions, and what would most improve confidence.",
          floor_rule: relevant.length ? null : "Do not assign more than 20 when no directly relevant observation was recorded."
        },
        lowest_cost_next_investigation: {
          status: "RECOMMEND_AFTER_REVIEW",
          rule: "Prefer a free record check, targeted return visit, simple measurement, phone call, or narrowly scoped professional question before a broad expensive engagement when that can reliably remove the uncertainty.",
          required_fields: ["action", "uncertainty_removed", "decision_affected", "estimated_cost_tier", "estimated_time", "evidence_trigger"]
        },
        professional_follow_up: {
          status: "RECOMMEND_ONLY_WHEN_JUSTIFIED",
          rule: "Name the professional, the exact question to answer, the triggering evidence, and the decision that answer could change."
        },
        conclusion_contract: {
          required_fields: ["answer", "supporting_observations", "supporting_photographs", "contradicting_evidence", "remaining_uncertainty", "estimated_confidence_0_to_100", "confidence_explanation", "cheapest_next_investigation"],
          prohibition: "Never output a score or recommendation without citing why the evidence supports it and what could reverse it."
        }
      };
    });
    return {
      schema_name: "property-intelligence-decision-brief",
      schema_version: "1.0",
      inspection_id: manifest.inspection_id,
      property_id: manifest.property_id,
      objective: "Remove uncertainty from five rural-property decisions. Organize the report around decisions rather than around the volume of collected data.",
      decisions,
      decision_summary: {
        overall_recommendation: "GENERATE_FROM_EVIDENCE",
        strengths: "IDENTIFY_MATERIAL_SUPPORTED_STRENGTHS",
        weaknesses: "IDENTIFY_MATERIAL_SUPPORTED_WEAKNESSES",
        unknowns: "IDENTIFY_DECISION_MATERIAL_UNKNOWNS",
        opinion_changes: "EXPLAIN_WHICH_EVIDENCE_CHANGED_OR_SHOULD_CHANGE_THE_ASSESSMENT",
        cheapest_uncertainty_reduction: "RANK_THE_LOWEST_COST_NEXT_ACTIONS_BY_DECISION_VALUE",
        confidence: "REPORT_ONE_EXPLAINED_0_TO_100_SCORE_PER_DECISION; DO_NOT AVERAGE AWAY A CRITICAL UNKNOWN"
      },
      confidence_rubric: [
        { range: "90-100", meaning: "High confidence: multiple consistent direct or measured sources, relevant media, and adequate spatial coverage; no material unresolved contradiction." },
        { range: "70-89", meaning: "Moderately high: useful consistent evidence with limited gaps that are unlikely to reverse the decision." },
        { range: "50-69", meaning: "Moderate: meaningful evidence exists, but a material gap, assumption, seasonality issue, or limited coverage could change the conclusion." },
        { range: "25-49", meaning: "Low: sparse, indirect, conflicting, or poorly distributed evidence; use only for preliminary direction." },
        { range: "0-24", meaning: "Insufficient: the inspection package cannot responsibly answer the decision." }
      ],
      reporting_rules: [
        "A recorded condition is not automatically a strength or weakness; evaluate its actual effect on intended use.",
        "Absence of an observation is not proof of absence.",
        "Do not infer market value, buildability, legal access, wetland status, septic suitability, timber value, or utility capacity without supporting evidence.",
        "Every material conclusion must cite evidence identifiers.",
        "Every score and recommendation must identify supporting observations, supporting photographs, contradicting evidence, remaining uncertainty, and the cheapest reliable next investigation.",
        "Every material unknown must be paired with the cheapest credible next investigation.",
        "Every professional referral must state the exact question and the evidence that makes the referral worthwhile."
      ]
    };
  }

  function createSuggestedInspectionQuestions(manifest) {
    const types = new Set(manifest.inspection.observations.map(observation => observation.observation_type));
    const questions = [
      { id: "Q-access", stakeholder: "Decision", decision_id: "D1_ACCESS", category: "Can I access it?", question: "What access limitations, entrance constraints, road conditions, crossings, or blocked areas could affect ordinary, construction, or emergency access?", evidence_types: ["field.entrance", "field.blocked", "field.culvert", "field.wet", "field.ditch"] },
      { id: "Q-build", stakeholder: "Decision", decision_id: "D2_BUILD", category: "Can I build here?", question: "Which areas appear plausibly buildable, what evidence supports them, and which drainage, grade, soil, septic, utility, access, boundary, or permitting unknown could reverse that conclusion?", evidence_types: ["field.homesite", "field.high", "field.dry", "field.wet", "field.ditch", "field.entrance"] },
      { id: "Q-economics", stakeholder: "Decision", decision_id: "D3_ECONOMICS", category: "Can I make money here?", question: "Which income, development, timber, conservation, recreation, or resale possibilities are supported, and what missing fact prevents a credible value or yield conclusion?", evidence_types: ["field.timber", "field.tree", "field.homesite", "field.open", "field.entrance", "field.wildlife"] },
      { id: "Q-cost", stakeholder: "Decision", decision_id: "D4_COST_RISK", category: "What might cost me money?", question: "Which observed or suspected conditions could create acquisition, clearing, access, drainage, infrastructure, maintenance, insurance, legal, or permitting cost?", evidence_types: ["field.hazard", "field.blocked", "field.wet", "field.culvert", "field.ditch", "field.thick"] },
      { id: "Q-special", stakeholder: "Decision", decision_id: "D5_DISTINCTION", category: "What makes this property special?", question: "Which physical, ecological, visual, access, timber, recreational, or homesite features materially distinguish this property?", evidence_types: ["field.tree", "field.wildlife", "field.high", "field.open", "field.homesite", "field.timber", "field.wet"] },
      { id: "Q-buyer", stakeholder: "Buyer", decision_id: null, category: "Buyer Questions", question: "What facts could change the intended use, offer price, contingencies, financing, insurance, or willingness to close?", evidence_types: ["field.hazard", "field.blocked", "field.wet", "field.homesite", "field.entrance"] },
      { id: "Q-seller", stakeholder: "Seller", decision_id: null, category: "Seller Transparency", question: "Which observed conditions, known repairs, access arrangements, drainage history, boundaries, utilities, or recurring problems should the seller clarify with records or direct answers?", evidence_types: ["field.hazard", "field.blocked", "field.wet", "field.culvert", "field.entrance"] },
      { id: "Q-builder", stakeholder: "Builder", decision_id: "D2_BUILD", category: "Builder Questions", question: "What site access, clearing, grading, drainage, foundation, staging, utility, and material-delivery constraints should a builder price or verify?", evidence_types: ["field.homesite", "field.high", "field.wet", "field.thick", "field.entrance", "field.blocked"] },
      { id: "Q-developer", stakeholder: "Developer", decision_id: "D3_ECONOMICS", category: "Developer Questions", question: "What limits usable yield, road layout, lot placement, infrastructure cost, phasing, permitting, or marketable features?", evidence_types: ["field.homesite", "field.entrance", "field.wet", "field.high", "field.open", "field.blocked"] },
      { id: "Q-engineer", stakeholder: "Engineer", decision_id: "D4_COST_RISK", category: "Engineer Questions", question: "Which exact drainage, crossing, slope, access, foundation, or erosion question needs an engineer, and what evidence triggered it?", evidence_types: ["field.culvert", "field.ditch", "field.wet", "field.hazard", "field.high"] },
      { id: "Q-forester", stakeholder: "Forester", decision_id: "D3_ECONOMICS", category: "Forester Questions", question: "What species, diameter, quality, density, access, health, habitat, or merchantable-volume information is missing before timber conclusions are credible?", evidence_types: ["field.tree", "field.timber", "field.blocked", "field.wet"] },
      { id: "Q-coverage", stakeholder: "Inspector", decision_id: null, category: "Coverage", question: "Which portions of the subject parcel were not adequately walked, observed, or photographed, and which decision is most exposed by that gap?", evidence_types: [] }
    ];
    return questions.map(item => Object.assign({}, item, {
      supporting_observation_ids: manifest.inspection.observations.filter(observation => item.evidence_types.includes(observation.observation_type)).map(observation => observation.observation_id),
      evidence_present: item.evidence_types.length === 0 ? manifest.inspection.gps_track.length > 0 : item.evidence_types.some(type => types.has(type)),
      instructions: "Answer from package evidence when possible. If evidence is insufficient, place the question under Questions Remaining without asking the user before generating the report."
    }));
  }

  function createAiAnalysis(manifest, relationships, questions, decisionBrief, questionBrief, fieldCoaching) {
    return {
      schema_name: "property-intelligence-ai-analysis-package",
      schema_version: "1.1",
      executive_summary: {
        status: "GENERATE_FROM_EVIDENCE",
        instruction: "Write a concise decision summary after reviewing every section and actual media file. Lead with what the evidence means for access, buildability, economic potential, cost/risk, and distinctive value. Separate facts, public data, estimates, inspector thoughts, and recommendations.",
        verified_inputs: {
          inspection_id: manifest.inspection_id,
          property_id: manifest.property_id,
          inspection_date: manifest.inspection.conditions.inspection_date || manifest.inspection.started_at,
          distance_walked_miles: manifest.summary.distance_walked_miles,
          observation_count: manifest.summary.observation_count,
          photograph_count: manifest.summary.photo_count,
          voice_note_count: manifest.summary.voice_note_count,
          inspector_thought_count: manifest.summary.inspector_thought_count
        }
      },
      decision_framework: propertyDecisionFramework,
      decision_brief: decisionBrief,
      investigation_questions: questionBrief || (manifest.inspection.field_coaching && manifest.inspection.field_coaching.question_brief) || { questions: [] },
      inspection_areas: manifest.inspection.inspection_areas || [],
      coverage: fieldCoaching ? fieldCoaching.coverage : null,
      missing_evidence: fieldCoaching ? fieldCoaching.missing_evidence_review : null,
      return_visit_plan: fieldCoaching ? fieldCoaching.return_visit_plan : null,
      field_efficiency: fieldCoaching ? fieldCoaching.field_efficiency : null,
      small_tract_water_map: manifest.small_tract_water_map || null,
      stakeholder_questions: questions.reduce((groups, question) => {
        const key = String(question.stakeholder || "Other").toLowerCase().replace(/[^a-z0-9]+/g, "_");
        if (!groups[key]) groups[key] = [];
        groups[key].push(question);
        return groups;
      }, {}),
      property_information: manifest.property,
      inspection_conditions: manifest.inspection.conditions,
      weather_context: manifest.inspection.weather_context || {},
      inspection_statistics: manifest.inspection.metrics,
      gps_track: manifest.inspection.gps_track,
      observations: manifest.inspection.observations,
      photographs: manifest.photographs,
      voice_notes: manifest.voice_notes,
      inspector_thoughts: manifest.inspection.inspector_thoughts,
      inspector_hypotheses: manifest.inspection.inspector_hypotheses || [],
      field_evidence_review: manifest.inspection.field_evidence_review || null,
      professional_handoff_cards: manifest.inspection.professional_handoff_cards || { cards: [] },
      pearson_road_evidence_sequence: manifest.inspection.pearson_road_evidence_sequence || null,
      corrections_and_audit: {
        correction_count: manifest.summary.correction_count || 0,
        voided_record_count: manifest.summary.voided_record_count || 0,
        path: "EVIDENCE_AUDIT_HISTORY.json",
        rule: "Ignore voided records in findings. Do not erase or reinterpret their original audit entries."
      },
      map_layers: manifest.map_context.layers,
      weather: { weather_record_id: "weather-inspection-conditions", observed_site_conditions: manifest.inspection.conditions, context: manifest.inspection.weather_context || {}, limitations: "Weather context, observed site conditions, and inferred causes are separate. Station data may not represent the parcel, and one inspection does not establish year-round conditions." },
      terrain: manifest.map_context.layers.terrain,
      contours: manifest.map_context.layers.contours,
      parcel_boundary: manifest.map_context.subject_parcel,
      public_data: {
        parcel_source: manifest.map_context.layers.parcels,
        terrain_source: manifest.map_context.layers.terrain,
        contour_source: manifest.map_context.layers.contours,
        rule: "Treat public layers according to their source, retrieval date, resolution, and stated limitations. Do not present them as a survey or professional determination."
      },
      evidence_relationships: relationships,
      evidence_classifications: evidenceClassificationDefinitions,
      suggested_inspection_questions: questions,
      metadata: {
        package_format: manifest.format,
        package_format_version: manifest.format_version,
        package_mode: manifest.package_mode,
        exported_at: manifest.exported_at,
        repository: manifest.repository,
        canonical_record: "inspection.json",
        actual_photo_paths: manifest.photographs.map(photo => photo.analysis && photo.analysis.path),
        actual_voice_paths: manifest.voice_notes.map(voice => voice.audio.path)
      }
    };
  }

  function createAiReadme(manifest) {
    return `# Property Intelligence AI Analysis Package

## Start here

This package records one rural-property field inspection. Assume no prior knowledge of the property. Read \`EVIDENCE_AUDIT_HISTORY.json\`, \`DECISION_BRIEF.json\`, \`SMALL_TRACT_WATER_MAP.json\`, \`QUESTION_BRIEF.json\`, \`FIELD_EVIDENCE_REVIEW.json\`, \`FIELD_COACHING.json\`, and \`AI_ANALYSIS.json\` first, then inspect every active actual photograph and voice note referenced there. Open \`small-tract-water-map.html\` for the human-readable water map and \`professional-handoff-cards.html\` for one-page audience handoffs. Use \`REPORT_TEMPLATE.md\` to produce the complete report immediately. Do not ask the user to identify files or relationships.

The purpose is not to repeat the evidence. The purpose is to reduce uncertainty about five decisions:

1. Can I access it?
2. Can I build here?
3. Can I make money here?
4. What might cost me money?
5. What makes this property special?

Every observation includes \`decision_relevance\`. Treat its candidate effect as a routing aid, not a conclusion. Decide whether it is truly a strength, weakness, neutral fact, or unresolved issue only after reviewing the linked evidence and intended use.

## How the evidence fits together

- Every GPS point has a stable \`gps_point_id\`.
- Every observation directly names its GPS point and lists directly attached or nearest photographs and voice notes with distance and time differences.
- A photograph names a confirmed observation only when the inspector explicitly linked it. \`nearest_by_location_unconfirmed\` is a discovery aid and must never be treated as the photograph's meaning.
- Every photograph preserves GPS point, direction faced, timestamp, weather, map coordinates, actual analysis-image path, explicit photo meaning, and its Context/Evidence/Measurement/Relationship roles when entered.
- \`EVIDENCE_SETS.json\` groups inspector-confirmed multi-photo subjects. Describe each set once, then list each photograph and its role. Never count several views of one tree or water area as several subjects. Pending suggestions are not active groupings.
- Every voice note names its observation, GPS point, timestamp, and actual audio path.
- \`EVIDENCE_RELATIONSHIPS.json\` is the compact relationship graph. \`inspection.json\` remains the canonical record.
- \`DECISION_BRIEF.json\` groups evidence under the five decisions and provides the confidence and uncertainty-reduction rules.
- \`QUESTION_BRIEF.json\` contains the inspector's investigation questions and the evidence explicitly attached to each question.
- \`FIELD_COACHING.json\` separates well-inspected, lightly-inspected, and not-inspected route-proximity estimates; it also records missing evidence and field-efficiency estimates.
- \`RETURN_VISIT_PLAN.json\` prioritizes unvisited areas, unanswered questions, measurements, and photographs for the next visit.
- \`SMALL_TRACT_WATER_MAP.json\` isolates only the approximately 5.49-acre small tract. It excludes large-tract evidence by geometry, distinguishes photographed water from inferred outlines, keeps the flowing-water corridor separate from minor depressions, and never treats unvisited acreage as dry.
- \`small-tract-water-map.html\` provides layer toggles and opens the actual photograph and photo-linked voice explanation from each water marker.
- Every observation, photograph, and voice note records its inspection area and optional question relationships. Photographs are labeled Critical, Helpful, Reference, or Duplicate.
- \`INSPECTOR_THOUGHTS.md\` contains experience, theories, concerns, and preferences. These are useful interpretations, but they are not observed facts and must never be silently converted into facts.
- \`EVIDENCE_AUDIT_HISTORY.json\` preserves append-only corrections and any voided attachments. Ignore voided records in findings, maps, counts, and recommendations, but never erase their audit history.
- \`PROFESSIONAL_HANDOFF_CARDS.json\` and \`professional-handoff-cards.html\` identify exact questions, evidence, unknowns, and decisions for builders, engineers, surveyors, foresters, soil/septic professionals, buyers, and sellers. They do not replace licensed work.
- Inspector hypotheses are separate from observations. Do not state that a drainage or construction idea will work; preserve its exact professional-verification question and contrary evidence.
- \`CHAT_REVIEW_RETURN_INSTRUCTIONS.md\` and the review-annotation schema define how a later photo-by-photo conversation must return discrete Draft annotations. Never treat an entire chat or assistant wording as fact. Only inspector-approved Active annotations may change a report, and every change must cite the annotation ID, supporting evidence IDs, and approval date.

## Evidence classifications

${Object.entries(evidenceClassificationDefinitions).map(([name, meaning]) => `- **${name}:** ${meaning}`).join("\n")}

## Maps and public data

The walked route is in \`track.geojson\` and \`track.gpx\`. Parcel geometry is in \`context/parcels.geojson\`; source parcel records, terrain, contours, coordinate system, bounds, dates, and provenance are documented under \`context/\` and in \`AI_ANALYSIS.json\`. These layers provide context and do not replace a boundary survey, engineering determination, wetland delineation, appraisal, or other professional work.

## Weather

The \`weather\` section and \`WEATHER_CONTEXT.json\` keep four things separate: weather context, observed site conditions, inferred causes, and year-round conditions not established. Preserve any named event, its dates, elapsed days, source rainfall total, station-distance limitation, inspector-reported local rain, and whether rainfall, surge, or both may be relevant. If authoritative weather history is absent, say so under Questions Remaining; do not invent rainfall, station precision, causation, or year-round behavior.

## Generate the decision report

1. Reconcile counts in \`AI_ANALYSIS.json\` with the actual photo and voice files.
2. Review the route, parcel, terrain, contours, every active observation, every active photograph, every active voice note, every inspector thought, every inspector hypothesis, and the correction audit. Audit-only evidence is not a finding.
3. Answer every inspector-created investigation question and each of the five decisions directly. For each, identify supporting observations, supporting photographs, contradicting evidence, remaining uncertainty, an explained 0-100 confidence score, and the cheapest credible next investigation. Never output a score without this explanation.
4. Use \`REPORT_TEMPLATE.md\` in order. Cite observation IDs, photo numbers, voice-note IDs, GPS point IDs, and public-layer sources near material statements.
5. Separate supported findings from estimates, interpretations, and professional-verification items.
6. Answer the buyer, seller, builder, developer, engineer, and forester questions that the evidence supports. Put unresolved matters under Questions Remaining without interrupting report generation to ask the user.
7. Recommend professional follow-up only when evidence justifies it. Name the professional, the exact question, the triggering evidence, and which decision the answer could change.
8. Recommend the lowest-cost next evidence-gathering step before expensive professional work whenever that step can reliably reduce the uncertainty.

## Unanswered-question rule

A question remains unanswered when relevant evidence is absent, conflicting, spatially incomplete, marked Estimated or Needs Professional Verification, dependent on unprovided public data, or outside the capability of a field inspection. Absence of an observation is not proof that a condition does not exist. Never hide a critical unknown inside an average confidence score.

Inspection ID: \`${manifest.inspection_id}\`

Property ID: \`${manifest.property_id}\`

Package mode: \`${manifest.package_mode}\`
`;
  }

  function createReportTemplate() {
    return `# Property Intelligence Report

> Generate a decision report from the package evidence without asking the user to match files. Cite evidence identifiers. Clearly distinguish Observed, Measured, Estimated, Public Data, Interpretation, and Needs Professional Verification. Do not confuse a large amount of data with a high-confidence answer.

## Decision Summary

## Property Overview

## Inspection Conditions

## Decision Matrix

For each decision provide: direct answer, material evidence, strengths, weaknesses, unknowns, 0-100 confidence with explanation, cheapest next investigation, and professional follow-up only when justified.

## Can I Access It?

## Can I Build Here?

## Can I Make Money Here?

## What Might Cost Me Money?

## What Makes This Property Special?

## Strengths

Include only strengths supported by cited evidence and explain why each matters to a decision.

## Weaknesses

Include only weaknesses supported by cited evidence and explain the likely consequence without inventing cost.

## Unknowns and Coverage Gaps

For every material unknown state why it matters, what evidence is missing, and which decision it could change.

## What Changed the Assessment

## Inspection Statistics

## Questions Answered

Answer every inspector-created question from \`QUESTION_BRIEF.json\`; cite its linked evidence and state contradictions and remaining uncertainty.

## Questions Remaining

Never imply a conclusion about acreage classified Not Inspected.

## Inspection Areas

Compare the evidence by named area without guessing where unassigned legacy evidence belongs.

## Coverage: Well Inspected, Lightly Inspected, Not Inspected

State the route-proximity methodology and limitation. Coverage is an estimate, not proof of visibility or conditions.

## Lowest-Cost Next Investigation

Rank actions by uncertainty removed per dollar and per hour. Prefer records, targeted calls, simple measurements, and focused return visits when reliable.

## Estimated Confidence

Give a separate explained 0-100 score for each of the five decisions. Do not average away a critical unknown.

## Return Visit Plan

Prioritize unvisited areas, highest-value unanswered questions, suggested walking route, measurements, and photographs.

## Field Efficiency

Report estimated time walking, stopped, and documenting; observation spacing; photographs and observations per acre; and questions answered versus remaining.

## Buyer Questions

## Seller Transparency

## Builder Questions

## Developer Questions

## Engineer Questions

## Forester Questions

## Recommended Professional Follow-up

Name the professional, exact question, triggering evidence, expected decision value, and whether a cheaper preliminary step should happen first.

## Evidence Appendix

Include an evidence index, photograph index, route and map-layer summary, voice-note references, inspector-thought comparison, methodology, sources, assumptions, and limitations.
`;
  }

  function createInspectorThoughtsMarkdown(manifest) {
    const thoughts = manifest.inspection.inspector_thoughts || [];
    const header = `# Inspector Thoughts

These entries preserve the inspector's judgment, theory, concern, preference, and lived field experience. They are **not observed facts**. Analyze them separately, compare them with the evidence, and preserve them for later validation against subsequent inspections or professional findings.
`;
    if (!thoughts.length) return `${header}\nNo explicit inspector thoughts were recorded during this inspection. Do not infer thoughts from ordinary observations or notes.\n`;
    return `${header}\n${thoughts.map((thought, index) => `## Thought ${index + 1} — ${thought.thought_id}\n\n- Time: ${thought.thought_at || "Not recorded"}\n- Location: ${thought.gps.latitude}, ${thought.gps.longitude} (GPS accuracy ${thought.gps.accuracy_m} m)\n- GPS point: ${thought.gps_point_id || "Not available"}\n- Heading: ${thought.compass_heading_deg == null ? "Not available" : `${Math.round(thought.compass_heading_deg)} degrees`}\n- Classification: Interpretation — NOT AN OBSERVED FACT\n- Thought: ${thought.text || "No text recorded"}\n- Nearby photographs: ${thought.nearest_photographs.map(photo => photo.photo_number).join(", ") || "None"}\n- Nearby voice notes: ${thought.nearest_voice_notes.map(voice => voice.voice_note_id).join(", ") || "None"}\n`).join("\n")}\n`;
  }

  function createInspectorHypothesesMarkdown(manifest) {
    const hypotheses = manifest.inspection.inspector_hypotheses || [];
    const header = `# Inspector Hypotheses\n\nThese are interpretations requiring verification. They are not observed facts, engineering conclusions, or construction recommendations.\n`;
    if (!hypotheses.length) return `${header}\nNo inspector hypothesis was recorded.\n`;
    return `${header}\n${hypotheses.map((item, index) => `## Hypothesis ${index + 1} — ${item.hypothesis_id}\n\n- Classification: ${item.evidence_classification}\n- Factual status: ${item.factual_status}\n- Statement: ${item.statement}\n- Triggering observations: ${(item.triggering_observation_ids || []).join(", ") || "None linked"}\n- Supporting photographs: ${(item.supporting_photo_ids || []).join(", ") || "None linked"}\n- Contradicting evidence: ${(item.contradicting_evidence_ids || []).join(", ") || "None recorded"}\n- Exact verification question: ${item.verification_question}\n- Professional: ${item.professional_type}\n- Cheapest next evidence: ${item.cheapest_next_evidence_step || "Not entered"}\n- Prohibition: ${item.prohibition}\n`).join("\n")}`;
  }

  function createSuggestedQuestionsMarkdown(questions) {
    return `# Suggested Inspection Questions

Answer supported questions in the report. Move unsupported or incomplete questions to Questions Remaining without asking the user before generating the report.

${questions.map(question => `## ${question.category}\n\n${question.question}\n\n- Audience: ${question.stakeholder}\n- Decision: ${question.decision_id || "Cross-cutting"}\n- Evidence present: ${question.evidence_present ? "Yes" : "No or not specifically recorded"}\n- Supporting observations: ${question.supporting_observation_ids.join(", ") || "None specifically linked"}\n- Output rule: Answer when supported. Otherwise state the uncertainty and the lowest-cost credible way to resolve it.\n`).join("\n")}`;
  }

  function createProfessionalHandoffHtml(bundle) {
    const cards = bundle && bundle.cards || [];
    const pages = cards.map(card => `<section class="card"><h1>${htmlEscape(card.audience)} Professional Handoff</h1><h2>Exact question</h2><p class="question">${htmlEscape(card.exact_question)}</p><dl><dt>GPS location</dt><dd>${card.gps_location ? `${htmlEscape(card.gps_location.latitude)}, ${htmlEscape(card.gps_location.longitude)} (accuracy ${htmlEscape(card.gps_location.accuracy_m || "unknown")} m)` : "Use the linked map and evidence; no single verified point is assigned."}</dd><dt>Relevant map</dt><dd>${htmlEscape(card.relevant_map)}</dd><dt>Photographs</dt><dd>${htmlEscape(card.photograph_ids.join(", ") || "None specifically linked")}</dd><dt>Field observations</dt><dd>${htmlEscape(card.inspector_observation_ids.join(", ") || "None specifically linked")}</dd><dt>Inspector hypothesis — not an observed fact</dt><dd>${htmlEscape(card.inspector_hypothesis.statement)}</dd><dt>Weather and rainfall context</dt><dd>${htmlEscape(JSON.stringify(card.weather_and_rainfall_context))}</dd><dt>What remains unknown</dt><dd>${htmlEscape(card.unknowns.join("; "))}</dd><dt>Why the answer matters</dt><dd>${htmlEscape(card.why_answer_matters)}</dd><dt>Decision it could change</dt><dd>${htmlEscape(card.expected_decision_change)}</dd></dl><div class="warning">${htmlEscape(card.limitation)}</div></section>`).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Professional Handoff Cards</title><style>@page{size:letter portrait;margin:.55in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0}.card{min-height:9.7in;page-break-after:always;padding:.1in}.card:last-child{page-break-after:auto}h1{border-bottom:5px solid #173f5f;padding-bottom:8px;text-transform:capitalize}.question{font-size:19px;font-weight:800;border:3px solid #173f5f;padding:12px}dt{font-weight:800;margin-top:12px}dd{margin:3px 0 0}.warning{margin-top:18px;border:3px solid #8a4400;padding:10px;font-weight:800}</style></head><body>${pages || "<p>No professional handoff cards were generated.</p>"}</body></html>`;
  }

  async function createInspectionPackage(options) {
    const settings = options || {};
    const packageMode = settings.packageMode === "report" ? "report" : "full_archive";
    const includeOriginals = packageMode === "full_archive";
    const sourceInspection = cloneWithoutBinary(settings.inspection || {});
    sourceInspection.points = Array.isArray(sourceInspection.points) ? sourceInspection.points : [];
    sourceInspection.markers = Array.isArray(sourceInspection.markers) ? sourceInspection.markers : [];
    sourceInspection.photos = Array.isArray(sourceInspection.photos) ? sourceInspection.photos : [];
    sourceInspection.voice_notes = Array.isArray(sourceInspection.voice_notes) ? sourceInspection.voice_notes : [];
    sourceInspection.orientation_samples = Array.isArray(sourceInspection.orientation_samples) ? sourceInspection.orientation_samples : [];
    sourceInspection.lifecycle_events = Array.isArray(sourceInspection.lifecycle_events) ? sourceInspection.lifecycle_events : [];
    sourceInspection.investigation_questions = Array.isArray(sourceInspection.investigation_questions) ? sourceInspection.investigation_questions : [];
    sourceInspection.inspection_areas = Array.isArray(sourceInspection.inspection_areas) ? sourceInspection.inspection_areas : [];
    if (coachingTools) coachingTools.ensureInspectionModel(sourceInspection, sourceInspection.started || settings.exportedAt);
    if (governanceTools) governanceTools.ensureGovernanceModel(sourceInspection, settings.exportedAt);
    const governanceView = governanceTools ? governanceTools.buildEffectiveInspection(sourceInspection) : { active: sourceInspection, audit_history: { corrections: [] } };
    const inspection = governanceView.active;
    const photoEntries = Array.isArray(settings.photoEntries) ? settings.photoEntries : [];
    const voiceEntries = Array.isArray(settings.voiceEntries) ? settings.voiceEntries : [];
    if (photoEntries.length !== sourceInspection.photos.length) {
      throw new Error(`Photo storage mismatch: metadata has ${sourceInspection.photos.length}, but ${photoEntries.length} photograph files were recovered.`);
    }
    if (voiceEntries.length !== sourceInspection.voice_notes.length) {
      throw new Error(`Voice-note storage mismatch: metadata has ${sourceInspection.voice_notes.length}, but ${voiceEntries.length} audio files were recovered.`);
    }
    const mapContext = settings.mapContext || {};
    if (typeof mapContext.parcelsText !== "string") throw new Error("Parcel geometry is required in every inspection package.");
    let parcels;
    try {
      parcels = JSON.parse(mapContext.parcelsText);
    } catch (error) {
      throw new Error("Parcel geometry is not valid JSON.");
    }
    if (!parcels || !Array.isArray(parcels.features)) throw new Error("Parcel geometry does not contain a feature collection.");

    const exportedAt = settings.exportedAt || new Date().toISOString();
    const propertyName = settings.propertyName || "Pearson Road";
    const propertyFolder = safeRepositoryName(propertyName, "Property");
    const inspectionId = inspection.inspection_id || null;
    if (!inspectionId) throw new Error("An immutable inspection ID is required before repository packaging.");
    const inspectionFolder = `Inspection_${repositoryDate(inspection, exportedAt)}_${safeRepositoryName(inspectionId, "inspection").slice(-16)}`;
    const exportId = createExportId({ exportId: settings.exportId, packageMode, exportedAt });
    const fileName = `${propertyFolder}_Inspection_${includeOriginals ? "FULL_ARCHIVE" : "AI_ANALYSIS_REPORT_PACKAGE"}_${settings.packageKind === "backup" ? "Backup_" : ""}${packageTimestamp(exportedAt)}_${exportId}.zip`;
    const manifestPhotos = [];
    const zipPhotos = [];
    const manifestVoices = [];
    const zipVoices = [];

    for (let index = 0; index < sourceInspection.photos.length; index += 1) {
      const rawMetadata = sourceInspection.photos[index];
      const metadata = governanceTools ? governanceTools.effectiveRecord(sourceInspection, "photo", rawMetadata) : rawMetadata;
      const entry = photoEntries[index];
      if (!entry || String(entry.id) !== String(metadata.id) || !(entry.originalBlob instanceof Blob) || entry.originalBlob.size < 1) {
        throw new Error(`Photograph ${index + 1} is missing its original bytes. Package creation stopped.`);
      }
      if (metadata.original_size_bytes != null && Number(metadata.original_size_bytes) !== entry.originalBlob.size) {
        throw new Error(`Photograph ${index + 1} failed its byte-size check. Package creation stopped.`);
      }
      const number = String(index + 1).padStart(3, "0");
      const originalExt = extensionFor(metadata.original_filename, metadata.original_mime_type || entry.originalBlob.type, "bin");
      const auditPrefix = metadata.excluded_from_findings ? "audit/" : "";
      const fullArchivePath = `${auditPrefix}photos/${number}_original.${originalExt}`;
      const originalPath = includeOriginals ? fullArchivePath : null;
      const analysisBlob = entry.analysisBlob instanceof Blob && entry.analysisBlob.size ? entry.analysisBlob : null;
      if (!analysisBlob) throw new Error(`Photograph ${index + 1} is missing its analysis-safe image copy. Package creation stopped.`);
      const analysisExt = analysisBlob ? extensionFor("", analysisBlob.type, "jpg") : null;
      const analysisPath = analysisBlob ? `${auditPrefix}photos/${number}_analysis.${analysisExt}` : null;
      const originalHash = await sha256Hex(entry.originalBlob);
      const analysisHash = analysisBlob ? await sha256Hex(analysisBlob) : null;
      if (!originalHash || !analysisHash) throw new Error(`Photograph ${index + 1} could not be SHA-256 verified. Package creation stopped.`);
      if (metadata.original_sha256 && metadata.original_sha256 !== originalHash) throw new Error(`Photograph ${index + 1} original SHA-256 changed after capture. Package creation stopped.`);
      if (metadata.analysis_sha256 && metadata.analysis_sha256 !== analysisHash) throw new Error(`Photograph ${index + 1} analysis SHA-256 changed after capture. Package creation stopped.`);
      const recordedAt = metadata.recorded_at || metadata.time || null;

      manifestPhotos.push({
        photo_id: metadata.id,
        photo_number: metadata.photo_number || `P${index + 1}`,
        associated_marker_id: metadata.associated_marker_id || null,
        associated_observation_id: metadata.associated_observation_id || null,
        category: metadata.category || "Other",
        photo_value: metadata.photo_value || "Helpful",
        evidence_set_id: metadata.evidence_set_id || null,
        record_status: metadata.record_status || "active",
        excluded_from_findings: Boolean(metadata.excluded_from_findings),
        correction_ids: metadata.correction_ids || [],
        area_id: metadata.area_id || null,
        question_ids: Array.isArray(metadata.question_ids) ? metadata.question_ids.slice() : [],
        question_links: Array.isArray(metadata.question_links) ? metadata.question_links.map(link => Object.assign({}, link)) : [],
        note: metadata.note || "",
        evidence_classification: metadata.evidence_classification || "Observed",
        observation_attributes: metadata.observation_attributes || {},
        explanation_voice_note_id: metadata.explanation_voice_note_id || null,
        explanation_voice_note_ids: Array.isArray(metadata.explanation_voice_note_ids) ? metadata.explanation_voice_note_ids.slice() : (metadata.explanation_voice_note_id ? [metadata.explanation_voice_note_id] : []),
        explanation_status: metadata.explanation_status || null,
        photo_meaning: metadata.photo_meaning || null,
        water_confirmation: metadata.water_confirmation || null,
        water_reviewed_at: metadata.water_reviewed_at || null,
        water: metadata.water || null,
        camera_opened_at: metadata.camera_opened_at || null,
        recorded_at: recordedAt,
        source_file_last_modified_at: metadata.source_file_last_modified_at || null,
        compass_heading_deg: metadata.compass_heading_deg == null ? null : metadata.compass_heading_deg,
        location: {
          latitude: metadata.lat,
          longitude: metadata.lon,
          gps_accuracy_m: metadata.gps_accuracy_m,
          gps_position_at: metadata.gps_position_at || null,
          gps_position_age_ms: metadata.gps_position_age_ms == null ? null : metadata.gps_position_age_ms,
          source: metadata.location_source || "live_browser_geolocation"
        },
        orientation: {
          width_px: metadata.width_px == null ? null : metadata.width_px,
          height_px: metadata.height_px == null ? null : metadata.height_px,
          pixel_orientation: metadata.pixel_orientation || null,
          exif_value: metadata.exif_orientation == null ? null : metadata.exif_orientation,
          exif_description: metadata.exif_orientation_description || orientationDescription(metadata.exif_orientation),
          device_screen_type: metadata.device_screen_orientation || null,
          device_screen_angle_deg: metadata.device_screen_angle_deg == null ? null : metadata.device_screen_angle_deg,
          sensor: metadata.sensor_orientation || null,
          analysis_copy_orientation: analysisBlob ? "browser-rendered upright; EXIF removed" : null
        },
        original: {
          path: originalPath,
          full_archive_path: fullArchivePath,
          included_in_package: includeOriginals,
          omission_reason: includeOriginals ? null : "Exact original bytes are retained on the inspection device and omitted to keep the ChatGPT / report package uploadable.",
          source_filename: metadata.original_filename || null,
          mime_type: metadata.original_mime_type || entry.originalBlob.type || "application/octet-stream",
          size_bytes: entry.originalBlob.size,
          width_px: metadata.width_px == null ? null : metadata.width_px,
          height_px: metadata.height_px == null ? null : metadata.height_px,
          recorded_at: recordedAt,
          sha256: originalHash,
          provenance: metadata.legacy_resized_photo ? "legacy app resized copy; pre-upgrade original was unavailable" : "exact bytes supplied by the phone file input"
        },
        analysis: analysisBlob ? {
          path: analysisPath,
          mime_type: analysisBlob.type || "image/jpeg",
          size_bytes: analysisBlob.size,
          width_px: entry.analysisWidth == null ? (metadata.analysis_width_px == null ? null : metadata.analysis_width_px) : entry.analysisWidth,
          height_px: entry.analysisHeight == null ? (metadata.analysis_height_px == null ? null : metadata.analysis_height_px) : entry.analysisHeight,
          profile: entry.analysisProfile || metadata.analysis_profile || null,
          sha256: analysisHash
        } : null,
        thumbnail: analysisBlob ? {
          path: analysisPath,
          shares_analysis_copy: true,
          purpose: "Gallery and map preview without duplicating image bytes"
        } : null
      });
      zipPhotos.push({ photoId: metadata.id, excludedFromFindings: Boolean(metadata.excluded_from_findings), originalPath, fullArchivePath, originalBlob: entry.originalBlob, analysisPath, analysisBlob });
    }

    for (let index = 0; index < sourceInspection.voice_notes.length; index += 1) {
      const rawMetadata = sourceInspection.voice_notes[index];
      const metadata = governanceTools ? governanceTools.effectiveRecord(sourceInspection, "voice_note", rawMetadata) : rawMetadata;
      const entry = voiceEntries[index];
      if (!entry || String(entry.id) !== String(metadata.id) || !(entry.audioBlob instanceof Blob) || entry.audioBlob.size < 1) {
        throw new Error(`Voice note ${index + 1} is missing its audio bytes. Package creation stopped.`);
      }
      if (metadata.size_bytes != null && Number(metadata.size_bytes) !== entry.audioBlob.size) {
        throw new Error(`Voice note ${index + 1} failed its byte-size check. Package creation stopped.`);
      }
      const number = String(index + 1).padStart(3, "0");
      const extension = extensionFor("", metadata.mime_type || entry.audioBlob.type, "m4a");
      const path = `${metadata.excluded_from_findings ? "audit/" : ""}voice-notes/${number}_voice-note.${extension}`;
      const audioHash = await sha256Hex(entry.audioBlob);
      if (!audioHash) throw new Error(`Voice note ${index + 1} could not be SHA-256 verified. Package creation stopped.`);
      manifestVoices.push({
        voice_note_id: metadata.id,
        purpose: metadata.purpose || "general_field_note",
        photo_id: metadata.photo_id || null,
        evidence_set_id: metadata.evidence_set_id || null,
        prompt: metadata.prompt || null,
        record_status: metadata.record_status || "active",
        excluded_from_findings: Boolean(metadata.excluded_from_findings),
        correction_ids: metadata.correction_ids || [],
        area_id: metadata.area_id || null,
        question_ids: Array.isArray(metadata.question_ids) ? metadata.question_ids.slice() : [],
        question_links: Array.isArray(metadata.question_links) ? metadata.question_links.map(link => Object.assign({}, link)) : [],
        started_at: metadata.started_at || metadata.recorded_at || null,
        finished_at: metadata.finished_at || null,
        duration_ms: metadata.duration_ms == null ? null : metadata.duration_ms,
        location: {
          latitude: metadata.lat,
          longitude: metadata.lon,
          gps_accuracy_m: metadata.gps_accuracy_m,
          gps_position_at: metadata.gps_position_at || null,
          source: "live_browser_geolocation"
        },
        compass_heading_deg: metadata.compass_heading_deg == null ? null : metadata.compass_heading_deg,
        device_orientation: metadata.sensor_orientation || null,
        recovered_after_interruption: Boolean(metadata.recovered_after_interruption),
        audio: {
          path,
          mime_type: metadata.mime_type || entry.audioBlob.type || "application/octet-stream",
          size_bytes: entry.audioBlob.size,
          sha256: audioHash
        }
      });
      zipVoices.push({ path, audioBlob: entry.audioBlob });
    }

    const auditOnlyPhotos = manifestPhotos.filter(photo => photo.excluded_from_findings);
    const auditOnlyVoices = manifestVoices.filter(voice => voice.excluded_from_findings);
    const activePhotos = manifestPhotos.filter(photo => !photo.excluded_from_findings);
    const activeVoices = manifestVoices.filter(voice => !voice.excluded_from_findings);
    manifestPhotos.splice(0, manifestPhotos.length, ...activePhotos);
    manifestVoices.splice(0, manifestVoices.length, ...activeVoices);

    const subjectFeature = parcels.features.find(feature => String((feature.attributes || {}).PAR_NUM || "") === "221S280000001010000") || null;
    if (!subjectFeature) throw new Error("The subject parcel boundary is missing from the offline parcel context.");
    const subjectAttributes = subjectFeature.attributes || {};
    const mapMetadata = {
      coordinate_reference_system: "EPSG:4326 (WGS 84 longitude/latitude)",
      bounds_wgs84: { west: -87.1, south: 30.4825, east: -87.083, north: 30.497 },
      raster_size_pixels: { width: 1800, height: 1500 },
      subject_parcel: {
        property_id: `parcel:${subjectAttributes.PAR_NUM}`,
        parcel_number: String(subjectAttributes.PAR_NUM),
        display_parcel_number: subjectAttributes.ParcelDisp || null,
        recorded_acres: subjectAttributes.CALC_ACRE == null ? null : subjectAttributes.CALC_ACRE,
        geometry_path: "context/parcels.geojson"
      },
      surrounding_parcel_count: Math.max(0, parcels.features.length - 1),
      layers: {
        parcels: {
          path: "context/parcels.geojson",
          source_record_path: "context/parcels.arcgis.json",
          source: "county ParcelsOpenData FeatureServer/0",
          retrieved_at: "2026-08-02"
        },
        terrain: {
          path: "context/usgs-terrain.png",
          source: "USGS 3DEP Elevation ImageServer — Hillshade Elevation Tinted",
          retrieved_at: "2026-08-02",
          available: Boolean(mapContext.terrainBlob instanceof Blob && mapContext.terrainBlob.size),
          size_bytes: mapContext.terrainBlob instanceof Blob ? mapContext.terrainBlob.size : null,
          sha256: mapContext.terrainBlob instanceof Blob ? await sha256Hex(mapContext.terrainBlob) : null
        },
        contours: {
          path: "context/usgs-contours-2ft.png",
          source: "USGS 3DEP Elevation ImageServer — Preset 2ft Contour Interval",
          interval_feet: 2,
          retrieved_at: "2026-08-02",
          available: Boolean(mapContext.contourBlob instanceof Blob && mapContext.contourBlob.size),
          size_bytes: mapContext.contourBlob instanceof Blob ? mapContext.contourBlob.size : null,
          sha256: mapContext.contourBlob instanceof Blob ? await sha256Hex(mapContext.contourBlob) : null
        }
      }
    };

    const coverage = coachingTools ? coachingTools.calculateCoverage({
      points: inspection.points,
      rings: subjectFeature.geometry && subjectFeature.geometry.rings,
      recordedAcres: mapMetadata.subject_parcel.recorded_acres
    }) : { status: "NOT_AVAILABLE", not_inspected: { percent: null, estimated_acres: null }, cells: [], unvisited_zone_centers: [] };
    const questionBrief = coachingTools ? coachingTools.createQuestionBrief(inspection) : { schema_name: "property-intelligence-investigation-questions", schema_version: "1.0", questions: [] };
    const missingEvidenceReview = coachingTools ? coachingTools.reviewMissingEvidence(inspection, coverage) : { important_questions_remaining: [], highest_value_next_actions: [] };
    const fieldEfficiency = coachingTools ? coachingTools.calculateFieldEfficiency(inspection, mapMetadata.subject_parcel.recorded_acres) : {};
    const returnVisitPlan = coachingTools ? coachingTools.createReturnVisitPlan(inspection, coverage, missingEvidenceReview) : {};
    const fieldCoaching = {
      schema_name: "property-intelligence-field-coaching",
      schema_version: "1.0",
      inspection_areas: inspection.inspection_areas,
      question_brief: questionBrief,
      coverage,
      missing_evidence_review: missingEvidenceReview,
      return_visit_plan: returnVisitPlan,
      field_efficiency: fieldEfficiency
    };

    const gpsTrack = normalizedGpsTrack(inspection.points);
    const thoughtEvents = inspection.markers.filter(event => event.record_class === "inspector_thought" || event.type === "thought" || event.observation_type === "field.thought");
    const evidenceEvents = inspection.markers.filter(event => !thoughtEvents.includes(event));
    const observations = evidenceEvents.map(event => ({
      observation_id: event.id || null,
      inspection_id: inspection.inspection_id || null,
      property_id: mapMetadata.subject_parcel.property_id,
      taxonomy_version: event.taxonomy_version || "property-observation-1.0",
      observation_type: event.observation_type || `field.${event.type}`,
      label: event.button_label || event.type,
      evidence_classification: event.evidence_classification || "Observed",
      area_id: event.area_id || null,
      question_ids: Array.isArray(event.question_ids) ? event.question_ids.slice() : [],
      question_links: Array.isArray(event.question_links) ? event.question_links.map(link => Object.assign({}, link)) : [],
      observed_at: event.time,
      geometry: { type: "Point", coordinates: [event.lon, event.lat] },
      gps: {
        latitude: event.lat,
        longitude: event.lon,
        accuracy_m: event.gps_accuracy_m,
        position_at: event.gps_position_at || null
      },
      compass_heading_deg: event.compass_heading_deg == null ? null : event.compass_heading_deg,
      device_orientation: event.device_orientation || null,
      note: event.note || "",
      attributes: event.attributes || {},
      attachments: {
        photo_id: event.photo_id || null,
        voice_note_id: event.voice_note_id || null,
        nearest_photographs: [],
        nearest_voice_notes: []
      },
      source: event.source || "button_press"
    }));
    observations.forEach((observation, index) => {
      const event = evidenceEvents[index];
      observation.decision_relevance = decisionRelevanceForObservation(observation);
      const gpsReference = nearestGpsReference(event, gpsTrack);
      observation.gps_point_id = gpsReference ? gpsReference.gps_point_id : null;
      observation.gps_point_reference = gpsReference;
      observation.attachments.nearest_photographs = nearestEvidence(event, manifestPhotos, {
        idField: "photo_id", targetId: event.id, directIds: [event.photo_id], linkField: "associated_observation_id"
      }).map(match => ({
        photo_id: match.item.photo_id,
        photo_number: match.item.photo_number,
        relationship: match.direct ? "direct" : "nearest_by_location",
        distance_m: match.distance_m,
        time_delta_ms: match.time_delta_ms,
        analysis_path: match.item.analysis && match.item.analysis.path
      }));
      observation.attachments.nearest_voice_notes = nearestEvidence(event, manifestVoices, {
        idField: "voice_note_id", targetId: event.id, directIds: [event.voice_note_id]
      }).map(match => ({
        voice_note_id: match.item.voice_note_id,
        relationship: match.direct ? "direct" : "nearest_by_location",
        distance_m: match.distance_m,
        time_delta_ms: match.time_delta_ms,
        audio_path: match.item.audio.path
      }));
    });

    const inspectorThoughts = thoughtEvents.map(event => {
      const gpsReference = nearestGpsReference(event, gpsTrack);
      return {
        thought_id: event.id,
        inspection_id: inspection.inspection_id,
        property_id: mapMetadata.subject_parcel.property_id,
        thought_at: event.time,
        text: event.note || "",
        record_class: "inspector_thought",
        evidence_classification: "Interpretation",
        area_id: event.area_id || null,
        question_ids: Array.isArray(event.question_ids) ? event.question_ids.slice() : [],
        question_links: Array.isArray(event.question_links) ? event.question_links.map(link => Object.assign({}, link)) : [],
        factual_status: "NOT_AN_OBSERVED_FACT",
        geometry: { type: "Point", coordinates: [event.lon, event.lat] },
        gps: { latitude: event.lat, longitude: event.lon, accuracy_m: event.gps_accuracy_m, position_at: event.gps_position_at || null },
        gps_point_id: gpsReference ? gpsReference.gps_point_id : null,
        gps_point_reference: gpsReference,
        compass_heading_deg: event.compass_heading_deg == null ? null : event.compass_heading_deg,
        device_orientation: event.device_orientation || null,
        nearest_photographs: nearestEvidence(event, manifestPhotos, { idField: "photo_id" }).map(match => ({ photo_id: match.item.photo_id, photo_number: match.item.photo_number, distance_m: match.distance_m, time_delta_ms: match.time_delta_ms, analysis_path: match.item.analysis && match.item.analysis.path })),
        nearest_voice_notes: nearestEvidence(event, manifestVoices, { idField: "voice_note_id" }).map(match => ({ voice_note_id: match.item.voice_note_id, distance_m: match.distance_m, time_delta_ms: match.time_delta_ms, audio_path: match.item.audio.path }))
      };
    });

    manifestPhotos.forEach(photo => {
      const target = { lat: photo.location.latitude, lon: photo.location.longitude, recorded_at: photo.recorded_at, gps_position_at: photo.location.gps_position_at };
      const gpsReference = nearestGpsReference(target, gpsTrack);
      const directObservationId = photo.associated_observation_id || photo.associated_marker_id || null;
      const observationMatches = nearestEvidence(target, evidenceEvents, { idField: "id", directIds: [directObservationId], limit: 3 });
      photo.observation_id = directObservationId;
      photo.observation_link_status = directObservationId ? "CONFIRMED_DIRECT" : "UNLINKED_DO_NOT_INFER_FROM_PROXIMITY";
      photo.nearest_observations = observationMatches.map(match => ({ observation_id: match.item.id, relationship: match.direct ? "direct" : "nearest_by_location_unconfirmed", distance_m: match.distance_m, time_delta_ms: match.time_delta_ms }));
      photo.gps_point_id = gpsReference ? gpsReference.gps_point_id : null;
      photo.gps_point_reference = gpsReference;
      photo.direction_faced = { heading_deg: photo.compass_heading_deg, cardinal: cardinalDirection(photo.compass_heading_deg) };
      photo.weather = { weather_record_id: "weather-inspection-conditions", path: "AI_ANALYSIS.json > weather" };
      photo.map_location = { property_id: mapMetadata.subject_parcel.property_id, longitude: photo.location.longitude, latitude: photo.location.latitude, parcel_boundary_path: mapMetadata.subject_parcel.geometry_path, track_path: "track.geojson" };
    });

    manifestVoices.forEach(voice => {
      const target = { lat: voice.location.latitude, lon: voice.location.longitude, started_at: voice.started_at, gps_position_at: voice.location.gps_position_at };
      const gpsReference = nearestGpsReference(target, gpsTrack);
      const directEvent = evidenceEvents.find(event => String(event.voice_note_id || "") === String(voice.voice_note_id));
      const observationMatches = nearestEvidence(target, evidenceEvents, { idField: "id", directIds: [directEvent && directEvent.id], limit: 3 });
      voice.observation_id = (directEvent && directEvent.id) || null;
      voice.observation_link_status = directEvent ? "CONFIRMED_DIRECT" : "UNLINKED_DO_NOT_INFER_FROM_PROXIMITY";
      voice.nearest_observations = observationMatches.map(match => ({ observation_id: match.item.id, relationship: match.direct ? "direct" : "nearest_by_location_unconfirmed", distance_m: match.distance_m, time_delta_ms: match.time_delta_ms }));
      voice.gps_point_id = gpsReference ? gpsReference.gps_point_id : null;
      voice.gps_point_reference = gpsReference;
    });

    const metrics = calculateInspectionMetrics(inspection, exportedAt);
    const schema = {
      schema_name: "property-intelligence-inspection",
      schema_version: "1.8",
      purpose: "Portable observations that can be imported across properties, compared without rewriting the field record, and evaluated against stable rural-property decisions.",
      stable_entities: ["property", "inspection", "inspection_export", "inspection_lifecycle_event", "inspection_area", "investigation_question", "gps_point", "observation", "inspector_thought", "inspector_hypothesis", "evidence_correction", "evidence_set", "evidence_set_event", "review_annotation", "weather_context", "attachment", "photo_explanation", "photo_meaning", "professional_handoff_card", "water_evidence", "water_area_cluster", "map_context", "coverage_estimate", "return_visit_plan"],
      observation_contract: {
        identity: ["observation_id", "inspection_id", "property_id"],
        classification: ["taxonomy_version", "observation_type", "label", "evidence_classification", "decision_relevance", "area_id", "question_ids", "question_links"],
        time_and_place: ["observed_at", "geometry", "gps"],
        optional_measurements: ["attributes", "compass_heading_deg", "device_orientation"],
        evidence_links: ["gps_point_id", "attachments.photo_id", "attachments.voice_note_id", "attachments.nearest_photographs", "attachments.nearest_voice_notes"]
      },
      inspector_thought_contract: "Inspector thoughts are interpretations and experience, not observed facts. Keep them separate from observations while preserving their time, place, heading, and nearby evidence.",
      inspector_hypothesis_contract: "Hypotheses are explicitly non-factual interpretations. Preserve their triggers, support, contradictions, exact verification question, professional type, and cheapest next evidence step. Never convert them into construction recommendations.",
      correction_contract: "Original records are immutable. Corrections are append-only records with identity, time, reason, corrected value, and active/corrected/voided status. Findings ignore voided records while audit history retains them.",
      evidence_set_contract: "Evidence Sets are inspector-confirmed subject relationships layered over immutable source records. A set may contain multiple photo locations and roles but represents one subject. Suggestions never activate silently.",
      review_annotation_contract: "Post-inspection chat review uses discrete property-intelligence-review-annotation/1.0 records. Entire chats are never facts. Only inspector-approved Active annotations affect derived reports and every material change must cite annotation ID, supporting evidence IDs, and approval time.",
      proximity_rule: "Spatial or temporal proximity is a discovery aid only. Never promote a nearby observation into a confirmed photograph or voice-note relationship.",
      coaching_contract: "Coverage is an explicitly limited route-proximity estimate. Questions and areas are permanent evidence relationships. Every recommendation must cite support, contradictions, remaining uncertainty, and the cheapest reliable next investigation.",
      water_contract: "User-confirmed water photographs are facts about inspection-time observations. Cluster outlines and building-avoidance areas are conservative interpretations, must retain every supporting evidence ID, and never establish surveyed wetland, drainage, soil, septic, groundwater, or year-round conditions.",
      extension_rule: "Add namespaced observation types and attributes; do not repurpose existing fields.",
      repository_rule: "Use property_id to compare properties, inspection_id to merge artifacts from one visit, and export_id to preserve every immutable package revision."
    };

    const smallTractWaterMap = waterTools ? waterTools.buildSmallTractWaterMapModel({
      inspection: Object.assign({}, inspection, {
        photos: manifestPhotos,
        observations,
        water_observation_rule: inspection.water_observation_rule || null
      }),
      subjectFeature,
      statedSmallTractAcres: 5.49,
      generatedAt: exportedAt
    }) : { status: "NOT_AVAILABLE", reason: "Water intelligence module was unavailable during packaging." };
    const fieldEvidenceReview = governanceTools ? governanceTools.createFieldEvidenceReview(inspection) : null;
    const evidenceSetSummaries = evidenceSetTools ? evidenceSetTools.createEvidenceSetSummaries(inspection) : { schema_name: "property-intelligence-evidence-set-index", schema_version: "1.0", sets: [] };
    const evidenceSetSuggestions = evidenceSetTools ? (sourceInspection.evidence_set_suggestions || []) : [];
    const allReviewAnnotations = sourceInspection.review_annotations || [];
    const activeReviewAnnotations = allReviewAnnotations.filter(item => item.approved_by_inspector === true && item.status === "Active");
    const postInspectionReview = { schema_name: "property-intelligence-post-inspection-review-layer", schema_version: "1.0", active_annotations: activeReviewAnnotations, audit_annotations: allReviewAnnotations, activation_rule: "Only inspector-approved Active annotations update current findings. Rejected, Superseded, and Draft annotations remain audit-only." };
    const professionalHandoffCards = governanceTools ? governanceTools.createProfessionalHandoffCards(inspection, "printable-report.html") : { cards: [] };
    const pearsonSequencePhotos = manifestPhotos.filter(photo => {
      const number = Number(String(photo.photo_number || "").replace(/\D/g, ""));
      return number >= 3 && number <= 11;
    });
    const pearsonRoadEvidenceSequence = {
      sequence_id: "pearson-large-tract-survey-flag-berm-water-p3-p11",
      inspector_directed_interpretation: "P3–P11 are the large-tract survey-flag / berm / water sequence.",
      photo_ids: pearsonSequencePhotos.map(photo => photo.photo_id),
      photo_numbers: pearsonSequencePhotos.map(photo => photo.photo_number),
      relationship_rule: "Treat these photographs as one inspector-directed sequence. Review each actual image and its confirmed meaning; do not borrow a category from a nearby button press.",
      conclusion_limit: "The sequence may support a drainage hypothesis but does not establish elevations, a lawful outlet, downstream capacity, right-of-way, permits, or effects on neighboring property."
    };
    const auditHistory = Object.assign({}, governanceView.audit_history || {}, {
      audit_only_photographs: auditOnlyPhotos,
      audit_only_voice_notes: auditOnlyVoices,
      correction_count: (sourceInspection.corrections || []).length,
      active_view_rule: "All report findings, maps, decision briefs, and AI evidence relationships use only active/corrected records. Voided records remain physically preserved here and under audit/ attachment paths."
    });

    const manifest = {
      format: FORMAT,
      format_version: FORMAT_VERSION,
      package_mode: includeOriginals ? "full_evidence_archive" : "chatgpt_report_package",
      analysis_profile: "chatgpt-property-intelligence-1.0",
      platform_schema: { name: schema.schema_name, version: schema.schema_version, path: "schema.json" },
      inspection_id: inspection.inspection_id || null,
      property_id: mapMetadata.subject_parcel.property_id,
      exported_at: exportedAt,
      package_kind: settings.packageKind === "backup" ? `${packageMode}_in_progress_backup` : `${packageMode}_finished_inspection`,
      app: {
        name: "Property Inspector",
        version: settings.appVersion || null,
        source_url: settings.sourceUrl || null
      },
      repository: {
        contract: "property-intelligence-repository-import/1.0",
        contract_path: "repository-import.json",
        property_name: propertyName,
        property_folder: propertyFolder,
        inspection_folder: inspectionFolder,
        inspection_path: `${propertyFolder}/${inspectionFolder}`,
        export_id: exportId,
        append_only: true,
        overwrite_allowed: false,
        comparison_key: mapMetadata.subject_parcel.property_id,
        merge_key: inspectionId
      },
      summary: {
        gps_track_point_count: inspection.points.length,
        field_event_count: inspection.markers.length,
        observation_count: observations.length,
        inspector_thought_count: inspectorThoughts.length,
        lifecycle_event_count: inspection.lifecycle_events.length,
        device_orientation_sample_count: inspection.orientation_samples.length,
        photo_count: manifestPhotos.length,
        source_photo_record_count: sourceInspection.photos.length,
        audit_only_photo_count: auditOnlyPhotos.length,
        original_photo_evidence_count: manifestPhotos.filter(photo => photo.original).length,
        original_photo_count: manifestPhotos.filter(photo => photo.original && photo.original.included_in_package).length,
        analysis_photo_count: manifestPhotos.filter(photo => photo.analysis).length,
        photo_explanation_count: manifestVoices.filter(voice => ["photo_explanation", "evidence_set_explanation"].includes(voice.purpose) && voice.photo_id).length,
        water_reviewed_photo_count: manifestPhotos.filter(photo => photo.water_confirmation).length,
        confirmed_water_photo_count: manifestPhotos.filter(photo => photo.water_confirmation === "yes").length,
        voice_note_count: manifestVoices.length,
        source_voice_note_record_count: sourceInspection.voice_notes.length,
        audit_only_voice_note_count: auditOnlyVoices.length,
        correction_count: (sourceInspection.corrections || []).length,
        voided_record_count: (auditHistory.voided_record_ids || []).length,
        inspector_hypothesis_count: (inspection.inspector_hypotheses || []).length,
        professional_handoff_card_count: (professionalHandoffCards.cards || []).length,
        evidence_set_count: (evidenceSetSummaries.sets || []).length,
        pending_evidence_set_suggestion_count: evidenceSetSuggestions.filter(item => item.status === "pending_inspector_confirmation").length,
        active_review_annotation_count: activeReviewAnnotations.length,
        elapsed_time_ms: metrics.elapsed_time_ms,
        active_movement_time_ms: metrics.active_movement_time_ms,
        stopped_time_ms: metrics.stopped_time_ms,
        distance_walked_m: metrics.distance_walked_m,
        distance_walked_miles: metrics.distance_walked_miles,
        investigation_question_count: inspection.investigation_questions.length,
        questions_answered_count: fieldEfficiency.questions_answered || 0,
        questions_remaining_count: fieldEfficiency.questions_remaining || 0,
        inspection_area_count: inspection.inspection_areas.length,
        well_inspected_percent_estimate: coverage.well_inspected ? coverage.well_inspected.percent : null,
        lightly_inspected_percent_estimate: coverage.lightly_inspected ? coverage.lightly_inspected.percent : null,
        not_inspected_percent_estimate: coverage.not_inspected ? coverage.not_inspected.percent : null
        ,small_tract_water_photo_count: smallTractWaterMap.water_photographs ? smallTractWaterMap.water_photographs.length : 0
        ,small_tract_water_cluster_count: smallTractWaterMap.water_area_clusters ? smallTractWaterMap.water_area_clusters.length : 0
      },
      property: mapMetadata.subject_parcel,
      inspection: {
        started_at: inspection.started || null,
        finished_at: inspection.stopped || null,
        conditions: inspection.conditions || {},
        weather_context: inspection.weather_context || {},
        metrics,
        lifecycle_events: inspection.lifecycle_events,
        gps_track: gpsTrack,
        device_orientation_samples: inspection.orientation_samples,
        field_events: inspection.markers,
        observations,
        inspector_thoughts: inspectorThoughts,
        inspector_hypotheses: inspection.inspector_hypotheses || [],
        corrections: sourceInspection.corrections || [],
        evidence_audit_history: auditHistory,
        field_evidence_review: fieldEvidenceReview,
        professional_handoff_cards: professionalHandoffCards,
        evidence_set_summaries: evidenceSetSummaries,
        evidence_set_suggestions: evidenceSetSuggestions,
        evidence_set_events: sourceInspection.evidence_set_events || [],
        post_inspection_review: postInspectionReview,
        pearson_road_evidence_sequence: pearsonRoadEvidenceSequence,
        investigation_questions: inspection.investigation_questions,
        inspection_areas: inspection.inspection_areas,
        field_coaching: fieldCoaching,
        water_observation_rule: inspection.water_observation_rule || null
      },
      photographs: manifestPhotos,
      voice_notes: manifestVoices,
      audit_history: auditHistory,
      small_tract_water_map: smallTractWaterMap,
      map_context: mapMetadata,
      files: {
        ai_readme: "AI_README.md",
        ai_analysis: "AI_ANALYSIS.json",
        decision_brief: "DECISION_BRIEF.json",
        question_brief: "QUESTION_BRIEF.json",
        field_coaching: "FIELD_COACHING.json",
        field_evidence_review: "FIELD_EVIDENCE_REVIEW.json",
        evidence_audit_history: "EVIDENCE_AUDIT_HISTORY.json",
        evidence_sets: "EVIDENCE_SETS.json",
        post_inspection_review: "POST_INSPECTION_REVIEW.json",
        weather_context: "WEATHER_CONTEXT.json",
        chat_review_return_instructions: "CHAT_REVIEW_RETURN_INSTRUCTIONS.md",
        review_annotation_schema: "schemas/property-intelligence-review-annotation.schema.json",
        professional_handoff_cards: "PROFESSIONAL_HANDOFF_CARDS.json",
        professional_handoff_printable: "professional-handoff-cards.html",
        return_visit_plan: "RETURN_VISIT_PLAN.json",
        small_tract_water_map: "SMALL_TRACT_WATER_MAP.json",
        small_tract_water_map_interactive: "small-tract-water-map.html",
        report_template: "REPORT_TEMPLATE.md",
        inspector_thoughts: "INSPECTOR_THOUGHTS.md",
        inspector_hypotheses: "INSPECTOR_HYPOTHESES.md",
        evidence_relationships: "EVIDENCE_RELATIONSHIPS.json",
        suggested_inspection_questions: "SUGGESTED_INSPECTION_QUESTIONS.md",
        instructions: "README.txt",
        chatgpt_reconstruction: "chatgpt-reconstruction.json",
        repository_import: "repository-import.json",
        repository_comparison: "repository-comparison.json",
        schema: "schema.json",
        canonical_record: "inspection.json",
        flat_event_table: "events.csv",
        observations_table: "observations.csv",
        flat_photo_table: "photos.csv",
        photo_index: "photo_index.json",
        printable_report: "printable-report.html",
        flat_voice_note_table: "voice-notes.csv",
        geojson: "track.geojson",
        gpx: "track.gpx",
        originals: includeOriginals ? "photos/*_original.*" : null,
        omitted_original_metadata: includeOriginals ? null : "inspection.json > photographs[].original and photo_index.json > photographs[].original",
        analysis_copies: "photos/*_analysis.*",
        voice_notes: "voice-notes/*",
        parcels: "context/parcels.geojson",
        parcel_source_record: "context/parcels.arcgis.json",
        terrain: "context/usgs-terrain.png",
        contours: "context/usgs-contours-2ft.png",
        map_context_metadata: "context/map-context.json"
      }
    };

    const photoIndex = {
      schema_name: "property-inspection-photo-index",
      schema_version: "1.0",
      inspection_id: manifest.inspection_id,
      property_id: manifest.property_id,
      photo_count: manifestPhotos.length,
      photographs: manifestPhotos
    };
    const reconstructionGuide = createReconstructionGuide(manifest);
    const evidenceRelationships = createEvidenceRelationships(manifest);
    const suggestedQuestions = createSuggestedInspectionQuestions(manifest);
    const decisionBrief = createDecisionBrief(manifest);
    const aiAnalysis = createAiAnalysis(manifest, evidenceRelationships, suggestedQuestions, decisionBrief, questionBrief, fieldCoaching);
    const aiReadme = createAiReadme(manifest);
    const reviewAnnotationSchema = createReviewAnnotationSchema();
    const chatReviewInstructions = createChatReviewInstructions(manifest);
    const reportTemplate = createReportTemplate();
    const inspectorThoughtsMarkdown = createInspectorThoughtsMarkdown(manifest);
    const inspectorHypothesesMarkdown = createInspectorHypothesesMarkdown(manifest);
    const suggestedQuestionsMarkdown = createSuggestedQuestionsMarkdown(suggestedQuestions);
    const professionalHandoffMarkdown = governanceTools ? governanceTools.handoffCardsMarkdown(professionalHandoffCards) : "# Professional Handoff Cards\n\nUnavailable.\n";
    const professionalHandoffHtml = createProfessionalHandoffHtml(professionalHandoffCards);
    const repositoryImport = createRepositoryImportManifest(manifest, fileName);
    const comparisonRecord = createRepositoryComparisonRecord(manifest);
    const printableReport = await createPrintableReport(manifest, parcels, mapContext, zipPhotos.filter(photo => !photo.excludedFromFindings).map(photo => ({ analysisBlob: photo.analysisBlob })));
    const interactiveWaterMap = createSmallTractWaterMapHtml(manifest);
    const zip = new ZipBuilder();
    const modifiedAt = new Date(exportedAt);
    zip.add("AI_README.md", aiReadme, { modifiedAt });
    zip.add("AI_ANALYSIS.json", JSON.stringify(aiAnalysis, null, 2) + "\n", { modifiedAt });
    zip.add("DECISION_BRIEF.json", JSON.stringify(decisionBrief, null, 2) + "\n", { modifiedAt });
    zip.add("QUESTION_BRIEF.json", JSON.stringify(questionBrief, null, 2) + "\n", { modifiedAt });
    zip.add("FIELD_COACHING.json", JSON.stringify(fieldCoaching, null, 2) + "\n", { modifiedAt });
    zip.add("FIELD_EVIDENCE_REVIEW.json", JSON.stringify(fieldEvidenceReview, null, 2) + "\n", { modifiedAt });
    zip.add("EVIDENCE_AUDIT_HISTORY.json", JSON.stringify(auditHistory, null, 2) + "\n", { modifiedAt });
    zip.add("EVIDENCE_SETS.json", JSON.stringify({ summaries: evidenceSetSummaries, pending_suggestions: evidenceSetSuggestions, append_only_events: sourceInspection.evidence_set_events || [] }, null, 2) + "\n", { modifiedAt });
    zip.add("POST_INSPECTION_REVIEW.json", JSON.stringify(postInspectionReview, null, 2) + "\n", { modifiedAt });
    zip.add("WEATHER_CONTEXT.json", JSON.stringify({ schema_name: "property-intelligence-weather-context", schema_version: "1.0", inspection_id: manifest.inspection_id, weather_context: manifest.inspection.weather_context || {}, observed_site_conditions: manifest.inspection.conditions || {}, interpretation_rules: ["Weather context is not an observed site condition.", "An inferred cause is not an observed fact.", "One inspection does not establish year-round conditions.", "A station total must retain its station-distance limitation."] }, null, 2) + "\n", { modifiedAt });
    zip.add("CHAT_REVIEW_RETURN_INSTRUCTIONS.md", chatReviewInstructions, { modifiedAt });
    zip.add("schemas/property-intelligence-review-annotation.schema.json", JSON.stringify(reviewAnnotationSchema, null, 2) + "\n", { modifiedAt });
    zip.add("PROFESSIONAL_HANDOFF_CARDS.json", JSON.stringify(professionalHandoffCards, null, 2) + "\n", { modifiedAt });
    zip.add("PROFESSIONAL_HANDOFF_CARDS.md", professionalHandoffMarkdown, { modifiedAt });
    zip.add("professional-handoff-cards.html", professionalHandoffHtml, { modifiedAt });
    zip.add("RETURN_VISIT_PLAN.json", JSON.stringify(returnVisitPlan, null, 2) + "\n", { modifiedAt });
    zip.add("SMALL_TRACT_WATER_MAP.json", JSON.stringify(smallTractWaterMap, null, 2) + "\n", { modifiedAt });
    zip.add("small-tract-water-map.html", interactiveWaterMap, { modifiedAt });
    zip.add("REPORT_TEMPLATE.md", reportTemplate, { modifiedAt });
    zip.add("INSPECTOR_THOUGHTS.md", inspectorThoughtsMarkdown, { modifiedAt });
    zip.add("INSPECTOR_HYPOTHESES.md", inspectorHypothesesMarkdown, { modifiedAt });
    zip.add("EVIDENCE_RELATIONSHIPS.json", JSON.stringify(evidenceRelationships, null, 2) + "\n", { modifiedAt });
    zip.add("SUGGESTED_INSPECTION_QUESTIONS.md", suggestedQuestionsMarkdown, { modifiedAt });
    zip.add("README.txt", makeReadme(manifest), { modifiedAt });
    zip.add("chatgpt-reconstruction.json", JSON.stringify(reconstructionGuide, null, 2) + "\n", { modifiedAt });
    zip.add("repository-import.json", JSON.stringify(repositoryImport, null, 2) + "\n", { modifiedAt });
    zip.add("repository-comparison.json", JSON.stringify(comparisonRecord, null, 2) + "\n", { modifiedAt });
    zip.add("schema.json", JSON.stringify(schema, null, 2) + "\n", { modifiedAt });
    zip.add("inspection.json", JSON.stringify(manifest, null, 2) + "\n", { modifiedAt });
    zip.add("events.csv", createCsv(inspection, manifestPhotos, manifestVoices), { modifiedAt });
    zip.add("observations.csv", createObservationsCsv(observations), { modifiedAt });
    zip.add("photos.csv", createPhotoCsv(manifestPhotos), { modifiedAt });
    zip.add("photo_index.json", JSON.stringify(photoIndex, null, 2) + "\n", { modifiedAt });
    zip.add("printable-report.html", printableReport, { modifiedAt });
    zip.add("voice-notes.csv", createVoiceCsv(manifestVoices), { modifiedAt });
    zip.add("track.geojson", createGeoJSON(inspection, manifestPhotos, manifestVoices) + "\n", { modifiedAt });
    zip.add("track.gpx", createGpx(inspection, manifestPhotos, manifestVoices), { modifiedAt });
    zip.add("context/map-context.json", JSON.stringify(mapMetadata, null, 2) + "\n", { modifiedAt });
    zip.add("context/parcels.geojson", JSON.stringify(createParcelGeoJSON(parcels), null, 2) + "\n", { modifiedAt });
    zip.add("context/parcels.arcgis.json", mapContext.parcelsText, { modifiedAt });
    if (mapContext.terrainBlob instanceof Blob && mapContext.terrainBlob.size) zip.add("context/usgs-terrain.png", mapContext.terrainBlob, { modifiedAt });
    if (mapContext.contourBlob instanceof Blob && mapContext.contourBlob.size) zip.add("context/usgs-contours-2ft.png", mapContext.contourBlob, { modifiedAt });
    zipPhotos.forEach(photo => {
      if (includeOriginals) zip.add(photo.fullArchivePath, photo.originalBlob, { modifiedAt });
      if (photo.analysisBlob) zip.add(photo.analysisPath, photo.analysisBlob, { modifiedAt });
    });
    zipVoices.forEach(note => zip.add(note.path, note.audioBlob, { modifiedAt }));
    (professionalHandoffCards.cards || []).forEach(card => {
      const audience = safeRepositoryName(card.audience, "professional").toLowerCase();
      zip.add(`professional-handoff/${audience}/${safeRepositoryName(card.card_id, "handoff")}.md`, governanceTools.handoffCardsMarkdown({ cards: [card] }), { modifiedAt });
    });

    const blob = await zip.build();
    return {
      blob,
      manifest,
      repositoryImport,
      fileName
    };
  }

  return {
    FORMAT,
    FORMAT_VERSION,
    ZipBuilder,
    crc32,
    createCsv,
    createObservationsCsv,
    createVoiceCsv,
    createGeoJSON,
    createGpx,
    createInspectionPackage,
    createRepositoryImportManifest,
    createRepositoryComparisonRecord,
    createEvidenceRelationships,
    createDecisionBrief,
    createSuggestedInspectionQuestions,
    createAiAnalysis,
    createAiReadme,
    createReviewAnnotationSchema,
    createChatReviewInstructions,
    createReportTemplate,
    createInspectorThoughtsMarkdown,
    createInspectorHypothesesMarkdown,
    estimateInspectionPackageSizes,
    calculateInspectionMetrics,
    createPrintableReport,
    dataUrlToBlob,
    extensionFor,
    sha256Hex,
    orientationDescription,
    parseExifOrientation
  };
});
