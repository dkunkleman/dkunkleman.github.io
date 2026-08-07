const fs = require('fs');
const path = require('path');

const out = 'field-simple-test-direct-v10-where-am-i';
const appPath = path.join(out, 'app.js');
const swPath = path.join(out, 'sw.js');
let app = fs.readFileSync(appPath, 'utf8');

app = app.replaceAll('3.13.0-home-test.5.1-safari-direct-10-where-am-i-1', '3.13.0-home-test.5.1-safari-direct-10-where-am-i-2');

const restoreNeedle = `      saveState();\n      await stateWriteQueue;\n      await loadPendingPhotos();`;
if (!app.includes(restoreNeedle)) throw new Error('canonical restore repaint anchor missing');
app = app.replace(restoreNeedle, `      saveState();\n      // The durable inspection has now been restored. Repaint the field UI immediately\n      // before any gallery reconciliation, migrations, parcel fetch, or offline setup.\n      redraw();\n      renderSimpleHeader();\n      renderSimpleHome();\n      stateWriteQueue.catch(() => {});\n      await loadPendingPhotos();`);

const slowNeedle = `    renderAuthoritativeWeather();\n    await renderGallery();\n    await Promise.all([loadParcels(), registerOfflineWorker()]);`;
if (!app.includes(slowNeedle)) throw new Error('slow startup anchor missing');
app = app.replace(slowNeedle, `    renderAuthoritativeWeather();\n    // Gallery, parcel loading, and offline setup are secondary. They must never\n    // hold the restored field screen on LOADING SAFE HOME TEST.\n    renderGallery().catch(() => {});\n    Promise.allSettled([loadParcels(), registerOfflineWorker()]).then(() => {\n      try { redraw(); renderSimpleHome(); } catch (error) {}\n    });`);

const mapNeedle = `    bindWhereAmIGestures();\n    drawWhereAmIMap('center');\n  }`;
if (!app.includes(mapNeedle)) throw new Error('WHERE AM I open anchor missing');
app = app.replace(mapNeedle, `    bindWhereAmIGestures();\n    drawWhereAmIMap('center');\n    // If parcel geometry is still arriving in the background, redraw the map\n    // when it becomes available without blocking the field screen.\n    if (!parcelFeatures.length) loadParcels().then(() => drawWhereAmIMap('center')).catch(() => {});\n  }`);

fs.writeFileSync(appPath, app);

let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replaceAll('3.13.0-home-test.5.1-safari-direct-10-where-am-i-1', '3.13.0-home-test.5.1-safari-direct-10-where-am-i-2');
sw = sw.replaceAll('property-inspector-home-test-313-direct-v10-where-am-i-1', 'property-inspector-home-test-313-direct-v10-where-am-i-2');
fs.writeFileSync(swPath, sw);

console.log('Patched WHERE AM I candidate for field-first durable restore.');
