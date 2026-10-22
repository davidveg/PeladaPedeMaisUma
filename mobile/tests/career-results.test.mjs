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
      partner: [{ playerId: "david", place: 1, votes: 6, momentum: 0.1 }],
      fairPlay: [{ playerId: "william", place: 1, votes: 5, momentum: 0.1 }],
      defense: [{ playerId: "mateus", place: 1, votes: 7, momentum: 0.2 }],
    },
  },
};

test("compartilha o placar e o resultado consolidado da votação encerrada", () => {
  const message = careerResultsMessage(separation, "https://pelada.example.com");
  assert.match(message, /Resultado da votação/);
  assert.match(message, /Azul 1 × 3 Amarelo/);
  assert.match(message, /William \(\+0\.3\)/);
  assert.match(message, /Mateus \(-0\.3\)/);
  assert.match(message, /Parceiro da rodada[\s\S]*David \(\+0\.1\)/);
  assert.match(message, /Fair Play[\s\S]*William \(\+0\.1\)/);
  assert.match(message, /Defesa da rodada[\s\S]*Mateus \(\+0\.2\)/);
  assert.match(message, /13/);
  assert.ok(message.endsWith("https://pelada.example.com/?separation=match-1"));
});

test("não compartilha votação que ainda está aberta", () => {
  assert.throws(() => careerResultsMessage({ ...separation, career: { ...separation.career, status: "OPEN" } }, "https://pelada.example.com"), /ainda não foi encerrada/);
});

test("usa nomes e marcadores das cores configuradas no resultado compartilhado", () => {
  const message = careerResultsMessage(separation, "https://pelada.example.com", {
    teamBlueName: "Vermelho",
    teamBlueColor: "#D62828",
    teamYellowName: "Branco",
    teamYellowColor: "#F5F5F5",
  });
  assert.match(message, /🔴 Vermelho 1 × 3 Branco ⚪/);
});
