ALTER TABLE career_configuration ADD COLUMN monthly_team_goalkeepers INTEGER NOT NULL DEFAULT 1;
ALTER TABLE career_configuration ADD COLUMN monthly_team_defenders INTEGER NOT NULL DEFAULT 2;
ALTER TABLE career_configuration ADD COLUMN monthly_team_midfielders INTEGER NOT NULL DEFAULT 2;
ALTER TABLE career_configuration ADD COLUMN monthly_team_attackers INTEGER NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS monthly_career_awards (
  month TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  finalized_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS monthly_career_awards_year_idx ON monthly_career_awards(year,month);
