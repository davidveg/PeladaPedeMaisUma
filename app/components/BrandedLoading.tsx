"use client";

import { useInstanceBranding } from "../InstanceBranding";

type BrandedLoadingProps = {
  message: string;
  detail?: string;
  variant?: "page" | "panel" | "inline";
  className?: string;
};

export function BrandedLoading({ message, detail, variant = "panel", className = "" }: BrandedLoadingProps) {
  const { config } = useInstanceBranding();
  const classes = `${variant === "page" ? "site-access-screen" : "branded-loading"} branded-loading-${variant}${className ? ` ${className}` : ""}`;

  return <div className={classes} role="status" aria-live="polite" aria-busy="true">
    <div className="branded-loading-spinner" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/><span/></div>
    <div className="branded-loading-copy"><strong>{message}</strong><small>{detail || `Preparando ${config.siteShortName}`}</small></div>
  </div>;
}
