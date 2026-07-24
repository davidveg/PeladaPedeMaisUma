import { sessionStore } from "./session-store";
import type { Session } from "./types";

export const API_BASE_URL = String(process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
let refreshPromise: Promise<Session | null> | null = null, expiredHandler: (() => void) | null = null;

export class ApiError extends Error {
  constructor(message: string, public status = 0, public kind: "network" | "server" | "validation" | "auth" = "server") { super(message); }
}

export const onSessionExpired = (handler: () => void) => { expiredHandler = handler; return () => { if (expiredHandler === handler) expiredHandler = null; }; };

export async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  if (!API_BASE_URL) throw new ApiError("Configure EXPO_PUBLIC_API_BASE_URL.", 0, "server");
  const session = await sessionStore.get(), headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (session?.accessToken) headers.set("authorization", `Bearer ${session.accessToken}`);
  let response: Response;
  try { response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers }); }
  catch { throw new ApiError("Sem conexão com o servidor.", 0, "network"); }
  if (response.status === 401 && retry && !path.startsWith("/api/mobile/auth")) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch<T>(path, options, false);
    expiredHandler?.();
    throw new ApiError("Sua sessão expirou. Entre novamente.", 401, "auth");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || (response.status >= 500 ? "Servidor indisponível." : "Não foi possível concluir a ação."), response.status, response.status === 401 ? "auth" : response.status >= 500 ? "server" : "validation");
  return payload as T;
}

export async function login(email: string, password: string, deviceName: string) {
  const session = await apiFetch<Session>("/api/mobile/auth", { method: "POST", body: JSON.stringify({ email, password, deviceName }) }, false);
  await sessionStore.set(session); return session;
}

export async function refreshSession() {
  if (!refreshPromise) refreshPromise = (async () => {
    const current = await sessionStore.get(); if (!current?.refreshToken) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/auth`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: current.refreshToken }) });
      const next = await response.json(); if (!response.ok) throw new Error();
      await sessionStore.set(next); return next as Session;
    } catch { await sessionStore.clear(); return null; }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function logout() {
  const session = await sessionStore.get();
  try { await apiFetch("/api/mobile/notifications", { method: "DELETE" }, false); } catch { /* O logout continua mesmo sem remover o token remoto. */ }
  try { await apiFetch("/api/mobile/auth", { method: "DELETE", body: JSON.stringify({ refreshToken: session?.refreshToken }) }, false); } catch { /* A limpeza local sempre acontece. */ }
  await sessionStore.clear();
}

export const jsonMutation = (method: string, body: unknown, idempotencyKey?: string): RequestInit => ({ method, headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined, body: JSON.stringify(body) });
