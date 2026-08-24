/* Financial domain for the single-pelada instance. Monetary values are integer cents. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb } from "./database";

export const FINANCIAL_SCOPE = "instance:1";
export const PAYMENT_METHODS = new Set(["PIX", "CASH", "TRANSFER", "CARD", "OTHER"]);
export const CHARGE_TYPES = new Set(["MONTHLY_FEE", "SINGLE_MATCH", "EXTRA", "OTHER"]);
const EXPENSE_CATEGORIES = new Set(["FIELD", "REFEREE", "WATER", "BALLS", "BIBS", "EQUIPMENT", "SOCIAL", "MAINTENANCE", "OTHER"]);

export class FinanceError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function normalizeCompetence(value: unknown) {
  const competence = String(value || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)) throw new FinanceError("Informe uma competência válida no formato AAAA-MM.");
  return competence;
}

export function currentCompetence(now = new Date()) { return now.toISOString().slice(0, 7); }

export function cents(value: unknown, field = "valor", allowZero = false) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || (!allowZero && amount === 0)) throw new FinanceError(`Informe um ${field} válido em centavos.`);
  return amount;
}

function signedCents(value: unknown, field = "valor") {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new FinanceError(`Informe um ${field} válido em centavos.`);
  return amount;
}

function text(value: unknown, field: string, max = 300, required = true) {
  const result = String(value || "").trim();
  if ((required && !result) || result.length > max) throw new FinanceError(`Revise o campo ${field}.`);
  return result || null;
}

function dateOnly(value: unknown, field: string) {
  const result = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(new Date(`${result}T12:00:00.000Z`).getTime())) throw new FinanceError(`Informe uma ${field} válida.`);
  return result;
}

function occurredAt(value: unknown, field: string) {
  const raw = String(value || "");
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00.000Z` : raw);
  if (!Number.isFinite(date.getTime())) throw new FinanceError(`Informe uma ${field} válida.`);
  return date.toISOString();
}

function method(value: unknown) {
  const result = String(value || "").toUpperCase();
  if (!PAYMENT_METHODS.has(result)) throw new FinanceError("Selecione um método de pagamento válido.");
  return result;
}

function uniqueKey(value: unknown) {
  const result = String(value || "").trim();
  if (result.length < 8 || result.length > 120) throw new FinanceError("A chave de idempotência é inválida.");
  return result;
}

function dueDateFor(competence: string, dueDay: number) {
  const [year, month] = competence.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${competence}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`;
}

function auditStatement(adminId: string, action: string, entityType: string, entityId: string, next?: unknown, previous?: unknown) {
  return db().prepare(`INSERT INTO audit_logs (id,administrator_id,action,entity_type,entity_id,previous_data,new_data,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), adminId, action, entityType, entityId, previous === undefined ? null : JSON.stringify(previous), next === undefined ? null : JSON.stringify(next), new Date().toISOString());
}

function rowCharge(row: any) {
  const paidCents = Number(row.paid_cents || 0), amountCents = Number(row.amount_cents);
  const overdue = row.status === "PENDING" && row.due_date < new Date().toISOString().slice(0, 10);
  return {
    id: row.id, playerId: row.player_id, playerName: row.player_name || null, matchId: row.match_id,
    type: row.type, description: row.description, category: row.category, amountCents, paidCents,
    remainingCents: Math.max(0, amountCents - paidCents), competence: row.competence, dueDate: row.due_date,
    status: overdue ? "OVERDUE" : row.status, storedStatus: row.status, lastPaidAt: row.last_paid_at || null, createdAt: row.created_at,
  };
}

function rowExpense(row: any) {
  const overdue = row.status === "PENDING" && row.due_date < new Date().toISOString().slice(0, 10);
  return {
    id: row.id, recurringExpenseId: row.recurring_expense_id, description: row.description, category: row.category,
    amountCents: Number(row.amount_cents), competence: row.competence, dueDate: row.due_date, paidAt: row.paid_at,
    method: row.method, status: overdue ? "OVERDUE" : row.status, storedStatus: row.status, supplier: row.supplier,
    notes: row.notes, createdAt: row.created_at,
  };
}

export async function loadFinance(competenceInput: unknown, viewer: any, selfOnly = false, canManage = viewer?.accountType === "administrator") {
  await ensureDb();
  const competence = normalizeCompetence(competenceInput || currentCompetence());
  if (!canManage || selfOnly) return loadPlayerFinance(viewer, competence);
  const [settings, chargeRows, expenseRows, movementRows, recurringRows, playerRows, matchRows, closure] = await Promise.all([
    db().prepare(`SELECT * FROM financial_settings WHERE scope_id=?`).bind(FINANCIAL_SCOPE).first<any>(),
    db().prepare(`SELECT c.*,p.display_name player_name,COALESCE(SUM(CASE WHEN fp.status='COMPLETED' THEN fp.amount_cents ELSE 0 END),0) paid_cents,MAX(CASE WHEN fp.status='COMPLETED' THEN fp.paid_at END) last_paid_at FROM financial_charges c LEFT JOIN players p ON p.id=c.player_id LEFT JOIN financial_payments fp ON fp.charge_id=c.id WHERE c.scope_id=? AND c.competence=? GROUP BY c.id ORDER BY c.due_date,c.created_at`).bind(FINANCIAL_SCOPE, competence).all(),
    db().prepare(`SELECT * FROM financial_expenses WHERE scope_id=? AND competence=? ORDER BY due_date,created_at`).bind(FINANCIAL_SCOPE, competence).all(),
    db().prepare(`SELECT m.*,p.display_name player_name FROM financial_movements m LEFT JOIN players p ON p.id=m.player_id WHERE m.scope_id=? AND substr(m.occurred_at,1,7)=? ORDER BY m.occurred_at DESC,m.created_at DESC`).bind(FINANCIAL_SCOPE, competence).all(),
    db().prepare(`SELECT * FROM financial_recurring_expenses WHERE scope_id=? ORDER BY active DESC,description`).bind(FINANCIAL_SCOPE).all(),
    db().prepare(`SELECT p.id,p.display_name,p.type,p.active,f.monthly_enabled,f.custom_monthly_fee_cents FROM players p LEFT JOIN financial_player_settings f ON f.player_id=p.id AND f.scope_id=? WHERE p.deleted_at IS NULL ORDER BY p.display_name`).bind(FINANCIAL_SCOPE).all(),
    db().prepare(`SELECT id,title,match_at FROM scheduled_matches WHERE status<>'CANCELLED' ORDER BY match_at DESC LIMIT 30`).all(),
    db().prepare(`SELECT id,snapshot,closed_at FROM financial_monthly_closures WHERE scope_id=? AND competence=?`).bind(FINANCIAL_SCOPE, competence).first<any>(),
  ]);
  const charges = chargeRows.results.map(rowCharge), expenses = expenseRows.results.map(rowExpense);
  const summary = await calculateSummary(competence, charges, expenses, Number(settings?.opening_balance_cents || 0));
  return {
    viewer: { accountType: viewer.accountType, role: viewer.role, email: viewer.email, canManage: true }, competence,
    settings: { defaultMonthlyFeeCents: Number(settings?.default_monthly_fee_cents || 0), defaultDueDay: Number(settings?.default_due_day || 10), openingBalanceCents: Number(settings?.opening_balance_cents || 0), initialCompetence: settings?.initial_competence || "", pixKey: settings?.pix_key || "" },
    summary, charges, expenses,
    movements: movementRows.results.map((row: any) => ({ id: row.id, direction: row.direction, category: row.category, description: row.description, amountCents: Number(row.amount_cents), occurredAt: row.occurred_at, method: row.method, playerId: row.player_id, playerName: row.player_name, chargeId: row.charge_id, paymentId: row.payment_id, expenseId: row.expense_id, status: row.status })),
    recurringExpenses: recurringRows.results.map((row: any) => ({ id: row.id, description: row.description, category: row.category, amountCents: Number(row.amount_cents), recurrence: row.recurrence, dueDay: Number(row.due_day), supplier: row.supplier, notes: row.notes, active: !!row.active })),
    players: playerRows.results.map((row: any) => ({ id: row.id, displayName: row.display_name, type: row.type, active: !!row.active, monthlyEnabled: row.monthly_enabled === null ? row.type !== "guest" : !!row.monthly_enabled, customMonthlyFeeCents: row.custom_monthly_fee_cents === null ? null : Number(row.custom_monthly_fee_cents) })),
    matches: matchRows.results.map((row: any) => ({ id: row.id, title: row.title, matchAt: row.match_at })),
    closure: closure ? { id: closure.id, ...JSON.parse(closure.snapshot), closedAt: closure.closed_at } : null,
  };
}

async function calculateSummary(competence: string, charges: any[], expenses: any[], openingBalanceCents: number) {
  const [year, month] = competence.split("-").map(Number), nextCompetence = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  const totals: any = await db().prepare(`SELECT COALESCE(SUM(CASE WHEN occurred_at<? AND direction='IN' THEN amount_cents WHEN occurred_at<? AND direction='OUT' THEN -amount_cents ELSE 0 END),0) balance_delta,COALESCE(SUM(CASE WHEN substr(occurred_at,1,7)=? AND direction='IN' THEN amount_cents ELSE 0 END),0) income_month,COALESCE(SUM(CASE WHEN substr(occurred_at,1,7)=? AND direction='OUT' THEN amount_cents ELSE 0 END),0) expense_month,COALESCE(SUM(CASE WHEN occurred_at<? AND direction='IN' THEN amount_cents WHEN occurred_at<? AND direction='OUT' THEN -amount_cents ELSE 0 END),0) previous_delta FROM financial_movements WHERE scope_id=? AND status='ACTIVE'`).bind(`${nextCompetence}-01`, `${nextCompetence}-01`, competence, competence, `${competence}-01`, `${competence}-01`, FINANCIAL_SCOPE).first();
  const monthly = charges.filter(item => item.type === "MONTHLY_FEE" && item.storedStatus !== "CANCELLED");
  const playerStatus = { current: 0, pending: 0, overdue: 0 };
  for (const charge of monthly) {
    if (charge.storedStatus === "PAID" || charge.storedStatus === "EXEMPT") playerStatus.current++;
    else if (charge.status === "OVERDUE") playerStatus.overdue++;
    else playerStatus.pending++;
  }
  const receivableCents = charges.filter(item => !["CANCELLED", "EXEMPT", "PAID"].includes(item.storedStatus)).reduce((sum, item) => sum + item.remainingCents, 0);
  const payableCents = expenses.filter(item => item.storedStatus === "PENDING").reduce((sum, item) => sum + item.amountCents, 0);
  const incomeCents = Number(totals?.income_month || 0), expenseCents = Number(totals?.expense_month || 0);
  return {
    currentBalanceCents: openingBalanceCents + Number(totals?.balance_delta || 0), incomeCents, expenseCents,
    resultCents: incomeCents - expenseCents, receivableCents, payableCents,
    previousBalanceCents: openingBalanceCents + Number(totals?.previous_delta || 0), players: playerStatus,
    nextExpenses: expenses.filter(item => item.storedStatus === "PENDING").slice(0, 5),
  };
}

async function loadPlayerFinance(viewer: any, competence: string) {
  if (!viewer.playerId) throw new FinanceError("Associe sua conta a um jogador para consultar o financeiro.", 403);
  const rows = await db().prepare(`SELECT c.*,p.display_name player_name,COALESCE(SUM(CASE WHEN fp.status='COMPLETED' THEN fp.amount_cents ELSE 0 END),0) paid_cents,MAX(CASE WHEN fp.status='COMPLETED' THEN fp.paid_at END) last_paid_at FROM financial_charges c JOIN players p ON p.id=c.player_id LEFT JOIN financial_payments fp ON fp.charge_id=c.id WHERE c.scope_id=? AND c.player_id=? GROUP BY c.id ORDER BY c.competence DESC,c.due_date DESC`).bind(FINANCIAL_SCOPE, viewer.playerId).all();
  const charges = rows.results.map(rowCharge), chargeIds = charges.map(item => item.id);
  let payments: any[] = [];
  if (chargeIds.length) {
    const result = await db().prepare(`SELECT id,charge_id,amount_cents,paid_at,method,notes,status FROM financial_payments WHERE scope_id=? AND charge_id IN (${chargeIds.map(() => "?").join(",")}) ORDER BY paid_at DESC`).bind(FINANCIAL_SCOPE, ...chargeIds).all();
    payments = result.results.map((row: any) => ({ id: row.id, chargeId: row.charge_id, amountCents: Number(row.amount_cents), paidAt: row.paid_at, method: row.method, notes: row.notes, status: row.status }));
  }
  return { viewer: { accountType: viewer.accountType, email: viewer.email, playerId: viewer.playerId }, competence, charges, payments, totalPendingCents: charges.filter(item => !["CANCELLED", "EXEMPT", "PAID"].includes(item.storedStatus)).reduce((sum, item) => sum + item.remainingCents, 0) };
}

export async function saveSettings(payload: any, admin: any) {
  await ensureDb();
  const defaultMonthlyFeeCents = cents(payload.defaultMonthlyFeeCents, "valor padrão", true);
  const openingBalanceCents = signedCents(payload.openingBalanceCents, "saldo inicial");
  const defaultDueDay = Number(payload.defaultDueDay);
  if (!Number.isInteger(defaultDueDay) || defaultDueDay < 1 || defaultDueDay > 31) throw new FinanceError("O vencimento deve ficar entre os dias 1 e 31.");
  const initialCompetence = payload.initialCompetence ? normalizeCompetence(payload.initialCompetence) : null;
  const pixKey = text(payload.pixKey, "chave Pix", 180, false);
  const now = new Date().toISOString();
  const previous = await db().prepare(`SELECT * FROM financial_settings WHERE scope_id=?`).bind(FINANCIAL_SCOPE).first();
  const statements = [db().prepare(`UPDATE financial_settings SET default_monthly_fee_cents=?,default_due_day=?,opening_balance_cents=?,initial_competence=?,pix_key=?,updated_at=? WHERE scope_id=?`).bind(defaultMonthlyFeeCents, defaultDueDay, openingBalanceCents, initialCompetence, pixKey, now, FINANCIAL_SCOPE)];
  if (Array.isArray(payload.players)) for (const item of payload.players) {
    const player = await db().prepare(`SELECT id FROM players WHERE id=? AND deleted_at IS NULL`).bind(String(item.playerId || "")).first();
    if (!player) throw new FinanceError("Um dos jogadores informados não existe.");
    const custom = item.customMonthlyFeeCents === null || item.customMonthlyFeeCents === "" || item.customMonthlyFeeCents === undefined ? null : cents(item.customMonthlyFeeCents, "valor personalizado", true);
    statements.push(db().prepare(`INSERT INTO financial_player_settings (scope_id,player_id,monthly_enabled,custom_monthly_fee_cents,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(scope_id,player_id) DO UPDATE SET monthly_enabled=excluded.monthly_enabled,custom_monthly_fee_cents=excluded.custom_monthly_fee_cents,updated_at=excluded.updated_at`).bind(FINANCIAL_SCOPE, String(item.playerId), item.monthlyEnabled ? 1 : 0, custom, now, now));
  }
  statements.push(auditStatement(admin.id, "FINANCIAL_SETTINGS_UPDATED", "financial_settings", FINANCIAL_SCOPE, { defaultMonthlyFeeCents, defaultDueDay, openingBalanceCents, initialCompetence, pixKey, players: payload.players }, previous));
  await db().batch(statements);
  return { message: "Configurações financeiras salvas." };
}

export async function generateMonthlyFees(payload: any, admin: any) {
  await ensureDb();
  const competence = normalizeCompetence(payload.competence), now = new Date().toISOString();
  const settings: any = await db().prepare(`SELECT * FROM financial_settings WHERE scope_id=?`).bind(FINANCIAL_SCOPE).first();
  if (settings?.initial_competence && competence < settings.initial_competence) throw new FinanceError("A competência é anterior ao início configurado.");
  const result = await db().prepare(`SELECT p.id,p.display_name,COALESCE(f.monthly_enabled,CASE WHEN p.type='guest' THEN 0 ELSE 1 END) monthly_enabled,f.custom_monthly_fee_cents FROM players p LEFT JOIN financial_player_settings f ON f.player_id=p.id AND f.scope_id=? WHERE p.active=1 AND p.deleted_at IS NULL`).bind(FINANCIAL_SCOPE).all();
  const eligible = result.results.filter((row: any) => !!row.monthly_enabled);
  if (!eligible.length) throw new FinanceError("Nenhum jogador mensalista está habilitado.");
  const dueDate = dueDateFor(competence, Number(settings?.default_due_day || 10)), statements: any[] = [], createdIds: string[] = [];
  for (const player of eligible as any[]) {
    const amount = player.custom_monthly_fee_cents === null ? Number(settings?.default_monthly_fee_cents || 0) : Number(player.custom_monthly_fee_cents);
    if (amount <= 0) throw new FinanceError(`Configure um valor de mensalidade para ${player.display_name}.`);
    const id = crypto.randomUUID(); createdIds.push(id);
    statements.push(db().prepare(`INSERT INTO financial_charges (id,scope_id,player_id,type,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,'MONTHLY_FEE',?,'MONTHLY_FEE',?,?,?,'PENDING',?,?,?)`).bind(id, FINANCIAL_SCOPE, player.id, `Mensalidade de ${player.display_name}`, amount, competence, dueDate, admin.id, now, now));
  }
  statements.push(auditStatement(admin.id, "MONTHLY_FEES_GENERATED", "financial_charge_batch", competence, { competence, dueDate, chargeIds: createdIds }));
  try { await db().batch(statements); }
  catch (error: any) { if (/unique|constraint/i.test(String(error?.message))) throw new FinanceError("As mensalidades desta competência já foram geradas.", 409); throw error; }
  return { message: `${createdIds.length} mensalidades geradas.`, created: createdIds.length };
}

export async function createCharge(payload: any, admin: any) {
  await ensureDb();
  const type = String(payload.type || "").toUpperCase();
  if (!CHARGE_TYPES.has(type) || type === "MONTHLY_FEE") throw new FinanceError("Selecione um tipo de cobrança avulsa válido.");
  const playerId = text(payload.playerId, "jogador", 80, type === "SINGLE_MATCH"), matchId = payload.matchId ? String(payload.matchId) : null;
  if (playerId && !await db().prepare(`SELECT id FROM players WHERE id=? AND deleted_at IS NULL`).bind(playerId).first()) throw new FinanceError("Jogador não encontrado.", 404);
  if (matchId && !await db().prepare(`SELECT id FROM scheduled_matches WHERE id=?`).bind(matchId).first()) throw new FinanceError("Partida não encontrada.", 404);
  if (type === "SINGLE_MATCH" && !matchId) throw new FinanceError("Selecione a partida da cobrança avulsa.");
  const id = crypto.randomUUID(), now = new Date().toISOString();
  const data = { description: text(payload.description, "descrição", 180), category: text(payload.category || type, "categoria", 60), amountCents: cents(payload.amountCents), competence: normalizeCompetence(payload.competence), dueDate: dateOnly(payload.dueDate, "data de vencimento") };
  await db().batch([
    db().prepare(`INSERT INTO financial_charges (id,scope_id,player_id,match_id,type,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'PENDING',?,?,?)`).bind(id, FINANCIAL_SCOPE, playerId, matchId, type, data.description, data.category, data.amountCents, data.competence, data.dueDate, admin.id, now, now),
    auditStatement(admin.id, "FINANCIAL_CHARGE_CREATED", "financial_charge", id, { ...data, type, playerId, matchId }),
  ]);
  return { id, message: "Cobrança criada." };
}

export async function registerPayment(payload: any, admin: any) {
  await ensureDb();
  const chargeId = String(payload.chargeId || ""), idempotencyKey = uniqueKey(payload.idempotencyKey);
  const prior: any = await db().prepare(`SELECT id,charge_id FROM financial_payments WHERE scope_id=? AND idempotency_key=?`).bind(FINANCIAL_SCOPE, idempotencyKey).first();
  if (prior) return { id: prior.id, chargeId: prior.charge_id, message: "Pagamento já registrado.", idempotent: true };
  const charge: any = await db().prepare(`SELECT c.*,COALESCE(SUM(CASE WHEN p.status='COMPLETED' THEN p.amount_cents ELSE 0 END),0) paid_cents FROM financial_charges c LEFT JOIN financial_payments p ON p.charge_id=c.id WHERE c.id=? AND c.scope_id=? GROUP BY c.id`).bind(chargeId, FINANCIAL_SCOPE).first();
  if (!charge) throw new FinanceError("Cobrança não encontrada.", 404);
  if (["CANCELLED", "EXEMPT"].includes(charge.status)) throw new FinanceError("Esta cobrança não aceita pagamentos.", 409);
  const amountCents = cents(payload.amountCents), remaining = Number(charge.amount_cents) - Number(charge.paid_cents || 0);
  if (amountCents > remaining) throw new FinanceError("O pagamento não pode ser maior que o valor restante.", 409);
  const paidAt = occurredAt(payload.paidAt, "data de pagamento"), paymentMethod = method(payload.method), notes = text(payload.notes, "observação", 1000, false);
  const id = crypto.randomUUID(), movementId = crypto.randomUUID(), now = new Date().toISOString();
  const statements = [
    db().prepare(`INSERT INTO financial_payments (id,scope_id,charge_id,amount_cents,paid_at,method,notes,status,created_by_administrator_id,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,'COMPLETED',?,?,?)`).bind(id, FINANCIAL_SCOPE, chargeId, amountCents, paidAt, paymentMethod, notes, admin.id, idempotencyKey, now),
    db().prepare(`INSERT INTO financial_movements (id,scope_id,direction,category,description,amount_cents,occurred_at,method,player_id,charge_id,payment_id,status,created_by_administrator_id,created_at) VALUES (?,?,'IN',?,?,?,?,?,?,?,?,'ACTIVE',?,?)`).bind(movementId, FINANCIAL_SCOPE, charge.category, charge.description, amountCents, paidAt, paymentMethod, charge.player_id, chargeId, id, admin.id, now),
    db().prepare(`UPDATE financial_charges SET status=CASE WHEN (SELECT COALESCE(SUM(amount_cents),0) FROM financial_payments WHERE charge_id=? AND status='COMPLETED')>=amount_cents THEN 'PAID' ELSE 'PENDING' END,updated_at=? WHERE id=?`).bind(chargeId, now, chargeId),
    auditStatement(admin.id, "FINANCIAL_PAYMENT_REGISTERED", "financial_payment", id, { chargeId, amountCents, paidAt, method: paymentMethod, notes }),
  ];
  try { await db().batch(statements); }
  catch (error: any) {
    if (/unique|constraint/i.test(String(error?.message))) {
      const duplicate: any = await db().prepare(`SELECT id,charge_id FROM financial_payments WHERE scope_id=? AND idempotency_key=?`).bind(FINANCIAL_SCOPE, idempotencyKey).first();
      if (duplicate) return { id: duplicate.id, chargeId: duplicate.charge_id, message: "Pagamento já registrado.", idempotent: true };
    }
    throw error;
  }
  return { id, chargeId, message: amountCents === remaining ? "Pagamento integral registrado." : "Pagamento parcial registrado." };
}

export async function reversePayment(payload: any, admin: any) {
  await ensureDb();
  const paymentId = String(payload.paymentId || ""), reason = text(payload.reason, "motivo", 500);
  const payment: any = await db().prepare(`SELECT * FROM financial_payments WHERE id=? AND scope_id=?`).bind(paymentId, FINANCIAL_SCOPE).first();
  if (!payment) throw new FinanceError("Pagamento não encontrado.", 404);
  if (payment.status === "REVERSED") return { message: "Pagamento já estava estornado.", idempotent: true };
  const now = new Date().toISOString();
  await db().batch([
    db().prepare(`UPDATE financial_payments SET status='REVERSED',reversed_at=?,reversed_by_administrator_id=?,reversal_reason=? WHERE id=? AND status='COMPLETED'`).bind(now, admin.id, reason, paymentId),
    db().prepare(`UPDATE financial_movements SET status='REVERSED' WHERE payment_id=?`).bind(paymentId),
    db().prepare(`UPDATE financial_charges SET status=CASE WHEN (SELECT COALESCE(SUM(amount_cents),0) FROM financial_payments WHERE charge_id=? AND status='COMPLETED' AND id<>?)>=amount_cents THEN 'PAID' ELSE 'PENDING' END,updated_at=? WHERE id=?`).bind(payment.charge_id, paymentId, now, payment.charge_id),
    auditStatement(admin.id, "FINANCIAL_PAYMENT_REVERSED", "financial_payment", paymentId, { status: "REVERSED", reason }, payment),
  ]);
  return { message: "Pagamento estornado e caixa atualizado." };
}

export async function cancelCharge(payload: any, admin: any) {
  await ensureDb();
  const id = String(payload.chargeId || ""), reason = text(payload.reason, "motivo", 500);
  const charge: any = await db().prepare(`SELECT c.*,EXISTS(SELECT 1 FROM financial_payments p WHERE p.charge_id=c.id AND p.status='COMPLETED') has_payment FROM financial_charges c WHERE c.id=? AND c.scope_id=?`).bind(id, FINANCIAL_SCOPE).first();
  if (!charge) throw new FinanceError("Cobrança não encontrada.", 404);
  if (charge.status === "CANCELLED") return { message: "Cobrança já estava cancelada.", idempotent: true };
  if (charge.has_payment) throw new FinanceError("Estorne os pagamentos antes de cancelar a cobrança.", 409);
  const now = new Date().toISOString();
  await db().batch([db().prepare(`UPDATE financial_charges SET status='CANCELLED',cancelled_at=?,cancelled_by_administrator_id=?,cancellation_reason=?,updated_at=? WHERE id=?`).bind(now, admin.id, reason, now, id), auditStatement(admin.id, "FINANCIAL_CHARGE_CANCELLED", "financial_charge", id, { status: "CANCELLED", reason }, charge)]);
  return { message: "Cobrança cancelada sem excluir o histórico." };
}

export async function toggleChargeExemption(payload: any, admin: any) {
  await ensureDb();
  const id = String(payload.chargeId || ""), charge: any = await db().prepare(`SELECT c.*,EXISTS(SELECT 1 FROM financial_payments p WHERE p.charge_id=c.id AND p.status='COMPLETED') has_payment FROM financial_charges c WHERE c.id=? AND c.scope_id=?`).bind(id, FINANCIAL_SCOPE).first();
  if (!charge) throw new FinanceError("Cobrança não encontrada.", 404);
  if (charge.status === "CANCELLED" || charge.has_payment) throw new FinanceError("Cobranças canceladas ou com pagamento não podem ser isentadas.", 409);
  const next = charge.status === "EXEMPT" ? "PENDING" : "EXEMPT", now = new Date().toISOString();
  await db().batch([db().prepare(`UPDATE financial_charges SET status=?,updated_at=? WHERE id=?`).bind(next, now, id), auditStatement(admin.id, next === "EXEMPT" ? "FINANCIAL_CHARGE_EXEMPTED" : "FINANCIAL_CHARGE_EXEMPTION_REMOVED", "financial_charge", id, { status: next }, charge)]);
  return { message: next === "EXEMPT" ? "Jogador isentado nesta cobrança." : "Isenção removida." };
}

export async function createExpense(payload: any, admin: any) {
  await ensureDb();
  const category = String(payload.category || "OTHER").toUpperCase();
  if (!EXPENSE_CATEGORIES.has(category)) throw new FinanceError("Selecione uma categoria de despesa válida.");
  const id = crypto.randomUUID(), now = new Date().toISOString();
  const data = { description: text(payload.description, "descrição", 180), category, amountCents: cents(payload.amountCents), competence: normalizeCompetence(payload.competence), dueDate: dateOnly(payload.dueDate, "data de vencimento"), supplier: text(payload.supplier, "fornecedor", 180, false), notes: text(payload.notes, "observação", 1000, false) };
  await db().batch([db().prepare(`INSERT INTO financial_expenses (id,scope_id,description,category,amount_cents,competence,due_date,status,supplier,notes,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'PENDING',?,?,?,?,?)`).bind(id, FINANCIAL_SCOPE, data.description, category, data.amountCents, data.competence, data.dueDate, data.supplier, data.notes, admin.id, now, now), auditStatement(admin.id, "FINANCIAL_EXPENSE_CREATED", "financial_expense", id, data)]);
  return { id, message: "Despesa cadastrada." };
}

export async function payExpense(payload: any, admin: any) {
  await ensureDb();
  const expenseId = String(payload.expenseId || ""), idempotencyKey = uniqueKey(payload.idempotencyKey);
  const expense: any = await db().prepare(`SELECT * FROM financial_expenses WHERE id=? AND scope_id=?`).bind(expenseId, FINANCIAL_SCOPE).first();
  if (!expense) throw new FinanceError("Despesa não encontrada.", 404);
  if (expense.status === "PAID") return { message: "Despesa já estava paga.", idempotent: true };
  if (expense.status === "CANCELLED") throw new FinanceError("Uma despesa cancelada não pode ser paga.", 409);
  if (expense.payment_idempotency_key === idempotencyKey) return { message: "Esta operação de pagamento foi estornada anteriormente.", idempotent: true };
  const paidAt = occurredAt(payload.paidAt, "data do pagamento"), paymentMethod = method(payload.method), now = new Date().toISOString(), movementId = crypto.randomUUID();
  try {
    await db().batch([
      db().prepare(`UPDATE financial_expenses SET status='PAID',paid_at=?,method=?,paid_by_administrator_id=?,payment_idempotency_key=?,updated_at=? WHERE id=? AND status='PENDING'`).bind(paidAt, paymentMethod, admin.id, idempotencyKey, now, expenseId),
      db().prepare(`INSERT INTO financial_movements (id,scope_id,direction,category,description,amount_cents,occurred_at,method,expense_id,status,created_by_administrator_id,created_at) VALUES (?,?,'OUT',?,?,?,?,?,?,'ACTIVE',?,?)`).bind(movementId, FINANCIAL_SCOPE, expense.category, expense.description, expense.amount_cents, paidAt, paymentMethod, expenseId, admin.id, now),
      auditStatement(admin.id, "FINANCIAL_EXPENSE_PAID", "financial_expense", expenseId, { status: "PAID", paidAt, method: paymentMethod }, expense),
    ]);
  } catch (error: any) { if (/unique|constraint/i.test(String(error?.message))) return { message: "Despesa já estava paga.", idempotent: true }; throw error; }
  return { message: "Pagamento da despesa registrado." };
}

export async function reverseExpensePayment(payload: any, admin: any) {
  await ensureDb();
  const id = String(payload.expenseId || ""), reason = text(payload.reason, "motivo", 500);
  const expense: any = await db().prepare(`SELECT * FROM financial_expenses WHERE id=? AND scope_id=?`).bind(id, FINANCIAL_SCOPE).first();
  if (!expense) throw new FinanceError("Despesa não encontrada.", 404);
  if (expense.status !== "PAID") return { message: "A despesa não possui pagamento ativo.", idempotent: true };
  const now = new Date().toISOString();
  await db().batch([
    db().prepare(`UPDATE financial_expenses SET status='PENDING',updated_at=? WHERE id=? AND status='PAID'`).bind(now, id),
    db().prepare(`UPDATE financial_movements SET status='REVERSED' WHERE expense_id=? AND status='ACTIVE'`).bind(id),
    auditStatement(admin.id, "FINANCIAL_EXPENSE_PAYMENT_REVERSED", "financial_expense", id, { status: "PENDING", reason }, expense),
  ]);
  return { message: "Pagamento da despesa estornado e caixa atualizado." };
}

export async function cancelExpense(payload: any, admin: any) {
  await ensureDb();
  const id = String(payload.expenseId || ""), reason = text(payload.reason, "motivo", 500);
  const expense: any = await db().prepare(`SELECT * FROM financial_expenses WHERE id=? AND scope_id=?`).bind(id, FINANCIAL_SCOPE).first();
  if (!expense) throw new FinanceError("Despesa não encontrada.", 404);
  if (expense.status === "CANCELLED") return { message: "Despesa já estava cancelada.", idempotent: true };
  if (expense.status === "PAID") throw new FinanceError("Uma despesa paga exige estorno antes do cancelamento.", 409);
  const now = new Date().toISOString();
  await db().batch([db().prepare(`UPDATE financial_expenses SET status='CANCELLED',cancelled_at=?,cancelled_by_administrator_id=?,cancellation_reason=?,updated_at=? WHERE id=?`).bind(now, admin.id, reason, now, id), auditStatement(admin.id, "FINANCIAL_EXPENSE_CANCELLED", "financial_expense", id, { status: "CANCELLED", reason }, expense)]);
  return { message: "Despesa cancelada sem excluir o histórico." };
}

export async function createRecurringExpense(payload: any, admin: any) {
  await ensureDb();
  const category = String(payload.category || "OTHER").toUpperCase(), dueDay = Number(payload.dueDay);
  if (!EXPENSE_CATEGORIES.has(category) || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new FinanceError("Revise a categoria e o dia de vencimento.");
  const id = crypto.randomUUID(), now = new Date().toISOString();
  const data = { description: text(payload.description, "descrição", 180), category, amountCents: cents(payload.amountCents), dueDay, supplier: text(payload.supplier, "fornecedor", 180, false), notes: text(payload.notes, "observação", 1000, false) };
  await db().batch([db().prepare(`INSERT INTO financial_recurring_expenses (id,scope_id,description,category,amount_cents,recurrence,due_day,supplier,notes,active,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,'MONTHLY',?,?,?,1,?,?,?)`).bind(id, FINANCIAL_SCOPE, data.description, category, data.amountCents, dueDay, data.supplier, data.notes, admin.id, now, now), auditStatement(admin.id, "FINANCIAL_RECURRING_EXPENSE_CREATED", "financial_recurring_expense", id, data)]);
  return { id, message: "Despesa recorrente configurada." };
}

export async function generateRecurringExpenses(payload: any, admin: any) {
  await ensureDb();
  const competence = normalizeCompetence(payload.competence), rows = await db().prepare(`SELECT * FROM financial_recurring_expenses WHERE scope_id=? AND active=1`).bind(FINANCIAL_SCOPE).all();
  if (!rows.results.length) throw new FinanceError("Nenhuma despesa recorrente ativa foi configurada.");
  const now = new Date().toISOString(), ids: string[] = [], statements: any[] = [];
  for (const row of rows.results as any[]) {
    const id = crypto.randomUUID(); ids.push(id);
    statements.push(db().prepare(`INSERT INTO financial_expenses (id,scope_id,recurring_expense_id,description,category,amount_cents,competence,due_date,status,supplier,notes,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'PENDING',?,?,?,?,?)`).bind(id, FINANCIAL_SCOPE, row.id, row.description, row.category, row.amount_cents, competence, dueDateFor(competence, Number(row.due_day)), row.supplier, row.notes, admin.id, now, now));
  }
  statements.push(auditStatement(admin.id, "FINANCIAL_RECURRING_EXPENSES_GENERATED", "financial_expense_batch", competence, { competence, expenseIds: ids }));
  try { await db().batch(statements); }
  catch (error: any) { if (/unique|constraint/i.test(String(error?.message))) throw new FinanceError("As despesas recorrentes desta competência já foram geradas.", 409); throw error; }
  return { message: `${ids.length} despesas recorrentes geradas.`, created: ids.length };
}

export async function closeMonth(payload: any, admin: any) {
  await ensureDb();
  const competence = normalizeCompetence(payload.competence);
  const existing: any = await db().prepare(`SELECT id FROM financial_monthly_closures WHERE scope_id=? AND competence=?`).bind(FINANCIAL_SCOPE, competence).first();
  if (existing) return { id: existing.id, message: "Esta competência já foi fechada.", idempotent: true };
  const view: any = await loadFinance(competence, admin, false, true), id = crypto.randomUUID(), now = new Date().toISOString();
  const snapshot = { competence, summary: view.summary, monthlyPlayers: view.charges.filter((item: any) => item.type === "MONTHLY_FEE").length };
  await db().batch([db().prepare(`INSERT INTO financial_monthly_closures (id,scope_id,competence,snapshot,closed_by_administrator_id,closed_at) VALUES (?,?,?,?,?,?)`).bind(id, FINANCIAL_SCOPE, competence, JSON.stringify(snapshot), admin.id, now), auditStatement(admin.id, "FINANCIAL_MONTH_CLOSED", "financial_monthly_closure", id, snapshot)]);
  return { id, message: "Fechamento mensal registrado." };
}
