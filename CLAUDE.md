# Strava Dashboard — CLAUDE.md

Personal training dashboard for Shawn Esquivel. Static HTML site, no framework, no build step.

**Live:** https://strava-dashboard-livid.vercel.app  
**Stack:** Vanilla HTML/JS · better-sqlite3 · Composio CLI · Vercel CLI

---

## Architecture

```
npm run fetch          →  Composio CLI calls Strava + Google Calendar APIs
scripts/fetch.js       →  upserts db/activities.db (SQLite, local only)
                       →  exports public/data.json (committed, served statically)
vercel --prod          →  deploys public/ as static site (no build step)
```

`data.json` is the only data source the browser touches. Refresh it with `npm run fetch`, commit, redeploy.

---

## Project structure

```
public/
  index.html          # entire app — all features, config at top of <script>
  data.json           # 446+ activities + next_run; committed to repo
  strava-logo.svg     # official Strava SVG (downloaded from brand kit)
  composio-logo.svg   # Composio logomark (black SVG, CSS-inverted to white)
scripts/
  fetch.js            # Strava pagination + GCal next-run → SQLite + data.json
  schema.sql          # SQLite schema
db/
  activities.db       # local only (.gitignored)
vercel.json           # outputDirectory: public, no build command
```

---

## User / social

- **Name:** Shawn Esquivel  
- **Location:** SF  
- **X:** @shawnbuilds → https://x.com/shawnbuilds  
- **Instagram:** @shawn.builds → https://www.instagram.com/shawn.builds/  
- **GitHub:** placeholder (`GITHUB_URL` const at top of index.html script block)

---

## Font

```css
font-family: Boathouse, "Segoe UI", "Helvetica Neue", -apple-system, system-ui,
  BlinkMacSystemFont, Roboto, Arial, sans-serif,
  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
font-size: 14px;
```

Boathouse is Strava's proprietary font; it falls back gracefully. Brand orange: `#FC5200`.

---

## Features

### Goals / Challenges
Configured in `GOALS` array at top of `index.html` script. Each entry has:
```js
{ id, title, detail, deadline, status, result, xPostUrl, mobyDick?, autoProgress? }
// status: 'active' | 'done' | 'failed'
// result: fill in when complete, e.g. '19:42'
// xPostUrl: link to X accountability post
```
- **Moby Dick goal** (year's big one): Half Marathon 1:56:02 (5:30/km), deadline Dec 31 2026
- **June 30 2026:** 30 Hevy sessions in June — progress auto-counted from data.json
- **Jul 31 2026:** Pain-free 10 km run post foot injury
- **Aug 31 2026:** 10 km in 55:00 (5:30/km)
- **Sep 30 2026:** Sub-20 min 5 km (3:59/km)
- **Dec 31 2026:** Sub-6 minute mile (3:44/km)

Display: top row = Moby Dick card + 2 most-urgent active goals. Full grid below.

### Personal Records (`PRS` array, hardcoded in index.html)
| Event | Time | Pace | Race |
|---|---|---|---|
| Marathon | 5:42:46 chip | 8:07/km | BMO Vancouver, May 4 2025 |
| Half Marathon | 2:11:47 | 6:04/km | Bangkok Midnight Marathon, Dec 22 2024 |
| 10 km | 1:04:45 | 6:28/km | Sun Run Vancouver, Jul 18 2024 |
| 5 km | ~22:00 | 4:17/km | Training (6×800m), Apr 9 2025 — not a race |

### Kipchoge Score
Marathon vs marathon: user speed (42195m / 20566s = 2.051 m/s) ÷ Kipchoge's WR (42195m / 7235s = 5.832 m/s) × 100 = **~35.2%**. Kipchoge WR: 2:00:35, Berlin 2022.

### WHOOP HR Linking
WHOOP and Strava App both record the same session separately. Matching: for each non-WHOOP activity, find the WHOOP activity with greatest UTC time-window overlap; link if overlap ≥ 30 seconds. WHOOP's `average_heartrate` / `max_heartrate` is then shown on the Strava card.

### Mileage Bucket
Weekly goal: **10 km/week**. Deduplication: matched WHOOP activities excluded from distance totals. Shows: this week vs goal, this month total, 4-week rolling average.

### Calendar
Month grid, Mon–Sun. Activities grouped by `start_date_local.slice(0,10)` (local date). Dots colored by sport: 🟠 Run · 🔵 Lift · 🟢 Other. Click day to see detail panel with WHOOP-linked HR.

### Next Run (Google Calendar)
`scripts/fetch.js` calls `GOOGLECALENDAR_EVENTS_LIST` on the `primary` calendar, filters events matching `/run|jog|5k|10k|tempo|interval|400m|800m|sprint/i`, takes the first upcoming match. Stored in `data.json` as `next_run`. Shows as pulsing green card in detail panel.

### Run & Yap modal
Trigger: orange "Run & Yap in SF" button in header. Modal: copy template + DM links (X + Instagram). Topics: jazz, startups, ai agents, canada, basketball. Template:
> hey shawn, would love to go for a run and yap on [date] in SF. here's my email so your ai agent can add me to the calendar! — [name] / email: [your@email.com]

---

## Data pipeline gotchas (Composio CLI)

1. **Large responses → file.** When output is too big, Composio returns `{ storedInFile: true, outputFilePath: "/tmp/..." }`. Always call `resolveResult(envelope)` before parsing. See `scripts/fetch.js`.

2. **Strip ANSI before JSON parse.** CLI emits color codes + "Update available" header. Strip with `/\x1b\[[0-9;]*[a-zA-Z]/g` then find first `{`.

3. **Activities in `result.data.details`.** Not `result.data` — it's an array nested under the `details` key.

4. **Pagination starts at page 1.** Stop when `batch.length === 0` or `< per_page`.

5. **`start_date_local` is not UTC.** It's local time in ISO format without a real timezone. `"2026-06-02T18:46:02Z"` means 6:46 PM local, not UTC. Use `.slice(0,10)` for calendar date grouping.

6. **`singleEvents: true` required for Google Calendar `orderBy: startTime`.**

---

## Refresh + deploy workflow

```bash
npm run fetch                                         # Strava + GCal → SQLite + data.json
git add public/data.json && git commit -m "refresh"
vercel --prod --scope shawnesquivels-projects
```

---

## SQLite queries (local analysis)

```bash
# Monthly run volume
sqlite3 db/activities.db "SELECT substr(start_date,1,7), COUNT(*), ROUND(SUM(distance)/1000,1)||' km' FROM activities WHERE sport_type='Run' GROUP BY 1 ORDER BY 1 DESC"

# Fastest 10 runs by pace
sqlite3 db/activities.db "SELECT name, substr(start_date_local,1,10), ROUND(1000/average_speed/60,2)||' min/km' FROM activities WHERE sport_type='Run' AND distance>=1000 ORDER BY average_speed DESC LIMIT 10"
```
