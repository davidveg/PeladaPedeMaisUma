/* Existing separation snapshots are intentionally schema-flexible JSON. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET as getSeparations, PATCH as patchSeparation, POST as postSeparation } from "../../separations/route";
import { db, playerAccountRequired, staffRequired } from "../../../../lib/database";
import { resolvePublicBaseUrl } from "../../../../lib/public-url";
import { getRuntimeBindings } from "../../../../lib/runtime-bindings";
const adminRequired=(request:Request)=>staffRequired(request,"SEPARATIONS_MANAGE");

export async function GET(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: { "cache-control": "private, no-store", vary: "Cookie, Authorization" } });
  const response = await getSeparations(request), payload = await response.json() as any, baseUrl = resolvePublicBaseUrl(request, getRuntimeBindings().APP_BASE_URL);
  const playerId = String(account.playerId || "");
  const votedMatches = playerId
    ? new Set(((await db().prepare(`SELECT career_match_id FROM career_votes WHERE voter_player_id=?`).bind(playerId).all()).results as any[]).map(row => String(row.career_match_id)))
    : new Set<string>();
  payload.separations = (payload.separations || []).map((item: any) => {
    if (!item.career) return item;
    const participants = [...(item.snapshot?.blue || []), ...(item.snapshot?.yellow || [])];
    const viewerIsParticipant = Boolean(playerId && participants.some((player: any) => String(player.id) === playerId));
    const viewerHasVoted = votedMatches.has(String(item.career.id));
    return {
      ...item,
      career: {
        ...item.career,
        votingUrl: `${baseUrl}/votacao?token=${encodeURIComponent(item.career.votingToken)}`,
        viewerIsParticipant,
        viewerHasVoted,
        viewerCanVote: viewerIsParticipant && !viewerHasVoted && item.career.status === "OPEN" && new Date(item.career.closesAt).getTime() > Date.now(),
      },
    };
  });
  return Response.json(payload, { status: response.status, headers: { "cache-control": "private, no-store", vary: "Cookie, Authorization" } });
}

export async function POST(request: Request) {
  return postSeparation(request);
}

export async function PATCH(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  return patchSeparation(request);
}
