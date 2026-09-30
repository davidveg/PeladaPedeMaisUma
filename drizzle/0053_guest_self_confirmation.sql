ALTER TABLE instance_configuration ADD COLUMN guest_self_confirmation_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scheduled_matches ADD COLUMN guest_confirmation_opens_at TEXT;
