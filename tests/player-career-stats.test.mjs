import assert from "node:assert/strict";
import test from "node:test";
import { calculatePlayerCareerStats } from "../lib/player-career-stats.ts";

test("contabiliza somente partidas com placar registrado no histórico de carreira", () => {
  const rows = [
    { winner_team: "BLUE", snapshot: JSON.stringify({ blue: [{ id: "ana" }, { id: "bia" }], yellow: [{ id: "carla" }] }) },
    { winner_team: "DRAW", snapshot: JSON.stringify({ blue: [{ id: "carla" }], yellow: [{ id: "ana" }] }) },
    { winner_team: "BLUE", snapshot: JSON.stringify({ blue: [{ id: "bia" }], yellow: [{ id: "ana" }] }) },
  ];

  const stats = calculatePlayerCareerStats(rows);

  assert.deepEqual(stats.ana, { games: 3, wins: 1, losses: 1 });
  assert.deepEqual(stats.bia, { games: 2, wins: 2, losses: 0 });
  assert.deepEqual(stats.carla, { games: 2, wins: 0, losses: 1 });
  assert.equal(stats.daniela, undefined);
});

test("ignora snapshots inválidos e não duplica jogador na mesma partida", () => {
  const stats = calculatePlayerCareerStats([
    { winner_team: "YELLOW", snapshot: "inválido" },
    { winner_team: "YELLOW", snapshot: { blue: [{ id: "ana" }, { id: "ana" }], yellow: [{ id: "bia" }] } },
  ]);

  assert.deepEqual(stats.ana, { games: 1, wins: 0, losses: 1 });
  assert.deepEqual(stats.bia, { games: 1, wins: 1, losses: 0 });
});
