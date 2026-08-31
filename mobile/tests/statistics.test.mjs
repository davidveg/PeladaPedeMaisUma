import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { advancedHighlights, closedAward, currentPeriod, fmt, formationRows, monthRange, parseDate, pitchColumns, playerPartnerships, resolveStatisticsPlayer, signed, sortAttendance, sortScorers, statisticsPath, validatePeriod } from "../src/statistics.ts";
import { calculateAdvancedStatistics } from "../../lib/statistics-engine.ts";
import { buildMonthlyCareerHighlights, buildPublicStatistics } from "../../lib/public-statistics.ts";

const players = [
  { id: "a", displayName: "Ana", type: "monthly", primaryPosition: "Ataque" },
  { id: "b", displayName: "Bia", type: "guest", primaryPosition: "Defesa" },
  { id: "g", displayName: "Goleiro", type: "goalkeeper", primaryPosition: "Goleiro" },
];
const matches = Array.from({ length: 3 }, (_, index) => ({
  id: `m${index}`, separationId: `s${index}`, title: `Pelada ${index}`, date: `2026-07-${String(index + 10).padStart(2, "0")}`,
  status: "CLOSED", seasonNumber: 1, manuallyAdjusted: false, contributionsAvailable: true,
  blueScore: 2, yellowScore: 1, winnerTeam: "BLUE", blueIds: ["a", "g"], yellowIds: ["b"],
  blue: [{ playerId: "a", position: "Ataque" }, { playerId: "g", position: "Goleiro" }], yellow: [{ playerId: "b", position: "Defesa" }],
  contributions: [{ scorerPlayerId: "a", assistPlayerId: "g", ownGoal: false }], votes: [],
}));
const data = calculateAdvancedStatistics(players, matches);

