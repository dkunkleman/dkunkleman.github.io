const assert=require("assert");
const fs=require("fs");
const path=require("path");
const Engine=require("../property-production-intelligence/production-engine-core.js");

const allConfirmations={measured_quantity_credible:true,time_record_credible:true,production_class_correct:true,abnormal_delays_identified:true};
const clock=(value)=>()=>value;
function create(id,overrides={}){
  const supplied=(name,fallback)=>Object.prototype.hasOwnProperty.call(overrides,name)?overrides[name]:fallback;
  return Engine.createProductionTest({
    production_test_id:id,property_id:overrides.property_id||"PROPERTY-1",production_class:overrides.production_class||"HEAVY_BRUSH_3_4",finish_level:overrides.finish_level||"REVEAL_FINISH",
    quantity_type:overrides.quantity_type||"SQUARE_FEET",quantity:supplied("quantity",1000),unit:overrides.unit||"sq ft",length_ft:supplied("length_ft",20),width_ft:supplied("width_ft",50),
    crew_model_id:"DAVID_PLUS_ONE_HELPER",crew_count:overrides.crew_count??2,status:overrides.status||"COMPLETED",
    time:{mobilization_minutes:0,layout_marking_minutes:0,cutting_minutes:overrides.cutting_minutes??60,debris_handling_minutes:overrides.debris_handling_minutes??0,cleanup_finish_minutes:0,documentation_minutes:0,equipment_delay_minutes:overrides.equipment_delay_minutes??0,weather_delay_minutes:0,other_delay_minutes:0,crew_lead_minutes:overrides.crew_lead_minutes??60,helper_minutes:overrides.helper_minutes??60,additional_worker_minutes:overrides.additional_worker_minutes??0},
    cost_inputs:overrides.cost_inputs,before_evidence_ids:overrides.before_evidence_ids
  },{clock:clock("2026-08-08T12:00:00.000Z")});
}
function eligible(test){return Engine.confirmBaselineEligibility(test,allConfirmations,"DAVID",{clock:clock("2026-08-08T13:00:00.000Z")});}
function completeCosts(lead=30,helper=20){return {crew_lead_loaded_rate:lead,helper_loaded_rate:helper,other_labor_cost:0,...Object.fromEntries(Engine.NONLABOR_COST_FIELDS.map((field)=>[field,0]))};}

// 20 x 50 must calculate exactly 1,000 square feet.
const thousand=Engine.evaluateProductionTest(create("PT-1000",{quantity:null}));
assert.strictEqual(thousand.calculated.quantity.quantity,1000);
assert.strictEqual(thousand.calculated.quantity.area_sq_ft,1000);
assert.strictEqual(thousand.calculated.quantity.acreage,Number((1000/43560).toFixed(6)));

// Linear-feet treatment retains length and can calculate area only from an explicit width.
const linear=Engine.evaluateProductionTest(create("PT-LINEAR",{quantity_type:"LINEAR_FEET",quantity:526,unit:"linear ft",width_ft:5}));
assert.strictEqual(linear.calculated.quantity.quantity,526);
assert.strictEqual(linear.calculated.quantity.area_sq_ft,2630);
assert.strictEqual(linear.calculated.rate.production_rate,526);

// Two people working one productive hour equals one crew-hour and two worker-hours.
assert.strictEqual(thousand.calculated.time.crew_hours,1);
assert.strictEqual(thousand.calculated.time.total_worker_hours,2);
assert.strictEqual(thousand.calculated.time.productive_worker_hours,2);
assert.strictEqual(thousand.calculated.rate.production_rate,1000);
assert.strictEqual(thousand.calculated.rate.worker_rate,500);

// Delays stay visible and do not inflate productive time or the observed production rate.
const delayed=Engine.evaluateProductionTest(create("PT-DELAY",{equipment_delay_minutes:30}));
assert.strictEqual(delayed.calculated.time.elapsed_job_hours,1.5);
assert.strictEqual(delayed.calculated.time.delay_minutes,30);
assert.strictEqual(delayed.calculated.time.crew_hours,1);
assert.strictEqual(delayed.calculated.rate.production_rate,1000);

// Partial quantities can be retained; aborted tests cannot enter the baseline.
const partial=Engine.confirmBaselineEligibility(create("PT-PARTIAL",{status:"PARTIAL",quantity:400}),allConfirmations,"DAVID");
assert.strictEqual(partial.baseline_eligibility,"ELIGIBLE");
const aborted=Engine.confirmBaselineEligibility(create("PT-ABORTED",{status:"ABORTED",quantity:300}),allConfirmations,"DAVID");
assert.strictEqual(aborted.baseline_eligibility,"INELIGIBLE");

// Missing quantity or time means rate UNKNOWN; no value may be invented.
const noQuantity=Engine.evaluateProductionTest(create("PT-NO-QTY",{quantity:null,length_ft:null,width_ft:null}));
assert.strictEqual(noQuantity.calculated.rate.production_rate,null);
const noTime=Engine.evaluateProductionTest(create("PT-NO-TIME",{cutting_minutes:0,crew_lead_minutes:0,helper_minutes:0}));
assert.strictEqual(noTime.calculated.rate.production_rate,null);

