import type { EngagementMatch } from "./player-engagement.ts";

export type CollectiveMilestoneKind = "matches" | "goals" | "players" | "attendance" | "season" | "anniversary";

export type CollectiveMilestone = {
  id: string;
  kind: CollectiveMilestoneKind;
  icon: string;
  title: string;
  description: string;
  achievedAt: string;
  value: number;
  seasonNumber?: number;
  separationId?: string;
};

export type CollectiveProgress = {
  id: string;
  kind: "matches" | "goals" | "players" | "season";
  icon: string;
  title: string;
  description: string;
  current: number;
  target: number;
  remaining: number;
  percent: number;
  scope: "HISTORICAL" | "SEASON";
};

export type CollectiveEngagement = {
  summary: {
    officialMatches: number;
    totalGoals: number;
    differentPlayers: number;
    attendanceRecord: number;
    seasonMatches: number;
  };
  progress: CollectiveProgress[];
  milestones: CollectiveMilestone[];
};

const matchLevels = [10, 25, 50, 100];
const goalLevels = [50, 100, 250, 500, 1000];
const playerLevels = [10, 25, 50, 100];

export function buildCollectiveEngagement(matches: EngagementMatch[], currentSeasonNumber: number, asOf = new Date()): CollectiveEngagement {
  const ordered = [...matches].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const milestones: CollectiveMilestone[] = [];
  const players = new Set<string>();
  const seasonTotals = new Map<number, number>();
  let officialMatches = 0, totalGoals = 0, attendanceRecord = 0;

  for (const match of ordered) {
    const previousMatches = officialMatches, previousGoals = totalGoals, previousPlayers = players.size;
    const participants = [...match.blue, ...match.yellow];
    const attendance = new Set(participants.map(player => player.id)).size;
    officialMatches += 1;
    totalGoals += Math.max(0, Number(match.blueScore || 0)) + Math.max(0, Number(match.yellowScore || 0));
    for (const player of participants) players.add(player.id);
    const previousSeasonMatches = seasonTotals.get(match.seasonNumber) || 0;
    const seasonMatches = previousSeasonMatches + 1;
    seasonTotals.set(match.seasonNumber, seasonMatches);

    for (const value of crossedLevels(previousMatches, officialMatches, matchLevels, 50)) milestones.push({
      id: `collective-matches-${value}`, kind: "matches", icon: "🏟️", title: `${value} partidas oficiais`,
      description: `A comunidade chegou à marca de ${value} partidas registradas oficialmente.`, achievedAt: match.date,
      value, seasonNumber: match.seasonNumber, separationId: match.separationId,
    });
    for (const value of crossedLevels(previousGoals, totalGoals, goalLevels, 500)) milestones.push({
      id: `collective-goals-${value}`, kind: "goals", icon: "⚽", title: `${formatNumber(value)} gols na história`,
      description: `Esta rodada levou a pelada à marca de ${formatNumber(value)} gols oficiais.`, achievedAt: match.date,
      value, seasonNumber: match.seasonNumber, separationId: match.separationId,
    });
    for (const value of crossedLevels(previousPlayers, players.size, playerLevels, 50)) milestones.push({
      id: `collective-players-${value}`, kind: "players", icon: "👥", title: `${value} jogadores na história`,
      description: `${value} jogadores diferentes já entraram em campo em partidas oficiais.`, achievedAt: match.date,
      value, seasonNumber: match.seasonNumber, separationId: match.separationId,
    });
    for (const value of crossedLevels(previousSeasonMatches, seasonMatches, [], 10)) milestones.push({
      id: `collective-season-${match.seasonNumber}-matches-${value}`, kind: "season", icon: "📅", title: `${value} rodadas na temporada ${match.seasonNumber}`,
      description: `A temporada ${match.seasonNumber} alcançou ${value} partidas oficiais.`, achievedAt: match.date,
      value, seasonNumber: match.seasonNumber, separationId: match.separationId,
    });
    if (attendanceRecord > 0 && attendance >= 10 && attendance > attendanceRecord) milestones.push({
      id: `collective-attendance-${match.separationId}`, kind: "attendance", icon: "🙌", title: "Novo recorde de participantes",
      description: `${attendance} jogadores participaram desta rodada, superando o recorde anterior de ${attendanceRecord}.`, achievedAt: match.date,
      value: attendance, seasonNumber: match.seasonNumber, separationId: match.separationId,
    });
    attendanceRecord = Math.max(attendanceRecord, attendance);
  }

  const firstDate = ordered[0]?.date?.slice(0, 10);
  if (firstDate) {
    const foundation = new Date(`${firstDate}T12:00:00Z`);
    const limit = Math.min(asOf.getUTCFullYear() - foundation.getUTCFullYear(), 100);
    for (let years = 1; years <= limit; years += 1) {
      const anniversary = new Date(foundation);
      anniversary.setUTCFullYear(foundation.getUTCFullYear() + years);
      if (anniversary > asOf) continue;
      milestones.push({ id: `collective-anniversary-${years}`, kind: "anniversary", icon: "🎂", title: `${years} ${years === 1 ? "ano" : "anos"} de história`, description: `A pelada completou ${years} ${years === 1 ? "ano" : "anos"} desde sua primeira partida oficial.`, achievedAt: anniversary.toISOString().slice(0, 10), value: years });
    }
  }

  milestones.sort((a, b) => a.achievedAt.localeCompare(b.achievedAt) || a.id.localeCompare(b.id));
  const seasonMatches = seasonTotals.get(currentSeasonNumber) || 0;
  const progress = [
    progressGoal("matches", "🏟️", "Próxima marca de partidas", "partidas oficiais", officialMatches, nextLevel(officialMatches, matchLevels, 50), "HISTORICAL"),
    progressGoal("goals", "⚽", "Rumo à próxima marca de gols", "gols oficiais", totalGoals, nextLevel(totalGoals, goalLevels, 500), "HISTORICAL"),
    progressGoal("players", "👥", "Comunidade em campo", "jogadores diferentes", players.size, nextLevel(players.size, playerLevels, 50), "HISTORICAL"),
    progressGoal(`season-${currentSeasonNumber}`, "📅", `Temporada ${currentSeasonNumber} em movimento`, "rodadas nesta temporada", seasonMatches, nextLevel(seasonMatches, [], 10), "SEASON"),
  ].sort((a, b) => b.percent - a.percent || a.remaining - b.remaining).slice(0, 3);

  return { summary: { officialMatches, totalGoals, differentPlayers: players.size, attendanceRecord, seasonMatches }, progress, milestones };
}

