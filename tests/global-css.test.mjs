import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a folha global preserva os tokens e o layout estrutural do site", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /:root\{[^}]*--cream:#f5f7f3[^}]*--green:#174d3b/);
  assert.match(css, /header\{height:76px;[^}]*display:flex;[^}]*position:sticky/);
  assert.match(css, /\.content\{max-width:1140px;/);
  assert.match(css, /\.history-list article\{[^}]*border-radius:14px;/);
});

test("o financeiro não propaga largura de desktop para telas de celular", async () => {
  const [css, layout] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /export const viewport:[\s\S]*width: "device-width"/);
  assert.match(css, /\.finance-page\{[^}]*overflow-x:clip/);
  assert.match(css, /\.finance-secondary-grid\{[^}]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:480px\)[\s\S]*?\.finance-metrics,[^}]*\.finance-secondary-grid[^}]*\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /@media\(max-width:480px\)[\s\S]*?\.finance-tabs\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.finance-table-wrap\{[^}]*overflow-x:auto/);
});

test("o editor de pesos mantém o número e o símbolo de porcentagem na mesma linha", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.expanded-weights \.weight-number\{[^}]*display:grid;[^}]*grid-template-columns:minmax\(0,1fr\) auto;[^}]*white-space:nowrap/);
  assert.match(css, /\.expanded-weights \.weight-number span\{[^}]*line-height:1;[^}]*white-space:nowrap/);
  assert.match(css, /\.expanded-weights \.weight-editor\{[^}]*grid-template-columns:minmax\(0,1fr\) 76px/);
  assert.match(css, /\.expanded-weights \.weight-number\{[^}]*width:76px;[^}]*min-height:38px/);
  assert.match(css, /@media\(max-width:600px\)[^\n]*\.expanded-weights \.weight-editor\{grid-template-columns:minmax\(0,1fr\) 74px/);
});
