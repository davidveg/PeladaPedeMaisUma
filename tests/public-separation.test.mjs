import assert from "node:assert/strict";
import test from "node:test";
import { publicSeparation } from "../lib/public-separation.ts";

test("snapshot público preserva times e regras sem expor a lista original", () => {
  const snapshot = { blue: [{ displayName: "Azul", speed: 4 }], yellow: [{ displayName: "Amarelo", speed: 3 }], speedWeight: .48, skillWeight: .32, markingWeight: .2, maximumPositionDifference: 1, protectedTopPlayersPercentage: .25, algorithmAttempts: 2500 };
  const result = publicSeparation({
    id: "one",
    match_title: "Pelada pública",
    match_date: "2026-07-14",
    location: null,
    original_text: "lista privada do WhatsApp",
    snapshot: JSON.stringify(snapshot),
    balance_classification: "Excelente equilíbrio",
    balance_score: 0,
    confirmed_at: "2026-07-14T12:00:00.000Z",
    manually_adjusted: 0,
    deleted_at: null,
  });
  assert.equal(result.matchTitle, "Pelada pública");
  assert.equal(result.snapshot.blue[0].displayName, "Azul");
  assert.equal(result.snapshot.markingWeight, .2);
  assert.equal(result.snapshot.maximumPositionDifference, 1);
  assert.equal(result.snapshot.algorithmAttempts, 2500);
  assert.equal(result.originalText, undefined);
  assert.equal(result.original_text, undefined);
  assert.equal(result.deleted_at, undefined);
});
