export type PlayerCareerStats = {
  games: number;
  wins: number;
  losses: number;
  goals: number;
  assists: number;
};

type CareerMatchStatsRow = {
  snapshot: string | Record<string, unknown>;
  winner_team?: string;
  winnerTeam?: string;
};

export const emptyPlayerCareerStats = (): PlayerCareerStats => ({ games: 0, wins: 0, losses: 0, goals: 0, assists: 0 });

export function calculatePlayerCareerStats(rows: CareerMatchStatsRow[], contributions: any[] = []): Record<string, PlayerCareerStats> {
  const totals: Record<string, PlayerCareerStats> = {};

  for (const row of rows) {
    let snapshot: any;
    try {
      snapshot = typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot;
    } catch {
      continue;
    }

    const participants = new Map<string, "BLUE" | "YELLOW">();
    for (const player of snapshot?.blue || []) if (player?.id && !participants.has(player.id)) participants.set(player.id, "BLUE");
    for (const player of snapshot?.yellow || []) if (player?.id && !participants.has(player.id)) participants.set(player.id, "YELLOW");
    const winner = row.winner_team ?? row.winnerTeam;

    for (const [playerId, team] of participants) {
      const stats = totals[playerId] ?? emptyPlayerCareerStats();
      stats.games += 1;
      if (winner === team) stats.wins += 1;
      else if (winner === "BLUE" || winner === "YELLOW") stats.losses += 1;
      totals[playerId] = stats;
    }
  }

  for (const contribution of contributions) {
    if (Boolean(contribution.is_own_goal ?? contribution.ownGoal)) continue;
    const scorerId = String(contribution.scorer_player_id ?? contribution.scorerPlayerId ?? "");
    const assistId = String(contribution.assist_player_id ?? contribution.assistPlayerId ?? "");
    if (scorerId) { const stats = totals[scorerId] ?? emptyPlayerCareerStats(); stats.goals += 1; totals[scorerId] = stats; }
    if (assistId) { const stats = totals[assistId] ?? emptyPlayerCareerStats(); stats.assists += 1; totals[assistId] = stats; }
  }

  return totals;
}

export function attachPlayerCareerStats<T extends { id?: string }>(player: T, totals: Record<string, PlayerCareerStats>): T & { careerStats: PlayerCareerStats } {
  return { ...player, careerStats: player.id ? totals[player.id] ?? emptyPlayerCareerStats() : emptyPlayerCareerStats() };
}
