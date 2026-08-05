(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TimberReconnaissance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TIMBER_DISCLAIMER = "This reconnaissance documents field observations and preliminary measurements. It is not a certified timber cruise, timber appraisal, sale volume or market valuation. Sampling design, species, product classification, volume and value should be verified by a qualified consulting forester before a timber sale or financial decision.";
  const MEASUREMENT_TYPES = ["Water depth", "Width", "Length", "Tree diameter", "Distance", "Other"];
  const MEASUREMENT_BASIS = ["Measured", "Estimated"];
  const ENDPOINT_STATUS = ["Yes", "No", "Unknown"];
  const ALIGNMENT_STATUS = ["Yes", "No", "Unknown", "Not applicable"];
  const WATER_BOTTOM_TYPES = ["Soft bottom", "Firm bottom", "Unknown"];
  const WATER_CONTEXT_TYPES = ["Isolated puddle", "Pooled area", "Ditch", "Creek"];
  const DBH_METHODS = ["Diameter tape reading", "Circumference converted to diameter", "Biltmore-stick estimate", "Visual estimate", "Not measured"];
  const HEIGHT_METHODS = ["Laser rangefinder/clinometer", "Tree scale stick", "Phone estimate", "Visual estimate", "Unknown"];
  const TREE_DEFECTS = ["Straight", "Slight sweep", "Severe sweep", "Leaning", "Forked", "Multiple stems", "Visible rot", "Hollow", "Lightning scar", "Fire scar", "Insect damage", "Broken top", "Dead top", "Excessive knots", "Large limbs", "Mechanical damage", "Unknown"];
  const TREE_PURPOSES = ["Likely timber sample", "Preserve for shade", "Landscape/specimen tree", "Wildlife tree", "Hazard concern", "Clearing obstacle", "Property buffer", "Unknown"];
  const PLOT_SIZES = {
    "1/20 acre": 0.05,
    "1/10 acre": 0.1,
    "1/5 acre": 0.2,
    "1/4 acre": 0.25,
    "1/2 acre": 0.5,
    "1 acre": 1
  };

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function makeId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function finitePositive(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; }
  function normalizeList(value) { return Array.from(new Set((Array.isArray(value) ? value : [value]).map(item => String(item || "").trim()).filter(Boolean))); }

  function ensureModel(inspection) {
    const data = inspection || {};
    data.measurements = Array.isArray(data.measurements) ? data.measurements : [];
    data.timber_plots = Array.isArray(data.timber_plots) ? data.timber_plots : [];
    data.timber_trees = Array.isArray(data.timber_trees) ? data.timber_trees : [];
    data.measurement_suggestions = Array.isArray(data.measurement_suggestions) ? data.measurement_suggestions : [];
    data.timber_counters = data.timber_counters && typeof data.timber_counters === "object" ? data.timber_counters : {};
    return data;
  }

  function permanentId(data, kind) {
    ensureModel(data);
    const key = kind === "plot" ? "plot" : "tree";
    const prefix = kind === "plot" ? "plot" : "tree";
    const records = kind === "plot" ? data.timber_plots : data.timber_trees;
    let candidate;
    do {
      data.timber_counters[key] = Number(data.timber_counters[key] || 0) + 1;
      candidate = `${prefix}:${data.property_id || "property"}:${String(data.timber_counters[key]).padStart(6, "0")}`;
    } while (records.some(item => String(item[`${key}_id`]) === candidate));
    return candidate;
  }

  function registerExplicitId(data, kind, id) {
    if (!id) return;
    const records = kind === "plot" ? data.timber_plots : data.timber_trees;
    const key = kind === "plot" ? "plot_id" : "tree_id";
    if (records.some(item => String(item[key]) === String(id))) throw new Error(`The permanent ${kind} ID already exists.`);
    const suffix = Number(String(id).split(":").pop());
    if (Number.isFinite(suffix)) data.timber_counters[kind] = Math.max(Number(data.timber_counters[kind] || 0), suffix);
  }

  function recordMeasurement(inspection, request) {
    const data = ensureModel(inspection);
    const input = request || {};
    if (!MEASUREMENT_TYPES.includes(input.measurement_type)) throw new Error("Choose what was measured.");
    const value = finitePositive(input.value);
    if (value == null) throw new Error("Enter the exact field value that was recorded.");
    const unit = String(input.unit || "").trim();
    if (!unit) throw new Error("Choose or enter the measurement unit.");
    if (!MEASUREMENT_BASIS.includes(input.basis)) throw new Error("Choose Measured or Estimated.");
    if (!ENDPOINT_STATUS.includes(input.reached_true_endpoint)) throw new Error("Record whether the device reached the true bottom or endpoint.");
    if (!ALIGNMENT_STATUS.includes(input.approximately_aligned)) throw new Error("Record whether the device was approximately vertical or level.");
    const subjectId = input.evidence_set_id || input.subject_id || null;
    if (!subjectId) throw new Error("Attach the measurement to a subject or photo group.");
    const row = {
      schema_name: "property-intelligence-structured-measurement",
      schema_version: "1.0",
      information_class: "MEASURED_ON_SITE",
      measurement_id: input.measurement_id || makeId("measurement"),
      inspection_id: data.inspection_id || null,
      property_id: data.property_id || null,
      measurement_type: input.measurement_type,
      authoritative_value: value,
      unit,
      basis: input.basis,
      reached_true_endpoint: input.reached_true_endpoint,
      approximately_vertical_or_level: input.approximately_aligned,
      instrument: String(input.instrument || "").trim() || "Not recorded",
      photo_id: input.photo_id || null,
      evidence_set_id: input.evidence_set_id || null,
      subject_id: subjectId,
      timber_tree_id: input.timber_tree_id || null,
      timber_plot_id: input.timber_plot_id || null,
      voice_note_ids: normalizeList(input.voice_note_ids),
      recorded_at: input.recorded_at || new Date().toISOString(),
      recorded_by: input.recorded_by || data.inspector_identity || "Field Inspector",
      location: clone(input.location || null),
      water_context: input.measurement_type === "Water depth" ? {
        bottom_type: WATER_BOTTOM_TYPES.includes(input.water_bottom_type) ? input.water_bottom_type : "Unknown",
        water_feature_type: WATER_CONTEXT_TYPES.includes(input.water_feature_type) ? input.water_feature_type : null,
        approximate_surface_length: finitePositive(input.surface_length),
        approximate_surface_width: finitePositive(input.surface_width),
        surface_unit: String(input.surface_unit || "ft")
      } : null,
      authority_rule: "The inspector-entered numeric value is the authoritative field measurement. The photograph is supporting evidence and must not be re-read as the sole source of the number.",
      photograph_role: input.photo_id ? "supporting measurement evidence" : "no photograph linked",
      inspector_confirmed: input.inspector_confirmed !== false,
      source_suggestion_id: input.source_suggestion_id || null
    };
    data.measurements.push(row);
    return row;
  }

  function diameterFromCircumference(circumferenceIn) {
    const value = finitePositive(circumferenceIn);
    return value == null ? null : Math.round((value / Math.PI) * 100) / 100;
  }

  function plotRadiusFeet(acres) {
    const value = finitePositive(acres);
    return value == null ? null : Math.round(Math.sqrt(value * 43560 / Math.PI) * 10) / 10;
  }

  function createSamplePlot(inspection, request) {
    const data = ensureModel(inspection);
    const input = request || {};
    const acres = finitePositive(input.plot_acres != null ? input.plot_acres : PLOT_SIZES[input.plot_size]);
    if (acres == null) throw new Error("Choose a fixed plot size or enter custom plot acres.");
    if (!input.center || !Number.isFinite(Number(input.center.latitude)) || !Number.isFinite(Number(input.center.longitude))) throw new Error("Wait for a GPS position before starting the sample plot.");
    registerExplicitId(data, "plot", input.plot_id);
    const plot = {
      schema_name: "property-intelligence-preliminary-timber-sample-plot",
      schema_version: "1.0",
      plot_id: input.plot_id || permanentId(data, "plot"),
      property_id: data.property_id || null,
      inspection_id: data.inspection_id || null,
      evidence_set_id: input.evidence_set_id || null,
      created_at: input.created_at || new Date().toISOString(),
      center: clone(input.center),
      plot_size_label: input.plot_size || `${acres} acre custom`,
      plot_acres: acres,
      radius_ft: plotRadiusFeet(acres),
      inclusion_rule: String(input.inclusion_rule || "Every qualifying tree rooted within the stated fixed radius"),
      sampling_method: String(input.sampling_method || "Fixed-radius field sample"),
      convenience_or_targeted_location: Boolean(input.convenience_or_targeted_location),
      canopy: input.canopy || "unknown",
      understory: input.understory || "unknown",
      access_conditions: String(input.access_conditions || "not recorded"),
      wet_ground_conditions: String(input.wet_ground_conditions || "not recorded"),
      selected_volume_equation: input.selected_volume_equation || null,
      tree_ids: [],
      status: "active",
      limitation: "This plot is preliminary reconnaissance. Sparse, targeted, or convenience sampling is not a formal statistically valid timber cruise."
    };
    data.timber_plots.push(plot);
    return plot;
  }

  function normalizeDbh(input) {
    const method = DBH_METHODS.includes(input.dbh_method) ? input.dbh_method : "Not measured";
    const circumference = finitePositive(input.circumference_in);
    let dbh = finitePositive(input.dbh_in);
    if (method === "Circumference converted to diameter") dbh = diameterFromCircumference(circumference);
    const estimated = ["Biltmore-stick estimate", "Visual estimate"].includes(method) || input.dbh_basis === "Estimated";
    return {
      dbh_in: dbh,
      circumference_in: circumference,
      method,
      instrument: String(input.dbh_instrument || "").trim() || (method === "Not measured" ? "None" : "Not recorded"),
      basis: method === "Not measured" ? "Not measured" : (estimated ? "Estimated" : "Measured"),
      confidence: input.dbh_confidence || "unknown",
      measurement_height_in: 54,
      measurement_position_rule: "Measure 54 inches above ground on the uphill side.",
      complications: normalizeList(input.dbh_complications),
      tape_position_photo_id: input.tape_position_photo_id || null
    };
  }

  function createTimberTree(inspection, request) {
    const data = ensureModel(inspection);
    const input = request || {};
    const targetPlot = input.plot_id ? data.timber_plots.find(item => item.plot_id === input.plot_id) : null;
    if (input.plot_id && !targetPlot) throw new Error("The selected timber sample plot was not found.");
    registerExplicitId(data, "tree", input.tree_id);
    const tree = {
      schema_name: "property-intelligence-preliminary-timber-tree",
      schema_version: "1.0",
      tree_id: input.tree_id || permanentId(data, "tree"),
      property_id: data.property_id || null,
      inspection_id: data.inspection_id || null,
      evidence_set_id: input.evidence_set_id || null,
      plot_id: input.plot_id || null,
      recorded_at: input.recorded_at || new Date().toISOString(),
      location: clone(input.location || null),
      probable_species: String(input.probable_species || "Unknown"),
      alternative_species: normalizeList(input.alternative_species),
      identification_confidence: input.identification_confidence || "low",
      identification_status: input.identification_status || "Unknown",
      identification_evidence: {
        connected_leaf_or_needle: Boolean(input.connected_leaf_or_needle),
        bark: Boolean(input.bark),
        twig_and_bud: Boolean(input.twig_and_bud),
        reproductive_material: Boolean(input.reproductive_material),
        habitat_and_stand: String(input.habitat_and_stand || "not recorded")
      },
      dbh: normalizeDbh(input),
      total_height_ft: finitePositive(input.total_height_ft),
      merchantable_height_ft: finitePositive(input.merchantable_height_ft),
      usable_16ft_logs: finitePositive(input.usable_16ft_logs),
      height_method: HEIGHT_METHODS.includes(input.height_method) ? input.height_method : "Unknown",
      usable_timber_end_reason: normalizeList(input.usable_timber_end_reason),
      defects_and_quality: normalizeList(input.defects_and_quality),
      purposes: normalizeList(input.purposes),
      product_category: input.product_category || "Unknown",
      photo_ids: normalizeList(input.photo_ids),
      defect_photo_ids: normalizeList(input.defect_photo_ids),
      inspector_explanation: String(input.inspector_explanation || ""),
      classification_rule: "Preliminary field identification and measurement; not a professional species, grade, volume, or value determination."
    };
    data.timber_trees.push(tree);
    if (targetPlot && !targetPlot.tree_ids.includes(tree.tree_id)) targetPlot.tree_ids.push(tree.tree_id);
    return tree;
  }

  function attachPhotoToTree(inspection, treeId, photoId, defectPhoto) {
    const data = ensureModel(inspection);
    const tree = data.timber_trees.find(item => item.tree_id === treeId);
    if (!tree) return null;
    if (!tree.photo_ids.includes(photoId)) tree.photo_ids.push(photoId);
    if (defectPhoto && !tree.defect_photo_ids.includes(photoId)) tree.defect_photo_ids.push(photoId);
    return tree;
  }

  function finishPlot(inspection, plotId) {
    const plot = ensureModel(inspection).timber_plots.find(item => item.plot_id === plotId);
    if (!plot) throw new Error("The timber sample plot was not found.");
    plot.status = "finished";
    plot.finished_at = new Date().toISOString();
    return plot;
  }

  function dbhBand(value) {
    if (!Number.isFinite(Number(value))) return "Not measured";
    if (value < 8) return "Under 8 in";
    if (value < 12) return "8–11.9 in";
    if (value < 16) return "12–15.9 in";
    if (value < 20) return "16–19.9 in";
    if (value < 24) return "20–23.9 in";
    return "24 in and larger";
  }

  function summarizePlot(inspection, plot) {
    const data = ensureModel(inspection);
    const trees = (plot.tree_ids || []).map(id => data.timber_trees.find(tree => tree.tree_id === id)).filter(Boolean);
    const dbhTrees = trees.filter(tree => finitePositive(tree.dbh && tree.dbh.dbh_in) != null);
    const speciesMix = {};
    const distribution = {};
    trees.forEach(tree => {
      speciesMix[tree.probable_species || "Unknown"] = (speciesMix[tree.probable_species || "Unknown"] || 0) + 1;
      const band = dbhBand(tree.dbh && tree.dbh.dbh_in);
      distribution[band] = (distribution[band] || 0) + 1;
    });
    const basalAreaTotal = dbhTrees.reduce((sum, tree) => sum + 0.005454 * Number(tree.dbh.dbh_in) ** 2, 0);
    const equation = plot.selected_volume_equation;
    return {
      plot_id: plot.plot_id,
      center: clone(plot.center),
      plot_acres: plot.plot_acres,
      radius_ft: plot.radius_ft,
      sampling_method: plot.sampling_method,
      tree_count: trees.length,
      trees_per_acre: plot.plot_acres ? Math.round((trees.length / plot.plot_acres) * 10) / 10 : null,
      average_dbh_in: dbhTrees.length ? Math.round((dbhTrees.reduce((sum, tree) => sum + Number(tree.dbh.dbh_in), 0) / dbhTrees.length) * 10) / 10 : null,
      dbh_distribution: distribution,
      species_mix: speciesMix,
      basal_area_sq_ft_per_acre: plot.plot_acres && dbhTrees.length ? Math.round((basalAreaTotal / plot.plot_acres) * 10) / 10 : null,
      basal_area_method: "0.005454 × DBH² per measured tree, expanded by stated plot acres",
      volume: equation ? { status: "NOT_CALCULATED", selected_equation_or_table: equation, reason: "The selected published equation requires validated species/product inputs and implementation review before use." } : { status: "NOT_CALCULATED", selected_equation_or_table: null, reason: "No appropriate published equation or table was selected." },
      canopy: plot.canopy,
      understory: plot.understory,
      access_conditions: plot.access_conditions,
      wet_ground_conditions: plot.wet_ground_conditions,
      limitation: plot.limitation,
      tree_ids: trees.map(tree => tree.tree_id)
    };
  }

  function createReconnaissance(inspection) {
    const data = ensureModel(inspection);
    const plotSummaries = data.timber_plots.map(plot => summarizePlot(data, plot));
    const builder = {
      large_trees_likely_requiring_expensive_removal: data.timber_trees.filter(tree => Number(tree.dbh && tree.dbh.dbh_in) >= 20 || tree.purposes.includes("Clearing obstacle")).map(tree => tree.tree_id),
      small_stems_and_brush_suitable_for_chipping: data.timber_trees.filter(tree => Number(tree.dbh && tree.dbh.dbh_in) > 0 && Number(tree.dbh.dbh_in) < 8).map(tree => tree.tree_id),
      mature_trees_suitable_for_retention: data.timber_trees.filter(tree => tree.purposes.some(purpose => ["Preserve for shade", "Landscape/specimen tree", "Property buffer"].includes(purpose))).map(tree => tree.tree_id),
      hazard_concerns: data.timber_trees.filter(tree => tree.purposes.includes("Hazard concern") || tree.defects_and_quality.some(defect => ["Visible rot", "Hollow", "Dead top", "Broken top", "Severe sweep", "Leaning"].includes(defect))).map(tree => tree.tree_id),
      likely_equipment_access_problems: data.timber_plots.filter(plot => !["good", "easy", "clear", "not recorded"].includes(String(plot.access_conditions).toLowerCase())).map(plot => ({ plot_id: plot.plot_id, condition: plot.access_conditions })),
      wet_ground_constraints: data.timber_plots.filter(plot => !["dry", "firm", "not recorded"].includes(String(plot.wet_ground_conditions).toLowerCase())).map(plot => ({ plot_id: plot.plot_id, condition: plot.wet_ground_conditions })),
      low_clearing_cost_building_areas: [],
      limitation: "Clearing implications are preliminary field observations, not contractor bids, engineering conclusions, or permission to remove trees."
    };
    return {
      schema_name: "property-intelligence-preliminary-timber-reconnaissance",
      schema_version: "1.0",
      property_id: data.property_id || null,
      inspection_id: data.inspection_id || null,
      generated_at: new Date().toISOString(),
      title: "Preliminary Timber Reconnaissance",
      disclaimer: TIMBER_DISCLAIMER,
      sampling_method_summary: { plot_count: data.timber_plots.length, plots: plotSummaries, formal_cruise: false },
      trees: clone(data.timber_trees),
      builder_and_clearing_summary: builder,
      conclusions_not_established: ["Certified timber cruise", "Timber appraisal", "Sale volume", "Market value", "Statistically valid tract-wide estimate unless a qualified forester validates the design"]
    };
  }

  function createForesterHandoff(inspection, reconnaissance) {
    const data = ensureModel(inspection);
    const summary = reconnaissance || createReconnaissance(data);
    const photoIds = Array.from(new Set(data.timber_trees.flatMap(tree => tree.photo_ids || [])));
    const defectPhotoIds = Array.from(new Set(data.timber_trees.flatMap(tree => tree.defect_photo_ids || [])));
    return {
      schema_name: "property-intelligence-forester-handoff",
      schema_version: "1.0",
      property_id: data.property_id || null,
      inspection_id: data.inspection_id || null,
      purpose: "Help a consulting forester orient before visiting without treating preliminary field work as a certified cruise or appraisal.",
      tree_and_plot_map_reference: "track.geojson and inspection.json",
      raw_tree_records: clone(data.timber_trees),
      raw_measurements: clone(data.measurements.filter(item => item.measurement_type === "Tree diameter" || item.timber_tree_id || item.timber_plot_id)),
      plot_designs: clone(data.timber_plots),
      plot_summaries: clone(summary.sampling_method_summary.plots),
      photograph_ids: photoIds,
      defect_photograph_ids: defectPhotoIds,
      species_confidence: data.timber_trees.map(tree => ({ tree_id: tree.tree_id, probable_species: tree.probable_species, alternatives: tree.alternative_species, status: tree.identification_status, confidence: tree.identification_confidence })),
      access_observations: data.timber_plots.map(plot => ({ plot_id: plot.plot_id, access_conditions: plot.access_conditions })),
      wet_ground_observations: data.timber_plots.map(plot => ({ plot_id: plot.plot_id, wet_ground_conditions: plot.wet_ground_conditions })),
      unanswered_questions: ["Verify species and product classification.", "Validate plot placement and sampling sufficiency.", "Select and apply appropriate regional volume equations or tables.", "Assess grade, operability, sale boundaries, market conditions and value."],
      disclaimer: TIMBER_DISCLAIMER
    };
  }

  return {
    TIMBER_DISCLAIMER, MEASUREMENT_TYPES, MEASUREMENT_BASIS, ENDPOINT_STATUS, ALIGNMENT_STATUS, WATER_BOTTOM_TYPES, WATER_CONTEXT_TYPES,
    DBH_METHODS, HEIGHT_METHODS, TREE_DEFECTS, TREE_PURPOSES, PLOT_SIZES,
    ensureModel, recordMeasurement, diameterFromCircumference, plotRadiusFeet, createSamplePlot, createTimberTree, attachPhotoToTree,
    finishPlot, summarizePlot, createReconnaissance, createForesterHandoff
  };
});
