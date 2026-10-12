/* Administrative special honors for the Hall of Fame. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminRequired, audit, db } from "../../../../lib/database";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const [honors, players] = await Promise.all([
    db().prepare(`SELECT h.id,h.player_id playerId,h.title,h.reason,h.season_number seasonNumber,h.created_at createdAt,p.display_name playerName,p.photo_url photoUrl FROM hall_of_fame_honors h JOIN players p ON p.id=h.player_id ORDER BY h.season_number DESC,h.created_at DESC`).all(),
    db().prepare(`SELECT id,display_name displayName,photo_url photoUrl,active FROM players WHERE deleted_at IS NULL ORDER BY display_name`).all(),
  ]);
  return Response.json({ honors: honors.results, players: players.results }, { headers: noStore });
}

export async function POST(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const body: any = await request.json().catch(() => ({}));
  const playerId = String(body.playerId || ""), title = String(body.title || "").trim(), reason = String(body.reason || "").trim(), seasonNumber = Number(body.seasonNumber);
  if (!playerId || title.length < 3 || title.length > 80 || reason.length < 10 || reason.length > 500 || !Number.isInteger(seasonNumber) || seasonNumber < 1) return Response.json({ error: "Informe jogador, título, motivo e uma temporada válida." }, { status: 400, headers: noStore });
  const player: any = await db().prepare(`SELECT id,display_name FROM players WHERE id=? AND deleted_at IS NULL`).bind(playerId).first();
  if (!player) return Response.json({ error: "Jogador não encontrado." }, { status: 404, headers: noStore });
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await db().prepare(`INSERT INTO hall_of_fame_honors (id,player_id,title,reason,season_number,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id, playerId, title, reason, seasonNumber, admin.id, now, now).run();
  const honor = { id, playerId, playerName: String(player.display_name), title, reason, seasonNumber, createdAt: now };
  await audit(admin.id, "HALL_OF_FAME_HONOR_CREATED", "hall_of_fame_honor", id, honor);
  return Response.json({ honor, message: `${player.display_name} foi incluído no Hall da Fama.` }, { status: 201, headers: noStore });
}

export async function DELETE(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const id = new URL(request.url).searchParams.get("id") || "";
  const previous: any = await db().prepare(`SELECT id,player_id playerId,title,reason,season_number seasonNumber,created_at createdAt FROM hall_of_fame_honors WHERE id=?`).bind(id).first();
  if (!previous) return Response.json({ error: "Homenagem não encontrada." }, { status: 404, headers: noStore });
  await db().prepare(`DELETE FROM hall_of_fame_honors WHERE id=?`).bind(id).run();
  await audit(admin.id, "HALL_OF_FAME_HONOR_REMOVED", "hall_of_fame_honor", id, null, previous);
  return Response.json({ message: "Homenagem especial removida." }, { headers: noStore });
}
