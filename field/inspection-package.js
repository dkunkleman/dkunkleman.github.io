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
      photo.oçŸ8ÞÚ$z{-®éÜj×Wf–FVæ6Uö6÷VçC¢Öæ–fW7E†÷F÷2æf–ÇFW"‡†÷FòÓâ†÷Fòæ÷&–v–æÂ’æÆVæwF‚À¢÷&–v–æÅ÷†÷Fõö6÷VçC¢Öæ–fW7E†÷F÷2æf–ÇFW"‡†÷FòÓâ†÷Fòæ÷&–v–æÂbb†÷Fòæ÷&–v–æÂæ–æ6ÇVFVEö–å÷6¶vR’æÆVæwF‚À¢æÇ—6—5÷†÷Fõö6÷VçC¢Öæ–fW7E†÷F÷2æf–ÇFW"‡†÷FòÓâ†÷FòææÇ—6—2’æÆVæwF‚À¢†÷FõöW‡ÆæF–öåö6÷VçC¢Öæ–fW7Efö–6W2æf–ÇFW"‡fö–6RÓâ²'†÷FõöW‡ÆæF–öâ"Â&Wf–FVæ6U÷6WEöW‡ÆæF–öâ%Òæ–æ6ÇVFW2‡fö–6RçW'÷6R’bbfö–6Rç†÷Fõö–B’æÆVæwF‚À¢vFW%÷&Wf–WvVE÷†÷Fõö6÷VçC¢Öæ–fW7E†÷F÷2æf–ÇFW"‡†÷FòÓâ†÷FòçvFW%ö6öæf—&ÖF–öâ’æÆVæwF‚À¢6öæf—&ÖVE÷vFW%÷†÷Fõö6÷VçC¢Öæ–fW7E†÷F÷2æf–ÇFW"‡†÷FòÓâ†÷FòçvFW%ö6öæf—&ÖF–öâÓÓÒ'–W2"’æÆVæwF‚À¢fö–6Uöæ÷FUö6÷VçC¢Öæ–fW7Efö–6W2æÆVæwF‚À¢6÷W&6U÷fö–6Uöæ÷FU÷&V6÷&Eö6÷VçC¢6÷W&6T–ç7V7F–öâçfö–6Uöæ÷FW2æÆVæwF‚À¢VF—EööæÇ•÷fö–6Uöæ÷FUö6÷VçC¢VF—DöæÇ•fö–6W2æÆVæwF‚À¢6÷'&V7F–öåö6÷VçC¢‡6÷W&6T–ç7V7F–öâæ6÷'&V7F–öç2ÇÂµÒ’æÆVæwF‚À¢fö–FVE÷&V6÷&Eö6÷VçC¢†VF—D†—7F÷'’çfö–FVE÷&V6÷&Eö–G2ÇÂµÒ’æÆVæwF‚À¢–ç7V7F÷%ö‡—÷F†W6—5ö6÷VçC¢†–ç7V7F–öâæ–ç7V7F÷%ö‡—÷F†W6W2ÇÂµÒ’æÆVæwF‚À¢&öfW76–öæÅö†æFöfeö6&Eö6÷VçC¢‡&öfW76–öæÄ†æFöfd6&G2æ6&G2ÇÂµÒ’æÆVæwF‚À¢Wf–FVæ6U÷6WEö6÷VçC¢†Wf–FVæ6U6WE7VÖÖ&–W2ç6WG2ÇÂµÒ’æÆVæwF‚À¢VæF–æuöWf–FVæ6U÷6WE÷7VvvW7F–öåö6÷VçC¢Wf–FVæ6U6WE7VvvW7F–öç2æf–ÇFW"†—FVÒÓâ—FVÒç7FGW2ÓÓÒ'VæF–æuö–ç7V7F÷%ö6öæf—&ÖF–öâ"’æÆVæwF‚À¢7F—fU÷&Wf–Wuöææ÷FF–öåö6÷VçC¢7F—fU&Wf–Wtææ÷FF–öç2æÆVæwF‚À¢VÆ6VE÷F–ÖUö×3¢ÖWG&–72æVÆ6VE÷F–ÖUö×2À¢7F—fUöÖ÷fVÖVçE÷F–ÖUö×3¢ÖWG&–72æ7F—fUöÖ÷fVÖVçE÷F–ÖUö×2À¢7F÷VE÷F–ÖUö×3¢ÖWG&–72ç7F÷VE÷F–ÖUö×2À¢F—7Fæ6U÷vÆ¶VEöÓ¢ÖWG&–72æF—7Fæ6U÷vÆ¶VEöÒÀ¢F—7Fæ6U÷vÆ¶VEöÖ–ÆW3¢ÖWG&–72æF—7Fæ6U÷vÆ¶VEöÖ–ÆW2À¢–çfW7F–vF–öå÷VW7F–öåö6÷VçC¢–ç7V7F–öâæ–çfW7F–vF–öå÷VW7F–öç2æÆVæwF‚À¢VW7F–öç5öç7vW&VEö6÷VçC¢f–VÆDVff–6–Væ7’çVW7F–öç5öç7vW&VBÇÂÀ¢VW7F–öç5÷&VÖ–æ–æuö6÷VçC¢f–VÆDVff–6–Væ7’çVW7F–öç5÷&VÖ–æ–ærÇÂÀ¢–ç7V7F–öåö&Vö6÷VçC¢–ç7V7F–öâæ–ç7V7F–öåö&V2æÆVæwF‚À¢vVÆÅö–ç7V7FVE÷W&6VçEöW7F–ÖFS¢6÷fW&vRçvVÆÅö–ç7V7FVBò6÷fW&vRçvVÆÅö–ç7V7FVBçW&6VçB¢çVÆÂÀ¢Æ–v‡FÇ•ö–ç7V7FVE÷W&6VçEöW7F–ÖFS¢6÷fW&vRæÆ–v‡FÇ•ö–ç7V7FVBò6÷fW&vRæÆ–v‡FÇ•ö–ç7V7FVBçW&6VçB¢çVÆÂÀ¢æ÷Eö–ç7V7FVE÷W&6VçEöW7F–ÖFS¢6÷fW&vRææ÷Eö–ç7V7FVBò6÷fW&vRææ÷Eö–ç7V7FVBçW&6VçB¢çVÆÀ¢Ç6ÖÆÅ÷G&7E÷vFW%÷†÷Fõö6÷VçC¢6ÖÆÅG&7EvFW$ÖçvFW%÷†÷Föw&‡2ò6ÖÆÅG&7EvFW$ÖçvFW%÷†÷Föw&‡2æÆVæwF‚¢ ¢Ç6ÖÆÅ÷G&7E÷vFW%ö6ÇW7FW%ö6÷VçC¢6ÖÆÅG&7EvFW$ÖçvFW%ö&Vö6ÇW7FW'2ò6ÖÆÅG&7EvFW$ÖçvFW%ö&Vö6ÇW7FW'2æÆVæwF‚¢ ¢ÒÀ¢&÷W'G“¢ÖÖWFFFç7V&¦V7E÷&6VÂÀ¢–ç7V7F–öã¢°¢7F'FVEöC¢–ç7V7F–öâç7F'FVBÇÂçVÆÂÀ¢f–æ—6†VEöC¢–ç7V7F–öâç7F÷VBÇÂçVÆÂÀ¢6öæF—F–öç3¢–ç7V7F–öâæ6öæF—F–öç2ÇÂ·ÒÀ¢vVF†W%ö6öçFW‡C¢–ç7V7F–öâçvVF†W%ö6öçFW‡BÇÂ·ÒÀ¢ÖWG&–72À¢Æ–fV7–6ÆUöWfVçG3¢–ç7V7F–öâæÆ–fV7–6ÆUöWfVçG2À¢w5÷G&6³¢w5G&6²À¢FWf–6Uö÷&–VçFF–öå÷6×ÆW3¢–ç7V7F–öâæ÷&–VçFF–öå÷6×ÆW2À¢f–VÆEöWfVçG3¢–ç7V7F–öâæÖ&¶W'2À¢ö'6W'fF–öç2À¢–ç7V7F÷%÷F†÷Vv‡G3¢–ç7V7F÷%F†÷Vv‡G2À¢–ç7V7F÷%ö‡—÷F†W6W3¢–ç7V7F–öâæ–ç7V7F÷%ö‡—÷F†W6W2ÇÂµÒÀ¢6÷'&V7F–öç3¢6÷W&6T–ç7V7F–öâæ6÷'&V7F–öç2ÇÂµÒÀ¢Wf–FVæ6UöVF—Eö†—7F÷'“¢VF—D†—7F÷'’À¢f–VÆEöWf–FVæ6U÷&Wf–Ws¢f–VÆDWf–FVæ6U&Wf–WrÀ¢&öfW76–öæÅö†æFöfeö6&G3¢&öfW76–öæÄ†æFöfd6&G2À¢Wf–FVæ6U÷6WE÷7VÖÖ&–W3¢Wf–FVæ6U6WE7VÖÖ&–W2À¢Wf–FVæ6U÷6WE÷7VvvW7F–öç3¢Wf–FVæ6U6WE7VvvW7F–öç2À¢Wf–FVæ6U÷6WEöWfVçG3¢6÷W&6T–ç7V7F–öâæWf–FVæ6U÷6WEöWfVçG2ÇÂµÒÀ¢÷7Eö–ç7V7F–öå÷&Wf–Ws¢÷7D–ç7V7F–öå&Wf–WrÀ¢V'6öå÷&öEöWf–FVæ6U÷6WVVæ6S¢V'6öå&öDWf–FVæ6U6WVVæ6RÀ¢–çfW7F–vF–öå÷VW7F–öç3¢–ç7V7F–öâæ–çfW7F–vF–öå÷VW7F–öç2À¢–ç7V7F–öåö&V3¢–ç7V7F–öâæ–ç7V7F–öåö&V2À¢f–VÆEö6ö6†–æs¢f–VÆD6ö6†–ærÀ¢vFW%öö'6W'fF–öå÷'VÆS¢–ç7V7F–öâçvFW%öö'6W'fF–öå÷'VÆRÇÂçVÆÀ¢ÒÀ¢†÷Föw&‡3¢Öæ–fW7E†÷F÷2À¢fö–6Uöæ÷FW3¢Öæ–fW7Efö–6W2À¢VF—Eö†—7F÷'“¢VF—D†—7F÷'’À¢6ÖÆÅ÷G&7E÷vFW%öÖ¢6ÖÆÅG&7EvFW$ÖÀ¢Öö6öçFW‡C¢ÖÖWFFFÀ¢f–ÆW3¢°¢•÷&VFÖS¢$•õ$TDÔRæÖB"À¢•öæÇ—6—3¢$•ôäÅ•4•2æ§6öâ"À¢FV6—6–öåö'&–Vc¢$DT4•4”ôåô%$”Tbæ§6öâ"À¢VW7F–öåö'&–Vc¢%TU5D”ôåô%$”Tbæ§6öâ"À¢f–VÆEö6ö6†–æs¢$d”TÄEô4ô4„”äræ§6öâ"À¢f–VÆEöWf–FVæ6U÷&Wf–Ws¢$d”TÄEôUd”DTä4Uõ$Ud”Uræ§6öâ"À¢Wf–FVæ6UöVF—Eö†—7F÷'“¢$Ud”DTä4UôTD•Eô„•5Dõ%’æ§6öâ"À¢Wf–FVæ6U÷6WG3¢$Ud”DTä4Uõ4UE2æ§6öâ"À¢÷7Eö–ç7V7F–öå÷&Wf–Ws¢%õ5Eô”å5T5D”ôåõ$Ud”Uræ§6öâ"À¢vVF†W%ö6öçFW‡C¢%tTD„U%ô4ôåDU…Bæ§6öâ"À¢6†E÷&Wf–Wu÷&WGW&åö–ç7G'V7F–öç3¢$4„Eõ$Ud”Uuõ$UEU$åô”å5E%T5D”ôå2æÖB"À¢&Wf–Wuöææ÷FF–öå÷66†VÖ¢'66†VÖ2÷&÷W'G’Ö–çFVÆÆ–vVæ6R×&Wf–WrÖææ÷FF–öâç66†VÖæ§6öâ"À¢&öfW76–öæÅö†æFöfeö6&G3¢%$ôdU54”ôäÅô„äDôdeô4$E2æ§6öâ"À¢&öfW76–öæÅö†æFöfe÷&–çF&ÆS¢'&öfW76–öæÂÖ†æFöfbÖ6&G2æ‡FÖÂ"À¢&WGW&å÷f—6—E÷Æã¢%$UEU$åõd•4•EõÄâæ§6öâ"À¢6ÖÆÅ÷G&7E÷vFW%öÖ¢%4ÔÄÅõE$5EõtDU%ôÔæ§6öâ"À¢6ÖÆÅ÷G&7E÷vFW%öÖö–çFW&7F—fS¢'6ÖÆÂ×G&7B×vFW"ÖÖæ‡FÖÂ"À¢&W÷'E÷FV×ÆFS¢%$Uõ%EõDTÕÄDRæÖB"À¢–ç7V7F÷%÷F†÷Vv‡G3¢$”å5T5Dõ%õD„õTt…E2æÖB"À¢–ç7V7F÷%ö‡—÷F†W6W3¢$”å5T5Dõ%ô…•õD„U4U2æÖB"À¢Wf–FVæ6U÷&VÆF–öç6†—3¢$Ud”DTä4Uõ$TÄD”ôå4„•2æ§6öâ"À¢7VvvW7FVEö–ç7V7F–öå÷VW7F–öç3¢%5TttU5DTEô”å5T5D”ôåõTU5D”ôå2æÖB"À¢–ç7G'V7F–öç3¢%$TDÔRçG‡B"À¢6†FwE÷&V6öç7G'V7F–öã¢&6†FwB×&V6öç7G'V7F–öâæ§6öâ"À¢&W÷6—F÷'•ö–×÷'C¢'&W÷6—F÷'’Ö–×÷'Bæ§6öâ"À¢&W÷6—F÷'•ö6ö×&—6öã¢'&W÷6—F÷'’Ö6ö×&—6öâæ§6öâ"À¢66†VÖ¢'66†VÖæ§6öâ"À¢6æöæ–6Å÷&V6÷&C¢&–ç7V7F–öâæ§6öâ"À¢fÆEöWfVçE÷F&ÆS¢&WfVçG2æ77b"À¢ö'6W'fF–öç5÷F&ÆS¢&ö'6W'fF–öç2æ77b"À¢fÆE÷†÷Fõ÷F&ÆS¢'†÷F÷2æ77b"À¢†÷Fõö–æFWƒ¢'†÷Fõö–æFW‚æ§6öâ"À¢&–çF&ÆU÷&W÷'C¢'&–çF&ÆR×&W÷'Bæ‡FÖÂ"À¢fÆE÷fö–6Uöæ÷FU÷F&ÆS¢'fö–6RÖæ÷FW2æ77b"À¢vVö§6öã¢'G&6²ævVö§6öâ"À¢wƒ¢'G&6²æw‚"À¢÷&–v–æÇ3¢–æ6ÇVFT÷&–v–æÇ2ò'†÷F÷2ò¥ö÷&–v–æÂâ¢"¢çVÆÂÀ¢öÖ—GFVEö÷&–v–æÅöÖWFFF¢–æ6ÇVFT÷&–v–æÇ2òçVÆÂ¢&–ç7V7F–öâæ§6öââ†÷Föw&‡5µÒæ÷&–v–æÂæB†÷Fõö–æFW‚æ§6öââ†÷Föw&‡5µÒæ÷&–v–æÂ"À¢æÇ—6—5ö6÷–W3¢'†÷F÷2ò¥öæÇ—6—2â¢"À¢fö–6Uöæ÷FW3¢'fö–6RÖæ÷FW2ò¢"À¢&6VÇ3¢&6öçFW‡B÷&6VÇ2ævVö§6öâ"À¢&6VÅ÷6÷W&6U÷&V6÷&C¢&6öçFW‡B÷&6VÇ2æ&6v—2æ§6öâ"À¢FW'&–ã¢&6öçFW‡B÷W6w2×FW'&–âçær"À¢6öçF÷W'3¢&6öçFW‡B÷W6w2Ö6öçF÷W'2Ó&gBçær"À¢Öö6öçFW‡EöÖWFFF¢&6öçFW‡BöÖÖ6öçFW‡Bæ§6öâ ¢Ð¢Ó° ¢6öç7B†÷Fô–æFW‚Ò°¢66†VÖöæÖS¢'&÷W'G’Ö–ç7V7F–öâ×†÷FòÖ–æFW‚"À¢66†VÖ÷fW'6–öã¢#ã"À¢–ç7V7F–öåö–C¢Öæ–fW7Bæ–ç7V7F–öåö–BÀ¢&÷W'G•ö–C¢Öæ–fW7Bç&÷W'G•ö–BÀ¢†÷Fõö6÷VçC¢Öæ–fW7E†÷F÷2æÆVæwF‚À¢†÷Föw&‡3¢Öæ–fW7E†÷F÷0¢Ó°¢6öç7B&V6öç7G'V7F–öäwV–FRÒ7&VFU&V6öç7G'V7F–öäwV–FR†Öæ–fW7B“°¢6öç7BWf–FVæ6U&VÆF–öç6†—2Ò7&VFTWf–FVæ6U&VÆF–öç6†—2†Öæ–fW7B“°¢6öç7B7VvvW7FVEVW7F–öç2Ò7&VFU7VvvW7FVD–ç7V7F–öåVW7F–öç2†Öæ–fW7B“°¢6öç7BFV6—6–öä'&–VbÒ7&VFTFV6—6–öä'&–Vb†Öæ–fW7B“°¢6öç7B”æÇ—6—2Ò7&VFT”æÇ—6—2†Öæ–fW7BÂWf–FVæ6U&VÆF–öç6†—2Â7VvvW7FVEVW7F–öç2ÂFV6—6–öä'&–VbÂVW7F–öä'&–VbÂf–VÆD6ö6†–ær“°¢6öç7B•&VFÖRÒ7&VFT•&VFÖR†Öæ–fW7B“°¢6öç7B&Wf–Wtææ÷FF–öå66†VÖÒ7&VFU&Wf–Wtææ÷FF–öå66†VÖ‚“°¢6öç7B6†E&Wf–Wt–ç7G'V7F–öç2Ò7&VFT6†E&Wf–Wt–ç7G'V7F–öç2†Öæ–fW7B“°¢6öç7B&W÷'EFV×ÆFRÒ7&VFU&W÷'EFV×ÆFR‚“°¢6öç7B–ç7V7F÷%F†÷Vv‡G4Ö&¶F÷vâÒ7&VFT–ç7V7F÷%F†÷Vv‡G4Ö&¶F÷vâ†Öæ–fW7B“°¢6öç7B–ç7V7F÷$‡—÷F†W6W4Ö&¶F÷vâÒ7&VFT–ç7V7F÷$‡—÷F†W6W4Ö&¶F÷vâ†Öæ–fW7B“°¢6öç7B7VvvW7FVEVW7F–öç4Ö&¶F÷vâÒ7&VFU7VvvW7FVEVW7F–öç4Ö&¶F÷vâ‡7VvvW7FVEVW7F–öç2“°¢6öç7B&öfW76–öæÄ†æFöfdÖ&¶F÷vâÒv÷fW&ææ6UFööÇ2òv÷fW&ææ6UFööÇ2æ†æFöfd6&G4Ö&¶F÷vâ‡&öfW76–öæÄ†æFöfd6&G2’¢"2&öfW76–öæÂ†æFöfb6&G5ÆåÆåVæf–Æ&ÆRåÆâ#°¢6öç7B&öfW76–öæÄ†æFöfd‡FÖÂÒ7&VFU&öfW76–öæÄ†æFöfd‡FÖÂ‡&öfW76–öæÄ†æFöfd6&G2“°¢6öç7B&W÷6—F÷'”–×÷'BÒ7&VFU&W÷6—F÷'”–×÷'DÖæ–fW7B†Öæ–fW7BÂf–ÆTæÖR“°¢6öç7B6ö×&—6öå&V6÷&BÒ7&VFU&W÷6—F÷'”6ö×&—6öå&V6÷&B†Öæ–fW7B“°¢6öç7B&–çF&ÆU&W÷'BÒv—B7&VFU&–çF&ÆU&W÷'B†Öæ–fW7BÂ&6VÇ2ÂÖ6öçFW‡BÂ¦—†÷F÷2æf–ÇFW"‡†÷FòÓâ†÷FòæW†6ÇVFVDg&öÔf–æF–æw2’æÖ‡†÷FòÓâ‡²æÇ—6—4&Æö#¢†÷FòææÇ—6—4&Æö"Ò’’“°¢6öç7B–çFW&7F—fUvFW$ÖÒ7&VFU6ÖÆÅG&7EvFW$Ö‡FÖÂ†Öæ–fW7B“°¢6öç7B¦—ÒæWr¦—'V–ÆFW"‚“°¢6öç7BÖöF–f–VDBÒæWrFFR†W‡÷'FVDB“°¢¦—æFB‚$•õ$TDÔRæÖB"Â•&VFÖRÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚$•ôäÅ•4•2æ§6öâ"Â¥4ôâç7G&–æv–g’†”æÇ—6—2ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚$DT4•4”ôåô%$”Tbæ§6öâ"Â¥4ôâç7G&–æv–g’†FV6—6–öä'&–VbÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%TU5D”ôåô%$”Tbæ§6öâ"Â¥4ôâç7G&–æv–g’‡VW7F–öä'&–VbÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚$d”TÄEô4ô4„”äræ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆD6ö6†–ærÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚$d”TÄEôUd”DTä4Uõ$Ud”Uræ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆDWf–FVæ6U&Wf–WrÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚$Ud”DTä4UôTD•Eô„•5Dõ%’æ§6öâ"Â¥4ôâç7G&–æv–g’†VF—D†—7F÷'’ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚$Ud”DTä4Uõ4UE2æ§6öâ"Â¥4ôâç7G&–æv–g’‡²7VÖÖ&–W3¢Wf–FVæ6U6WE7VÖÖ&–W2ÂVæF–æu÷7VvvW7F–öç3¢Wf–FVæ6U6WE7VvvW7F–öç2ÂVæEööæÇ•öWfVçG3¢6÷W&6T–ç7V7F–öâæWf–FVæ6U÷6WEöWfVçG2ÇÂµÒÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%õ5Eô”å5T5D”ôåõ$Ud”Uræ§6öâ"Â¥4ôâç7G&–æv–g’‡÷7D–ç7V7F–öå&Wf–WrÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%tTD„U%ô4ôåDU…Bæ§6öâ"Â¥4ôâç7G&–æv–g’‡²66†VÖöæÖS¢'&÷W'G’Ö–çFVÆÆ–vVæ6R×vVF†W"Ö6öçFW‡B"Â66†VÖ÷fW'6–öã¢#ã"Â–ç7V7F–öåö–C¢Öæ–fW7Bæ–ç7V7F–öåö–BÂvVF†W%ö6öçFW‡C¢Öæ–fW7Bæ–ç7V7F–öâçvVF†W%ö6öçFW‡BÇÂ·ÒÂö'6W'fVE÷6—FUö6öæF—F–öç3¢Öæ–fW7Bæ–ç7V7F–öâæ6öæF—F–öç2ÇÂ·ÒÂ–çFW'&WFF–öå÷'VÆW3¢²%vVF†W"6öçFW‡B—2æ÷Bâö'6W'fVB6—FR6öæF—F–öââ"Â$â–æfW'&VB6W6R—2æ÷Bâö'6W'fVBf7Bâ"Â$öæR–ç7V7F–öâFöW2æ÷BW7F&Æ—6‚–V"×&÷VæB6öæF—F–öç2â"Â$7FF–öâF÷FÂ×W7B&WF–â—G27FF–öâÖF—7Fæ6RÆ–Ö—FF–öââ%ÒÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚$4„Eõ$Ud”Uuõ$UEU$åô”å5E%T5D”ôå2æÖB"Â6†E&Wf–Wt–ç7G'V7F–öç2Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'66†VÖ2÷&÷W'G’Ö–çFVÆÆ–vVæ6R×&Wf–WrÖææ÷FF–öâç66†VÖæ§6öâ"Â¥4ôâç7G&–æv–g’‡&Wf–Wtææ÷FF–öå66†VÖÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%$ôdU54”ôäÅô„äDôdeô4$E2æ§6öâ"Â¥4ôâç7G&–æv–g’‡&öfW76–öæÄ†æFöfd6&G2ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%$ôdU54”ôäÅô„äDôdeô4$E2æÖB"Â&öfW76–öæÄ†æFöfdÖ&¶F÷vâÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚'&öfW76–öæÂÖ†æFöfbÖ6&G2æ‡FÖÂ"Â&öfW76–öæÄ†æFöfd‡FÖÂÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚%$UEU$åõd•4•EõÄâæ§6öâ"Â¥4ôâç7G&–æv–g’‡&WGW&åf—6—EÆâÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%4ÔÄÅõE$5EõtDU%ôÔæ§6öâ"Â¥4ôâç7G&–æv–g’‡6ÖÆÅG&7EvFW$ÖÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'6ÖÆÂ×G&7B×vFW"ÖÖæ‡FÖÂ"Â–çFW&7F—fUvFW$ÖÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚%$Uõ%EõDTÕÄDRæÖB"Â&W÷'EFV×ÆFRÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚$”å5T5Dõ%õD„õTt…E2æÖB"Â–ç7V7F÷%F†÷Vv‡G4Ö&¶F÷vâÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚$”å5T5Dõ%ô…•õD„U4U2æÖB"Â–ç7V7F÷$‡—÷F†W6W4Ö&¶F÷vâÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚$Ud”DTä4Uõ$TÄD”ôå4„•2æ§6öâ"Â¥4ôâç7G&–æv–g’†Wf–FVæ6U&VÆF–öç6†—2ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%5TttU5DTEô”å5T5D”ôåõTU5D”ôå2æÖB"Â7VvvW7FVEVW7F–öç4Ö&¶F÷vâÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚%$TDÔRçG‡B"ÂÖ¶U&VFÖR†Öæ–fW7B’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&6†FwB×&V6öç7G'V7F–öâæ§6öâ"Â¥4ôâç7G&–æv–g’‡&V6öç7G'V7F–öäwV–FRÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'&W÷6—F÷'’Ö–×÷'Bæ§6öâ"Â¥4ôâç7G&–æv–g’‡&W÷6—F÷'”–×÷'BÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'&W÷6—F÷'’Ö6ö×&—6öâæ§6öâ"Â¥4ôâç7G&–æv–g’†6ö×&—6öå&V6÷&BÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'66†VÖæ§6öâ"Â¥4ôâç7G&–æv–g’‡66†VÖÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&–ç7V7F–öâæ§6öâ"Â¥4ôâç7G&–æv–g’†Öæ–fW7BÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&WfVçG2æ77b"Â7&VFT77b†–ç7V7F–öâÂÖæ–fW7E†÷F÷2ÂÖæ–fW7Efö–6W2’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&ö'6W'fF–öç2æ77b"Â7&VFTö'6W'fF–öç477b†ö'6W'fF–öç2’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'†÷F÷2æ77b"Â7&VFU†÷Fô77b†Öæ–fW7E†÷F÷2’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'†÷Fõö–æFW‚æ§6öâ"Â¥4ôâç7G&–æv–g’‡†÷Fô–æFW‚ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'&–çF&ÆR×&W÷'Bæ‡FÖÂ"Â&–çF&ÆU&W÷'BÂ²ÖöF–f–VDBÒ“°¢¦—æFB‚'fö–6RÖæ÷FW2æ77b"Â7&VFUfö–6T77b†Öæ–fW7Efö–6W2’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'G&6²ævVö§6öâ"Â7&VFTvVô¥4ôâ†–ç7V7F–öâÂÖæ–fW7E†÷F÷2ÂÖæ–fW7Efö–6W2’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'G&6²æw‚"Â7&VFTw‚†–ç7V7F–öâÂÖæ–fW7E†÷F÷2ÂÖæ–fW7Efö–6W2’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&6öçFW‡BöÖÖ6öçFW‡Bæ§6öâ"Â¥4ôâç7G&–æv–g’†ÖÖWFFFÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&6öçFW‡B÷&6VÇ2ævVö§6öâ"Â¥4ôâç7G&–æv–g’†7&VFU&6VÄvVô¥4ôâ‡&6VÇ2’ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&6öçFW‡B÷&6VÇ2æ&6v—2æ§6öâ"ÂÖ6öçFW‡Bç&6VÇ5FW‡BÂ²ÖöF–f–VDBÒ“°¢–b†Ö6öçFW‡BçFW'&–ä&Æö"–ç7Fæ6Vöb&Æö"bbÖ6öçFW‡BçFW'&–ä&Æö"ç6—¦R’¦—æFB‚&6öçFW‡B÷W6w2×FW'&–âçær"ÂÖ6öçFW‡BçFW'&–ä&Æö"Â²ÖöF–f–VDBÒ“°¢–b†Ö6öçFW‡Bæ6öçF÷W$&Æö"–ç7Fæ6Vöb&Æö"bbÖ6öçFW‡Bæ6öçF÷W$&Æö"ç6—¦R’¦—æFB‚&6öçFW‡B÷W6w2Ö6öçF÷W'2Ó&gBçær"ÂÖ6öçFW‡Bæ6öçF÷W$&Æö"Â²ÖöF–f–VDBÒ“°¢¦—†÷F÷2æf÷$V6‚‡†÷FòÓâ°¢–b†–æ6ÇVFT÷&–v–æÇ2’¦—æFB‡†÷FòægVÆÄ&6†—fUF‚Â†÷Fòæ÷&–v–æÄ&Æö"Â²ÖöF–f–VDBÒ“°¢–b‡†÷FòææÇ—6—4&Æö"’¦—æFB‡†÷FòææÇ—6—5F‚Â†÷FòææÇ—6—4&Æö"Â²ÖöF–f–VDBÒ“°¢Ò“°¢¦—fö–6W2æf÷$V6‚†æ÷FRÓâ¦—æFB†æ÷FRçF‚Âæ÷FRæVF–ô&Æö"Â²ÖöF–f–VDBÒ’“°¢‡&öfW76–öæÄ†æFöfd6&G2æ6&G2ÇÂµÒ’æf÷$V6‚†6&BÓâ°¢6öç7BVF–Væ6RÒ6fU&W÷6—F÷'”æÖR†6&BæVF–Væ6RÂ'&öfW76–öæÂ"’çFôÆ÷vW$66R‚“°¢¦—æFB†&öfW76–öæÂÖ†æFöfbòG¶VF–Væ6WÒòG·6fU&W÷6—F÷'”æÖR†6&Bæ6&Eö–BÂ&†æFöfb"—ÒæÖFÂv÷fW&ææ6UFööÇ2æ†æFöfd6&G4Ö&¶F÷vâ‡²6&G3¢¶6&EÒÒ’Â²ÖöF–f–VDBÒ“°¢Ò“° ¢6öç7B&Æö"Òv—B¦—æ'V–ÆB‚“°¢&WGW&â°¢&Æö"À¢Öæ–fW7BÀ¢&W÷6—F÷'”–×÷'BÀ¢f–ÆTæÖP¢Ó°¢Ð ¢&WGW&â°¢dõ$ÔBÀ¢dõ$ÔEõdU%4”ôâÀ¢¦—'V–ÆFW"À¢7&33"À¢7&VFT77bÀ¢7&VFTö'6W'fF–öç477bÀ¢7&VFUfö–6T77bÀ¢7&VFTvVô¥4ôâÀ¢7&VFTw‚À¢7&VFT–ç7V7F–öå6¶vRÀ¢7&VFU&W÷6—F÷'”–×÷'DÖæ–fW7BÀ¢7&VFU&W÷6—F÷'”6ö×&—6öå&V6÷&BÀ¢7&VFTWf–FVæ6U&VÆF–öç6†—2À¢7&VFTFV6—6–öä'&–VbÀ¢7&VFU7VvvW7FVD–ç7V7F–öåVW7F–öç2À¢7&VFT”æÇ—6—2À¢7&VFT•&VFÖRÀ¢7&VFU&Wf–Wtææ÷FF–öå66†VÖÀ¢7&VFT6†E&Wf–Wt–ç7G'V7F–öç2À¢7&VFU&W÷'EFV×ÆFRÀ¢7&VFT–ç7V7F÷%F†÷Vv‡G4Ö&¶F÷vâÀ¢7&VFT–ç7V7F÷$‡—÷F†W6W4Ö&¶F÷vâÀ¢W7F–ÖFT–ç7V7F–öå6¶vU6—¦W2À¢6Æ7VÆFT–ç7V7F–öäÖWG&–72À¢7&VFU&–çF&ÆU&W÷'BÀ¢FFW&ÅFô&Æö"À¢W‡FVç6–öäf÷"À¢6†#Sd†W‚À¢÷&–VçFF–öäFW67&—F–öâÀ¢'6TW†–d÷&–VçFF–öà¢Ó°§Ò“°