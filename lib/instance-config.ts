export type InstanceConfiguration = {
  siteName: string;
  siteShortName: string;
  siteTagline: string;
  footerText: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  shareImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  teamBlueColor: string;
  teamYellowColor: string;
  teamBlueName: string;
  teamYellowName: string;
  appName: string;
  appTagline: string;
  appPrimaryColor: string;
  appSecondaryColor: string;
  appBackgroundColor: string;
  appTextColor: string;
  defaultMatchTitle: string;
  defaultMatchWeekday: number;
  defaultMatchTime: string;
  defaultMatchLocation: string;
  confirmationLeadMinutes: number;
  manualSeparationEnabled: boolean;
  separationDraftsEnabled: boolean;
  guestPreconfirmationEnabled: boolean;
  guestConfirmationThreshold: number;
  financeEnabled: boolean;
  timezone: string;
  updatedAt?: string;
};

export const DEFAULT_INSTANCE_CONFIGURATION: InstanceConfiguration = {
  siteName: "Pelada Pede Mais Uma",
  siteShortName: "Pelada",
  siteTagline: "Times equilibrados. Resenha garantida.",
  footerText: "Times equilibrados. Resenha garantida.",
  logoUrl: null,
  faviconUrl: null,
  shareImageUrl: null,
  primaryColor: "#174D3B",
  secondaryColor: "#D9F36B",
  backgroundColor: "#F5F7F3",
  surfaceColor: "#FFFFFF",
  textColor: "#15241F",
  mutedColor: "#68756F",
  teamBlueColor: "#1768E5",
  teamYellowColor: "#F4BF20",
  teamBlueName: "Azul",
  teamYellowName: "Amarelo",
  appName: "Pelada Pede Mais Uma",
  appTagline: "Entre para a partida",
  appPrimaryColor: "#0B3D2E",
  appSecondaryColor: "#D9F36B",
  appBackgroundColor: "#F6F4EC",
  appTextColor: "#17221D",
  defaultMatchTitle: "Pelada",
  defaultMatchWeekday: 0,
  defaultMatchTime: "09:00",
  defaultMatchLocation: "Rio de Janeiro, Brasil",
  confirmationLeadMinutes: 60,
  manualSeparationEnabled: false,
  separationDraftsEnabled: false,
  guestPreconfirmationEnabled: false,
  guestConfirmationThreshold: 16,
  financeEnabled: true,
  timezone: "America/Sao_Paulo",
};

type InstanceConfigurationRow = Record<string, unknown> | null | undefined;

