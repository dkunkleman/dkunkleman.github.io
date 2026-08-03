"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { parseStoredZip, safeComponent, safeRelativePath, targetWithin } = require("./import-package.js");

const SCHEMA_NAME = "property-intelligence-review-annotation";
const SCHEMA_VERSION = "1.0";
const RECORD_TYPES = ["Inspector clarification", "Correction", "Accidental button press", "Observed fact", "Measurement", "Estimate", "Inspector interpretation", "Personal preference", "Report wording", "Professional-verification item", "Unanswered question", "Photo-value classification", "Area assignment", "Inspection-phase assignment"];
const STATUSES = ["Draft", "Inspector approved", "Rejected", "Superseded", "Active"];
const PHOTO_SELECTIONS = ["Critical", "Helpful", "Reference", "Duplicate", "Exclude from main report"];
const REQUIRED_FILES = ["CHAT_REVIEW_ANNOTATIONS.json", "PHOTO_REVIEW.md", "REPORT_UPDATES.json", "CORRECTIONS.json", "QUESTIONS_REMAINING.json", "PHOTO_SELECTION.json", "REVIEW_SESSION_SUMMARY.md"];

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function jsonEntry(entries, name) {
  const bytes = entries.get(name);
  if (!bytes) throw new Error(`Required Chat Review member is missing: ${name}`);
  try { return JSON.parse(bytes.toString("utf8")); } catch (error) { throw new Error(`Chat Review member is not valid JSON: ${name}`); }
}
function array(value) { return Array.isArray(value) ? value : []; }
function itemId(item, fields) { for (const field of fields) if (item && item[field] != null) return String(item[field]); return null; }

function normalizeAnnotation(annotation) {
  const row = clone(annotation || {});
  row.schema_name = row.schema_name || SCHEMA_NAME;
  row.schema_version = row.schema_version || SCHEMA_VERSION;
  row.photograph_ids = array(row.photograph_ids).map(String);
  row.observation_ids = array(row.observation_ids).map(String);
  row.voice_note_ids = array(row.voice_note_ids).map(String);
  row.gps_point_ids = array(row.gps_point_ids || row["GPS point IDs"]).map(String);
  row.report_sections_affected = array(row.report_sections_affected || row["report sections affected"]);
  row.supporting_evidence = array(row.supporting_evidence);
  row.contradicting_evidence = array(row.contradicting_evidence);
  row.unanswered_questions = array(row.unanswered_questions);
  row.approved_by_inspector = row.approved_by_inspector === true;
  row.main_report_or_appendix = row.main_report_or_appendix || "appendix";
  return row;
}

function sourceIndexes(manifest) {
  const inspection = manifest.inspection || {};
  return {
    photos: new Set(array(manifest.photographs).map(item => itemId(item, ["photo_id", "id"])).filter(Boolean)),
    observations: new Set(array(inspection.observations).concat(array(inspection.field_events)).map(item => itemId(item, ["observation_id", "id"])).filter(Boolean)),
    voices: new Set(array(manifest.voice_notes).map(item => itemId(item, ["voice_note_id", "id"])).filter(Boolean)),
    gps: new Set(array(inspection.gps_track).map(item => itemId(item, ["gps_point_id", "point_id", "id"])).filter(Boolean))
  };
}

function requireKnown(ids, known, label, annotationId) {
  ids.forEach(id => { if (!known.has(String(id))) throw new Error(`Annotation ${annotationId} references an unknown ${label}: ${id}`); });
}

