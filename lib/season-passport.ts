import type { CareerAchievement, EngagementMatch, EngagementPlayer } from "./player-engagement";

export type SeasonPassportRecognition = "PARTNER" | "FAIR_PLAY" | "DEFENSE";
export type SeasonPassportResult = "WIN" | "DRAW" | "LOSS" | "ABSENT";

export type SeasonPassportStamp = {
  id: string;
  separationId: string;
  title: string;
  date: string;
  month: string;
  round: number;
  participated: boolean;
  team: "BLUE" | "YELLOW" | null;
  result: SeasonPassportResult;
  blueScore: number;
  yellowScore: number;
  goals: number;
  assists: number;
  motm: boolean;
  recognitions: SeasonPassportRecognition[];
  achievements: Array<{ id: string; title: string; icon: string }>;
  primaryIcon: string;
};

export type SeasonPassportMonth = {
  month: string;
  totalMatches: number;
  appearances: number;
  wins: number;
  goals: number;
  assists: number;
};

export type SeasonPassportSummary = {
  seasonNumber: number;
  totalMatches: number;
  appearances: number;
  attendanceRate: number;
  perfectSeasonTarget: number;
  perfectSeasonProgress: number;
  currentAttendanceStreak: number;
  bestAttendanceStreak: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  motmAwards: number;
  recognitionAwards: number;
};

export type SeasonPassport = {
  summary: SeasonPassportSummary;
  months: SeasonPassportMonth[];
  recentStamps: SeasonPassportStamp[];
};

export type SeasonPassportDetails = SeasonPassport & {
  availableSeasons: number[];
  selectedMonth: string | null;
  stamps: SeasonPassportStamp[];
};

export function buildSeasonPassport(params: {
  player: EngagementPlayer;
  matches: EngagementMatch[];
  seasonNumber: number;
  achievements?: CareerAchievement[];
}) {
  const seasonMatches = [...params.matches]
    .filter(match => match.seasonNumber === params.seasonNumber)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const achievementsByMatch = new Map<string, CareerAchievement[]>();
  for (const achievement of params.achievements || []) {
    if (!achievement.matchId) continue;
    const values = achievementsByMatch.get(achievement.matchId) || [];
    values.push(achievement);
    achievementsByMatch.set(achievement.matchId, values);
  }

  let currentAttendanceStreak = 0, bestAttendanceStreak = 0;
  const stamps = seasonMatches.map((match, index) => {
    const team = participantTeam(match, params.player.id);
    if (team) {
      currentAttendanceStreak += 1;
      bestAttendanceStreak = Math.max(bestAttendanceStreak, currentAttendanceStreak);
    } else currentAttendanceStreak = 0;
    return passportStamp(match, params.player.id, team, index + 1, achievementsByMatch.get(match.separationId) || []);
  });
  const appearances = stamps.filter(stamp => stamp.participated).length;
  const attendanceRate = stamps.length ? Math.round(appearances / stamps.length * 100) : 0;
  const summary: SeasonPassportSummary = {
    seasonNumber: params.seasonNumber,
    totalMatches: stamps.length,
    appearances,
    attendanceRate,
    perfectSeasonTarget: 95,
    perfectSeasonProgress: Math.min(100, Math.round(attendanceRate / .95)),
    currentAttendanceStreak,
    bestAttendanceStreak,
    wins: stamps.filter(stamp => stamp.result === "WIN").length,
    draws: stamps.filter(stamp => stamp.result === "DRAW").length,
    losses: stamps.filter(stamp => stamp.result === "LOSS").length,
    goals: stamps.reduce((total, stamp) => total + stamp.goals, 0),
    assists: stamps.reduce((total, stamp) => total + stamp.assists, 0),
    motmAwards: stamps.filter(stamp => stamp.motm).length,
    recognitionAwards: stamps.reduce((total, stamp) => total + stamp.recognitions.length, 0),
  };
  const months = [...groupMonths(stamps).values()]
    .sort((a, b) => b.month.localeCompare(a.month));
  return { summary, months, stamps };
}

export function seasonPassportPreview(passport: ReturnType<typeof buildSeasonPassport>): SeasonPassport {
  return {
    summary: passport.summary,
    months: passport.months,
    recentStamps: passport.stamps.slice(-8).reverse(),
  };
}

function passportStamp(match: EngagementMatch, playerId: string, team: "BLUE" | "YELLOW" | null, round: number, achievements: CareerAchievement[]): SeasonPassportStamp {
  const goals = match.contributions.filter(item => !item.ownGoal && item.scorerPlayerId === playerId).length;
  const assists = match.contributions.filter(item => !item.ownGoal && item.assistPlayerId === playerId).length;
  const motm = match.status === "CLOSED" && (match.results?.motm?.find(entry => Number(entry.place || 1) === 1) || match.results?.motm?.[0])?.playerId === playerId;
  const recognitions: SeasonPassportRecognition[] = [];
  if (match.status === "CLOSED" && match.results?.partner?.[0]?.playerId === playerId) recognitions.push("PARTNER");
  if (match.status === "CLOSED" && match.results?.fairPlay?.[0]?.playerId === playerId) recognitions.push("FAIR_PLAY");
  if (match.status === "CLOSED" && match.results?.defense?.[0]?.playerId === playerId) recognitions.push("DEFENSE");
  const result: SeasonPassportResult = !team ? "ABSENT" : match.winnerTeam === "DRAW" ? "DRAW" : match.winnerTeam === team ? "WIN" : "LOSS";
  const primaryIcon = motm ? "⭐" : recognitions.length ? "🏆" : goals ? "⚽" : assists ? "🎯" : team ? "✓" : "—";
  return {
    id: match.id,
    separationId: match.separationId,
    title: match.title,
    date: match.date,
    month: match.date.slice(0, 7),
    round,
    participated: Boolean(team),
    team,
    result,
    blueScore: match.blueScore,
    yellowScore: match.yellowScore,
    goals,
    assists,
    motm,
    recognitions,
    achievements: achievements.map(item => ({ id: item.id, title: item.title, icon: item.icon })),
    primaryIcon,
  };
}

function groupMonths(stamps: SeasonPassportStamp[]) {
  const months = new Map<string, SeasonPassportMonth>();
  for (const stamp of stamps) {
    const month = months.get(stamp.month) || { month: stamp.month, totalMatches: 0, appearances: 0, wins: 0, goals: 0, assists: 0 };
    month.totalMatches += 1;
    if (stamp.participated) month.appearances += 1;
    if (stamp.result === "WIN") month.wins += 1;
    month.goals += stamp.goals;
    month.assists += stamp.assists;
    months.set(stamp.month, month);
  }
  return months;
}

function participantTeam(match: EngagementMatch, playerId: string) {
  if (match.blue.some(player => player.id === playerId)) return "BLUE" as const;
  if (match.yellow.some(player => player.id === playerId)) return "YELLOW" as const;
  return null;
}
