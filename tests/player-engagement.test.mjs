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
  ], { motm: [{ playerId: "ana", place: 1 }], partner: [{ playerId: "bia" }], fairPlay: [{ playerId: "caio" }], defense: [{ playerId: "dani" }] }),
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
  assert.equal(season.partnerAwards, 0);
  assert.equal(season.fairPlayAwards, 0);
  assert.equal(season.defenseAwards, 0);
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
  assert.ok(recap.highlights.some(item => item.includes("Parceiro da rodada")));
  assert.ok(recap.stories.some(item => item.kind === "recognition" && item.label === "Defesa da rodada"));
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

test("libera feitos especiais de atuação, placar e votação", () => {
  const complete = {
    ...match("complete", "2026-02-01", "BLUE", [
      { scorerPlayerId: "ana" }, { scorerPlayerId: "ana" },
      { scorerPlayerId: "bia", assistPlayerId: "ana" }, { scorerPlayerId: "bia", assistPlayerId: "ana" },
    ]),
    blueScore: 4, yellowScore: 3,
  };
  const defeat = {
    ...match("defeat", "2026-02-08", "YELLOW", [{ scorerPlayerId: "ana" }, { scorerPlayerId: "ana" }], { motm: [{ playerId: "ana", place: 1 }] }),
    blueScore: 2, yellowScore: 3,
  };
  const draw = { ...match("draw", "2026-02-15", "DRAW", [], { motm: [{ playerId: "ana", place: 1 }] }), blueScore: 2, yellowScore: 2 };
  const fiveGoals = { ...match("five", "2026-02-22", "BLUE", Array.from({ length: 5 }, () => ({ scorerPlayerId: "ana" }))), blueScore: 5, yellowScore: 1 };
  const sweep = match("sweep", "2026-03-01", "BLUE", [], {
    motm: [{ playerId: "ana", place: 1 }], partner: [{ playerId: "ana" }], fairPlay: [{ playerId: "ana" }], defense: [{ playerId: "ana" }],
  });
  const result = buildPlayerEngagement({ player: players.ana, matches: [complete, defeat, draw, fiveGoals, sweep], currentSeasonNumber: 2 });
  const ids = new Set(result.achievements.unlocked.map(item => item.id));
  for (const id of ["complete_match", "complete_show", "owned_attack", "fine_margin", "perfect_connection", "fought_to_end", "motm_in_defeat", "motm_in_draw", "poker", "manita", "complete_highlight", "partner_first", "fair_play_first", "defense_first", "round_favorite", "social_sweep"]) assert.ok(ids.has(id), id);
});

test("libera sequências e coleções cumulativas", () => {
  const losses = [1, 2, 3].map(index => match(`loss-${index}`, `2026-04-0${index}`, "YELLOW"));
  const run = Array.from({ length: 10 }, (_, index) => match(`run-${index}`, `2026-04-${String(index + 4).padStart(2, "0")}`, index ? "DRAW" : "BLUE", [], {
    motm: [{ playerId: "ana", place: 1 }], partner: [{ playerId: "ana" }], fairPlay: [{ playerId: "ana" }], defense: [{ playerId: "ana" }],
  }));
  const result = buildPlayerEngagement({ player: players.ana, matches: [...losses, ...run], currentSeasonNumber: 2 });
  const ids = new Set(result.achievements.unlocked.map(item => item.id));
  for (const id of ["turned_the_tide", "attendance_10", "unbeaten_5", "unbeaten_10", "motm_3", "motm_5", "social_5", "social_10"]) assert.ok(ids.has(id), id);
});

test("temporada perfeita exige pelo menos 95% de assiduidade e temporada encerrada", () => {
  const season = Array.from({ length: 20 }, (_, index) => ({ ...match(`season-${index}`, `2026-05-${String(index + 1).padStart(2, "0")}`, "BLUE"), seasonNumber: 4 }));
  season[19] = { ...season[19], blue: season[19].blue.filter(player => player.id !== "ana") };
  const closed = [{ seasonNumber: 4, endedAt: "2026-06-01", annualMvp: [] }];
  const qualified = buildPlayerEngagement({ player: players.ana, matches: season, currentSeasonNumber: 5, seasonAwards: closed });
  assert.match(qualified.achievements.unlocked.find(item => item.id === "perfect_season_4")?.description || "", /19 das 20.*95%/);

  season[18] = { ...season[18], blue: season[18].blue.filter(player => player.id !== "ana") };
  const below = buildPlayerEngagement({ player: players.ana, matches: season, currentSeasonNumber: 5, seasonAwards: closed });
  assert.equal(below.achievements.unlocked.some(item => item.id === "perfect_season_4"), false);
  const open = buildPlayerEngagement({ player: players.ana, matches: season.slice(0, 19), currentSeasonNumber: 4, seasonAwards: [] });
  assert.equal(open.achievements.unlocked.some(item => item.id === "perfect_season_4"), false);
});
