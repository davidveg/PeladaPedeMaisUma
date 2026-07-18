export type MatchContributionInput = { team: "BLUE" | "YELLOW"; scorerPlayerId: string; assistPlayerId?: string | null; ownGoal?: boolean };

export function validateMatchContributions(input: { contributions: unknown; blueScore: number; yellowScore: number; blueIds: string[]; yellowIds: string[] }) {
  if (!Array.isArray(input.contributions)) return { error: "Informe os autores de todos os gols.", contributions: [] as MatchContributionInput[] };
  const contributions: MatchContributionInput[] = input.contributions.map((entry: any) => ({ team: entry?.team === "YELLOW" ? "YELLOW" : "BLUE", scorerPlayerId: String(entry?.scorerPlayerId || ""), assistPlayerId: entry?.assistPlayerId ? String(entry.assistPlayerId) : null, ownGoal: Boolean(entry?.ownGoal) }));
  if (contributions.length !== input.blueScore + input.yellowScore) return { error: "A quantidade de gols informados deve ser igual ao placar.", contributions };
  const teams = { BLUE: new Set(input.blueIds), YELLOW: new Set(input.yellowIds) };
  if (contributions.filter(goal => goal.team === "BLUE").length !== input.blueScore || contributions.filter(goal => goal.team === "YELLOW").length !== input.yellowScore) return { error: "Distribua os gols de acordo com o placar de cada time.", contributions };
  for (const goal of contributions) {
    const team = teams[goal.team];
    const opposingTeam = teams[goal.team === "BLUE" ? "YELLOW" : "BLUE"];
    if (goal.ownGoal) {
      if (!opposingTeam.has(goal.scorerPlayerId)) return { error: "No gol contra, selecione o jogador da equipe adversária que desviou a bola.", contributions };
      if (goal.assistPlayerId) return { error: "Gol contra não pode possuir assistência.", contributions };
      continue;
    }
    if (!team.has(goal.scorerPlayerId)) return { error: "Todo gol deve ter um autor do time correspondente.", contributions };
    if (goal.assistPlayerId && !team.has(goal.assistPlayerId)) return { error: "A assistência deve ser atribuída a um jogador do mesmo time.", contributions };
    if (goal.assistPlayerId === goal.scorerPlayerId) return { error: "O autor do gol não pode dar assistência para si mesmo.", contributions };
  }
  return { error: null, contributions };
}
