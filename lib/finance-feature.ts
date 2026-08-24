import { db, ensureDb } from "./database";

export async function isFinanceEnabled() {
  await ensureDb();
  const enabled = await db().prepare("SELECT finance_enabled FROM instance_configuration WHERE id=1").first("finance_enabled");
  return Number(enabled ?? 1) !== 0;
}
