CREATE TABLE IF NOT EXISTS login_rate_limits (
  id TEXT PRIMARY KEY NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS login_rate_limits_updated_idx ON login_rate_limits(updated_at);
