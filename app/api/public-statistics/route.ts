import { db, ensureDb } from "../../../lib/database";
import { buildPublicStatistics, type StatisticsMatch } from "../../../lib/public-statistics";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  await ensureDb();
  const params = new URL(request.url).searchParams;
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const from = isoDate.test(params.get("from") || "") ? params.get("from")! : defaultFrom;
  const to = isoDate.test(params.get("to") || "") ? params.get("to")! : defaultTo;
  if (from > to) return Response.json({ error: "A data inicial deve ser anterior à data final." }, { status: 400 });

  const [playerRows, matchRows, contributionRows] = await Promise.all([
    // Jogadores excluídos logicamente continuam aqui para preservar rankings e confrontos históricos.
    db().prepare(`SELECT id,display_name,photo_url,type FROM players ORDER BY display_name`).all(),
    db().prepare(`SELECT c.id,c.separation_id,c.blue_score,c.yellow_score,c.winner_team,s.match_title,s.match_date,s.snapshot,substr(c.created_at,1,10) created_date
      FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND COALESCE(s.match_date,substr(c.created_at,1,10)) BETWEEN ? AND ?
      ORDER BY COALESCE(s.match_date,substr(c.created_at,1,10)) DESC,c.created_at DESC`).bind(from, to).all(),
    db().prepare(`SELECT g.career_match_id,g.scorer_player_id,g.assist_player_id,g.is_own_goal
      FROM career_match_contributions g JOIN career_matches c ON c.id=g.career_match_id
      JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND COALESCE(s.match_date,substr(c.created_at,1,10)) BETWEEN ? AND ?`).bind(from, to).all(),
  ]);

  const players = (playerRows.results as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    displayName: String(row.display_name),
    photoUrl: row.photo_url ? String(row.photo_url) : null,
    type: row.type ? String(row.type) : null,
  }));
  const matches: StatisticsMatch[] = (matchRows.results as Record<string, unknown>[]).map(row => {
    const snapshot = JSON.parse(String(row.snapshot || "{}"));
    return {
      id: String(row.id), separationId: String(row.separation_id), title: String(row.match_title), date: String(row.match_date || row.created_date),
      blueScore: Number(row.blue_score), yellowScore: Number(row.yellow_score),
      winnerTeam: row.winner_team === "BLUE" || row.winner_team === "YELLOW" ? row.winner_team : "DRAW",
      blueIds: (snapshot.blue || []).map((player: { id: unknown }) => String(player.id)),
      yellowIds: (snapshot.yellow || []).map((player: { id: unknown }) => String(player.id)),
    };
  });
  const contributions = (contributionRows.results as Record<string, unknown>[]).map(row => ({
    matchId: String(row.career_match_id), scorerPlayerId: String(row.scorer_player_id),
    assistPlayerId: row.assist_player_id ? String(row.assist_player_id) : null, ownGoal: Boolean(row.is_own_goal),
  }));
  const statistics = buildPublicStatistics(players, matches, contributions, params.get("playerA") || undefined, params.get("playerB") || undefined);
  return Response.json({ from, to, players, ...statistics }, { headers: { "cache-control": "no-store, max-age=0" } });
}
