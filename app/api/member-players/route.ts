import { audit, db, playerAccountRequired } from "../../../lib/database";

export async function GET(request: Request) {
  const member = await playerAccountRequired(request);
  if (!member) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const rows = await db().prepare(`SELECT p.id,p.display_name,p.type,p.primary_position,p.photo_url FROM players p LEFT JOIN player_account_links l ON l.player_id=p.id WHERE p.deleted_at IS NULL AND p.active=1 AND l.player_id IS NULL ORDER BY p.display_name`).all();
  return Response.json({ players: rows.results.map((row: any) => ({ id: row.id, displayName: row.display_name, type: row.type, primaryPosition: row.primary_position, photoUrl: row.photo_url })) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const member: any = await playerAccountRequired(request);
  if (!member) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (member.playerId) return Response.json({ error: "Esta conta já está associada a um jogador. Somente um administrador pode desfazer a associação." }, { status: 409 });
  const payload = await request.json().catch(() => ({})) as any, playerId = String(payload.playerId || "");
  const player: any = await db().prepare(`SELECT id,display_name FROM players WHERE id=? AND active=1 AND deleted_at IS NULL`).bind(playerId).first();
  if (!player) return Response.json({ error: "Jogador indisponível para associação." }, { status: 404 });
  const used = await db().prepare(`SELECT account_id FROM player_account_links WHERE player_id=?`).bind(playerId).first();
  if (used) return Response.json({ error: "Este jogador já está associado a outra conta." }, { status: 409 });
  try {
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`).bind(playerId, member.accountType === "administrator" ? "administrator" : "member", member.id, new Date().toISOString()).run();
  } catch (error: any) {
    if (String(error?.message || error).toLowerCase().includes("unique")) return Response.json({ error: "Este jogador já está associado a outra conta." }, { status: 409 });
    throw error;
  }
  await audit(member.accountType === "administrator" ? member.id : null, "MEMBER_ASSOCIATE", member.accountType === "administrator" ? "administrator" : "member_account", member.id, { email: member.email, playerId, displayName: player.display_name, portal: "player" });
  return Response.json({ ok: true, message: `Conta associada a ${player.display_name}.` });
}
