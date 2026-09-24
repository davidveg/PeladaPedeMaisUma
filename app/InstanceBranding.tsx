"use client";

import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type PropsWithChildren, type SyntheticEvent } from "react";
import { DEFAULT_INSTANCE_CONFIGURATION, type InstanceConfiguration } from "../lib/instance-config";
import { fitBrandLogo } from "../lib/brand-logo";
import { colorWithOpacity, contrastTextColor, readableTeamColor } from "../lib/team-colors";

type BrandingContextValue = {
  config: InstanceConfiguration;
  refresh(): Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue>({
  config: DEFAULT_INSTANCE_CONFIGURATION,
  async refresh() {},
});

export function InstanceBrandingProvider({ children, initialConfig = DEFAULT_INSTANCE_CONFIGURATION }: PropsWithChildren<{ initialConfig?: InstanceConfiguration }>) {
  const [config, setConfig] = useState<InstanceConfiguration>(initialConfig);

  async function refresh() {
    const response = await fetch("/api/public-config", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { instance?: InstanceConfiguration };
    if (payload.instance) setConfig({ ...DEFAULT_INSTANCE_CONFIGURATION, ...payload.instance });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const variables: Record<string, string> = {
      "--ink": config.textColor,
      "--muted": config.mutedColor,
      "--cream": config.backgroundColor,
      "--green": config.primaryColor,
      "--admin-sidebar": config.adminSidebarColor,
      "--admin-sidebar-contrast": contrastTextColor(config.adminSidebarColor),
      "--admin-sidebar-muted": colorWithOpacity(contrastTextColor(config.adminSidebarColor), .72),
      "--admin-sidebar-border": colorWithOpacity(contrastTextColor(config.adminSidebarColor), .2),
      "--admin-sidebar-active": readableTeamColor(config.adminSidebarColor),
      "--lime": config.secondaryColor,
      "--blue": config.teamBlueColor,
      "--yellow": config.teamYellowColor,
      "--blue-soft": colorWithOpacity(config.teamBlueColor, .1),
      "--yellow-soft": colorWithOpacity(config.teamYellowColor, .1),
      "--blue-ink": readableTeamColor(config.teamBlueColor),
      "--yellow-ink": readableTeamColor(config.teamYellowColor),
      "--blue-contrast": contrastTextColor(config.teamBlueColor),
      "--yellow-contrast": contrastTextColor(config.teamYellowColor),
      "--white": config.surfaceColor,
    };
    for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
    const defaultName = DEFAULT_INSTANCE_CONFIGURATION.siteName;
    if (document.title.includes(defaultName)) document.title = document.title.replace(defaultName, config.siteName);
  }, [config]);

  const value = useMemo(() => ({ config, refresh }), [config]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useInstanceBranding() {
  return useContext(BrandingContext);
}

export function BrandIdentity({ compact = false, previewConfig, onLogoLoad }: { compact?: boolean; previewConfig?: InstanceConfiguration; onLogoLoad?: (dimensions: { width: number; height: number }) => void }) {
  const branding = useInstanceBranding();
  const config = previewConfig ?? branding.config;
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const suffix = config.siteName === config.siteShortName
    ? config.siteTagline
    : config.siteName.replace(config.siteShortName, "").trim() || config.siteTagline;
  useEffect(() => setNaturalSize({ width: 1, height: 1 }), [config.logoUrl]);
  const publicFit = fitBrandLogo(naturalSize.width, naturalSize.height, config.showPublicBrandText ? 112 : 180, config.publicLogoSize);
  const adminFit = fitBrandLogo(naturalSize.width, naturalSize.height, config.showAdminBrandText ? 112 : 190, config.adminLogoSize);
  const style = {
    "--brand-public-logo-height": `${config.publicLogoSize}px`,
    "--brand-public-logo-width": `${publicFit.width}px`,
    "--brand-public-fitted-height": `${publicFit.height}px`,
    "--brand-admin-logo-height": `${config.adminLogoSize}px`,
    "--brand-admin-logo-width": `${adminFit.width}px`,
    "--brand-admin-fitted-height": `${adminFit.height}px`,
    "--brand-public-text-display": config.showPublicBrandText ? "flex" : "none",
    "--brand-admin-text-display": config.showAdminBrandText ? "flex" : "none",
    "--brand-public-ink": config.textColor,
    "--brand-admin-ink": contrastTextColor(config.adminSidebarColor),
  } as CSSProperties;
  function logoLoaded(event: SyntheticEvent<HTMLImageElement>) {
    const dimensions = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
    setNaturalSize(dimensions);
    onLogoLoad?.(dimensions);
  }
  const visibilityClasses = `${config.showPublicBrandText ? "" : " brand-identity--public-logo-only"}${config.showAdminBrandText ? "" : " brand-identity--admin-logo-only"}`;
  return <span className={`brand-identity${visibilityClasses}`} style={style}>
    <span className={config.logoUrl ? "brand-mark brand-mark-image" : "brand-mark"}>
      {config.logoUrl ? <img src={config.logoUrl} alt="" onLoad={logoLoaded}/> : "⚽"}
    </span>
    <span className="brand-copy"><b>{config.siteShortName}</b>{!compact && <small>{suffix}</small>}</span>
  </span>;
}
