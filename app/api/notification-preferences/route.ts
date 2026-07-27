/* Shared notification settings for authenticated administrator and member accounts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { playerAccountRequired } from "../../../lib/database";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationAccountType,
} from "../../../lib/notification-preferences";

const noStore = { "cache-control": "no-store" };

function identity(account: any) {
  return {
    accountType: (account.accountType === "administrator" ? "administrator" : "member") as NotificationAccountType,
    accountId: String(account.id),
  };
}

export async function GET(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const current = identity(account);
  return Response.json({ preferences: await getNotificationPreferences(current.accountType, current.accountId) }, { headers: noStore });
}

export async function PUT(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const payload = await request.json().catch(() => ({}));
  const current = identity(account);
  const preferences = await saveNotificationPreferences(current.accountType, current.accountId, payload);
  return Response.json({ preferences, message: "Preferências de notificações salvas." }, { headers: noStore });
}
