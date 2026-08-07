# Property Inspector

Production, offline-first field evidence collection for the subject rural parcel. The iPhone workflow is deliberately simple: confirm **Offline ready**, tap **Start Inspection**, record observations while walking, then tap **Finish Inspection** and save the one resulting package to the Property Intelligence Repository. ChatGPT analyzes the permanent repository record rather than acting as file storage.

## Inspection Coaching

- Create one or more investigation questions and select any question(s) the next evidence should answer.
- Create named inspection areas such as **Large Tract – Northwest**, **Road Frontage**, **Creek**, or **South Ridge**. The selected area attaches automatically to each new observation, photograph, note, inspector thought, and voice note.
- Mark question-linked evidence as supporting, contradicting, or context. This prevents an evidence count from being mistaken for a conclusion.
- Mark each photograph **Critical**, **Helpful**, **Reference**, or **Duplicate**. The default is Helpful, and the value can be changed from the paginated gallery without altering image bytes.
- View a conservative route-proximity estimate of **Well inspected**, **Lightly inspected**, and **Not inspected** parcel cells. The method and limitation are exported; unvisited acreage is never represented as inspected.
- Before GPS is stopped, **Finish Inspection** presents the most important unanswered questions, missing photographs and measurements, empty inspection areas, and the cheapest next evidence to collect. The inspector may safely return to the inspection or finish with the uncertainty explicitly preserved.
- The package includes `QUESTION_BRIEF.json`, `FIELD_COACHING.json`, and `RETURN_VISIT_PLAN.json`, plus field-efficiency estimates for walking, stopping, documenting, observation spacing, evidence per acre, and questions answered versus remaining.

## Correctable professional evidence

- **Undo / Correct Last Record** is always visible. It can mark an observation, button press, photograph, category, area assignment, or voice note Correct, Accidental, Wrong Category, Wrong Area, Duplicate, Needs Clarification, or Withdrawn.
- Corrections are append-only. The original entry, correction time, reason, corrected value, inspector identity, and active/corrected/voided status are preserved. Voided records are excluded from maps, findings, decision briefs, and active counts while remaining recoverable under `EVIDENCE_AUDIT_HISTORY.json` and `audit/` attachment paths.
- The Pearson Road Entrance press at `2026-08-03T13:04:01.864Z` is automatically and non-destructively marked accidental when that saved inspection is loaded or packaged.
- **UNDO LAST** is permanently visible and creates a `user_undo` audit correction instead of deleting evidence. **REVIEW / CORRECT RECORDS** can correct older observations, photographs, voice notes, thoughts, areas, questions, photo classifications, and group assignments.
- The accidental Pearson Homesite press near P44 is voided non-destructively. P44 is corrected in the effective view to Water Measurement, explicitly separated from the Homesite source record, while both originals remain in the audit.

## Multi-photo Evidence Sets

