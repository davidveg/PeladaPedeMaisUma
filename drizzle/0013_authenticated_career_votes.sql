ALTER TABLE career_votes ADD COLUMN voter_account_type TEXT;
ALTER TABLE career_votes ADD COLUMN voter_account_id TEXT;

CREATE UNIQUE INDEX career_votes_account_unique_idx
ON career_votes(career_match_id,voter_account_type,voter_account_id)
WHERE voter_account_type IS NOT NULL AND voter_account_id IS NOT NULL;
