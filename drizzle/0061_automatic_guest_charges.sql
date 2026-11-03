ALTER TABLE instance_configuration ADD COLUMN automatic_guest_charge_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE instance_configuration ADD COLUMN automatic_guest_charge_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE financial_charges ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL';
CREATE UNIQUE INDEX financial_charge_auto_guest_unique
  ON financial_charges(scope_id,match_id,player_id)
  WHERE type='SINGLE_MATCH' AND origin='AUTO_GUEST_ATTENDANCE';
