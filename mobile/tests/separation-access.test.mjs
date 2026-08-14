import assert from "node:assert/strict";
import test from "node:test";
import {
  manualSeparationEntryVisible,
  separationBuilderAllowed,
} from "../src/separation-access.ts";

test("exibe a entrada manual para administradores e moderadores autorizados", () => {
  assert.equal(manualSeparationEntryVisible({ role: "admin" }, true), true);
  assert.equal(manualSeparationEntryVisible({ role: "admin" }, false), false);
  assert.equal(manualSeparationEntryVisible({ role: "moderator", permissions: ["SEPARATIONS_MANAGE"] }, true), true);
  assert.equal(manualSeparationEntryVisible({ role: "moderator", permissions: [] }, true), false);
  assert.equal(manualSeparationEntryVisible({ role: "player" }, true), false);
});

test("mantém a montagem iniciada por uma partida mesmo com a importação manual desligada", () => {
  assert.equal(separationBuilderAllowed({ role: "admin" }, false, "match-1"), true);
  assert.equal(separationBuilderAllowed({ role: "admin" }, false), false);
  assert.equal(separationBuilderAllowed({ role: "moderator", permissions: ["SEPARATIONS_MANAGE"] }, false, "match-1"), true);
  assert.equal(separationBuilderAllowed({ role: "player" }, true, "match-1"), false);
});
