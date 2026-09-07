import { adminRequired, audit, db, ensureDb } from "../../../lib/database";

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();
  const [rows, players] = await Promise.all([
    db().prepare(`SELECT accounts.*,l.player_id,p.display_name,p.type,p.primary_position FROM (SELECT id,email,active,last_login_at,created_at,updated_at,role,0 promoted_from_member,'member' account_type FROM member_accounts UNION ALL SELECT id,email,active,last_login_at,created_at,updated_at,'administrator' role,promoted_from_member,'administrator' account_type FROM administrators) accounts LEFT JOIN player_account_links l ON l.account_type=accounts.account_type AND l.account_id=accounts.id LEFT JOIN players p ON p.id=l.player_id ORDER BY accounts.created_at DESC`).all(),
    db().prepare(`SELECT p.id,p.display_name,p.type,p.primary_position FROM players p LEFT JOIN player_account_links l ON l.player_id=p.id WHERE p.deleted_at IS NULL AND p.active=1 AND l.player_id IS NULL ORDER BY p.display_name`).all(),
  ]);
  return Response.json({
    associations: rows.results.map((row: any) => ({ id: row.id, email: row.email, accountType: row.account_type, role: row.role || (row.account_type === "administrator" ? "administrator" : "member"), promotedFromMember: !!row.promoted_from_member, canDemote: row.account_type === "administrator" && !!row.promoted_from_member, playerId: row.player_id, playerName: row.display_name, playerType: row.type, primaryPosition: row.primary_position, active: !!row.active, lastLoginAt: row.last_login_at, createdAt: row.created_at, updatedAt: row.updated_at })),
    availablePlayers: players.results.map((row: any) => ({ id: row.id, displayName: row.display_name, type: row.type, primaryPosition: row.primary_position })),
  }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const payload = await request.json().catch(() => ({})) as any;
  const accountId = String(payload.accountId || ""), playerId = String(payload.playerId || "");
  const accountType = payload.accountType === "administrator" ? "administrator" : payload.accountType === "member" ? "member" : null;
  if (!accountId || !playerId || !accountType) return Response.json({ error: "Informe uma conta e um jogador válidos." }, { status: 400 });
  const table = accountType === "administrator" ? "administrators" : "member_accounts";
  const account: any = await db().prepare(`SELECT id,email,active FROM ${table} WHERE id=?`).bind(accountId).first();
  if (!account) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
  if (!account.active) return Response.json({ error: "Ative a conta antes de associar um jogador." }, { status: 409 });
  if (await db().prepare(`SELECT player_id FROM player_account_links WHERE account_type=? AND account_id=?`).bind(accountType, accountId).first()) return Response.json({ error: "Esta conta já está associada a um jogador." }, { status: 409 });
  const player: any = await db().prepare(`SELECT p.id,p.display_name FROM players p LEFT JOIN player_account_links l ON l.player_id=p.id WHERE p.id=? AND p.active=1 AND p.deleted_at IS NULL AND l.player_id IS NULL`).bind(playerId).first();
  if (!player) return Response.json({ error: "Jogador indisponível para associação." }, { status: 409 });
  try {
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`).bind(playerId, accountType, accountId, new Date().toISOString()).run();
  } catch (error: any) {
    if (String(error?.message || error).toLowerCase().includes("unique")) return Response.json({ error: "A conta ou o jogador já foi associado em outra operação." }, { status: 409 });
    throw error;
  }
  await audit(admin.id, "MEMBER_ASSOCIATE", accountType === "administrator" ? "administrator" : "member_account", accountId, { email: account.email, playerId, displayName: player.display_name, approvedBy: admin.id, portal: "admin" });
  return Response.json({ ok: true, message: `${account.email} foi associado a ${player.display_name}.` });
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
  return Response.json({ ok: true, message: "Associação removida. Um administrador deverá aprovar o próximo vínculo." });
}
