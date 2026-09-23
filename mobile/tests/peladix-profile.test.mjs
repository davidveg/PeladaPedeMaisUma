import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const eas = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
const firebase = JSON.parse(readFileSync(new URL("../google-services-peladix.json", import.meta.url), "utf8"));

test("perfis da Peladix usam somente sua identidade EAS e Firebase", () => {
  for (const profileName of ["peladix-preview", "peladix-production"]) {
    const env = eas.build[profileName].env;
    assert.equal(env.EXPO_EAS_PROJECT_ID, "4a4cf359-9c40-43b8-93bd-57a2ab53aa43");
    assert.equal(env.EXPO_UPDATES_URL, "https://u.expo.dev/4a4cf359-9c40-43b8-93bd-57a2ab53aa43");
    assert.equal(env.EXPO_APP_SLUG, "pelada-peladix");
    assert.equal(env.EXPO_ANDROID_PACKAGE, "br.com.peladix.app");
    assert.equal(env.EXPO_GOOGLE_SERVICES_FILE, "./google-services-peladix.json");
  }

  assert.equal(firebase.project_info.project_id, "peladix-361e7");
  assert.ok(firebase.client.some((client) => client.client_info.android_client_info.package_name === "br.com.peladix.app"));
});