function validateAnnotation(annotation, manifest, options) {
  const row = normalizeAnnotation(annotation);
  const settings = options || {};
  const required = ["annotation_id", "property_id", "inspection_id", "review_session_id", "created_at", "created_by", "source_conversation_reference", "exact_inspector_statement", "concise_approved_finding", "record_type", "evidence_classification", "confidence", "status"];
  required.forEach(field => { if (row[field] == null || String(row[field]).trim() === "") throw new Error(`Review annotation is missing ${field}.`); });
  ["approved_by_inspector", "approval_time", "photograph_ids", "observation_ids", "voice_note_ids", "gps_point_ids", "inspection_area_id", "report_sections_affected", "supersedes_annotation_id", "supporting_evidence", "contradicting_evidence", "unanswered_questions", "professional_verification_question", "main_report_or_appendix"].forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(row, field)) throw new Error(`Review annotation ${row.annotation_id} is missing required field ${field}.`);
  });
  if (row.schema_name !== SCHEMA_NAME || row.schema_version !== SCHEMA_VERSION) throw new Error(`Unsupported review annotation schema: ${row.schema_name}/${row.schema_version}`);
  if (String(row.property_id) !== String(manifest.property_id) || String(row.inspection_id) !== String(manifest.inspection_id)) throw new Error(`Annotation ${row.annotation_id} targets a different property or inspection.`);
  if (!RECORD_TYPES.includes(row.record_type)) throw new Error(`Annotation ${row.annotation_id} has an unsupported record type.`);
  if (!STATUSES.includes(row.status)) throw new Error(`Annotation ${row.annotation_id} has an unsupported status.`);
  if (!["main-report", "appendix"].includes(row.main_report_or_appendix)) throw new Error(`Annotation ${row.annotation_id} must designate main-report or appendix.`);
  if (Object.prototype.hasOwnProperty.call(row, "conversation_transcript") || Object.prototype.hasOwnProperty.call(row, "whole_chat")) throw new Error(`Annotation ${row.annotation_id} attempts to ingest a whole conversation. Submit discrete inspector-approved annotations instead.`);
  if (["Active", "Inspector approved"].includes(row.status) && (!row.approved_by_inspector || !row.approval_time)) throw new Error(`Annotation ${row.annotation_id} cannot be active without explicit inspector approval and approval_time.`);
  if (row.created_by === "ChatGPT" && row.record_type === "Observed fact" && !row.exact_inspector_statement) throw new Error(`Assistant language cannot become an observed fact without an exact inspector statement.`);
  const indexes = settings.indexes || sourceIndexes(manifest);
  requireKnown(row.photograph_ids, indexes.photos, "photograph", row.annotation_id);
  requireKnown(row.observation_ids, indexes.observations, "observation", row.annotation_id);
  requireKnown(row.voice_note_ids, indexes.voices, "voice note", row.annotation_id);
  requireKnown(row.gps_point_ids, indexes.gps, "GPS point", row.annotation_id);
  return row;
}

function validateReportUpdates(reportUpdates, annotations) {
  const approved = new Map(annotations.filter(item => item.approved_by_inspector && ["Active", "Inspector approved"].includes(item.status)).map(item => [String(item.annotation_id), item]));
  const updates = array(reportUpdates.updates || reportUpdates);
  updates.forEach((update, index) => {
    if (!update.annotation_id || !approved.has(String(update.annotation_id))) throw new Error(`Report update ${index + 1} does not cite an approved annotation.`);
    const annotation = approved.get(String(update.annotation_id));
    if (!update.inspector_approval_date || String(update.inspector_approval_date) !== String(annotation.approval_time)) throw new Error(`Report update for ${update.annotation_id} must cite its inspector approval date.`);
    if (!array(update.supporting_photograph_ids).length && !array(update.supporting_observation_ids).length) throw new Error(`Material report update for ${update.annotation_id} must cite supporting photograph or observation IDs.`);
  });
  return updates;
}

