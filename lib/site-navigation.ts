const protectedAccountPaths = new Set(["/partidas", "/notificacoes", "/financeiro"]);

export function isAccountProtectedPath(href: string) {
  return protectedAccountPaths.has(pathname(href));
}

export function accountSignInHref(returnTo: string, sessionExpired = false) {
  const safeReturnTo = safeSiteReturnTo(returnTo) || "/";
  const parameters = new URLSearchParams({ returnTo: safeReturnTo });
  if (sessionExpired) parameters.set("reason", "session-expired");
  return `/conta?${parameters.toString()}`;
}

export function safeSiteReturnTo(value: string | null | undefined) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return "";
  try {
    const parsed = new URL(candidate, "https://pelada.local");
    return parsed.origin === "https://pelada.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "";
  } catch {
    return "";
  }
}

function pathname(href: string) {
  try {
    return new URL(href, "https://pelada.local").pathname;
  } catch {
    return href;
  }
}
