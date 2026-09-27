import { getRuntimeBindings } from "../../../lib/runtime-bindings";
import { resolvePublicBaseUrl } from "../../../lib/public-url";
import { db, ensureDb } from "../../../lib/database";
import { instanceConfigurationFromRow } from "../../../lib/instance-config";
import { ensureCareerSeasonCurrent } from "../../../lib/career-season";
import type { PublicCareerSeason } from "../../../lib/career";

export async function GET(request: Request) {
  let configuredUrl: string | undefined;
  try {
    configuredUrl = getRuntimeBindings().APP_BASE_URL;
  } catch {
    // Durante a inicialização local, usamos a origem da própria requisição.
  }

  await ensureDb();
  await ensureCareerSeasonCurrent();
  const [instanceRow, seasonRow] = await Promise.all([
    db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first(),
    db().prepare(`SELECT enabled,season_number,season_duration_months,season_started_at,next_season_reset_at FROM career_configuration WHERE id=1`).first(),
  ]);
  const instance = instanceConfigurationFromRow(instanceRow);
  const rawSeason = seasonRow as Record<string, unknown> | null;
  const season: PublicCareerSeason = {
    enabled: Boolean(rawSeason?.enabled),
    seasonNumber: Number(rawSeason?.season_number || 1),
    durationMonths: Number(rawSeason?.season_duration_months || 12),
    startedAt: String(rawSeason?.season_started_at || ""),
    nextResetAt: String(rawSeason?.next_season_reset_at || ""),
  };
  return Response.json(
    { baseUrl: resolvePublicBaseUrl(request, configuredUrl), instance, season },
    { headers: { "cache-control": "no-store" } },
  );
}
