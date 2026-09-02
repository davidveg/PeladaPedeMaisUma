/* Database adapter for achievements, season retrospectives and round recaps. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb } from "./database";
import {
  buildPlayerEngagement,
  buildRoundRecaps,
  type EngagementMatch,
  type EngagementPlayer,
  type MonthlyAwardSnapshot,
  type SeasonAwardSnapshot,
} from "./player-engagement";

export async function loadPlayerEngagement(player: EngagementPlayer) {
  const history = await loadEngagementHistory();
  return buildPlayerEngagement({
    player,
    matches: history.matches,
    currentSeasonNumber: history.currentSeasonNumber,
    seasonStartedAt: history.seasonStartedAt,
    nextSeasonResetAt: history.nextSeasonResetAt,
    monthlyAwards: history.monthlyAwards,
    seasonAwards: history.seasonAwards,
  });
}

export async function loadRoundRecaps() {
  const history = await loadEngagementHistory();
  return buildRoundRecaps({
    matches: history.matches,
    siteName: history.siteName,
    teamBlueName: history.teamBlueName,
    teamYellowName: history.teamYellowName,
  });
}

async function loadEngagementHistory() {
  await ensureDb();
  const [matchRows, contributionRows, monthlyRows, seasonRows, careerConfig, instance] = await Promise.all([
    db().prepare(`SELECT c.id,c.separation_id,c.status,c.blue_score,c.yellow_score,c.winner_team,c.config_snapshot,c.results_snapshot,c.participation_snapshot,
      s.match_title,s.match_date,s.snapshot,substr(c.created_at,1,10) created_date
      FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL ORDER BY COALESCE(s.match_date,substr(c.created_at,1,10)),c.created_at`).all(),
    db().prepare(`SELECT career_match_id,scorer_player_id,assist_player_id,is_own_goal FROM career_match_contributions`).all(),
    db().prepare(`SELECT month,snapshot FROM monthly_career_awards ORDER BY month`).all(),
    db().prepare(`SELECT season_number,ended_at,snapshot FROM career_season_awards ORDER BY season_number`).all(),
    db().prepare(`SELECT season_number,season_started_at,next_season_reset_at FROM career_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT site_name,team_blue_name,team_yellow_name FROM instance_configuration WHERE id=1`).first<any>(),
  ]);
  const contributions = groupBy(contributionRows.results as any[], row => String(row.career_match_id));
  const matches = (matchRows.results as any[]).flatMap(row => {
    const snapshot = parseJson(row.participation_snapshot ?? row.snapshot, null), config = parseJson(row.config_snapshot, {});
    if (!snapshot || !Array.isArray(snapshot.blue) || !Array.isArray(snapshot.yellow)) return [];
    const players = (entries: any[]): EngagementPlayer[] => entries.flatMap(value => value?.id ? [{ id: String(value.id), displayName: String(value.displayName || value.fullName || "Jogador") }] : []);
    return [{
      id: String(row.id), separationId: String(row.separation_id), title: String(row.match_title || "Pelada"), date: String(row.match_date || row.created_date),
      seasonNumber: Number(config.seasonNumber || 1), status: String(row.status), blueScore: Number(row.blue_score), yellowScore: Number(row.yellow_score),
      winnerTeam: row.winner_team === "BLUE" || row.winner_team === "YELLOW" ? row.winner_team : "DRAW",
      blue: players(snapshot.blue), yellow: players(snapshot.yellow), results: parseJson(row.results_snapshot, null),
      contributions: (contributions.get(String(row.id)) || []).map(value => ({ scorerPlayerId: String(value.scorer_player_id), assistPlayerId: value.assist_player_id ? String(value.assist_player_id) : null, ownGoal: Boolean(value.is_own_goal) })),
    } satisfies EngagementMatch];
  });
  const monthlyAwards = (monthlyRows.results as any[]).flatMap(row => { const value = parseJson(row.snapshot, null); return value ? [{ ...value, month: String(value.month || row.month) } as MonthlyAwardSnapshot] : []; });
  const seasonAwards = (seasonRows.results as any[]).flatMap(row => { const value = parseJson(row.snapshot, null); return value ? [{ ...value, seasonNumber: Number(value.seasonNumber || row.season_number), endedAt: String(value.endedAt || row.ended_at) } as SeasonAwardSnapshot] : []; });
  return {
    matches, monthlyAwards, seasonAwards,
    currentSeasonNumber: Number(careerConfig?.season_number || 1),
    seasonStartedAt: careerConfig?.season_started_at || null,
    nextSeasonResetAt: careerConfig?.next_season_reset_at || null,
    siteName: String(instance?.site_name || "Pelada"),
    teamBlueName: String(instance?.team_blue_name || "Azul"),
    teamYellowName: String(instance?.team_yellow_name || "Amarelo"),
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string) { const result = new Map<string, T[]>(); for (const row of rows) { const id = key(row); const items = result.get(id) || []; items.push(row); result.set(id, items); } return result; }
function parseJson(value: unknown, fallback: any) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
