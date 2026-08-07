const fs = require('fs');
const vm = require('vm');
const app = fs.readFileSync('field-simple-test-direct-v10-where-am-i/app.js', 'utf8');
new vm.Script(app);

function need(text, message) {
  if (!app.includes(text)) throw new Error(message);
}

need('function inspectionStateGet()', 'inspectionStateGet missing');
need('request.onsuccess = () => finish(request.result);', 'canonical state read does not resolve from IndexedDB request success');
need('transaction.onabort = () => fail', 'canonical state read does not surface transaction abort');
need('transaction.onerror = () => fail', 'canonical state read does not surface transaction error');

const start = app.indexOf('  function inspectionStateGet() {');
const end = app.indexOf('\n\n  async function restoreCanonicalInspectionState()', start);
if (start < 0 || end < 0) throw new Error('inspectionStateGet boundaries missing');
const body = app.slice(start, end);
if (body.includes('return transactionRequest(transaction, request')) throw new Error('canonical readonly state read still uses the old transaction-completion helper');
if (!body.includes('request.onsuccess = () => finish(request.result);')) throw new Error('request success is not the canonical read completion point');

console.log('PASS: Safari canonical state restore resolves from IndexedDB get() success instead of the old transaction-completion helper.');
