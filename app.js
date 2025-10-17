<script type="module">
/* ===== Core setup ===== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Your Supabase (same as current) */
const SUPABASE_URL = "https://tiajlbxezlddhxtebtbg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYWpsYnhlemxkZGh4dGVidGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTcwNTYsImV4cCI6MjA3NjAzMzA1Nn0.szBJhvyDcV6oDn-NgVUUxF_MZdHC60xXBe0AgDDQbbU";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Mini utils */
const $  = sel => document.querySelector(sel);
const td = v => `<td>${v ?? ""}</td>`;
const esc = s => (s||"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const scrollTarget = () => (
  document.getElementById("submit") ||
  document.querySelector("#step2")  ||
  document.querySelector("#link")   ||
  document.body
);
function showToast(msg){
  const T = $("#toast"); if(!T) return;
  T.textContent = msg; T.style.display = "block";
  setTimeout(()=>T.style.display="none",1400);
}
function confetti(){
  const n=80, H=innerHeight, W=innerWidth;
  for(let i=0;i<n;i++){
    const d=document.createElement("div");
    d.style.cssText=`position:fixed;left:${Math.random()*W}px;top:-10px;width:6px;height:10px;background:hsl(${Math.random()*360} 90% 60%);opacity:.9;border-radius:2px;z-index:9999`;
    document.body.appendChild(d);
    const t=1500+Math.random()*1200, x=(Math.random()-.5)*120;
    d.animate([{transform:`translate(0,0)`},{transform:`translate(${x}px, ${H+40}px)`}],{duration:t,easing:"cubic-bezier(.2,.7,.2,1)"}).finished.then(()=>d.remove());
  }
}
function badge(count){
  if(count>=7) return `🏅 <span class="badge">7-Day Streak</span>`;
  if(count>=3) return `🎖️ <span class="badge">3-Day Streak</span>`;
  if(count>=1) return `✅ <span class="badge">First Action</span>`;
  return "";
}
function isLikelyURL(u){
  try{ const x=new URL(u); return /^(https?):/.test(x.protocol) }catch{ return false }
}

function openComposeModal(actionName){
  const M  = document.getElementById('composeModal');
  const BG = document.getElementById('composeBg');
  const TX = document.getElementById('composeText');
  const AC = document.getElementById('composeAction');
  if(!M || !BG || !TX) return;

  AC && (AC.textContent = actionName || "");

  const site = location.origin;
  const base = `I just did "${actionName}" with #LiveLikeCharlie — your turn. ${site}`;
  TX.value = base;
  // Try to copy for convenience
  navigator.clipboard?.writeText(base).catch(()=>{});

  M.classList.add('open');
  TX.focus();
}

function closeComposeModal(){
  document.getElementById('composeModal')?.classList.remove('open');
}

function setComposeBackground(url){
  const BG = document.getElementById('composeBg');
  if(BG) BG.style.backgroundImage = url ? `url("${url}")` : '';
}

function renderComposeBackgroundChoices(){
  const el = document.getElementById('bgPicker');
  if(!el) return;

  // Put any filenames you have in /img here (add/remove freely)
  const images = [
    '/img/flag.jpg',
    '/img/constitution.jpg',
    '/img/flag2.jpg',
    '/img/eagle.jpg',
    '/img/bibles.jpg'
  ];

  el.innerHTML = '';
  images.forEach((src, i) => {
    const b = document.createElement('button');
    b.style.backgroundImage = `url("${src}")`;
    b.title = 'Background ' + (i+1);
    b.onclick = () => {
      [...el.children].forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      setComposeBackground(src);
    };
    // Hide if missing
    const img = new Image();
    img.onerror = ()=> b.style.display='none';
    img.src = src;

    el.appendChild(b);
    if(i === 0) b.click(); // pick first by default
  });
}


