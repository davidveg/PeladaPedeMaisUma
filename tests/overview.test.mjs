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
  assert.match(source, /className="overview-score-team blue"/);
  assert.match(source, /className="overview-score-team yellow"/);
  assert.match(source, /aria-label=\{`Placar final:/);
  assert.match(route, /m\.status='OPEN'/);
  assert.match(route, /monthly_career_awards/);
});

test("a visão geral reúne jogador, equilíbrio e histórico", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/visao-geral/OverviewApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visao-geral/overview.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /Resumo do jogador/);
  assert.match(source, /overview-player-empty/);
  assert.match(styles, /\.overview-player-empty>p\{[^}]*margin:10px 0 18px/);
  assert.match(styles, /\.overview-player-empty>a\{[^}]*display:inline-flex/);
  assert.match(source, /Equilíbrio da última escalação/);
  assert.match(source, /Últimas partidas/);
  assert.match(styles, /var\(--control-surface/);
  assert.match(styles, /\.overview-main header\{position:static/);
  assert.match(source, /balance\.metrics\.map/);
  assert.match(styles, /\.overview-balance-metrics/);
  assert.match(styles, /\.overview-balance-bar\.even>i b\{background:var\(--muted/);
  assert.match(styles, /\.overview-balance-bar\.blue>i b\{background:var\(--blue\)/);
  assert.match(styles, /\.overview-balance-bar\.yellow>i b\{background:var\(--yellow\)/);
  assert.match(styles, /\.overview-last-score \.overview-score-team\{--score-team:var\(--blue\)[^}]*background:linear-gradient/);
  assert.match(styles, /\.overview-last-score \.overview-score-team\.yellow\{--score-team:var\(--yellow\)\}/);
  assert.match(styles, /box-shadow:inset 0 -4px 0 var\(--score-team\)/);
  assert.match(styles, /@media\(max-width:560px\)/);
});

test("a saudação usa o instante do servidor e o fuso configurado durante a hidratação", async () => {
  const [source, page, home] = await Promise.all([
    readFile(new URL("../app/visao-geral/OverviewApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/visao-geral/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HomeApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<OverviewApp initialNow=\{new Date\(\)\.toISOString\(\)\}\/>/);
  assert.match(home, /<OverviewApp initialNow=\{new Date\(\)\.toISOString\(\)\}\/>/);
  assert.match(source, /OverviewApp\(\{ initialNow \}: \{ initialNow: string \}\)/);
  assert.match(source, /config\.timezone\|\|"America\/Sao_Paulo"/);
  assert.match(source, /hourCycle:"h23",timeZone/);
  assert.match(source, /month:"long",timeZone/);
  assert.doesNotMatch(source, /new Date\(\)\.getHours\(\)/);
});
