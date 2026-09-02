export type HistoricalPerformance = {
  adjustment: number;
  confidence: number;
  games: number;
  winLossForm: number;
  goalDifference: number;
  goals: number;
  assists: number;
  peerRating: number;
  recentMomentum: number;
  recentMatches: number;
};

type MatchEntry = {
  date: string;
  result: number;
  goalDifference: number;
  goals: number;
  assists: number;
  peerPoints: number;
  peerPossible: number;
  momentum: number;
};

type Accumulator = { position: string; entries: MatchEntry[] };

const clamp = (value: number, minimum = -1, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const parse = (value: unknown, fallback: any) => { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } };
const rounded = (value: number) => Math.round(value * 1000) / 1000;

export function emptyHistoricalPerformance(): HistoricalPerformance {
  return { adjustment: 0, confidence: 0, games: 0, winLossForm: 0, goalDifference: 0, goals: 0, assists: 0, peerRating: 0, recentMomentum: 0, recentMatches: 0 };
}

export function calculateHistoricalPerformance(matchRows: any[], contributionRows: any[] = [], voteRows: any[] = []): Record<string, HistoricalPerformance> {
  const contributionsByMatch = groupBy(contributionRows, row => String(row.career_match_id ?? row.careerMatchId ?? ""));
  const votesByMatch = groupBy(voteRows, row => String(row.career_match_id ?? row.careerMatchId ?? ""));
  const accumulators: Record<string, Accumulator> = {};

  for (const row of matchRows) {
    const matchId = String(row.id ?? row.career_match_id ?? "");
    const snapshot = parse(row.participation_snapshot ?? row.participationSnapshot ?? row.snapshot, {}), blue = Array.isArray(snapshot.blue) ? snapshot.blue : [], yellow = Array.isArray(snapshot.yellow) ? snapshot.yellow : [];
    const participants = new Map<string, { team: "BLUE" | "YELLOW"; position: string }>();
    for (const player of blue) if (player?.id) participants.set(String(player.id), { team: "BLUE", position: String(player.primaryPosition ?? "") });
    for (const player of yellow) if (player?.id) participants.set(String(player.id), { team: "YELLOW", position: String(player.primaryPosition ?? "") });
    if (!participants.size) continue;

    const goals = new Map<string, number>(), assists = new Map<string, number>();
    for (const contribution of contributionsByMatch.get(matchId) || []) {
      if (!Boolean(contribution.is_own_goal ?? contribution.ownGoal)) increment(goals, String(contribution.scorer_player_id ?? contribution.scorerPlayerId ?? ""));
      increment(assists, String(contribution.assist_player_id ?? contribution.assistPlayerId ?? ""));
    }
    const finalizedVotes = row.status == null || String(row.status) === "CLOSED" ? votesByMatch.get(matchId) || [] : [];
    const peer = new Map<string, number>(), ballots = finalizedVotes.length;
    for (const vote of finalizedVotes) {
      add(peer, String(vote.motm_first_id ?? vote.motmFirstId ?? ""), 3); add(peer, String(vote.motm_second_id ?? vote.motmSecondId ?? ""), 2); add(peer, String(vote.motm_third_id ?? vote.motmThirdId ?? ""), 1);
      add(peer, String(vote.dotm_first_id ?? vote.dotmFirstId ?? ""), -3); add(peer, String(vote.dotm_second_id ?? vote.dotmSecondId ?? ""), -2); add(peer, String(vote.dotm_third_id ?? vote.dotmThirdId ?? ""), -1);
    }
    const configuration = parse(row.config_snapshot ?? row.configSnapshot, {}), results = parse(row.results_snapshot ?? row.resultsSnapshot, {});
    const votingMomentum = new Map<string, number>();
    for (const entry of [...(results?.motm || []), ...(results?.dotm || [])]) add(votingMomentum, String(entry.playerId ?? entry.player_id ?? ""), number(entry.momentum));
    const blueScore = number(row.blue_score ?? row.blueScore), yellowScore = number(row.yellow_score ?? row.yellowScore), winner = String(row.winner_team ?? row.winnerTeam ?? "DRAW");
    const date = String(row.match_date ?? row.matchDate ?? row.created_at ?? row.createdAt ?? "");

    for (const [playerId, participant] of participants) {
      const won = winner === participant.team, lost = winner === "BLUE" || winner === "YELLOW" ? !won : false;
      const result = won ? 1 : lost ? -1 : 0, goalDifference = participant.team === "BLUE" ? blueScore - yellowScore : yellowScore - blueScore;
      const resultValue = won ? number(configuration.winnerBonus, .1) : lost ? number(configuration.loserPenalty, -.1) : 0;
      const momentum = resultValue * number(configuration.resultMomentumMultiplier, 1) + number(votingMomentum.get(playerId)) * number(configuration.momentumMultiplier, 1);
      const accumulator = accumulators[playerId] ?? { position: participant.position, entries: [] };
      if (!accumulator.position) accumulator.position = participant.position;
      accumulator.entries.push({ date, result, goalDifference, goals: goals.get(playerId) || 0, assists: assists.get(playerId) || 0, peerPoints: peer.get(playerId) || 0, peerPossible: ballots * 3, momentum });
      accumulators[playerId] = accumulator;
    }
  }

  const ratesByPosition = new Map<string, { goals: number[]; assists: number[] }>();
  for (const accumulator of Object.values(accumulators)) {
    const games = accumulator.entries.length || 1, group = ratesByPosition.get(accumulator.position) ?? { goals: [], assists: [] };
    group.goals.push(sum(accumulator.entries, "goals") / games); group.assists.push(sum(accumulator.entries, "assists") / games);
    ratesByPosition.set(accumulator.position, group);
  }

  return Object.fromEntries(Object.entries(accumulators).map(([playerId, accumulator]) => {
    const entries = accumulator.entries, games = entries.length, group = ratesByPosition.get(accumulator.position) ?? { goals: [], assists: [] };
    const goalsRate = sum(entries, "goals") / games, assistsRate = sum(entries, "assists") / games;
    const winLossForm = clamp(sum(entries, "result") / games), goalDifference = clamp((sum(entries, "goalDifference") / games) / 3);
    const goals = relativeRate(goalsRate, average(group.goals)), assists = relativeRate(assistsRate, average(group.assists));
    const peerPossible = sum(entries, "peerPossible"), peerRating = peerPossible ? clamp(sum(entries, "peerPoints") / peerPossible) : 0;
    const recent = [...entries].sort((left, right) => left.date.localeCompare(right.date)).slice(-10), recentWeight = recent.reduce((total, _entry, index) => total + index + 1, 0);
    const recentAverage = recentWeight ? recent.reduce((total, entry, index) => total + entry.momentum * (index + 1), 0) / recentWeight : 0;
    const recentMomentum = clamp(recentAverage / .3), confidence = Math.min(1, games / 5);
    const index = winLossForm * .28 + goalDifference * .18 + goals * .12 + assists * .10 + peerRating * .17 + recentMomentum * .15;
    return [playerId, { adjustment: rounded(clamp(index * .6 * confidence, -.6, .6)), confidence: rounded(confidence), games, winLossForm: rounded(winLossForm), goalDifference: rounded(goalDifference), goals: rounded(goals), assists: rounded(assists), peerRating: rounded(peerRating), recentMomentum: rounded(recentMomentum), recentMatches: recent.length }];
  }));
}

function groupBy<T>(rows: T[], key: (row: T) => string) { const grouped = new Map<string, T[]>(); for (const row of rows) { const value = key(row); if (!value) continue; const items = grouped.get(value) || []; items.push(row); grouped.set(value, items); } return grouped; }
function increment(values: Map<string, number>, key: string) { if (key) values.set(key, (values.get(key) || 0) + 1); }
function add(values: Map<string, number>, key: string, value: number) { if (key) values.set(key, (values.get(key) || 0) + value); }
function sum(entries: MatchEntry[], key: keyof MatchEntry) { return entries.reduce((total, entry) => total + number(entry[key]), 0); }
function average(values: number[]) { return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0; }
function relativeRate(value: number, positionAverage: number) { if (!positionAverage && !value) return 0; return clamp((value - positionAverage) / Math.max(.25, positionAverage + .25)); }
