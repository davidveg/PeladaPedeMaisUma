import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb, hashPassword }, separations, mobile, proposal, publicConfig, instanceConfig] = await Promise.all([
  import("../lib/runtime-bindings.ts"), import("../lib/database.ts"), import("../app/api/separations/route.ts"),
  import("../app/api/mobile/separations/route.ts"), import("../app/api/mobile/separations/proposal/route.ts"),
  import("../app/api/public-config/route.ts"), import("../app/api/instance-config/route.ts"),
]);

test("aposenta criação avulsa sem alterar o histórico nem permitir reativação", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-retired-separation-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), key = "legacy-idempotency-key-123";
    await db().prepare("INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .bind("retirement-admin", "admin@example.com", await hashPassword("test-password-123"), 1, 0, now, now).run();
    await db().prepare("INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)")
      .bind("retirement-session", "retirement-admin", "2099-01-01T00:00:00.000Z", now).run();
    const snapshot = JSON.stringify({ blue: [{ id: "old-blue", displayName: "Antigo Azul" }], yellow: [{ id: "old-yellow", displayName: "Antigo Amarelo" }], rating: "Bom equilíbrio", cost: 1 });
    await db().prepare("INSERT INTO team_separations (id,match_title,match_date,original_text,snapshot,manually_adjusted,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind("legacy", "Pelada antiga", "2025-01-12", "Lista original do WhatsApp", snapshot, 0, 1, "Bom equilíbrio", now, now, now).run();
    await db().prepare("INSERT INTO mobile_idempotency_keys (id,administrator_id,operation,idempotency_key,status_code,response_json,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind("legacy-key", "retirement-admin", "CREATE_SEPARATION", key, 201, JSON.stringify({ id: "legacy" }), now).run();
    const before = await db().prepare("SELECT * FROM team_separations ORDER BY id").all();
    await db().prepare("UPDATE instance_configuration SET manual_separation_enabled=1,separation_drafts_enabled=1 WHERE id=1").run();
    const request = (path, method = "GET", body, authenticated = true) => new Request(`https://pelada.example${path}`, {
      method, headers: { "content-type": "application/json", "idempotency-key": key, ...(authenticated ? { cookie: "ppm_session=retirement-session" } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const [handler, path, body] of [
      [separations.POST, "/api/separations", { title: "Nova avulsa", result: JSON.parse(snapshot) }],
      [mobile.POST, "/api/mobile/separations", { title: "Nova avulsa", result: JSON.parse(snapshot) }],
      [proposal.POST, "/api/mobile/separations/proposal", { originalText: "PELADA\n1 - Jogador: ✅" }],
      [proposal.POST, "/api/mobile/separations/proposal", { playerIds: ["a", "b", "c", "d"] }],
      [proposal.POST, "/api/mobile/separations/proposal", { matchId: "  " }],
      [proposal.POST, "/api/mobile/separations/proposal", { matchId: 123 }],
      [proposal.POST, "/api/mobile/separations/proposal", null],
    ]) {
      const blocked = await handler(request(path, "POST", body));
      assert.equal(blocked.status, 410, path);
      assert.equal((await blocked.json()).code, "STANDALONE_SEPARATION_REMOVED");
      assert.equal(blocked.headers.get("x-idempotent-replay"), null);
      assert.equal((await handler(request(path, "POST", body, false))).status, 401);
    }
    assert.deepEqual(await db().prepare("SELECT * FROM team_separations ORDER BY id").all(), before);
    assert.equal(await db().prepare("SELECT COUNT(*) total FROM scheduled_matches").first("total"), 0);
    assert.equal(await db().prepare("SELECT COUNT(*) total FROM match_separation_drafts").first("total"), 0);

    for (const handler of [publicConfig.GET, instanceConfig.GET]) {
      const response = await handler(request(handler === publicConfig.GET ? "/api/public-config" : "/api/instance-config"));
      const payload = await response.json(), config = payload.instance || payload.config;
      assert.equal(config.manualSeparationEnabled, false);
      assert.equal(config.separationDraftsEnabled, true);
      if (handler === instanceConfig.GET) {
        const saved = await instanceConfig.PUT(request("/api/instance-config", "PUT", { ...config, manualSeparationEnabled: true }));
        assert.equal(saved.status, 200);
        assert.equal((await saved.json()).config.manualSeparationEnabled, false);
      }
    }
    assert.equal(await db().prepare("SELECT manual_separation_enabled FROM instance_configuration WHERE id=1").first("manual_separation_enabled"), 0);
    for (const [handler, path] of [[separations.GET, "/api/separations?id=legacy"], [mobile.GET, "/api/mobile/separations?id=legacy"]]) {
      const response = await handler(request(path));
      assert.equal(response.status, 200);
      const historical = (await response.json()).separations[0];
      assert.equal(historical.id, "legacy");
      assert.equal(historical.matchTitle, "Pelada antiga");
      assert.equal(historical.snapshot.blue[0].displayName, "Antigo Azul");
      assert.equal(historical.originalText, undefined);
    }
    // Editing existing data remains supported, even without a scheduled match.
    const arrivalOrder = { blue: ["old-blue"], yellow: ["old-yellow"] };
    for (const handler of [separations.PATCH, mobile.PATCH]) {
      const edited = await handler(request("/api/separations", "PATCH", { id: "legacy", arrivalOrder }));
      assert.equal(edited.status, 200);
      assert.deepEqual((await edited.json()).arrivalOrder, arrivalOrder);
    }
    const stored = await db().prepare("SELECT original_text,snapshot FROM team_separations WHERE id='legacy'").first();
    assert.equal(stored.snapshot, snapshot);
    assert.equal(stored.original_text, "Lista original do WhatsApp");
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("interfaces não oferecem importação nem ativação da criação avulsa", async () => {
  for (const path of ["app/FootballApp.tsx", "app/admin/AdminApp.tsx", "app/partidas/MatchHubApp.tsx", "mobile/app/(app)/new-separation.tsx", "mobile/app/(app)/_layout.tsx"]) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /manualSeparationEnabled|parseWhatsApp|matchPlayers|view=import|Lista copiada do WhatsApp|originalText/, path);
  }
  const home = await readFile(new URL("../app/HomeApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /params\.get\("view"\)/);
  assert.match(home, /params\.get\("matchId"\)/);
});