- **START PHOTO GROUP** begins one inspector-confirmed subject. While active, photographs, voice notes, measurements, and observations attach to that subject until **FINISH THIS SUBJECT**.
- Individual Tree sets receive permanent property-level `tree_id` values and collect species confidence, DBH basis, height estimates, condition, purpose, explanation, and the whole-tree/bark/base/crown photo pattern.
- Water, tree/canopy, homesite, drainage, access, boundary, view, vegetation, and other sets retain every exact photo point and role while reports describe the set once.
- Automatic grouping is suggestion-only. The app offers **Yes, same subject**, **No, separate subjects**, **Select which photos**, and **Ask me later**; it never activates a group silently.
- `EVIDENCE_SETS.json` contains effective set summaries, pending suggestions, and append-only relationship events. Printable reports use one group marker and list individual photo roles and locations under the subject.
- Pearson P45-P59, P64-P67, P68-P72, and P73 review patterns are preloaded only as pending inspector-confirmation suggestions. P72 is suggested as Measurement and P73 as Transition.
- **Flowing Water / Creek Corridor** is a distinct subject type. It requests safely obtainable upstream, downstream, across-channel, measurement, flow, bank, high-ground, amenity, avoidance, road/homesite relationship, and voice evidence without asking the inspector to cross a channel or stand in moving water.
- The real Pearson P107-P118, P121-P125, P132-P136, and P143-P145 sequence is proposed as the pending **Northwest Creek / Flowing-Water Corridor**. P145 is proposed as Measurement plus Flow Evidence; P135/P136 as Scenic Context; P139 as related Adjacent Higher-Ground / Tree Context; and P143/P144 as Upstream/Downstream views. Nothing activates without inspector approval.
- Every photograph explicitly asks whether a tape, ruler, staff, diameter tape, or other measuring device is visible. A Yes answer opens **What did you measure?** immediately. The inspector-entered number, unit, measured/estimated basis, endpoint check, alignment check, subject, instrument, and water context become the authoritative record; the image is supporting evidence only.
- Pearson P158-P159 and P162-P163 are two separate pending localized-puddle suggestions. Their approximate 3-4 inch and 4-5 inch review ranges never become active measurements until the inspector enters and confirms an exact value.
- **Preliminary Timber Reconnaissance** extends Individual Tree evidence and adds fixed-radius **Timber Sample Plot** sets. Permanent `tree_id` and `plot_id` values retain probable/alternative species, confidence, DBH method, circumference conversion, height method, usable logs, defects, multiple purposes, photographs, access, wet ground, and plot design.
- Plot summaries calculate trees per acre, average DBH, DBH distribution, species mix, and basal area only from the stated fixed-radius sample. Volume remains `NOT_CALCULATED` unless an appropriate published equation/table is explicitly selected and validated. Convenience, targeted, or sparse plots are never described as a formal statistically valid cruise.
- The package includes `STRUCTURED_MEASUREMENTS.json`, `PRELIMINARY_TIMBER_RECONNAISSANCE.json`, `FORESTER_HANDOFF.json`, and `FORESTER_HANDOFF.md`. Timber output always carries the required limitation that it is not a certified timber cruise, timber appraisal, sale volume, or market valuation.

## Post-inspection Chat Review

- Every inspection package contains `CHAT_REVIEW_RETURN_INSTRUCTIONS.md` and `schemas/property-intelligence-review-annotation.schema.json` so ChatGPT can return one standard `CHAT_REVIEW_PACKAGE.zip` after photo-by-photo review.
- Review annotations are discrete, versioned records. Whole conversations and assistant language never become facts. Only inspector-approved `Active` annotations affect derived findings.
- `POST_INSPECTION_REVIEW.json` separates active approved annotations from Draft, Rejected, and Superseded audit history.
- Repository import is two-stage: `node repository/chat-review.js CHAT_REVIEW_PACKAGE.zip <repository-root>` validates and stages proposals; rerun with `--approve "Inspector Name" 2026-08-03T20:30:00.000Z` only after the inspector reviews them.
- A photograph is never assigned to a nearby prior observation as fact. Unconfirmed proximity is labeled `nearest_by_location_unconfirmed`; only an inspector-confirmed direct relationship becomes `observation_id`.
- After the voice explanation, the app records what the photo shows, whether anything was measured or estimated, the area represented, why it matters, and whether it supplies Context, Evidence, Measurement, or Relationship coverage. The gallery displays the missing roles.
- **Inspector Hypothesis** records interpretation separately from facts, with triggering observations, supporting photographs, contradictions, an exact verification question, professional type, and cheapest next evidence step.
- `FIELD_EVIDENCE_REVIEW.json` identifies strong and repetitive evidence, missing context and measurements, unsupported hypotheses, professional-ready questions, and cautious review candidates for field time that may have produced little additional value.
- `PROFESSIONAL_HANDOFF_CARDS.json`, Markdown audience cards, and `professional-handoff-cards.html` provide one-page builder, civil/drainage engineer, surveyor, forester, soil/septic, buyer, and seller handoffs without claiming to replace licensed work.

## Reviewed property synthesis

- **REVIEW AND BUILD REPORT** guides the inspector through corrections, Evidence Sets, the water map, creek map, vegetation map, homesite concepts, ChatGPT review import, and final report generation. No inferred phase, zone, grouping, map interpretation, or land-use concept becomes active without inspector approval.
- The real Pearson P3-P196 review is organized into 12 pending photo phases. P3-P11 remain limited large-tract context; P12-P196 remain the primary 5.48-acre small-tract evidence. The immutable Entrance and P44 Homesite corrections continue to exclude the accidental button presses without deleting them.
- `SEGMENTED_ROUTE.json` preserves every raw GPS point while splitting displayed walked geometry at rejected fixes, pauses, area/phase changes, relocations, gaps over 120 seconds, and implied speeds over 5 m/s. Unverified relocation is dashed gray or hidden; it is never represented as walked.
- `CREEK_CORRIDOR_MAP.json`, `VEGETATION_CLEARING_MAP.json`, and `HOMESITE_OPPORTUNITY_MAP.json` each have an interactive HTML view. Photo markers open the actual packaged analysis photograph and associated voice evidence. Confirmed creek centerlines remain dashed, conceptual zones remain non-surveyed, and all required limitations travel with the maps.
- `PROPERTY_INTELLIGENCE_REPORT.md`, its interactive/printable HTML versions, and `AUDIENCE_REPORTS.json` turn the same immutable evidence into plain-English buyer, seller, builder, forester, drainage-engineer, and internal views. Every report section states meaning, supporting photos, supporting observations, evidence classification, confidence, and limitations.

