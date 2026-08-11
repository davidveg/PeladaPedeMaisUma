/* Saved snapshots remain schema-flexible for historical compatibility. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { calculateTeamDelta, defaultConfig, guestBalancePenalty, type Config, type Player } from "./football.ts";

export function rebuildEditedSeparation(snapshot: any, blueInput: unknown, yellowInput: unknown) {
  const currentBlue = Array.isArray(snapshot?.blue) ? snapshot.blue as Player[] : [];
  const currentYellow = Array.isArray(snapshot?.yellow) ? snapshot.yellow as Player[] : [];
  const players = [...currentBlue, ...currentYellow];
  const blueIds = stringIds(blueInput), yellowIds = stringIds(yellowInput);
  const submitted = [...blueIds, ...yellowIds], expected = new Set(players.map(player => String(player.id)));
  if (!blueIds.length || !yellowIds.length) throw new Error("Os dois times precisam ter pelo menos um jogador.");
  if (submitted.length !== expected.size || new Set(submitted).size !== submitted.length || submitted.some(id => !expected.has(id))) {
    throw new Error("A edição deve manter exatamente os jogadores da separação, sem duplicações.");
  }
  const byId = new Map(players.map(player => [String(player.id), player]));
  const blue = blueIds.map(id => byId.get(id)!), yellow = yellowIds.map(id => byId.get(id)!);
  const config: Config = { ...defaultConfig, ...snapshot };
  const metrics = calculateTeamDelta(blue, yellow, config);
  const maximumPositionDifference = Number(snapshot?.maximumPositionDifference ?? config.maximumPositionDifference ?? 1);
  const positionDifferences = [metrics.delta.defenders, metrics.delta.midfielders, metrics.delta.attackers];
  const positionDifference = positionDifferences.reduce((sum, value) => sum + value, 0);
  const positionExcess = positionDifferences.reduce((sum, value) => sum + Math.max(0, value - maximumPositionDifference), 0);
  const attributeDifference = Math.abs((metrics.blueMetrics.total - metrics.blueMetrics.momentum) - (metrics.yellowMetrics.total - metrics.yellowMetrics.momentum));
  const cost = metrics.delta.players * 1000 + positionExcess * 2000 + positionDifference * 120 + guestBalancePenalty(blue, yellow)
    + attributeDifference * 14 + Math.abs(metrics.blueMetrics.scoreAvg - metrics.yellowMetrics.scoreAvg) * 18;
  const rating = cost < 35 ? "Excelente equilíbrio" : cost < 80 ? "Bom equilíbrio" : cost < 150 ? "Equilíbrio aceitável" : "Equilíbrio limitado";
  const preserved = { ...snapshot };
  delete preserved.extraId;
  return { ...preserved, blue, yellow, ...metrics, cost, rating };
}

function stringIds(value: unknown) {
  return Array.isArray(value) ? value.map(item => String(item || "")).filter(Boolean) : [];
}
