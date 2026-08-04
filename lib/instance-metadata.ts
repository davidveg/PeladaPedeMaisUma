import type { InstanceConfiguration } from "./instance-config";

export function instanceShareImageUrl(config: InstanceConfiguration, baseUrl: string) {
  const source = config.shareImageUrl || config.logoUrl || "/og.png";
  return new URL(source, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

export function instanceFaviconUrl(config: InstanceConfiguration) {
  return config.faviconUrl || config.logoUrl || null;
}
