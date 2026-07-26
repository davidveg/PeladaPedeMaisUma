import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb, hashPassword, verifyPassword }, resetRoute] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/member-associations/password/route.ts"),
]);

test("administrador redefine senha do jogador e revoga todas as sessões", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-admin-member-reset-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), adminId = "reset-admin", memberId = "reset-member", temporaryPassword = "temporaria-987";
    await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(adminId, "admin-reset@example.com", await hashPassword("senha-admin-123"), 1, 0, now, now).run();
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("reset-admin-session", adminId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind(memberId, "jogador-reset@example.com", await hashPassword("senha-antiga-123"), 1, now, now).run();
    await db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("reset-member-web", memberId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO mobile_sessions (id,account_type,account_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind("reset-member-mobile", "member", memberId, "admin-reset-access", "admin-reset-refresh", "2099-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO mobile_push_tokens (id,account_type,account_id,mobile_session_id,expo_push_token,platform,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)`)
      .bind("reset-member-push", "member", memberId, "reset-member-mobile", "ExpoPushToken[admin-member-reset]", "android", now, now).run();

    const body = { accountId: memberId, password: temporaryPassword, confirmation: temporaryPassword };
    const unauthenticated = await resetRoute.PUT(jsonRequest("https://pelada.example/api/member-associations/password", body));
    assert.equal(unauthenticated.status, 401);
    const reset = await resetRoute.PUT(jsonRequest("https://pelada.example/api/member-associations/password", body, "ppm_session=reset-admin-session"));
    assert.equal(reset.status, 200);
    const member = await db().prepare(`SELECT password_hash FROM member_accounts WHERE id=?`).bind(memberId).first();
    assert.equal(await verifyPassword(temporaryPassword, member.password_hash), true);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM member_sessions WHERE member_account_id=?`).bind(memberId).first("total"), 0);
    assert.ok(await db().prepare(`SELECT revoked_at FROM mobile_sessions WHERE id='reset-member-mobile'`).first("revoked_at"));
    assert.equal(await db().prepare(`SELECT active FROM mobile_push_tokens WHERE id='reset-member-push'`).first("active"), 0);
    const event = await db().prepare(`SELECT administrator_id,action,entity_id FROM audit_logs WHERE action='ADMIN_MEMBER_PASSWORD_RESET'`).first();
    assert.deepEqual({ ...event }, { administrator_id: adminId, action: "ADMIN_MEMBER_PASSWORD_RESET", entity_id: memberId });
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(url, body, cookie = "") {
  return new Request(url, { method: "PUT", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}
