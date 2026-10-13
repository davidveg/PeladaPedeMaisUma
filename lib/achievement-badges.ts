const perfectSeasonPattern = /^perfect_season_\d+$/;

export function achievementBadgeKey(id: string) {
  const canonicalId = String(id || "").split(":", 1)[0];
  return perfectSeasonPattern.test(canonicalId) ? "perfect_season" : canonicalId;
}

export function achievementBadgePath(id: string) {
  return `/achievements/${encodeURIComponent(achievementBadgeKey(id))}.png`;
}
