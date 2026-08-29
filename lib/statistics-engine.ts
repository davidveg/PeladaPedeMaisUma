/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- record helpers infer heterogeneous derived summaries. */
import {
  BLOWOUT_GOAL_DIFFERENCE,
  DEFAULT_PARTNERSHIP_MINIMUM_GAMES,
  DEFAULT_RECENT_WINDOW,
  HIGH_CONFIDENCE_GAMES,
  IPI_WEIGHTS,
  MEDIUM_CONFIDENCE_GAMES,
  OFFENSIVE_WEIGHTS,
  STATISTICS_VERSION,
} from "./statistics-engine-config.ts";
import type {
  AdvancedStatisticsFilters,
  AdvancedStatisticsMatch,
  AdvancedStatisticsPlayer,
  ConfidenceLevel,
  StatisticsParticipant,
  StatisticsPosition,
} from "./statistics-types.ts";

type Team = "BLUE" | "YELLOW";
type PlayerMatchEntry = {
  matchId: string; date: string; team: Team; result: -1 | 0 | 1; goalsFor: number; goalsAgainst: number;
  plusMinus: number; goals: number; assists: number; contributionsAvailable: boolean; peerPoints: number; peerPossible: number; position: StatisticsPosition;
};
type PlayerAccumulator = { player: AdvancedStatisticsPlayer; entries: PlayerMatchEntry[] };
type TeamObservation = { result: -1 | 0 | 1; goalsFor: number; goalsAgainst: number };

