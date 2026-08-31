import { db, ensureDb, playerAccountRequired } from "../../../lib/database";
import { matchHubFilters, type MatchHubItem } from "../../../lib/match-hub";
import { weatherSummaryFromRow } from "../../../lib/weather-presentation";

const noStore = { "cache-control": "private, no-store", vary: "Cookie, Authorization" };

export async function GET(request: Request) {
  await ensureDb();
  const account = await playerAccountRequired(request) as { accountType?: string; permissions?: string[] } | null;
  if (!account) return Response.json({ error: "Entre na sua conta para consultar as partidas." }, { status: 401, headers: noStore });
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(params.get("page")) || 1)));
  const filter = matchHubFilters.some(item => item.value === params.get("filter")) ? params.get("filter") : "all";
  const matchId = params.get("match"), separationId = params.get("separation");
  const detail = Boolean(matchId || separationId);
  const predicates: string[] = [];
  const values: (string | number)[] = [account ? 1 : 0, account ? 1 : 0];
  if (matchId) { predicates.push("matchId=?"); values.push(matchId); }
  else if (separationId) { predicates.push("separationId=?"); values.push(separationId); }
  else {
    const filters: Record<string, string> = {
      all: "status IN ('OPEN','TEAMS','FINISHED')", open: "status='OPEN'",
      teams: "status IN ('TEAMS','FINISHED')", finished: "status='FINISHED'",
      history: "status IN ('TEAMS','FINISHED','CLOSED')", cancelled: "status='CANCELLED'",
    };
    predicates.push(filters[filter || "all"]);
  }
  // UNION keeps standalone legacy separations without inventing a scheduled match.
  // No raw snapshots, private drafts, player rosters or weather refreshes in this feed.
  const query = `WITH entries AS (
    SELECT 'match:'||m.id id,m.id matchId,s.id separationId,m.title title,m.match_at date,m.location location,
      CASE WHEN m.status='CANCELLED' THEN 'CANCELLED' WHEN c.id IS NOT NULL THEN 'FINISHED'
        WHEN s.id IS NOT NULL THEN 'TEAMS' WHEN m.status='OPEN' THEN 'OPEN' ELSE 'CLOSED' END status,
      s.confirmed_at confirmedAt,
      (SELECT COUNT(*) FROM match_attendance a WHERE a.match_id=m.id AND a.status='PRESENT') present,
      c.blue_score blueScore,c.yellow_score yellowScore,c.status votingStatus,c.closes_at votingClosesAt,
      m.match_at sortDate,m.weather_snapshot weatherSnapshot
    FROM scheduled_matches m
    LEFT JOIN team_separations s ON s.id=m.separation_id AND s.deleted_at IS NULL
    LEFT JOIN career_matches c ON c.separation_id=s.id
    WHERE ?=1
    UNION ALL
    SELECT 'separation:'||s.id,
      (SELECT m.id FROM scheduled_matches m WHERE m.separation_id=s.id LIMIT 1),s.id,s.match_title,s.match_date,s.location,
      CASE WHEN c.id IS NOT NULL THEN 'FINISHED' ELSE 'TEAMS' END,s.confirmed_at,NULL,
      c.blue_score,c.yellow_score,c.status,c.closes_at,COALESCE(s.match_date,s.confirmed_at),NULL
    FROM team_separations s LEFT JOIN career_matches c ON c.separation_id=s.id
    WHERE s.deleted_at IS NULL AND (?=0 OR NOT EXISTS(SELECT 1 FROM scheduled_matches m WHERE m.separation_id=s.id))
  ) SELECT id,matchId,separationId,title,date,location,status,confirmedAt,present,
      blueScore,yellowScore,votingStatus,votingClosesAt,weatherSnapshot FROM entries
    WHERE ${predicates.join(" AND ")}
    ORDER BY CASE WHEN status='OPEN' THEN 0 ELSE 1 END,
      CASE WHEN status='OPEN' THEN sortDate END ASC,sortDate DESC,id DESC LIMIT ? OFFSET ?`;
  values.push(detail ? 1 : 13, detail ? 0 : (page - 1) * 12);
  const result = await db().prepare(query).bind(...values).all<MatchHubItem & { weatherSnapshot: string | null }>();
  const items = result.results.slice(0, detail ? 1 : 12).map(({ weatherSnapshot, ...item }) => ({
    ...item, weatherSummary: weatherSummaryFromRow({ weather_snapshot: weatherSnapshot }),
  }));
  return Response.json({ items, page, hasMore: !detail && result.results.length > 12,
    viewer: { authenticated: Boolean(account), permissions: account?.accountType === "administrator" ? ["*"] : account?.permissions || [] },
  }, { headers: noStore });
}
