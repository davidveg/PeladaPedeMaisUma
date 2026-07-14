import assert from "node:assert/strict";
import test from "node:test";
import { createSmtpMailer } from "../server/selfhost-mailer.mjs";

test("mailer permanece desativado sem credenciais e URL pública", async () => {
  const mailer = createSmtpMailer({});
  assert.equal(mailer.configured, false);
  await assert.rejects(() => mailer.sendPasswordReset({ to: "admin@example.com", token: "a".repeat(64) }), /não configurado/);
  await assert.rejects(() => mailer.sendPasswordChanged({ to: "admin@example.com", changedAt: new Date().toISOString() }), /não configurado/);
});

test("mailer de produção rejeita link de redefinição sem HTTPS", () => {
  const mailer = createSmtpMailer({ SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_USER: "pelada@example.com", SMTP_PASSWORD: "app-password", SMTP_FROM: "pelada@example.com", APP_BASE_URL: "http://pelada.example.com" });
  assert.equal(mailer.configured, false);
});

test("mailer gera mensagem de redefinição com transporte local de teste", async () => {
  const mailer = createSmtpMailer({
    SMTP_JSON_TRANSPORT: "true",
    SMTP_FROM: "Pelada <pelada@example.com>",
    APP_BASE_URL: "https://pelada.example.com",
  });
  const result = await mailer.sendPasswordReset({ to: "admin@example.com", token: "a".repeat(64) });
  assert.equal(mailer.configured, true);
  assert.ok(result.messageId);
});

test("mailer envia aviso de alteração sem receber ou informar a senha", async () => {
  const mailer = createSmtpMailer({
    SMTP_JSON_TRANSPORT: "true",
    SMTP_FROM: "Pelada <pelada@example.com>",
    APP_BASE_URL: "https://pelada.example.com",
    TZ: "America/Sao_Paulo",
  });
  const result = await mailer.sendPasswordChanged({ to: "admin@example.com", changedAt: "2026-07-14T12:00:00.000Z" });
  assert.ok(result.messageId);
});
