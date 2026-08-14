ALTER TABLE administrators ADD COLUMN promoted_from_member INTEGER NOT NULL DEFAULT 0;

UPDATE administrators
SET promoted_from_member=1
WHERE id IN (
  SELECT entity_id
  FROM audit_logs
  WHERE action='MEMBER_PROMOTED_TO_ADMIN' AND entity_id IS NOT NULL
);
