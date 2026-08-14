import { audit, db, ensureDb, staffRequired } from "../../../../lib/database";
const adminRequired=(request:Request)=>staffRequired(request,"BALANCE_CONFIG_MANAGE");

const columns = ["speed_weight", "skill_weight", "marking_weight", "tactical_intelligence_weight", "competitiveness_weight", "goalkeeper_defenses_weight", "goalkeeper_positioning_weight", "goalkeeper_safety_weight", "goalkeeper_footwork_weight", "goalkeeper_leadership_weight"];
const keys = ["speedWeight", "skillWeight", "markingWeight", "tacticalIntelligenceWeight", "competitivenessWeight", "goalkeeperDefensesWeight", "goalkeeperPositioningWeight", "goalkeeperSafetyWeight", "goalkeeperFootworkWeight", "goalkeeperLeadershipWeight"];

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  const row: any = await db().prepare(`SELECT ${columns.join(",")},updated_at FROM system_configuration WHERE id=1`).first();
  return Response.json({ ...Object.fromEntries(keys.map((key, index) => [key, Number(row[columns[index]])])), ratingSystemVersion: 2, updatedAt: row.updated_at }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  const payload = await request.json() as any;
  const weights = keys.map(key => Number(payload[key]));
  if (!valid(weights.slice(0, 5)) || !valid(weights.slice(5))) return Response.json({ error: "Cada grupo de cinco pesos deve somar 100%." }, { status: 400 });
  const previous = await db().prepare(`SELECT ${columns.join(",")} FROM system_configuration WHERE id=1`).first();
  const now = new Date().toISOString();
  await db().prepare(`UPDATE system_configuration SET ${columns.map(column => `${column}=?`).join(",")},updated_at=? WHERE id=1`).bind(...weights, now).run();
  await audit(admin.id, "UPDATE", "configuration", "1", { ...Object.fromEntries(keys.map((key, index) => [key, weights[index]])), source: "mobile" }, previous);
  return Response.json({ ...Object.fromEntries(keys.map((key, index) => [key, weights[index]])), ratingSystemVersion: 2, updatedAt: now });
}

function valid(weights: number[]) { return weights.every(value => Number.isFinite(value) && value >= 0 && value <= 1) && Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) <= .0001; }