function crossedLevels(previous: number, current: number, fixed: number[], step: number) {
  if (current <= previous) return [];
  const levels = fixed.filter(value => value > previous && value <= current);
  const start = fixed.at(-1) || 0;
  if (step > 0 && current > start) {
    for (let value = Math.max(step, Math.floor(previous / step + 1) * step); value <= current; value += step) if (value > start && !levels.includes(value)) levels.push(value);
  }
  return levels.sort((a, b) => a - b);
}

function nextLevel(current: number, fixed: number[], step: number) {
  const next = fixed.find(value => value > current);
  if (next) return next;
  return Math.max(step, Math.floor(current / step + 1) * step);
}

function progressGoal(id: string, icon: string, title: string, unit: string, current: number, target: number, scope: "HISTORICAL" | "SEASON"): CollectiveProgress {
  const remaining = Math.max(0, target - current);
  return { id, kind: id.startsWith("season-") ? "season" : id as CollectiveProgress["kind"], icon, title, description: remaining === 1 ? `Falta 1 ${singular(unit)}.` : `Faltam ${remaining} ${unit}.`, current, target, remaining, percent: target ? Math.min(100, Math.round(current / target * 100)) : 0, scope };
}

function singular(unit: string) {
  return unit === "partidas oficiais" ? "partida oficial" : unit === "gols oficiais" ? "gol oficial" : unit === "jogadores diferentes" ? "jogador diferente" : "rodada nesta temporada";
}

function formatNumber(value: number) { return new Intl.NumberFormat("pt-BR").format(value); }
