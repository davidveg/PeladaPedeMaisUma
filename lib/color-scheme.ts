import type { InstanceConfiguration } from "./instance-config";

export type SiteColorScheme = "dark" | "light";

export const COLOR_SCHEME_STORAGE_KEY = "pelada-pede-mais-uma:color-scheme";
export const COLOR_SCHEME_CHANGE_EVENT = "pelada-pede-mais-uma:color-scheme-change";

function rgb(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color || "");
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
}

export function mixHexColors(first: string, second: string, secondWeight: number) {
  const from = rgb(first);
  const to = rgb(second);
  if (!from || !to) return first;
  const weight = Math.max(0, Math.min(1, secondWeight));
  const channel = (index: number) => Math.round(from[index] * (1 - weight) + to[index] * weight).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`.toUpperCase();
}

function relativeLuminance(color: string) {
  const value = rgb(color);
  if (!value) return null;
  const linear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  };
  return linear(value[0]) * .2126 + linear(value[1]) * .7152 + linear(value[2]) * .0722;
}

export function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  if (firstLuminance == null || secondLuminance == null) return 1;
  const lightest = Math.max(firstLuminance, secondLuminance);
  const darkest = Math.min(firstLuminance, secondLuminance);
  return (lightest + .05) / (darkest + .05);
}

export function readableAccentTextColor(accent: string, background: string, minimumRatio = 4.5) {
  if (contrastRatio(accent, background) >= minimumRatio) return accent;
  const dark = "#17221D";
  const light = "#FFFFFF";
  const target = contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
  for (let step = 1; step <= 100; step += 1) {
    const candidate = mixHexColors(accent, target, step / 100);
    if (contrastRatio(candidate, background) >= minimumRatio) return candidate;
  }
  return target;
}

export type SiteAppearance = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  controlSurface: string;
  controlText: string;
  accentText: string;
  managementAccentText: string;
  adminSidebar: string;
  publicSidebar: string;
  publicTopbar: string;
};

/**
 * O tema claro nasce da identidade escura configurada pela pelada. Assim as
 * cores da marca continuam reconhecíveis sem duplicar todos os campos no banco.
 */
export function siteAppearance(config: InstanceConfiguration, scheme: SiteColorScheme): SiteAppearance {
  if (scheme === "dark") {
    return {
      background: config.managementBackgroundColor,
      surface: config.managementSurfaceColor,
      text: config.managementTextColor,
      muted: config.managementMutedColor,
      controlSurface: config.controlSurfaceColor,
      controlText: config.controlTextColor,
      accentText: config.primaryColor,
      managementAccentText: config.managementButtonColor,
      adminSidebar: config.adminSidebarColor,
      publicSidebar: config.publicSidebarColor,
      publicTopbar: config.publicTopbarColor,
    };
  }

  const background = mixHexColors(config.managementBackgroundColor, "#FFFFFF", .92);
  const surface = mixHexColors(config.managementSurfaceColor, "#FFFFFF", .975);
  const text = "#17221D";
  return {
    background,
    surface,
    text,
    muted: mixHexColors(text, background, .48),
    controlSurface: mixHexColors(config.controlSurfaceColor, "#FFFFFF", .92),
    controlText: text,
    accentText: readableAccentTextColor(config.primaryColor, surface),
    managementAccentText: readableAccentTextColor(config.managementButtonColor, surface),
    adminSidebar: mixHexColors(config.adminSidebarColor, "#FFFFFF", .87),
    publicSidebar: mixHexColors(config.publicSidebarColor, "#FFFFFF", .87),
    publicTopbar: mixHexColors(config.publicTopbarColor, "#FFFFFF", .94),
  };
}
