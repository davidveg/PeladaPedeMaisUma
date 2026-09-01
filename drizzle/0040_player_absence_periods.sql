CREATE TABLE IF NOT EXISTS player_absence_periods (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS player_absence_periods_dates_idx
  ON player_absence_periods(start_date,end_date);

ALTER TABLE match_attendance ADD COLUMN absence_period_id TEXT;
ALTER TABLE match_attendance ADD COLUMN absence_previous_status TEXT;
ALTER TABLE match_attendance ADD COLUMN absence_previous_change_count INTEGER;
