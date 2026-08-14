import { adminRequired as fullAdminRequired, audit, currentStaff, db, ensureDb } from "../../../lib/database";
import {
  INSTANCE_CONFIGURATION_COLUMNS,
  instanceConfigurationFromRow,
  instanceConfigurationValues,
  validateInstanceConfiguration,
} from "../../../lib/instance-config";
const adminRequired=(request:Request)=>request.method==="GET"?currentStaff(request):fullAdminRequired(request);

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();
  const row = await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first();
  return Response.json({ config: instanceConfigurationFromRow(row) }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const admin = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();
  const validation = validateInstanceConfiguration(await request.json().catch(() => ({})));
  if (!validation.config) return Response.json({ error: validation.error }, { status: 400 });

  const previousRow = await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first();
  const previous = instanceConfigurationFromRow(previousRow);
  const now = new Date().toISOString();
  const assignments = INSTANCE_CONFIGURATION_COLUMNS.map((column) => `${column}=?`).join(",");
  await db().prepare(`UPDATE instance_configuration SET ${assignments},updated_at=? WHERE id=1`)
    .bind(...instanceConfigurationValues(validation.config), now).run();
  const next = { ...validation.config, updatedAt: now };
  await audit(String(admin.id), "UPDATE_INSTANCE_CONFIGURATION", "instance_configuration", "1", next, previous);
  return Response.json({ ok: true, config: next, message: "Configurações da instância atualizadas." });
}
