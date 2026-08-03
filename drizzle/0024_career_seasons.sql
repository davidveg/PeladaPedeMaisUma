ALTER TABLE career_configuration ADD COLUMN season_duration_months INTEGER NOT NULL DEFAULT 12;
ALTER TABLE career_configuration ADD COLUMN season_started_at TEXT;
ALTER TABLE career_configuration ADD COLUMN next_season_reset_at TEXT;
ALTER TABLE career_configuration ADD COLUMN season_number INTEGER NOT NULL DEFAULT 1;
