/* D1 rows are provided by the existing untyped runtime adapter. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, db, ensureDb, hashOpaqueToken } from "./database";

export const MOBILE_ACCESS_TTL_MS = 15 * 60_000;
export const MOBILE_REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
export const MOBILE_REFRESH_REUSE_GRACE_MS = 60_000;

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
};

export async function createMobileSession(account: { id: string; accountType: "administrator" | "member" }, deviceName?: string) {
  await ensureDb();
  const next = await buildMobileSession(account, deviceName);
  await next.insert.run();
  return next.session;
}

export async function rotateMobileSession(refreshToken: string, deviceName?: string) {
  await ensureDb();
  if (!refreshToken || refreshToken.length > 256) return { error: "Refresh token inválido.", status: 401 } as const;
  const hash = await hashOpaqueToken(refreshToken), nowDate = new Date(), now = nowDate.toISOString();
  const row: any = await db().prepare(`SELECT * FROM mobile_sessions
    WHERE revoked_at IS NULL AND (refresh_token_hash=? OR (previous_refresh_token_hash=? AND previous_refresh_valid_until>?))
    ORDER BY CASE WHEN refresh_token_hash=? THEN 0 ELSE 1 END LIMIT 1`).bind(hash, hash, now, hash).first();
  if (!row) {
    const reused: any = await db().prepare(`SELECT * FROM mobile_sessions WHERE refresh_token_hash=? LIMIT 1`).bind(hash).first();
    if (!reused) return { error: "Sessão expirada.", status: 401 } as const;
    await db().prepare(`UPDATE mobile_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE account_type=? AND account_id=?`).bind(now, reused.account_type, reused.account_id).run();
    await audit(reused.account_type === "administrator" ? reused.account_id : null, "MOBILE_REFRESH_REUSE", reused.account_type, reused.account_id, { sessionId: reused.id, reason: "outside_grace_window" });
    return { error: "Sessão revogada. Entre novamente.", status: 401 } as const;
  }
  if (row.refresh_expires_at <= now) {
    await db().prepare(`UPDATE mobile_sessions SET revoked_at=? WHERE id=?`).bind(now, row.id).run();
    return { error: "Sessão expirada.", status: 401 } as const;
  }
  const accountType = row.account_type as "administrator" | "member";
  const table = accountType === "administrator" ? "administrators" : "member_accounts";
  const active = await db().prepare(`SELECT id FROM ${table} WHERE id=? AND active=1`).bind(row.account_id).first();
  if (!active) return { error: "Conta desativada.", status: 403 } as const;
  const graceUntil = new Date(nowDate.getTime() + MOBILE_REFRESH_REUSE_GRACE_MS).toISOString();
  const next = await buildMobileSession({ id: row.account_id, accountType }, deviceName || row.device_name, row.refresh_token_hash, graceUntil);
  await db().batch([next.insert, db().prepare(`UPDATE mobile_sessions SET revoked_at=?,replaced_by_session_id=? WHERE id=?`).bind(now, next.session.id, row.id)]);
  await audit(accountType === "administrator" ? row.account_id : null, "MOBILE_SESSION_REFRESH", accountType, row.account_id, { previousSessionId: row.id, sessionId: next.session.id, graceRecovery: row.refresh_token_hash !== hash });
  return { session: next.session, accountType } as const;
}

export async function revokeMobileSession(request: Request, refreshToken?: string) {
  await ensureDb();
  const bearer = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  const clauses: string[] = [], values: string[] = [];
  if (bearer) { clauses.push("access_token_hash=?"); values.push(await hashOpaqueToken(bearer)); }
  if (refreshToken) { clauses.push("refresh_token_hash=?"); values.push(await hashOpaqueToken(refreshToken)); }
  if (!clauses.length) return null;
  const row: any = await db().prepare(`SELECT id,account_type,account_id FROM mobile_sessions WHERE ${clauses.join(" OR ")} LIMIT 1`).bind(...values).first();
  if (!row) return null;
  await db().prepare(`UPDATE mobile_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE id=?`).bind(new Date().toISOString(), row.id).run();
  await audit(row.account_type === "administrator" ? row.account_id : null, "MOBILE_LOGOUT", row.account_type, row.account_id, { sessionId: row.id });
  return row;
}

function cleanDeviceName(value?: string) {
  const text = String(value || "Dispositivo móvel").trim();
  return text.slice(0, 120) || "Dispositivo móvel";
}

async function buildMobileSession(account: { id: string; accountType: "administrator" | "member" }, deviceName?: string, previousRefreshTokenHash?: string, previousRefreshValidUntil?: string) {
  const id = crypto.randomUUID(), accessToken = randomToken(), refreshToken = randomToken(), now = new Date();
  const accessExpiresAt = new Date(now.getTime() + MOBILE_ACCESS_TTL_MS), refreshExpiresAt = new Date(now.getTime() + MOBILE_REFRESH_TTL_MS);
  const session = { id, accessToken, refreshToken, accessExpiresAt: accessExpiresAt.toISOString(), refreshExpiresAt: refreshExpiresAt.toISOString(), expiresIn: MOBILE_ACCESS_TTL_MS / 1000 };
  const insert = db().prepare(`INSERT INTO mobile_sessions (id,account_type,account_id,access_token_hash,refresh_token_hash,previous_refresh_token_hash,previous_refresh_valid_until,access_expires_at,refresh_expires_at,device_name,last_used_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, account.accountType, account.id, await hashOpaqueToken(accessToken), await hashOpaqueToken(refreshToken), previousRefreshTokenHash || null, previousRefreshValidUntil || null, session.accessExpiresAt, session.refreshExpiresAt, cleanDeviceName(deviceName), now.toISOString(), now.toISOString());
  return { session, insert };
}
