import type { Player } from "./football";

export function publicPlayer(row: any): Player {
  const displayName = String(row.display_name ?? row.displayName ?? "Jogador");
  return {
    id: String(row.id),
    fullName: displayName,
    displayName,
    type: String(row.type ?? "monthly"),
    primaryPosition: row.primary_position ?? row.primaryPosition,
    speed: Number(row.speed ?? 3),
    skill: Number(row.skill ?? 3),
    marking: Number(row.marking ?? 3),
    goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.goalkeeperPositioning ?? row.speed ?? 3),
    goalExit: Number(row.goal_exit ?? row.goalExit ?? row.marking ?? 3),
    momentum: Number(row.momentum ?? 0),
    photoUrl: row.photo_url ?? row.photoUrl ?? null,
    active: true,
  };
}
