import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(new URL("../app/partidas/MatchCardScore.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/partidas/match-hub.css", import.meta.url), "utf8");
const hub = await readFile(new URL("../app/partidas/MatchHubApp.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
runInNewContext(compiled, { exports, require(name) {
  if (name === "react/jsx-runtime") return jsxRuntime;
  throw new Error(`Unexpected import: ${name}`);
} });
const { MatchCardScore } = exports;
const render = (blueScore, yellowScore, blueName = "Vermelho", yellowName = "Azul") => renderToStaticMarkup(jsxRuntime.jsx(MatchCardScore, { blueScore, yellowScore, blueName, yellowName }));
const rules = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) => selectors.trim() === selector).map(([, , declarations]) => declarations);

test("cartões sem resultado completo não mostram placar fictício", () => {
  for (const [blue, yellow] of [[null, null], [null, 7], [3, null], [undefined, undefined], [NaN, 0], [0, Infinity]]) assert.equal(render(blue, yellow), "");
});

test("placar final destaca ambos os números, incluindo zero, empate e dois dígitos", () => {
  for (const [blue, yellow] of [[0, 0], [3, 7], [10, 12], [100, 99]]) {
    const html = render(blue, yellow);
    assert.match(html, /Placar final<\/span>/);
    assert.match(html, new RegExp(`<strong>${blue}</strong>`));
    assert.match(html, new RegExp(`<strong>${yellow}</strong>`));
    assert.ok(html.includes(`aria-label="Placar final: Vermelho ${blue} a ${yellow} Azul"`));
  }
});

test("preserva nomes completos e usa as cores configuradas na identidade da pelada", () => {
  const name = "Equipe Vermelha com nome bastante longo & convidados";
  const html = render(7, 3, name, "Branco");
  assert.ok(html.includes("Equipe Vermelha com nome bastante longo &amp; convidados"));
  assert.match(rules(".match-hub-final-score-team.blue")[0], /var\(--blue-ink,var\(--blue\)\)/);
  assert.match(rules(".match-hub-final-score-team.yellow")[0], /var\(--yellow-ink,var\(--yellow\)\)/);
  assert.match(rules(".match-hub-final-score-team.blue")[0], /border-top-color:var\(--blue\)/);
  assert.match(rules(".match-hub-final-score-team.yellow")[0], /border-top-color:var\(--yellow\)/);
  assert.match(hub, /<MatchCardScore blueScore=\{entry.blueScore\} yellowScore=\{entry.yellowScore\} blueName=\{brand.teamBlueName\} yellowName=\{brand.teamYellowName\}/);
});

test("grade mantém dois times lado a lado e permite nomes longos sem altura fixa", () => {
  assert.match(rules(".match-hub-final-score-board")[0], /grid-template-columns:minmax\(0,1fr\) 18px minmax\(0,1fr\)/);
  assert.match(rules(".match-hub-final-score")[0], /width:340px;max-width:100%;min-width:0/);
  assert.match(rules(".match-hub-final-score-name")[0], /overflow-wrap:anywhere/);
  assert.doesNotMatch(rules(".match-hub-final-score-team")[0], /(?:^|;)height:/);
  assert.doesNotMatch(rules(".match-hub-final-score-name")[0], /line-clamp|overflow:hidden/);
  const numbers = rules(".match-hub-final-score-team strong")[0];
  assert.match(numbers, /font-size:clamp\(32px,3.5vw,46px\)/);
  assert.match(numbers, /white-space:nowrap/);
  const mobile = css.slice(css.indexOf("@media(max-width:650px)"));
  assert.match(mobile, /\.match-hub-final-score\{width:100%\}/);
  assert.match(mobile, /\.match-hub-card-action\{[^}]*width:100%/);
});

test("alteração fica na listagem e preserva navegação e placar compacto do detalhe", () => {
  assert.match(hub, /className="match-hub-card" href=\{matchHubHref\(entry\)\}/);
  assert.match(hub, /<ScoreSummary item=\{item\}/);
  assert.doesNotMatch(hub, /<ScoreSummary item=\{entry\}/);
  assert.match(hub, /Ver partida →/);
});
