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
  assert.equal(config.guestSelfConfirmationEnabled, false);
  assert.equal(config.guestSelfConfirmationLeadHours, 48);
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
    guestSelfConfirmationEnabled: true,
    guestSelfConfirmationLeadHours: 72,
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
  assert.equal(result.config.guestSelfConfirmationEnabled, true);
  assert.equal(result.config.guestSelfConfirmationLeadHours, 72);
  assert.equal(result.config.guestConfirmationThreshold, 18);
  assert.equal(result.config.financeEnabled, false);
  assert.equal(result.config.delinquencyAttendanceBlockEnabled, true);
  assert.equal(result.config.allowInsecureLocalNetworkAuth, true);
  assert.equal(result.config.shareImageUrl, "/api/upload?key=branding%2Fsocial.png");
  assert.equal(result.config.faviconUrl, "/api/upload?key=branding%2Ffavicon.ico");
});

test("mantém colunas e valores alinhados ao salvar a configuração", () => {
  const config = { ...DEFAULT_INSTANCE_CONFIGURATION, manualSeparationEnabled: true, separationDraftsEnabled: true, guestPreconfirmationEnabled: true, guestConfirmationThreshold: 20, guestSelfConfirmationEnabled: true, guestSelfConfirmationLeadHours: 72, financeEnabled: false, delinquencyAttendanceBlockEnabled: true, allowInsecureLocalNetworkAuth: true };
  assert.equal(INSTANCE_CONFIGURATION_COLUMNS.length, instanceConfigurationValues(config).length);
  const index = INSTANCE_CONFIGURATION_COLUMNS.indexOf("manual_separation_enabled");
  assert.equal(instanceConfigurationValues(config)[index], 0);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("separation_drafts_enabled")], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("guest_preconfirmation_enabled")], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("guest_confirmation_threshold")], 20);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("guest_self_confirmation_enabled")], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("guest_self_confirmation_lead_hours")], 72);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("finance_enabled")], 0);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("delinquency_attendance_block_enabled")], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("allow_insecure_local_network_auth")], 1);
});

