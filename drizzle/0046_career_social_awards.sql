ALTER TABLE career_configuration ADD COLUMN partner_award REAL NOT NULL DEFAULT 0.1;
ALTER TABLE career_configuration ADD COLUMN fair_play_award REAL NOT NULL DEFAULT 0.1;
ALTER TABLE career_configuration ADD COLUMN defense_award REAL NOT NULL DEFAULT 0.1;

ALTER TABLE career_votes ADD COLUMN partner_id TEXT;
ALTER TABLE career_votes ADD COLUMN fair_play_id TEXT;
ALTER TABLE career_votes ADD COLUMN defense_id TEXT;
