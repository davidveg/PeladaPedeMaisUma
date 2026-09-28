"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { accountSignInHref, isAccountProtectedPath } from "../../lib/site-navigation";
import { BrandIdentity, useInstanceBranding } from "../InstanceBranding";
import { NotificationBell } from "./NotificationBell";
import { careerSeasonProgress } from "../../lib/career";

type SiteSection = "home" | "players" | "statistics" | "separations" | "matches" | "finance" | "notifications" | "account" | "admin";

async function navigateWithDocument(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (isAccountProtectedPath(href)) {
    try {
      const response = await fetch("/api/member-auth", { cache: "no-store", headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!payload.member) {
        window.location.assign(accountSignInHref(href, true));
        return;
      }
    } catch {
      // The destination also validates the session and remains the safe fallback.
    }
  }
  window.location.assign(href);
}

export function SiteHeader({
  active,
}: {
  active?: SiteSection;
  isAdmin?: boolean;
}) {
  const { config, season } = useInstanceBranding();
  const [viewerEmail, setViewerEmail] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const navigation = useRef<HTMLElement>(null);
  const activeLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const menu = navigation.current;
    const item = activeLink.current;
    if (!menu || !item || window.innerWidth > 900) return;

    // Centraliza somente o eixo horizontal para não esconder o início das
    // páginas sob o cabeçalho fixo.
    menu.scrollLeft = Math.max(0, item.offsetLeft - (menu.clientWidth - item.offsetWidth) / 2);
  }, [active]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/member-auth", { cache: "no-store", headers: { accept: "application/json" }, signal: controller.signal })
      .then(response => response.json())
      .then(payload => setViewerEmail(String(payload.member?.email || "")))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let active = true;
    const refreshUnread = async () => {
      try {
        const response = await fetch("/api/notifications?pageSize=10", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (active) setUnreadNotifications(Math.max(0, Number(payload.unread) || 0));
      } catch {
        // Sem sessão, o sino continua disponível sem contador.
      }
    };
    void refreshUnread();
    const timer = window.setInterval(refreshUnread, 60000);
    window.addEventListener("focus", refreshUnread);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshUnread);
    };
  }, []);
  const currentSection = active === "separations" || active === "home" ? "matches" : active;
  const viewerInitials = useMemo(() => {
    if (!viewerEmail) return "P+";
    const name = viewerEmail.split("@")[0].split(/[._-]+/).filter(Boolean);
    return (name.length > 1 ? `${name[0][0]}${name.at(-1)?.[0] || ""}` : name[0]?.slice(0, 2) || "P+").toUpperCase();
  }, [viewerEmail]);
  const seasonProgress = useMemo(() => season ? careerSeasonProgress(season) : null, [season]);
  const seasonYear = season ? new Date(season.startedAt).getUTCFullYear() : Number.NaN;
  const seasonMonth = useMemo(() => {
    if (!season || !seasonProgress) return "";
    const date = new Date(season.startedAt);
    if (!Number.isFinite(date.getTime())) return "";
    date.setUTCMonth(date.getUTCMonth() + seasonProgress.currentMonth - 1);
    return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(date);
  }, [season, seasonProgress]);
  const navigationIcons: Partial<Record<SiteSection, string>> = { matches: "▦", players: "♙", statistics: "⌁", finance: "▤", account: "◎", admin: "⚙" };
  const link = (section: SiteSection, href: string, label: string) => (
    <a ref={currentSection === section ? activeLink : undefined} className={currentSection === section ? "active" : undefined} aria-current={currentSection === section ? "page" : undefined} href={href} onClick={(event) => navigateWithDocument(event, href)}>
      <span className="site-nav-icon" aria-hidden="true">{navigationIcons[section] || "•"}</span><span>{label}</span>
    </a>
  );

  return (
    <header className="site-header">
      <aside className="site-sidebar">
        <a href="/partidas" className="brand" onClick={(event) => navigateWithDocument(event, "/partidas")}>
          <BrandIdentity/>
        </a>
        <nav ref={navigation} aria-label="Navegação principal">
          <span className="site-nav-group">GESTÃO</span>
          {link("matches", "/partidas", "Partidas")}
          {link("players", "/jogadores", "Jogadores")}
          {link("statistics", "/estatisticas", "Estatísticas")}
          <span className="site-nav-group">OPERAÇÃO</span>
          {config.financeEnabled && link("finance", "/financeiro", "Financeiro")}
          {link("account", "/conta", "Minha conta")}
          {link("admin", "/admin", "Painel Administrativo")}
        </nav>
        {season && seasonMonth && <div className="site-season-card">
          <small>TEMPORADA {Number.isFinite(seasonYear) ? seasonYear : season.seasonNumber}</small>
          <strong>{seasonMonth}</strong>
          <div className="site-season-progress" role="progressbar" aria-label={`Andamento da temporada: mês ${seasonProgress?.currentMonth} de ${seasonProgress?.totalMonths}`} aria-valuemin={1} aria-valuemax={seasonProgress?.totalMonths} aria-valuenow={seasonProgress?.currentMonth}>
            <span style={{ width: `${seasonProgress?.percentage ?? 0}%` }}/>
          </div>
        </div>}
      </aside>
      <div className="site-topbar">
        <div><small>Centro de gestão</small><strong>{config.siteName}</strong></div>
        <div className="site-topbar-actions">
          <NotificationBell unread={unreadNotifications} onClick={(event) => navigateWithDocument(event, "/notificacoes")}/>
          <a className="site-viewer" href="/conta" aria-label="Abrir minha conta" onClick={(event) => navigateWithDocument(event, "/conta")}>{viewerInitials}</a>
        </div>
      </div>
    </header>
  );
}
