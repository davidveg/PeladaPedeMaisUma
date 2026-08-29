import type { StatisticsPosition } from "./statistics-types.ts";

export const STATISTICS_VERSION = 1;
export const DEFAULT_RECENT_WINDOW = 5 as const;
export const DEFAULT_PARTNERSHIP_MINIMUM_GAMES = 3;
export const BLOWOUT_GOAL_DIFFERENCE = 4;
export const HIGH_CONFIDENCE_GAMES = 15;
export const MEDIUM_CONFIDENCE_GAMES = 5;

export type IpiWeights = {
  result: number;
  impact: number;
  offense: number;
  consistency: number;
  form: number;
  peerRating: number;
};

export const IPI_WEIGHTS: Record<StatisticsPosition, IpiWeights> = {
  Goleiro: { result: .27, impact: .31, offense: .02, consistency: .18, form: .14, peerRating: .08 },
  Defesa: { result: .22, impact: .28, offense: .08, consistency: .17, form: .15, peerRating: .10 },
  "Meio-campo": { result: .18, impact: .20, offense: .22, consistency: .15, form: .15, peerRating: .10 },
  Ataque: { result: .17, impact: .15, offense: .30, consistency: .13, form: .15, peerRating: .10 },
};

export const OFFENSIVE_WEIGHTS: Record<StatisticsPosition, { goals: number; assists: number }> = {
  Goleiro: { goals: .2, assists: .8 },
  Defesa: { goals: .45, assists: .55 },
  "Meio-campo": { goals: .35, assists: .65 },
  Ataque: { goals: .7, assists: .3 },
};