test("datas usam calendário brasileiro, validam inversão e respeitam bissextos", () => {
  assert.equal(parseDate("31/02/2026"), null);
  assert.equal(parseDate("29/02/2024"), "2024-02-29");
  assert.equal(parseDate("1/2/2026"), null);
  assert.equal(validatePeriod("02/01/2026", "01/01/2026"), null);
  assert.deepEqual(validatePeriod("01/01/2026", "01/01/2026"), { from: "2026-01-01", to: "2026-01-01" });
  assert.deepEqual(monthRange("2024-02"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(currentPeriod("month", new Date("2026-08-01T01:00:00Z")), monthRange("2026-07"));
  assert.deepEqual(currentPeriod("year", new Date("2027-01-01T01:00:00Z")), { from: "2026-01-01", to: "2026-12-31" });
});

test("parâmetros das consultas correspondem às APIs atuais e escapam nomes e IDs", () => {
  const path = statisticsPath(false, { from: "2026-07-01", to: "2026-07-31", playerA: "a&b", playerB: "g", ignored: undefined });
  const url = new URL(path, "https://test.invalid");
  assert.equal(url.pathname, "/api/public-statistics");
  assert.equal(url.searchParams.get("playerA"), "a&b");
  assert.equal(url.searchParams.has("ignored"), false);
  const advanced = new URL(statisticsPath(true, { recent: 10, minimumGames: 3, partnershipMinimumGames: 5, position: "Meio-campo", season: 2 }), "https://test.invalid");
  assert.equal(advanced.pathname, "/api/public-statistics/advanced");
  assert.equal(advanced.searchParams.get("partnershipMinimumGames"), "5");
  assert.equal(advanced.searchParams.get("position"), "Meio-campo");
});

test("rankings gerais reaproveitam dados do servidor sem alterar fontes ou incluir convidados por padrão", () => {
  const original = buildPublicStatistics(players, matches, [{ matchId: "m0", scorerPlayerId: "b" }, { matchId: "m1", scorerPlayerId: "a", assistPlayerId: "g" }]);
  const snapshot = JSON.stringify(original);
  assert.ok(sortScorers(original.leaderboard, false, "goals").every(row => row.player.type !== "guest"));
  assert.equal(sortScorers(original.leaderboard, true, "goals").length, 3);
  assert.equal(sortScorers(original.leaderboard, false, "assists")[0].player.id, "g");
  assert.equal(sortScorers(original.leaderboard, false, "goals", true)[0].player.id, "g");
  assert.ok(sortAttendance(original.attendance, false, "presences").every(row => row.player.type !== "guest"));
  assert.equal(sortAttendance(original.attendance, true, "name", true)[0].player.id, "a");
  assert.equal(JSON.stringify(original), snapshot);
});

test("premiações aguardam o fechamento do servidor e preservam o histórico antecipado", () => {
  const pending = buildMonthlyCareerHighlights(players, matches, 2026, "2026-07-20", "2026-07", "2026-12-31");
  assert.equal(closedAward(pending), null);
  assert.equal(pending.annualMvpAvailable, false);
  const ended = buildMonthlyCareerHighlights(players, matches, 2026, "2026-08-01", "2026-07", "2026-12-31");
  const saved = { ...ended.focus, playerOfMonth: { ...ended.focus.playerOfMonth, totalMomentum: 1.234 } };
  const early = buildMonthlyCareerHighlights(players, matches, 2026, "2026-07-20", "2026-07", "2026-12-31", [saved]);
  assert.equal(closedAward(early).playerOfMonth.totalMomentum, 1.234);
  assert.equal(closedAward(early, "2026-07").month, "2026-07");
  assert.equal(closedAward(early, "2026-01"), null);
  assert.ok(early.focus.selection.every(entry => entry.player.type !== "guest"));
});

test("formação aceita configuração por mês, inclusive posições vazias e mais de sete jogadores", () => {
  const award = { selection: [], formation: { goalkeepers: 1, defenders: 4, midfielders: 3, attackers: 3 } };
  assert.equal(formationRows(award).reduce((sum, row) => sum + row.slots, 0), 11);
  assert.deepEqual(formationRows(award).map(row => row.role), ["Ataque", "Meio-campo", "Defesa", "Goleiro"]);
  assert.equal(formationRows({ selection: [] }).reduce((sum, row) => sum + row.slots, 0), 7);
  assert.equal(formationRows({ selection: [], formation: { goalkeepers: 1, defenders: 0, midfielders: 1, attackers: 1 } }).length, 3);
  assert.equal(pitchColumns(224), 2);
  assert.equal(pitchColumns(224, 2), 1);
  assert.equal(pitchColumns(600), 4);
});

test("análise permite qualquer jogador, contas sem vínculo e seleção inexistente", () => {
  assert.equal(resolveStatisticsPlayer(data.players, "b", "a").player.id, "b");
  assert.equal(resolveStatisticsPlayer(data.players, "removed", "a").player.id, "a");
  assert.ok(resolveStatisticsPlayer(data.players, "", null));
  assert.equal(resolveStatisticsPlayer([], "a"), null);
  assert.equal(playerPartnerships(data.partnerships, "g")[0].playerA.id, "a");
  assert.deepEqual(playerPartnerships(data.partnerships, "removed"), []);
});

test("destaques não transformam valores nulos em zero nem mutam rankings", () => {
  const snapshot = JSON.stringify(data);
  const highlights = advancedHighlights(data);
  assert.ok(highlights.find(item => item.label === "Melhor IPI").player);
  assert.equal(highlights.find(item => item.label === "Melhor forma").value, "Sem dados");
  assert.equal(JSON.stringify(data), snapshot);
  assert.equal(fmt(null), "Sem dados");
  assert.equal(fmt(Number.NaN), "Sem dados");
  assert.equal(signed(0), "0,0");
  assert.equal(signed(1), "+1,0");
});

test("entradas acessíveis sem exigir jogador associado e sem uma nova aba inferior", async () => {
  const read = file => readFile(new URL(file, import.meta.url), "utf8");
  const layout = await read("../app/(app)/_layout.tsx");
  assert.match(layout, /name="statistics" options=\{\{ href: null/);
  for (const path of ["../app/(app)/account.tsx", "../app/(app)/matches/index.tsx"]) assert.match(await read(path), /Estatísticas da pelada/);
  assert.match(await read("../app/(app)/card.tsx"), /params: \{ player: player.id \}/);
  assert.match(await read("../src/statistics-advanced-screen.tsx"), /enabled: Boolean\(account\)/);
});
