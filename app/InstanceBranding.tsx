"use client";

import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type PropsWithChildren, type SyntheticEvent } from "react";
import { DEFAULT_INSTANCE_CONFIGURATION, type InstanceConfiguration } from "../lib/instance-config";
import { fitBrandLogo } from "../lib/brand-logo";
import { colorWithOpacity, contrastTextColor, readableTeamColor } from "../lib/team-colors";
import { COLOR_SCHEME_CHANGE_EVENT, COLOR_SCHEME_STORAGE_KEY, readableAccentTextColor, siteAppearance, type SiteColorScheme } from "../lib/color-scheme";
import type { PublicCareerSeason } from "../lib/career";

type BrandingContextValue = {
  config: InstanceConfiguration;
  season: PublicCareerSeason | null;
  colorScheme: SiteColorScheme;
  refresh(): Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue>({
  config: DEFAULT_INSTANCE_CONFIGURATION,
  season: null,
  colorScheme: "dark",
  async refresh() {},
});

export function InstanceBrandingProvider({ children, initialConfig = DEFAULT_INSTANCE_CONFIGURATION }: PropsWithChildren<{ initialConfig?: InstanceConfiguration }>) {
  const [config, setConfig] = useState<InstanceConfiguration>(initialConfig);
  const [season, setSeason] = useState<PublicCareerSeason | null>(null);
  const [colorScheme, setColorScheme] = useState<SiteColorScheme>("dark");

  async function refresh() {
    const response = await fetch("/api/public-config", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { instance?: InstanceConfiguration; season?: PublicCareerSeason };
    if (payload.instance) setConfig({ ...DEFAULT_INSTANCE_CONFIGURATION, ...payload.instance });
    setSeason(payload.season || null);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const sync = (event?: Event) => {
      if (event?.type === "storage") {
        const storageEvent = event as StorageEvent;
        if (storageEvent.key !== COLOR_SCHEME_STORAGE_KEY) return;
        document.documentElement.dataset.colorScheme = storageEvent.newValue === "light" ? "light" : "dark";
      }
      setColorScheme(document.documentElement.dataset.colorScheme === "light" ? "light" : "dark");
    };
    sync();
    window.addEventListener(COLOR_SCHEME_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COLOR_SCHEME_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const selectedScheme: SiteColorScheme = root.dataset.colorScheme === "light" ? "light" : "dark";
    const appearance = siteAppearance(config, selectedScheme);
    const effectiveAdminSidebar = selectedScheme === "dark" ? config.adminSidebarColor : appearance.adminSidebar;
    const variables: Record<string, string> = {
      "--ink": appearance.text,
      "--muted": appearance.muted,
      "--cream": appearance.background,
      "--green": config.primaryColor,
      "--management-background": selectedScheme === "dark" ? config.managementBackgroundColor : appearance.background,
      "--management-surface": selectedScheme === "dark" ? config.managementSurfaceColor : appearance.surface,
      "--management-text": appearance.text,
      "--management-muted": appearance.muted,
      "--management-button": config.managementButtonColor,
      "--management-button-text": config.managementButtonTextColor,
      "--management-button-contrast": contrastTextColor(config.managementButtonColor),
      "--management-accent-text": appearance.managementAccentText,
      "--management-line": colorWithOpacity(appearance.text, .16),
      "--control-surface": selectedScheme === "dark" ? config.controlSurfaceColor : appearance.controlSurface,
      "--control-text": selectedScheme === "dark" ? config.controlTextColor : appearance.controlText,
      "--control-contrast": selectedScheme === "dark" ? contrastTextColor(config.controlSurfaceColor) : contrastTextColor(appearance.controlSurface),
      "--control-line": colorWithOpacity(appearance.controlText, .16),
      "--admin-sidebar": effectiveAdminSidebar,
      "--admin-sidebar-contrast": contrastTextColor(appearance.adminSidebar),
      "--admin-sidebar-muted": colorWithOpacity(contrastTextColor(appearance.adminSidebar), .72),
      "--admin-sidebar-border": colorWithOpacity(contrastTextColor(appearance.adminSidebar), .2),
      "--admin-sidebar-active": readableTeamColor(appearance.adminSidebar),
      "--admin-sidebar-accent-text": readableAccentTextColor(config.managementButtonColor, effectiveAdminSidebar),
      "--public-sidebar": selectedScheme === "dark" ? config.publicSidebarColor : appearance.publicSidebar,
      "--public-sidebar-contrast": selectedScheme === "dark" ? contrastTextColor(config.publicSidebarColor) : contrastTextColor(appearance.publicSidebar),
      "--public-sidebar-muted": colorWithOpacity(contrastTextColor(appearance.publicSidebar), .72),
      "--public-sidebar-border": colorWithOpacity(contrastTextColor(appearance.publicSidebar), .16),
      "--public-sidebar-highlight": config.secondaryColor,
      "--public-sidebar-highlight-contrast": contrastTextColor(config.secondaryColor),
      "--public-topbar": selectedScheme === "dark" ? config.publicTopbarColor : appearance.publicTopbar,
      "--public-topbar-contrast": selectedScheme === "dark" ? contrastTextColor(config.publicTopbarColor) : contrastTextColor(appearance.publicTopbar),
      "--public-topbar-muted": colorWithOpacity(contrastTextColor(appearance.publicTopbar), .62),
      "--public-topbar-border": colorWithOpacity(contrastTextColor(appearance.publicTopbar), .1),
      "--accent-text": appearance.accentText,
      "--lime": config.secondaryColor,
      "--blue": config.teamBlueColor,
      "--yellow": config.teamYellowColor,
      "--blue-soft": colorWithOpacity(config.teamBlueColor, .1),
      "--yellow-soft": colorWithOpacity(config.teamYellowColor, .1),
      "--blue-ink": readableTeamColor(config.teamBlueColor),
      "--yellow-ink": readableTeamColor(config.teamYellowColor),
      "--blue-contrast": contrastTextColor(config.teamBlueColor),
      "--yellow-contrast": contrastTextColor(config.teamYellowColor),
      "--white": appearance.surface,
    };
    for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
    const defaultName = DEFAULT_INSTANCE_CONFIGURATION.siteName;
    if (document.title.includes(defaultName)) document.title = document.title.replace(defaultName, config.siteName);
  }, [config, colorScheme]);

  const value = useMemo(() => ({ config, season, colorScheme, refresh }), [config, season, colorScheme]);
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
    "--brand-public-ink": "var(--public-sidebar-contrast, #fff)",
    "--brand-admin-ink": "var(--admin-sidebar-contrast, #fff)",
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
