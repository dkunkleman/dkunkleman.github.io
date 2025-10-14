(function(){
  const C = ()=>document.getElementById('c');
  function sizeFrom(sel){
    const [w,h]=sel.value.split('x').map(Number);
    return {w,h};
  }
  function preset(ctx,w,h,type){
    const g=ctx.createLinearGradient(0,0,w,h);
    if(type==='sunset'){ g.addColorStop(0,'#ff7a59'); g.addColorStop(1,'#5b1fa6'); }
    else if(type==='dark'){ g.addColorStop(0,'#051129'); g.addColorStop(1,'#0c1b3a'); }
    else { g.addColorStop(0,'#152a52'); g.addColorStop(1,'#b91c1c'); } // patriotic
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }
  function text(ctx,txt,x,y,size=48,weight='800',align='center'){
    ctx.font=`${weight} ${size}px Inter,system-ui,Segoe UI,Roboto,Arial`;
    ctx.fillStyle='#ffffff';
    ctx.textAlign=align; ctx.textBaseline='middle';
    ctx.fillText(txt,x,y);
  }
  async function draw(img){
    const title=document.getElementById('title').value||'One Small Good Thing';
    const subtitle=document.getElementById('subtitle').value||'Join me + invite 3 friends';
    const footer=document.getElementById('footer').value||'Like Charlie • #LiveLikeCharlie';
    const sz=sizeFrom(document.getElementById('size'));
    const c=C(); c.width=sz.w; c.height=sz.h;
    const ctx=c.getContext('2d');

    preset(ctx,sz.w,sz.h,document.getElementById('bgPreset').value);

    if(img){
      const ratio=Math.min(sz.w/img.width, sz.h/img.height);
      const dw=img.width*ratio, dh=img.height*ratio;
      ctx.globalAlpha=0.28;
      ctx.drawImage(img, (sz.w-dw)/2, (sz.h-dh)/2, dw, dh);
      ctx.globalAlpha=1;
    }

    text(ctx,title, sz.w/2, sz.h*0.32, Math.round(sz.h*0.08));
    text(ctx,subtitle, sz.w/2, sz.h*0.52, Math.round(sz.h*0.045), '700');
    text(ctx,footer, sz.w/2, sz.h*0.86, Math.round(sz.h*0.04), '700');
  }

  async function chooseBg(){
    return new Promise(res=>{
      const f=document.getElementById('bgFile');
      if(!f.files || !f.files[0]) return res(null);
      const r=new FileReader();
      r.onload=()=>{const img=new Image(); img.onload=()=>res(img); img.src=r.result};
      r.readAsDataURL(f.files[0]);
    });
  }

  window.renderShareImage = async function(){
    draw(await chooseBg());
  }
  window.downloadShareImage = function(e){
    const url=C().toDataURL('image/png');
    e.currentTarget.href=url;
  }
})();
