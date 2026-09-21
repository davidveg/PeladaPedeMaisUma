import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../app/components/SiteFooter.tsx", import.meta.url), "utf8");
const football = readFileSync(new URL("../app/FootballApp.tsx", import.meta.url), "utf8");

test("rodapé compartilhado aparece pelo layout e não fica duplicado em Jogadores", () => {
  assert.match(layout, /<SiteFooter\s*\/>/);
  assert.doesNotMatch(football, /className="site-footer"/);
  assert.match(footer, /className="site-footer"/);
});

test("rodapé mantém os aplicativos e fica oculto no painel administrativo", () => {
  assert.match(footer, /pathname === "\/admin"/);
  assert.match(footer, /pathname\.startsWith\("\/admin\/"\)/);
  assert.match(footer, /\/baixar-app\?platform=android/);
  assert.match(footer, /\/baixar-app\?platform=ios/);
});
