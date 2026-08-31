import assert from "node:assert/strict";
import test from "node:test";
import { separationBuilderAllowed } from "../src/separation-access.ts";

test("exige uma partida mesmo para administradores e moderadores autorizados", () => {
  for (const account of [{ role: "admin" }, { role: "moderator", permissions: ["SEPARATIONS_MANAGE"] }]) {
    for (const matchId of [undefined, "", "  "]) assert.equal(separationBuilderAllowed(account, matchId), false);
    assert.equal(separationBuilderAllowed(account, "match-1"), true);
  }
});

test("a partida não concede permissão de montagem para contas sem autorização", () => {
  for (const account of [null, undefined, { role: "player" }, { role: "moderator", permissions: [] }])
    assert.equal(separationBuilderAllowed(account, "match-1"), false);
});
