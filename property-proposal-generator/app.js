(function () {
  "use strict";
  const Generator=window.PropertyProposalGenerator,input=window.PEARSON_PROPOSAL_INPUT;
  const proposal=Generator.createProposal(input);
  input.options.forEach((option)=>Generator.addOption(proposal,option));
  let selectedOptionId=proposal.options[0].option_id;
  const money=(value)=>value===null||value===undefined?"UNKNOWN":Number(value).toLocaleString("en-US",{style:"currency",currency:"USD"});
  const safe=(value)=>String(value??"UNKNOWN").replace(/[&<>\"]/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[character]);
  const download=(name,blob)=>{const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1500);};

  function showZone(option){
    selectedOptionId=option.option_id;render();
    const frame=document.getElementById("propertyMap");
    try{frame.contentWindow.PropertyMapReview?.showProposalZone(option.proposal_zone_id);}catch(_){/* Map remains usable if browser blocks frame access. */}
  }

  function saveOption(option){
    const price=document.querySelector(`[data-price="${option.option_id}"]`).value.trim();
    const validated=document.querySelector(`[data-price-valid="${option.option_id}"]`).checked;
    option.customer_selected=document.querySelector(`[data-option-selected="${option.option_id}"]`).checked;
    Generator.approveStandalonePrice(option,price,validated);
    render();
  }

  function renderOptions(){
    document.getElementById("optionEditor").innerHTML=proposal.options.map((option)=>`<article class="option-card ${option.option_id===selectedOptionId?"selected":""}"><h2>OPTION ${safe(option.option_code)} - ${safe(option.customer_title)}</h2><p class="quantity">APPROXIMATELY ${option.area_sq_ft.toLocaleString()} SQ FT / ${option.acreage.toFixed(3)} ACRE</p>${option.option_code==="A"?`<p>${option.length_ft} linear ft x ${option.width_ft} ft</p>`:""}<p><b>Work class:</b> ${safe(option.work_class)}</p><p class="unknown">${safe(option.internal_pricing.status)}</p><label><input data-option-selected="${option.option_id}" type="checkbox" ${option.customer_selected?"checked":""}> Customer selects this option</label><label>David's standalone price<input data-price="${option.option_id}" inputmode="decimal" value="${option.standalone_price??""}" placeholder="UNKNOWN"></label><label><input data-price-valid="${option.option_id}" type="checkbox" ${option.price_status==="VALIDATED"?"checked":""}> David validates this price</label><div class="row"><button type="button" data-show-zone="${option.option_id}">SHOW MAP ZONE</button><button class="primary" type="button" data-save-option="${option.option_id}">SAVE OPTION</button></div></article>`).join("");
    document.querySelectorAll("[data-show-zone]").forEach((button)=>button.onclick=()=>showZone(proposal.options.find((option)=>option.option_id===button.dataset.showZone)));
    document.querySelectorAll("[data-save-option]").forEach((button)=>button.onclick=()=>saveOption(proposal.options.find((option)=>option.option_id===button.dataset.saveOption)));
  }

  function renderPackage(){
    const summary=Generator.packageSummary(proposal);
    document.getElementById("packageEditor").innerHTML=`<article class="package-card"><h2>Complete Property Reveal Package - A + B + C + D</h2><label><input id="packageSelected" type="checkbox" ${proposal.package.selected?"checked":""}> Customer selects complete package</label><div class="row"><label>Discount method<select id="discountType"><option value="AMOUNT" ${proposal.package.discount_type!=="PERCENT"?"selected":""}>Dollar amount</option><option value="PERCENT" ${proposal.package.discount_type==="PERCENT"?"selected":""}>Percentage</option></select></label><label>Approved discount<input id="discountValue" inputmode="decimal" value="${proposal.package.discount_type==="PERCENT"?(proposal.package.discount_percent??""):(proposal.package.discount_amount??"")}" placeholder="UNKNOWN"></label></div><div class="row"><label>Minimum package price<input id="minimumPackagePrice" inputmode="decimal" value="${proposal.package.minimum_package_price??""}" placeholder="UNKNOWN"></label><label><input id="discountValidated" type="checkbox" ${proposal.package.discount_status==="VALIDATED"?"checked":""}> David validates discount</label></div><label><input id="floorOverride" type="checkbox" ${proposal.package.floor_override_approved?"checked":""}> David explicitly approves below-floor price</label><button id="savePackage" class="primary" type="button">SAVE PACKAGE PRICING</button><div class="package-math"><span>Standalone total</span><b>${money(summary.standalone_sum)}</b><span>YOU SAVE</span><b>${money(summary.package_savings)}</b><strong>PACKAGE PRICE</strong><strong>${money(summary.final_package_price)}</strong></div>${summary.warning?`<p class="unknown">${safe(summary.warning)}</p>`:""}${!summary.complete?'<p class="unknown">Package acceptance remains blocked until all four prices and the discount are validated.</p>':""}</article>`;
    document.getElementById("savePackage").onclick=()=>{const type=document.getElementById("discountType").value,value=document.getElementById("discountValue").value.trim();proposal.package.selected=document.getElementById("packageSelected").checked;Generator.setPackageDiscount(proposal,{discount_type:type,discount_percent:type==="PERCENT"?value:null,discount_amount:type==="AMOUNT"?value:null,minimum_package_price:document.getElementById("minimumPackagePrice").value.trim(),discount_status:document.getElementById("discountValidated").checked?"VALIDATED":"DRAFT",floor_override_approved:document.getElementById("floorOverride").checked});render();};
  }

  function render(){document.getElementById("proposalIdentity").textContent=`${proposal.proposal_id} v${proposal.proposal_version} - ${proposal.proposal_status}`;renderOptions();renderPackage();}
  document.getElementById("previewProposal").onclick=()=>{document.getElementById("proposalPreviewContent").innerHTML=Generator.renderCustomerProposal(proposal);document.getElementById("proposalPreview").showModal();};
  document.getElementById("closePreview").onclick=()=>document.getElementById("proposalPreview").close();
  document.getElementById("exportProposal").onclick=()=>download(`${proposal.proposal_id}_v${proposal.proposal_version}.json`,new Blob([JSON.stringify(proposal,null,2)],{type:"application/json"}));
  render();
})();