export function instanceConfigurationFromRow(row: InstanceConfigurationRow): InstanceConfiguration {
  if (!row) return { ...DEFAULT_INSTANCE_CONFIGURATION };
  const value = (key: string, fallback: string) => String(row[key] ?? fallback);
  return {
    siteName: value("site_name", DEFAULT_INSTANCE_CONFIGURATION.siteName),
    siteShortName: value("site_short_name", DEFAULT_INSTANCE_CONFIGURATION.siteShortName),
    siteTagline: value("site_tagline", DEFAULT_INSTANCE_CONFIGURATION.siteTagline),
    footerText: value("footer_text", DEFAULT_INSTANCE_CONFIGURATION.footerText),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    faviconUrl: row.favicon_url ? String(row.favicon_url) : null,
    shareImageUrl: row.share_image_url ? String(row.share_image_url) : null,
    primaryColor: value("primary_color", DEFAULT_INSTANCE_CONFIGURATION.primaryColor),
    secondaryColor: value("secondary_color", DEFAULT_INSTANCE_CONFIGURATION.secondaryColor),
    backgroundColor: value("background_color", DEFAULT_INSTANCE_CONFIGURATION.backgroundColor),
    surfaceColor: value("surface_color", DEFAULT_INSTANCE_CONFIGURATION.surfaceColor),
    textColor: value("text_color", DEFAULT_INSTANCE_CONFIGURATION.textColor),
    mutedColor: value("muted_color", DEFAULT_INSTANCE_CONFIGURATION.mutedColor),
    teamBlueColor: value("team_blue_color", DEFAULT_INSTANCE_CONFIGURATION.teamBlueColor),
    teamYellowColor: value("team_yellow_color", DEFAULT_INSTANCE_CONFIGURATION.teamYellowColor),
    teamBlueName: value("team_blue_name", DEFAULT_INSTANCE_CONFIGURATION.teamBlueName),
    teamYellowName: value("team_yellow_name", DEFAULT_INSTANCE_CONFIGURATION.teamYellowName),
    appName: value("app_name", DEFAULT_INSTANCE_CONFIGURATION.appName),
    appTagline: value("app_tagline", DEFAULT_INSTANCE_CONFIGURATION.appTagline),
    appPrimaryColor: value("app_primary_color", DEFAULT_INSTANCE_CONFIGURATION.appPrimaryColor),
    appSecondaryColor: value("app_secondary_color", DEFAULT_INSTANCE_CONFIGURATION.appSecondaryColor),
    appBackgroundColor: value("app_background_color", DEFAULT_INSTANCE_CONFIGURATION.appBackgroundColor),
    appTextColor: value("app_text_color", DEFAULT_INSTANCE_CONFIGURATION.appTextColor),
    defaultMatchTitle: value("default_match_title", DEFAULT_INSTANCE_CONFIGURATION.defaultMatchTitle),
    defaultMatchWeekday: Number(row.default_match_weekday ?? DEFAULT_INSTANCE_CONFIGURATION.defaultMatchWeekday),
    defaultMatchTime: value("default_match_time", DEFAULT_INSTANCE_CONFIGURATION.defaultMatchTime),
    defaultMatchLocation: value("default_match_location", DEFAULT_INSTANCE_CONFIGURATION.defaultMatchLocation),
    confirmationLeadMinutes: Number(row.confirmation_lead_minutes ?? DEFAULT_INSTANCE_CONFIGURATION.confirmationLeadMinutes),
    manualSeparationEnabled: Boolean(row.manual_separation_enabled ?? DEFAULT_INSTANCE_CONFIGURATION.manualSeparationEnabled),
    separationDraftsEnabled: Boolean(row.separation_drafts_enabled ?? DEFAULT_INSTANCE_CONFIGURATION.separationDraftsEnabled),
    guestPreconfirmationEnabled: Boolean(row.guest_preconfirmation_enabled ?? DEFAULT_INSTANCE_CONFIGURATION.guestPreconfirmationEnabled),
    guestConfirmationThreshold: Number(row.guest_confirmation_threshold ?? DEFAULT_INSTANCE_CONFIGURATION.guestConfirmationThreshold),
    financeEnabled: Boolean(row.finance_enabled ?? DEFAULT_INSTANCE_CONFIGURATION.financeEnabled),
    timezone: value("timezone", DEFAULT_INSTANCE_CONFIGURATION.timezone),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

const colorPattern = /^#[0-9A-F]{6}$/i;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateInstanceConfiguration(input: unknown): { config?: InstanceConfiguration; error?: string } {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const text = (key: keyof InstanceConfiguration, maximum: number, fallback: string) =>
    String(source[key] ?? fallback).trim().slice(0, maximum);
  const color = (key: keyof InstanceConfiguration, fallback: string) =>
    String(source[key] ?? fallback).trim().toUpperCase();

  const config: InstanceConfiguration = {
    siteName: text("siteName", 120, DEFAULT_INSTANCE_CONFIGURATION.siteName),
    siteShortName: text("siteShortName", 40, DEFAULT_INSTANCE_CONFIGURATION.siteShortName),
    siteTagline: text("siteTagline", 180, DEFAULT_INSTANCE_CONFIGURATION.siteTagline),
    footerText: text("footerText", 240, DEFAULT_INSTANCE_CONFIGURATION.footerText),
    logoUrl: String(source.logoUrl ?? "").trim().slice(0, 500) || null,
    faviconUrl: String(source.faviconUrl ?? "").trim().slice(0, 500) || null,
    shareImageUrl: String(source.shareImageUrl ?? "").trim().slice(0, 500) || null,
    primaryColor: color("primaryColor", DEFAULT_INSTANCE_CONFIGURATION.primaryColor),
    secondaryColor: color("secondaryColor", DEFAULT_INSTANCE_CONFIGURATION.secondaryColor),
    backgroundColor: color("backgroundColor", DEFAULT_INSTANCE_CONFIGURATION.backgroundColor),
    surfaceColor: color("surfaceColor", DEFAULT_INSTANCE_CONFIGURATION.surfaceColor),
    textColor: color("textColor", DEFAULT_INSTANCE_CONFIGURATION.textColor),
    mutedColor: color("mutedColor", DEFAULT_INSTANCE_CONFIGURATION.mutedColor),
    teamBlueColor: color("teamBlueColor", DEFAULT_INSTANCE_CONFIGURATION.teamBlueColor),
    teamYellowColor: color("teamYellowColor", DEFAULT_INSTANCE_CONFIGURATION.teamYellowColor),
    teamBlueName: text("teamBlueName", 40, DEFAULT_INSTANCE_CONFIGURATION.teamBlueName),
    teamYellowName: text("teamYellowName", 40, DEFAULT_INSTANCE_CONFIGURATION.teamYellowName),
    appName: text("appName", 120, DEFAULT_INSTANCE_CONFIGURATION.appName),
    appTagline: text("appTagline", 180, DEFAULT_INSTANCE_CONFIGURATION.appTagline),
    appPrimaryColor: color("appPrimaryColor", DEFAULT_INSTANCE_CONFIGURATION.appPrimaryColor),
    appSecondaryColor: color("appSecondaryColor", DEFAULT_INSTANCE_CONFIGURATION.appSecondaryColor),
    appBackgroundColor: color("appBackgroundColor", DEFAULT_INSTANCE_CONFIGURATION.appBackgroundColor),
    appTextColor: color("appTextColor", DEFAULT_INSTANCE_CONFIGURATION.appTextColor),
    defaultMatchTitle: text("defaultMatchTitle", 120, DEFAULT_INSTANCE_CONFIGURATION.defaultMatchTitle),
    defaultMatchWeekday: Number(source.defaultMatchWeekday ?? DEFAULT_INSTANCE_CONFIGURATION.defaultMatchWeekday),
    defaultMatchTime: String(source.defaultMatchTime ?? DEFAULT_INSTANCE_CONFIGURATION.defaultMatchTime).trim(),
    defaultMatchLocation: text("defaultMatchLocation", 300, DEFAULT_INSTANCE_CONFIGURATION.defaultMatchLocation),
    confirmationLeadMinutes: Number(source.confirmationLeadMinutes ?? DEFAULT_INSTANCE_CONFIGURATION.confirmationLeadMinutes),
    manualSeparationEnabled: source.manualSeparationEnabled === true,
    separationDraftsEnabled: source.separationDraftsEnabled === true,
    guestPreconfirmationEnabled: source.guestPreconfirmationEnabled === true,
    guestConfirmationThreshold: Number(source.guestConfirmationThreshold ?? DEFAULT_INSTANCE_CONFIGURATION.guestConfirmationThreshold),
    financeEnabled: source.financeEnabled !== false,
    timezone: text("timezone", 80, DEFAULT_INSTANCE_CONFIGURATION.timezone),
  };

  if (!config.siteName || !config.siteShortName || !config.appName || !config.defaultMatchTitle || !config.defaultMatchLocation || !config.teamBlueName || !config.teamYellowName) {
    return { error: "Os nomes do site, aplicativo, partida e das duas equipes são obrigatórios." };
  }
  if (config.teamBlueName.toLocaleLowerCase("pt-BR") === config.teamYellowName.toLocaleLowerCase("pt-BR")) return { error: "As duas equipes precisam ter nomes diferentes." };
  const colorKeys = [
    "primaryColor", "secondaryColor", "backgroundColor", "surfaceColor", "textColor", "mutedColor",
    "teamBlueColor", "teamYellowColor", "appPrimaryColor", "appSecondaryColor", "appBackgroundColor", "appTextColor",
  ] as const;
  if (colorKeys.some((key) => !colorPattern.test(config[key]))) return { error: "As cores devem usar o formato hexadecimal #RRGGBB." };
  if (!Number.isInteger(config.defaultMatchWeekday) || config.defaultMatchWeekday < 0 || config.defaultMatchWeekday > 6) {
    return { error: "Selecione um dia da semana válido." };
  }
  if (!timePattern.test(config.defaultMatchTime)) return { error: "O horário padrão deve usar o formato HH:MM." };
  if (!Number.isInteger(config.confirmationLeadMinutes) || config.confirmationLeadMinutes < 0 || config.confirmationLeadMinutes > 10080) {
    return { error: "A antecedência das confirmações deve ficar entre 0 e 10.080 minutos." };
  }
  if (!Number.isInteger(config.guestConfirmationThreshold) || config.guestConfirmationThreshold < 1 || config.guestConfirmationThreshold > 100) {
    return { error: "O mínimo para confirmar convidados deve ficar entre 1 e 100 jogadores." };
  }
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: config.timezone }).format(new Date());
  } catch {
    return { error: "Informe um fuso horário IANA válido, como America/Sao_Paulo." };
  }
  if (config.logoUrl && !config.logoUrl.startsWith("/api/upload?key=branding%2F") && !/^https:\/\//i.test(config.logoUrl)) {
    return { error: "O logotipo deve ser um upload do sistema ou uma URL HTTPS." };
  }
  if (config.faviconUrl && !config.faviconUrl.startsWith("/api/upload?key=branding%2F") && !/^https:\/\//i.test(config.faviconUrl)) {
    return { error: "O favicon deve ser um upload do sistema ou uma URL HTTPS." };
  }
  if (config.shareImageUrl && !config.shareImageUrl.startsWith("/api/upload?key=branding%2F") && !/^https:\/\//i.test(config.shareImageUrl)) {
    return { error: "A imagem de compartilhamento deve ser um upload do sistema ou uma URL HTTPS." };
  }
  return { config };
}

