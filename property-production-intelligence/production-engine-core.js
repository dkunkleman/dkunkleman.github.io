(function (root, factory) {
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.PropertyProductionEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const PRODUCTION_CLASSES=["LIGHT_BRUSH_1_2","MEDIUM_BRUSH_2_3","HEAVY_BRUSH_3_4","DELICATE_CREEK_REVEAL","SELECTIVE_HOMESITE_REVEAL","WALKING_PATH_REVEAL","VIEW_WINDOW_REVEAL","CLEAN_STAGING_FINISH","DEBRIS_HANDLING_ONLY","CUSTOM"];
  const FINISH_LEVELS=["REVEAL_FINISH","CLEAN_STAGING_FINISH","OTHER"];
  const QUANTITY_TYPES=["SQUARE_FEET","LINEAR_FEET","COUNT","OTHER"];
  const CLOCK_FIELDS=["mobilization_minutes","layout_marking_minutes","cutting_minutes","debris_handling_minutes","cleanup_finish_minutes","documentation_minutes","equipment_delay_minutes","weather_delay_minutes","other_delay_minutes"];
  const PRODUCTIVE_CLOCK_FIELDS=["layout_marking_minutes","cutting_minutes","debris_handling_minutes","cleanup_finish_minutes"];
  const DELAY_FIELDS=["equipment_delay_minutes","weather_delay_minutes","other_delay_minutes"];
  const NONLABOR_COST_FIELDS=["equipment_cost","equipment_rental","fuel","oil","blades","string","chains","consumables","transportation","hauling","disposal","third_party_services","mapping_documentation_cost","other_direct_cost"];
  const BASELINE_CONFIRMATIONS=["measured_quantity_credible","time_record_credible","production_class_correct","abnormal_delays_identified"];
  const clone=(value)=>JSON.parse(JSON.stringify(value));
  const list=(value)=>Array.isArray(value)?value:[];
  const unique=(values)=>[...new Set(list(values).filter(Boolean))];
  const num=(value)=>typeof value==="number"&&Number.isFinite(value)?value:null;
  const round=(value,places=4)=>value===null?null:Number(value.toFixed(places));
  const now=(clock)=>typeof clock==="function"?clock():new Date().toISOString();
  const positive=(value)=>num(value)!==null&&value>0;

  function sumKnown(values){
    return values.every((value)=>num(value)!==null)?values.reduce((sum,value)=>sum+value,0):null;
  }

  function emptyTime(){return Object.fromEntries(CLOCK_FIELDS.map((field)=>[field,0]));}
  function emptyCosts(){return {crew_lead_loaded_rate:null,helper_loaded_rate:null,other_labor_cost:null,...Object.fromEntries(NONLABOR_COST_FIELDS.map((field)=>[field,null]))};}

  function quantityResult(test){
    const supplied=num(test.quantity);
    if(test.quantity_type==="SQUARE_FEET"){
      const calculated=positive(test.length_ft)&&positive(test.width_ft)?test.length_ft*test.width_ft:null;
      const quantity=supplied??num(test.area_sq_ft)??calculated;
      return {quantity,unit:"sq ft",basis:supplied!==null?"OPERATOR_RECORDED_QUANTITY":num(test.area_sq_ft)!==null?"OPERATOR_RECORDED_AREA":"OPERATOR_RECORDED_LENGTH_X_WIDTH",area_sq_ft:quantity,acreage:quantity===null?null:quantity/43560};
    }
    if(test.quantity_type==="LINEAR_FEET"){
      const quantity=supplied??num(test.length_ft);
      return {quantity,unit:"linear ft",basis:supplied!==null?"OPERATOR_RECORDED_QUANTITY":"OPERATOR_RECORDED_LENGTH",area_sq_ft:positive(quantity)&&positive(test.width_ft)?quantity*test.width_ft:null,acreage:positive(quantity)&&positive(test.width_ft)?quantity*test.width_ft/43560:null};
    }
    if(test.quantity_type==="COUNT")return {quantity:supplied,unit:"count",basis:"OPERATOR_RECORDED_QUANTITY",area_sq_ft:null,acreage:null};
    return {quantity:supplied,unit:test.unit||"other",basis:"OPERATOR_RECORDED_QUANTITY",area_sq_ft:num(test.area_sq_ft),acreage:num(test.acreage)};
  }

  function timeResult(test){
    const time={...emptyTime(),...(test.time||{})};
    const elapsedMinutes=sumKnown(CLOCK_FIELDS.map((field)=>num(time[field])));
    const productiveMinutes=sumKnown(PRODUCTIVE_CLOCK_FIELDS.map((field)=>num(time[field])));
    const delayMinutes=sumKnown(DELAY_FIELDS.map((field)=>num(time[field])));
    const workerMinutes=sumKnown([num(time.crew_lead_minutes),num(time.helper_minutes),num(time.additional_worker_minutes)]);
    const crewCount=num(test.crew_count);
    return {
      elapsed_job_hours:elapsedMinutes===null?null:elapsedMinutes/60,
      total_worker_hours:workerMinutes===null?null:workerMinutes/60,
      productive_worker_hours:productiveMinutes===null||crewCount===null?null:productiveMinutes*crewCount/60,
      crew_hours:productiveMinutes===null?null:productiveMinutes/60,
      productive_clock_minutes:productiveMinutes,
      delay_minutes:delayMinutes,
      elapsed_clock_minutes:elapsedMinutes
    };
  }

  function laborCostResult(test,timeMetrics){
    const costs={...emptyCosts(),...(test.cost_inputs||{})};
    const time={...emptyTime(),...(test.time||{})};
    const components=[];
    if(num(time.crew_lead_minutes)>0)components.push(num(costs.crew_lead_loaded_rate)===null?null:time.crew_lead_minutes/60*costs.crew_lead_loaded_rate);
    if(num(time.helper_minutes)>0)components.push(num(costs.helper_loaded_rate)===null?null:time.helper_minutes/60*costs.helper_loaded_rate);
    if(num(time.additional_worker_minutes)>0)components.push(num(costs.other_labor_cost));
    else components.push(num(costs.other_labor_cost));
    if(!components.length&&timeMetrics.total_worker_hours===0)return {actual_labor_cost:0,status:"KNOWN"};
    const total=sumKnown(components);
    return {actual_labor_cost:total,status:total===null?"UNKNOWN_COMPONENTS":"KNOWN"};
  }

  function costResult(test,timeMetrics){
    const costs={...emptyCosts(),...(test.cost_inputs||{})};
    const labor=laborCostResult(test,timeMetrics);
    const nonlabor=sumKnown(NONLABOR_COST_FIELDS.map((field)=>num(costs[field])));
    const direct=labor.actual_labor_cost===null||nonlabor===null?null:labor.actual_labor_cost+nonlabor;
    const unknown=[];
    if(labor.actual_labor_cost===null)unknown.push("LABOR_COST_COMPONENT");
    NONLABOR_COST_FIELDS.forEach((field)=>{if(num(costs[field])===null)unknown.push(field.toUpperCase());});
    return {actual_labor_cost:labor.actual_labor_cost,actual_nonlabor_direct_cost:nonlabor,actual_direct_cost:direct,cost_status:unknown.length?"PARTIAL_UNKNOWN":"COMPLETE",unknown_cost_components:unknown};
  }

  function rateResult(test,quantityMetrics,timeMetrics){
    if(!positive(quantityMetrics.quantity)||!positive(timeMetrics.crew_hours))return {rate_status:"UNKNOWN",production_rate:null,production_rate_unit:null,worker_rate:null,worker_rate_unit:null};
    const baseUnit=test.quantity_type==="SQUARE_FEET"?"sq ft":test.quantity_type==="LINEAR_FEET"?"linear ft":test.quantity_type==="COUNT"?"count":test.unit||"unit";
    const productionRate=quantityMetrics.quantity/timeMetrics.crew_hours;
    const workerRate=positive(timeMetrics.productive_worker_hours)?quantityMetrics.quantity/timeMetrics.productive_worker_hours:null;
    return {rate_status:"CALCULATED_FROM_MEASURED_TEST",production_rate:productionRate,production_rate_unit:`${baseUnit} per crew-hour`,worker_rate:workerRate,worker_rate_unit:workerRate===null?null:`${baseUnit} per worker-hour`};
  }

  function createProductionTest(input,options){
    if(!input.production_test_id||!input.property_id)throw new Error("production_test_id and property_id are required.");
    if(!PRODUCTION_CLASSES.includes(input.production_class))throw new Error("Unsupported production_class.");
    if(!FINISH_LEVELS.includes(input.finish_level))throw new Error("Unsupported finish_level.");
    if(!QUANTITY_TYPES.includes(input.quantity_type))throw new Error("Unsupported quantity_type.");
    const createdAt=input.created_at||now(options?.clock);
    return {
      production_test_id:input.production_test_id,property_id:input.property_id,work_order_id:input.work_order_id||null,proposal_zone_id:input.proposal_zone_id||null,
      service_code:input.service_code||"UNKNOWN",production_class:input.production_class,finish_level:input.finish_level,test_date:input.test_date||createdAt.slice(0,10),crew_model_id:input.crew_model_id||"UNKNOWN",
      quantity_type:input.quantity_type,quantity:num(input.quantity),unit:input.unit||"UNKNOWN",length_ft:num(input.length_ft),width_ft:num(input.width_ft),area_sq_ft:num(input.area_sq_ft),acreage:num(input.acreage),quantity_completion_status:input.quantity_completion_status||"COMPLETED_QUANTITY",
      dominant_material_class:input.dominant_material_class||"UNKNOWN",density_status:input.density_status||"UNKNOWN",terrain_status:input.terrain_status||"UNKNOWN",wetness_status:input.wetness_status||"UNKNOWN",slope_status:input.slope_status||"UNKNOWN",access_status:input.access_status||"UNKNOWN",debris_handling_method:input.debris_handling_method||"UNKNOWN",preservation_complexity:input.preservation_complexity||"UNKNOWN",obstacle_notes:input.obstacle_notes||"",
      time:{...emptyTime(),crew_lead_minutes:null,helper_minutes:null,additional_worker_minutes:null,...clone(input.time||{})},crew_count:num(input.crew_count),cost_inputs:{...emptyCosts(),...clone(input.cost_inputs||{})},
      status:input.status||"DRAFT",baseline_eligibility:input.baseline_eligibility||"NOT_REVIEWED",baseline_confirmation:null,
      before_evidence_ids:unique(input.before_evidence_ids),work_evidence_ids:unique(input.work_evidence_ids),after_evidence_ids:unique(input.after_evidence_ids),record_class:"BUSINESS_WORK_RECORD",
      action_log:clone(list(input.action_log)),created_at:createdAt,history:[{event_id:`${input.production_test_id}-EVENT-001`,occurred_at:createdAt,action:"PRODUCTION_TEST_CREATED",note:"Business/work record created; source field evidence was not modified."}]
    };
  }

  function evaluateProductionTest(test){
    const quantity=quantityResult(test),time=timeResult(test),cost=costResult(test,time),rate=rateResult(test,quantity,time);
    return {...clone(test),calculated:{quantity:{quantity:round(quantity.quantity),unit:quantity.unit,basis:quantity.basis,area_sq_ft:round(quantity.area_sq_ft),acreage:round(quantity.acreage,6)},time:Object.fromEntries(Object.entries(time).map(([key,value])=>[key,round(value)])),cost:{...cost,actual_labor_cost:round(cost.actual_labor_cost,2),actual_nonlabor_direct_cost:round(cost.actual_nonlabor_direct_cost,2),actual_direct_cost:round(cost.actual_direct_cost,2)},rate:{...rate,production_rate:round(rate.production_rate,4),worker_rate:round(rate.worker_rate,4)}}};
  }

  function confirmBaselineEligibility(test,confirmations,operator,options){
    const result=clone(test),evaluation=evaluateProductionTest(result);
    const confirmed=BASELINE_CONFIRMATIONS.every((field)=>confirmations?.[field]===true);
    const usableStatus=["COMPLETED","PARTIAL"].includes(result.status);
    const rateKnown=evaluation.calculated.rate.production_rate!==null;
    result.baseline_confirmation={operator:operator||"UNKNOWN",confirmed_at:now(options?.clock),...Object.fromEntries(BASELINE_CONFIRMATIONS.map((field)=>[field,confirmations?.[field]===true]))};
    result.baseline_eligibility=confirmed&&usableStatus&&rateKnown?"ELIGIBLE":"INELIGIBLE";
    result.history.push({event_id:`${result.production_test_id}-EVENT-${String(result.history.length+1).padStart(3,"0")}`,occurred_at:result.baseline_confirmation.confirmed_at,action:"BASELINE_ELIGIBILITY_REVIEWED",note:result.baseline_eligibility});
    return result;
  }

  function maturity(testCount,propertyCount){
    if(testCount===0)return "NO_DATA";
    if(testCount===1)return "ONE_TEST_ONLY";
    if(testCount<=4)return "EARLY_RANGE";
    if(testCount<=9)return "DEVELOPING_BASELINE";
    return propertyCount>=3?"ESTABLISHED_INTERNAL_BASELINE":"DEVELOPING_BASELINE";
  }
  function median(values){const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}

  function aggregateProductionKnowledge(tests,productionClass,finishLevel,quantityType){
    const eligible=list(tests).filter((test)=>test.production_class===productionClass&&test.finish_level===finishLevel&&test.quantity_type===quantityType&&test.baseline_eligibility==="ELIGIBLE").map(evaluateProductionTest).filter((test)=>positive(test.calculated.rate.production_rate));
    const rates=eligible.map((test)=>test.calculated.rate.production_rate),quantities=eligible.map((test)=>test.calculated.quantity.quantity),crewHours=eligible.map((test)=>test.calculated.time.crew_hours);
    const totalQuantity=quantities.reduce((sum,value)=>sum+value,0),totalCrewHours=crewHours.reduce((sum,value)=>sum+value,0),propertyCount=new Set(eligible.map((test)=>test.property_id)).size;
    const status=maturity(eligible.length,propertyCount);
    return {production_class:productionClass,finish_level:finishLevel,quantity_type:quantityType,test_count:eligible.length,property_count:propertyCount,total_quantity:eligible.length?round(totalQuantity):null,total_crew_hours:eligible.length?round(totalCrewHours):null,weighted_average_rate:eligible.length&&positive(totalCrewHours)?round(totalQuantity/totalCrewHours):null,minimum_observed_rate:eligible.length?round(Math.min(...rates)):null,maximum_observed_rate:eligible.length?round(Math.max(...rates)):null,median_rate:eligible.length>=3?round(median(rates)):null,source_production_test_ids:eligible.map((test)=>test.production_test_id),data_maturity_status:status,rate_range_status:eligible.length>=3?"FAST_TYPICAL_SLOW_AVAILABLE":status==="ONE_TEST_ONLY"?"ONLY_ONE_PRODUCTION_TEST_EXISTS":"INSUFFICIENT_FOR_RANGE",fast_observed_rate:eligible.length>=3?round(Math.max(...rates)):null,typical_internal_rate:eligible.length>=3?round(median(rates)):null,slow_conservative_rate:eligible.length>=3?round(Math.min(...rates)):null,reliability_explanation:status==="NO_DATA"?"No eligible production test exists.":status==="ONE_TEST_ONLY"?"ONLY ONE PRODUCTION TEST EXISTS. It may inform review but does not establish a reliable range.":status==="EARLY_RANGE"?"Two to four eligible tests provide an early observed range only.":status==="DEVELOPING_BASELINE"?"The internal baseline is developing and is not statistically proven.":"At least ten eligible tests across at least three properties support an established internal baseline; it is not statistically proven."};
  }

  function cleanStagingIncrement(revealTest,cleanStagingTest){
    const reveal=evaluateProductionTest(revealTest),clean=evaluateProductionTest(cleanStagingTest);
    const sameContext=reveal.property_id===clean.property_id&&reveal.proposal_zone_id===clean.proposal_zone_id&&reveal.quantity_type===clean.quantity_type;
    const correctSequence=reveal.finish_level==="REVEAL_FINISH"&&clean.finish_level==="CLEAN_STAGING_FINISH";
    if(!sameContext||!correctSequence)return {status:"NOT_COMPARABLE",source_production_test_ids:[reveal.production_test_id,clean.production_test_id],additional_crew_hours:null,additional_worker_hours:null,additional_direct_cost:null,explanation:"Reveal and Clean Staging tests must describe the same property, proposal zone, and quantity type, in that order."};
    return {status:"OBSERVED_INCREMENT",source_production_test_ids:[reveal.production_test_id,clean.production_test_id],measured_quantity:clean.calculated.quantity.quantity,quantity_unit:clean.calculated.quantity.unit,additional_crew_hours:clean.calculated.time.crew_hours,additional_worker_hours:clean.calculated.time.total_worker_hours,additional_direct_cost:clean.calculated.cost.actual_direct_cost,cost_status:clean.calculated.cost.cost_status,explanation:"The Clean Staging test is a separately recorded follow-on pass. Its measured time and cost are the observed increment beyond Reveal Finish; UNKNOWN components remain UNKNOWN."};
  }

  function loadedCrewHourlyCost(crewModel){
    const rates=[num(crewModel?.crew_lead_loaded_rate),num(crewModel?.helper_loaded_rate),...list(crewModel?.additional_worker_loaded_rates).map(num)];
    return rates.every((rate)=>rate!==null)?rates.reduce((sum,rate)=>sum+rate,0):null;
  }
  function estimateCostComponents(input,estimatedCrewHours){
    const laborHourly=loadedCrewHourlyCost(input.crew_model),labor=positive(estimatedCrewHours)&&laborHourly!==null?estimatedCrewHours*laborHourly:null;
    const fields=["estimated_equipment_cost","estimated_fuel_consumables","estimated_transportation","estimated_debris","estimated_documentation","estimated_other_direct_cost"];
    const other=fields.map((field)=>num(input[field]));
    const direct=labor===null||other.some((value)=>value===null)?null:labor+other.reduce((sum,value)=>sum+value,0);
    return {estimated_labor_cost:round(labor,2),...Object.fromEntries(fields.map((field,index)=>[field,other[index]])),estimated_direct_cost:round(direct,2),unknown_cost_components:[...(labor===null?["ESTIMATED_LABOR_COST"]:[]),...fields.filter((field,index)=>other[index]===null)]};
  }

  function createEstimate(input,options){
    const createdAt=input.original_estimate_created_at||now(options?.clock),quantity=num(input.measured_quantity),rate=num(input.selected_production_rate),crewHours=positive(quantity)&&positive(rate)?quantity/rate:null,cost=estimateCostComponents(input,crewHours);
    const contingencyPercent=num(input.contingency_percent),contingencyAmount=num(input.contingency_amount),contingency=contingencyAmount??(cost.estimated_direct_cost!==null&&contingencyPercent!==null?cost.estimated_direct_cost*contingencyPercent:null),withContingency=cost.estimated_direct_cost===null||contingency===null?null:cost.estimated_direct_cost+contingency;
    const margin=num(input.target_gross_margin),minimumProfit=num(input.minimum_job_profit),marginFloor=withContingency!==null&&margin!==null&&margin>=0&&margin<1?withContingency/(1-margin):null,profitFloor=withContingency!==null&&minimumProfit!==null?withContingency+minimumProfit:null,recommended=marginFloor===null||profitFloor===null?null:Math.max(marginFloor,profitFloor);
    return {estimate_id:input.estimate_id,property_id:input.property_id,proposal_zone_id:input.proposal_zone_id,production_class:input.production_class,finish_level:input.finish_level,quantity_type:input.quantity_type,measured_quantity:quantity,source_production_test_ids:unique(input.source_production_test_ids),selected_production_rate:rate,production_rate_basis:input.production_rate_basis||"UNKNOWN",data_maturity_status:input.data_maturity_status||"NO_DATA",estimated_crew_hours:round(crewHours),...cost,contingency:round(contingency,2),estimated_cost_with_contingency:round(withContingency,2),target_gross_margin:margin,minimum_job_profit:minimumProfit,recommended_minimum_sell_price:round(recommended,2),operator_selected_sell_price:num(input.operator_selected_sell_price),pricing_status:input.pricing_status||"UNKNOWN",price_warning:null,original_estimate_created_at:createdAt,record_class:"BUSINESS_ESTIMATE_RECORD",history:[{event_id:`${input.estimate_id}-EVENT-001`,occurred_at:createdAt,action:"ESTIMATE_CREATED"}]};
  }

  function approveEstimatePrice(estimate,price,operator,options){
    const result=clone(estimate),selected=num(price);
    if(selected===null)throw new Error("Operator-selected sell price is required.");
    result.operator_selected_sell_price=selected;result.pricing_status="OPERATOR_APPROVED";result.price_warning=result.recommended_minimum_sell_price!==null&&selected<result.recommended_minimum_sell_price?"OPERATOR PRICE IS BELOW THE CALCULATED MINIMUM FLOOR":null;
    result.history.push({event_id:`${result.estimate_id}-EVENT-${String(result.history.length+1).padStart(3,"0")}`,occurred_at:now(options?.clock),action:"SELL_PRICE_OPERATOR_APPROVED",operator:operator||"UNKNOWN",price:selected,warning:result.price_warning});
    return result;
  }

  function conservativeEstimateRange(input,knowledge,options){
    if(knowledge.test_count<3)return {status:knowledge.test_count===1?"ONLY_ONE_PRODUCTION_TEST_EXISTS":"INSUFFICIENT_DATA",warning:knowledge.reliability_explanation,cases:[]};
    const cases=[{code:"FAST_OBSERVED_CASE",rate:knowledge.fast_observed_rate},{code:"TYPICAL_INTERNAL_CASE",rate:knowledge.typical_internal_rate},{code:"SLOW_CONSERVATIVE_CASE",rate:knowledge.slow_conservative_rate}].map((item)=>({code:item.code,estimate:createEstimate({...input,estimate_id:`${input.estimate_id}-${item.code}`,selected_production_rate:item.rate,production_rate_basis:`${item.code} FROM ELIGIBLE INTERNAL TESTS`,source_production_test_ids:knowledge.source_production_test_ids,data_maturity_status:knowledge.data_maturity_status},options)}));
    return {status:"RANGE_AVAILABLE",warning:"Observed internal cases are not statistically proven.",cases};
  }

  function packageEconomics(input){
    const estimates=list(input.estimates),standalone=estimates.map((estimate)=>num(estimate.operator_selected_sell_price)),costs=estimates.map((estimate)=>num(estimate.estimated_cost_with_contingency));
    const standaloneSum=standalone.every((value)=>value!==null)?standalone.reduce((sum,value)=>sum+value,0):null,directSum=costs.every((value)=>value!==null)?costs.reduce((sum,value)=>sum+value,0):null;
    const savingsComponents=input.shared_cost_savings||{},savingsValues=Object.values(savingsComponents).map(num),sharedSavings=savingsValues.length&&savingsValues.every((value)=>value!==null)?savingsValues.reduce((sum,value)=>sum+value,0):null;
    const discount=num(input.requested_package_discount),packagePrice=standaloneSum===null||discount===null?null:standaloneSum-discount,packageCost=directSum===null||sharedSavings===null?null:Math.max(0,directSum-sharedSavings),gross=packagePrice===null||packageCost===null?null:packagePrice-packageCost,margin=packagePrice>0&&gross!==null?gross/packagePrice:null;
    const targetMargin=num(input.target_gross_margin),minimumProfit=num(input.minimum_job_profit),marginFloor=packageCost!==null&&targetMargin!==null&&targetMargin>=0&&targetMargin<1?packageCost/(1-targetMargin):null,profitFloor=packageCost!==null&&minimumProfit!==null?packageCost+minimumProfit:null,floor=marginFloor===null||profitFloor===null?null:Math.max(marginFloor,profitFloor);
    const warning=packagePrice!==null&&floor!==null&&packagePrice<floor?"REQUESTED PACKAGE DISCOUNT VIOLATES THE APPROVED MARGIN OR MINIMUM PROFIT FLOOR":null;
    return {sum_of_standalone_prices:round(standaloneSum,2),shared_cost_savings:round(sharedSavings,2),requested_package_discount:discount,package_price:round(packagePrice,2),package_expected_direct_cost:round(packageCost,2),package_expected_gross_dollars:round(gross,2),package_expected_gross_margin:round(margin,4),minimum_margin_floor:round(floor,2),warning,operator_override_required:!!warning};
  }

  function errorMetric(estimated,actual){
    const e=num(estimated),a=num(actual);if(e===null||a===null)return {absolute:null,percent:null};const absolute=a-e;return {absolute:round(absolute,4),percent:e===0?null:round(absolute/e,4)};
  }
  function plannedVsActual(estimate,actualTest,actualRevenue){
    const original=clone(estimate),actual=evaluateProductionTest(actualTest),revenue=num(actualRevenue),actualCost=actual.calculated.cost.actual_direct_cost,actualGross=revenue===null||actualCost===null?null:revenue-actualCost,actualMargin=revenue>0&&actualGross!==null?actualGross/revenue:null,estimatedGross=estimate.operator_selected_sell_price!==null&&estimate.estimated_cost_with_contingency!==null?estimate.operator_selected_sell_price-estimate.estimated_cost_with_contingency:null,estimatedMargin=estimate.operator_selected_sell_price>0&&estimatedGross!==null?estimatedGross/estimate.operator_selected_sell_price:null;
    return {comparison_id:`COMPARE-${estimate.estimate_id}-${actualTest.production_test_id}`,original_estimate_snapshot:original,actual_production_test_id:actualTest.production_test_id,quantity_error:errorMetric(estimate.measured_quantity,actual.calculated.quantity.quantity),crew_hours_error:errorMetric(estimate.estimated_crew_hours,actual.calculated.time.crew_hours),cost_error:errorMetric(estimate.estimated_cost_with_contingency,actualCost),production_rate_error:errorMetric(estimate.selected_production_rate,actual.calculated.rate.production_rate),gross_dollars_error:errorMetric(estimatedGross,actualGross),margin_error:errorMetric(estimatedMargin,actualMargin),actual:{quantity:actual.calculated.quantity.quantity,crew_hours:actual.calculated.time.crew_hours,direct_cost:actualCost,production_rate:actual.calculated.rate.production_rate,revenue,actual_gross_dollars:round(actualGross,2),actual_margin:round(actualMargin,4)}};
  }

  function productionTestFromWorkPhase(workPhase,operatorReview,options){
    const test=createProductionTest({production_test_id:operatorReview?.production_test_id||`PT-${workPhase.work_phase_id}`,property_id:workPhase.property_id,work_order_id:workPhase.work_order_id,proposal_zone_id:workPhase.proposal_zone_id,service_code:workPhase.service_code,production_class:workPhase.production_class,finish_level:workPhase.finish_level,quantity_type:workPhase.quantity_type,quantity:workPhase.actual_quantity,unit:workPhase.unit,length_ft:workPhase.actual_length_ft,width_ft:workPhase.actual_width_ft,area_sq_ft:workPhase.actual_area_sq_ft,crew_model_id:workPhase.crew_model_id,crew_count:workPhase.crew_count,time:workPhase.actual_time,cost_inputs:workPhase.actual_cost_inputs,status:workPhase.status==="COMPLETED"?"COMPLETED":"PARTIAL",before_evidence_ids:workPhase.before_evidence_ids,work_evidence_ids:workPhase.work_evidence_ids,after_evidence_ids:workPhase.after_evidence_ids},options);
    if(operatorReview?.operator_confirms===true)return confirmBaselineEligibility(test,operatorReview.confirmations,operatorReview.operator,options);
    return test;
  }

  function beginFieldTest(test,startedAt){const result=clone(test);result.status="ACTIVE";result.action_log.push({action:"TEST_STARTED",at:startedAt});result.history.push({event_id:`${result.production_test_id}-EVENT-${String(result.history.length+1).padStart(3,"0")}`,occurred_at:startedAt,action:"TEST_STARTED"});return result;}
  function togglePhase(test,phase,action,at){
    const result=clone(test),allowed=["CUTTING","DEBRIS_HANDLING"];if(!allowed.includes(phase)||!["START","STOP"].includes(action))throw new Error("Unsupported field phase action.");
    if(result.status!=="ACTIVE")throw new Error("Test must be active.");
    const open=result.action_log.findLast((entry)=>entry.phase===phase&&entry.action==="START"&&!entry.closed_at);
    if(action==="START"){if(open)throw new Error(`${phase} is already active.`);result.action_log.push({phase,action:"START",at});}
    else {if(!open)throw new Error(`${phase} has not started.`);open.closed_at=at;open.duration_minutes=(new Date(at)-new Date(open.at))/60000;result.action_log.push({phase,action:"STOP",at,duration_minutes:open.duration_minutes});const field=phase==="CUTTING"?"cutting_minutes":"debris_handling_minutes";result.time[field]=(num(result.time[field])||0)+open.duration_minutes;}
    return result;
  }
  function addFieldDelay(test,delayType,minutes,note,at){const result=clone(test),field=delayType==="EQUIPMENT"?"equipment_delay_minutes":delayType==="WEATHER"?"weather_delay_minutes":"other_delay_minutes";if(!positive(minutes))throw new Error("Delay minutes must be greater than zero.");result.time[field]=(num(result.time[field])||0)+minutes;result.action_log.push({action:"DELAY_RECORDED",delay_type:delayType,minutes,note:note||"",at});return result;}
  function finishFieldTest(test,status,finishedAt){const result=clone(test);if(!["COMPLETED","PARTIAL","ABORTED"].includes(status))throw new Error("Unsupported finish status.");if(result.action_log.some((entry)=>entry.action==="START"&&!entry.closed_at))throw new Error("Stop active work phases before finishing the test.");result.status=status;result.action_log.push({action:"TEST_FINISHED",status,at:finishedAt});result.history.push({event_id:`${result.production_test_id}-EVENT-${String(result.history.length+1).padStart(3,"0")}`,occurred_at:finishedAt,action:"TEST_FINISHED",note:status});return evaluateProductionTest(result);}

  return {PRODUCTION_CLASSES,FINISH_LEVELS,QUANTITY_TYPES,CLOCK_FIELDS,PRODUCTIVE_CLOCK_FIELDS,DELAY_FIELDS,NONLABOR_COST_FIELDS,BASELINE_CONFIRMATIONS,clone,quantityResult,timeResult,costResult,rateResult,createProductionTest,evaluateProductionTest,confirmBaselineEligibility,aggregateProductionKnowledge,cleanStagingIncrement,createEstimate,approveEstimatePrice,conservativeEstimateRange,packageEconomics,plannedVsActual,productionTestFromWorkPhase,beginFieldTest,togglePhase,addFieldDelay,finishFieldTest};
});
