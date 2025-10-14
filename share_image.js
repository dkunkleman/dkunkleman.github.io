
// share_image.js — Simple on-page share image generator (1:1, 4:5, 16:9)
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const canvas = $('#shareCanvas');
  const ctx = canvas.getContext('2d');
  const ratioSel = $('#ratioSelect');
  const titleEl = $('#titleInput');
  const subtitleEl = $('#subtitleInput');
  const footerEl = $('#footerInput');
  const presetEl = $('#bgPreset');
  const uploadEl = $('#bgUpload');
  const renderBtn = $('#renderBtn');
  const downloadBtn = $('#downloadBtn');

  let bgImg = null;

  const RATIOS = {
    "square-1080": [1080, 1080],    // 1:1
    "portrait-1080x1350": [1080, 1350], // 4:5
    "landscape-1920x1080": [1920, 1080] // 16:9
  };

  function setCanvasSize(key){
    const [w,h] = RATIOS[key] || RATIOS["square-1080"];
    canvas.width = w;
    canvas.height = h;
  }

  function drawBg(){
    const w = canvas.width, h = canvas.height;
    const preset = presetEl.value;
    if(bgImg){
      // cover fit
      const iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
      const ir = iw/ih, cr = w/h;
      let dw, dh, dx, dy;
      if(ir > cr){ // too wide
        dh = h; dw = ir * dh; dx = (w - dw)/2; dy = 0;
      }else{ // too tall
        dw = w; dh = dw / ir; dx = 0; dy = (h - dh)/2;
      }
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    }else{
      // Preset gradients
      let g;
      if(preset === "patriotic"){
        g = ctx.createLinearGradient(0,0,w,h);
        g.addColorStop(0, "#0b1220");
        g.addColorStop(.5, "#13294b");
        g.addColorStop(1, "#1e3a8a");
      }else if(preset === "sunset"){
        g = ctx.createLinearGradient(0,0,w,h);
        g.addColorStop(0, "#ff7e5f");
        g.addColorStop(1, "#feb47b");
      }else{
        g = ctx.createLinearGradient(0,0,w,h);
        g.addColorStop(0, "#111827");
        g.addColorStop(1, "#0b1220");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
      // subtle stripes
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for(let y=0;y<h;y+=24){ ctx.fillRect(0,y,w,8); }
    }
    // overlay vignette
    const vg = ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.8);
    vg.addColorStop(0,"rgba(0,0,0,0)");
    vg.addColorStop(1,"rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,w,h);
  }

  function wrapText(text, x, y, maxWidth, lineHeight, font){
    ctx.font = font;
    const words = (text||"").split(/\s+/);
    let line = "", yy = y, lines = [];
    for(let i=0;i<words.length;i++){
      const test = line ? line + " " + words[i] : words[i];
      if(ctx.measureText(test).width > maxWidth && line){
        lines.push(line); line = words[i];
      }else{ line = test; }
    }
    if(line) lines.push(line);
    lines.forEach((ln, idx)=>{
      ctx.fillText(ln, x, yy + idx*lineHeight);
    });
    return yy + lines.length*lineHeight;
  }

  function draw(){
    drawBg();
    const w = canvas.width, h = canvas.height;
    // content box
    const pad = Math.round(w*0.06);
    const maxText = w - pad*2;

    // Title
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    const title = (titleEl.value || "Like Charlie");
    const subtitle = (subtitleEl.value || "");
    const footer = (footerEl.value || "#LiveLikeCharlie");

    // Title font scales with width
    const titleSize = Math.max(36, Math.round(w*0.065));
    const subtitleSize = Math.max(20, Math.round(w*0.035));
    const footerSize = Math.max(18, Math.round(w*0.028));

    let y = Math.round(h*0.22);

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.font = `800 ${titleSize}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif`;
    y = wrapText(title, pad, y, maxText, Math.round(titleSize*1.15), ctx.font) + Math.round(titleSize*0.35);

    // Subtitle
    ctx.font = `500 ${subtitleSize}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif`;
    y = wrapText(subtitle, pad, y, maxText, Math.round(subtitleSize*1.25), ctx.font) + Math.round(subtitleSize*0.8);

    // Footer ribbon
    const rbH = Math.round(footerSize*2);
    const rbY = h - rbH - pad;
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(pad, rbY, w - pad*2, rbH);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${footerSize}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(footer, pad + Math.round(footerSize*0.8), rbY + rbH/2);

    // brand corner
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `800 ${Math.max(16, Math.round(w*0.03))}px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText("Like Charlie", pad, pad);
  }

  function setPresetImg(file){
    if(!file) return;
    const img = new Image();
    img.onload = ()=>{ bgImg = img; draw(); };
    img.src = URL.createObjectURL(file);
  }

  // Events
  ratioSel.addEventListener('change', ()=>{ setCanvasSize(ratioSel.value); draw(); });
  presetEl.addEventListener('change', ()=>{ bgImg = null; draw(); });
  uploadEl.addEventListener('change', (e)=>{ const f=e.target.files[0]; if(f) setPresetImg(f); });
  [titleEl, subtitleEl, footerEl].forEach(el=> el.addEventListener('input', draw));
  renderBtn.addEventListener('click', draw);
  downloadBtn.addEventListener('click', ()=>{
    const link = document.createElement('a');
    link.download = 'like-charlie-share.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // init
  setCanvasSize(ratioSel.value);
  draw();
})();
