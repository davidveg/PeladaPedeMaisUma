import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_INSTANCE_CONFIGURATION,
  INSTANCE_CONFIGURATION_COLUMNS,
  instanceConfigurationFromRow,
  instanceConfigurationValues,
  validateInstanceConfiguration,
} from "../lib/instance-config.ts";
import { instanceFaviconUrl, instanceShareImageUrl } from "../lib/instance-metadata.ts";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("mantém a identidade e o domingo atuais como padrão retrocompatível", () => {
  const config = instanceConfigurationFromRow(null);
  assert.equal(config.siteName, "Pelada Pede Mais Uma");
  assert.equal(config.defaultMatchWeekday, 0);
  assert.equal(config.defaultMatchTime, "09:00");
  assert.equal(config.confirmationLeadMinutes, 60);
  assert.equal(config.teamBlueName, "Azul");
  assert.equal(config.teamYellowName, "Amarelo");
  assert.equal(config.manualSeparationEnabled, false);
  assert.equal(config.separationDraftsEnabled, false);
  assert.equal(config.guestPreconfirmationEnabled, false);
  assert.equal(config.guestConfirmationThreshold, 16);
  assert.equal(config.financeEnabled, true);
  assert.equal(config.delinquencyAttendanceBlockEnabled, false);
  assert.equal(config.allowInsecureLocalNetworkAuth, false);
  assert.equal(config.shareImageUrl, null);
  assert.equal(config.faviconUrl, null);
  assert.equal(config.adminSidebarColor, "#133F31");
  assert.equal(config.managementBackgroundColor, "#0F1612");
  assert.equal(config.managementSurfaceColor, "#18211D");
  assert.equal(config.managementTextColor, "#F2F5F3");
  assert.equal(config.managementMutedColor, "#98A69F");
  assert.equal(config.managementButtonColor, "#D3EB7A");
  assert.equal(config.managementButtonTextColor, "#172018");
  assert.equal(config.controlSurfaceColor, "#202B26");
  assert.equal(config.controlTextColor, "#F2F5F3");
  assert.equal(config.publicLogoSize, 44);
  assert.equal(config.adminLogoSize, 54);
  assert.equal(config.showPublicBrandText, true);
  assert.equal(config.showAdminBrandText, true);
});

test("ignora a ativação legada sem afetar rascunhos ou outras configurações", () => {
  const config = instanceConfigurationFromRow({ manual_separation_enabled: 1, separation_drafts_enabled: 1, team_blue_name: "Vermelho" });
  assert.equal(config.manualSeparationEnabled, false);
  assert.equal(config.separationDraftsEnabled, true);
  assert.equal(config.teamBlueName, "Vermelho");
});

test("normaliza tamanhos antigos para não quebrar os cabeçalhos", () => {
  const config = instanceConfigurationFromRow({ public_logo_size: 96, admin_logo_size: 120 });
  assert.equal(config.publicLogoSize, 64);
  assert.equal(config.adminLogoSize, 88);
});

