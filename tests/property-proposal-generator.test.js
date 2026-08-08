"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Generator=require("../property-proposal-generator/proposal-generator-core.js");

const proposal=Generator.createProposal({property_id:"TEST-PROPERTY",proposal_id:"TEST-PROPOSAL",property:{name:"Test Property"},customer:{name:"Test Customer"},map_url:"../pearson-road-map/index.html"});
const square=(west,south,size)=>({type:"Polygon",coordinates:[[[west,south],[west+size,south],[west+size,south+size],[west,south+size],[west,south]]]});
for(const [index,service] of ["CREEK-PATH","HOMESITE-REVEAL","HEAVY-BRUSH","HOMESITE-REVEAL"].entries()){
  const code=String.fromCharCode(65+index),geometry=index===0?{type:"LineString",coordinates:[[-87.1,30.4],[-87.099,30.4]]}:square(-87.1+index*.002,30.4,.001);
  Generator.addOption(proposal,{option_id:`OPTION-${code}`,option_code:code,proposal_zone_id:`ZONE-${code}`,service_code:service,geometry,width_ft:index===0?5:null,package_included:true});
}
assert.equal(proposal.options.length,4);assert.equal(proposal.options[0].measurement_basis,"APPROXIMATE FROM EDITABLE PROPOSAL GEOMETRY - NOT A SURVEY");
const oldArea=proposal.options[1].area_sq_ft;proposal.options[1].geometry=square(-87.098,30.4,.0015);Generator.recalculateOption(proposal.options[1]);assert.notEqual(proposal.options[1].area_sq_ft,oldArea);
assert.equal(proposal.options[0].internal_pricing.status,"NEEDS_PRODUCTION_TEST");
const pricing=Generator.calculateInternalPricing(proposal.options[0],{crew_lead_labor:100});assert.equal(pricing.cost_floor,null);assert.ok(pricing.unknown_cost_components.includes("helper_labor"));
proposal.options[0].customer_selected=true;assert.throws(()=>Generator.acceptProposal(proposal,"Customer"),/validated standalone price/);
proposal.options.forEach((option,index)=>{option.customer_selected=true;Generator.approveStandalonePrice(option,(index+1)*1000,true);});
proposal.package.selected=true;let summary=Generator.setPackageDiscount(proposal,{discount_type:"PERCENT",discount_percent:10,discount_status:"VALIDATED"});assert.deepEqual([summary.standalone_sum,summary.package_savings,summary.final_package_price],[10000,1000,9000]);
const versionBefore=proposal.proposal_version;Generator.materialUpdate(proposal,"Customer-facing scope changed");assert.equal(proposal.proposal_version,versionBefore+1);
const accepted=Generator.acceptProposal(proposal,"Test Customer");assert.equal(accepted.immutable,true);assert.equal(accepted.accepted_geometry.length,4);assert.equal(proposal.proposal_status,"ACCEPTED");
const frozen=JSON.stringify(accepted);proposal.options[0].geometry.coordinates[0][0]-=.01;assert.equal(JSON.stringify(accepted),frozen,"accepted geometry must remain frozen after later draft edits");
const customerHtml=Generator.renderCustomerProposal(proposal);assert.match(customerHtml,/data-proposal-zone-id="ZONE-A"/);assert.match(customerHtml,/APPROXIMATE - NOT A SURVEY/);assert.doesNotMatch(customerHtml,/known_direct_cost|target_margin_percent|minimum_job_profit/,"internal pricing must not leak into customer proposal");
const schema=JSON.parse(fs.readFileSync(path.join(__dirname,"..","property-proposal-generator","proposal.schema.json"),"utf8"));assert.equal(schema.title,"Property Intelligence Proposal");assert.equal(Object.keys(Generator.SERVICE_LIBRARY).length,6);assert.equal(Generator.STANDARD_CLAUSES.length,9);
console.log("PASS: proposal generator preserves structured authority, unknown pricing, package safeguards, customer/internal separation, versioning, and acceptance freeze.");
