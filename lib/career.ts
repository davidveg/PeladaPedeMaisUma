export type CareerConfig = {
  enabled: boolean;
  trackContributions: boolean;
  cardTiersEnabled: boolean;
  cardBronzeMax: number;
  cardSilverMax: number;
  cardGoldMax: number;
  momentumMultiplier: number;
  winnerBonus: number;
  loserPenalty: number;
  motmThird: number;
  motmSecond: number;
  motmFirst: number;
  dotmThird: number;
  dotmSecond: number;
  dotmFirst: number;
  votingDays: number;
};

export const defaultCareerConfig: CareerConfig = { enabled: true, trackContributions: true, cardTiersEnabled: false, cardBronzeMax: 2.4, cardSilverMax: 3.9, cardGoldMax: 4.5, momentumMultiplier: 1, winnerBonus: .1, loserPenalty: -.1, motmThird: .1, motmSecond: .2, motmFirst: .3, dotmThird: -.1, dotmSecond: -.2, dotmFirst: -.3, votingDays: 5 };

export function careerConfigFromRow(row: any): CareerConfig {
  if (!row) return { ...defaultCareerConfig };
  return { enabled: Boolean(row.enabled), trackContributions: Boolean(row.track_contributions ?? 1), cardTiersEnabled: Boolean(row.card_tiers_enabled ?? 0), cardBronzeMax: Number(row.card_bronze_max ?? 2.4), cardSilverMax: Number(row.card_silver_max ?? 3.9), cardGoldMax: Number(row.card_gold_max ?? 4.5), momentumMultiplier: Number(row.momentum_multiplier ?? 1), winnerBonus: Number(row.winner_bonus), loserPenalty: Number(row.loser_penalty), motmThird: Number(row.motm_third), motmSecond: Number(row.motm_second), motmFirst: Number(row.motm_first), dotmThird: Number(row.dotm_third), dotmSecond: Number(row.dotm_second), dotmFirst: Number(row.dotm_first), votingDays: Number(row.voting_days) };
}

export function validateCareerConfig(config: CareerConfig) {
  const positive = [config.winnerBonus, config.motmThird, config.motmSecond, config.motmFirst];
  const negative = [config.loserPenalty, config.dotmThird, config.dotmSecond, config.dotmFirst];
  const tiers = [config.cardBronzeMax, config.cardSilverMax, config.cardGoldMax];
  const validTiers = tiers.every(value => Number.isFinite(value) && value >= 1 && value < 5 && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9) && config.cardBronzeMax < config.cardSilverMax && config.cardSilverMax < config.cardGoldMax;
  return validTiers && Number.isFinite(config.momentumMultiplier) && config.momentumMultiplier >= 0 && config.momentumMultiplier <= 5 && positive.every(value => Number.isFinite(value) && value >= 0 && value <= 1) && negative.every(value => Number.isFinite(value) && value <= 0 && value >= -1) && Number.isInteger(config.votingDays) && config.votingDays >= 1 && config.votingDays <= 30;
}

export function matchWinner(blueScore: number, yellowScore: number) { return blueScore === yellowScore ? "DRAW" : blueScore > yellowScore ? "BLUE" : "YELLOW"; }
export function teamMomentumForResult(winner: "BLUE" | "YELLOW" | "DRAW", team: "BLUE" | "YELLOW", winnerBonus: number, loserPenalty: number) { return winner === "DRAW" ? 0 : winner === team ? winnerBonus : loserPenalty; }

export type CareerVoteInput = { voterPlayerId: string; motmThirdId: string; motmSecondId: string; motmFirstId: string; dotmThirdId: string; dotmSecondId: string; dotmFirstId: string };

export function validateCareerVote(input: CareerVoteInput, participantIds: string[]) {
  const podium = [input.motmThirdId, input.motmSecondId, input.motmFirstId, input.dotmThirdId, input.dotmSecondId, input.dotmFirstId];
  const participants = new Set(participantIds);
  if (!participants.has(input.voterPlayerId)) return "O jogador identificado não participou desta partida.";
  if (podium.some(id => !participants.has(id))) return "Todos os votos devem ser destinados a jogadores desta partida.";
  if (podium.includes(input.voterPlayerId)) return "O jogador não pode votar em si mesmo.";
  if (new Set(podium).size !== podium.length) return "Cada jogador pode aparecer somente uma vez entre os destaques.";
  return null;
}

export function rankCareerVotes(votes: any[], prefix: "motm" | "dotm") {
  const totals = new Map<string, { playerId: string; points: number; firstVotes: number; secondVotes: number; thirdVotes: number }>();
  const add = (playerId: string, points: number, place: "firstVotes" | "secondVotes" | "thirdVotes") => {
    const current = totals.get(playerId) || { playerId, points: 0, firstVotes: 0, secondVotes: 0, thirdVotes: 0 };
    current.points += points; current[place] += 1; totals.set(playerId, current);
  };
  for (const vote of votes) {
    add(vote[`${prefix}_third_id`], 1, "thirdVotes");
    add(vote[`${prefix}_second_id`], 2, "secondVotes");
    add(vote[`${prefix}_first_id`], 3, "firstVotes");
  }
  return [...totals.values()].sort((a,b)=>b.points-a.points||b.firstVotes-a.firstVotes||b.secondVotes-a.secondVotes||b.thirdVotes-a.thirdVotes||a.playerId.localeCompare(b.playerId)).slice(0,3).map((entry,index)=>({ ...entry, place: index+1 }));
}
