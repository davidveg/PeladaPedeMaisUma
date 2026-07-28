import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_INSTANCE_CONFIGURATION,
  instanceConfigurationFromRow,
  validateInstanceConfiguration,
} from "../lib/instance-config.ts";
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
  });
  assert.equal(result.error, undefined);
  assert.equal(result.config.siteName, "Futebol de Quarta");
  assert.equal(result.config.defaultMatchWeekday, 3);
  assert.equal(result.config.teamBlueName, "Camisa");
  assert.equal(result.config.teamYellowName, "Sem camisa");
});

test("rejeita cores, horários e logotipos externos inseguros", () => {
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, primaryColor: "verde" }).error, /hexadecimal/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, defaultMatchTime: "25:00" }).error, /HH:MM/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, logoUrl: "http://inseguro.example/logo.png" }).error, /logotipo/);
  assert.match(validateInstanceConfiguration({ ...DEFAULT_INSTANCE_CONFIGURATION, teamYellowName: "Azul" }).error, /diferentes/);
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