test("aceita identidade, cores e dia da semana personalizados", () => {
  const result = validateInstanceConfiguration({
    ...DEFAULT_INSTANCE_CONFIGURATION,
    siteName: "Futebol de Quarta",
    siteShortName: "FDQ",
    appName: "FDQ",
    primaryColor: "#123ABC",
    adminSidebarColor: "#440052",
    managementBackgroundColor: "#111827",
    managementSurfaceColor: "#1F2937",
    managementTextColor: "#F9FAFB",
    managementMutedColor: "#9CA3AF",
    managementButtonColor: "#38BDF8",
    managementButtonTextColor: "#082F49",
    controlSurfaceColor: "#253147",
    controlTextColor: "#F8FAFC",
    publicLogoSize: 58,
    adminLogoSize: 72,
    showPublicBrandText: false,
    showAdminBrandText: false,
    defaultMatchWeekday: 3,
    defaultMatchTime: "20:30",
    confirmationLeadMinutes: 180,
    teamBlueName: "Camisa",
    teamYellowName: "Sem camisa",
    manualSeparationEnabled: true,
    separationDraftsEnabled: true,
    guestPreconfirmationEnabled: true,
    guestConfirmationThreshold: 18,
    financeEnabled: false,
    delinquencyAttendanceBlockEnabled: true,
    allowInsecureLocalNetworkAuth: true,
    shareImageUrl: "/api/upload?key=branding%2Fsocial.png",
    faviconUrl: "/api/upload?key=branding%2Ffavicon.ico",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.config.siteName, "Futebol de Quarta");
  assert.equal(result.config.defaultMatchWeekday, 3);
  assert.equal(result.config.teamBlueName, "Camisa");
  assert.equal(result.config.teamYellowName, "Sem camisa");
  assert.equal(result.config.adminSidebarColor, "#440052");
  assert.equal(result.config.managementBackgroundColor, "#111827");
  assert.equal(result.config.managementSurfaceColor, "#1F2937");
  assert.equal(result.config.managementTextColor, "#F9FAFB");
  assert.equal(result.config.managementMutedColor, "#9CA3AF");
  assert.equal(result.config.managementButtonColor, "#38BDF8");
  assert.equal(result.config.managementButtonTextColor, "#082F49");
  assert.equal(result.config.controlSurfaceColor, "#253147");
  assert.equal(result.config.controlTextColor, "#F8FAFC");
  assert.equal(result.config.publicLogoSize, 58);
  assert.equal(result.config.adminLogoSize, 72);
  assert.equal(result.config.showPublicBrandText, false);
  assert.equal(result.config.showAdminBrandText, false);
  assert.equal(result.config.manualSeparationEnabled, false);
  assert.equal(result.config.separationDraftsEnabled, true);
  assert.equal(result.config.guestPreconfirmationEnabled, true);
  assert.equal(result.config.guestConfirmationThreshold, 18);
  assert.equal(result.config.financeEnabled, false);
  assert.equal(result.config.delinquencyAttendanceBlockEnabled, true);
  assert.equal(result.config.allowInsecureLocalNetworkAuth, true);
  assert.equal(result.config.shareImageUrl, "/api/upload?key=branding%2Fsocial.png");
  assert.equal(result.config.faviconUrl, "/api/upload?key=branding%2Ffavicon.ico");
});

test("mantém colunas e valores alinhados ao salvar a configuração", () => {
  const config = { ...DEFAULT_INSTANCE_CONFIGURATION, manualSeparationEnabled: true, separationDraftsEnabled: true, guestPreconfirmationEnabled: true, guestConfirmationThreshold: 20, financeEnabled: false, delinquencyAttendanceBlockEnabled: true, allowInsecureLocalNetworkAuth: true };
  assert.equal(INSTANCE_CONFIGURATION_COLUMNS.length, instanceConfigurationValues(config).length);
  const index = INSTANCE_CONFIGURATION_COLUMNS.indexOf("manual_separation_enabled");
  assert.equal(instanceConfigurationValues(config)[index], 0);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("separation_drafts_enabled")], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("guest_preconfirmation_enabled")], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("guest_confirmation_threshold")], 20);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("finance_enabled")], 0);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("delinquency_attendance_block_enabled")], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("allow_insecure_local_network_auth")], 1);
});

test("migração mantém o login HTTP pela rede local desativado por padrão", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-local-network-auth-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0052_local_network_auth.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT allow_insecure_local_network_auth FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { allow_insecure_local_network_auth: 0 });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração cria o bloqueio por inadimplência desativado por padrão", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-delinquency-attendance-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0045_delinquency_attendance_block.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT delinquency_attendance_block_enabled FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { delinquency_attendance_block_enabled: 0 });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração mantém o módulo financeiro ativo nas instalações existentes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-finance-toggle-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0036_finance_toggle.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT finance_enabled FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { finance_enabled: 1 });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejeita cores, horários e logotipos externos inseguros", () => {
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, primaryColor: "verde" }).error, /hexadecimal/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, adminSidebarColor: "roxo" }).error, /hexadecimal/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, managementBackgroundColor: "escuro" }).error, /hexadecimal/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, managementButtonColor: "azul" }).error, /hexadecimal/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, controlSurfaceColor: "cinza" }).error, /hexadecimal/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, defaultMatchTime: "25:00" }).error, /HH:MM/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, logoUrl: "http://inseguro.example/logo.png" }).error, /logotipo/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, shareImageUrl: "http://inseguro.example/social.png" }).error, /compartilhamento/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, faviconUrl: "http://inseguro.example/favicon.ico" }).error, /favicon/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, teamYellowName: "Azul" }).error, /diferentes/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, guestConfirmationThreshold: 0 }).error, /mínimo/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, publicLogoSize: 20 }).error, /público/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, adminLogoSize: 140 }).error, /administrativo/);
});

test("migração cria rascunhos de separação desativados por padrão", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-separation-drafts-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0029_separation_drafts.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT separation_drafts_enabled FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { separation_drafts_enabled: 0 });
    const table = await bindings.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='match_separation_drafts'").first();
    assert.equal(table.name, "match_separation_drafts");
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração cria a lista de espera desativada e isolada por partida", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-guest-preconfirmation-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0028_guest_preconfirmation.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT guest_preconfirmation_enabled,guest_confirmation_threshold FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { guest_preconfirmation_enabled: 0, guest_confirmation_threshold: 16 });
    const table = await bindings.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='match_guest_preconfirmations'").first();
    assert.equal(table.name, "match_guest_preconfirmations");
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("prioriza a imagem social e mantém fallbacks seguros por instância", () => {
  const base = "https://peladadoagriao.example";
  assert.equal(instanceShareImageUrl({ ...DEFAULT_INSTANCE_CONFIGURATION, shareImageUrl: "/api/upload?key=branding%2Fsocial.png" }, base), "https://peladadoagriao.example/api/upload?key=branding%2Fsocial.png");
  assert.equal(instanceShareImageUrl({ ...DEFAULT_INSTANCE_CONFIGURATION, logoUrl: "/api/upload?key=branding%2Flogo.png" }, base), "https://peladadoagriao.example/api/upload?key=branding%2Flogo.png");
  assert.equal(instanceShareImageUrl(DEFAULT_INSTANCE_CONFIGURATION, base), "https://peladadoagriao.example/og.png");
});

