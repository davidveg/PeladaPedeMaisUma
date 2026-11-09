ALTER TABLE career_configuration ADD COLUMN attendance_bonus_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE career_configuration ADD COLUMN attendance_bonus_default_value REAL NOT NULL DEFAULT 0.1;

ALTER TABLE career_matches ADD COLUMN attendance_bonus_value REAL;
ALTER TABLE career_matches ADD COLUMN attendance_bonus_reason TEXT;
ALTER TABLE career_matches ADD COLUMN attendance_bonus_applied_at TEXT;
ALTER TABLE career_matches ADD COLUMN attendance_bonus_applied_by_administrator_id TEXT;
