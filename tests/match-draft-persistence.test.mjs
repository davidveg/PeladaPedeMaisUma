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
