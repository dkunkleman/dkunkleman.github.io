const fs = require('fs');
const path = require('path');

const out = 'field-simple-test-direct-v10-where-am-i';
const appPath = path.join(out, 'app.js');
const swPath = path.join(out, 'sw.js');
let app = fs.readFileSync(appPath, 'utf8');

app = app.replaceAll('3.13.0-home-test.5.1-safari-direct-10-where-am-i-3', '3.13.0-home-test.5.1-safari-direct-10-where-am-i-4');

const pointNeedle = `  function whereAmITrackPoints() {\n    return (data.points || []).filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)));\n  }`;
if (!app.includes(pointNeedle)) throw new Error('WHERE AM I point source anchor missing');
app = app.replace(pointNeedle, `${pointNeedle}\n\n  function whereAmITrackSegments() {\n    const model = currentSegmentedRoute();\n    const segments = model && Array.isArray(model.segments) ? model.segments : [];\n    return segments.map(segment => (segment && Array.isArray(segment.points) ? segment.points : []).filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))).filter(segment => segment.length);\n  }`);

const drawNeedle = `    const rings=subjectRings();\n    const trail=whereAmITrackPoints();\n    const boundary=rings.map((ring,idx)=>'<path d="'+ring.map((p,i)=>(i?'L':'M')+sx(p[0]).toFixed(1)+' '+sy(p[1]).toFixed(1)).join(' ')+' Z" fill="rgba(255,255,255,.12)" stroke="'+(idx===0?'#e21d1d':'#ff8b22')+'" stroke-width="12" vector-effect="non-scaling-stroke"/>').join('');\n    const trailPath=trail.length>1?'<polyline points="'+trail.map(p=>sx(p.lon).toFixed(1)+','+sy(p.lat).toFixed(1)).join(' ')+'" fill="none" stroke="#1664d8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".9" vector-effect="non-scaling-stroke"/>':'';\n    const here=lastPosition?'<circle cx="'+sx(lastPosition.lon).toFixed(1)+'" cy="'+sy(lastPosition.lat).toFixed(1)+'" r="24" fill="#0a68ff" stroke="#fff" stroke-width="7" vector-effect="non-scaling-stroke"/><circle cx="'+sx(lastPosition.lon).toFixed(1)+'" cy="'+sy(lastPosition.lat).toFixed(1)+'" r="48" fill="none" stroke="#0a68ff" stroke-width="5" opacity=".38" vector-effect="non-scaling-stroke"/>':'';\n    svgEl.innerHTML='<rect width="1800" height="1500" fill="#d9ddd6"/>'+boundary+trailPath+here;\n    stateEl.textContent=(lastPosition?simpleLocatorState(rings):'LOCATION UNAVAILABLE')+' · '+trail.length+' GPS trail points';`;
if (!app.includes(drawNeedle)) throw new Error('WHERE AM I continuous trail anchor missing');
const drawReplacement = `    const rings=subjectRings();\n    const trail=whereAmITrackPoints();\n    const trailSegments=whereAmITrackSegments();\n    const boundary=rings.map((ring,idx)=>'<path d="'+ring.map((p,i)=>(i?'L':'M')+sx(p[0]).toFixed(1)+' '+sy(p[1]).toFixed(1)).join(' ')+' Z" fill="rgba(255,255,255,.12)" stroke="'+(idx===0?'#e21d1d':'#ff8b22')+'" stroke-width="12" vector-effect="non-scaling-stroke"/>').join('');\n    const trailPaths=trailSegments.map(segment=>segment.length>1?'<polyline points="'+segment.map(p=>sx(p.lon).toFixed(1)+','+sy(p.lat).toFixed(1)).join(' ')+'" fill="none" stroke="#1664d8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".9" vector-effect="non-scaling-stroke"/>':'').join('');\n    const trailDots=trailSegments.filter(segment=>segment.length===1).map(segment=>'<circle cx="'+sx(segment[0].lon).toFixed(1)+'" cy="'+sy(segment[0].lat).toFixed(1)+'" r="7" fill="#1664d8" opacity=".8"/>').join('');\n    const here=lastPosition?'<circle cx="'+sx(lastPosition.lon).toFixed(1)+'" cy="'+sy(lastPosition.lat).toFixed(1)+'" r="24" fill="#0a68ff" stroke="#fff" stroke-width="7" vector-effect="non-scaling-stroke"/><circle cx="'+sx(lastPosition.lon).toFixed(1)+'" cy="'+sy(lastPosition.lat).toFixed(1)+'" r="48" fill="none" stroke="#0a68ff" stroke-width="5" opacity=".38" vector-effect="non-scaling-stroke"/>':'';\n    svgEl.innerHTML='<rect width="1800" height="1500" fill="#d9ddd6"/>'+boundary+trailPaths+trailDots+here;\n    stateEl.textContent=(lastPosition?simpleLocatorState(rings):'LOCATION UNAVAILABLE')+' · '+trail.length+' GPS trail points · '+trailSegments.length+' walked segments';`;
app = app.replace(drawNeedle, drawReplacement);

fs.writeFileSync(appPath, app);

let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replaceAll('3.13.0-home-test.5.1-safari-direct-10-where-am-i-3', '3.13.0-home-test.5.1-safari-direct-10-where-am-i-4');
sw = sw.replaceAll('property-inspector-home-test-313-direct-v10-where-am-i-3', 'property-inspector-home-test-313-direct-v10-where-am-i-4');
fs.writeFileSync(swPath, sw);

console.log('Patched WHERE AM I to display segmented walked routes without false straight relocation lines.');
