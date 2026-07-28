export type StatisticsPlayer = { id: string; displayName: string; photoUrl?: string | null };
export type StatisticsContribution = { matchId: string; scorerPlayerId: string; assistPlayerId?: string | null; ownGoal?: boolean };
export type StatisticsMatch = {
  id: string;
  separationId: string;
  title: string;
  date: string;
  blueScore: number;
  yellowScore: number;
  winnerTeam: "BLUE" | "YELLOW" | "DRAW";
  blueIds: string[];
  yellowIds: string[];
};

export function buildPublicStatistics(players: StatisticsPlayer[], matches: StatisticsMatch[], contributions: StatisticsContribution[], playerA?: string, playerB?: string) {
  const totals = new Map(players.map(player => [player.id, { player, goals: 0, assists: 0 }]));
  const matchIds = new Set(matches.map(match => match.id));
  for (const contribution of contributions) {
    if (!matchIds.has(contribution.matchId)) continue;
    if (!contribution.ownGoal) {
      const scorer = totals.get(contribution.scorerPlayerId);
      if (scorer) scorer.goals += 1;
      const assistant = contribution.assistPlayerId ? totals.get(contribution.assistPlayerId) : null;
      if (assistant) assistant.assists += 1;
    }
  }
  const leaderboard = [...totals.values()]
    .filter(entry => entry.goals || entry.assists)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.player.displayName.localeCompare(b.player.displayName, "pt-BR"));

  const versusMatches = playerA && playerB && playerA !== playerB ? matches.flatMap(match => {
    const teamA = match.blueIds.includes(playerA) ? "BLUE" : match.yellowIds.includes(playerA) ? "YELLOW" : null;
    const teamB = match.blueIds.includes(playerB) ? "BLUE" : match.yellowIds.includes(playerB) ? "YELLOW" : null;
    if (!teamA || !teamB || teamA === teamB) return [];
    const result = match.winnerTeam === "DRAW" ? "DRAW" : match.winnerTeam === teamA ? "A" : "B";
    return [{ ...match, teamA, teamB, result }];
  }) : [];

  return {
    leaderboard,
    coverage: {
      matches: matches.length,
      matchesWithContributions: new Set(contributions.filter(entry => matchIds.has(entry.matchId)).map(entry => entry.matchId)).size,
    },
    versus: {
      playerA: players.find(player => player.id === playerA) || null,
      playerB: players.find(player => player.id === playerB) || null,
      winsA: versusMatches.filter(match => match.result === "A").length,
      winsB: versusMatches.filter(match => match.result === "B").length,
      draws: versusMatches.filter(match => match.result === "DRAW").length,
      matches: versusMatches,
    },
  };
}
