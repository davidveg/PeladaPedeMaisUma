import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, absenceRoute, adminMatches, matchesRoute] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/player-absence/route.ts"),
  import("../app/api/admin/matches/route.ts"),
  import("../app/api/matches/route.ts"),
]);
const { db, ensureDb, hashPassword } = database;

test("período de ausência aplica, restaura e acompanha novas partidas sem consumir remarcações", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-player-absence-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), playerId = "absence-player", memberId = "absence-member", adminId = "absence-admin";
    await db().batch([
      db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,'[]','monthly','Defesa',3,3,3,1,?,?)`).bind(playerId, "Jogador Ausente", "Jogador Ausente", now, now),
      db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(memberId, "absence@example.com", await hashPassword("absence-password"), 1, now, now),
      db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("absence-member-session", memberId, "2099-01-01T00:00:00.000Z", now),
      db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`).bind(playerId, "member", memberId, now),
      db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(adminId, "absence-admin@example.com", await hashPassword("absence-admin-password"), 1, 0, now, now),
      db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("absence-admin-session", adminId, "2099-01-01T00:00:00.000Z", now),
      matchStatement("absence-inside", "2099-07-10T12:00:00.000Z", adminId, now),
      matchStatement("absence-outside", "2099-08-10T12:00:00.000Z", adminId, now),
      db().prepare(`INSERT INTO match_attendance (id,match_id,player_id,status,change_count,responded_by_account_type,responded_by_account_id,created_at,updated_at) VALUES (?,?,?,'PRESENT',1,'member',?,?,?)`).bind("manual-present", "absence-inside", playerId, memberId, now, now),
    ]);

    const invalid = await absenceRoute.PUT(memberRequest("PUT", { startDate: "2099-07-20", endDate: "2099-07-01" }));
    assert.equal(invalid.status, 400);

    const saved = await absenceRoute.PUT(memberRequest("PUT", { startDate: "2099-07-01", endDate: "2099-07-31", reason: "Férias" }));
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).affectedMatches, 1);
    const overridden = await attendance("absence-inside", playerId);
    assert.deepEqual(pick(overridden), { status: "ABSENT", change_count: 1, absence_previous_status: "PRESENT", absence_previous_change_count: 1 });
    assert.ok(overridden.absence_period_id);
    assert.equal(await attendance("absence-outside", playerId), null);

    const manualReturn = await matchesRoute.PUT(memberRequest("PUT", { matchId: "absence-inside", status: "PRESENT" }, "/api/matches"));
    assert.equal(manualReturn.status, 200);
    assert.deepEqual(pick(await attendance("absence-inside", playerId)), { status: "PRESENT", change_count: 1, absence_previous_status: null, absence_previous_change_count: null });

    const edited = await absenceRoute.PUT(memberRequest("PUT", { startDate: "2099-08-01", endDate: "2099-08-31", reason: "Recuperação" }));
    assert.equal(edited.status, 200);
    assert.deepEqual(pick(await attendance("absence-inside", playerId)), { status: "PRESENT", change_count: 1, absence_previous_status: null, absence_previous_change_count: null });
    const automatic = await attendance("absence-outside", playerId);
    assert.deepEqual(pick(automatic), { status: "ABSENT", change_count: 0, absence_previous_status: null, absence_previous_change_count: null });

    const removed = await absenceRoute.DELETE(memberRequest("DELETE"));
    assert.equal(removed.status, 200);
    assert.equal(await attendance("absence-outside", playerId), null);
    assert.equal((await absenceRoute.GET(memberRequest("GET"))).status, 200);
    assert.equal((await (await absenceRoute.GET(memberRequest("GET"))).json()).absence, null);

    await absenceRoute.PUT(memberRequest("PUT", { startDate: "2099-09-01", endDate: "2099-09-30" }));
    const created = await adminMatches.POST(adminRequest({
      title: "Partida durante ausência", matchAt: "2099-09-12T12:00:00.000Z",
      confirmationDeadline: "2099-09-12T11:00:00.000Z", location: "Campo", maxChanges: 2,
    }));
    assert.equal(created.status, 201);
    const createdId = (await created.json()).id;
    assert.equal((await attendance(createdId, playerId)).status, "ABSENT");
    assert.equal((await attendance(createdId, playerId)).change_count, 0);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function matchStatement(id, matchAt, adminId, now) {
  const deadline = new Date(new Date(matchAt).getTime() - 3_600_000).toISOString();
  return db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,location,max_changes,status,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,2,'OPEN',?,?,?)`).bind(id, id, matchAt, deadline, "Campo", adminId, now, now);
}

function memberRequest(method, body, path = "/api/player-absence") {
  return new Request(`https://pelada.example${path}`, {
    method, headers: { cookie: "ppm_member_session=absence-member-session", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function adminRequest(body) {
  return new Request("https://pelada.example/api/admin/matches", { method: "POST", headers: { cookie: "ppm_session=absence-admin-session", "content-type": "application/json" }, body: JSON.stringify(body) });
}

function attendance(matchId, playerId) {
  return db().prepare(`SELECT * FROM match_attendance WHERE match_id=? AND player_id=?`).bind(matchId, playerId).first();
}

function pick(row) {
  return { status: row.status, change_count: row.change_count, absence_previous_status: row.absence_previous_status, absence_previous_change_count: row.absence_previous_change_count };
}
