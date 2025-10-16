// === Supabase init ===
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = "https://tiajlbxezlddhxtebtbg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYWpsYnhlemxkZGh4dGVidGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTcwNTYsImV4cCI6MjA3NjAzMzA1Nn0.szBJhvyDcV6oDn-NgVUUxF_MZdHC60xXBe0AgDDQbbU";
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === Tiny helpers ===
const $ = s => document.querySelector(s);
const td = v => `<td>${v ?? ""}</td>`;
const esc = s => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function showToast(msg){ const T=$("#toast"); if(!T) return; T.textContent=msg; T.style.display="block"; setTimeout(()=>T.style.display="none",1400); }
function isURL(u){ try{const x=new URL(u); return /^https?:/.test(x.protocol);}catch{return false} }
function confetti(){ const n=80,box=document.body,H=innerHeight,W=innerWidth; for(let i=0;i<n;i++){const d=document.createElement("div"); d.style.cssText=`position:fixed;left:${Math.random()*W}px;top:-10px;width:6px;height:10px;background:hsl(${Math.random()*360} 90% 60%);opacity:.9;transform:rotate(${Math.random()*360}deg);border-radius:2px;z-index:9999`; box.appendChild(d); const t=1500+Math.random()*1200,x=(Math.random()-.5)*120; d.animate([{transform:`translate(0,0) rotate(0deg)`},{transform:`translate(${x}px, ${H+40}px) rotate(${360*Math.random()}deg)`}],{duration:t,easing:"cubic-bezier(.2,.7,.2,1)"}).finished.then(()=>d.remove())} }
function badge(count){ if(count>=7) return `🏅 <span class="badge">7-Day Streak</span>`; if(count>=3) return `🎖️ <span class="badge">3-Day Streak</span>`; if(count>=1) return `✅ <span class="badge">First Action</span>`; return ""; }

// === Background rotator ===
document.body.classList.add('has-photo');
const bg=document.getElementById('page-bg');
if(bg){
  const bgImages=[
    "https://images.unsplash.com/photo-1465447142348-e9952c393450?q=80&w=2000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1509099836639-18ba1795216d?q=80&w=2000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511735643442-503bb3bd3487?q=80&w=2000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2000&auto=format&fit=crop"
  ];
  let i=0; const setBG=idx=>{ bg.style.opacity=0; setTimeout(()=>{ bg.style.backgroundImage=`url("${bgImages[idx]}")`; bg.style.opacity=1; },220); };
  setBG(i); setInterval(()=>{ i=(i+1)%bgImages.length; setBG(i); },12000);
}

// === Actions from actions.html + popularity bubble ===
async function fetchActionsFromActionsHTML(){
  const res = await fetch("/actions.html", { cache:"no-store" });
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const cards = [...doc.querySelectorAll('.card')];
  const seen = new Set(), names=[], details = new Map();
  for(const card of cards){
    const name = (card.querySelector('a[data-action]')?.getAttribute('data-action')
                || card.querySelector('h3')?.textContent || "").trim();
    const desc = (card.querySelector('p')?.textContent || "").trim();
    if(name && !seen.has(name.toLowerCase())){ seen.add(name.toLowerCase()); names.push(name); details.set(name, desc); }
  }
  return { names, details };
}

function renderTop3Covers(top3){
  const caps = [...document.querySelectorAll(".img-cards .img-card .cap")];
  top3.slice(0,3).forEach((name,idx)=>{
    if(!caps[idx]) return;
    caps[idx].textContent = name;
    const card = caps[idx].closest(".img-card");
    card.style.cursor = "pointer";
    card.onclick = ()=>{
      const sel=$("#action");
      if(sel){ [...sel.options].forEach(o=>{ if(o.value===name) sel.value=name }); document.getElementById('actionDesc').scrollIntoView({behavior:"smooth"}); }
      openComposeFor(name);
    };
  });
}

