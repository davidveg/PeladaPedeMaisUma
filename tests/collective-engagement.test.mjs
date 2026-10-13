import assert from "node:assert/strict";
import test from "node:test";
import { buildCollectiveEngagement } from "../lib/collective-engagement.ts";
import { buildRoundRecaps } from "../lib/player-engagement.ts";

const players = Array.from({ length: 12 }, (_, index) => ({ id: `p-${index + 1}`, displayName: `Jogador ${index + 1}` }));

function matches(total, seasonNumber = 3) {
  return Array.from({ length: total }, (_, index) => ({
    id: `career-${index + 1}`,
    separationId: `separation-${index + 1}`,
    title: `Rodada ${index + 1}`,
    date: new Date(Date.UTC(2024, 0, 6 + index * 7)).toISOString().slice(0, 10),
    seasonNumber,
    status: "CLOSED",
    blueScore: 2,
    yellowScore: 2,
    winnerTeam: "DRAW",
    blue: players.slice(0, 6),
    yellow: players.slice(6),
    contributions: [],
    results: null,
  }));
}

test("calcula metas coletivas e registra somente os limiares cruzados", () => {
  const result = buildCollectiveEngagement(matches(25), 3, new Date("2026-02-01T12:00:00Z"));
  assert.deepEqual(result.summary, { officialMatches: 25, totalGoals: 100, differentPlayers: 12, attendanceRecord: 12, seasonMatches: 25 });
  assert.ok(result.milestones.some(item => item.id === "collective-matches-25" && item.separationId === "separation-25"));
  assert.ok(result.milestones.some(item => item.id === "collective-goals-100" && item.separationId === "separation-25"));
  assert.ok(result.milestones.some(item => item.id === "collective-players-10"));
  assert.ok(result.milestones.some(item => item.id === "collective-season-3-matches-20"));
  assert.ok(result.milestones.some(item => item.id === "collective-anniversary-2"));
  assert.equal(result.progress.length, 3);
  assert.ok(result.progress.every(item => item.target > item.current && item.remaining === item.target - item.current));
});

test("recalcula a linha histórica sem duplicar marcos quando a súmula muda", () => {
  const original = matches(25);
  const first = buildCollectiveEngagement(original, 3, new Date("2024-12-01T12:00:00Z"));
  const corrected = original.map((match, index) => index === 0 ? { ...match, blueScore: 0, yellowScore: 0 } : match);
  const second = buildCollectiveEngagement(corrected, 3, new Date("2024-12-01T12:00:00Z"));
  assert.equal(first.milestones.filter(item => item.id === "collective-goals-100").length, 1);
  assert.equal(second.milestones.some(item => item.id === "collective-goals-100"), false);
  assert.equal(second.summary.totalGoals, 96);
});

test("leva o marco coletivo para a resenha e o texto compartilhável", () => {
  const history = matches(10);
  const recaps = buildRoundRecaps({ matches: history, siteName: "Pelada Teste" });
  const recap = recaps["separation-10"];
  assert.ok(recap.collectiveMilestones.some(item => item.id === "collective-matches-10"));
  assert.ok(recap.collectiveMilestones.some(item => item.id === "collective-season-3-matches-10"));
  assert.ok(recap.stories.some(item => item.kind === "collective"));
  assert.match(recap.shareText, /10 partidas oficiais/);
});
