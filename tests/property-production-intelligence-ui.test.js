const assert=require("assert");
const fs=require("fs");
const path=require("path");
const root=path.join(__dirname,"..","property-production-intelligence");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");

["START TEST","START CUTTING","START DEBRIS","ADD DELAY","FINISH TEST","COMPLETED","PARTIAL","ABORTED"].forEach((label)=>assert(html.includes(label),`missing field action: ${label}`));
assert(html.includes("Length (ft)")&&html.includes("Width (ft)"));
assert(html.includes("1,000 sq ft"));
assert(html.includes("Operator review for future internal baseline"));
assert(html.includes("Pearson proposal inputs"));
assert(css.includes("@media(max-width:420px)"),"must have a 390px-safe mobile layout");
assert(css.includes("width:min(720px,100%)"));
assert(!html.match(/serviceWorker/i),"isolated prototype must not register a service worker");
assert(app.includes('propertyProductionIntelligenceV01Review'),"must use its own isolated storage key");
assert(!app.includes("propertyInspectorHomeTest313V1"),"must not use protected field storage");
assert(!app.includes("property-inspector-home-test-313-evidence"),"must not use protected evidence database");
assert(app.includes("fetch(\"pearson-proposal-inputs.json\")"));

console.log("property-production-intelligence-ui.test.js passed");
