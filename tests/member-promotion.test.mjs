import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb, hashPassword, verifyPassword }, promotionRoute, demotionRoute, associationsRoute, authRoute, memberAuthRoute] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/member-associations/promote/route.ts"),
  import("../app/api/member-associations/demote/route.ts"),
  import("../app/api/member-associations/route.ts"),
  import("../app/api/auth/route.ts"),
  import("../app/api/member-auth/route.ts"),
]);

test("administrador promove conta de jogador preservando credenciais, associação e dados da conta", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-member-promotion-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), administratorId = "promotion-admin", memberId = "promoted-member", playerId = "promoted-player";
    const password = "senha-jogador-123", passwordHash = await hashPassword(password);
    await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(administratorId, "admin-promotion@example.com", await hashPassword("senha-admin-123"), 1, 0, now, now).run();
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("promotion-admin-session", administratorId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO players (id,full_name,display_name,type,primary_position,speed,skill,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(playerId, "Jogador Promovido", "Promovido", "monthly", "Defesa", 3, 3, 1, now, now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,last_login_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(memberId, "jogador-promotion@example.com", passwordHash, 1, now, now, now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`)
      .bind(playerId, "member", memberId, now).run();
    await db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("promoted-member-web", memberId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO mobile_sessions (id,account_type,account_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind("promoted-member-mobile", "member", memberId, "promotion-access", "promotion-refresh", "2099-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO mobile_push_tokens (id,account_type,account_id,mobile_session_id,expo_push_token,platform,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)`)
      .bind("promoted-member-push", "member", memberId, "promoted-member-mobile", "ExpoPushToken[member-promotion]", "android", now, now).run();
    await db().prepare(`INSERT INTO account_notifications (id,account_type,account_id,type,title,body,created_at) VALUES (?,?,?,?,?,?,?)`)
      .bind("promoted-notification", "member", memberId, "MATCH_CREATED", "Partida", "Nova partida", now).run();
    await db().prepare(`INSERT INTO account_notification_preferences (id,account_type,account_id,created_at,updated_at) VALUES (?,?,?,?,?)`)
      .bind("promoted-preferences", "member", memberId, now, now).run();
    await db().prepare(`INSERT INTO career_votes (id,career_match_id,voter_player_id,motm_third_id,motm_second_id,motm_first_id,dotm_third_id,dotm_second_id,dotm_first_id,created_at,voter_account_type,voter_account_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("promoted-vote", "match-one", playerId, "p2", "p3", "p4", "p5", "p6", "p7", now, "member", memberId).run();

    const unauthenticated = await promotionRoute.POST(jsonRequest({ accountId: memberId }));
    assert.equal(unauthenticated.status, 401);
    const response = await promotionRoute.POST(jsonRequest({ accountId: memberId }, "ppm_session=promotion-admin-session"));
    assert.equal(response.status, 200);

    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM member_accounts WHERE id=?`).bind(memberId).first("total"), 0);
    const promoted = await db().prepare(`SELECT email,password_hash,active,must_change_password,promoted_from_member,created_at FROM administrators WHERE id=?`).bind(memberId).first();
    assert.equal(promoted.email, "jogador-promotion@example.com");
    assert.equal(await verifyPassword(password, promoted.password_hash), true);
    assert.equal(promoted.active, 1);
    assert.equal(promoted.must_change_password, 0);
    assert.equal(promoted.promoted_from_member, 1);
    assert.equal(promoted.created_at, now);
    assert.deepEqual(
      { ...(await db().prepare(`SELECT player_id,account_type,account_id FROM player_account_links WHERE player_id=?`).bind(playerId).first()) },
      { player_id: playerId, account_type: "administrator", account_id: memberId },
    );
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM member_sessions WHERE member_account_id=?`).bind(memberId).first("total"), 0);
    assert.equal(await db().prepare(`SELECT account_type FROM mobile_sessions WHERE id='promoted-member-mobile'`).first("account_type"), "administrator");
    assert.equal(await db().prepare(`SELECT account_type FROM mobile_push_tokens WHERE id='promoted-member-push'`).first("account_type"), "administrator");
    assert.equal(await db().prepare(`SELECT account_type FROM account_notifications WHERE id='promoted-notification'`).first("account_type"), "administrator");
    assert.equal(await db().prepare(`SELECT account_type FROM account_notification_preferences WHERE id='promoted-preferences'`).first("account_type"), "administrator");
    assert.equal(await db().prepare(`SELECT voter_account_type FROM career_votes WHERE id='promoted-vote'`).first("voter_account_type"), "administrator");

    const login = await authRoute.POST(new Request("https://pelada.example/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "jogador-promotion@example.com", password }),
    }));
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie") || "", /ppm_session=/);
    const event = await db().prepare(`SELECT administrator_id,action,entity_type,entity_id FROM audit_logs WHERE action='MEMBER_PROMOTED_TO_ADMIN'`).first();
    assert.deepEqual({ ...event }, { administrator_id: administratorId, action: "MEMBER_PROMOTED_TO_ADMIN", entity_type: "administrator", entity_id: memberId });

    const associations = await associationsRoute.GET(new Request("https://pelada.example/api/member-associations", { headers: { cookie: "ppm_session=promotion-admin-session" } }));
    assert.equal(associations.status, 200);
    const promotedAssociation = (await associations.json()).associations.find((item) => item.id === memberId);
    assert.equal(promotedAssociation.canDemote, true);
    assert.equal(promotedAssociation.promotedFromMember, true);

    assert.equal((await demotionRoute.POST(demotionRequest({ accountId: memberId }))).status, 401);
    const directAdministratorAttempt = await demotionRoute.POST(demotionRequest({ accountId: administratorId }, "ppm_session=promotion-admin-session"));
    assert.equal(directAdministratorAttempt.status, 403);

    const promotedSessionId = (login.headers.get("set-cookie") || "").match(/ppm_session=([^;]+)/)?.[1];
    assert.ok(promotedSessionId);
    await db().prepare(`UPDATE administrators SET active=0 WHERE id<>?`).bind(memberId).run();
    const lastActiveAttempt = await demotionRoute.POST(demotionRequest({ accountId: memberId }, `ppm_session=${promotedSessionId}`));
    assert.equal(lastActiveAttempt.status, 400);
    await db().prepare(`UPDATE administrators SET active=1 WHERE id=?`).bind(administratorId).run();

    const demotion = await demotionRoute.POST(demotionRequest({ accountId: memberId }, "ppm_session=promotion-admin-session"));
    assert.equal(demotion.status, 200);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM administrators WHERE id=?`).bind(memberId).first("total"), 0);
    const restored = await db().prepare(`SELECT email,password_hash,active,created_at FROM member_accounts WHERE id=?`).bind(memberId).first();
    assert.equal(restored.email, "jogador-promotion@example.com");
    assert.equal(await verifyPassword(password, restored.password_hash), true);
    assert.equal(restored.active, 1);
    assert.equal(restored.created_at, now);
    assert.deepEqual(
      { ...(await db().prepare(`SELECT player_id,account_type,account_id FROM player_account_links WHERE player_id=?`).bind(playerId).first()) },
      { player_id: playerId, account_type: "member", account_id: memberId },
    );
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM sessions WHERE administrator_id=?`).bind(memberId).first("total"), 0);
    assert.equal(await db().prepare(`SELECT account_type FROM mobile_sessions WHERE id='promoted-member-mobile'`).first("account_type"), "member");
    assert.equal(await db().prepare(`SELECT account_type FROM mobile_push_tokens WHERE id='promoted-member-push'`).first("account_type"), "member");
    assert.equal(await db().prepare(`SELECT account_type FROM account_notifications WHERE id='promoted-notification'`).first("account_type"), "member");
    assert.equal(await db().prepare(`SELECT account_type FROM account_notification_preferences WHERE id='promoted-preferences'`).first("account_type"), "member");
    assert.equal(await db().prepare(`SELECT voter_account_type FROM career_votes WHERE id='promoted-vote'`).first("voter_account_type"), "member");

    const memberLogin = await memberAuthRoute.POST(new Request("https://pelada.example/api/member-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "jogador-promotion@example.com", password }),
    }));
    assert.equal(memberLogin.status, 200);
    assert.match(memberLogin.headers.get("set-cookie") || "", /ppm_member_session=/);
    const demotionEvent = await db().prepare(`SELECT administrator_id,action,entity_type,entity_id FROM audit_logs WHERE action='ADMIN_REVERTED_TO_MEMBER'`).first();
    assert.deepEqual({ ...demotionEvent }, { administrator_id: administratorId, action: "ADMIN_REVERTED_TO_MEMBER", entity_type: "member_account", entity_id: memberId });
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração identifica promoções antigas sem liberar administradores cadastrados diretamente", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-promoted-admin-migration-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    const now = new Date().toISOString();
    await bindings.DB.prepare(`CREATE TABLE administrators (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
    await bindings.DB.prepare(`CREATE TABLE audit_logs (id TEXT PRIMARY KEY, administrator_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, previous_data TEXT, new_data TEXT, created_at TEXT NOT NULL)`).run();
    await bindings.DB.prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES ('direct','direct@example.com','hash',1,0,?,?)`).bind(now, now).run();
    await bindings.DB.prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES ('legacy-promoted','promoted@example.com','hash',1,0,?,?)`).bind(now, now).run();
    await bindings.DB.prepare(`INSERT INTO audit_logs (id,administrator_id,action,entity_type,entity_id,created_at) VALUES ('promotion-log','direct','MEMBER_PROMOTED_TO_ADMIN','administrator','legacy-promoted',?)`).bind(now).run();

    await ensureDb();
    assert.equal(await db().prepare(`SELECT promoted_from_member FROM administrators WHERE id='direct'`).first("promoted_from_member"), 0);
    assert.equal(await db().prepare(`SELECT promoted_from_member FROM administrators WHERE id='legacy-promoted'`).first("promoted_from_member"), 1);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(body, cookie = "") {
  return new Request("https://pelada.example/api/member-associations/promote", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function demotionRequest(body, cookie = "") {
  return new Request("https://pelada.example/api/member-associations/demote", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}
