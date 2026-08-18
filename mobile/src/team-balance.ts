import type { Player, TeamDelta, TeamMetrics, TeamResult } from "./types";

function playerMomentumContribution(player: Player, votingMultiplier: number, resultMultiplier: number) {
  const hasSeparatedSources = player.resultMomentum != null || player.votingMomentum != null;
  if (!hasSeparatedSources) return (player.momentum ?? 0) * votingMultiplier;
  return (player.resultMomentum ?? 0) * resultMultiplier + (player.votingMomentum ?? 0) * votingMultiplier;
}

function attributes(player: Player) {
  const goalkeeper = player.type === "goalkeeper" || player.primaryPosition === "Goleiro";
  return {
    speed: goalkeeper ? player.goalkeeperPositioning ?? player.speed : player.speed,
    skill: player.skill,
    marking: goalkeeper ? player.goalExit ?? player.marking ?? 3 : player.marking ?? 3,
    tacticalIntelligence: goalkeeper ? player.goalkeeperSafety ?? 3 : player.tacticalIntelligence ?? 3,
    competitiveness: goalkeeper ? player.goalkeeperLeadership ?? 3 : player.competitiveness ?? 3,
  };
}

function historicalLearningContribution(player: Player, result: TeamResult) {
  return result.historicalLearningEnabled ? Number(player.historicalPerformance?.adjustment ?? 0) : 0;
}

function playerScore(player: Player, result: TeamResult) {
  const value = attributes(player);
  const goalkeeper=player.type==="goalkeeper"||player.primaryPosition==="Goleiro";
  const modern=result.ratingSystemVersion===2||result.tacticalIntelligenceWeight!=null;
  const base=!modern?value.speed*Number(result.speedWeight??.48)+value.skill*Number(result.skillWeight??.32)+value.marking*Number(result.markingWeight??.2):goalkeeper
    ?value.skill*Number(result.goalkeeperDefensesWeight??.4)+value.speed*Number(result.goalkeeperPositioningWeight??.25)+value.tacticalIntelligence*Number(result.goalkeeperSafetyWeight??.2)+value.marking*Number(result.goalkeeperFootworkWeight??.1)+value.competitiveness*Number(result.goalkeeperLeadershipWeight??.05)
    :value.speed*Number(result.speedWeight??.35)+value.skill*Number(result.skillWeight??.25)+value.marking*Number(result.markingWeight??.15)+value.tacticalIntelligence*Number(result.tacticalIntelligenceWeight??.2)+value.competitiveness*Number(result.competitivenessWeight??.05);
  const raw = base
    + playerMomentumContribution(player, Number(result.momentumMultiplier ?? 1), Number(result.resultMomentumMultiplier ?? 1));
  return Math.round(Math.max(1, Math.min(5, raw)) * 10) / 10;
}

export function calculateMobileTeamMetrics(team: Player[], result: TeamResult): TeamMetrics {
  const positions = { Defesa: 0, "Meio-campo": 0, Ataque: 0, Goleiro: 0 };
  let speed = 0, skill = 0, marking = 0, tacticalIntelligence=0, competitiveness=0, momentum = 0, historicalLearning = 0, total = 0;
  for (const player of team) {
    if (player.primaryPosition in positions) positions[player.primaryPosition as keyof typeof positions]++;
    const value = attributes(player);
    speed += value.speed;
    skill += value.skill;
    marking += value.marking;
    tacticalIntelligence += value.tacticalIntelligence;
    competitiveness += value.competitiveness;
    momentum += playerMomentumContribution(player, Number(result.momentumMultiplier ?? 1), Number(result.resultMomentumMultiplier ?? 1));
    historicalLearning += historicalLearningContribution(player, result);
    total += playerScore(player, result);
  }
  const count = team.length, average = (value: number) => count ? value / count : 0, balancingTotal = total + historicalLearning;
  return { count, positions, speed, skill, marking, tacticalIntelligence, competitiveness, momentum, historicalLearning, total, balancingTotal, speedAvg: average(speed), skillAvg: average(skill), markingAvg: average(marking), tacticalIntelligenceAvg:average(tacticalIntelligence), competitivenessAvg:average(competitiveness), momentumAvg: average(momentum), historicalLearningAvg:average(historicalLearning), scoreAvg: average(total), balancingScoreAvg:average(balancingTotal) };
}

