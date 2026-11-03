ALTER TABLE financial_expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE financial_expenses ADD COLUMN player_id TEXT;
ALTER TABLE financial_expenses ADD COLUMN match_id TEXT;
CREATE UNIQUE INDEX financial_expense_goalkeeper_match_unique
  ON financial_expenses(scope_id,match_id,player_id)
  WHERE type='GOALKEEPER_SINGLE_MATCH';
