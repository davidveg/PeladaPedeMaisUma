/* Shared paginated in-app notification center for web and mobile accounts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb, playerAccountRequired } from "../../../lib/database";
import { getNotificationPreferences, type NotificationAccountType } from "../../../lib/notification-preferences";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  await ensureDb();

  const accountType = (account.accountType === "administrator" ? "administrator" : "member") as NotificationAccountType;
  const url = new URL(request.url);
  const requestedPage = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
  const preferences = await getNotificationPreferences(accountType, String(account.id));
  const requestedPageSize = Number(url.searchParams.get("pageSize"));
  const pageSize = [10, 20, 50].includes(requestedPageSize) ? requestedPageSize : preferences.pageSize;
  const counts: any = await db().prepare(
    `SELECT COUNT(*) total,
            SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) unread
     FROM account_notifications WHERE account_type=? AND account_id=?`,
  ).bind(accountType, account.id).first();
  const total = Number(counts?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const rows = (await db().prepare(
    `SELECT id,type,title,body,match_id,read_at,created_at
     FROM account_notifications WHERE account_type=? AND account_id=?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).bind(accountType, account.id, pageSize, (page - 1) * pageSize).all()).results as any[];

  return Response.json({
    unread: Number(counts?.unread || 0),
    total,
    page,
    pageSize,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
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
