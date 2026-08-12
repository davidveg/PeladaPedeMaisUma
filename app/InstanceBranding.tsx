"use client";

import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { DEFAULT_INSTANCE_CONFIGURATION, type InstanceConfiguration } from "../lib/instance-config";
import { colorWithOpacity, contrastTextColor, readableTeamColor } from "../lib/team-colors";

type BrandingContextValue = {
  config: InstanceConfiguration;
  refresh(): Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue>({
  config: DEFAULT_INSTANCE_CONFIGURATION,
  async refresh() {},
});

export function InstanceBrandingProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<InstanceConfiguration>(DEFAULT_INSTANCE_CONFIGURATION);

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

export function BrandIdentity({ compact = false }: { compact?: boolean }) {
  const { config } = useInstanceBranding();
  const suffix = config.siteName === config.siteShortName
    ? config.siteTagline
    : config.siteName.replace(config.siteShortName, "").trim() || config.siteTagline;
  return <>
    <span className={config.logoUrl ? "brand-mark brand-mark-image" : "brand-mark"}>
      {config.logoUrl ? <img src={config.logoUrl} alt=""/> : "⚽"}
    </span>
    <span><b>{config.siteShortName}</b>{!compact && <small>{suffix}</small>}</span>
  </>;
}
