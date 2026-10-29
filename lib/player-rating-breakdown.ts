import { attributeRating, type Config, type Player } from "./football.ts";

const finite = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export type PlayerRatingBreakdown = {
  base: number;
  evolution: number;
  resultMomentum: number;
  votingMomentum: number;
  resultMultiplier: number;
  votingMultiplier: number;
  resultImpact: number;
  votingImpact: number;
  accumulatedMomentum: number;
  momentumImpact: number;
  calculatedOverall: number;
  limitedOverall: number;
  displayedOverall: number;
  limited: boolean;
  rounded: boolean;
};

export function playerRatingBreakdown(player: Player, config: Config): PlayerRatingBreakdown {
  const base = attributeRating(player, config);
  const evolution = finite(player.careerRatingAdjustment);
  const resultMultiplier = finite(config.resultMomentumMultiplier, 1);
  const votingMultiplier = finite(config.momentumMultiplier, 1);
  const separated = player.resultMomentum != null || player.votingMomentum != null;
  const resultMomentum = separated ? finite(player.resultMomentum) : 0;
  const votingMomentum = separated ? finite(player.votingMomentum) : finite(player.momentum);
  const resultImpact = resultMomentum * resultMultiplier;
  const votingImpact = votingMomentum * votingMultiplier;
  const accumulatedMomentum = separated ? resultMomentum + votingMomentum : finite(player.momentum);
  const momentumImpact = resultImpact + votingImpact;
  const calculatedOverall = base + evolution + momentumImpact;
  const limitedOverall = Math.max(1, Math.min(5, calculatedOverall));
  const displayedOverall = Math.round(limitedOverall * 10) / 10;
  return {
    base, evolution, resultMomentum, votingMomentum, resultMultiplier, votingMultiplier,
    resultImpact, votingImpact, accumulatedMomentum, momentumImpact, calculatedOverall,
    limitedOverall, displayedOverall,
    limited: Math.abs(limitedOverall - calculatedOverall) > 0.0001,
    rounded: Math.abs(displayedOverall - limitedOverall) > 0.0001,
  };
}
