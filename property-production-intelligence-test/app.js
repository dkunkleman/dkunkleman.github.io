(function(){
  "use strict";
  const Engine=window.PropertyProductionEngine;
  const STORAGE_KEY="property-production-intelligence-poc-v1";
  const SOURCE_BUILD="9a6e8e070c3cec1437ee3c8a74342edf4cbe6575";
  const CLASS_LABELS={LIGHT_BRUSH_1_2:"Light brush — 1–2 inch",MEDIUM_BRUSH_2_3:"Medium brush — 2–3 inch",HEAVY_BRUSH_3_4:"Heavy brush — 3–4 inch",DELICATE_CREEK_REVEAL:"Delicate creek reveal",SELECTIVE_HOMESITE_REVEAL:"Selective homesite reveal",WALKING_PATH_REVEAL:"Walking path reveal",VIEW_WINDOW_REVEAL:"View-window reveal",CLEAN_STAGING_FINISH:"Clean staging finish",DEBRIS_HANDLING_ONLY:"Debris handling only",CUSTOM:"Custom"};
  const COST_FIELDS=[["crew_lead_loaded_rate","Crew-lead loaded $/hour"],["helper_loaded_rate","Helper loaded $/hour"],["other_labor_cost","Other labor $"],["equipment_cost","Equipment $"],["equipment_rental","Equipment rental $"],["fuel","Fuel $"],["oil","Oil $"],["blades","Blades $"],["string","String $"],["chains","Chains $"],["consumables","Other consumables $"],["transportation","Transportation $"],["hauling","Hauling $"],["disposal","Disposal $"],["third_party_services","Third-party services $"],["mapping_documentation_cost","Map / documentation $"],["other_direct_cost","Other direct $"]];
  let state={schema_version:1,source_build:SOURCE_BUILD,active_test:null,saved_tests:[],selected_result_id:null};
  const $=(id)=>document.getElementById(id);
  const now=()=>new Date().toISOString();
  const format=(value,digits=1)=>value===null||value===undefined?"UNKNOWN":Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});
  const hours=(value)=>value>0&&value<.01?"<0.01":format(value,2);
  const fact=(label,value)=>`<div class="fact"><span>${label}</span><strong>${value}</strong></div>`;
  const setHidden=(id,hidden)=>$(id).classList.toggle("hidden",hidden);
  function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  function load(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(saved&&saved.schema_version===1&&saved.source_build===SOURCE_BUILD)state={...state,...saved,saved_tests:Array.isArray(saved.saved_tests)?saved.saved_tests:[]};}catch(_){/* preserve empty isolated state */}}
  function area(){const length=Number($("lengthFt").value)||0,width=Number($("widthFt").value)||0;return {length,width,area:length*width};}
  function updateArea(){$("areaAnswer").textContent=`${format(area().area,0)} sq ft`;}
  function activePhase(phase){return !!state.active_test?.action_log?.find((entry)=>entry.phase===phase&&entry.action==="START"&&!entry.closed_at);}
  function currentResult(){return state.saved_tests.find((test)=>test.production_test_id===state.selected_result_id)||null;}
  function createTest(){
    const q=area(),id=`PT-${new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14)}`;
    state.active_test=Engine.beginFieldTest(Engine.createProductionTest({production_test_id:id,property_id:"ISOLATED-PHYSICAL-TEST",production_class:$("productionClass").value,finish_level:$("finishLevel").value,quantity_type:"SQUARE_FEET",length_ft:q.length,width_ft:q.width,area_sq_ft:q.area,unit:"sq ft",crew_model_id:Number($("crewCount").value)===2?"DAVID_PLUS_ONE_HELPER":"ISOLATED_TEST_CREW",crew_count:Number($("crewCount").value),dominant_material_class:$("materialClass").value||"UNKNOWN",density_status:$("density").value,terrain_status:$("terrain").value,wetness_status:$("wetness").value,obstacle_notes:$("conditionNotes").value,status:"DRAFT"}),now());
    state.selected_result_id=null;persist();showActive();
  }
  function toggle(phase){try{state.active_test=Engine.togglePhase(state.active_test,phase,activePhase(phase)?"STOP":"START",now());persist();renderLive();}catch(error){alert(error.message);}}
  function addDelay(){const text=prompt("How many delay minutes? Leave blank to cancel.","5");if(text===null)return;const minutes=Number(text);if(!(minutes>0)){alert("Enter delay minutes greater than zero.");return;}const type=(prompt("Type EQUIPMENT, WEATHER, or OTHER.","OTHER")||"OTHER").toUpperCase();const note=prompt("Short reason (optional).","")||"";try{state.active_test=Engine.addFieldDelay(state.active_test,type,minutes,note,now());persist();renderLive();}catch(error){alert(error.message);}}
  function renderLive(){
    if(!state.active_test)return;
    $("testId").textContent=state.active_test.production_test_id;
    $("cuttingButton").textContent=activePhase("CUTTING")?"STOP CUTTING":"START CUTTING";$("cuttingButton").classList.toggle("running",activePhase("CUTTING"));
    $("debrisButton").textContent=activePhase("DEBRIS_HANDLING")?"STOP DEBRIS":"START DEBRIS";$("debrisButton").classList.toggle("running",activePhase("DEBRIS_HANDLING"));
    const e=Engine.evaluateProductionTest(state.active_test),t=e.calculated.time;
    $("liveFacts").innerHTML=fact("Planned test area",`${format(e.calculated.quantity.area_sq_ft,0)} sq ft`)+fact("Productive time",`${format(t.productive_clock_minutes,1)} min`)+fact("Delay time",`${format(t.delay_minutes,1)} min`)+fact("Saved locally","YES");
  }
  function showActive(){setHidden("setupCard",true);setHidden("activeCard",false);setHidden("finishCard",true);setHidden("resultsCard",true);renderLive();}
  function openFinish(){if(activePhase("CUTTING")||activePhase("DEBRIS_HANDLING")){alert("Stop cutting and debris timing before finishing.");return;}$("completedQuantity").value=Engine.evaluateProductionTest(state.active_test).calculated.quantity.quantity||0;setHidden("finishCard",false);$("finishCard").scrollIntoView({behavior:"smooth",block:"start"});}
  function finish(status){
    const completed=Number($("completedQuantity").value);if(!(completed>=0)){alert("Enter the amount actually completed.");return;}
    const test=state.active_test;test.quantity=completed;test.area_sq_ft=completed;test.quantity_completion_status=status;
    const elapsed=Engine.evaluateProductionTest(test).calculated.time.elapsed_clock_minutes||0,crew=Number(test.crew_count)||0;
    test.time.crew_lead_minutes=crew>=1?elapsed:0;test.time.helper_minutes=crew>=2?elapsed:0;test.time.additional_worker_minutes=crew>2?elapsed*(crew-2):0;
    const finished=Engine.finishFieldTest(test,status,now());state.saved_tests.push(finished);state.selected_result_id=finished.production_test_id;state.active_test=null;persist();renderSaved();showResult(finished);
  }
  function showResult(test){setHidden("setupCard",true);setHidden("activeCard",true);setHidden("finishCard",true);setHidden("resultsCard",false);renderResult(test);}
  function renderResult(test){
    const e=Engine.evaluateProductionTest(test),t=e.calculated.time,rate=e.calculated.rate.production_rate;
    $("resultFacts").innerHTML=fact("Completed measured quantity",`${format(e.calculated.quantity.quantity,0)} ${e.calculated.quantity.unit}`)+fact("Productive time",`${format(t.productive_clock_minutes,1)} min`)+fact("Delay time",`${format(t.delay_minutes,1)} min`)+fact("Crew-hours",hours(t.crew_hours))+fact("Worker-hours",hours(t.total_worker_hours))+fact("Actual production rate",rate===null?"UNKNOWN":`${format(rate,1)} ${e.calculated.rate.production_rate_unit}`)+fact("Direct-cost status",e.calculated.cost.actual_direct_cost===null?"UNKNOWN":`$${format(e.calculated.cost.actual_direct_cost,2)}`)+fact("Baseline eligibility",e.baseline_eligibility);
    $("baselineStatus").textContent=e.baseline_eligibility==="ELIGIBLE"?"Eligible for the matching internal production class after operator confirmation.":"Not eligible. This test cannot influence estimates yet.";
  }
  function updateSaved(test){const index=state.saved_tests.findIndex((item)=>item.production_test_id===test.production_test_id);if(index>=0)state.saved_tests[index]=test;state.selected_result_id=test.production_test_id;persist();renderSaved();renderResult(test);}
  function applyCosts(){const test=Engine.clone(currentResult());if(!test)return;COST_FIELDS.forEach(([field])=>{const text=$(field).value;test.cost_inputs[field]=text===""?null:Number(text);});updateSaved(Engine.evaluateProductionTest(test));}
  function confirmBaseline(){const test=currentResult();if(!test)return;const confirmations={};document.querySelectorAll("[data-confirm]").forEach((node)=>{confirmations[node.dataset.confirm]=node.checked;});updateSaved(Engine.confirmBaselineEligibility(test,confirmations,"DAVID",{clock:now}));}
  function download(){const test=currentResult();if(!test)return;const blob=new Blob([JSON.stringify(test,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`${test.production_test_id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function newTest(){state.selected_result_id=null;persist();setHidden("setupCard",false);setHidden("activeCard",true);setHidden("finishCard",true);setHidden("resultsCard",true);window.scrollTo({top:0,behavior:"smooth"});}
  function renderSaved(){
    $("savedCount").textContent=`${state.saved_tests.length} saved test${state.saved_tests.length===1?"":"s"}`;
    $("savedTests").innerHTML=state.saved_tests.slice().reverse().map((test)=>`<button class="saved-test" data-test-id="${test.production_test_id}"><strong>${test.production_test_id}</strong><span>${test.production_class.replaceAll("_"," ")} · ${test.status}</span></button>`).join("");
    document.querySelectorAll("[data-test-id]").forEach((button)=>button.addEventListener("click",()=>{state.selected_result_id=button.dataset.testId;persist();showResult(currentResult());}));
  }
  async function prepareOffline(){
    if(!("serviceWorker" in navigator)){$("offlineStatus").textContent="OFFLINE STORAGE UNAVAILABLE IN THIS BROWSER";return;}
    try{await navigator.serviceWorker.register("./sw.js",{scope:"./"});await navigator.serviceWorker.ready;$("offlineStatus").textContent="OFFLINE STORAGE READY";}catch(_){$("offlineStatus").textContent="OFFLINE STORAGE NOT READY — KEEP THIS PAGE OPEN";}
  }
  function init(){
    Engine.PRODUCTION_CLASSES.forEach((value)=>$("productionClass").add(new Option(CLASS_LABELS[value]||value,value)));$("productionClass").value="HEAVY_BRUSH_3_4";
    COST_FIELDS.forEach(([field,label])=>$("costInputs").insertAdjacentHTML("beforeend",`<label>${label}<input id="${field}" type="number" inputmode="decimal" min="0" placeholder="UNKNOWN"></label>`));
    $("lengthFt").addEventListener("input",updateArea);$("widthFt").addEventListener("input",updateArea);$("startTest").addEventListener("click",createTest);$("cuttingButton").addEventListener("click",()=>toggle("CUTTING"));$("debrisButton").addEventListener("click",()=>toggle("DEBRIS_HANDLING"));$("delayButton").addEventListener("click",addDelay);$("finishButton").addEventListener("click",openFinish);document.querySelectorAll("[data-finish]").forEach((button)=>button.addEventListener("click",()=>finish(button.dataset.finish)));$("recalculateCost").addEventListener("click",applyCosts);$("baselineButton").addEventListener("click",confirmBaseline);$("downloadTest").addEventListener("click",download);$("newTest").addEventListener("click",newTest);
    updateArea();load();renderSaved();if(state.active_test)showActive();else if(currentResult())showResult(currentResult());prepareOffline();
  }
  document.addEventListener("DOMContentLoaded",init);
})();