/* ===== Sticky header + Social share strip ===== */
(function mountStickyAndShareBar(){
  // Make top header/nav sticky
  const style = document.createElement("style");
  style.textContent = `
    header, .nav { position: sticky; top: 0; z-index: 1000; }
    header { backdrop-filter: blur(6px); background: rgba(11,18,32,.65); }
    #shareStrip {
      position: sticky; top: 52px; z-index: 999;
      display:flex; gap:10px; align-items:center; flex-wrap:wrap;
      padding:8px 12px; background: rgba(16,24,48,.55); border-bottom: 1px solid rgba(255,255,255,.15);
    }
    #shareStrip .icons { display:flex; gap:8px; align-items:center }
    #shareStrip button, #shareStrip a {
      display:inline-flex; align-items:center; gap:8px;
      padding:6px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.18);
      color:#fff; text-decoration:none; cursor:pointer; background:rgba(255,255,255,.05);
    }
    #shareStrip input { flex:1 1 380px; min-width:240px; padding:6px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.25); background:rgba(0,0,0,.35); color:#fff }
  `;
  document.head.appendChild(style);

  // Build social strip
  const strip = document.createElement("div");
  strip.id = "shareStrip";
  const msgDefault = "I’m doing one small good action with #LiveLikeCharlie — pick one, post it, and invite 3 friends: ";
  strip.innerHTML = `
    <div class="icons">
      <strong>Share:</strong>
      <a id="sX"       title="Share to X"        rel="noopener noreferrer">X</a>
      <a id="sFB"      title="Share to Facebook" rel="noopener noreferrer">Facebook</a>
      <a id="sIG"      title="Open Instagram"    rel="noopener noreferrer">Instagram</a>
      <a id="sTT"      title="Open TikTok"       rel="noopener noreferrer">TikTok</a>
      <button id="sCopy" title="Copy suggested message">Copy</button>
      <button id="sShare" title="Native share">System Share</button>
    </div>
    <input id="sMsg" value="${esc(msgDefault)}${esc(location.origin)}" />
  `;
  const headerEl = document.querySelector("header") || document.body.firstElementChild;
  headerEl?.insertAdjacentElement("afterend", strip);

  // Wire handlers
  const msg = () => ($("#sMsg")?.value || msgDefault) + " " + location.origin;

  $("#sX")?.addEventListener("click",  e=>{
    e.preventDefault();
    const u = "https://x.com/intent/tweet?text="+encodeURIComponent(msg());
    window.open(u,"_blank","noopener,noreferrer");
  });
  $("#sFB")?.addEventListener("click", e=>{
    e.preventDefault();
    const u = "https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(location.origin)+"&quote="+encodeURIComponent(msg());
    window.open(u,"_blank","noopener,noreferrer");
  });
  $("#sIG")?.addEventListener("click", e=>{
    e.preventDefault(); window.open("https://www.instagram.com/","_blank","noopener,noreferrer");
  });
  $("#sTT")?.addEventListener("click", e=>{
    e.preventDefault(); window.open("https://www.tiktok.com/creator-center/upload?lang=en","_blank","noopener,noreferrer");
  });
  $("#sCopy")?.addEventListener("click", async ()=>{
    await navigator.clipboard.writeText($("#sMsg").value); showToast("Copied!");
  });
  $("#sShare")?.addEventListener("click", async ()=>{
    if(navigator.share){
      await navigator.share({ title:"Live Like Charlie", text: $("#sMsg").value, url: location.origin });
    }else{
      const u = "https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(location.origin);
      window.open(u,"_blank","noopener,noreferrer");
    }
  });
})();

document.getElementById('composeClose')?.addEventListener('click', closeComposeModal);
document.querySelector('#composeModal .lc-backdrop')?.addEventListener('click', closeComposeModal);
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeComposeModal(); });

document.getElementById('copyCompose')?.addEventListener('click', async ()=>{
  const v = document.getElementById('composeText')?.value || '';
  await navigator.clipboard.writeText(v);
  showToast('Copied!');
});

document.getElementById('goX')?.addEventListener('click', ()=>{
  const v = document.getElementById('composeText')?.value || '';
  window.open('https://x.com/intent/tweet?text='+encodeURIComponent(v), '_blank','noopener,noreferrer');
});
document.getElementById('goFB')?.addEventListener('click', ()=>{
  const v = document.getElementById('composeText')?.value || '';
  window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(location.origin)+'&quote='+encodeURIComponent(v), '_blank','noopener,noreferrer');
});
document.getElementById('goIG')?.addEventListener('click', ()=>{
  window.open('https://www.instagram.com/', '_blank','noopener,noreferrer');
});
document.getElementById('goTT')?.addEventListener('click', ()=>{
  window.open('https://www.tiktok.com/creator-center/upload?lang=en', '_blank','noopener,noreferrer');
});


/* ===== Actions: fetch from /actions.html, compute counts, sort, render top-3 ===== */
async function fetchActionsFromActionsHTML(){
  // Scrape visible actions (data-action) from /actions.html
  const res  = await fetch("/actions.html", { credentials:"omit", cache:"no-store" });
  const html = await res.text();
  const doc  = new DOMParser().parseFromString(html,"text/html");
  const links = [...doc.querySelectorAll('a[data-action]')];
  const seen  = new Set();
  const names = [];
  for(const a of links){
    const name = (a.getAttribute("data-action") || a.textContent || "").trim();
    if(name && !seen.has(name.toLowerCase())){ seen.add(name.toLowerCase()); names.push(name); }
  }
  return names;
}

