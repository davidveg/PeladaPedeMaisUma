/* eslint-disable @typescript-eslint/no-explicit-any -- D1 returns untyped row objects at this adapter boundary. */
import { db, ensureDb } from "./database.ts";
import type { AdvancedStatisticsMatch, AdvancedStatisticsPlayer, StatisticsParticipant, StatisticsPosition } from "./statistics-types.ts";

export async function loadAdvancedStatisticsData(from: string, to: string) {
  await ensureDb();
  const [playerRows, matchRows, contributionRows, voteRows] = await Promise.all([
    db().prepare(`SELECT id,display_name,photo_url,type,primary_position FROM players ORDER BY display_name`).all(),
    db().prepare(`SELECT c.id,c.separation_id,c.status,c.blue_score,c.yellow_score,c.winner_team,c.config_snapshot,
      s.match_title,s.match_date,s.snapshot,s.manually_adjusted,s.balance_score,s.balance_classification,
      substr(c.created_at,1,10) created_date
      FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND c.status IN ('OPEN','CLOSED') AND COALESCE(s.match_date,substr(c.created_at,1,10)) BETWEEN ? AND ?
      ORDER BY COALESCE(s.match_date,substr(c.created_at,1,10)),c.created_at`).bind(from, to).all(),
    db().prepare(`SELECT g.career_match_id,g.scorer_player_id,g.assist_player_id,g.is_own_goal
      FROM career_match_contributions g JOIN career_matches c ON c.id=g.career_match_id
      JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND c.status IN ('OPEN','CLOSED') AND COALESCE(s.match_date,substr(c.created_at,1,10)) BETWEEN ? AND ?`).bind(from, to).all(),
    db().prepare(`SELECT v.career_match_id,v.motm_first_id,v.motm_second_id,v.motm_third_id,v.dotm_first_id,v.dotm_second_id,v.dotm_third_id
      FROM career_votes v JOIN career_matches c ON c.id=v.career_match_id
      JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND c.status IN ('OPEN','CLOSED') AND COALESCE(s.match_date,substr(c.created_at,1,10)) BETWEEN ? AND ?`).bind(from, to).all(),
  ]);
  const players = (playerRows.results as any[]).map(row => ({ id: String(row.id), displayName: String(row.display_name), photoUrl: row.photo_url || null, type: row.type || null, primaryPosition: row.primary_position || null })) as AdvancedStatisticsPlayer[];
  const contributions = groupBy(contributionRows.results as any[], row => String(row.career_match_id));
  const votes = groupBy(voteRows.results as any[], row => String(row.career_match_id));
  const matches = (matchRows.results as any[]).flatMap(row => {
    const snapshot = parseJson(row.snapshot, null), config = parseJson(row.config_snapshot, {});
    if (!snapshot || !Array.isArray(snapshot.blue) || !Array.isArray(snapshot.yellow)) return [];
    const mapParticipants = (entries: any[]): StatisticsParticipant[] => entries.flatMap(player => player?.id ? [{ playerId: String(player.id), position: normalizePosition(player.primaryPosition) }] : []);
    const strength = (team: any) => finite(team?.balancingTotal ?? team?.total);
    return [{
      id: String(row.id), separationId: String(row.separation_id), title: String(row.match_title), date: String(row.match_date || row.created_date), status: String(row.status),
      seasonNumber: Number(config.seasonNumber || 1), manuallyAdjusted: Boolean(row.manually_adjusted), blueScore: Number(row.blue_score), yellowScore: Number(row.yellow_score),
      winnerTeam: row.winner_team === "BLUE" || row.winner_team === "YELLOW" ? row.winner_team : "DRAW",
      blue: mapParticipants(snapshot.blue), yellow: mapParticipants(snapshot.yellow),
      contributionsAvailable: Boolean(config.trackContributions),
      contributions: (contributions.get(String(row.id)) || []).map(entry => ({ scorerPlayerId: String(entry.scorer_player_id), assistPlayerId: entry.assist_player_id ? String(entry.assist_player_id) : null, ownGoal: Boolean(entry.is_own_goal) })),
      votes: (votes.get(String(row.id)) || []).map(entry => ({ motmFirstId: String(entry.motm_first_id), motmSecondId: String(entry.motm_second_id), motmThirdId: String(entry.motm_third_id), dotmFirstId: String(entry.dotm_first_id), dotmSecondId: String(entry.dotm_second_id), dotmThirdId: String(entry.dotm_third_id) })),
      prediction: { blueStrength: strength(snapshot.blueBaseMetrics ?? snapshot.blueMetrics), yellowStrength: strength(snapshot.yellowBaseMetrics ?? snapshot.yellowMetrics), balanceCost: finite(row.balance_score), classification: row.balance_classification ? String(row.balance_classification) : null, algorithmVersion: finite(snapshot.balanceAlgorithmVersion ?? snapshot.ratingSystemVersion) },
    } satisfies AdvancedStatisticsMatch];
  });
  return { players, matches };
}

function groupBy<T>(rows: T[], key: (row: T) => string) { const result = new Map<string, T[]>(); for (const row of rows) { const id = key(row); const values = result.get(id) || []; values.push(row); result.set(id, values); } return result; }
function parseJson(value: unknown, fallback: any) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
function finite(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function normalizePosition(value: unknown): StatisticsPosition | "" { const candidate = String(value || ""); return ["Goleiro", "Defesa", "Meio-campo", "Ataque"].includes(candidate) ? candidate as StatisticsPosition : ""; }
