import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildHallOfFame } from "../lib/hall-of-fame.ts";

const ana = { id: "ana", displayName: "Ana", photoUrl: null, primaryPosition: "Ataque", active: true };
const bia = { id: "bia", displayName: "Bia", photoUrl: null, primaryPosition: "Defesa", active: true };

test("monta ídolos, classes, recordes e momentos a partir do histórico oficial", () => {
  const matches = Array.from({ length: 10 }, (_, index) => ({
    id: `career-${index + 1}`, separationId: `match-${index + 1}`, title: "Pelada", date: `2026-${String(index + 1).padStart(2, "0")}-10`, seasonNumber: 1, status: "CLOSED",
    blueScore: 2, yellowScore: 1, winnerTeam: "BLUE", blue: [ana], yellow: [bia],
    contributions: [{ scorerPlayerId: "ana", assistPlayerId: "ana" }],
    results: { motm: [{ playerId: index === 9 ? "bia" : "ana", place: 1 }], partner: [{ playerId: "ana" }], fairPlay: [], defense: [] },
  }));
  const hall = buildHallOfFame({
    players: [ana, bia], matches,
    seasonAwards: [{ seasonNumber: 1, endedAt: "2026-12-31", annualMvp: [{ place: 1, player: ana }, { place: 2, player: bia }] }],
    achievements: [
      { id: "social_10", playerId: "ana", title: "Ídolo da pelada", description: "Dez reconhecimentos.", icon: "💎", achievedAt: "2026-10-10", matchId: "match-10" },
      { id: "motm_in_defeat", playerId: "bia", title: "Craque até na derrota", description: "Eleita craque na derrota.", icon: "🦁", achievedAt: "2026-10-10", matchId: "match-10" },
    ],
  });
  assert.equal(hall.featured[0].title, "Ídolo da Pelada");
  assert.equal(hall.featured[0].player.id, "ana");
  assert.equal(hall.classes[0].members.length, 2);
  assert.equal(hall.records.find(item => item.id === "games")?.value, 10);
  assert.equal(hall.records.find(item => item.id === "socialAwards")?.players[0].id, "ana");
  assert.equal(hall.moments[0].player.id, "ana");
  assert.equal(hall.summary.inductedPlayers, 2);
});

test("layouts do Hall usam a paleta configurável e reduzem colunas no celular", async () => {
  const [css, site, mobile] = await Promise.all([
    readFile(new URL("../app/hall-da-fama/hall-of-fame.css", import.meta.url), "utf8"),
    readFile(new URL("../app/hall-da-fama/HallOfFameApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/app/(app)/hall-of-fame.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /var\(--management-background\)/);
  assert.match(css, /var\(--management-surface\)/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(site, /SiteHeader active="hall"/);
  assert.match(site, /hall\.availableSeasons/);
  assert.match(mobile, /useMobileBranding/);
  assert.match(mobile, /flexBasis:"46%"/);
});