function validateChatReviewEntries(entries, manifest) {
  REQUIRED_FILES.forEach(name => { if (!entries.has(name)) throw new Error(`Required Chat Review member is missing: ${name}`); });
  const annotationDoc = jsonEntry(entries, "CHAT_REVIEW_ANNOTATIONS.json");
  if (annotationDoc.schema_name !== "property-intelligence-chat-review-annotations" || annotationDoc.schema_version !== "1.0") throw new Error("Unsupported Chat Review annotation collection.");
  if (String(annotationDoc.property_id) !== String(manifest.property_id) || String(annotationDoc.inspection_id) !== String(manifest.inspection_id)) throw new Error("Chat Review Package targets a different property or inspection.");
  const indexes = sourceIndexes(manifest);
  const annotations = array(annotationDoc.annotations).map(item => validateAnnotation(item, manifest, { indexes }));
  const ids = new Set();
  annotations.forEach(item => { if (ids.has(item.annotation_id)) throw new Error(`Duplicate annotation ID: ${item.annotation_id}`); ids.add(item.annotation_id); });
  const sessionIds = new Set(annotations.map(item => item.review_session_id));
  if (sessionIds.size !== 1 || !sessionIds.has(annotationDoc.review_session_id)) throw new Error("All annotations must belong to the declared review session.");
  annotations.forEach(item => {
    if (item.supersedes_annotation_id && !ids.has(item.supersedes_annotation_id) && !item.supersedes_prior_session) throw new Error(`Annotation ${item.annotation_id} supersedes an annotation not present in this session without declaring a prior-session reference.`);
  });
  const photoSelection = jsonEntry(entries, "PHOTO_SELECTION.json");
  array(photoSelection.photographs || photoSelection).forEach(item => {
    if (!indexes.photos.has(String(item.photo_id))) throw new Error(`Photo selection references an unknown photograph: ${item.photo_id}`);
    if (!PHOTO_SELECTIONS.includes(item.classification)) throw new Error(`Photo ${item.photo_id} has an unsupported selection classification.`);
  });
  const reportUpdates = jsonEntry(entries, "REPORT_UPDATES.json");
  const activeApproved = annotations.filter(item => item.approved_by_inspector && ["Active", "Inspector approved"].includes(item.status));
  if (activeApproved.length) validateReportUpdates(reportUpdates, annotations);
  return { annotationDoc, annotations, photoSelection, reportUpdates, indexes };
}

function findInspectionRoot(repositoryRoot, propertyId, inspectionId) {
  const root = path.resolve(repositoryRoot);
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) { if (!entry.name.startsWith(".")) stack.push(target); continue; }
      if (entry.name !== "repository-identity.json") continue;
      const identity = JSON.parse(fs.readFileSync(target, "utf8"));
      if (String(identity.property_id) === String(propertyId) && String(identity.inspection_id) === String(inspectionId)) return current;
    }
  }
  throw new Error(`No repository inspection matches property_id ${propertyId} and inspection_id ${inspectionId}.`);
}

function immutableWrite(target, bytes) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try { fs.writeFileSync(target, value, { flag: "wx" }); return "created"; }
  catch (error) {
    if (!error || error.code !== "EEXIST") throw error;
    const existing = fs.readFileSync(target);
    if (existing.length !== value.length || sha256(existing) !== sha256(value)) throw new Error(`Immutable review collision: ${target}`);
    return "already_present_identical";
  }
}

function evidenceCoordinates(manifest, annotation) {
  const inspection = manifest.inspection || {};
  const sources = array(manifest.photographs).concat(array(inspection.observations), array(inspection.field_events), array(inspection.gps_track));
  const wanted = new Set(annotation.photograph_ids.concat(annotation.observation_ids, annotation.gps_point_ids));
  return sources.map(item => {
    const id = itemId(item, ["photo_id", "observation_id", "gps_point_id", "point_id", "id"]);
    const lat = Number(item.latitude != null ? item.latitude : (item.lat != null ? item.lat : item.location && item.location.latitude)), lon = Number(item.longitude != null ? item.longitude : (item.lon != null ? item.lon : item.location && item.location.longitude));
    return id && wanted.has(id) && Number.isFinite(lat) && Number.isFinite(lon) ? { id, lat, lon } : null;
  }).filter(Boolean);
}

