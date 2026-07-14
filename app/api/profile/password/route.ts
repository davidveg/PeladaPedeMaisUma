import { audit, currentAdmin, db, hashPassword, verifyPassword } from "../../../../lib/database";
import { logEvent } from "../../../../lib/logger";
import { getRuntimeBindings } from "../../../../lib/runtime-bindings";

export async function PUT(request: Request) {
  const admin: any = await currentAdmin(request);
  if (!admin) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const payload = await request.json().catch(() => ({})) as { currentPassword?: string; newPassword?: string; confirmation?: string };
  const currentPassword = String(payload.currentPassword ?? "");
  const newPassword = String(payload.newPassword ?? "");
  const confirmation = String(payload.confirmation ?? "");
  if (newPassword.length < 8) return Response.json({ error: "A nova senha deve ter no mínimo 8 caracteres." }, { status: 400 });
  if (newPassword !== confirmation) return Response.json({ error: "A confirmação não corresponde à nova senha." }, { status: 400 });

  const account: any = await db().prepare(`SELECT email,password_hash FROM administrators WHERE id=? AND active=1`).bind(admin.id).first();
  if (!account || !(await verifyPassword(currentPassword, account.password_hash))) {
    logEvent("warn", "profile_password_change_rejected", { administratorId: admin.id });
    return Response.json({ error: "A senha atual está incorreta." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const sessionId = (request.headers.get("cookie") || "").match(/ppm_session=([^;]+)/)?.[1] ?? "";
  const database = db();
  await database.batch([
    database.prepare(`UPDATE administrators SET password_hash=?,must_change_password=0,updated_at=? WHERE id=?`).bind(await hashPassword(newPassword), now, admin.id),
    database.prepare(`DELETE FROM sessions WHERE administrator_id=? AND id<>?`).bind(admin.id, sessionId),
  ]);
  await audit(admin.id, "CHANGE_PASSWORD", "administrator", admin.id, { passwordChanged: true, otherSessionsRevoked: true, notification: "email" });
  logEvent("info", "profile_password_changed", { administratorId: admin.id });

  const mailer = getRuntimeBindings().MAILER;
  if (!mailer?.configured) {
    logEvent("warn", "password_changed_email_unavailable", { administratorId: admin.id });
    return Response.json({ ok: true, emailSent: false, message: "Senha alterada. O aviso por e-mail não foi enviado porque o SMTP não está configurado." });
  }
  try {
    const result = await mailer.sendPasswordChanged({ to: account.email, changedAt: now });
    logEvent("info", "password_changed_email_sent", { administratorId: admin.id, messageId: result.messageId });
    return Response.json({ ok: true, emailSent: true, message: "Senha alterada com sucesso. Enviamos um aviso para o seu e-mail." });
  } catch (error) {
    logEvent("error", "password_changed_email_failed", { administratorId: admin.id, error });
    return Response.json({ ok: true, emailSent: false, message: "Senha alterada, mas não foi possível enviar o aviso por e-mail." });
  }
}
