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
    manualHonors: [{ id: "special-bia", playerId: "bia", title: "Fundadora da pelada", reason: "Ajudou a construir a história do grupo.", seasonNumber: 1, createdAt: "2026-12-31" }],
  });
  assert.equal(hall.featured[0].title, "Ídolo da Pelada");
  assert.equal(hall.featured[0].player.id, "ana");
  assert.equal(hall.classes[0].members.length, 2);
  assert.equal(hall.records.find(item => item.id === "games")?.value, 10);
  assert.equal(hall.records.find(item => item.id === "socialAwards")?.players[0].id, "ana");
  assert.equal(hall.moments[0].player.id, "ana");
  assert.equal(hall.summary.inductedPlayers, 2);
  assert.equal(hall.featured.some(item => item.id === "manual:special-bia" && item.title === "Fundadora da pelada"), true);
  assert.equal(hall.collectiveMilestones.some(item => item.id === "collective-matches-10"), true);
  assert.equal(hall.collectiveProgress.length, 3);
});

test("layouts do Hall usam a paleta configurável e reduzem colunas no celular", async () => {
  const [css, site, mobile, admin, adminApi, globals] = await Promise.all([
    readFile(new URL("../app/hall-da-fama/hall-of-fame.css", import.meta.url), "utf8"),
    readFile(new URL("../app/hall-da-fama/HallOfFameApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/app/(app)/hall-of-fame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/hall-of-fame/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(css, /var\(--management-background\)/);
  assert.match(css, /var\(--management-surface\)/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(site, /SiteHeader active="hall"/);
  assert.match(site, /<PlayerPhoto[^>]*large hoverPreview previewSize=\{360\}/);
  assert.match(css, /\.hall-featured-card>\.player-avatar-wrap\.has-preview\{[^}]*cursor:zoom-in/);
  assert.match(site, /hall\.availableSeasons/);
  assert.match(mobile, /useMobileBranding/);
  assert.match(mobile, /flexBasis:"46%"/);
  assert.match(mobile, /API_BASE_URL.*apiFetch/);
  assert.match(mobile, /\^https\?:\\\/\\\//);
  assert.match(mobile, /player\.photoUrl\.startsWith\("\/"\)/);
  assert.match(mobile, /onError=\{\(\)=>setFailedUri\(uri\)\}/);
  assert.match(site, /hall\.collectiveMilestones/);
  assert.match(mobile, /collectiveProgress/);
  assert.match(admin, /Homenagens especiais/);
  assert.match(admin, /className="wide hall-admin-reason"/);
  assert.equal((admin.match(/className="hall-admin-main-field"/g) || []).length, 2);
  assert.match(globals, /\.hall-admin-main-field input\{[^}]*min-height:58px[^}]*border:1px solid[^}]*font-size:12px[^}]*font-weight:700/);
  assert.match(globals, /\.hall-admin-reason textarea\{[^}]*border:1px solid[^}]*border-radius:10px[^}]*padding:13px/);
  assert.match(adminApi, /HALL_OF_FAME_HONOR_CREATED/);
});
