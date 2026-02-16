# DecisionLens — Phase-1 Static (Local Test)

This is a **static HTML/CSS/JS** build meant for Phase‑1 (Silent) testing.

## What’s included
- Homepage (`index.html`) — locked copy
- Dashboard (`dashboard.html`)
- Sessions (5) with PKT time conversion + countdown (DST-safe via IANA timezones)
- News cards with locked structure + pagination (sample JSON data)
- Watchlist tabs (sample data; refresh hook ready)
- Paid panels visible but locked (Phase‑1)
- Education placeholder (Phase‑3)

## Run locally
Recommended (so `fetch()` works):
```bash
cd decisionlens_phase1_static
python -m http.server 8000
```
Then open:
- http://localhost:8000/index.html
- http://localhost:8000/dashboard.html

## GitHub Pages
Upload the folder contents to the **repo root** on `main`, then enable Pages:
- Settings → Pages → Deploy from Branch → `main` / root

## Notes
- Payments are NOT active in Phase‑1 (locked by design).
- Replace `data/news.sample.json` with your real news feed later.
