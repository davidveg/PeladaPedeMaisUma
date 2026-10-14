import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("site amplia badges pessoais, coletivos e do Hall da Fama somente com mouse", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /@media\(hover:hover\) and \(pointer:fine\)/);
  assert.match(css, /:is\(\.achievement-badge,\.collective-badge,\.hall-record-badge\):hover/);
  assert.match(css, /transform:scale\(1\.8\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