function createDerivedReview(manifest, annotations, reportUpdates) {
  const active = annotations.filter(item => item.status === "Active" && item.approved_by_inspector);
  const rejected = annotations.filter(item => ["Rejected", "Superseded"].includes(item.status));
  const findings = active.map(item => ({
    annotation_id: item.annotation_id,
    finding: item.concise_approved_finding,
    record_type: item.record_type,
    evidence_classification: item.evidence_classification,
    confidence: item.confidence,
    report_sections_affected: item.report_sections_affected,
    supporting_photograph_ids: item.photograph_ids,
    supporting_observation_ids: item.observation_ids,
    inspector_approval_date: item.approval_time,
    main_report_or_appendix: item.main_report_or_appendix
  }));
  const mapFeatures = [];
  active.forEach(annotation => evidenceCoordinates(manifest, annotation).forEach(point => mapFeatures.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: [point.lon, point.lat] },
    properties: { annotation_id: annotation.annotation_id, evidence_id: point.id, classification: annotation.evidence_classification, observed_geometry: true, inferred_boundary: false, style_class: "approved-review-point" }
  })));
  return {
    findings: { schema_name: "property-intelligence-approved-review-findings", schema_version: "1.0", property_id: manifest.property_id, inspection_id: manifest.inspection_id, active_findings: findings, excluded_rejected_or_superseded_annotation_ids: rejected.map(item => item.annotation_id), source_rule: "Only inspector-approved Active annotations appear here. Original evidence and rejected/superseded annotations remain in audit history." },
    reportUpdates: { schema_name: "property-intelligence-regenerated-report-updates", schema_version: "1.0", property_id: manifest.property_id, inspection_id: manifest.inspection_id, updates: array(reportUpdates.updates || reportUpdates).filter(item => findings.some(finding => finding.annotation_id === item.annotation_id)), traceability_rule: "Every material statement cites annotation ID, supporting evidence IDs, and inspector approval date." },
    map: { type: "FeatureCollection", name: "approved-review-annotations", properties: { inferred_boundary_style_rule: "Inferred boundaries must be visually different from observed points." }, features: mapFeatures }
  };
}