## Small-tract water intelligence

- After every saved photograph, the app immediately asks **“Why did you take this picture?”** and starts a voice explanation. The audio inherits the photo's area and questions and is linked back to that photograph in IndexedDB and the exported package.
- The inspector explicitly confirms Standing Water, Flowing Water, Ditch, Creek or Stream, Other Water, No, or Unsure. The app never silently treats a photograph as water evidence.
- Confirmed water may record depth, measured/estimated basis, width, length, and behavior. These fields drive a searchable significance classification without treating every small depression as a building constraint.
- The verified parcel's smaller exterior ring is automatically isolated as the approximately 5.48-acre **Small Tract**. Evidence outside that ring is excluded even when it occurred close in time.
- Nearby compatible photographs may form a conservative `WA-#` cluster. A single photo without dimensions stays a point. Entered dimensions constrain outlines; flowing water never merges indiscriminately with isolated standing puddles.
- The live map and package distinguish actual blue photo points, estimated dashed blue outlines, preliminary red building-avoidance areas, inspected corridor with no standing water observed, and uninspected/unknown acreage.
- An inspector-confirmed creek set adds exact flowing-water points, a dashed conservative centerline, reported flow-direction arrows, measured depth/width points, adjacent high-ground evidence, scenic/amenity photographs, and building-avoidance context. Pending groups never create a centerline.
- Creek reports always state: **Observed flowing-water corridor. Permanence, ordinary high-water limits, wetlands status, drainage rights and building setbacks remain unverified.** Creek alignment beyond connected photographed evidence remains uninspected/unknown.
- `SMALL_TRACT_WATER_MAP.json` is the AI-readable model. `small-tract-water-map.html` is the interactive human-readable map; its markers open the actual photograph and photo-linked voice explanation. The printable report adds four landscape small-tract water pages.
- `FLOWING_WATER_CORRIDORS.json` separates the confirmed creek corridor, adjacent wooded ground, isolated puddles elsewhere, inferred alignment, and uninspected watercourse extent for immediate ChatGPT analysis.

## Reliability model

- The app shell, parcel geometry, USGS terrain, and USGS 2-foot contour raster are cached under the `/field/` service-worker scope.
- GPS points, observations, notes, and device-orientation samples are written to local recovery storage as they are recorded.
- Original photo bytes and browser-rendered analysis copies are stored in IndexedDB. Photo metadata and the photo event are stored with the bytes so an interruption between attachment storage and screen refresh can be reconciled.
- Every IndexedDB operation uses one generation-aware transaction manager. A closing, closed, aborted, or inactive connection is invalidated, reopened, and retried exactly once. Old connection callbacks cannot invalidate a newer generation.
- Photo capture is not reported as successful until the original, analysis copy, metadata, and marker commit atomically and a read-back verifies both image byte counts. A second failure retains the record in a visible, cache-backed **Retry Pending Photo** queue.
- Voice notes are written to IndexedDB in one-second recovery chunks while recording. A reload recovers a recording through the last stored chunk.
- Package export fails closed if any original photo, analysis copy, voice note, GPS record, or parcel geometry cannot be recovered. A missing optional terrain or contour raster is disclosed but does not block evidence capture or export.
- The original photograph is never replaced by the analysis copy.

## Adaptive tree-identification evidence

