import assert from "node:assert/strict";
import test from "node:test";
import { isPlayerType, playerTypeLabel, playerTypeValidationError } from "../lib/player-types.ts";

test("reconhece e apresenta o tipo Avulso", () => {
  assert.equal(isPlayerType("casual"), true);
  assert.equal(playerTypeLabel("casual"), "Avulso");
  assert.equal(playerTypeLabel("goalkeeper"), "Goleiro Mensalista");
});

test("permite Avulso somente na posição de goleiro", () => {
  assert.equal(playerTypeValidationError("casual", "Goleiro"), null);
  assert.equal(playerTypeValidationError("goalkeeper", "Goleiro"), null);
  assert.equal(playerTypeValidationError("monthly", "Goleiro"), "Para goleiros, selecione Goleiro Mensalista ou Avulso.");
  assert.equal(playerTypeValidationError("guest", "Goleiro"), "Para goleiros, selecione Goleiro Mensalista ou Avulso.");
  assert.equal(playerTypeValidationError("casual", "Defesa"), "Goleiro Mensalista e Avulso são tipos exclusivos da posição Goleiro.");
  assert.equal(playerTypeValidationError("goalkeeper", "Ataque"), "Goleiro Mensalista e Avulso são tipos exclusivos da posição Goleiro.");
});

test("rejeita tipos desconhecidos", () => {
  assert.equal(playerTypeValidationError("unknown", "Goleiro"), "Selecione um tipo de jogador válido.");
});