async function bubblePopularActions(){
  const sel = $("#action"); if(!sel) return;
  const { names, details } = await fetchActionsFromActionsHTML();

  const { data, error } = await sb.from("submissions").select("action");
  const counts = {};
  if(!error && data){ data.forEach(r => counts[r.action] = (counts[r.action]||0)+1); }

  const pinned = ["Live your faith","Know your rights","Build and serve"].map(s=>s.toLowerCase());
  const keyed = names.map((a,i)=>({ name:a, i, c:counts[a]||0, pinned:pinned.includes(a.toLowerCase()) }));
  keyed.sort((A,B)=> A.pinned!==B.pinned ? (A.pinned?-1:1) : (B.c-A.c) || (A.i-B.i));

  const first = sel.options[0]; sel.innerHTML=""; sel.appendChild(first);
  keyed.forEach(k=>{ const o=document.createElement("option"); o.value=o.text=k.name; sel.appendChild(o); });

  // Top-3 line
  const topLine = keyed.slice(0,3).map(k=>k.name);
  const top3El = $("#top3"); if(top3El) top3El.textContent = topLine.length ? "Top today: "+topLine.join(" • ") : "";

  // Action description live update
  sel.addEventListener('change', ()=>{
    const v = sel.value;
    $("#actionDesc").textContent = details.get(v) || "";
    if(v) openComposeFor(v);
  });

  // Initial desc (none) + cards
  renderTop3Covers(topLine);
  // Keep a small reference for compose prefill
  window.__lc_details = details;
}

// === Compose modal (Step 2) ===
const compose = $("#compose");
const closeCompose = $("#closeCompose");
const composeText = $("#composeText");

function openComposeFor(actionName){
  const desc = window.__lc_details?.get(actionName) || "";
  $("#actionDesc").textContent = desc;
  const caption = `I just did “${actionName || 'One Small Good Thing'}” with #LiveLikeCharlie — your turn: pick one, post it, and invite 3 friends. ${location.origin}`;
  if(composeText) composeText.value = caption;
  compose?.classList.add("show");
  if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(caption).catch(()=>{});
}
closeCompose?.addEventListener('click', ()=> compose?.classList.remove('show'));
compose?.addEventListener('click', e=>{ if(e.target.id==='compose') compose.classList.remove('show'); });

// Platform handlers + copy caption
compose?.addEventListener('click', e=>{
  const btn = e.target.closest('button[data-platform]'); if(!btn) return;
  const txt = encodeURIComponent(composeText?.value || "");
  if(btn.dataset.platform === 'x'){
    window.open("https://x.com/intent/tweet?text="+txt, "_blank","noopener,noreferrer");
  } else if(btn.dataset.platform === 'facebook'){
    const shareUrl = encodeURIComponent(location.origin + location.pathname);
    window.open("https://www.facebook.com/sharer/sharer.php?u="+shareUrl+"&quote="+txt, "_blank","noopener,noreferrer");
  } else if(btn.dataset.platform === 'instagram'){
    window.open("https://www.instagram.com/", "_blank","noopener,noreferrer");
    alert("Instagram doesn’t allow prefilled captions from the web. We copied your text. Paste it into the caption.");
  } else if(btn.dataset.platform === 'tiktok'){
    window.open("https://www.tiktok.com/creator-center/upload?lang=en", "_blank","noopener,noreferrer");
    alert("TikTok doesn’t allow prefilled captions from the web. We copied your text. Paste it into the caption.");
  }
});
$("#copyCompose")?.addEventListener('click', async ()=>{
  const t = composeText?.value || ""; await navigator.clipboard.writeText(t); showToast("Copied!");
});

// === Share section enhancements ===
$("#shot")?.addEventListener('change', ()=>{
  const f = $("#shot").files?.[0]; const prev = $("#shotPreview");
  if(!f || !prev) return; const r=new FileReader();
  r.onload = e=>{ prev.src=e.target.result; prev.style.display='block'; };
  r.readAsDataURL(f);
});

