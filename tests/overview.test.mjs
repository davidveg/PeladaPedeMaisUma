import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a visão geral alterna entre partida aberta e última pelada", async () => {
  const [source, route] = await Promise.all([
    readFile(new URL("../app/visao-geral/OverviewApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/overview/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(source, /data\.openMatch\|\|data\.latestMatch/);
  assert.match(source, /Confirmar presença/);
  assert.match(source, /Ver resultado/);
  assert.match(route, /m\.status='OPEN'/);
  assert.match(route, /monthly_career_awards/);
});

test("a visão geral reúne jogador, equilíbrio e histórico", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/visao-geral/OverviewApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visao-geral/overview.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /Resumo do jogador/);
  assert.match(source, /Equilíbrio da última escalação/);
  assert.match(source, /Últimas partidas/);
  assert.match(styles, /var\(--control-surface/);
  assert.match(styles, /\.overview-main header\{position:static/);
  assert.match(source, /balance\.metrics\.map/);
  assert.match(styles, /\.overview-balance-metrics/);
  assert.match(styles, /\.overview-balance-bar\.even>i b\{background:var\(--muted/);
  assert.match(styles, /\.overview-balance-bar\.blue>i b\{background:var\(--blue\)/);
  assert.match(styles, /\.overview-balance-bar\.yellow>i b\{background:var\(--yellow\)/);
  assert.match(styles, /@media\(max-width:560px\)/);
});
