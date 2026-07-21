export type Weights = { speedWeight: number; skillWeight: number; markingWeight: number; updatedAt?: string };

export function normalizeWeights(current: Weights, changed: "speedWeight" | "skillWeight" | "markingWeight", next: number): Weights {
  const keys = ["speedWeight", "skillWeight", "markingWeight"] as const, others = keys.filter(key => key !== changed), bounded = Math.max(0, Math.min(1, next)), remaining = 1 - bounded, currentOthers = current[others[0]] + current[others[1]];
  const first = currentOthers > 0 ? remaining * current[others[0]] / currentOthers : remaining / 2;
  return { ...current, [changed]: round(bounded), [others[0]]: round(first), [others[1]]: round(remaining - first) };
}
const round = (value: number) => Math.round(value * 10_000) / 10_000;
