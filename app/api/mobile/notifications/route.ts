/* Mobile account rows are provided by the shared authentication adapter. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, currentPlayerAccount, db, ensureDb } from "../../../../lib/database";
import { notifyPendingCareerVotesForAccount } from "../../../../lib/push-notifications";

const expoTokenPattern = /^(Expo(nent)?PushToken)\[[^\]]+\]$/;
const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const account: any = await currentPlayerAccount(request);
  if (!account?.mobileSessionId) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const payload = await request.json().catch(() => ({})) as any;
  const expoPushToken = String(payload.expoPushToken || "").trim();
  if (!expoTokenPattern.test(expoPushToken)) return Response.json({ error: "Token de notificação inválido." }, { status: 400, headers: noStore });
  const accountType = account.accountType === "administrator" ? "administrator" : "member";
  const platform = payload.platform === "ios" ? "ios" : "android";
  const deviceName = String(payload.deviceName || "").trim().slice(0, 120) || null;
  const now = new Date().toISOString(), id = crypto.randomUUID();
  await ensureDb();
  await db().prepare(
    `INSERT INTO mobile_push_tokens
     (id,account_type,account_id,mobile_session_id,expo_push_token,platform,device_name,active,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,1,?,?)
     ON CONFLICT(expo_push_token) DO UPDATE SET
       account_type=excluded.account_type,account_id=excluded.account_id,mobile_session_id=excluded.mobile_session_id,
       platform=excluded.platform,device_name=excluded.device_name,active=1,updated_at=excluded.updated_at`,
  ).bind(id, accountType, account.id, account.mobileSessionId, expoPushToken, platform, deviceName, now, now).run();
  const result = await notifyPendingCareerVotesForAccount({ accountType, accountId: account.id });
  await audit(accountType === "administrator" ? account.id : null, "MOBILE_PUSH_REGISTERED", "mobile_push_token", id, { platform, deviceName });
  return Response.json({ ok: true, pendingNotificationsSent: result.sent }, { status: 201, headers: noStore });
}

export async function DELETE(request: Request) {
  const account: any = await currentPlayerAccount(request);
  if (!account?.mobileSessionId) return Response.json({ ok: true }, { headers: noStore });
  const now = new Date().toISOString();
  await db().prepare(`UPDATE mobile_push_tokens SET active=0,updated_at=? WHERE mobile_session_id=?`).bind(now, account.mobileSessionId).run();
  return Response.json({ ok: true }, { headers: noStore });
}
