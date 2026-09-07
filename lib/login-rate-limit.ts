import { db, hashOpaqueToken } from "./database";

const WINDOW_MS = 15 * 60_000;
const BLOCK_MS = 15 * 60_000;
const RETENTION_MS = 24 * 60 * 60_000;
const ACCOUNT_LIMIT = 5;
const IP_LIMIT = 25;

type RateLimitEntry = { id: string; limit: number; kind: "account" | "ip" };
export type LoginRateLimit = { allowed: boolean; retryAfter: number; entries: RateLimitEntry[] };

export async function beginLoginAttempt(request: Request, scope: string, email: string): Promise<LoginRateLimit> {
  const normalizedEmail = email.trim().toLowerCase().slice(0, 320);
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0];
  const entries: RateLimitEntry[] = [
    { id: `${scope}:account:${await hashOpaqueToken(normalizedEmail)}`, limit: ACCOUNT_LIMIT, kind: "account" },
  ];
  if (forwarded?.trim()) entries.push({ id: `${scope}:ip:${await hashOpaqueToken(forwarded.trim().slice(0, 128))}`, limit: IP_LIMIT, kind: "ip" });
  const now = new Date(), rows = await Promise.all(entries.map(entry => db().prepare(`SELECT blocked_until FROM login_rate_limits WHERE id=?`).bind(entry.id).first<{ blocked_until?: string | null }>()));
  const blockedUntil = rows.reduce((latest, row) => row?.blocked_until && row.blocked_until > latest ? row.blocked_until : latest, "");
  const retryAfter = blockedUntil > now.toISOString() ? Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - now.getTime()) / 1000)) : 0;
  return { allowed: retryAfter === 0, retryAfter, entries };
}

export async function recordLoginFailure(rateLimit: LoginRateLimit) {
  const now = new Date(), nowIso = now.toISOString(), cutoff = new Date(now.getTime() - WINDOW_MS).toISOString(), blockedUntil = new Date(now.getTime() + BLOCK_MS).toISOString();
  const updates = rateLimit.entries.map(entry => db().prepare(`
    INSERT INTO login_rate_limits (id,failures,window_started_at,blocked_until,updated_at) VALUES (?,1,?,NULL,?)
    ON CONFLICT(id) DO UPDATE SET
      failures=CASE WHEN login_rate_limits.window_started_at<=? THEN 1 ELSE login_rate_limits.failures+1 END,
      window_started_at=CASE WHEN login_rate_limits.window_started_at<=? THEN ? ELSE login_rate_limits.window_started_at END,
      blocked_until=CASE WHEN login_rate_limits.window_started_at<=? THEN NULL WHEN login_rate_limits.failures+1>=? THEN ? ELSE login_rate_limits.blocked_until END,
      updated_at=?
  `).bind(entry.id, nowIso, nowIso, cutoff, cutoff, nowIso, cutoff, entry.limit, blockedUntil, nowIso));
  updates.push(db().prepare(`DELETE FROM login_rate_limits WHERE updated_at<?`).bind(new Date(now.getTime() - RETENTION_MS).toISOString()));
  await db().batch(updates);
}

export async function clearSuccessfulLogin(rateLimit: LoginRateLimit) {
  const account = rateLimit.entries.find(entry => entry.kind === "account");
  if (account) await db().prepare(`DELETE FROM login_rate_limits WHERE id=?`).bind(account.id).run();
}

export function loginRateLimitResponse(rateLimit: LoginRateLimit, headers: Record<string, string> = {}) {
  return Response.json({ error: "Muitas tentativas de login. Aguarde antes de tentar novamente." }, {
    status: 429,
    headers: { ...headers, "cache-control": "no-store", "retry-after": String(rateLimit.retryAfter) },
  });
}
