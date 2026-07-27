/* Shared in-app notification center for web and mobile accounts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb, playerAccountRequired } from "../../../lib/database";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  await ensureDb();
  const rows = (await db().prepare(
    `SELECT id,type,title,body,match_id,read_at,created_at
     FROM account_notifications WHERE account_type=? AND account_id=?
     ORDER BY created_at DESC LIMIT 100`,
  ).bind(account.accountType, account.id).all()).results as any[];
  const unread: any = await db().prepare(
    `SELECT COUNT(*) total FROM account_notifications WHERE account_type=? AND account_id=? AND read_at IS NULL`,
  ).bind(account.accountType, account.id).first();
  return Response.json({
    unread: Number(unread?.total || 0),
    notifications: rows.map(row => ({
      id: String(row.id), type: String(row.type), title: String(row.title), body: String(row.body),
      matchId: row.match_id ? String(row.match_id) : null, readAt: row.read_at || null, createdAt: String(row.created_at),
    })),
  }, { headers: noStore });
}

export async function PATCH(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as any, now = new Date().toISOString();
  if (payload.all) {
    await db().prepare(
      `UPDATE account_notifications SET read_at=? WHERE account_type=? AND account_id=? AND read_at IS NULL`,
    ).bind(now, account.accountType, account.id).run();
  } else {
    await db().prepare(
      `UPDATE account_notifications SET read_at=? WHERE id=? AND account_type=? AND account_id=?`,
    ).bind(now, String(payload.id || ""), account.accountType, account.id).run();
  }
  return Response.json({ ok: true }, { headers: noStore });
}