function importChatReviewPackage(packagePath, repositoryRoot, options) {
  const settings = options || {};
  const packageBytes = fs.readFileSync(packagePath);
  const entries = parseStoredZip(packageBytes);
  const rawAnnotations = jsonEntry(entries, "CHAT_REVIEW_ANNOTATIONS.json");
  const inspectionRoot = findInspectionRoot(repositoryRoot, rawAnnotations.property_id, rawAnnotations.inspection_id);
  const manifest = JSON.parse(fs.readFileSync(path.join(inspectionRoot, "inspection.json"), "utf8"));
  const validated = validateChatReviewEntries(entries, manifest);
  const sessionId = safeComponent(validated.annotationDoc.review_session_id, "review session ID");
  const reviewRoot = targetWithin(inspectionRoot, `reviews/${sessionId}`);
  const packageHash = sha256(packageBytes);
  const writes = [];
  const write = (relative, bytes) => writes.push({ relative: safeRelativePath(relative), target: targetWithin(reviewRoot, relative), bytes: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes) });
  write("source/CHAT_REVIEW_PACKAGE.zip", packageBytes);
  REQUIRED_FILES.forEach(name => write(`source/${name}`, entries.get(name)));
  write("validation.json", JSON.stringify({ schema_name: "property-intelligence-chat-review-validation", schema_version: "1.0", validated_at: settings.reviewedAt || validated.annotationDoc.created_at || (validated.annotations[0] && validated.annotations[0].created_at) || null, property_id: manifest.property_id, inspection_id: manifest.inspection_id, review_session_id: sessionId, package_sha256: packageHash, referenced_records_verified: true, cross_inspection_references_found: false, proposed_annotation_count: validated.annotations.length }, null, 2) + "\n");
  write("proposed-annotations.json", JSON.stringify({ review_session_id: sessionId, annotations: validated.annotations }, null, 2) + "\n");

  let approvedAnnotations = [];
  if (settings.approve === true) {
    if (!settings.inspector || !settings.approvalTime) throw new Error("Approval requires inspector and approvalTime. Staging alone never activates findings.");
    approvedAnnotations = validated.annotations.map(item => {
      const row = clone(item);
      if (row.status === "Rejected") return row;
      row.approved_by_inspector = true;
      row.approval_time = settings.approvalTime;
      row.approved_by = settings.inspector;
      row.status = row.status === "Superseded" ? "Superseded" : "Active";
      return row;
    });
    validateReportUpdates(validated.reportUpdates, approvedAnnotations);
    const derived = createDerivedReview(manifest, approvedAnnotations, validated.reportUpdates);
    write("approved/annotations.json", JSON.stringify({ review_session_id: sessionId, approved_by: settings.inspector, approval_time: settings.approvalTime, annotations: approvedAnnotations }, null, 2) + "\n");
    write("approved/CURRENT_FINDINGS.json", JSON.stringify(derived.findings, null, 2) + "\n");
    write("approved/REGENERATED_REPORT_UPDATES.json", JSON.stringify(derived.reportUpdates, null, 2) + "\n");
    write("approved/REGENERATED_MAP_ANNOTATIONS.geojson", JSON.stringify(derived.map, null, 2) + "\n");
    write("approved/regeneration-receipt.json", JSON.stringify({ status: "regenerated", generated_at: settings.approvalTime, report_sections: Array.from(new Set(approvedAnnotations.flatMap(item => item.report_sections_affected))), map_annotations_generated: true, professional_handoff_updates_included: approvedAnnotations.some(item => item.report_sections_affected.includes("Professional handoff cards")) }, null, 2) + "\n");
  } else {
    write("APPROVAL_REQUIRED.json", JSON.stringify({ status: "awaiting_inspector_approval", activation_performed: false, instruction: "Review proposed-annotations.json and rerun import with explicit inspector approval. Draft, assistant-generated, rejected, and superseded language is excluded from current findings." }, null, 2) + "\n");
  }

  const results = writes.map(item => ({ path: path.relative(repositoryRoot, item.target).replaceAll("\\", "/"), status: immutableWrite(item.target, item.bytes) }));
  return { propertyId: manifest.property_id, inspectionId: manifest.inspection_id, reviewSessionId: sessionId, packageSha256: packageHash, approved: settings.approve === true, activeAnnotationCount: approvedAnnotations.filter(item => item.status === "Active").length, proposedAnnotations: validated.annotations, writes: results };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const packagePath = args[0], repositoryRoot = args[1];
  const approveIndex = args.indexOf("--approve");
  if (!packagePath || !repositoryRoot) {
    process.stderr.write("Usage: node repository/chat-review.js <CHAT_REVIEW_PACKAGE.zip> <repository-root> [--approve <inspector> <approval-ISO-time>]\n");
    process.exitCode = 2;
  } else {
    try {
      const options = approveIndex >= 0 ? { approve: true, inspector: args[approveIndex + 1], approvalTime: args[approveIndex + 2] } : {};
      process.stdout.write(JSON.stringify(importChatReviewPackage(packagePath, repositoryRoot, options), null, 2) + "\n");
    } catch (error) {
      process.stderr.write(`CHAT REVIEW IMPORT FAILED: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

module.exports = { SCHEMA_NAME, SCHEMA_VERSION, RECORD_TYPES, STATUSES, PHOTO_SELECTIONS, REQUIRED_FILES, normalizeAnnotation, validateAnnotation, validateChatReviewEntries, createDerivedReview, importChatReviewPackage, findInspectionRoot };
