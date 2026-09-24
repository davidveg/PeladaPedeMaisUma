import assert from "node:assert/strict";
import test from "node:test";
import { fitBrandLogo } from "../lib/brand-logo.ts";

test("mantém um logotipo quadrado inteiro dentro da altura máxima", () => {
  assert.deepEqual(fitBrandLogo(1254, 1254, 180, 64), { width: 64, height: 64, aspectRatio: 1 });
});

test("reduz logotipos horizontais pela largura sem deformar", () => {
  const fit = fitBrandLogo(1200, 400, 180, 64);
  assert.equal(fit.width, 180);
  assert.equal(fit.height, 60);
  assert.equal(fit.aspectRatio, 3);
});

test("preserva logotipos verticais pela altura configurada", () => {
  const fit = fitBrandLogo(400, 800, 180, 64);
  assert.equal(fit.width, 32);
  assert.equal(fit.height, 64);
  assert.equal(fit.aspectRatio, .5);
});

test("usa dimensões seguras enquanto a imagem ainda não carregou", () => {
  assert.deepEqual(fitBrandLogo(0, 0, 180, 64), { width: 64, height: 64, aspectRatio: 1 });
});
