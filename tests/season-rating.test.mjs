import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, seasonRating] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../lib/season-rating.ts"),
]);
const { calculateSeasonRatingEntries, createSeasonRatingReview, applySeasonRatingReview } = seasonRating;
const { db, ensureDb } = database;

const candidate = (overrides = {}) => ({
  playerId: "p1", displayName: "Jogador", position: "Defesa", games: 15,
  currentAdjustment: 0, baseOverall: 3.5, ipi: 70, rawIpi: 70,
  plusMinusPerGame: 1, utilization: 70, consistency: 75,
  availableComponents: ["result", "impact", "consistency"], ...overrides,
});

test("propõe evolução em passos conservadores de 0,05", () => {
  const [entry] = calculateSeasonRatingEntries([candidate()]);
  assert.equal(entry.eligible, true);
  assert.equal(entry.confidence, 1);
  assert.equal(entry.proposedDelta, .1);
  assert.equal(entry.newAdjustment, .1);
  assert.equal(entry.newOverall, 3.6);
});

test("reduz o efeito para amostra parcial e ignora menos de cinco jogos", () => {
  const [partial] = calculateSeasonRatingEntries([candidate({ games: 6, rawIpi: 100 })]);
  const [insufficient] = calculateSeasonRatingEntries([candidate({ games: 4, rawIpi: 100 })]);
  assert.equal(partial.proposedDelta, .1);
  assert.equal(insufficient.proposedDelta, 0);
  assert.equal(insufficient.reason, "INSUFFICIENT_GAMES");
});

test("respeita os limites por temporada e acumulado da carreira", () => {
  const [seasonLimit] = calculateSeasonRatingEntries([candidate({ rawIpi: 100 })]);
  const [careerLimit] = calculateSeasonRatingEntries([candidate({ rawIpi: 100, currentAdjustment: .55 })]);
  assert.equal(seasonLimit.proposedDelta, .2);
  assert.equal(careerLimit.proposedDelta, .05);
  assert.equal(careerLimit.newAdjustment, .6);
  assert.equal(careerLimit.reason, "CAREER_CAP");
});

test("preserva a prévia, aplica o livro-razão e inicia a temporada seguinte", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-season-rating-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings(bindings);
  try {
    await ensureDb();
    const rows = (await db().prepare(`SELECT id,display_name,primary_position FROM players ORDER BY display_name LIMIT 4`).all()).results;
    assert.equal(rows.length, 4);
    const participant = row => ({ id: row.id, displayName: row.display_name, primaryPosition: row.primary_position });
    const snapshot = { blue: rows.slice(0, 2).map(participant), yellow: rows.slice(2).map(participant) };
    const now = "2026-06-30T12:00:00.000Z";
    await db().prepare(`UPDATE career_configuration SET season_number=1,season_started_at='2026-01-01T00:00:00.000Z',next_season_reset_at='2027-01-01T00:00:00.000Z' WHERE id=1`).run();
    for (let index = 0; index < 5; index++) {
      const separationId = `rating-separation-${index}`, matchId = `rating-match-${index}`, date = `2026-0${index + 1}-15`;
      await db().prepare(`INSERT INTO team_separations (id,match_title,match_date,original_text,snapshot,manually_adjusted,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,?,?,0,?,'Equilibrado',?,?,?)`)
        .bind(separationId, `Rodada ${index + 1}`, date, "", JSON.stringify(snapshot), .1, now, now, now).run();
      await db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,closed_at,created_by_administrator_id,config_snapshot,participation_snapshot,team_momentum_applied,votes_momentum_applied,created_at,updated_at) VALUES (?,?,?,?,?,?,'CLOSED',?,?,?,?,?,1,1,?,?)`)
        .bind(matchId, separationId, 3, 1, "BLUE", `rating-token-${index}`, now, now, "admin", JSON.stringify({ seasonNumber: 1, trackContributions: false }), JSON.stringify(snapshot), now, now).run();
    }
    let review = await createSeasonRatingReview({ seasonNumber: 1, startedAt: "2026-01-01", endedAt: "2026-06-30", administratorId: "admin" });
    assert.equal(review.status, "PROPOSED");
    assert.equal(review.players.length, 4);
    assert.ok(review.players.some(player => player.proposedDelta !== 0));
    assert.match(review.sourceHash, /^[a-f0-9]{64}$/);
    await db().prepare(`UPDATE career_matches SET blue_score=4,updated_at=? WHERE id='rating-match-0'`).bind(new Date().toISOString()).run();
    await assert.rejects(
      applySeasonRatingReview({ seasonNumber: 1, administratorId: "admin", now: new Date(now) }),
      /Recalcule a prévia/,
    );
    review = await createSeasonRatingReview({ seasonNumber: 1, startedAt: "2026-01-01", endedAt: "2026-06-30", administratorId: "admin" });
    assert.equal(review.status, "PROPOSED");
    const applied = await applySeasonRatingReview({ seasonNumber: 1, administratorId: "admin", now: new Date(now) });
    assert.equal(applied.status, "APPLIED");
    assert.equal(applied.nextSeasonNumber, 2);
    assert.equal(Number(await db().prepare(`SELECT COUNT(*) total FROM player_season_rating_adjustments WHERE season_number=1`).first("total")), 4);
    assert.equal(Number(await db().prepare(`SELECT season_number FROM career_configuration WHERE id=1`).first("season_number")), 2);
    assert.equal(await db().prepare(`SELECT status FROM career_season_rating_reviews WHERE season_number=1`).first("status"), "APPLIED");
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});
