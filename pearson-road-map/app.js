(function () {
  "use strict";
  const Core = window.PropertyMapCore;
  const PROPERTY_ID = "221S280000001010000";
  const STORAGE_KEY = `property-intelligence-experience-map-v0.2:${PROPERTY_ID}`;
  const VIEWER_ID = sessionStorage.getItem("property-map-viewer") || `viewer-${Date.now().toString(36)}`;
  sessionStorage.setItem("property-map-viewer", VIEWER_ID);
  const DAY_COLORS = { "2026-08-03": "#e77728", "2026-08-04": "#8156a6", "2026-08-05": "#18815b", "2026-08-06": "#c44b67", "2026-08-07": "#1377c8" };
  const WORK_TYPES = ["CLEAR / REVEAL", "SELECTIVE BRUSH REMOVAL", "PRESERVE MATURE TREES", "OPEN VIEW CORRIDOR", "ACCESS IMPROVEMENT", "CULVERT / CROSSING", "DRAINAGE WORK", "TRAIL", "HOMESITE REVEAL", "PASTURE / OPEN AREA", "OTHER"];
  const PROPOSAL_V02_TITLE = "WESTERN FRONTAGE, ENTRANCE & WATER-FEATURE REVEAL";
  const PROPOSAL_V01_TITLE = PROPOSAL_V02_TITLE;
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
    parcel: "data/AUG7_SUBJECT_PARCEL.geojson",
    gps: "data/ALL_GPS_POINTS.geojson",
    routes: "data/ALL_ROUTE_SEGMENTS.geojson",
    displayWalks: "data/DISPLAY_WALKS_CLEAN.geojson",
    photos: "data/ALL_PHOTO_POINTS.geojson",
    findings: "data/ALL_FIELD_FINDINGS.geojson",
    sections: "data/ALL_MAPPED_SECTIONS.geojson",
    interpretation: "data/ALL_INSPECTOR_INTERPRETATIONS.geojson",
    aug7Transect: "data/AUG7_MAPPED_SECTIONS_FILTERED.geojson",
    summary: "data/ALL_INCURSIONS_SUMMARY.json"
  };
  const state = {
    model: loadModel(), source: {}, map: null, groups: {}, photoMarkers: new Map(), selectedPhotoId: null,
    selectedProposalId: null, mode: "EVIDENCE", filter: "ALL", activeDates: new Set(Object.keys(DAY_COLORS)),
    draw: null, baseLayer: null, topoLayer: null, contourLayer: null, folderImages: new Map(),
    currentPhotoSet: [], currentPhotoIndex: -1, currentPhotoCollectionLabel: "ALL VISIBLE PHOTOS", touchStartX: null
  };

  function loadModel() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && saved.schema_name === "property-intelligence-map" ? saved : Core.createModel(PROPERTY_ID);
    } catch (_) { return Core.createModel(PROPERTY_ID); }
  }
  function saveModel() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.model)); }
  function applyPresentationProfile(profile){state.model.presentation.profile=profile||"INTERNAL_EDITABLE";document.body.dataset.profile=state.model.presentation.profile;saveModel();if(state.map)renderAll();setTimeout(()=>state.map&&state.map.invalidateSize(),0);}
  function deepFreeze(object) {
    if (!object || typeof object !== "object" || Object.isFrozen(object)) return object;
    Object.freeze(object); Object.values(object).forEach(deepFreeze); return object;
  }
  async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response.json(); }
  function status(message) { document.getElementById("mapStatus").textContent = message; }
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
    if (!state.model.proposals.features.some((feature) => feature.id === "PROPOSAL-ZONE-001")) {
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
      if (upgradeToProposalV02 || props.geometry_status === "CONCEPTUAL PLACEHOLDER - RESHAPE BEFORE CUSTOMER USE" || props.name === "A - WESTERN REVEAL" || props.name === "A — Western wet/dry reveal") {
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
        scope: "NEARBY BAY-DRAINAGE CULVERTS — NOT AUTOMATICALLY THE SAME AS THE TWO APPROXIMATELY 36-INCH CULVERTS BENEATH PEARSON ROAD",
        official_hydrologic_finding: false,
        field_evidence_modified: false,
        professional_confirmation_needed: true
      });
    }
    if (!state.model.property_assets.some((asset) => asset.asset_id === "ASSET-CULVERT-PEARSON-001")) {
      state.model.property_assets.push({ asset_id: "ASSET-CULVERT-PEARSON-001", property_id: PROPERTY_ID, asset_type: "CULVERT", name: "Pearson Road creek crossing — two approximately 36-inch culverts", source_location: null, display_location: [-87.09266,30.48945], location_status: "APPROXIMATE DISPLAY LOCATION — FIELD LOCATION NOT ESTABLISHED IN THIS PROTOTYPE", pipe_count: 2, pipe_diameter_in: 36, material: "UNKNOWN", linked_photo_ids: [], notes: "David controlling correction: two approximately 36-inch culverts beneath Pearson Road where the creek crosses.", observations: [
        { observation_id: "CULVERT-OBS-CONTEXT-001", recorded_at: "2026-08-07T18:10:00.000Z", date_time: "2026-08-03", water_to_top_in: null, water_to_invert_in: null, tide_condition: "UNKNOWN", recent_rainfall: "See separately sourced weather record", information_class: "CONTEXT_ONLY", note: "Repeat water-to-culvert-top measurement not recorded; ready for future visit." },
        { observation_id: "CULVERT-OBS-CONTEXT-002", recorded_at: "2026-08-07T18:10:00.000Z", date_time: "2026-08-07", water_to_top_in: null, water_to_invert_in: null, tide_condition: "UNKNOWN", recent_rainfall: "Stage IV last measurable rainfall ended approximately 91–92 hours before August 7 parcel observations", information_class: "ANALYSIS_CONTEXT", note: "No culvert water-level measurement was captured on August 7." }
      ] });
    }
    saveModel();
  }

  function initializeMap() {
    if (!window.L) throw new Error("Development map library did not load. Connect this computer to the internet and reopen the prototype.");
    state.map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([30.4896, -87.0893], 16);
    document.getElementById("presentationProfile").value=state.model.presentation.profile||"INTERNAL_EDITABLE";document.body.dataset.profile=state.model.presentation.profile||"INTERNAL_EDITABLE";
    const config = window.PROPERTY_MAP_CONFIG || {};
    const imagery = config.developmentImageryUrl || "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
    state.baseLayer = L.tileLayer(imagery, { maxZoom: 20, attribution: "USGS The National Map imagery" }).addTo(state.map);
    state.topoLayer = L.tileLayer(config.usgsTopoUrl || "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, opacity: .76, attribution: "USGS Topo" });
    state.contourLayer = null;
    ["parcel","walks","gps","photos","findings","sections","transect","interpretation","proposal","assets"].forEach((name) => { state.groups[name] = L.layerGroup().addTo(state.map); });
    state.map.on("mousemove", (event) => updateFilmstrip([event.latlng.lng, event.latlng.lat]));
    state.map.on("click", handleMapClick);
    renderAll();
    const bounds = L.geoJSON(state.source.parcel).getBounds();
    state.contourLayer = config.contourTileTemplate
      ? L.tileLayer(config.contourTileTemplate, { maxZoom: 20, opacity: .72 })
      : L.imageOverlay("data/usgs-contours-2ft.png", bounds, { opacity: .72, interactive: false });
    state.map.fitBounds(bounds.pad(.08));
    const providerMessage = config.mapkitToken ? "Apple MapKit token is configured; provider adapter is ready for the next prototype." : "USGS development imagery shown. Apple MapKit Hybrid becomes available when its token is configured.";
    const counts = state.source.summary.counts;
    document.getElementById("evidenceTotals").innerHTML = `<h2>Evidence inventory</h2><p><strong>${counts.gps_points.toLocaleString()}</strong> GPS points<br><strong>${counts.photo_points.toLocaleString()}</strong> photograph points<br><strong>${counts.field_findings.toLocaleString()}</strong> field findings<br><strong>${counts.mapped_section_features.toLocaleString()}</strong> section/source features</p><p>August 3–7. Outside-large-parcel evidence is preserved separately.</p>`;
    status(`Loaded every available August 3–7 GPS, photograph, tree, water, culvert, ditch, entrance, brush, and section record. ${providerMessage}`);
  }

  function clearGroups() { Object.values(state.groups).forEach((group) => group.clearLayers()); state.photoMarkers.clear(); }
  function lineStyle(date, weight) { return { color: DAY_COLORS[date] || "#4b5563", weight: weight || 4, opacity: .9 }; }
  function visibleDate(date) { return state.activeDates.has(date); }
  function renderAll() {
    clearGroups();
    if (layerVisible("parcel")) L.geoJSON(state.source.parcel, { style: { color: "#f4d03f", weight: 5, fillColor: "#f4d03f", fillOpacity: .04 } }).addTo(state.groups.parcel);
    if (layerVisible("walks")) {
      const customerProfile = ["CUSTOMER_REVIEW", "PRINT_REPORT"].includes(state.model.presentation.profile);
      const useDisplayWalks = state.mode === "PROPOSAL" || customerProfile;
      const source = useDisplayWalks ? state.source.displayWalks : state.source.routes;
      const routes = source.features.filter((feature) => visibleDate(dateOf(feature)));
      L.geoJSON({ type:"FeatureCollection", features:routes }, {
        style:(feature)=>lineStyle(dateOf(feature),5),
        onEachFeature:(feature,layer)=>layer.bindPopup(useDisplayWalks
          ? `<b>${dateOf(feature)} customer display walk</b><br>${p(feature).display_point_count} retained display points from ${p(feature).source_point_count} raw points.<br>Presentation-only cleanup. Every raw GPS point remains preserved.<br>No artificial relocation connectors.<br>Phone GPS — not a survey.`
          : `<b>${dateOf(feature)} raw walked route</b><br>${p(feature).point_count} preserved GPS points<br>${p(feature).start_time}<br>No artificial relocation connectors.<br>Phone GPS — not a survey.`)
      }).addTo(state.groups.walks);
    }
    if (layerVisible("gps")) renderGpsPoints();
    if (layerVisible("sections")) { renderSections(); if(visibleDate("2026-08-07")) renderAug7Transect(); }
    if (layerVisible("findings")) renderFindings();
    if (layerVisible("interpretation") && visibleDate("2026-08-07")) renderInterpretation();
    if (layerVisible("photos")) renderPhotos();
    if (layerVisible("proposal")) renderProposals();
    renderAssets();
    renderAssetPanel();
    updateFilmstrip(centerCoordinate());
    renderProposalSheet();
    renderInternalPricing();
  }
  function layerVisible(name) { const box = document.querySelector(`[data-layer="${name}"]`); return !box || box.checked; }
  function scopeVisible(feature) { return p(feature).evidence_scope === "SUBJECT_PARCEL" || document.getElementById("outsideEvidenceToggle").checked; }
  function evidenceVisible(feature) { return visibleDate(dateOf(feature)) && scopeVisible(feature); }
  function safe(value) { return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character])); }

  function renderGpsPoints() {
    const features = state.source.gps.features.filter(evidenceVisible);
    const GpsCanvasLayer=L.Layer.extend({
      initialize(points){this.points=points;this._draw=this._draw.bind(this);},
      onAdd(map){this._map=map;this._canvas=L.DomUtil.create("canvas","leaflet-layer gps-point-canvas");this._canvas.style.position="absolute";this._canvas.style.pointerEvents="none";map.getPanes().overlayPane.appendChild(this._canvas);map.on("moveend zoomend resize",this._draw);this._draw();},
      onRemove(map){map.off("moveend zoomend resize",this._draw);this._canvas.remove();},
      _draw(){
        const size=this._map.getSize(),ratio=Math.max(1,window.devicePixelRatio||1),topLeft=this._map.containerPointToLayerPoint([0,0]);
        this._canvas.width=Math.round(size.x*ratio);this._canvas.height=Math.round(size.y*ratio);this._canvas.style.width=`${size.x}px`;this._canvas.style.height=`${size.y}px`;L.DomUtil.setPosition(this._canvas,topLeft);
        const context=this._canvas.getContext("2d");context.scale(ratio,ratio);context.globalAlpha=.66;
        for(const feature of this.points){const coordinate=feature.geometry.coordinates,point=this._map.latLngToContainerPoint([coordinate[1],coordinate[0]]);if(point.x<0||point.y<0||point.x>size.x||point.y>size.y)continue;context.fillStyle=DAY_COLORS[dateOf(feature)]||"#555";context.fillRect(point.x-1.4,point.y-1.4,2.8,2.8);}
      }
    });
    state.groups.gps.addLayer(new GpsCanvasLayer(features));
  }

  function findingAppearance(kind) {
    if(kind==="WATER")return{label:"W",css:"water"};
    if(kind==="DRY")return{label:"D",css:"dry"};
    if(kind==="CULVERT"||kind==="CULVERT_NEEDED"||kind==="NO_CULVERT_NEEDED")return{label:"C",css:"culvert"};
    if(kind==="DITCH_SWALE")return{label:"S",css:"water"};
    if(kind==="ROAD_ENTRANCE")return{label:"R",css:"road"};
    if(kind==="BLOCKED")return{label:"X",css:"other"};
    if(kind==="PINE")return{label:"P",css:"tree"};
    if(kind==="HARDWOOD")return{label:"H",css:"tree"};
    if(kind==="MAGNOLIA")return{label:"M",css:"tree"};
    if(kind==="TREE")return{label:"T",css:"tree"};
    if(kind==="BRUSH")return{label:"B",css:"brush"};
    return{label:"•",css:"other"};
  }

  function renderFindings() {
    state.source.findings.features.filter(evidenceVisible).forEach((feature)=>{
      const props=p(feature),appearance=findingAppearance(props.display_class);
      const marker=L.marker([feature.geometry.coordinates[1],feature.geometry.coordinates[0]],{icon:L.divIcon({className:`finding-marker ${appearance.css}`,html:appearance.label,iconSize:[22,22]}),title:props.label}).addTo(state.groups.findings);
      marker.bindPopup(`<b>${safe(props.display_class)}</b><br>${safe(props.label)}<br>${safe(props.inspection_date)} — ${safe(props.timestamp)}<br>Record: ${safe(props.record_id || "source record without ID")}<br>Accuracy: ${safe(props.gps_accuracy_m)} m<br>${safe(props.note)}<br><i>${safe(props.evidence_scope)}; original wording preserved.</i>`);
    });
  }

  function renderSections() {
    const features=state.source.sections.features.filter((feature)=>{
      const date=dateOf(feature,p(feature).recorded_at ? String(p(feature).recorded_at).slice(0,10) : "2026-08-07");
      return date==="UNKNOWN" || visibleDate(date);
    });
    L.geoJSON({type:"FeatureCollection",features},{
      style:(feature)=>({color:p(feature).display_status?.includes("RAW")?"#89928d":"#365d48",weight:p(feature).display_status?.includes("RAW")?1:3,opacity:p(feature).display_status?.includes("RAW")?.22:.72,fillOpacity:.05,dashArray:p(feature).display_status?.includes("RAW")?"2 5":"7 4"}),
      pointToLayer:(feature,latlng)=>L.circleMarker(latlng,{radius:1.2,stroke:false,fillColor:"#365d48",fillOpacity:.25}),
      onEachFeature:(feature,layer)=>layer.bindPopup(`<b>Mapped section ${safe(p(feature).section_id || "source geometry")}</b><br>${safe(p(feature).display_status)}<br><i>Original section evidence is unchanged.</i>`)
    }).addTo(state.groups.sections);
  }

  function renderAug7Transect() {
    const features=state.source.aug7Transect.features.filter((feature)=>feature.geometry.type==="LineString"&&["SECTION-004","SECTION-005","SECTION-006","SECTION-007"].includes(p(feature).section_id));
    L.geoJSON({type:"FeatureCollection",features},{
      style:{color:"#0b72c4",weight:7,opacity:.95},
      onEachFeature:(feature,layer)=>layer.bindTooltip("WESTERN DRAINAGE-PERSISTENCE / WET-DRY TRANSITION WALK",{sticky:true}).bindPopup(`<b>ONE LOGICAL AUGUST 7 WALK</b><br>Source segment: ${safe(p(feature).section_id)} / ${safe(p(feature).segment_number)}<br>Every source point is preserved. Pauses remain separate; no false relocation connector was drawn.`)
    }).addTo(state.groups.transect);
  }

  function renderInterpretation() {
    L.geoJSON(state.source.interpretation, {
      style: (feature) => {
        const kind = p(feature).interpretation_class || "";
        if (kind.includes("DRY") || kind.includes("DRAINED")) return { color:"#9f8d00",fillColor:"#f2dc3a",fillOpacity:.28,weight:2 };
        if (kind.includes("WET") || kind.includes("WATER")) return { color:"#0067aa",fillColor:"#2b9cf0",fillOpacity:.25,weight:3 };
        return { color:"#77857d",fillOpacity:.06,weight:1 };
      },
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius:7,color:"#fff",weight:2,fillColor:"#0878bd",fillOpacity:1 }),
      onEachFeature: (feature, layer) => layer.bindPopup(`<b>${p(feature).interpretation_class || "Interpretation"}</b><br>${p(feature).statement || ""}<br><i>Interpretation; source evidence remains separate.</i>`)
    }).addTo(state.groups.interpretation);
  }

  function renderPhotos() {
    const proposalPhotos = state.mode === "PROPOSAL" && state.selectedProposalId ? photosForProposal(state.selectedProposalId) : null;
    const visibleIds = proposalPhotos ? new Set(proposalPhotos.map((photo) => p(photo).photo_id)) : null;
    state.source.photos.features.filter(evidenceVisible).filter((photo) => !visibleIds || visibleIds.has(p(photo).photo_id)).forEach((photo) => {
      const id = p(photo).photo_id; const favorite = isFavorite(id); const featured = photoMeta(id).featured;
      const recordedWater = p(photo).is_recorded_water_category === true;
      const icon = L.divIcon({ className:`photo-marker${favorite ? " favorite" : ""}${recordedWater ? " water-photo" : ""}`, html: recordedWater ? "W" : (featured ? "★" : String(p(photo).photo_number || "P").replace("P","")), iconSize:[featured||recordedWater?24:19,featured||recordedWater?24:19] });
      const marker = L.marker([photo.geometry.coordinates[1],photo.geometry.coordinates[0]], { icon, title:p(photo).photo_number }).addTo(state.groups.photos);
      marker.on("click", () => openPhoto(photo, collectionForPhoto(photo))); marker.on("mouseover", () => { state.selectedPhotoId=id; highlightPhoto(id); updateFilmstrip(photo.geometry.coordinates); });
      state.photoMarkers.set(id, marker);
    });
  }
  function renderProposals() {
    state.model.proposals.features.forEach((feature) => {
      const primary=p(feature).recommended_first_project===true;
      const layer = L.geoJSON(feature, { style: { color:p(feature).color || "#f29f05",fillColor:p(feature).color || "#f29f05",fillOpacity:primary?.30:.10,weight:primary?5:3,dashArray:primary?null:"8 7" } }).addTo(state.groups.proposal);
      layer.eachLayer((part) => {
        part.bindTooltip(`${safe(p(feature).name)}<br>${p(feature).acreage || "?"} acres${primary?"<br>RECOMMENDED FIRST PROJECT":"<br>OPTIONAL - NOT INCLUDED"}${p(feature).geometry_status?`<br>${safe(p(feature).geometry_status)}`:""}`, { permanent:true,direction:"center",className:"proposal-label" });
        part.on("click", (event) => { L.DomEvent.stopPropagation(event); state.selectedProposalId=feature.id; showProposal(feature); renderProposalSheet(); renderInternalPricing(); });
      });
    });
  }
  function renderAssets() {
    state.model.property_assets.forEach((asset) => {
      if (!asset.display_location) return;
      L.marker([asset.display_location[1],asset.display_location[0]], { icon:L.divIcon({className:"proposal-label",html:"C",iconSize:[25,25]}) }).addTo(state.groups.assets).bindPopup(`<b>${asset.name}</b><br>${asset.location_status}<br>${asset.observations.length} repeat observation records`);
    });
  }

  function photoMeta(id) { return state.model.presentation.photo_metadata.find((item) => item.photo_id === id) || {}; }
  function isFavorite(id) { return state.model.presentation.customer_favorites.some((item) => item.photo_id === id && (item.viewer_or_session_id === VIEWER_ID || item.viewer_or_session_id === "prototype-customer")); }
  function centerCoordinate() { const c=state.map.getCenter(); return [c.lng,c.lat]; }
  function filteredPhotos() {
    const all=state.source.photos.features.filter(evidenceVisible);
    if(state.filter==="FEATURED") return all.filter((photo)=>photoMeta(p(photo).photo_id).featured);
    if(state.filter==="FAVORITES") return all.filter((photo)=>isFavorite(p(photo).photo_id));
    return all;
  }
  function pointInRing(point, ring) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
      const intersect=((yi>point[1])!==(yj>point[1]))&&(point[0]<(xj-xi)*(point[1]-yi)/(yj-yi||Number.EPSILON)+xi);
      if(intersect)inside=!inside;
    }
    return inside;
  }
  function photosForProposal(proposalId) {
    const zone=state.model.proposals.features.find((feature)=>feature.id===proposalId);
    if(!zone)return [];
    const ids=new Set([...(p(zone).before_photo_ids||[]),...(p(zone).linked_before_photo_ids||[])]);
    const ring=zone.geometry&&zone.geometry.type==="Polygon"?zone.geometry.coordinates[0]:null;
    const directlyAttached=filteredPhotos().filter((photo)=>ids.has(p(photo).photo_id));
    return directlyAttached.length ? directlyAttached : filteredPhotos().filter((photo)=>ring&&pointInRing(photo.geometry.coordinates,ring));
  }
  function collectionForPhoto(photo) {
    if(state.selectedProposalId){
      const zonePhotos=photosForProposal(state.selectedProposalId);
      const zone=state.model.proposals.features.find((feature)=>feature.id===state.selectedProposalId);
      if(zonePhotos.some((item)=>p(item).photo_id===p(photo).photo_id))return{photos:zonePhotos,label:`${p(zone).name} PHOTOS`};
    }
    const label=state.filter==="FEATURED"?"DAVID'S FEATURED PHOTOS":state.filter==="FAVORITES"?"MY FAVORITES":`${[...state.activeDates].sort().join(", ")} VISIBLE PHOTOS`;
    return{photos:filteredPhotos(),label};
  }
  function updateFilmstrip(coordinate) {
    const ranked=Core.rankPhotos(filteredPhotos(),coordinate,state.model.presentation.photo_metadata,state.model.presentation.customer_favorites,8);
    state.currentPhotoSet=ranked.map((entry)=>entry.photo);
    state.currentPhotoCollectionLabel=state.filter==="FEATURED"?"DAVID'S FEATURED PHOTOS":state.filter==="FAVORITES"?"MY FAVORITES":"NEARBY PHOTOS AT CURRENT MAP LOCATION";
    const strip=document.getElementById("photoFilmstrip"); strip.innerHTML="";
    ranked.forEach((entry,index)=>{
      const photo=entry.photo,id=p(photo).photo_id,card=document.createElement("button");
      const size=entry.featured&&index<2?"hero":index<2?"large":index<5?"medium":"faded";
      card.className=`photo-card ${size}`; card.dataset.photoId=id; card.draggable=entry.featured;
      const category=p(photo).recorded_category || p(photo).category || "PHOTO";
      card.innerHTML=`<img loading="lazy" src="${photoPath(photo)}" alt="${p(photo).photo_number} ${category}"><span>${entry.featured?'<b class="star">★</b>':''}${isFavorite(id)?'♡ ':''}${p(photo).is_recorded_water_category?'WATER — ':''}${p(photo).photo_number} — ${category}</span>`;
      card.addEventListener("mouseenter",()=>highlightPhoto(id)); card.addEventListener("click",()=>openPhoto(photo,{photos:state.currentPhotoSet,label:state.currentPhotoCollectionLabel}));
      card.addEventListener("dragstart",(event)=>event.dataTransfer.setData("text/photo-id",id)); card.addEventListener("dragover",(event)=>event.preventDefault()); card.addEventListener("drop",(event)=>reorderFeatured(event,id));
      strip.appendChild(card);
    });
  }
  function highlightPhoto(id) {
    state.photoMarkers.forEach((marker,key)=>marker.getElement()&&marker.getElement().classList.toggle("selected",key===id));
    document.querySelectorAll(".photo-card").forEach((card)=>card.classList.toggle("selected",card.dataset.photoId===id));
    const card=document.querySelector(`.photo-card[data-photo-id="${CSS.escape(id)}"]`);if(card)card.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  }
  function pulsePhoto(photo) {
    const id=p(photo).photo_id;state.selectedPhotoId=id;highlightPhoto(id);
    const marker=state.photoMarkers.get(id),element=marker&&marker.getElement();if(element){element.classList.add("selected");setTimeout(()=>element.classList.remove("selected"),750);}
    const latlng=L.latLng(photo.geometry.coordinates[1],photo.geometry.coordinates[0]);
    if(!state.map.getBounds().pad(-.12).contains(latlng))state.map.panTo(latlng,{animate:true,duration:.25});
  }
  function openPhoto(photo, collection) {
    const requested=collection&&collection.photos&&collection.photos.length?collection:{photos:[photo],label:"SELECTED PHOTO"};
    state.currentPhotoSet=requested.photos;state.currentPhotoCollectionLabel=requested.label||"CURRENT PHOTO SET";
    state.currentPhotoIndex=Math.max(0,state.currentPhotoSet.findIndex((item)=>p(item).photo_id===p(photo).photo_id));
    renderOpenPhoto();
  }
  function renderOpenPhoto() {
    const photo=state.currentPhotoSet[state.currentPhotoIndex];if(!photo)return;
    const id=p(photo).photo_id,meta=photoMeta(id),favorite=isFavorite(id),dialog=document.getElementById("photoDialog");
    const category=p(photo).recorded_category || p(photo).category || "PHOTO";
    const waterStatement=p(photo).is_recorded_water_category ? "<b>Map classification: WATER — explicitly recorded by the app.</b>" : `<b>Map classification:</b> ${safe(p(photo).display_class || category)}<br><i>Image appearance has not been silently reclassified.</i>`;
    document.getElementById("photoCounter").textContent=`${state.currentPhotoIndex+1} OF ${state.currentPhotoSet.length}`;
    document.getElementById("photoCollectionLabel").textContent=state.currentPhotoCollectionLabel;
    document.getElementById("previousPhoto").disabled=state.currentPhotoSet.length<2;
    document.getElementById("nextPhoto").disabled=state.currentPhotoSet.length<2;
    document.getElementById("photoDetails").innerHTML=`<h2>${safe(p(photo).photo_number)} - ${safe(category)}</h2><img src="${photoPath(photo)}" alt="${safe(p(photo).photo_number)}"><p>${waterStatement}<br><b>Recorded:</b> ${safe(p(photo).timestamp)}<br><b>GPS:</b> ${photo.geometry.coordinates[1].toFixed(7)}, ${photo.geometry.coordinates[0].toFixed(7)}<br><b>Accuracy:</b> ${safe(p(photo).gps_accuracy_m)} m<br><b>Section:</b> ${safe(p(photo).section_id || "No direct section ID")}<br><b>Associated records:</b> ${safe((p(photo).associated_record_ids||[]).join(", ") || "None recorded")}<br><b>Scope:</b> ${safe(p(photo).evidence_scope)}<br><b>Source:</b> ${safe(p(photo).source_file)}</p><button id="featurePhoto">${meta.featured?"REMOVE FEATURE":"FEATURE PHOTO"}</button> <button id="favoritePhoto">${favorite?"REMOVE FAVORITE":"FAVORITE"}</button>`;
    document.getElementById("featurePhoto").onclick=()=>{const set=[...state.currentPhotoSet],label=state.currentPhotoCollectionLabel,index=state.currentPhotoIndex;Core.setFeatured(state.model,id,!meta.featured,"Selected during map review","David");saveModel();renderAll();state.currentPhotoSet=set;state.currentPhotoCollectionLabel=label;state.currentPhotoIndex=index;renderOpenPhoto();};
    document.getElementById("favoritePhoto").onclick=()=>{const set=[...state.currentPhotoSet],label=state.currentPhotoCollectionLabel,index=state.currentPhotoIndex;Core.toggleFavorite(state.model,id,state.selectedProposalId,VIEWER_ID);saveModel();renderAll();state.currentPhotoSet=set;state.currentPhotoCollectionLabel=label;state.currentPhotoIndex=index;renderOpenPhoto();};
    pulsePhoto(photo);
    if(dialog.showModal&&!dialog.open) dialog.showModal();
  }
  function movePhoto(step){if(!state.currentPhotoSet.length)return;state.currentPhotoIndex=(state.currentPhotoIndex+step+state.currentPhotoSet.length)%state.currentPhotoSet.length;renderOpenPhoto();}
  function reorderFeatured(event,targetId){const sourceId=event.dataTransfer.getData("text/photo-id");if(!sourceId||sourceId===targetId)return;const ids=state.model.presentation.photo_metadata.filter(x=>x.featured).sort((a,b)=>(a.featured_rank||999)-(b.featured_rank||999)).map(x=>x.photo_id);const from=ids.indexOf(sourceId),to=ids.indexOf(targetId);if(from<0||to<0)return;ids.splice(to,0,ids.splice(from,1)[0]);Core.reorderFeatured(state.model,ids);saveModel();renderAll();}

  function formatMoney(value){const amount=Core.money(value);return amount===null?"UNKNOWN":amount.toLocaleString("en-US",{style:"currency",currency:"USD"});}
  function listHtml(values){return `<ul class="scope-list">${(values&&values.length?values:["UNKNOWN"]).map((value)=>`<li>${safe(value)}</li>`).join("")}</ul>`;}
  function showProposal(feature){const props=p(feature);document.getElementById("selection").innerHTML=`<h2>${safe(props.name)}</h2><p><b>${safe(props.work_type)}</b><br>${safe(props.acreage)} acres &middot; approximately ${safe(props.approx_length_ft)} x ${safe(props.approx_width_ft)} feet<br>${safe(props.proposed_intervention)}<br><b>Benefit:</b> ${safe(props.expected_benefit)}<br><b>Customer price:</b> ${formatMoney(props.price)}</p><p><small>${safe(props.geometry_measurement_basis)}</small></p>`;}
  function productionTestFor(zoneId){return state.model.production_tests.find((test)=>test.proposal_zone_id===zoneId)||null;}
  function renderInternalPricing(){
    const zone=state.model.proposals.features.find((feature)=>feature.id===state.selectedProposalId)||state.model.proposals.features[0];if(!zone)return;
    const props=p(zone),estimate=Core.estimateZone(zone,productionTestFor(props.proposal_zone_id)),crew=state.model.pricing_crew_models[0];
    document.getElementById("pricingStatus").innerHTML=`<b>COST FLOOR:</b> ${estimate.cost_floor===null?'<span class="status-warn">NEEDS PRODUCTION TEST</span>':formatMoney(estimate.cost_floor)}<br><b>Known direct cost entered so far:</b> ${formatMoney(estimate.known_direct_cost)} <i>(not a complete cost floor)</i><br><b>Unknown cost components:</b> ${safe(estimate.unknown_cost_components.join(", ")||"None")}<br><b>Expected gross dollars:</b> ${estimate.expected_gross_dollars===null?"UNKNOWN":formatMoney(estimate.expected_gross_dollars)}<br><b>Pricing crew:</b> ${safe(crew?.name||"UNKNOWN")} (David's labor is not assumed to be free)`;
    document.getElementById("marketReference").innerHTML=`<b>MARKET / ALTERNATIVE REFERENCE:</b> ${state.model.market_benchmarks.length?safe(props.market_alternative_reference):'<span class="status-warn">UNKNOWN - NO VERIFIED BENCHMARKS ENTERED</span>'}<br>Competitor references remain internal and never set the sell price automatically.`;
    document.getElementById("sellPrice").value=Core.money(props.price)===null?"":props.price;
    document.getElementById("validatePrice").checked=props.price_status==="VALIDATED";
    document.getElementById("targetStart").value=/^\d{4}-\d{2}-\d{2}$/.test(props.target_start||"")?props.target_start:"";
    document.getElementById("targetCompletion").value=/^\d{4}-\d{2}-\d{2}$/.test(props.target_completion||"")?props.target_completion:"";
  }
  function proposalPhotoButtons(zone){
    const ids=[...(p(zone).before_photo_ids||[]),...(p(zone).linked_before_photo_ids||[])];
    return [...new Set(ids)].map((id)=>state.source.photos.features.find((photo)=>p(photo).photo_id===id)).filter(Boolean).map((photo)=>`<button type="button" data-proposal-photo="${safe(p(photo).photo_id)}"><img src="${photoPath(photo)}" alt="${safe(p(photo).photo_number)}"><span>${safe(p(photo).photo_number)}</span></button>`).join("")||"<p>Before photographs: UNKNOWN</p>";
  }
  function renderProposalSheet(){
    const zones=state.model.proposals.features,zone=zones.find((feature)=>feature.id===state.selectedProposalId)||zones[0];if(!zone)return;
    const props=p(zone),total=Core.proposalTotal(zones);
    document.getElementById("proposalTotal").textContent=total.complete?`TOTAL: ${formatMoney(total.priced_total)}`:"TOTAL: UNKNOWN";
    const next=["Candidate homesite / view reveal — NOT INCLUDED IN CURRENT PRICE","Creek / water-walk extension — NOT INCLUDED IN CURRENT PRICE","Eastern open-area / pasture-potential reveal — NOT INCLUDED IN CURRENT PRICE"];
    document.getElementById("starterReveal").innerHTML=`<article class="starter-zone"><div><span class="eyebrow">RECOMMENDED FIRST PROJECT</span><h3>${safe(props.name)}</h3><p><b>${safe(props.acreage)} acres</b> &middot; approximately ${safe(props.approx_length_ft)} x ${safe(props.approx_width_ft)} feet &middot; ${safe(props.perimeter_ft)}-foot perimeter</p><p><small>${safe(props.geometry_measurement_basis)}</small></p><p><b>Base finish:</b> ${safe(props.finish_level||"REVEAL FINISH")}</p><p><b>Optional upgrade:</b> ${safe(props.optional_upgrade||"UNKNOWN")}</p>${props.geometry_status?`<p class="status-warn">${safe(props.geometry_status)}</p>`:""}<p><b>Existing condition:</b> ${safe(props.current_condition||props.existing_condition||"UNKNOWN")}</p><p><b>Primary objective:</b> ${safe(props.primary_objective||"UNKNOWN")}</p><b>Work included</b>${listHtml(props.included_scope)}<b>What is preserved</b>${listHtml(props.preserve)}<b>Not included</b>${listHtml(props.exclusions)}<p><b>Expected customer / marketing benefit:</b> ${safe(props.expected_benefit||"UNKNOWN")}</p><p><b>Expected visible result:</b> ${safe(props.expected_visible_result||"UNKNOWN")}</p><p><b>Target start:</b> ${safe(props.target_start||"UNKNOWN")}<br><b>Target completion:</b> ${safe(props.target_completion||"UNKNOWN")}</p><p><b>Fixed proposed price:</b> ${formatMoney(props.price)} ${props.price_status!=="VALIDATED"?'<span class="status-warn">NEEDS PRODUCTION TEST / NOT YET VALIDATED</span>':''}</p></div><div><h3>Featured before photographs (${new Set(props.before_photo_ids||[]).size})</h3><p>Click any photo, then use Previous / Next within this proposal only.</p><div class="proposal-photo-row">${proposalPhotoButtons(zone)}</div><div class="next-opportunities"><b>OPTIONAL NEXT OPPORTUNITIES</b>${listHtml(next)}</div></div></article>`;
    document.querySelectorAll("[data-proposal-photo]").forEach((button)=>button.onclick=()=>{const photo=state.source.photos.features.find((item)=>p(item).photo_id===button.dataset.proposalPhoto);if(photo)openPhoto(photo,{photos:photosForProposal(zone.id),label:`${props.name} PHOTOS`});});
    const lastWork=state.model.work_orders[state.model.work_orders.length-1];
    document.getElementById("acceptanceStatus").innerHTML=lastWork?`<div class="work-order-summary"><b>ACCEPTED PROPOSAL BECAME WORK ORDER</b><br>${safe(lastWork.work_order_id)} &middot; ${safe(lastWork.status)}<br>Payment processing: NOT ACTIVATED<br>Outcome: UNPERFORMED</div>`:"";
  }
  function saveSellPrice(){
    const zone=state.model.proposals.features.find((feature)=>feature.id===state.selectedProposalId)||state.model.proposals.features[0];if(!zone)return;
    const raw=document.getElementById("sellPrice").value.trim(),value=Core.money(raw),validated=document.getElementById("validatePrice").checked;
    const targetStart=document.getElementById("targetStart").value||"UNKNOWN",targetCompletion=document.getElementById("targetCompletion").value||"UNKNOWN";
    const patch={price:value,estimated_price:value===null?"UNKNOWN":value,price_status:value!==null&&validated?"VALIDATED":"DRAFT",target_start:targetStart,target_completion:targetCompletion};
    Core.replaceFeature(state.model,"proposals",zone.id,patch,"SET_PROPOSED_SELL_PRICE");saveModel();renderProposalSheet();renderInternalPricing();status(value===null?"Price remains UNKNOWN.":"Internal proposed price saved. Customer acceptance remains blocked until David validates it.");
  }
  function captureCustomerMessage(kind){const message=prompt(kind==="QUESTION"?"What is your question?":"What would you like changed?","");if(!message)return;const zone=state.model.proposals.features.find((feature)=>feature.id===state.selectedProposalId)||state.model.proposals.features[0];Core.addCustomerMessage(state.model,kind,message,"PEARSON-STARTER-REVEAL",p(zone).proposal_zone_id,VIEWER_ID);saveModel();document.getElementById("acceptanceStatus").textContent=kind==="QUESTION"?"Question saved for David.":"Change request saved for David.";}
  function acceptCurrentProposal(){try{const result=Core.acceptProposal(state.model,"Prototype customer",VIEWER_ID);saveModel();renderProposalSheet();status(`Proposal accepted and frozen. Work order ${result.work_order.work_order_id} created; no payment was activated.`);}catch(error){document.getElementById("acceptanceStatus").innerHTML=`<span class="status-warn">NOT ACCEPTED: ${safe(error.message)}</span>`;}}
  function handleMapClick(event){
    if(!state.draw)return;
    state.draw.points.push([event.latlng.lng,event.latlng.lat]);
    if(state.draw.preview)state.draw.preview.remove();
    state.draw.preview=L.polyline(state.draw.points.map(x=>[x[1],x[0]]),{color:"#f29f05",weight:4,dashArray:"6 5"}).addTo(state.map);
    status(`${state.draw.mode}: ${state.draw.points.length} point${state.draw.points.length===1?"":"s"}. Add at least 3, then press FINISH AREA.`);
  }
  function beginArea(mode){state.draw={mode,points:[],featureId:state.selectedProposalId,preview:null};const button=document.querySelector('[data-edit="DRAW_AREA"]');button.textContent="FINISH AREA";button.dataset.finishing="true";status("Click around the work area. Press FINISH AREA after at least three points.");}
  function finishArea(){if(!state.draw||state.draw.points.length<3){status("Add at least three map points before finishing the area.");return;}const coords=[...state.draw.points,state.draw.points[0]];const ring=[coords],metrics=Core.polygonMetrics(ring);if(state.draw.mode==="RESHAPE"&&state.draw.featureId){const before=Core.clone(state.model.proposals.features);const feature=state.model.proposals.features.find(f=>f.id===state.draw.featureId);feature.geometry.coordinates=ring;Object.assign(feature.properties,{acreage:metrics.acreage,quantity:metrics.acreage,perimeter_ft:metrics.perimeter_ft,approx_length_ft:metrics.approx_length_ft,approx_width_ft:metrics.approx_width_ft,geometry_measurement_basis:metrics.basis,geometry_status:"DAVID-DRAWN DRAFT - REVIEW BEFORE CUSTOMER USE"});Core.recordEdit(state.model,"RESHAPE","proposals",before,state.model.proposals.features,{feature_id:feature.id});}else{const id=`PROPOSAL-ZONE-${String(state.model.proposals.features.length+1).padStart(3,"0")}`;const type=prompt(`Work type:\n${WORK_TYPES.join("\n")}`,"CLEAR / REVEAL")||"OTHER";Core.addFeature(state.model,"proposals",{type:"Feature",id,geometry:{type:"Polygon",coordinates:ring},properties:{proposal_zone_id:id,name:prompt("Name this work area",`Zone ${state.model.proposals.features.length+1}`)||id,work_type:type,service_type:type,finish_level:"REVEAL FINISH",current_condition:"UNKNOWN",existing_condition:"UNKNOWN",primary_objective:"UNKNOWN",proposed_intervention:type,included_scope:[],preserve:[],remove:[],expected_benefit:"UNKNOWN",expected_visible_result:"UNKNOWN",target_start:"UNKNOWN",target_completion:"UNKNOWN",completion_target:"NEEDS PRODUCTION TEST",price:null,price_status:"DRAFT",market_alternative_reference:"UNKNOWN",customer_selected:false,recommended_first_project:false,quantity:metrics.acreage,unit:"acre",acreage:metrics.acreage,perimeter_ft:metrics.perimeter_ft,approx_length_ft:metrics.approx_length_ft,approx_width_ft:metrics.approx_width_ft,geometry_measurement_basis:metrics.basis,color:"#f29f05",before_photo_ids:[],linked_before_photo_ids:[],geometry_status:"DAVID-DRAWN DRAFT - REVIEW BEFORE CUSTOMER USE",evidence_status:"CONCEPTUAL PROPOSAL - NOT COMPLETED WORK"}},"DRAW_AREA");}if(state.draw.preview)state.draw.preview.remove();state.draw=null;const button=document.querySelector('[data-edit="DRAW_AREA"]');button.textContent="DRAW WORK AREA";delete button.dataset.finishing;saveModel();renderAll();status("Proposal area saved as a new map version. Original evidence was not changed.");}
  function editProposal(action){
    const feature=state.model.proposals.features.find(f=>f.id===state.selectedProposalId);
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
  function exportData(){const payload=Core.clone(state.model);payload.source_evidence.embedded_feature_collections=state.source;download(`PROPERTY_MAP_${PROPERTY_ID}_v${Math.max(state.model.proposals.current_version||0,state.model.presentation.current_version||0)}.json`,new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));}
  function projectExport(point,bounds,width,height){const x=(point[0]-bounds.minX)/(bounds.maxX-bounds.minX)*width,y=height-(point[1]-bounds.minY)/(bounds.maxY-bounds.minY)*height;return[x,y];}
  function exportImage(){
    const all=[];function walk(coords){if(typeof coords[0]==="number")all.push(coords);else coords.forEach(walk);}walk(state.source.parcel.features[0].geometry.coordinates);const bounds={minX:Math.min(...all.map(x=>x[0])),maxX:Math.max(...all.map(x=>x[0])),minY:Math.min(...all.map(x=>x[1])),maxY:Math.max(...all.map(x=>x[1]))};const W=1800,H=1200,pad=70,inner={minX:bounds.minX-(bounds.maxX-bounds.minX)*.04,maxX:bounds.maxX+(bounds.maxX-bounds.minX)*.04,minY:bounds.minY-(bounds.maxY-bounds.minY)*.04,maxY:bounds.maxY+(bounds.maxY-bounds.minY)*.04};
    const path=(coords)=>coords.map((pt,i)=>`${i?"L":"M"}${projectExport(pt,inner,W,H).join(" ")}`).join(" ");let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#e8eee9"/><text x="${pad}" y="48" font-family="Arial" font-size="32" font-weight="bold">PEARSON ROAD — PROPERTY IMPROVEMENT PROPOSAL</text>`;
    const rings=state.source.parcel.features[0].geometry.coordinates;svg+=rings.map(r=>`<path d="${path(r)}Z" fill="#f4d03f18" stroke="#9c7d00" stroke-width="7"/>`).join("");
    state.source.routes.features.forEach((feature)=>{if(feature.geometry.type==="LineString"&&visibleDate(dateOf(feature)))svg+=`<path d="${path(feature.geometry.coordinates)}" fill="none" stroke="${DAY_COLORS[dateOf(feature)]||'#555'}" stroke-width="5"/>`;});
    state.model.proposals.features.forEach((f,index)=>{const color=p(f).color||"#f29f05";svg+=`<path d="${path(f.geometry.coordinates[0])}Z" fill="${color}55" stroke="${color}" stroke-width="8"/><text x="${projectExport(f.geometry.coordinates[0][0],inner,W,H)[0]}" y="${projectExport(f.geometry.coordinates[0][0],inner,W,H)[1]}" font-family="Arial" font-size="28" font-weight="bold">${String.fromCharCode(65+index)} — ${p(f).name} (${p(f).acreage} ac)</text>`;});
    state.source.photos.features.filter((feature)=>evidenceVisible(feature)).forEach(f=>{const q=projectExport(f.geometry.coordinates,inner,W,H);const water=p(f).is_recorded_water_category;svg+=`<circle cx="${q[0]}" cy="${q[1]}" r="7" fill="${water?'#0a75c2':'#f5cf27'}" stroke="#111" stroke-width="2"/>`;});svg+=`<g font-family="Arial" font-size="22"><text x="${pad}" y="${H-90}">Aug 3 orange · Aug 4 purple · Aug 5 green · Aug 6 rose · Aug 7 blue · Blue W: recorded water</text><text x="${pad}" y="${H-50}" font-weight="bold">APPROXIMATE PHONE GPS AND COUNTY PARCEL — NOT A SURVEY</text></g></svg>`;
    const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));image.onload=()=>{const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;canvas.getContext("2d").drawImage(image,0,0);URL.revokeObjectURL(url);canvas.toBlob(blob=>download("PEARSON_ROAD_PROPERTY_IMPROVEMENT_PROPOSAL.png",blob),"image/png");};image.src=url;
  }

  function bindUi(){
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
    document.getElementById("undoEdit").addEventListener("click",()=>{Core.undo(state.model);saveModel();renderAll();});
    document.getElementById("featuredFilter").addEventListener("click",()=>{state.filter=state.filter==="FEATURED"?"ALL":"FEATURED";document.getElementById("featuredFilter").classList.toggle("active",state.filter==="FEATURED");updateFilmstrip(centerCoordinate());});
    document.getElementById("favoritesFilter").addEventListener("click",()=>{state.filter=state.filter==="FAVORITES"?"ALL":"FAVORITES";document.getElementById("favoritesFilter").classList.toggle("active",state.filter==="FAVORITES");updateFilmstrip(centerCoordinate());});
    document.getElementById("showFavoritesMap").addEventListener("change",renderAll);
    document.getElementById("topographyToggle").addEventListener("change",event=>event.target.checked?state.topoLayer.addTo(state.map):state.map.removeLayer(state.topoLayer));
    document.getElementById("contoursToggle").addEventListener("change",event=>event.target.checked?state.contourLayer.addTo(state.map):state.map.removeLayer(state.contourLayer));
    document.getElementById("exportMap").addEventListener("click",exportData);document.getElementById("exportImage").addEventListener("click",exportImage);document.getElementById("printMap").addEventListener("click",()=>window.print());
    document.getElementById("closePhoto").addEventListener("click",()=>document.getElementById("photoDialog").close());
    document.getElementById("previousPhoto").addEventListener("click",()=>movePhoto(-1));document.getElementById("nextPhoto").addEventListener("click",()=>movePhoto(1));
    document.addEventListener("keydown",(event)=>{const dialog=document.getElementById("photoDialog");if(!dialog.open)return;if(event.key==="ArrowLeft"){event.preventDefault();movePhoto(-1);}if(event.key==="ArrowRight"){event.preventDefault();movePhoto(1);}});
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
