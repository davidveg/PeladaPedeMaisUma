/* D1 and untrusted JSON payloads are narrowed explicitly at each use. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminRequired, audit, db, ensureDb } from "../../../../lib/database";

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();
  const row: any = await db().prepare(`SELECT speed_weight,skill_weight,marking_weight,updated_at FROM system_configuration WHERE id=1`).first();
  return Response.json({ speedWeight: Number(row.speed_weight), skillWeight: Number(row.skill_weight), markingWeight: Number(row.marking_weight), updatedAt: row.updated_at }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const payload = await request.json().catch(() => ({})) as any;
  const weights = [Number(payload.speedWeight), Number(payload.skillWeight), Number(payload.markingWeight)];
  if (weights.some(value => !Number.isFinite(value) || value < 0 || value > 1) || Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) > .0001) return Response.json({ error: "Os três pesos devem somar 100%." }, { status: 400 });
  const previous: any = await db().prepare(`SELECT speed_weight speedWeight,skill_weight skillWeight,marking_weight markingWeight FROM system_configuration WHERE id=1`).first(), now = new Date().toISOString();
  await db().prepare(`UPDATE system_configuration SET speed_weight=?,skill_weight=?,marking_weight=?,updated_at=? WHERE id=1`).bind(...weights, now).run();
  const next = { speedWeight: weights[0], skillWeight: weights[1], markingWeight: weights[2], updatedAt: now };
  await audit(admin.id, "MOBILE_UPDATE_WEIGHTS", "configuration", "1", next, previous);
  return Response.json({ ok: true, config: next, message: "Pesos atualizados com sucesso." });
}
