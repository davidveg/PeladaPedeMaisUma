import assert from "node:assert/strict";
import test from "node:test";
import { publicSeparation } from "../lib/public-separation.ts";

test("snapshot público preserva times e regras sem expor a lista original", () => {
  const snapshot = { blue: [{ id: "blue-player", displayName: "Azul", speed: 4 }], yellow: [{ id: "yellow-player", displayName: "Amarelo", speed: 3 }], speedWeight: .48, skillWeight: .32, markingWeight: .2, maximumPositionDifference: 1, protectedTopPlayersPercentage: .25, algorithmAttempts: 2500 };
  const result = publicSeparation({
    id: "one",
    match_title: "Pelada pública",
    match_date: "2026-07-14",
    location: null,
    original_text: "lista privada do WhatsApp",
    snapshot: JSON.stringify(snapshot),
    balance_classification: "Excelente equilíbrio",
    balance_score: 0,
    confirmed_at: "2026-07-14T12:00:00.000Z",
    manually_adjusted: 0,
    career_id: "career-one",
    career_blue_score: 3,
    career_yellow_score: 1,
    career_winner_team: "BLUE",
    career_voting_token: "token",
    career_status: "OPEN",
    career_closes_at: "2026-07-19T12:00:00.000Z",
    career_closed_at: null,
    career_config_snapshot: JSON.stringify({ winnerBonus: .1, loserPenalty: -.1, votingDays: 5 }),
    career_results_snapshot: null,
    deleted_at: null,
  }, { "blue-player": { games: 4, wins: 3, losses: 1 } });
  assert.equal(result.matchTitle, "Pelada pública");
  assert.equal(result.snapshot.blue[0].displayName, "Azul");
  assert.equal(result.snapshot.markingWeight, .2);
  assert.equal(result.snapshot.maximumPositionDifference, 1);
  assert.equal(result.snapshot.algorithmAttempts, 2500);
  assert.deepEqual(result.snapshot.blue[0].careerStats, { games: 4, wins: 3, losses: 1 });
  assert.deepEqual(result.snapshot.yellow[0].careerStats, { games: 0, wins: 0, losses: 0 });
  assert.equal(result.originalText, undefined);
  assert.equal(result.original_text, undefined);
  assert.equal(result.deleted_at, undefined);
  assert.equal(result.career.blueScore, 3);
  assert.equal(result.career.winnerTeam, "BLUE");
  assert.equal(result.career.config.votingDays, 5);
});
