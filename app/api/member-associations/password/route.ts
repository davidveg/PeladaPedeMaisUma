/* Database account rows are narrowed at the endpoint boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminRequired, audit, db, ensureDb, hashPassword } from "../../../../lib/database";
import { validNewPassword } from "../../../../lib/password-reset-token";

export async function PUT(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as { accountId?: string; password?: string; confirmation?: string };
  const accountId = String(payload.accountId || ""), password = String(payload.password || ""), confirmation = String(payload.confirmation || "");
  if (!accountId) return Response.json({ error: "Conta de jogador não informada." }, { status: 400 });
  if (!validNewPassword(password)) return Response.json({ error: "A senha temporária deve ter pelo menos 8 caracteres e não pode ser “admin”." }, { status: 400 });
  if (password !== confirmation) return Response.json({ error: "A confirmação não corresponde à senha temporária." }, { status: 400 });
  const account: any = await db().prepare(`SELECT id,email,active FROM member_accounts WHERE id=?`).bind(accountId).first();
  if (!account) return Response.json({ error: "Conta de jogador não encontrada." }, { status: 404 });

  const now = new Date().toISOString();
  await db().batch([
    db().prepare(`UPDATE member_accounts SET password_hash=?,updated_at=? WHERE id=?`).bind(await hashPassword(password), now, accountId),
    db().prepare(`UPDATE member_password_reset_tokens SET used_at=? WHERE member_account_id=? AND used_at IS NULL`).bind(now, accountId),
    db().prepare(`DELETE FROM member_sessions WHERE member_account_id=?`).bind(accountId),
    db().prepare(`UPDATE mobile_sessions SET revoked_at=? WHERE account_type='member' AND account_id=? AND revoked_at IS NULL`).bind(now, accountId),
    db().prepare(`UPDATE mobile_push_tokens SET active=0,updated_at=? WHERE account_type='member' AND account_id=?`).bind(now, accountId),
  ]);
  await audit(admin.id, "ADMIN_MEMBER_PASSWORD_RESET", "member_account", accountId, {
    email: account.email,
    active: Boolean(account.active),
    sessionsRevoked: true,
    resetMethod: "temporary_password",
  });
  return Response.json({ ok: true, message: `Senha temporária redefinida para ${account.email}. Todas as sessões anteriores foram encerradas.` });
}
