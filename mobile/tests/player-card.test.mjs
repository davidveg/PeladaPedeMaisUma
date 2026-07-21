import assert from "node:assert/strict";
import test from "node:test";
import { playerCardTier, playerOverall } from "../src/player-card.ts";

const config = {
  speedWeight: 0.48,
  skillWeight: 0.32,
  markingWeight: 0.2,
  momentumMultiplier: 1,
  showContributions: true,
  cardTiersEnabled: true,
  cardBronzeMax: 2.4,
  cardSilverMax: 3.9,
  cardGoldMax: 4.5,
};

test("aplica os níveis configurados ao overall arredondado", () => {
  assert.equal(playerCardTier(2.4, config), "bronze");
  assert.equal(playerCardTier(3.9, config), "silver");
  assert.equal(playerCardTier(4.5, config), "gold");
  assert.equal(playerCardTier(4.6, config), "legendary");
});

test("mantém o visual padrão quando cards por nível estão desativados", () => {
  assert.equal(playerCardTier(4.8, { ...config, cardTiersEnabled: false }), "default");
});

test("calcula o overall com pesos e momentum do modo carreira", () => {
  const player = { id: "1", displayName: "Jogador", type: "monthly", primaryPosition: "Defesa", speed: 4, skill: 4, marking: 4, momentum: 0.2 };
  assert.equal(playerOverall(player, config), 4.2);
});
