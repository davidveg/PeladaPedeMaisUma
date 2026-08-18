import { defaultMonthlyTeamFormation, type MonthlyTeamFormation } from "./career.ts";

export type StatisticsPlayer = { id: string; displayName: string; photoUrl?: string | null; type?: string | null; primaryPosition?: string | null };
export type StatisticsContribution = { matchId: string; scorerPlayerId: string; assistPlayerId?: string | null; ownGoal?: boolean };
export type StatisticsVoteResult = { playerId: string; momentum?: number };
export type StatisticsMatch = {
  id: string;
  separationId: string;
  title: string;
  date: string;
  blueScore: number;
  yellowScore: number;
  winnerTeam: "BLUE" | "YELLOW" | "DRAW";
  blueIds: string[];
  yellowIds: string[];
  config?: { winnerBonus?: number; loserPenalty?: number } | null;
  results?: { motm?: StatisticsVoteResult[]; dotm?: StatisticsVoteResult[] } | null;
};

export function buildPublicStatistics(players: StatisticsPlayer[], matches: StatisticsMatch[], contributions: StatisticsContribution[], playerA?: string, playerB?: string) {
  const totals = new Map(players.map(player => [player.id, { player, goals: 0, assists: 0 }]));
  const attendanceTotals = new Map(players.map(player => [player.id, { player, presences: 0 }]));
  const matchIds = new Set(matches.map(match => match.id));
  for (const match of matches) {
    for (const playerId of new Set([...match.blueIds, ...match.yellowIds])) {
      const attendance = attendanceTotals.get(playerId);
      if (attendance) attendance.presences += 1;
    }
  }
  for (const contribution of contributions) {
    if (!matchIds.has(contribution.matchId)) continue;
    if (!contribution.ownGoal) {
      const scorer = totals.get(contribution.scorerPlayerId);
      if (scorer) scorer.goals += 1;
      const assistant = contribution.assistPlayerId ? totals.get(contribution.assistPlayerId) : null;
      if (assistant) assistant.assists += 1;
    }
  }
  const leaderboard = [...totals.values()]
    .filter(entry => entry.goals || entry.assists)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.player.displayName.localeCompare(b.player.displayName, "pt-BR"));
  const attendance = [...attendanceTotals.values()]
    .filter(entry => entry.presences > 0)
    .map(entry => ({ ...entry, rate: matches.length ? Math.round(entry.presences / matches.length * 1000) / 10 : 0 }))
    .sort((a, b) => b.presences - a.presences || a.player.displayName.localeCompare(b.player.displayName, "pt-BR"));

  const versusMatches = playerA && playerB && playerA !== playerB ? matches.flatMap(match => {
    const teamA = match.blueIds.includes(playerA) ? "BLUE" : match.yellowIds.includes(playerA) ? "YELLOW" : null;
    const teamB = match.blueIds.includes(playerB) ? "BLUE" : match.yellowIds.includes(playerB) ? "YELLOW" : null;
    if (!teamA || !teamB || teamA === teamB) return [];
    const result = match.winnerTeam === "DRAW" ? "DRAW" : match.winnerTeam === teamA ? "A" : "B";
    return [{ ...match, teamA, teamB, result }];
  }) : [];

  return {
    leaderboard,
    attendance,
    streaks: buildStreakLeaders(players, matches),
    coverage: {
      matches: matches.length,
      matchesWithContributions: new Set(contributions.filter(entry => matchIds.has(entry.matchId)).map(entry => entry.matchId)).size,
    },
    versus: {
      playerA: players.find(player => player.id === playerA) || null,
      playerB: players.find(player => player.id === playerB) || null,
      winsA: versusMatches.filter(match => match.result === "A").length,
      winsB: versusMatches.filter(match => match.result === "B").length,
      draws: versusMatches.filter(match => match.result === "DRAW").length,
      matches: versusMatches,
    },
  };
}