// Cost remains unknown until every required input is provided, including explicit zeroes.
assert.strictEqual(thousand.calculated.cost.actual_direct_cost,null);
assert(thousand.calculated.cost.unknown_cost_components.length>0);
const knownCost=Engine.evaluateProductionTest(create("PT-COST",{cost_inputs:completeCosts()}));
assert.strictEqual(knownCost.calculated.cost.actual_labor_cost,50);
assert.strictEqual(knownCost.calculated.cost.actual_direct_cost,50);
assert.strictEqual(knownCost.calculated.cost.cost_status,"COMPLETE");

// One test is explicitly weak and cannot be described as a reliable range.
const oneKnowledge=Engine.aggregateProductionKnowledge([eligible(create("PT-ONE"))],"HEAVY_BRUSH_3_4","REVEAL_FINISH","SQUARE_FEET");
assert.strictEqual(oneKnowledge.data_maturity_status,"ONE_TEST_ONLY");
assert.match(oneKnowledge.reliability_explanation,/ONLY ONE PRODUCTION TEST EXISTS/);
assert.strictEqual(oneKnowledge.median_rate,null);

// Multiple tests calculate weighted/min/max/median using only matching, eligible records.
const tests=[eligible(create("PT-M1",{quantity:1000,cutting_minutes:60})),eligible(create("PT-M2",{quantity:800,cutting_minutes:120,crew_lead_minutes:120,helper_minutes:120})),eligible(create("PT-M3",{quantity:600,cutting_minutes:60}))];
const knowledge=Engine.aggregateProductionKnowledge(tests,"HEAVY_BRUSH_3_4","REVEAL_FINISH","SQUARE_FEET");
assert.strictEqual(knowledge.test_count,3);
assert.strictEqual(knowledge.total_quantity,2400);
assert.strictEqual(knowledge.total_crew_hours,4);
assert.strictEqual(knowledge.weighted_average_rate,600);
assert.strictEqual(knowledge.minimum_observed_rate,400);
assert.strictEqual(knowledge.maximum_observed_rate,1000);
assert.strictEqual(knowledge.median_rate,600);

// Classes and finish levels never mix silently.
const light=eligible(create("PT-LIGHT",{production_class:"LIGHT_BRUSH_1_2"}));
const staging=eligible(create("PT-STAGE",{finish_level:"CLEAN_STAGING_FINISH"}));
assert.strictEqual(Engine.aggregateProductionKnowledge([...tests,light,staging],"HEAVY_BRUSH_3_4","REVEAL_FINISH","SQUARE_FEET").test_count,3);
assert.strictEqual(Engine.aggregateProductionKnowledge([...tests,light,staging],"LIGHT_BRUSH_1_2","REVEAL_FINISH","SQUARE_FEET").test_count,1);
assert.strictEqual(Engine.aggregateProductionKnowledge([...tests,light,staging],"HEAVY_BRUSH_3_4","CLEAN_STAGING_FINISH","SQUARE_FEET").test_count,1);

// A follow-on Clean Staging pass is retained as the observed incremental effort after Reveal Finish.
const cleanFollowOn=create("PT-CLEAN-INCREMENT",{finish_level:"CLEAN_STAGING_FINISH",quantity:1000,cutting_minutes:30,crew_lead_minutes:30,helper_minutes:30,cost_inputs:completeCosts()});
cleanFollowOn.proposal_zone_id="ZONE-A";
const revealBase=create("PT-REVEAL-BASE",{quantity:1000,cost_inputs:completeCosts()});
revealBase.proposal_zone_id="ZONE-A";
const increment=Engine.cleanStagingIncrement(revealBase,cleanFollowOn);
assert.strictEqual(increment.status,"OBSERVED_INCREMENT");
assert.strictEqual(increment.additional_crew_hours,.5);
assert.strictEqual(increment.additional_worker_hours,1);
assert.strictEqual(increment.additional_direct_cost,25);

// Estimates stay unknown if rate or required cost inputs are unknown.
const unknownEstimate=Engine.createEstimate({estimate_id:"EST-UNKNOWN",property_id:"PROPERTY-1",proposal_zone_id:"ZONE-A",production_class:"HEAVY_BRUSH_3_4",finish_level:"REVEAL_FINISH",quantity_type:"SQUARE_FEET",measured_quantity:1000,selected_production_rate:null,crew_model:{crew_lead_loaded_rate:30,helper_loaded_rate:20},target_gross_margin:.3,minimum_job_profit:100});
assert.strictEqual(unknownEstimate.estimated_crew_hours,null);
assert.strictEqual(unknownEstimate.recommended_minimum_sell_price,null);
assert.strictEqual(unknownEstimate.pricing_status,"UNKNOWN");

// Conservative cases require at least three matching tests.
assert.strictEqual(Engine.conservativeEstimateRange({estimate_id:"EST-ONE",property_id:"PROPERTY-1",proposal_zone_id:"ZONE-A",production_class:"HEAVY_BRUSH_3_4",finish_level:"REVEAL_FINISH",quantity_type:"SQUARE_FEET",measured_quantity:1000},oneKnowledge).status,"ONLY_ONE_PRODUCTION_TEST_EXISTS");

