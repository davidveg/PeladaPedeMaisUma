import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/partidas/match-hub.css", import.meta.url), "utf8");
const source = await readFile(new URL("../app/partidas/MatchHubApp.tsx", import.meta.url), "utf8");
const rules = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, selectors]) => selectors.trim() === selector).map(([, , declarations]) => declarations);

test("placar reserva três colunas sem separar um time do outro", () => {
  const score = rules(".match-hub-score")[0];
  assert.match(score, /display:inline-grid/);
  assert.match(score, /grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(score, /flex-shrink:0/);
  assert.match(score, /max-width:100%/);
  assert.doesNotMatch(score, /flex-wrap:wrap/);
  assert.match(rules(".match-hub-detail-head")[0], /grid-template-columns:minmax\(0,1fr\) auto/);
});

test("no celular o placar inteiro passa para baixo dos dados da partida", () => {
  const mobile = css.slice(css.indexOf("@media(max-width:650px)"));
  assert.match(mobile, /\.match-hub-detail-head\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(mobile, /\.match-hub-detail-head>\.match-hub-score\{max-width:100%;justify-self:start\}/);
});

test("nomes longos podem quebrar dentro do time sem quebrar os números ou perder as cores", () => {
  assert.equal((source.match(/className="match-hub-team-name"/g) || []).length, 2);
  assert.match(rules(".match-hub-score .match-hub-team-name")[0], /overflow-wrap:anywhere/);
  assert.match(rules(".match-hub-score b")[0], /white-space:nowrap/);
  assert.match(rules(".match-hub-score .blue")[0], /var\(--blue/);
  assert.match(rules(".match-hub-score .yellow")[0], /var\(--yellow/);
  assert.match(source, /aria-label=\{`Placar:/);
});
