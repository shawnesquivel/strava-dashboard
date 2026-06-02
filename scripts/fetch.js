#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const ROOT      = path.join(__dirname, '..');
const DB_PATH   = path.join(ROOT, 'db', 'activities.db');
const DATA_PATH = path.join(ROOT, 'public', 'data.json');
const SCHEMA    = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// Strip ANSI codes and extract the JSON object from composio CLI output.
function parseComposioOutput(raw) {
  const clean = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  const start = clean.indexOf('{');
  if (start === -1) throw new Error('No JSON in composio output:\n' + clean.slice(0, 300));
  return JSON.parse(clean.slice(start));
}

// Composio stores large responses in a file instead of stdout.
function resolveResult(result) {
  if (result.storedInFile && result.outputFilePath) {
    return JSON.parse(fs.readFileSync(result.outputFilePath, 'utf8'));
  }
  return result;
}

function fetchPage(page, perPage = 50) {
  process.stdout.write(`  page ${page} ... `);
  const raw = execSync(
    `composio execute STRAVA_LIST_ATHLETE_ACTIVITIES -d '{"per_page":${perPage},"page":${page}}'`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  const envelope = parseComposioOutput(raw);
  const result = resolveResult(envelope);
  if (!result.successful) throw new Error('Composio error: ' + JSON.stringify(result.error));
  const activities = result.data?.details ?? [];
  console.log(`${activities.length} activities`);
  return activities;
}

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(SCHEMA);
  return db;
}

const upsertStmt = db => db.prepare(`
  INSERT INTO activities (
    id, name, sport_type, device_name,
    start_date, start_date_local, timezone,
    elapsed_time, moving_time, distance,
    average_speed, max_speed,
    has_heartrate, average_heartrate, max_heartrate,
    total_elevation_gain, pr_count, achievement_count,
    kudos_count, athlete_count, commute, trainer, manual,
    gear_id, raw_json
  ) VALUES (
    @id, @name, @sport_type, @device_name,
    @start_date, @start_date_local, @timezone,
    @elapsed_time, @moving_time, @distance,
    @average_speed, @max_speed,
    @has_heartrate, @average_heartrate, @max_heartrate,
    @total_elevation_gain, @pr_count, @achievement_count,
    @kudos_count, @athlete_count, @commute, @trainer, @manual,
    @gear_id, @raw_json
  )
  ON CONFLICT(id) DO UPDATE SET
    name              = excluded.name,
    kudos_count       = excluded.kudos_count,
    achievement_count = excluded.achievement_count,
    raw_json          = excluded.raw_json,
    fetched_at        = CURRENT_TIMESTAMP
`);

function upsert(stmt, a) {
  stmt.run({
    id: a.id,
    name: a.name,
    sport_type: a.sport_type ?? a.type ?? null,
    device_name: a.device_name ?? null,
    start_date: a.start_date,
    start_date_local: a.start_date_local ?? null,
    timezone: a.timezone ?? null,
    elapsed_time: a.elapsed_time ?? 0,
    moving_time: a.moving_time ?? 0,
    distance: a.distance ?? 0,
    average_speed: a.average_speed ?? 0,
    max_speed: a.max_speed ?? 0,
    has_heartrate: a.has_heartrate ? 1 : 0,
    average_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    total_elevation_gain: a.total_elevation_gain ?? 0,
    pr_count: a.pr_count ?? 0,
    achievement_count: a.achievement_count ?? 0,
    kudos_count: a.kudos_count ?? 0,
    athlete_count: a.athlete_count ?? 1,
    commute: a.commute ? 1 : 0,
    trainer: a.trainer ? 1 : 0,
    manual: a.manual ? 1 : 0,
    gear_id: a.gear_id ?? null,
    raw_json: JSON.stringify(a),
  });
}

// Keywords that indicate a run event on the calendar
const RUN_RE = /run|jog|5k|10k|tempo|interval|400m|800m|sprint|easy\s|long\s|speed\s+training/i;

function fetchNextRun() {
  try {
    process.stdout.write('  Fetching Google Calendar for next run... ');
    const now  = new Date().toISOString();
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const raw = execSync(
      `composio execute GOOGLECALENDAR_EVENTS_LIST -d '{"calendarId":"primary","timeMin":"${now}","timeMax":"${soon}","singleEvents":true,"orderBy":"startTime","maxResults":100}'`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const envelope = parseComposioOutput(raw);
    const result   = resolveResult(envelope);
    if (!result.successful) { console.log('not connected'); return null; }

    const events = result.data?.items ?? result.data?.events ?? [];
    const next   = events.find(e => RUN_RE.test(e.summary || ''));
    if (!next) { console.log('none found'); return null; }

    console.log(`"${next.summary}"`);
    return {
      title: next.summary,
      start: next.start?.dateTime || next.start?.date,
      end:   next.end?.dateTime   || next.end?.date,
      description: next.description || null,
    };
  } catch (e) {
    console.log(`skipped (${e.message.slice(0, 50)})`);
    return null;
  }
}

function exportJson(db, nextRun) {
  const rows = db.prepare('SELECT * FROM activities ORDER BY start_date DESC').all();
  const activities = rows.map(r => ({
    id: r.id,
    name: r.name,
    sport_type: r.sport_type,
    device_name: r.device_name,
    start_date: r.start_date,
    start_date_local: r.start_date_local,
    timezone: r.timezone,
    elapsed_time: r.elapsed_time,
    moving_time: r.moving_time,
    distance: r.distance,
    average_speed: r.average_speed,
    max_speed: r.max_speed,
    has_heartrate: !!r.has_heartrate,
    average_heartrate: r.average_heartrate,
    max_heartrate: r.max_heartrate,
    total_elevation_gain: r.total_elevation_gain,
    pr_count: r.pr_count,
    achievement_count: r.achievement_count,
    kudos_count: r.kudos_count,
    athlete_count: r.athlete_count,
    commute: !!r.commute,
    trainer: !!r.trainer,
    manual: !!r.manual,
    gear_id: r.gear_id,
  }));

  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify({
    generated_at: new Date().toISOString(),
    count: activities.length,
    next_run: nextRun,
    activities,
  }, null, 2));
  console.log(`\n✓ Exported ${activities.length} activities + next_run → public/data.json`);
}

async function main() {
  console.log('🏃 Fetching Strava activities...\n');
  const db = initDb();
  const stmt = upsertStmt(db);
  const insertPage = db.transaction(list => { for (const a of list) upsert(stmt, a); });

  let page = 1, total = 0;
  while (true) {
    const batch = fetchPage(page++);
    if (batch.length === 0) break;
    insertPage(batch);
    total += batch.length;
    if (batch.length < 50) break;
  }

  console.log(`\nTotal synced: ${total} activities`);
  const nextRun = fetchNextRun();
  exportJson(db, nextRun);
  db.close();
}

main().catch(e => { console.error('\n✗', e.message); process.exit(1); });