function renderTop3Covers(top3Names){
  // Expect elements with [data-top3-card] and inner [data-top3-name]
  const cards = [...document.querySelectorAll("[data-top3-card]")];
  cards.forEach((card,i)=>{
    const name = top3Names[i];
    if(!name){ card.style.display="none"; return; }
    card.style.display="";
    const cap = card.querySelector("[data-top3-name]");
    if(cap) cap.textContent = name;
    card.style.cursor = "pointer";
    card.onclick = () => {
      const sel = $("#action");
      if(sel){
        // ensure option exists
        let found=false; for(const o of sel.options){ if((o.value||o.text)===name){found=true;break} }
        if(!found){ const o=document.createElement("option"); o.value=name; o.text=name; sel.appendChild(o); }
        sel.value = name;
        sel.dispatchEvent(new Event("change",{bubbles:true}));
      }
      scrollTarget()?.scrollIntoView({behavior:"smooth"});
    };
  });
}

async function bubblePopularActions(){
  const actions = await fetchActionsFromActionsHTML();

  // Get counts
  let counts = {};
  try{
    const { data, error } = await sb.from("submissions").select("action");
    if(!error && Array.isArray(data)){
      for(const r of data){ if(r && r.action){ counts[r.action] = (counts[r.action]||0)+1; } }
    }
  }catch(_){ /* ignore, render alpha if offline */ }

  // Sort by count desc, then name asc
  const keyed = actions.map(name=>({ name, n: counts[name]||0 }))
                       .sort((a,b)=> (b.n - a.n) || a.name.localeCompare(b.name));

  // Fill Step 1 select
  const sel = $("#action");
  if(sel){
    const first = sel.options[0] ? sel.options[0].outerHTML : '<option value="">Select an action…(step 2 Posting the action will pop up)</option>';
    sel.innerHTML = first + keyed.map(k=>`<option value="${esc(k.name)}">${esc(k.name)}</option>`).join("");
    sel.addEventListener("change", () => {
      if(!sel.value) return;
      // Your description logic (if any) will still listen to 'change'
      scrollTarget()?.scrollIntoView({ behavior:"smooth" });
    }, { once: true });
  }

  // Paint Top-3
  renderTop3Covers(keyed.slice(0,3).map(k=>k.name));
}

