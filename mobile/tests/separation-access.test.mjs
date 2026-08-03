import assert from "node:assert/strict";
import test from "node:test";
import {
  manualSeparationEntryVisible,
  separationBuilderAllowed,
} from "../src/separation-access.ts";

test("exibe a entrada manual somente para administrador quando habilitada", () => {
  assert.equal(manualSeparationEntryVisible("admin", true), true);
  assert.equal(manualSeparationEntryVisible("admin", false), false);
  assert.equal(manualSeparationEntryVisible("member", true), false);
});

test("mantém a montagem iniciada por uma partida mesmo com a importação manual desligada", () => {
  assert.equal(separationBuilderAllowed("admin", false, "match-1"), true);
  assert.equal(separationBuilderAllowed("admin", false), false);
  assert.equal(separationBuilderAllowed("member", true, "match-1"), false);
});
