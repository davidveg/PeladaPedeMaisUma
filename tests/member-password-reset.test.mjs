import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb, hashPassword, verifyPassword }, memberPasswordReset] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/member-password-reset/route.ts"),
]);

test("jogador redefine a senha com token único e todas as sessões são revogadas", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-member-reset-"));
  const bindings = await createSelfhostBindings(directory);
  const delivered = [], changed = [];
  setRuntimeBindings({
    ...bindings,
    APP_BASE_URL: "https://pelada.example",
    MAILER: {
      configured: true,
      async sendPasswordReset(message) { delivered.push(message); return { messageId: "reset-message" }; },
      async sendPasswordChanged(message) { changed.push(message); return { messageId: "changed-message" }; },
    },
  });
  try {
    await ensureDb();
    const now = new Date().toISOString(), accountId = "member-reset", oldPassword = "senha-antiga-123", newPassword = "senha-nova-456";
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind(accountId, "jogador@example.com", await hashPassword(oldPassword), 1, now, now).run();
    await db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("member-web-session", accountId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO mobile_sessions (id,account_type,account_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind("member-mobile-session", "member", accountId, "access-hash-reset", "refresh-hash-reset", "2099-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO mobile_push_tokens (id,account_type,account_id,mobile_session_id,expo_push_token,platform,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)`)
      .bind("member-push", "member", accountId, "member-mobile-session", "ExpoPushToken[member-reset]", "android", now, now).run();

    const unknown = await memberPasswordReset.POST(jsonRequest("https://pelada.example/api/member-password-reset", { email: "desconhecido@example.com" }));
    assert.equal(unknown.status, 202);
    assert.equal(delivered.length, 0);

    const requested = await memberPasswordReset.POST(jsonRequest("https://pelada.example/api/member-password-reset", { email: "JOGADOR@example.com" }));
    assert.equal(requested.status, 202);
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].portal, "member");
    assert.match(delivered[0].token, /^[a-f0-9]{64}$/);
    const stored = await db().prepare(`SELECT token_hash FROM member_password_reset_tokens WHERE member_account_id=?`).bind(accountId).first();
    assert.notEqual(stored.token_hash, delivered[0].token);

    const mismatch = await memberPasswordReset.PUT(jsonRequest("https://pelada.example/api/member-password-reset", { token: delivered[0].token, password: newPassword, confirmation: "outra-senha" }, "PUT"));
    assert.equal(mismatch.status, 400);
    const completed = await memberPasswordReset.PUT(jsonRequest("https://pelada.example/api/member-password-reset", { token: delivered[0].token, password: newPassword, confirmation: newPassword }, "PUT"));
    assert.equal(completed.status, 200);
    const account = await db().prepare(`SELECT password_hash FROM member_accounts WHERE id=?`).bind(accountId).first();
    assert.equal(await verifyPassword(newPassword, account.password_hash), true);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM member_sessions WHERE member_account_id=?`).bind(accountId).first("total"), 0);
    assert.ok(await db().prepare(`SELECT revoked_at FROM mobile_sessions WHERE id='member-mobile-session'`).first("revoked_at"));
    assert.equal(await db().prepare(`SELECT active FROM mobile_push_tokens WHERE id='member-push'`).first("active"), 0);
    assert.equal(changed.length, 1);
    assert.equal(changed[0].portal, "member");

    const reused = await memberPasswordReset.PUT(jsonRequest("https://pelada.example/api/member-password-reset", { token: delivered[0].token, password: newPassword, confirmation: newPassword }, "PUT"));
    assert.equal(reused.status, 400);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(url, body, method = "POST") {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