// === Submit handler (with screenshot upload) ===
let lastClick = 0;
$("#completeBtn")?.addEventListener('click', async()=>{
  const now = Date.now(); if(now-lastClick < 8000){ alert("Please wait a moment between submissions."); return; }
  lastClick = now;

  const action = $("#action")?.value.trim();
  const link = $("#link")?.value.trim();
  const name = ($("#name")?.value || "").trim() || null;

  if(!action || !link){ alert("Please pick an action and paste your link."); return; }
  if(!isURL(link)){ alert("Please paste a valid public link (starts with http/https)."); return; }

  let screenshot_url = null;
  const file = $("#shot")?.files?.[0];
  if(file){
    const path=`${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
    const up = await sb.storage.from("proofs").upload(path, file, { upsert:false });
    if(up.error){ console.error(up.error); alert("Upload failed: "+up.error.message); return; }
    const { data } = sb.storage.from("proofs").getPublicUrl(path);
    screenshot_url = data.publicUrl;
  }

  const ins = await sb.from("submissions").insert([{ action, platform: "Unknown", link, name, screenshot_url }]).select();
  if(ins.error){ console.error(ins.error); alert("Save failed: "+ins.error.message); return; }

  showToast("Saved! Updating lists…");
  confetti();

  const k="lc_days"; const today=new Date().toISOString().slice(0,10);
  const days=new Set(JSON.parse(localStorage.getItem(k)||"[]")); days.add(today);
  localStorage.setItem(k, JSON.stringify([...days]));
  $("#badge").innerHTML = badge(days.size);

  $("#link").value=""; if($("#shot")) $("#shot").value="";
  await Promise.all([bubblePopularActions(), loadRecent(), loadLeaders()]);

  if(navigator.share){
    await navigator.share({title:"Live Like Charlie", text:"I completed a Like Charlie action! Your turn—pick one, post it, and invite 3 friends.", url: location.origin});
  }
});

$("#inviteBtn")?.addEventListener('click', async()=>{
  if(navigator.share){
    await navigator.share({title:"Live Like Charlie", text:"Join me: do one small good action, post it, and invite 3 friends.", url: location.origin});
  } else {
    alert("Copy the page link and text your friends!");
  }
});

// === Tables ===
async function loadRecent(){
  const { data, error } = await sb.from("submissions")
    .select("created_at, action, platform, link, name, screenshot_url")
    .order("created_at",{ascending:false}).limit(25);
  if(error){ console.error(error); return; }
  const rows = (data||[]).map(r=>{
    const when = new Date(r.created_at).toLocaleString();
    const url = `<a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">Open</a>`;
    const shot = r.screenshot_url ? `<a href="${esc(r.screenshot_url)}" target="_blank" rel="noopener noreferrer">Screenshot</a>` : "";
    return `<tr>${td(when)}${td(esc(r.action))}${td(esc(r.platform||""))}${td(url)}${td(esc(r.name||""))}${td(shot)}</tr>`;
  });
  $("#recent").innerHTML = rows.length
    ? `<tr><th>When</th><th>Action</th><th>Platform</th><th>Link</th><th>Name</th><th>Proof</th></tr>` + rows.join("")
    : `<tr><td colspan="6" class="muted">No submissions yet — be the first!</td></tr>`;
}

async function loadLeaders(){
  const { data, error } = await sb.from("submissions").select("action");
  if(error){ console.error(error); return; }
  const counts = {}; (data||[]).forEach(r => counts[r.action] = (counts[r.action]||0)+1);
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  $("#leaders").innerHTML = sorted.length
    ? `<tr><th>#</th><th>Action</th><th>Count</th></tr>` + sorted.map((r,i)=>`<tr>${td(i+1)}${td(esc(r[0]))}${td(r[1])}</tr>`).join("")
    : `<tr><td colspan="3" class="muted">No leaderboard yet — your post could be first.</td></tr>`;
}

// === Smooth scroll & brand share ===
document.querySelectorAll('a[href^="#"], a[href="/#impact"]').forEach(a=>{
  a.addEventListener('click',e=>{
    const href=a.getAttribute('href'); const id=href?.startsWith('/#')?href.slice(1):href;
    const el=id?document.querySelector(id):null;
    if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth'}); }
  });
});
document.querySelector('.brand')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  const url=location.origin, text="Do one small good action. #LiveLikeCharlie";
  if(navigator.share){ await navigator.share({title:"Live Like Charlie", text, url}); }
  else{ window.open("https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url),"__blank","noopener,noreferrer"); }
});

// === Prefill link via share target (?shared_url=...) ===
const params = new URLSearchParams(location.search);
const shared = params.get("shared_url") || params.get("url") || params.get("text");
if(shared && $("#link")){ $("#link").value = shared; $("#submit").scrollIntoView({behavior:"smooth"}); }

// === Kickoff ===
await Promise.all([bubblePopularActions(), loadRecent(), loadLeaders()]);
if('serviceWorker' in navigator){ navigator.serviceWorker.register('/sw.js'); }
