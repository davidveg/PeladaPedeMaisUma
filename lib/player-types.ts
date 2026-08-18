import type { Position } from "./football";

export const PLAYER_TYPES = ["monthly", "guest", "goalkeeper", "casual"] as const;
export type PlayerType = (typeof PLAYER_TYPES)[number];

export function isPlayerType(value: unknown): value is PlayerType {
  return typeof value === "string" && (PLAYER_TYPES as readonly string[]).includes(value);
}

export function playerTypeLabel(type: string) {
  if (type === "guest") return "Convidado";
  if (type === "goalkeeper") return "Goleiro Mensalista";
  if (type === "casual") return "Avulso";
  return "Mensalista";
}

export function playerTypeValidationError(type: unknown, position: Position | string) {
  if (!isPlayerType(type)) return "Selecione um tipo de jogador válido.";
  const goalkeeper = position === "Goleiro";
  if (goalkeeper && type !== "goalkeeper" && type !== "casual") return "Para goleiros, selecione Goleiro Mensalista ou Avulso.";
  if (!goalkeeper && (type === "goalkeeper" || type === "casual")) return "Goleiro Mensalista e Avulso são tipos exclusivos da posição Goleiro.";
  return null;
}