test("migração define 48 horas como antecedência padrão dos convidados", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-guest-confirmation-lead-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE instance_configuration (id INTEGER PRIMARY KEY)").run();
    await bindings.DB.prepare("INSERT INTO instance_configuration (id) VALUES (1)").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0055_guest_confirmation_default_lead.sql", import.meta.url), "utf8"));
    assert.equal(await bindings.DB.prepare("SELECT guest_self_confirmation_lead_hours FROM instance_configuration WHERE id=1").first("guest_self_confirmation_lead_hours"), 48);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração cria a confirmação própria de convidados desativada e sem abrir partidas", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-guest-self-confirmation-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0019_instance_configuration.sql", import.meta.url), "utf8"));
    await bindings.DB.exec(`CREATE TABLE scheduled_matches (id TEXT PRIMARY KEY);`);
    await bindings.DB.exec(await readFile(new URL("../drizzle/0053_guest_self_confirmation.sql", import.meta.url), "utf8"));
    const config = await bindings.DB.prepare("SELECT guest_self_confirmation_enabled FROM instance_configuration WHERE id=1").first();
    const columns = await bindings.DB.prepare("PRAGMA table_info(scheduled_matches)").all();
    assert.deepEqual({ ...config }, { guest_self_confirmation_enabled: 0 });
    assert.ok(columns.results.some(column => column.name === "guest_confirmation_opens_at"));
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
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
  assert.match(branding, /--management-button-contrast.*contrastTextColor\(config\.managementButtonColor\)/);
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
  assert.match(admin, /const teamSettings=\[\["teamBlueName","Nome da primeira equipe","teamBlueColor"\],\["teamYellowName","Nome da segunda equipe","teamYellowColor"\]\]/);
  assert.match(admin, /className="instance-team-grid"/);
  assert.match(styles, /\.instance-team-grid \{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("tema moderno usa a paleta configurável nos blocos e no financeiro", async () => {
  const [theme, statistics, admin, globals] = await Promise.all([
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/estatisticas/statistics.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(theme, /\.admin-shell :is\([\s\S]*\.rating-slider[\s\S]*var\(--control-surface/);
  assert.match(statistics, /\.monthly-pitch \{[\s\S]*background-image:\s*repeating-linear-gradient\(0deg/);
  assert.match(theme, /\.admin-shell \.rating-slider > \.rating-slider-value \{[\s\S]*var\(--management-button[\s\S]*var\(--management-button-contrast/);
  assert.match(admin, /backgroundColor:brand\.managementButtonColor,color:contrastTextColor\(brand\.managementButtonColor\)/);
  assert.match(admin, /className="rating-slider-value" style=\{valueStyle\}/);
  assert.match(theme, /\.finance-page \.finance-head[\s\S]*background:\s*transparent/);
  assert.match(theme, /\.finance-page :is\([\s\S]*\.finance-dashboard-actions[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.finance-page \.finance-closure-notice \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.finance-page \.finance-closure-notice > button \{[\s\S]*var\(--management-button/);
  assert.match(theme, /\.finance-page \.finance-closure-comparison\.error[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.finance-page \.competence-picker \.localized-month-input \{[\s\S]*var\(--control-text/);
  assert.match(theme, /\.finance-page \.finance-dialog,[\s\S]*form\.finance-card \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.finance-page \.finance-dialog \.editor-actions \{[\s\S]*var\(--management-line/);
  assert.match(theme, /Public functional surfaces reuse the palette/);
  assert.match(theme, /\.member-page :is\([\s\S]*\.round-center[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.member-page :is\([\s\S]*\.round-center-grid > article[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.member-page \.primary[\s\S]*var\(--management-button/);
  assert.match(theme, /\.member-page \.team-player > \.team-player-score,[\s\S]*\.app-shell \.team-player > \.team-player-score \{[\s\S]*var\(--management-button[\s\S]*var\(--management-button-contrast/);
  const football = await readFile(new URL("../app/FootballApp.tsx", import.meta.url), "utf8");
  assert.match(football, /backgroundColor:brand\.managementButtonColor,color:contrastTextColor\(brand\.managementButtonColor\)/);
  assert.match(football, /className="team-player-score" style=\{scoreChipStyle\}/);
  assert.match(theme, /\.app-shell \.section-head \.balance \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.app-shell \.result-actions \.ghost \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /:is\(\.app-shell, \.member-page\) \.career-match-card\.pending \.career-score-inputs \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /:is\(\.app-shell, \.member-page\) \.career-result-editor \.career-score-inputs \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /:is\(\.app-shell, \.member-page\) \.career-result-editor \.career-score-inputs label:first-child input \{[\s\S]*var\(--control-surface[\s\S]*var\(--blue[\s\S]*var\(--control-text/);
  assert.match(theme, /:is\(\.app-shell, \.member-page\) \.career-result-editor \.career-score-inputs label:last-child input \{[\s\S]*var\(--control-surface[\s\S]*var\(--yellow[\s\S]*var\(--control-text/);
  assert.match(theme, /\.app-shell \.contribution-row select,[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.app-shell \.participation-team \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.app-shell \.career-rules-snapshot \{[\s\S]*var\(--management-surface[\s\S]*var\(--management-text/);
  assert.match(theme, /\.app-shell \.career-rules-snapshot > header,[\s\S]*\.career-rule-points > article \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.member-page :is\(\.participation-summary, \.career-rules-snapshot\)[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.vote-page \.vote-brand,[\s\S]*\.vote-page \.vote-card[\s\S]*var\(--management-surface[\s\S]*var\(--management-text/);
  assert.match(theme, /\.vote-page :is\([\s\S]*\.vote-podium,[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.app-shell > main \{[\s\S]*padding-bottom:\s*clamp/);
  assert.match(theme, /\.finance-page \.primary \{[\s\S]*var\(--management-button-text/);
  assert.match(theme, /\.member-page \.round-center > header \{[\s\S]*background:\s*transparent/);
  assert.match(theme, /body:has\(:is\([\s\S]*\.site-footer \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.app-download-badge \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.statistics-page :is\(\.empty, \.statistics-loading, \.versus-empty\) \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.statistics-page \.statistics-record-grid > article \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.statistics-page \.streak-players > span \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.statistics-page \.streak-players b \{[\s\S]*var\(--control-text/);
  assert.match(theme, /\.statistics-page \.versus-picker select,[\s\S]*\.versus-score,[\s\S]*\.versus-matches > a \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.statistics-page \.versus-player b,[\s\S]*\.versus-matches > a :is\(b, strong\) \{[\s\S]*var\(--control-text/);
  assert.match(theme, /\.statistics-page \.versus-matches > a strong\.winner \{[\s\S]*var\(--management-button[\s\S]*var\(--management-button-text/);
  assert.match(theme, /\.app-shell :is\(\.public-player-empty, \.public-player-list-title > b\) \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.app-shell \.public-players \{[\s\S]*padding-bottom:\s*clamp/);
  assert.match(theme, /\.app-shell \.public-player-tr\.tier-row \{[\s\S]*var\(--management-surface[\s\S]*var\(--roster-tier-accent/);
  assert.match(theme, /\.app-shell \.public-player-tr > strong,[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.advanced-statistics-page :is\([\s\S]*\.advanced-section[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.advanced-statistics-page :is\([\s\S]*\.advanced-highlight-grid article[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell :is\(\.audit-toolbar > div, \.audit-list article\) \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.admin-shell :is\([\s\S]*\.career-season-status[\s\S]*\.card-tier-settings[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.expanded-weights \.weight-total\.valid \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.expanded-weights \.weight-total\.invalid \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.card-tier-option\.bronze \.career-number > span \{[\s\S]*color:\s*#321f16/);
  assert.match(theme, /\.admin-shell \.card-tier-option\.silver \.career-number > span \{[\s\S]*color:\s*#202a2f/);
  assert.match(theme, /\.admin-shell \.card-tier-option\.gold \.career-number > span \{[\s\S]*color:\s*#30270d/);
  assert.match(theme, /\.admin-shell \.career-award-actions > button:first-child \{[\s\S]*var\(--management-button[\s\S]*var\(--management-button-text/);
  assert.match(theme, /\.admin-shell :is\(\.release-admin-intro, \.release-admin-form\) \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.admin-shell \.release-version-grid :is\(input, textarea\),[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.release-version-grid textarea \{[\s\S]*scrollbar-gutter:\s*stable[\s\S]*scrollbar-color:/);
  assert.match(theme, /\.admin-shell \.release-version-grid textarea::-webkit-scrollbar-thumb \{[\s\S]*var\(--control-text[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.release-version-grid textarea::-webkit-scrollbar-button \{[\s\S]*display:\s*none/);
  assert.match(theme, /\.admin-shell \.release-platform,[\s\S]*\.release-platform\.enabled \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.release-platform\.enabled \{[\s\S]*var\(--management-button/);
  assert.match(theme, /\.admin-shell \.release-admin-help \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.moderator-editor > header \{[\s\S]*position:\s*static[\s\S]*background:\s*transparent[\s\S]*var\(--management-line/);
  assert.match(theme, /\.admin-shell \.moderator-permission-grid :is\(label, article\),[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.admin-shell \.moderator-permission-grid label\.selected \{[\s\S]*var\(--management-button[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.moderator-promotion-modal \.ghost,[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.match-admin-surface :is\(\.match-admin-toolbar, \.match-admin-card, \.match-admin-detail, \.separation-draft-setting\) \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.match-admin-surface \.match-attendance-summary span \{[\s\S]*var\(--control-line/);
  assert.match(theme, /\.match-admin-surface \.match-player-admin-list > div,[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.member-page \.editor \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.member-page \.editor :is\(input, select, textarea\),[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.member-page :is\([\s\S]*\.player-achievements,[\s\S]*\.notification-preferences-card,[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.member-page :is\([\s\S]*\.member-profile-actions,[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.member-page \.member-profile-actions dl > div \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.member-page \.member-profile-actions dl > div dd \{[\s\S]*var\(--control-text/);
  assert.match(theme, /\.member-page \.player-financial-history \.finance-table-wrap \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.member-page \.player-financial-history \.finance-table td \{[\s\S]*var\(--control-text/);
  assert.match(theme, /\.member-page \.player-financial-history \.finance-table td:first-child \{[\s\S]*display:\s*table-cell/);
  assert.match(theme, /\.member-page \.player-financial-history \.finance-history-link \{[\s\S]*var\(--management-button/);
  assert.match(theme, /\.member-page \.notification-site-item \{[\s\S]*var\(--management-surface[\s\S]*var\(--management-text/);
  assert.match(theme, /\.member-page \.notification-site-item\.unread \{[\s\S]*var\(--management-button[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.member-page \.notification-site-toolbar select \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.member-page \.notification-site-main \.member-account-head \{[\s\S]*align-items:\s*flex-start/);
  assert.match(theme, /\.member-page :is\(\.match-hub-pagination, \.notification-pagination\),[\s\S]*\.admin-shell :is\(\.career-pagination, \.audit-pagination\),[\s\S]*\.match-admin-surface \.match-admin-pagination \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.member-page :is\(\.match-hub-pagination, \.notification-pagination\) \.ghost,[\s\S]*\.match-admin-surface \.match-admin-pagination \.ghost \{[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.member-page :is\(\.match-hub-pagination, \.notification-pagination\) \.ghost:disabled,[\s\S]*opacity:\s*1/);
  assert.match(theme, /\.member-page :is\([\s\S]*\.achievement-grid article,[\s\S]*\.retrospective-numbers,[\s\S]*\.notification-preferences-grid,[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.modal-back button\.close,[\s\S]*var\(--control-surface[\s\S]*var\(--control-text/);
  assert.match(theme, /\.modal-back button\.close:hover,[\s\S]*var\(--management-button[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-notice > button\[aria-label\^="Fechar"\] \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.admin-shell \.admin-main \.admin-card\.table \{[\s\S]*overflow:\s*hidden;[\s\S]*background-clip:\s*padding-box/);
  assert.match(theme, /\.admin-shell \.admin-main \.admin-card\.table > \.tr \+ \.tr \{[\s\S]*border-top:\s*1px solid var\(--management-line/);
  assert.match(globals, /\.association-summary>div\{[^}]*var\(--control-surface[^}]*var\(--control-text/);
  assert.match(globals, /\.table>\.tr\.admin-tr:not\(\.th\),\.table>\.tr\.member-association-tr:not\(\.th\)\{[^}]*var\(--management-surface[^}]*var\(--management-text/);
  assert.match(globals, /\.table>\.tr\.admin-tr:not\(\.th\)>span:not\(:first-child\),\.table>\.tr\.member-association-tr:not\(\.th\)>span:not\(:first-child\):not\(\.association-account-actions\)\{[^}]*var\(--control-surface[^}]*var\(--control-text/);
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

test("apresentação do logotipo aplica a mesma configuração nas áreas pública e administrativa", async () => {
  const [branding, styles, admin] = await Promise.all([
    readFile(new URL("../app/InstanceBranding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/branding.css", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
  ]);
  const presentationPanel = admin.match(/function BrandPresentationPanel[\s\S]*?function InstanceConfigForm/)?.[0] || "";
  assert.match(branding, /--brand-public-logo-height/);
  assert.match(branding, /--brand-admin-logo-height/);
  assert.match(branding, /naturalWidth/);
  assert.match(branding, /fitBrandLogo/);
  assert.match(branding, /showPublicBrandText/);
  assert.match(styles, /\.brand \.brand-mark/);
  assert.match(styles, /\.admin-brand \.brand-mark/);
  assert.match(admin, /Apresentação do logotipo/);
  assert.match(admin, /BrandIdentity previewConfig/);
  assert.match(admin, /Arquivo carregado/);
  assert.match(presentationPanel, /publicLogoSize:draft\.logoSize,adminLogoSize:draft\.logoSize/);
  assert.match(presentationPanel, /showPublicBrandText:draft\.showBrandText,showAdminBrandText:draft\.showBrandText/);
  assert.equal((presentationPanel.match(/type="range"/g) || []).length, 1);
  assert.match(presentationPanel, /Configuração única/);
});
