import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, adminMatches, matchHub, separations, careerService] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/admin/matches/route.ts"),
  import("../app/api/match-hub/route.ts"),
  import("../app/api/separations/route.ts"),
  import("../lib/career-service.ts"),
]);
const { db, ensureDb } = database;

test("administrador cancela partida passada com times, sem apagar o histórico nem permitir resultado posterior", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-post-separation-cancel-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), closedAt = "2020-07-05T15:00:00.000Z";
    await db().batch([
      db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES ('late-cancel-admin','admin@example.com','hash',1,0,?,?)`).bind(now, now),
      db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES ('late-cancel-admin-session','late-cancel-admin','2099-01-01T00:00:00.000Z',?)`).bind(now),
      db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,role,created_at,updated_at) VALUES ('late-cancel-moderator','moderator@example.com','hash',1,'moderator',?,?)`).bind(now, now),
      db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES ('late-cancel-moderator-session','late-cancel-moderator','2099-01-01T00:00:00.000Z',?)`).bind(now),
      db().prepare(`INSERT INTO moderator_permissions (member_account_id,permission,enabled,updated_at,updated_by_administrator_id) VALUES ('late-cancel-moderator','MATCHES_CANCEL',1,?,'late-cancel-admin')`).bind(now),
      db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES ('late-cancel-blue','Azul','Azul','Azul','[]','monthly','Defesa',3,3,3,1,?,?)`).bind(now, now),
      db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES ('late-cancel-yellow','Amarelo','Amarelo','Amarelo','[]','monthly','Ataque',3,3,3,1,?,?)`).bind(now, now),
    ]);
    const snapshot = JSON.stringify({ blue: [{ id: "late-cancel-blue", displayName: "Azul", primaryPosition: "Defesa" }], yellow: [{ id: "late-cancel-yellow", displayName: "Amarelo", primaryPosition: "Ataque" }] });
    const addClosedMatch = async (id, separationId, matchAt) => {
      await db().batch([
        db().prepare(`INSERT INTO team_separations (id,match_title,match_date,original_text,snapshot,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,'',?,0,'Equilíbrio aceitável',?,?,?)`).bind(separationId, id, matchAt.slice(0, 10), snapshot, closedAt, closedAt, closedAt),
        db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,max_changes,status,created_by_administrator_id,separation_id,closed_at,created_at,updated_at) VALUES (?,?,?,?,2,'CLOSED','late-cancel-admin',?,?,?,?)`).bind(id, id, matchAt, matchAt, separationId, closedAt, now, now),
      ]);
    };
    await addClosedMatch("past-match", "past-separation", "2020-07-05T12:00:00.000Z");
    await addClosedMatch("future-match", "future-separation", "2099-07-05T12:00:00.000Z");
    await addClosedMatch("result-match", "result-separation", "2020-07-12T12:00:00.000Z");
    await db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,created_by_administrator_id,config_snapshot,created_at,updated_at) VALUES ('confirmed-result','result-separation',2,1,'BLUE','token','OPEN','2099-01-01T00:00:00.000Z','late-cancel-admin','{}',?,?)`).bind(now, now).run();

    const cancel = (matchId, cookie) => adminMatches.PATCH(jsonRequest({ action: "cancel", matchId }, cookie));
    const moderatorAttempt = await cancel("past-match", "ppm_member_session=late-cancel-moderator-session");
    assert.equal(moderatorAttempt.status, 403);
    assert.match((await moderatorAttempt.json()).error, /somente administradores/i);
    assert.equal((await cancel("future-match", "ppm_session=late-cancel-admin-session")).status, 409);
    const resultAttempt = await cancel("result-match", "ppm_session=late-cancel-admin-session");
    assert.equal(resultAttempt.status, 409);
    assert.match((await resultAttempt.json()).error, /resultado já foi confirmado/i);

    const adminList = await adminMatches.GET(request("/api/admin/matches?id=past-match", "ppm_session=late-cancel-admin-session"));
    assert.equal((await adminList.json()).matches[0].canCancelAfterTeams, true);
    const moderatorList = await adminMatches.GET(request("/api/admin/matches?id=past-match", "ppm_member_session=late-cancel-moderator-session"));
    assert.equal((await moderatorList.json()).matches[0].canCancelAfterTeams, false);

    const response = await cancel("past-match", "ppm_session=late-cancel-admin-session");
    assert.equal(response.status, 200);
    assert.match((await response.json()).message, /escalação foi preservada/i);
    const stored = await db().prepare(`SELECT status,separation_id,closed_at FROM scheduled_matches WHERE id='past-match'`).first();
    assert.deepEqual({ ...stored }, { status: "CANCELLED", separation_id: "past-separation", closed_at: closedAt });
    assert.equal(await db().prepare(`SELECT deleted_at FROM team_separations WHERE id='past-separation'`).first("deleted_at"), null);
    const audit = await db().prepare(`SELECT new_data FROM audit_logs WHERE action='MATCH_CANCELLED' AND entity_id='past-match' ORDER BY created_at DESC LIMIT 1`).first();
    assert.equal(JSON.parse(audit.new_data).cancellationType, "AFTER_TEAMS_WITHOUT_RESULT");

    const cancelledHub = await matchHub.GET(request("/api/match-hub?filter=cancelled", "ppm_member_session=late-cancel-moderator-session"));
    const cancelledItem = (await cancelledHub.json()).items.find(item => item.matchId === "past-match");
    assert.equal(cancelledItem.status, "CANCELLED");
    assert.equal(cancelledItem.separationId, "past-separation");
    const editCancelled = await separations.PATCH(new Request("https://pelada.example/api/separations", {
      method: "PATCH", headers: { "content-type": "application/json", cookie: "ppm_session=late-cancel-admin-session" },
      body: JSON.stringify({ id: "past-separation", action: "teams", blue: [], yellow: [] }),
    }));
    assert.equal(editCancelled.status, 409);
    assert.match((await editCancelled.json()).error, /preservada somente para consulta/i);

    await db().prepare(`UPDATE career_configuration SET enabled=1 WHERE id=1`).run();
    await assert.rejects(
      () => careerService.createCareerMatch("past-separation", 0, 0, "late-cancel-admin"),
      /partida cancelada/i,
    );
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("cancelamento após os times aparece somente no painel administrativo", async () => {
  const [panel, admin, hub] = await Promise.all([
    readFile(new URL("../app/admin/MatchesPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/partidas/MatchHubApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /Cancelar partida sem resultado/);
  assert.match(admin, /allowPostSeparationCancellation=\{fullAdministrator\}/);
  assert.doesNotMatch(hub, /allowPostSeparationCancellation/);
  assert.match(hub, /item\.status === "CANCELLED" \? \[\] : permissions/);
});

function request(path, cookie) {
  return new Request(`https://pelada.example${path}`, { headers: { cookie } });
}

function jsonRequest(body, cookie) {
  return new Request("https://pelada.example/api/admin/matches", {
    method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body),
  });
}
