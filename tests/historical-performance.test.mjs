import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { balancingScore, defaultConfig, historicalLearningContribution, score } from "../lib/football.ts";
import { calculateHistoricalPerformance } from "../lib/historical-performance.ts";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

const player = (id, position = "Ataque") => ({ id, displayName: id, primaryPosition: position });
const snapshot = JSON.stringify({ blue: [player("a"), player("c")], yellow: [player("b"), player("d")] });

test("índice histórico combina resultados, saldo, contribuições, votos e recência sem alterar o OVR", () => {
  const matches = Array.from({ length: 6 }, (_, index) => ({
    id: `m${index}`, snapshot, blue_score: 3, yellow_score: 1, winner_team: "BLUE", status: "CLOSED", match_date: `2026-0${index + 1}-01`,
    config_snapshot: JSON.stringify({ winnerBonus: .1, loserPenalty: -.1, resultMomentumMultiplier: 1, momentumMultiplier: 1 }),
    results_snapshot: JSON.stringify({ motm: [{ playerId: "a", momentum: .3 }], dotm: [{ playerId: "b", momentum: -.3 }] }),
  }));
  const contributions = matches.flatMap(match => [
    { career_match_id: match.id, scorer_player_id: "a", assist_player_id: "c", is_own_goal: 0 },
    { career_match_id: match.id, scorer_player_id: "b", assist_player_id: null, is_own_goal: 1 },
  ]);
  const votes = matches.map(match => ({ career_match_id: match.id, motm_first_id: "a", motm_second_id: "c", motm_third_id: "d", dotm_first_id: "b", dotm_second_id: "d", dotm_third_id: "c" }));
  const result = calculateHistoricalPerformance(matches, contributions, votes);
  assert.equal(result.a.games, 6); assert.equal(result.a.recentMatches, 6); assert.equal(result.a.confidence, 1);
  assert.ok(result.a.adjustment > 0); assert.ok(result.b.adjustment < 0); assert.ok(result.a.goals > result.b.goals);
  const footballPlayer = { id: "a", fullName: "A", displayName: "A", type: "monthly", primaryPosition: "Ataque", speed: 3, skill: 3, marking: 3, tacticalIntelligence: 3, competitiveness: 3, historicalPerformance: result.a };
  assert.equal(historicalLearningContribution(footballPlayer, defaultConfig), 0);
  assert.equal(score(footballPlayer, { ...defaultConfig, historicalLearningEnabled: true }), score(footballPlayer, defaultConfig));
  assert.ok(balancingScore(footballPlayer, { ...defaultConfig, historicalLearningEnabled: true }) > score(footballPlayer, defaultConfig));
});

test("confiança reduz a influência para jogadores com pouco histórico", () => {
  const [single] = [{ id: "only", snapshot, blue_score: 2, yellow_score: 0, winner_team: "BLUE", match_date: "2026-08-01", config_snapshot: "{}", results_snapshot: null }];
  const result = calculateHistoricalPerformance([single]);
  assert.equal(result.a.confidence, .2);
  assert.ok(Math.abs(result.a.adjustment) <= .12);
});

test("migração mantém o aprendizado histórico desligado por padrão", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-historical-learning-")), bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(`CREATE TABLE system_configuration (id INTEGER PRIMARY KEY,algorithm_attempts INTEGER NOT NULL);INSERT INTO system_configuration VALUES (1,2500);`);
    await bindings.DB.exec(await readFile(new URL("../drizzle/0033_historical_learning.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare(`SELECT historical_learning_enabled FROM system_configuration WHERE id=1`).first();
    assert.equal(row.historical_learning_enabled, 0);
  } finally { bindings.DB.close(); await rm(directory, { recursive: true, force: true }); }
});