const positions: StatisticsPosition[] = ["Goleiro", "Defesa", "Meio-campo", "Ataque"];
const clamp = (value: number, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, value));
const round = (value: number, digits = 2) => { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; };
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const standardDeviation = (values: number[]) => { if (values.length < 2) return 0; const mean = average(values); return Math.sqrt(average(values.map(value => (value - mean) ** 2))); };
const utilization = (wins: number, draws: number, games: number) => games ? (wins * 3 + draws) / (games * 3) * 100 : 0;
export function calculateAdvancedStatistics(
  players: AdvancedStatisticsPlayer[],
  inputMatches: AdvancedStatisticsMatch[],
  filters: AdvancedStatisticsFilters = {},
) {
  const recentWindow = filters.recentWindow || DEFAULT_RECENT_WINDOW;
  const minimumGames = Math.max(1, Math.floor(filters.minimumGames || 1));
  const partnershipMinimumGames = Math.max(1, Math.floor(filters.partnershipMinimumGames || DEFAULT_PARTNERSHIP_MINIMUM_GAMES));
  const matches = inputMatches.filter(match =>
    (!filters.from || match.date >= filters.from) && (!filters.to || match.date <= filters.to) &&
    (!filters.seasonNumber || match.seasonNumber === filters.seasonNumber)
  ).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  const playerMap = new Map(players.map(player => [player.id, player]));
  const accumulators = new Map<string, PlayerAccumulator>();
  const entriesByMatch = new Map<string, Map<string, PlayerMatchEntry>>();

  for (const match of matches) {
    const goals = new Map<string, number>(), assists = new Map<string, number>();
    for (const contribution of match.contributions) {
      if (!contribution.ownGoal) increment(goals, contribution.scorerPlayerId);
      if (!contribution.ownGoal && contribution.assistPlayerId) increment(assists, contribution.assistPlayerId);
    }
    const peer = new Map<string, number>();
    const validVotes = match.status === "CLOSED" ? match.votes : [];
    for (const vote of validVotes) {
      add(peer, vote.motmFirstId, 3); add(peer, vote.motmSecondId, 2); add(peer, vote.motmThirdId, 1);
      add(peer, vote.dotmFirstId, -3); add(peer, vote.dotmSecondId, -2); add(peer, vote.dotmThirdId, -1);
    }
    const matchEntries = new Map<string, PlayerMatchEntry>();
    for (const [team, participants] of [["BLUE", match.blue], ["YELLOW", match.yellow]] as const) {
      const goalsFor = team === "BLUE" ? match.blueScore : match.yellowScore;
      const goalsAgainst = team === "BLUE" ? match.yellowScore : match.blueScore;
      const won = match.winnerTeam === team, draw = match.winnerTeam === "DRAW";
      for (const participant of uniqueParticipants(participants)) {
        const player = playerMap.get(participant.playerId); if (!player) continue;
        const position = normalizedPosition(participant.position || player.primaryPosition);
        const entry: PlayerMatchEntry = {
          matchId: match.id, date: match.date, team, result: won ? 1 : draw ? 0 : -1,
          goalsFor, goalsAgainst, plusMinus: goalsFor - goalsAgainst,
          goals: goals.get(player.id) || 0, assists: assists.get(player.id) || 0, contributionsAvailable: Boolean(match.contributionsAvailable),
          peerPoints: peer.get(player.id) || 0, peerPossible: validVotes.length * 3, position,
        };
        const accumulator = accumulators.get(player.id) || { player, entries: [] };
        accumulator.entries.push(entry); accumulators.set(player.id, accumulator); matchEntries.set(player.id, entry);
      }
    }
    entriesByMatch.set(match.id, matchEntries);
  }

  const summaries = [...accumulators.values()].map(accumulator => baseSummary(accumulator, recentWindow));
  const percentiles = percentileComponents(summaries);
  const playerStatistics = summaries.map(summary => finalizePlayerSummary(summary, percentiles, recentWindow, matches, entriesByMatch))
    .filter(entry => entry.games >= minimumGames && (!filters.position || entry.position === filters.position))
    .sort((left, right) => (right.ipi?.value || -1) - (left.ipi?.value || -1) || left.player.displayName.localeCompare(right.player.displayName, "pt-BR"));
  const partnerships = calculatePartnerships(matches, playerMap, partnershipMinimumGames);
  const balance = calculateBalanceQuality(matches);
  const records = calculateRecords(matches, playerStatistics, entriesByMatch, playerMap);
  const publicPlayerStatistics = playerStatistics.map(({ entries: _entries, offenseRate: _offenseRate, peerRating: _peerRating, ...entry }) => entry);
  const positionRankings = Object.fromEntries(positions.map(position => [position, publicPlayerStatistics.filter(entry => entry.position === position)]));
  return {
    version: STATISTICS_VERSION,
    filters: { ...filters, recentWindow, minimumGames, partnershipMinimumGames },
    coverage: {
      matches: matches.length,
      closedVotes: matches.filter(match => match.status === "CLOSED" && match.votes.length).length,
      detailedContributions: matches.filter(match => match.contributionsAvailable).length,
      predictedBalance: matches.filter(hasPrediction).length,
      automaticPredictions: matches.filter(match => !match.manuallyAdjusted && hasPrediction(match)).length,
    },
    players: publicPlayerStatistics,
    partnerships,
    chemistry: partnerships.map(entry => ({ source: entry.playerA, target: entry.playerB, games: entry.games, chemistry: entry.chemistry, confidence: entry.confidence })),
    positionRankings,
    records,
    balance,
  };
}

