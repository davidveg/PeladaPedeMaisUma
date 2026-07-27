"use client";

import Link from "next/link";

type SiteSection = "home" | "players" | "separations" | "matches" | "notifications" | "account" | "admin";

export function SiteHeader({
  active,
  isAdmin = false,
  onLogout,
}: {
  active?: SiteSection;
  isAdmin?: boolean;
  onLogout?: () => void;
}) {
  const link = (section: SiteSection, href: string, label: string) => (
    <Link className={active === section ? "active" : undefined} aria-current={active === section ? "page" : undefined} href={href}>
      {label}
    </Link>
  );

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark">⚽</span>
        <span><b>Pelada</b><small>Pede Mais Uma</small></span>
      </Link>
      <nav aria-label="Navegação principal">
        {link("home", "/", isAdmin ? "Montar times" : "Início")}
        {link("players", "/jogadores", "Jogadores")}
        {link("separations", "/separacoes-salvas", isAdmin ? "Separações salvas" : "Últimas separações")}
        {link("matches", "/partidas", "Partidas")}
        {link("notifications", "/notificacoes", "Notificações")}
        {link("account", "/conta", "Minha conta")}
        {link("admin", "/admin", isAdmin ? "Painel administrativo" : "Entrar como administrador")}
        {onLogout ? <button type="button" onClick={onLogout}>Sair</button> : null}
      </nav>
    </header>
  );
}
