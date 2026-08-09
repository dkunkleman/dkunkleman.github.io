const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname,"..","property-opportunity-engine");
const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
const css = fs.readFileSync(path.join(root,"styles.css"),"utf8");
const app = fs.readFileSync(path.join(root,"app.js"),"utf8");

assert(html.includes("Candidates, not claims."));
assert(html.includes("Observed condition")&&html.includes("Customer decision"));
assert(html.includes('id="customerType"')&&html.includes('id="statusFilter"'));
assert(app.includes("customer_interest_basis")&&app.includes("evidence_basis"));
assert(app.includes("createProposalDraftInput")&&app.includes("repeatPhotoRecommendation"));
assert(css.includes("@media(max-width:800px)")&&css.includes("@media(max-width:420px)"));
assert(!html.includes("ACCEPT PROPOSAL"),"review dashboard must not auto-accept or sell a candidate");
assert(!app.includes("localStorage")&&!app.includes("indexedDB"),"isolated review UI must not touch field storage");
console.log("PASS: isolated opportunity review UI exposes the evidence-to-decision chain, customer intent, integrations, and mobile reflow without touching field storage.");
