/* Account rows are validated at the endpoint boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminRequired, audit, db, ensureDb } from "../../../../lib/database";
import { insertAdministratorSql } from "../../../../lib/administrator-sql";
import { logEvent } from "../../../../lib/logger";

export async function POST(request: Request) {
  const administrator: any = await adminRequired(request);
  if (!administrator) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();

  const payload = await request.json().catch(() => ({})) as { accountId?: string };
  const accountId = String(payload.accountId || "").trim();
  if (!accountId) return Response.json({ error: "Conta de jogador não informada." }, { status: 400 });

  const member: any = await db().prepare(
    `SELECT a.id,a.email,a.password_hash,a.active,a.last_login_at,a.created_at,a.updated_at,
            l.player_id,p.display_name player_name
     FROM member_accounts a
     LEFT JOIN player_account_links l ON l.account_type='member' AND l.account_id=a.id
     LEFT JOIN players p ON p.id=l.player_id
     WHERE a.id=?`,
  ).bind(accountId).first();
  if (!member) return Response.json({ error: "Conta de jogador não encontrada ou já promovida." }, { status: 404 });

  const emailConflict = await db().prepare(`SELECT id FROM administrators WHERE email=? OR id=? LIMIT 1`).bind(member.email, accountId).first();
  if (emailConflict) return Response.json({ error: "Já existe uma conta administrativa com este e-mail." }, { status: 409 });

  const now = new Date().toISOString();
  try {
    await db().batch([
      db().prepare(insertAdministratorSql).bind(
        member.id,
        member.email,
        member.password_hash,
        member.active ? 1 : 0,
        0,
        member.last_login_at || null,
        member.created_at,
        now,
      ),
      db().prepare(`UPDATE player_account_links SET account_type='administrator' WHERE account_type='member' AND account_id=?`).bind(accountId),
      db().prepare(`UPDATE mobile_sessions SET account_type='administrator' WHERE account_type='member' AND account_id=?`).bind(accountId),
      db().prepare(`UPDATE mobile_push_tokens SET account_type='administrator',updated_at=? WHERE account_type='member' AND account_id=?`).bind(now, accountId),
      db().prepare(`UPDATE account_notifications SET account_type='administrator' WHERE account_type='member' AND account_id=?`).bind(accountId),
      db().prepare(`UPDATE account_notification_preferences SET account_type='administrator',updated_at=? WHERE account_type='member' AND account_id=?`).bind(now, accountId),
      db().prepare(`UPDATE career_votes SET voter_account_type='administrator' WHERE voter_account_type='member' AND voter_account_id=?`).bind(accountId),
      db().prepare(`DELETE FROM member_password_reset_tokens WHERE member_account_id=?`).bind(accountId),
      db().prepare(`DELETE FROM member_sessions WHERE member_account_id=?`).bind(accountId),
      db().prepare(`DELETE FROM member_accounts WHERE id=?`).bind(accountId),
    ]);
  } catch (error: any) {
    if (String(error?.message || error).toLowerCase().includes("unique")) {
      return Response.json({ error: "Não foi possível promover a conta porque já existe um cadastro administrativo conflitante." }, { status: 409 });
    }
    throw error;
  }

  await audit(administrator.id, "MEMBER_PROMOTED_TO_ADMIN", "administrator", accountId, {
    email: member.email,
    playerId: member.player_id || null,
    playerName: member.player_name || null,
    active: Boolean(member.active),
    passwordPreserved: true,
    playerAssociationPreserved: Boolean(member.player_id),
  }, {
    accountType: "member",
    email: member.email,
    playerId: member.player_id || null,
  });
  logEvent("info", "member_promoted_to_administrator", {
    administratorId: administrator.id,
    promotedAccountId: accountId,
    playerId: member.player_id || null,
  });

  return Response.json({
    ok: true,
    message: `${member.email} agora é uma conta de administrador. A senha e${member.player_id ? " a associação com o jogador" : " o cadastro"} foram preservadas.`,
  });
}
