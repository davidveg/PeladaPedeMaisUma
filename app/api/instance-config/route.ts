import { adminRequired as fullAdminRequired, audit, currentStaff, db, ensureDb } from "../../../lib/database";
import {
  INSTANCE_CONFIGURATION_COLUMNS,
  instanceConfigurationFromRow,
  instanceConfigurationValues,
  validateInstanceConfiguration,
} from "../../../lib/instance-config";
import { finalizeUploadAttachment, validateUploadAttachment } from "../../../lib/upload-lifecycle";
const adminRequired=async(request:Request)=>{
  if(request.method!=="GET")return fullAdminRequired(request);
  const staff:any=await currentStaff(request);
  return staff?.accountType==="administrator"&&staff.mustChangePassword?null:staff;
};

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
  const brandingFields = ["logoUrl", "faviconUrl", "shareImageUrl"] as const;
  const attachments = new Map<typeof brandingFields[number], Awaited<ReturnType<typeof validateUploadAttachment>>["reference"]>();
  for (const field of brandingFields) {
    const nextValue = validation.config[field], previousValue = previous[field];
    if (nextValue === previousValue || !String(nextValue || "").startsWith("/api/upload")) continue;
    const attachment = await validateUploadAttachment(nextValue, "branding", { accountType: "administrator", accountId: String(admin.id) }, "instance_configuration", field);
    if (!attachment.reference) return Response.json({ error: attachment.error }, { status: 400 });
    attachments.set(field, attachment.reference);
  }
  const now = new Date().toISOString();
  const assignments = INSTANCE_CONFIGURATION_COLUMNS.map((column) => `${column}=?`).join(",");
  await db().prepare(`UPDATE instance_configuration SET ${assignments},updated_at=? WHERE id=1`)
    .bind(...instanceConfigurationValues(validation.config), now).run();
  for (const field of brandingFields) {
    if (validation.config[field] !== previous[field]) await finalizeUploadAttachment(attachments.get(field), previous[field]);
  }
  const next = { ...validation.config, updatedAt: now };
  await audit(String(admin.id), "UPDATE_INSTANCE_CONFIGURATION", "instance_configuration", "1", next, previous);
  return Response.json({ ok: true, config: next, message: "Configurações da instância atualizadas." });
}
