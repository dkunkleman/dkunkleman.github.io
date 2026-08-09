(function () {
  "use strict";
  const Engine=window.PropertyOpportunityEngine;
  const baseContext=window.PEARSON_LIKE_OPPORTUNITY_CONTEXT;
  let catalog=[],rules=[],opportunities=[],selectedId=null;
  const safe=(value)=>String(value??"UNKNOWN").replace(/[&<>\"]/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[character]);
  const label=(value)=>String(value||"UNKNOWN").replaceAll("_"," ");

  async function loadJson(path){const response=await fetch(path);if(!response.ok)throw new Error(`${path} could not be loaded.`);return response.json();}
  function context(){return {...baseContext,customer_type:document.getElementById("customerType").value};}

  function discover(){
    const active=context();
    const primary=Engine.discoverOpportunities(active,catalog,rules);
    const recurring=Engine.evaluateRecurringOpportunities(active,catalog,rules);
    const seen=new Set();
    opportunities=[...primary,...recurring].filter((item)=>{const key=[item.opportunity_type,...item.source_work_order_ids,...item.source_proposal_zone_ids].join("|");if(seen.has(key))return false;seen.add(key);return true;});
    const statuses=[...new Set(opportunities.map((item)=>item.status))].sort();
    document.getElementById("statusFilter").innerHTML='<option value="ALL">All statuses</option>'+statuses.map((status)=>`<option value="${safe(status)}">${safe(label(status))}</option>`).join("");
    if(!opportunities.some((item)=>item.opportunity_id===selectedId))selectedId=opportunities[0]?.opportunity_id||null;
    render();
  }

  function filtered(){
    const status=document.getElementById("statusFilter").value;
    const visibility=document.getElementById("visibilityFilter").value;
    return opportunities.filter((item)=>(status==="ALL"||item.status===status)&&(visibility==="ALL"||item.visible_to_customer_type));
  }

  function renderSummary(){
    const visible=filtered();
    document.getElementById("countAll").textContent=visible.length;
    document.getElementById("countVerify").textContent=visible.filter((item)=>item.status==="NEEDS_VERIFICATION").length;
    document.getElementById("countReady").textContent=visible.filter((item)=>item.status==="READY_FOR_PROPOSAL").length;
    document.getElementById("countHandoff").textContent=visible.filter((item)=>item.opportunity_type==="PROFESSIONAL_HANDOFF").length;
  }

  function renderList(){
    const items=filtered();
    if(!items.length){document.getElementById("opportunityList").innerHTML='<div class="empty">No candidates match this customer and filter.</div>';document.getElementById("opportunityDetail").innerHTML='<p>Select a different filter.</p>';return;}
    if(!items.some((item)=>item.opportunity_id===selectedId))selectedId=items[0].opportunity_id;
    document.getElementById("opportunityList").innerHTML=items.map((item)=>`<button class="candidate ${item.opportunity_id===selectedId?"selected":""}" data-id="${safe(item.opportunity_id)}"><strong>${safe(label(item.opportunity_type))}</strong><small><span>${safe(label(item.status))}</span><span>${item.visible_to_customer_type?"Relevant":"Internal only"}</span></small><span class="status ${item.status==="NEEDS_VERIFICATION"?"needs":item.status==="READY_FOR_PROPOSAL"?"ready":""}">${safe(label(item.proposal_eligibility))}</span></button>`).join("");
    document.querySelectorAll(".candidate").forEach((button)=>button.onclick=()=>{selectedId=button.dataset.id;renderList();renderDetail();});
  }

  function basisList(items,emptyText){return items.length?`<ul>${items.map((item)=>`<li><b>${safe(item.source_id)}</b> — ${safe(item.statement)}</li>`).join("")}</ul>`:`<p>${safe(emptyText)}</p>`;}
  function stringList(items,emptyText){return items.length?`<ul>${items.map((item)=>`<li>${safe(item)}</li>`).join("")}</ul>`:`<p>${safe(emptyText)}</p>`;}

  function renderDetail(){
    const item=opportunities.find((entry)=>entry.opportunity_id===selectedId);if(!item)return;
    const type=catalog.find((entry)=>entry.code===item.opportunity_type)||{};
    const repeat=Engine.repeatPhotoRecommendation(item,[]);
    const proposalReady=item.status==="READY_FOR_PROPOSAL"&&item.proposal_eligibility==="READY_FOR_DRAFT";
    const proposalContract=proposalReady?Engine.createProposalDraftInput(item,true):null;
    document.getElementById("opportunityDetail").innerHTML=`
      <h1>${safe(type.label||label(item.opportunity_type))}</h1>
      <p><b>${safe(label(item.status))}</b> · ${safe(label(item.proposal_eligibility))} · ${item.visible_to_customer_type?"Relevant to selected customer":"Not normally shown to selected customer"}</p>
      <div class="stage-grid">
        <section class="stage"><span class="label">Observed condition</span>${basisList(item.evidence_basis,"No physical condition is being claimed by this candidate.")}</section>
        <section class="stage interpretation"><span class="label">Interpretation</span>${basisList(item.interpretation_basis,"No interpretation is required.")}</section>
        <section class="stage unknown"><span class="label">Unknown / verification</span><b>Unknowns</b>${stringList(item.unknowns,"No additional unknown is recorded.")}<b>Required verification</b>${stringList(item.required_verifications,"No required verification remains.")}</section>
        <section class="stage opportunity"><span class="label">Possible opportunity</span><p>${safe(item.customer_value_hypothesis)}</p></section>
        <section class="stage"><span class="label">Proposal eligibility</span><p>${safe(label(item.proposal_eligibility))}</p><p>${safe(item.eligible_service_codes.join(", ")||"No Property Intelligence physical-service code")}</p></section>
        <section class="stage"><span class="label">Customer decision</span><p>${["ACCEPTED","DECLINED","DEFERRED"].includes(item.status)?safe(label(item.status)):"No decision recorded"}</p></section>
      </div>
      <h2>Cheapest next investigation</h2><p class="unknown-text">${safe(item.suggested_next_investigation)}</p><p>Investigation cost: ${safe(item.estimated_investigation_cost_status)}</p>
      <h2>Customer interest — separate from physical evidence</h2><div class="separation">${basisList(item.customer_interest_basis,"No relevant customer favorite, zone selection, question, or change request is recorded.")}</div>
      <h2>Priority dimensions</h2><table class="priority-table"><thead><tr><th>Dimension</th><th>Input</th><th>Basis</th></tr></thead><tbody>${Engine.PRIORITY_DIMENSIONS.map((key)=>{const input=item.priority_inputs[key];return `<tr><td>${safe(label(key))}</td><td>${input.status==="KNOWN"?`${input.level} / 5`:"UNKNOWN"}</td><td>${safe(input.basis)}</td></tr>`;}).join("")}</tbody></table><p><b>Priority score:</b> ${item.priority_score===null?"UNKNOWN":item.priority_score} — ${safe(item.priority_explanation)}</p>
      <h2>Integration contracts</h2><div class="contract"><section><b>Proposal generator</b><p>${proposalContract?`Operator-approved draft input is permitted. Price remains <code>UNKNOWN</code>; geometry remains operator-controlled.`:`Not eligible yet. No proposal draft may be generated.`}</p></section><section><b>Repeat Photo Points</b><p>Recommendation only; no point is created automatically.</p><p>Missing phases: ${safe(repeat.missing_phases.join(", ")||"None")}</p></section></div>
      <h2>Traceable sources</h2><p>Observations: ${safe(item.source_observation_ids.join(", ")||"None")}<br>Photos: ${safe(item.source_photo_ids.join(", ")||"None")}<br>Assets: ${safe(item.source_asset_ids.join(", ")||"None")}<br>Proposal zones: ${safe(item.source_proposal_zone_ids.join(", ")||"None")}<br>Work orders: ${safe(item.source_work_order_ids.join(", ")||"None")}</p>
    `;
  }

  function render(){renderSummary();renderList();renderDetail();}
  async function start(){
    try{
      [catalog,rules]=await Promise.all([loadJson("opportunity-types.json"),loadJson("discovery-rules.json")]);
      document.getElementById("exampleStatus").textContent=baseContext.example_status;
      document.getElementById("customerType").value=baseContext.customer_type;
      document.getElementById("customerType").onchange=discover;
      document.getElementById("statusFilter").onchange=render;
      document.getElementById("visibilityFilter").onchange=render;
      discover();
    }catch(error){document.getElementById("opportunityDetail").innerHTML=`<p class="unknown-text">${safe(error.message)}</p>`;console.error(error);}
  }
  start();
})();
