/* Public release metadata used before and after authentication in the mobile app. */
import { getMobileReleaseConfiguration, releaseForPlatform, type MobilePlatform } from "../../../../lib/mobile-release";
import { resolvePublicBaseUrl } from "../../../../lib/public-url";
import { getRuntimeBindings } from "../../../../lib/runtime-bindings";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = String(url.searchParams.get("platform") || "").toLowerCase();
  if (platform !== "android" && platform !== "ios") {
    return Response.json({ error: "Informe a plataforma android ou ios." }, { status: 400, headers: noStore });
  }
  const configuration = await getMobileReleaseConfiguration();
  return Response.json(releaseForPlatform(configuration, platform as MobilePlatform, resolvePublicBaseUrl(request, getRuntimeBindings().APP_BASE_URL)), { headers: noStore });
}
