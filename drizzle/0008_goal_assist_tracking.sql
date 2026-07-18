ALTER TABLE career_configuration ADD COLUMN track_contributions INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS career_match_contributions (
  id TEXT PRIMARY KEY,
  career_match_id TEXT NOT NULL,
  scorer_player_id TEXT NOT NULL,
  assist_player_id TEXT,
  team TEXT NOT NULL,
  is_own_goal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS career_match_contributions_match_idx ON career_match_contributions(career_match_id);
CREATE INDEX IF NOT EXISTS career_match_contributions_scorer_idx ON career_match_contributions(scorer_player_id);
CREATE INDEX IF NOT EXISTS career_match_contributions_assist_idx ON career_match_contributions(assist_player_id);
