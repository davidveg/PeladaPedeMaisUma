import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateAdvancedStatistics } from "../lib/statistics-engine.ts";
import { STATISTICS_VERSION } from "../lib/statistics-engine-config.ts";

const players = [
  { id: "g", displayName: "Goleiro", type: "goalkeeper", primaryPosition: "Goleiro" },
  { id: "d", displayName: "Defensor", type: "monthly", primaryPosition: "Defesa" },
  { id: "m", displayName: "Meia", type: "monthly", primaryPosition: "Meio-campo" },
  { id: "a", displayName: "Atacante", type: "monthly", primaryPosition: "Ataque" },
  { id: "x", displayName: "Rival", type: "monthly", primaryPosition: "Ataque" },
  { id: "y", displayName: "Rival 2", type: "monthly", primaryPosition: "Defesa" },
];
const participant = (playerId, position) => ({ playerId, position });
const match = (id, date, blueScore, yellowScore, blue, yellow, extra = {}) => ({
  id, separationId: `s-${id}`, title: `Rodada ${id}`, date, status: "CLOSED", seasonNumber: 2, manuallyAdjusted: false, contributionsAvailable: true,
  blueScore, yellowScore, winnerTeam: blueScore === yellowScore ? "DRAW" : blueScore > yellowScore ? "BLUE" : "YELLOW",
  blue, yellow, contributions: [], votes: [], prediction: { blueStrength: 12, yellowStrength: 11.8, balanceCost: 20, classification: "Excelente equilíbrio", algorithmVersion: 2 }, ...extra,
});
const baseMatches = [
  match("1", "2026-01-01", 3, 1, [participant("g", "Goleiro"), participant("d", "Defesa"), participant("a", "Ataque")], [participant("m", "Meio-campo"), participant("x", "Ataque"), participant("y", "Defesa")], { contributions: [{ scorerPlayerId: "a", assistPlayerId: "d", ownGoal: false }, { scorerPlayerId: "a", assistPlayerId: "d", ownGoal: false }, { scorerPlayerId: "x", ownGoal: true }], votes: [{ motmFirstId: "a", motmSecondId: "d", motmThirdId: "g", dotmFirstId: "x", dotmSecondId: "y", dotmThirdId: "m" }] }),
  match("2", "2026-01-08", 2, 2, [participant("g", "Goleiro"), participant("d", "Defesa"), participant("a", "Ataque")], [participant("m", "Meio-campo"), participant("x", "Ataque"), participant("y", "Defesa")], { contributions: [{ scorerPlayerId: "a", assistPlayerId: "d", ownGoal: false }] }),
  match("3", "2026-01-15", 0, 2, [participant("g", "Goleiro"), participant("m", "Meio-campo"), participant("a", "Ataque")], [participant("d", "Defesa"), participant("x", "Ataque"), participant("y", "Defesa")]),
  match("4", "2026-01-22", 1, 0, [participant("g", "Goleiro"), participant("d", "Defesa"), participant("a", "Ataque")], [participant("m", "Meio-campo"), participant("x", "Ataque"), participant("y", "Defesa")]),
  match("5", "2026-01-29", 2, 1, [participant("g", "Goleiro"), participant("d", "Defesa"), participant("a", "Ataque")], [participant("m", "Meio-campo"), participant("x", "Ataque"), participant("y", "Defesa")]),
];

test("calcula IPI versionado, confiança, +/- e forma sem inventar contribuições", () => {
  const result = calculateAdvancedStatistics(players, baseMatches, { recentWindow: 5 });
  const attacker = result.players.find(entry => entry.player.id === "a");
  assert.equal(result.version, STATISTICS_VERSION);
  assert.equal(attacker.games, 5);
  assert.equal(attacker.plusMinus, 2);
  assert.equal(attacker.goals, 3);
  assert.equal(attacker.assists, 0);
  assert.equal(attacker.ipi.confidence, "Média");
  assert.ok(attacker.ipi.value >= 0 && attacker.ipi.value <= 100);
  assert.deepEqual(attacker.recent.sequence, ["V", "E", "D", "V", "V"]);
});

test("calcula duplas com regularização e ignora par com amostra menor que o filtro", () => {
  const result = calculateAdvancedStatistics(players, baseMatches, { partnershipMinimumGames: 3 });
  const pair = result.partnerships.find(entry => new Set([entry.playerA.id, entry.playerB.id]).has("g") && new Set([entry.playerA.id, entry.playerB.id]).has("a"));
  assert.equal(pair.games, 5);
  assert.ok(pair.chemistry > 50 && pair.chemistry < pair.utilization);
  assert.ok(!result.partnerships.some(entry => new Set([entry.playerA.id, entry.playerB.id]).has("d") && new Set([entry.playerA.id, entry.playerB.id]).has("m")));
});

