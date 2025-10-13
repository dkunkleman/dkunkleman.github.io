
# Like Charlie Network — One-Page Launch
## Quick Deploy
1) Drag the `site.zip` into https://app.netlify.com/drop or push the `site/` folder to any static host (GitHub Pages, Render Static, Vercel).
2) In `index.html`, search for `formspree.io/f/your-id` and replace with your Formspree endpoint if you want email receipt uploads to notify you.
3) To make the scoreboard global later, swap the localStorage store for a Google Sheet / Supabase backend.

## Test Flow (desktop or phone)
- Open the site → Step 1 “Make my post” → choose an action, add email + state → click “Make and Count my post”.
- Copy the generated text to X/Facebook/Instagram/TikTok.
- Copy your Post URL back into Step 2 and click “Save & Count.” (Stores in this browser for now.)
