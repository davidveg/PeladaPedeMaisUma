ALTER TABLE member_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','moderator'));

CREATE TABLE moderator_permissions (
  member_account_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by_administrator_id TEXT NOT NULL,
  PRIMARY KEY(member_account_id,permission)
);

CREATE INDEX moderator_permissions_account_idx ON moderator_permissions(member_account_id,enabled);
