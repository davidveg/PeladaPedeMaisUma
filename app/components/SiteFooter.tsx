"use client";

import { useEffect, useState } from "react";
import { useInstanceBranding } from "../InstanceBranding";

export function SiteFooter() {
  const { config } = useInstanceBranding();
  const [pathname, setPathname] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  if (!pathname || pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return <footer className="site-footer">
    <div className="footer-signature"><b>⚽ {config.siteName}</b><span>{config.footerText}</span></div>
    <div className="app-downloads" aria-label={`Aplicativos ${config.appName}`}>
      <a className="app-download-badge android" href="/baixar-app?platform=android" aria-label={`Baixar aplicativo ${config.appName} para Android`}>
        <span className="app-platform-icon" aria-hidden="true">APK</span>
        <span><small>BAIXE AGORA</small><b>Aplicativo Android</b></span>
        <i aria-hidden="true">↓</i>
      </a>
      <a className="app-download-badge ios" href="/baixar-app?platform=ios" aria-label={`Baixar aplicativo ${config.appName} para iOS`}>
        <span className="app-platform-icon" aria-hidden="true">iOS</span>
        <span><small>TESTFLIGHT / APP STORE</small><b>Aplicativo para iOS</b></span>
        <i aria-hidden="true">ABRIR</i>
      </a>
    </div>
  </footer>;
}
