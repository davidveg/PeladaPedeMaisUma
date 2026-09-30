import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("site gera e compartilha a imagem da seleção mensal", async () => {
  const [statistics, imageClient] = await Promise.all([
    readFile(new URL("../app/estatisticas/StatisticsApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recap-image-client.ts", import.meta.url), "utf8"),
  ]);
  assert.match(statistics, /renderRecapPng\(captureRef\.current,title,"#202b26"\)/);
  assert.match(statistics, /shareRecapFile\(image,title,message\)/);
  assert.match(statistics, /Compartilhar seleção no WhatsApp/);
  assert.match(imageClient, /backgroundColor = "#fbf7ed"/);
});

test("site gera e compartilha a imagem do jogador do mês", async () => {
  const statistics = await readFile(new URL("../app/estatisticas/StatisticsApp.tsx", import.meta.url), "utf8");
  assert.match(statistics, /renderRecapPng\(captureRef\.current,title,"#123f31"\)/);
  assert.match(statistics, /Jogador do mês · \$\{standing\.player\.displayName\}/);
  assert.match(statistics, /Compartilhar destaque no WhatsApp/);
});
