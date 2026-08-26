import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSecondaryPosition, secondaryPositionValidationError } from "../lib/player-positions.ts";

test("aceita uma posição secundária diferente para jogador de linha", () => {
  assert.equal(normalizeSecondaryPosition("Defesa", "Meio-campo", "monthly"), "Meio-campo");
  assert.equal(secondaryPositionValidationError("Defesa", "Meio-campo", "monthly"), null);
});

test("rejeita posição secundária igual à principal", () => {
  assert.match(secondaryPositionValidationError("Ataque", "Ataque", "guest") || "", /diferente/);
});

test("goleiros permanecem com uma única posição", () => {
  assert.equal(normalizeSecondaryPosition("Goleiro", "Defesa", "goalkeeper"), null);
  assert.match(secondaryPositionValidationError("Goleiro", "Defesa", "goalkeeper") || "", /Goleiros/);
});
