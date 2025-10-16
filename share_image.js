// Share Image generator for LiveLikeCharlieChallenge.org
(function(){
  const $ = (sel) => document.querySelector(sel);

  const state = {
    theme: 'patriotic', // 'patriotic' | 'sunset' | 'dark'
    message: 'I did one small good thing. Your turn in 24 hours. #LiveLikeCharlie',
    handle: ''
  };

  function gradientForTheme(ctx, w, h, theme){
    const g = ctx.createLinearGradient(0, 0, w, h);
    if(theme === 'dark'){
      g.addColorStop(0, '#0b0f19');
      g.addColorStop(1, '#1f2837');
    } else if(theme === 'sunset'){
      g.addColorStop(0, '#ff7e5f');
      g.addColorStop(1, '#feb47b');
    } else {
      // patriotic
      g.addColorStop(0, '#0b5ed7'); // blue
      g.addColorStop(1, '#c1121f'); // red
    }
    return g;
  }

  function render(){
    const canvas = $('#preview');
    if(!canvas){ return; }
    const w = 1200, h = 630;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // background
    ctx.fillStyle = gradientForTheme(ctx, w, h, state.theme);
    ctx.fillRect(0,0,w,h);

    // white border
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 12;
    ctx.strokeRect(24,24,w-48,h-48);

    // heading
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Live Like Charlie Challenge', 60, 70);

    // message
    wrapText(ctx, state.message, 60, 180, w - 120, 44);

    // footer
    ctx.font = 'bold 40px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'left';
    const handle = state.handle ? 'by @' + state.handle.replace(/^@/, '') : '';
    ctx.fillText(handle, 60, h - 120);

    ctx.textAlign = 'right';
    ctx.fillText('livelikecharliechallenge.org', w - 60, h - 120);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight){
    const words = text.split(' ');
    let line = '';
    for(let n=0; n<words.length; n++){
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0){
        ctx.font = '500 44px system-ui, -apple-system, Segoe UI, Roboto, Arial';
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.font = '500 44px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillText(line, x, y);
  }

  function download(){
    const canvas = $('#preview');
    const a = document.createElement('a');
    a.download = 'livelikecharlie-share.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  function bind(){
    const themeSelect = $('#themeSelect');
    const messageInput = $('#messageInput');
    const handleInput = $('#handleInput');
    const renderBtn = $('#renderBtn');
    const downloadBtn = $('#downloadBtn');

    themeSelect && themeSelect.addEventListener('change', (e) => { state.theme = e.target.value; render(); });
    messageInput && messageInput.addEventListener('input', (e) => { state.message = e.target.value; render(); });
    handleInput && handleInput.addEventListener('input', (e) => { state.handle = e.target.value; render(); });
    renderBtn && renderBtn.addEventListener('click', render);
    downloadBtn && downloadBtn.addEventListener('click', download);
    render();
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
