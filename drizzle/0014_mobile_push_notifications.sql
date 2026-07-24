CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  id TEXT PRIMARY KEY,
  account_type TEXT NOT NULL CHECK(account_type IN ('administrator','member')),
  account_id TEXT NOT NULL,
  mobile_session_id TEXT,
  expo_push_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  device_name TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mobile_push_tokens_account_idx
ON mobile_push_tokens(account_type,account_id,active);

CREATE TABLE IF NOT EXISTS push_notification_deliveries (
  id TEXT PRIMARY KEY,
  career_match_id TEXT NOT NULL,
  push_token_id TEXT NOT NULL,
  status TEXT NOT NULL,
  ticket_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(career_match_id,push_token_id)
);
CREATE INDEX IF NOT EXISTS push_notification_deliveries_match_idx
ON push_notification_deliveries(career_match_id);
