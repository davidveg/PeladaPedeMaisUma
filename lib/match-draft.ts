import { validateMatchContributions, type MatchContributionInput } from "./match-contributions.ts";

export function scoresFromContributions(contributions: MatchContributionInput[]) {
  return {
    blueScore: contributions.filter(goal => goal.team === "BLUE").length,
    yellowScore: contributions.filter(goal => goal.team === "YELLOW").length,
  };
}

export function validateMatchDraft(input: { contributions: unknown; blueIds: string[]; yellowIds: string[] }) {
  const raw = Array.isArray(input.contributions) ? input.contributions : [];
  const normalized = raw.map((entry: any) => ({
    team: entry?.team === "YELLOW" ? "YELLOW" as const : "BLUE" as const,
    scorerPlayerId: String(entry?.scorerPlayerId || ""),
    assistPlayerId: entry?.assistPlayerId ? String(entry.assistPlayerId) : null,
    ownGoal: Boolean(entry?.ownGoal),
  }));
  const scores = scoresFromContributions(normalized);
  if (scores.blueScore > 99 || scores.yellowScore > 99) return { error: "O rascunho aceita no máximo 99 gols por equipe.", contributions: normalized, ...scores };
  return { ...validateMatchContributions({ contributions: normalized, ...scores, blueIds: input.blueIds, yellowIds: input.yellowIds }), ...scores };
}
