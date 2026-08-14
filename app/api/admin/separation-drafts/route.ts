/* Administrative separation drafts never close a match or notify participants. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ensureDb, staffRequired } from "../../../../lib/database";
import { loadMatchSeparationDraft, saveMatchSeparationDraft } from "../../../../lib/scheduled-matches";
const adminRequired=(request:Request)=>staffRequired(request,"SEPARATIONS_MANAGE");

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  await ensureDb();
  const matchId = new URL(request.url).searchParams.get("matchId") || "";
  try {
    return Response.json(await loadMatchSeparationDraft(matchId), { headers: noStore });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Não foi possível carregar o rascunho." }, { status: Number(error?.status || 400), headers: noStore });
  }
}

export async function PUT(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as any;
  try {
    const saved = await saveMatchSeparationDraft(String(payload.matchId || ""), admin, {
      result: payload.result,
      manuallyAdjusted: Boolean(payload.manuallyAdjusted),
    });
    return Response.json({ ok: true, ...saved, message: "Rascunho da separação salvo sem encerrar a lista." }, { headers: noStore });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Não foi possível salvar o rascunho." }, { status: Number(error?.status || 400), headers: noStore });
  }
}
