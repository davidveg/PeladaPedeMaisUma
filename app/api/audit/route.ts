import { adminRequired, db, ensureDb } from "../../../lib/database";

function parseJson(value: unknown) {
  if (!value || typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}

export async function GET(request: Request) {
  const admin = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  const rows = await db().prepare(`
    SELECT l.id, l.administrator_id, l.action, l.entity_type, l.entity_id,
           l.previous_data, l.new_data, l.created_at, a.email AS administrator_email
    FROM audit_logs l
    LEFT JOIN administrators a ON a.id = l.administrator_id
    ORDER BY l.created_at DESC
    LIMIT 300
  `).all();
  return Response.json({
    logs: rows.results.map((row: any) => ({
      id: row.id,
      administratorId: row.administrator_id,
      administratorEmail: row.administrator_email || "Ação pública",
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      previousData: parseJson(row.previous_data),
      newData: parseJson(row.new_data),
      createdAt: row.created_at,
    })),
  });
}
