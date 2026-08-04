"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  CRC_TABLE[n] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function safeRelativePath(value) {
  const normalized = String(value || "").replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (!normalized || normalized.startsWith("/") || parts.some(part => !part || part === "." || part === "..")) throw new Error(`Unsafe repository path: ${value}`);
  return parts.join("/");
}

function safeComponent(value, label) {
  const component = String(value || "");
  if (!component || component === "." || component === ".." || component.includes("/") || component.includes("\\") || !/^[A-Za-z0-9._-]+$/.test(component)) throw new Error(`Unsafe ${label || "repository identifier"}: ${value}`);
  return component;
}

function targetWithin(root, relative) {
  const rootPath = path.resolve(root);
  const target = path.resolve(rootPath, ...safeRelativePath(relative).split("/"));
  if (target !== rootPath && !target.startsWith(rootPath + path.sep)) throw new Error(`Repository path escapes its root: ${relative}`);
  return target;
}

function parseStoredZip(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  const minimum = Math.max(0, buffer.length - 65557);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("ZIP end record is missing.");
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error(`ZIP central record ${index + 1} is invalid.`);
    const method = buffer.readUInt16LE(offset + 10);
    const checksum = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = safeRelativePath(buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    if (method !== 0 || compressedSize !== size) throw new Error(`Unsupported compressed ZIP member: ${name}`);
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`ZIP local record is missing for ${name}.`);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + size);
    if (data.length !== size || crc32(data) !== checksum) throw new Error(`ZIP integrity check failed for ${name}.`);
    if (entries.has(name)) throw new Error(`Duplicate ZIP member: ${name}`);
    entries.set(name, Buffer.from(data));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function jsonEntry(entries, name) {
  const value = entries.get(name);
  if (!value) throw new Error(`Required package member is missing: ${name}`);
  try {
    return JSON.parse(value.toString("utf8"));
  } catch (error) {
    throw new Error(`Package member is not valid JSON: ${name}`);
  }
}

function extension(name, fallback) {
  const result = path.extname(String(name || "")).replace(/^\./, "").toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(result) ? result : fallback;
}

function immutableWrite(target, bytes) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, value, { flag: "wx" });
    return "created";
  } catch (error) {
    if (!error || error.code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target);
    if (existing.length !== value.length || sha256(existing) !== sha256(value)) throw new Error(`Immutable repository collision: ${target}`);
    return "already_present_identical";
  }
}

function addWrite(writes, repositoryRoot, relative, bytes) {
  writes.push({ relative: safeRelativePath(relative), target: targetWithin(repositoryRoot, relative), bytes: Buffer.from(bytes) });
}

