import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, financeRoute] = await Promise.all([
  import("../lib/runtime-bindings.ts"), import("../lib/database.ts"), import("../app/api/finance/route.ts"),
]);
const { db, ensureDb, hashPassword } = database;

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "ppm-finance-")), bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  await ensureDb();
  await db().prepare(`DELETE FROM players`).run();
  const now = new Date().toISOString(), adminId = "finance-admin", playerA = "finance-player-a", playerB = "finance-player-b", memberId = "finance-member";
  await db().batch([
    db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(adminId, "finance-admin@example.com", await hashPassword("finance-password"), 1, 0, now, now),
    db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("finance-admin-session", adminId, "2099-01-01T00:00:00.000Z", now),
    db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(playerA, "Jogador A", "Jogador A", "[]", "monthly", "Defesa", 3, 3, 3, 1, now, now),
    db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(playerB, "Jogador B", "Jogador B", "[]", "monthly", "Ataque", 3, 3, 3, 1, now, now),
    db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(memberId, "finance-member@example.com", await hashPassword("member-password"), 1, now, now),
    db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("finance-member-session", memberId, "2099-01-01T00:00:00.000Z", now),
    db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`).bind(playerA, "member", memberId, now),
  ]);
  return { directory, bindings, adminId, playerA, playerB, cleanup: async () => { bindings.DB.close(); setRuntimeBindings(undefined); await rm(directory, { recursive: true, force: true }); } };
}

test("gera mensalidades com valor personalizado e impede competência duplicada", async () => {
  const f = await fixture();
  try {
    assert.equal((await post({ action: "save-settings", defaultMonthlyFeeCents: 10000, defaultDueDay: 10, openingBalanceCents: 35000, initialCompetence: "2026-08", pixKey: "financeiro@example.com", players: [{ playerId: f.playerA, monthlyEnabled: true, customMonthlyFeeCents: null }, { playerId: f.playerB, monthlyEnabled: true, customMonthlyFeeCents: 8000 }] })).status, 200);
    const generated = await post({ action: "generate-monthly", competence: "2026-08" });
    assert.equal(generated.status, 200); assert.equal((await generated.json()).created, 2);
    const charges = await db().prepare(`SELECT player_id,amount_cents,due_date,status FROM financial_charges ORDER BY player_id`).all();
    assert.deepEqual(charges.results.map(row => ({ ...row })), [
      { player_id: f.playerA, amount_cents: 10000, due_date: "2026-08-10", status: "PENDING" },
      { player_id: f.playerB, amount_cents: 8000, due_date: "2026-08-10", status: "PENDING" },
    ]);
    assert.equal((await get("2026-08")).settings.pixKey, "financeiro@example.com");
    assert.equal((await post({ action: "generate-monthly", competence: "2026-08" })).status, 409);
  } finally { await f.cleanup(); }
});

test("módulo desativado bloqueia consultas e operações sem alterar os dados", async () => {
  const f = await fixture();
  try {
    await db().prepare("UPDATE instance_configuration SET finance_enabled=0 WHERE id=1").run();
    const getResponse = await financeRoute.GET(new Request("https://pelada.example/api/finance?competence=2026-08", { headers: { cookie: "ppm_session=finance-admin-session" } }));
    assert.equal(getResponse.status, 404);
    assert.match((await getResponse.json()).error, /desativado/);
    const postResponse = await post({ action: "create-expense", description: "Não deve entrar", category: "OTHER", amountCents: 1000, competence: "2026-08", dueDate: "2026-08-10" });
    assert.equal(postResponse.status, 404);
    assert.equal(await db().prepare("SELECT COUNT(*) total FROM financial_expenses").first("total"), 0);
  } finally { await f.cleanup(); }
});

test("pagamento parcial, integral e idempotente atualiza cobrança, caixa e valores a receber", async () => {
  const f = await fixture();
  try {
    await post({ action: "save-settings", defaultMonthlyFeeCents: 10000, defaultDueDay: 10, openingBalanceCents: 5000, initialCompetence: "2026-08", players: [{ playerId: f.playerA, monthlyEnabled: true }, { playerId: f.playerB, monthlyEnabled: false }] });
    await post({ action: "generate-monthly", competence: "2026-08" });
    const chargeId = await db().prepare(`SELECT id FROM financial_charges WHERE player_id=?`).bind(f.playerA).first("id");
    const partialBody = { action: "register-payment", chargeId, amountCents: 6000, paidAt: "2026-08-10", method: "PIX", notes: "Parcial", idempotencyKey: "payment-partial-key" };
    assert.equal((await post(partialBody)).status, 200); assert.equal((await post(partialBody)).status, 200);
    let view = await get("2026-08");
    assert.equal(view.charges[0].paidCents, 6000); assert.equal(view.charges[0].remainingCents, 4000); assert.equal(view.charges[0].storedStatus, "PENDING");
    assert.equal(view.summary.currentBalanceCents, 11000); assert.equal(view.summary.receivableCents, 4000);
    assert.equal((await post({ action: "register-payment", chargeId, amountCents: 4000, paidAt: "2026-08-12", method: "CASH", idempotencyKey: "payment-final-key" })).status, 200);
    view = await get("2026-08");
    assert.equal(view.charges[0].storedStatus, "PAID"); assert.equal(view.summary.currentBalanceCents, 15000); assert.equal(view.summary.receivableCents, 0); assert.equal(view.summary.incomeCents, 10000);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM financial_movements`).first("total"), 2);
    assert.equal((await post({ action: "register-payment", chargeId, amountCents: -1, paidAt: "2026-08-12", method: "PIX", idempotencyKey: "negative-payment" })).status, 400);
  } finally { await f.cleanup(); }
});

