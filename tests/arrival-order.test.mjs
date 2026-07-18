import assert from "node:assert/strict";
import test from "node:test";
import { normalizeArrivalOrder, validateArrivalOrder } from "../lib/arrival-order.ts";

test("aceita uma ordem independente para cada time", () => {
  assert.equal(validateArrivalOrder({ blue: ["b2", "b1"], yellow: ["y1", "y2"] }, ["b1", "b2"], ["y1", "y2"]), null);
});

test("rejeita jogadores ausentes, repetidos ou de outra separação", () => {
  assert.match(validateArrivalOrder({ blue: ["b1"], yellow: ["y1"] }, ["b1", "b2"], ["y1"]), /cada jogador/i);
  assert.match(validateArrivalOrder({ blue: ["b1", "b1"], yellow: ["y1"] }, ["b1", "b2"], ["y1"]), /cada jogador/i);
  assert.match(validateArrivalOrder({ blue: ["b1", "y1"], yellow: ["y1"] }, ["b1", "b2"], ["y1"]), /outra equipe/i);
});

test("converte a ordem global antiga preservando a ordem relativa por equipe", () => {
  assert.deepEqual(normalizeArrivalOrder(["b2", "y1", "b1", "y2"], ["b1", "b2"], ["y1", "y2"]), {
    blue: ["b2", "b1"],
    yellow: ["y1", "y2"],
  });
});
