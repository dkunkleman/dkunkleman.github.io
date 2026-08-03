# Property Inspector

Production, offline-first field evidence collection for the subject rural parcel. The iPhone workflow is deliberately simple: confirm **Offline ready**, tap **Start Inspection**, record observations while walking, then tap **Finish Inspection** and save the one resulting package to the Property Intelligence Repository. ChatGPT analyzes the permanent repository record rather than acting as file storage.

## Reliability model

- The app shell, parcel geometry, USGS terrain, and USGS 2-foot contour raster are cached under the `/field/` service-worker scope.
- GPS points, observations, notes, and device-orientation samples are written to local recovery storage as they are recorded.
- Original photo bytes and browser-rendered analysis copies are stored in IndexedDB. Photo metadata and the photo event are stored with the bytes so an interruption between attachment storage and screen refresh can be reconciled.
- Every IndexedDB operation uses one generation-aware transaction manager. A closing, closed, aborted, or inactive connection is invalidated, reopened, and retried exactly once. Old connection callbacks cannot invalidate a newer generation.
- Photo capture is not reported as successful until the original, analysis copy, metadata, and marker commit atomically and a read-back verifies both image byte counts. A second failure retains the record in a visible, cache-backed **Retry Pending Photo** queue.
- Voice notes are written to IndexedDB in one-second recovery chunks while recording. A reload recovers a recording through the last stored chunk.
- Package export fails closed if any original photo, analysis copy, voice note, GPS record, or parcel geometry cannot be recovered. A missing optional terrain or contour raster is disclosed but does not block evidence capture or export.
- The original photograph is never replaced by the analysis copy.

## Two one-file package modes

`Finish Inspection` creates an AI-ready `AI_ANALYSIS_REPORT_PACKAGE` ZIP for repository ingestion and immediate ChatGPT analysis. **Create FULL EVIDENCE ARCHIVE** creates the permanent evidentiary ZIP without clearing or altering the saved inspection.

- **CHATGPT ANALYSIS PACKAGE** includes every analysis-quality photograph, voice note, raw GPS point, orientation sample, evidence observation, inspector thought, report instruction, map layer, and reconstruction file. It routes every observation to access, buildability, economic potential, cost/risk, or distinctive value and requires explained confidence plus the cheapest credible next investigation. Images use a 1,900-pixel maximum dimension and JPEG quality 0.80; older stored analysis copies are optimized sequentially during export without altering the saved evidence. Exact originals are not duplicated, but their SHA-256, source name, dimensions, size, timestamp, and metadata remain in the manifest.
- **FULL EVIDENCE ARCHIVE** additionally includes every exact original photograph byte-for-byte. Its larger size is intentional.

Both modes contain:

- `AI_README.md`, the plain-English first-read contract that tells ChatGPT what the inspection contains, how evidence relates, and how to report uncertainty;
- `AI_ANALYSIS.json`, the analysis-first view organized as Executive Summary, Property Information, Inspection Conditions, Inspection Statistics, GPS Track, Observations, Photographs, Voice Notes, Map Layers, Weather, Terrain, Contours, Parcel Boundary, Public Data, Evidence Relationships, Suggested Inspection Questions, and Metadata;
- `DECISION_BRIEF.json`, the five-decision brief with routed evidence, possible strengths and weaknesses, material-unknown rules, an explained 0-100 confidence rubric, lowest-cost investigation requirements, and evidence-triggered professional follow-up;
- `REPORT_TEMPLATE.md`, with the required professional Property Intelligence Report sections;
- `INSPECTOR_THOUGHTS.md`, which preserves the inspector's judgment, theories, concerns, and preferences while explicitly separating them from observed facts;
- `EVIDENCE_RELATIONSHIPS.json`, which directly joins observations, photographs, voice notes, and stable GPS-point IDs;
- `SUGGESTED_INSPECTION_QUESTIONS.md`, which distinguishes questions answerable from the package from questions requiring additional evidence;
- `repository-import.json`, which assigns an immutable property folder, inspection folder, export ID, extraction map, and reject-on-collision policy;
- `repository-comparison.json`, a compact normalized record for future comparisons of standing water, trees, construction, improvements, and recurring observations;
- canonical `inspection.json` and a versioned `schema.json`;
- `chatgpt-reconstruction.json`, which requires automatic map, report, timeline, gallery, answered/remaining questions, next-visit, and missed-area outputs without asking the field user to match files;
- every GPS point with time, accuracy, altitude, speed, heading, and device orientation when available;
- every structured observation and free note, each directly referencing its GPS point and nearest photographs and voice notes;
- inspection conditions, evidence classifications, elapsed time, active movement time, stopped time, and distance;
- photo GPS, timestamps, heading, cardinal direction faced, screen orientation, sensor orientation, associated observation, GPS-point ID, weather reference, map location, dimensions, EXIF orientation, sizes, and mandatory SHA-256 hashes;
- actual voice-note audio and its observation/GPS/time/heading/orientation relationships;
- flat CSV, GeoJSON, and GPX analysis copies;
- `observations.csv`, `photo_index.json`, and a self-contained-within-the-package interactive `printable-report.html` with category maps and actual photographs;
- subject and neighboring parcel geometry;
- georeferenced USGS terrain and 2-foot contour context.

