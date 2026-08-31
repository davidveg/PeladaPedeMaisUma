import { staffRequired } from "../../../../../lib/database";
import { createMatchSeparationProposal, loadMatchSeparationDraft } from "../../../../../lib/scheduled-matches";

export async function POST(request: Request) {
  if (!(await staffRequired(request, "SEPARATIONS_MANAGE"))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const matchId = typeof payload?.matchId === "string" ? payload.matchId.trim() : "";
  if (!matchId) return Response.json({
    error: "A criação de separações avulsas foi encerrada. Abra uma partida e monte os times pelas presenças.",
    code: "STANDALONE_SEPARATION_REMOVED",
  }, { status: 410, headers: { "cache-control": "no-store" } });
  try {
    const proposal = payload.loadDraft
      ? await loadMatchSeparationDraft(matchId)
      : await createMatchSeparationProposal(matchId, Number(payload.nonce) || 0);
    return Response.json({
      // Compatibility alias: these are match metadata, no longer parsed text.
      parsed: { title: proposal.match.title, date: proposal.match.date },
      ...proposal,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error: unknown) {
    const failure = error as { message?: string; status?: number };
    return Response.json({ error: failure?.message || "Não foi possível gerar os times." }, { status: Number(failure?.status || 400) });
  }
}
