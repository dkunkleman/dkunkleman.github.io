(function(){
  "use strict";
  const Engine=window.PropertyProductionEngine;
  const STORAGE_KEY="propertyProductionIntelligenceV01Review";
  const CLASS_LABELS={LIGHT_BRUSH_1_2:"Light brush — 1–2 inch",MEDIUM_BRUSH_2_3:"Medium brush — 2–3 inch",HEAVY_BRUSH_3_4:"Heavy brush — 3–4 inch",DELICATE_CREEK_REVEAL:"Delicate creek reveal",SELECTIVE_HOMESITE_REVEAL:"Selective homesite reveal",WALKING_PATH_REVEAL:"Walking path reveal",VIEW_WINDOW_REVEAL:"View-window reveal",CLEAN_STAGING_FINISH:"Clean staging finish",DEBRIS_HANDLING_ONLY:"Debris handling only",CUSTOM:"Custom"};
  const COST_FIELDS=[
    ["crew_lead_loaded_rate","Crew-lead loaded $/hour"],["helper_loaded_rate","Helper loaded $/hour"],["other_labor_cost","Other labor $"],
    ["equipment_cost","Equipment $"],["equipment_rental","Equipment rental $"],["fuel","Fuel $"],["oil","Oil $"],
    ["blades","Blades $"],["string","String $"],["chains","Chains $"],["consumables","Other consumables $"],
    ["transportation","Transportation $"],["hauling","Hauling $"],["disposal","Disposal $"],
    ["third_party_services","Third-party services $"],["mapping_documentation_cost","Map / documentation $"],["other_direct_cost","Other direct $"]
  ];
  let state={test:null,finished:null};
  const $=(id)=>document.getElementById(id);
  const format=(value,digits=1)=>value===null||value===undefined?"UNKNOWN":Number(value).toLocaleString(undefined,{maximumFractionDigits:digits});
  const now=()=>new Date().toISOString();
  const persist=()=>localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  const load=()=>{try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(saved&&typeof saved==="object")state=saved;}catch(_){/* keep empty isolated state */}};
  function setHidden(id,hidden){$(id).classList.toggle("hidden",hidden);}
  function area(){const length=Number($("lengthFt").value)||0,width=Number($("widthFt").value)||0;return {length,width,area:length*width};}
  function updateArea(){const value=area().area;$("areaAnswer").textContent=`${format(value,0)} sq ft`;}
  function activePhase(phase){return !!state.test?.action_log?.find((entry)=>entry.phase===phase&&entry.action==="START"&&!entry.closed_at);}
  function fact(label,value){return `<div class="fact"><span>${label}</span><strong>${value}</strong></div>`;}
  function renderLive(){
    if(!state.test)return;
    $("testId").textContent=state.test.production_test_id;
    $("cuttingButton").textContent=activePhase("CUTTING")?"STOP CUTTING":"START CUTTING";
    $("cuttingButton").classList.toggle("running",activePhase("CUTTING"));
    $("debrisButton").textContent=activePhase("DEBRIS_HANDLING")?"STOP DEBRIS":"START DEBRIS";
    $("debrisButton").classList.toggle("running",activePhase("DEBRIS_HANDLING"));
    const e=Engine.evaluateProductionTest(state.test);
    $("liveFacts").innerHTML=fact("Planned test area",`${format(e.calculated.quantity.area_sq_ft,0)} sq ft`)+fact("Cutting recorded",`${format(e.calculated.time.cutting_minutes||0,1)} min`)+fact("Debris recorded",`${format(e.calculated.time.debris_handling_minutes||0,1)} min`)+fact("Delay recorded",`${format((e.calculated.time.equipment_delay_minutes||0)+(e.calculated.time.weather_delay_minutes||0)+(e.calculated.time.other_delay_minutes||0),1)} min`);
  }
  function createTest(){
    const q=area();
    const id=`PT-${new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14)}`;
    state.test=Engine.beginFieldTest(Engine.createProductionTest({production_test_id:id,property_id:"PEARSON-ROAD-REVIEW",production_class:$("productionClass").value,finish_level:$("finishLevel").value,quantity_type:"SQUARE_FEET",length_ft:q.length,width_ft:q.width,area_sq_ft:q.area,unit:"sq ft",crew_model_id:$("crewCount").value==="2"?"DAVID_PLUS_ONE_HELPER":"FIELD_CREW_REVIEW",crew_count:Number($("crewCount").value),dominant_material_class:$("materialClass").value||"UNKNOWN",density_status:$("density").value,terrain_status:$("terrain").value,wetness_status:$("wetness").value,obstacle_notes:$("conditionNotes").value,status:"DRAFT"}),now());
    state.finished=null;persist();setHidden("setupCard",true);setHidden("activeCard",false);setHidden("resultsCard",true);renderLive();
  }
  function toggle(phase){
    try{state.test=Engine.togglePhase(state.test,phase,activePhase(phase)?"STOP":"START",now());persist();renderLive();}
    catch(error){alert(error.message);}
  }
  function addDelay(){
    const text=prompt("How many delay minutes? Leave blank to cancel.","5");if(text===null)return;
    const minutes=Number(text);if(!(minutes>0)){alert("Enter delay minutes greater than zero.");return;}
    const type=(prompt("Type EQUIPMENT, WEATHER, or OTHER.","OTHER")||"OTHER").toUpperCase();
    const note=prompt("Short reason (optional).","")||"";
    try{state.test=Engine.addFieldDelay(state.test,type,minutes,note,now());persist();renderLive();}catch(error){alert(error.message);}
  }
  function openFinish(){
    if(activePhase("CUTTING")||activePhase("DEBRIS_HANDLING")){alert("Stop cutting and debris timing before finishing.");return;}
    $("completedQuantity").value=area().area;setHidden("finishCard",false);$("finishCard").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function finish(status){
    const completed=Number($("completedQuantity").value);
    if(!(completed>=0)){alert("Enter the amount actually completed.");return;}
    state.test.quantity=completed;state.test.area_sq_ft=completed;state.test.quantity_completion_status=status;
    const elapsed=Engine.evaluateProductionTest(state.test).calculated.time.elapsed_clock_minutes||0;
    const crew=Number(state.test.crew_count)||0;
    state.test.time.crew_lead_minutes=crew>=1?elapsed:0;
    state.test.time.helper_minutes=crew>=2?elapsed:0;
    state.test.time.additional_worker_minutes=crew>2?elapsed*(crew-2):0;
    state.finished=Engine.finishFieldTest(state.test,status,now());state.test=state.finished;persist();
    setHidden("activeCard",true);setHidden("finishCard",true);setHidden("resultsCard",false);renderResults();$("resultsCard").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function renderResults(){
    const e=Engine.evaluateProductionTest(state.test);state.finished=e;
    const rate=e.calculated.rate.production_rate;
    $("resultFacts").innerHTML=fact("Result",e.status)+fact("Completed quantity",`${format(e.calculated.quantity.quantity,0)} sq ft`)+fact("Crew-hours",format(e.calculated.time.crew_hours,2))+fact("Productive worker-hours",format(e.calculated.time.productive_worker_hours,2))+fact("Observed rate",rate===null?"UNKNOWN — no usable quantity/time":`${format(rate,1)} ${e.calculated.rate.production_rate_unit}`)+fact("Actual direct cost",e.calculated.cost.actual_direct_cost===null?"UNKNOWN":`$${format(e.calculated.cost.actual_direct_cost,2)}`)+fact("Baseline eligibility",e.baseline_eligibility);
    $("baselineStatus").textContent=e.baseline_eligibility==="ELIGIBLE"?"Eligible for the matching internal production class after operator confirmation.":"Not eligible. This test cannot influence estimates yet.";
  }
  function applyCosts(){
    COST_FIELDS.forEach(([field])=>{const text=$(field).value;state.test.cost_inputs[field]=text===""?null:Number(text);});
    state.finished=Engine.evaluateProductionTest(state.test);state.test=state.finished;persist();renderResults();
  }
  function confirmBaseline(){
    const confirmations={};document.querySelectorAll("[data-confirm]").forEach((node)=>{confirmations[node.dataset.confirm]=node.checked;});
    state.test=Engine.confirmBaselineEligibility(state.test,confirmations,"DAVID",{clock:()=>now()});state.finished=Engine.evaluateProductionTest(state.test);persist();renderResults();
  }
  function download(){
    const blob=new Blob([JSON.stringify(state.finished||state.test,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${state.test.production_test_id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function reset(){state={test:null,finished:null};persist();setHidden("setupCard",false);setHidden("activeCard",true);setHidden("finishCard",true);setHidden("resultsCard",true);window.scrollTo({top:0,behavior:"smooth"});}
  function renderPearson(){
    fetch("pearson-proposal-inputs.json").then((r)=>r.json()).then((data)=>{$("pearsonInputs").innerHTML=data.map((item)=>{const quantity=item.quantity_type==="LINEAR_FEET"?`${format(item.measured_quantity,0)} approximate linear ft / ${format(item.area_sq_ft,0)} sq ft treatment area`:`${format(item.area_sq_ft,0)} approximate sq ft / ${format(item.area_sq_ft/43560,3)} acre`;return `<article class="proposal"><h3>${item.option_code} — ${item.name}</h3><p>${quantity}</p><span class="unknown">RATE UNKNOWN</span> <span class="unknown">HOURS UNKNOWN</span> <span class="unknown">COST UNKNOWN</span> <span class="unknown">PRICE UNKNOWN</span></article>`;}).join("");}).catch(()=>{$("pearsonInputs").textContent="Proposal input file could not be read.";});
  }
  function init(){
    Engine.PRODUCTION_CLASSES.forEach((value)=>$("productionClass").add(new Option(CLASS_LABELS[value]||value,value)));$("productionClass").value="HEAVY_BRUSH_3_4";
    COST_FIELDS.forEach(([field,label])=>{$("costInputs").insertAdjacentHTML("beforeend",`<label>${label}<input id="${field}" type="number" inputmode="decimal" min="0" placeholder="UNKNOWN"></label>`);});
    $("lengthFt").addEventListener("input",updateArea);$("widthFt").addEventListener("input",updateArea);$("startTest").addEventListener("click",createTest);$("cuttingButton").addEventListener("click",()=>toggle("CUTTING"));$("debrisButton").addEventListener("click",()=>toggle("DEBRIS_HANDLING"));$("delayButton").addEventListener("click",addDelay);$("finishButton").addEventListener("click",openFinish);document.querySelectorAll("[data-finish]").forEach((button)=>button.addEventListener("click",()=>finish(button.dataset.finish)));$("recalculateCost").addEventListener("click",applyCosts);$("baselineButton").addEventListener("click",confirmBaseline);$("downloadTest").addEventListener("click",download);$("newTest").addEventListener("click",reset);
    updateArea();load();renderPearson();if(state.test){if(["COMPLETED","PARTIAL","ABORTED"].includes(state.test.status)){setHidden("setupCard",true);setHidden("resultsCard",false);renderResults();}else{setHidden("setupCard",true);setHidden("activeCard",false);renderLive();}}
  }
  document.addEventListener("DOMContentLoaded",init);
})();
