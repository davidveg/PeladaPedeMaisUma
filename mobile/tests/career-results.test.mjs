import assert from "node:assert/strict";
import test from "node:test";
import { careerResultsMessage } from "../src/career-results.ts";

const separation = {
  id: "match-1",
  matchTitle: "PELADA - 19/07 Batista",
  snapshot: {
    blue: [{ id: "william", displayName: "William" }, { id: "david", displayName: "David" }],
    yellow: [{ id: "mateus", displayName: "Mateus" }],
  },
  career: {
    status: "CLOSED",
    blueScore: 1,
    yellowScore: 3,
    results: {
      voteCount: 13,
      motm: [{ playerId: "william", place: 1, momentum: 0.3 }],
      dotm: [{ playerId: "mateus", place: 1, momentum: -0.3 }],
    },
  },
};

test("compartilha o placar e o resultado consolidado da votação encerrada", () => {
  const message = careerResultsMessage(separation, "https://pelada.example.com");
  assert.match(message, /Resultado da votação/);
  assert.match(message, /Azul 1 × 3 Amarelo/);
  assert.match(message, /William \(\+0\.3\)/);
  assert.match(message, /Mateus \(-0\.3\)/);
  assert.match(message, /13/);
  assert.ok(message.endsWith("https://pelada.example.com/?separation=match-1"));
});

test("não compartilha votação que ainda está aberta", () => {
  assert.throws(() => careerResultsMessage({ ...separation, career: { ...separation.career, status: "OPEN" } }, "https://pelada.example.com"), /ainda não foi encerrada/);
});
