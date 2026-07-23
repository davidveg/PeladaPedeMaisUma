import assert from "node:assert/strict";
import test from "node:test";
import { balanceRating, recalculateTeamResult } from "../src/team-balance.ts";

const player = (id, primaryPosition, value = 3) => ({ id, displayName: id, fullName: id, type: "monthly", primaryPosition, speed: value, skill: value, marking: value, momentum: 0 });
const blue = [player("b-def", "Defesa"), player("b-att", "Ataque")];
const yellow = [player("y-def", "Defesa"), player("y-att", "Ataque")];
const result = { blue, yellow, rating: "", cost: 0, speedWeight: .48, skillWeight: .32, markingWeight: .2, momentumMultiplier: 1, maximumPositionDifference: 1, protectedTopPlayersPercentage: .25, algorithmAttempts: 2500 };

test("recalcula uma divisão equivalente como excelente", () => {
  const next = recalculateTeamResult(result, blue, yellow);
  assert.equal(next.rating, "Excelente equilíbrio");
  assert.equal(next.cost, 0);
  assert.deepEqual(next.delta, { players: 0, defenders: 0, midfielders: 0, attackers: 0, speed: 0, skill: 0, marking: 0, momentum: 0, score: 0 });
  assert.equal(next.blueMetrics.scoreAvg, 3);
  assert.equal(next.yellowMetrics.scoreAvg, 3);
});

test("transferência individual atualiza quantidade, custo e classificação", () => {
  const moved = blue[1];
  const next = recalculateTeamResult(result, [blue[0]], [...yellow, moved]);
  assert.equal(next.delta.players, 2);
  assert.ok(next.cost >= 2000);
  assert.equal(next.rating, "Equilíbrio limitado");
});

test("usa as mesmas faixas de classificação do algoritmo", () => {
  assert.equal(balanceRating(34.99), "Excelente equilíbrio");
  assert.equal(balanceRating(35), "Bom equilíbrio");
  assert.equal(balanceRating(80), "Equilíbrio aceitável");
  assert.equal(balanceRating(150), "Equilíbrio limitado");
});
