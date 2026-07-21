import assert from "node:assert/strict";
import test from "node:test";
import { publicSeparation } from "../lib/public-separation.ts";

test("expõe o resultado consolidado quando a votação foi encerrada", () => {
  const results = {
    voteCount: 13,
    motm: [{ playerId: "blue-1", points: 20, firstVotes: 5, secondVotes: 2, thirdVotes: 1, place: 1, momentum: 0.3 }],
    dotm: [{ playerId: "yellow-1", points: 18, firstVotes: 4, secondVotes: 3, thirdVotes: 0, place: 1, momentum: -0.3 }],
  };
  const separation = publicSeparation({
    id: "separation-1",
    match_title: "PELADA - 19/07 Batista",
    snapshot: JSON.stringify({
      blue: [{ id: "blue-1", displayName: "William" }],
      yellow: [{ id: "yellow-1", displayName: "Mateus" }],
    }),
    confirmed_at: "2026-07-18T12:00:00.000Z",
    career_id: "career-1",
    career_blue_score: 1,
    career_yellow_score: 3,
    career_winner_team: "YELLOW",
    career_voting_token: "token",
    career_status: "CLOSED",
    career_closes_at: "2026-07-23T12:00:00.000Z",
    career_closed_at: "2026-07-21T13:00:00.000Z",
    career_config_snapshot: "{}",
    career_results_snapshot: JSON.stringify(results),
  });

  assert.equal(separation.career.status, "CLOSED");
  assert.equal(separation.career.closedAt, "2026-07-21T13:00:00.000Z");
  assert.deepEqual(separation.career.results, results);
});
