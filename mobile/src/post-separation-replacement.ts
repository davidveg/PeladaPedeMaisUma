import type { MatchPlayer, ScheduledMatch } from "./types";

export type ReplacementPlayerOption = {
  value: string;
  label: string;
  player: MatchPlayer;
};

export function replacementPlayerOptions(
  match: Pick<ScheduledMatch, "lineup">,
  players: MatchPlayer[],
  teamBlueName: string,
  teamYellowName: string,
) {
  const blue = match.lineup?.blue || [], yellow = match.lineup?.yellow || [];
  const lineupIds = new Set([...blue, ...yellow].map(player => player.id));
  const option = (player: MatchPlayer, prefix = ""): ReplacementPlayerOption => ({
    value: player.id,
    label: `${prefix}${player.displayName} · ${player.primaryPosition}`,
    player,
  });
  const byName = (left: ReplacementPlayerOption, right: ReplacementPlayerOption) =>
    left.player.displayName.localeCompare(right.player.displayName, "pt-BR", { sensitivity: "base", numeric: true });
  return {
    outgoing: [
      ...blue.map(player => option(player, `Time ${teamBlueName} · `)).sort(byName),
      ...yellow.map(player => option(player, `Time ${teamYellowName} · `)).sort(byName),
    ],
    incoming: players.filter(player => !lineupIds.has(player.id)).map(player => option(player)).sort(byName),
  };
}
