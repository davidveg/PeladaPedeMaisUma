import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyCareerHighlights, buildPublicStatistics } from "../lib/public-statistics.ts";

const players = [
  { id: "a", displayName: "Ana", type: "monthly" },
  { id: "b", displayName: "Bia", type: "monthly" },
  { id: "c", displayName: "Caio", type: "guest" },
];
const matches = [
  { id: "m1", separationId: "s1", title: "Rodada 1", date: "2026-07-05", blueScore: 2, yellowScore: 1, winnerTeam: "BLUE", blueIds: ["a"], yellowIds: ["b", "c"] },
  { id: "m2", separationId: "s2", title: "Rodada 2", date: "2026-07-12", blueScore: 0, yellowScore: 0, winnerTeam: "DRAW", blueIds: ["b"], yellowIds: ["a", "c"] },
  { id: "m3", separationId: "s3", title: "Rodada 3", date: "2026-07-19", blueScore: 1, yellowScore: 0, winnerTeam: "BLUE", blueIds: ["a", "b"], yellowIds: ["c"] },
];

test("calcula artilharia, assistências e ignora gol contra", () => {
  const result = buildPublicStatistics(players, matches, [
    { matchId: "m1", scorerPlayerId: "a", assistPlayerId: "c" },
    { matchId: "m1", scorerPlayerId: "b", ownGoal: true },
    { matchId: "m3", scorerPlayerId: "a", assistPlayerId: "b" },
  ]);
  assert.deepEqual(result.leaderboard.map(entry => [entry.player.id, entry.goals, entry.assists]), [["a", 2, 0], ["b", 0, 1], ["c", 0, 1]]);
  assert.equal(result.leaderboard.find(entry => entry.player.id === "c")?.player.type, "guest");
  assert.deepEqual(result.coverage, { matches: 3, matchesWithContributions: 2 });
});

test("versus considera somente equipes opostas e mostra vitórias e empates", () => {
  const result = buildPublicStatistics(players, matches, [], "a", "b");
  assert.equal(result.versus.winsA, 1);
  assert.equal(result.versus.winsB, 0);
  assert.equal(result.versus.draws, 1);
  assert.deepEqual(result.versus.matches.map(match => match.id), ["m1", "m2"]);
});

test("ranking de assiduidade conta uma presença por seleção com resultado", () => {
  const duplicated = [{ ...matches[0], blueIds: ["a", "a"] }, ...matches.slice(1)];
  const result = buildPublicStatistics(players, duplicated, []);
  assert.deepEqual(result.attendance.map(entry => [entry.player.id, entry.presences, entry.rate]), [
    ["a", 3, 100],
    ["b", 3, 100],
    ["c", 3, 100],
  ]);
});

test("calcula as maiores sequências de vitórias e de invencibilidade no período", () => {
  const result = buildPublicStatistics(players, matches, []);
  assert.equal(result.streaks.winning.length, 1);
  assert.deepEqual(result.streaks.winning.players.map(player => player.id), ["a", "b"]);
  assert.equal(result.streaks.unbeaten.length, 3);
  assert.deepEqual(result.streaks.unbeaten.players.map(player => player.id), ["a"]);
});

