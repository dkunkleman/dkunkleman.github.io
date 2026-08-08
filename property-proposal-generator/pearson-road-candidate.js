(function (root) {
  "use strict";
  root.PEARSON_PROPOSAL_INPUT = {
    property_id: "221S280000001010000",
    proposal_id: "PEARSON-ROAD-PROPERTY-REVEAL-001",
    proposal_version: 1,
    proposal_status: "DRAFT",
    customer: { name: "UNKNOWN" },
    property: { name: "Pearson Road", address: "Pearson Road - exact customer-facing address pending approval" },
    map_url: "../pearson-road-map/index.html",
    payment: { status: "DRAFT", terms: "UNKNOWN" },
    options: [
      {
        option_id: "OPTION-A", option_code: "A", proposal_zone_id: "PROPOSAL-A-PEARSON-ROAD", proposal_template: "SMALL_CREEK_PATH", service_code: "CREEK-PATH", customer_title: "Creek Walk Reveal", width_ft: 5,
        geometry: { type: "LineString", coordinates: [[-87.09269,30.49008],[-87.09253,30.49014],[-87.09236,30.49030],[-87.09237,30.49055],[-87.09229,30.49063],[-87.09216,30.49071],[-87.09220,30.49078],[-87.09218,30.49088],[-87.09210,30.49096],[-87.09199,30.49103],[-87.09191,30.49112],[-87.09186,30.49117]] },
        property_specific_scope: ["Follow the approved southeast creek-side route on the small parcel."], package_included: true
      },
      {
        option_id: "OPTION-B", option_code: "B", proposal_zone_id: "PROPOSAL-B-PEARSON-ROAD", proposal_template: "SMALL_CLEARING_PATHS", service_code: "HOMESITE-REVEAL", customer_title: "Small Homesite / Approach / Sunset Reveal",
        geometry: { type: "Polygon", coordinates: [[[-87.092310,30.490217],[-87.092048,30.490217],[-87.092048,30.489922],[-87.092032,30.489922],[-87.092032,30.490217],[-87.092000,30.490217],[-87.092000,30.490541],[-87.092310,30.490541],[-87.092310,30.490217]]] },
        property_specific_scope: ["Selective house opening among mature trees.", "South 5-foot walking approach.", "Northwest 5-foot approach remains TBD and unpriced by quantity.", "Westward sunset sightline is directional only and does not add clearing area."],
        sunset_view_sightline: [[-87.092155,30.490379],[-87.092731,30.490379]], sunset_view_target_width_ft: 40, package_included: true
      },
      {
        option_id: "OPTION-C", option_code: "C", proposal_zone_id: "PROPOSAL-C-PEARSON-ROAD", proposal_template: "SMALL_EASTERN_HOMESITE", service_code: "HEAVY-BRUSH", customer_title: "Eastern Heavy-Brush Reveal",
        geometry: { type: "Polygon", coordinates: [[[-87.091489,30.490769],[-87.091439,30.490868],[-87.091393,30.490952],[-87.091310,30.490978],[-87.091169,30.490972],[-87.091058,30.490946],[-87.091027,30.490850],[-87.091024,30.490740],[-87.090984,30.490597],[-87.091020,30.490504],[-87.091064,30.490431],[-87.091125,30.490381],[-87.091190,30.490348],[-87.091267,30.490327],[-87.091353,30.490303],[-87.091405,30.490393],[-87.091454,30.490426],[-87.091433,30.490554],[-87.091489,30.490640],[-87.091489,30.490769]]] },
        property_specific_scope: ["Predominantly 3-4 inch woody brush, subject to field verification.", "Reveal possible future pasture, paddock, homesite, yard, open woodland, or recreation; do not represent this as finished pasture."], package_included: true
      },
      {
        option_id: "OPTION-D", option_code: "D", proposal_zone_id: "PROPOSAL-D-PEARSON-ROAD", proposal_template: "LARGE_WESTERN_HOMESITE", service_code: "HOMESITE-REVEAL", customer_title: "Large Homesite / Approach / Sunset Reveal",
        geometry: { type: "Polygon", coordinates: [[[-87.092730,30.488880],[-87.092360,30.488880],[-87.092360,30.489050],[-87.092470,30.489050],[-87.092470,30.489580],[-87.092486,30.489580],[-87.092486,30.489050],[-87.092730,30.489050],[-87.092730,30.488880]]] },
        property_specific_scope: ["Candidate opening and 5-foot Pearson Road walking connection.", "West-facing 40-foot sunset-view target remains selective view work within or at the opening and does not add separate clearing area."],
        sunset_view_sightline: [[-87.092545,30.488965],[-87.092730,30.488965]], sunset_view_target_width_ft: 40, package_included: true
      }
    ]
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
