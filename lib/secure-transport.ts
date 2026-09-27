import { db, ensureDb } from "./database";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isSecureTransport(request: Request) {
  const url = new URL(request.url);
  if (url.protocol === "https:" || localHosts.has(url.hostname)) return true;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return forwardedProtocol === "https";
}

export function isPrivateNetworkHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (localHosts.has(host)) return true;
  const parts = host.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [first, second] = parts.map(Number);
    return first === 10
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 169 && second === 254);
  }
  return /^(?:fc|fd)[0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
}

export async function isAuthenticationTransportAllowed(request: Request) {
  if (isSecureTransport(request)) return true;
  if (!isPrivateNetworkHost(new URL(request.url).hostname)) return false;
  await ensureDb();
  const enabled = await db().prepare("SELECT allow_insecure_local_network_auth FROM instance_configuration WHERE id=1").first("allow_insecure_local_network_auth");
  return Boolean(enabled);
}

export function sessionCookie(request: Request, name: string, value: string, maxAge: number) {
  const secure = isSecureTransport(request) ? "; Secure" : "";
  return `${name}=${value}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function secureTransportRequiredResponse() {
  return Response.json({ error: "Use HTTPS para autenticar ou habilite o acesso HTTP à rede local no painel administrativo." }, {
    status: 426,
    headers: { "cache-control": "no-store", upgrade: "TLS/1.2" },
  });
}
