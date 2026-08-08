type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export async function checkServerConnection(baseUrl: string, fetcher: Fetcher = fetch, timeoutMs = 10_000) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/$/, "");
  if (!normalizedBaseUrl) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`${normalizedBaseUrl}/api/health`, {
      method: "GET",
      headers: { accept: "application/json", "cache-control": "no-cache" },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null) as { status?: string } | null;
    return payload?.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
