(function (root, factory) {
  "use strict";
  const coaching = typeof module === "object" && module.exports ? require("./inspection-coaching.js") : (root && root.InspectionCoaching);
  const water = typeof module === "object" && module.exports ? require("./water-intelligence.js") : (root && root.WaterIntelligence);
  const governance = typeof module === "object" && module.exports ? require("./evidence-governance.js") : (root && root.EvidenceGovernance);
  const evidenceSets = typeof module === "object" && module.exports ? require("./evidence-sets.js") : (root && root.EvidenceSets);
  const timber = typeof module === "object" && module.exports ? require("./timber-reconnaissance.js") : (root && root.TimberReconnaissance);
  const synthesis = typeof module === "object" && module.exports ? require("./reviewed-property-synthesis.js") : (root && root.ReviewedPropertySynthesis);
  const frontage = typeof module === "object" && module.exports ? require("./frontage-workflow.js") : (root && root.PropertyFrontageWorkflow);
  const automaticContext = typeof module === "object" && module.exports ? require("./automatic-context.js") : (root && root.AutomaticFieldContext);
  const sectionMapping = typeof module === "object" && module.exports ? require("./section-mapping.js") : (root && root.SimpleSectionMapping);
  const wetEdgeMapping = typeof module === "object" && module.exports ? require("./wet-edge-mapping.js") : (root && root.WetEdgeMapping);
  const propertyReview = typeof module === "object" && module.exports ? require("./property-review.js") : (root && root.PropertyPrevisitReview);
  const api = factory(coaching, water, governance, evidenceSets, timber, synthesis, frontage, automaticContext, sectionMapping, wetEdgeMapping, propertyReview);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.InspectionPackage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (coachingTools, waterTools, governanceTools, evidenceSetTools, timberTools, synthesisTools, frontageTools, automaticContextTools, sectionMappingTools, wetEdgeMappingTools, propertyReviewTools) {
  "use strict";

  const FORMAT = "property-inspector-home-test-313-package";
  const FORMAT_VERSION = "2.1";
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

  function createGeoJSON(insp…52971 tokens truncated…ATER_MAP.json",
        small_tract_water_map_interactive: "small-tract-water-map.html",
        segmented_route: "SEGMENTED_ROUTE.json",
        reviewed_property_synthesis: "REVIEWED_PROPERTY_SYNTHESIS.json",
        creek_corridor_map: "CREEK_CORRIDOR_MAP.json",
        creek_corridor_map_interactive: "creek-corridor-map.html",
        vegetation_clearing_map: "VEGETATION_CLEARING_MAP.json",
        vegetation_clearing_map_interactive: "vegetation-clearing-map.html",
        homesite_opportunity_map: "HOMESITE_OPPORTUNITY_MAP.json",
        homesite_opportunity_map_interactive: "homesite-opportunity-map.html",
        property_intelligence_report: "PROPERTY_INTELLIGENCE_REPORT.md",
        property_intelligence_report_html: "property-intelligence-report.html",
        printable_property_report: "printable-property-report.html",
        audience_reports: "AUDIENCE_REPORTS.json",
        audience_report_folder: "audience-reports/*.md",
        flowing_water_corridors: "FLOWING_WATER_CORRIDORS.json",
        structured_measurements: "STRUCTURED_MEASUREMENTS.json",
        preliminary_timber_reconnaissance: "PRELIMINARY_TIMBER_RECONNAISSANCE.json",
        forester_handoff: "FORESTER_HANDOFF.json",
        forester_handoff_markdown: "FORESTER_HANDOFF.md",
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
        subject_parcel_geojson: "subject-parcel.geojson",
        photo_points_geojson: "photo-points.geojson",
        feature_points_geojson: "feature-points.geojson",
        property_field_map: "property-field-map.html",
        printable_property_field_map: "printable-property-field-map.html",
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

    const reviewedSynthesis = synthesisTools ? synthesisTools.buildSynthesis({
      inspection: Object.assign({}, sourceInspection, { points: inspection.points, markers: inspection.markers, photos: manifestPhotos, voice_notes: manifestVoices, lifecycle_events: inspection.lifecycle_events, segmented_route: segmentedRoute }),
      photos: manifestPhotos,
      voiceNotes: manifestVoices,
      subjectFeature,
      smallTractWaterMap,
      flowingWaterModel: flowingWaterCorridorModel,
      manifest
    }) : { route: segmentedRoute, review: { phases: [], events: [], rule: "Reviewed synthesis module unavailable." }, creek_corridor_map: {}, vegetation_clearing_map: {}, homesite_opportunity_map: {}, property_report: { sections: [] }, property_report_markdown: "# Property Intelligence Report\n\nReviewed synthesis module unavailable.\n", property_report_html: "<!doctype html><title>Property Intelligence Report unavailable</title>", audience_reports: { reports: [] }, map_html: { creek: "", vegetation: "", homesite: "" } };
    inspection.segmented_route = reviewedSynthesis.route;
    manifest.inspection.segmented_route = reviewedSynthesis.route;
    manifest.reviewed_property_synthesis = {
      property_scope: reviewedSynthesis.property_scope,
      review: reviewedSynthesis.review,
      creek_corridor_map: "CREEK_CORRIDOR_MAP.json",
      vegetation_clearing_map: "VEGETATION_CLEARING_MAP.json",
      homesite_opportunity_map: "HOMESITE_OPPORTUNITY_MAP.json",
      property_report: "PROPERTY_INTELLIGENCE_REPORT.md",
      audience_reports: "AUDIENCE_REPORTS.json"
    };
    manifest.summary.approved_review_phase_count = (reviewedSynthesis.review.phases || []).filter(item => item.status === "approved").length;
    manifest.summary.pending_review_phase_count = (reviewedSynthesis.review.phases || []).filter(item => item.status === "pending_inspector_confirmation").length;

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
    const foresterHandoffMarkdown = `# Forester Handoff â€” Preliminary Timber Reconnaissance\n\n${foresterHandoff.disclaimer}\n\n## Orientation\n\n- Property ID: ${manifest.property_id}\n- Inspection ID: ${manifest.inspection_id}\n- Sample plots: ${(foresterHandoff.plot_designs || []).length}\n- Recorded trees: ${(foresterHandoff.raw_tree_records || []).length}\n- Timber measurements: ${(foresterHandoff.raw_measurements || []).length}\n- Map: ${foresterHandoff.tree_and_plot_map_reference}\n\n## Unanswered questions\n\n${(foresterHandoff.unanswered_questions || []).map(item => `- ${item}`).join("\n") || "- No timber questions were generated."}\n\nReview FORESTER_HANDOFF.json for raw measurements, methods, plot design, species confidence, access, wet-ground observations, and photograph IDs.\n`;
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
    zip.add("AUDIT_ONLY_GPS_POINTS.json", JSON.stringify({ schema_name: "property-intelligence-audit-only-gps", schema_version: "1.0", inspection_id: manifest.inspection_id, reason: "Excluded prior-day app-test GPS points remain permanently recoverable but do not affect the active route or findings.", points: auditHistory.audit_only_gps_points || [] }, null, 2) + "\n", { modifiedAt });
    zip.add("EVIDENCE_SETS.json", JSON.stringify({ summaries: evidenceSetSummaries, pending_suggestions: evidenceSetSuggestions, append_only_events: sourceInspection.evidence_set_events || [] }, null, 2) + "\n", { modifiedAt });
    zip.add("POST_INSPECTION_REVIEW.json", JSON.stringify(postInspectionReview, null, 2) + "\n", { modifiedAt });
    zip.add("WEATHER_CONTEXT.json", JSON.stringify({ schema_name: "property-intelligence-weather-context", schema_version: "2.0", inspection_id: manifest.inspection_id, authoritative_weather: manifest.inspection.authoritative_weather || null, manual_weather_context: manifest.inspection.weather_context || {}, observed_site_conditions: manifest.inspection.conditions || {}, interpretation_rules: ["Weather context is not an observed site condition.", "An inferred cause is not an observed fact.", "One inspection does not establish year-round conditions.", "A station total must retain its station-distance limitation.", "Calculated departures and percentages must be labeled as derived from cited official station records.", "Station rainfall may differ from parcel rainfall."] }, null, 2) + "\n", { modifiedAt });
    zip.add("AUTOMATIC_CONTEXT.json", JSON.stringify(automaticContext, null, 2) + "\n", { modifiedAt });
    zip.add("FACTS_BY_CLASS.json", JSON.stringify(factsByClass, null, 2) + "\n", { modifiedAt });
    zip.add("SITE_SOUND_EXPERIENCE.json", JSON.stringify({ schema_name: "property-intelligence-site-sound-experience-index", schema_version: "1.0", inspection_id: manifest.inspection_id, records: sourceInspection.site_sound_records || [], rule: "Site sound and experience choices are on-site observations. Ambient recordings and device metadata are device captures. External weather remains external context." }, null, 2) + "\n", { modifiedAt });
    zip.add("MAPPED_SECTIONS.json", JSON.stringify(mappedSections, null, 2) + "\n", { modifiedAt });
    zip.add("mapped-sections.geojson", JSON.stringify(mappedSectionsGeoJson, null, 2) + "\n", { modifiedAt });
    zip.add("SECTION_NOTES.json", JSON.stringify({ schema_name: "property-intelligence-section-notes", schema_version: "1.0", inspection_id: manifest.inspection_id, records: sourceInspection.section_notes || [] }, null, 2) + "\n", { modifiedAt });
    zip.add("UI_ACTION_LOG.json", JSON.stringify({ schema_name: "property-inspector-ui-action-log", schema_version: "1.0", inspection_id: manifest.inspection_id, records: sourceInspection.ui_action_log || [] }, null, 2) + "\n", { modifiedAt });
    zip.add("WET_EDGE_MAPPING.json", JSON.stringify(wetEdgeMapping, null, 2) + "\n", { modifiedAt });
    if (august4ReferenceRoute) zip.add("AUGUST_4_REFERENCE_ROUTE.json", JSON.stringify(august4ReferenceRoute) + "\n", { modifiedAt });
    zip.add("PROPERTY_PREVISIT_REVIEW.json", JSON.stringify(propertyPrevisitReview, null, 2) + "\n", { modifiedAt });
    zip.add("CHAT_REVIEW_RETURN_INSTRUCTIONS.md", chatReviewInstructions, { modifiedAt });
    zip.add("schemas/property-intelligence-review-annotation.schema.json", JSON.stringify(reviewAnnotationSchema, null, 2) + "\n", { modifiedAt });
    zip.add("PROFESSIONAL_HANDOFF_CARDS.json", JSON.stringify(professionalHandoffCards, null, 2) + "\n", { modifiedAt });
    zip.add("PROFESSIONAL_HANDOFF_CARDS.md", professionalHandoffMarkdown, { modifiedAt });
    zip.add("professional-handoff-cards.html", professionalHandoffHtml, { modifiedAt });
    zip.add("RETURN_VISIT_PLAN.json", JSON.stringify(returnVisitPlan, null, 2) + "\n", { modifiedAt });
    zip.add("SMALL_TRACT_WATER_MAP.json", JSON.stringify(smallTractWaterMap, null, 2) + "\n", { modifiedAt });
    zip.add("FLOWING_WATER_CORRIDORS.json", JSON.stringify(flowingWaterCorridorModel, null, 2) + "\n", { modifiedAt });
    zip.add("SEGMENTED_ROUTE.json", JSON.stringify(reviewedSynthesis.route, null, 2) + "\n", { modifiedAt });
    zip.add("REVIEWED_PROPERTY_SYNTHESIS.json", JSON.stringify({ schema_name: reviewedSynthesis.schema_name, schema_version: reviewedSynthesis.schema_version, property_scope: reviewedSynthesis.property_scope, review: reviewedSynthesis.review, warnings: reviewedSynthesis.warnings }, null, 2) + "\n", { modifiedAt });
    zip.add("CREEK_CORRIDOR_MAP.json", JSON.stringify(reviewedSynthesis.creek_corridor_map, null, 2) + "\n", { modifiedAt });
    zip.add("creek-corridor-map.html", reviewedSynthesis.map_html.creek, { modifiedAt });
    zip.add("VEGETATION_CLEARING_MAP.json", JSON.stringify(reviewedSynthesis.vegetation_clearing_map, null, 2) + "\n", { modifiedAt });
    zip.add("vegetation-clearing-map.html", reviewedSynthesis.map_html.vegetation, { modifiedAt });
    zip.add("HOMESITE_OPPORTUNITY_MAP.json", JSON.stringify(reviewedSynthesis.homesite_opportunity_map, null, 2) + "\n", { modifiedAt });
    zip.add("homesite-opportunity-map.html", reviewedSynthesis.map_html.homesite, { modifiedAt });
    zip.add("PROPERTY_INTELLIGENCE_REPORT.md", reviewedSynthesis.property_report_markdown, { modifiedAt });
    zip.add("property-intelligence-report.html", reviewedSynthesis.property_report_html, { modifiedAt });
    zip.add("printable-property-report.html", reviewedSynthesis.property_report_html, { modifiedAt });
    zip.add("AUDIENCE_REPORTS.json", JSON.stringify(reviewedSynthesis.audience_reports, null, 2) + "\n", { modifiedAt });
    (reviewedSynthesis.audience_reports.reports || []).forEach(report => zip.add(report.filename, report.markdown, { modifiedAt }));
    zip.add("STRUCTURED_MEASUREMENTS.json", JSON.stringify({ schema_name: "property-intelligence-structured-measurement-index", schema_version: "1.0", inspection_id: manifest.inspection_id, authority_rule: "Inspector-entered numeric values are authoritative. Photographs are supporting evidence, not the sole source for reading measurements.", measurements: structuredMeasurements, pending_suggestions: (sourceInspection.evidence_set_suggestions || []).filter(item => item.suggested_measurement && item.status === "pending_inspector_confirmation") }, null, 2) + "\n", { modifiedAt });
    zip.add("PRELIMINARY_TIMBER_RECONNAISSANCE.json", JSON.stringify(timberReconnaissance, null, 2) + "\n", { modifiedAt });
    zip.add("FORESTER_HANDOFF.json", JSON.stringify(foresterHandoff, null, 2) + "\n", { modifiedAt });
    zip.add("FORESTER_HANDOFF.md", foresterHandoffMarkdown, { modifiedAt });
    zip.add("FRONTAGE_AND_CROSSING.json", JSON.stringify(frontageAnalysis, null, 2) + "\n", { modifiedAt });
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
    zip.add("subject-parcel.geojson", JSON.stringify(createParcelGeoJSON({ features: [subjectFeature] }), null, 2) + "\n", { modifiedAt });
    zip.add("photo-points.geojson", JSON.stringify(createPhotoPointsGeoJSON(manifestPhotos), null, 2) + "\n", { modifiedAt });
    zip.add("feature-points.geojson", JSON.stringify(createFeaturePointsGeoJSON(inspection.markers), null, 2) + "\n", { modifiedAt });
    zip.add("property-field-map.html", printableReport, { modifiedAt });
    zip.add("printable-property-field-map.html", printableReport, { modifiedAt });
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

