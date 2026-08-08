(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../pearson-road-map/property-map-core.js"));
  else root.PropertyProposalGenerator = factory(root.PropertyMapCore);
})(typeof globalThis !== "undefined" ? globalThis : this, function (MapCore) {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const money = (value) => MapCore.money(value);
  const nowIso = () => new Date().toISOString();

  const SERVICE_LIBRARY = {
    "CREEK-PATH": {
      service_code: "CREEK-PATH",
      customer_title: "Creek Walk Reveal",
      production_class: "NEEDS PRODUCTION TEST",
      standard_scope: ["Selectively open a natural creek-side walking corridor, normally 3-5 feet wide.", "Preserve creek banks, roots, mature trees, and drainage."],
      preserve: ["Creek banks", "Tree roots", "Mature trees", "Existing drainage"],
      exclusions: ["No excavation", "No dredging", "No grading", "No surveyed-boundary claim"]
    },
    "WALK-PATH": {
      service_code: "WALK-PATH",
      customer_title: "Walking Connection",
      production_class: "NEEDS PRODUCTION TEST",
      standard_scope: ["Selectively open an approximately 5-foot walking connection from the mapped route."],
      preserve: ["Mature trees selected by David", "Drainage routes"],
      exclusions: ["No vehicle-access representation", "No grading", "No excavation"]
    },
    "HOMESITE-REVEAL": {
      service_code: "HOMESITE-REVEAL",
      customer_title: "Candidate Homesite Reveal",
      production_class: "NEEDS PRODUCTION TEST",
      standard_scope: ["Selectively reveal an opening among mature trees within the approved proposal geometry."],
      preserve: ["Selected mature trees", "Useful privacy screening", "Drainage evidence"],
      exclusions: ["Not a house pad", "No buildability representation", "No septic representation"]
    },
    "LIGHT-BRUSH": {
      service_code: "LIGHT-BRUSH",
      customer_title: "Light-Brush Reveal",
      production_class: "PRINCIPALLY 1-2 INCH WOODY BRUSH - FIELD VERIFICATION REQUIRED",
      standard_scope: ["Selectively cut principally 1-2 inch woody brush within the approved proposal geometry."],
      preserve: ["Selected mature trees", "Vegetation outside the approved geometry"],
      exclusions: ["No root removal", "No stump grubbing", "No grading"]
    },
    "HEAVY-BRUSH": {
      service_code: "HEAVY-BRUSH",
      customer_title: "Heavy-Brush Reveal",
      production_class: "PRINCIPALLY 3-4 INCH WOODY BRUSH - FIELD VERIFICATION REQUIRED",
      standard_scope: ["Selectively cut principally 3-4 inch woody brush within the approved proposal geometry."],
      preserve: ["Selected mature trees", "Vegetation outside the approved geometry", "Drainage evidence"],
      exclusions: ["No root removal", "No stump grubbing", "No grading", "Does not create finished pasture"]
    },
    "VIEW-REVEAL": {
      service_code: "VIEW-REVEAL",
      customer_title: "Selective View Reveal",
      production_class: "NEEDS PRODUCTION TEST",
      standard_scope: ["Open a selective view window in the approved direction."],
      preserve: ["Selected framing trees", "Vegetation outside separately approved clearing geometry"],
      exclusions: ["A directional sightline is not clearing area", "Only separately drawn and approved geometry counts toward treatment area"]
    }
  };

  const STANDARD_CLAUSES = [
    { clause_id: "EVIDENCE_PROPOSAL", title: "Evidence and proposal", text: "Field evidence and proposal geometry remain separate. A proposed work area does not rewrite an observation or photograph." },
    { clause_id: "NOT_SURVEY", title: "Approximate map", text: "All mapped quantities are approximate and are not a survey." },
    { clause_id: "NO_SITE_GUARANTEE", title: "Professional limitations", text: "No buildability, septic, wetland, drainage, engineering, or regulatory approval is represented." },
    { clause_id: "DEBRIS", title: "Debris handling", text: "Debris handling follows the accepted option and any separately approved upgrade." },
    { clause_id: "CHANGE_ORDER", title: "Changes", text: "Work outside the frozen accepted geometry or scope requires a written change order or a new proposal version." },
    { clause_id: "SAFETY", title: "Safety", text: "Work may be paused or rescheduled when weather, water, access, or site conditions are unsafe." },
    { clause_id: "DOCUMENTATION", title: "Documentation", text: "Before and after photographs document visible conditions; they do not prove hidden conditions or causation." },
    { clause_id: "PACKAGE", title: "Package pricing", text: "Package savings apply only when the complete stated package is accepted as one proposal." },
    { clause_id: "VERSION_FREEZE", title: "Acceptance", text: "Acceptance freezes the proposal version, selected options, geometry, prices, discount, and payment terms." }
  ];

  function createProposal(input) {
    if (!input || !input.property_id) throw new Error("property_id is required.");
    return {
      schema_name: "property-intelligence-proposal",
      schema_version: 1,
      property_id: input.property_id,
      proposal_id: input.proposal_id || `${input.property_id}-PROPOSAL-001`,
      proposal_version: Number(input.proposal_version || 1),
      proposal_status: input.proposal_status || "DRAFT",
      customer: clone(input.customer || { name: "UNKNOWN" }),
      property: clone(input.property || { name: "UNKNOWN" }),
      map_url: input.map_url || "UNKNOWN",
      options: [],
      package: { selected: false, standalone_total: null, discount_type: "AMOUNT", discount_percent: null, discount_amount: null, savings: null, package_price: null, discount_status: "DRAFT", minimum_package_price: null, floor_override_approved: false },
      payment: clone(input.payment || { status: "DRAFT", terms: "UNKNOWN" }),
      acceptance: null,
      version_history: [{ proposal_version: Number(input.proposal_version || 1), changed_at: nowIso(), reason: "PROPOSAL CREATED" }],
      standard_clause_ids: STANDARD_CLAUSES.map((item) => item.clause_id),
      evidence_rule: "EVIDENCE != PROPOSAL",
      created_at: nowIso(),
      updated_at: nowIso()
    };
  }

  function calculateMeasurements(option) {
    const geometry = option.geometry;
    if (!geometry) return { measurement_status: "UNKNOWN" };
    if (geometry.type === "LineString") {
      const length = MapCore.lineLengthFeet(geometry.coordinates);
      const width = Number(option.width_ft);
      const area = Number.isFinite(length) && Number.isFinite(width) ? length * width : null;
      return {
        measurement_status: area === null ? "UNKNOWN" : "APPROXIMATE",
        length_ft: Number.isFinite(length) ? Math.round(length * 10) / 10 : null,
        width_ft: Number.isFinite(width) ? width : null,
        area_sq_ft: area === null ? null : Math.round(area),
        acreage: area === null ? null : Number((area / 43560).toFixed(3)),
        perimeter_ft: null,
        measurement_basis: "APPROXIMATE FROM EDITABLE PROPOSAL GEOMETRY - NOT A SURVEY"
      };
    }
    const feature = { type: "Feature", geometry: clone(geometry), properties: { option_code: option.option_code, proposal_template: option.proposal_template, editable_centerline: option.editable_centerline, corridor_width_ft: option.width_ft, sunset_view_sightline: option.sunset_view_sightline, sunset_view_target_width_ft: option.sunset_view_target_width_ft } };
    const quantities = MapCore.proposalQuantities(feature) || {};
    return {
      measurement_status: quantities.area_sq_ft === undefined ? "UNKNOWN" : "APPROXIMATE",
      length_ft: quantities.approx_length_ft ?? null,
      width_ft: quantities.approx_width_ft ?? null,
      area_sq_ft: quantities.area_sq_ft ?? null,
      acreage: quantities.acreage ?? null,
      perimeter_ft: quantities.perimeter_ft ?? null,
      components: clone(quantities.components || []),
      measurement_basis: quantities.basis || "APPROXIMATE - NOT A SURVEY"
    };
  }

  function addOption(proposal, input) {
    const service = SERVICE_LIBRARY[input.service_code];
    if (!service) throw new Error(`Unknown service code: ${input.service_code}`);
    if (!input.option_id || !input.proposal_zone_id || !input.geometry) throw new Error("option_id, proposal_zone_id, and geometry are required.");
    const option = {
      option_id: input.option_id,
      option_code: input.option_code || input.option_id,
      proposal_zone_id: input.proposal_zone_id,
      proposal_template: input.proposal_template || null,
      service_code: input.service_code,
      customer_title: input.customer_title || service.customer_title,
      geometry: clone(input.geometry),
      measurement_basis: "APPROXIMATE - NOT A SURVEY",
      length_ft: null,
      width_ft: input.width_ft ?? null,
      area_sq_ft: null,
      acreage: null,
      perimeter_ft: null,
      work_class: input.work_class || service.production_class,
      production_class: input.production_class || service.production_class,
      standard_scope: clone(service.standard_scope),
      property_specific_scope: clone(input.property_specific_scope || []),
      preserve: clone(input.preserve || service.preserve),
      exclusions: clone(input.exclusions || service.exclusions),
      before_photo_ids: clone(input.before_photo_ids || []),
      repeat_photo_point_ids: clone(input.repeat_photo_point_ids || []),
      standalone_price: null,
      price_status: "DRAFT",
      customer_selected: false,
      package_included: Boolean(input.package_included),
      directional_only: Boolean(input.directional_only),
      editable_centerline: clone(input.editable_centerline || null),
      sunset_view_sightline: clone(input.sunset_view_sightline || null),
      sunset_view_target_width_ft: input.sunset_view_target_width_ft ?? null,
      internal_pricing: { status: "NEEDS_PRODUCTION_TEST", known_direct_cost: null, unknown_cost_components: [], proposed_sell_price: null, expected_gross_dollars: null }
    };
    Object.assign(option, calculateMeasurements(option));
    proposal.options.push(option);
    proposal.updated_at = nowIso();
    return option;
  }

  function recalculateOption(option) {
    const before = { length_ft: option.length_ft, width_ft: option.width_ft, area_sq_ft: option.area_sq_ft, acreage: option.acreage, perimeter_ft: option.perimeter_ft };
    Object.assign(option, calculateMeasurements(option));
    return { before, after: { length_ft: option.length_ft, width_ft: option.width_ft, area_sq_ft: option.area_sq_ft, acreage: option.acreage, perimeter_ft: option.perimeter_ft } };
  }

  function calculateInternalPricing(option, input) {
    const names = ["crew_lead_labor", "helper_labor", "payroll_employer_burden", "equipment", "fuel_consumables", "mobilization", "debris_handling", "documentation_mapping", "contingency", "other_direct_cost"];
    const known = {}, unknown = [];
    names.forEach((name) => { const value = money(input && input[name]); if (value === null) unknown.push(name); else known[name] = value; });
    const knownDirectCost = Math.round(Object.values(known).reduce((sum, value) => sum + value, 0) * 100) / 100;
    const targetMarginPercent = money(input && input.target_margin_percent);
    const minimumJobProfit = money(input && input.minimum_job_profit);
    const costFloor = unknown.length ? null : knownDirectCost;
    const marginPrice = costFloor === null || targetMarginPercent === null || targetMarginPercent >= 100 ? null : costFloor / (1 - targetMarginPercent / 100);
    const profitPrice = costFloor === null || minimumJobProfit === null ? null : costFloor + minimumJobProfit;
    const minimumApprovedPrice = marginPrice === null || profitPrice === null ? null : Math.round(Math.max(marginPrice, profitPrice) * 100) / 100;
    option.internal_pricing = {
      status: unknown.length ? "NEEDS_PRODUCTION_TEST" : "CALCULATED_FROM_OPERATOR_INPUT",
      pricing_crew_model: clone(input && input.pricing_crew_model || { name: "David + 1 helper" }),
      known_cost_components: known,
      unknown_cost_components: unknown,
      known_direct_cost: knownDirectCost,
      cost_floor: costFloor,
      target_margin_percent: targetMarginPercent,
      minimum_job_profit: minimumJobProfit,
      minimum_approved_price: minimumApprovedPrice,
      proposed_sell_price: money(option.standalone_price),
      expected_gross_dollars: money(option.standalone_price) === null || costFloor === null ? null : Math.round((money(option.standalone_price) - costFloor) * 100) / 100
    };
    return option.internal_pricing;
  }

  function approveStandalonePrice(option, price, approved) {
    const value = money(price);
    option.standalone_price = value;
    option.price_status = value !== null && approved ? "VALIDATED" : "DRAFT";
    if (option.internal_pricing) option.internal_pricing.proposed_sell_price = value;
    return option;
  }

  function packageSummary(proposal) {
    const zones = proposal.options.map((option) => ({ id: option.proposal_zone_id, properties: { option_code: option.option_code, price: option.standalone_price, minimum_approved_price: option.internal_pricing && option.internal_pricing.minimum_approved_price } }));
    return MapCore.proposalPackageSummary(zones, proposal.package);
  }

  function setPackageDiscount(proposal, input) {
    proposal.package = { ...proposal.package, ...clone(input || {}) };
    const summary = packageSummary(proposal);
    Object.assign(proposal.package, {
      standalone_total: summary.standalone_sum,
      discount_amount: summary.discount_amount,
      savings: summary.package_savings,
      package_price: summary.final_package_price,
      warning: summary.warning,
      complete: summary.complete
    });
    return summary;
  }

  function materialUpdate(proposal, reason) {
    proposal.proposal_version += 1;
    proposal.proposal_status = "DRAFT";
    proposal.updated_at = nowIso();
    proposal.version_history.push({ proposal_version: proposal.proposal_version, changed_at: proposal.updated_at, reason: reason || "MATERIAL CUSTOMER-FACING CHANGE" });
    return proposal.proposal_version;
  }

  function acceptProposal(proposal, acceptedBy) {
    const selected = proposal.package.selected ? proposal.options : proposal.options.filter((option) => option.customer_selected);
    if (!selected.length) throw new Error("At least one proposal option must be selected.");
    const unpriced = selected.filter((option) => money(option.standalone_price) === null || option.price_status !== "VALIDATED");
    if (unpriced.length) throw new Error("Every selected option needs David's validated standalone price.");
    const summary = packageSummary(proposal);
    if (proposal.package.selected && !summary.complete) throw new Error("The package discount, required pricing, and any margin-floor warning must be resolved before acceptance.");
    proposal.acceptance = {
      accepted_at: nowIso(),
      accepted_by: acceptedBy || "Customer",
      proposal_id: proposal.proposal_id,
      proposal_version: proposal.proposal_version,
      selected_option_ids: selected.map((option) => option.option_id),
      accepted_geometry: selected.map((option) => ({ option_id: option.option_id, proposal_zone_id: option.proposal_zone_id, geometry: clone(option.geometry) })),
      accepted_prices: selected.map((option) => ({ option_id: option.option_id, standalone_price: option.standalone_price })),
      package: proposal.package.selected ? clone(summary) : null,
      payment: clone(proposal.payment),
      immutable: true
    };
    proposal.proposal_status = "ACCEPTED";
    return clone(proposal.acceptance);
  }

  function renderCustomerProposal(proposal) {
    const esc = (value) => String(value ?? "UNKNOWN").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character]);
    const selected = proposal.options;
    const summary = packageSummary(proposal);
    const optionHtml = selected.map((option) => `<article data-proposal-zone-id="${esc(option.proposal_zone_id)}"><h3>OPTION ${esc(option.option_code)} - ${esc(option.customer_title)}</h3><p>Approximate quantity: ${option.area_sq_ft === null ? "UNKNOWN" : `${Number(option.area_sq_ft).toLocaleString()} sq ft / ${Number(option.acreage).toFixed(3)} acre`}</p><p>Work class: ${esc(option.work_class)}</p><p>${option.standard_scope.map(esc).join(" ")}</p><p>Preserve: ${option.preserve.map(esc).join("; ")}</p><p>Limits: ${option.exclusions.map(esc).join("; ")}</p><p>Standalone price: ${option.standalone_price === null ? "UNKNOWN" : `$${Number(option.standalone_price).toFixed(2)}`}</p><label><input type="checkbox" data-option-id="${esc(option.option_id)}"> ACCEPT OPTION ${esc(option.option_code)}</label></article>`).join("");
    return `<main data-proposal-id="${esc(proposal.proposal_id)}" data-proposal-version="${esc(proposal.proposal_version)}"><section class="proposal-page"><h1>${esc(proposal.property.name)} Property Reveal Proposal</h1><p>Customer: ${esc(proposal.customer.name)}</p><p>Proposal: ${esc(proposal.proposal_id)} v${esc(proposal.proposal_version)}</p><p>Interactive map: ${esc(proposal.map_url)}</p><p>APPROXIMATE - NOT A SURVEY</p></section><section class="proposal-page">${optionHtml}</section><section class="proposal-page"><h2>Complete Property Reveal Package</h2><p>Standalone total: ${summary.standalone_sum === null ? "UNKNOWN" : `$${summary.standalone_sum.toFixed(2)}`}</p><p>Package savings: ${summary.package_savings === null ? "UNKNOWN" : `$${summary.package_savings.toFixed(2)}`}</p><p>Package price: ${summary.final_package_price === null ? "UNKNOWN" : `$${summary.final_package_price.toFixed(2)}`}</p><h2>Standard terms</h2>${STANDARD_CLAUSES.map((clause) => `<p><b>${esc(clause.title)}:</b> ${esc(clause.text)}</p>`).join("")}<button type="button" data-action="ASK_QUESTION">ASK A QUESTION</button><button type="button" data-action="REQUEST_CHANGE">REQUEST A CHANGE</button><button type="button" data-action="ACCEPT_PROPOSAL" ${selected.some((option) => option.standalone_price === null) ? "disabled" : ""}>ACCEPT PROPOSAL</button></section></main>`;
  }

  return { SERVICE_LIBRARY, STANDARD_CLAUSES, createProposal, addOption, calculateMeasurements, recalculateOption, calculateInternalPricing, approveStandalonePrice, packageSummary, setPackageDiscount, materialUpdate, acceptProposal, renderCustomerProposal };
});
