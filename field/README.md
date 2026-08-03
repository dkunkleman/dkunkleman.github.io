# Property Inspector

Production, offline-first field evidence collection for the subject rural parcel. The iPhone workflow is deliberately simple: confirm **Offline ready**, tap **Start Inspection**, record observations while walking, then tap **Finish Inspection** and send the one resulting package to ChatGPT.

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

`Finish Inspection` creates a standards-compliant `REPORT_PACKAGE` ZIP for ChatGPT. **Create FULL EVIDENCE ARCHIVE** creates the permanent evidentiary ZIP without clearing or altering the saved inspection.

- **CHATGPT / REPORT PACKAGE** includes every analysis-quality photograph, voice note, raw GPS point, orientation sample, observation, report, map layer, and reconstruction file. Images use a 1,900-pixel maximum dimension and JPEG quality 0.80; older stored analysis copies are optimized sequentially during export without altering the saved evidence. Exact originals are not duplicated, but their SHA-256, source name, dimensions, size, timestamp, and metadata remain in the manifest.
- **FULL EVIDENCE ARCHIVE** additionally includes every exact original photograph byte-for-byte. Its larger size is intentional.

Both modes contain:

- canonical `inspection.json` and a versioned `schema.json`;
- `chatgpt-reconstruction.json`, which requires automatic map, report, timeline, gallery, answered/remaining questions, next-visit, and missed-area outputs without asking the field user to match files;
- every GPS point with time, accuracy, altitude, speed, heading, and device orientation when available;
- every structured observation and free note;
- inspection conditions, evidence classifications, elapsed time, active movement time, stopped time, and distance;
- photo GPS, timestamps, heading, screen orientation, sensor orientation, dimensions, EXIF orientation, sizes, and mandatory SHA-256 hashes;
- actual voice-note audio and its GPS/time/heading/orientation metadata;
- flat CSV, GeoJSON, and GPX analysis copies;
- `observations.csv`, `photo_index.json`, and a self-contained-within-the-package interactive `printable-report.html` with category maps and actual photographs;
- subject and neighboring parcel geometry;
- georeferenced USGS terrain and 2-foot contour context.

The package schema uses stable property, inspection, observation, GPS-point, attachment, lifecycle, conditions, and map-context entities. New observation taxonomies and namespaced attributes can be added without repurposing existing fields.

## Automated verification

From the repository root:

```powershell
node --check field\inspection-package.js
node --check field\app.js
node --check field\idb-recovery.js
node tests\idb-recovery.test.js
node tests\inspection-package.test.js
```

The recovery tests simulate stale cached connections, close events, transaction-creation failures, asynchronous aborts between image-copy serialization, read-back closure, pending-photo recovery, and later package inventory. Package tests independently parse and CRC-check both modes, recover exact originals from the full archive, display every analysis photograph from the report package, and exercise the recorded field scale of 190 photos, 4,964 GPS points, 252 observations, 944 existing orientation samples, and two voice notes.

## Required real-iPhone acceptance test

1. Open the deployed `/field/` page in iPhone Safari while online and wait for **Offline ready**.
2. Turn on Airplane Mode. Reload the page and confirm the terrain, 2-foot contours, red subject boundary, and neighboring boundaries still appear.
3. Tap **Start Inspection**, allow Precise Location and motion/orientation access, then walk at least 20 feet.
4. Record Wet, High Ground, a Free Note, one Voice Note, and at least one photo. Use **Take a photograph after saving** on one structured observation to verify the relationship.
5. Close Safari after saving one observation, reopen it, and confirm the counters and photographs return.
6. Take 20 photos over several minutes. Background and reopen Safari twice, rotate between portrait and landscape, and continue taking photos. If a pending-photo button appears, tap it and confirm recovery.
7. Still offline, tap **Finish Inspection**. Send the single `REPORT_PACKAGE` ZIP to ChatGPT from the iOS share sheet.
8. Upload that one ZIP to ChatGPT. It should follow `chatgpt-reconstruction.json` and produce the interactive map, printable report, inspection timeline, photo gallery, questions answered, questions remaining, suggested next visit, and areas not yet inspected.
9. Return to the unchanged saved inspection and create the `FULL_ARCHIVE` ZIP. Preserve it in a backed-up permanent location and confirm its photo count matches the report package.

Do not clear the inspection until ChatGPT confirms the package was received and every photo can be displayed.
