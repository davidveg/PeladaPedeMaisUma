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
  assert.equal(config.guestPreconfirmationEnabled, false);
  assert.equal(config.guestConfirmationThreshold, 16);
  assert.equal(config.shareImageUrl, null);
  assert.equal(config.faviconUrl, null);
});

test("aceita identidade, cores e dia da semana personalizados", () => {
  const result = validateInstanceConfiguration({
    ...DEFAULT_INSTANCE_CONFIGURATION,
    siteName: "Futebol de Quarta",
    siteShortName: "FDQ",
    appName: "FDQ",
    primaryColor: "#123ABC",
    defaultMatchWeekday: 3,
    defaultMatchTime: "20:30",
    confirmationLeadMinutes: 180,
    teamBlueName: "Camisa",
    teamYellowName: "Sem camisa",
    manualSeparationEnabled: true,
    guestPreconfirmationEnabled: true,
    guestConfirmationThreshold: 18,
    shareImageUrl: "/api/upload?key=branding%2Fsocial.png",
    faviconUrl: "/api/upload?key=branding%2Ffavicon.ico",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.config.siteName, "Futebol de Quarta");
  assert.equal(result.config.defaultMatchWeekday, 3);
  assert.equal(result.config.teamBlueName, "Camisa");
  assert.equal(result.config.teamYellowName, "Sem camisa");
  assert.equal(result.config.manualSeparationEnabled, true);
  assert.equal(result.config.guestPreconfirmationEnabled, true);
  assert.equal(result.config.guestConfirmationThreshold, 18);
  assert.equal(result.config.shareImageUrl, "/api/upload?key=branding%2Fsocial.png");
  assert.equal(result.config.faviconUrl, "/api/upload?key=branding%2Ffavicon.ico");
});

test("mantém colunas e valores alinhados ao salvar a configuração", () => {
  const config = { ...DEFAULT_INSTANCE_CONFIGURATION, manualSeparationEnabled: true, guestPreconfirmationEnabled: true, guestConfirmationThreshold: 20 };
  assert.equal(INSTANCE_CONFIGURATION_COLUMNS.length, instanceConfigurationValues(config).length);
  const index = INSTANCE_CONFIGURATION_COLUMNS.indexOf("manual_separation_enabled");
  assert.equal(instanceConfigurationValues(config)[index], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("guest_preconfirmation_enabled")], 1);
  assert.equal(instanceConfigurationValues(config)[INSTANCE_CONFIGURATION_COLUMNS.indexOf("guest_confirmation_threshold")], 20);
});

test("rejeita cores, horários e logotipos externos inseguros", () => {
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, primaryColor: "verde" }).error, /hexadecimal/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, defaultMatchTime: "25:00" }).error, /HH:MM/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, logoUrl: "http://inseguro.example/logo.png" }).error, /logotipo/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, shareImageUrl: "http://inseguro.example/social.png" }).error, /compartilhamento/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, faviconUrl: "http://inseguro.example/favicon.ico" }).error, /favicon/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, teamYellowName: "Azul" }).error, /diferentes/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, guestConfirmationThreshold: 0 }).error, /mínimo/);
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
