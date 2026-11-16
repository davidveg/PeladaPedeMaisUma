const seasonalBadgeAliases: Array<[RegExp, string]> = [
  [/^perfect_season_\d+$/, "perfect_season"],
  [/^undefeated_season_\d+$/, "undefeated_season"],
];

export function achievementBadgeKey(id: string) {
  const canonicalId = String(id || "").split(":", 1)[0];
  return seasonalBadgeAliases.find(([pattern]) => pattern.test(canonicalId))?.[1] || canonicalId;
}

export function achievementBadgePath(id: string) {
  return `/achievements/${encodeURIComponent(achievementBadgeKey(id))}.png`;
}
