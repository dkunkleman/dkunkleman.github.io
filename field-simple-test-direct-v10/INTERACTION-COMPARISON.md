# 3.13 Simple Interaction Restoration

## Sources compared

- Physically proven source: version 3.13.0, commit `2c16315`.
- Protected recovery source: version 3.16.2, commit `b06b162`.
- Files inspected: `field/app.js`, `field/index.html`, `field/inspection-package.js`, `field/idb-recovery.js`, and `field/sw.js`.

## Physically proven 3.13 interaction

```text
Field button
  -> observation or photograph
  -> optional note/review
  -> field-button grid
```

Version 3.13 did contain detailed evidence dialogs, but an ordinary field button did not first create a Feature Capture Session. The user could record common observations directly, take a photograph, add a voice note, and continue.

## Failed 3.16 interaction

```text
Field button
  -> active Feature Capture Session
  -> structured feature dialog
  -> photograph
  -> mandatory photo explanation
  -> mandatory photo meaning and possible water classification
  -> minimum / complete / defer decision
  -> incomplete session can reopen or block another feature
  -> field-button grid is no longer an obvious destination
```

The blocking changes in 3.16 were concrete:

- `openFeatureCaptureSession()` rejected a new feature whenever `active_feature_session_id` existed and reopened the active session.
- `saveFeatureSession(mode)` required the user to understand `minimum`, `complete`, or `defer` outcomes.
- The Feature Capture dialog canceled normal dismissal and instructed the user to choose a completion path.
- `updateNextStep()` prioritized finishing or deferring the active session instead of returning to the field buttons.
- Field buttons were all rerouted through Feature Capture Sessions.
- Guided missions and question state were added to the default path.
- Photo explanation, meaning, measurement, and water-classification dialogs prevented ordinary cancel behavior.
- Sticky workflow and mission/status sections consumed the small iPhone viewport and obscured the button grid.

## States that lacked an immediate route to the buttons

- Active Feature Capture Session
- Feature Capture details dialog
- Photo explanation dialog
- Photo meaning dialog
- Structured measurement dialog
- Water classification dialog
- Evidence-set post-photo dialog
- Guided Mission dialog and finish review
- Pending incomplete session after attempting to select another feature

## Isolated home-test repair

The home test keeps the 3.13 durable IndexedDB transaction recovery, original-plus-analysis photo commit, photo read-back verification, pending-photo queue, GPS/voice persistence, and both package modes. Its default interaction is deliberately smaller:

```text
Field button
  -> durable basic record with GPS/time
  -> optional compact details, photos, or note
  -> SAVE WHAT I HAVE & RETURN TO FIELD BUTTONS
  -> field-button grid
```

Every optional value may remain empty. Starting a new feature preserves the prior feature as `BASIC_RECORD_SAVED_DETAILS_INCOMPLETE`. No mission, question, photo role, classification, or completion choice controls the default route.

