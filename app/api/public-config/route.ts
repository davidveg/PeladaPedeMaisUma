import { getRuntimeBindings } from "../../../lib/runtime-bindings";
import { resolvePublicBaseUrl } from "../../../lib/public-url";

export async function GET(request: Request) {
  let configuredUrl: string | undefined;
  try {
    configuredUrl = getRuntimeBindings().APP_BASE_URL;
  } catch {
    // Durante a inicialização local, usamos a origem da própria requisição.
  }

  return Response.json(
    { baseUrl: resolvePublicBaseUrl(request, configuredUrl) },
    { headers: { "cache-control": "no-store" } },
  );
}
