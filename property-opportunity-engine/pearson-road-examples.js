(function (root) {
  "use strict";
  root.PEARSON_LIKE_OPPORTUNITY_CONTEXT = {
    example_status: "PEARSON-LIKE REGRESSION INPUT — NOT SOURCE EVIDENCE",
    property_id: "PEARSON-ROAD-EXAMPLE",
    customer_type: "SELLER_LISTING_AGENT",
    clock: function () { return "2026-08-08T18:00:00.000Z"; },
    observations: [
      {id:"OBS-WATER-001",record_type:"OBSERVATION",tags:["RECORDED_WATER_FEATURE","OBSTRUCTED_ACCESS_OR_VIEW"],statement:"Recorded creek/water feature with obstructed physical and visual access."},
      {id:"OBS-BRUSH-HEAVY-001",record_type:"OBSERVATION",tags:["BRUSH_3_4_INCH","OBSTRUCTING_VEGETATION"],statement:"Principally 3–4 inch woody brush recorded in an eastern candidate area."},
      {id:"OBS-BRUSH-LIGHT-001",record_type:"OBSERVATION",tags:["BRUSH_1_2_INCH","OBSTRUCTING_VEGETATION"],statement:"Principally 1–2 inch brush recorded near a candidate use area."},
      {id:"OBS-TREES-001",record_type:"OBSERVATION",tags:["IMPORTANT_MATURE_TREES"],statement:"Important mature pines and hardwoods recorded for preservation review."},
      {id:"OBS-WETLAND-QUESTION-001",record_type:"OBSERVATION",tags:["OUT_OF_SCOPE_QUESTION"],question:"Where are jurisdictional wetland limits?",professional_type:"WETLAND_PROFESSIONAL",safety_related:false}
    ],
    photos: [
      {id:"PHOTO-WATER-001",record_type:"PHOTO",tags:["WATER","BASELINE"],statement:"Geolocated water photograph."},
      {id:"PHOTO-WATER-002",record_type:"PHOTO",tags:["WATER"],statement:"Second geolocated water photograph."},
      {id:"PHOTO-BRUSH-001",record_type:"PHOTO",tags:["BRUSH"],statement:"Representative brush photograph."}
    ],
    assets: [
      {id:"ASSET-CULVERT-001",record_type:"ASSET",tags:["REPEATED_WATER_OR_CULVERT_ASSET"],statement:"Culvert identified for repeated water-height comparison."}
    ],
    proposal_zones: [
      {id:"ZONE-A-CREEK-PATH",record_type:"PROPOSAL_ZONE",tags:["CANDIDATE_ACCESS_CORRIDOR"],length_ft:526,measurement_status:"APPROXIMATE"},
      {id:"ZONE-B-SMALL-HOMESITE",record_type:"PROPOSAL_ZONE",tags:["CANDIDATE_USE_AREA","RELEVANT_USE_AREA","BRUSH_1_2_INCH","VIEW_DIRECTION","PROPOSED_CLEARING_GEOMETRY"],geometry_status:"APPROVED_FOR_DRAFT",source_observation_ids:["OBS-BRUSH-LIGHT-001"]},
      {id:"ZONE-C-HEAVY-BRUSH",record_type:"PROPOSAL_ZONE",tags:["RELEVANT_USE_AREA","BRUSH_3_4_INCH","PROPOSED_CLEARING_GEOMETRY"],geometry_status:"DRAFT",source_observation_ids:["OBS-BRUSH-HEAVY-001"]},
      {id:"ZONE-NW-UNKNOWN-PATH",record_type:"PROPOSAL_ZONE",tags:["CANDIDATE_ACCESS_CORRIDOR"],length_ft:null,measurement_status:"TBD"},
      {id:"ZONE-FUTURE-REVEAL-001",record_type:"PROPOSAL_ZONE",tags:["ADDITIONAL_REVEAL_CANDIDATE"],geometry_status:"DRAFT"}
    ],
    work_orders: [
      {id:"WORK-REVEAL-001",record_type:"WORK_RECORD",status:"COMPLETED",proposal_zone_ids:["ZONE-B-SMALL-HOMESITE"],before_photo_ids:["PHOTO-BRUSH-001"],after_photo_ids:[],maintenance_review_due:true,maintenance_scheduled:false}
    ],
    customer_interactions: [
      {id:"INTERACTION-FAVORITE-001",record_type:"CUSTOMER_INTERACTION",interaction_type:"PHOTO_FAVORITE",photo_id:"PHOTO-WATER-001"},
      {id:"INTERACTION-FAVORITE-002",record_type:"CUSTOMER_INTERACTION",interaction_type:"PHOTO_FAVORITE",photo_id:"PHOTO-WATER-002"},
      {id:"INTERACTION-ZONE-001",record_type:"CUSTOMER_INTERACTION",interaction_type:"ZONE_SELECTED",proposal_zone_id:"ZONE-A-CREEK-PATH"},
      {id:"INTERACTION-SHOWING-001",record_type:"CUSTOMER_INTERACTION",interaction_type:"SHOWING_SCHEDULED"}
    ],
    events: [
      {id:"EVENT-STORM-001",record_type:"EXTERNAL_EVENT",tags:["SIGNIFICANT_STORM_EVENT"],statement:"Example significant storm event; parcel effect not yet observed."}
    ],
    repeat_photo_points: [{id:"PHOTO-POINT-WATER-001",record_type:"REPEAT_PHOTO_POINT"}]
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
