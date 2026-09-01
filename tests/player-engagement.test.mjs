import assert from "node:assert/strict";
import test from "node:test";
import { buildPlayerEngagement, buildRoundRecaps } from "../lib/player-engagement.ts";

const players = {
  ana: { id: "ana", displayName: "Ana" },
  bia: { id: "bia", displayName: "Bia" },
  caio: { id: "caio", displayName: "Caio" },
  dani: { id: "dani", displayName: "Dani" },
};

function match(id, date, winnerTeam, contributions = [], results = null) {
  return {
    id: `career-${id}`, separationId: `separation-${id}`, title: `Rodada ${id}`, date,
    seasonNumber: 2, status: results ? "CLOSED" : "OPEN", blueScore: winnerTeam === "BLUE" ? 3 : 1,
    yellowScore: winnerTeam === "YELLOW" ? 3 : 1, winnerTeam,
    blue: [players.ana, players.bia], yellow: [players.caio, players.dani], contributions, results,
  };
}

const history = [
  match("one", "2026-01-10", "BLUE", [
    { scorerPlayerId: "ana", assistPlayerId: "bia" },
    { scorerPlayerId: "ana", assistPlayerId: "bia" },
    { scorerPlayerId: "ana", assistPlayerId: "bia" },
  ], { motm: [{ playerId: "ana", place: 1 }] }),
  match("two", "2026-01-17", "BLUE", [{ scorerPlayerId: "ana", assistPlayerId: "bia" }]),
  match("three", "2026-01-24", "BLUE", [{ scorerPlayerId: "ana" }]),
];

test("gera conquistas permanentes e progresso a partir do histórico oficial", () => {
  const result = buildPlayerEngagement({
    player: players.ana,
    matches: history,
    currentSeasonNumber: 2,
    seasonStartedAt: "2026-01-01",
    nextSeasonResetAt: "2027-01-01",
    monthlyAwards: [{ month: "2026-01", playerOfMonth: { player: players.ana }, selection: [{ player: players.ana }] }],
  });

  const ids = result.achievements.unlocked.map(item => item.id);
  assert.ok(ids.includes("games_1"));
  assert.ok(ids.includes("goals_1"));
  assert.ok(ids.includes("hat_trick"));
  assert.ok(ids.includes("winning_streak_3"));
  assert.ok(ids.includes("player_of_month_first"));
  assert.equal(result.achievements.next.find(item => item.id === "games")?.target, 10);
});

test("resume a temporada pessoal com parceria, votação e números esportivos", () => {
  const result = buildPlayerEngagement({ player: players.ana, matches: history, currentSeasonNumber: 2 });
  const season = result.retrospective;
  assert.equal(season.games, 3);
  assert.equal(season.wins, 3);
  assert.equal(season.goals, 5);
  assert.equal(season.bestGoalsInMatch, 3);
  assert.equal(season.bestWinningStreak, 3);
  assert.equal(season.motmAwards, 1);
  assert.deepEqual(season.topPartner, { id: "bia", displayName: "Bia", games: 3 });
  assert.match(season.shareText, /Retrospectiva de Ana/);
});

test("monta a resenha automática com placar, destaques e marcos da rodada", () => {
  const recaps = buildRoundRecaps({ matches: history, siteName: "Pelada Teste", teamBlueName: "Verde", teamYellowName: "Branco" });
  const recap = recaps["career-one"];
  assert.equal(recaps["separation-one"], recap);
  assert.equal(recap.headline, "Verde venceu por 3 × 1");
  assert.equal(recap.result.totalGoals, 4);
  assert.equal(recap.date, "2026-01-10");
  assert.ok(recap.stories.some(item => item.kind === "goals"));
  assert.ok(recap.highlights.some(item => item.includes("Ana liderou com 3 gols")));
  assert.ok(recap.highlights.some(item => item.includes("Man of the Match")));
  assert.ok(recap.milestones.some(item => item.title === "Hat-trick"));
  assert.equal(recap.milestones.find(item => item.title === "Hat-trick")?.playerName, "Ana");
  assert.equal(recap.milestones.find(item => item.title === "Hat-trick")?.playerId, "ana");
  assert.match(recap.shareText, /Resenha da rodada/);
});

test("destaca recordes de gols e de diferença no placar no jornal da partida", () => {
  const recordMatch = { ...match("record", "2026-01-31", "BLUE"), blueScore: 8, yellowScore: 1 };
  const recaps = buildRoundRecaps({ matches: [...history, recordMatch], teamBlueName: "Verde", teamYellowName: "Branco" });
  assert.ok(recaps[recordMatch.id].records.some(item => item.includes("recorde de gols")));
  assert.ok(recaps[recordMatch.id].records.some(item => item.includes("Maior diferença")));
  assert.ok(recaps[recordMatch.id].stories.some(item => item.kind === "record"));
});
