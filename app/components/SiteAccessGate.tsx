"use client";

import { useEffect, useState, type PropsWithChildren } from "react";
import { accountSignInHref, isPublicSitePath } from "../../lib/site-navigation";

type AccessState = "checking" | "allowed" | "failed";

export function SiteAccessGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<AccessState>("checking");

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

    void validate();
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
  }, []);

  if (state === "checking") return <div className="member-loading">Verificando seu acesso…</div>;
  if (state === "failed") return <div className="member-loading site-access-failed"><span>Não foi possível validar seu acesso.</span><button className="primary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div>;
  return children;
}
