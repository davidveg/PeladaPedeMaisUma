/** Shared, snapshot-free contract for the web/mobile match hub. */
export type MatchHubStatus = "OPEN" | "TEAMS" | "FINISHED" | "CLOSED" | "CANCELLED";
export type MatchHubFilter = "all" | "open" | "teams" | "finished" | "history" | "cancelled";
export type MatchHubItem = {
  id: string; matchId: string | null; separationId: string | null;
  title: string; date: string | null; location: string | null; status: MatchHubStatus;
  confirmedAt: string | null; present: number | null;
  blueScore: number | null; yellowScore: number | null;
  votingStatus: string | null; votingClosesAt: string | null;
};
export type MatchHubPayload = {
  items: MatchHubItem[]; page: number; hasMore: boolean;
  viewer: { authenticated: boolean; permissions: string[] };
};
export const matchHubFilters: { value: MatchHubFilter; label: string }[] = [
  { value: "all", label: "Todas" }, { value: "open", label: "Abertas" },
  { value: "teams", label: "Times gerados" }, { value: "finished", label: "Finalizadas" },
  { value: "history", label: "Histórico" }, { value: "cancelled", label: "Canceladas" },
];
export const matchHubStatusLabel: Record<MatchHubStatus, string> = {
  OPEN: "Confirmações abertas", TEAMS: "Times gerados", FINISHED: "Resultado confirmado",
  CLOSED: "Lista encerrada sem times", CANCELLED: "Cancelada",
};
export function matchHubHref(item: Pick<MatchHubItem, "matchId" | "separationId">, tab?: string) {
  const params = new URLSearchParams(item.matchId ? { match: item.matchId } : { separation: item.separationId || "" });
  if (tab) params.set("tab", tab);
  return `/partidas?${params}`;
}
