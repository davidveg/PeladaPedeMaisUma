import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });

const { MAX_EMAIL_LENGTH, normalizeEmail } = await import("../lib/email.ts");

test("normaliza e-mails válidos sem alterar endereços aceitos", () => {
  assert.equal(normalizeEmail(" Jogador+Teste@Exemplo.COM "), "jogador+teste@exemplo.com");
  assert.equal(normalizeEmail("usuario@sub.dominio.com.br"), "usuario@sub.dominio.com.br");
});

test("rejeita formatos ambíguos e limites incompatíveis com e-mail", () => {
  for (const value of [null, 42, "sem-arroba.example", "dois@@example.com", ".inicio@example.com", "fim.@example.com", "usuario@example", "usuario@-example.com", "usuario@example..com"]) {
    assert.equal(normalizeEmail(value), null);
  }
  assert.equal(normalizeEmail(`${"a".repeat(65)}@example.com`), null);
  assert.equal(normalizeEmail(`${"a".repeat(MAX_EMAIL_LENGTH)}@example.com`), null);
});

test("descarta a carga usada no ReDoS antes de analisar o formato", () => {
  const malicious = "!@" + "!@".repeat(32_000);
  assert.equal(normalizeEmail(malicious), null);
});
