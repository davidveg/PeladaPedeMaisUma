import assert from "node:assert/strict";
import test from "node:test";
import { buildMatchAttendanceShareMessage } from "../lib/match-attendance-sharing.ts";

test("gera parcial agrupada com presentes, ausentes e pendentes em branco", () => {
  const message = buildMatchAttendanceShareMessage({
    title: "Pelada",
    matchAt: "2026-07-26T09:00:00-03:00",
    location: "Batista",
    players: [
      { id: "g1", displayName: "Aranha", type: "goalkeeper", primaryPosition: "Goleiro" },
      { id: "g2", displayName: "Lourenço", type: "goalkeeper", primaryPosition: "Goleiro" },
      { id: "g3", displayName: "Renato", type: "goalkeeper", primaryPosition: "Goleiro" },
      { id: "m1", displayName: "William", type: "monthly", primaryPosition: "Defesa" },
      { id: "m2", displayName: "Cussa", type: "monthly", primaryPosition: "Ataque" },
      { id: "c1", displayName: "Marcos", type: "guest", primaryPosition: "Meio-campo" },
      { id: "c2", displayName: "Bruna", type: "guest", primaryPosition: "Defesa" },
      { id: "c3", displayName: "Carlos", type: "guest", primaryPosition: "Ataque" },
    ],
    attendance: [
      { playerId: "g1", status: "PRESENT" },
      { playerId: "g3", status: "ABSENT" },
      { playerId: "m1", status: "ABSENT" },
      { playerId: "c1", status: "PRESENT" },
      { playerId: "c2", status: "ABSENT" },
    ],
    confirmationUrl: "https://pelada.example/partidas?match=partida-1",
  });
  assert.match(message, /\*PELADA - 26\/07\/2026 - BATISTA\*/);
  assert.match(message, /Confirme sua presença no site:\*\nhttps:\/\/pelada\.example\/partidas\?match=partida-1\n\nAguardando confirmações/);
  assert.match(message, /✅ 2 confirmados · ❌ 1 ausentes · ⏳ 1 pendentes/);
  assert.match(message, /Goleiros:\n1 - Aranha\n2 - \n/);
  assert.doesNotMatch(message, /Lourenço|Renato/);
  assert.match(message, /Mensalistas:\n1 - Cussa: \n2 - William: ❌/);
  assert.match(message, /Convidados:\n1 - Marcos: ✅/);
  assert.doesNotMatch(message, /Bruna|Carlos/);
});

test("omite a seção de convidados quando nenhum deles confirmou presença", () => {
  const message = buildMatchAttendanceShareMessage({
    title: "Pelada",
    matchAt: "2026-07-26T09:00:00-03:00",
    players: [
      { id: "m1", displayName: "William", type: "monthly", primaryPosition: "Defesa" },
      { id: "c1", displayName: "Marcos", type: "guest", primaryPosition: "Ataque" },
    ],
    attendance: [{ playerId: "c1", status: "ABSENT" }],
  });
  assert.match(message, /Goleiros:\n1 - \n2 - \n/);
  assert.doesNotMatch(message, /Convidados:|Marcos/);
  assert.match(message, /✅ 0 confirmados · ❌ 0 ausentes · ⏳ 1 pendentes/);
});

test("exibe convidados na lista de espera sem check e sem contá-los como presentes ou pendentes", () => {
  const message = buildMatchAttendanceShareMessage({
    title: "Pelada XPTO",
    matchAt: "2026-08-16T09:00:00-03:00",
    players: [
      { id: "m1", displayName: "William", type: "monthly", primaryPosition: "Defesa" },
      { id: "c1", displayName: "Bruno Varella", type: "guest", primaryPosition: "Ataque" },
      { id: "c2", displayName: "Edu Fraga", type: "guest", primaryPosition: "Meio-campo" },
    ],
    attendance: [{ playerId: "m1", status: "PRESENT" }],
    preconfirmedGuestIds: ["c1", "c2"],
  });
  assert.match(message, /✅ 1 confirmados · ❌ 0 ausentes · ⏳ 0 pendentes/);
  assert.match(message, /Convidados:\n1 - Bruno Varella: \n2 - Edu Fraga: /);
  assert.doesNotMatch(message, /Bruno Varella: ✅|Edu Fraga: ✅/);
});

test("mantém convidados confirmados em ordem alfabética e a fila na ordem de entrada", () => {
  const message = buildMatchAttendanceShareMessage({
    title: "Pelada com fila",
    matchAt: "2026-09-06T09:00:00-03:00",
    players: [
      { id: "w3", displayName: "Ana Espera", type: "guest" },
      { id: "p2", displayName: "Bruno Presente", type: "guest" },
      { id: "w1", displayName: "Zeca Espera", type: "guest" },
      { id: "p1", displayName: "Alice Presente", type: "guest" },
      { id: "w2", displayName: "Marcos Espera", type: "guest" },
      { id: "m2", displayName: "William", type: "monthly" },
      { id: "m1", displayName: "Cussa", type: "monthly" },
    ],
    attendance: [
      { playerId: "p1", status: "PRESENT" }, { playerId: "p2", status: "PRESENT" },
    ],
    // Ordem real de inclusão na espera: Zeca, Marcos e Ana.
    preconfirmedGuestIds: ["w1", "w2", "w3"],
  });
  assert.match(message, /Mensalistas:\n1 - Cussa: \n2 - William: /);
  assert.match(message, /Convidados:\n1 - Alice Presente: ✅\n2 - Bruno Presente: ✅\n3 - Zeca Espera: \n4 - Marcos Espera: \n5 - Ana Espera: /);
});

test("sem lista de espera ordena normalmente os convidados por nome", () => {
  const message = buildMatchAttendanceShareMessage({
    title: "Pelada sem fila",
    matchAt: "2026-09-06T09:00:00-03:00",
    players: [
      { id: "c3", displayName: "Zeca", type: "guest" },
      { id: "c1", displayName: "Ana", type: "guest" },
      { id: "c2", displayName: "Marcos", type: "guest" },
    ],
    attendance: [
      { playerId: "c3", status: "PRESENT" },
      { playerId: "c1", status: "PRESENT" },
      { playerId: "c2", status: "PRESENT" },
    ],
  });
  assert.match(message, /Convidados:\n1 - Ana: ✅\n2 - Marcos: ✅\n3 - Zeca: ✅/);
});
