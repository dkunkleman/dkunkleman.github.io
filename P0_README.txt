# Live Like Charlie Challenge — P0 Fixes (Drop-in Files)

This package contains the **P0, zero-debate** fixes to unblock the site:

- `manifest.webmanifest` — Correct manifest filename + valid icons.
- `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png` — Placeholder icons.
- `sw.js` — Minimal service worker for cache and offline.
- `data/actions.json` — Single source of truth for actions (deduped, family/patriot/faith/community).
- `share_image.js` — Canvas generator for share images.
- `admin.html` — Targets the `submissions` table (replace placeholders for Supabase URL & anon key, and **lock this down**).

## Install

Copy these into your repo root, preserving folders:

```
/manifest.webmanifest
/sw.js
/icons/icon-192.png
/icons/icon-512.png
/icons/maskable-512.png
/data/actions.json
/share_image.js
/admin.html   (replacing the old admin file)
```

Then update **your HTML**:
- Change any `<link rel="manifest" href="/manifest.json">` to:
  ```html
  <link rel="manifest" href="/manifest.webmanifest">
  ```
- Ensure your app registers the service worker (in `app.js` or inline):
  ```js
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }
  ```
- On any page that referenced `/share_image.js`, you’re now covered—buttons with IDs
  `themeSelect`, `messageInput`, `handleInput`, `renderBtn`, `downloadBtn` and a `<canvas id="preview">`
  will work out of the box.

## Git (cut a branch and push)

```bash
git checkout -b p0-fixes
git add manifest.webmanifest sw.js data/actions.json share_image.js icons/ admin.html
git commit -m "P0: manifest+icons, SW, actions JSON, share_image tool, admin wired to submissions"
git push -u origin p0-fixes
```

Then open a PR and deploy your preview.
