import { staffRequired, audit, db, ensureDb } from "../../../lib/database";
import { normalizeName } from "../../../lib/football";
import { ensureCareerSeasonCurrent } from "../../../lib/career-season";
import { isPlayerType, playerTypeValidationError } from "../../../lib/player-types";

const map = (row: any) => ({
  ...row,
  fullName: row.full_name,
  displayName: row.display_name,
  primaryPosition: row.primary_position,
  photoUrl: row.photo_url,
  marking: Number(row.marking ?? 3),
  tacticalIntelligence: Number(row.tactical_intelligence ?? 3),
  competitiveness: Number(row.competitiveness ?? 3),
  goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.speed ?? 3),
  goalExit: Number(row.goal_exit ?? row.marking ?? 3),
  goalkeeperSafety: Number(row.goalkeeper_safety ?? 3),
  goalkeeperLeadership: Number(row.goalkeeper_leadership ?? 3),
  momentum: Number(row.momentum ?? 0),
  resultMomentum: Number(row.result_momentum ?? 0),
  votingMomentum: Number(row.voting_momentum ?? 0),
  aliases: JSON.parse(row.aliases || "[]"),
  active: Boolean(row.active),
});

export async function POST(request: Request) {
  const admin: any = await staffRequired(request,"SEPARATIONS_MANAGE");
  if (!admin) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  await ensureCareerSeasonCurrent();
  const payload = await request.json() as any;
  const displayName = String(payload.displayName || "").trim();
  const speed = Math.round(Number(payload.speed) * 10) / 10;
  const skill = Math.round(Number(payload.skill) * 10) / 10;
  const marking = Math.round(Number(payload.marking ?? 3) * 10) / 10;
  const tacticalIntelligence = Math.round(Number(payload.tacticalIntelligence ?? 3) * 10) / 10;
  const competitiveness = Math.round(Number(payload.competitiveness ?? 3) * 10) / 10;
  const goalkeeperPositioning = Math.round(Number(payload.goalkeeperPositioning ?? payload.speed ?? 3) * 10) / 10;
  const goalExit = Math.round(Number(payload.goalExit ?? payload.marking ?? 3) * 10) / 10;
  const goalkeeperSafety = Math.round(Number(payload.goalkeeperSafety ?? 3) * 10) / 10;
  const goalkeeperLeadership = Math.round(Number(payload.goalkeeperLeadership ?? 3) * 10) / 10;
  const positions = new Set(["Defesa", "Meio-campo", "Ataque", "Goleiro"]);
  const playerType = isPlayerType(payload.type) ? payload.type : payload.primaryPosition === "Goleiro" ? "goalkeeper" : "guest";

  if (!displayName || !positions.has(payload.primaryPosition) || [speed,skill,marking,tacticalIntelligence,competitiveness,goalkeeperPositioning,goalExit,goalkeeperSafety,goalkeeperLeadership].some(value=>!Number.isFinite(value)||value<1||value>5)) {
    return Response.json({ error: "Informe nome, posição e todos os atributos entre 1 e 5." }, { status: 400 });
  }
  const typeError = playerTypeValidationError(playerType, payload.primaryPosition);
  if (typeError) return Response.json({ error: typeError }, { status: 400 });

  const rows = await db().prepare("SELECT * FROM players WHERE deleted_at IS NULL AND active=1").all();
  const normalized = normalizeName(displayName);
  const existing = rows.results.find((row: any) => {
    const names = [row.display_name, row.full_name, row.nickname, ...JSON.parse(row.aliases || "[]")];
    return names.some((name) => name && normalizeName(name) === normalized);
  });
  if (existing) return Response.json({ player: map(existing), reused: true });

  const id = crypto.randomUUID(), now = new Date().toISOString();
  await db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,tactical_intelligence,competitiveness,goalkeeper_positioning,goal_exit,goalkeeper_safety,goalkeeper_leadership,photo_url,active,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, String(payload.fullName || displayName).trim(), displayName, String(payload.nickname || "").trim() || null, "[]", playerType, payload.primaryPosition, speed, skill, marking, tacticalIntelligence, competitiveness, goalkeeperPositioning, goalExit, goalkeeperSafety, goalkeeperLeadership, null, 1, String(payload.notes || "").trim() || null, now, now).run();
  const created = await db().prepare("SELECT * FROM players WHERE id=?").bind(id).first();
  await audit(admin.id, "CREATE", "player", id, { displayName, type: playerType, primaryPosition: payload.primaryPosition, speed, skill, marking, tacticalIntelligence, competitiveness, goalkeeperPositioning, goalExit, goalkeeperSafety, goalkeeperLeadership });
  return Response.json({ player: map(created), reused: false }, { status: 201 });
}
