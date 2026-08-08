"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("../pearson-road-map/property-map-core.js");

const close = (points) => [...points, points[0]];
const feature = (code, points, properties = {}) => ({ type:"Feature", id:`ZONE-${code}`, geometry:{type:"Polygon",coordinates:[close(points)]}, properties:{proposal_zone_id:`ZONE-${code}`,option_code:code,price:null,price_status:"DRAFT",customer_selected:false,...properties} });
const creekCenterline = [[-87.09269,30.49008],[-87.09253,30.49014],[-87.09236,30.49030],[-87.09237,30.49055],[-87.09229,30.49063],[-87.09216,30.49071],[-87.09220,30.49078],[-87.09218,30.49088],[-87.09210,30.49096],[-87.09199,30.49103],[-87.09191,30.49112],[-87.09186,30.49117]];
const bShape = [[-87.092310,30.490217],[-87.092048,30.490217],[-87.092048,30.489922],[-87.092032,30.489922],[-87.092032,30.490217],[-87.092000,30.490217],[-87.092000,30.490541],[-87.092310,30.490541]];
const cShape = [[-87.091489,30.490769],[-87.091439,30.490868],[-87.091393,30.490952],[-87.091310,30.490978],[-87.091169,30.490972],[-87.091058,30.490946],[-87.091027,30.490850],[-87.091024,30.490740],[-87.090984,30.490597],[-87.091020,30.490504],[-87.091064,30.490431],[-87.091125,30.490381],[-87.091190,30.490348],[-87.091267,30.490327],[-87.091353,30.490303],[-87.091405,30.490393],[-87.091454,30.490426],[-87.091433,30.490554],[-87.091489,30.490640]];
const dShape = [[-87.092730,30.488880],[-87.092360,30.488880],[-87.092360,30.489050],[-87.092470,30.489050],[-87.092470,30.489580],[-87.092486,30.489580],[-87.092486,30.489050],[-87.092730,30.489050]];

const a = feature("A", [[0,0],[0.00001,0],[0,0.00001]], { editable_centerline:creekCenterline,corridor_width_ft:5 });
const b = feature("B", bShape, { sunset_view_sightline:[[-87.092155,30.490379],[-87.092731,30.490379]],sunset_view_target_width_ft:40 });
const c = feature("C", cShape);
const d = feature("D", dShape, { sunset_view_sightline:[[-87.092545,30.488965],[-87.092730,30.488965]],sunset_view_target_width_ft:40 });

const qa=Core.proposalQuantities(a),qb=Core.proposalQuantities(b),qc=Core.proposalQuantities(c),qd=Core.proposalQuantities(d);
assert.deepEqual([qa.centerline_ft,qa.corridor_width_ft,qa.area_sq_ft,qa.acreage],[526,5,2629,0.06]);
assert.deepEqual([qb.area_sq_ft,qb.acreage],[12048,0.277]);
assert.deepEqual([qb.components[0].area_sq_ft,qb.components[0].approx_width_ft,qb.components[0].approx_length_ft],[11507,97.6,117.8]);
assert.deepEqual([qb.components[1].area_sq_ft,qb.components[1].approx_length_ft,qb.components[1].approx_width_ft],[541,107.3,5]);
assert.equal(qb.components[2].measurement_status,"TBD","northwest path length must remain TBD");
assert.equal(qb.components[3].counts_toward_total,false,"sunset sightline must not count as treatment area");
assert.equal(qb.components[3].approx_length_ft,181);
assert.deepEqual([qc.area_sq_ft,qc.acreage,qc.perimeter_ft,Math.round(qc.approx_width_ft)],[29849,0.685,667,159]);assert.ok(Math.abs(qc.approx_length_ft-245)<=1,"heavy-brush bounding length should remain approximately 245 feet");
assert.deepEqual([qd.area_sq_ft,qd.acreage],[8178,0.188]);
assert.deepEqual([qd.components[0].area_sq_ft,qd.components[0].approx_length_ft,qd.components[0].approx_width_ft],[7206,116.5,61.8]);
assert.deepEqual([qd.components[1].area_sq_ft,qd.components[1].approx_length_ft,qd.components[1].approx_width_ft],[972,192.8,5]);

assert.deepEqual(Core.proposalClearingTotals([a,b,c,d],["A","B","C"]),{option_codes:["A","B","C"],missing_option_codes:[],area_sq_ft:44526,acreage:1.022,complete:true,exclusions:["TBD northwest approach quantity","directional-only sunset sightlines","future separately drawn clearing corridors"]});
assert.equal(Core.proposalClearingTotals([a,b,c,d]).area_sq_ft,52704);
assert.equal(Core.proposalClearingTotals([a,b,c,d]).acreage,1.21);

const changedB=JSON.parse(JSON.stringify(b));changedB.geometry.coordinates[0][6][1]+=0.00005;changedB.geometry.coordinates[0].at(-1)[0]=changedB.geometry.coordinates[0][0][0];changedB.geometry.coordinates[0].at(-1)[1]=changedB.geometry.coordinates[0][0][1];assert.notEqual(Core.proposalQuantities(changedB).area_sq_ft,qb.area_sq_ft,"measurements must recalculate after geometry editing");
const longSightline=JSON.parse(JSON.stringify(b));longSightline.properties.sunset_view_sightline=[[-87.1,30.49],[-86.9,30.49]];assert.equal(Core.proposalQuantities(longSightline).area_sq_ft,qb.area_sq_ft,"directional sightline must never inflate clearing area");

[a,b,c,d].forEach((zone,index)=>{zone.properties.price=(index+1)*1000;zone.properties.price_status="VALIDATED";});
let summary=Core.proposalPackageSummary([a,b,c,d],{discount_type:"AMOUNT",discount_amount:null,discount_status:"DRAFT"});assert.equal(summary.final_package_price,null,"package price must remain unknown without an explicit discount");
summary=Core.proposalPackageSummary([a,b,c,d],{discount_type:"PERCENT",discount_percent:10,discount_status:"VALIDATED"});assert.deepEqual([summary.standalone_sum,summary.package_savings,summary.final_package_price,summary.complete],[10000,1000,9000,true]);
summary=Core.proposalPackageSummary([a,b,c,d],{discount_type:"AMOUNT",discount_amount:1500,discount_status:"VALIDATED",minimum_package_price:9000});assert.equal(summary.complete,false);assert.match(summary.warning,/BELOW/);

const root=path.resolve(__dirname,"..");const html=fs.readFileSync(path.join(root,"pearson-road-map","index.html"),"utf8"),app=fs.readFileSync(path.join(root,"pearson-road-map","app.js"),"utf8");
assert.match(html,/id="proposalOptions"/);assert.match(html,/id="packageOffer"/);assert.match(app,/ensureProposalOptions\(\)/);assert.match(app,/renderProposalOptions\(zones\)/);assert.match(app,/DIRECTIONAL SIGHTLINE ONLY - NOT INCLUDED AS CLEARING AREA/);assert.match(app,/northwest_approach_length_status:"TBD - NO LENGTH ASSIGNED"/);assert.match(app,/window\.PropertyMapReview=\{showProposalZone/);
assert.match(root ? fs.readFileSync(path.join(root,"pearson-road-map","styles.css"),"utf8") : "",/body\[data-profile="CUSTOMER_REVIEW"\] \[data-open-panel="proposal"\]\{display:none\}/,"customer view must hide geometry-edit controls");

console.log("PASS: Pearson proposal options recalculate from geometry, preserve TBD and directional exclusions, and block unapproved package pricing.");
