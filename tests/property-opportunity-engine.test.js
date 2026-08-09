const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Engine = require("../property-opportunity-engine/opportunity-engine-core.js");

const root = path.join(__dirname,"..","property-opportunity-engine");
const catalog = JSON.parse(fs.readFileSync(path.join(root,"opportunity-types.json"),"utf8"));
const rules = JSON.parse(fs.readFileSync(path.join(root,"discovery-rules.json"),"utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root,"opportunity.schema.json"),"utf8"));
const contracts = JSON.parse(fs.readFileSync(path.join(root,"integration-contracts.json"),"utf8"));
const sampleSource = fs.readFileSync(path.join(root,"pearson-road-examples.js"),"utf8");
const sampleSandbox = { globalThis: {} };
vm.runInNewContext(sampleSource,sampleSandbox);
const context = sampleSandbox.globalThis.PEARSON_LIKE_OPPORTUNITY_CONTEXT;

assert.strictEqual(catalog.length,14,"all required V0.1 opportunity types must exist");
["CREEK_WATER_FEATURE_REVEAL","LIGHT_BRUSH_REVEAL","HEAVY_BRUSH_REVEAL","HOMESITE_USE_AREA_REVEAL","WALKING_PATH_ACCESS_REVEAL","VIEW_SUNSET_REVEAL","TREE_PRESERVATION_SELECTIVE_CLEARING","ADDITIONAL_REVEAL_WORK","PRE_SHOWING_REFRESH","MAINTENANCE_REGROWTH_VISIT","POST_STORM_INSPECTION","REPEAT_PHOTO_MONITORING","WATER_CULVERT_MONITORING","PROFESSIONAL_HANDOFF"].forEach((code)=>assert(catalog.some((entry)=>entry.code===code),`missing ${code}`));
assert(schema.required.includes("priority_inputs")&&schema.required.includes("history"),"schema must preserve disclosed priority inputs and history");
assert.strictEqual(contracts.proposal_generator.operator_approval_required,true);
assert(contracts.proposal_generator.forbidden_automatic_actions.includes("SET_PRICE"));
assert.strictEqual(contracts.repeat_photo.creates_record_automatically,false);

const sourceBefore = JSON.stringify(context);
const opportunities = Engine.discoverOpportunities(context,catalog,rules);
assert.strictEqual(JSON.stringify(context),sourceBefore,"discovery must not mutate source context or evidence");
assert(opportunities.length>=10,"Pearson-like regression input should exercise the engine broadly");

for(const opportunity of opportunities){
  assert(opportunity.opportunity_id&&opportunity.property_id&&opportunity.created_at);
  assert(Engine.STATUS.includes(opportunity.status));
  assert.strictEqual(opportunity.priority_score,null,"unknown priority inputs must prevent false-precision single scoring");
  assert(/No single score/.test(opportunity.priority_explanation));
  Engine.validateSeparation(opportunity);
  opportunity.evidence_basis.forEach((item)=>assert.notStrictEqual(item.information_class,"CUSTOMER_INTEREST"));
  opportunity.customer_interest_basis.forEach((item)=>assert.strictEqual(item.information_class,"CUSTOMER_INTEREST"));
}

const water = opportunities.find((item)=>item.opportunity_type==="CREEK_WATER_FEATURE_REVEAL");
assert(water,"creek + obstructed access must create a candidate");
assert(water.source_observation_ids.includes("OBS-WATER-001"));
assert(water.source_photo_ids.includes("PHOTO-WATER-001"));
assert(water.source_customer_interaction_ids.includes("INTERACTION-FAVORITE-001"),"favorites may affect priority");
assert(!water.evidence_basis.some((item)=>item.source_id==="INTERACTION-FAVORITE-001"),"favorite must not become property evidence");
assert(!/increase property value/i.test(water.customer_value_hypothesis),"value increase must not be stated as fact");

const heavy = opportunities.find((item)=>item.opportunity_type==="HEAVY_BRUSH_REVEAL");
assert(heavy&&heavy.status==="NEEDS_VERIFICATION");
assert(heavy.required_verifications.some((text)=>/production rate/i.test(text)));
assert.strictEqual(heavy.proposal_eligibility,"NEEDS_VERIFICATION");
assert.throws(()=>Engine.createProposalDraftInput(heavy,true),/not ready/i);

const light = opportunities.find((item)=>item.opportunity_type==="LIGHT_BRUSH_REVEAL");
assert(light&&light.source_observation_ids.includes("OBS-BRUSH-LIGHT-001"));

const paths = opportunities.filter((item)=>item.opportunity_type==="WALKING_PATH_ACCESS_REVEAL");
assert.strictEqual(paths.length,2,"measured creek walk and unknown northwest connection must remain separate candidates");
const unknownPath = paths.find((item)=>item.source_proposal_zone_ids.includes("ZONE-NW-UNKNOWN-PATH"));
assert(unknownPath&&unknownPath.status==="NEEDS_VERIFICATION");
assert(unknownPath.unknowns.includes("Corridor length is unknown."));
assert(/measure/i.test(unknownPath.suggested_next_investigation));
assert(!JSON.stringify(unknownPath).match(/northwest[^\n]*\b\d+(\.\d+)?\s*(ft|feet)/i),"unknown northwest path must not gain a fabricated dimension");

const homesite = opportunities.find((item)=>item.opportunity_type==="HOMESITE_USE_AREA_REVEAL");
assert(homesite&&homesite.status==="READY_FOR_PROPOSAL","approved existing geometry may support a proposal draft");
assert.throws(()=>Engine.createProposalDraftInput(homesite,false),/Operator approval/);
const draft = Engine.createProposalDraftInput(homesite,true);
assert.strictEqual(draft.status,"DRAFT_INPUT_ONLY");
assert.strictEqual(draft.proposed_price,null);
assert.strictEqual(draft.price_status,"UNKNOWN");
assert.strictEqual(draft.geometry,null);
assert.strictEqual(draft.automatic_customer_delivery,false);
assert.strictEqual(draft.automatic_acceptance,false);

const repeat = opportunities.find((item)=>item.opportunity_type==="REPEAT_PHOTO_MONITORING");
assert(repeat&&repeat.source_work_order_ids.includes("WORK-REVEAL-001"));
const repeatContract = Engine.repeatPhotoRecommendation(repeat,["BEFORE"]);
assert.strictEqual(repeatContract.creates_record_automatically,false);
assert(repeatContract.missing_phases.includes("AFTER"));
assert(repeatContract.missing_phases.includes("WORK"));

const culvert = opportunities.find((item)=>item.opportunity_type==="WATER_CULVERT_MONITORING");
assert(culvert&&culvert.source_asset_ids.includes("ASSET-CULVERT-001"));
assert(/contrasting condition/i.test(culvert.suggested_next_investigation));

const handoff = opportunities.find((item)=>item.opportunity_type==="PROFESSIONAL_HANDOFF");
assert(handoff&&handoff.proposal_eligibility==="NOT_ELIGIBLE");
assert.strictEqual(handoff.eligible_service_codes.length,0);
assert(/WETLAND_PROFESSIONAL/.test(handoff.required_verifications[0]));

const buyerContext = {...context,customer_type:"BUYER"};
const buyerOpportunities = Engine.discoverOpportunities(buyerContext,catalog,rules);
const buyerVisible = Engine.filterForCustomer(buyerOpportunities,"BUYER");
assert(buyerVisible.some((item)=>item.opportunity_type==="PROFESSIONAL_HANDOFF"));
assert(!buyerVisible.some((item)=>item.opportunity_type==="PRE_SHOWING_REFRESH"),"customer-intent filtering must not show every type to every customer");

const recurring = Engine.evaluateRecurringOpportunities(context,catalog,rules);
assert(recurring.some((item)=>item.opportunity_type==="MAINTENANCE_REGROWTH_VISIT"));
assert(recurring.some((item)=>item.opportunity_type==="REPEAT_PHOTO_MONITORING"));
assert(recurring.some((item)=>item.opportunity_type==="ADDITIONAL_REVEAL_WORK"));
const preShowing = recurring.find((item)=>item.opportunity_type==="PRE_SHOWING_REFRESH");
assert(preShowing&&preShowing.source_customer_interaction_ids.includes("INTERACTION-SHOWING-001"));
assert(!preShowing.evidence_basis.some((item)=>item.source_id==="INTERACTION-SHOWING-001"),"showing intent may not become physical evidence");
assert(recurring.every((item)=>item.status==="NEEDS_VERIFICATION"),"recurring candidates require current-condition review and may not auto-sell or schedule");

const verificationCandidate = Engine.clone(heavy);
const verification = verificationCandidate.required_verifications[0];
Engine.resolveVerification(verificationCandidate,verification,["PRODUCTION-TEST-001"],()=>"2026-08-09T00:00:00.000Z");
assert.strictEqual(verificationCandidate.status,"READY_FOR_PROPOSAL");
assert(verificationCandidate.history.some((event)=>event.action==="VERIFICATION_RECORDED"));
assert(verificationCandidate.history.some((event)=>event.action==="VERIFICATION_COMPLETE"));

const learning = Engine.historicalLearningRecord(repeat,{actual_cost_status:"UNKNOWN",after_evidence_ids:[]});
assert.strictEqual(learning.machine_learning_status,"NOT_IMPLEMENTED_V0.1");
assert.strictEqual(learning.actual_cost_status,"UNKNOWN");

assert.throws(()=>Engine.createOpportunity({opportunity_id:"BAD",property_id:"P",opportunity_type:"X",customer_type:"OWNER",source_observation_ids:[],source_customer_interaction_ids:["C-1"],evidence_basis:[{information_class:"CUSTOMER_INTEREST",source_id:"C-1"}],priority_inputs:{} }),/Customer behavior/);
const coreSource = fs.readFileSync(path.join(root,"opportunity-engine-core.js"),"utf8");
assert(!/PEARSON-ROAD/i.test(coreSource),"generic engine rules must not be hard-coded to Pearson Road");

console.log("PASS: opportunity discovery, evidence/customer separation, unknown preservation, customer intent, proposal and repeat-photo contracts, recurring review, history, and Pearson-like regressions are verified.");