The package schema uses stable property, inspection, export, observation, GPS-point, attachment, lifecycle, conditions, and map-context entities. New observation taxonomies and namespaced attributes can be added without repurposing existing fields. `property_id` joins repeated visits to the same property, `inspection_id` joins report/full artifacts from one visit, and `export_id` preserves every package revision.

The reference append-only importer is documented in [`../repository/README.md`](../repository/README.md). It permanently stores each source ZIP, extracts versioned maps and records, content-addresses photo/voice/map evidence by SHA-256, and refuses to overwrite an existing export.

## Automated verification

From the repository root:

```powershell
node --check field\inspection-package.js
node --check field\app.js
node --check field\idb-recovery.js
node --check repository\import-package.js
node tests\idb-recovery.test.js
node tests\inspection-package.test.js
```

The recovery tests simulate stale cached connections, close events, transaction-creation failures, asynchronous aborts between image-copy serialization, read-back closure, pending-photo recovery, and later package inventory. Package tests independently parse and CRC-check both modes, recover exact originals, exercise the recorded 190-photo field scale, import report/full packages into the same inspection folder, verify content-addressed evidence, and prove that importing the same export twice is rejected instead of overwritten.

## Required real-iPhone acceptance test

1. Open the deployed `/field/` page in iPhone Safari while online and wait for **Offline ready**.
2. Turn on Airplane Mode. Reload the page and confirm the terrain, 2-foot contours, red subject boundary, and neighboring boundaries still appear.
3. Tap **Start Inspection**, allow Precise Location and motion/orientation access, then walk at least 20 feet.
4. Record Wet, High Ground, a Free Note, one Voice Note, and at least one photo. Use **Take a photograph after saving** on one structured observation to verify the relationship.
5. Close Safari after saving one observation, reopen it, and confirm the counters and photographs return.
6. Take 20 photos over several minutes. Background and reopen Safari twice, rotate between portrait and landscape, and continue taking photos. If a pending-photo button appears, tap it and confirm recovery.
7. Still offline, tap **Finish Inspection**. Use **Save to Property Intelligence Repository** in the iOS share sheet for the single `AI_ANALYSIS_REPORT_PACKAGE` ZIP.
8. Confirm the repository receipt names the expected property folder, inspection folder, and unique export ID. ChatGPT should begin with `AI_README.md` and `DECISION_BRIEF.json`, answer the five property decisions, then produce the supporting map, report, timeline, gallery, role-specific questions, next visit, and uninspected areas without asking the user to match evidence.
9. Return to the unchanged saved inspection and create the `FULL_ARCHIVE` ZIP. Save it to the same repository inspection; it must create a second export version and add exact originals without replacing the report package.

Do not clear the inspection until the repository confirms both packages were received and every photo can be displayed.
