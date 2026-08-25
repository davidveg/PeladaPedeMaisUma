import assert from "node:assert/strict";
import test from "node:test";
import { rebuildEditedSeparation } from "../lib/separation-team-edit.ts";

const player = (id, position, speed) => ({ id, displayName: id, fullName: id, type: "monthly", primaryPosition: position, speed, skill: speed, marking: 3, tacticalIntelligence: 3, competitiveness: 3, momentum: 0 });
const snapshot = { blue: [player("a", "Defesa", 4), player("b", "Ataque", 3)], yellow: [player("c", "Defesa", 3), player("d", "Ataque", 4)], speedWeight: .35, skillWeight: .25, markingWeight: .15, tacticalIntelligenceWeight: .2, competitivenessWeight: .05, maximumPositionDifference: 1 };

test("transfere jogadores de uma separação pendente e recalcula os indicadores", () => {
  const result = rebuildEditedSeparation(snapshot, ["a"], ["c", "d", "b"]);
  assert.deepEqual(result.blue.map(value => value.id), ["a"]);
  assert.deepEqual(result.yellow.map(value => value.id), ["c", "d", "b"]);
  assert.equal(result.delta.players, 2);
  assert.equal(typeof result.cost, "number");
  assert.equal(typeof result.rating, "string");
});

test("preserva o equilíbrio por times-base ao editar uma lista ímpar",()=>{
  const extra=player("e","Meio-campo",3),odd={...snapshot,blue:[...snapshot.blue,extra]};
  const result=rebuildEditedSeparation(odd,["a","b","e"],["c","d"]);
  assert.equal(result.extraId,"e");
  assert.equal(result.blueBaseMetrics.count,result.yellowBaseMetrics.count);
  assert.equal(result.delta.baseTeams,true);
  assert.equal(result.delta.players,1);
});

test("não permite perder, repetir ou inventar jogadores durante a edição", () => {
  assert.throws(() => rebuildEditedSeparation(snapshot, ["a", "b"], ["c"]), /exatamente/);
  assert.throws(() => rebuildEditedSeparation(snapshot, ["a", "b"], ["c", "c"]), /exatamente/);
  assert.throws(() => rebuildEditedSeparation(snapshot, ["a", "b"], ["c", "x"]), /exatamente/);
});
