import { currentPlayerAccount, db, ensureDb } from "../../../lib/database";
import { buildMonthlyCareerHighlights, buildPublicStatistics, type MonthlyCareerAward, type StatisticsMatch } from "../../../lib/public-statistics";
import { tryFinalizeCurrentMonthFromHistory } from "../../../lib/career-awards";
import { finalizeIfExpired } from "../../../lib/career-service";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  await ensureDb();
  const account = await currentPlayerAccount(request);
  const expiredVoting = await db().prepare(`SELECT * FROM career_matches WHERE status='OPEN' AND closes_at<=?`).bind(new Date().toISOString()).all();
  for (const match of expiredVoting.results) await finalizeIfExpired(match);
  const params = new URL(request.url).searchParams;
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const from = isoDate.test(params.get("from") || "") ? params.get("from")! : defaultFrom;
  const to = isoDate.test(params.get("to") || "") ? params.get("to")! : defaultTo;
  if (from > to) return Response.json({ error: "A data inicial deve ser anterior à data final." }, { status: 400 });

  const selectedYear = Number(to.slice(0, 4));
  const yearFrom = `${selectedYear}-01-01`, yearTo = `${selectedYear}-12-31`;
  const [playerRows, matchRows, contributionRows, yearMatchRows, careerRow] = await Promise.all([
    // Jogadores excluídos logicamente continuam aqui para preservar rankings e confrontos históricos.
    db().prepare(`SELECT id,display_name,photo_url,type,primary_position FROM players ORDER BY display_name`).all(),
    db().prepare(`SELECT c.id,c.separation_id,c.blue_score,c.yellow_score,c.winner_team,c.config_snapshot,c.results_snapshot,s.match_title,s.match_date,s.snapshot,substr(c.created_at,1,10) created_date
      FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND COALESCE(s.match_date,substr(c.created_at,1,10)) BETWEEN ? AND ?
      ORDER BY COALESCE(s.match_date,substr(c.created_at,1,10)) DESC,c.created_at DESC`).bind(from, to).all(),
    db().prepare(`SELECT g.career_match_id,g.scorer_player_id,g.assist_player_id,g.is_own_goal
      FROM career_match_contributions g JOIN career_matches c ON c.id=g.career_match_id
      JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND COALESCE(s.match_date,substr(c.created_at,1,10)) BETWEEN ? AND ?`).bind(from, to).all(),
    db().prepare(`SELECT c.id,c.separation_id,c.blue_score,c.yellow_score,c.winner_team,c.config_snapshot,c.results_snapshot,s.match_title,s.match_date,s.snapshot,substr(c.created_at,1,10) created_date
      FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND COALESCE(s.match_date,substr(c.created_at,1,10)) BETWEEN ? AND ?
      ORDER BY COALESCE(s.match_date,substr(c.created_at,1,10)),c.created_at`).bind(yearFrom, yearTo).all(),
    db().prepare(`SELECT next_season_reset_at,monthly_team_goalkeepers,monthly_team_defenders,monthly_team_midfielders,monthly_team_attackers FROM career_configuration WHERE id=1`).first(),
  ]);

  const players = (playerRows.results as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    displayName: String(row.display_name),
    photoUrl: row.photo_url ? String(row.photo_url) : null,
    type: row.type ? String(row.type) : null,
    primaryPosition: row.primary_position ? String(row.primary_position) : null,
  }));
  const mapMatch = (row: Record<string, unknown>): StatisticsMatch => {
    const snapshot = parseJson(row.snapshot, {});
    return {
      id: String(row.id), separationId: String(row.separation_id), title: String(row.match_title), date: String(row.match_date || row.created_date),
      blueScore: Number(row.blue_score), yellowScore: Number(row.yellow_score),
      winnerTeam: row.winner_team === "BLUE" || row.winner_team === "YELLOW" ? row.winner_team : "DRAW",
      blueIds: (snapshot.blue || []).map((player: { id: unknown }) => String(player.id)),
      yellowIds: (snapshot.yellow || []).map((player: { id: unknown }) => String(player.id)),
      config: parseJson(row.config_snapshot, null),
      results: parseJson(row.results_snapshot, null),
    };
  };
  const matches = (matchRows.results as Record<string, unknown>[]).map(mapMatch);
  const yearMatches = (yearMatchRows.results as Record<string, unknown>[]).map(mapMatch);
  const contributions = (contributionRows.results as Record<string, unknown>[]).map(row => ({
    matchId: String(row.career_match_id), scorerPlayerId: String(row.scorer_player_id),
    assistPlayerId: row.assist_player_id ? String(row.assist_player_id) : null, ownGoal: Boolean(row.is_own_goal),
  }));
  const statistics = buildPublicStatistics(players, matches, contributions, params.get("playerA") || undefined, params.get("playerB") || undefined);
  const today = new Date().toISOString().slice(0, 10), currentMonth = today.slice(0, 7), requestedMonth = to.slice(0, 7);
  await tryFinalizeCurrentMonthFromHistory(today).catch(() => null);
  const focusMonth = selectedYear === Number(today.slice(0, 4)) && requestedMonth > currentMonth ? currentMonth : requestedMonth;
  const annualAwardsAvailableAt = annualAwardsDate(selectedYear, careerRow?.next_season_reset_at);
  const monthlyFormation = { goalkeepers: Number(careerRow?.monthly_team_goalkeepers ?? 1), defenders: Number(careerRow?.monthly_team_defenders ?? 2), midfielders: Number(careerRow?.monthly_team_midfielders ?? 2), attackers: Number(careerRow?.monthly_team_attackers ?? 2) };
  const calculatedHighlights = buildMonthlyCareerHighlights(players, yearMatches, selectedYear, today, focusMonth, annualAwardsAvailableAt, [], monthlyFormation);
  const finalizedAt = new Date().toISOString();
  for (const award of calculatedHighlights.history) {
    await db().prepare(`INSERT OR IGNORE INTO monthly_career_awards (month,year,snapshot,finalized_at) VALUES (?,?,?,?)`)
      .bind(award.month, selectedYear, JSON.stringify(award), finalizedAt).run();
  }
  const [finalizedRows,seasonAwardRow] = await Promise.all([
    db().prepare(`SELECT snapshot FROM monthly_career_awards WHERE year=? ORDER BY month DESC`).bind(selectedYear).all(),
    db().prepare(`SELECT snapshot,ended_at,finalized_at FROM career_season_awards WHERE year=? ORDER BY season_number DESC LIMIT 1`).bind(selectedYear).first<any>(),
  ]);
  const finalizedAwards = (finalizedRows.results as Record<string, unknown>[]).flatMap(row => {
    const award = parseJson(row.snapshot, null) as MonthlyCareerAward | null;
    return award?.month ? [award] : [];
  });
  const careerHighlights = buildMonthlyCareerHighlights(players, yearMatches, selectedYear, today, focusMonth, annualAwardsAvailableAt, finalizedAwards, monthlyFormation);
  const seasonSnapshot = parseJson(seasonAwardRow?.snapshot, null);
  if (Array.isArray(seasonSnapshot?.annualMvp)) {
    careerHighlights.annualMvp = seasonSnapshot.annualMvp;
    careerHighlights.annualMvpAvailable = true;
    careerHighlights.annualMvpAvailableAt = String(seasonAwardRow?.ended_at || seasonAwardRow?.finalized_at || annualAwardsAvailableAt).slice(0, 10);
  }
  // Rankings remain public; the match-by-match history follows the Partidas access policy.
  const versus = { ...statistics.versus, totalMatches: statistics.versus.matches.length,
    matchDetailsRestricted: !account, matches: account ? statistics.versus.matches : [] };
  return Response.json({ from, to, players, ...statistics, versus, careerHighlights }, { headers: { "cache-control": "private, no-store", vary: "Cookie, Authorization" } });
}

function parseJson(value: unknown, fallback: any) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
function annualAwardsDate(year: number, nextSeasonResetAt: unknown) {
  const fallback = `${year}-12-31`, reset = new Date(String(nextSeasonResetAt || ""));
  if (!Number.isFinite(reset.getTime())) return fallback;
  const lastSeasonDay = new Date(reset.getTime() - 86400000).toISOString().slice(0, 10);
  return lastSeasonDay.startsWith(`${year}-12-`) ? lastSeasonDay : fallback;
}
