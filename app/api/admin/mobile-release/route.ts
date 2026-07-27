/* Administrative mobile release lifecycle. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { broadcastAccountNotification } from "../../../../lib/account-notifications";
import { adminRequired, audit } from "../../../../lib/database";
import {
  getMobileReleaseConfiguration,
  normalizeMobileRelease,
  saveMobileReleaseConfiguration,
  validateMobileRelease,
  validateMobileReleaseDraft,
} from "../../../../lib/mobile-release";
import { resolvePublicBaseUrl } from "../../../../lib/public-url";
import { getRuntimeBindings } from "../../../../lib/runtime-bindings";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  return Response.json({ release: await getMobileReleaseConfiguration() }, { headers: noStore });
}

export async function PUT(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const current = await getMobileReleaseConfiguration();
  const next = normalizeMobileRelease(await request.json().catch(() => ({})), current);
  const error = validateMobileReleaseDraft(next);
  if (error) return Response.json({ error }, { status: 400, headers: noStore });
  const release = await saveMobileReleaseConfiguration(next, String(admin.id));
  await audit(admin.id, "MOBILE_RELEASE_DRAFT_SAVED", "mobile_release", "1", release, current);
  return Response.json({ release, message: "Configuração da versão salva sem notificar os usuários." }, { headers: noStore });
}

export async function POST(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const current = await getMobileReleaseConfiguration();
  const next = normalizeMobileRelease(await request.json().catch(() => ({})), current);
  const error = validateMobileRelease(next);
  if (error) return Response.json({ error }, { status: 400, headers: noStore });
  const release = await saveMobileReleaseConfiguration(next, String(admin.id), true);
  const origin = resolvePublicBaseUrl(request, getRuntimeBindings().APP_BASE_URL);
  const platforms = [release.androidEnabled && "Android", release.iosEnabled && "iOS"].filter(Boolean).join(" e ");
  const notification = await broadcastAccountNotification({
    type: "APP_RELEASED",
    title: `Nova versão ${release.latestVersion}`,
    body: `A versão ${release.latestVersion} está disponível para ${platforms}. Confira as novidades e atualize o aplicativo.`,
    actionUrl: `${origin}/baixar-app`,
  });
  await audit(admin.id, "MOBILE_RELEASE_PUBLISHED", "mobile_release", "1", { ...release, notification }, current);
  return Response.json({
    release,
    notification,
    message: `Versão ${release.latestVersion} publicada e usuários notificados.`,
  }, { headers: noStore });
}
