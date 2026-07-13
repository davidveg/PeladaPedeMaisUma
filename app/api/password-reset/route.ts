import { audit, db, ensureDb, hashPassword } from "../../../lib/database";
import { logEvent } from "../../../lib/logger";
import { createPasswordResetToken, hashPasswordResetToken, validNewPassword, validPasswordResetToken } from "../../../lib/password-reset-token";
import { getRuntimeBindings } from "../../../lib/runtime-bindings";

const genericMessage = "Se o e-mail estiver cadastrado, você receberá as instruções em alguns minutos.";

export async function POST(request: Request) {
  await ensureDb();
  const mailer = getRuntimeBindings().MAILER;
  if (!mailer?.configured) {
    logEvent("error", "password_reset_mailer_unavailable");
    return Response.json({ error: "O envio de e-mail ainda não está configurado. Contate o administrador do sistema." }, { status: 503 });
  }

  const payload = await request.json().catch(() => ({})) as { email?: string };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const admin: any = /^\S+@\S+\.\S+$/.test(email) ? await db().prepare(`SELECT id,email FROM administrators WHERE email=? AND active=1`).bind(email).first() : null;
  if (!admin) {
    logEvent("info", "password_reset_requested", { accountFound: false });
    return Response.json({ ok: true, message: genericMessage }, { status: 202 });
  }

  const minimumCreatedAt = new Date(Date.now() - 60_000).toISOString();
  const recent = await db().prepare(`SELECT id FROM password_reset_tokens WHERE administrator_id=? AND created_at>? LIMIT 1`).bind(admin.id, minimumCreatedAt).first();
  const hourlyCreatedAt = new Date(Date.now() - 60 * 60_000).toISOString();
  const hourly: any = await db().prepare(`SELECT COUNT(*) total FROM password_reset_tokens WHERE administrator_id=? AND created_at>?`).bind(admin.id, hourlyCreatedAt).first();
  if (recent || Number(hourly?.total ?? 0) >= 5) {
    logEvent("warn", "password_reset_rate_limited", { administratorId: admin.id });
    return Response.json({ ok: true, message: genericMessage }, { status: 202 });
  }

  const token = createPasswordResetToken();
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60_000);
  await db().prepare(`DELETE FROM password_reset_tokens WHERE created_at<?`).bind(new Date(now.getTime() - 24 * 60 * 60_000).toISOString()).run();
  await db().prepare(`INSERT INTO password_reset_tokens (id,administrator_id,token_hash,expires_at,used_at,created_at) VALUES (?,?,?,?,NULL,?)`).bind(id, admin.id, await hashPasswordResetToken(token), expiresAt.toISOString(), now.toISOString()).run();

  try {
    const result = await mailer.sendPasswordReset({ to: admin.email, token });
    await audit(null, "PASSWORD_RESET_REQUEST", "administrator", admin.id, { delivery: "email" });
    logEvent("info", "password_reset_email_sent", { administratorId: admin.id, messageId: result.messageId });
  } catch (error) {
    await db().prepare(`UPDATE password_reset_tokens SET used_at=? WHERE id=?`).bind(new Date().toISOString(), id).run();
    logEvent("error", "password_reset_email_failed", { administratorId: admin.id, error });
  }

  return Response.json({ ok: true, message: genericMessage }, { status: 202 });
}

export async function PUT(request: Request) {
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as { token?: string; password?: string };
  const token = String(payload.token ?? "");
  const password = String(payload.password ?? "");
  if (!validPasswordResetToken(token) || !validNewPassword(password)) {
    return Response.json({ error: "Link inválido ou senha fora dos critérios mínimos." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row: any = await db().prepare(`SELECT t.id token_id,t.administrator_id FROM password_reset_tokens t JOIN administrators a ON a.id=t.administrator_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND a.active=1 LIMIT 1`).bind(await hashPasswordResetToken(token), now).first();
  if (!row) {
    logEvent("warn", "password_reset_token_rejected");
    return Response.json({ error: "Este link é inválido, expirou ou já foi utilizado." }, { status: 400 });
  }

  const database = db();
  const claimed = await database.prepare(`UPDATE password_reset_tokens SET used_at=? WHERE id=? AND used_at IS NULL`).bind(now, row.token_id).run();
  if (Number(claimed.meta?.changes ?? 0) !== 1) {
    logEvent("warn", "password_reset_token_race_rejected");
    return Response.json({ error: "Este link já foi utilizado." }, { status: 400 });
  }
  await database.batch([
    database.prepare(`UPDATE administrators SET password_hash=?,must_change_password=0,updated_at=? WHERE id=?`).bind(await hashPassword(password), now, row.administrator_id),
    database.prepare(`UPDATE password_reset_tokens SET used_at=? WHERE administrator_id=? AND used_at IS NULL`).bind(now, row.administrator_id),
    database.prepare(`DELETE FROM sessions WHERE administrator_id=?`).bind(row.administrator_id),
  ]);
  await audit(row.administrator_id, "PASSWORD_RESET", "administrator", row.administrator_id, { sessionsRevoked: true });
  logEvent("info", "password_reset_completed", { administratorId: row.administrator_id });
  return Response.json({ ok: true, message: "Senha redefinida. Você já pode entrar no painel." });
}
