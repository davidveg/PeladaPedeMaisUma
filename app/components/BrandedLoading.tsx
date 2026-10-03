"use client";

import type { CSSProperties } from "react";
import { useInstanceBranding } from "../InstanceBranding";

type BrandedLoadingProps = {
  message: string;
  detail?: string;
  variant?: "page" | "panel" | "inline";
  className?: string;
};

export function BrandedLoading({ message, detail, variant = "panel", className = "" }: BrandedLoadingProps) {
  const { config } = useInstanceBranding();
  const style = {
    "--access-background": config.managementBackgroundColor,
    "--access-surface": config.managementSurfaceColor,
    "--access-text": config.managementTextColor,
    "--access-muted": config.managementMutedColor,
    "--access-accent": config.managementButtonColor,
    "--access-button-text": config.managementButtonTextColor,
  } as CSSProperties;
  const classes = `${variant === "page" ? "site-access-screen" : "branded-loading"} branded-loading-${variant}${className ? ` ${className}` : ""}`;

  return <div className={classes} style={style} role="status" aria-live="polite" aria-busy="true">
    <div className="branded-loading-spinner" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/><span/></div>
    <div className="branded-loading-copy"><strong>{message}</strong><small>{detail || `Preparando ${config.siteShortName}`}</small></div>
  </div>;
}
