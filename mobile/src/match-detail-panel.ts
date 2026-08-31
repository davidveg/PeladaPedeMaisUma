import type { MatchHubItem } from "./match-hub";

/** Missing published teams must not redirect an explicitly selected tab to attendance. */
export function matchDetailPanel(item: Pick<MatchHubItem, "matchId" | "separationId">, tab: string) {
  if (tab === "attendance") return item.matchId ? "attendance" : "legacy-attendance";
  if (item.separationId) return "separation";
  return tab === "teams" ? "awaiting-teams" : "unavailable";
}
