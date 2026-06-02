# Training Calendar

A personal training dashboard built with the **Composio CLI** and **Vercel CLI** — no framework, no backend, no build step. Just a static HTML page powered by a local data pipeline.

Live demo: [strava-dashboard-livid.vercel.app](https://strava-dashboard-livid.vercel.app)

**Features**
- Month calendar view of all Strava activities (runs, lifts, rehab)
- WHOOP heart-rate data auto-linked to Strava activities by UTC time overlap
- Kipchoge Score — your best recent run pace as a % of Eliud Kipchoge's marathon WR
- Next upcoming run pulled from Google Calendar
- "Run with me" copy template for X DMs
- SQLite as local source of truth; `data.json` as the static export

---

## How it works

```
composio CLI          →   Strava API + Google Calendar API
scripts/fetch.js      →   SQLite (db/activities.db) + public/data.json
vercel CLI            →   deploys public/ as a static site
```

`data.json` is committed to the repo and served as a static file. When you want fresh data, run `npm run fetch` and redeploy.

---

## Prerequisites

1. **Node.js 18+**
2. **Composio CLI** — connects Claude to your Strava and Google Calendar accounts

   ```bash
   npm install -g composio
   composio login
   composio link strava
   composio link googlecalendar   # optional, for "Next Run" feature
   ```

3. **Vercel CLI**

   ```bash
   npm install -g vercel
   vercel login
   ```

---

## Setup

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/strava-dashboard
cd strava-dashboard
npm install

# Pull your Strava data → SQLite → data.json
npm run fetch

# Preview locally (requires Node.js `serve`)
npm run dev
# → open http://localhost:3000
```

---

## Deploy to Vercel

```bash
# First deploy (creates the project)
vercel --yes --scope YOUR_VERCEL_SCOPE

# Subsequent deploys to production
vercel --prod --scope YOUR_VERCEL_SCOPE
```

Vercel reads `vercel.json` which points to `public/` as the output directory — no build step required.

---

## Refresh data

```bash
npm run fetch    # fetches all Strava pages + next run from Google Calendar
                 # writes db/activities.db (local) + public/data.json (committed)

git add public/data.json
git commit -m "refresh data"
vercel --prod --scope YOUR_VERCEL_SCOPE
```

---

## Project structure

```
strava-dashboard/
├── public/
│   ├── index.html       # calendar dashboard (vanilla HTML/JS)
│   └── data.json        # 446+ activities, committed for static deploy
├── scripts/
│   ├── fetch.js         # Strava + GCal → SQLite → data.json
│   └── schema.sql       # SQLite schema
├── db/
│   └── activities.db    # local only (gitignored)
├── package.json
├── vercel.json          # outputDirectory: public
└── .gitignore
```

---

## SQLite queries

The local `db/activities.db` is a full SQLite database you can query directly:

```bash
# Distance by sport type
sqlite3 db/activities.db "SELECT sport_type, COUNT(*), ROUND(SUM(distance)/1000,1)||' km' FROM activities GROUP BY sport_type"

# Your 10 fastest runs
sqlite3 db/activities.db "SELECT name, start_date_local, ROUND(1000/average_speed/60,2)||' min/km' as pace FROM activities WHERE sport_type='Run' AND distance>=1000 ORDER BY average_speed DESC LIMIT 10"

# Monthly run volume
sqlite3 db/activities.db "SELECT substr(start_date,1,7) as month, COUNT(*), ROUND(SUM(distance)/1000,1) FROM activities WHERE sport_type='Run' GROUP BY month ORDER BY month DESC"
```

---

## WHOOP linking logic

WHOOP and Strava often record the same session as separate activities (WHOOP auto-detects movement; Strava records what you manually start). The dashboard links them by finding the WHOOP activity with the greatest UTC time overlap against each non-WHOOP activity — if overlap ≥ 30 seconds, WHOOP's heart rate data is shown on the Strava card.

---

## Built with

- [Composio CLI](https://composio.dev) — authenticated API access to Strava + Google Calendar
- [Vercel CLI](https://vercel.com/docs/cli) — zero-config static hosting
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local data storage
- Vanilla HTML/CSS/JS — no framework needed for a personal dashboard
