import assert from "node:assert/strict";
import test from "node:test";
import { passwordResetEndpoint } from "../src/password-recovery.ts";

test("usa o fluxo de recuperação correspondente ao perfil autenticado", () => {
  assert.equal(passwordResetEndpoint("player"), "/api/member-password-reset");
  assert.equal(passwordResetEndpoint("admin"), "/api/password-reset");
});
