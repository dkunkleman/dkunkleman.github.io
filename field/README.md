# Property Inspector

Production, offline-first field evidence collection for the subject rural parcel. The iPhone workflow is deliberately simple: confirm **Offline ready**, tap **Start Inspection**, record observations while walking, then tap **Finish Inspection** and send the one resulting package to ChatGPT.

## Reliability model

- The app shell, parcel geometry, USGS terrain, and USGS 2-foot contour raster are cached under the `/field/` service-worker scope.
- GPS points, observations, notes, and device-orientation samples are written to local recovery storage as they are recorded.
- Original photo bytes and browser-rendered analysis copies are stored in IndexedDB. Photo metadata and the photo event are stored with the bytes so an interruption between attachment storage and screen refresh can be reconciled.
- Voice notes are written to IndexedDB in one-second recovery chunks while recording. A reload recovers a recording through the last stored chunk.
- Package export fails closed if any original photo, analysis copy, voice note, parcel geometry, terrain raster, or contour raster cannot be recovered.
- The original photograph is never replaced by the analysis copy.

## One-file package

`Finish Inspection` creates one standards-compliant ZIP containing:

- canonical `inspection.json` and a versioned `schema.json`;
- every GPS point with time, accuracy, altitude, speed, heading, and device orientation when available;
- every structured observation and free note;
- exact photo originals, analysis-safe image copies, GPS, timestamps, heading, screen orientation, sensor orientation, dimensions, EXIF orientation, sizes, and SHA-256 hashes when Web Crypto is available;
- actual voice-note audio and its GPS/time/heading/orientation metadata;
- flat CSV, GeoJSON, and GPX analysis copies;
- subject and neighboring parcel geometry;
- georeferenced USGS terrain and 2-foot contour context.

The package schema uses stable property, inspection, observation, GPS-point, attachment, and map-context entities. New observation taxonomies and namespaced attributes can be added without repurposing existing fields.

## Automated verification

From the repository root:

```powershell
node --check field\inspection-package.js
node --check field\app.js
node tests\inspection-package.test.js
```

The recovery test builds a complete package, parses the ZIP independently, validates every CRC-32, recovers two photograph originals byte-for-byte, recovers their analysis copies and a voice note, verifies all GPS/event/orientation metadata, and confirms the subject parcel plus offline terrain and contours are present. It also proves that missing photo bytes or a missing analysis copy blocks package creation.

## Required real-iPhone acceptance test

1. Open the deployed `/field/` page in iPhone Safari while online and wait for **Offline ready**.
2. Turn on Airplane Mode. Reload the page and confirm the terrain, 2-foot contours, red subject boundary, and neighboring boundaries still appear.
3. Tap **Start Inspection**, allow Precise Location and motion/orientation access, then walk at least 200 feet.
4. Record Wet, Blocked, Homesite, a Free Note, one Voice Note, and at least two photos in different phone orientations.
5. Close Safari after saving one observation, reopen it, and confirm the counters and photographs return.
6. Still offline, tap **Finish Inspection**. Send the single package to ChatGPT from the iOS share sheet.
7. Ask ChatGPT to reconstruct the route, distance, each observation/note, headings, parcel coverage, missed area, voice note, and both actual photographs using only that package.

Do not clear the inspection until ChatGPT confirms the package was received and every photo can be displayed.
