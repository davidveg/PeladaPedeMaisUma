const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isSecureTransport(request: Request) {
  const url = new URL(request.url);
  if (url.protocol === "https:" || localHosts.has(url.hostname)) return true;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return forwardedProtocol === "https";
}

export function secureTransportRequiredResponse() {
  return Response.json({ error: "Use HTTPS para autenticar." }, {
    status: 426,
    headers: { "cache-control": "no-store", upgrade: "TLS/1.2" },
  });
}
