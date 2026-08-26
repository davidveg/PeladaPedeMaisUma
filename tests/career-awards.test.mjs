import assert from "node:assert/strict";
import test from "node:test";
import { isLastRegularMatchOfMonth } from "../lib/career-award-calendar.ts";

test("identifica o último jogo semanal do mês", () => {
  assert.equal(isLastRegularMatchOfMonth("2026-08-30", 0), true, "o domingo seguinte já pertence a setembro");
  assert.equal(isLastRegularMatchOfMonth("2026-08-23", 0), false, "ainda existe outro domingo em agosto");
  assert.equal(isLastRegularMatchOfMonth("2026-08-29", 0), false, "uma partida antecipada no sábado não substitui o domingo regular restante");
  assert.equal(isLastRegularMatchOfMonth("data-inválida", 0), false);
});
