import { audit, db, ensureDb, hashOpaqueToken } from "./database";
import { sessionCookie } from "./secure-transport";

export const WEB_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const WEB_SESSION_TTL_MS = WEB_SESSION_TTL_SECONDS * 1000;
const WEB_SESSION_RENEWAL_WINDOW_MS = WEB_SESSION_TTL_MS / 2;

type WebAccount = { id: string; accountType: "administrator" | "member" };
type WebSessionDefinition = {
  cookieName: "ppm_session" | "ppm_member_session";
  table: "sessions" | "member_sessions";
  accountColumn: "administrator_id" | "member_account_id";
  accountTable: "administrators" | "member_accounts";
  entityType: "administrator" | "member_account";
};

const administratorSession: WebSessionDefinition = {
  cookieName: "ppm_session",
  table: "sessions",
  accountColumn: "administrator_id",
  accountTable: "administrators",
  entityType: "administrator",
};

const memberSession: WebSessionDefinition = {
  cookieName: "ppm_member_session",
  table: "member_sessions",
  accountColumn: "member_account_id",
  accountTable: "member_accounts",
  entityType: "member_account",
};

export async function renewCurrentWebSession(request: Request, account: WebAccount | null | undefined) {
  if (!account) return null;
  const definition = account.accountType === "administrator" ? administratorSession : memberSession;
  const token = cookieValue(request, definition.cookieName);
  if (!token) return null;

  await ensureDb();
  const hash = await hashOpaqueToken(token), now = new Date();
  const session = await db().prepare(
    `SELECT id,expires_at expiresAt FROM ${definition.table} WHERE id IN (?,?) AND ${definition.accountColumn}=? AND expires_at>? LIMIT 1`,
  ).bind(hash, token, account.id, now.toISOString()).first<{ id: string; expiresAt: string }>();
  if (!session) return null;

  if (session.id === token) {
    await db().prepare(`UPDATE ${definition.table} SET id=? WHERE id=?`).bind(hash, token).run();
  }
  if (new Date(session.expiresAt).getTime() - now.getTime() > WEB_SESSION_RENEWAL_WINDOW_MS) return null;

  const expiresAt = new Date(now.getTime() + WEB_SESSION_TTL_MS).toISOString();
  await db().prepare(`UPDATE ${definition.table} SET expires_at=? WHERE id=?`).bind(expiresAt, hash).run();
  return sessionCookie(request, definition.cookieName, token, WEB_SESSION_TTL_SECONDS);
}

export async function closeInvalidWebSessions(request: Request, portal: "player" | "protected") {
  await ensureDb();
  for (const definition of [administratorSession, memberSession]) {
    const token = cookieValue(request, definition.cookieName);
    if (!token) continue;
    const hash = await hashOpaqueToken(token);
    const row = await db().prepare(
      `SELECT s.id,s.expires_at expiresAt,s.${definition.accountColumn} accountId,a.active
       FROM ${definition.table} s LEFT JOIN ${definition.accountTable} a ON a.id=s.${definition.accountColumn}
       WHERE s.id IN (?,?) LIMIT 1`,
    ).bind(hash, token).first<{ id: string; expiresAt: string; accountId: string; active: number | null }>();
    if (!row) continue;

    const reason = new Date(row.expiresAt).getTime() <= Date.now()
      ? "expired"
      : Number(row.active) !== 1 ? "account_inactive" : null;
    if (!reason) continue;
    await db().prepare(`DELETE FROM ${definition.table} WHERE id=?`).bind(row.id).run();
    await audit(
      definition.entityType === "administrator" ? row.accountId : null,
      "WEB_SESSION_ENDED",
      definition.entityType,
      row.accountId,
      { reason, portal, expiresAt: row.expiresAt },
    );
  }
}

function cookieValue(request: Request, name: string) {
  return (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] || "";
}
