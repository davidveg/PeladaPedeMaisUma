import assert from "node:assert/strict";
import test from "node:test";
import { dismissedRecently, evaluateRelease } from "../src/app-version-policy.ts";

test("detecta atualização opcional pela build instalada", () => {
  assert.deepEqual(evaluateRelease(7, { enabled: true, publishedAt: "2026-07-27T12:00:00Z", latestBuild: 8, minimumBuild: 6 }), { available: true, required: false });
});

test("bloqueia builds abaixo da versão mínima", () => {
  assert.deepEqual(evaluateRelease(5, { enabled: true, publishedAt: "2026-07-27T12:00:00Z", latestBuild: 8, minimumBuild: 6 }), { available: true, required: true });
});

test("ignora release desativada, não publicada ou já instalada", () => {
  assert.equal(evaluateRelease(7, { enabled: false, publishedAt: "2026-07-27T12:00:00Z", latestBuild: 8, minimumBuild: 6 }).available, false);
  assert.equal(evaluateRelease(7, { enabled: true, publishedAt: null, latestBuild: 8, minimumBuild: 6 }).available, false);
  assert.equal(evaluateRelease(8, { enabled: true, publishedAt: "2026-07-27T12:00:00Z", latestBuild: 8, minimumBuild: 6 }).available, false);
});

test("lembra novamente após vinte e quatro horas", () => {
  const now = Date.parse("2026-07-28T12:00:00Z"), day = 24 * 60 * 60 * 1000;
  assert.equal(dismissedRecently(now - day + 1, now, day), true);
  assert.equal(dismissedRecently(now - day, now, day), false);
});