/* ===== Compose / share helpers in Step 2 ===== */
$("#composeX")   && ($("#composeX").onclick  = () => window.open("https://x.com/intent/tweet?text="+encodeURIComponent($("#suggested")?$("#suggested").value:""), "_blank","noopener,noreferrer"));
$("#composeFB")  && ($("#composeFB").onclick = () => window.open("https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(location.origin), "_blank","noopener,noreferrer"));
$("#copyMsg")    && ($("#copyMsg").onclick   = async()=>{ const box=$("#suggested"); if(!box) return; await navigator.clipboard.writeText(box.value); showToast("Copied!"); });

const platformOpeners = {
  "X":         ()=>$("#composeX")?.click(),
  "Facebook":  ()=>$("#composeFB")?.click(),
  "Instagram": ()=>window.open("https://www.instagram.com/","_blank","noopener,noreferrer"),
  "TikTok":    ()=>window.open("https://www.tiktok.com/creator-center/upload?lang=en","_blank","noopener,noreferrer"),
  "Other":     ()=>window.open(location.origin,"_blank","noopener,noreferrer"),
};
$("#openPlatform") && ($("#openPlatform").onclick = ()=>{
  const p = $("#platform")?.value;
  if(!p){ alert("Select a platform"); return; }
  (platformOpeners[p] || platformOpeners["Other"])();
});
$("#shareNative") && ($("#shareNative").onclick = async()=>{
  if(navigator.share){
    await navigator.share({ title:"Live Like Charlie", text:"I’m doing one small good action. Your turn—pick one, post it, invite 3 friends.", url: location.origin });
  }else{
    window.open("https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(location.origin),"_blank","noopener,noreferrer");
  }
});

/* ===== Save (Step 3) ===== */
async function completeChallenge(){
  const action   = $("#action")?.value.trim();
  const platform = $("#platform")?.value.trim();
  const link     = $("#link")?.value.trim();
  const name     = ($("#name")?.value || "").trim() || null;

  if(!action || !platform || !link){ alert("Please pick action + platform and paste your link."); return; }
  if(!isLikelyURL(link))           { alert("Please paste a valid public link (starts with http/https)."); return; }

  // optional screenshot upload
  let screenshot_url = null;
  const file = $("#shot")?.files?.[0];
  if(file){
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
    const up = await sb.storage.from("proofs").upload(path, file, { upsert:false });
    if(up.error){ console.error(up.error); alert("Upload failed: " + up.error.message); return; }
    const { data } = sb.storage.from("proofs").getPublicUrl(path);
    screenshot_url = data.publicUrl;
  }

  const ins = await sb.from("submissions").insert([{ action, platform, link, name, screenshot_url }]).select();
  if(ins.error){ console.error(ins.error); alert("Save failed: " + ins.error.message); return; }

  showToast("Saved! Updating lists…"); confetti();

  // local streak badge
  const k="lc_days", today=new Date().toISOString().slice(0,10);
  const days=new Set(JSON.parse(localStorage.getItem(k)||"[]")); days.add(today);
  localStorage.setItem(k, JSON.stringify([...days]));
  $("#badge") && ($("#badge").innerHTML = badge(days.size));

  // reset inputs
  $("#link") && ($("#link").value = "");
  if($("#shot")) $("#shot").value = "";

  await Promise.all([ bubblePopularActions(), loadRecent(), loadLeaders() ]);

  if(navigator.share){
    await navigator.share({ title:"Live Like Charlie", text:"I completed a Like Charlie action! Your turn—pick one, post it, and invite 3 friends.", url: location.origin });
  }
}
$("#completeBtn") && ($("#completeBtn").onclick = completeChallenge);
$("#inviteBtn")   && ($("#inviteBtn").onclick   = async()=>{
  if(navigator.share){
    await navigator.share({ title:"Live Like Charlie", text:"Join me: do one small good action, post it, and invite 3 friends.", url: location.origin });
  }else{
    alert("Copy the page link and text your friends!");
  }
});

/* ===== Recent + Leaders ===== */
async function loadRecent(){
  const { data, error } = await sb.from("submissions")
    .select("created_at, action, platform, link, name, screenshot_url")
    .order("created_at",{ascending:false}).limit(25);
  if(error){ console.error(error); return; }

  const rows = (data||[]).map(r=>{
    const when = new Date(r.created_at).toLocaleString();
    const url  = `<a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">Open</a>`;
    const shot = r.screenshot_url ? `<a href="${esc(r.screenshot_url)}" target="_blank" rel="noopener noreferrer">Screenshot</a>` : "";
    return `<tr>${td(when)}${td(esc(r.action))}${td(esc(r.platform))}${td(url)}${td(esc(r.name||""))}${td(shot)}</tr>`;
  });
  const tbl=$("#recent"); if(tbl) tbl.innerHTML = `<tr><th>When</th><th>Action</th><th>Platform</th><th>Link</th><th>Name</th><th>Proof</th></tr>` + rows.join("");
}
async function loadLeaders(){
  const { data, error } = await sb.from("submissions").select("action");
  if(error){ console.error(error); return; }
  const counts = {}; (data||[]).forEach(r=> counts[r.action] = (counts[r.action]||0)+1);
  const sorted = Object.entries(counts).sort((a,b)=> b[1]-a[1]);
  const tbl = $("#leaders");
  if(tbl) tbl.innerHTML = `<tr><th>#</th><th>Action</th><th>Count</th></tr>` + sorted.map((r,i)=>`<tr>${td(i+1)}${td(esc(r[0]))}${td(r[1])}</tr>`).join("");
}

/* ===== Deep links & boot ===== */
const params = new URLSearchParams(location.search);
const shared = params.get("shared_url") || params.get("url") || params.get("text");
if(shared && $("#link")){ $("#link").value = shared; scrollTarget()?.scrollIntoView({behavior:"smooth"}); }

await Promise.all([ bubblePopularActions(), loadRecent(), loadLeaders() ]);

/* Accept ?action=...&step=2 from /actions.html red buttons */
{
  const chosen = params.get("action");
  const step   = params.get("step");
  const sel    = $("#action");
  if(chosen && sel){
    let found=false; for(const o of sel.options){ if((o.value||o.text)===chosen){found=true;break} }
    if(!found){ const o=document.createElement("option"); o.value=chosen; o.text=chosen; sel.appendChild(o); }
    sel.value = chosen;
    sel.dispatchEvent(new Event("change",{bubbles:true}));
  }
  if(step==="2"){ scrollTarget()?.scrollIntoView({behavior:"smooth"}); }
}

/* PWA worker (unchanged) */
if("serviceWorker" in navigator){ navigator.serviceWorker.register("/sw.js"); }

/* Clickable brand share helper (unchanged) */
{
  const brand = document.querySelector(".brand");
  if(brand){
    brand.style.cursor = "pointer";
    brand.addEventListener("click", async (e)=>{
      e.preventDefault();
      const shareUrl = location.origin;
      const shareText = "Join me: Do one small good action with #LiveLikeCharlie";
      if(navigator.share){
        await navigator.share({ title:"Live Like Charlie", text:shareText, url:shareUrl });
      }else{
        const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        const x  = `https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        window.open(fb,"_blank","noopener,noreferrer");
        setTimeout(()=>window.open(x,"_blank","noopener,noreferrer"), 300);
      }
    });
  }
}
</script>
