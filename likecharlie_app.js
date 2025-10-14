
/*
 LikeCharlie / CyberMave — Drop‑in JS to upgrade to a shared backend + deep‑link actions
 Usage:
  1) Include this file after your HTML, right before </body>:
        <script>
          window.SUPABASE_URL = "https://YOURPROJECT.supabase.co";
          window.SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";
        </script>
        <script src="likecharlie_app.js"></script>
  2) Add data attributes to your existing DOM (see comments below).
  3) If SUPABASE_* are not set, the script gracefully falls back to localStorage.
*/

(function(){
  // ---------- Tiny helpers ----------
  const $ = (sel, root=document)=>root.querySelector(sel);
  const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
  const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));

  // ---------- Config ----------
  const SUPABASE_URL = window.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
  const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

  // ---------- Lightweight Supabase client (no external dep) ----------
  async function sbFetch(path, {method="GET", headers={}, body}={}){
    if(!HAS_SUPABASE) throw new Error("Supabase not configured");
    const url = SUPABASE_URL.replace(/\/+$/,"") + "/rest/v1/" + path.replace(/^\/+/,"");
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=representation",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if(!res.ok){
      const t = await res.text().catch(()=>res.statusText);
      throw new Error(`Supabase error ${res.status}: ${t}`);
    }
    return res.json();
  }

  // ---------- Storage layer (Supabase first, fallback to local) ----------
  const LS_KEY = "likecharlie_submissions_v2";
  function localList(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||"[]"); }catch(_){ return []; } }
  function localSave(rec){
    const items = localList();
    items.unshift(rec);
    localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0,500)));
    return rec;
  }

  async function saveSubmission({action, platform, post_url, name, email, ref_code}){
    const base = {
      action, platform, post_url,
      name: name||null, email: email||null,
      ref_code: ref_code||null,
      created_at: new Date().toISOString(),
      ip_hint: null,
      ua: navigator.userAgent,
    };
    if(HAS_SUPABASE){
      try{
        const out = await sbFetch("public_submissions", {method:"POST", body: base});
        return out && out[0] ? out[0] : base;
      }catch(e){
        console.warn("Supabase save failed, falling back to local:", e.message);
        return localSave(base);
      }
    }else{
      return localSave(base);
    }
  }

  async function listSubmissions({limit=50}={}){
    if(HAS_SUPABASE){
      try{
        return await sbFetch(`public_submissions?select=*&order=created_at.desc&limit=${limit}`);
      }catch(e){
        console.warn("Supabase list failed, falling back to local:", e.message);
        return localList().slice(0, limit);
      }
    }else{
      return localList().slice(0, limit);
    }
  }

  async function leaderboard({limit=100}={}){
    if(HAS_SUPABASE){
      try{
        // group by action + count
        const rows = await sbFetch(`rpc/public_action_counts`, {method:"POST", body:{}});
        return rows.slice(0, limit);
      }catch(e){
        console.warn("Supabase leaderboard failed, building from local:", e.message);
      }
    }
    // Build from local as fallback
    const agg = {};
    for(const r of localList()){
      const k = (r.action||"").trim().toLowerCase();
      agg[k] = (agg[k]||0)+1;
    }
    return Object.entries(agg).map(([action,count])=>({action, count})).sort((a,b)=>b.count-a.count).slice(0,limit);
  }

  // ---------- UI wiring ----------
  // Required data- attributes in your HTML:
  //  - data-action-select: <select> or <input> that holds the chosen action
  //  - data-platform-select: <select> for "Facebook / X / Instagram / TikTok / Other"
  //  - data-post-url: <input> where the user pastes their post link
  //  - data-name, data-email: optional inputs
  //  - data-save: button to trigger Save & Count
  //  - data-leaderboard: <tbody> where leaderboard rows are rendered
  //  - data-recent: <tbody> for recent submissions list
  //  - data-actions-link: on Actions page, add data-action on each link to deep-link

  function getVal(sel){ const el = $(sel); return el ? (el.value||el.textContent||"").trim() : ""; }
  function setVal(sel, v){ const el = $(sel); if(el){ if("value" in el) el.value = v; else el.textContent = v; } }

  function parseQuery(){
    const p = new URLSearchParams(location.search);
    return Object.fromEntries(p.entries());
  }

  function ensureHashStep1(){
    if(location.hash !== "#step1"){
      location.hash = "step1";
    }
  }

  async function renderLeaderboard(){
    const tbody = $('[data-leaderboard]');
    if(!tbody) return;
    const rows = await leaderboard({limit:100});
    tbody.innerHTML = rows.map((r,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${escapeHtml(titleCase(r.action||""))}</td>
        <td>${r.count}</td>
      </tr>`).join("");
  }

  async function renderRecent(){
    const tbody = $('[data-recent]');
    if(!tbody) return;
    const rows = await listSubmissions({limit:25});
    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>${escapeHtml(titleCase(r.action||""))}</td>
        <td>${escapeHtml(r.platform||"")}</td>
        <td><a href="${escapeAttr(r.post_url||"#")}" target="_blank" rel="noopener">view</a></td>
      </tr>`).join("");
  }

  function titleCase(s){ return s.replace(/\w\S*/g, t=>t[0].toUpperCase()+t.slice(1).toLowerCase()); }
  function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g, "&quot;"); }

  // Deep-linking: from Actions page click → homepage step1 prefilled
  function wireActionDeepLinks(){
    $$('[data-action]').forEach(el=>{
      el.addEventListener('click', (e)=>{
        // If it's a link, let it navigate; if not, do it manually
        const action = el.getAttribute('data-action') || el.textContent.trim();
        const url = new URL(location.origin + location.pathname.replace(/\/actions.*$/i,"/"));
        url.searchParams.set("action", action);
        url.hash = "step1";
        location.href = url.toString();
      });
    });
  }

  // On load, prefill the chosen action from ?action=... and jump to step1
  function prefillFromQuery(){
    const q = parseQuery();
    if(q.action){
      setVal('[data-action-select]', q.action);
      ensureHashStep1();
    }
    if(q.ref){
      // store a referral code for later
      sessionStorage.setItem("likecharlie_ref", q.ref);
    }
  }

  // Save & Count handler
  async function wireSave(){
    const btn = $('[data-save]');
    if(!btn) return;
    btn.addEventListener('click', async (e)=>{
      e.preventDefault();
      const action = getVal('[data-action-select]');
      const platform = getVal('[data-platform-select]') || "Facebook";
      const post_url = getVal('[data-post-url]');
      const name = getVal('[data-name]');
      const email = getVal('[data-email]');
      const ref_code = sessionStorage.getItem("likecharlie_ref") || null;

      if(!action || !post_url){
        alert("Please choose an action and paste your post link.");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Saving...";
      try{
        const rec = await saveSubmission({action, platform, post_url, name, email, ref_code});
        await Promise.all([renderLeaderboard(), renderRecent()]);
        btn.textContent = "Saved!";
        await sleep(800);
        btn.textContent = "Save & Count";
      }catch(err){
        console.error(err);
        alert("Sorry, save failed. Please try again in a moment.");
        btn.textContent = "Save & Count";
      }finally{
        btn.disabled = false;
      }
    });
  }

  // Autoadvance "stepper" UX if you use #step1 / #step2 / #step3 anchors
  function wireStepper(){
    // If your UI uses "Next" buttons with [data-next="#step2"], this wires them
    $$('[data-next]').forEach(el=>{
      el.addEventListener('click', (e)=>{
        const target = el.getAttribute('data-next');
        if(target) location.hash = target.replace(/^#?/,"#");
      });
    });
  }

  // Init
  document.addEventListener('DOMContentLoaded', async ()=>{
    try{
      prefillFromQuery();
      wireActionDeepLinks();
      wireSave();
      wireStepper();
      renderLeaderboard();
      renderRecent();
    }catch(e){
      console.error("Init error:", e);
    }
  });
})();
