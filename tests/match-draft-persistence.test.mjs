import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const football = readFileSync(new URL("../app/FootballApp.tsx", import.meta.url), "utf8");
const standalone = readFileSync(new URL("../app/sumula/MatchDraftApp.tsx", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../mobile/src/separation-detail.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/career/draft/route.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("site preserva a súmula localmente e sincroniza o rascunho completo", () => {
  assert.match(football, /localStorage\.setItem\(cacheKey/);
  assert.match(standalone, /localStorage\.setItem\(`ppm\.match-draft\./);
  assert.match(football, /participation:\{blueIds:blueParticipantIds,yellowIds:yellowParticipantIds\}/);
  assert.match(route, /const next = \{ contributions, blueScore, yellowScore, participation:/);
});

test("aplicativo recupera o rascunho local e também o envia ao servidor", () => {
  assert.match(mobile, /AsyncStorage\.getItem\(cacheKey\)/);
  assert.match(mobile, /AsyncStorage\.setItem\(cacheKey/);
  assert.match(mobile, /apiFetch<\{draft:DraftPayload\["draft"\]\}>\(`\/api\/career\/draft/);
});

test("placar pendente tem apresentação centralizada e destacada", () => {
  assert.match(styles, /career-match-card\.pending \.career-score-inputs\{display:grid/);
  assert.match(styles, /font:800 31px Georgia,serif;text-align:center/);
});

test("participação efetiva aparece depois dos lançamentos no fechamento", () => {
  const pending = football.slice(football.indexOf("if(!career)return"), football.indexOf("if(editingResult)return"));
  assert.ok(pending.indexOf('className="contribution-editor"') < pending.indexOf("<ParticipationEditor"));
});

test("quatro grupos de pontuação do Momentum cabem na mesma linha larga", () => {
  assert.match(styles, /career-rule-points\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:980px\)\{\.career-rule-points\{grid-template-columns:repeat\(2/);
});
