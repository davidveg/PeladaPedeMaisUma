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
    const isolatedDeletion = await separations.DELETE(request("/api/separations?id=legacy", "DELETE"));
    assert.equal(isolatedDeletion.status, 410);
    assert.match((await isolatedDeletion.json()).error, /histórico agora pertence à partida/i);
    assert.equal(await db().prepare("SELECT deleted_at FROM team_separations WHERE id='legacy'").first("deleted_at"), null);
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

    await db().batch([
      db().prepare("INSERT INTO team_separations (id,match_title,match_date,original_text,snapshot,manually_adjusted,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES ('linked-delete','Partida vinculada','2099-10-03','',?,0,1,'Bom equilíbrio',?,?,?)").bind(snapshot, now, now, now),
      db().prepare("INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,location,max_changes,status,created_by_administrator_id,separation_id,created_at,updated_at) VALUES ('match-delete','Partida vinculada','2099-10-03T12:00:00.000Z','2099-10-03T11:00:00.000Z','Campo',2,'CLOSED','retirement-admin','linked-delete',?,?)").bind(now, now),
      db().prepare("INSERT INTO match_separation_drafts (id,match_id,snapshot,manually_adjusted,present_player_ids,proposal_number,created_by_administrator_id,created_at,updated_at) VALUES ('draft-delete','match-delete',?,0,'[]',1,'retirement-admin',?,?)").bind(snapshot, now, now),
      db().prepare("INSERT INTO account_notifications (id,account_type,account_id,type,title,body,match_id,created_at) VALUES ('notice-delete','administrator','retirement-admin','MATCH_CREATED','Partida','Partida','match-delete',?)").bind(now),
    ]);
    await db().prepare("DELETE FROM scheduled_matches WHERE id='match-delete'").run();
    assert.ok(await db().prepare("SELECT deleted_at FROM team_separations WHERE id='linked-delete'").first("deleted_at"));
    assert.equal(await db().prepare("SELECT COUNT(*) total FROM match_separation_drafts WHERE match_id='match-delete'").first("total"), 0);
    assert.equal(await db().prepare("SELECT COUNT(*) total FROM account_notifications WHERE match_id='match-delete'").first("total"), 0);
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

test("painel consolida rascunhos e times dentro de Partidas sem remover o histórico", async () => {
  const [admin, matches, memberMatches, permissions] = await Promise.all([
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/MatchesPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/partidas/MatchesApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/moderator-permissions.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(admin, /\['separations','Separações'\]|tab==='separations'|SeparationAdminPanel|removeSep/);
  assert.match(admin, /canConfigureDrafts=\{fullAdministrator\}/);
  assert.match(matches, /function SeparationDraftSetting/);
  assert.match(matches, /\/api\/instance-config/);
  assert.match(matches, /CONFIGURAÇÃO DAS PARTIDAS/);
  assert.match(matches, /Rascunhos de Escalação/);
  assert.match(matches, /\/partidas\?match=\$\{encodeURIComponent\(match\.id\)\}&tab=teams/);
  assert.match(memberMatches, /\/partidas\?match=\$\{encodeURIComponent\(item\.id\)\}&tab=teams/);
  assert.match(permissions, /label: "Times e rascunhos"/);
});
