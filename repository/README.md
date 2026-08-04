# Property Intelligence Repository

The repository is the permanent, append-only system of record. The phone collects evidence; the repository stores every immutable inspection export; ChatGPT reads repository records and creates derived analysis without modifying source evidence.

## Ingestion contract

Every Property Inspector ZIP contains `repository-import.json`. It supplies stable `property_id`, `inspection_id`, and `export_id` values plus the permanent property/inspection folder and extraction map.

The importer rejects a repeated `export_id` and never overwrites a different file. Report packages and full archives from the same field visit merge under the same inspection folder because they share an `inspection_id`; each export remains a separate version.

```powershell
node repository\import-package.js C:\Inspections\Pearson_Road_Inspection_AI_ANALYSIS_REPORT_PACKAGE_....zip D:\Property-Intelligence
```

The resulting layout is append-only:

```text
Pearson_Road/
  Inspection_2026-08-03_<inspection-id>/
    inspection.json
    repository-identity.json
    packages/
      AI_ANALYSIS_REPORT_PACKAGE_<export-id>.zip
      FULL_ARCHIVE_<export-id>.zip
    versions/<export-id>/
    maps/<export-id>/
      SMALL_TRACT_WATER_MAP.json
      FLOWING_WATER_CORRIDORS.json
      small-tract-water-map.html
    photos/analysis/
    photos/original/
    photos/audit/
    voice/
    voice/audit/
    weather/<export-id>/
      WEATHER_CONTEXT.json
      conditions.json
    terrain/
    contours/
    property_boundary/<export-id>/
    analysis/<export-id>/
      AI_README.md
      AI_ANALYSIS.json
      DECISION_BRIEF.json
      REPORT_TEMPLATE.md
      INSPECTOR_THOUGHTS.md
      INSPECTOR_HYPOTHESES.md
      EVIDENCE_AUDIT_HISTORY.json
      FIELD_EVIDENCE_REVIEW.json
      PROFESSIONAL_HANDOFF_CARDS.json
      professional-handoff-cards.html
      EVIDENCE_RELATIONSHIPS.json
      SUGGESTED_INSPECTION_QUESTIONS.md
```

Photo, voice, terrain, and contour filenames are content-addressed with SHA-256. Repeated identical evidence is accepted without rewriting it; a different byte sequence at an existing immutable path stops ingestion.

Correction-aware packages keep active evidence in the normal photo and voice collections. Voided attachments are separately integrity-checked and retained under `photos/audit/` and `voice/audit/`. The correction therefore changes findings without destroying the original record or bytes.

## Import Chat Review

Post-inspection conversations return one `CHAT_REVIEW_PACKAGE.zip`. Stage it first:

```text
node repository/chat-review.js CHAT_REVIEW_PACKAGE.zip PROPERTY_INTELLIGENCE_REPOSITORY
```

The importer validates `property_id`, `inspection_id`, and every photograph, observation, voice-note, and GPS reference. It permanently stores the source ZIP and seven required review files under `reviews/<review_session_id>/`, writes the proposed annotations, and stops at `APPROVAL_REQUIRED.json`.

After the inspector reviews the proposal, activate it explicitly:

```text
node repository/chat-review.js CHAT_REVIEW_PACKAGE.zip PROPERTY_INTELLIGENCE_REPOSITORY --approve "Inspector Name" 2026-08-03T20:30:00.000Z
```

Approval appends an immutable approved annotation version and regenerates traceable current findings, report updates, and map annotations. Every material report update cites its annotation ID, supporting photograph or observation IDs, and inspector approval date. Draft, Rejected, and Superseded annotations remain in audit history and are excluded from current findings.

Tree evidence remains purpose- and safety-aware after ingestion. Whole-tree obstruction, the alternative-view plan, AI suggestions, inspector determination, missing features, and leaf provenance remain part of the evidence-set history. Weather ingestion likewise preserves the explicit separation between weather context, inspection-time site observations, inferred causes, and year-round conditions not established.

Confirmed creek Evidence Sets are retained in `FLOWING_WATER_CORRIDORS.json`. Exact photographs and measurements remain observed evidence; dashed centerlines and flow arrows remain explicit inferences. Pending group suggestions never enter the current map, and uninspected watercourse extent is never filled in.

`printable_report.pdf.pending.json` tells the future repository service to render `printable-report.html` into a PDF. PDF rendering and ChatGPT analysis are deliberately repository responsibilities rather than field-phone work.

## Upload boundary

The current GitHub Pages field app uses the iPhone share sheet as the one-tap handoff. A production repository service should expose an authenticated upload endpoint that accepts one ZIP, runs this same validation and import contract server-side, returns the ingestion receipt, and does not put repository credentials in the browser application.

ChatGPT should receive read-only repository access and use `property_id` for cross-inspection comparison, `inspection_id` to associate artifacts from one visit, and `export_id` for version history. For a single visit it should read `AI_README.md` first, use `DECISION_BRIEF.json` to answer the five property decisions, then inspect `AI_ANALYSIS.json` and all linked evidence; inspector thoughts remain available for retrospective reasoning comparison but are never promoted to observed fact.
