CREATE TABLE IF NOT EXISTS financial_settings (
  scope_id TEXT PRIMARY KEY DEFAULT 'instance:1', default_monthly_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(default_monthly_fee_cents >= 0),
  default_due_day INTEGER NOT NULL DEFAULT 10 CHECK(default_due_day BETWEEN 1 AND 31), opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  initial_competence TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS financial_player_settings (
  scope_id TEXT NOT NULL DEFAULT 'instance:1', player_id TEXT NOT NULL, monthly_enabled INTEGER NOT NULL DEFAULT 1,
  custom_monthly_fee_cents INTEGER CHECK(custom_monthly_fee_cents IS NULL OR custom_monthly_fee_cents >= 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(scope_id, player_id)
);
CREATE TABLE IF NOT EXISTS financial_charges (
  id TEXT PRIMARY KEY, scope_id TEXT NOT NULL DEFAULT 'instance:1', player_id TEXT, match_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('MONTHLY_FEE','SINGLE_MATCH','EXTRA','OTHER')), description TEXT NOT NULL, category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), competence TEXT NOT NULL, due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID','EXEMPT','CANCELLED')),
  created_by_administrator_id TEXT NOT NULL, cancelled_at TEXT, cancelled_by_administrator_id TEXT, cancellation_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_charge_monthly_unique ON financial_charges(scope_id,player_id,type,competence) WHERE type='MONTHLY_FEE';
CREATE INDEX IF NOT EXISTS financial_charge_scope_competence_idx ON financial_charges(scope_id,competence);
CREATE INDEX IF NOT EXISTS financial_charge_player_idx ON financial_charges(player_id,competence);
CREATE TABLE IF NOT EXISTS financial_payments (
  id TEXT PRIMARY KEY, scope_id TEXT NOT NULL DEFAULT 'instance:1', charge_id TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  paid_at TEXT NOT NULL, method TEXT NOT NULL CHECK(method IN ('PIX','CASH','TRANSFER','CARD','OTHER')), notes TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED','REVERSED')), created_by_administrator_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL, reversed_at TEXT, reversed_by_administrator_id TEXT, reversal_reason TEXT, created_at TEXT NOT NULL,
  UNIQUE(scope_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS financial_payment_charge_idx ON financial_payments(charge_id,status);
CREATE TABLE IF NOT EXISTS financial_recurring_expenses (
  id TEXT PRIMARY KEY, scope_id TEXT NOT NULL DEFAULT 'instance:1', description TEXT NOT NULL, category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), recurrence TEXT NOT NULL DEFAULT 'MONTHLY' CHECK(recurrence='MONTHLY'),
  due_day INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 31), supplier TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1,
  created_by_administrator_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS financial_recurring_expense_scope_idx ON financial_recurring_expenses(scope_id,active);
CREATE TABLE IF NOT EXISTS financial_expenses (
  id TEXT PRIMARY KEY, scope_id TEXT NOT NULL DEFAULT 'instance:1', recurring_expense_id TEXT, description TEXT NOT NULL, category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), competence TEXT NOT NULL, due_date TEXT NOT NULL, paid_at TEXT, method TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID','CANCELLED')), supplier TEXT, notes TEXT,
  created_by_administrator_id TEXT NOT NULL, paid_by_administrator_id TEXT, payment_idempotency_key TEXT,
  cancelled_at TEXT, cancelled_by_administrator_id TEXT, cancellation_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_expense_recurring_competence_unique ON financial_expenses(scope_id,recurring_expense_id,competence) WHERE recurring_expense_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS financial_expense_payment_idempotency_unique ON financial_expenses(scope_id,payment_idempotency_key) WHERE payment_idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS financial_expense_scope_competence_idx ON financial_expenses(scope_id,competence);
CREATE TABLE IF NOT EXISTS financial_movements (
  id TEXT PRIMARY KEY, scope_id TEXT NOT NULL DEFAULT 'instance:1', direction TEXT NOT NULL CHECK(direction IN ('IN','OUT')), category TEXT NOT NULL,
  description TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), occurred_at TEXT NOT NULL, method TEXT, player_id TEXT,
  charge_id TEXT, payment_id TEXT, expense_id TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVERSED')),
  created_by_administrator_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_movement_payment_unique ON financial_movements(payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS financial_movement_expense_unique ON financial_movements(expense_id) WHERE expense_id IS NOT NULL AND status='ACTIVE';
CREATE INDEX IF NOT EXISTS financial_movement_scope_date_idx ON financial_movements(scope_id,occurred_at);
CREATE TABLE IF NOT EXISTS financial_monthly_closures (
  id TEXT PRIMARY KEY, scope_id TEXT NOT NULL DEFAULT 'instance:1', competence TEXT NOT NULL, snapshot TEXT NOT NULL,
  closed_by_administrator_id TEXT NOT NULL, closed_at TEXT NOT NULL, UNIQUE(scope_id,competence)
);
