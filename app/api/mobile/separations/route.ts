/* Existing separation snapshots are intentionally schema-flexible JSON. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GET as getSeparations, PATCH as patchSeparation, POST as postSeparation } from "../../separations/route";
import { adminRequired, playerAccountRequired } from "../../../../lib/database";
import { claimIdempotency, readIdempotencyKey, releaseIdempotency, storeIdempotentResponse } from "../../../../lib/mobile-idempotency";
import { resolvePublicBaseUrl } from "../../../../lib/public-url";
import { getRuntimeBindings } from "../../../../lib/runtime-bindings";

export async function GET(request: Request) {
  if (!(await playerAccountRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const response = await getSeparations(), payload = await response.json() as any, baseUrl = resolvePublicBaseUrl(request, getRuntimeBindings().APP_BASE_URL);
  payload.separations = (payload.separations || []).map((item: any) => item.career ? { ...item, career: { ...item.career, votingUrl: `${baseUrl}/votacao?token=${encodeURIComponent(item.career.votingToken)}` } } : item);
  return Response.json(payload, { status: response.status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const key = readIdempotencyKey(request);
  if (!key) return Response.json({ error: "Envie uma Idempotency-Key entre 16 e 128 caracteres." }, { status: 400 });
  const previous = await claimIdempotency(admin.id, "CREATE_SEPARATION", key);
  if (previous) return previous;
  let response: Response;
  try { response = await postSeparation(request); } catch (error) { await releaseIdempotency(admin.id, "CREATE_SEPARATION", key); throw error; }
  if (!response.ok) { await releaseIdempotency(admin.id, "CREATE_SEPARATION", key); return response; }
  return storeIdempotentResponse(admin.id, "CREATE_SEPARATION", key, response);
}

export async function PATCH(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  return patchSeparation(request);
}