- Individual Tree and Tree Group sets first ask whether most of the subject can be photographed safely and clearly. Canopy, nearby trees, brush, water or unsafe ground, boundaries, and access restrictions are valid limitations. Creek-side tree evidence can record the tree's relationship to the creek and proposed homesite without requiring a crossing.
- If the whole subject is unavailable, the app stops requesting that view and switches to purpose-specific obtainable evidence: base/ground, bark, lower trunk, visible crown, connected branch, leaf surfaces, twig/bud, reproductive material, opposite-side trunk, or a slow panorama when safe.
- Species-identification, timber, landscape/preserve, hazard, and forest-character purposes each receive a different evidence sequence. The app never directs the inspector across water, into unsafe brush, outside authorized property, up a tree, or into traffic.
- AI species suggestions retain alternatives, visible features, missing features, and a confidence level, but remain explicitly **AI suggestion — not confirmed**. Only Inspector confirmed, Probable, Possible, Unknown, or Professional identification requested may become the recorded determination.
- A leaf photograph records whether it was traced to the tree, probably belongs to it, or is uncertain. An uncertain fallen leaf is never silently treated as subject-tree evidence.

## Weather context

- `Finish Inspection` automatically resolves the previous calendar day, previous 7 full days, and previous 30 full days from the nearest supported official NOAA/NWS/NCEI station. It records station name/ID/coordinates, straight-line distance and method, retrieval time, exact daily station records, 1991-2020 normals, derived amount/percentage departures, source record IDs/URLs, and significant-event context.
- A verified result is saved with the inspection for offline reuse. Pearson Road on August 3, 2026 has a bundled, source-identified NOAA snapshot so a no-service finish still includes the actual official record. Other historical dates retrieve NCEI daily summaries and station normals when online and then retain the verified record on the phone.
- Manual local-rain knowledge remains separate and is never overwritten as parcel rainfall. `WEATHER_CONTEXT.json`, `AI_ANALYSIS.json`, the repository weather record, and the printable report keep official station context, inspector-reported local conditions, observed site conditions, inferred causes, and year-round conditions not established as separate analytical categories.
- Station rainfall may differ materially from parcel rainfall. Named storms provide regional context; they do not prove that a parcel condition or particular rainfall total was caused by that storm.

## Two one-file package modes

`Finish Inspection` creates an AI-ready `AI_ANALYSIS_REPORT_PACKAGE` ZIP for repository ingestion and immediate ChatGPT analysis. **Create FULL EVIDENCE ARCHIVE** creates the permanent evidentiary ZIP without clearing or altering the saved inspection.

- **CHATGPT ANALYSIS PACKAGE** includes every analysis-quality photograph, voice note, raw GPS point, orientation sample, evidence observation, inspector thought, report instruction, map layer, and reconstruction file. It routes every observation to access, buildability, economic potential, cost/risk, or distinctive value and requires explained confidence plus the cheapest credible next investigation. Images use a 1,900-pixel maximum dimension and JPEG quality 0.80; older stored analysis copies are optimized sequentially during export without altering the saved evidence. Exact originals are not duplicated, but their SHA-256, source name, dimensions, size, timestamp, and metadata remain in the manifest.
- **FULL EVIDENCE ARCHIVE** additionally includes every exact original photograph byte-for-byte. Its larger size is intentional.

Both modes contain:

