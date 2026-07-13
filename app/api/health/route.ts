import { db, ensureDb } from "../../../lib/database";
import { getRuntimeBindings } from "../../../lib/runtime-bindings";

export async function GET() {
  try {
    await ensureDb();
    await db().prepare("SELECT 1 AS ok").first();
    return Response.json({ status: "ok", checks: { database: "ok", smtpConfigured: Boolean(getRuntimeBindings().MAILER?.configured) } });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}
