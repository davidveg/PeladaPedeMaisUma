/* D1 authentication rows are provided by the existing untyped adapter. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST as createMatch, PUT as updateMatch } from "../../../career/match/route";
import { adminRequired } from "../../../../../lib/database";
import { claimIdempotency, readIdempotencyKey, releaseIdempotency, storeIdempotentResponse } from "../../../../../lib/mobile-idempotency";

async function run(request: Request, operation: string, handler: (request: Request) => Promise<Response>) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const key = readIdempotencyKey(request);
  if (!key) return Response.json({ error: "Envie uma Idempotency-Key entre 16 e 128 caracteres." }, { status: 400 });
  const previous = await claimIdempotency(admin.id, operation, key);
  if (previous) return previous;
  let response: Response;
  try { response = await handler(request); } catch (error) { await releaseIdempotency(admin.id, operation, key); throw error; }
  if (!response.ok) { await releaseIdempotency(admin.id, operation, key); return response; }
  return storeIdempotentResponse(admin.id, operation, key, response);
}

export const POST = (request: Request) => run(request, "CONFIRM_MATCH", createMatch);
export const PUT = (request: Request) => run(request, "CORRECT_MATCH", updateMatch);