- `AI_README.md`, the plain-English first-read contract that tells ChatGPT what the inspection contains, how evidence relates, and how to report uncertainty;
- `AI_ANALYSIS.json`, the analysis-first view organized as Executive Summary, Property Information, Inspection Conditions, Inspection Statistics, GPS Track, Observations, Photographs, Voice Notes, Map Layers, Weather, Terrain, Contours, Parcel Boundary, Public Data, Evidence Relationships, Suggested Inspection Questions, and Metadata;
- `DECISION_BRIEF.json`, the five-decision brief with routed evidence, possible strengths and weaknesses, material-unknown rules, an explained 0-100 confidence rubric, lowest-cost investigation requirements, and evidence-triggered professional follow-up;
- `QUESTION_BRIEF.json`, every inspector-created question with directly linked supporting, contradicting, and contextual evidence;
- `FIELD_COACHING.json`, named areas, conservative coverage estimates, missing-evidence review, and field-efficiency measures;
- `FIELD_EVIDENCE_REVIEW.json` and `EVIDENCE_AUDIT_HISTORY.json`, the professional evidence-quality review and immutable correction history;
- `INSPECTOR_HYPOTHESES.md`, preserving non-factual interpretations, contradictory evidence, and exact professional-verification questions;
- `PROFESSIONAL_HANDOFF_CARDS.json` and `professional-handoff-cards.html`, audience-specific one-page professional orientation cards;
- `RETURN_VISIT_PLAN.json`, unvisited-zone waypoints and prioritized questions, measurements, and photographs;
- `SMALL_TRACT_WATER_MAP.json` and `small-tract-water-map.html`, which isolate the small tract, preserve all underlying water evidence, and distinguish observations from conservative inference;
- `REPORT_TEMPLATE.md`, with the required professional Property Intelligence Report sections;
- `INSPECTOR_THOUGHTS.md`, which preserves the inspector's judgment, theories, concerns, and preferences while explicitly separating them from observed facts;
- `EVIDENCE_RELATIONSHIPS.json`, which directly joins observations, photographs, voice notes, and stable GPS-point IDs;
- `WEATHER_CONTEXT.json`, which preserves the structured authoritative NOAA record, exact daily station evidence, 1991-2020 normal calculations, source URLs, named-event context, manual local context, superseded working estimates, and station-distance/causation limitations;
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
node --check field\inspection-coaching.js
node --check field\reviewed-property-synthesis.js
node --check field\water-intelligence.js
node --check field\evidence-governance.js
node --check field\app.js
node --check field\idb-recovery.js
node --check repository\import-package.js
node tests\idb-recovery.test.js
node tests\inspection-coaching.test.js
node tests\water-intelligence.test.js
node tests\evidence-governance.test.js
node tests\evidence-sets.test.js
node tests\chat-review.test.js
node tests\inspection-package.test.js
```

The recovery tests simulate stale cached connections, close events, transaction-creation failures, asynchronous aborts between image-copy serialization, read-back closure, pending-photo recovery, and later package inventory. Package tests independently parse and CRC-check both modes, recover exact originals, exercise the recorded 190-photo field scale, import report/full packages into the same inspection folder, verify content-addressed evidence, and prove that importing the same export twice is rejected instead of overwritten.

## Required real-iPhone acceptance test

1. Open the deployed `/field/` page in iPhone Safari while online and wait for **Offline ready**.
2. Turn on Airplane Mode. Reload the page and confirm the terrain, 2-foot contours, red subject boundary, and neighboring boundaries still appear.
3. Tap **Start Inspection**, allow Precise Location and motion/orientation access, then walk at least 20 feet.
4. Create **Large Tract** and **Small Tract** areas plus two investigation questions. Select **Small Tract** and both questions, record Wet, High Ground, a Free Note, one Voice Note, and at least one photo. Use **Take a photograph after saving** on one structured observation to verify the relationship.
5. Close Safari after saving one observation, reopen it, and confirm the counters and photographs return.
6. Take 20 photos over several minutes. After each save, confirm the voice prompt starts; test Record, Skip, and Explain Later; answer the four short photo-meaning questions; mark Context, Evidence, Measurement, and Relationship roles; then answer the water question. Record at least two nearby 3-by-5-foot isolated depressions and one separately flowing-water photograph. Background and reopen Safari twice, rotate between portrait and landscape, and continue taking photos. If a pending-photo button appears, tap it and confirm recovery.
7. Record a test Entrance, tap **Undo / Correct Last Record**, mark it Accidental, and verify it disappears from active map/findings but remains in Corrections & audit history. Correct one photo category and one area assignment. Record one Inspector Hypothesis with explicit support, contradiction, professional question, and cheapest next evidence.
8. Mark photos Critical, Helpful, Reference, and Duplicate from the gallery. Confirm the classifications survive backgrounding Safari.
9. Still offline, tap **Finish Inspection**. Confirm the before-you-leave review identifies unanswered questions, missing evidence, and unvisited coverage before GPS stops. Return once, collect the suggested evidence, then finish and use **Save to Property Intelligence Repository** for the single `AI_ANALYSIS_REPORT_PACKAGE` ZIP.
10. Confirm the repository receipt names the expected property folder, inspection folder, and unique export ID. Verify the correction audit, field evidence review, hypothesis file, professional handoff cards, water map, and linked media. ChatGPT must ignore voided evidence, preserve its audit history, and never promote proximity into a confirmed photo meaning.
11. Return to the unchanged saved inspection and create the `FULL_ARCHIVE` ZIP. Save it to the same repository inspection; it must create a second export version, retain audit-only originals under `audit/`, and never replace the report package.

Do not clear the inspection until the repository confirms both packages were received and every photo can be displayed.
