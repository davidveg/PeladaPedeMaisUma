import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicStatistics } from "../lib/public-statistics.ts";

const players = [
  { id: "a", displayName: "Ana" },
  { id: "b", displayName: "Bia" },
  { id: "c", displayName: "Caio" },
];
const matches = [
  { id: "m1", separationId: "s1", title: "Rodada 1", date: "2026-07-05", blueScore: 2, yellowScore: 1, winnerTeam: "BLUE", blueIds: ["a"], yellowIds: ["b", "c"] },
  { id: "m2", separationId: "s2", title: "Rodada 2", date: "2026-07-12", blueScore: 0, yellowScore: 0, winnerTeam: "DRAW", blueIds: ["b"], yellowIds: ["a", "c"] },
  { id: "m3", separationId: "s3", title: "Rodada 3", date: "2026-07-19", blueScore: 1, yellowScore: 0, winnerTeam: "BLUE", blueIds: ["a", "b"], yellowIds: ["c"] },
];

test("calcula artilharia, assistências e ignora gol contra", () => {
  const result = buildPublicStatistics(players, matches, [
    { matchId: "m1", scorerPlayerId: "a", assistPlayerId: "c" },
    { matchId: "m1", scorerPlayerId: "b", ownGoal: true },
    { matchId: "m3", scorerPlayerId: "a", assistPlayerId: "b" },
  ]);
  assert.deepEqual(result.leaderboard.map(entry => [entry.player.id, entry.goals, entry.assists]), [["a", 2, 0], ["b", 0, 1], ["c", 0, 1]]);
  assert.deepEqual(result.coverage, { matches: 3, matchesWithContributions: 2 });
});

test("versus considera somente equipes opostas e mostra vitórias e empates", () => {
  const result = buildPublicStatistics(players, matches, [], "a", "b");
  assert.equal(result.versus.winsA, 1);
  assert.equal(result.versus.winsB, 0);
  assert.equal(result.versus.draws, 1);
  assert.deepEqual(result.versus.matches.map(match => match.id), ["m1", "m2"]);
});
