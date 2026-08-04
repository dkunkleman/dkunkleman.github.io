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

Legacy inspections are never assigned retrospective mission completion. They export `GUIDED_MISSION_NOT_AVAILABLE_AT_CAPTURE` and `NO_RETROSPECTIVE_MISSION_STATUS` while preserving every original event exactly.
