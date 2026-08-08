const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "pearson-road-map", "data");
const propertyId = "221S280000001010000";

const visiblyWet = {
  "2026-08-03": [
    13,14,15,16,17,18,19,20,21,22,24,25,26,
    31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,
    68,69,70,71,72,
    107,108,109,110,111,112,114,115,116,117,118,122,123,125,127,
    132,133,134,135,136,143,144,145,157,158,159,162,163
  ],
  "2026-08-05": [
    10,11,12,13,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,
    34,35,36,37,39,40,41,42,43,44,45,46,47,48
  ],
  "2026-08-07": [90,91,94,96,97,98,99,104,105,106,107,108,109,111,112,113,114]
};

const possiblyWet = {
  "2026-08-03": [23,113,121,165],
  "2026-08-05": [14,33,38],
  "2026-08-07": [92,93]
};

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
}

function write(name, value) {
  fs.writeFileSync(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function parcelPart(point, rings) {
  if (pointInRing(point, rings[0])) return "LARGE_PARCEL";
  if (pointInRing(point, rings[1])) return "SMALL_PARCEL";
  return null;
}

function photoKey(feature) {
  const number = Number(String(feature.properties.photo_number || "").replace(/\D/g, ""));
  return { date: feature.properties.inspection_date, number };
}

function inList(lists, date, number) {
  return Boolean(lists[date] && lists[date].includes(number));
}

const parcelSource = JSON.parse(
  fs.readFileSync(
    path.join(root, "field-simple-test-direct-v10-where-am-i-v5", "assets", "parcels.json"),
    "utf8"
  )
);
const sourceParcel = parcelSource.features.find((feature) => feature.attributes.PAR_NUM === propertyId);
if (!sourceParcel || sourceParcel.geometry.rings.length !== 2) {
  throw new Error("Expected the Pearson Road subject parcel to contain exactly two source rings.");
}
const [largeRing, smallRing] = sourceParcel.geometry.rings;

const parcelParts = {
  type: "FeatureCollection",
  name: "PEARSON_ROAD_LARGE_AND_SMALL_PARCELS",
  properties: {
    property_id: propertyId,
    county_recorded_total_acres: sourceParcel.attributes.CALC_ACRE,
    source: "Frozen v5 county parcel geometry",
    source_geometry_modified: false,
    limitation: "Phone GPS and county parcel geometry are approximate and are not a survey."
  },
  features: [
    {
      type: "Feature",
      id: `${propertyId}-LARGE`,
      properties: {
        property_id: propertyId,
        parcel_part_id: `${propertyId}-LARGE`,
        display_name: "LARGE PARCEL",
        county_recorded_total_acres: sourceParcel.attributes.CALC_ACRE,
        component_acres: null,
        information_class: "COUNTY_PARCEL_GEOMETRY",
        source_ring_index: 0
      },
      geometry: { type: "Polygon", coordinates: [largeRing] }
    },
    {
      type: "Feature",
      id: `${propertyId}-SMALL`,
      properties: {
        property_id: propertyId,
        parcel_part_id: `${propertyId}-SMALL`,
        display_name: "SMALL PARCEL",
        county_recorded_total_acres: sourceParcel.attributes.CALC_ACRE,
        component_acres: null,
        information_class: "COUNTY_PARCEL_GEOMETRY",
        source_ring_index: 1
      },
      geometry: { type: "Polygon", coordinates: [smallRing] }
    }
  ]
};
write("PEARSON_LARGE_SMALL_PARCELS.geojson", parcelParts);

const photos = read("ALL_PHOTO_POINTS.geojson");
const reviewedPhotos = [];
const visualReviewRows = [];

for (const feature of photos.features) {
  const part = parcelPart(feature.geometry.coordinates, sourceParcel.geometry.rings);
  if (!part) continue;
  const { date, number } = photoKey(feature);
  const recordedWater = feature.properties.is_recorded_water_category === true || feature.properties.display_class === "WATER";
  const clearlyVisible = inList(visiblyWet, date, number);
  const possible = inList(possiblyWet, date, number);
  if (!recordedWater && !clearlyVisible && !possible) continue;

  const reviewClass = recordedWater
    ? "RECORDED_WATER"
    : clearlyVisible
    ? "VISIBLE_WATER_IN_PHOTO"
    : "POSSIBLE_WATER_IN_PHOTO";
  const confidence = recordedWater ? "SOURCE_RECORDED" : clearlyVisible ? "HIGH_OR_MODERATE" : "LOW_REVIEW_REQUIRED";
  const copy = JSON.parse(JSON.stringify(feature));
  copy.properties = {
    ...copy.properties,
    parcel_part: part,
    water_review_class: reviewClass,
    water_review_confidence: confidence,
    water_review_source: recordedWater ? "FIELD_APP_RECORDED_CATEGORY" : "2026-08-08_VISUAL_CONTACT_SHEET_REVIEW",
    original_recorded_category: feature.properties.recorded_category,
    original_evidence_modified: false,
    review_limitation: recordedWater
      ? "Recorded as water by the field application; image appearance is supporting evidence."
      : possible
      ? "Possible visible water; retain for inspector review before using it as a conclusion."
      : "Water is visibly present in the photograph; this visual review does not establish extent, duration, cause, or regulatory status."
  };
  reviewedPhotos.push(copy);
  visualReviewRows.push({
    photo_id: feature.properties.photo_id,
    photo_number: feature.properties.photo_number,
    inspection_date: date,
    parcel_part: part,
    original_recorded_category: feature.properties.recorded_category,
    water_review_class: reviewClass,
    water_review_confidence: confidence,
    thumbnail_path: feature.properties.thumbnail_path
  });
}

write("ALL_WATER_PHOTO_REVIEW.geojson", {
  type: "FeatureCollection",
  name: "ALL_WATER_PHOTO_REVIEW",
  properties: {
    generated_at: "2026-08-08",
    property_id: propertyId,
    original_evidence_modified: false,
    review_rule: "Recorded water is preserved as recorded. Additional visible-water and possible-water labels are separate visual-review interpretations."
  },
  features: reviewedPhotos
});
write("ALL_WATER_PHOTO_REVIEW.json", {
  schema_name: "pearson-water-photo-visual-review",
  generated_at: "2026-08-08",
  property_id: propertyId,
  original_evidence_modified: false,
  counts: visualReviewRows.reduce((accumulator, row) => {
    accumulator[row.water_review_class] = (accumulator[row.water_review_class] || 0) + 1;
    return accumulator;
  }, {}),
  photographs: visualReviewRows
});

const findings = read("ALL_FIELD_FINDINGS.geojson");
const propertyBounds = { minX: -87.0932, maxX: -87.0840, minY: 30.4862, maxY: 30.4921 };
const waterFindings = findings.features
  .filter((feature) => String(feature.properties.display_class || "").toUpperCase() === "WATER")
  .filter((feature) => {
    const [x, y] = feature.geometry.coordinates;
    return x >= propertyBounds.minX && x <= propertyBounds.maxX && y >= propertyBounds.minY && y <= propertyBounds.maxY;
  })
  .map((feature) => {
    const copy = JSON.parse(JSON.stringify(feature));
    copy.properties = {
      ...copy.properties,
      parcel_part: parcelPart(feature.geometry.coordinates, sourceParcel.geometry.rings) || "NEAR_PARCEL_GPS_UNCERTAINTY",
      original_evidence_modified: false
    };
    return copy;
  });
write("ALL_SUBJECT_WATER_FINDINGS.geojson", {
  type: "FeatureCollection",
  name: "ALL_SUBJECT_WATER_FINDINGS",
  properties: {
    property_id: propertyId,
    original_evidence_modified: false,
    boundary_rule: "Includes recorded water findings inside either subject-parcel component and nearby points that may reflect phone-GPS uncertainty."
  },
  features: waterFindings
});

const sections = read("ALL_MAPPED_SECTIONS.geojson");
const sectionLines = sections.features
  .filter((feature) => feature.geometry.type === "LineString")
  .filter((feature) => {
    const status = feature.properties.display_status || "";
    const id = feature.properties.section_id;
    if (status === "SOURCE_SECTION_GEOMETRY") return true;
    if (status === "FILTERED_DISPLAY_WITH_SOURCE_POINTS_PRESERVED") return true;
    return status === "RAW_SOURCE_POINTS_AND_LINES" && ["SECTION-001", "SECTION-002", "SECTION-003"].includes(id);
  })
  .map((feature) => {
    const copy = JSON.parse(JSON.stringify(feature));
    const isAug7Transition = copy.properties.source_file.includes("AUG7_") && ["SECTION-004", "SECTION-005", "SECTION-006", "SECTION-007"].includes(copy.properties.section_id);
    copy.properties = {
      ...copy.properties,
      inspection_date: copy.properties.source_file.includes("AUG7_") ? "2026-08-07" : "2026-08-05",
      interpretation_role: isAug7Transition ? "AUGUST_7_WET_DRY_TRANSITION_WALK" : "MAPPED_SECTION_FOR_WET_DRY_REVIEW",
      interpretation_source: isAug7Transition ? "INSPECTOR_POST_FIELD_CLARIFICATION" : "INSPECTOR_STATED_SECTION_PURPOSE",
      original_section_evidence_modified: false,
      limitation: "A mapped section line is field evidence for review; it is not a surveyed wet-area boundary."
    };
    return copy;
  });
write("ALL_WET_DRY_SECTION_LINES.geojson", {
  type: "FeatureCollection",
  name: "ALL_WET_DRY_SECTION_LINES",
  properties: {
    property_id: propertyId,
    original_evidence_modified: false,
    interpretation_statement: "The inspector states that these mapped sections were intended to help separate wet and dry conditions. Exact sides remain unknown except where separately confirmed."
  },
  features: sectionLines
});

console.log(
  JSON.stringify({
    parcel_parts: parcelParts.features.length,
    water_photo_review: visualReviewRows.reduce((accumulator, row) => {
      accumulator[row.water_review_class] = (accumulator[row.water_review_class] || 0) + 1;
      return accumulator;
    }, {}),
    recorded_water_findings: waterFindings.length,
    displayed_section_lines: sectionLines.length
  })
);
