CREATE TABLE IF NOT EXISTS player_account_links (
  player_id TEXT PRIMARY KEY,
  account_type TEXT NOT NULL,
  account_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO player_account_links (player_id,account_type,account_id,created_at)
SELECT player_id,'member',id,CURRENT_TIMESTAMP
FROM member_accounts
WHERE player_id IS NOT NULL;

UPDATE member_accounts SET player_id=NULL WHERE player_id IS NOT NULL;
