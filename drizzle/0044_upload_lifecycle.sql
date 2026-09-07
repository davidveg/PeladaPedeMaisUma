CREATE TABLE IF NOT EXISTS upload_objects (
  object_key TEXT PRIMARY KEY NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('players','branding')),
  owner_account_type TEXT NOT NULL CHECK(owner_account_type IN ('administrator','member')),
  owner_account_id TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  status TEXT NOT NULL CHECK(status IN ('uploading','pending','attached','rejected','deleted')),
  attached_entity_type TEXT,
  attached_entity_id TEXT,
  created_at TEXT NOT NULL,
  attached_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS upload_objects_owner_idx ON upload_objects(owner_account_type,owner_account_id,created_at);
CREATE INDEX IF NOT EXISTS upload_objects_status_idx ON upload_objects(status,updated_at);