test("monta jogador, seleção mensal, histórico fechado e pódio anual pelo momentum reconstruído", () => {
  const awardPlayers = [
    { id: "g", displayName: "Goleiro", type: "goalkeeper", primaryPosition: "Goleiro" },
    { id: "d1", displayName: "Defesa 1", type: "monthly", primaryPosition: "Defesa" },
    { id: "d2", displayName: "Defesa 2", type: "monthly", primaryPosition: "Defesa" },
    { id: "m1", displayName: "Meia 1", type: "monthly", primaryPosition: "Meio-campo" },
    { id: "m2", displayName: "Meia 2", type: "monthly", primaryPosition: "Meio-campo" },
    { id: "a1", displayName: "Atacante 1", type: "monthly", primaryPosition: "Ataque" },
    { id: "a2", displayName: "Atacante 2", type: "monthly", primaryPosition: "Ataque" },
    { id: "guest", displayName: "Convidado", type: "guest", primaryPosition: "Ataque" },
  ];
  const awardMatches = [
    { id: "jan-1", separationId: "s-jan-1", title: "Janeiro 1", date: "2026-01-04", blueScore: 2, yellowScore: 1, winnerTeam: "BLUE", blueIds: ["g", "d1", "m1", "a1", "guest"], yellowIds: ["d2", "m2", "a2"], config: { winnerBonus: .1, loserPenalty: -.1 }, results: { motm: [{ playerId: "guest", momentum: 9 }, { playerId: "a1", momentum: .3 }], dotm: [{ playerId: "d2", momentum: -.3 }] } },
    { id: "jan-2", separationId: "s-jan-2", title: "Janeiro 2", date: "2026-01-11", blueScore: 1, yellowScore: 1, winnerTeam: "DRAW", blueIds: ["g", "d1", "m1", "a1"], yellowIds: ["d2", "m2", "a2"], config: { winnerBonus: .1, loserPenalty: -.1 }, results: { motm: [{ playerId: "m1", momentum: .2 }], dotm: [] } },
    { id: "feb-1", separationId: "s-feb-1", title: "Fevereiro", date: "2026-02-01", blueScore: 1, yellowScore: 0, winnerTeam: "BLUE", blueIds: ["g", "d1", "m1", "a1"], yellowIds: ["d2", "m2", "a2"], config: { winnerBonus: .1, loserPenalty: -.1 }, results: { motm: [{ playerId: "a1", momentum: .3 }], dotm: [] } },
  ];
  const result = buildMonthlyCareerHighlights(awardPlayers, awardMatches, 2026, "2026-03-15", "2026-01", "2026-03-01");
  assert.equal(result.focus.playerOfMonth.player.id, "a1");
  assert.equal(result.focus.playerOfMonth.totalMomentum, .4);
  assert.equal(result.focusMonthClosed, true);
  assert.ok(result.focus.selection.every(member => member.player.id !== "guest"));
  assert.deepEqual(result.focus.selection.map(member => member.role), ["Goleiro", "Defesa", "Defesa", "Meio-campo", "Meio-campo", "Ataque", "Ataque"]);
  assert.deepEqual(result.history.map(month => month.month), ["2026-02", "2026-01"]);
  assert.equal(result.annualMvp[0].player.id, "a1");
  assert.equal(result.annualMvp[0].selections, 2);
  assert.equal(result.annualMvp[0].playerOfMonthAwards, 2);
  assert.equal(result.annualMvp[0].medal, "Bola de Ouro");

  const hidden = buildMonthlyCareerHighlights(awardPlayers, awardMatches, 2026, "2026-03-15", "2026-01", "2026-12-31");
  assert.equal(hidden.annualMvpAvailable, false);
  assert.deepEqual(hidden.annualMvp, []);

  const currentMonth = buildMonthlyCareerHighlights(awardPlayers, awardMatches, 2026, "2026-02-15", "2026-02", "2026-12-31");
  assert.equal(currentMonth.focusMonthClosed, false);
  assert.equal(currentMonth.focus, null, "o mês em andamento não deve publicar a premiação");

  const preservedFebruary = structuredClone(result.history.find(award => award.month === "2026-02"));
  const currentMonthFinalizedEarly = buildMonthlyCareerHighlights(awardPlayers, awardMatches, 2026, "2026-02-15", "2026-02", "2026-12-31", [preservedFebruary]);
  assert.equal(currentMonthFinalizedEarly.focusMonthClosed, true);
  assert.equal(currentMonthFinalizedEarly.focus.month, "2026-02", "um retrato persistido deve publicar o mês antes do fim do calendário");

  const preservedJanuary = structuredClone(result.history.find(award => award.month === "2026-01"));
  preservedJanuary.playerOfMonth.player.displayName = "Destaque preservado";
  const withFinalizedSnapshot = buildMonthlyCareerHighlights(awardPlayers, awardMatches, 2026, "2026-03-15", "2026-01", "2026-12-31", [preservedJanuary]);
  assert.equal(withFinalizedSnapshot.focus.playerOfMonth.player.displayName, "Destaque preservado", "o retrato mensal finalizado deve prevalecer sobre recálculos posteriores");

  const compactFormation = buildMonthlyCareerHighlights(awardPlayers, awardMatches, 2026, "2026-03-15", "2026-02", "2026-12-31", [], { goalkeepers: 1, defenders: 1, midfielders: 1, attackers: 1 });
  assert.deepEqual(compactFormation.focus.formation, { goalkeepers: 1, defenders: 1, midfielders: 1, attackers: 1 });
  assert.deepEqual(compactFormation.focus.selection.map(member => member.role), ["Goleiro", "Defesa", "Meio-campo", "Ataque"]);
});
