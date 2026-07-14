import { adminRequired, audit, db, ensureDb } from "../../../lib/database";
import { normalizeName } from "../../../lib/football";

const map = (row: any) => ({
  ...row,
  fullName: row.full_name,
  displayName: row.display_name,
  primaryPosition: row.primary_position,
  photoUrl: row.photo_url,
  momentum: Number(row.momentum ?? 0),
  aliases: JSON.parse(row.aliases || "[]"),
  active: Boolean(row.active),
});

export async function POST(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  const payload = await request.json() as any;
  const displayName = String(payload.displayName || "").trim();
  const speed = Math.round(Number(payload.speed) * 10) / 10;
  const skill = Math.round(Number(payload.skill) * 10) / 10;
  const marking = Math.round(Number(payload.marking ?? 3) * 10) / 10;
  const positions = new Set(["Defesa", "Meio-campo", "Ataque", "Goleiro"]);

  if (!displayName || !positions.has(payload.primaryPosition) || speed < 1 || speed > 5 || skill < 1 || skill > 5 || marking < 1 || marking > 5) {
    return Response.json({ error: "Informe nome, posição, velocidade, habilidade e marcação entre 1 e 5." }, { status: 400 });
  }

  const rows = await db().prepare("SELECT * FROM players WHERE deleted_at IS NULL AND active=1").all();
  const normalized = normalizeName(displayName);
  const existing = rows.results.find((row: any) => {
    const names = [row.display_name, row.full_name, row.nickname, ...JSON.parse(row.aliases || "[]")];
    return names.some((name) => name && normalizeName(name) === normalized);
  });
  if (existing) return Response.json({ player: map(existing), reused: true });

  const id = crypto.randomUUID(), now = new Date().toISOString();
  await db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,photo_url,active,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, String(payload.fullName || displayName).trim(), displayName, String(payload.nickname || "").trim() || null, "[]", payload.primaryPosition === "Goleiro" ? "goalkeeper" : "guest", payload.primaryPosition, speed, skill, marking, null, 1, String(payload.notes || "").trim() || null, now, now).run();
  const created = await db().prepare("SELECT * FROM players WHERE id=?").bind(id).first();
  await audit(admin.id, "CREATE", "player", id, { displayName, type: "guest", primaryPosition: payload.primaryPosition, speed, skill, marking });
  return Response.json({ player: map(created), reused: false }, { status: 201 });
}
