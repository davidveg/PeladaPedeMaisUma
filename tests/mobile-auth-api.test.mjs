import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb, hashPassword }, mobileAuth, mobileConfig, mobileSeparations] = await Promise.all([
  import("../lib/runtime-bindings.ts"), import("../lib/database.ts"), import("../app/api/mobile/auth/route.ts"), import("../app/api/mobile/config/route.ts"), import("../app/api/mobile/separations/route.ts"),
]);

test("sessão mobile rotativa aplica papel administrativo no servidor", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-mobile-auth-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const password = "senha-segura-123", now = new Date().toISOString(), adminId = "admin-mobile-test", memberId = "member-mobile-test";
    await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(adminId, "admin-mobile@example.com", await hashPassword(password), 1, 0, now, now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(memberId, "member-mobile@example.com", await hashPassword(password), 1, now, now).run();

    const adminLogin = await mobileAuth.POST(jsonRequest("https://pelada.example/api/mobile/auth", "POST", { email: "admin-mobile@example.com", password, deviceName: "Teste" }));
    assert.equal(adminLogin.status, 201);
    const adminSession = await adminLogin.json();
    assert.equal(adminSession.account.role, "admin");
    assert.ok(adminSession.accessToken && adminSession.refreshToken);

    const config = await mobileConfig.GET(authorized("https://pelada.example/api/mobile/config", adminSession.accessToken));
    assert.equal(config.status, 200);

    const key = "00000000-0000-4000-8000-000000000001", separationBody = { title: "Teste mobile", originalText: "lista", result: { blue: [{ id: "b1" }], yellow: [{ id: "y1" }], cost: 1, rating: "Bom equilíbrio" } };
    const created = await mobileSeparations.POST(authorizedJson("https://pelada.example/api/mobile/separations", adminSession.accessToken, separationBody, key));
    const replayed = await mobileSeparations.POST(authorizedJson("https://pelada.example/api/mobile/separations", adminSession.accessToken, separationBody, key));
    assert.equal(created.status, 201);
    assert.equal(replayed.headers.get("x-idempotent-replay"), "true");
    assert.equal((await created.json()).id, (await replayed.json()).id);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM team_separations WHERE match_title='Teste mobile'`).first("total"), 1);

    const memberLogin = await mobileAuth.POST(jsonRequest("https://pelada.example/api/mobile/auth", "POST", { email: "member-mobile@example.com", password }));
    const memberSession = await memberLogin.json();
    const forbidden = await mobileConfig.GET(authorized("https://pelada.example/api/mobile/config", memberSession.accessToken));
    assert.equal(forbidden.status, 401);

    const refreshed = await mobileAuth.PUT(jsonRequest("https://pelada.example/api/mobile/auth", "PUT", { refreshToken: adminSession.refreshToken }));
    assert.equal(refreshed.status, 200);
    const rotated = await refreshed.json();
    assert.notEqual(rotated.refreshToken, adminSession.refreshToken);

    const reused = await mobileAuth.PUT(jsonRequest("https://pelada.example/api/mobile/auth", "PUT", { refreshToken: adminSession.refreshToken }));
    assert.equal(reused.status, 401);
    const revoked = await mobileConfig.GET(authorized("https://pelada.example/api/mobile/config", rotated.accessToken));
    assert.equal(revoked.status, 401);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(url, method, body) { return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
function authorized(url, token) { return new Request(url, { headers: { authorization: `Bearer ${token}` } }); }
function authorizedJson(url, token, body, key) { return new Request(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) }); }
