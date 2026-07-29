import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, adminMatches] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/admin/matches/route.ts"),
]);
const { db, ensureDb, hashPassword } = database;

test("uma partida aceita no máximo dois goleiros confirmados e libera a vaga após desistência", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-goalkeeper-limit-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), adminId = "goalkeeper-admin";
    await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(adminId, "goalkeeper-admin@example.com", await hashPassword("goalkeeper-admin-password"), 1, 0, now, now).run();
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("goalkeeper-admin-session", adminId, "2099-01-01T00:00:00.000Z", now).run();
    for (const [id, name] of [["goalkeeper-1", "Aranha"], ["goalkeeper-2", "Lourenço"], ["goalkeeper-3", "Renato"]]) {
      await db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, name, name, "[]", "goalkeeper", "Goleiro", 4, 4, 4, 1, now, now).run();
    }
    const creation = await adminMatches.POST(jsonRequest("https://pelada.example/api/admin/matches", {
      title: "Pelada com goleiros", matchAt: "2099-08-03T12:00:00.000Z",
      confirmationDeadline: "2099-08-03T11:00:00.000Z", maxChanges: 2, location: "Batista",
    }, "ppm_session=goalkeeper-admin-session"));
    const matchId = (await creation.json()).id;
    const mark = (playerId, status) => adminMatches.PATCH(jsonRequest("https://pelada.example/api/admin/matches", {
      action: "attendance", matchId, playerId, status,
    }, "ppm_session=goalkeeper-admin-session", "PATCH"));

    assert.equal((await mark("goalkeeper-1", "PRESENT")).status, 200);
    assert.equal((await mark("goalkeeper-2", "PRESENT")).status, 200);
    const blocked = await mark("goalkeeper-3", "PRESENT");
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).error, /2 goleiros confirmados/i);

    assert.equal((await mark("goalkeeper-1", "ABSENT")).status, 200);
    assert.equal((await mark("goalkeeper-3", "PRESENT")).status, 200);
    const confirmed = await db().prepare(`SELECT COUNT(*) total FROM match_attendance WHERE match_id=? AND status='PRESENT' AND player_id LIKE 'goalkeeper-%'`).bind(matchId).first();
    assert.equal(Number(confirmed.total), 2);

    const response = await adminMatches.GET(new Request("https://pelada.example/api/admin/matches", { headers: { cookie: "ppm_session=goalkeeper-admin-session" } }));
    const item = (await response.json()).matches.find(match => match.id === matchId);
    assert.deepEqual(item.goalkeepers, { present: 2, max: 2 });
    assert.match(item.shareMessage, /Goleiros:\n1 - Lourenço\n2 - Renato/);
    assert.doesNotMatch(item.shareMessage, /Aranha/);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(url, body, cookie = "", method = "POST") {
  return new Request(url, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}