function baseSummary(accumulator: PlayerAccumulator, recentWindow: number) {
  const entries = [...accumulator.entries].sort((a, b) => a.date.localeCompare(b.date) || a.matchId.localeCompare(b.matchId));
  const games = entries.length, wins = entries.filter(entry => entry.result === 1).length, draws = entries.filter(entry => entry.result === 0).length, losses = games - wins - draws;
  const goals = sum(entries, "goals"), assists = sum(entries, "assists"), contributionGames = entries.filter(entry => entry.contributionsAvailable).length, plusMinus = sum(entries, "plusMinus"), goalsFor = sum(entries, "goalsFor"), goalsAgainst = sum(entries, "goalsAgainst");
  const peerPossible = sum(entries, "peerPossible"), peerPoints = sum(entries, "peerPoints");
  const position = dominantPosition(entries);
  const recent = entries.slice(-recentWindow), baseline = entries.slice(0, Math.max(0, entries.length - recentWindow));
  const recentWins = recent.filter(entry => entry.result === 1).length, recentDraws = recent.filter(entry => entry.result === 0).length;
  const recentUtilization = utilization(recentWins, recentDraws, recent.length);
  const baselineWins = baseline.filter(entry => entry.result === 1).length, baselineDraws = baseline.filter(entry => entry.result === 0).length;
  const baselineUtilization = baseline.length ? utilization(baselineWins, baselineDraws, baseline.length) : null;
  const matchPerformance = entries.map(entry => clamp((entry.result === 1 ? 78 : entry.result === 0 ? 52 : 26) + entry.plusMinus * 6 + entry.goals * 8 + entry.assists * 6));
  const rawConsistency = entries.length >= 3 ? clamp(100 - standardDeviation(matchPerformance) * 2) : null;
  const consistency = rawConsistency == null ? null : round(50 + Math.min(1, games / 15) * (rawConsistency - 50), 1);
  return {
    player: accumulator.player, entries, position, games, wins, draws, losses, goals, assists, contributionGames, goalsFor, goalsAgainst, plusMinus,
    plusMinusPerGame: games ? plusMinus / games : 0, utilization: utilization(wins, draws, games),
    offenseRate: contributionGames ? (goals * OFFENSIVE_WEIGHTS[position].goals + assists * OFFENSIVE_WEIGHTS[position].assists) / contributionGames : null,
    peerRating: peerPossible ? clamp(50 + peerPoints / peerPossible * 50) : null,
    recent: { window: recentWindow, games: recent.length, contributionGames: recent.filter(entry => entry.contributionsAvailable).length, sequence: recent.map(entry => entry.result === 1 ? "V" : entry.result === 0 ? "E" : "D"), utilization: recentUtilization, goals: sum(recent, "goals"), assists: sum(recent, "assists"), plusMinus: sum(recent, "plusMinus"), trend: baselineUtilization == null ? null : recentUtilization - baselineUtilization },
    consistency,
  };
}

function percentileComponents(summaries: ReturnType<typeof baseSummary>[]) {
  const result = new Map<string, { impact: number; offense: number | null }>();
  for (const position of positions) {
    const group = summaries.filter(summary => summary.position === position);
    for (const summary of group) result.set(summary.player.id, {
      impact: percentile(summary.plusMinusPerGame, group.map(entry => entry.plusMinusPerGame)),
      offense: summary.offenseRate == null ? null : percentile(summary.offenseRate, group.flatMap(entry => entry.offenseRate == null ? [] : [entry.offenseRate])),
    });
  }
  return result;
}

function finalizePlayerSummary(summary: ReturnType<typeof baseSummary>, components: Map<string, { impact: number; offense: number | null }>, recentWindow: number, matches: AdvancedStatisticsMatch[], entriesByMatch: Map<string, Map<string, PlayerMatchEntry>>) {
  const percentileValues = components.get(summary.player.id) || { impact: 50, offense: null };
  const form = summary.recent.games ? summary.recent.utilization : null;
  const values: Record<string, number | null> = { result: summary.utilization, impact: percentileValues.impact, offense: percentileValues.offense, consistency: summary.consistency, form, peerRating: summary.peerRating };
  const weights = IPI_WEIGHTS[summary.position], available = Object.entries(weights).filter(([key]) => values[key] != null);
  const totalWeight = available.reduce((total, [, weight]) => total + weight, 0);
  const rawIpi = totalWeight ? available.reduce((total, [key, weight]) => total + Number(values[key]) * weight, 0) / totalWeight : null;
  const reliability = Math.min(1, summary.games / HIGH_CONFIDENCE_GAMES);
  const ipi = rawIpi == null ? null : { value: round(50 + reliability * (rawIpi - 50), 1), raw: round(rawIpi, 1), confidence: confidence(summary.games), games: summary.games, availableComponents: available.map(([key]) => key) };
  return { ...summary, plusMinusPerGame: round(summary.plusMinusPerGame), utilization: round(summary.utilization, 1), impact: calculateImpact(summary.player.id, summary.entries, matches, entriesByMatch), ipi, recent: { ...summary.recent, utilization: round(summary.recent.utilization, 1), trend: summary.recent.trend == null ? null : round(summary.recent.trend, 1), window: recentWindow } };
}

