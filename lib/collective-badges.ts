import type { CollectiveMilestoneKind } from "./collective-engagement.ts";

const collectiveKinds = new Set<CollectiveMilestoneKind>(["matches", "goals", "players", "attendance", "season", "anniversary"]);

export function collectiveBadgeKey(kind: string): CollectiveMilestoneKind | "unknown" {
  return collectiveKinds.has(kind as CollectiveMilestoneKind) ? kind as CollectiveMilestoneKind : "unknown";
}

export function collectiveBadgePath(kind: string) {
  return `/collective-achievements/${collectiveBadgeKey(kind)}.png`;
}
