import assert from "node:assert/strict";
import test from "node:test";
import { filterPlayerDirectory } from "../lib/player-directory-filters.ts";

const players = [
  { id: "1", displayName: "João Silva", fullName: "João da Silva", nickname: "Jão", aliases: [], type: "monthly", primaryPosition: "Ataque", secondaryPosition: "Meio-campo" },
  { id: "2", displayName: "Carlos", fullName: "Carlos Souza", nickname: null, aliases: ["Carlinhos"], type: "guest", primaryPosition: "Defesa", secondaryPosition: null },
  { id: "3", displayName: "Marcos", fullName: "Marcos Lima", nickname: null, aliases: [], type: "goalkeeper", primaryPosition: "Goleiro", secondaryPosition: null },
];

test("filtra jogadores por nome sem diferenciar acentos", () => {
  assert.deepEqual(filterPlayerDirectory(players, { name: "jao", position: "", type: "" }).map(player => player.id), ["1"]);
  assert.deepEqual(filterPlayerDirectory(players, { name: "carlinhos", position: "", type: "" }).map(player => player.id), ["2"]);
});

test("combina filtros de posição principal ou secundária e tipo", () => {
  assert.deepEqual(filterPlayerDirectory(players, { name: "", position: "Meio-campo", type: "monthly" }).map(player => player.id), ["1"]);
  assert.deepEqual(filterPlayerDirectory(players, { name: "", position: "Defesa", type: "monthly" }), []);
  assert.deepEqual(filterPlayerDirectory(players, { name: "", position: "Goleiro", type: "goalkeeper" }).map(player => player.id), ["3"]);
});
