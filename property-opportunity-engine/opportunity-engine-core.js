(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PropertyOpportunityEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATUS = ["DISCOVERED","NEEDS_VERIFICATION","READY_FOR_PROPOSAL","PROPOSED","ACCEPTED","DECLINED","DEFERRED","COMPLETED","MONITORING"];
  const CUSTOMER_TYPES = ["SELLER_LISTING_AGENT","BUYER","BUILDER","OWNER"];
  const PRIORITY_DIMENSIONS = ["customer_relevance","evidence_strength","uncertainty_reduction","likely_customer_benefit","estimated_implementation_effort","potential_gross_margin_class","repeat_recurring_potential","data_learning_value","urgency_safety"];
  const TRANSITIONS = {
    DISCOVERED: ["NEEDS_VERIFICATION","READY_FOR_PROPOSAL","DEFERRED","DECLINED"],
    NEEDS_VERIFICATION: ["READY_FOR_PROPOSAL","DEFERRED","DECLINED"],
    READY_FOR_PROPOSAL: ["PROPOSED","DEFERRED","DECLINED"],
    PROPOSED: ["ACCEPTED","DECLINED","DEFERRED"],
    ACCEPTED: ["COMPLETED","DEFERRED"],
    COMPLETED: ["MONITORING"],
    MONITORING: ["COMPLETED","DEFERRED"],
    DECLINED: [],
    DEFERRED: ["NEEDS_VERIFICATION","READY_FOR_PROPOSAL","DECLINED"]
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const list = (value) => Array.isArray(value) ? value : [];
  const unique = (values) => [...new Set(list(values).filter(Boolean))];
  const now = (clock) => typeof clock === "function" ? clock() : new Date().toISOString();
  const idPart = (value) => String(value || "UNKNOWN").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").toUpperCase();
  const hasTag = (record, tag) => list(record?.tags).includes(tag);
  const recordsWithTag = (records, tag) => list(records).filter((record) => hasTag(record, tag));
  const basis = (informationClass, record, statement) => ({
    information_class: informationClass,
    source_id: record.id,
    statement,
    source_record_type: record.record_type || informationClass
  });

  function ordinal(level, basisText) {
    if (level === null || level === undefined || level === "UNKNOWN") return { status: "UNKNOWN", level: null, basis: basisText || "Not established." };
    const value = Math.max(1,Math.min(5,Number(level)));
    return { status: "KNOWN", level: value, basis: basisText || "Traceable rule input." };
  }

  function emptyPriority() {
    return Object.fromEntries(PRIORITY_DIMENSIONS.map((key) => [key, ordinal("UNKNOWN")]));
  }

  function normalizePriority(input) {
    const result = emptyPriority();
    Object.entries(input || {}).forEach(([key,value]) => {
      if (!PRIORITY_DIMENSIONS.includes(key)) return;
      result[key] = value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value,"status") ? clone(value) : ordinal(value);
    });
    return result;
  }

  function priorityResult(inputs) {
    const values = PRIORITY_DIMENSIONS.map((key) => inputs[key]).filter((entry) => entry?.status === "KNOWN" && Number.isFinite(entry.level));
    const complete = values.length === PRIORITY_DIMENSIONS.length;
    return {
      score: complete ? Number((values.reduce((sum,entry) => sum + entry.level,0) / values.length).toFixed(2)) : null,
      explanation: complete
        ? "All nine disclosed priority dimensions are known; the displayed score is their unweighted review average, not ROI."
        : `${values.length} of ${PRIORITY_DIMENSIONS.length} priority dimensions are known. No single score is produced because unknown inputs remain UNKNOWN.`
    };
  }

  function typeRecord(catalog, code) {
    return list(catalog).find((entry) => entry.code === code) || { code, label: code, eligible_service_codes: [], customer_types: CUSTOMER_TYPES };
  }

  function customerRelevance(type, customerType) {
    const visible = list(type.customer_types).includes(customerType);
    return {
      visible,
      priority: visible ? ordinal(4,`${type.label} is configured as relevant to ${customerType}.`) : ordinal(1,`${type.label} is not normally shown to ${customerType}.`)
    };
  }

  function createOpportunity(input, options) {
    const clock = options?.clock;
    const createdAt = input.created_at || now(clock);
    const requiredVerifications = unique(input.required_verifications);
    const status = input.status || (requiredVerifications.length ? "NEEDS_VERIFICATION" : "READY_FOR_PROPOSAL");
    const eligibility = input.proposal_eligibility || (status === "READY_FOR_PROPOSAL" ? "READY_FOR_DRAFT" : status === "NEEDS_VERIFICATION" ? "NEEDS_VERIFICATION" : "NOT_ELIGIBLE");
    const priorityInputs = normalizePriority(input.priority_inputs);
    const priority = priorityResult(priorityInputs);
    const opportunity = {
      opportunity_id: input.opportunity_id,
      property_id: input.property_id,
      created_at: createdAt,
      opportunity_type: input.opportunity_type,
      customer_need: input.customer_need || "UNKNOWN",
      customer_type: input.customer_type,
      source_observation_ids: unique(input.source_observation_ids),
      source_photo_ids: unique(input.source_photo_ids),
      source_asset_ids: unique(input.source_asset_ids),
      source_proposal_zone_ids: unique(input.source_proposal_zone_ids),
      source_work_order_ids: unique(input.source_work_order_ids),
      source_customer_interaction_ids: unique(input.source_customer_interaction_ids),
      evidence_basis: clone(list(input.evidence_basis)),
      interpretation_basis: clone(list(input.interpretation_basis)),
      customer_interest_basis: clone(list(input.customer_interest_basis)),
      unknowns: unique(input.unknowns),
      required_verifications: requiredVerifications,
      suggested_next_investigation: input.suggested_next_investigation || "UNKNOWN",
      estimated_investigation_cost_status: input.estimated_investigation_cost_status || "UNKNOWN",
      eligible_service_codes: unique(input.eligible_service_codes),
      proposal_eligibility: eligibility,
      priority_inputs: priorityInputs,
      priority_score: priority.score,
      priority_explanation: priority.explanation,
      customer_value_hypothesis: input.customer_value_hypothesis || "UNKNOWN — HYPOTHESIS NOT ESTABLISHED",
      business_value_hypothesis: input.business_value_hypothesis || "UNKNOWN — HYPOTHESIS NOT ESTABLISHED",
      status,
      visible_to_customer_type: input.visible_to_customer_type !== false,
      discovery_rule_ids: unique(input.discovery_rule_ids),
      history: [{
        event_id: `${input.opportunity_id}-EVENT-001`,
        occurred_at: createdAt,
        action: "OPPORTUNITY_DISCOVERED",
        status_from: null,
        status_to: status,
        source_ids: unique([...(input.source_observation_ids || []),...(input.source_photo_ids || []),...(input.source_asset_ids || [])]),
        note: "Candidate created from traceable rule inputs."
      }]
    };
    validateSeparation(opportunity);
    return opportunity;
  }

  function validateSeparation(opportunity) {
    const customerIds = new Set(opportunity.source_customer_interaction_ids || []);
    const physicalIds = new Set([...(opportunity.source_observation_ids || []),...(opportunity.source_photo_ids || []),...(opportunity.source_asset_ids || []),...(opportunity.source_work_order_ids || [])]);
    for (const item of opportunity.evidence_basis || []) {
      if (item.information_class === "CUSTOMER_INTEREST" || customerIds.has(item.source_id)) throw new Error("Customer behavior cannot be stored as physical evidence basis.");
    }
    for (const item of opportunity.customer_interest_basis || []) {
      if (item.information_class !== "CUSTOMER_INTEREST") throw new Error("Customer-interest priority inputs must remain labeled CUSTOMER_INTEREST.");
      if (physicalIds.has(item.source_id)) throw new Error("Physical evidence cannot be relabeled as customer behavior.");
    }
    return true;
  }

  function ruleByType(rules, opportunityType) {
    return list(rules).find((rule) => rule.opportunity_type === opportunityType) || null;
  }

  function ids(records) { return unique(records.map((record) => record.id)); }
  function interpretation(record, statement) { return basis("INTERPRETATION",record,statement); }

  function relatedInteractions(context, photoIds, zoneIds) {
    const photoSet = new Set(photoIds);
    const zoneSet = new Set(zoneIds);
    return list(context.customer_interactions).filter((interaction) => photoSet.has(interaction.photo_id) || zoneSet.has(interaction.proposal_zone_id));
  }

  function interestPriority(interactions) {
    if (!interactions.length) return ordinal("UNKNOWN","No relevant customer interaction has been recorded.");
    return ordinal(Math.min(5,2 + interactions.length),`${interactions.length} separate customer interaction(s) relate to this candidate. This affects interest priority only.`);
  }

  function candidate(input, context, catalog, rules, sequence) {
    const type = typeRecord(catalog,input.opportunity_type);
    const relevance = customerRelevance(type,context.customer_type);
    const explicitInteractionIds = new Set(list(input.source_customer_interaction_ids));
    const interactions = uniqueRecords([...relatedInteractions(context,input.source_photo_ids || [],input.source_proposal_zone_ids || []),...list(context.customer_interactions).filter((record)=>explicitInteractionIds.has(record.id))]);
    const physicalStrength = input.evidence_basis?.length ? Math.min(5,2 + input.evidence_basis.length) : "UNKNOWN";
    const unknownCount = list(input.required_verifications).length;
    const rule = ruleByType(rules,input.opportunity_type);
    const suggestedInvestigation = input.suggested_next_investigation || rule?.cheapest_next_investigation || "UNKNOWN";
    const priorityInputs = {
      customer_relevance: relevance.priority,
      evidence_strength: ordinal(physicalStrength,input.evidence_basis?.length ? `${input.evidence_basis.length} physical evidence basis record(s) are linked.` : "Physical evidence strength is not established."),
      uncertainty_reduction: ordinal(suggestedInvestigation !== "UNKNOWN" && unknownCount ? 4 : unknownCount ? "UNKNOWN" : 3,unknownCount ? "A specific next investigation could resolve a stated verification need." : "No required verification is currently recorded."),
      likely_customer_benefit: input.customer_benefit_level ? ordinal(input.customer_benefit_level,"Candidate-specific hypothesis; not a value-increase fact.") : interestPriority(interactions),
      estimated_implementation_effort: input.implementation_effort_level ? ordinal(input.implementation_effort_level,"Planning estimate for review; not a production rate.") : ordinal("UNKNOWN"),
      potential_gross_margin_class: ordinal("UNKNOWN","No validated cost and sell-price evidence is available."),
      repeat_recurring_potential: input.recurring_level ? ordinal(input.recurring_level,"Rule indicates a legitimate repeat or monitoring use.") : ordinal("UNKNOWN"),
      data_learning_value: ordinal(input.learning_level || 3,"Structured follow-through would improve the historical dataset."),
      urgency_safety: input.urgency_level ? ordinal(input.urgency_level,"Safety or time-sensitive rule input is present.") : ordinal("UNKNOWN")
    };
    return createOpportunity({
      ...input,
      opportunity_id: input.opportunity_id || `OPP-${idPart(context.property_id)}-${String(sequence).padStart(3,"0")}`,
      property_id: context.property_id,
      customer_type: context.customer_type,
      eligible_service_codes: input.eligible_service_codes || type.eligible_service_codes,
      source_customer_interaction_ids: ids(interactions),
      customer_interest_basis: interactions.map((record) => basis("CUSTOMER_INTEREST",record,`${record.interaction_type} indicates interest; it does not prove a property condition.`)),
      priority_inputs: priorityInputs,
      visible_to_customer_type: relevance.visible,
      suggested_next_investigation: suggestedInvestigation,
      discovery_rule_ids: unique([...(input.discovery_rule_ids || []),rule?.rule_id])
    },{ clock: context.clock });
  }

  function uniqueRecords(records) {
    const seen = new Set();
    return records.filter((record)=>record?.id&&!seen.has(record.id)&&seen.add(record.id));
  }

  function discoverOpportunities(context, catalog, rules) {
    if (!context?.property_id) throw new Error("property_id is required.");
    if (!CUSTOMER_TYPES.includes(context.customer_type)) throw new Error("A supported customer_type is required.");
    const observations = list(context.observations);
    const photos = list(context.photos);
    const assets = list(context.assets);
    const zones = list(context.proposal_zones);
    const workOrders = list(context.work_orders);
    const events = list(context.events);
    const candidates = [];
    const push = (input) => candidates.push(candidate(input,context,catalog,rules,candidates.length + 1));

    const water = recordsWithTag(observations,"RECORDED_WATER_FEATURE");
    const waterPhotos = photos.filter((photo) => hasTag(photo,"WATER"));
    const obstructedWater = water.filter((record) => hasTag(record,"OBSTRUCTED_ACCESS_OR_VIEW"));
    if (water.length && obstructedWater.length) push({
      opportunity_type:"CREEK_WATER_FEATURE_REVEAL",
      customer_need:"Understand and safely experience a recorded water feature.",
      source_observation_ids:ids(water),source_photo_ids:ids(waterPhotos),
      evidence_basis:[...water.map((record)=>basis("OBSERVED_CONDITION",record,"Recorded water feature.")),...obstructedWater.map((record)=>basis("OBSERVED_CONDITION",record,"Physical or visual access was recorded as obstructed."))],
      interpretation_basis:[interpretation(obstructedWater[0],"Selective access or view work may make the recorded feature easier to understand.")],
      unknowns:["Regulatory status and permissible work near the water are not established."],
      required_verifications:["Confirm a safe, permissible reveal limit that does not disturb the channel."],
      customer_value_hypothesis:"A safer, clearer view may help a customer understand the recorded water feature; no property-value increase is claimed.",
      business_value_hypothesis:"A bounded reveal may be a service candidate after scope verification.",customer_benefit_level:4,implementation_effort_level:3,learning_level:4
    });

    for (const spec of [
      { tag:"BRUSH_1_2_INCH",type:"LIGHT_BRUSH_REVEAL",label:"principally 1–2 inch brush",investigation:"Measure representative 1–2 inch brush density and a small production-test area." },
      { tag:"BRUSH_3_4_INCH",type:"HEAVY_BRUSH_REVEAL",label:"principally 3–4 inch woody brush",investigation:"Measure representative 3–4 inch brush density and production rate." }
    ]) {
      const brush = recordsWithTag(observations,spec.tag);
      const relevantZones = zones.filter((zone)=>hasTag(zone,"RELEVANT_USE_AREA") && (list(zone.source_observation_ids).some((id)=>brush.some((record)=>record.id===id)) || hasTag(zone,spec.tag)));
      if (brush.length && relevantZones.length) push({
        opportunity_type:spec.type,customer_need:"Reveal a customer-relevant use area without overstating the finished condition.",
        source_observation_ids:ids(brush),source_proposal_zone_ids:ids(relevantZones),
        evidence_basis:brush.map((record)=>basis("OBSERVED_CONDITION",record,`Recorded ${spec.label}.`)),
        interpretation_basis:[interpretation(relevantZones[0],"The recorded brush overlaps or relates to a candidate use area.")],
        unknowns:["Representative production rate and direct cost are unknown."],required_verifications:[spec.investigation],suggested_next_investigation:spec.investigation,
        customer_value_hypothesis:"Selective brush removal may make the candidate use area easier to evaluate; it does not create finished pasture or a build-ready site.",
        business_value_hypothesis:"A measurable brush-reveal service may be proposal-eligible after production verification.",customer_benefit_level:4,implementation_effort_level:spec.type==="HEAVY_BRUSH_REVEAL"?4:3,learning_level:5
      });
    }

    const homesites = zones.filter((zone)=>hasTag(zone,"CANDIDATE_USE_AREA"));
    const obstructing = recordsWithTag(observations,"OBSTRUCTING_VEGETATION");
    if (homesites.length && obstructing.length) push({
      opportunity_type:"HOMESITE_USE_AREA_REVEAL",customer_need:"Understand a candidate use area while preserving selected mature trees.",
      source_observation_ids:ids(obstructing),source_proposal_zone_ids:ids(homesites),
      evidence_basis:obstructing.map((record)=>basis("OBSERVED_CONDITION",record,"Obstructing vegetation was recorded.")),
      interpretation_basis:homesites.map((zone)=>interpretation(zone,"A mapped candidate use area exists; buildability is not established.")),
      unknowns:["Buildability, septic suitability, setbacks, wetlands, and final clearing scope are not established."],
      required_verifications:homesites.some((zone)=>zone.geometry_status==="APPROVED_FOR_DRAFT")?[]:["Confirm the proposed reveal boundary and preserve-tree choices in the field."],
      customer_value_hypothesis:"A selective reveal may help the customer understand the candidate area; it is not a buildability opinion.",
      business_value_hypothesis:"A bounded homesite/use-area reveal may become a proposal option after operator review.",customer_benefit_level:4,implementation_effort_level:3,learning_level:4
    });

    const accessZones = zones.filter((zone)=>hasTag(zone,"CANDIDATE_ACCESS_CORRIDOR"));
    accessZones.forEach((zone)=>{
      const lengthUnknown = zone.length_ft === null || zone.length_ft === undefined || zone.measurement_status === "TBD";
      push({opportunity_type:"WALKING_PATH_ACCESS_REVEAL",customer_need:"Create understandable walking access to a documented feature or use area.",source_proposal_zone_ids:[zone.id],
        evidence_basis:[],interpretation_basis:[interpretation(zone,"A candidate access corridor has been identified in proposal geometry.")],unknowns:lengthUnknown?["Corridor length is unknown."]:[],required_verifications:lengthUnknown?["Walk and measure the unverified corridor before assigning length or price."]:[],
        suggested_next_investigation:lengthUnknown?"Walk and measure the unvisited access corridor.":"Confirm path width and preserve limits before proposal conversion.",
        customer_value_hypothesis:"A walkable connection may improve understanding and access; final feasibility is not established.",business_value_hypothesis:"A measured path may become a proposal option.",customer_benefit_level:4,implementation_effort_level:"UNKNOWN",learning_level:4});
    });

    const viewZones = zones.filter((zone)=>hasTag(zone,"VIEW_DIRECTION"));
    if (viewZones.length && obstructing.length) push({opportunity_type:"VIEW_SUNSET_REVEAL",customer_need:"Evaluate a selective view window from a documented candidate area.",source_observation_ids:ids(obstructing),source_proposal_zone_ids:ids(viewZones),
      evidence_basis:obstructing.map((record)=>basis("OBSERVED_CONDITION",record,"Vegetation obstructs the proposed view direction.")),interpretation_basis:viewZones.map((zone)=>interpretation(zone,"A view direction is mapped; clearing width and outcome are not established.")),
      unknowns:["The useful view width and trees to preserve are not field-confirmed."],required_verifications:["Stand at the intended viewing point near sunset and mark the narrowest useful selective view window."],
      customer_value_hypothesis:"A selective view may improve the experience of the candidate area; no value increase is claimed.",business_value_hypothesis:"A bounded view reveal may become an optional service.",customer_benefit_level:3,implementation_effort_level:"UNKNOWN",learning_level:4});

    const matureTrees = recordsWithTag(observations,"IMPORTANT_MATURE_TREES");
    const clearingZones = zones.filter((zone)=>hasTag(zone,"PROPOSED_CLEARING_GEOMETRY"));
    if (matureTrees.length && clearingZones.length) push({opportunity_type:"TREE_PRESERVATION_SELECTIVE_CLEARING",customer_need:"Preserve important mature trees while reviewing proposed clearing.",source_observation_ids:ids(matureTrees),source_proposal_zone_ids:ids(clearingZones),
      evidence_basis:matureTrees.map((record)=>basis("OBSERVED_CONDITION",record,"Important mature trees were recorded.")),interpretation_basis:clearingZones.map((zone)=>interpretation(zone,"Proposed clearing geometry could affect recorded mature trees.")),
      unknowns:["Final preserve/remove decisions are not established."],required_verifications:["Mark the trees to preserve before any cutting begins."],
      customer_value_hypothesis:"Advance marking may reduce accidental removal and preserve intended character.",business_value_hypothesis:"Tree-marking can improve scope clarity but is not a forester opinion.",customer_benefit_level:5,implementation_effort_level:2,learning_level:3});

    const completed = workOrders.filter((work)=>work.status==="COMPLETED");
    const missingAfter = completed.filter((work)=>!list(work.after_photo_ids).length);
    if (missingAfter.length) push({opportunity_type:"REPEAT_PHOTO_MONITORING",customer_need:"Complete the visual record of finished work.",source_work_order_ids:ids(missingAfter),source_proposal_zone_ids:unique(missingAfter.flatMap((work)=>work.proposal_zone_ids||[])),
      evidence_basis:missingAfter.map((work)=>basis("WORK_RECORD",work,"Work is recorded complete but AFTER evidence is missing.")),interpretation_basis:[],unknowns:["Visible completed condition is not documented from the repeatable view."],required_verifications:["Capture AFTER evidence at the same permanent photo point."],
      customer_value_hypothesis:"Matched AFTER evidence may help the customer understand what changed.",business_value_hypothesis:"Complete before/after records support honest case-study and maintenance review.",customer_benefit_level:4,implementation_effort_level:1,recurring_level:4,learning_level:5});

    const remainingRevealZones = zones.filter((zone)=>hasTag(zone,"ADDITIONAL_REVEAL_CANDIDATE")&&!completed.some((work)=>list(work.proposal_zone_ids).includes(zone.id)));
    if (completed.length && remainingRevealZones.length) push({opportunity_type:"ADDITIONAL_REVEAL_WORK",customer_need:"Review a separate remaining reveal area after learning from completed work.",source_work_order_ids:ids(completed),source_proposal_zone_ids:ids(remainingRevealZones),
      evidence_basis:completed.map((work)=>basis("WORK_RECORD",work,"A separate physical reveal is recorded complete.")),interpretation_basis:remainingRevealZones.map((zone)=>interpretation(zone,"A separate candidate reveal area remains; it is not included in completed work.")),
      unknowns:["Current condition, customer priority, and production scope for the remaining area are unknown."],required_verifications:["Inspect the remaining candidate area and confirm that it is still the next useful bounded reveal."],
      customer_value_hypothesis:"A separate reveal may be useful if the customer still values that area after reviewing completed work.",business_value_hypothesis:"Additional work is a candidate only; it is not included or scheduled automatically.",customer_benefit_level:3,implementation_effort_level:"UNKNOWN",recurring_level:3,learning_level:4});

    const showingInteractions = list(context.customer_interactions).filter((record)=>["SHOWING_SCHEDULED","PRE_SHOWING_REFRESH_REQUESTED"].includes(record.interaction_type));
    if (context.customer_type==="SELLER_LISTING_AGENT"&&completed.length&&showingInteractions.length) push({opportunity_type:"PRE_SHOWING_REFRESH",customer_need:"Confirm that previously completed presentation areas remain showing-ready.",source_work_order_ids:ids(completed),source_customer_interaction_ids:ids(showingInteractions),
      evidence_basis:completed.map((work)=>basis("WORK_RECORD",work,"A prior physical reveal is recorded complete.")),interpretation_basis:[],unknowns:["Current presentation condition is unknown."],required_verifications:["Inspect the previously completed presentation areas shortly before the showing."],
      customer_value_hypothesis:"A condition-based refresh may improve showing readiness; the scheduled showing does not prove that physical work is needed.",business_value_hypothesis:"Pre-showing refresh is legitimate only when a current inspection identifies needed work.",customer_benefit_level:4,implementation_effort_level:2,recurring_level:4,learning_level:3});

    const baseline = context.repeat_photo_points?.length || photos.some((photo)=>hasTag(photo,"BASELINE"));
    const storms = events.filter((event)=>hasTag(event,"SIGNIFICANT_STORM_EVENT"));
    if (baseline && storms.length) push({opportunity_type:"POST_STORM_INSPECTION",customer_need:"Compare recorded baseline conditions after a significant storm.",source_asset_ids:[],source_photo_ids:ids(photos.filter((photo)=>hasTag(photo,"BASELINE"))),
      evidence_basis:storms.map((event)=>basis("EXTERNAL_EVENT",event,"A significant storm event is recorded separately from parcel observations.")),interpretation_basis:[],unknowns:["Post-event parcel condition is unknown until inspected."],required_verifications:["Revisit established baseline points after conditions are safe."],
      customer_value_hypothesis:"A repeat inspection may identify changed conditions without assuming storm causation.",business_value_hypothesis:"A post-storm review may be a legitimate monitoring service.",customer_benefit_level:4,implementation_effort_level:2,recurring_level:4,learning_level:5,urgency_level:4});

    const repeatAssets = assets.filter((asset)=>hasTag(asset,"REPEATED_WATER_OR_CULVERT_ASSET"));
    if (repeatAssets.length) push({opportunity_type:"WATER_CULVERT_MONITORING",customer_need:"Compare water or culvert conditions using repeatable measurements.",source_asset_ids:ids(repeatAssets),
      evidence_basis:repeatAssets.map((asset)=>basis("ASSET_RECORD",asset,"A water or culvert asset is designated for repeat observation.")),interpretation_basis:[],unknowns:["Behavior under contrasting rainfall or tide conditions is not established."],required_verifications:["Repeat the same documented measurement under a contrasting condition."],
      customer_value_hypothesis:"Repeated measurements may reduce uncertainty about changing water conditions; they do not establish engineering capacity.",business_value_hypothesis:"A repeat monitoring visit may be useful when conditions materially differ.",customer_benefit_level:4,implementation_effort_level:2,recurring_level:5,learning_level:5});

    const outOfScope = observations.filter((record)=>hasTag(record,"OUT_OF_SCOPE_QUESTION"));
    outOfScope.forEach((record)=>push({opportunity_type:"PROFESSIONAL_HANDOFF",customer_need:"Obtain a qualified answer to a question outside Property Intelligence's scope.",source_observation_ids:[record.id],
      evidence_basis:[basis("OBSERVED_QUESTION",record,"An unresolved professional question is recorded.")],interpretation_basis:[],unknowns:[record.question || "Professional determination is unknown."],required_verifications:[`Obtain review from ${record.professional_type || "the appropriate professional"}.`],suggested_next_investigation:`Send the exact question and linked evidence to ${record.professional_type || "the appropriate professional"}.`,eligible_service_codes:[],proposal_eligibility:"NOT_ELIGIBLE",
      customer_value_hypothesis:"A targeted professional review may remove a specific uncertainty.",business_value_hypothesis:"Professional referral is a scope boundary, not a Property Intelligence physical-service sale.",customer_benefit_level:5,implementation_effort_level:2,learning_level:3,urgency_level:record.safety_related?5:"UNKNOWN"}));

    return candidates;
  }

  function filterForCustomer(opportunities, customerType) {
    return list(opportunities).filter((opportunity)=>opportunity.customer_type===customerType && opportunity.visible_to_customer_type);
  }

  function transitionOpportunity(opportunity, nextStatus, details) {
    if (!STATUS.includes(nextStatus)) throw new Error("Unsupported opportunity status.");
    if (!list(TRANSITIONS[opportunity.status]).includes(nextStatus)) throw new Error(`Invalid transition ${opportunity.status} to ${nextStatus}.`);
    if (nextStatus === "READY_FOR_PROPOSAL" && opportunity.required_verifications.length) throw new Error("Required verifications must be resolved before proposal readiness.");
    const previous = opportunity.status;
    opportunity.status = nextStatus;
    opportunity.proposal_eligibility = nextStatus === "READY_FOR_PROPOSAL" ? "READY_FOR_DRAFT" : nextStatus === "NEEDS_VERIFICATION" ? "NEEDS_VERIFICATION" : opportunity.proposal_eligibility;
    opportunity.history.push({event_id:`${opportunity.opportunity_id}-EVENT-${String(opportunity.history.length+1).padStart(3,"0")}`,occurred_at:details?.occurred_at || new Date().toISOString(),action:details?.action || "STATUS_CHANGED",status_from:previous,status_to:nextStatus,source_ids:unique(details?.source_ids),note:details?.note || ""});
    return opportunity;
  }

  function resolveVerification(opportunity, verification, sourceIds, clock) {
    const index = opportunity.required_verifications.indexOf(verification);
    if (index < 0) throw new Error("Verification is not currently required.");
    opportunity.required_verifications.splice(index,1);
    opportunity.history.push({event_id:`${opportunity.opportunity_id}-EVENT-${String(opportunity.history.length+1).padStart(3,"0")}`,occurred_at:now(clock),action:"VERIFICATION_RECORDED",status_from:opportunity.status,status_to:opportunity.status,source_ids:unique(sourceIds),note:verification});
    if (!opportunity.required_verifications.length && opportunity.status === "NEEDS_VERIFICATION") transitionOpportunity(opportunity,"READY_FOR_PROPOSAL",{action:"VERIFICATION_COMPLETE",source_ids:sourceIds,occurred_at:now(clock)});
    return opportunity;
  }

  function createProposalDraftInput(opportunity, operatorApproval) {
    if (!operatorApproval) throw new Error("Operator approval is required before proposal conversion.");
    if (opportunity.status !== "READY_FOR_PROPOSAL" || opportunity.proposal_eligibility !== "READY_FOR_DRAFT") throw new Error("Opportunity is not ready for a proposal draft.");
    return {
      contract_version:"OPPORTUNITY-TO-PROPOSAL-V0.1",
      status:"DRAFT_INPUT_ONLY",
      source_opportunity_id:opportunity.opportunity_id,
      property_id:opportunity.property_id,
      source_proposal_zone_ids:clone(opportunity.source_proposal_zone_ids),
      eligible_service_codes:clone(opportunity.eligible_service_codes),
      customer_need:opportunity.customer_need,
      proposed_price:null,
      price_status:"UNKNOWN",
      geometry:null,
      geometry_instruction:"Operator must explicitly select or approve geometry. Do not alter source proposal geometry.",
      automatic_customer_delivery:false,
      automatic_acceptance:false
    };
  }

  function repeatPhotoRecommendation(opportunity, existingPhases) {
    const phases = new Set(existingPhases || []);
    const required = opportunity.status === "COMPLETED" || opportunity.source_work_order_ids.length ? ["BEFORE","WORK","AFTER"] : ["BEFORE","MONITORING"];
    return {contract_version:"OPPORTUNITY-TO-REPEAT-PHOTO-V0.1",source_opportunity_id:opportunity.opportunity_id,creates_record_automatically:false,operator_approval_required:true,required_phases:required,missing_phases:required.filter((phase)=>!phases.has(phase)),suggested_purpose:opportunity.opportunity_type};
  }

  function evaluateRecurringOpportunities(context, catalog, rules) {
    const completed = list(context.work_orders).filter((work)=>work.status==="COMPLETED");
    const recurring = [];
    const push = (input) => recurring.push(candidate(input,context,catalog,rules,900 + recurring.length));
    completed.forEach((work)=>{
      if (work.maintenance_review_due && !work.maintenance_scheduled) push({opportunity_type:"MAINTENANCE_REGROWTH_VISIT",customer_need:"Review regrowth in a completed work area.",source_work_order_ids:[work.id],source_proposal_zone_ids:work.proposal_zone_ids,
        evidence_basis:[basis("WORK_RECORD",work,"A completed work record has a maintenance review due.")],interpretation_basis:[],unknowns:["Current regrowth condition is unknown until observed."],required_verifications:["Inspect the completed zone for regrowth before proposing maintenance."],customer_value_hypothesis:"A condition-based maintenance visit may preserve the intended reveal.",business_value_hypothesis:"Maintenance may become recurring work only if current regrowth supports it.",customer_benefit_level:3,implementation_effort_level:2,recurring_level:5,learning_level:4});
      if (!list(work.after_photo_ids).length) push({opportunity_type:"REPEAT_PHOTO_MONITORING",customer_need:"Complete the before/work/after record.",source_work_order_ids:[work.id],source_proposal_zone_ids:work.proposal_zone_ids,
        evidence_basis:[basis("WORK_RECORD",work,"Completed work lacks linked AFTER evidence.")],interpretation_basis:[],unknowns:["Visible outcome is not documented."],required_verifications:["Capture AFTER evidence at the permanent photo point."],customer_value_hypothesis:"Matched documentation may help the customer review completed work.",business_value_hypothesis:"Complete outcome records improve service learning.",customer_benefit_level:4,implementation_effort_level:1,recurring_level:4,learning_level:5});
    });
    const remainingZones = list(context.proposal_zones).filter((zone)=>hasTag(zone,"ADDITIONAL_REVEAL_CANDIDATE")&&!completed.some((work)=>list(work.proposal_zone_ids).includes(zone.id)));
    if (completed.length&&remainingZones.length) push({opportunity_type:"ADDITIONAL_REVEAL_WORK",customer_need:"Review a separate remaining reveal area after learning from completed work.",source_work_order_ids:ids(completed),source_proposal_zone_ids:ids(remainingZones),evidence_basis:completed.map((work)=>basis("WORK_RECORD",work,"A prior physical reveal is recorded complete.")),interpretation_basis:remainingZones.map((zone)=>interpretation(zone,"A separate candidate area remains outside completed work.")),unknowns:["Current condition and current customer priority are unknown."],required_verifications:["Inspect the remaining candidate area and confirm that it is still the next useful bounded reveal."],customer_value_hypothesis:"A separate reveal may be useful if the customer still values it.",business_value_hypothesis:"Additional work is a review candidate, not an automatic sale.",customer_benefit_level:3,implementation_effort_level:"UNKNOWN",recurring_level:3,learning_level:4});
    const showings = list(context.customer_interactions).filter((record)=>["SHOWING_SCHEDULED","PRE_SHOWING_REFRESH_REQUESTED"].includes(record.interaction_type));
    if (context.customer_type==="SELLER_LISTING_AGENT"&&completed.length&&showings.length) push({opportunity_type:"PRE_SHOWING_REFRESH",customer_need:"Confirm that previously completed presentation areas remain showing-ready.",source_work_order_ids:ids(completed),source_customer_interaction_ids:ids(showings),evidence_basis:completed.map((work)=>basis("WORK_RECORD",work,"A prior physical reveal is recorded complete.")),interpretation_basis:[],unknowns:["Current presentation condition is unknown."],required_verifications:["Inspect the previously completed presentation areas shortly before the showing."],customer_value_hypothesis:"A condition-based refresh may support showing readiness.",business_value_hypothesis:"Refresh work requires a current-condition basis.",customer_benefit_level:4,implementation_effort_level:2,recurring_level:4,learning_level:3});
    return recurring;
  }

  function historicalLearningRecord(opportunity, linked) {
    return {
      opportunity_id: opportunity.opportunity_id,
      property_id: opportunity.property_id,
      opportunity_type: opportunity.opportunity_type,
      discovered_at: opportunity.created_at,
      current_status: opportunity.status,
      verification_event_ids: opportunity.history.filter((event)=>event.action.includes("VERIFICATION")).map((event)=>event.event_id),
      proposal_ids: unique(linked?.proposal_ids),
      work_order_ids: unique([...(opportunity.source_work_order_ids || []),...(linked?.work_order_ids || [])]),
      actual_cost_status: linked?.actual_cost_status || "UNKNOWN",
      after_evidence_ids: unique(linked?.after_evidence_ids),
      monitoring_event_ids: unique(linked?.monitoring_event_ids),
      customer_decision: ["ACCEPTED","DECLINED","DEFERRED"].includes(opportunity.status) ? opportunity.status : "UNKNOWN",
      outcome_status: linked?.outcome_status || "UNKNOWN",
      machine_learning_status:"NOT_IMPLEMENTED_V0.1"
    };
  }

  return {STATUS,CUSTOMER_TYPES,PRIORITY_DIMENSIONS,clone,ordinal,priorityResult,createOpportunity,validateSeparation,discoverOpportunities,filterForCustomer,transitionOpportunity,resolveVerification,createProposalDraftInput,repeatPhotoRecommendation,evaluateRecurringOpportunities,historicalLearningRecord};
});
