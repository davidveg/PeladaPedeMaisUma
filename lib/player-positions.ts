import type { Position } from "./football";

export const linePositions = ["Defesa", "Meio-campo", "Ataque"] as const;
export type LinePosition = (typeof linePositions)[number];

export function isLinePosition(value: unknown): value is LinePosition {
  return linePositions.includes(String(value) as LinePosition);
}

const goalkeeperType = (type: unknown) => type === "goalkeeper" || type === "casual";

export function normalizeSecondaryPosition(primaryPosition: unknown, value: unknown, type?: unknown): LinePosition | null {
  if (primaryPosition === "Goleiro" || goalkeeperType(type)) return null;
  const secondary = String(value ?? "").trim();
  return isLinePosition(secondary) && secondary !== primaryPosition ? secondary : null;
}

export function secondaryPositionValidationError(primaryPosition: unknown, value: unknown, type?: unknown) {
  if (value == null || String(value).trim() === "") return null;
  if (primaryPosition === "Goleiro" || goalkeeperType(type)) return "Goleiros não podem ter posição secundária.";
  if (!isLinePosition(value)) return "A posição secundária deve ser Defesa, Meio-campo ou Ataque.";
  if (value === primaryPosition) return "A posição secundária deve ser diferente da posição principal.";
  return null;
}

export function positionSummary(primaryPosition: Position | string, secondaryPosition?: Position | string | null) {
  return secondaryPosition ? `${primaryPosition} / ${secondaryPosition}` : primaryPosition;
}