test("separa temporadas, posições e partidas ajustadas manualmente na avaliação do equilíbrio", () => {
  const otherSeason = { ...baseMatches[0], id: "old", separationId: "s-old", seasonNumber: 1 };
  const manual = { ...baseMatches[1], id: "manual", separationId: "s-manual", manuallyAdjusted: true };
  const result = calculateAdvancedStatistics(players, [...baseMatches, otherSeason, manual], { seasonNumber: 2, position: "Defesa" });
  assert.ok(result.players.every(entry => entry.position === "Defesa"));
  assert.equal(result.coverage.matches, 6);
  assert.equal(result.balance.sample, 5);
  assert.equal(result.balance.predictionError, null);
  assert.ok(result.balance.correlation !== null);
});

test("trata jogador sem partida e componentes ausentes sem transformar ausência em zero", () => {
  const result = calculateAdvancedStatistics([...players, { id: "none", displayName: "Sem jogos", primaryPosition: "Defesa" }], baseMatches.slice(1));
  assert.equal(result.players.some(entry => entry.player.id === "none"), false);
  const noVotes = result.players.find(entry => entry.player.id === "m");
  assert.ok(noVotes.ipi.availableComponents.length < 6);
});

test("detecta sequências, goleada, partida com mais gols e recordes individuais", () => {
  const result = calculateAdvancedStatistics(players, baseMatches);
  assert.equal(result.records.wins.length, 3);
  assert.equal(result.records.unbeaten.length, 5);
  assert.equal(result.records.goals.length, 2);
  assert.equal(result.records.mostGoals.value, 2);
  assert.equal(result.records.highestScoring.id, "1");
});

test("partida cancelada ou sem resultado não entra porque o motor recebe somente resultados canônicos", () => {
  const result = calculateAdvancedStatistics(players, []);
  assert.equal(result.coverage.matches, 0);
  assert.deepEqual(result.players, []);
  assert.equal(result.balance.averageGoalDifference, null);
});

test("regulariza 100% de aproveitamento em uma única partida e eleva a confiança com histórico longo", () => {
  const small = calculateAdvancedStatistics(players, [baseMatches[0]]);
  const attacker = small.players.find(entry => entry.player.id === "a");
  assert.equal(attacker.ipi.confidence, "Baixa");
  assert.ok(attacker.ipi.value < attacker.ipi.raw);
  const longHistory = Array.from({ length: 20 }, (_, index) => ({ ...baseMatches[index % baseMatches.length], id: `long-${index}`, separationId: `long-s-${index}`, date: `2026-${String(Math.floor(index / 4) + 1).padStart(2, "0")}-${String(index % 4 + 1).padStart(2, "0")}` }));
  const long = calculateAdvancedStatistics(players, longHistory).players.find(entry => entry.player.id === "a");
  assert.equal(long.ipi.confidence, "Alta");
  assert.equal(long.games, 20);
});

test("não inventa gols para goleiro ou defensor e preserva empate na amostra", () => {
  const result = calculateAdvancedStatistics(players, baseMatches);
  const goalkeeper = result.players.find(entry => entry.player.id === "g"), defender = result.players.find(entry => entry.player.id === "d");
  assert.equal(goalkeeper.position, "Goleiro");
  assert.equal(goalkeeper.goals, 0);
  assert.equal(defender.goals, 0);
  assert.ok(goalkeeper.draws > 0);
  assert.ok(defender.ipi.availableComponents.includes("offense"));
});

test("jogadores que nunca atuaram juntos não formam parceria", () => {
  const separated = [match("never", "2026-02-01", 1, 0, [participant("a", "Ataque"), participant("d", "Defesa")], [participant("m", "Meio-campo"), participant("x", "Ataque")])];
  const result = calculateAdvancedStatistics(players, separated, { partnershipMinimumGames: 1 });
  assert.equal(result.partnerships.some(pair => new Set([pair.playerA.id, pair.playerB.id]).has("a") && new Set([pair.playerA.id, pair.playerB.id]).has("m")), false);
});

test("remove o componente ofensivo quando gols e assistências não eram coletados", () => {
  const untracked = baseMatches.map(item => ({ ...item, contributionsAvailable: false, contributions: [] }));
  const result = calculateAdvancedStatistics(players, untracked);
  const attacker = result.players.find(entry => entry.player.id === "a");
  assert.equal(result.coverage.detailedContributions, 0);
  assert.equal(attacker.contributionGames, 0);
  assert.equal(attacker.ipi.availableComponents.includes("offense"), false);
});

test("a rede de entrosamento mantém altura própria e seletor separado do título", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/estatisticas/avancadas/AdvancedStatisticsApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/estatisticas/avancadas/advanced-statistics.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className="advanced-section network-section"/);
  assert.match(styles, /\.advanced-two-columns\{align-items:start\}/);
  assert.match(styles, /\.advanced-two-columns>\.advanced-section\{height:auto\}/);
  assert.match(styles, /\.network-section \.network-picker\{max-width:300px;margin:0 0 20px auto\}/);
});
