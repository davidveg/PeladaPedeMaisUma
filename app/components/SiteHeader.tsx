"use client";

import type { MouseEvent } from "react";
import { accountSignInHref, isAccountProtectedPath } from "../../lib/site-navigation";

type SiteSection = "home" | "players" | "separations" | "matches" | "notifications" | "account" | "admin";

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
  isAdmin = false,
}: {
  active?: SiteSection;
  isAdmin?: boolean;
}) {
  const link = (section: SiteSection, href: string, label: string) => (
    <a className={active === section ? "active" : undefined} aria-current={active === section ? "page" : undefined} href={href} onClick={(event) => navigateWithDocument(event, href)}>
      {label}
    </a>
  );

  return (
    <header className="site-header">
      <a href="/" className="brand" onClick={(event) => navigateWithDocument(event, "/")}>
        <span className="brand-mark">⚽</span>
        <span><b>Pelada</b><small>Pede Mais Uma</small></span>
      </a>
      <nav aria-label="Navegação principal">
        {link("home", "/", isAdmin ? "Montar times" : "Início")}
        {link("players", "/jogadores", "Jogadores")}
        {link("separations", "/separacoes-salvas", isAdmin ? "Separações salvas" : "Últimas separações")}
        {link("matches", "/partidas", "Partidas")}
        {link("notifications", "/notificacoes", "Notificações")}
        {link("account", "/conta", "Minha conta")}
        {link("admin", "/admin", isAdmin ? "Painel administrativo" : "Entrar como administrador")}
      </nav>
    </header>
  );
}
