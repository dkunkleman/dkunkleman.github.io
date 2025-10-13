
# Actions Guide (Like Charlie Network)

This page includes:
- Approved Actions dropdown (seeded with defaults)
- "Add Action" button (modal) to submit a new action → goes to a pending queue
- Hidden Admin bar (`?admin=1`) with Review/Approve/Deny
- Export to CSV of approved actions
- Founders counter demo (locks at 1000 in localStorage)
- Optional Google Form embed (paste iframe; saved locally)

## Files
- `actions.html` — the page (drop it into your site root / link from your nav)

## How it stores data
- Uses `localStorage` keys:
  - `lc_actions` — approved actions
  - `lc_actions_pending` — pending submissions
  - `lc_founders` — demo counter
  - `lc_actions_form_embed` — optional Google Form iframe

## Admin
- Open the page with `?admin=1` in the URL to reveal the admin bar.
- Click **Review / Approve** to manage the queue.

## Render / Deployment
- If Render builds from a GitHub repo: commit `actions.html` and push to `main` (or your auto-deploy branch). Render will redeploy automatically.
- If Render is a Static Site with "Publish Directory": ensure `actions.html` is inside that folder.
- Manual redeploy: go to the Render dashboard → your service → **Manual Deploy** → **Clear build cache & deploy** (if assets seem cached).
- For CDN caching: if you use a CDN in front of Render, you may need to purge the cache for updated files.

