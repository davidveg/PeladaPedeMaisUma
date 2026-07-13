import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordResetToken, hashPasswordResetToken, validNewPassword, validPasswordResetToken } from "../lib/password-reset-token.ts";

test("token de recuperação é aleatório e armazenável somente como hash", async () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();
  const hash = await hashPasswordResetToken(first);
  assert.equal(validPasswordResetToken(first), true);
  assert.notEqual(first, second);
  assert.notEqual(hash, first);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test("nova senha respeita os critérios mínimos", () => {
  assert.equal(validNewPassword("NovaSenha123"), true);
  assert.equal(validNewPassword("curta"), false);
  assert.equal(validNewPassword("admin"), false);
});
