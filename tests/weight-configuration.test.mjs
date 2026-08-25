import assert from "node:assert/strict";
import test from "node:test";
import { updateWeightValue, weightTotalPercent } from "../lib/weight-configuration.ts";

test("a edição de um peso não altera os demais",()=>{
  const current={physical:.2,technique:.3,marking:.2,tactical:.25,competitiveness:.05};
  const next=updateWeightValue(current,"physical",.35);
  assert.deepEqual(next,{...current,physical:.35});
});

test("os pesos ficam entre 0% e 100% e usam pontos percentuais inteiros",()=>{
  const current={physical:.2};
  assert.equal(updateWeightValue(current,"physical",.236).physical,.24);
  assert.equal(updateWeightValue(current,"physical",2).physical,1);
  assert.equal(updateWeightValue(current,"physical",-1).physical,0);
});

test("o total do grupo é apresentado em porcentagem",()=>{
  const weights={physical:.2,technique:.3,marking:.2,tactical:.25,competitiveness:.05};
  assert.equal(weightTotalPercent(weights,Object.keys(weights)),100);
  assert.equal(weightTotalPercent({...weights,physical:.35},Object.keys(weights)),115);
});
