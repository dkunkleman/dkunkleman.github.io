"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Timber = require("../field/timber-reconnaissance.js");

const inspection = {
  property_id: "property-test", inspection_id: "inspection-test", inspector_identity: "Test Inspector",
  measurements: [], timber_plots: [], timber_trees: [], measurement_suggestions: [], timber_counters: {}
};

assert.equal(Timber.diameterFromCircumference(Math.PI * 20), 20, "circumference is converted to diameter without hiding the method");
assert.equal(Timber.plotRadiusFeet(0.1), 37.2, "one-tenth-acre fixed plot radius is explicit");
assert.throws(() => Timber.recordMeasurement(inspection, { measurement_type: "Water depth", value: "", unit: "in", basis: "Measured", reached_true_endpoint: "Yes", approximately_aligned: "Yes", subject_id: "water-1" }), /exact field value/, "a photograph cannot substitute for the entered value");

const depth = Timber.recordMeasurement(inspection, {
  measurement_type: "Water depth", value: 3.5, unit: "in", basis: "Measured", instrument: "marked staff",
  reached_true_endpoint: "Yes", approximately_aligned: "Yes", subject_id: "water-1", evidence_set_id: "water-1", photo_id: "photo-159",
  water_bottom_type: "Firm bottom", water_feature_type: "Isolated puddle", surface_length: 8, surface_width: 4
});
assert.equal(depth.authoritative_value, 3.5);
assert.match(depth.authority_rule, /inspector-entered numeric value is the authoritative field measurement/i);
assert.equal(depth.water_context.water_feature_type, "Isolated puddle");

const plot = Timber.createSamplePlot(inspection, {
  plot_size: "1/10 acre", plot_acres: 0.1, center: { latitude: 30.49, longitude: -87.09, accuracy_m: 4 },
  sampling_method: "Convenience plot", convenience_or_targeted_location: true, canopy: "closed", understory: "moderate",
  access_conditions: "soft approach", wet_ground_conditions: "wet along north edge"
});
const treeOne = Timber.createTimberTree(inspection, {
  plot_id: plot.plot_id, probable_species: "loblolly pine", identification_status: "Probable", identification_confidence: "medium",
  dbh_method: "Diameter tape reading", dbh_in: 20, dbh_instrument: "diameter tape", dbh_confidence: "high",
  merchantable_height_ft: 48, usable_16ft_logs: 3, height_method: "Visual estimate", product_category: "Sawtimber",
  defects_and_quality: ["Straight"], purposes: ["Likely timber sample"], photo_ids: ["photo-tree-1"]
});
const treeTwo = Timber.createTimberTree(inspection, {
  plot_id: plot.plot_id, probable_species: "oak", alternative_species: ["water oak"], identification_status: "Possible", identification_confidence: "low",
  dbh_method: "Circumference converted to diameter", circumference_in: Math.PI * 10, dbh_instrument: "tape measure", dbh_confidence: "medium",
  merchantable_height_ft: 24, usable_16ft_logs: 1.5, height_method: "Visual estimate", product_category: "Unknown",
  defects_and_quality: ["Forked", "Large limbs"], purposes: ["Preserve for shade", "Clearing obstacle"], photo_ids: ["photo-tree-2"], defect_photo_ids: ["photo-tree-2"]
});
assert.match(treeOne.tree_id, /^tree:property-test:/);
assert.notEqual(treeOne.tree_id, treeTwo.tree_id, "every tree has a permanent distinct property-level ID");
assert.equal(treeTwo.dbh.dbh_in, 10);
assert.equal(treeTwo.dbh.method, "Circumference converted to diameter");

const plotSummary = Timber.summarizePlot(inspection, plot);
assert.equal(plotSummary.tree_count, 2);
assert.equal(plotSummary.trees_per_acre, 20);
assert.equal(plotSummary.average_dbh_in, 15);
assert(Number.isFinite(plotSummary.basal_area_sq_ft_per_acre));
assert.equal(plotSummary.volume.status, "NOT_CALCULATED", "volume is never invented without a selected published equation");
assert.match(plotSummary.limitation, /not a formal statistically valid timber cruise/i);

const reconnaissance = Timber.createReconnaissance(inspection);
assert.equal(reconnaissance.title, "Preliminary Timber Reconnaissance");
assert.equal(reconnaissance.sampling_method_summary.plot_count, 1);
assert(reconnaissance.builder_and_clearing_summary.large_trees_likely_requiring_expensive_removal.includes(treeOne.tree_id));
assert(reconnaissance.builder_and_clearing_summary.mature_trees_suitable_for_retention.includes(treeTwo.tree_id));
assert.equal(reconnaissance.disclaimer, Timber.TIMBER_DISCLAIMER);
assert.match(reconnaissance.disclaimer, /not a certified timber cruise, timber appraisal, sale volume or market valuation/);

const handoff = Timber.createForesterHandoff(inspection, reconnaissance);
assert.equal(handoff.raw_tree_records.length, 2);
assert.equal(handoff.plot_designs.length, 1);
assert(handoff.photograph_ids.includes("photo-tree-1") && handoff.defect_photograph_ids.includes("photo-tree-2"));
assert(handoff.unanswered_questions.some(question => /volume equations/i.test(question)));

const indexSource = fs.readFileSync(path.resolve(__dirname, "../field/index.html"), "utf8");
const appSource = fs.readFileSync(path.resolve(__dirname, "../field/app.js"), "utf8");
const workerSource = fs.readFileSync(path.resolve(__dirname, "../field/sw.js"), "utf8");
assert(indexSource.includes("What did you measure?") && indexSource.includes("Did the device reach the true bottom/end point?") && indexSource.includes("Does this photograph show a tape, ruler, staff, diameter tape"), "measurement capture is immediate and structured");
assert(indexSource.includes("Timber Sample Plot") && indexSource.includes("ADD TREE TO PLOT") && indexSource.includes("Measure 54 inches above ground on the uphill side"), "field UI exposes plot and DBH coaching");
assert(appSource.includes("recordMeasurement") && appSource.includes("createSamplePlot") && appSource.includes("createTimberTree"), "app persists structured measurements, plots, and trees");
assert(workerSource.includes("timber-reconnaissance.js?v=3.12.0") && workerSource.includes("v17"), "timber tools are cached for offline use in the new release");

process.stdout.write("PASS: authoritative structured measurements, permanent tree/plot IDs, fixed-radius calculations, preliminary timber limitations, builder summary, and forester handoff are verified.\n");