test("despesas pontuais e recorrentes preservam histórico, saldo, idempotência e estorno", async () => {
  const f = await fixture();
  try {
    await post({ action: "save-settings", defaultMonthlyFeeCents: 10000, defaultDueDay: 10, openingBalanceCents: 200000, players: [] });
    assert.equal((await post({ action: "create-expense", description: "Água", category: "WATER", amountCents: 5000, competence: "2026-08", dueDate: "2026-08-08", supplier: "Mercado" })).status, 200);
    assert.equal((await post({ action: "create-recurring-expense", description: "Campo", category: "FIELD", amountCents: 120000, dueDay: 5, supplier: "Arena" })).status, 200);
    assert.equal((await post({ action: "generate-recurring-expenses", competence: "2026-08" })).status, 200);
    assert.equal((await post({ action: "generate-recurring-expenses", competence: "2026-08" })).status, 409);
    const waterId = await db().prepare(`SELECT id FROM financial_expenses WHERE description='Água'`).first("id");
    const payBody = { action: "pay-expense", expenseId: waterId, paidAt: "2026-08-08", method: "TRANSFER", idempotencyKey: "expense-water-payment" };
    assert.equal((await post(payBody)).status, 200); assert.equal((await post(payBody)).status, 200);
    let view = await get("2026-08"); assert.equal(view.summary.expenseCents, 5000); assert.equal(view.summary.currentBalanceCents, 195000); assert.equal(view.summary.payableCents, 120000);
    assert.equal((await post({ action: "reverse-expense-payment", expenseId: waterId, reason: "Pagamento lançado na conta errada" })).status, 200);
    view = await get("2026-08"); assert.equal(view.summary.expenseCents, 0); assert.equal(view.summary.currentBalanceCents, 200000); assert.equal(view.summary.payableCents, 125000);
    assert.equal((await post(payBody)).status, 200); assert.equal((await get("2026-08")).summary.expenseCents, 0);
  } finally { await f.cleanup(); }
});

test("permissões mantêm jogador no próprio histórico e isolam outro escopo", async () => {
  const f = await fixture();
  try {
    const now = new Date().toISOString();
    await db().batch([
      db().prepare(`INSERT INTO financial_charges (id,scope_id,player_id,type,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at) VALUES ('own-charge','instance:1',?,'OTHER','Própria','OTHER',2500,'2026-08','2026-08-10','PENDING',?,?,?)`).bind(f.playerA, f.adminId, now, now),
      db().prepare(`INSERT INTO financial_charges (id,scope_id,player_id,type,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at) VALUES ('other-player-charge','instance:1',?,'OTHER','Outro jogador','OTHER',3000,'2026-08','2026-08-10','PENDING',?,?,?)`).bind(f.playerB, f.adminId, now, now),
      db().prepare(`INSERT INTO financial_charges (id,scope_id,player_id,type,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at) VALUES ('other-scope-charge','instance:2',?,'OTHER','Outra pelada','OTHER',9000,'2026-08','2026-08-10','PENDING',?,?,?)`).bind(f.playerA, f.adminId, now, now),
    ]);
    const response = await financeRoute.GET(new Request("https://pelada.example/api/finance?competence=2026-08", { headers: { cookie: "ppm_member_session=finance-member-session" } }));
    assert.equal(response.status, 200); const body = await response.json(); assert.deepEqual(body.charges.map(item => item.id), ["own-charge"]); assert.equal(body.totalPendingCents, 2500);
    assert.equal((await financeRoute.POST(request({ action: "create-expense", description: "Ataque", category: "OTHER", amountCents: 100, competence: "2026-08", dueDate: "2026-08-10" }, "ppm_member_session=finance-member-session"))).status, 403);
  } finally { await f.cleanup(); }
});

