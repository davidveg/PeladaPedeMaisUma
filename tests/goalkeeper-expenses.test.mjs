import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, financeRoute, financeService] = await Promise.all([
  import("../lib/runtime-bindings.ts"), import("../lib/database.ts"), import("../app/api/finance/route.ts"), import("../lib/finance-service.ts"),
]);
const { db, ensureDb, hashPassword } = database;

test("despesa de goleiro avulso exige goleiro e partida e impede duplicidade", async () => {
  const fixture = await setup();
  try {
    const response = await post({
      action: "create-expense", type: "GOALKEEPER_SINGLE_MATCH", playerId: fixture.goalkeeperId, matchId: fixture.matchId,
      category: "OTHER", amountCents: 8000, competence: "2099-07", dueDate: "2099-07-27", notes: "Diária combinada",
    });
    assert.equal(response.status, 200);
    const expense = await db().prepare(`SELECT type,player_id,match_id,description,amount_cents,status FROM financial_expenses`).first();
    assert.deepEqual({ ...expense }, {
      type: "GOALKEEPER_SINGLE_MATCH", player_id: fixture.goalkeeperId, match_id: fixture.matchId,
      description: "Goleiro avulso — Goleiro Um — Pelada de domingo", amount_cents: 8000, status: "PENDING",
    });
    assert.equal((await post({ action: "create-expense", type: "GOALKEEPER_SINGLE_MATCH", playerId: fixture.goalkeeperId, matchId: fixture.matchId, category: "OTHER", amountCents: 8000, competence: "2099-07", dueDate: "2099-07-27" })).status, 409);
    assert.equal((await post({ action: "create-expense", type: "GOALKEEPER_SINGLE_MATCH", playerId: fixture.monthlyId, matchId: fixture.matchId, category: "OTHER", amountCents: 8000, competence: "2099-07", dueDate: "2099-07-27" })).status, 404);

    const view = await financeRoute.GET(new Request("https://pelada.example/api/finance?competence=2099-07", { headers: { cookie: "ppm_session=goalkeeper-expense-session" } }));
    const payload = await view.json();
    const mapped = payload.expenses[0];
    assert.deepEqual({ type: mapped.type, playerId: mapped.playerId, playerName: mapped.playerName, matchId: mapped.matchId, matchTitle: mapped.matchTitle }, {
      type: "GOALKEEPER_SINGLE_MATCH", playerId: fixture.goalkeeperId, playerName: "Goleiro Um", matchId: fixture.matchId, matchTitle: "Pelada de domingo",
    });
    assert.deepEqual(payload.players.filter(player => player.type === "casual").map(player => ({ id: player.id, primaryPosition: player.primaryPosition })), [
      { id: fixture.secondGoalkeeperId, primaryPosition: "Goleiro" },
      { id: fixture.goalkeeperId, primaryPosition: "Goleiro" },
    ]);
  } finally { await fixture.cleanup(); }
});

test("cancelamento de partida cancela despesa pendente de goleiro e preserva a paga", async () => {
  const fixture = await setup();
  try {
    for (const playerId of [fixture.goalkeeperId, fixture.secondGoalkeeperId]) {
      assert.equal((await post({ action: "create-expense", type: "GOALKEEPER_SINGLE_MATCH", playerId, matchId: fixture.matchId, category: "OTHER", amountCents: 8000, competence: "2099-07", dueDate: "2099-07-27" })).status, 200);
    }
    const paidId = await db().prepare(`SELECT id FROM financial_expenses WHERE player_id=?`).bind(fixture.goalkeeperId).first("id");
    assert.equal((await post({ action: "pay-expense", expenseId: paidId, amountCents: 8000, paidAt: "2099-07-27", method: "PIX", idempotencyKey: "goalkeeper-expense-payment" })).status, 200);
    assert.equal(await db().prepare(`SELECT player_id FROM financial_movements WHERE expense_id=?`).bind(paidId).first("player_id"), fixture.goalkeeperId);
    const result = await financeService.cancelPendingGoalkeeperExpensesForMatch(fixture.matchId, { id: fixture.adminId });
    assert.equal(result.cancelled, 1);
    const expenses = await db().prepare(`SELECT player_id,status FROM financial_expenses ORDER BY player_id`).all();
    assert.deepEqual(expenses.results.map(row => ({ ...row })), [
      { player_id: fixture.goalkeeperId, status: "PAID" },
      { player_id: fixture.secondGoalkeeperId, status: "CANCELLED" },
    ]);
  } finally { await fixture.cleanup(); }
});

test("migração preserva despesas antigas como despesas comuns", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-goalkeeper-expense-migration-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(`CREATE TABLE financial_expenses (id TEXT PRIMARY KEY,scope_id TEXT NOT NULL); INSERT INTO financial_expenses (id,scope_id) VALUES ('legacy','instance:1');`);
    await bindings.DB.exec(await readFile(new URL("../drizzle/0062_goalkeeper_single_match_expenses.sql", import.meta.url), "utf8"));
    assert.deepEqual({ ...(await bindings.DB.prepare(`SELECT type,player_id,match_id FROM financial_expenses WHERE id='legacy'`).first()) }, { type: "STANDARD", player_id: null, match_id: null });
  } finally { bindings.DB.close(); await rm(directory, { recursive: true, force: true }); }
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "ppm-goalkeeper-expense-")), bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  await ensureDb();
  const now = new Date().toISOString(), adminId = "goalkeeper-expense-admin", matchId = "goalkeeper-expense-match";
  const goalkeeperId = "goalkeeper-expense-one", secondGoalkeeperId = "goalkeeper-expense-two", monthlyId = "goalkeeper-expense-monthly";
  await db().batch([
    db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(adminId, "goalkeeper-expense@example.com", await hashPassword("goalkeeper-expense-password"), 1, 0, now, now),
    db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES ('goalkeeper-expense-session',?,'2100-01-01T00:00:00.000Z',?)`).bind(adminId, now),
    db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(goalkeeperId, "Goleiro Um", "Goleiro Um", "[]", "casual", "Goleiro", 3, 3, 3, 1, now, now),
    db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(secondGoalkeeperId, "Goleiro Dois", "Goleiro Dois", "[]", "casual", "Goleiro", 3, 3, 3, 1, now, now),
    db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(monthlyId, "Goleiro Mensalista", "Goleiro Mensalista", "[]", "goalkeeper", "Goleiro", 3, 3, 3, 1, now, now),
    db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,location,max_changes,status,created_by_administrator_id,created_at,updated_at) VALUES (?,'Pelada de domingo','2099-07-27T12:00:00.000Z','2099-07-27T11:00:00.000Z','Quadra',2,'OPEN',?,?,?)`).bind(matchId, adminId, now, now),
  ]);
  return { adminId, matchId, goalkeeperId, secondGoalkeeperId, monthlyId, async cleanup() { bindings.DB.close(); setRuntimeBindings(undefined); await rm(directory, { recursive: true, force: true }); } };
}

function post(body) { return financeRoute.POST(new Request("https://pelada.example/api/finance", { method: "POST", headers: { "content-type": "application/json", cookie: "ppm_session=goalkeeper-expense-session" }, body: JSON.stringify(body) })); }
