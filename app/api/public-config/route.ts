import { getRuntimeBindings } from "../../../lib/runtime-bindings";
import { resolvePublicBaseUrl } from "../../../lib/public-url";
import { db, ensureDb } from "../../../lib/database";
import { instanceConfigurationFromRow } from "../../../lib/instance-config";

export async function GET(request: Request) {
  let configuredUrl: string | undefined;
  try {
    configuredUrl = getRuntimeBindings().APP_BASE_URL;
  } catch {
    // Durante a inicialização local, usamos a origem da própria requisição.
  }

  await ensureDb();
  const instance = instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
  return Response.json(
    { baseUrl: resolvePublicBaseUrl(request, configuredUrl), instance },
    { headers: { "cache-control": "no-store" } },
  );
}