export function buildStreakLeaders(players: StatisticsPlayer[], matches: StatisticsMatch[]) {
  const ordered = [...matches].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const playerMap = new Map(players.map(player => [player.id, player]));
  const records = new Map<string, { wins: number; unbeaten: number; currentWins: number; currentUnbeaten: number }>();
  for (const match of ordered) {
    for (const [team, ids] of [["BLUE", match.blueIds], ["YELLOW", match.yellowIds]] as const) {
      for (const playerId of new Set(ids)) {
        if (!playerMap.has(playerId)) continue;
        const record = records.get(playerId) || { wins: 0, unbeaten: 0, currentWins: 0, currentUnbeaten: 0 };
        const won = match.winnerTeam === team, drew = match.winnerTeam === "DRAW";
        record.currentWins = won ? record.currentWins + 1 : 0;
        record.currentUnbeaten = won || drew ? record.currentUnbeaten + 1 : 0;
        record.wins = Math.max(record.wins, record.currentWins);
        record.unbeaten = Math.max(record.unbeaten, record.currentUnbeaten);
        records.set(playerId, record);
      }
    }
  }
  const leader = (key: "wins" | "unbeaten") => {
    const length = Math.max(0, ...[...records.values()].map(record => record[key]));
    return { length, players: length ? [...records].filter(([, record]) => record[key] === length).map(([id]) => playerMap.get(id)!).sort(byPlayerName) : [] };
  };
  return { winning: leader("wins"), unbeaten: leader("unbeaten") };
}

