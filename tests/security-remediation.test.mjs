import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });

const [runtime, database, authRoute, memberAuthRoute, mobileAuthRoute, administratorsRoute, playersRoute, instanceConfigRoute, separationsRoute, memberPlayersRoute, associationsRoute] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/auth/route.ts"),
  import("../app/api/member-auth/route.ts"),
  import("../app/api/mobile/auth/route.ts"),
  import("../app/api/administrators/route.ts"),
  import("../app/api/players/route.ts"),
  import("../app/api/instance-config/route.ts"),
  import("../app/api/separations/route.ts"),
  import("../app/api/member-players/route.ts"),
  import("../app/api/member-associations/route.ts"),
]);

const { setRuntimeBindings } = runtime;
const { adminRequired, db, ensureDb, hashOpaqueToken, hashPassword, staffRequired } = database;

test("administrador com troca pendente não acessa rotas privilegiadas antes do primeiro acesso", async () => {
  await withDatabase("ppm-first-access-gate-", async () => {
    const administrator = await db().prepare(`SELECT id FROM administrators WHERE email='admin'`).first();
    const now = new Date().toISOString();
    await db().batch([
      db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("pending-admin-session", administrator.id, "2099-01-01T00:00:00.000Z", now),
      db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("stolen-bootstrap-session", administrator.id, "2099-01-01T00:00:00.000Z", now),
      db().prepare(`INSERT INTO mobile_sessions (id,account_type,account_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .bind("pending-mobile-session", "administrator", administrator.id, "pending-access-hash", "pending-refresh-hash", "2099-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z", now),
    ]);
    const request = cookieRequest("https://pelada.example/api/administrators", "ppm_session=pending-admin-session");

    assert.ok(await database.currentAdmin(request), "a sessão precisa continuar visível para o fluxo de primeiro acesso");
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM sessions WHERE id=?`).bind("pending-admin-session").first("total"), 0, "sessões legadas devem migrar para hash no primeiro uso");
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM sessions WHERE id=?`).bind(await hashOpaqueToken("pending-admin-session")).first("total"), 1);
    assert.equal(await adminRequired(request), null);
    assert.equal(await staffRequired(request, "PLAYERS_MANAGE"), null);
    assert.equal((await authRoute.GET(cookieRequest("https://pelada.example/api/auth", "ppm_session=pending-admin-session"))).status, 200);
    assert.equal((await administratorsRoute.GET(request)).status, 401);
    assert.equal((await playersRoute.POST(jsonRequest("https://pelada.example/api/players", {}, "ppm_session=pending-admin-session"))).status, 403);
    assert.equal((await instanceConfigRoute.GET(cookieRequest("https://pelada.example/api/instance-config", "ppm_session=pending-admin-session"))).status, 401);
    assert.equal((await separationsRoute.PATCH(jsonRequest("https://pelada.example/api/separations", { action: "correct-confirmed-teams", id: "any" }, "ppm_session=pending-admin-session"))).status, 401);

    const completion = await authRoute.PUT(jsonRequest("https://pelada.example/api/auth", { email: "owner@example.com", password: "senha-segura-123" }, "ppm_session=pending-admin-session"));
    assert.equal(completion.status, 200);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM sessions WHERE administrator_id=?`).bind(administrator.id).first("total"), 1);
    assert.equal(await database.currentAdmin(cookieRequest("https://pelada.example/api/auth", "ppm_session=stolen-bootstrap-session")), null);
    assert.ok(await db().prepare(`SELECT revoked_at FROM mobile_sessions WHERE id='pending-mobile-session'`).first("revoked_at"));
    assert.ok(await adminRequired(request));
    assert.equal((await administratorsRoute.GET(request)).status, 200);

    const login = await authRoute.POST(loginRequest("https://pelada.example/api/auth", "owner@example.com", "senha-segura-123", "198.51.100.20"));
    assert.equal(login.status, 200);
    const setCookie = login.headers.get("set-cookie");
    assert.match(setCookie, /; Secure;/);
    const rawToken = /ppm_session=([^;]+)/.exec(setCookie)?.[1];
    assert.ok(rawToken);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM sessions WHERE id=?`).bind(rawToken).first("total"), 0);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM sessions WHERE id=?`).bind(await hashOpaqueToken(rawToken)).first("total"), 1);
  });
});

test("sessão de membro usa cookie Secure e persiste apenas o hash do token", async () => {
  await withDatabase("ppm-member-session-hash-", async () => {
    const registration = await memberAuthRoute.PUT(jsonRequest("https://pelada.example/api/member-auth", {
      email: "novo-membro@example.com",
      password: "senha-member-123",
      confirmation: "senha-member-123",
    }));
    assert.equal(registration.status, 201);
    const setCookie = registration.headers.get("set-cookie");
    assert.match(setCookie, /; Secure;/);
    const rawToken = /ppm_member_session=([^;]+)/.exec(setCookie)?.[1];
    assert.ok(rawToken);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM member_sessions WHERE id=?`).bind(rawToken).first("total"), 0);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM member_sessions WHERE id=?`).bind(await hashOpaqueToken(rawToken)).first("total"), 1);
  });
});

