# Live Like Charlie — Launch Drop-ins (Today)

## Files
- `manifest.webmanifest` — link this from every page in `<head>`
- `sw.js` — register once on the homepage (`navigator.serviceWorker.register('/sw.js')`)
- `data/actions.json` — set as the canonical actions source

## Git steps
1. Place all three files at repo root (and `/data` folder for actions).
2. Commit & push to `main`.
3. In GitHub Pages, verify Source = main/root and HTTPS is enforced.

## HTML changes
- Add to `<head>` on **index.html**, **actions.html**, **privacy.html**, **about.html**:
  ```html
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#0b1220">
  ```

- Ensure homepage registers the service worker once:
  ```js
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
  ```

- Replace any `fetch('/actions.html')` or `fetch('/actions.json')` with:
  ```js
  const res = await fetch('/data/actions.json', {cache:'no-store'});
  const list = (await res.json()).details; // [{title, description}]
  ```

## Security
- Remove any public service keys. Keep only the Supabase **anon** key in the client.
- RLS on `submissions`: allow `insert` for anon; allow `select` only for `approved = true`; deny `update` to anon.
