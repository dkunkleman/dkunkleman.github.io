(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PropertyPrevisitReview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AERIAL_TYPES = Object.freeze([
    "VISIBLE CREEK OR CHANNEL", "POSSIBLE DRAINAGE PATH", "POSSIBLE OPEN WATER",
    "LIGHT OR SPARSE CANOPY", "POSSIBLE BARE SOIL",
    "POSSIBLE WETLAND VEGETATION", "POSSIBLE FLOODPLAIN OR WET FLAT",
    "SPARSE OR STRESSED CANOPY", "POSSIBLE BARE OR PALE GROUND",
    "IMAGERY GLARE OR UNCERTAIN", "NEEDS FIELD CONFIRMATION"
  ]);
  const TRACE_TYPES = Object.freeze(["PROBABLE MAIN CREEK", "PROBABLE CREEK BRANCH", "POSSIBLE MARSHY CLEARING", "DENSER TREE CANOPY", "THINNER TREE CANOPY", "LIKELY DENSE 2–3 INCH BRUSH", "LIKELY MIXED BRUSH AND LARGER TREES", "UNKNOWN"]);
  const LEGACY_TRACE_TYPES = Object.freeze(["LIKELY LARGER TREES", "PROBABLE MAIN CHANNEL", "PROBABLE BRANCH"]);
  const RETURN_CHOICES = Object.freeze(["SAME STANDING WATER", "LESS STANDING WATER", "NO WATER BUT STILL SOFT", "FIRM AND DRY", "MORE WATER", "CANNOT REACH"]);

  function ensureModel(inspection) {
    inspection.property_previsit_review = inspection.property_previsit_review && typeof inspection.property_previsit_review === "object" ? inspection.property_previsit_review : {};
    const model = inspection.property_previsit_review;
    model.schema_name = "property-intelligence-previsit-water-terrain-review";
    model.schema_version = "1.2";
    model.aerial_interpretations = Array.isArray(model.aerial_interpretations) ? model.aerial_interpretations : [];
    model.aerial_traces = Array.isArray(model.aerial_traces) ? model.aerial_traces : [];
    model.field_prediction_checks = Array.isArray(model.field_prediction_checks) ? model.field_prediction_checks : [];
    model.return_visit_observations = Array.isArray(model.return_visit_observations) ? model.return_visit_observations : [];
    model.stopping_points = Array.isArray(model.stopping_points) ? model.stopping_points : [];
    model.next_trace_number = Math.max(Number(model.next_trace_number) || 1, model.aerial_traces.length + 1);
    if (!model.aerial_interpretations.some(item => item.interpretation_id === "APPLE-MAPS-INSPECTOR-2026-08-04")) {
      model.aerial_interpretations.push({
        interpretation_id: "APPLE-MAPS-INSPECTOR-2026-08-04",
        information_class: "AERIAL_INTERPRETATION",
        source: "inspector-supplied Apple Maps screenshot",
        source_image_in_package: false,
        source_image_status: "USER_SUPPLIED_LOCAL_REFERENCE_INSPECTED; NOT_REPUBLISHED_IN_PUBLIC_GITHUB_PAGES_BUILD",
        source_image: {
          filename: "Screenshot (1417).png",
          sha256: "304b8e025d7ef0d17437028b4282b8f55c67a4c579ca73027a1556badf8c6f46",
          size_bytes: 2869159,
          pixel_width: 1920,
          pixel_height: 1080,
          screenshot_recorded_at_utc: "2026-08-05T00:29:04.2948759Z",
          provider_url_parameters_visible: { center: "30.489452,-87.088502", span: "0.004782,0.009521", map: "satellite" },
          imagery_date: null,
          imagery_date_status: "NOT_SHOWN_IN_SCREENSHOT",
          rights_note: "The source screenshot remains with the inspector and is identified by hash. It is not republished by this public test app."
        },
        interpretation_date: "2026-08-04",
        reviewer: "Inspector",
        confidence: "probable",
        field_confirmation_status: "NOT_FIELD_CONFIRMED",
        not_a_survey: true,
        not_a_regulatory_wetland_determination: true,
        selections: ["MULTIPLE PROBABLE CREEK OR DRAINAGE CHANNELS", "BRANCHING DRAINAGE NETWORK", "BROADER LIGHT MOTTLED AREAS INTERPRETED AS LIKELY DENSE 2–3 INCH BRUSH", "FIELD CONFIRMATION REQUIRED"],
        warning: "Lighter broad areas are interpreted as likely dense, twisty 2–3-inch brush with an approximately 10–12-foot canopy and difficult foot travel—not open ground. Moisture, water, soil exposure, image stitching, sunlight, season, or vegetation stress can still produce similar colors, so field confirmation is required."
      });
    }
    if (!model.aerial_calibrations) model.aerial_calibrations = [];
    if (!model.aerial_calibrations.some(item => item.calibration_id === "SMALL-TRACT-LIGHT-MOTTLED-2026-08-04")) {
      model.aerial_calibrations.push({
        calibration_id: "SMALL-TRACT-LIGHT-MOTTLED-2026-08-04",
        information_class: "INSPECTOR_CONFIRMED_AERIAL_CALIBRATION",
        reference_area: "Small tract",
        field_date: "2026-08-04",
        field_observation: ["lighter aerial appearance", "dense twisty brush and young vegetation", "brush generally approximately 2–3 inches in diameter", "brush canopy approximately 10–12 feet", "difficult to travel through", "most inspected small-tract ground dry"],
        pattern_rule: "LIGHT_MOTTLED_AERIAL_PATTERN = LIKELY_DENSE_2_TO_3_INCH_BRUSH_WITH_APPROXIMATELY_10_TO_12_FOOT_CANOPY_AND_DIFFICULT_TRAVEL",
        status: "FIELD_CALIBRATED_PATTERN_NOT_UNIVERSALLY_CONFIRMED",
        imagery_provider: "Apple Maps",
        imagery_date: null,
        imagery_date_status: "NOT_ESTABLISHED",
        photograph_ids: [],
        photograph_relationship_status: "SMALL_TRACT_PHOTOGRAPH_IDS_NOT_DIRECTLY_IDENTIFIED_IN_CURRENT_ARCHIVE_METADATA",
        gps_route_reference: "AUGUST_4_REFERENCE_ROUTE.json",
        mapped_section_reference: null,
        mapped_section_status: "NO_MAPPED_SECTION_EXISTS_IN_THE_VERIFIED_FULL_ARCHIVE",
        inspector_confirmation: "Lighter or whitish mottled vegetation on the physically inspected small tract corresponded primarily to dense, twisty brush generally approximately 2–3 inches in diameter, with an approximately 10–12-foot canopy and difficult foot travel; most inspected small-tract ground was dry.",
        append_only_corrections: [{ correction_id: "SMALL-TRACT-CALIBRATION-CORRECTION-001", recorded_at: "2026-08-04", statement: "The lighter areas are not open ground; they are better understood as twisty, winding 2–3-inch brush with a roughly 10–12-foot canopy that is difficult to travel through.", supersedes_any_easy_or_open_interpretation: true, append_only: true }],
        append_only: true,
        limitations: ["Do not call every similarly colored area identical.", "Moisture, sunlight, season, image stitching, tree stress, water, and soil exposure may create similar colors.", "Do not label the pattern open ground, cleared land, buildable area, or dry area without field observation."]
      });
    }
    model.aerial_pattern_classes = {
      LIKELY_LARGER_TREES: { visual_pattern: ["darker", "larger crown shapes", "heavier canopy", "visible individual or grouped tree crowns"], likely_field_meaning: ["mature pine or hardwood trees", "larger-tree clearing work may be present"], travel_rule: "Do not infer travel difficulty from large-tree canopy. Mature-tree areas may be open and easy underneath or may contain dense brush." },
      LIKELY_DENSE_2_TO_3_INCH_BRUSH: { visual_pattern: ["lighter", "mottled", "broad patches rather than single crowns", "resembles the field-confirmed small-tract brush areas"], likely_field_meaning: ["dense twisty brush", "approximately 2–3 inches in diameter where field-confirmed", "approximately 10–12 feet tall", "difficult to walk through", "not open ground", "exact size and density require on-site confirmation"], cost_and_access_implications: ["brush cutting", "difficult walking", "difficult visibility", "limited ease of movement", "possible access cost", "equipment movement uncertain if wet"] },
      LIKELY_MIXED_BRUSH_AND_LARGER_TREES: { visual_pattern: ["dark crowns over a lighter mottled texture", "light underbrush texture interrupted by scattered or numerous dark crowns"], likely_field_meaning: ["large trees with dense small-brush understory", "tree canopy and underbrush must be field-confirmed separately"] },
      PROBABLE_CREEK_OR_DRAINAGE: { visual_pattern: ["narrow", "winding", "branching", "connected to other channel-like features", "may appear dark because of water, deep shade, or dense channel vegetation"], primary_rule: "Use shape and continuity as the primary evidence. Do not classify a creek only from darkness." }
    };
    model.independent_field_layers = {
      large_trees_overhead: ["NO LARGE TREES OBSERVED", "SCATTERED LARGE TREES", "MANY LARGE TREES", "NEARLY CONTINUOUS LARGE-TREE CANOPY", "UNKNOWN"],
      underbrush: ["OPEN UNDERNEATH", "LIGHT SMALL BRUSH", "DENSE 1–2-INCH BRUSH", "DENSE 2–3-INCH TANGLED BRUSH", "BRUSH DIAMETER UNKNOWN", "UNKNOWN"],
      travel_difficulty: ["EASY TO WALK THROUGH", "MODERATELY DIFFICULT", "VERY DIFFICULT", "CANNOT TRAVEL WITHOUT CUTTING", "UNKNOWN"],
      ground_and_water: ["DRY AND FIRM", "SOFT WITHOUT VISIBLE WATER", "STANDING WATER MOSTLY 2–4 INCHES", "LOCAL WATER APPROXIMATELY 8 INCHES", "WATER DEPTH UNKNOWN", "GROUND UNKNOWN"]
    };
    model.controlling_inspector_observations = [
      "Areas containing large mature trees can be easier to travel through than areas dominated by dense 2–3-inch brush.",
      "Dense 2–3-inch brush may occur without large trees, beneath scattered large trees, or beneath many large pine or hardwood trees.",
      "Along the curved road toward the north boundary, large trees and dense 2–3-inch tangled brush occur together.",
      "Cutting dense brush could improve visibility and foot travel across substantial portions of both tracts.",
      "Removing brush would not resolve standing-water and soft-ground conditions on the large tract."
    ];
    model.interpretation_corrections = Array.isArray(model.interpretation_corrections) ? model.interpretation_corrections : [];
    if (!model.interpretation_corrections.some(item => item.correction_id === "TRAIL-TO-MARSHY-CLEARING-2026-08-04")) model.interpretation_corrections.push({
      correction_id: "TRAIL-TO-MARSHY-CLEARING-2026-08-04", recorded_at: "2026-08-04", append_only: true,
      source: "INSPECTOR FIELD CONFIRMATION", original_label: "TRAIL", original_label_status: "SUPERSEDED_AUDIT_ONLY",
      current_label: "MARSHY CLEARING / WET LOW-VEGETATION AREA",
      current_facing_rule: "Do not display or report the prior Trail interpretation as current.",
      exclusions: ["constructed trail", "firm path", "vehicle route", "dry open ground"],
      geometry_status: "APPROXIMATE_LOCATION_ON_AUGUST_4_REACHED_ROUTE; EXACT_CLEARING_BOUNDARY_NOT_ESTABLISHED"
    });
    model.aerial_area_interpretations = [
      { area_id: "WESTERN-CENTRAL-CANOPY", label: "DENSER LARGE-TREE CANOPY", information_class: "AERIAL_INTERPRETATION", observations: ["darker", "more continuous large-tree crowns", "heavier mature-tree canopy"], field_confirmation_status: "NOT_FIELD_CONFIRMED", geometry_status: "NOT_YET_TRACED" },
      { area_id: "AUGUST4-MARSHY-TRANSITION", label: "FIELD-CONFIRMED MARSHY CLEARING", information_class: "INSPECTOR_FIELD_CONFIRMATION", observations: ["marshy clearing", "lower or thinner vegetation", "soft ground", "standing water observed during the August 4 inspection"], field_confirmation_status: "CONFIRMED_BY_INSPECTOR", geometry_status: "APPROXIMATE_LOCATION_ON_AUGUST_4_REACHED_ROUTE; EXACT_BOUNDARY_NOT_ESTABLISHED" },
      { area_id: "EAST-OF-MAIN-CREEK", label: "THINNER TREE CANOPY / LIKELY LOW BRUSH OR MARSH", information_class: "AERIAL_INTERPRETATION", observations: ["noticeably fewer continuous large-tree crowns", "lighter and patchier vegetation", "scattered large trees", "branching creek and drainage features", "probable low brush, marsh vegetation, or wet flats"], field_confirmation_status: "NOT_FIELD_CONFIRMED", prohibited_conclusions: ["dry", "open upland", "buildable", "easy vehicle access", "cleared land"], geometry_status: "NOT_YET_TRACED" }
    ];
    model.report_conclusion = "The Apple Maps imagery shows a substantial reduction in mature-tree canopy toward the east, especially beyond the visible creek network. This may improve visibility and reduce large-tree clearing, but it does not establish dry or usable land. The lighter area may instead represent marsh, wet flats, and dense lower vegetation.";
    model.prediction_method = ["darkness or lightness", "texture", "visible crown shape", "width", "winding or branching form", "connection to other drainage features", "agreement with field-confirmed reference areas"];
    model.what_to_expect_today = [
      "Apple Maps appears to show several winding creek or drainage channels across the large tract, especially toward the eastern side.",
      "Darker areas may contain large trees. Some may be relatively easy to walk under.",
      "Lighter mottled areas likely contain dense 2–3-inch tangled brush about 10–12 feet tall and may be much harder to travel through.",
      "Some areas appear to contain both large trees and dense brush underneath.",
      "Standing water may be hidden beneath either vegetation type.",
      "The mature woods thin substantially toward the eastern side, especially after the main creek. The lighter eastern area appears to contain fewer large trees, but it may consist of marsh, wet flats, and dense lower brush rather than dry open land.",
      "The location reached during the August 4 walk was largely a marshy clearing, not a trail.",
      "Winding dark lines likely indicate creeks or drainage channels.",
      "The August 4 walked route remained soft and mostly under 2–4 inches of standing water, with some locations near 8 inches. No dry ground was reached.",
      "The eastern portion should not be assumed dry merely because some mapped elevations appear higher.",
      "Creek valleys and drainage channels may cross otherwise higher areas.",
      "Dry usable acreage has not yet been established.",
      "Most of the small tract previously observed was dry.",
      "Wear waterproof boots.",
      "Do not walk into deeper water merely to complete the map."
    ];
    model.source_review_status = model.source_review_status || {
      aerial_imagery: "INSPECTOR_SCREENSHOT_INTERPRETATION_RECORDED; PROVIDER DATE AND RESOLUTION NOT ESTABLISHED",
      elevation_hillshade: "AVAILABLE_AS_OFFLINE_USGS_TERRAIN_CONTEXT; DERIVED LOW AREAS NEED REVIEW",
      national_hydrography: "NOT_YET_RETRIEVED",
      wetlands_inventory: "NOT_YET_RETRIEVED",
      soils: "NOT_YET_RETRIEVED",
      flood_mapping: "NOT_YET_RETRIEVED",
      recent_rainfall: "OFFICIAL_STATION_CONTEXT_REQUESTED_NONBLOCKING",
      gauges: "NOT_YET_RETRIEVED",
      prior_route: "AUGUST_4_REFERENCE_ROUTE_INCLUDED"
    };
    model.dry_weather_return_plan = model.dry_weather_return_plan || {
      status: "WAIT_FOR_MEANINGFULLY_DRIER_CONDITIONS",
      readiness_statement: "Conditions are not yet meaningfully drier.",
      readiness_basis: "Official rainfall since the first inspection, mostly dry days, later storm events, and nearby gauge trends must be evaluated before changing this status.",
      recommended_repeat_locations: ["beginning of the large-tract route", "representative 2–4-inch location", "deepest observed location", "furthest reached point", "visible creek or channel crossing", "any materially changed condition"],
      do_not_prompt_every_gps_point: true
    };
    return model;
  }

  function addAerialTrace(inspection, options) {
    const model = ensureModel(inspection);
    const settings = options || {};
    if (![...TRACE_TYPES, ...LEGACY_TRACE_TYPES].includes(settings.trace_type)) throw new Error("Choose what the aerial image appears to show.");
    const coordinates = Array.isArray(settings.coordinates) ? settings.coordinates.filter(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))).map(point => [Number(point[0]), Number(point[1])]) : [];
    if (coordinates.length < 2) throw new Error("Tap at least two map points for this trace.");
    const number = Number(model.next_trace_number) || 1;
    model.next_trace_number = number + 1;
    const trace = {
      trace_id: `AERIAL-TRACE-${String(number).padStart(3, "0")}`,
      information_class: "AERIAL_INTERPRETATION",
      trace_type: settings.trace_type,
      geometry: { type: settings.trace_type.includes("AREA") && coordinates.length > 2 ? "Polygon" : "LineString", coordinates: settings.trace_type.includes("AREA") && coordinates.length > 2 ? [[...coordinates, coordinates[0]]] : coordinates },
      source: "inspector-supplied Apple Maps screenshot",
      interpretation_date: settings.interpretation_date || new Date().toISOString(),
      reviewer: settings.reviewer || "Inspector",
      confidence: settings.confidence || "uncertain",
      field_confirmation_status: "NOT_FIELD_CONFIRMED",
      not_a_survey: true,
      not_a_regulatory_wetland_determination: true,
      merge_rule: "Do not merge with field-observed water unless locations overlap within documented uncertainty.",
      prediction_label: "PREDICTED FROM AERIAL IMAGE — CHECK ON THE GROUND",
      reference_area_used: settings.reference_area_used || (settings.trace_type === "LIKELY DENSE 2–3 INCH BRUSH" ? "Small tract field-calibrated light mottled dense-brush pattern" : null),
      append_only: true
    };
    model.aerial_traces.push(trace);
    return trace;
  }

  function confirmPrediction(inspection, options) {
    const model = ensureModel(inspection);
    const settings = options || {};
    const allowed = ["YES — MOSTLY SMALL BRUSH", "NO — MOSTLY LARGER TREES", "MIXED BRUSH AND TREES", "WET OR UNDERWATER", "CANNOT SEE ENOUGH", "SKIP"];
    if (!allowed.includes(settings.answer)) throw new Error("Choose what is actually here.");
    if (!settings.position) throw new Error("WAIT HERE — GPS is not ready. Nothing was recorded yet.");
    const details = Array.isArray(settings.details) ? settings.details.filter(item => ["SMALL BRUSH", "MOSTLY 1–2 INCHES", "MOSTLY 2–3 INCHES", "NO BRUSH LARGER THAN 3 INCHES OBSERVED", "SCATTERED LARGE TREES", "NO LARGE TREES OBSERVED"].includes(item)) : [];
    const record = {
      field_prediction_check_id: `PREDICTION-CHECK-${String(model.field_prediction_checks.length + 1).padStart(3, "0")}`,
      information_class: "OBSERVED_ON_SITE",
      aerial_trace_id: settings.aerial_trace_id || null,
      aerial_prediction: settings.aerial_prediction || "UNKNOWN",
      field_observation: settings.answer,
      field_details: details,
      agreement_status: settings.answer === "SKIP" || settings.answer === "CANNOT SEE ENOUGH" ? "NOT_DETERMINED" : (settings.answer === "YES — MOSTLY SMALL BRUSH" ? "AGREES" : "DIFFERS_OR_PARTLY_DIFFERS"),
      recorded_at: settings.recorded_at || new Date().toISOString(),
      latitude: Number(settings.position.lat), longitude: Number(settings.position.lon),
      gps_accuracy_m: settings.position.accuracy_m == null ? null : Number(settings.position.accuracy_m),
      imagery_provider: "Apple Maps", imagery_date: null,
      photo_ids: [], voice_note_ids: [], append_only: true
    };
    model.field_prediction_checks.push(record);
    return record;
  }

  function addPredictionFieldChoice(inspection, options) {
    const model = ensureModel(inspection);
    const settings = options || {};
    const allowed = ["NO LARGE TREES OBSERVED", "SCATTERED LARGE TREES", "MANY LARGE TREES", "NEARLY CONTINUOUS LARGE-TREE CANOPY", "OPEN UNDERNEATH", "MOSTLY OPEN UNDERBRUSH", "LIGHT SMALL BRUSH", "DENSE 1–2-INCH BRUSH", "DENSE 2–3-INCH TANGLED BRUSH", "ABOUT 10–12 FOOT BRUSH CANOPY", "EASY TO WALK THROUGH", "MODERATELY DIFFICULT", "VERY DIFFICULT", "CANNOT TRAVEL WITHOUT CUTTING", "MARSH / WET FLAT", "STANDING WATER", "DRY AND FIRM", "FIRM AND DRY", "SOFT WITHOUT VISIBLE WATER", "STANDING WATER MOSTLY 2–4 INCHES", "LOCAL WATER APPROXIMATELY 8 INCHES", "WATER DEPTH UNKNOWN", "CREEK OR DRAINAGE", "CREEK OR CHANNEL", "CANNOT REACH", "AERIAL PREDICTION WRONG", "SKIP"];
    if (!allowed.includes(settings.choice)) throw new Error("Choose what is actually here.");
    if (!settings.position) throw new Error("WAIT HERE — GPS is not ready. Nothing was recorded yet.");
    let record = settings.field_prediction_check_id ? model.field_prediction_checks.find(item => item.field_prediction_check_id === settings.field_prediction_check_id) : null;
    if (!record) {
      record = {
        field_prediction_check_id: `PREDICTION-CHECK-${String(model.field_prediction_checks.length + 1).padStart(3, "0")}`,
        information_class: "OBSERVED_ON_SITE",
        aerial_trace_id: settings.aerial_trace_id || null,
        aerial_prediction: settings.aerial_prediction || "LIKELY DENSE 2–3 INCH BRUSH",
        field_observation: "MULTIPLE_IMMEDIATE_FIELD_CHOICES",
        field_details: [], selection_events: [],
        agreement_status: "NOT_YET_DETERMINED",
        recorded_at: settings.recorded_at || new Date().toISOString(),
        latitude: Number(settings.position.lat), longitude: Number(settings.position.lon),
        gps_accuracy_m: settings.position.accuracy_m == null ? null : Number(settings.position.accuracy_m),
        imagery_provider: "Apple Maps", imagery_date: null,
        photo_ids: [], voice_note_ids: [], append_only: true
      };
      model.field_prediction_checks.push(record);
    }
    const time = settings.recorded_at || new Date().toISOString();
    record.selection_events.push({ choice: settings.choice, recorded_at: time, latitude: Number(settings.position.lat), longitude: Number(settings.position.lon), gps_accuracy_m: settings.position.accuracy_m == null ? null : Number(settings.position.accuracy_m), append_only: true });
    if (settings.choice !== "SKIP" && !record.field_details.includes(settings.choice)) record.field_details.push(settings.choice);
    if (settings.choice === "SKIP") record.agreement_status = record.field_details.length ? record.agreement_status : "NOT_DETERMINED";
    else if (settings.choice === "AERIAL PREDICTION WRONG") record.agreement_status = "DISAGREES";
    else if (["MARSH / WET FLAT", "STANDING WATER", "SOFT WITHOUT VISIBLE WATER", "DENSE 2–3-INCH TANGLED BRUSH", "SCATTERED LARGE TREES", "MOSTLY OPEN UNDERBRUSH", "CREEK OR CHANNEL", "ABOUT 10–12 FOOT BRUSH CANOPY", "VERY DIFFICULT", "CANNOT TRAVEL WITHOUT CUTTING"].includes(settings.choice)) record.agreement_status = record.agreement_status === "DISAGREES" ? "CONFLICT_REQUIRES_REVIEW" : "AGREES_OR_PARTLY_AGREES";
    else record.agreement_status = record.agreement_status === "AGREES_OR_PARTLY_AGREES" ? "PARTLY_AGREES" : "DIFFERS_OR_PARTLY_DIFFERS";
    record.updated_at = time;
    return record;
  }

  function markStoppingPoint(inspection, position, reason, recordedAt) {
    const model = ensureModel(inspection);
    if (!position) throw new Error("WAIT HERE — GPS is not ready. Nothing was recorded yet.");
    const point = {
      stopping_point_id: `STOP-${String(model.stopping_points.length + 1).padStart(3, "0")}`,
      information_class: "OBSERVED_ON_SITE",
      recorded_at: recordedAt || new Date().toISOString(),
      latitude: Number(position.lat), longitude: Number(position.lon),
      gps_accuracy_m: position.accuracy_m == null ? null : Number(position.accuracy_m),
      reason: reason || "Wet conditions continued beyond the point where the inspector stopped.",
      condition_beyond: "UNKNOWN",
      append_only: true
    };
    model.stopping_points.push(point);
    return point;
  }

  function addReturnObservation(inspection, choice, position, recordedAt) {
    const model = ensureModel(inspection);
    if (!RETURN_CHOICES.includes(choice)) throw new Error("Choose what is here now.");
    if (!position) throw new Error("WAIT HERE — GPS is not ready. Nothing was recorded yet.");
    const record = {
      return_observation_id: `RETURN-${String(model.return_visit_observations.length + 1).padStart(3, "0")}`,
      information_class: "OBSERVED_ON_SITE", observation: choice,
      recorded_at: recordedAt || new Date().toISOString(),
      latitude: Number(position.lat), longitude: Number(position.lon),
      gps_accuracy_m: position.accuracy_m == null ? null : Number(position.accuracy_m),
      comparison_route_date: "2026-08-04", append_only: true,
      photo_ids: [], voice_note_ids: []
    };
    model.return_visit_observations.push(record);
    return record;
  }

  function analysisModel(inspection) {
    const model = ensureModel(inspection);
    return {
      schema_name: model.schema_name, schema_version: model.schema_version,
      what_to_expect_today: model.what_to_expect_today,
      aerial_interpretations: model.aerial_interpretations,
      aerial_calibrations: model.aerial_calibrations,
      interpretation_corrections: model.interpretation_corrections,
      aerial_area_interpretations: model.aerial_area_interpretations,
      report_conclusion: model.report_conclusion,
      aerial_pattern_classes: model.aerial_pattern_classes,
      independent_field_layers: model.independent_field_layers,
      controlling_inspector_observations: model.controlling_inspector_observations,
      prediction_method: model.prediction_method,
      aerial_traces: model.aerial_traces,
      field_prediction_checks: model.field_prediction_checks,
      source_review_status: model.source_review_status,
      dry_weather_return_plan: model.dry_weather_return_plan,
      return_visit_observations: model.return_visit_observations,
      stopping_points: model.stopping_points,
      rules: [
        "Aerial interpretations are not field observations.",
        "A pale aerial area is not evidence of dry, open, firm, buildable ground or wetlands.",
        "Large-tree canopy does not establish walking difficulty or underbrush condition.",
        "Vegetation appearance does not establish ground or water condition.",
        "Mapped higher ground is not necessarily dry.",
        "Unvisited acreage remains unknown."
      ]
    };
  }

  return { AERIAL_TYPES, TRACE_TYPES, RETURN_CHOICES, ensureModel, addAerialTrace, confirmPrediction, addPredictionFieldChoice, markStoppingPoint, addReturnObservation, analysisModel };
});
