const fs = require('fs');
const path = require('path');

const out = 'field-simple-test-direct-v10-where-am-i';
const appPath = path.join(out, 'app.js');
const swPath = path.join(out, 'sw.js');
let app = fs.readFileSync(appPath, 'utf8');

app = app.replaceAll('3.13.0-home-test.5.1-safari-direct-10-where-am-i-1', '3.13.0-home-test.5.1-safari-direct-10-where-am-i-3');

const initStart = app.indexOf('  async function initialize() {');
const initEnd = app.indexOf('\n\n  startBtn.addEventListener', initStart);
if (initStart < 0 || initEnd < 0) throw new Error('initialize function anchors missing');

const initialize = `  async function initialize() {
    if (!packageTools || !dbRecoveryTools || !coachingTools || !waterTools || !governanceTools || !evidenceSetTools || !weatherTools || !frontageTools || !automaticContextTools || !sectionMappingTools || !wetEdgeTools || !previsitTools) {
      setStatus("Inspection package code failed to load. Do not begin an inspection.", "error");
      startBtn.disabled = true;
      return;
    }
    if (!window.isSecureContext) {
      setStatus("GPS, camera storage, and offline recovery require the secure HTTPS version of this page. Do not begin from an insecure address.", "error");
      startBtn.disabled = true;
      return;
    }

    // Critical startup path: local recovery pointer -> IndexedDB -> canonical state.
    // Nothing that touches the network, gallery, parcel map, service worker, or
    // photo-store health check may run before the canonical inspection is restored.
    loadState();
    try {
      await openPhotoDb();
      await restoreCanonicalInspectionState();

      governanceTools.ensureGovernanceModel(data);
      lastSavedOrientation = data.orientation_samples.length ? data.orientation_samples[data.orientation_samples.length - 1] : null;
      if (data.started && !data.inspection_id) data.inspection_id = makeId("inspection");

      // A browser reload / full Safari restart always returns to field buttons.
      // An unfinished section therefore reopens PAUSED and cannot collect edge
      // points until the inspector deliberately resumes it.
      const restoredActiveSection = sectionMappingTools.activeSection(data);
      if (restoredActiveSection && restoredActiveSection.completion_status === "ACTIVE" && !restoredActiveSection.capture_paused) {
        restoredActiveSection.capture_paused = true;
        restoredActiveSection.events = Array.isArray(restoredActiveSection.events) ? restoredActiveSection.events : [];
        restoredActiveSection.events.push({ event_type: "SECTION_AUTO_PAUSED_AFTER_APP_RESTART", recorded_at: new Date().toISOString() });
      }

      // Paint the FULL restored inspection immediately. This is the acceptance
      // boundary: compact 3/3/3 recovery data must never remain the visible UI
      // after canonical IndexedDB state has been read.
      redraw();
      renderSimpleHeader();
      renderSimpleHome();
      saveState();
    } catch (error) {
      setStatus(\`CANONICAL INSPECTION RESTORE FAILED: \${error.message} Do not press Clear or clear Safari data.\`, "error");
      startBtn.disabled = true;
      renderSimpleHeader();
      return;
    }

    // Automation-only test position is applied only after canonical restore.
    if (SIMPLE_AUTOMATION_MODE && data.started) {
      lastPosition = { lat: 30.489, lon: -87.091, accuracy_m: 3, altitude_m: 20, altitude_accuracy_m: 2, heading_deg: 90, speed_mps: 0, time: new Date().toISOString(), sequence: 1 };
      if (!data.points.length) data.points.push(Object.assign({}, lastPosition));
      renderSimpleHeader();
    }

    // Secondary durable reconciliation runs in the background. Failure here may
    // reduce previews or delay trail completion, but it cannot hide the restored
    // field screen or replace canonical metadata with the compact pointer.
    (async () => {
      try {
        await revalidatePhotoDb();
        await loadPendingPhotos();
        await reconcileGpsPoints();
        await migrateLegacyPhotos();
        await reconcileStoredPhotos();
        await reconcileStoredVoiceNotes();
        await recoverInterruptedVoiceNote();
        evidenceSetTools.addPearsonSuggestions(data);
        redraw();
        renderSimpleHeader();
        renderSimpleHome();
      } catch (error) {
        setStatus(\`BACKGROUND EVIDENCE RECONCILIATION DELAYED: \${error.message}. Restored inspection metadata remains loaded.\`, "warning");
      }
    })();

    // August 4 reference data is useful context, never a prerequisite for opening
    // today's saved inspection. It is intentionally isolated from the restore path.
    (async () => {
      try {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
        const response = await fetch("./assets/august-4-route-context.json", controller ? { signal: controller.signal } : undefined);
        if (timer) clearTimeout(timer);
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        august4RouteContext = await response.json();
        try { renderSimpleLocator(); } catch (error) {}
      } catch (error) {
        august4RouteContext = null;
      }
    })();

    redraw();
    renderConditions();
    renderAuthoritativeWeather();
    renderGallery().catch(() => {});
    Promise.allSettled([loadParcels(), registerOfflineWorker()]).then(() => {
      try { redraw(); renderSimpleHome(); } catch (error) {}
    });

    if (data.started && !data.stopped && !SIMPLE_AUTOMATION_MODE) {
      // Refresh/restart never silently asks Safari for location. The visible
      // RECONNECT GPS button is the explicit user gesture.
      gpsUserActivatedThisPage = false;
      gpsRecoveryReason = "";
      gpsManualRequestInFlight = false;
      clearManualGpsFallback();
      clearActiveGpsWatch();
      refreshGpsPermissionState().catch(() => {});
      updateControls();
      renderSimpleHeader();
    }

    coverageSnapshot = null;
    coachingStateSnapshot = null;
    coverageDirty = true;
    try { redraw(); renderCoaching(); renderAuditHistory(); renderEvidenceSets(); } catch (error) {}
    if (statusEl.dataset.kind !== "error") {
      setStatus(pendingPhotoQueue.length ? "Photo is waiting to be saved. Keep this page open and tap Retry Pending Photo." : (data.started ? "Saved inspection loaded. Use RECONNECT GPS when you want location tracking." : "Ready. Use RECONNECT GPS when you want location tracking."), pendingPhotoQueue.length ? "warning" : "normal");
    }
    installSimpleReturnButtons();
    document.getElementById("simpleTopReturn").addEventListener("click", simpleReturnToFieldButtons);
    document.getElementById("simpleTopFinish").addEventListener("click", renderSimpleFinish);
    document.getElementById("simpleAdvancedReturn").addEventListener("click", simpleReturnFromAdvanced);
    renderSimpleHome();
    schedulePackageEstimateRefresh();
  }`;

app = app.slice(0, initStart) + initialize + app.slice(initEnd);

const mapNeedle = `    bindWhereAmIGestures();\n    drawWhereAmIMap('center');\n  }`;
if (!app.includes(mapNeedle)) throw new Error('WHERE AM I open anchor missing');
app = app.replace(mapNeedle, `    bindWhereAmIGestures();\n    drawWhereAmIMap('center');\n    if (!parcelFeatures.length) loadParcels().then(() => drawWhereAmIMap('center')).catch(() => {});\n  }`);

fs.writeFileSync(appPath, app);

let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replaceAll('3.13.0-home-test.5.1-safari-direct-10-where-am-i-1', '3.13.0-home-test.5.1-safari-direct-10-where-am-i-3');
sw = sw.replaceAll('property-inspector-home-test-313-direct-v10-where-am-i-1', 'property-inspector-home-test-313-direct-v10-where-am-i-3');
fs.writeFileSync(swPath, sw);

console.log('Patched WHERE AM I v3 so canonical IndexedDB restore is the first async startup operation.');
