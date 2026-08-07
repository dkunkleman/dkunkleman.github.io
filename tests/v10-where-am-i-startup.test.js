const fs = require('fs');
const vm = require('vm');
const app = fs.readFileSync('field-simple-test-direct-v10-where-am-i/app.js', 'utf8');
const sw = fs.readFileSync('field-simple-test-direct-v10-where-am-i/sw.js', 'utf8');
new vm.Script(app);

function need(text, message) {
  if (!app.includes(text)) throw new Error(message);
}

need('3.13.0-home-test.5.1-safari-direct-10-where-am-i-4', 'v4 version missing');
need('CANONICAL INSPECTION RESTORE FAILED', 'explicit canonical restore failure status missing');
need('await openPhotoDb();\n      await restoreCanonicalInspectionState();', 'canonical IndexedDB restore is not immediate after DB open');
need('renderSimpleHeader();\n      renderSimpleHome();\n      saveState();', 'full restored field UI is not painted immediately after restore');
need('renderGallery().catch(() => {});', 'gallery still blocks startup');
need('Promise.allSettled([loadParcels(), registerOfflineWorker()])', 'parcel/offline background startup missing');

const initStart = app.indexOf('  async function initialize() {');
const initEnd = app.indexOf('\n\n  startBtn.addEventListener', initStart);
if (initStart < 0 || initEnd < 0) throw new Error('initialize boundaries missing');
const init = app.slice(initStart, initEnd);
const loadState = init.indexOf('loadState();');
const openDb = init.indexOf('await openPhotoDb();');
const restore = init.indexOf('await restoreCanonicalInspectionState();');
const firstFetch = init.indexOf('fetch(');
const revalidate = init.indexOf('await revalidatePhotoDb();');
const repaint = init.indexOf('renderSimpleHeader();\n      renderSimpleHome();', restore);
const preRestore = init.slice(loadState, restore);

if (!(loadState >= 0 && openDb > loadState && restore > openDb)) throw new Error('canonical restore ordering is wrong');
if (firstFetch >= 0 && firstFetch < restore) throw new Error('network fetch still runs before canonical restore');
if (revalidate >= 0 && revalidate < restore) throw new Error('photo DB health check still runs before canonical restore');
if (repaint < restore) throw new Error('restored UI repaint occurs before or without canonical restore');
if (preRestore.includes('saveState();')) throw new Error('saveState still runs between compact pointer load and canonical restore');
if (!init.includes('fetch("./assets/august-4-route-context.json"')) throw new Error('August 4 reference fetch was lost instead of moved to background');
if (!init.includes('setTimeout(() => controller.abort(), 5000)')) throw new Error('August 4 background fetch lacks a hard timeout');
if (!sw.includes('property-inspector-home-test-313-direct-v10-where-am-i-4')) throw new Error('v4 service-worker cache missing');

console.log('PASS: canonical IndexedDB inspection restore and repaint occur before every network/background task.');