// Package savings are explicit and unsafe requested discounts produce a warning without auto-changing them.
const estimateA={operator_selected_sell_price:1500,estimated_cost_with_contingency:900};
const estimateB={operator_selected_sell_price:1500,estimated_cost_with_contingency:900};
const safePackage=Engine.packageEconomics({estimates:[estimateA,estimateB],shared_cost_savings:{mobilization:100},requested_package_discount:200,target_gross_margin:.3,minimum_job_profit:100});
assert.strictEqual(safePackage.sum_of_standalone_prices,3000);
assert.strictEqual(safePackage.shared_cost_savings,100);
assert.strictEqual(safePackage.package_price,2800);
assert.strictEqual(safePackage.package_expected_direct_cost,1700);
assert.strictEqual(safePackage.warning,null);
const unsafePackage=Engine.packageEconomics({estimates:[estimateA,estimateB],shared_cost_savings:{mobilization:100},requested_package_discount:1200,target_gross_margin:.3,minimum_job_profit:100});
assert.match(unsafePackage.warning,/VIOLATES/);
assert.strictEqual(unsafePackage.requested_package_discount,1200,"engine warns but never silently changes the operator's requested discount");

// Planned-versus-actual preserves the original estimate snapshot.
const approved=Engine.approveEstimatePrice(Engine.createEstimate({estimate_id:"EST-1",property_id:"PROPERTY-1",proposal_zone_id:"ZONE-A",production_class:"HEAVY_BRUSH_3_4",finish_level:"REVEAL_FINISH",quantity_type:"SQUARE_FEET",measured_quantity:1000,selected_production_rate:1000,crew_model:{crew_lead_loaded_rate:30,helper_loaded_rate:20},estimated_equipment_cost:0,estimated_fuel_consumables:0,estimated_transportation:0,estimated_debris:0,estimated_documentation:0,estimated_other_direct_cost:0,contingency_amount:0,target_gross_margin:.3,minimum_job_profit:100}),500,"DAVID");
const comparison=Engine.plannedVsActual(approved,create("PT-ACTUAL",{quantity:800,cost_inputs:completeCosts()}),500);
assert.strictEqual(comparison.original_estimate_snapshot.estimate_id,"EST-1");
assert.strictEqual(comparison.original_estimate_snapshot.operator_selected_sell_price,500);
assert.strictEqual(comparison.actual.quantity,800);
assert.notStrictEqual(comparison.quantity_error.absolute,null);

// Work-order import requires explicit operator confirmation of all four gates.
const workPhase={work_phase_id:"PHASE-1",work_order_id:"WORK-1",property_id:"PROPERTY-1",proposal_zone_id:"ZONE-A",service_code:"HEAVY_BRUSH_REVEAL",production_class:"HEAVY_BRUSH_3_4",finish_level:"REVEAL_FINISH",quantity_type:"SQUARE_FEET",actual_quantity:1000,unit:"sq ft",crew_model_id:"DAVID_PLUS_ONE_HELPER",crew_count:2,actual_time:{cutting_minutes:60,crew_lead_minutes:60,helper_minutes:60,additional_worker_minutes:0},status:"COMPLETED",before_evidence_ids:["PHOTO-BEFORE"],after_evidence_ids:["PHOTO-AFTER"]};
assert.strictEqual(Engine.productionTestFromWorkPhase(workPhase,{operator_confirms:false}).baseline_eligibility,"NOT_REVIEWED");
assert.strictEqual(Engine.productionTestFromWorkPhase(workPhase,{operator_confirms:true,production_test_id:"PT-WORK-1",confirmations:allConfirmations,operator:"DAVID"}).baseline_eligibility,"ELIGIBLE");

// Linking evidence IDs never mutates the source evidence object.
const fieldEvidence={observation_id:"OBS-1",gps:{lat:30.1,lon:-87.2},note:"immutable"};
const before=JSON.stringify(fieldEvidence);
const linked=create("PT-EVIDENCE",{before_evidence_ids:[fieldEvidence.observation_id]});
assert.deepStrictEqual(linked.before_evidence_ids,["OBS-1"]);
assert.strictEqual(JSON.stringify(fieldEvidence),before);
assert.strictEqual(linked.record_class,"BUSINESS_WORK_RECORD");

// Pearson examples retain real geometry quantities while every production/pricing result is unknown.
const pearson=JSON.parse(fs.readFileSync(path.join(__dirname,"..","property-production-intelligence","pearson-proposal-inputs.json"),"utf8"));
assert.deepStrictEqual(pearson.map((item)=>item.option_code),["A","B","C","D"]);
pearson.forEach((item)=>{assert.strictEqual(item.production_rate,null);assert.strictEqual(item.estimated_crew_hours,null);assert.strictEqual(item.estimated_cost,null);assert.strictEqual(item.recommended_price,null);});
assert.strictEqual(pearson.find((item)=>item.option_code==="B").components.find((component)=>component.name==="NORTHWEST APPROACH").measured_quantity,null);

console.log("property-production-intelligence.test.js passed");
