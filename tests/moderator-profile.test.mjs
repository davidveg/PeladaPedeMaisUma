import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });

const [{ setRuntimeBindings }, { db, ensureDb, hashPassword }, moderatorRoute, authRoute, playersRoute, matchesRoute] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/moderators/route.ts"),
  import("../app/api/auth/route.ts"),
  import("../app/api/players/route.ts"),
  import("../app/api/admin/matches/route.ts"),
]);

test("administrador promove, configura e reverte moderador com autorização por operação", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-moderator-profile-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), adminId = "moderator-admin", memberId = "moderator-member", playerId = "moderator-player";
    await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(adminId, "admin-moderator@example.com", await hashPassword("senha-admin-123"), 1, 0, now, now).run();
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("moderator-admin-session", adminId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO players (id,full_name,display_name,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(playerId, "Jogador Moderador", "Moderador", "monthly", "Defesa", 3, 3, 3, 1, now, now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,role,active,created_at,updated_at) VALUES (?,?,?,'member',1,?,?)`)
      .bind(memberId, "moderador@example.com", await hashPassword("senha-moderador-123"), now, now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`)
      .bind(playerId, "member", memberId, now).run();

    assert.equal((await moderatorRoute.POST(jsonRequest("POST", { accountId: memberId }))).status, 401);
    const invalidPromotion = await moderatorRoute.POST(jsonRequest("POST", { accountId: memberId, permissions: ["INVALID_PERMISSION"] }, "ppm_session=moderator-admin-session"));
    assert.equal(invalidPromotion.status, 400);
    const definitionsResponse = await moderatorRoute.GET(new Request("https://pelada.example/api/moderators", { headers: { cookie: "ppm_session=moderator-admin-session" } }));
    assert.equal(definitionsResponse.status, 200);
    assert.ok((await definitionsResponse.json()).permissionDefinitions.some(item => item.key === "FINANCE_MANAGE"));
    const promoted = await moderatorRoute.POST(jsonRequest("POST", { accountId: memberId, permissions: ["PLAYERS_MANAGE", "FINANCE_MANAGE"] }, "ppm_session=moderator-admin-session"));
    assert.equal(promoted.status, 201);
    assert.equal(await db().prepare(`SELECT role FROM member_accounts WHERE id=?`).bind(memberId).first("role"), "moderator");
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM moderator_permissions WHERE member_account_id=? AND permission='PLAYERS_MANAGE'`).bind(memberId).first("total"), 1);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM moderator_permissions WHERE member_account_id=? AND permission='FINANCE_MANAGE'`).bind(memberId).first("total"), 1);

    const login = await authRoute.POST(jsonRequest("POST", { email: "moderador@example.com", password: "senha-moderador-123" }));
    assert.equal(login.status, 200);
    assert.equal((await login.clone().json()).admin.role, "moderator");
    assert.deepEqual((await login.json()).admin.permissions, ["FINANCE_MANAGE", "PLAYERS_MANAGE"]);
    const moderatorCookie = (login.headers.get("set-cookie") || "").match(/ppm_member_session=([^;]+)/)?.[1];
    assert.ok(moderatorCookie);
    const cookie = `ppm_member_session=${moderatorCookie}`;

    assert.equal((await playersRoute.GET(new Request("https://pelada.example/api/players", { headers: { cookie } }))).status, 200);
    const createdPlayer = await playersRoute.POST(jsonRequest("POST", {
      displayName: "Criado pelo moderador", fullName: "Criado pelo moderador", type: "guest", primaryPosition: "Ataque",
      speed: 3, skill: 3, marking: 3, tacticalIntelligence: 3, competitiveness: 3,
      goalkeeperPositioning: 3, goalExit: 3, goalkeeperSafety: 3, goalkeeperLeadership: 3, active: true,
    }, cookie, "/api/players"));
    assert.equal(createdPlayer.status, 201);
    assert.equal((await matchesRoute.GET(new Request("https://pelada.example/api/admin/matches", { headers: { cookie } }))).status, 403);
    assert.equal((await moderatorRoute.GET(new Request("https://pelada.example/api/moderators", { headers: { cookie } }))).status, 401);

    const reconfigured = await moderatorRoute.PUT(jsonRequest("PUT", { accountId: memberId, permissions: ["MATCHES_MANAGE"] }, "ppm_session=moderator-admin-session"));
    assert.equal(reconfigured.status, 200);
    const match = await matchesRoute.POST(jsonRequest("POST", {
      title: "Partida do moderador", matchAt: "2099-06-10T12:00:00.000Z", confirmationDeadline: "2099-06-10T11:00:00.000Z", location: "Campo", maxChanges: 2,
    }, cookie, "/api/admin/matches"));
    assert.equal(match.status, 201);
    assert.equal((await playersRoute.GET(new Request("https://pelada.example/api/players", { headers: { cookie } }))).status, 403);

    const reverted = await moderatorRoute.DELETE(new Request(`https://pelada.example/api/moderators?accountId=${memberId}`, { method: "DELETE", headers: { cookie: "ppm_session=moderator-admin-session" } }));
    assert.equal(reverted.status, 200);
    assert.equal(await db().prepare(`SELECT role FROM member_accounts WHERE id=?`).bind(memberId).first("role"), "member");
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM moderator_permissions WHERE member_account_id=?`).bind(memberId).first("total"), 0);
    assert.equal((await matchesRoute.GET(new Request("https://pelada.example/api/admin/matches", { headers: { cookie } }))).status, 403);
    const auditActions = (await db().prepare(`SELECT action FROM audit_logs WHERE entity_id=? ORDER BY created_at`).bind(memberId).all()).results.map(row => row.action);
    assert.ok(auditActions.includes("MEMBER_PROMOTED_TO_MODERATOR"));
    assert.ok(auditActions.includes("MODERATOR_PERMISSIONS_UPDATED"));
    assert.ok(auditActions.includes("MODERATOR_REVERTED_TO_MEMBER"));
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona o perfil comum às contas de jogador existentes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-moderator-migration-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    const now = new Date().toISOString();
    await bindings.DB.prepare(`CREATE TABLE member_accounts (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,player_id TEXT UNIQUE,active INTEGER NOT NULL DEFAULT 1,last_login_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`).run();
    await bindings.DB.prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES ('legacy-member','legacy@example.com','hash',1,?,?)`).bind(now,now).run();
    await ensureDb();
    assert.equal(await db().prepare(`SELECT role FROM member_accounts WHERE id='legacy-member'`).first("role"), "member");
    const columns = await db().prepare(`PRAGMA table_info(member_accounts)`).all();
    assert.ok(columns.results.some(column => column.name === "role"));
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(method, body, cookie = "", path = "/api/moderators") {
  return new Request(`https://pelada.example${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}
