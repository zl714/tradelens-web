# TradeLens

**A clean, honest dashboard for real stock quotes, charts, and news.**

TradeLens surfaces live market data and headlines for any ticker — no
predictions, no hype, just the facts presented cleanly. It is the working,
honest core of a larger idea (an AI-assisted stock app), deliberately scoped to
the part that always works: real data, displayed well.

> **Honest framing:** TradeLens does **not** predict prices or give financial
> advice. It is a portfolio project that demonstrates REST API integration, a
> Python serverless backend, data visualization, and a responsive frontend.
> When no API key is configured (or the upstream API is unavailable), it shows
> clearly-labelled **sample data** so the demo is never broken.

---

## Features

- **Ticker search** — look up any symbol.
- **Quote card** — company name, live price, $ and % change (green up / red down).
- **Key stats grid** — market cap, P/E, 52-week high/low, volume, day range, open, prev close, EPS.
- **Interactive price chart** — Chart.js area chart with **1D / 1W / 1M / 3M / 6M / 1Y**
  range toggles, plus intraday **1H / 4H** views. Intraday toggles disable
  gracefully when a live key's tier doesn't include intraday history; in demo
  mode every toggle works.
- **Advisor ("Find Stocks")** — a separate view with a short onboarding quiz
  (horizon, risk, sectors, goal, persisted in `localStorage`) that ranks a
  bundled universe of ~45 real stocks & ETFs by transparent rule-based match,
  with a plain-English "Why it matches" for each pick. Educational only — the
  not-financial-advice notice is scoped to this view.
- **Latest news** — headlines with source, date, and links that open in a new tab.
- **Watchlist** — add/remove tickers, persisted in `localStorage`; click to load.
- **Loading & error states**, plus a **"Demo data"** badge when running on sample data.

## Tech Stack

- **Frontend:** vanilla HTML / CSS / JavaScript (no framework, no build step).
  Charting via [Chart.js](https://www.chartjs.org/) loaded from a CDN.
- **Backend:** a single **Vercel Python serverless function** at `/api/data.py`
  using only the Python **standard library** (`urllib`, `json`, `os`) — so there
  is **no `requirements.txt`** and zero dependency risk.
- **Data source:** [Financial Modeling Prep](https://financialmodelingprep.com/)
  (FMP) free tier, proxied server-side so the API key is never exposed to the browser.

## How the data flows

```
Browser  ──►  /api/data?endpoint=quote&symbol=AAPL  ──►  FMP API
   ▲                                                        │
   └───────────────  JSON { source, data }  ◄───────────────┘
```

- `endpoint` is one of `quote | profile | history | news | chart1h | chart4h | chart1d`.
  The `chart*` endpoints proxy FMP's intraday `/historical-chart` series; when a
  key's tier doesn't include them they return `{"source": "unavailable"}` so the
  matching toggle disables instead of showing a broken chart.
- If `FMP_API_KEY` is missing, or FMP fails / is rate-limited, the function
  returns bundled **sample data** tagged `{"source": "demo"}`.
- If the `/api` call itself can't be reached (e.g. the page is opened as a local
  `file://` with no server), the frontend falls back to its **own** bundled
  sample dataset. Either way, the UI renders fully and shows the "Demo data" badge.

## Project structure

```
marketlens/
├── index.html            # markup + script/style includes
├── css/styles.css        # theme (dark forest green + lime accent)
├── js/
│   ├── sample-data.js      # client-side fallback dataset (daily + intraday)
│   ├── format.js           # number / date formatting helpers
│   ├── api.js              # fetch layer + fallback logic
│   ├── charts.js           # Chart.js price chart + multi-timeframe toggles
│   ├── render.js           # quote / stats / news DOM rendering
│   ├── watchlist.js        # localStorage watchlist
│   ├── advisor-universe.js # bundled ~45-ticker universe + tags
│   ├── advisor.js          # onboarding quiz, rule-based ranking, results
│   └── app.js              # orchestration + view switching + event wiring
├── api/
│   ├── data.py           # Vercel Python serverless proxy (stdlib only)
│   └── sample.py         # bundled server-side sample dataset
├── .env.example          # FMP_API_KEY placeholder (copy to .env)
├── .gitignore            # ignores .env, __pycache__, .vercel, etc.
└── vercel.json           # zero-config deploy hints
```

## Run locally

No build step. The frontend works two ways:

**1. Quickest — open the file directly**

Open `index.html` in a browser. The `/api` call won't exist, so the app uses its
client-side sample data and shows the "Demo data" badge. Great for a fast look.

**2. With the Python API (recommended) — use Vercel CLI**

```bash
npm i -g vercel        # one-time
cd marketlens
vercel dev             # serves the static site + the Python function locally
```

Then visit the printed local URL (usually http://localhost:3000). To use live
data locally, set the key first:

```bash
cp .env.example .env
# edit .env and paste your free FMP key
```

> A plain static server (e.g. `python3 -m http.server`) will serve the frontend
> but **not** the Python function — you'll just see demo data, which is fine.

## Deploy to Vercel

1. Push this repo to GitHub (the `.env` file is git-ignored — never committed).
2. In Vercel, **Add New → Project** and import the repo. No build settings needed.
3. **Project → Settings → Environment Variables**, add:

   | Name | Value |
   |------|-------|
   | `FMP_API_KEY` | your free key from [FMP](https://site.financialmodelingprep.com/developer/docs) |

4. **Deploy.** Vercel auto-detects `api/data.py` as a Python serverless function.

If you skip the env var, the live site still works — it just shows demo data.

## Security notes

- The FMP key is read from `os.environ` **server-side only**; it is never sent to
  or stored in the browser.
- No secrets are committed: `.env` is git-ignored and only `.env.example`
  (a placeholder) is tracked.
- All API-derived text is HTML-escaped before rendering; news links are
  restricted to `http(s)` URLs and open with `rel="noopener noreferrer"`.

---

Built by [Zachary LeCroy](../my-portfolio/index.html). Data via Financial
Modeling Prep. Educational / portfolio project.
