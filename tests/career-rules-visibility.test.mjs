import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [site, mobile, publicMapper] = await Promise.all([
  readFile(new URL("../app/FootballApp.tsx", import.meta.url), "utf8"),
  readFile(new URL("../mobile/src/separation-detail.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-separation.ts", import.meta.url), "utf8"),
]);

test("site e aplicativo explicam os pesos históricos de resultados e votações", () => {
  for (const source of [site, mobile]) {
    assert.match(source, /CONFIGURAÇÃO HISTÓRICA/);
    assert.match(source, /Vitórias e derrotas/i);
    assert.match(source, /Votações/i);
    assert.match(source, /resultMomentumMultiplier/);
    assert.match(source, /momentumMultiplier/);
    assert.match(source, /motmFirst/);
    assert.match(source, /dotmFirst/);
    assert.match(source, /atua somente sobre seu saldo/);
    assert.match(source, /PONTOS BRUTOS DE MOMENTUM/);
    assert.doesNotMatch(source, /× no OVR/);
  }
});

test("a interface recebe a configuração congelada na confirmação da partida", () => {
  assert.match(publicMapper, /career_config_snapshot/);
  assert.match(publicMapper, /config:/);
});