export function buildMonthlyCareerHighlights(players: StatisticsPlayer[], matches: StatisticsMatch[], year: number, referenceDate = new Date().toISOString().slice(0, 10), focusMonth = referenceDate.slice(0, 7), annualAwardsAvailableAt = `${year}-12-31`, finalizedAwards: MonthlyCareerAward[] = [], requestedFormation: MonthlyTeamFormation = defaultMonthlyTeamFormation) {
  const formation = normalizeFormation(requestedFormation);
  const eligiblePlayers = players.filter(player => player.type === "monthly" || player.type === "goalkeeper" || player.type === "casual" || player.primaryPosition === "Goleiro");
  const playerMap = new Map(eligiblePlayers.map(player => [player.id, player]));
  const months = new Map<string, StatisticsMatch[]>();
  for (const match of matches) {
    const key = match.date.slice(0, 7);
    if (Number(key.slice(0, 4)) !== year) continue;
    months.set(key, [...(months.get(key) || []), match]);
  }
  const awards = [...months].map(([month, monthMatches]) => buildMonthAward(month, monthMatches, playerMap, formation)).filter(Boolean) as MonthlyCareerAward[];
  awards.sort((a, b) => b.month.localeCompare(a.month));
  const referenceMonth = referenceDate.slice(0, 7), selectedMonth = focusMonth.startsWith(`${year}-`) ? focusMonth : `${year}-12`;
  const isClosed = (month: string) => month < referenceMonth;
  const currentYear = Number(referenceDate.slice(0, 4));
  const annualMvpAvailable = year < currentYear || (year === currentYear && referenceDate >= annualAwardsAvailableAt);
  const closedAwards = awards.filter(award => isClosed(award.month) || (annualMvpAvailable && award.month <= referenceMonth));
  const historyByMonth = new Map(finalizedAwards.filter(award => award.month.startsWith(`${year}-`) && isClosed(award.month)).map(award => [award.month, award]));
  for (const award of closedAwards) if (!historyByMonth.has(award.month)) historyByMonth.set(award.month, award);
  const history = [...historyByMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  const mvpTotals = new Map<string, { player: StatisticsPlayer; selections: number; playerOfMonthAwards: number; momentum: number }>();
  for (const award of history) {
    for (const member of award.selection) {
      const current = mvpTotals.get(member.player.id) || { player: member.player, selections: 0, playerOfMonthAwards: 0, momentum: 0 };
      current.selections += 1; current.momentum += member.totalMomentum; mvpTotals.set(member.player.id, current);
    }
    if (award.playerOfMonth) {
      const current = mvpTotals.get(award.playerOfMonth.player.id) || { player: award.playerOfMonth.player, selections: 0, playerOfMonthAwards: 0, momentum: 0 };
      current.playerOfMonthAwards += 1; mvpTotals.set(current.player.id, current);
    }
  }
  const annualMvp = [...mvpTotals.values()]
    .sort((a, b) => b.selections - a.selections || b.playerOfMonthAwards - a.playerOfMonthAwards || b.momentum - a.momentum || byPlayerName(a.player, b.player))
    .slice(0, 3).map((entry, index) => ({ ...entry, place: index + 1, medal: (["Bola de Ouro", "Bola de Prata", "Bola de Bronze"] as const)[index], momentum: round(entry.momentum) }));
  return { year, focusMonth: selectedMonth, focusMonthClosed: isClosed(selectedMonth), focus: isClosed(selectedMonth) ? history.find(award => award.month === selectedMonth) || null : null, history, annualMvp: annualMvpAvailable ? annualMvp : [], annualMvpAvailable, annualMvpAvailableAt: annualAwardsAvailableAt };
}

type MonthlyCareerStanding = {
  player: StatisticsPlayer;
  resultMomentum: number;
  votingMomentum: number;
  totalMomentum: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
};
export type MonthlyCareerAward = {
  month: string;
  matchCount: number;
  formation: MonthlyTeamFormation;
  playerOfMonth: MonthlyCareerStanding | null;
  selection: (MonthlyCareerStanding & { role: string })[];
};

function buildMonthAward(month: string, matches: StatisticsMatch[], playerMap: Map<string, StatisticsPlayer>, formation: MonthlyTeamFormation): MonthlyCareerAward | null {
  const standings = new Map<string, MonthlyCareerStanding>();
  const get = (playerId: string) => {
    const player = playerMap.get(playerId); if (!player) return null;
    const current = standings.get(playerId) || { player, resultMomentum: 0, votingMomentum: 0, totalMomentum: 0, games: 0, wins: 0, draws: 0, losses: 0 };
    standings.set(playerId, current); return current;
  };
  for (const match of matches) {
    const winnerBonus = finite(match.config?.winnerBonus, .1), loserPenalty = finite(match.config?.loserPenalty, -.1);
    for (const [team, ids] of [["BLUE", match.blueIds], ["YELLOW", match.yellowIds]] as const) {
      for (const playerId of new Set(ids)) {
        const standing = get(playerId); if (!standing) continue;
        const won = match.winnerTeam === team, drew = match.winnerTeam === "DRAW";
        standing.games += 1; standing.wins += Number(won); standing.draws += Number(drew); standing.losses += Number(!won && !drew);
        standing.resultMomentum += drew ? 0 : won ? winnerBonus : loserPenalty;
      }
    }
    for (const result of [...(match.results?.motm || []), ...(match.results?.dotm || [])]) {
      const standing = get(result.playerId); if (standing) standing.votingMomentum += finite(result.momentum, 0);
    }
  }
  const ranked = [...standings.values()].map(standing => ({ ...standing, resultMomentum: round(standing.resultMomentum), votingMomentum: round(standing.votingMomentum), totalMomentum: round(standing.resultMomentum + standing.votingMomentum) })).sort(byMonthlyStanding);
  if (!ranked.length) return null;
  const select = (role: string, amount: number) => ranked.filter(entry => playerRole(entry.player) === role).slice(0, amount).map(entry => ({ ...entry, role }));
  return { month, matchCount: matches.length, formation, playerOfMonth: ranked[0] || null, selection: [...select("Goleiro", formation.goalkeepers), ...select("Defesa", formation.defenders), ...select("Meio-campo", formation.midfielders), ...select("Ataque", formation.attackers)] };
}

function normalizeFormation(value: MonthlyTeamFormation): MonthlyTeamFormation {
  const number = (entry: unknown, fallback: number) => Number.isInteger(Number(entry)) && Number(entry) >= 0 ? Math.min(11, Number(entry)) : fallback;
  const result = { goalkeepers: number(value?.goalkeepers, 1), defenders: number(value?.defenders, 2), midfielders: number(value?.midfielders, 2), attackers: number(value?.attackers, 2) };
  return Object.values(result).reduce((sum, entry) => sum + entry, 0) > 0 ? result : { ...defaultMonthlyTeamFormation };
}

function playerRole(player: StatisticsPlayer) {
  if (player.type === "goalkeeper" || player.primaryPosition === "Goleiro") return "Goleiro";
  return ["Defesa", "Meio-campo", "Ataque"].includes(String(player.primaryPosition)) ? String(player.primaryPosition) : "";
}
function byMonthlyStanding(a: MonthlyCareerStanding, b: MonthlyCareerStanding) { return b.totalMomentum - a.totalMomentum || b.votingMomentum - a.votingMomentum || b.wins - a.wins || b.games - a.games || byPlayerName(a.player, b.player); }
function byPlayerName(a: StatisticsPlayer, b: StatisticsPlayer) { return a.displayName.localeCompare(b.displayName, "pt-BR"); }
function finite(value: unknown, fallback: number) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function round(value: number) { return Math.round((value + Number.EPSILON) * 1000) / 1000; }
