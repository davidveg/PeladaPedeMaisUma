import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, adminMatches] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/admin/matches/route.ts"),
]);
const { db, ensureDb } = database;

test("administrador substitui jogador no mesmo time após fechar a lista e antes do resultado", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-post-separation-replacement-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), matchId = "replacement-match", separationId = "replacement-separation";
    await db().batch([
      db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES ('replacement-admin','admin@example.com','hash',1,0,?,?)`).bind(now, now),
      db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES ('replacement-admin-session','replacement-admin','2099-01-01T00:00:00.000Z',?)`).bind(now),
      db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,role,created_at,updated_at) VALUES ('replacement-moderator','moderator@example.com','hash',1,'moderator',?,?)`).bind(now, now),
      db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES ('replacement-moderator-session','replacement-moderator','2099-01-01T00:00:00.000Z',?)`).bind(now),
      db().prepare(`INSERT INTO moderator_permissions (member_account_id,permission,enabled,updated_at,updated_by_administrator_id) VALUES ('replacement-moderator','SEPARATIONS_MANAGE',1,?,'replacement-admin')`).bind(now),
    ]);
    const players = [
      player("replacement-outgoing", "Carlos", "monthly", "Defesa", 3.6),
      player("replacement-blue-2", "Bruno", "monthly", "Ataque", 3.8),
      player("replacement-yellow-1", "Diego", "monthly", "Defesa", 3.7),
      player("replacement-yellow-2", "Eduardo", "monthly", "Ataque", 3.9),
      player("replacement-incoming", "Felipe", "guest", "Meio-campo", 4.1),
    ];
    for (const item of players) {
      await db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,tactical_intelligence,competitiveness,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`)
        .bind(item.id, item.fullName, item.displayName, item.displayName, "[]", item.type, item.primaryPosition, item.speed, item.skill, item.marking, item.tacticalIntelligence, item.competitiveness, now, now).run();
    }
    const snapshot = {
      blue: [players[0], players[1]], yellow: [players[2], players[3]],
      speedWeight: .35, skillWeight: .25, markingWeight: .15, tacticalIntelligenceWeight: .2, competitivenessWeight: .05,
      protectedTopPlayersPercentage: .25, algorithmAttempts: 100, maximumPositionDifference: 1,
      cost: 10, rating: "Excelente equilíbrio", selectionMethod: "automatic",
    };
    await db().batch([
      db().prepare(`INSERT INTO team_separations (id,match_title,match_date,original_text,snapshot,manually_adjusted,balance_score,balance_classification,arrival_order,match_draft,confirmed_at,created_at,updated_at) VALUES (?,?,?,'',?,0,10,'Excelente equilíbrio',?,'rascunho',?,?,?)`)
        .bind(separationId, "Pelada da troca", "2099-08-03", JSON.stringify(snapshot), JSON.stringify({ blue: [players[0].id, players[1].id], yellow: [players[2].id, players[3].id] }), now, now, now),
      db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,max_changes,status,created_by_administrator_id,separation_id,closed_at,created_at,updated_at) VALUES (?,?,'2099-08-03T12:00:00.000Z','2099-08-03T11:00:00.000Z',2,'CLOSED','replacement-admin',?,?,?,?)`)
        .bind(matchId, "Pelada da troca", separationId, now, now, now),
    ]);
    for (const item of players.slice(0, 4)) {
      await db().prepare(`INSERT INTO match_attendance (id,match_id,player_id,status,change_count,created_at,updated_at) VALUES (?,?,?,'PRESENT',1,?,?)`)
        .bind(`attendance-${item.id}`, matchId, item.id, now, now).run();
    }
    await db().batch([
      db().prepare(`INSERT INTO match_attendance (id,match_id,player_id,status,change_count,created_at,updated_at) VALUES ('attendance-incoming',?,?,'ABSENT',2,?,?)`).bind(matchId, players[4].id, now, now),
      db().prepare(`INSERT INTO match_guest_preconfirmations (id,match_id,player_id,created_by_administrator_id,created_at,updated_at) VALUES ('waiting-incoming',?,?,'replacement-admin',?,?)`).bind(matchId, players[4].id, now, now),
    ]);

    const before = await adminMatches.GET(request(`/api/admin/matches?id=${matchId}`, "ppm_session=replacement-admin-session"));
    const listedBefore = (await before.json()).matches[0];
    assert.equal(listedBefore.canReplaceAfterTeams, true);
    assert.deepEqual(listedBefore.lineup.blue.map(item => item.id), [players[0].id, players[1].id]);

    const moderatorAttempt = await replace(matchId, players[0].id, players[4].id, "ppm_member_session=replacement-moderator-session");
    assert.equal(moderatorAttempt.status, 403);
    assert.match((await moderatorAttempt.json()).error, /somente administradores/i);

    const response = await replace(matchId, players[0].id, players[4].id, "ppm_session=replacement-admin-session");
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.team, "BLUE");
    assert.match(payload.message, /Felipe substituiu Carlos/i);
    assert.equal(payload.teamName, "Azul");

    const separation = await db().prepare(`SELECT snapshot,manually_adjusted,arrival_order,match_draft FROM team_separations WHERE id=?`).bind(separationId).first();
    const storedSnapshot = JSON.parse(separation.snapshot);
    assert.deepEqual(storedSnapshot.blue.map(item => item.id), [players[4].id, players[1].id]);
    assert.deepEqual(storedSnapshot.yellow.map(item => item.id), [players[2].id, players[3].id]);
    assert.equal(storedSnapshot.selectionMethod, "manual");
    assert.equal(Number(separation.manually_adjusted), 1);
    assert.equal(separation.arrival_order, null);
    assert.equal(separation.match_draft, null);

    const attendance = await db().prepare(`SELECT player_id,status,change_count,updated_by_administrator_id FROM match_attendance WHERE match_id=? AND player_id IN (?,?) ORDER BY player_id`).bind(matchId, players[0].id, players[4].id).all();
    assert.deepEqual(attendance.results.map(item => ({ ...item })), [
      { player_id: players[4].id, status: "PRESENT", change_count: 2, updated_by_administrator_id: "replacement-admin" },
      { player_id: players[0].id, status: "ABSENT", change_count: 1, updated_by_administrator_id: "replacement-admin" },
    ]);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM match_guest_preconfirmations WHERE match_id=?`).bind(matchId).first("total"), 0);
    const audit = await db().prepare(`SELECT new_data FROM audit_logs WHERE action='MATCH_PLAYER_REPLACED_AFTER_TEAMS' AND entity_id=?`).bind(matchId).first();
    assert.deepEqual({ team: JSON.parse(audit.new_data).team, outgoing: JSON.parse(audit.new_data).outgoingPlayerId, incoming: JSON.parse(audit.new_data).incomingPlayerId }, {
      team: "BLUE", outgoing: players[0].id, incoming: players[4].id,
    });

    await db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,created_by_administrator_id,config_snapshot,created_at,updated_at) VALUES ('replacement-result',?,1,0,'BLUE','replacement-token','OPEN','2099-08-10T00:00:00.000Z','replacement-admin','{}',?,?)`).bind(separationId, now, now).run();
    const afterResult = await replace(matchId, players[4].id, players[0].id, "ppm_session=replacement-admin-session");
    assert.equal(afterResult.status, 409);
    assert.match((await afterResult.json()).error, /resultado.+confirmado/i);
    const after = await adminMatches.GET(request(`/api/admin/matches?id=${matchId}`, "ppm_session=replacement-admin-session"));
    assert.equal((await after.json()).matches[0].canReplaceAfterTeams, false);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("painel administrativo oferece a substituição somente ao administrador completo", async () => {
  const [panel, admin] = await Promise.all([
    readFile(new URL("../app/admin/MatchesPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /Substituição de última hora/);
  assert.match(panel, /action: "replace-player"/);
  assert.match(panel, /O substituto entra na mesma equipe/);
  assert.match(admin, /allowPostSeparationReplacement=\{fullAdministrator\}/);
});

function player(id, displayName, type, primaryPosition, rating) {
  return { id, fullName: displayName, displayName, type, primaryPosition, speed: rating, skill: rating, marking: rating, tacticalIntelligence: rating, competitiveness: rating, momentum: 0, resultMomentum: 0, votingMomentum: 0, careerRatingAdjustment: 0, active: true };
}

function request(path, cookie) {
  return new Request(`https://pelada.example${path}`, { headers: { cookie } });
}

function replace(matchId, outgoingPlayerId, incomingPlayerId, cookie) {
  return adminMatches.PATCH(new Request("https://pelada.example/api/admin/matches", {
    method: "PATCH", headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "replace-player", matchId, outgoingPlayerId, incomingPlayerId }),
  }));
}
