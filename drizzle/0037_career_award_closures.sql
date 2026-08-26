CREATE TABLE IF NOT EXISTS career_season_awards (
  season_number INTEGER PRIMARY KEY,
  year INTEGER NOT NULL,
  started_at TEXT,
  ended_at TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  finalized_by_administrator_id TEXT NOT NULL,
  finalized_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS career_season_awards_year_idx
ON career_season_awards(year, season_number);
