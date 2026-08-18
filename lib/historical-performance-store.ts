import { db } from "./database";
import type { Player } from "./football";
import { calculateHistoricalPerformance, emptyHistoricalPerformance, type HistoricalPerformance } from "./historical-performance";

export async function loadHistoricalPerformance(): Promise<Record<string, HistoricalPerformance>> {
  const [matches, contributions, votes] = await Promise.all([
    db().prepare(`SELECT c.id,c.blue_score,c.yellow_score,c.winner_team,c.status,c.config_snapshot,c.results_snapshot,c.created_at,s.match_date,s.snapshot
      FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL
      ORDER BY COALESCE(s.match_date,substr(c.created_at,1,10)),c.created_at`).all(),
    db().prepare(`SELECT career_match_id,scorer_player_id,assist_player_id,is_own_goal FROM career_match_contributions`).all(),
    db().prepare(`SELECT career_match_id,motm_third_id,motm_second_id,motm_first_id,dotm_third_id,dotm_second_id,dotm_first_id FROM career_votes`).all(),
  ]);
  return calculateHistoricalPerformance(matches.results as any[], contributions.results as any[], votes.results as any[]);
}

export async function attachHistoricalPerformance<T extends Player>(players: T[], enabled: boolean): Promise<T[]> {
  if (!enabled) return players;
  const performance = await loadHistoricalPerformance();
  return players.map(player => ({ ...player, historicalPerformance: performance[player.id] ?? emptyHistoricalPerformance() }));
}
