import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, matches, adminMatches] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/matches/route.ts"),
  import("../app/api/admin/matches/route.ts"),
]);
const { db, ensureDb, hashPassword } = database;

test("bloqueio financeiro é opcional, amigável e permite intervenção administrativa", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-financial-attendance-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), adminId = "financial-block-admin", memberId = "financial-block-member";
    const playerId = "financial-block-player", matchId = "financial-block-match", chargeId = "financial-block-charge";
    await db().batch([
      db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(adminId, "financial-block-admin@example.com", await hashPassword("financial-block-admin-password"), 1, 0, now, now),
      db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("financial-block-admin-session", adminId, "2099-01-01T00:00:00.000Z", now),
      db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(memberId, "financial-block-member@example.com", await hashPassword("financial-block-member-password"), 1, now, now),
      db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("financial-block-member-session", memberId, "2099-01-01T00:00:00.000Z", now),
      db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(playerId, "Jogador em negociação", "Jogador em negociação", "Negociação", "[]", "monthly", "Defesa", 3, 3, 3, 1, now, now),
      db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?, 'member', ?, ?)`).bind(playerId, memberId, now),
      db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,location,max_changes,status,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,10,'OPEN',?,?,?)`).bind(matchId, "Pelada financeira", "2099-09-20T12:00:00.000Z", "2099-09-20T11:00:00.000Z", "Batista", adminId, now, now),
      db().prepare(`INSERT INTO financial_charges (id,scope_id,player_id,type,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at) VALUES (?,'instance:1',?,'MONTHLY_FEE','Mensalidade vencida','MONTHLY_FEE',7000,'2000-01','2000-01-10','PENDING',?,?,?)`).bind(chargeId, playerId, adminId, now, now),
    ]);

    const memberCookie = "ppm_member_session=financial-block-member-session", adminCookie = "ppm_session=financial-block-admin-session";
    assert.equal((await matches.PUT(request({ matchId, status: "PRESENT" }, memberCookie, "PUT"))).status, 200, "o padrão desativado não deve bloquear");
    assert.equal((await matches.PUT(request({ matchId, status: "ABSENT" }, memberCookie, "PUT"))).status, 200);
    await db().prepare(`UPDATE instance_configuration SET delinquency_attendance_block_enabled=1 WHERE id=1`).run();

    const list = await matches.GET(new Request("https://pelada.example/api/matches", { headers: { cookie: memberCookie } }));
    const item = (await list.json()).matches.find(match => match.id === matchId);
    assert.equal(item.viewer.attendanceBlockedByDelinquency, true);
    assert.equal(item.viewer.canConfirmPresence, false);
    assert.equal(item.viewer.canRespond, true);
    assert.match(item.viewer.attendanceBlockMessage, /administração.*regularizar ou combinar/i);

    const blocked = await matches.PUT(request({ matchId, status: "PRESENT" }, memberCookie, "PUT"));
    assert.equal(blocked.status, 403);
    assert.match((await blocked.json()).error, /pagamento em atraso.*administração/i);
    assert.equal(await db().prepare(`SELECT status FROM match_attendance WHERE match_id=? AND player_id=?`).bind(matchId, playerId).first("status"), "ABSENT");

    const override = await adminMatches.PATCH(request({ action: "attendance", matchId, playerId, status: "PRESENT" }, adminCookie, "PATCH"));
    assert.equal(override.status, 200, "a administração deve poder confirmar após negociação");
    assert.equal((await adminMatches.PATCH(request({ action: "attendance", matchId, playerId, status: "ABSENT" }, adminCookie, "PATCH"))).status, 200);

    await db().prepare(`INSERT INTO financial_payments (id,scope_id,charge_id,amount_cents,paid_at,method,status,created_by_administrator_id,idempotency_key,created_at) VALUES ('financial-block-payment','instance:1',?,7000,?,'PIX','COMPLETED',?,'financial-block-payment-key',?)`).bind(chargeId, now, adminId, now).run();
    const regularizedList = await matches.GET(new Request("https://pelada.example/api/matches", { headers: { cookie: memberCookie } }));
    const regularized = (await regularizedList.json()).matches.find(match => match.id === matchId);
    assert.equal(regularized.viewer.attendanceBlockedByDelinquency, false);
    assert.equal(regularized.viewer.canConfirmPresence, true);
    assert.equal((await matches.PUT(request({ matchId, status: "PRESENT" }, memberCookie, "PUT"))).status, 200);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function request(body, cookie, method) {
  return new Request("https://pelada.example/api/matches", { method, headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
}
