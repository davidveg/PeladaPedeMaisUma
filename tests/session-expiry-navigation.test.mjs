import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb }, memberAuth, adminAuth, navigation] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/member-auth/route.ts"),
  import("../app/api/auth/route.ts"),
  import("../lib/site-navigation.ts"),
]);

test("rotas protegidas preservam o destino e rejeitam retornos externos", () => {
  assert.equal(navigation.isAccountProtectedPath("/partidas#proxima"), true);
  assert.equal(navigation.isAccountProtectedPath("/notificacoes?page=2"), true);
  assert.equal(navigation.isAccountProtectedPath("/jogadores"), false);
  assert.equal(navigation.accountSignInHref("/partidas#proxima", true), "/conta?returnTo=%2Fpartidas%23proxima&reason=session-expired");
  assert.equal(navigation.safeSiteReturnTo("https://malicioso.example"), "");
  assert.equal(navigation.safeSiteReturnTo("//malicioso.example"), "");
  assert.equal(navigation.safeSiteReturnTo("/partidas?filtro=abertas#jogo"), "/partidas?filtro=abertas#jogo");
});

test("sessões web expiradas são invalidadas sem permitir cache da autenticação", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-expired-session-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), expired = new Date(Date.now() - 60_000).toISOString();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind("expired-member", "expired-member@example.com", "hash", 1, now, now).run();
    await db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("expired-member-session", "expired-member", expired, now).run();
    const seededAdmin = await db().prepare(`SELECT id FROM administrators LIMIT 1`).first();
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("expired-admin-session", seededAdmin.id, expired, now).run();

    const memberResponse = await memberAuth.GET(new Request("https://pelada.example/api/member-auth", {
      headers: { cookie: "ppm_member_session=expired-member-session; ppm_session=expired-admin-session" },
    }));
    assert.deepEqual(await memberResponse.json(), { member: null });
    assert.match(memberResponse.headers.get("cache-control") || "", /no-store/);
    assert.match(memberResponse.headers.get("set-cookie") || "", /ppm_member_session=.*Max-Age=0/);
    assert.match(memberResponse.headers.get("set-cookie") || "", /ppm_session=.*Max-Age=0/);

    const adminResponse = await adminAuth.GET(new Request("https://pelada.example/api/auth", {
      headers: { cookie: "ppm_session=expired-admin-session" },
    }));
    assert.deepEqual(await adminResponse.json(), { admin: null });
    assert.match(adminResponse.headers.get("cache-control") || "", /no-store/);
    assert.match(adminResponse.headers.get("set-cookie") || "", /ppm_session=.*Max-Age=0/);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
