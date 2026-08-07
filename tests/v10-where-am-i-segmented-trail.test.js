const fs=require('fs');
const vm=require('vm');
const app=fs.readFileSync('field-simple-test-direct-v10-where-am-i/app.js','utf8');
new vm.Script(app);
function need(text,msg){if(!app.includes(text)) throw new Error(msg);}
need('3.13.0-home-test.5.1-safari-direct-10-where-am-i-4','v4 version missing');
need('function whereAmITrackSegments()','segmented trail helper missing');
need('const model = currentSegmentedRoute();','WHERE AM I must use the existing segmented route model');
need('Array.isArray(model.segments)','segmented route list is not consumed');
need('const trailSegments=whereAmITrackSegments();','map does not render segmented trails');
need('trailSegments.map(segment=>segment.length>1','walked segments are not drawn separately');
need("+' walked segments'",'walked segment count is not visible');
if(app.includes("const trailPath=trail.length>1?'<polyline")) throw new Error('single continuous raw GPS polyline still exists in WHERE AM I');
console.log('PASS: WHERE AM I draws only segmented walked routes and does not invent straight relocation lines.');
