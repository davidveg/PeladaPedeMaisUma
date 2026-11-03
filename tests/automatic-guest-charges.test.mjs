import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, scheduledMatches, guestFinance, instanceConfigRoute, instanceConfig] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../lib/scheduled-matches.ts"),
  import("../lib/guest-finance.ts"),
  import("../app/api/instance-config/route.ts"),
  import("../lib/instance-config.ts"),
]);
const { db, ensureDb, hashPassword } = database;

test("confirmação de convidado cria, cancela e reativa uma única cobrança automática", async () => {
  const fixture = await setup();
  try {
    const account = { id: fixture.adminId, accountType: "administrator" };
    await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.guestId, status: "PRESENT", account, administratorOverride: true });
    const created = await automaticCharges(fixture.matchId, fixture.guestId);
    assert.equal(created.length, 1);
    assert.deepEqual(pick(created[0], ["amount_cents", "competence", "due_date", "status", "origin"]), {
      amount_cents: 3500, competence: "2099-07", due_date: "2099-07-27", status: "PENDING", origin: "AUTO_GUEST_ATTENDANCE",
    });

    const repeated = await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.guestId, status: "PRESENT", account, administratorOverride: true });
    assert.equal(repeated.changed, false);
    assert.equal((await automaticCharges(fixture.matchId, fixture.guestId)).length, 1);

    await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.guestId, status: "ABSENT", account, administratorOverride: true });
    assert.equal((await automaticCharges(fixture.matchId, fixture.guestId))[0].status, "CANCELLED");

    await db().prepare(`UPDATE instance_configuration SET automatic_guest_charge_amount_cents=4000 WHERE id=1`).run();
    await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.guestId, status: "PRESENT", account, administratorOverride: true });
    const reactivated = (await automaticCharges(fixture.matchId, fixture.guestId))[0];
    assert.equal(reactivated.id, created[0].id);
    assert.equal(reactivated.status, "PENDING");
    assert.equal(reactivated.amount_cents, 4000);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM audit_logs WHERE action IN ('AUTOMATIC_GUEST_CHARGE_CREATED','AUTOMATIC_GUEST_CHARGE_CANCELLED','AUTOMATIC_GUEST_CHARGE_REACTIVATED')`).first("total"), 3);
  } finally { await fixture.cleanup(); }
});

test("pagamento é preservado e cancelamento da partida afeta somente pendências automáticas", async () => {
  const fixture = await setup();
  try {
    const account = { id: fixture.adminId, accountType: "administrator" };
    await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.guestId, status: "PRESENT", account, administratorOverride: true });
    const paidCharge = (await automaticCharges(fixture.matchId, fixture.guestId))[0], now = new Date().toISOString();
    await db().batch([
      db().prepare(`INSERT INTO financial_payments (id,scope_id,charge_id,amount_cents,paid_at,method,status,created_by_administrator_id,idempotency_key,created_at) VALUES ('guest-payment','instance:1',?,3500,?,'PIX','COMPLETED',?,'guest-payment-key',?)`).bind(paidCharge.id, now, fixture.adminId, now),
      db().prepare(`UPDATE financial_charges SET status='PAID',updated_at=? WHERE id=?`).bind(now, paidCharge.id),
    ]);
    await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.guestId, status: "ABSENT", account, administratorOverride: true });
    assert.equal((await automaticCharges(fixture.matchId, fixture.guestId))[0].status, "PAID");

    await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.secondGuestId, status: "PRESENT", account, administratorOverride: true });
    const match = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(fixture.matchId).first();
    assert.equal((await guestFinance.cancelAutomaticGuestChargesForMatch(match, fixture.adminId)).cancelled, 1);
    assert.equal((await automaticCharges(fixture.matchId, fixture.secondGuestId))[0].status, "CANCELLED");
    assert.equal((await automaticCharges(fixture.matchId, fixture.guestId))[0].status, "PAID");
  } finally { await fixture.cleanup(); }
});

test("automação desligada e jogadores não convidados não geram cobrança", async () => {
  const fixture = await setup();
  try {
    await db().prepare(`UPDATE instance_configuration SET automatic_guest_charge_enabled=0 WHERE id=1`).run();
    const account = { id: fixture.adminId, accountType: "administrator" };
    await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.guestId, status: "PRESENT", account, administratorOverride: true });
    await scheduledMatches.setAttendance({ matchId: fixture.matchId, playerId: fixture.monthlyId, status: "PRESENT", account, administratorOverride: true });
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM financial_charges`).first("total"), 0);
  } finally { await fixture.cleanup(); }
});

