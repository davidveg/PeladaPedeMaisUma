ALTER TABLE players ADD COLUMN career_rating_adjustment REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS career_season_rating_reviews (
  season_number INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK(status IN ('PROPOSED','APPLIED')),
  formula_version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  created_by_administrator_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  applied_by_administrator_id TEXT,
  applied_at TEXT
);

CREATE TABLE IF NOT EXISTS player_season_rating_adjustments (
  id TEXT PRIMARY KEY,
  season_number INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  previous_adjustment REAL NOT NULL,
  proposed_delta REAL NOT NULL,
  applied_delta REAL NOT NULL,
  new_adjustment REAL NOT NULL,
  metrics_snapshot TEXT NOT NULL,
  formula_version INTEGER NOT NULL,
  applied_by_administrator_id TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  UNIQUE(season_number,player_id)
);

CREATE INDEX IF NOT EXISTS player_season_rating_adjustment_player_idx
ON player_season_rating_adjustments(player_id,season_number);
