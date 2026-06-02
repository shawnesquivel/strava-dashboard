CREATE TABLE IF NOT EXISTS activities (
  id               INTEGER PRIMARY KEY,
  name             TEXT    NOT NULL,
  sport_type       TEXT,
  device_name      TEXT,
  start_date       TEXT,       -- UTC ISO8601
  start_date_local TEXT,       -- local time (no tz suffix)
  timezone         TEXT,
  elapsed_time     INTEGER,    -- seconds
  moving_time      INTEGER,    -- seconds
  distance         REAL    DEFAULT 0,   -- metres
  average_speed    REAL    DEFAULT 0,   -- m/s
  max_speed        REAL    DEFAULT 0,   -- m/s
  has_heartrate    INTEGER DEFAULT 0,
  average_heartrate REAL,
  max_heartrate    REAL,
  total_elevation_gain REAL DEFAULT 0,
  pr_count         INTEGER DEFAULT 0,
  achievement_count INTEGER DEFAULT 0,
  kudos_count      INTEGER DEFAULT 0,
  athlete_count    INTEGER DEFAULT 1,
  commute          INTEGER DEFAULT 0,
  trainer          INTEGER DEFAULT 0,
  manual           INTEGER DEFAULT 0,
  gear_id          TEXT,
  raw_json         TEXT,
  fetched_at       TEXT DEFAULT CURRENT_TIMESTAMP
);
