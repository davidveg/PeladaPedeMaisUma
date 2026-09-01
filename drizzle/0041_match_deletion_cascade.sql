CREATE TRIGGER IF NOT EXISTS scheduled_matches_delete_cascade
BEFORE DELETE ON scheduled_matches
BEGIN
  DELETE FROM match_attendance WHERE match_id = OLD.id;
  DELETE FROM match_guest_preconfirmations WHERE match_id = OLD.id;
  DELETE FROM match_separation_drafts WHERE match_id = OLD.id;
  DELETE FROM account_notifications WHERE match_id = OLD.id;
  UPDATE team_separations
  SET deleted_at = COALESCE(deleted_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = OLD.separation_id;
END;
