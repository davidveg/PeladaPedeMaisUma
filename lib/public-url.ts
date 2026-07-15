export function normalizePublicBaseUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function resolvePublicBaseUrl(request: Request, configuredUrl?: string): string {
  const configured = normalizePublicBaseUrl(configuredUrl);
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestUrl = new URL(request.url);
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : requestUrl.protocol.replace(":", "");

  return normalizePublicBaseUrl(host ? `${protocol}://${host}` : requestUrl.origin) || requestUrl.origin;
}
