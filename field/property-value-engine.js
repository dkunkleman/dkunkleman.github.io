(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PropertyValueEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VALUE_DRIVERS = [
    ["buildability", "Buildability"], ["development_potential", "Development Potential"],
    ["timber", "Timber"], ["water", "Water"], ["views", "Views"], ["privacy", "Privacy"],
    ["access", "Access"], ["utilities", "Utilities"], ["clearing_cost", "Clearing Cost"],
    ["recreation", "Recreation"], ["agriculture", "Agriculture"], ["horses", "Horses"],
    ["wildlife", "Wildlife"], ["beauty", "Beauty"], ["investment", "Investment"],
    ["maintenance", "Maintenance"], ["hazards", "Hazards"], ["tree_preservation", "Tree Preservation"]
  ].map(([driver_id, label]) => ({ driver_id, label }));

  const EFFECTS = [
    ["increase_value", "Increase value"], ["decrease_value", "Decrease value"],
    ["increase_cost", "Increase cost"], ["decrease_cost", "Decrease cost"],
    ["increase_uncertainty", "Increase uncertainty"], ["reduce_uncertainty", "Reduce uncertainty"]
  ].map(([effect_id, label]) => ({ effect_id, label }));

  const HEAT_LAYERS = [
    ["value", "Value Heat Map"], ["cost", "Cost Heat Map"], ["risk", "Risk Heat Map"],
    ["opportunity", "Opportunity Heat Map"], ["beauty", "Beauty Heat Map"],
    ["buildability", "Buildability Heat Map"], ["tree_preservation", "Tree Preservation Heat Map"],
    ["water", "Water Heat Map"]
  ].map(([layer_id, label]) => ({ layer_id, label }));

  const DRIVER_IDS = new Set(VALUE_DRIVERS.map(item => item.driver_id));
  const EFFECT_IDS = new Set(EFFECTS.map(item => item.effect_id));
  const CONFIDENCE = new Set(["low", "medium", "high"]);

  const TYPE_SUGGESTIONS = {
    wet: ["water", "buildability", "development_potential", "maintenance", "hazards"],
    dry: ["buildability", "development_potential", "access"],
    blocked: ["access", "clearing_cost", "development_potential"],
    high: ["buildability", "views", "development_potential"],
    homesite: ["buildability", "development_potential", "investment", "beauty"],
    culvert: ["access", "water", "maintenance", "hazards"],
    tree: ["timber", "tree_preservation", "beauty", "privacy"],
    timber: ["timber", "investment", "clearing_cost"],
    entrance: ["access", "development_potential", "investment"],
    wildlife: ["wildlife", "recreation", "beauty"],
    thick: ["clearing_cost", "access", "development_potential"],
    open: ["clearing_cost", "agriculture", "horses", "buildability"],
    ditch: ["water", "maintenance", "hazards", "buildability"],
    hazard: ["hazards", "maintenance", "investment"],
    flowing_water: ["water", "beauty", "recreation", "buildability", "hazards"]
  };

  const CHEAPEST_INVESTIGATIONS = {
    buildability: "Flag a candidate footprint and photograph ground, drainage, slope, access direction, and nearby constraints before ordering professional studies.",
    development_potential: "Mark plausible use areas and constraints on the parcel map, then compare them with readily available zoning and parcel records.",
    timber: "Record a small purpose-labeled sample of DBH, species confidence, defects, merchantable length, and access before requesting a forester visit.",
    water: "Return after a contrasting rainfall condition and photograph the same GPS locations with simple depth, width, and flow measurements.",
    views: "Photograph each meaningful view from a fixed GPS point and heading during leaf-on conditions.",
    privacy: "Photograph boundary-facing sight lines from the intended use area and record seasonal vegetation limitations.",
    access: "Walk and photograph the narrowest, softest, steepest, and turning-constrained portions of the likely access route.",
    utilities: "Check public utility maps and photograph visible connection points before ordering utility locates or designs.",
    clearing_cost: "Mark representative clearing zones and count/measure representative stems before asking a contractor for a scoped estimate.",
    recreation: "Map the intended trail, hunting, water, or gathering use and document its access and safety constraints.",
    agriculture: "Photograph representative soil surface, slope, drainage, vegetation, and access, then check official soil mapping.",
    horses: "Walk a proposed turnout/fence route and document slope, footing, shade, water, hazards, and vehicle access.",
    wildlife: "Photograph tracks, browse, bedding, crossings, and habitat context with GPS rather than relying on a general impression.",
    beauty: "Capture repeatable context views from fixed GPS points and headings so visual quality can be compared across seasons.",
    investment: "List the intended value-creation strategy and identify the single unverified assumption most capable of changing it.",
    maintenance: "Inventory recurring-maintenance features and photograph their extent before requesting scoped prices.",
    hazards: "Photograph the hazard, the possible target, scale, and surrounding context, then identify the least expensive qualified screening step.",
    tree_preservation: "Mark priority trees, measure DBH, photograph defects and canopy relationship, and map their distance from the proposed work area."
  };

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = finite(value);
    return number == null ? fallback : Math.max(minimum, Math.min(maximum, number));
  }

  function driverLabel(id) {
    const found = VALUE_DRIVERS.find(item => item.driver_id === id);
    return found ? found.label : String(id || "Unknown");
  }

  function effectLabel(id) {
    const found = EFFECTS.find(item => item.effect_id === id);
    return found ? found.label : String(id || "Not assessed");
  }

  function suggestedDriverIds(observationType) {
    const type = String(observationType || "").replace(/^field\./, "");
    return (TYPE_SUGGESTIONS[type] || []).slice();
  }

  function ensureInspectionModel(inspection) {
    const data = inspection || {};
    data.active_value_driver_ids = Array.isArray(data.active_value_driver_ids)
      ? data.active_value_driver_ids.filter(id => DRIVER_IDS.has(id)) : [];
    data.active_value_effects = Array.isArray(data.active_value_effects)
      ? [...new Set(data.active_value_effects.filter(id => EFFECT_IDS.has(id)))]
      : (EFFECT_IDS.has(data.active_value_effect) ? [data.active_value_effect] : []);
    data.active_value_effect = EFFECT_IDS.has(data.active_value_effect) ? data.active_value_effect : "";
    if (!data.active_value_effects.length && data.active_value_effect) data.active_value_effects = [data.active_value_effect];
    if (!data.active_value_effect && data.active_value_effects.length) data.active_value_effect = data.active_value_effects[0];
    data.active_value_magnitude = clamp(data.active_value_magnitude, 1, 5, 3);
    data.active_value_confidence = CONFIDENCE.has(data.active_value_confidence) ? data.active_value_confidence : "medium";
    data.active_value_reason = String(data.active_value_reason || "");
    return data;
  }

  function activeContext(inspection) {
    const data = ensureInspectionModel(inspection);
    return {
      driver_ids: data.active_value_driver_ids.slice(),
      effect: data.active_value_effects[0] || data.active_value_effect,
      effects: data.active_value_effects.slice(),
      magnitude: data.active_value_magnitude,
      confidence: data.active_value_confidence,
      reason: data.active_value_reason.trim(),
      intended_use_scenario_id: data.active_intended_use_scenario_id || null
    };
  }

  function linksFromContext(context, recordedAt) {
    const input = context || {};
    const ids = Array.isArray(input.driver_ids) ? [...new Set(input.driver_ids.filter(id => DRIVER_IDS.has(id)))] : [];
    const effects = Array.isArray(input.effects) ? [...new Set(input.effects.filter(id => EFFECT_IDS.has(id)))] : (EFFECT_IDS.has(input.effect) ? [input.effect] : []);
    if (!ids.length || !effects.length) return [];
    return ids.flatMap(driverId => effects.map(effect => ({
      value_driver_id: driverId,
      value_driver: driverLabel(driverId),
      effect,
      effect_label: effectLabel(effect),
      magnitude: clamp(input.magnitude, 1, 5, 3),
      confidence: CONFIDENCE.has(input.confidence) ? input.confidence : "medium",
      inspector_reason: String(input.reason || "").trim(),
      assessment_source: "inspector_selected",
      intended_use_scenario_id: input.intended_use_scenario_id || null,
      assessed_at: recordedAt || new Date().toISOString()
    })));
  }

  function normalizeLinks(observation) {
    const source = observation && Array.isArray(observation.value_driver_links) ? observation.value_driver_links : [];
    return source.filter(link => link && DRIVER_IDS.has(link.value_driver_id) && EFFECT_IDS.has(link.effect)).map(link => ({
      value_driver_id: link.value_driver_id,
      value_driver: driverLabel(link.value_driver_id),
      effect: link.effect,
      effect_label: effectLabel(link.effect),
      magnitude: clamp(link.magnitude, 1, 5, 3),
      confidence: CONFIDENCE.has(link.confidence) ? link.confidence : "medium",
      inspector_reason: String(link.inspector_reason || "").trim(),
      assessment_source: link.assessment_source || "inspector_selected",
      intended_use_scenario_id: link.intended_use_scenario_id || null,
      assessed_at: link.assessed_at || observation.observed_at || observation.time || null
    }));
  }

  function confidenceWeight(confidence) {
    return confidence === "high" ? 1 : (confidence === "low" ? 0.5 : 0.75);
  }

  function scoresForLink(link) {
    const magnitude = link.magnitude * confidenceWeight(link.confidence);
    const scores = { value: 0, cost: 0, risk: 0, opportunity: 0, beauty: 0, buildability: 0, tree_preservation: 0, water: 0 };
    if (link.effect === "increase_value") { scores.value += magnitude; scores.opportunity += magnitude; }
    if (link.effect === "decrease_value") { scores.value -= magnitude; scores.risk += magnitude; }
    if (link.effect === "increase_cost") { scores.cost += magnitude; scores.risk += magnitude; }
    if (link.effect === "decrease_cost") { scores.cost -= magnitude; scores.opportunity += magnitude; }
    if (link.effect === "increase_uncertainty") scores.risk += magnitude;
    if (link.effect === "reduce_uncertainty") scores.risk -= magnitude;
    if (link.value_driver_id === "beauty") scores.beauty += scores.value || (link.effect === "reduce_uncertainty" ? magnitude : 0);
    if (link.value_driver_id === "buildability") scores.buildability += scores.value - Math.max(0, scores.cost) - Math.max(0, scores.risk);
    if (["tree_preservation", "timber", "privacy"].includes(link.value_driver_id)) scores.tree_preservation += scores.value - Math.max(0, scores.cost);
    if (link.value_driver_id === "water") scores.water += scores.value - Math.max(0, scores.cost) - Math.max(0, scores.risk);
    return scores;
  }

  function createImpact(observation, link, index) {
    const id = observation.observation_id || observation.id || `observation-${index + 1}`;
    const gps = observation.gps || {};
    const geometry = observation.geometry && observation.geometry.coordinates;
    const latitude = finite(gps.latitude != null ? gps.latitude : (geometry && geometry[1]));
    const longitude = finite(gps.longitude != null ? gps.longitude : (geometry && geometry[0]));
    const attachments = observation.attachments || {};
    const photographs = (attachments.nearest_photographs || []).filter(item => item.relationship === "direct").map(item => item.photo_id);
    return {
      impact_id: `value-impact-${id}-${link.value_driver_id}-${link.effect}`,
      observation_id: id,
      observation_label: observation.label || observation.button_label || observation.observation_type || observation.type || "Observation",
      observed_at: observation.observed_at || observation.time || null,
      gps_point_id: observation.gps_point_id || null,
      location: latitude == null || longitude == null ? null : { latitude, longitude, accuracy_m: finite(gps.accuracy_m != null ? gps.accuracy_m : observation.gps_accuracy_m) },
      value_driver_id: link.value_driver_id,
      value_driver: link.value_driver,
      effect: link.effect,
      effect_label: link.effect_label,
      magnitude: link.magnitude,
      confidence: link.confidence,
      inspector_reason: link.inspector_reason,
      assessment_source: link.assessment_source,
      evidence_classification: observation.evidence_classification || "Observed",
      supporting_photograph_ids: photographs,
      supporting_voice_note_ids: (attachments.nearest_voice_notes || []).filter(item => item.relationship === "direct").map(item => item.voice_note_id),
      scores: scoresForLink(link),
      limitation: "This is an evidence-linked field assessment, not a monetary appraisal, engineering conclusion, bid, or guarantee of market reaction."
    };
  }

  function aggregateByDriver(impacts) {
    const map = new Map();
    impacts.forEach(impact => {
      if (!map.has(impact.value_driver_id)) map.set(impact.value_driver_id, {
        value_driver_id: impact.value_driver_id,
        value_driver: impact.value_driver,
        value_score: 0, cost_score: 0, risk_score: 0, opportunity_score: 0,
        supporting_observation_ids: [], supporting_photograph_ids: [], reasons: [], effect_counts: {}
      });
      const item = map.get(impact.value_driver_id);
      item.value_score += impact.scores.value;
      item.cost_score += impact.scores.cost;
      item.risk_score += impact.scores.risk;
      item.opportunity_score += impact.scores.opportunity;
      item.supporting_observation_ids.push(impact.observation_id);
      item.supporting_photograph_ids.push(...impact.supporting_photograph_ids);
      if (impact.inspector_reason) item.reasons.push(impact.inspector_reason);
      item.effect_counts[impact.effect] = (item.effect_counts[impact.effect] || 0) + 1;
    });
    return [...map.values()].map(item => Object.assign(item, {
      value_score: Number(item.value_score.toFixed(2)), cost_score: Number(item.cost_score.toFixed(2)),
      risk_score: Number(item.risk_score.toFixed(2)), opportunity_score: Number(item.opportunity_score.toFixed(2)),
      supporting_observation_ids: [...new Set(item.supporting_observation_ids)],
      supporting_photograph_ids: [...new Set(item.supporting_photograph_ids)], reasons: [...new Set(item.reasons)]
    }));
  }

  function ranked(aggregates, scoreField, direction) {
    return aggregates.filter(item => direction === "positive" ? item[scoreField] > 0 : item[scoreField] !== 0)
      .sort((a, b) => direction === "absolute" ? Math.abs(b[scoreField]) - Math.abs(a[scoreField]) : b[scoreField] - a[scoreField])
      .slice(0, 10).map((item, index) => ({
        rank: index + 1,
        value_driver_id: item.value_driver_id,
        value_driver: item.value_driver,
        evidence_weighted_score: item[scoreField],
        why: item.reasons.length ? item.reasons.join("; ") : `Inspector-linked ${item.value_driver.toLowerCase()} evidence produced this relative evidence score. Review the cited observations before making a decision.`,
        supporting_observation_ids: item.supporting_observation_ids,
        supporting_photograph_ids: item.supporting_photograph_ids,
        contradicting_evidence: "Review other impacts for the same driver with an opposing effect.",
        remaining_uncertainty: "No monetary effect is established unless supported by separate market, contractor, or professional evidence."
      }));
  }

  function heatMap(impacts, subjectParcel, eligibility) {
    if (!eligibility || eligibility.eligible !== true) return {
      schema_name: "property-intelligence-value-driver-heat-maps", schema_version: "1.1", status: "INSUFFICIENT_SPATIAL_EVIDENCE",
      reason: eligibility && eligibility.reason || "Specify an Intended Use Scenario and collect sufficient spatial Field Truth and coverage evidence.",
      subject_parcel: subjectParcel || null, evidence_density: eligibility && eligibility.evidence_density || null, unknown_areas_visible: true, layers: [],
      limitations: ["No heat map was rendered because the evidence gate did not pass.", "Unknown ground is not neutral, safe, dry, buildable, low cost, or low risk.", "Beauty is subjective and scenario-dependent."]
    };
    const points = impacts.filter(impact => impact.location).map(impact => ({
      impact_id: impact.impact_id,
      observation_id: impact.observation_id,
      latitude: impact.location.latitude,
      longitude: impact.location.longitude,
      radius_m: Math.max(15, Math.min(65, impact.location.accuracy_m || 25)),
      value_driver_id: impact.value_driver_id,
      effect: impact.effect,
      magnitude: impact.magnitude,
      confidence: impact.confidence,
      scores: impact.scores,
      why: impact.inspector_reason || `${impact.effect_label}: ${impact.value_driver}`,
      supporting_photograph_ids: impact.supporting_photograph_ids
    }));
    return {
      schema_name: "property-intelligence-value-driver-heat-maps",
      schema_version: "1.0",
      status: "EVIDENCE_SUPPORTED",
      intended_use_scenario_id: eligibility.scenario_id,
      evidence_density: eligibility.evidence_density,
      method: "Evidence influence zones centered on inspector-assessed observations. No interpolation into unvisited or unsupported acreage.",
      subject_parcel: subjectParcel || null,
      layers: HEAT_LAYERS.map(layer => ({
        layer_id: layer.layer_id,
        label: layer.label,
        points: points.filter(point => point.scores[layer.layer_id] !== 0).map(point => Object.assign({}, point, { layer_score: Number(point.scores[layer.layer_id].toFixed(2)) }))
      })),
      limitations: [
        "Scores are relative evidence-prioritization weights, not dollars, appraisal adjustments, probabilities, engineering findings, or parcel-wide conclusions.",
        "An unvisited location has no heat-map score and must not be interpreted as neutral, safe, buildable, dry, low cost, or low risk.",
        "Overlapping circles show multiple recorded influences; they do not establish feature boundaries."
      ]
    };
  }

  function buildValueEngine(options) {
    const settings = options || {};
    const observations = Array.isArray(settings.observations) ? settings.observations : [];
    const impacts = [];
    const unassessed = [];
    const suggestions = [];
    observations.forEach((observation, index) => {
      const type = String(observation.observation_type || observation.type || "").replace(/^field\./, "");
      const attributes = observation.attributes || {};
      const inheritedAttachment = (type === "photo" && attributes.associated_observation_id) || (type === "voice_note" && attributes.photo_id);
      if (inheritedAttachment) return;
      const links = normalizeLinks(observation).filter(link => link.intended_use_scenario_id && link.intended_use_scenario_id === settings.activeIntendedUseScenarioId);
      if (!links.length) {
        const observationId = observation.observation_id || observation.id || `observation-${index + 1}`;
        unassessed.push(observationId);
        suggestions.push({
          observation_id: observationId,
          suggested_value_driver_ids: suggestedDriverIds(observation.observation_type || observation.type),
          status: "SUGGESTED_UNCONFIRMED",
          rule: "A suggestion is not an inspector assessment and is excluded from rankings and heat maps until confirmed."
        });
      }
      links.forEach(link => impacts.push(createImpact(observation, link, index)));
    });
    const aggregates = aggregateByDriver(impacts);
    const uncertaintyDrivers = aggregates.filter(item => item.effect_counts.increase_uncertainty).sort((a, b) => b.risk_score - a.risk_score);
    const questions = (Array.isArray(settings.questions) ? settings.questions : []).filter(item => item.status !== "answered").slice(0, 10).map((item, index) => ({
      rank: index + 1,
      question_id: item.question_id || item.id || null,
      question: item.text || item.question,
      why: "The inspector left this investigation question unresolved.",
      affected_value_driver_ids: item.value_driver_ids || [],
      cheapest_next_investigation: "Collect the smallest direct observation, photograph, measurement, public record, or qualified screening needed to answer this question."
    }));
    uncertaintyDrivers.forEach(item => {
      if (questions.length >= 10) return;
      questions.push({
        rank: questions.length + 1,
        question_id: null,
        question: `What would resolve the recorded uncertainty affecting ${item.value_driver}?`,
        why: `Inspector assessments increased uncertainty for ${item.value_driver}.`,
        affected_value_driver_ids: [item.value_driver_id],
        supporting_observation_ids: item.supporting_observation_ids,
        cheapest_next_investigation: CHEAPEST_INVESTIGATIONS[item.value_driver_id]
      });
    });
    const rankedAggregateDrivers = aggregates.slice().sort((a, b) => (Math.abs(b.risk_score) + Math.abs(b.cost_score) + Math.abs(b.value_score)) - (Math.abs(a.risk_score) + Math.abs(a.cost_score) + Math.abs(a.value_score))).map(item => item.value_driver_id);
    const investigationDrivers = [...new Set(questions.flatMap(item => item.affected_value_driver_ids || []).concat(uncertaintyDrivers.map(item => item.value_driver_id), rankedAggregateDrivers))];
    const cheapest = investigationDrivers.slice(0, 10).map((driverId, index) => {
      const aggregate = aggregates.find(item => item.value_driver_id === driverId);
      return {
        rank: index + 1,
        value_driver_id: driverId,
        value_driver: driverLabel(driverId),
        investigation: CHEAPEST_INVESTIGATIONS[driverId],
        why: `This is the lowest-cost field or public-record step identified for reducing uncertainty about ${driverLabel(driverId).toLowerCase()}.`,
        supporting_observation_ids: aggregate ? aggregate.supporting_observation_ids : [],
        decision_change: "Could change the relative value, cost, risk, or opportunity assessment; it does not establish a monetary adjustment by itself."
      };
    });
    return {
      schema_name: "property-intelligence-value-engine",
      schema_version: "1.0",
      property_id: settings.propertyId || null,
      inspection_id: settings.inspectionId || null,
      purpose: "Explain why field evidence may affect property value, cost, risk, opportunity, and uncertainty without presenting an appraisal.",
      value_drivers: VALUE_DRIVERS,
      effects: EFFECTS,
      impacts,
      unassessed_observation_ids: unassessed,
      unconfirmed_suggestions: suggestions,
      rankings: {
        top_10_value_drivers: ranked(aggregates, "value_score", "absolute"),
        top_10_cost_drivers: ranked(aggregates, "cost_score", "absolute"),
        top_10_risks: ranked(aggregates, "risk_score", "positive"),
        top_10_opportunities: ranked(aggregates, "opportunity_score", "positive"),
        top_10_unanswered_questions: questions,
        top_10_cheapest_next_investigations: cheapest
      },
      active_intended_use_scenario_id: settings.activeIntendedUseScenarioId || null,
      intended_use_scenarios: Array.isArray(settings.intendedUseScenarios) ? settings.intendedUseScenarios : [],
      legacy_or_unscoped_assessment_rule: "A value assessment without an Intended Use Scenario is preserved but excluded from derived rankings and heat maps.",
      heat_maps: heatMap(impacts, settings.subjectParcel, settings.heatMapEligibility),
      report_rules: [
        "Every ranked item must explain why, cite supporting observations and photographs, identify contradicting evidence, state remaining uncertainty, and name the cheapest credible next investigation.",
        "Do not convert relative evidence scores into dollars, appraisal adjustments, ROI, probabilities, or tract-wide conclusions.",
        "Do not count unconfirmed suggestions in findings, rankings, or heat maps.",
        "A feature may create both value and cost. Preserve both effects rather than netting away the tradeoff."
      ]
    };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function createHeatMapHtml(model) {
    if (!model || model.status !== "EVIDENCE_SUPPORTED") return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Property Value Heat Maps — insufficient evidence</title><style>body{font-family:Arial,sans-serif;margin:24px;background:#f4f1e8;color:#172016}.warning{max-width:760px;border:4px solid #8a4400;background:#fff3df;padding:18px;font-weight:800}</style></head><body><main class="warning"><h1>Insufficient spatial evidence</h1><p>${escapeHtml(model && model.reason || "Specify an Intended Use Scenario and collect sufficient spatial Field Truth and coverage evidence.")}</p><p>No heat map was rendered. Unknown ground remains visibly unknown. Beauty is subjective and scenario-dependent.</p></main></body></html>`;
    const payload = JSON.stringify(model).replace(/</g, "\\u003c");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Property Value Driver Heat Maps</title><style>body{font-family:Arial,sans-serif;margin:0;background:#f4f1e8;color:#172016}header,main{max-width:1100px;margin:auto;padding:16px}.warning{border:3px solid #8a4400;background:#fff3df;padding:12px;font-weight:700}.layers{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin:14px 0}.layers label{background:#fff;border:2px solid #274c2c;padding:12px;font-weight:800}.map{height:68vh;min-height:480px;background:#e7eadf;border:4px solid #243b24;position:relative;overflow:hidden}.point{position:absolute;border-radius:50%;transform:translate(-50%,-50%);border:2px solid rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#111;cursor:pointer}.positive{background:rgba(21,145,60,.55)}.negative{background:rgba(199,54,40,.58)}.neutral{background:rgba(245,176,45,.6)}#details{background:#fff;border:2px solid #274c2c;padding:12px;margin-top:10px;min-height:48px}</style></head><body><header><h1>Property Value Driver Heat Maps</h1><p class="warning">These are evidence influence zones, not appraised values or parcel-wide conclusions. Unvisited or unsupported ground remains unknown.</p></header><main><div id="layers" class="layers"></div><div id="map" class="map" aria-label="Evidence influence map"></div><div id="details">Select an evidence circle to see why it matters.</div></main><script>const MODEL=${payload};const layers=document.getElementById('layers'),map=document.getElementById('map'),details=document.getElementById('details');let active=MODEL.layers[0]&&MODEL.layers[0].layer_id;function bounds(points){const xs=points.map(p=>p.longitude),ys=points.map(p=>p.latitude);return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}}function draw(){map.innerHTML='';const layer=MODEL.layers.find(x=>x.layer_id===active),points=layer?layer.points:[];if(!points.length){map.innerHTML='<p style="padding:20px">No inspector-confirmed impacts were recorded for this layer.</p>';return}const b=bounds(points),dx=b.maxX-b.minX||.001,dy=b.maxY-b.minY||.001;points.forEach(p=>{const el=document.createElement('button');el.className='point '+(p.layer_score>0?'positive':p.layer_score<0?'negative':'neutral');el.style.left=(8+84*(p.longitude-b.minX)/dx)+'%';el.style.top=(92-84*(p.latitude-b.minY)/dy)+'%';const size=34+Math.min(42,Math.abs(p.layer_score)*7);el.style.width=size+'px';el.style.height=size+'px';el.textContent=p.observation_id;el.onclick=()=>details.textContent=p.why+' | '+p.value_driver_id+' | '+p.effect+' | confidence '+p.confidence+' | photos '+(p.supporting_photograph_ids.join(', ')||'none directly linked');map.appendChild(el)})}MODEL.layers.forEach((layer,i)=>{const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='layer';radio.checked=i===0;radio.onchange=()=>{active=layer.layer_id;draw()};label.append(radio,document.createTextNode(' '+layer.label+' ('+layer.points.length+')'));layers.appendChild(label)});draw();</script></body></html>`;
  }

  return {
    VALUE_DRIVERS,
    EFFECTS,
    HEAT_LAYERS,
    suggestedDriverIds,
    ensureInspectionModel,
    activeContext,
    linksFromContext,
    normalizeLinks,
    buildValueEngine,
    createHeatMapHtml
  };
});
