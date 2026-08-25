import assert from "node:assert/strict";
import test from "node:test";
import { defaultWeights, goalkeeperWeightKeys, lineWeightKeys, updateWeight, weightTotalPercent } from "../src/weights.ts";

test("altera somente o peso escolhido", () => {
  const next = updateWeight(defaultWeights, "speedWeight", .6);
  assert.equal(next.speedWeight, .6);
  assert.equal(next.skillWeight, defaultWeights.skillWeight);
  assert.equal(next.markingWeight, defaultWeights.markingWeight);
  assert.equal(next.goalkeeperDefensesWeight, defaultWeights.goalkeeperDefensesWeight);
});

test("limita pesos ao intervalo entre zero e um", () => {
  assert.equal(updateWeight(defaultWeights, "markingWeight", 2).markingWeight, 1);
  assert.equal(updateWeight(defaultWeights, "markingWeight", -1).markingWeight, 0);
});

test("arredonda o valor alterado para pontos percentuais inteiros", () => {
  assert.equal(updateWeight(defaultWeights, "tacticalIntelligenceWeight", .236).tacticalIntelligenceWeight, .24);
});

test("calcula os totais dos grupos em porcentagem", () => {
  assert.equal(weightTotalPercent(defaultWeights, lineWeightKeys), 100);
  assert.equal(weightTotalPercent(defaultWeights, goalkeeperWeightKeys), 100);
  const changed = updateWeight(defaultWeights, "goalkeeperSafetyWeight", .35);
  assert.equal(weightTotalPercent(changed, goalkeeperWeightKeys), 115);
});
