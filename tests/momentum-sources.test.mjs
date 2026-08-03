import assert from "node:assert/strict";
import test from "node:test";
import { splitLegacyMomentumSources } from "../lib/momentum-sources.ts";

test("reconstrói as origens do momentum preservando o total histórico", () => {
  const separated = splitLegacyMomentumSources([
    { id: "p1", momentum: 0.5 },
    { id: "p2", momentum: -0.2 },
    { id: "p3", momentum: 0.1 },
  ], [JSON.stringify({
    motm: [{ playerId: "p1", momentum: 0.3 }],
    dotm: [{ playerId: "p2", momentum: -0.1 }],
  })]);
  assert.deepEqual(separated, [
    { id: "p1", resultMomentum: 0.2, votingMomentum: 0.3 },
    { id: "p2", resultMomentum: -0.1, votingMomentum: -0.1 },
    { id: "p3", resultMomentum: 0.1, votingMomentum: 0 },
  ]);
  for (const entry of separated) {
    const original = [0.5, -0.2, 0.1][separated.indexOf(entry)];
    assert.equal(Math.round((entry.resultMomentum + entry.votingMomentum) * 1000) / 1000, original);
  }
});
