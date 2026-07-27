"use client";
/* API errors are narrowed at runtime and notification state is synchronized after each request. */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";

type Notice = { id: string; type: string; title: string; body: string; matchId?: string | null; readAt?: string | null; createdAt: string };
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options), payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || "Não foi possível carregar as notificações."), { status: response.status });
  return payload;
}

export default function NotificationsApp() {
  const [items, setItems] = useState<Notice[]>([]), [unread, setUnread] = useState(0), [loading, setLoading] = useState(true), [unauthorized, setUnauthorized] = useState(false), [error, setError] = useState(""), [isAdmin, setIsAdmin] = useState(false);
  async function load() {
    try {
      const [data, authPayload] = await Promise.all([api("/api/notifications"), api("/api/member-auth")]);
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
      setIsAdmin(authPayload.member?.accountType === "administrator");
    }
    catch (cause: any) { if (cause.status === 401) setUnauthorized(true); else setError(cause.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function read(item?: Notice) {
    await api("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(item ? { id: item.id } : { all: true }) });
    if (item?.matchId) window.location.assign(`/partidas#${encodeURIComponent(item.matchId)}`); else await load();
  }
  return <div className="member-page"><SiteHeader active="notifications" isAdmin={isAdmin}/><main className="member-main notification-site-main"><div className="member-account-head"><div><div className="eyebrow">ATUALIZAÇÕES DA PELADA</div><h1>Notificações</h1><p>{unread ? `${unread} não lida${unread === 1 ? "" : "s"}` : "Tudo em dia"}</p></div>{unread > 0 && <button className="ghost" onClick={() => read()}>Marcar todas como lidas</button>}</div>{loading ? <div className="member-loading">Carregando…</div> : unauthorized ? <div className="alert">Entre na sua conta para consultar as notificações. <a href="/conta?returnTo=/notificacoes">Entrar</a></div> : error ? <div className="alert error">{error}</div> : <div className="notification-site-list">{items.length ? items.map(item => <button key={item.id} className={item.readAt ? "notification-site-item" : "notification-site-item unread"} onClick={() => read(item)}><span>{noticeIcon(item.type)}</span><div><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small></div>{item.matchId && <i>›</i>}</button>) : <div className="empty">Nenhuma notificação ainda.</div>}</div>}</main></div>;
}
function noticeIcon(type: string) { return type === "MATCH_CREATED" ? "📅" : type === "ATTENDANCE_CHANGED" ? "✅" : type === "MATCH_CANCELLED" ? "🚫" : "📣"; }
