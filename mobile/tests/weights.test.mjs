import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWeights } from "../src/weights.ts";

test("ajusta os outros pesos proporcionalmente e mantém 100%", () => {
  const next = normalizeWeights({ speedWeight: .48, skillWeight: .32, markingWeight: .2 }, "speedWeight", .6);
  assert.equal(next.speedWeight, .6);
  assert.ok(Math.abs(next.skillWeight + next.markingWeight - .4) < .0001);
  assert.ok(Math.abs(next.speedWeight + next.skillWeight + next.markingWeight - 1) < .0001);
});

test("limita pesos ao intervalo entre zero e um", () => {
  assert.equal(normalizeWeights({ speedWeight: .4, skillWeight: .4, markingWeight: .2 }, "markingWeight", 2).markingWeight, 1);
});
