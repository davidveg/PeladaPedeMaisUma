"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { accountSignInHref, isAccountProtectedPath } from "../../lib/site-navigation";
import { BrandIdentity, useInstanceBranding } from "../InstanceBranding";

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
  const { config } = useInstanceBranding();
  const navigation = useRef<HTMLElement>(null);
  const activeLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const menu = navigation.current;
    const item = activeLink.current;
    if (!menu || !item) return;

    // Centraliza somente o eixo horizontal para não esconder o início das
    // páginas sob o cabeçalho fixo.
    menu.scrollLeft = Math.max(0, item.offsetLeft - (menu.clientWidth - item.offsetWidth) / 2);
  }, [active]);
  const currentSection = active === "separations" || active === "home" ? "matches" : active;
  const link = (section: SiteSection, href: string, label: string) => (
    <a ref={currentSection === section ? activeLink : undefined} className={currentSection === section ? "active" : undefined} aria-current={currentSection === section ? "page" : undefined} href={href} onClick={(event) => navigateWithDocument(event, href)}>
      {label}
    </a>
  );

  return (
    <header className="site-header">
      <a href="/partidas" className="brand" onClick={(event) => navigateWithDocument(event, "/partidas")}>
        <BrandIdentity/>
      </a>
      <nav ref={navigation} aria-label="Navegação principal">
        {link("players", "/jogadores", "Jogadores")}
        {link("statistics", "/estatisticas", "Estatísticas")}
        {link("matches", "/partidas", "Partidas")}
        {config.financeEnabled && link("finance", "/financeiro", "Financeiro")}
        {link("notifications", "/notificacoes", "Notificações")}
        {link("account", "/conta", "Minha conta")}
        {link("admin", "/admin", "Painel Administrativo")}
      </nav>
    </header>
  );
}
