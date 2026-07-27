import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb }, { GET }, preferencesRoute] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/notifications/route.ts"),
  import("../app/api/notification-preferences/route.ts"),
]);

test("feed de notificações pagina no servidor e respeita o tamanho salvo pela conta", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-notification-page-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), expires = new Date(Date.now() + 60_000).toISOString();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind("page-member", "page-member@example.com", "hash", 1, now, now).run();
    await db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("page-session", "page-member", expires, now).run();
    for (let index = 0; index < 23; index += 1) {
      await db().prepare(`INSERT INTO account_notifications (id,account_type,account_id,type,title,body,created_at) VALUES (?,?,?,?,?,?,?)`)
        .bind(`page-notice-${index}`, "member", "page-member", "MATCH_CREATED", `Aviso ${index}`, "Conteúdo", new Date(Date.now() + index).toISOString()).run();
    }
    const headers = { cookie: "ppm_member_session=page-session" };
    const second = await (await GET(new Request("https://pelada.example/api/notifications?page=2", { headers }))).json();
    assert.deepEqual(
      { total: second.total, page: second.page, pageSize: second.pageSize, totalPages: second.totalPages, count: second.notifications.length },
      { total: 23, page: 2, pageSize: 10, totalPages: 3, count: 10 },
    );
    assert.equal(second.hasPrevious, true);
    assert.equal(second.hasNext, true);

    const savedResponse = await preferencesRoute.PUT(new Request("https://pelada.example/api/notification-preferences", {
      method: "PUT", headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ pageSize: 20, matchesInApp: false, matchesPush: false }),
    }));
    assert.equal(savedResponse.status, 200);
    const savedPreferences = await (await preferencesRoute.GET(new Request("https://pelada.example/api/notification-preferences", { headers }))).json();
    assert.equal(savedPreferences.preferences.pageSize, 20);
    assert.equal(savedPreferences.preferences.matchesInApp, false);
    assert.equal(savedPreferences.preferences.matchesPush, false);
    const savedDefault = await (await GET(new Request("https://pelada.example/api/notifications", { headers }))).json();
    assert.equal(savedDefault.pageSize, 20);
    assert.equal(savedDefault.notifications.length, 20);

    const overridden = await (await GET(new Request("https://pelada.example/api/notifications?pageSize=50", { headers }))).json();
    assert.equal(overridden.pageSize, 50);
    assert.equal(overridden.notifications.length, 23);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
