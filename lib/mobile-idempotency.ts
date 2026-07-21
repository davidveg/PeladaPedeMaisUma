/* D1 rows are provided by the existing untyped runtime adapter. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "./database";

export function readIdempotencyKey(request: Request) {
  const key = (request.headers.get("idempotency-key") || "").trim();
  return key.length >= 16 && key.length <= 128 ? key : null;
}

export async function previousIdempotentResponse(administratorId: string, operation: string, key: string) {
  const row: any = await db().prepare(`SELECT status_code,response_json FROM mobile_idempotency_keys WHERE administrator_id=? AND operation=? AND idempotency_key=?`).bind(administratorId, operation, key).first();
  if (!row) return null;
  if (Number(row.status_code) === 0) return Response.json({ error: "Esta ação idempotente ainda está sendo processada." }, { status: 409, headers: { "retry-after": "2" } });
  return new Response(row.response_json, { status: Number(row.status_code), headers: { "content-type": "application/json", "x-idempotent-replay": "true" } });
}

export async function claimIdempotency(administratorId: string, operation: string, key: string) {
  try {
    await db().prepare(`INSERT INTO mobile_idempotency_keys (id,administrator_id,operation,idempotency_key,status_code,response_json,created_at) VALUES (?,?,?,?,0,'{}',?)`)
      .bind(crypto.randomUUID(), administratorId, operation, key, new Date().toISOString()).run();
    return null;
  } catch { return previousIdempotentResponse(administratorId, operation, key); }
}

export async function storeIdempotentResponse(administratorId: string, operation: string, key: string, response: Response) {
  const body = await response.clone().text();
  await db().prepare(`UPDATE mobile_idempotency_keys SET status_code=?,response_json=? WHERE administrator_id=? AND operation=? AND idempotency_key=?`).bind(response.status, body, administratorId, operation, key).run();
  return new Response(body, { status: response.status, headers: response.headers });
}

export async function releaseIdempotency(administratorId: string, operation: string, key: string) {
  await db().prepare(`DELETE FROM mobile_idempotency_keys WHERE administrator_id=? AND operation=? AND idempotency_key=? AND status_code=0`).bind(administratorId, operation, key).run();
}