test("moderador financeiro administra o módulo sem perder a privacidade da visão própria", async () => {
  const f = await fixture();
  try {
    const now = new Date().toISOString();
    await db().batch([
      db().prepare(`UPDATE member_accounts SET role='moderator',updated_at=? WHERE id='finance-member'`).bind(now),
      db().prepare(`INSERT INTO moderator_permissions (member_account_id,permission,enabled,updated_at,updated_by_administrator_id) VALUES ('finance-member','FINANCE_MANAGE',1,?,?)`).bind(now, f.adminId),
      db().prepare(`INSERT INTO financial_charges (id,scope_id,player_id,type,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at) VALUES ('moderator-own-charge','instance:1',?,'OTHER','Própria','OTHER',2500,'2026-08','2026-08-10','PENDING',?,?,?)`).bind(f.playerA, f.adminId, now, now),
      db().prepare(`INSERT INTO financial_charges (id,scope_id,player_id,type,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at) VALUES ('moderator-other-charge','instance:1',?,'OTHER','Outro jogador','OTHER',3000,'2026-08','2026-08-10','PENDING',?,?,?)`).bind(f.playerB, f.adminId, now, now),
    ]);
    const cookie = "ppm_member_session=finance-member-session";
    const managementResponse = await financeRoute.GET(new Request("https://pelada.example/api/finance?competence=2026-08", { headers: { cookie } }));
    assert.equal(managementResponse.status, 200);
    const management = await managementResponse.json();
    assert.equal(management.viewer.canManage, true);
    assert.deepEqual(management.charges.map(item => item.id).sort(), ["moderator-other-charge", "moderator-own-charge"]);
    assert.equal((await financeRoute.POST(request({ action: "create-expense", description: "Despesa do moderador", category: "OTHER", amountCents: 1500, competence: "2026-08", dueDate: "2026-08-20" }, cookie))).status, 200);

    const selfResponse = await financeRoute.GET(new Request("https://pelada.example/api/finance?competence=2026-08&view=self", { headers: { cookie } }));
    assert.equal(selfResponse.status, 200);
    const self = await selfResponse.json();
    assert.deepEqual(self.charges.map(item => item.id), ["moderator-own-charge"]);

    await db().prepare(`DELETE FROM moderator_permissions WHERE member_account_id='finance-member' AND permission='FINANCE_MANAGE'`).run();
    assert.equal((await financeRoute.POST(request({ action: "create-expense", description: "Sem acesso", category: "OTHER", amountCents: 1500, competence: "2026-08", dueDate: "2026-08-20" }, cookie))).status, 403);
    const restricted = await financeRoute.GET(new Request("https://pelada.example/api/finance?competence=2026-08", { headers: { cookie } }));
    assert.equal(restricted.status, 200);
    assert.deepEqual((await restricted.json()).charges.map(item => item.id), ["moderator-own-charge"]);
  } finally { await f.cleanup(); }
});

test("cancelamento exige estorno, mantém auditoria e fechamento mensal é idempotente", async () => {
  const f = await fixture();
  try {
    await post({ action: "create-charge", type: "OTHER", playerId: f.playerA, description: "Contribuição", category: "EXTRA", amountCents: 10000, competence: "2026-08", dueDate: "2026-08-10" });
    const chargeId = await db().prepare(`SELECT id FROM financial_charges`).first("id");
    await post({ action: "register-payment", chargeId, amountCents: 10000, paidAt: "2026-08-10", method: "PIX", idempotencyKey: "cancel-test-payment" });
    assert.equal((await post({ action: "cancel-charge", chargeId, reason: "Correção" })).status, 409);
    const paymentId = await db().prepare(`SELECT id FROM financial_payments`).first("id");
    assert.equal((await post({ action: "reverse-payment", paymentId, reason: "Pagamento incorreto" })).status, 200);
    assert.equal((await post({ action: "cancel-charge", chargeId, reason: "Cobrança indevida" })).status, 200);
    assert.equal(await db().prepare(`SELECT status FROM financial_charges WHERE id=?`).bind(chargeId).first("status"), "CANCELLED");
    assert.equal(await db().prepare(`SELECT status FROM financial_movements WHERE payment_id=?`).bind(paymentId).first("status"), "REVERSED");
    assert.equal((await post({ action: "close-month", competence: "2026-08" })).status, 200); assert.equal((await post({ action: "close-month", competence: "2026-08" })).status, 200);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM financial_monthly_closures`).first("total"), 1);
    assert.ok(Number(await db().prepare(`SELECT COUNT(*) total FROM audit_logs WHERE action LIKE 'FINANCIAL_%'`).first("total")) >= 4);
  } finally { await f.cleanup(); }
});

function request(body, cookie = "ppm_session=finance-admin-session") { return new Request("https://pelada.example/api/finance", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) }); }
function post(body) { return financeRoute.POST(request(body)); }
async function get(competence) { const response = await financeRoute.GET(new Request(`https://pelada.example/api/finance?competence=${competence}`, { headers: { cookie: "ppm_session=finance-admin-session" } })); assert.equal(response.status, 200); return response.json(); }
