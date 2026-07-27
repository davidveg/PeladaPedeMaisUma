/* Shared mobile release configuration for admin, public download and app checks. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb } from "./database";

export type MobilePlatform = "android" | "ios";
export type MobileReleaseConfiguration = {
  latestVersion: string;
  androidBuild: number;
  iosBuild: number;
  minimumAndroidBuild: number;
  minimumIosBuild: number;
  androidEnabled: boolean;
  iosEnabled: boolean;
  androidUrl: string;
  iosUrl: string;
  releaseNotes: string;
  publishedAt: string | null;
  updatedAt: string;
};

export const defaultMobileRelease: MobileReleaseConfiguration = {
  latestVersion: "1.0.0",
  androidBuild: 1,
  iosBuild: 1,
  minimumAndroidBuild: 1,
  minimumIosBuild: 1,
  androidEnabled: false,
  iosEnabled: false,
  androidUrl: "https://web.vegaalameda.com/download/pedemaisuma/android/PeladaPedeMaisUma.apk",
  iosUrl: "",
  releaseNotes: "",
  publishedAt: null,
  updatedAt: new Date(0).toISOString(),
};

export async function getMobileReleaseConfiguration() {
  await ensureDb();
  const row: any = await db().prepare(`SELECT * FROM mobile_release_configuration WHERE id=1`).first();
  return row ? mapMobileRelease(row) : { ...defaultMobileRelease };
}

export function normalizeMobileRelease(input: any, current = defaultMobileRelease): MobileReleaseConfiguration {
  const positiveBuild = (value: unknown, fallback: number) => {
    const parsed = Math.floor(Number(value));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    latestVersion: String(input?.latestVersion ?? current.latestVersion).trim(),
    androidBuild: positiveBuild(input?.androidBuild, current.androidBuild),
    iosBuild: positiveBuild(input?.iosBuild, current.iosBuild),
    minimumAndroidBuild: positiveBuild(input?.minimumAndroidBuild, current.minimumAndroidBuild),
    minimumIosBuild: positiveBuild(input?.minimumIosBuild, current.minimumIosBuild),
    androidEnabled: typeof input?.androidEnabled === "boolean" ? input.androidEnabled : current.androidEnabled,
    iosEnabled: typeof input?.iosEnabled === "boolean" ? input.iosEnabled : current.iosEnabled,
    androidUrl: String(input?.androidUrl ?? current.androidUrl).trim(),
    iosUrl: String(input?.iosUrl ?? current.iosUrl).trim(),
    releaseNotes: String(input?.releaseNotes ?? current.releaseNotes).trim().slice(0, 4000),
    publishedAt: current.publishedAt,
    updatedAt: current.updatedAt,
  };
}

export function validateMobileRelease(value: MobileReleaseConfiguration) {
  const draftError = validateMobileReleaseDraft(value);
  if (draftError) return draftError;
  if (!value.androidEnabled && !value.iosEnabled) return "Ative pelo menos uma plataforma antes de publicar.";
  return "";
}

export function validateMobileReleaseDraft(value: MobileReleaseConfiguration) {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value.latestVersion)) return "Informe a versão no formato 1.2.0.";
  if (value.minimumAndroidBuild > value.androidBuild) return "A build mínima do Android não pode superar a build publicada.";
  if (value.minimumIosBuild > value.iosBuild) return "A build mínima do iOS não pode superar a build publicada.";
  if (value.androidEnabled && !validDownloadUrl(value.androidUrl)) return "Informe uma URL HTTPS válida para o Android.";
  if (value.iosEnabled && !validDownloadUrl(value.iosUrl)) return "Informe uma URL HTTPS válida para o iOS.";
  return "";
}

export async function saveMobileReleaseConfiguration(
  value: MobileReleaseConfiguration,
  administratorId: string,
  publish = false,
) {
  await ensureDb();
  const now = new Date().toISOString();
  await db().prepare(
    `INSERT INTO mobile_release_configuration
     (id,latest_version,android_build,ios_build,minimum_android_build,minimum_ios_build,
      android_enabled,ios_enabled,android_url,ios_url,release_notes,published_at,published_by_administrator_id,updated_at)
     VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
      latest_version=excluded.latest_version,android_build=excluded.android_build,ios_build=excluded.ios_build,
      minimum_android_build=excluded.minimum_android_build,minimum_ios_build=excluded.minimum_ios_build,
      android_enabled=excluded.android_enabled,ios_enabled=excluded.ios_enabled,
      android_url=excluded.android_url,ios_url=excluded.ios_url,release_notes=excluded.release_notes,
      published_at=excluded.published_at,published_by_administrator_id=excluded.published_by_administrator_id,
      updated_at=excluded.updated_at`,
  ).bind(
    value.latestVersion, value.androidBuild, value.iosBuild,
    value.minimumAndroidBuild, value.minimumIosBuild,
    Number(value.androidEnabled), Number(value.iosEnabled),
    value.androidUrl || null, value.iosUrl || null, value.releaseNotes,
    publish ? now : value.publishedAt, administratorId, now,
  ).run();
  return getMobileReleaseConfiguration();
}

export function releaseForPlatform(
  configuration: MobileReleaseConfiguration,
  platform: MobilePlatform,
  origin: string,
) {
  const android = platform === "android";
  return {
    platform,
    enabled: android ? configuration.androidEnabled : configuration.iosEnabled,
    latestVersion: configuration.latestVersion,
    latestBuild: android ? configuration.androidBuild : configuration.iosBuild,
    minimumBuild: android ? configuration.minimumAndroidBuild : configuration.minimumIosBuild,
    downloadUrl: `${origin.replace(/\/$/, "")}/baixar-app?platform=${platform}`,
    directDownloadUrl: android ? configuration.androidUrl : configuration.iosUrl,
    releaseNotes: configuration.releaseNotes,
    publishedAt: configuration.publishedAt,
  };
}

function mapMobileRelease(row: any): MobileReleaseConfiguration {
  return {
    latestVersion: String(row.latest_version || "1.0.0"),
    androidBuild: Number(row.android_build || 1),
    iosBuild: Number(row.ios_build || 1),
    minimumAndroidBuild: Number(row.minimum_android_build || 1),
    minimumIosBuild: Number(row.minimum_ios_build || 1),
    androidEnabled: Boolean(row.android_enabled),
    iosEnabled: Boolean(row.ios_enabled),
    androidUrl: String(row.android_url || ""),
    iosUrl: String(row.ios_url || ""),
    releaseNotes: String(row.release_notes || ""),
    publishedAt: row.published_at ? String(row.published_at) : null,
    updatedAt: String(row.updated_at || new Date(0).toISOString()),
  };
}

function validDownloadUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
