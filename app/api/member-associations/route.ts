import { adminRequired, audit, db, ensureDb } from "../../../lib/database";

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();
  const rows = await db().prepare(`SELECT accounts.*,l.player_id,p.display_name,p.type,p.primary_position FROM (SELECT id,email,active,last_login_at,created_at,updated_at,'member' account_type FROM member_accounts UNION ALL SELECT id,email,active,last_login_at,created_at,updated_at,'administrator' account_type FROM administrators) accounts LEFT JOIN player_account_links l ON l.account_type=accounts.account_type AND l.account_id=accounts.id LEFT JOIN players p ON p.id=l.player_id ORDER BY accounts.created_at DESC`).all();
  return Response.json({ associations: rows.results.map((row: any) => ({ id: row.id, email: row.email, accountType: row.account_type, playerId: row.player_id, playerName: row.display_name, playerType: row.type, primaryPosition: row.primary_position, active: !!row.active, lastLoginAt: row.last_login_at, createdAt: row.created_at, updatedAt: row.updated_at })) }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const accountType = new URL(request.url).searchParams.get("type") === "administrator" ? "administrator" : "member";
  const table = accountType === "administrator" ? "administrators" : "member_accounts";
  const previous: any = id ? await db().prepare(`SELECT a.email,l.player_id,p.display_name FROM ${table} a LEFT JOIN player_account_links l ON l.account_type=? AND l.account_id=a.id LEFT JOIN players p ON p.id=l.player_id WHERE a.id=?`).bind(accountType, id).first() : null;
  if (!previous) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
  await db().prepare(`DELETE FROM player_account_links WHERE account_type=? AND account_id=?`).bind(accountType, id).run();
  await audit(admin.id, "MEMBER_DISASSOCIATE", accountType === "administrator" ? "administrator" : "member_account", id || undefined, { email: previous.email, playerId: null }, previous);
  return Response.json({ ok: true, message: "Associação removida. O usuário poderá escolher outro jogador no próximo acesso." });
}
