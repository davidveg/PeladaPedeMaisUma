/* Account rows are validated at the endpoint boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminRequired, audit, db, ensureDb } from "../../../../lib/database";
import { logEvent } from "../../../../lib/logger";

export async function POST(request: Request) {
  const administrator: any = await adminRequired(request);
  if (!administrator) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();

  const payload = await request.json().catch(() => ({})) as { accountId?: string };
  const accountId = String(payload.accountId || "").trim();
  if (!accountId) return Response.json({ error: "Administrador não informado." }, { status: 400 });

  const target: any = await db().prepare(
    `SELECT a.id,a.email,a.password_hash,a.active,a.promoted_from_member,a.last_login_at,a.created_at,a.updated_at,
            l.player_id,p.display_name player_name
     FROM administrators a
     LEFT JOIN player_account_links l ON l.account_type='administrator' AND l.account_id=a.id
     LEFT JOIN players p ON p.id=l.player_id
     WHERE a.id=?`,
  ).bind(accountId).first();
  if (!target) return Response.json({ error: "Administrador não encontrado." }, { status: 404 });
  if (!target.promoted_from_member) {
    return Response.json({ error: "Somente administradores promovidos pelo painel de contas de jogadores podem voltar a ser usuários." }, { status: 403 });
  }

  if (target.active) {
    const activeAdministrators = Number(await db().prepare(`SELECT COUNT(*) total FROM administrators WHERE active=1`).first("total") || 0);
    if (activeAdministrators <= 1) {
      return Response.json({ error: "Não é possível reverter o último administrador ativo do sistema." }, { status: 400 });
    }
  }

  const memberConflict = await db().prepare(`SELECT id FROM member_accounts WHERE id=? OR email=? LIMIT 1`).bind(accountId, target.email).first();
  if (memberConflict) return Response.json({ error: "Já existe uma conta de jogador conflitante com este administrador." }, { status: 409 });

  const now = new Date().toISOString();
  try {
    await db().batch([
      db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,last_login_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(
        target.id,
        target.email,
        target.password_hash,
        target.active ? 1 : 0,
        target.last_login_at || null,
        target.created_at,
        now,
      ),
      db().prepare(`UPDATE player_account_links SET account_type='member' WHERE account_type='administrator' AND account_id=?`).bind(accountId),
      db().prepare(`UPDATE mobile_sessions SET account_type='member' WHERE account_type='administrator' AND account_id=?`).bind(accountId),
      db().prepare(`UPDATE mobile_push_tokens SET account_type='member',updated_at=? WHERE account_type='administrator' AND account_id=?`).bind(now, accountId),
      db().prepare(`UPDATE account_notifications SET account_type='member' WHERE account_type='administrator' AND account_id=?`).bind(accountId),
      db().prepare(`UPDATE account_notification_preferences SET account_type='member',updated_at=? WHERE account_type='administrator' AND account_id=?`).bind(now, accountId),
      db().prepare(`UPDATE career_votes SET voter_account_type='member' WHERE voter_account_type='administrator' AND voter_account_id=?`).bind(accountId),
      db().prepare(`DELETE FROM password_reset_tokens WHERE administrator_id=?`).bind(accountId),
      db().prepare(`DELETE FROM sessions WHERE administrator_id=?`).bind(accountId),
      db().prepare(`DELETE FROM administrators WHERE id=?`).bind(accountId),
    ]);
  } catch (error: any) {
    if (String(error?.message || error).toLowerCase().includes("unique")) {
      return Response.json({ error: "Não foi possível reverter a conta porque já existe um cadastro de jogador conflitante." }, { status: 409 });
    }
    throw error;
  }

  await audit(administrator.id, "ADMIN_REVERTED_TO_MEMBER", "member_account", accountId, {
    accountType: "member",
    email: target.email,
    playerId: target.player_id || null,
    playerName: target.player_name || null,
    active: Boolean(target.active),
    passwordPreserved: true,
    playerAssociationPreserved: Boolean(target.player_id),
  }, {
    accountType: "administrator",
    email: target.email,
    playerId: target.player_id || null,
    promotedFromMember: true,
  });
  logEvent("info", "administrator_reverted_to_member", {
    administratorId: administrator.id,
    revertedAccountId: accountId,
    playerId: target.player_id || null,
  });

  return Response.json({
    ok: true,
    message: `${target.email} voltou a ser uma conta de jogador. A senha e${target.player_id ? " a associação com o jogador" : " o cadastro"} foram preservadas.`,
  });
}
