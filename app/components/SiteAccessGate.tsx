"use client";

import { useEffect, useState, type CSSProperties, type PropsWithChildren } from "react";
import { accountSignInHref, isPublicSitePath } from "../../lib/site-navigation";
import { useInstanceBranding } from "../InstanceBranding";

type AccessState = "checking" | "allowed" | "failed";

export function SiteAccessGate({ children, authenticated = false }: PropsWithChildren<{ authenticated?: boolean }>) {
  const { config } = useInstanceBranding();
  const [state, setState] = useState<AccessState>(authenticated ? "allowed" : "checking");
  const accessScreenStyle = {
    "--access-background": config.managementBackgroundColor,
    "--access-surface": config.managementSurfaceColor,
    "--access-text": config.managementTextColor,
    "--access-muted": config.managementMutedColor,
    "--access-accent": config.managementButtonColor,
    "--access-button-text": config.managementButtonTextColor,
  } as CSSProperties;

  useEffect(() => {
    let active = true;
    const pathname = window.location.pathname;
    if (isPublicSitePath(pathname)) {
      setState("allowed");
      return () => { active = false; };
    }

    const validate = async () => {
      try {
        const response = await fetch("/api/member-auth", { cache: "no-store", headers: { accept: "application/json" } });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok && payload.member) {
          setState("allowed");
          return;
        }
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.replace(accountSignInHref(returnTo, response.headers.get("x-session-expired") === "1"));
      } catch {
        if (active) setState("failed");
      }
    };

    if (!authenticated) void validate();
    const timer = window.setInterval(validate, 60_000);
    const revalidate = () => { if (document.visibilityState === "visible") void validate(); };
    window.addEventListener("focus", validate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", validate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [authenticated]);

  if (state === "checking") return <div className="site-access-screen" style={accessScreenStyle} role="status" aria-live="polite">
    <div className="site-access-football" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <circle className="site-access-football-outline" cx="100" cy="100" r="96"/>
        <g className="site-access-football-panels">
          <path d="M100 68 124 85 115 113 85 113 76 85Z"/>
          <path d="M85 26 115 26 125 45 100 61 75 45Z"/>
          <path d="M163 64 181 86 171 111 146 104 145 78Z"/>
          <path d="M152 139 149 169 125 185 104 166 119 136Z"/>
          <path d="M81 136 96 166 75 185 51 169 48 139Z"/>
          <path d="M55 78 54 104 29 111 19 86 37 64Z"/>
        </g>
        <g className="site-access-football-seams">
          <path d="M100 68V61M124 85l21-7M115 113l4 23M85 113l-4 23M76 85l-21-7"/>
          <path d="M75 45 37 64M125 45l38 19M171 111l-19 28M48 139l-19-28M75 185h50"/>
        </g>
      </svg>
    </div>
    <div className="site-access-loading" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/></div>
    <div className="site-access-loading-copy"><strong>Verificando seu acesso…</strong><small>Preparando {config.siteShortName}</small></div>
  </div>;
  if (state === "failed") return <div className="site-access-screen site-access-failed" style={accessScreenStyle}><span>Não foi possível validar seu acesso.</span><button className="primary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div>;
  return children;
}
