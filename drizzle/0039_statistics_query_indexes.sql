CREATE INDEX IF NOT EXISTS team_separations_statistics_date_idx
ON team_separations(match_date, deleted_at);

CREATE INDEX IF NOT EXISTS career_matches_statistics_status_idx
ON career_matches(status, closed_at);

