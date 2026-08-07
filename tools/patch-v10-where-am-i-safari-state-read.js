const fs = require('fs');
const path = require('path');

const out = 'field-simple-test-direct-v10-where-am-i';
const appPath = path.join(out, 'app.js');
const swPath = path.join(out, 'sw.js');
let app = fs.readFileSync(appPath, 'utf8');

app = app.replaceAll('3.13.0-home-test.5.1-safari-direct-10-where-am-i-4', '3.13.0-home-test.5.1-safari-direct-10-where-am-i-5');

const stateGetNeedle = `  function inspectionStateGet() {\n    return withEvidenceTransaction(stateStoreName, "readonly", transaction => {\n      const request = transaction.objectStore(stateStoreName).get("active");\n      return transactionRequest(transaction, request, "Inspection state could not be read.", result => result || null);\n    });\n  }`;
if (!app.includes(stateGetNeedle)) throw new Error('inspectionStateGet anchor missing');
const stateGetReplacement = `  function inspectionStateGet() {\n    return withEvidenceTransaction(stateStoreName, "readonly", transaction => new Promise((resolve, reject) => {\n      let settled = false;\n      let request;\n      try {\n        request = transaction.objectStore(stateStoreName).get("active");\n      } catch (error) {\n        reject(error);\n        return;\n      }\n      const finish = value => {\n        if (settled) return;\n        settled = true;\n        resolve(value || null);\n      };\n      const fail = error => {\n        if (settled) return;\n        settled = true;\n        reject(error);\n      };\n      // Safari can deliver the readonly get() result before transaction.oncomplete.\n      // The record is safe to consume at request success; do not hold startup hostage\n      // waiting for a later transaction-completion callback.\n      request.onsuccess = () => finish(request.result);\n      request.onerror = () => fail(request.error || new Error("Inspection state could not be read."));\n      transaction.onerror = () => fail(transaction.error || new Error("Inspection state could not be read."));\n      transaction.onabort = () => fail(transaction.error || new DOMException("Inspection state read was aborted.", "AbortError"));\n    }));\n  }`;
app = app.replace(stateGetNeedle, stateGetReplacement);

const initNeedle = `    loadState();\n    try {\n      await openPhotoDb();\n      await restoreCanonicalInspectionState();`;
if (!app.includes(initNeedle)) throw new Error('initialize restore anchor missing');
const initReplacement = `    loadState();\n    const showRestoreStage = (headline, detail) => {\n      const content = document.getElementById("simpleContent");\n      if (content) content.innerHTML = '<section class="simple-start"><h2>' + headline + '</h2><p>' + (detail || 'Do not press Clear. Saved evidence is not being changed.') + '</p></section>';\n      renderSimpleHeader();\n    };\n    showRestoreStage("OPENING SAVED INSPECTION DATABASE…", "Do not press Clear. This is reading the existing IndexedDB evidence store.");\n    try {\n      let stageTimer = setTimeout(() => showRestoreStage("STILL OPENING SAVED DATABASE…", "Safari is taking longer than expected. Keep this page open; nothing is being erased or migrated."), 8000);\n      await openPhotoDb();\n      clearTimeout(stageTimer);\n      showRestoreStage("READING FULL SAVED INSPECTION…", "The compact 3/3/3 emergency copy is not authoritative. Reading the full canonical inspection now.");\n      stageTimer = setTimeout(() => showRestoreStage("STILL READING FULL INSPECTION…", "Safari has not finished the IndexedDB read yet. Keep this page open; do not press Clear."), 8000);\n      await restoreCanonicalInspectionState();\n      clearTimeout(stageTimer);`;
app = app.replace(initNeedle, initReplacement);

const catchNeedle = `    } catch (error) {\n      setStatus(\`CANONICAL INSPECTION RESTORE FAILED: \${error.message} Do not press Clear or clear Safari data.\`, "error");\n      startBtn.disabled = true;\n      renderSimpleHeader();\n      return;\n    }`;
if (!app.includes(catchNeedle)) throw new Error('restore catch anchor missing');
const catchReplacement = `    } catch (error) {\n      setStatus(\`CANONICAL INSPECTION RESTORE FAILED: \${error.message} Do not press Clear or clear Safari data.\`, "error");\n      startBtn.disabled = true;\n      const content = document.getElementById("simpleContent");\n      if (content) content.innerHTML = '<section class="simple-start"><h2>FULL INSPECTION RESTORE FAILED</h2><p>' + String(error && error.message || error) + '</p><p>Do not press Clear or clear Safari website data.</p></section>';\n      renderSimpleHeader();\n      return;\n    }`;
app = app.replace(catchNeedle, catchReplacement);

fs.writeFileSync(appPath, app);

let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replaceAll('3.13.0-home-test.5.1-safari-direct-10-where-am-i-4', '3.13.0-home-test.5.1-safari-direct-10-where-am-i-5');
sw = sw.replaceAll('property-inspector-home-test-313-direct-v10-where-am-i-4', 'property-inspector-home-test-313-direct-v10-where-am-i-5');
fs.writeFileSync(swPath, sw);

console.log('Patched WHERE AM I v5 for Safari request-success canonical-state restore and visible restore stages.');
