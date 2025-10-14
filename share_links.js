<script>
// Reads copy from a textarea/input with id="copyText" (or [data-copy-text])
(function () {
  function getCopyText() {
    const el = document.querySelector('#copyText, [data-copy-text]');
    return (el && (el.value || el.textContent || '')) || '';
  }
  function getShareURL() {
    // optional field for a URL you want included with shares
    const el = document.querySelector('#shareUrl, [data-share-url]');
    return (el && el.value) || location.origin;
  }
  function openWin(url) { window.open(url, '_blank', 'noopener,noreferrer'); }

  function enc(s) { return encodeURIComponent(s || ''); }

  // Buttons are identified by data-share="x|facebook|instagram|tiktok|truth|youtube|telegram|linkedin"
  function bind(selector, handler) {
    document.querySelectorAll(selector).forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        handler();
      });
    });
  }

  // X (Twitter)
  bind('[data-share="x"]', () => {
    const text = getCopyText();
    const url  = getShareURL();
    openWin(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`);
  });

  // Facebook
  bind('[data-share="facebook"]', () => {
    const text = getCopyText();
    const url  = getShareURL();
    openWin(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`);
  });

  // LinkedIn
  bind('[data-share="linkedin"]', () => {
    const url = getShareURL();
    openWin(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`);
  });

  // Telegram
  bind('[data-share="telegram"]', () => {
    const text = getCopyText();
    const url  = getShareURL();
    openWin(`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`);
  });

  // Instagram (no web intent; open site/app)
  bind('[data-share="instagram"]', () => openWin('https://www.instagram.com/'));

  // TikTok (no web composer)
  bind('[data-share="tiktok"]', () => openWin('https://www.tiktok.com/'));

  // Truth Social
  bind('[data-share="truth"]', () => openWin('https://truthsocial.com/'));

  // YouTube upload
  bind('[data-share="youtube"]', () => openWin('https://www.youtube.com/upload'));

  // Image generator link (if present)
  document.querySelectorAll('[data-share="render"]').forEach(a => {
    // href should already be set by your page logic; do nothing
  });
})();
</script>
