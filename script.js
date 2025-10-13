
// Referral code capture & personal code
const params = new URLSearchParams(location.search);
const incoming = params.get("ref");
if (incoming) localStorage.setItem("lc_referrer", incoming);
const my = localStorage.getItem("lc_myref") || `lc-${Math.random().toString(36).slice(2,8)}`;
localStorage.setItem("lc_myref", my);

// Populate badge grid & select
const badges = [
  ["Bible Badge","Reading, memorizing, or sharing scripture","bible.png"],
  ["Forgive Badge (Erika)","Sharing a forgiveness story or testimony","forgive.png"],
  ["Purity Badge","Committing to wait until marriage","purity.png"],
  ["Family Life Badge","Posting a family meal or moment","family.png"],
  ["Cupcake (BakeLikeCharlie)","Baking/hosting a bake sale","cupcake.png"],
  ["Listening Badge","Respectful conversation with someone you disagree with","listening.png"],
  ["Pay It Forward","Donating or a generous act","payitforward.png"],
  ["Boldness Badge","Public witness or testimony","boldness.png"],
  ["Fight! Fight! Fight!","Taking a strong public stand","fight.png"],
  ["Inspire Badge","Sharing inspiration or mentoring","inspire.png"],
  ["Gold Standard (Charlie)","Completing all badge categories","gold.png"]
];
const grid = document.getElementById("badgesGrid");
const sel = document.getElementById("badge");
badges.forEach(([name,earned,file])=>{
  const d = document.createElement("div");
  d.className = "b";
  d.innerHTML = `<img loading="lazy" src="assets/${file}" alt="${name}"/><div><strong>${name}</strong></div><div class="small">Earned by: ${earned}</div>`;
  grid.appendChild(d);
  const o = document.createElement("option"); o.value = name; o.textContent = name; sel.appendChild(o);
});
const refInput = document.getElementById("ref"); if (refInput) refInput.value = my;

// Leaderboard placeholders
const lbs = document.getElementById("lbs");
["Top States","Top Churches / Youth","Top Families"].forEach((title,i)=>{
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h3>${title}</h3>
  <table class="table"><tbody id="lb${i}"></tbody></table>`;
  lbs.appendChild(card);
  const body = card.querySelector("tbody");
  for(let r=1;r<=5;r++){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>Placeholder ${r}</td><td style="text-align:right;color:#f59e0b">${Math.floor(Math.random()*900)}</td>`;
    body.appendChild(tr);
  }
});

// Submit handler (stores locally and offers CSV download)
function submitStory(e){
  e.preventDefault();
  const record = {
    handle: document.getElementById('handle').value.trim(),
    group: document.getElementById('group').value.trim(),
    email: document.getElementById('email').value.trim(),
    link: document.getElementById('link').value.trim(),
    badge: document.getElementById('badge').value,
    ref: document.getElementById('ref').value,
    notes: document.getElementById('notes').value.trim(),
    ts: new Date().toISOString()
  };
  const key = "lc_submissions";
  const arr = JSON.parse(localStorage.getItem(key) || "[]");
  arr.push(record);
  localStorage.setItem(key, JSON.stringify(arr));
  document.getElementById('msg').textContent = "Saved locally. Use Export CSV to send to your master sheet.";
  // Offer CSV
  const headers = Object.keys(record);
  const rows = [headers.join(",")].concat(arr.map(o=>headers.map(h=>`"${(o[h]||"").replaceAll('"','""')}"`).join(",")));
  const blob = new Blob([rows.join("\n")], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "submissions_export.csv"; a.click();
  return false;
}
