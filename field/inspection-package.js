(function (root, factory) {
  "use strict";
  const coaching = typeof module === "object" && module.exports ? require("./inspection-coaching.js") : (root && root.InspectionCoaching);
  const water = typeof module === "object" && module.exports ? require("./water-intelligence.js") : (root && root.WaterIntelligence);
  const governance = typeof module === "object" && module.exports ? require("./evidence-governance.js") : (root && root.EvidenceGovernance);
  const evidenceSets = typeof module === "object" && module.exports ? require("./evidence-sets.js") : (root && root.EvidenceSets);
  const timber = typeof module === "object" && module.exports ? require("./timber-reconnaissance.js") : (root && root.TimberReconnaissance);
  const synthesis = typeof module === "object" && module.exports ? require("./reviewed-property-synthesis.js") : (root && root.ReviewedPropertySynthesis);
  const valueEngine = typeof module === "object" && module.exports ? require("./property-value-engine.js") : (root && root.PropertyValueEngine);
  const fieldTruth = typeof module === "object" && module.exports ? require("./field-truth-engine.js") : (root && root.FieldTruthEngine);
  const guidedMission = typeof module === "object" && module.exports ? require("./guided-mission-orchestrator.js") : (root && root.GuidedMissionOrchestrator);
  const treeIdentification = typeof module === "object" && module.exports ? require("./tree-identification-engine.js") : (root && root.TreeIdentificationEngine);
  const fieldCaptureCoach = typeof module === "object" && module.exports ? require("./field-capture-coach.js") : (root && root.FieldCaptureCoach);
  const fieldMeasurements = typeof module === "object" && module.exports ? require("./field-measurement-engine.js") : (root && root.FieldMeasurementEngine);
  const treeNetwork = typeof module === "object" && module.exports ? require("./tree-network-engine.js") : (root && root.TreeNetworkEngine);
  const api = factory(coaching, water, governance, evidenceSets, timber, synthesis, valueEngine, fieldTruth, guidedMission, treeIdentification, fieldCaptureCoach, fieldMeasurements, treeNetwork);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.InspectionPackage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (coachingTools, waterTools, governanceTools, evidenceSetTools, timberTools, synthesisTools, valueTools, fieldTruthTools, missionTools, treeIdentificationTools, fieldCaptureCoachTools, fieldMeasurementTools, treeNetworkTools) {
  "use strict";

  const FORMAT = "pearson-road-inspection-package";
  const FORMAT_VERSION = "2.2";
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
      "photo_number", "photo_id", "photo_value", "evidence_set_id", "area_id", "question_ids", "question_links",ó]¸öÚ$z{-®éÜj×¢wV–FVDÖ—76–öäÖöFVÂæÆVv7•÷7FGW2ÇÂçVÆÂÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$Ô•54”ôåõ4´•õ$T4õ$E2æ§6öâ"Â¥4ôâç7G&–æv–g’‡²6¶—÷&V6÷&G3¢wV–FVDÖ—76–öäÖöFVÂæÖ—76–öå÷6¶—÷&V6÷&G2ÇÂµÒÂVæEööæÇ•÷&öw&W75öWfVçG3¢wV–FVDÖ—76–öäÖöFVÂæVæEööæÇ•÷&öw&W75öWfVçG2ÇÂµÒÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$”å5T5D”ôåôd”ä•4…õ$Ud”Uræ§6öâ"Â¥4ôâç7G&–æv–g’‡²f–æ—6…÷&Wf–Ww3¢wV–FVDÖ—76–öäÖöFVÂæ–ç7V7F–öåöf–æ—6…÷&Wf–Ww2ÇÂµÒÂ'VÆS¢%Væ¶æ÷vâÂVç6fRÂ6¶—VBÂæB66WFVBÖ–æ6ö×ÆWFR&R†öæW7B÷WF6öÖW3²æòÖ—76–ærç7vW"—2f'&–6FVBâ"ÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$uT”DTEô”å5T5D”ôåõ$Uõ%EôTäD•‚æÖB"ÂÖ—76–öåFööÇ2òÖ—76–öåFööÇ2æwV–FVDVæF—‚‡6÷W&6T–ç7V7F–öâ’¢"2wV–FVB–ç7V7F–öâÖ—76–öâVæF—…ÆåÆäuT”DTEôÔ•54”ôåôäõEôd”Ä$ÄUôEô4EU$UÆåÆääõõ$UE$õ5T5D•dUôÔ•54”ôåõ5DEU5Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUô”DTåD”d”4D”ôåõ4U54”ôå2æ§6öâ"Â¥4ôâç7G&–æv–g’‡²6W76–öç3¢G&VT–FVçF–f–6F–öäÖöFVÂç6W76–öç2ÇÂµÒÂÆVv7•÷7FGW3¢G&VT–FVçF–f–6F–öäÖöFVÂæÆVv7•÷7FGW2ÇÂçVÆÂÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUô”DTåD”d”4D”ôåôÔTD”æ§6öâ"Â¥4ôâç7G&–æv–g’‡²&VÆF–öç6†—3¢G&VT–FVçF–f–6F–öäÖöFVÂæF—&V7EöÖVF–ÇÂµÒÂ'VÆS¢$öæÇ’D•$T5BÖBÖ6GW&R&VÆF–öç6†—2–FVçF–g’F&vWB×G&VRWf–FVæ6S²Ö—†VB÷"Væ6W'F–âw&÷VæBÖFW&–ÂFöW2æ÷B&÷fR76ö6–F–öââ"ÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôd”TÄEõE$•E2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VT–FVçF–f–6F–öäÖöFVÂæf–VÆE÷G&—G2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôÔT5U$TÔTåE2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VT–FVçF–f–6F–öäÖöFVÂæÖV7W&VÖVçG2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUõ$Tt”ôäÅô4äD”DDU2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VT–FVçF–f–6F–öäÖöFVÂç&Vv–öæÅö6æF–FFW2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUõ$õd”DU%õ$U5TÅE2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VT–FVçF–f–6F–öäÖöFVÂç&÷f–FW%÷&W7VÇG2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUô4ôÔ$”äTEô4äD”DDU2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VT–FVçF–f–6F–öäÖöFVÂæ6öÖ&–æVEö6æF–FFW2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôDD•dUôUd”DTä4Uõ$UTU5E2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VT–FVçF–f–6F–öäÖöFVÂæFF—fU÷&WVW7G2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôU…U%EõdU$”d”4D”ôå2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VT–FVçF–f–6F–öäÖöFVÂæW‡W'E÷fW&–f–6F–öç2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUõ$TuTÄDõ%•ôdÄu2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VT–FVçF–f–6F–öäÖöFVÂç&VwVÆF÷'•öfÆw2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUô”DTåD”d”4D”ôåõ$Uõ%BæÖB"ÂG&VT–FVçF–f–6F–öå&W÷'BÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'G&VRÖ–FVçF–f–6F–öâÖÖæ‡FÖÂ"ÂG&VT–FVçF–f–6F–öäÖÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUô”DTåD”d”4D”ôåõ44ÄUô4$Bæ‡FÖÂ"ÂG&VU66ÆT6&BÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$dTEU$Uô4EU$Uô4ô4„”äuôUdTåE2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆD6GW&T6ö6„ÖöFVÂæ6ö6†–æuöWfVçG2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$d”TÄEô„TÅôÄ”%$%•õdU%4”ôâæ§6öâ"Â¥4ôâç7G&–æv–g’„ö&¦V7Bæ76–vâ‡·ÒÂf–VÆD6GW&T6ö6„ÖöFVÂæf–VÆEö†VÇöÆ–'&'•÷fW'6–öâÇÂ·ÒÂ²Æ–'&'“¢f–VÆD6GW&T6ö6„ÖöFVÂæ†VÇöÆ–'&'’ÇÂµÒÒ’ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$d”TÄEõE$õT$ÄU4„ôõD”äuõ$U5ôå4U2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆD6GW&T6ö6„ÖöFVÂçG&÷V&ÆW6†ö÷F–æu÷&W7öç6W2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$d”TÄEô•ô54•5Dä4UôUdTåE2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆD6GW&T6ö6„ÖöFVÂæ•ö76—7Fæ6UöWfVçG2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$dTEU$Uõ4U54”ôåô4ôÕÄUDTäU52æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆD6GW&T6ö6„ÖöFVÂæfVGW&U÷6W76–öåö6ö×ÆWFVæW72ÇÂ·ÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$dTEU$Uõ4U54”ôåôD•$T5EôÔTD”æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆD6GW&T6ö6„ÖöFVÂæfVGW&U÷6W76–öåöF—&V7EöÖVF–ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$ÔT5U$TÔTåEõDôôÅõ$Tt•5E%’æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆDÖV7W&VÖVçDÖöFVÂæÖV7W&VÖVçE÷FööÅ÷&Vv—7G'’ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%”$E5D”4µõtDU%ôÔT5U$TÔTåE2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆDÖV7W&VÖVçDÖöFVÂç–&G7F–6µ÷vFW%öÖV7W&VÖVçG2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUô4•$5TÔdU$Tä4UôÔT5U$TÔTåE2æ§6öâ"Â¥4ôâç7G&–æv–g’‚‡G&VT–FVçF–f–6F–öäÖöFVÂæÖV7W&VÖVçG2ÇÂµÒ’æf–ÇFW"†—FVÒÓâ—FVÒæÖV7W&VÖVçE÷G—RÓÓÒ%E$TUô4•$5TÔdU$Tä4R"’ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUô4Ä5TÄDTEôD$‚æ§6öâ"Â¥4ôâç7G&–æv–g’‚‡G&VT–FVçF–f–6F–öäÖöFVÂæÖV7W&VÖVçG2ÇÂµÒ’æf–ÇFW"†—FVÒÓâ—FVÒæÖV7W&VÖVçE÷G—RÓÓÒ%E$TUô4•$5TÔdU$Tä4R"’æÖ†—FVÒÓâ‡²G&VUöÖV7W&VÖVçEö–C¢—FVÒçG&VUöÖV7W&VÖVçEö–BÂG&VUö–FVçF–f–W#¢—FVÒçG&VUö–FVçF–f–W"Â÷&–v–æÅö6—&7VÖfW&Væ6U÷fÇVS¢—FVÒæ÷&–v–æÅö6—&7VÖfW&Væ6U÷fÇVRÂ÷&–v–æÅö6—&7VÖfW&Væ6U÷Væ—C¢—FVÒæ÷&–v–æÅö6—&7VÖfW&Væ6U÷Væ—BÂ6Æ7VÆF–öã¢—FVÒæ6Æ7VÆF–öâÂÆ–Ö—FF–öã¢—FVÒæÆ–Ö—FF–öç2Ò’’ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUõDUô4„T4µ2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆDÖV7W&VÖVçDÖöFVÂçG&VU÷FUö6†V6·2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUõ5DTÕôÔT5U$TÔTåE2æ§6öâ"Â¥4ôâç7G&–æv–g’‚‡G&VT–FVçF–f–6F–öäÖöFVÂæÖV7W&VÖVçG2ÇÂµÒ’æÖ†—FVÒÓâ‡²G&VUö–FVçF–f–W#¢—FVÒçG&VUö–FVçF–f–W"Â7FVÕö–C¢—FVÒç7FVÕö–BÂÖV7W&VÖVçC¢—FVÒÒ’’ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$4äD”DDUô$TôÔT5U$TÔTåE2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆDÖV7W&VÖVçDÖöFVÂæ6æF–FFUö&VöÖV7W&VÖVçG2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$4äD”DDUô$Tô5$õ55õ4T5D”ôå2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆDÖV7W&VÖVçDÖöFVÂæ6æF–FFUö&Vö7&÷75÷6V7F–öç2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$4äD”DDUô$TõU$”ÔUDU%2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆDÖV7W&VÖVçDÖöFVÂæ6æF–FFUö&V÷W&–ÖWFW'2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$4äD”DDUô$Tõ$TÄDTEôD•5Dä4U2æ§6öâ"Â¥4ôâç7G&–æv–g’†f–VÆDÖV7W&VÖVçDÖöFVÂæ6æF–FFUö&V÷&VÆFVEöF—7Fæ6W2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µôD•5Dä4Uôô%4U%dD”ôå2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂæF—7Fæ6Uöö'6W'fF–öç2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µô4Ä5TÄDTEôD•5Dä4U2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂæ6Æ7VÆFVEöF—7Fæ6W2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µôÄô4Åô4ôõ$D”äDU2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂæÆö6Åö6ö÷&F–æFW2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µôD¥U5DÔTåEõ$U5TÅE2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂæF§W7FÖVçE÷&W7VÇG2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µõ$U4”ETÅ2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂç&W6–GVÇ2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µõTä4U%D”åE’æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂçVæ6W'F–çG’ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µôäU…EôÔT5U$TÔTåEõ$T4ôÔÔTäDD”ôå2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂææW‡EöÖV7W&VÖVçE÷&V6öÖÖVæFF–öç2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µôä4„õ%2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂææ6†÷'2ÇÂµÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µôÄ”täÔTåEõ5DEU2æ§6öâ"Â¥4ôâç7G&–æv–g’‡G&VTæWGv÷&´ÖöFVÂæÆ–væÖVçE÷7FGW2ÇÂ·ÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%E$TUôäUEtõ$µôÔæ‡FÖÂ"ÂG&VTæWGv÷&´ÖÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%$õU%E•õdÅTUôTät”äRæ§6öâ"Â¥4ôâç7G&–æv–g’‡&÷W'G•fÇVTVæv–æRÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%dÅTUôE$•dU%ô„TEôÔ2æ§6öâ"Â¥4ôâç7G&–æv–g’‡&÷W'G•fÇVTVæv–æRæ†VEöÖ2ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'&÷W'G’×fÇVRÖ†VBÖÖæ‡FÖÂ"Â–çFW&7F—fUfÇVTÖÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%dÅTUôE$•dU%õ$Uõ%EôTäD•‚æÖB"ÂfÇVTVæv–æTVæF—‚Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$4„Eõ$Ud”Uuõ$UEU$åô”å5E%T5D”ôå2æÖB"Â6†E&Wf–Wt–ç7G'V7F–öç2Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'66†VÖ2÷&÷W'G’Ö–çFVÆÆ–vVæ6R×&Wf–WrÖææ÷FF–öâç66†VÖæ§6öâ"Â¥4ôâç7G&–æv–g’‡&Wf–Wtææ÷FF–öå66†VÖÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%$ôdU54”ôäÅô„äDôdeô4$E2æ§6öâ"Â¥4ôâç7G&–æv–g’‡&öfW76–öæÄ†æFöfd6&G2ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%$ôdU54”ôäÅô„äDôdeô4$E2æÖB"Â&öfW76–öæÄ†æFöfdÖ&¶F÷vâÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'&öfW76–öæÂÖ†æFöfbÖ6&G2æ‡FÖÂ"Â&öfW76–öæÄ†æFöfd‡FÖÂÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%$UEU$åõd•4•EõÄâæ§6öâ"Â¥4ôâç7G&–æv–g’‡&WGW&åf—6—EÆâÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%4ÔÄÅõE$5EõtDU%ôÔæ§6öâ"Â6¶vT§6öâ‡6ÖÆÅG&7EvFW$Ö’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚$dÄõt”äuõtDU%ô4õ%$”Dõ%2æ§6öâ"Â¥4ôâç7G&–æv–g’†fÆ÷v–æuvFW$6÷'&–F÷$ÖöFVÂÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%4TtÔTåDTEõ$õUDRæ§6öâ"Â6¶vT§6öâ‡&Wf–WvVE7–çF†W6—2ç&÷WFR’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%$Ud”UtTEõ$õU%E•õ5”åD„U4•2æ§6öâ"Â¥4ôâç7G&–æv–g’‡²66†VÖöæÖS¢&Wf–WvVE7–çF†W6—2ç66†VÖöæÖRÂ66†VÖ÷fW'6–öã¢&Wf–WvVE7–çF†W6—2ç66†VÖ÷fW'6–öâÂ&÷W'G•÷66÷S¢&Wf–WvVE7–çF†W6—2ç&÷W'G•÷66÷RÂ&Wf–Ws¢&Wf–WvVE7–çF†W6—2ç&Wf–WrÂv&æ–æw3¢&Wf–WvVE7–çF†W6—2çv&æ–æw2ÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$5$TTµô4õ%$”Dõ%ôÔæ§6öâ"Â6¶vT§6öâ‡&Wf–WvVE7–çF†W6—2æ7&VVµö6÷'&–F÷%öÖ’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&7&VV²Ö6÷'&–F÷"ÖÖæ‡FÖÂ"Â&Wf–WvVE7–çF†W6—2æÖö‡FÖÂæ7&VV²Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%dTtUDD”ôåô4ÄT$”äuôÔæ§6öâ"Â6¶vT§6öâ‡&Wf–WvVE7–çF†W6—2çfVvWFF–öåö6ÆV&–æuöÖ’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'fVvWFF–öâÖ6ÆV&–ærÖÖæ‡FÖÂ"Â&Wf–WvVE7–çF†W6—2æÖö‡FÖÂçfVvWFF–öâÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$„ôÔU4•DUôõõ%ETä•E•ôÔæ§6öâ"Â6¶vT§6öâ‡&Wf–WvVE7–çF†W6—2æ†öÖW6—FUö÷÷'GVæ—G•öÖ’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&†öÖW6—FRÖ÷÷'GVæ—G’ÖÖæ‡FÖÂ"Â&Wf–WvVE7–çF†W6—2æÖö‡FÖÂæ†öÖW6—FRÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%$õU%E•ô”åDTÄÄ”tTä4Uõ$Uõ%BæÖB"Â&Wf–WvVE7–çF†W6—2ç&÷W'G•÷&W÷'EöÖ&¶F÷vâÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'&÷W'G’Ö–çFVÆÆ–vVæ6R×&W÷'Bæ‡FÖÂ"Â&Wf–WvVE7–çF†W6—2ç&÷W'G•÷&W÷'Eö‡FÖÂÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'&–çF&ÆR×&÷W'G’×&W÷'Bæ‡FÖÂ"Â&Wf–WvVE7–çF†W6—2ç&÷W'G•÷&W÷'Eö‡FÖÂÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$TD”Tä4Uõ$Uõ%E2æ§6öâ"Â¥4ôâç7G&–æv–g’‡&Wf–WvVE7–çF†W6—2æVF–Væ6U÷&W÷'G2ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢‡&Wf–WvVE7–çF†W6—2æVF–Væ6U÷&W÷'G2ç&W÷'G2ÇÂµÒ’æf÷$V6‚‡&W÷'BÓâ¦—æFB‡&W÷'Bæf–ÆVæÖRÂ&W÷'BæÖ&¶F÷vâÂ²ÖöF–f–VDBÒ’“°Ğ¢¦—æFB‚%5E%T5EU$TEôÔT5U$TÔTåE2æ§6öâ"Â¥4ôâç7G&–æv–g’‡²66†VÖöæÖS¢'&÷W'G’Ö–çFVÆÆ–vVæ6R×7G'V7GW&VBÖÖV7W&VÖVçBÖ–æFW‚"Â66†VÖ÷fW'6–öã¢#ã"Â–ç7V7F–öåö–C¢Öæ–fW7Bæ–ç7V7F–öåö–BÂWF†÷&—G•÷'VÆS¢$–ç7V7F÷"ÖVçFW&VBçVÖW&–2fÇVW2&RWF†÷&—FF—fRâ†÷Föw&‡2&R7W÷'F–ærWf–FVæ6RÂæ÷BF†R6öÆR6÷W&6Rf÷"&VF–ærÖV7W&VÖVçG2â"ÂÖV7W&VÖVçG3¢7G'V7GW&VDÖV7W&VÖVçG2ÂVæF–æu÷7VvvW7F–öç3¢‡6÷W&6T–ç7V7F–öâæWf–FVæ6U÷6WE÷7VvvW7F–öç2ÇÂµÒ’æf–ÇFW"†—FVÒÓâ—FVÒç7VvvW7FVEöÖV7W&VÖVçBbb—FVÒç7FGW2ÓÓÒ'VæF–æuö–ç7V7F÷%ö6öæf—&ÖF–öâ"’ÒÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%$TÄ”Ô”ä%•õD”Ô$U%õ$T4ôää•54ä4Ræ§6öâ"Â¥4ôâç7G&–æv–g’‡F–Ö&W%&V6öææ—76æ6RÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$dõ$U5DU%ô„äDôdbæ§6öâ"Â¥4ôâç7G&–æv–g’†f÷&W7FW$†æFöfbÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$dõ$U5DU%ô„äDôdbæÖB"Âf÷&W7FW$†æFöfdÖ&¶F÷vâÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'6ÖÆÂ×G&7B×vFW"ÖÖæ‡FÖÂ"Â–çFW&7F—fUvFW$ÖÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%$Uõ%EõDTÕÄDRæÖB"Â&W÷'EFV×ÆFRÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$”å5T5Dõ%õD„õTt…E2æÖB"Â–ç7V7F÷%F†÷Vv‡G4Ö&¶F÷vâÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$”å5T5Dõ%ô…•õD„U4U2æÖB"Â–ç7V7F÷$‡—÷F†W6W4Ö&¶F÷vâÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚$Ud”DTä4Uõ$TÄD”ôå4„•2æ§6öâ"Â6¶vT§6öâ†Wf–FVæ6U&VÆF–öç6†—2’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚%5TttU5DTEô”å5T5D”ôåõTU5D”ôå2æÖB"Â7VvvW7FVEVW7F–öç4Ö&¶F÷vâÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚%$TDÔRçG‡B"ÂÖ¶U&VFÖR†Öæ–fW7B’Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚&6†FwB×&V6öç7G'V7F–öâæ§6öâ"Â¥4ôâç7G&–æv–g’‡&V6öç7G'V7F–öäwV–FRÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'&W÷6—F÷'’Ö–×÷'Bæ§6öâ"Â¥4ôâç7G&–æv–g’‡&W÷6—F÷'”–×÷'BÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'&W÷6—F÷'’Ö6ö×&—6öâæ§6öâ"Â6¶vT§6öâ†6ö×&—6öå&V6÷&B’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'66†VÖæ§6öâ"Â¥4ôâç7G&–æv–g’‡66†VÖÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚&–ç7V7F–öâæ§6öâ"Â6¶vT§6öâ†Öæ–fW7B’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚&WfVçG2æ77b"Â7&VFT77b†–ç7V7F–öâÂÖæ–fW7E†÷F÷2ÂÖæ–fW7Efö–6W2’Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚&ö'6W'fF–öç2æ77b"Â7&VFTö'6W'fF–öç477b†ö'6W'fF–öç2’Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'†÷F÷2æ77b"Â7&VFU†÷Fô77b†Öæ–fW7E†÷F÷2’Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'†÷Fõö–æFW‚æ§6öâ"Â6¶vT§6öâ‡†÷Fô–æFW‚’Â²ÖöF–f–VDBÒ“°¢¦—æFB‚'&–çF&ÆR×&W÷'Bæ‡FÖÂ"Â&–çF&ÆU&W÷'Ev—F…fÇVRÂ²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'fö–6RÖæ÷FW2æ77b"Â7&VFUfö–6T77b†Öæ–fW7Efö–6W2’Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'G&6²ævVö§6öâ"Â7&VFTvVô¥4ôâ†–ç7V7F–öâÂÖæ–fW7E†÷F÷2ÂÖæ–fW7Efö–6W2’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚'G&6²æw‚"Â7&VFTw‚†–ç7V7F–öâÂÖæ–fW7E†÷F÷2ÂÖæ–fW7Efö–6W2’Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚&6öçFW‡BöÖÖ6öçFW‡Bæ§6öâ"Â¥4ôâç7G&–æv–g’†ÖÖWFFFÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚&6öçFW‡B÷&6VÇ2ævVö§6öâ"Â¥4ôâç7G&–æv–g’†7&VFU&6VÄvVô¥4ôâ‡&6VÇ2’ÂçVÆÂÂ"’²%Æâ"Â²ÖöF–f–VDBÒ“°Ğ¢¦—æFB‚&6öçFW‡B÷&6VÇ2æ&6v—2æ§6öâ"ÂÖ6öçFW‡Bç&6VÇ5FW‡BÂ²ÖöF–f–VDBÒ“°Ğ¢–b†Ö6öçFW‡BçFW'&–ä&Æö"–ç7Fæ6Vöb&Æö"bbÖ6öçFW‡BçFW'&–ä&Æö"ç6—¦R’¦—æFB‚&6öçFW‡B÷W6w2×FW'&–âçær"ÂÖ6öçFW‡BçFW'&–ä&Æö"Â²ÖöF–f–VDBÒ“°Ğ¢–b†Ö6öçFW‡Bæ6öçF÷W$&Æö"–ç7Fæ6Vöb&Æö"bbÖ6öçFW‡Bæ6öçF÷W$&Æö"ç6—¦R’¦—æFB‚&6öçFW‡B÷W6w2Ö6öçF÷W'2Ó&gBçær"ÂÖ6öçFW‡Bæ6öçF÷W$&Æö"Â²ÖöF–f–VDBÒ“°Ğ¢¦—†÷F÷2æf÷$V6‚‡†÷FòÓâ°Ğ¢–b†–æ6ÇVFT÷&–v–æÇ2’¦—æFB‡†÷FòægVÆÄ&6†—fUF‚Â†÷Fòæ÷&–v–æÄ&Æö"Â²ÖöF–f–VDBÒ“°Ğ¢–b‡†÷FòææÇ—6—4&Æö"’¦—æFB‡†÷FòææÇ—6—5F‚Â†÷FòææÇ—6—4&Æö"Â²ÖöF–f–VDBÒ“°Ğ¢–b‡†÷Fòæææ÷FFVD&Æö"’¦—æFB‡†÷Fòæææ÷FFVEF‚Â†÷Fòæææ÷FFVD&Æö"Â²ÖöF–f–VDBÒ“°Ğ¢Ò“°Ğ¢¦—fö–6W2æf÷$V6‚†æ÷FRÓâ¦—æFB†æ÷FRçF‚Âæ÷FRæVF–ô&Æö"Â²ÖöF–f–VDBÒ’“°Ğ¢‡&öfW76–öæÄ†æFöfd6&G2æ6&G2ÇÂµÒ’æf÷$V6‚†6&BÓâ°Ğ¢6öç7BVF–Væ6RÒ6fU&W÷6—F÷'”æÖR†6&BæVF–Væ6RÂ'&öfW76–öæÂ"’çFôÆ÷vW$66R‚“°Ğ¢¦—æFB†&öfW76–öæÂÖ†æFöfbòG¶VF–Væ6WÒòG·6fU&W÷6—F÷'”æÖR†6&Bæ6&Eö–BÂ&†æFöfb"—ÒæÖFÂv÷fW&ææ6UFööÇ2æ†æFöfd6&G4Ö&¶F÷vâ‡²6&G3¢¶6&EÒÒ’Â²ÖöF–f–VDBÒ“°Ğ¢Ò“°Ğ Ğ¢6öç7B&Æö"Òv—B¦—æ'V–ÆB‚“°Ğ¢&WGW&â°Ğ¢&Æö"ÀĞ¢Öæ–fW7BÀĞ¢&W÷6—F÷'”–×÷'BÀĞ¢f–ÆTæÖPĞ¢Ó°Ğ¢ĞĞ Ğ¢&WGW&â°Ğ¢dõ$ÔBÀĞ¢dõ$ÔEõdU%4”ôâÀĞ¢¦—'V–ÆFW"ÀĞ¢7&33"ÀĞ¢7&VFT77bÀĞ¢7&VFTö'6W'fF–öç477bÀĞ¢7&VFUfö–6T77bÀĞ¢7&VFTvVô¥4ôâÀĞ¢7&VFTw‚ÀĞ¢7&VFT–ç7V7F–öå6¶vRÀĞ¢7&VFU&W÷6—F÷'”–×÷'DÖæ–fW7BÀĞ¢7&VFU&W÷6—F÷'”6ö×&—6öå&V6÷&BÀĞ¢7&VFTWf–FVæ6U&VÆF–öç6†—2ÀĞ¢7&VFTFV6—6–öä'&–VbÀĞ¢7&VFU7VvvW7FVD–ç7V7F–öåVW7F–öç2ÀĞ¢7&VFT”æÇ—6—2ÀĞ¢7&VFT•&VFÖRÀĞ¢7&VFU&Wf–Wtææ÷FF–öå66†VÖÀĞ¢7&VFT6†E&Wf–Wt–ç7G'V7F–öç2ÀĞ¢7&VFU&W÷'EFV×ÆFRÀĞ¢7&VFT–ç7V7F÷%F†÷Vv‡G4Ö&¶F÷vâÀĞ¢7&VFT–ç7V7F÷$‡—÷F†W6W4Ö&¶F÷vâÀĞ¢W7F–ÖFT–ç7V7F–öå6¶vU6—¦W2ÀĞ¢6Æ7VÆFT–ç7V7F–öäÖWG&–72ÀĞ¢7&VFU&–çF&ÆU&W÷'BÀĞ¢FFW&ÅFô&Æö"ÀĞ¢W‡FVç6–öäf÷"ÀĞ¢6†#Sd†W‚ÀĞ¢÷&–VçFF–öäFW67&—F–öâÀĞ¢'6TW†–d÷&–VçFF–öàĞ¢Ó°Ğ§Ò“°Ğ