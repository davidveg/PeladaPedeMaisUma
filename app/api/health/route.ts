import { db, ensureDb } from "../../../lib/database";

export async function GET() {
  try {
    await ensureDb();
    await db().prepare("SELECT 1 AS ok").first();
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}
