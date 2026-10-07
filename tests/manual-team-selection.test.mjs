import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("site oferece escolha manual completa antes de publicar", async () => {
  const source = await readFile(new URL("../app/FootballApp.tsx", import.meta.url), "utf8");
  assert.match(source, /Como deseja montar os times\?/);
  assert.match(source, /Escolha manual/);
  assert.match(source, /remaining===0&&blue\.length>0&&yellow\.length>0/);
  assert.match(source, /recalculateTeamBalance\(blue,yellow,config\)/);
  assert.match(source, /selectionMethod:\s*"manual"/);
});

test("aplicativo oferece o mesmo método e bloqueia distribuição incompleta", async () => {
  const source = await readFile(new URL("../mobile/app/(app)/new-separation.tsx", import.meta.url), "utf8");
  assert.match(source, /Escolher jogadores manualmente/);
  assert.match(source, /Distribuição manual/);
  assert.match(source, /remaining===0&&blue>0&&yellow>0/);
  assert.match(source, /recalculateTeamResult\(current\.result,blue,yellow\)/);
  assert.match(source, /selectionMethod:\s*"manual"/);
});

test("servidor normaliza o método no snapshot e mantém a validação dos presentes", async () => {
  const source = await readFile(new URL("../lib/scheduled-matches.ts", import.meta.url), "utf8");
  assert.match(source, /input\?\.selectionMethod === "manual" \? "manual" : "automatic"/);
  assert.match(source, /new Set\(submitted\)\.size !== submitted\.length/);
  assert.match(source, /!blueIds\.length \|\| !yellowIds\.length/);
});

test("cartões da escolha manual herdam a identidade visual configurável", async () => {
  const theme = await readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8");
  assert.match(theme, /\.app-shell \.separation-method-grid > button[\s\S]*?var\(--management-surface/);
  assert.match(theme, /\.app-shell \.separation-method-grid > button small[\s\S]*?var\(--management-muted/);
  assert.match(theme, /\.app-shell \.manual-team-counts span[\s\S]*?var\(--control-surface/);
  assert.match(theme, /\.app-shell \.manual-player-list article[\s\S]*?var\(--management-surface/);
  assert.match(theme, /\.manual-blue\[aria-pressed="true"\][\s\S]*?var\(--blue-contrast/);
  assert.match(theme, /\.manual-yellow\[aria-pressed="true"\][\s\S]*?var\(--yellow-contrast/);
});
