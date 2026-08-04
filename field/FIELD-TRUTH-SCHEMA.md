# Field Truth and Guided Mission Schema

Canonical hierarchy:

`Property → Intended Use Scenario → Decision → Field Mission → Question → Feature Capture Session → Original Evidence → Measurement → Derived Finding → Value/Cost/Risk Effect → Remaining Uncertainty → Next Investigation`

Original GPS, photographs, audio, observations and measurements are immutable. Mission progress, skips, corrections, inspector interpretations, AI suggestions, derived effects and professional determinations are append-only.

Geometry basis is always explicit: `at_feature`, `phone_location_only`, `measured_offset`, `mapped_polygon`, or `walked_line`. Route-condition sessions use `walked_line`; each point preserves time, GPS sequence, coordinates, and accuracy. The line is a phone-GPS centerline, never a surveyed road edge, right-of-way, or passable-width boundary.

Package records:

- `FIELD_TRUTH.json`: typed Field Truth layer and migration rule.
- `FEATURE_CAPTURE_SESSIONS.json`: structured attributes, geometry basis, methods, skip reasons, direct media roles and append-only events.
- `FIELD_MISSIONS.json`: intended uses, questions, unresolved uncertainty and next investigations.
- `PROFESSIONAL_DETERMINATIONS.json`: later qualified findings without overwriting field evidence.
- `REPEAT_STATIONS.json`: fixed target, heading, photo/measurement template and trigger.
- `PUBLIC_DATA_PROVENANCE.json`: source identity, retrieval time, URL, date, geometry, raw record and limitations.
- `INSPECTION_MISSION_PLAN.json`: selected template and ordered steps.
- `INSPECTION_MISSION_PROGRESS.json`: calculated progress and coverage warning.
- `MISSION_EVIDENCE_REQUIREMENTS.json`: required/recommended evidence and direct IDs.
- `MISSION_SKIP_RECORDS.json`: Skip, Not Applicable and Unsafe records with reasons.
- `INSPECTION_FINISH_REVIEW.json`: append-only issue review and honest resolutions.
- `TREE_IDENTIFICATION_*.json`: permanent inspection-level tree IDs, direct diagnostic media, field traits, provisional candidates, provider provenance, expert verification, regulatory flags, and adaptive evidence requests.
- `TREE_CIRCUMFERENCE_MEASUREMENTS.json` and `TREE_CALCULATED_DBH.json`: preserved original circumference plus explicit diameter/radius formulas and calculated—not directly measured—results.
- `YARDSTICK_WATER_MEASUREMENTS.json`: visible water depth, soft-sediment penetration, combined insertion, bottom reference, direct photographs, and limitations kept as separate fields.
- `CANDIDATE_AREA_*.json`: approximate usable-opening dimensions, cross-sections, walked phone-GPS perimeter, limiting features, and relationships. These do not establish buildability or surveyed boundaries.
- `TREE_NETWORK_*.json`: immutable tree-to-tree measurements, local adjusted coordinates, residuals, uncertainty, disconnected/weak geometry, next-best measurements, anchors, and explicit alignment status.

`LOCAL_RELATIVE_TREE_NETWORK` never creates authoritative latitude/longitude. Phone GPS and public parcel alignment remain approximate. Survey/professional statuses require separately supplied anchors and provenance. Corrections are append-only and never rewrite an original distance.

Legacy inspections are never assigned retrospective mission completion. They export `GUIDED_MISSION_NOT_AVAILABLE_AT_CAPTURE` and `NO_RETROSPECTIVE_MISSION_STATUS` while preserving every original event exactly.