test("prioriza o favicon e usa o logotipo da instância como fallback", () => {
  assert.equal(instanceFaviconUrl({ ...DEFAULT_INSTANCE_CONFIGURATION, faviconUrl: "/api/upload?key=branding%2Ffavicon.ico", logoUrl: "/api/upload?key=branding%2Flogo.png" }), "/api/upload?key=branding%2Ffavicon.ico");
  assert.equal(instanceFaviconUrl({ ...DEFAULT_INSTANCE_CONFIGURATION, logoUrl: "/api/upload?key=branding%2Flogo.png" }), "/api/upload?key=branding%2Flogo.png");
  assert.equal(instanceFaviconUrl(DEFAULT_INSTANCE_CONFIGURATION), null);
});

test("migração acrescenta nomes retrocompatíveis às instâncias existentes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-team-names-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0020_team_names.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT team_blue_name,team_yellow_name FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { team_blue_name: "Azul", team_yellow_name: "Amarelo" });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração mantém a importação manual desativada por padrão", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-manual-separation-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0020_team_names.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0021_manual_separation_toggle.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT manual_separation_enabled FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { manual_separation_enabled: 0 });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona imagem de compartilhamento sem alterar a identidade existente", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-share-image-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.prepare("UPDATE instance_configuration SET site_name='Pelada do Agrião' WHERE id=1").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0025_instance_share_image.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT site_name,share_image_url FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { site_name: "Pelada do Agrião", share_image_url: null });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona favicon sem alterar a identidade existente", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-favicon-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.prepare("UPDATE instance_configuration SET site_name='Pelada do Agrião' WHERE id=1").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0026_instance_favicon.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT site_name,favicon_url FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { site_name: "Pelada do Agrião", favicon_url: null });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração cria configuração isolada com os padrões atuais", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-instance-config-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT site_name,default_match_weekday,default_match_time FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, {
      site_name: "Pelada Pede Mais Uma",
      default_match_weekday: 0,
      default_match_time: "09:00",
    });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona a cor do menu administrativo sem alterar a identidade existente", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-admin-sidebar-color-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.prepare("UPDATE instance_configuration SET site_name='Peladix'").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0047_admin_sidebar_color.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT site_name,admin_sidebar_color FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { site_name: "Peladix", admin_sidebar_color: "#133F31" });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona a paleta da área de gestão sem alterar a identidade existente", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-management-palette-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.prepare("UPDATE instance_configuration SET site_name='Peladix'").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0049_management_palette.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT site_name,management_background_color,management_surface_color,management_text_color,management_muted_color FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, {
      site_name: "Peladix",
      management_background_color: "#0F1612",
      management_surface_color: "#18211D",
      management_text_color: "#F2F5F3",
      management_muted_color: "#98A69F",
    });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona cores independentes para os botões da gestão", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-management-buttons-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0050_management_button_palette.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT management_button_color,management_button_text_color FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, {
      management_button_color: "#D3EB7A",
      management_button_text_color: "#172018",
    });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona a paleta dos blocos e controles", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-control-surfaces-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(await readFile(new URL("../drizzle/0051_control_surface_palette.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT control_surface_color,control_text_color FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, {
      control_surface_color: "#202B26",
      control_text_color: "#F2F5F3",
    });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("menu administrativo aplica a cor configurada com contraste derivado", async () => {
  const [branding, styles, admin] = await Promise.all([
    readFile(new URL("../app/InstanceBranding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/branding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(branding, /--admin-sidebar.*adminSidebarColor/);
  assert.match(branding, /--admin-sidebar-contrast.*contrastTextColor/);
  assert.match(branding, /--management-background.*managementBackgroundColor/);
  assert.match(branding, /--management-surface.*managementSurfaceColor/);
  assert.match(branding, /--management-button.*managementButtonColor/);
  assert.match(branding, /--management-button-text.*managementButtonTextColor/);
  assert.match(branding, /--control-surface.*controlSurfaceColor/);
  assert.match(branding, /--control-text.*controlTextColor/);
  assert.match(styles, /background:\s*var\(--admin-sidebar/);
  assert.match(admin, /Menu lateral administrativo/);
  assert.match(admin, /Fundo da gestão e do site atual/);
  assert.match(admin, /Botões principais da gestão/);
  assert.match(admin, /Destaques do tema clássico/);
  assert.match(admin, /Cartões da gestão e do site atual/);
  assert.match(admin, /Botões principais da gestão e do site/);
  assert.match(admin, /Texto dos botões da gestão e do site/);
  assert.match(admin, /Containers auxiliares e campos/);
  assert.match(admin, /Texto dos containers auxiliares/);
});

test("tema moderno usa a paleta configurável nos blocos e no financeiro", async () => {
  const [theme, statistics] = await Promise.all([
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/estatisticas/statistics.css", import.meta.url), "utf8"),
  ]);
  assert.match(theme, /\.admin-shell :is\([\s\S]*\.rating-slider[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.finance-page \.finance-head[\s\S]*background:\s*transparent/);
  assert.match(theme, /\.finance-page :is\([\s\S]*\.finance-dashboard-actions[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.finance-page \.finance-closure-notice \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.finance-page \.finance-closure-notice > button \{[\s\S]*var\(--management-button/);
  assert.match(theme, /\.finance-page \.finance-closure-comparison\.error[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.finance-page \.competence-picker \.localized-month-input \{[\s\S]*var\(--control-text/);
  assert.match(theme, /Public functional surfaces reuse the palette/);
  assert.match(theme, /\.member-page :is\([\s\S]*\.round-center[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.member-page :is\([\s\S]*\.round-center-grid > article[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.member-page \.primary[\s\S]*var\(--management-button/);
  assert.match(theme, /\.finance-page \.primary \{[\s\S]*var\(--management-button-text/);
  assert.match(theme, /\.member-page \.round-center > header \{[\s\S]*background:\s*transparent/);
  assert.match(theme, /body:has\(:is\([\s\S]*\.site-footer \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.app-download-badge \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.statistics-page :is\(\.empty, \.statistics-loading, \.versus-empty\) \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.statistics-page \.statistics-record-grid > article \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.statistics-page \.streak-players > span \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.statistics-page \.streak-players b \{[\s\S]*var\(--control-text/);
  assert.match(theme, /\.app-shell :is\(\.public-player-empty, \.public-player-list-title > b\) \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.app-shell \.public-player-tr\.tier-row \{[\s\S]*var\(--management-surface[\s\S]*var\(--roster-tier-accent/);
  assert.match(theme, /\.app-shell \.public-player-tr > strong,[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.advanced-statistics-page :is\([\s\S]*\.advanced-section[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.advanced-statistics-page :is\([\s\S]*\.advanced-highlight-grid article[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell :is\(\.audit-toolbar > div, \.audit-list article\) \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.admin-shell :is\([\s\S]*\.career-season-status[\s\S]*\.card-tier-settings[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.expanded-weights \.weight-total\.valid \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.expanded-weights \.weight-total\.invalid \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.admin-main \.admin-card\.table \{[\s\S]*overflow:\s*hidden;[\s\S]*background-clip:\s*padding-box/);
  assert.match(theme, /\.admin-shell \.admin-main \.admin-card\.table > \.tr \+ \.tr \{[\s\S]*border-top:\s*1px solid var\(--management-line/);
  assert.match(statistics, /\.statistics-period\{[^}]*var\(--control-surface/);
  assert.match(statistics, /\.monthly-awards-pending\{[^}]*var\(--control-surface/);
});

test("migração adiciona a apresentação dos logotipos sem ocultar a identidade existente", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-brand-presentation-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.prepare("UPDATE instance_configuration SET site_name='Peladix'").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0048_brand_presentation.sql", import.meta.url), "utf8"));
    const row = await bindings.DB.prepare("SELECT site_name,public_logo_size,admin_logo_size,show_public_brand_text,show_admin_brand_text FROM instance_configuration WHERE id=1").first();
    assert.deepEqual({ ...row }, { site_name: "Peladix", public_logo_size: 44, admin_logo_size: 54, show_public_brand_text: 1, show_admin_brand_text: 1 });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("cabeçalhos público e administrativo usam tamanhos e textos independentes", async () => {
  const [branding, styles, admin] = await Promise.all([
    readFile(new URL("../app/InstanceBranding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/branding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(branding, /--brand-public-logo-height/);
  assert.match(branding, /--brand-admin-logo-height/);
  assert.match(branding, /naturalWidth/);
  assert.match(branding, /fitBrandLogo/);
  assert.match(branding, /showPublicBrandText/);
  assert.match(styles, /\.brand \.brand-mark/);
  assert.match(styles, /\.admin-brand \.brand-mark/);
  assert.match(admin, /Apresentação dos logotipos/);
  assert.match(admin, /BrandIdentity previewConfig/);
  assert.match(admin, /Arquivo carregado/);
});