function calculateImpact(playerId: string, entries: PlayerMatchEntry[], matches: AdvancedStatisticsMatch[], entriesByMatch: Map<string, Map<string, PlayerMatchEntry>>) {
  const withPlayer: TeamObservation[] = entries.map(entry => ({ result: entry.result, goalsFor: entry.goalsFor, goalsAgainst: entry.goalsAgainst }));
  const withoutPlayer: TeamObservation[] = [];
  for (const match of matches) {
    const participants = entriesByMatch.get(match.id); if (participants?.has(playerId)) continue;
    const resultBlue: -1 | 0 | 1 = match.winnerTeam === "BLUE" ? 1 : match.winnerTeam === "YELLOW" ? -1 : 0;
    withoutPlayer.push({ result: resultBlue, goalsFor: match.blueScore, goalsAgainst: match.yellowScore });
    withoutPlayer.push({ result: resultBlue === 0 ? 0 : resultBlue === 1 ? -1 : 1, goalsFor: match.yellowScore, goalsAgainst: match.blueScore });
  }
  const summarize = (observations: TeamObservation[]) => {
    const wins = observations.filter(entry => entry.result === 1).length, draws = observations.filter(entry => entry.result === 0).length;
    return { games: observations.length, utilization: observations.length ? round(utilization(wins, draws, observations.length), 1) : null, goalsForPerGame: observations.length ? round(average(observations.map(entry => entry.goalsFor))) : null, goalsAgainstPerGame: observations.length ? round(average(observations.map(entry => entry.goalsAgainst))) : null, plusMinusPerGame: observations.length ? round(average(observations.map(entry => entry.goalsFor - entry.goalsAgainst))) : null };
  };
  const withStats = summarize(withPlayer), withoutStats = summarize(withoutPlayer);
  return { withPlayer: withStats, withoutPlayer: withoutStats, utilizationDifference: withStats.utilization == null || withoutStats.utilization == null ? null : round(withStats.utilization - withoutStats.utilization, 1), plusMinusDifference: withStats.plusMinusPerGame == null || withoutStats.plusMinusPerGame == null ? null : round(withStats.plusMinusPerGame - withoutStats.plusMinusPerGame) };
}

