export type TeamArrivalOrder = { blue: string[]; yellow: string[] };

export function validateArrivalOrder(value: unknown, blueIds: string[], yellowIds: string[]): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Informe a ordem de chegada dos dois times.";
  const input = value as Record<string, unknown>;
  const blueError = validateTeam(input.blue, blueIds, "Azul");
  if (blueError) return blueError;
  return validateTeam(input.yellow, yellowIds, "Amarelo");
}

export function normalizeArrivalOrder(value: unknown, blueIds: string[], yellowIds: string[]): TeamArrivalOrder | null {
  if (!value) return null;
  try {
    const parsed: any = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) {
      const ids = parsed.map(String), blue = ids.filter(id => blueIds.includes(id)), yellow = ids.filter(id => yellowIds.includes(id));
      return !validateArrivalOrder({ blue, yellow }, blueIds, yellowIds) ? { blue, yellow } : null;
    }
    const normalized = { blue: Array.isArray(parsed?.blue) ? parsed.blue.map(String) : [], yellow: Array.isArray(parsed?.yellow) ? parsed.yellow.map(String) : [] };
    return !validateArrivalOrder(normalized, blueIds, yellowIds) ? normalized : null;
  } catch { return null; }
}

function validateTeam(value: unknown, participantIds: string[], team: string): string | null {
  if (!Array.isArray(value)) return `Informe a ordem de chegada do Time ${team}.`;
  const order = value.map(String), participants = new Set(participantIds);
  if (order.length !== participantIds.length || new Set(order).size !== order.length) return `A ordem do Time ${team} deve conter cada jogador exatamente uma vez.`;
  if (order.some(id => !participants.has(id))) return `A ordem do Time ${team} contém um jogador de outra equipe.`;
  return null;
}
