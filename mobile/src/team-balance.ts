import type { Player, TeamDelta, TeamMetrics, TeamResult } from "./types";

function attributes(player: Player) {
  const goalkeeper = player.type === "goalkeeper" || player.primaryPosition === "Goleiro";
  return {
    speed: goalkeeper ? player.goalkeeperPositioning ?? player.speed : player.speed,
    skill: player.skill,
    marking: goalkeeper ? player.goalExit ?? player.marking ?? 3 : player.marking ?? 3,
  };
}

function playerScore(player: Player, result: TeamResult) {
  const value = attributes(player);
  const raw = value.speed * Number(result.speedWeight ?? .48)
    + value.skill * Number(result.skillWeight ?? .32)
    + value.marking * Number(result.markingWeight ?? .2)
    + (player.momentum ?? 0) * Number(result.momentumMultiplier ?? 1);
  return Math.round(Math.max(1, Math.min(5, raw)) * 10) / 10;
}

export function calculateMobileTeamMetrics(team: Player[], result: TeamResult): TeamMetrics {
  const positions = { Defesa: 0, "Meio-campo": 0, Ataque: 0, Goleiro: 0 };
  let speed = 0, skill = 0, marking = 0, momentum = 0, total = 0;
  for (const player of team) {
    if (player.primaryPosition in positions) positions[player.primaryPosition as keyof typeof positions]++;
    const value = attributes(player);
    speed += value.speed;
    skill += value.skill;
    marking += value.marking;
    momentum += player.momentum ?? 0;
    total += playerScore(player, result);
  }
  const count = team.length, average = (value: number) => count ? value / count : 0;
  return { count, positions, speed, skill, marking, momentum, total, speedAvg: average(speed), skillAvg: average(skill), markingAvg: average(marking), momentumAvg: average(momentum), scoreAvg: average(total) };
}

export function balanceRating(cost: number) {
  return cost < 35 ? "Excelente equilíbrio" : cost < 80 ? "Bom equilíbrio" : cost < 150 ? "Equilíbrio aceitável" : "Equilíbrio limitado";
}

export function recalculateTeamResult(result: TeamResult, blue: Player[], yellow: Player[]): TeamResult {
  const blueMetrics = calculateMobileTeamMetrics(blue, result), yellowMetrics = calculateMobileTeamMetrics(yellow, result);
  const delta: TeamDelta = {
    players: Math.abs(blueMetrics.count - yellowMetrics.count),
    defenders: Math.abs(blueMetrics.positions.Defesa - yellowMetrics.positions.Defesa),
    midfielders: Math.abs(blueMetrics.positions["Meio-campo"] - yellowMetrics.positions["Meio-campo"]),
    attackers: Math.abs(blueMetrics.positions.Ataque - yellowMetrics.positions.Ataque),
    speed: Math.abs(blueMetrics.speed - yellowMetrics.speed),
    skill: Math.abs(blueMetrics.skill - yellowMetrics.skill),
    marking: Math.abs(blueMetrics.marking - yellowMetrics.marking),
    momentum: Math.abs(blueMetrics.momentum - yellowMetrics.momentum),
    score: Math.abs(blueMetrics.total - yellowMetrics.total),
  };
  const maximumPositionDifference = Number(result.maximumPositionDifference ?? 1);
  const positionDifferences = [delta.defenders, delta.midfielders, delta.attackers];
  const positionDifference = positionDifferences.reduce((sum, value) => sum + value, 0);
  const positionExcess = positionDifferences.reduce((sum, value) => sum + Math.max(0, value - maximumPositionDifference), 0);
  const attributeDifference = delta.speed * Number(result.speedWeight ?? .48)
    + delta.skill * Number(result.skillWeight ?? .32)
    + delta.marking * Number(result.markingWeight ?? .2);
  const cost = delta.players * 1000 + positionExcess * 2000 + positionDifference * 120 + attributeDifference * 14 + Math.abs(blueMetrics.scoreAvg - yellowMetrics.scoreAvg) * 18;
  return { ...result, blue, yellow, blueMetrics, yellowMetrics, delta, cost, rating: balanceRating(cost), extraId: undefined };
}
