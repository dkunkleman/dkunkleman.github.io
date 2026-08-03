# Property Intelligence Repository

The repository is the permanent, append-only system of record. The phone collects evidence; the repository stores every immutable inspection export; ChatGPT reads repository records and creates derived analysis without modifying source evidence.

## Ingestion contract

Every Property Inspector ZIP contains `repository-import.json`. It supplies stable `property_id`, `inspection_id`, and `export_id` values plus the permanent property/inspection folder and extraction map.

The importer rejects a repeated `export_id` and never overwrites a different file. Report packages and full archives from the same field visit merge under the same inspection folder because they share an `inspection_id`; each export remains a separate version.

```powershell
node repository\import-package.js C:\Inspections\Pearson_Road_Inspection_REPORT_PACKAGE_....zip D:\Property-Intelligence
```

The resulting layout is append-only:

```text
Pearson_Road/
  Inspection_2026-08-03_<inspection-id>/
    inspection.json
    repository-identity.json
    packages/
      REPORT_PACKAGE_<export-id>.zip
      FULL_ARCHIVE_<export-id>.zip
    versions/<export-id>/
    maps/<export-id>/
    photos/analysis/
    photos/original/
    voice/
    weather/<export-id>/conditions.json
    terrain/
    contours/
    property_boundary/<export-id>/
    analysis/<export-id>/
```

Photo, voice, terrain, and contour filenames are content-addressed with SHA-256. Repeated identical evidence is accepted without rewriting it; a different byte sequence at an existing immutable path stops ingestion.

`printable_report.pdf.pending.json` tells the future repository service to render `printable-report.html` into a PDF. PDF rendering and ChatGPT analysis are deliberately repository responsibilities rather than field-phone work.

## Upload boundary

The current GitHub Pages field app uses the iPhone share sheet as the one-tap handoff. A production repository service should expose an authenticated upload endpoint that accepts one ZIP, runs this same validation and import contract server-side, returns the ingestion receipt, and does not put repository credentials in the browser application.

ChatGPT should receive read-only repository access and use `property_id` for cross-inspection comparison, `inspection_id` to associate artifacts from one visit, and `export_id` for version history.
