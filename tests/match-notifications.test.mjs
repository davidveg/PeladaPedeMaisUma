import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb }, { broadcastAccountNotification }] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../lib/account-notifications.ts"),
]);

test("evento de partida cria aviso interno e envia push com link para a partida", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-match-notification-"));
  const bindings = await createSelfhostBindings(directory);
  const originalFetch = globalThis.fetch;
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind("notice-member", "notice-member@example.com", "hash", 1, now, now).run();
    await db().prepare(`INSERT INTO mobile_push_tokens (id,account_type,account_id,mobile_session_id,expo_push_token,platform,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)`)
      .bind("notice-token", "member", "notice-member", "notice-session", "ExpoPushToken[match-notice]", "android", now, now).run();
    const requests = [];
    globalThis.fetch = async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return Response.json({ data: [{ status: "ok", id: "match-ticket" }] });
    };

    const result = await broadcastAccountNotification({
      type: "MATCH_CREATED", title: "Nova partida criada",
      body: "Pelada de domingo: confirme sua presença.", matchId: "scheduled-match-1",
    });
    assert.equal(result.sent, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0][0].channelId, "matches");
    assert.deepEqual(requests[0][0].data, { type: "match_created", matchId: "scheduled-match-1" });
    const internal = await db().prepare(`SELECT type,title,match_id,read_at FROM account_notifications WHERE account_type='member' AND account_id='notice-member'`).first();
    assert.deepEqual({ ...internal }, { type: "MATCH_CREATED", title: "Nova partida criada", match_id: "scheduled-match-1", read_at: null });
    const delivery = await db().prepare(`SELECT status,ticket_id FROM notification_push_deliveries WHERE push_token_id='notice-token'`).first();
    assert.deepEqual({ ...delivery }, { status: "SENT", ticket_id: "match-ticket" });
  } finally {
    globalThis.fetch = originalFetch;
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
