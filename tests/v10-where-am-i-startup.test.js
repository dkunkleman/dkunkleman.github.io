const fs = require('fs');
const vm = require('vm');
const app = fs.readFileSync('field-simple-test-direct-v10-where-am-i/app.js', 'utf8');
const sw = fs.readFileSync('field-simple-test-direct-v10-where-am-i/sw.js', 'utf8');
new vm.Script(app);

function need(text, message) {
  if (!app.includes(text)) throw new Error(message);
}

need('3.13.0-home-test.5.1-safari-direct-10-where-am-i-2', 'v2 version missing');
need('renderSimpleHeader();\n      renderSimpleHome();\n      stateWriteQueue.catch(() => {});\n      await loadPendingPhotos();', 'full restored field UI is not painted before slower recovery work');
need('renderGallery().catch(() => {});', 'gallery still blocks startup');
need('Promise.allSettled([loadParcels(), registerOfflineWorker()])', 'parcel/offline background startup missing');
need("if (!parcelFeatures.length) loadParcels().then(() => drawWhereAmIMap('center')).catch(() => {});", 'WHERE AM I map does not redraw when parcel geometry arrives');

const repaint = app.indexOf('renderSimpleHeader();\n      renderSimpleHome();\n      stateWriteQueue.catch(() => {});');
const pending = app.indexOf('await loadPendingPhotos();', repaint);
if (repaint < 0 || pending < 0 || repaint > pending) throw new Error('restored UI repaint occurs too late');

if (app.includes('renderAuthoritativeWeather();\n    await renderGallery();')) throw new Error('gallery still awaited during startup');
if (app.includes('await Promise.all([loadParcels(), registerOfflineWorker()])')) throw new Error('parcel/offline setup still blocks startup');
if (!sw.includes('property-inspector-home-test-313-direct-v10-where-am-i-2')) throw new Error('v2 service-worker cache missing');

console.log('PASS: WHERE AM I restores and paints durable inspection before gallery/parcel/offline background work.');