test("salvar a configuração reconcilia convidados já presentes em partidas existentes", async () => {
  const fixture = await setup();
  try {
    const now = new Date().toISOString();
    await db().batch([
      db().prepare(`UPDATE instance_configuration SET automatic_guest_charge_enabled=0,automatic_guest_charge_amount_cents=0 WHERE id=1`),
      db().prepare(`INSERT INTO match_attendance (id,match_id,player_id,status,change_count,created_at,updated_at) VALUES ('preexisting-guest-attendance',?,?,'PRESENT',0,?,?)`).bind(fixture.matchId, fixture.guestId, now, now),
    ]);
    assert.equal((await automaticCharges(fixture.matchId, fixture.guestId)).length, 0);
    const current = instanceConfig.instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
    const response = await instanceConfigRoute.PUT(new Request("https://pelada.example/api/instance-config", {
      method: "PUT", headers: { "content-type": "application/json", cookie: "ppm_session=guest-charge-admin-session" },
      body: JSON.stringify({ ...current, automaticGuestChargeEnabled: true, automaticGuestChargeAmountCents: 3600 }),
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.guestChargeReconciliation, { eligible: 1, created: 1, skippedClosedCompetence: 0 });
    assert.match(payload.message, /1 cobrança pendente foi criada/);
    const created = (await automaticCharges(fixture.matchId, fixture.guestId))[0];
    assert.equal(created.amount_cents, 3600);

    const secondResponse = await instanceConfigRoute.PUT(new Request("https://pelada.example/api/instance-config", {
      method: "PUT", headers: { "content-type": "application/json", cookie: "ppm_session=guest-charge-admin-session" },
      body: JSON.stringify({ ...payload.config, automaticGuestChargeAmountCents: 5000 }),
    }));
    assert.equal(secondResponse.status, 200);
    assert.deepEqual((await secondResponse.json()).guestChargeReconciliation, { eligible: 0, created: 0, skippedClosedCompetence: 0 });
    assert.equal((await automaticCharges(fixture.matchId, fixture.guestId))[0].amount_cents, 3600);
  } finally { await fixture.cleanup(); }
});

test("reconciliação ignora convidados de partidas com resultado confirmado", async () => {
  const fixture = await setup();
  try {
    const now = new Date().toISOString(), separationId = "guest-charge-confirmed-separation";
    await db().batch([
      db().prepare(`UPDATE instance_configuration SET automatic_guest_charge_enabled=0,automatic_guest_charge_amount_cents=0 WHERE id=1`),
      db().prepare(`INSERT INTO match_attendance (id,match_id,player_id,status,change_count,created_at,updated_at) VALUES ('confirmed-result-guest-attendance',?,?,'PRESENT',0,?,?)`).bind(fixture.matchId, fixture.guestId, now, now),
      db().prepare(`INSERT INTO team_separations (id,match_title,match_date,original_text,snapshot,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,'2099-07-27','',?,0,'Bom equilíbrio',?,?,?)`).bind(separationId, "Pelada com resultado", JSON.stringify({ blue: [], yellow: [] }), now, now, now),
      db().prepare(`UPDATE scheduled_matches SET separation_id=? WHERE id=?`).bind(separationId, fixture.matchId),
      db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,created_by_administrator_id,config_snapshot,created_at,updated_at) VALUES ('guest-charge-confirmed-result',?,2,1,'BLUE','guest-charge-confirmed-token','OPEN','2100-01-01T00:00:00.000Z',?,'{}',?,?)`).bind(separationId, fixture.adminId, now, now),
    ]);
    const current = instanceConfig.instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
    const response = await instanceConfigRoute.PUT(new Request("https://pelada.example/api/instance-config", {
      method: "PUT", headers: { "content-type": "application/json", cookie: "ppm_session=guest-charge-admin-session" },
      body: JSON.stringify({ ...current, automaticGuestChargeEnabled: true, automaticGuestChargeAmountCents: 3600 }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).guestChargeReconciliation, { eligible: 0, created: 0, skippedClosedCompetence: 0 });
    assert.equal((await automaticCharges(fixture.matchId, fixture.guestId)).length, 0);
  } finally { await fixture.cleanup(); }
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "ppm-auto-guest-charge-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  await ensureDb();
  const now = new Date().toISOString(), adminId = "guest-charge-admin", matchId = "guest-charge-match";
  const guestId = "guest-charge-player", secondGuestId = "guest-charge-second", monthlyId = "guest-charge-monthly";
  await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(adminId, "guest-charge@example.com", await hashPassword("guest-charge-password"), 1, 0, now, now).run();
  await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES ('guest-charge-admin-session',?,'2100-01-01T00:00:00.000Z',?)`).bind(adminId, now).run();
  for (const [id, name, type] of [[guestId, "Convidado Um", "guest"], [secondGuestId, "Convidado Dois", "guest"], [monthlyId, "Mensalista", "monthly"]]) {
    await db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, name, name, "[]", type, "Ataque", 3, 3, 3, 1, now, now).run();
  }
  await db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,location,max_changes,status,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,'Quadra',20,'OPEN',?,?,?)`).bind(matchId, "Pelada dos convidados", "2099-07-27T12:00:00.000Z", "2099-07-27T11:00:00.000Z", adminId, now, now).run();
  await db().prepare(`UPDATE instance_configuration SET finance_enabled=1,automatic_guest_charge_enabled=1,automatic_guest_charge_amount_cents=3500,timezone='America/Sao_Paulo' WHERE id=1`).run();
  return {
    adminId, matchId, guestId, secondGuestId, monthlyId,
    async cleanup() { bindings.DB.close(); setRuntimeBindings(undefined); await rm(directory, { recursive: true, force: true }); },
  };
}

async function automaticCharges(matchId, playerId) {
  return (await db().prepare(`SELECT * FROM financial_charges WHERE match_id=? AND player_id=? AND origin='AUTO_GUEST_ATTENDANCE' ORDER BY created_at`).bind(matchId, playerId).all()).results;
}

function pick(value, keys) { return Object.fromEntries(keys.map(key => [key, value[key]])); }
