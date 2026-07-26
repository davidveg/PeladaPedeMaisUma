/* Database rows are narrowed at the endpoint boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, db, ensureDb, hashPassword } from "../../../lib/database";
import { logEvent } from "../../../lib/logger";
import { createPasswordResetToken, hashPasswordResetToken, validNewPassword, validPasswordResetToken } from "../../../lib/password-reset-token";
import { getRuntimeBindings } from "../../../lib/runtime-bindings";

const genericMessage = "Se o e-mail estiver cadastrado, você receberá as instruções em alguns minutos.";

export async function POST(request: Request) {
  await ensureDb();
  const mailer = getRuntimeBindings().MAILER;
  if (!mailer?.configured) {
    logEvent("error", "member_password_reset_mailer_unavailable");
    return Response.json({ error: "O envio de e-mail ainda não está configurado. Contate o administrador do sistema." }, { status: 503 });
  }
  const payload = await request.json().catch(() => ({})) as { email?: string };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const member: any = /^\S+@\S+\.\S+$/.test(email)
    ? await db().prepare(`SELECT id,email FROM member_accounts WHERE email=? AND active=1`).bind(email).first()
    : null;
  if (!member) {
    logEvent("info", "member_password_reset_requested", { accountFound: false });
    return Response.json({ ok: true, message: genericMessage }, { status: 202 });
  }

  const minimumCreatedAt = new Date(Date.now() - 60_000).toISOString();
  const hourlyCreatedAt = new Date(Date.now() - 60 * 60_000).toISOString();
  const [recent, hourly] = await Promise.all([
    db().prepare(`SELECT id FROM member_password_reset_tokens WHERE member_account_id=? AND created_at>? LIMIT 1`).bind(member.id, minimumCreatedAt).first(),
    db().prepare(`SELECT COUNT(*) total FROM member_password_reset_tokens WHERE member_account_id=? AND created_at>?`).bind(member.id, hourlyCreatedAt).first<any>(),
  ]);
  if (recent || Number(hourly?.total ?? 0) >= 5) {
    logEvent("warn", "member_password_reset_rate_limited", { memberAccountId: member.id });
    return Response.json({ ok: true, message: genericMessage }, { status: 202 });
  }

  const token = createPasswordResetToken(), id = crypto.randomUUID(), now = new Date(), expiresAt = new Date(now.getTime() + 30 * 60_000);
  await db().prepare(`DELETE FROM member_password_reset_tokens WHERE created_at<?`).bind(new Date(now.getTime() - 24 * 60 * 60_000).toISOString()).run();
  await db().prepare(
    `INSERT INTO member_password_reset_tokens (id,member_account_id,token_hash,expires_at,used_at,created_at) VALUES (?,?,?,?,NULL,?)`,
  ).bind(id, member.id, await hashPasswordResetToken(token), expiresAt.toISOString(), now.toISOString()).run();

  try {
    const result = await mailer.sendPasswordReset({ to: member.email, token, portal: "member" });
    await audit(null, "MEMBER_PASSWORD_RESET_REQUEST", "member_account", member.id, { delivery: "email" });
    logEvent("info", "member_password_reset_email_sent", { memberAccountId: member.id, messageId: result.messageId });
  } catch (error) {
    await db().prepare(`UPDATE member_password_reset_tokens SET used_at=? WHERE id=?`).bind(new Date().toISOString(), id).run();
    logEvent("error", "member_password_reset_email_failed", { memberAccountId: member.id, error });
  }
  return Response.json({ ok: true, message: genericMessage }, { status: 202 });
}

export async function PUT(request: Request) {
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as { token?: string; password?: string; confirmation?: string };
  const token = String(payload.token ?? ""), password = String(payload.password ?? ""), confirmation = String(payload.confirmation ?? "");
  if (!validPasswordResetToken(token) || !validNewPassword(password) || password !== confirmation) {
    return Response.json({ error: "Link inválido, senhas diferentes ou senha fora dos critérios mínimos." }, { status: 400 });
  }
  const now = new Date().toISOString(), tokenHash = await hashPasswordResetToken(token);
  const row: any = await db().prepare(
    `SELECT t.id token_id,t.member_account_id,a.email
     FROM member_password_reset_tokens t JOIN member_accounts a ON a.id=t.member_account_id
     WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND a.active=1 LIMIT 1`,
  ).bind(tokenHash, now).first();
  if (!row) {
    logEvent("warn", "member_password_reset_token_rejected");
    return Response.json({ error: "Este link é inválido, expirou ou já foi utilizado." }, { status: 400 });
  }
  const claimed = await db().prepare(`UPDATE member_password_reset_tokens SET used_at=? WHERE id=? AND used_at IS NULL`).bind(now, row.token_id).run();
  if (Number(claimed.meta?.changes ?? 0) !== 1) return Response.json({ error: "Este link já foi utilizado." }, { status: 400 });
  await db().batch([
    db().prepare(`UPDATE member_accounts SET password_hash=?,updated_at=? WHERE id=?`).bind(await hashPassword(password), now, row.member_account_id),
    db().prepare(`UPDATE member_password_reset_tokens SET used_at=? WHERE member_account_id=? AND used_at IS NULL`).bind(now, row.member_account_id),
    db().prepare(`DELETE FROM member_sessions WHERE member_account_id=?`).bind(row.member_account_id),
    db().prepare(`UPDATE mobile_sessions SET revoked_at=? WHERE account_type='member' AND account_id=? AND revoked_at IS NULL`).bind(now, row.member_account_id),
    db().prepare(`UPDATE mobile_push_tokens SET active=0,updated_at=? WHERE account_type='member' AND account_id=?`).bind(now, row.member_account_id),
  ]);
  await audit(null, "MEMBER_PASSWORD_RESET", "member_account", row.member_account_id, { sessionsRevoked: true });
  logEvent("info", "member_password_reset_completed", { memberAccountId: row.member_account_id });
  try {
    await getRuntimeBindings().MAILER?.sendPasswordChanged({ to: row.email, changedAt: now, portal: "member" });
  } catch (error) {
    logEvent("error", "member_password_changed_email_failed", { memberAccountId: row.member_account_id, error });
  }
  return Response.json({ ok: true, message: "Senha redefinida. Você já pode entrar com a nova senha." });
}
