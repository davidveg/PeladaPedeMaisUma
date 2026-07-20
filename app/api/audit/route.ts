import { adminRequired, db, ensureDb } from "../../../lib/database";

function parseJson(value: unknown) {
  if (!value || typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}

export async function GET(request: Request) {
  const admin = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  const parameters = new URL(request.url).searchParams;
  const requestedPage = Math.max(1, Number.parseInt(parameters.get("page") || "1", 10) || 1);
  const requestedPageSize = Number.parseInt(parameters.get("pageSize") || "10", 10) || 10;
  const pageSize = [10, 25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 10;
  const query = String(parameters.get("q") || "").trim().slice(0, 100).toLowerCase();
  const action = String(parameters.get("action") || "ALL").trim().slice(0, 50);
  const search = `%${query}%`;
  const filters = `
    WHERE (? = '' OR LOWER(COALESCE(a.email, 'Ação pública') || ' ' || l.action || ' ' || l.entity_type || ' ' || COALESCE(l.entity_id, '') || ' ' || COALESCE(l.previous_data, '') || ' ' || COALESCE(l.new_data, '')) LIKE ?)
      AND (? = 'ALL' OR l.action = ?)
  `;
  const count = await db().prepare(`SELECT COUNT(*) AS total FROM audit_logs l LEFT JOIN administrators a ON a.id = l.administrator_id ${filters}`).bind(query, search, action, action).first<any>();
  const total = Number(count?.total || 0), totalPages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(requestedPage, totalPages), offset = (page - 1) * pageSize;
  const [rows, actionRows] = await Promise.all([
    db().prepare(`
    SELECT l.id, l.administrator_id, l.action, l.entity_type, l.entity_id,
           l.previous_data, l.new_data, l.created_at, a.email AS administrator_email
    FROM audit_logs l
    LEFT JOIN administrators a ON a.id = l.administrator_id
    ${filters}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(query, search, action, action, pageSize, offset).all(),
    db().prepare(`SELECT DISTINCT action FROM audit_logs ORDER BY action`).all(),
  ]);
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
    actions: actionRows.results.map((row: any) => row.action),
    pagination: { page, pageSize, total, totalPages },
  });
}
