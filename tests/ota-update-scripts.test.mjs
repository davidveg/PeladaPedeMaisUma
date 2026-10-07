import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";

const applications = [
  {
    script: "pelada-pede-mais-uma",
    values: ["00374e15-c3c9-46fd-ab57-ebb23ee01635", "https://pedemaisuma.vegaalameda.com", "br.com.peladapedemaisuma.app"],
  },
  {
    script: "pelada-do-agriao",
    values: ["5c7cc851-84df-4e97-8405-35091dc56fa0", "https://peladadoagriao.vegaalameda.com", "br.com.peladadoagriao.app", "google-services-agriao.json"],
  },
  {
    script: "pelada-peladix",
    values: ["4a4cf359-9c40-43b8-93bd-57a2ab53aa43", "https://peladix.vegaalameda.com", "br.com.peladix.app", "google-services-peladix.json", "#440052"],
  },
];

for (const application of applications) test(`script Bash de ${application.script} replica a OTA preview Android do PowerShell`, async () => {
  const bashUrl = new URL(`../update-${application.script}.sh`, import.meta.url);
  const [bash, powershell] = await Promise.all([
    readFile(bashUrl, "utf8"),
    readFile(new URL(`../update-${application.script}.ps1`, import.meta.url), "utf8"),
  ]);

  assert.match(bash, /^#!\/usr\/bin\/env bash/);
  assert.match(bash, /set -Eeuo pipefail/);
  assert.match(bash, /command -v npx/);
  assert.match(bash, /node_modules\/expo-router\/package\.json/);
  assert.match(bash, /npm ci/);
  assert.match(bash, /--channel preview/);
  assert.match(bash, /--environment preview/);
  assert.match(bash, /--platform android/);

  for (const value of application.values) {
    assert.match(bash, new RegExp(value.replaceAll(".", "\\.")));
    assert.match(powershell, new RegExp(value.replaceAll(".", "\\.")));
  }

  await access(bashUrl, constants.X_OK);
});