function calculatePartnerships(matches: AdvancedStatisticsMatch[], playerMap: Map<string, AdvancedStatisticsPlayer>, minimumGames: number) {
  const pairs = new Map<string, { playerA: AdvancedStatisticsPlayer; playerB: AdvancedStatisticsPlayer; games: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number }>();
  for (const match of matches) for (const [team, participants] of [["BLUE", match.blue], ["YELLOW", match.yellow]] as const) {
    const ids = uniqueParticipants(participants).map(entry => entry.playerId).filter(id => playerMap.has(id)).sort();
    const won = match.winnerTeam === team, draw = match.winnerTeam === "DRAW";
    const goalsFor = team === "BLUE" ? match.blueScore : match.yellowScore, goalsAgainst = team === "BLUE" ? match.yellowScore : match.blueScore;
    for (let first = 0; first < ids.length; first++) for (let second = first + 1; second < ids.length; second++) {
      const key = `${ids[first]}:${ids[second]}`, current = pairs.get(key) || { playerA: playerMap.get(ids[first])!, playerB: playerMap.get(ids[second])!, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
      current.games++; current.wins += Number(won); current.draws += Number(draw); current.losses += Number(!won && !draw); current.goalsFor += goalsFor; current.goalsAgainst += goalsAgainst; pairs.set(key, current);
    }
  }
  return [...pairs.values()].filter(pair => pair.games >= minimumGames).map(pair => {
    const usage = utilization(pair.wins, pair.draws, pair.games), saldoPerGame = (pair.goalsFor - pair.goalsAgainst) / pair.games;
    const raw = usage * .7 + clamp(50 + saldoPerGame * 10) * .3, reliability = pair.games / (pair.games + 5);
    return { ...pair, utilization: round(usage, 1), plusMinus: pair.goalsFor - pair.goalsAgainst, plusMinusPerGame: round(saldoPerGame), chemistry: round(50 + reliability * (raw - 50), 1), confidence: round(reliability * 100, 1) };
  }).sort((left, right) => right.chemistry - left.chemistry || right.games - left.games || left.playerA.displayName.localeCompare(right.playerA.displayName, "pt-BR"));
}

function calculateBalanceQuality(matches: AdvancedStatisticsMatch[]) {
  const actual = matches.filter(match => !match.manuallyAdjusted && hasPrediction(match));
  const predictedDifferences = actual.map(match => Number(match.prediction!.blueStrength) - Number(match.prediction!.yellowStrength));
  const observedDifferences = actual.map(match => match.blueScore - match.yellowScore);
  const balanceIndices = actual.map(match => { const blue = Number(match.prediction!.blueStrength), yellow = Number(match.prediction!.yellowStrength); return clamp(100 - Math.abs(blue - yellow) / Math.max(1, (Math.abs(blue) + Math.abs(yellow)) / 2) * 100); });
  return {
    sample: actual.length,
    averagePredictedBalance: actual.length ? round(average(balanceIndices), 1) : null,
    averageGoalDifference: matches.length ? round(average(matches.map(match => Math.abs(match.blueScore - match.yellowScore)))) : null,
    oneGoalGamesPercentage: matches.length ? round(matches.filter(match => Math.abs(match.blueScore - match.yellowScore) === 1).length / matches.length * 100, 1) : null,
    drawsPercentage: matches.length ? round(matches.filter(match => match.blueScore === match.yellowScore).length / matches.length * 100, 1) : null,
    blowoutsPercentage: matches.length ? round(matches.filter(match => Math.abs(match.blueScore - match.yellowScore) >= BLOWOUT_GOAL_DIFFERENCE).length / matches.length * 100, 1) : null,
    correlation: actual.length >= 3 ? round(pearson(predictedDifferences, observedDifferences), 3) : null,
    predictionError: null,
    predictionErrorReason: "O algoritmo estima força e equilíbrio, mas ainda não produz um placar esperado calibrado.",
  };
}

function calculateRecords(matches: AdvancedStatisticsMatch[], players: any[], entriesByMatch: Map<string, Map<string, PlayerMatchEntry>>, playerMap: Map<string, AdvancedStatisticsPlayer>) {
  const streaks = { wins: recordStreak(players, entry => entry.result === 1), unbeaten: recordStreak(players, entry => entry.result >= 0), losses: recordStreak(players, entry => entry.result === -1), goals: recordStreak(players, entry => entry.goals > 0), assists: recordStreak(players, entry => entry.assists > 0) };
  let mostGoals: any = null, mostAssists: any = null;
  for (const match of matches) for (const entry of entriesByMatch.get(match.id)?.values() || []) {
    if (entry.goals > 0 && (!mostGoals || entry.goals > mostGoals.value)) mostGoals = { player: playerMap.get([...entriesByMatch.get(match.id)!.entries()].find(([, candidate]) => candidate === entry)![0]), value: entry.goals, matchId: match.id, separationId: match.separationId, date: match.date, title: match.title };
    if (entry.assists > 0 && (!mostAssists || entry.assists > mostAssists.value)) mostAssists = { player: playerMap.get([...entriesByMatch.get(match.id)!.entries()].find(([, candidate]) => candidate === entry)![0]), value: entry.assists, matchId: match.id, separationId: match.separationId, date: match.date, title: match.title };
  }
  const biggestBlowout = [...matches].sort((a, b) => Math.abs(b.blueScore - b.yellowScore) - Math.abs(a.blueScore - a.yellowScore))[0] || null;
  const highestScoring = [...matches].sort((a, b) => b.blueScore + b.yellowScore - a.blueScore - a.yellowScore)[0] || null;
  const eligible = players.filter(player => player.games >= 3);
  const highestPlusMinus = [...players].sort((a, b) => b.plusMinus - a.plusMinus)[0] || null;
  const bestUtilization = [...eligible].sort((a, b) => b.utilization - a.utilization)[0] || null;
  const highestIpi = [...eligible].sort((a, b) => (b.ipi?.value || 0) - (a.ipi?.value || 0))[0] || null;
  const highestConsistency = [...eligible].filter(entry => entry.consistency != null).sort((a, b) => b.consistency - a.consistency)[0] || null;
  return { ...streaks, mostGoals, mostAssists, biggestBlowout, highestScoring,
    highestPlusMinus: highestPlusMinus ? { player: highestPlusMinus.player, plusMinus: highestPlusMinus.plusMinus } : null,
    bestUtilization: bestUtilization ? { player: bestUtilization.player, utilization: bestUtilization.utilization, games: bestUtilization.games } : null,
    highestIpi: highestIpi ? { player: highestIpi.player, ipi: highestIpi.ipi } : null,
    highestConsistency: highestConsistency ? { player: highestConsistency.player, consistency: highestConsistency.consistency } : null,
  };
}

function recordStreak(players: any[], predicate: (entry: PlayerMatchEntry) => boolean) {
  let length = 0, leaders: AdvancedStatisticsPlayer[] = [];
  for (const player of players) {
    let current = 0, best = 0;
    for (const entry of player.entries) { current = predicate(entry) ? current + 1 : 0; best = Math.max(best, current); }
    if (best > length) { length = best; leaders = [player.player]; } else if (best && best === length) leaders.push(player.player);
  }
  return { length, players: leaders.sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR")) };
}

function confidence(games: number): ConfidenceLevel { return games >= HIGH_CONFIDENCE_GAMES ? "Alta" : games >= MEDIUM_CONFIDENCE_GAMES ? "Média" : "Baixa"; }
function dominantPosition(entries: PlayerMatchEntry[]) { return positions.map(position => ({ position, total: entries.filter(entry => entry.position === position).length })).sort((a, b) => b.total - a.total || positions.indexOf(a.position) - positions.indexOf(b.position))[0]?.position || "Ataque"; }
function normalizedPosition(value: unknown): StatisticsPosition { const candidate = String(value || ""); return positions.includes(candidate as StatisticsPosition) ? candidate as StatisticsPosition : "Ataque"; }
function percentile(value: number, values: number[]) { if (values.length <= 1) return 50; const below = values.filter(candidate => candidate < value).length, equal = values.filter(candidate => candidate === value).length; return round((below + (equal - 1) / 2) / (values.length - 1) * 100, 1); }
function uniqueParticipants(participants: StatisticsParticipant[]) { return [...new Map(participants.map(entry => [entry.playerId, entry])).values()]; }
function increment(values: Map<string, number>, key: string) { if (key) values.set(key, (values.get(key) || 0) + 1); }
function add(values: Map<string, number>, key: string, value: number) { if (key) values.set(key, (values.get(key) || 0) + value); }
function sum<T>(entries: T[], key: keyof T) { return entries.reduce((total, entry) => total + Number(entry[key] || 0), 0); }
function hasPrediction(match: AdvancedStatisticsMatch) { return Number.isFinite(match.prediction?.blueStrength) && Number.isFinite(match.prediction?.yellowStrength); }
function pearson(left: number[], right: number[]) { const leftMean = average(left), rightMean = average(right); const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0); const denominator = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0) * right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0)); return denominator ? numerator / denominator : 0; }
