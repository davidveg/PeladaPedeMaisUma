CREATE TABLE IF NOT EXISTS scheduled_matches (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  match_at TEXT NOT NULL,
  confirmation_deadline TEXT NOT NULL,
  location TEXT,
  max_changes INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED','CANCELLED')),
  created_by_administrator_id TEXT NOT NULL,
  separation_id TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS scheduled_matches_status_date_idx
  ON scheduled_matches(status,match_at);

CREATE TABLE IF NOT EXISTS match_attendance (
  id TEXT PRIMARY KEY NOT NULL,
  match_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PRESENT','ABSENT')),
  change_count INTEGER NOT NULL DEFAULT 0,
  responded_by_account_type TEXT,
  responded_by_account_id TEXT,
  updated_by_administrator_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(match_id,player_id)
);

CREATE INDEX IF NOT EXISTS match_attendance_match_idx
  ON match_attendance(match_id,status);

CREATE TABLE IF NOT EXISTS account_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  account_type TEXT NOT NULL CHECK(account_type IN ('administrator','member')),
  account_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  match_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS account_notifications_account_idx
  ON account_notifications(account_type,account_id,created_at);

CREATE TABLE IF NOT EXISTS notification_push_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  notification_id TEXT NOT NULL,
  push_token_id TEXT NOT NULL,
  status TEXT NOT NULL,
  ticket_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(notification_id,push_token_id)
);

CREATE INDEX IF NOT EXISTS notification_push_notification_idx
  ON notification_push_deliveries(notification_id);
