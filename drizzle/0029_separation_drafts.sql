ALTER TABLE instance_configuration
ADD COLUMN separation_drafts_enabled INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS match_separation_drafts (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE,
  snapshot TEXT NOT NULL,
  manually_adjusted INTEGER NOT NULL DEFAULT 0,
  present_player_ids TEXT NOT NULL,
  proposal_number INTEGER NOT NULL DEFAULT 1,
  created_by_administrator_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS match_separation_drafts_match_idx
ON match_separation_drafts(match_id);
