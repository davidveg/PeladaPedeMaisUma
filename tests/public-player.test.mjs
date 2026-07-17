import assert from "node:assert/strict";
import test from "node:test";
import { publicPlayer } from "../lib/public-player.ts";

test("jogador público expõe apenas dados esportivos", () => {
  const player = publicPlayer({
    id: "player-one",
    full_name: "Nome civil privado",
    display_name: "Marcos",
    nickname: "Apelido interno",
    notes: "Observação administrativa",
    type: "monthly",
    primary_position: "Defesa",
    speed: 4.1,
    skill: 3.8,
    marking: 4.3,
    goalkeeper_positioning: 3,
    goal_exit: 3,
    momentum: .2,
    photo_url: "/api/upload?id=photo",
  });

  assert.equal(player.displayName, "Marcos");
  assert.equal(player.fullName, "Marcos");
  assert.equal(player.primaryPosition, "Defesa");
  assert.equal(player.momentum, .2);
  assert.equal(player.photoUrl, "/api/upload?id=photo");
  assert.equal(player.notes, undefined);
  assert.equal(player.nickname, undefined);
});
