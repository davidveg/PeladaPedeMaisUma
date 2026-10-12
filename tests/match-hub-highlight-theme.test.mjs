import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("personal highlights use theme-aware surfaces and text on web and mobile", async () => {
  const [webCss, mobileDetail] = await Promise.all([
    readFile(new URL("../app/partidas/match-hub.css", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/match-hub-detail.tsx", import.meta.url), "utf8"),
  ]);

  const personalRule = [...webCss.matchAll(/\.round-center-personal\s*\{(?<body>[^}]*)\}/gs)].at(-1)?.groups?.body || "";
  assert.match(personalRule, /background:\s*color-mix\([^;]*var\(--control-surface/);
  assert.match(personalRule, /color:\s*var\(--control-text/);
  assert.doesNotMatch(personalRule, /#fff8dc/i);

  assert.match(mobileDetail, /styles\.personal, \{ backgroundColor: palette\.yellowSoft, borderColor: palette\.yellow \}/);
  assert.match(mobileDetail, /personal: \{[^}]*borderWidth: 1/);
  assert.doesNotMatch(mobileDetail, /backgroundColor: "#FFF8DC"/);
});