export function balanceRating(cost: number) {
  return cost < 35 ? "Excelente equilíbrio" : cost < 80 ? "Bom equilíbrio" : cost < 150 ? "Equilíbrio aceitável" : "Equilíbrio limitado";
}

export function recalculateTeamResult(result: TeamResult, blue: Player[], yellow: Player[]): TeamResult {
  const blueMetrics = calculateMobileTeamMetrics(blue, result), yellowMetrics = calculateMobileTeamMetrics(yellow, result);
  const advantage = (blueValue: number, yellowValue: number) => blueValue === yellowValue ? "EVEN" as const : blueValue > yellowValue ? "BLUE" as const : "YELLOW" as const;
  const delta: TeamDelta = {
    players: Math.abs(blueMetrics.count - yellowMetrics.count),
    defenders: Math.abs(blueMetrics.positions.Defesa - yellowMetrics.positions.Defesa),
    midfielders: Math.abs(blueMetrics.positions["Meio-campo"] - yellowMetrics.positions["Meio-campo"]),
    attackers: Math.abs(blueMetrics.positions.Ataque - yellowMetrics.positions.Ataque),
    speed: Math.abs(blueMetrics.speed - yellowMetrics.speed),
    skill: Math.abs(blueMetrics.skill - yellowMetrics.skill),
    marking: Math.abs(blueMetrics.marking - yellowMetrics.marking),
    tacticalIntelligence:Math.abs(blueMetrics.tacticalIntelligence-yellowMetrics.tacticalIntelligence),
    competitiveness:Math.abs(blueMetrics.competitiveness-yellowMetrics.competitiveness),
    momentum: Math.abs(blueMetrics.momentum - yellowMetrics.momentum),
    historicalLearning: Math.abs(Number(blueMetrics.historicalLearning ?? 0) - Number(yellowMetrics.historicalLearning ?? 0)),
    score: Math.abs(blueMetrics.total - yellowMetrics.total),
    balancingScore: Math.abs(Number(blueMetrics.balancingTotal ?? blueMetrics.total) - Number(yellowMetrics.balancingTotal ?? yellowMetrics.total)),
    advantage: {
      players: advantage(blueMetrics.count, yellowMetrics.count), defenders: advantage(blueMetrics.positions.Defesa, yellowMetrics.positions.Defesa),
      midfielders: advantage(blueMetrics.positions["Meio-campo"], yellowMetrics.positions["Meio-campo"]), attackers: advantage(blueMetrics.positions.Ataque, yellowMetrics.positions.Ataque),
      speed: advantage(blueMetrics.speed, yellowMetrics.speed), skill: advantage(blueMetrics.skill, yellowMetrics.skill), marking: advantage(blueMetrics.marking, yellowMetrics.marking),
      tacticalIntelligence: advantage(blueMetrics.tacticalIntelligence, yellowMetrics.tacticalIntelligence), competitiveness: advantage(blueMetrics.competitiveness, yellowMetrics.competitiveness),
      momentum: advantage(blueMetrics.momentum, yellowMetrics.momentum), historicalLearning: advantage(Number(blueMetrics.historicalLearning ?? 0), Number(yellowMetrics.historicalLearning ?? 0)),
      score: advantage(blueMetrics.total, yellowMetrics.total),
    },
  };
  const maximumPositionDifference = Number(result.maximumPositionDifference ?? 1);
  const positionDifferences = [delta.defenders, delta.midfielders, delta.attackers];
  const positionDifference = positionDifferences.reduce((sum, value) => sum + value, 0);
  const positionExcess = positionDifferences.reduce((sum, value) => sum + Math.max(0, value - maximumPositionDifference), 0);
  const attributeDifference = Math.abs((blueMetrics.total-blueMetrics.momentum)-(yellowMetrics.total-yellowMetrics.momentum));
  const cost = delta.players * 1000 + positionExcess * 2000 + positionDifference * 120 + attributeDifference * 14 + Math.abs(blueMetrics.scoreAvg - yellowMetrics.scoreAvg) * 18 + Number(delta.historicalLearning ?? 0) * 30;
  return { ...result, blue, yellow, blueMetrics, yellowMetrics, delta, cost, rating: balanceRating(cost), extraId: undefined };
}
