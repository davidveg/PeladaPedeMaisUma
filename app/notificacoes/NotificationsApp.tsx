"use client";
/* API errors are narrowed at runtime and notification state is synchronized after each request. */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";

type Notice = { id: string; type: string; title: string; body: string; matchId?: string | null; actionUrl?: string | null; readAt?: string | null; createdAt: string };
type PageData = {
  unread: number; total: number; page: number; pageSize: number; totalPages: number;
  hasPrevious: boolean; hasNext: boolean; notifications: Notice[];
};

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options), payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || "Não foi possível carregar as notificações."), { status: response.status });
  return payload;
}

export default function NotificationsApp() {
  const [data, setData] = useState<PageData>({ unread: 0, total: 0, page: 1, pageSize: 10, totalPages: 1, hasPrevious: false, hasNext: false, notifications: [] });
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true), [unauthorized, setUnauthorized] = useState(false), [error, setError] = useState(""), [isAdmin, setIsAdmin] = useState(false);

  async function load(targetPage = page, targetPageSize = pageSize) {
    setLoading(true); setError("");
    try {
      const parameters = new URLSearchParams({ page: String(targetPage) });
      if (targetPageSize) parameters.set("pageSize", String(targetPageSize));
      const [payload, authPayload] = await Promise.all([api(`/api/notifications?${parameters}`), api("/api/member-auth")]);
      setData(payload);
      setPage(payload.page);
      setPageSize(payload.pageSize);
      setIsAdmin(authPayload.member?.accountType === "administrator");
    } catch (cause: any) {
      if (cause.status === 401) setUnauthorized(true); else setError(cause.message);
    } finally { setLoading(false); }
  }

  // The request is intentionally refreshed only when pagination inputs change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(page, pageSize); }, [page, pageSize]);

  async function read(item?: Notice) {
    await api("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(item ? { id: item.id } : { all: true }) });
    if (item?.actionUrl) window.location.assign(item.actionUrl);
    else if (item?.matchId) window.location.assign(`/partidas#${encodeURIComponent(item.matchId)}`);
    else await load();
  }

  const first = data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = Math.min(data.total, data.page * data.pageSize);
  return <div className="member-page"><SiteHeader active="notifications" isAdmin={isAdmin}/><main className="member-main notification-site-main">
    <div className="member-account-head"><div><div className="eyebrow">ATUALIZAÇÕES DA PELADA</div><h1>Notificações</h1><p>{data.unread ? `${data.unread} não lida${data.unread === 1 ? "" : "s"}` : "Tudo em dia"}</p></div>{data.unread > 0 && <button className="ghost" onClick={() => read()}>Marcar todas como lidas</button>}</div>
    {loading && !data.notifications.length ? <div className="member-loading">Carregando…</div> : unauthorized ? <div className="alert">Entre na sua conta para consultar as notificações. <a href="/conta?returnTo=/notificacoes">Entrar</a></div> : error ? <div className="alert error">{error}</div> : <>
      <div className="notification-site-toolbar"><span>{first}–{last} de {data.total}</span><label>Por página<select value={pageSize || data.pageSize} onChange={event => { setPage(1); setPageSize(Number(event.target.value)); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label></div>
      <div className="notification-site-list">{data.notifications.length ? data.notifications.map(item => <button key={item.id} className={item.readAt ? "notification-site-item" : "notification-site-item unread"} onClick={() => read(item)}><span>{noticeIcon(item.type)}</span><div><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small></div>{(item.matchId || item.actionUrl) && <i>›</i>}</button>) : <div className="empty">Nenhuma notificação ainda.</div>}</div>
      {data.totalPages > 1 && <nav className="notification-pagination" aria-label="Paginação das notificações"><button className="ghost" disabled={!data.hasPrevious || loading} onClick={() => setPage(current => current - 1)}>← Anterior</button><span>Página {data.page} de {data.totalPages}</span><button className="ghost" disabled={!data.hasNext || loading} onClick={() => setPage(current => current + 1)}>Próxima →</button></nav>}
    </>}
  </main></div>;
}

function noticeIcon(type: string) { return type === "APP_RELEASED" ? "⬆️" : type === "MATCH_CREATED" ? "📅" : type === "ATTENDANCE_CHANGED" ? "✅" : type === "MATCH_CANCELLED" ? "🚫" : "📣"; }
