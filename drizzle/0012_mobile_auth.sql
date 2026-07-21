CREATE TABLE IF NOT EXISTS mobile_sessions (
  id TEXT PRIMARY KEY,
  account_type TEXT NOT NULL CHECK(account_type IN ('administrator','member')),
  account_id TEXT NOT NULL,
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  access_expires_at TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  revoked_at TEXT,
  replaced_by_session_id TEXT,
  device_name TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mobile_sessions_account_idx ON mobile_sessions(account_type,account_id);
CREATE INDEX IF NOT EXISTS mobile_sessions_refresh_idx ON mobile_sessions(refresh_token_hash);
CREATE TABLE IF NOT EXISTS mobile_idempotency_keys (
  id TEXT PRIMARY KEY,
  administrator_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(administrator_id,operation,idempotency_key)
);
