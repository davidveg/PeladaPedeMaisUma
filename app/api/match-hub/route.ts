import { db, ensureDb, playerAccountRequired } from "../../../lib/database";
import { matchHubFilters, type MatchHubItem } from "../../../lib/match-hub";
import { weatherSummaryFromRow } from "../../../lib/weather-presentation";

const noStore = { "cache-control": "private, no-store", vary: "Cookie, Authorization" };

export async function GET(request: Request) {
  await ensureDb();
  const account = await playerAccountRequired(request) as { accountType?: string; permissions?: string[]; playerId?: string | null } | null;
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
  let items: MatchHubItem[] = result.results.slice(0, detail ? 1 : 12).map(({ weatherSnapshot, ...item }) => ({
    ...item, weatherSummary: weatherSummaryFromRow({ weather_snapshot: weatherSnapshot }),
  }));
  if (detail && items[0]) items = [await enrichDetail(items[0], String(account.playerId || ""))];
  return Response.json({ items, page, hasMore: !detail && result.results.length > 12,
    viewer: { authenticated: Boolean(account), permissions: account?.accountType === "administrator" ? ["*"] : account?.permissions || [] },
  }, { headers: noStore });
}

async function enrichDetail(item: MatchHubItem, playerId: string): Promise<MatchHubItem> {
  let confirmationDeadline: string | null = null, viewerAttendanceStatus: string | null = null;
  if (item.matchId) {
    const match: any = await db().prepare(`SELECT confirmation_deadline FROM scheduled_matches WHERE id=?`).bind(item.matchId).first();
    confirmationDeadline = match?.confirmation_deadline ? String(match.confirmation_deadline) : null;
    if (playerId) {
      const attendance: any = await db().prepare(`SELECT status FROM match_attendance WHERE match_id=? AND player_id=?`).bind(item.matchId, playerId).first();
      viewerAttendanceStatus = attendance?.status ? String(attendance.status) : null;
    }
  }
  let viewerVoteStatus: MatchHubItem["viewerVoteStatus"] = null;
  const personalHighlights: string[] = [];
  if (item.separationId) {
    const career: any = await db().prepare(`SELECT id,status,participation_snapshot,results_snapshot FROM career_matches WHERE separation_id=?`).bind(item.separationId).first();
    if (career && playerId) {
      const separation: any = await db().prepare(`SELECT snapshot FROM team_separations WHERE id=?`).bind(item.separationId).first();
      const participation = career.participation_snapshot ? JSON.parse(career.participation_snapshot) : JSON.parse(separation?.snapshot || "{}");
      const participant = [...(participation.blue || []), ...(participation.yellow || [])].some((player: any) => String(player.id) === playerId);
      const voted = participant ? Boolean(await db().prepare(`SELECT id FROM career_votes WHERE career_match_id=? AND voter_player_id=?`).bind(career.id, playerId).first()) : false;
      viewerVoteStatus = career.status === "CLOSED" ? "CLOSED" : !participant ? "NOT_PARTICIPANT" : voted ? "DONE" : "AVAILABLE";
      if (career.status === "CLOSED" && career.results_snapshot) {
        const results = JSON.parse(career.results_snapshot), awards = [["partner","Parceiro da rodada"],["fairPlay","Fair Play"],["defense","Defesa da rodada"]] as const;
        if (results?.motm?.[0]?.playerId === playerId) personalHighlights.push("Você foi o Man of the Match.");
        for (const [key, label] of awards) if (results?.[key]?.[0]?.playerId === playerId) personalHighlights.push(`Você recebeu o reconhecimento de ${label}.`);
      }
    }
  }
  const nextAction: MatchHubItem["nextAction"] = item.status === "OPEN"
    ? { tab: "attendance", label: viewerAttendanceStatus ? "Revisar minha presença" : "Responder presença", description: confirmationDeadline ? `Confirmações até ${dateTimeLabel(confirmationDeadline)}.` : "Confirme se você participará da rodada." }
    : item.status === "TEAMS"
      ? { tab: "teams", label: "Conferir os times", description: "A escalação já foi publicada." }
      : viewerVoteStatus === "AVAILABLE"
        ? { tab: "voting", label: "Votar nos destaques", description: item.votingClosesAt ? `Votação aberta até ${dateTimeLabel(item.votingClosesAt)}.` : "Sua votação está pendente." }
        : item.status === "FINISHED"
          ? { tab: "result", label: "Ver resultado e resenha", description: viewerVoteStatus === "DONE" ? "Seu voto já foi registrado." : "Confira os destaques desta partida." }
          : null;
  return { ...item, confirmationDeadline, viewerAttendanceStatus, viewerVoteStatus, personalHighlights, nextAction };
}

function dateTimeLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : value;
}
