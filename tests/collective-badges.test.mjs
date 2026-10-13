import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { collectiveBadgeKey, collectiveBadgePath } from "../lib/collective-badges.ts";

const kinds = ["matches", "goals", "players", "attendance", "season", "anniversary"];

test("resolve uma imagem temática para cada tipo de marco coletivo", () => {
  for (const kind of kinds) {
    assert.equal(collectiveBadgeKey(kind), kind);
    assert.equal(collectiveBadgePath(kind), `/collective-achievements/${kind}.png`);
    const path = `public/collective-achievements/${kind}.png`;
    assert.equal(existsSync(path), true);
    assert.ok(statSync(path).size > 50_000);
  }
  assert.equal(collectiveBadgeKey("future-kind"), "unknown");
  assert.equal(collectiveBadgePath("future-kind"), "/collective-achievements/unknown.png");
});

test("site e aplicativo mantêm o emoji como fallback", () => {
  const site = readFileSync("app/components/CollectiveBadge.tsx", "utf8");
  const mobile = readFileSync("mobile/src/collective-badge.tsx", "utf8");
  assert.match(site, /onError/);
  assert.match(site, /icon \|\| "🏆"/);
  assert.match(mobile, /onError/);
  assert.match(mobile, /icon \|\| "🏆"/);
});
