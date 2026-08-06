import assert from "node:assert/strict";
import test from "node:test";
import { defaultWeights, goalkeeperWeightKeys, lineWeightKeys, normalizeWeights } from "../src/weights.ts";

test("ajusta os outros pesos proporcionalmente e mantém 100%", () => {
  const next = normalizeWeights({ speedWeight: .48, skillWeight: .32, markingWeight: .2 }, "speedWeight", .6);
  assert.equal(next.speedWeight, .6);
  assert.ok(Math.abs(next.skillWeight + next.markingWeight - .4) < .0001);
  assert.ok(Math.abs(next.speedWeight + next.skillWeight + next.markingWeight - 1) < .0001);
});

test("limita pesos ao intervalo entre zero e um", () => {
  assert.equal(normalizeWeights({ speedWeight: .4, skillWeight: .4, markingWeight: .2 }, "markingWeight", 2).markingWeight, 1);
});

test("redistribui somente os cinco pesos dos jogadores de linha", () => {
  const next = normalizeWeights(defaultWeights, lineWeightKeys, "tacticalIntelligenceWeight", .4);
  const lineTotal = lineWeightKeys.reduce((sum, key) => sum + next[key], 0);
  assert.ok(Math.abs(lineTotal - 1) < .0001);
  assert.equal(next.tacticalIntelligenceWeight, .4);
  assert.equal(next.goalkeeperDefensesWeight, defaultWeights.goalkeeperDefensesWeight);
});

test("redistribui somente os cinco pesos dos goleiros", () => {
  const next = normalizeWeights(defaultWeights, goalkeeperWeightKeys, "goalkeeperSafetyWeight", .35);
  const goalkeeperTotal = goalkeeperWeightKeys.reduce((sum, key) => sum + next[key], 0);
  assert.ok(Math.abs(goalkeeperTotal - 1) < .0001);
  assert.equal(next.goalkeeperSafetyWeight, .35);
  assert.equal(next.speedWeight, defaultWeights.speedWeight);
});
