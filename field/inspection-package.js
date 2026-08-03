(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.InspectionPackage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT = "pearson-road-inspection-package";
  const FORMAT_VERSION = "1.0";
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
      "photo_id", "recorded_at", "source_file_last_modified_at", "latitude", "longitude",
      "gps_accuracy_m", "gps_position_at", "gps_position_age_ms", "original_path", "original_name",
      "original_mime_type", "original_size_bytes", "original_sha256", "analysis_path",
      "analysis_mime_type", "analysis_size_bytes", "analysis_sha256", "width_px", "height_px",
      "pixel_orientation", "exif_orientation", "exif_orientation_description",
      "device_screen_orientation", "device_screen_angle_deg", "compass_heading_deg",
      "sensor_alpha_deg", "sensor_beta_deg", "sensor_gamma_deg"
    ]];
    (photos || []).forEach(photo => rows.push([
      photo.photo_id, photo.recorded_at, photo.source_file_last_modified_at,
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
      photo.orientation.sensor ? photo.orientation.sensor.gamma_deg : ""
    ]));
    return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function createVoiceCsv(voiceNotes) {
    const rows = [[
      "voice_note_id", "started_at", "finished_at", "duration_ms", "latitude", "longitude",
      "gps_accuracy_m", "gps_position_at", "compass_heading_deg", "audio_path", "mime_type",
      "size_bytes", "sha256", "recovered_after_interruption", "sensor_alpha_deg",
      "sensor_beta_deg", "sensor_gamma_deg"
    ]];
    (voiceNotes || []).forEach(note => rows.push([
      note.voice_note_id, note.started_at, note.finished_at, note.duration_ms,
      note.location.latitude, note.location.longitude, note.location.gps_accuracy_m,
      note.location.gps_position_at, note.compass_heading_deg, note.audio.path,
      note.audio.mime_type, note.audio.size_bytes, note.audio.sha256,
      note.recovered_after_interruption,
      note.device_orientation ? note.device_orientation.alpha_deg : "",
      note.device_orientation ? note.device_orientation.beta_deg : "",
      note.device_orientation ? note.device_orientation.gamma_deg : ""
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
          note: event.note || "",
          time: event.time,
          gps_accuracy_m: event.gps_accuracy_m,
          compass_heading_deg: event.compass_heading_deg == null ? null : event.compass_heading_deg,
          device_orientation: event.device_orientation || null,
          photo_id: event.photo_id || null,
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

  function compactTimestamp(value) {
    const date = new Date(value || Date.now());
    const safe = Number.isNaN(date.valueOf()) ? new Date() : date;
    return safe.toISOString().replaceAll("-", "").replaceAll(":", "").replace(".000", "");
  }

  function makeReadme(manifest) {
    return [
      "PROPERTY INSPECTOR — COMPLETE FIELD PACKAGE",
      "",
      "Upload this ZIP file directly to ChatGPT as one file.",
      "Start with inspection.json; it is the canonical, machine-readable record.",
      "",
      "Contents:",
      "- inspection.json: canonical record of the property, GPS track, observations, notes, photos, voice notes, headings, device orientation, and map context.",
      "- schema.json: stable, extensible observation contract for future cross-property analysis.",
      "- events.csv: flat table of every GPS point, inspection start/pause/resume/finish event, observation, and device-orientation sample.",
      "- photos.csv: flat photo index with coordinates, timestamps, orientation, paths, sizes, and SHA-256 hashes when available.",
      "- voice-notes.csv and voice-notes/: voice-note index and the actual audio files.",
      "- track.geojson: GIS-ready route and event points.",
      "- track.gpx: GPS exchange copy of the route and waypoints.",
      "- photos/NNN_original.ext: exact original bytes captured or selected on the phone.",
      "- photos/NNN_analysis.jpg: browser-rendered JPEG copy guaranteed for image analysis.",
      "- context/: subject and neighboring parcel geometry, USGS terrain, 2-foot contours, bounds, acreage, and source metadata.",
      "",
      `Inspection ID: ${manifest.inspection_id}`,
      `Started: ${manifest.inspection.started_at || "not recorded"}`,
      `Finished: ${manifest.inspection.finished_at || "not recorded"}`,
      `GPS points: ${manifest.summary.gps_track_point_count}`,
      `Field events: ${manifest.summary.field_event_count}`,
      `Photographs: ${manifest.summary.photo_count}`,
      `Voice notes: ${manifest.summary.voice_note_count}`,
      `Subject parcel: ${manifest.property.display_parcel_number || manifest.property.parcel_number}`,
      `Recorded acres: ${manifest.property.recorded_acres}`,
      "",
      "Integrity: ZIP CRC-32 protects every member. inspection.json and photos.csv also record photo byte sizes and SHA-256 hashes when the browser provided SHA-256.",
      "Original photographs are never replaced by the analysis copies. Both are included so the source evidence is preserved and each image remains easy to analyze.",
      "This package is self-contained. The analyst should not need to ask the field user for separate photos, map layers, notes, audio, or GPS files."
    ].join("\r\n") + "\r\n";
  }

  async function createInspectionPackage(options) {
    const settings = options || {};
    const inspection = cloneWithoutBinary(settings.inspection || {});
    inspection.points = Array.isArray(inspection.points) ? inspection.points : [];
    inspection.markers = Array.isArray(inspection.markers) ? inspection.markers : [];
    inspection.photos = Array.isArray(inspection.photos) ? inspection.photos : [];
    inspection.voice_notes = Array.isArray(inspection.voice_notes) ? inspection.voice_notes : [];
    inspection.orientation_samples = Array.isArray(inspection.orientation_samples) ? inspection.orientation_samples : [];
    inspection.lifecycle_events = Array.isArray(inspection.lifecycle_events) ? inspection.lifecycle_events : [];
    const photoEntries = Array.isArray(settings.photoEntries) ? settings.photoEntries : [];
    const voiceEntries = Array.isArray(settings.voiceEntries) ? settings.voiceEntries : [];
    if (photoEntries.length !== inspection.photos.length) {
      throw new Error(`Photo storage mismatch: metadata has ${inspection.photos.length}, but ${photoEntries.length} photograph files were recovered.`);
    }
    if (voiceEntries.length !== inspection.voice_notes.length) {
      throw new Error(`Voice-note storage mismatch: metadata has ${inspection.voice_notes.length}, but ${voiceEntries.length} audio files were recovered.`);
    }
    const mapContext = settings.mapContext || {};
    if (!(mapContext.terrainBlob instanceof Blob) || !mapContext.terrainBlob.size || !(mapContext.contourBlob instanceof Blob) || !mapContext.contourBlob.size || typeof mapContext.parcelsText !== "string") {
      throw new Error("Offline terrain, contours, and parcel geometry are required in every inspection package.");
    }
    let parcels;
    try {
      parcels = JSON.parse(mapContext.parcelsText);
    } catch (error) {
      throw new Error("Parcel geometry is not valid JSON.");
    }
    if (!parcels || !Array.isArray(parcels.features)) throw new Error("Parcel geometry does not contain a feature collection.");

    const exportedAt = settings.exportedAt || new Date().toISOString();
    const manifestPhotos = [];
    const zipPhotos = [];
    const manifestVoices = [];
    const zipVoices = [];

    for (let index = 0; index < inspection.photos.length; index += 1) {
      const metadata = inspection.photos[index];
      const entry = photoEntries[index];
      if (!entry || String(entry.id) !== String(metadata.id) || !(entry.originalBlob instanceof Blob) || entry.originalBlob.size < 1) {
        throw new Error(`Photograph ${index + 1} is missing its original bytes. Package creation stopped.`);
      }
      if (metadata.original_size_bytes != null && Number(metadata.original_size_bytes) !== entry.originalBlob.size) {
        throw new Error(`Photograph ${index + 1} failed its byte-size check. Package creation stopped.`);
      }
      const number = String(index + 1).padStart(3, "0");
      const originalExt = extensionFor(metadata.original_filename, metadata.original_mime_type || entry.originalBlob.type, "bin");
      const originalPath = `photos/${number}_original.${originalExt}`;
      const analysisBlob = entry.analysisBlob instanceof Blob && entry.analysisBlob.size ? entry.analysisBlob : null;
      if (!analysisBlob) throw new Error(`Photograph ${index + 1} is missing its analysis-safe image copy. Package creation stopped.`);
      const analysisExt = analysisBlob ? extensionFor("", analysisBlob.type, "jpg") : null;
      const analysisPath = analysisBlob ? `photos/${number}_analysis.${analysisExt}` : null;
      const originalHash = await sha256Hex(entry.originalBlob);
      const analysisHash = analysisBlob ? await sha256Hex(analysisBlob) : null;
      const recordedAt = metadata.recorded_at || metadata.time || null;

      manifestPhotos.push({
        photo_id: metadata.id,
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
          source_filename: metadata.original_filename || null,
          mime_type: metadata.original_mime_type || entry.originalBlob.type || "application/octet-stream",
          size_bytes: entry.originalBlob.size,
          sha256: originalHash,
          provenance: metadata.legacy_resized_photo ? "legacy app resized copy; pre-upgrade original was unavailable" : "exact bytes supplied by the phone file input"
        },
        analysis: analysisBlob ? {
          path: analysisPath,
          mime_type: analysisBlob.type || "image/jpeg",
          size_bytes: analysisBlob.size,
          sha256: analysisHash
        } : null
      });
      zipPhotos.push({ originalPath, originalBlob: entry.originalBlob, analysisPath, analysisBlob });
    }

    for (let index = 0; index < inspection.voice_notes.length; index += 1) {
      const metadata = inspection.voice_notes[index];
      const entry = voiceEntries[index];
      if (!entry || String(entry.id) !== String(metadata.id) || !(entry.audioBlob instanceof Blob) || entry.audioBlob.size < 1) {
        throw new Error(`Voice note ${index + 1} is missing its audio bytes. Package creation stopped.`);
      }
      if (metadata.size_bytes != null && Number(metadata.size_bytes) !== entry.audioBlob.size) {
        throw new Error(`Voice note ${index + 1} failed its byte-size check. Package creation stopped.`);
      }
      const number = String(index + 1).padStart(3, "0");
      const extension = extensionFor("", metadata.mime_type || entry.audioBlob.type, "m4a");
      const path = `voice-notes/${number}_voice-note.${extension}`;
      manifestVoices.push({
        voice_note_id: metadata.id,
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
          sha256: await sha256Hex(entry.audioBlob)
        }
      });
      zipVoices.push({ path, audioBlob: entry.audioBlob });
    }

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
          size_bytes: mapContext.terrainBlob.size,
          sha256: await sha256Hex(mapContext.terrainBlob)
        },
        contours: {
          path: "context/usgs-contours-2ft.png",
          source: "USGS 3DEP Elevation ImageServer — Preset 2ft Contour Interval",
          interval_feet: 2,
          retrieved_at: "2026-08-02",
          size_bytes: mapContext.contourBlob.size,
          sha256: await sha256Hex(mapContext.contourBlob)
        }
      }
    };

    const observations = inspection.markers.map(event => ({
      observation_id: event.id || null,
      inspection_id: inspection.inspection_id || null,
      property_id: mapMetadata.subject_parcel.property_id,
      taxonomy_version: event.taxonomy_version || "property-observation-1.0",
      observation_type: event.observation_type || `field.${event.type}`,
      label: event.button_label || event.type,
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
        voice_note_id: event.voice_note_id || null
      },
      source: event.source || "button_press"
    }));

    const schema = {
      schema_name: "property-intelligence-inspection",
      schema_version: "1.0",
      purpose: "Portable observations that can be imported across properties and compared without rewriting the field record.",
      stable_entities: ["property", "inspection", "inspection_lifecycle_event", "gps_point", "observation", "attachment", "map_context"],
      observation_contract: {
        identity: ["observation_id", "inspection_id", "property_id"],
        classification: ["taxonomy_version", "observation_type", "label"],
        time_and_place: ["observed_at", "geometry", "gps"],
        optional_measurements: ["attributes", "compass_heading_deg", "device_orientation"],
        evidence_links: ["attachments.photo_id", "attachments.voice_note_id"]
      },
      extension_rule: "Add namespaced observation types and attributes; do not repurpose existing fields."
    };

    const manifest = {
      format: FORMAT,
      format_version: FORMAT_VERSION,
      platform_schema: { name: schema.schema_name, version: schema.schema_version, path: "schema.json" },
      inspection_id: inspection.inspection_id || null,
      property_id: mapMetadata.subject_parcel.property_id,
      exported_at: exportedAt,
      app: {
        name: "Property Inspector",
        version: settings.appVersion || null,
        source_url: settings.sourceUrl || null
      },
      summary: {
        gps_track_point_count: inspection.points.length,
        field_event_count: inspection.markers.length,
        observation_count: observations.length,
        lifecycle_event_count: inspection.lifecycle_events.length,
        device_orientation_sample_count: inspection.orientation_samples.length,
        photo_count: manifestPhotos.length,
        original_photo_count: manifestPhotos.filter(photo => photo.original).length,
        analysis_photo_count: manifestPhotos.filter(photo => photo.analysis).length,
        voice_note_count: manifestVoices.length
      },
      property: mapMetadata.subject_parcel,
      inspection: {
        started_at: inspection.started || null,
        finished_at: inspection.stopped || null,
        lifecycle_events: inspection.lifecycle_events,
        gps_track: inspection.points,
        device_orientation_samples: inspection.orientation_samples,
        field_events: inspection.markers,
        observations
      },
      photographs: manifestPhotos,
      voice_notes: manifestVoices,
      map_context: mapMetadata,
      files: {
        instructions: "README.txt",
        schema: "schema.json",
        canonical_record: "inspection.json",
        flat_event_table: "events.csv",
        flat_photo_table: "photos.csv",
        flat_voice_note_table: "voice-notes.csv",
        geojson: "track.geojson",
        gpx: "track.gpx",
        originals: "photos/*_original.*",
        analysis_copies: "photos/*_analysis.*",
        voice_notes: "voice-notes/*",
        parcels: "context/parcels.geojson",
        parcel_source_record: "context/parcels.arcgis.json",
        terrain: "context/usgs-terrain.png",
        contours: "context/usgs-contours-2ft.png",
        map_context_metadata: "context/map-context.json"
      }
    };

    const zip = new ZipBuilder();
    const modifiedAt = new Date(exportedAt);
    zip.add("README.txt", makeReadme(manifest), { modifiedAt });
    zip.add("schema.json", JSON.stringify(schema, null, 2) + "\n", { modifiedAt });
    zip.add("inspection.json", JSON.stringify(manifest, null, 2) + "\n", { modifiedAt });
    zip.add("events.csv", createCsv(inspection, manifestPhotos, manifestVoices), { modifiedAt });
    zip.add("photos.csv", createPhotoCsv(manifestPhotos), { modifiedAt });
    zip.add("voice-notes.csv", createVoiceCsv(manifestVoices), { modifiedAt });
    zip.add("track.geojson", createGeoJSON(inspection, manifestPhotos, manifestVoices) + "\n", { modifiedAt });
    zip.add("track.gpx", createGpx(inspection, manifestPhotos, manifestVoices), { modifiedAt });
    zip.add("context/map-context.json", JSON.stringify(mapMetadata, null, 2) + "\n", { modifiedAt });
    zip.add("context/parcels.geojson", JSON.stringify(createParcelGeoJSON(parcels), null, 2) + "\n", { modifiedAt });
    zip.add("context/parcels.arcgis.json", mapContext.parcelsText, { modifiedAt });
    zip.add("context/usgs-terrain.png", mapContext.terrainBlob, { modifiedAt });
    zip.add("context/usgs-contours-2ft.png", mapContext.contourBlob, { modifiedAt });
    zipPhotos.forEach(photo => {
      zip.add(photo.originalPath, photo.originalBlob, { modifiedAt });
      if (photo.analysisBlob) zip.add(photo.analysisPath, photo.analysisBlob, { modifiedAt });
    });
    zipVoices.forEach(note => zip.add(note.path, note.audioBlob, { modifiedAt }));

    const blob = await zip.build();
    return {
      blob,
      manifest,
      fileName: `Property_Inspection_${compactTimestamp(inspection.started || exportedAt)}.zip`
    };
  }

  return {
    FORMAT,
    FORMAT_VERSION,
    ZipBuilder,
    crc32,
    createCsv,
    createVoiceCsv,
    createGeoJSON,
    createGpx,
    createInspectionPackage,
    dataUrlToBlob,
    extensionFor,
    orientationDescription,
    parseExifOrientation
  };
});