export const INSTANCE_CONFIGURATION_COLUMNS = [
  "site_name", "site_short_name", "site_tagline", "footer_text", "logo_url", "favicon_url", "share_image_url",
  "primary_color", "secondary_color", "background_color", "surface_color", "text_color", "muted_color",
  "team_blue_color", "team_yellow_color", "team_blue_name", "team_yellow_name", "app_name", "app_tagline", "app_primary_color",
  "app_secondary_color", "app_background_color", "app_text_color", "default_match_title",
  "default_match_weekday", "default_match_time", "default_match_location", "confirmation_lead_minutes", "manual_separation_enabled",
  "separation_drafts_enabled",
  "guest_preconfirmation_enabled", "guest_confirmation_threshold", "finance_enabled", "timezone",
] as const;

export function instanceConfigurationValues(config: InstanceConfiguration) {
  return [
    config.siteName, config.siteShortName, config.siteTagline, config.footerText, config.logoUrl, config.faviconUrl, config.shareImageUrl,
    config.primaryColor, config.secondaryColor, config.backgroundColor, config.surfaceColor, config.textColor,
    config.mutedColor, config.teamBlueColor, config.teamYellowColor, config.teamBlueName, config.teamYellowName, config.appName, config.appTagline,
    config.appPrimaryColor, config.appSecondaryColor, config.appBackgroundColor, config.appTextColor,
    config.defaultMatchTitle, config.defaultMatchWeekday, config.defaultMatchTime, config.defaultMatchLocation, config.confirmationLeadMinutes,
    Number(config.manualSeparationEnabled), Number(config.separationDraftsEnabled), Number(config.guestPreconfirmationEnabled), config.guestConfirmationThreshold, Number(config.financeEnabled),
    config.timezone,
  ];
}
