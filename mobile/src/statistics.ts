// Wire contracts only: all statistics, eligibility and award closures are calculated by the server.
export type StatsPlayer = { id: string; displayName: string; photoUrl?: string | null; type?: string | null; primaryPosition?: string | null };
export type Period = { from: string; to: string };
export type Streak = { length: number; players: StatsPlayer[] };
export type MonthlyStanding = { player: StatsPlayer; resultMomentum: number; votingMomentum: number; totalMomentum: number; games: number; wins: number; draws: number; losses: number };
export type Formation = { goalkeepers: number; defenders: number; midfielders: number; attackers: number };
export type MonthlyAward = { month: string; matchCount: number; formation?: Formation; playerOfMonth: MonthlyStanding | null; selection: (MonthlyStanding & { role: string })[] };
export type StatsMatch = { id: string; separationId: string; title: string; date: string; blueScore: number; yellowScore: number };
export type GeneralStatistics = Period & {
  players: StatsPlayer[];
  leaderboard: { player: StatsPlayer; goals: number; assists: number }[];
  attendance: { player: StatsPlayer; presences: number; rate: number }[];
  coverage: { matches: number; matchesWithContributions: number };
  streaks: { winning: Streak; unbeaten: Streak };
  careerHighlights: { year: number; focusMonth: string; focusMonthClosed: boolean; focus: MonthlyAward | null; history: MonthlyAward[]; annualMvp: { player: StatsPlayer; selections: number; playerOfMonthAwards: number; momentum: number; place: number; medal: string }[]; annualMvpAvailable: boolean; annualMvpAvailableAt: string };
  versus: { playerA: StatsPlayer | null; playerB: StatsPlayer | null; winsA: number; winsB: number; draws: number; totalMatches?: number; matchDetailsRestricted?: boolean; matches: (StatsMatch & { teamA: string; teamB: string; result: string })[] };
};
export type PlayerStatistics = {
  player: StatsPlayer; position: string; games: number; wins: number; draws: number; losses: number;
  goals: number; assists: number; contributionGames: number; goalsFor: number; goalsAgainst: number; plusMinus: number; plusMinusPerGame: number;
  utilization: number; consistency: number | null;
  ipi: { value: number; confidence: string; availableComponents?: string[] } | null;
  recent: { games: number; window: number; sequence: string[]; utilization: number; trend: number | null; contributionGames: number; goals: number; assists: number; plusMinus: number };
  impact: { utilizationDifference: number | null; plusMinusDifference: number | null };
};
export type Partnership = { playerA: StatsPlayer; playerB: StatsPlayer; games: number; wins: number; draws: number; losses: number; utilization: number; plusMinus: number; chemistry: number; confidence: number };
type ContributionRecord = { player: StatsPlayer; value: number; matchId: string; separationId: string; title: string; date: string };
export type AdvancedStatistics = Period & {
  version: number; seasons: number[]; allPlayers: StatsPlayer[]; players: PlayerStatistics[]; partnerships: Partnership[];
  coverage: { matches: number; closedVotes: number; detailedContributions: number; automaticPredictions: number };
  positionRankings: Record<string, PlayerStatistics[]>;
  records: Record<"wins" | "unbeaten" | "losses" | "goals" | "assists", Streak> & {
    mostGoals: ContributionRecord | null; mostAssists: ContributionRecord | null;
    biggestBlowout: StatsMatch | null; highestScoring: StatsMatch | null; matchDetailsRestricted?: boolean;
    highestPlusMinus: { player: StatsPlayer; plusMinus: number } | null;
    bestUtilization: { player: StatsPlayer; utilization: number; games: number } | null;
    highestIpi: { player: StatsPlayer; ipi: { value: number } | null } | null;
    highestConsistency: { player: StatsPlayer; consistency: number } | null;
  };
  balance: { sample: number; averagePredictedBalance: number | null; averageGoalDifference: number | null; oneGoalGamesPercentage: number | null; drawsPercentage: number | null; blowoutsPercentage: number | null; correlation: number | null; predictionErrorReason: string };
};
export const positions = ["Goleiro", "Defesa", "Meio-campo", "Ataque"];
export const fmt = (value: number | null | undefined, digits = 1, suffix = "") => value == null || !Number.isFinite(value) ? "Sem dados" : value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + suffix;
export const signed = (value: number | null | undefined, suffix = "") => value == null ? "Sem dados" : `${value > 0 ? "+" : ""}${fmt(value, 1, suffix)}`;
export const momentum = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })}`;
export function monthRange(month: string): Period {
  const [year, number] = month.split("-").map(Number);
  return { from: `${month}-01`, to: `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}` };
}
export function currentPeriod(mode: "month" | "year", now = new Date()): Period {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find(part => part.type === "year")!.value, month = parts.find(part => part.type === "month")!.value;
  return mode === "year" ? { from: `${year}-01-01`, to: `${year}-12-31` } : monthRange(`${year}-${month}`);
}
export const dateLabel = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
export const monthLabel = (month: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
export function parseDate(text: string): string | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return null;
  const iso = text.split("/").reverse().join("-"), date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
export function validatePeriod(from: string, to: string): Period | null {
  const a = parseDate(from), b = parseDate(to);
  return a && b && a <= b ? { from: a, to: b } : null;
}
export function statisticsPath(advanced: boolean, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  return `/api/public-statistics${advanced ? "/advanced" : ""}?${query}`;
}
export function sortScorers(rows: GeneralStatistics["leaderboard"], includeGuests: boolean, key: "goals" | "assists" | "participations", ascending = false) {
  const value = (row: typeof rows[number]) => key === "participations" ? row.goals + row.assists : row[key];
  return rows.filter(row => includeGuests || row.player.type !== "guest").sort((a, b) => (value(a) - value(b)) * (ascending ? 1 : -1) || a.player.displayName.localeCompare(b.player.displayName, "pt-BR"));
}
export function formationRows(award: MonthlyAward) {
  const formation = award.formation || { goalkeepers: 1, defenders: 2, midfielders: 2, attackers: 2 };
  return ([['Ataque', 'attackers'], ['Meio-campo', 'midfielders'], ['Defesa', 'defenders'], ['Goleiro', 'goalkeepers']] as const)
    .map(([role, key]) => ({ role, slots: Math.max(0, formation[key]), players: award.selection.filter(entry => entry.role === role) }))
    .filter(row => row.slots > 0 || row.players.length > 0);
}
export function closedAward(highlights: GeneralStatistics["careerHighlights"], selectedMonth = ""): MonthlyAward | null {
  // A calendar date alone must never unlock an award: early closure and saved snapshots are authoritative.
  if (selectedMonth) return highlights.history.find(award => award.month === selectedMonth) || null;
  return highlights.focusMonthClosed ? highlights.focus : null;
}

export function sortAttendance(rows: GeneralStatistics["attendance"], includeGuests: boolean, key: "presences" | "rate" | "name", ascending = false) {
  return rows.filter(row => includeGuests || row.player.type !== "guest").sort((a, b) => {
    const difference = key === "name" ? a.player.displayName.localeCompare(b.player.displayName, "pt-BR") : a[key] - b[key];
    return difference * (ascending ? 1 : -1) || a.player.displayName.localeCompare(b.player.displayName, "pt-BR");
  });
}

export function resolveStatisticsPlayer(players: PlayerStatistics[], selected: string, ownId?: string | null) {
  return players.find(entry => entry.player.id === selected) || players.find(entry => entry.player.id === ownId) || players[0] || null;
}

export function playerPartnerships(pairs: Partnership[], playerId: string) {
  return pairs.filter(pair => pair.playerA.id === playerId || pair.playerB.id === playerId);
}

export function advancedHighlights(data: AdvancedStatistics) {
  const best = (get: (entry: PlayerStatistics) => number | null) => [...data.players].filter(entry => get(entry) != null).sort((a, b) => get(b)! - get(a)!)[0];
  const ipi = best(entry => entry.ipi?.value ?? null), form = best(entry => entry.recent.trend);
  const balance = best(entry => entry.plusMinus), consistency = best(entry => entry.consistency);
  return [
    { label: "Melhor IPI", value: fmt(ipi?.ipi?.value), player: ipi?.player },
    { label: "Melhor forma", value: signed(form?.recent.trend, " p.p."), player: form?.player },
    { label: "Maior saldo +/−", value: signed(balance?.plusMinus), player: balance?.player },
    { label: "Mais consistente", value: fmt(consistency?.consistency, 1, "%"), player: consistency?.player },
  ];
}

export function pitchColumns(width: number, fontScale = 1) {
  // Limit each line to readable cards; larger formations wrap without overflowing the pitch.
  return Math.max(1, Math.min(4, Math.floor((width - 24) / (100 * Math.max(1, fontScale)))));
}
