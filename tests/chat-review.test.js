"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Package = require("../field/inspection-package.js");
const Review = require("../repository/chat-review.js");

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "property-review-"));
  try {
    const inspectionRoot = path.join(root, "Property_00000017", "Inspection_2026-08-03");
    fs.mkdirSync(inspectionRoot, { recursive: true });
    const manifest = {
      property_id: "property-00000017", inspection_id: "inspection-20260803",
      photographs: [{ photo_id: "photo-P44", latitude: 30.49, longitude: -87.09 }, { photo_id: "photo-P45", latitude: 30.4901, longitude: -87.0901 }],
      voice_notes: [{ voice_note_id: "voice-1" }],
      inspection: {
        observations: [{ observation_id: "observation-water-44", latitude: 30.49, longitude: -87.09 }],
        field_events: [{ observation_id: "observation-homesite-44", latitude: 30.49, longitude: -87.09 }],
        gps_track: [{ gps_point_id: "gps-44", latitude: 30.49, longitude: -87.09 }]
      }
    };
    fs.writeFileSync(path.join(inspectionRoot, "repository-identity.json"), JSON.stringify({ property_id: manifest.property_id, inspection_id: manifest.inspection_id }));
    fs.writeFileSync(path.join(inspectionRoot, "inspection.json"), JSON.stringify(manifest));

    const session = "review-pearson-20260803-01";
    const createdAt = "2026-08-03T20:00:00.000Z";
    const annotations = [
      {
        schema_name: Review.SCHEMA_NAME, schema_version: Review.SCHEMA_VERSION, annotation_id: "annotation-p44-water", property_id: manifest.property_id, inspection_id: manifest.inspection_id, review_session_id: session,
        created_at: createdAt, created_by: "ChatGPT with inspector", approved_by_inspector: false, approval_time: null, source_conversation_reference: "Pearson photo review P44",
        photograph_ids: ["photo-P44"], observation_ids: ["observation-water-44"], voice_note_ids: [], gps_point_ids: ["gps-44"], inspection_area_id: "small-tract",
        report_sections_affected: ["Drainage", "Photo captions"], exact_inspector_statement: "P44 is shallow standing water measured at approximately 3 inches, not homesite evidence.", concise_approved_finding: "P44 documents approximately three inches of shallow standing water.",
        record_type: "Measurement", evidence_classification: "Measured", confidence: "high", status: "Draft", supersedes_annotation_id: null,
        supporting_evidence: ["photo-P44", "observation-water-44"], contradicting_evidence: [], unanswered_questions: [], professional_verification_question: null, main_report_or_appendix: "main-report"
      },
      {
        schema_name: Review.SCHEMA_NAME, schema_version: Review.SCHEMA_VERSION, annotation_id: "annotation-rejected-brush", property_id: manifest.property_id, inspection_id: manifest.inspection_id, review_session_id: session,
        created_at: createdAt, created_by: "ChatGPT", approved_by_inspector: false, approval_time: null, source_conversation_reference: "Assistant exploratory interpretation",
        photograph_ids: ["photo-P45"], observation_ids: [], voice_note_ids: ["voice-1"], gps_point_ids: [], inspection_area_id: "small-tract",
        report_sections_affected: ["Inspection Scope"], exact_inspector_statement: "The inspector rejected this characterization.", concise_approved_finding: "The entire corridor was dense impassable brush.",
        record_type: "Inspector interpretation", evidence_classification: "Interpretation", confidence: "low", status: "Rejected", supersedes_annotation_id: null,
        supporting_evidence: ["photo-P45"], contradicting_evidence: [], unanswered_questions: [], professional_verification_question: null, main_report_or_appendix: "appendix"
      }
    ];
    const approvalTime = "2026-08-03T20:30:00.000Z";
    const zip = new Package.ZipBuilder();
    zip.add("CHAT_REVIEW_ANNOTATIONS.json", JSON.stringify({ schema_name: "property-intelligence-chat-review-annotations", schema_version: "1.0", property_id: manifest.property_id, inspection_id: manifest.inspection_id, review_session_id: session, created_at: createdAt, annotations }));
    zip.add("PHOTO_REVIEW.md", "# Photo Review\n\nP44 reviewed with the inspector.\n");
    zip.add("REPORT_UPDATES.json", JSON.stringify({ updates: [{ annotation_id: "annotation-p44-water", report_section: "Drainage", replacement_text: "P44 documents approximately three inches of shallow standing water.", supporting_photograph_ids: ["photo-P44"], supporting_observation_ids: ["observation-water-44"], inspector_approval_date: approvalTime }] }));
    zip.add("CORRECTIONS.json", JSON.stringify({ corrections: ["annotation-p44-water"] }));
    zip.add("QUESTIONS_REMAINING.json", JSON.stringify({ questions: [] }));
    zip.add("PHOTO_SELECTION.json", JSON.stringify({ photographs: [{ photo_id: "photo-P44", classification: "Critical" }, { photo_id: "photo-P45", classification: "Reference" }] }));
    zip.add("REVIEW_SESSION_SUMMARY.md", "# Review Session Summary\n");
    const packagePath = path.join(root, "CHAT_REVIEW_PACKAGE.zip");
    fs.writeFileSync(packagePath, Buffer.from(await (await zip.build()).arrayBuffer()));

    const staged = Review.importChatReviewPackage(packagePath, root);
    assert.equal(staged.approved, false);
    assert.equal(staged.proposedAnnotations.length, 2, "proposed findings are shown before activation");
    assert(fs.existsSync(path.join(inspectionRoot, "reviews", session, "source", "CHAT_REVIEW_PACKAGE.zip")), "source review package is permanently preserved");
    assert(!fs.existsSync(path.join(inspectionRoot, "reviews", session, "approved", "CURRENT_FINDINGS.json")), "staging does not activate findings");

    const approved = Review.importChatReviewPackage(packagePath, root, { approve: true, inspector: "Daniel Kunkleman", approvalTime });
    assert.equal(approved.activeAnnotationCount, 1, "rejected assistant interpretation does not become active");
    const findings = JSON.parse(fs.readFileSync(path.join(inspectionRoot, "reviews", session, "approved", "CURRENT_FINDINGS.json"), "utf8"));
    assert.equal(findings.active_findings[0].annotation_id, "annotation-p44-water");
    assert.equal(findings.active_findings[0].inspector_approval_date, approvalTime);
    assert.deepEqual(findings.excluded_rejected_or_superseded_annotation_ids, ["annotation-rejected-brush"]);

    const broken = new Map(Review.REQUIRED_FILES.map(name => [name, Buffer.from("{}") ]));
    broken.set("CHAT_REVIEW_ANNOTATIONS.json", Buffer.from(JSON.stringify({ schema_name: "property-intelligence-chat-review-annotations", schema_version: "1.0", property_id: manifest.property_id, inspection_id: manifest.inspection_id, review_session_id: session, annotations: [Object.assign({}, annotations[0], { photograph_ids: ["photo-from-another-inspection"] })] })));
    broken.set("PHOTO_SELECTION.json", Buffer.from(JSON.stringify({ photographs: [] })));
    broken.set("REPORT_UPDATES.json", Buffer.from(JSON.stringify({ updates: [] })));
    assert.throws(() => Review.validateChatReviewEntries(broken, manifest), /unknown photograph/, "broken and cross-inspection references are rejected");

    process.stdout.write("PASS: Chat Review staging, identity/reference validation, explicit inspector approval, immutable source preservation, traceable regeneration, and rejected-assistant exclusion.\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
