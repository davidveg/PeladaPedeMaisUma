CREATE TABLE IF NOT EXISTS member_password_reset_tokens (
  id TEXT PRIMARY KEY,
  member_account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS member_password_reset_account_idx
ON member_password_reset_tokens(member_account_id,created_at);
