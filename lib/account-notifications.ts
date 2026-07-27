/* Database and Expo Push payloads are narrowed at integration boundaries. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb } from "./database";
import { logEvent } from "./logger";

export type AccountNotificationType =
  | "MATCH_CREATED"
  | "MATCH_UPDATED"
  | "ATTENDANCE_CHANGED"
  | "MATCH_CLOSED"
  | "MATCH_CANCELLED";

export type BroadcastNotification = {
  type: AccountNotificationType;
  title: string;
  body: string;
  matchId: string;
};

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";

export async function broadcastAccountNotification(message: BroadcastNotification) {
  await ensureDb();
  const recipients = (await db().prepare(
    `SELECT id account_id,'administrator' account_type FROM administrators WHERE active=1
     UNION ALL
     SELECT id account_id,'member' account_type FROM member_accounts WHERE active=1`,
  ).all()).results as any[];
  const now = new Date().toISOString();
  const notifications = recipients.map(recipient => ({
    id: crypto.randomUUID(),
    accountType: recipient.account_type === "administrator" ? "administrator" : "member",
    accountId: String(recipient.account_id),
  }));
  for (let offset = 0; offset < notifications.length; offset += 100) {
    await db().batch(notifications.slice(offset, offset + 100).map(item => db().prepare(
      `INSERT INTO account_notifications
       (id,account_type,account_id,type,title,body,match_id,created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).bind(item.id, item.accountType, item.accountId, message.type, message.title, message.body, message.matchId, now)));
  }
  const sent = await sendPush(notifications, message);
  return { created: notifications.length, sent };
}

async function sendPush(
  notifications: { id: string; accountType: string; accountId: string }[],
  message: BroadcastNotification,
) {
  const pending: any[] = [];
  for (const notification of notifications) {
    const tokens = (await db().prepare(
      `SELECT id,expo_push_token FROM mobile_push_tokens
       WHERE account_type=? AND account_id=? AND active=1`,
    ).bind(notification.accountType, notification.accountId).all()).results as any[];
    for (const token of tokens) {
      const deliveryId = crypto.randomUUID(), now = new Date().toISOString();
      try {
        await db().prepare(
          `INSERT INTO notification_push_deliveries
           (id,notification_id,push_token_id,status,created_at,updated_at)
           VALUES (?,?,?,'PENDING',?,?)`,
        ).bind(deliveryId, notification.id, token.id, now, now).run();
        pending.push({ deliveryId, tokenId: String(token.id), expoPushToken: String(token.expo_push_token) });
      } catch (error: any) {
        if (!String(error?.message || error).toLowerCase().includes("unique")) throw error;
      }
    }
  }

  for (let offset = 0; offset < pending.length; offset += 100) {
    const batch = pending.slice(offset, offset + 100);
    try {
      const response = await fetch(expoPushEndpoint, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(batch.map(item => ({
          to: item.expoPushToken,
          title: message.title,
          body: message.body,
          sound: "default",
          priority: "high",
          channelId: "matches",
          data: { type: message.type.toLowerCase(), matchId: message.matchId },
        }))),
        signal: AbortSignal.timeout(8_000),
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.errors?.[0]?.message || `Expo Push HTTP ${response.status}`);
      const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
      for (let index = 0; index < batch.length; index += 1) {
        const item = batch[index], ticket = tickets[index] || {}, now = new Date().toISOString();
        const error = ticket.status === "error" ? String(ticket.message || ticket.details?.error || "Falha no Expo Push") : null;
        await db().prepare(
          `UPDATE notification_push_deliveries SET status=?,ticket_id=?,error=?,updated_at=? WHERE id=?`,
        ).bind(error ? "FAILED" : "SENT", ticket.id || null, error, now, item.deliveryId).run();
        if (ticket.details?.error === "DeviceNotRegistered") {
          await db().prepare(`UPDATE mobile_push_tokens SET active=0,updated_at=? WHERE id=?`).bind(now, item.tokenId).run();
        }
      }
    } catch (error: any) {
      const detail = String(error?.message || error).slice(0, 500), now = new Date().toISOString();
      for (const item of batch) {
        await db().prepare(
          `UPDATE notification_push_deliveries SET status='FAILED',error=?,updated_at=? WHERE id=?`,
        ).bind(detail, now, item.deliveryId).run();
      }
      logEvent("warn", "match_push_notification_failed", { count: batch.length, error: detail });
    }
  }
  if (pending.length) logEvent("info", "match_notifications_dispatched", { type: message.type, count: pending.length });
  return pending.length;
}
