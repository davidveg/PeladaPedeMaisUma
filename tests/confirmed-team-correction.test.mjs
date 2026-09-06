import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb }, { createCareerMatch }, correction] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../lib/career-service.ts"),
  import("../lib/confirmed-team-correction.ts"),
]);

test("corrige os lados somente na última partida e preserva a votação", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-team-correction-")), bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    await db().prepare("UPDATE career_configuration SET enabled=1,track_contributions=0,winner_bonus=.1,loser_penalty=-.1 WHERE id=1").run();
    const now = new Date().toISOString(), players = Array.from({ length: 8 }, (_, index) => ({ id: `p${index + 1}`, displayName: `Jogador ${index + 1}`, primaryPosition: index < 2 ? "Goleiro" : "Ataque", type: index < 2 ? "goalkeeper" : "monthly" }));
    for (const player of players) await db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,goalkeeper_positioning,goal_exit,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(player.id, player.displayName, player.displayName, "[]", player.type, player.primaryPosition, 3, 3, 3, 3, 3, 1, now, now).run();
    const snapshot = { blue: players.slice(0, 4), yellow: players.slice(4), speedWeight: .35, skillWeight: .25, markingWeight: .15, tacticalIntelligenceWeight: .2, competitivenessWeight: .05, maximumPositionDifference: 2 };
    await db().prepare(`INSERT INTO team_separations (id,match_title,match_date,original_text,snapshot,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind("s-correction", "Pelada", "2026-09-06", "", JSON.stringify(snapshot), 0, "Bom equilíbrio", now, now, now).run();
    await db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,max_changes,status,created_by_administrator_id,separation_id,closed_at,created_at,updated_at) VALUES (?,?,?,?,?,'CLOSED',?,?,?,?,?)`).bind("scheduled-correction", "Pelada", "2026-09-06T12:00:00.000Z", "2026-09-06T11:00:00.000Z", 2, "admin", "s-correction", now, now, now).run();
    const match = await createCareerMatch("s-correction", 2, 1, "admin", [], { reviewed: true, blueIds: ["p1", "p2", "p3", "p4"], yellowIds: ["p5", "p6", "p7", "p8"] });
    await db().prepare(`INSERT INTO career_votes (id,career_match_id,voter_player_id,motm_third_id,motm_second_id,motm_first_id,dotm_third_id,dotm_second_id,dotm_first_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind("vote-1", match.id, "p2", "p1", "p3", "p4", "p5", "p6", "p7", now).run();

    assert.equal((await correction.confirmedTeamCorrectionEligibility("s-correction")).allowed, true);
    await correction.correctConfirmedTeamAssignment({ separationId: "s-correction", blue: ["p2", "p3", "p4"], yellow: ["p5", "p6", "p7", "p8", "p1"], administratorId: "admin" });
    const stored = await db().prepare(`SELECT s.snapshot,c.participation_snapshot FROM team_separations s JOIN career_matches c ON c.separation_id=s.id WHERE s.id='s-correction'`).first();
    assert.deepEqual(JSON.parse(stored.snapshot).yellow.map(player => player.id), ["p5", "p6", "p7", "p8", "p1"]);
    assert.deepEqual(JSON.parse(stored.participation_snapshot).yellow.map(player => player.id), ["p5", "p6", "p7", "p8", "p1"]);
    assert.equal(Number(await db().prepare("SELECT result_momentum FROM players WHERE id='p1'").first("result_momentum")), -.1);
    assert.equal(Number(await db().prepare("SELECT COUNT(*) total FROM career_votes WHERE career_match_id=?").bind(match.id).first("total")), 1);

    await db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,max_changes,status,created_by_administrator_id,created_at,updated_at) VALUES ('newer','Próxima','2026-09-13T12:00:00.000Z','2026-09-13T11:00:00.000Z',2,'OPEN','admin',?,?)`).bind(now, now).run();
    const blocked = await correction.confirmedTeamCorrectionEligibility("s-correction");
    assert.equal(blocked.allowed, false);
    assert.match(blocked.reason, /partida mais nova/);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
