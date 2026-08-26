import type { Player } from "./football";

export function publicPlayer(row: any): Player {
  const displayName = String(row.display_name ?? row.displayName ?? "Jogador");
  return {
    id: String(row.id),
    fullName: displayName,
    displayName,
    type: String(row.type ?? "monthly"),
    primaryPosition: row.primary_position ?? row.primaryPosition,
    secondaryPosition: row.secondary_position ?? row.secondaryPosition ?? null,
    speed: Number(row.speed ?? 3),
    skill: Number(row.skill ?? 3),
    marking: Number(row.marking ?? 3),
    tacticalIntelligence: Number(row.tactical_intelligence ?? row.tacticalIntelligence ?? 3),
    competitiveness: Number(row.competitiveness ?? 3),
    goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.goalkeeperPositioning ?? row.speed ?? 3),
    goalExit: Number(row.goal_exit ?? row.goalExit ?? row.marking ?? 3),
    goalkeeperSafety: Number(row.goalkeeper_safety ?? row.goalkeeperSafety ?? 3),
    goalkeeperLeadership: Number(row.goalkeeper_leadership ?? row.goalkeeperLeadership ?? 3),
    momentum: Number(row.momentum ?? 0),
    ...(row.result_momentum != null || row.voting_momentum != null || row.resultMomentum != null || row.votingMomentum != null ? {
      resultMomentum: Number(row.result_momentum ?? row.resultMomentum ?? 0),
      votingMomentum: Number(row.voting_momentum ?? row.votingMomentum ?? 0),
    } : {}),
    photoUrl: row.photo_url ?? row.photoUrl ?? null,
    active: true,
  };
}
