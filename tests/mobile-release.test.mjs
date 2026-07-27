import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb }, adminRoute, publicRoute, { saveNotificationPreferences }] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/admin/mobile-release/route.ts"),
  import("../app/api/mobile/version/route.ts"),
  import("../lib/notification-preferences.ts"),
]);

test("administrador publica versão, feed e push apontam para a página estável", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-mobile-release-"));
  const bindings = await createSelfhostBindings(directory);
  const originalFetch = globalThis.fetch;
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), expires = new Date(Date.now() + 60_000).toISOString();
    const administratorId = await db().prepare(`SELECT id FROM administrators LIMIT 1`).first("id");
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`).bind("release-admin-session", administratorId, expires, now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind("release-member", "release@example.com", "hash", 1, now, now).run();
    await db().prepare(`INSERT INTO mobile_push_tokens (id,account_type,account_id,expo_push_token,platform,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`).bind("release-push", "member", "release-member", "ExpoPushToken[release]", "android", now, now).run();
    const pushes = [];
    globalThis.fetch = async (_url, options) => {
      pushes.push(JSON.parse(options.body));
      return Response.json({ data: [{ status: "ok", id: "release-ticket" }] });
    };
    const headers = { cookie: "ppm_session=release-admin-session", "content-type": "application/json" };
    const body = {
      latestVersion: "1.1.0", androidBuild: 2, minimumAndroidBuild: 1, androidEnabled: true,
      androidUrl: "https://downloads.example/Pelada.apk", iosBuild: 1, minimumIosBuild: 1,
      iosEnabled: false, iosUrl: "", releaseNotes: "Nova central de atualizações.",
    };
    const response = await adminRoute.POST(new Request("https://pelada.example/api/admin/mobile-release", { method: "POST", headers, body: JSON.stringify(body) }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.release.latestVersion, "1.1.0");
    assert.equal(result.notification.sent, 1);
    const notice = await db().prepare(`SELECT type,action_url FROM account_notifications WHERE account_type='member' AND account_id='release-member'`).first();
    assert.deepEqual({ ...notice }, { type: "APP_RELEASED", action_url: "https://pelada.example/baixar-app" });
    assert.equal(pushes[0][0].channelId, "app-updates");
    assert.deepEqual(pushes[0][0].data, { type: "app_released", actionUrl: "https://pelada.example/baixar-app" });

    const android = await (await publicRoute.GET(new Request("https://pelada.example/api/mobile/version?platform=android"))).json();
    assert.equal(android.latestBuild, 2);
    assert.equal(android.downloadUrl, "https://pelada.example/baixar-app?platform=android");
    assert.equal(android.directDownloadUrl, "https://downloads.example/Pelada.apk");

    await saveNotificationPreferences("member", "release-member", { appUpdatesInApp: false, appUpdatesPush: false });
    const mutedResponse = await adminRoute.POST(new Request("https://pelada.example/api/admin/mobile-release", {
      method: "POST", headers, body: JSON.stringify({ ...body, latestVersion: "1.2.0", androidBuild: 3 }),
    }));
    assert.equal(mutedResponse.status, 200);
    assert.equal(pushes.length, 1);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM account_notifications WHERE account_type='member' AND account_id='release-member'`).first("total"), 1);
  } finally {
    globalThis.fetch = originalFetch;
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
