import { db, ensureDb } from "./database";
import { calculatePlayerCareerStats, type PlayerCareerStats } from "./player-career-stats";

export async function loadPlayerCareerStats(): Promise<Record<string, PlayerCareerStats>> {
  await ensureDb();
  const [rows,contributions] = await Promise.all([
    db().prepare(`SELECT s.snapshot,c.winner_team FROM career_matches c JOIN team_separations s ON s.id=c.separation_id`).all(),
    db().prepare(`SELECT scorer_player_id,assist_player_id,is_own_goal FROM career_match_contributions`).all(),
  ]);
  return calculatePlayerCareerStats(rows.results as any[], contributions.results as any[]);
}
