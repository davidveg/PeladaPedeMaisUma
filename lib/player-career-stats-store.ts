import { db, ensureDb } from "./database";
import { calculatePlayerCareerStats, type PlayerCareerStats } from "./player-career-stats";

export async function loadPlayerCareerStats(): Promise<Record<string, PlayerCareerStats>> {
  await ensureDb();
  const rows = await db().prepare(`SELECT s.snapshot,c.winner_team FROM career_matches c JOIN team_separations s ON s.id=c.separation_id`).all();
  return calculatePlayerCareerStats(rows.results as any[]);
}
