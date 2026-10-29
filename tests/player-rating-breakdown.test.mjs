import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig, score } from "../lib/football.ts";
import { playerRatingBreakdown } from "../lib/player-rating-breakdown.ts";

const player = { id: "breakdown", fullName: "Jogador", displayName: "Jogador", type: "monthly", primaryPosition: "Defesa", speed: 4, skill: 4, marking: 4, tacticalIntelligence: 4, competitiveness: 4, careerRatingAdjustment: .1, momentum: .6, resultMomentum: .4, votingMomentum: .2 };

test("detalha os dois pesos de Momentum sem divergir do Overall", () => {
  const config = { ...defaultConfig, resultMomentumMultiplier: .5, momentumMultiplier: .25 };
  const result = playerRatingBreakdown(player, config);
  assert.equal(result.resultImpact, .2);
  assert.equal(result.votingImpact, .05);
  assert.equal(result.momentumImpact, .25);
  assert.ok(Math.abs(result.accumulatedMomentum - .6) < 1e-9);
  assert.equal(result.displayedOverall, score(player, config));
});

test("expõe arredondamento e limite da escala na composição", () => {
  const rounded = playerRatingBreakdown({ ...player, speed: 3.96, skill: 3.96, marking: 3.96, tacticalIntelligence: 3.96, competitiveness: 3.96, careerRatingAdjustment: 0, resultMomentum: 0, votingMomentum: 0 }, defaultConfig);
  assert.equal(rounded.displayedOverall, 4);
  assert.equal(rounded.rounded, true);
  const limited = playerRatingBreakdown({ ...player, speed: 5, skill: 5, marking: 5, tacticalIntelligence: 5, competitiveness: 5, resultMomentum: 1, votingMomentum: 1 }, defaultConfig);
  assert.equal(limited.displayedOverall, 5);
  assert.equal(limited.limited, true);
});
