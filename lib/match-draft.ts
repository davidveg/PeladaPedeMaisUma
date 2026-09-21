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
  for (const goal of normalized) {
    if (!goal.scorerPlayerId) {
      if (goal.assistPlayerId) return { error: "Selecione o autor antes de informar a assistência.", contributions: normalized, ...scores };
      continue;
    }
    const singleScore = goal.team === "BLUE" ? { blueScore: 1, yellowScore: 0 } : { blueScore: 0, yellowScore: 1 };
    const validation = validateMatchContributions({ contributions: [goal], ...singleScore, blueIds: input.blueIds, yellowIds: input.yellowIds });
    if (validation.error) return { error: validation.error, contributions: normalized, ...scores };
  }
  return { error: null, contributions: normalized, ...scores };
}

export function normalizeDraftScore(value: unknown) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 99 ? score : null;
}

export function normalizeDraftParticipation(input: unknown, eligibleIds: string[], fallback: { blueIds: string[]; yellowIds: string[] }) {
  const payload = input && typeof input === "object" ? input as { blueIds?: unknown; yellowIds?: unknown } : null;
  if (!Array.isArray(payload?.blueIds) || !Array.isArray(payload?.yellowIds)) return { ...fallback, reviewed: false };
  const blueIds = payload.blueIds.map(String), yellowIds = payload.yellowIds.map(String), all = [...blueIds, ...yellowIds];
  if (new Set(all).size !== all.length) return { error: "Um jogador não pode aparecer duas vezes na participação do rascunho.", blueIds, yellowIds, reviewed: true };
  const eligible = new Set(eligibleIds);
  if (all.some(id => !eligible.has(id))) return { error: "A participação do rascunho contém um jogador indisponível.", blueIds, yellowIds, reviewed: true };
  return { blueIds, yellowIds, reviewed: true };
}