function importInspectionPackage(packagePath, repositoryRoot, options) {
  const settings = options || {};
  const sourceBytes = fs.readFileSync(packagePath);
  const entries = parseStoredZip(sourceBytes);
  const manifest = jsonEntry(entries, "inspection.json");
  const contract = jsonEntry(entries, "repository-import.json");
  if (contract.schema_name !== "property-intelligence-repository-import" || contract.schema_version !== "1.0") throw new Error("Unsupported repository import contract.");
  if (!manifest.repository || manifest.repository.export_id !== contract.export_id) throw new Error("Inspection manifest and repository contract export IDs do not match.");
  if (manifest.inspection_id !== contract.inspection_id || manifest.property_id !== contract.property_id) throw new Error("Repository identity does not match the inspection manifest.");
  const inspectionPath = safeRelativePath(contract.repository_path);
  if (inspectionPath !== `${contract.identity.property_folder}/${contract.identity.inspection_folder}`) throw new Error("Repository folder identity is inconsistent.");
  const inspectionRoot = targetWithin(repositoryRoot, inspectionPath);
  const versionPath = `versions/${contract.export_id}`;
  const versionRoot = targetWithin(inspectionRoot, versionPath);
  if (fs.existsSync(versionRoot)) throw new Error(`Export ${contract.export_id} already exists. Repository imports are append-only.`);

  const writes = [];
  const identity = {
    schema_name: "property-intelligence-repository-identity",
    schema_version: "1.0",
    property_id: manifest.property_id,
    inspection_id: manifest.inspection_id,
    property_folder: contract.identity.property_folder,
    inspection_folder: contract.identity.inspection_folder,
    append_only: true,
    versions_path: "versions/"
  };
  addWrite(writes, inspectionRoot, "repository-identity.json", JSON.stringify(identity, null, 2) + "\n");
  if (!fs.existsSync(targetWithin(inspectionRoot, "inspection.json"))) addWrite(writes, inspectionRoot, "inspection.json", entries.get("inspection.json"));
  addWrite(writes, inspectionRoot, `${versionPath}/inspection.json`, entries.get("inspection.json"));
  addWrite(writes, inspectionRoot, `${versionPath}/repository-import.json`, entries.get("repository-import.json"));
  for (const name of ["schema.json", "events.csv", "observations.csv", "photos.csv", "photo_index.json", "voice-notes.csv"]) {
    if (entries.has(name)) addWrite(writes, inspectionRoot, `${versionPath}/${name}`, entries.get(name));
  }
  for (const [source, destination] of [
    ["track.geojson", `maps/${contract.export_id}/track.geojson`],
    ["track.gpx", `maps/${contract.export_id}/track.gpx`],
    ["context/map-context.json", `maps/${contract.export_id}/map-context.json`],
    ["context/parcels.geojson", `property_boundary/${contract.export_id}/parcels.geojson`],
    ["context/parcels.arcgis.json", `property_boundary/${contract.export_id}/parcels.arcgis.json`],
    ["chatgpt-reconstruction.json", `analysis/${contract.export_id}/chatgpt-reconstruction.json`],
    ["repository-comparison.json", `analysis/${contract.export_id}/repository-comparison.json`],
    ["AI_README.md", `analysis/${contract.export_id}/AI_README.md`],
    ["AI_ANALYSIS.json", `analysis/${contract.export_id}/AI_ANALYSIS.json`],
    ["DECISION_BRIEF.json", `analysis/${contract.export_id}/DECISION_BRIEF.json`],
    ["QUESTION_BRIEF.json", `analysis/${contract.export_id}/QUESTION_BRIEF.json`],
    ["FIELD_COACHING.json", `analysis/${contract.export_id}/FIELD_COACHING.json`],
    ["FIELD_EVIDENCE_REVIEW.json", `analysis/${contract.export_id}/FIELD_EVIDENCE_REVIEW.json`],
    ["EVIDENCE_AUDIT_HISTORY.json", `analysis/${contract.export_id}/EVIDENCE_AUDIT_HISTORY.json`],
    ["EVIDENCE_SETS.json", `analysis/${contract.export_id}/EVIDENCE_SETS.json`],
    ["POST_INSPECTION_REVIEW.json", `analysis/${contract.export_id}/POST_INSPECTION_REVIEW.json`],
    ["WEATHER_CONTEXT.json", `weather/${contract.export_id}/WEATHER_CONTEXT.json`],
    ["CHAT_REVIEW_RETURN_INSTRUCTIONS.md", `analysis/${contract.export_id}/CHAT_REVIEW_RETURN_INSTRUCTIONS.md`],
    ["schemas/property-intelligence-review-annotation.schema.json", `analysis/${contract.export_id}/schemas/property-intelligence-review-annotation.schema.json`],
    ["PROFESSIONAL_HANDOFF_CARDS.json", `analysis/${contract.export_id}/PROFESSIONAL_HANDOFF_CARDS.json`],
    ["PROFESSIONAL_HANDOFF_CARDS.md", `analysis/${contract.export_id}/PROFESSIONAL_HANDOFF_CARDS.md`],
    ["professional-handoff-cards.html", `analysis/${contract.export_id}/professional-handoff-cards.html`],
    ["RETURN_VISIT_PLAN.json", `analysis/${contract.export_id}/RETURN_VISIT_PLAN.json`],
    ["SMALL_TRACT_WATER_MAP.json", `maps/${contract.export_id}/SMALL_TRACT_WATER_MAP.json`],
    ["FLOWING_WATER_CORRIDORS.json", `maps/${contract.export_id}/FLOWING_WATER_CORRIDORS.json`],
    ["STRUCTURED_MEASUREMENTS.json", `measurements/${contract.export_id}/STRUCTURED_MEASUREMENTS.json`],
    ["PRELIMINARY_TIMBER_RECONNAISSANCE.json", `timber/${contract.export_id}/PRELIMINARY_TIMBER_RECONNAISSANCE.json`],
    ["FORESTER_HANDOFF.json", `timber/${contract.export_id}/FORESTER_HANDOFF.json`],
    ["FORESTER_HANDOFF.md", `timber/${contract.export_id}/FORESTER_HANDOFF.md`],
    ["small-tract-water-map.html", `maps/${contract.export_id}/small-tract-water-map.html`],
    ["REPORT_TEMPLATE.md", `analysis/${contract.export_id}/REPORT_TEMPLATE.md`],
    ["INSPECTOR_THOUGHTS.md", `analysis/${contract.export_id}/INSPECTOR_THOUGHTS.md`],
    ["INSPECTOR_HYPOTHESES.md", `analysis/${contract.export_id}/INSPECTOR_HYPOTHESES.md`],
    ["EVIDENCE_RELATIONSHIPS.json", `analysis/${contract.export_id}/EVIDENCE_RELATIONSHIPS.json`],
    ["SUGGESTED_INSPECTION_QUESTIONS.md", `analysis/${contract.export_id}/SUGGESTED_INSPECTION_QUESTIONS.md`],
    ["printable-report.html", `analysis/${contract.export_id}/printable-report.html`]
  ]) {
    if (entries.has(source)) addWrite(writes, inspectionRoot, destination, entries.get(source));
  }
  addWrite(writes, inspectionRoot, `weather/${contract.export_id}/conditions.json`, JSON.stringify({ inspection_id: manifest.inspection_id, export_id: contract.export_id, conditions: manifest.inspection.conditions || {}, weather_context: manifest.inspection.weather_context || {} }, null, 2) + "\n");

  for (const photo of manifest.photographs || []) {
    for (const kind of ["original", "analysis"]) {
      const evidence = photo[kind];
      if (!evidence || !evidence.path) continue;
      const bytes = entries.get(evidence.path);
      if (!bytes) throw new Error(`Photo evidence is missing: ${evidence.path}`);
      const digest = sha256(bytes);
      if (digest !== evidence.sha256) throw new Error(`Photo SHA-256 mismatch: ${evidence.path}`);
      addWrite(writes, inspectionRoot, `photos/${kind}/${safeComponent(photo.photo_id, "photo ID")}_${digest.slice(0, 20)}.${extension(evidence.path, "bin")}`, bytes);
    }
  }
  for (const voice of manifest.voice_notes || []) {
    const evidence = voice.audio;
    if (!evidence || !evidence.path) continue;
    const bytes = entries.get(evidence.path);
    if (!bytes || sha256(bytes) !== evidence.sha256) throw new Error(`Voice-note integrity mismatch: ${evidence.path}`);
    addWrite(writes, inspectionRoot, `voice/${safeComponent(voice.voice_note_id, "voice-note ID")}_${evidence.sha256.slice(0, 20)}.${extension(evidence.path, "bin")}`, bytes);
  }
  const audit = manifest.audit_history || {};
  for (const photo of audit.audit_only_photographs || []) {
    for (const kind of ["original", "analysis"]) {
      const evidence = photo[kind];
      if (!evidence || !evidence.path) continue;
      const bytes = entries.get(evidence.path);
      if (!bytes || sha256(bytes) !== evidence.sha256) throw new Error(`Audit photograph integrity mismatch: ${evidence.path}`);
      addWrite(writes, inspectionRoot, `photos/audit/${kind}/${safeComponent(photo.photo_id, "photo ID")}_${evidence.sha256.slice(0, 20)}.${extension(evidence.path, "bin")}`, bytes);
    }
  }
  for (const voice of audit.audit_only_voice_notes || []) {
    const evidence = voice.audio;
    if (!evidence || !evidence.path) continue;
    const bytes = entries.get(evidence.path);
    if (!bytes || sha256(bytes) !== evidence.sha256) throw new Error(`Audit voice-note integrity mismatch: ${evidence.path}`);
    addWrite(writes, inspectionRoot, `voice/audit/${safeComponent(voice.voice_note_id, "voice-note ID")}_${evidence.sha256.slice(0, 20)}.${extension(evidence.path, "bin")}`, bytes);
  }
  for (const [name, bytes] of entries.entries()) {
    if (name.startsWith("professional-handoff/") && name.endsWith(".md")) addWrite(writes, inspectionRoot, `analysis/${contract.export_id}/${name}`, bytes);
  }
  for (const [layer, folder] of [["terrain", "terrain"], ["contours", "contours"]]) {
    const evidence = manifest.map_context && manifest.map_context.layers && manifest.map_context.layers[layer];
    if (!evidence || !evidence.available || !evidence.path) continue;
    const bytes = entries.get(evidence.path);
    if (!bytes || sha256(bytes) !== evidence.sha256) throw new Error(`${layer} integrity mismatch.`);
    addWrite(writes, inspectionRoot, `${folder}/${evidence.sha256}.${extension(evidence.path, "bin")}`, bytes);
  }

  const artifactName = safeComponent(contract.artifact.repository_filename, "artifact filename");
  addWrite(writes, inspectionRoot, `packages/${artifactName}`, sourceBytes);
  const packageHash = sha256(sourceBytes);
  const receipt = {
    schema_name: "property-intelligence-ingestion-receipt",
    schema_version: "1.0",
    ingested_at: settings.ingestedAt || new Date().toISOString(),
    property_id: manifest.property_id,
    inspection_id: manifest.inspection_id,
    export_id: contract.export_id,
    package_mode: manifest.package_mode,
    source_package: `packages/${artifactName}`,
    source_package_size_bytes: sourceBytes.length,
    source_package_sha256: packageHash,
    overwrite_performed: false
  };
  addWrite(writes, inspectionRoot, `${versionPath}/ingestion-receipt.json`, JSON.stringify(receipt, null, 2) + "\n");
  addWrite(writes, inspectionRoot, `analysis/${contract.export_id}/printable_report.pdf.pending.json`, JSON.stringify({ source: "printable-report.html", destination: "printable_report.pdf", status: "pending_repository_generation", source_export_id: contract.export_id }, null, 2) + "\n");

  const targetKeys = new Set();
  for (const write of writes) {
    const key = path.normalize(write.target).toLowerCase();
    if (targetKeys.has(key)) throw new Error(`Repository import maps two records to the same path: ${write.relative}`);
    targetKeys.add(key);
    if (fs.existsSync(write.target)) {
      const existing = fs.readFileSync(write.target);
      if (existing.length !== write.bytes.length || sha256(existing) !== sha256(write.bytes)) throw new Error(`Immutable repository collision: ${write.target}`);
    }
  }
  fs.mkdirSync(inspectionRoot, { recursive: true });
  const results = writes.map(write => ({ path: path.relative(repositoryRoot, write.target).replaceAll("\\", "/"), status: immutableWrite(write.target, write.bytes) }));
  return { repositoryPath: inspectionPath, exportId: contract.export_id, packageSha256: packageHash, writes: results, receipt };
}

if (require.main === module) {
  const packagePath = process.argv[2];
  const repositoryRoot = process.argv[3];
  if (!packagePath || !repositoryRoot) {
    process.stderr.write("Usage: node repository/import-package.js <inspection-package.zip> <repository-root>\n");
    process.exitCode = 2;
  } else {
    try {
      const result = importInspectionPackage(packagePath, repositoryRoot);
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } catch (error) {
      process.stderr.write(`IMPORT FAILED: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

module.exports = { parseStoredZip, importInspectionPackage, safeRelativePath, safeComponent, targetWithin, sha256 };
