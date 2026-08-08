(function () {
  "use strict";
  const Core = window.PropertyMapCore;
  const PROPERTY_ID = "221S280000001010000";
  const STORAGE_KEY = `property-intelligence-experience-map-v0.3:${PROPERTY_ID}`;
  const VIEWER_ID = sessionStorage.getItem("property-map-viewer") || `viewer-${Date.now().toString(36)}`;
  sessionStorage.setItem("property-map-viewer", VIEWER_ID);
  const DAY_COLORS = { "2026-08-03": "#e77728", "2026-08-04": "#8156a6", "2026-08-05": "#18815b", "2026-08-06": "#c44b67", "2026-08-07": "#1377c8" };
  const WORK_TYPES = ["CLEAR / REVEAL", "SELECTIVE BRUSH REMOVAL", "PRESERVE MATURE TREES", "OPEN VIEW CORRIDOR", "ACCESS IMPROVEMENT", "CULVERT / CROSSING", "DRAINAGE WORK", "TRAIL", "HOMESITE REVEAL", "PASTURE / OPEN AREA", "OTHER"];
  const PROPOSAL_V02_TITLE = "WESTERN FRONTAGE, ENTRANCE & WATER-FEATURE REVEAL";
  const PROPOSAL_V01_TITLE = PROPOSAL_V02_TITLE;
  const SEED_OLD_PROPOSAL = false;
  const PROPOSAL_TEMPLATES = {
    SMALL_CREEK_PATH: {
      parcel:"SMALL PARCEL", name:"SOUTHEAST CREEK-SIDE PATH",
      primary_objective:"Prepare a natural walking pathway along the southeast side of the creek so the water, mature trees, and creek-side experience can be seen safely from the small parcel.",
      included_scope:["Selectively open the approved creek-side path area", "Preserve mature trees, creek banks, roots, and drainage features", "Keep cut material out of the creek and water paths", "Create matched before-and-after photographs"],
      expected_benefit:"Let an owner or buyer walk beside and understand the creek as a property feature without altering the creek itself."
    },
    SMALL_CLEARING_PATHS: {
      parcel:"SMALL PARCEL", name:"SMALL-PARCEL CLEARING & TWO APPROACH PATHS",
      primary_objective:"Reveal one selected clearing and prepare understandable walking paths to it from both Pearson Road approaches: the north/south frontage and the northwest approach.",
      included_scope:["Selectively open the approved clearing", "Prepare one walking connection from the north/south Pearson Road frontage", "Prepare one walking connection from the northwest Pearson Road approach", "Preserve selected mature trees and useful privacy screening", "Create matched before-and-after photographs"],
      expected_benefit:"Help a buyer enter from either approach, reach the same clearing, and understand how the small parcel could be experienced."
    },
    LARGE_CLEARING: {
      parcel:"LARGE PARCEL", name:"LARGE-PARCEL PROPOSED CLEARED AREA",
      primary_objective:"Selectively reveal one bounded area on the large parcel so its ground, vegetation, water relationship, and potential use can be evaluated before any broader clearing decision.",
      included_scope:["Selectively clear only the approved box", "Preserve mature trees selected during the work", "Keep cut material out of observed water and drainage routes", "Create matched before-and-after photographs and update the property map"],
      expected_benefit:"Create one understandable test area that shows what additional large-parcel reveal work may accomplish without committing to clearing the entire tract."
    }
  };
  const HIGH_RESOLUTION_MAX_ZOOM = 22;
  const USGS_NATIVE_MAX_ZOOM = 16;
  const IMPORTANT_FINDING_CLASSES = new Set(["WATER","CULVERT","CULVERT_NEEDED","NO_CULVERT_NEEDED","DITCH_SWALE","ROAD_ENTRANCE","BLOCKED","PINE","HARDWOOD","MAGNOLIA","TREE","BRUSH","OPEN_AREA"]);
  const PROPOSAL_V01_PHOTOS = [
    "photo-9b78c354-2488-421a-802a-7e3c3927e035", "photo-3806255a-744e-47b3-80bf-48d0bd7e41dc",
    "photo-3788b8fd-8c39-469e-90db-680cf23b7928", "photo-067b4916-83f7-4bd7-bae7-05bafda11031",
    "photo-ade931ab-463f-4188-af5f-46a587eb8083", "photo-04c4b4fe-1c30-4a42-beb7-10adada56b6e",
    "photo-2c777f8f-ffc6-4b3e-9c7c-07112ac9f9ff", "photo-2a55f93f-197b-4cb9-adf3-294ce1d22ef4"
  ];
  const PROPOSAL_V01_GEOMETRY = [[
    [-87.09270,30.48857],[-87.09218,30.48857],[-87.09205,30.48872],[-87.09194,30.48940],
    [-87.09202,30.48966],[-87.09216,30.48977],[-87.09270,30.48961],[-87.09270,30.48857]
  ]];
  const files = {
    parcel: "data/PEARSON_LARGE_SMALL_PARCELS.geojson",
    gps: "data/ALL_GPS_POINTS.geojson",
    routes: "data/ALL_ROUTE_SEGMENTS.geojson",
    displayWalks: "data/DISPLAY_WALKS_CLEAN.geojson",
    photos: "data/ALL_PHOTO_POINTS.geojson",
    waterPhotos: "data/ALL_WATER_PHOTO_REVIEW.geojson",
    findings: "data/ALL_FIELD_FINDINGS.geojson",
    waterFindings: "data/ALL_SUBJECT_WATER_FINDINGS.geojson",
    sections: "data/ALL_MAPPED_SECTIONS.geojson",
    waterSections: "data/ALL_WET_DRY_SECTION_LINES.geojson",
    interpretation: "data/ALL_INSPECTOR_INTERPRETATIONS.geojson",
    wetDryInterpretation: "data/AUG7_INSPECTOR_WET_DRY_INTERPRETATION.geojson",
    aug7Transect: "data/AUG7_MAPPED_SECTIONS_FILTERED.geojson",
    summary: "data/ALL_INCURSIONS_SUMMARY.json"
  };
  const state = {
    model: loadModel(), source: {}, map: null, groups: {}, photoMarkers: new Map(), selectedPhotoId: null,
    selectedProposalId: null, mode: "EVIDENCE", filter: "WATER", activeDates: new Set(Object.keys(DAY_COLORS)), photoPulseMarker: null,
    draw: null, rectangleEditor: null, baseLayer: null, topoLayer: null, contourLayer: null, folderImages: new Map(),
    currentPhotoSet: [], currentPhotoIndex: -1, currentPhotoCollectionLabel: "ALL VISIBLE PHOTOS", touchStartX: null
  };
  let statusTimer = null;

  function loadModel() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && saved.schema_name === "property-intelligence-map" ? saved : Core.createModel(PROPERTY_ID);
    } catch (_) { return Core.createModel(PROPERTY_ID); }
  }
  function saveModel() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.model)); }
  function applyPresentationProfile(profile){state.model.presentation.profile=profile||"INTERNAL_EDITABLE";document.body.dataset.profile=state.model.presentation.profile;document.getElementById("customerViewToggle").textContent=state.model.presentation.profile==="CUSTOMER_REVIEW"?"DAVID VIEW":"CUSTOMER VIEW";closeControlPanel();saveModel();if(state.map)renderAll();setTimeout(()=>state.map&&state.map.invalidateSize(),0);}
  function closeControlPanel(){document.body.removeAttribute("data-open-panel");document.getElementById("controlDrawer").setAttribute("aria-hidden","true");document.querySelectorAll("[data-open-panel]").forEach(button=>button.classList.remove("active"));}
  function openControlPanel(panel){
    if(document.body.dataset.openPanel===panel)return closeControlPanel();
    if(panel==="proposal"){
      if(state.mode!=="PROPOSAL")document.querySelector('[data-mode="PROPOSAL"]').click();
      const zone=state.model.proposals.features.find((feature)=>feature.id===state.selectedProposalId)||state.model.proposals.features[0];
      if(zone)state.map.fitBounds(L.geoJSON(zone).getBounds().pad(.35));
    }
    document.body.dataset.openPanel=panel;
    document.getElementById("controlDrawer").setAttribute("aria-hidden","false");
    document.getElementById("drawerTitle").textContent=({layers:"LAYERS",visits:"VISITS",photos:"PHOTOS",proposal:"EDIT PROPOSAL",more:"MORE"})[panel]||"MAP OPTIONS";
    document.querySelectorAll("[data-open-panel]").forEach(button=>button.classList.toggle("active",button.dataset.openPanel===panel));
    setTimeout(()=>state.map&&state.map.invalidateSize(),0);
  }
  function deepFreeze(object) {
    if (!object || typeof object !== "object" || Object.isFrozen(object)) return object;
    Object.freeze(object); Object.values(object).forEach(deepFreeze); return object;
  }
  async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response.json(); }
  function status(message) {
    const bar=document.getElementById("mapStatus");
    bar.textContent=message;bar.classList.add("show");
    clearTimeout(statusTimer);statusTimer=setTimeout(()=>bar.classList.remove("show"),4200);
  }
  function p(feature) { return feature && feature.properties || {}; }
  function dateOf(feature, fallback) { return p(feature).inspection_date || p(feature).inspection_date_local || fallback || "2026-08-07"; }
  function photoPath(photo) {
    return state.folderImages.get(p(photo).photo_id) || p(photo).thumbnail_path || "";
  }
  function sourceCollections() {
    return Object.entries(state.source).filter(([, data]) => data && data.type === "FeatureCollection").map(([name, data]) => ({ name, feature_count: data.features ? data.features.length : 0, source: files[name] || "loaded-folder" }));
  }

  async function loadSource() {
    const entries = await Promise.all(Object.entries(files).map(async ([key, url]) => [key, await getJson(url)]));
    state.source = Object.fromEntries(entries);
    deepFreeze(state.source);
    state.model.source_evidence = { immutable: true, feature_collections: sourceCollections() };
    seedPresentationAndProposal();
    if (!state.selectedProposalId) state.selectedProposalId = state.model.proposals.features[0]?.id || null;
  }

  function seedPresentationAndProposal() {
    if (!state.model.market_benchmarks) state.model.market_benchmarks = [];
    if (!state.model.pricing_crew_models) state.model.pricing_crew_models = [];
    if (!state.model.production_tests) state.model.production_tests = [];
    if (!state.model.proposal_versions) state.model.proposal_versions = [];
    if (!state.model.accepted_proposals) state.model.accepted_proposals = [];
    if (!state.model.work_orders) state.model.work_orders = [];
    if (!state.model.recurring_opportunities) state.model.recurring_opportunities = [];
    if (!state.model.customer_engagement) state.model.customer_engagement = { questions: [], change_requests: [], zone_interest: [] };
    if (!state.model.customer_engagement.questions) state.model.customer_engagement.questions = [];
    if (!state.model.customer_engagement.change_requests) state.model.customer_engagement.change_requests = [];
    if (!state.model.customer_engagement.zone_interest) state.model.customer_engagement.zone_interest = [];
    if (!state.model.service_timeline) state.model.service_timeline = { lead_received_at:null, first_response_at:null, site_visit_at:null, proposal_delivered_at:null, work_started_at:null, work_completed_at:null };
    const existing = state.model.presentation.photo_metadata || [];
    state.model.presentation.photo_metadata = existing;
    PROPOSAL_V01_PHOTOS.forEach((id, index) => {
      const found = existing.find((item) => item.photo_id === id);
      const metadata = { photo_id: id, featured: true, featured_rank: index + 1, featured_reason: "Proposal V0.2 before-photo story; presentation metadata only", featured_by: "PROPOSAL DRAFT - DAVID REVIEW REQUIRED", featured_at: "2026-08-07T18:00:00.000Z" };
      if (found) Object.assign(found, metadata);
      else existing.push(metadata);
    });
    if (!state.model.presentation.customer_favorites) state.model.presentation.customer_favorites = [];
    ["photo-3806255a-744e-47b3-80bf-48d0bd7e41dc", "photo-3788b8fd-8c39-469e-90db-680cf23b7928"].forEach((id, index) => {
      if (!state.model.presentation.customer_favorites.some((item) => item.photo_id === id && item.viewer_or_session_id === "prototype-customer")) {
        state.model.presentation.customer_favorites.push({ favorite_id: `favorite-demo-${index + 1}`, photo_id: id, proposal_id: "PROPOSAL-ZONE-001", viewer_or_session_id: "prototype-customer", created_at: "2026-08-07T18:05:00.000Z", simulation: true });
      }
    });
    if (!state.model.proposals) state.model.proposals = { features: [], current_version: 0 };
    if (SEED_OLD_PROPOSAL && !state.model.proposals.features.some((feature) => feature.id === "PROPOSAL-ZONE-001")) {
      const coordinates = Core.clone(PROPOSAL_V01_GEOMETRY);
      const metrics = Core.polygonMetrics(coordinates);
      state.model.proposals.features.push({ type: "Feature", id: "PROPOSAL-ZONE-001", geometry: { type: "Polygon", coordinates }, properties: { proposal_zone_id: "PROPOSAL-ZONE-001", name: PROPOSAL_V01_TITLE, work_type: "CLEAR / REVEAL", service_type: "STARTER REVEAL", finish_level: "REVEAL FINISH", optional_upgrade: "UPGRADE TO CLEAN STAGING FINISH - NOT INCLUDED IN CURRENT PRICE", current_condition: "Dense smaller vegetation and documented standing-water locations obscure the western frontage, candidate entrance, and water-feature relationship.", existing_condition: "Dense smaller vegetation and documented standing-water locations obscure the western frontage, candidate entrance, and water-feature relationship.", primary_objective: "Make the proposed western approach and nearby water feature visible and understandable from the frontage while retaining the mature wooded character.", proposed_intervention: "Selective reveal using an approved work boundary; preserve mature trees and drainage evidence.", included_scope: ["Selectively cut designated smaller brush within the approved work polygon", "Open a visible and walkable relationship between the western frontage, candidate entrance, and nearby water feature", "Remove cut material from the staged zone and consolidate it onsite only at a David/customer-approved screened location", "Complete a final walk-through and matched after-photo record"], preserve: ["Mature pines and hardwoods unless separately approved", "The documented water/drainage feature and natural ground contours", "Vegetation outside the approved work polygon"], exclusions: ["No grading, excavation, stump grubbing, drainage engineering, or build-ready claim", "Clean Staging Finish is an optional upgrade, not included in the base Reveal Finish"], remove: ["Only selected smaller brush within the approved work polygon"], expected_benefit: "Help a buyer understand the western approach, see the water feature as part of the property story, and recognize the mature-tree setting.", expected_visible_result: "A legible western entrance-and-water-feature reveal, not a finished driveway, engineered drainage project, or build-ready site.", target_start: "UNKNOWN", target_completion: "UNKNOWN", completion_target: "NEEDS PRODUCTION TEST", price: null, price_status: "DRAFT", market_alternative_reference: "UNKNOWN", customer_selected: true, recommended_first_project: true, quantity: metrics.acreage, unit: "acre", acreage: metrics.acreage, perimeter_ft: metrics.perimeter_ft, approx_length_ft: metrics.approx_length_ft, approx_width_ft: metrics.approx_width_ft, geometry_measurement_basis: metrics.basis, color: "#f29f05", before_photo_ids: Core.clone(PROPOSAL_V01_PHOTOS), linked_before_photo_ids: Core.clone(PROPOSAL_V01_PHOTOS), geometry_status: "EVIDENCE-GROUNDED DRAFT - DAVID MUST APPROVE OR RESHAPE BEFORE CUSTOMER USE", evidence_status: "CONCEPTUAL PROPOSAL - NOT COMPLETED WORK" } });
    }
    const starter = state.model.proposals.features.find((feature) => feature.id === "PROPOSAL-ZONE-001");
    if (starter) {
      const props = starter.properties || (starter.properties = {});
      const upgradeToProposalV02 = props.proposal_release !== "V0.2";
      const defaults = {
        proposal_release:"V0.2", proposal_zone_id:"PROPOSAL-ZONE-001", name:PROPOSAL_V02_TITLE, service_type:"STARTER REVEAL", finish_level:"REVEAL FINISH",
        optional_upgrade:"UPGRADE TO CLEAN STAGING FINISH - NOT INCLUDED IN CURRENT PRICE",
        current_condition:props.existing_condition || "Dense smaller vegetation and documented standing-water locations obscure the western frontage, candidate entrance, and water-feature relationship.",
        primary_objective:"Make the proposed western approach and nearby water feature visible and understandable from the frontage while retaining the mature wooded character.",
        included_scope:["Selectively cut designated smaller brush within the approved work polygon", "Open a visible and walkable relationship between the western frontage, candidate entrance, and nearby water feature", "Remove cut material from the staged zone and consolidate it onsite only at a David/customer-approved screened location", "Complete a final walk-through and matched after-photo record"],
        preserve:["Mature pines and hardwoods unless separately approved", "The documented water/drainage feature and natural ground contours", "Vegetation outside the approved work polygon"],
        exclusions:["No grading, excavation, stump grubbing, drainage engineering, or build-ready claim", "Clean Staging Finish is an optional upgrade, not included in the base Reveal Finish"],
        remove:["Only selected smaller brush within the approved work polygon"],
        expected_benefit:"Help a buyer understand the western approach, see the water feature as part of the property story, and recognize the mature-tree setting.",
        expected_visible_result:"A legible western entrance-and-water-feature reveal, not a finished driveway, engineered drainage project, or build-ready site.",
        target_start:"UNKNOWN", target_completion:"UNKNOWN", completion_target:"NEEDS PRODUCTION TEST",
        price:null, price_status:"DRAFT", market_alternative_reference:"UNKNOWN", customer_selected:true, recommended_first_project:true, geometry_status:"EVIDENCE-GROUNDED DRAFT - DAVID MUST APPROVE OR RESHAPE BEFORE CUSTOMER USE",
        unit:"acre", before_photo_ids:Core.clone(PROPOSAL_V01_PHOTOS), linked_before_photo_ids:Core.clone(PROPOSAL_V01_PHOTOS)
      };
      if (upgradeToProposalV02) Object.assign(props, defaults);
      else Object.entries(defaults).forEach(([key,value]) => { if (props[key] === undefined) props[key] = value; });
      if (upgradeToProposalV02 || props.geometry_status === "CONCEPTUAL PLACEHOLDER - RESHAPE BEFORE CUSTOMER USE" || props.name === "A - WESTERN REVEAL" || props.name === "A â€” Western wet/dry reveal") {
        starter.geometry.coordinates = Core.clone(PROPOSAL_V01_GEOMETRY);
        Object.assign(props, { name:PROPOSAL_V02_TITLE, geometry_status:"EVIDENCE-GROUNDED DRAFT - DAVID MUST APPROVE OR RESHAPE BEFORE CUSTOMER USE", before_photo_ids:Core.clone(PROPOSAL_V01_PHOTOS), linked_before_photo_ids:Core.clone(PROPOSAL_V01_PHOTOS) });
      }
      const metrics = Core.polygonMetrics(starter.geometry.coordinates);
      Object.assign(props, { acreage:metrics.acreage, quantity:metrics.acreage, perimeter_ft:metrics.perimeter_ft, approx_length_ft:metrics.approx_length_ft, approx_width_ft:metrics.approx_width_ft, geometry_measurement_basis:metrics.basis });
    }
    if (!state.model.pricing_crew_models.length) Core.createPricingCrewModel(state.model, { pricing_crew_model_id:"PRICING-CREW-001", name:"David + 1 helper" });
    else state.model.pricing_crew_models[0].name = "David + 1 helper";
    if (!state.model.property_assets) state.model.property_assets = [];
    if (!state.model.context_records) state.model.context_records = [];
    if (!state.model.context_records.some((record) => record.context_id === "CONTEXT-BAY-CULVERT-OVERTOPPING-001")) {
      state.model.context_records.push({
        context_id: "CONTEXT-BAY-CULVERT-OVERTOPPING-001",
        information_class: "INSPECTOR_OR_USER_SUPPLIED_CONTEXT",
        statement: "The recent inspection context followed Tropical Storm Bertha and included reported roadway overtopping near three large bay-drainage culverts.",
        scope: "NEARBY BAY-DRAINAGE CULVERTS â€” NOT AUTOMATICALLY THE SAME AS THE TWO APPROXIMATELY 36-INCH CULVERTS BENEATH PEARSON ROAD",
        official_hydrologic_finding: false,
        field_evidence_modified: false,
        professional_confirmation_needed: true
      });
    }
    if (!state.model.property_assets.some((asset) => asset.asset_id === "ASSET-CULVERT-PEARSON-001")) {
      state.model.property_assets.push({ asset_id: "ASSET-CULVERT-PEARSON-001", property_id: PROPERTY_ID, asset_type: "CULVERT", name: "Pearson Road creek crossing â€” two approxi…13875 tokens truncated…ometry_measurement_basis:metrics.basis,geometry_status:"DAVID-DRAWN DRAFT - REVIEW BEFORE CUSTOMER USE"});Core.recordEdit(state.model,"RESHAPE","proposals",before,state.model.proposals.features,{feature_id:feature.id});}else{const id=`PROPOSAL-ZONE-${String(state.model.proposals.features.length+1).padStart(3,"0")}`;const type=prompt(`Work type:\n${WORK_TYPES.join("\n")}`,"CLEAR / REVEAL")||"OTHER";Core.addFeature(state.model,"proposals",{type:"Feature",id,geometry:{type:"Polygon",coordinates:ring},properties:{proposal_zone_id:id,name:prompt("Name this work area",`Zone ${state.model.proposals.features.length+1}`)||id,work_type:type,service_type:type,finish_level:"REVEAL FINISH",current_condition:"UNKNOWN",existing_condition:"UNKNOWN",primary_objective:"UNKNOWN",proposed_intervention:type,included_scope:[],preserve:[],remove:[],expected_benefit:"UNKNOWN",expected_visible_result:"UNKNOWN",target_start:"UNKNOWN",target_completion:"UNKNOWN",completion_target:"NEEDS PRODUCTION TEST",price:null,price_status:"DRAFT",market_alternative_reference:"UNKNOWN",customer_selected:false,recommended_first_project:false,quantity:metrics.acreage,unit:"acre",acreage:metrics.acreage,perimeter_ft:metrics.perimeter_ft,approx_length_ft:metrics.approx_length_ft,approx_width_ft:metrics.approx_width_ft,geometry_measurement_basis:metrics.basis,color:"#f29f05",before_photo_ids:[],linked_before_photo_ids:[],geometry_status:"DAVID-DRAWN DRAFT - REVIEW BEFORE CUSTOMER USE",evidence_status:"CONCEPTUAL PROPOSAL - NOT COMPLETED WORK"}},"DRAW_AREA");}if(state.draw.preview)state.draw.preview.remove();state.draw=null;const button=document.querySelector('[data-edit="DRAW_AREA"]');button.textContent="DRAW WORK AREA";delete button.dataset.finishing;saveModel();renderAll();status("Proposal area saved as a new map version. Original evidence was not changed.");}
  function editProposal(action){
    const feature=state.model.proposals.features.find(f=>f.id===state.selectedProposalId);
    if(action==="DRAW_RECTANGLE")return beginRectangle(null);
    if(action==="RESIZE_RECTANGLE")return beginRectangleResize();
    if(action==="DRAW_AREA"){const button=document.querySelector('[data-edit="DRAW_AREA"]');if(button.dataset.finishing)return finishArea();return beginArea("DRAW_AREA");}
    if(action==="RESHAPE"){if(!feature)return status("Select a proposal area first.");return beginArea("RESHAPE");}
    if(!feature)return status("Select a proposal area first.");
    const props=p(feature); let patch={};
    if(action==="RENAME")patch.name=prompt("New area name",props.name)||props.name;
    else if(action==="CHANGE_TYPE")patch.work_type=prompt(`Work type:\n${WORK_TYPES.join("\n")}`,props.work_type)||props.work_type;
    else if(action==="CHANGE_COLOR")patch.color=prompt("Map color (for example #f29f05)",props.color)||props.color;
    else if(action==="ADD_NOTE")patch.note=prompt("Proposal note",props.note||"")||props.note;
    else if(action==="ADD_PRICE")patch.estimated_price=prompt("Estimated price or UNKNOWN",props.estimated_price||"UNKNOWN")||props.estimated_price;
    else if(action==="ADD_BENEFIT")patch.expected_benefit=prompt("Expected customer benefit",props.expected_benefit||"UNKNOWN")||props.expected_benefit;
    else if(action==="ATTACH_PHOTO")patch.linked_before_photo_ids=[...new Set([...(props.linked_before_photo_ids||[]),state.selectedPhotoId].filter(Boolean))];
    else if(action==="SPLIT")return status("SPLIT is preserved as an editor control; select the cut line in the next prototype. No geometry changed.");
    else if(action==="MERGE")return status("MERGE requires selecting two proposal areas. No geometry changed.");
    Core.replaceFeature(state.model,"proposals",feature.id,patch,action);saveModel();renderAll();showProposal(feature);
  }

  function renderAssetPanel(){const select=document.getElementById("assetSelect");select.innerHTML=state.model.property_assets.map(a=>`<option value="${a.asset_id}">${a.name}</option>`).join("");renderAssetTimeline();}
  function renderAssetTimeline(){const id=document.getElementById("assetSelect").value||state.model.property_assets[0]?.asset_id;const asset=state.model.property_assets.find(a=>a.asset_id===id);document.getElementById("assetTimeline").innerHTML=asset?asset.observations.map(o=>`<article><b>${o.date_time||o.recorded_at}</b><br>${Number.isFinite(o.water_to_top_in)?`${o.water_to_top_in} in below culvert top`:"Water-to-top: not measured"}<br>${o.tide_condition||"Tide unknown"}<br>${o.note||""}</article>`).join(""):"No asset selected.";}
  function addCulvertObservation(){const id=document.getElementById("assetSelect").value;const value=prompt("How many inches from the water surface UP to the inside top of the culvert? Leave blank if unknown.","");const measured=value!==null&&value.trim()!==""?Number(value):null;Core.addAssetObservation(state.model,id,{date_time:new Date().toISOString(),water_to_top_in:Number.isFinite(measured)?measured:null,water_to_invert_in:null,water_depth_in:null,flowing:"UNKNOWN",flow_direction:"UNKNOWN",road_overtopping:"UNKNOWN",road_water_distance:null,tide_condition:prompt("Tide: HIGH / LOW / BETWEEN / UNKNOWN","UNKNOWN")||"UNKNOWN",measurement_method:prompt("Method: MEASURED / ESTIMATED","MEASURED")||"UNKNOWN",confidence:"INSPECTOR ENTERED",recent_rainfall:"Link authoritative weather separately",note:prompt("Optional note","")||"",information_class:"FIELD_OBSERVATION_ENTERED_DURING_MAP_REVIEW"});saveModel();renderAssetTimeline();}

  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  async function captureCurrentMapPicture(){
    if(!window.html2canvas)return status("SAVE PICTURE is still loading. Wait a moment and press it again.");
    const wrap=document.querySelector(".map-wrap");
    document.body.classList.add("saving-map-picture");
    try{
      await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const scale=Math.min(2,Math.max(1,window.devicePixelRatio||1));
      const canvas=await window.html2canvas(wrap,{useCORS:true,allowTaint:false,backgroundColor:"#d6ddd8",scale,logging:false});
      const blob=await new Promise((resolve)=>canvas.toBlob(resolve,"image/png"));
      if(!blob)throw new Error("The picture could not be created.");
      const stamp=new Date().toISOString().replace(/[:.]/g,"-");
      download(`PEARSON_ROAD_MAP_${stamp}.png`,blob);
      status("Picture saved to Downloads. Your map and evidence were not changed.");
    }catch(error){
      console.error(error);
      status("PICTURE NOT SAVED. Keep the map open and try SAVE PICTURE again.");
    }finally{
      document.body.classList.remove("saving-map-picture");
    }
  }
  function exportData(){const payload=Core.clone(state.model);payload.source_evidence.embedded_feature_collections=state.source;download(`PROPERTY_MAP_${PROPERTY_ID}_v${Math.max(state.model.proposals.current_version||0,state.model.presentation.current_version||0)}.json`,new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));}
  function projectExport(point,bounds,width,height){const x=(point[0]-bounds.minX)/(bounds.maxX-bounds.minX)*width,y=height-(point[1]-bounds.minY)/(bounds.maxY-bounds.minY)*height;return[x,y];}
  function exportImage(){
    const all=[];function walk(coords){if(typeof coords[0]==="number")all.push(coords);else coords.forEach(walk);}state.source.parcel.features.forEach(feature=>walk(feature.geometry.coordinates));const bounds={minX:Math.min(...all.map(x=>x[0])),maxX:Math.max(...all.map(x=>x[0])),minY:Math.min(...all.map(x=>x[1])),maxY:Math.max(...all.map(x=>x[1]))};const W=1800,H=1200,pad=70,inner={minX:bounds.minX-(bounds.maxX-bounds.minX)*.04,maxX:bounds.maxX+(bounds.maxX-bounds.minX)*.04,minY:bounds.minY-(bounds.maxY-bounds.minY)*.04,maxY:bounds.maxY+(bounds.maxY-bounds.minY)*.04};
    const path=(coords)=>coords.map((pt,i)=>`${i?"L":"M"}${projectExport(pt,inner,W,H).join(" ")}`).join(" ");let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#e8eee9"/><text x="${pad}" y="48" font-family="Arial" font-size="32" font-weight="bold">PEARSON ROAD â€” WATER &amp; CLEARING REVIEW</text>`;
    const rings=state.source.parcel.features.flatMap(feature=>feature.geometry.coordinates);svg+=rings.map(r=>`<path d="${path(r)}Z" fill="#f4d03f18" stroke="#9c7d00" stroke-width="7"/>`).join("");
    state.source.waterSections.features.filter((feature)=>visibleDate(dateOf(feature))).forEach((feature)=>{const kind=String(p(feature).condition||p(feature).section_type||"").toUpperCase();const color=kind.includes("DRY")&&!kind.includes("WET")?"#e0a400":"#00a5cf";svg+=`<path d="${path(feature.geometry.coordinates)}" fill="none" stroke="#ffffff" stroke-width="11"/><path d="${path(feature.geometry.coordinates)}" fill="none" stroke="${color}" stroke-width="6"/>`;});
    state.model.proposals.features.forEach((f,index)=>{const color=p(f).color||"#f29f05";svg+=`<path d="${path(f.geometry.coordinates[0])}Z" fill="${color}55" stroke="${color}" stroke-width="8"/><text x="${projectExport(f.geometry.coordinates[0][0],inner,W,H)[0]}" y="${projectExport(f.geometry.coordinates[0][0],inner,W,H)[1]}" font-family="Arial" font-size="28" font-weight="bold">${String.fromCharCode(65+index)} â€” ${p(f).name} (${p(f).acreage} ac)</text>`;});
    state.source.waterPhotos.features.filter((feature)=>visibleDate(dateOf(feature))).forEach(f=>{const q=projectExport(f.geometry.coordinates,inner,W,H);const kind=waterReviewClass(f);const fill=kind==="RECORDED_WATER"?"#0756a3":kind==="VISIBLE_WATER_IN_PHOTO"?"#00b8d9":"#ffffff";const label=kind==="POSSIBLE_WATER_IN_PHOTO"?"?":"W";svg+=`<circle cx="${q[0]}" cy="${q[1]}" r="10" fill="${fill}" stroke="#063e66" stroke-width="3"/><text x="${q[0]}" y="${q[1]+5}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="${kind==="POSSIBLE_WATER_IN_PHOTO"?'#063e66':'#ffffff'}">${label}</text>`;});svg+=`<g font-family="Arial" font-size="22"><text x="${pad}" y="${H-90}">Dark blue W: recorded water Â· Cyan W: water visible in photo Â· White ?: possible water</text><text x="${pad}" y="${H-50}" font-weight="bold">APPROXIMATE PHONE GPS AND COUNTY PARCEL â€” NOT A SURVEY</text></g></svg>`;
    const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));image.onload=()=>{const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;canvas.getContext("2d").drawImage(image,0,0);URL.revokeObjectURL(url);canvas.toBlob(blob=>download("PEARSON_ROAD_WATER_CLEARING_REVIEW.png",blob),"image/png");};image.src=url;
  }

  function bindUi(){
    document.querySelectorAll("[data-open-panel]").forEach(button=>button.addEventListener("click",()=>openControlPanel(button.dataset.openPanel)));
    document.getElementById("closeControlDrawer").addEventListener("click",closeControlPanel);
    document.getElementById("doneProposalEdit").addEventListener("click",closeControlPanel);
    document.getElementById("customerViewToggle").addEventListener("click",()=>applyPresentationProfile(document.body.dataset.profile==="CUSTOMER_REVIEW"?"INTERNAL_EDITABLE":"CUSTOMER_REVIEW"));
    document.getElementById("allFindingsToggle").addEventListener("change",renderAll);
    document.querySelectorAll("[data-layer]").forEach(box=>box.addEventListener("change",renderAll));
    document.querySelectorAll("[data-date]").forEach(box=>box.addEventListener("change",()=>{box.checked?state.activeDates.add(box.dataset.date):state.activeDates.delete(box.dataset.date);renderAll();}));
    document.getElementById("allDays").addEventListener("click",()=>{document.querySelectorAll("[data-date]").forEach(box=>{box.checked=true;state.activeDates.add(box.dataset.date);});renderAll();});
    document.getElementById("outsideEvidenceToggle").addEventListener("change",renderAll);
    document.getElementById("fitParcel").addEventListener("click",()=>state.map.fitBounds(L.geoJSON(state.source.parcel).getBounds().pad(.08)));
    document.getElementById("fitAllEvidence").addEventListener("click",()=>{const points=[...state.source.gps.features,...state.source.photos.features,...state.source.findings.features].filter((feature)=>visibleDate(dateOf(feature)));state.map.fitBounds(L.geoJSON({type:"FeatureCollection",features:points}).getBounds().pad(.06));});
    document.getElementById("fitAug7Transition").addEventListener("click",()=>{const features=state.source.aug7Transect.features.filter((feature)=>feature.geometry.type==="LineString"&&["SECTION-004","SECTION-005","SECTION-006","SECTION-007"].includes(p(feature).section_id));state.map.fitBounds(L.geoJSON({type:"FeatureCollection",features}).getBounds().pad(.16));status("Showing the August 7 western drainage-persistence / wet-dry transition as one logical walk with separate source segments.");});
    document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{
      state.mode=button.dataset.mode;document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b===button));
      document.getElementById("proposalTools").hidden=state.mode!=="PROPOSAL";document.getElementById("internalPricing").hidden=state.mode!=="PROPOSAL";
      state.model.presentation.profile="INTERNAL_EDITABLE";document.getElementById("presentationProfile").value="INTERNAL_EDITABLE";document.body.dataset.profile="INTERNAL_EDITABLE";
      if(state.mode==="PROPOSAL"){
        document.querySelector('[data-layer="proposal"]').checked=true;document.querySelector('[data-layer="parcel"]').checked=true;document.querySelector('[data-layer="photos"]').checked=true;
        ["walks","gps","findings","sections","interpretation"].forEach((name)=>{document.querySelector(`[data-layer="${name}"]`).checked=false;});
        document.getElementById("outsideEvidenceToggle").checked=false;
      }
      saveModel();renderAll();
    }));
    document.querySelectorAll("[data-edit]").forEach(button=>button.addEventListener("click",()=>editProposal(button.dataset.edit)));
    document.querySelectorAll("[data-proposal-template]").forEach(button=>button.addEventListener("click",()=>beginRectangle(button.dataset.proposalTemplate)));
    document.getElementById("saveRectangle").addEventListener("click",saveRectangle);
    document.getElementById("cancelRectangle").addEventListener("click",cancelRectangle);
    document.getElementById("keepRectangle").addEventListener("click",saveRectangle);
    document.getElementById("restartRectangle").addEventListener("click",restartRectangle);
    document.getElementById("cancelRectangleMap").addEventListener("click",cancelRectangle);
    document.getElementById("savePictureAfterBox").addEventListener("click",captureCurrentMapPicture);
    document.getElementById("doneAfterBox").addEventListener("click",()=>document.getElementById("drawCoach").hidden=true);
    document.getElementById("saveCurrentMapPicture").addEventListener("click",captureCurrentMapPicture);
    document.getElementById("undoEdit").addEventListener("click",()=>{Core.undo(state.model);saveModel();renderAll();});
    document.getElementById("waterReviewFilter").addEventListener("click",()=>setPhotoFilter("WATER"));
    document.getElementById("allPhotoFilter").addEventListener("click",()=>setPhotoFilter("ALL"));
    document.getElementById("featuredFilter").addEventListener("click",()=>setPhotoFilter("FEATURED"));
    document.getElementById("favoritesFilter").addEventListener("click",()=>setPhotoFilter("FAVORITES"));
    document.getElementById("showFavoritesMap").addEventListener("change",renderAll);
    document.getElementById("topographyToggle").addEventListener("change",event=>event.target.checked?state.topoLayer.addTo(state.map):state.map.removeLayer(state.topoLayer));
    document.getElementById("contoursToggle").addEventListener("change",event=>event.target.checked?state.contourLayer.addTo(state.map):state.map.removeLayer(state.contourLayer));
    document.getElementById("exportMap").addEventListener("click",exportData);document.getElementById("exportImage").addEventListener("click",exportImage);document.getElementById("printMap").addEventListener("click",()=>window.print());
    document.getElementById("closePhoto").addEventListener("click",()=>document.getElementById("photoDialog").close());
    document.getElementById("previousPhoto").addEventListener("click",()=>movePhoto(-1));document.getElementById("nextPhoto").addEventListener("click",()=>movePhoto(1));
    document.addEventListener("keydown",(event)=>{const dialog=document.getElementById("photoDialog");if(event.key==="Escape"&&!dialog.open){closeControlPanel();return;}if(!dialog.open)return;if(event.key==="ArrowLeft"){event.preventDefault();movePhoto(-1);}if(event.key==="ArrowRight"){event.preventDefault();movePhoto(1);}});
    const dialog=document.getElementById("photoDialog");dialog.addEventListener("touchstart",(event)=>{state.touchStartX=event.changedTouches[0]?.clientX??null;},{passive:true});dialog.addEventListener("touchend",(event)=>{if(state.touchStartX===null)return;const delta=(event.changedTouches[0]?.clientX??state.touchStartX)-state.touchStartX;state.touchStartX=null;if(Math.abs(delta)>55)movePhoto(delta<0?1:-1);},{passive:true});
    document.getElementById("fullPropertyView").addEventListener("click",()=>{state.map.fitBounds(L.geoJSON(state.source.parcel).getBounds().pad(.08));document.getElementById("fullPropertyView").classList.add("active");document.getElementById("zoneDetailView").classList.remove("active");});
    document.getElementById("zoneDetailView").addEventListener("click",()=>{const zone=state.model.proposals.features.find((feature)=>feature.id===state.selectedProposalId)||state.model.proposals.features[0];if(!zone)return status("Select a proposal zone first.");state.map.fitBounds(L.geoJSON(zone).getBounds().pad(.35));document.getElementById("zoneDetailView").classList.add("active");document.getElementById("fullPropertyView").classList.remove("active");updateFilmstrip(zone.geometry.coordinates[0][0]);});
    document.getElementById("saveSellPrice").addEventListener("click",saveSellPrice);document.getElementById("askQuestion").addEventListener("click",()=>captureCustomerMessage("QUESTION"));document.getElementById("requestChange").addEventListener("click",()=>captureCustomerMessage("CHANGE_REQUEST"));document.getElementById("acceptProposal").addEventListener("click",acceptCurrentProposal);
    document.getElementById("presentationProfile").addEventListener("change",(event)=>applyPresentationProfile(event.target.value));
    document.getElementById("assetSelect").addEventListener("change",renderAssetTimeline);document.getElementById("addCulvertObservation").addEventListener("click",addCulvertObservation);
    document.getElementById("folderInput").addEventListener("change",loadFolder);
  }
  async function loadFolder(event){const selected=[...event.target.files];const photoIndex=selected.find(file=>/03_PHOTO_INDEX\.json$/i.test(file.webkitRelativePath||file.name));if(photoIndex){const index=JSON.parse(await photoIndex.text());const entries=Array.isArray(index)?index:(index.photos||index.records||[]);selected.filter(file=>/photos\/.+\.(jpe?g|png)$/i.test(file.webkitRelativePath)).forEach(file=>{const match=file.webkitRelativePath.match(/(\d{3})_(analysis|original)/i);if(!match)return;const photo=entries.find(item=>Number(String(item.photo_number||"").replace(/\D/g,""))===Number(match[1]));if(photo)state.folderImages.set(photo.photo_id,URL.createObjectURL(file));});}status(`Loaded ${selected.length} files from the selected property folder. Original files were not modified.`);renderAll();}

  async function start(){try{bindUi();await loadSource();initializeMap();}catch(error){status(`MAP COULD NOT OPEN: ${error.message}`);console.error(error);}}
  start();
})();