test("endpoints que emitem cookie recusam autenticação por HTTP fora do localhost", async () => {
  assert.equal((await authRoute.POST(loginRequest("http://pelada.example/api/auth", "admin", "admin", "198.51.100.40"))).status, 426);
  assert.equal((await memberAuthRoute.POST(loginRequest("http://pelada.example/api/member-auth", "member@example.com", "senha-member-123", "198.51.100.41"))).status, 426);
  assert.equal((await memberAuthRoute.PUT(jsonRequest("http://pelada.example/api/member-auth", { email: "member@example.com", password: "senha-member-123", confirmation: "senha-member-123" }))).status, 426);
});

test("logins web, membro e mobile são bloqueados após cinco falhas por conta", async () => {
  await withDatabase("ppm-login-rate-limit-", async () => {
    const cases = [
      [authRoute, "https://pelada.example/api/auth", "admin-inexistente@example.com", "198.51.100.31"],
      [memberAuthRoute, "https://pelada.example/api/member-auth", "membro-inexistente@example.com", "198.51.100.32"],
      [mobileAuthRoute, "https://pelada.example/api/mobile/auth", "mobile-inexistente@example.com", "198.51.100.33"],
    ];
    for (const [route, url, email, ip] of cases) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal((await route.POST(loginRequest(url, email, "senha-incorreta", ip))).status, 401);
      }
      const blocked = await route.POST(loginRequest(url, email, "senha-incorreta", ip));
      assert.equal(blocked.status, 429);
      assert.match(blocked.headers.get("cache-control"), /no-store/);
      assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    }
  });
});

test("conta comum não enumera nem reivindica jogador; administrador aprova o vínculo", async () => {
  await withDatabase("ppm-admin-association-", async () => {
    const now = new Date().toISOString(), adminId = "association-admin", memberId = "association-member", otherMemberId = "association-member-2", playerId = "association-player";
    await db().batch([
      db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(adminId, "association-admin@example.com", await hashPassword("senha-admin-123"), 1, 0, now, now),
      db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("association-admin-session", adminId, "2099-01-01T00:00:00.000Z", now),
      db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(memberId, "member@example.com", await hashPassword("senha-member-123"), 1, now, now),
      db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(otherMemberId, "other@example.com", await hashPassword("senha-other-123"), 1, now, now),
      db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("association-member-session", memberId, "2099-01-01T00:00:00.000Z", now),
      db().prepare(`INSERT INTO players (id,full_name,display_name,type,primary_position,speed,skill,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(playerId, "Jogador Protegido", "Protegido", "monthly", "Defesa", 3, 3, 1, now, now),
    ]);

    const memberCookie = "ppm_member_session=association-member-session";
    assert.equal((await memberPlayersRoute.GET(cookieRequest("https://pelada.example/api/member-players", memberCookie))).status, 403);
    assert.equal((await memberPlayersRoute.POST(jsonRequest("https://pelada.example/api/member-players", { playerId }, memberCookie))).status, 403);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM player_account_links WHERE player_id=?`).bind(playerId).first("total"), 0);

    const association = { accountId: memberId, accountType: "member", playerId };
    assert.equal((await associationsRoute.PUT(jsonRequest("https://pelada.example/api/member-associations", association))).status, 401);
    const approved = await associationsRoute.PUT(jsonRequest("https://pelada.example/api/member-associations", association, "ppm_session=association-admin-session"));
    assert.equal(approved.status, 200);
    assert.deepEqual(
      { ...(await db().prepare(`SELECT player_id,account_type,account_id FROM player_account_links WHERE player_id=?`).bind(playerId).first()) },
      { player_id: playerId, account_type: "member", account_id: memberId },
    );
    const event = await db().prepare(`SELECT administrator_id,action,entity_id,new_data FROM audit_logs WHERE action='MEMBER_ASSOCIATE' ORDER BY created_at DESC`).first();
    assert.equal(event.administrator_id, adminId);
    assert.equal(event.entity_id, memberId);
    assert.equal(JSON.parse(event.new_data).approvedBy, adminId);

    const duplicate = await associationsRoute.PUT(jsonRequest("https://pelada.example/api/member-associations", { ...association, accountId: otherMemberId }, "ppm_session=association-admin-session"));
    assert.equal(duplicate.status, 409);
    const listing = await associationsRoute.GET(cookieRequest("https://pelada.example/api/member-associations", "ppm_session=association-admin-session"));
    assert.equal(listing.status, 200);
    assert.equal((await listing.json()).availablePlayers.some((player) => player.id === playerId), false);
  });
});

async function withDatabase(prefix, callback) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    await callback();
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
}

function cookieRequest(url, cookie) {
  return new Request(url, { headers: { cookie } });
}

function jsonRequest(url, body, cookie = "") {
  return new Request(url, { method: "PUT", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}

function loginRequest(url, email, password, ip) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password }),
  });
}
