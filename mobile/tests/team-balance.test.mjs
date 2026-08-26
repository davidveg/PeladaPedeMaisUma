import assert from "node:assert/strict";
import test from "node:test";
import { balanceRating, recalculateTeamResult } from "../src/team-balance.ts";

const player = (id, primaryPosition, value = 3) => ({ id, displayName: id, fullName: id, type: "monthly", primaryPosition, speed: value, skill: value, marking: value, momentum: 0 });
const blue = [player("b-def", "Defesa"), player("b-att", "Ataque")];
const yellow = [player("y-def", "Defesa"), player("y-att", "Ataque")];
const result = { blue, yellow, rating: "", cost: 0, speedWeight: .48, skillWeight: .32, markingWeight: .2, momentumMultiplier: 1, maximumPositionDifference: 1, protectedTopPlayersPercentage: .25, algorithmAttempts: 2500 };

test("recalcula uma divisão equivalente como excelente", () => {
  const next = recalculateTeamResult(result, blue, yellow);
  assert.equal(next.rating, "Excelente equilíbrio");
  assert.equal(next.cost, 0);
  assert.deepEqual(next.delta, {
    players: 0, defenders: 0, midfielders: 0, attackers: 0, speed: 0, skill: 0, marking: 0,
    tacticalIntelligence:0, competitiveness:0, momentum: 0, historicalLearning:0, score: 0, balancingScore:0,
    advantage:{players:"EVEN",defenders:"EVEN",midfielders:"EVEN",attackers:"EVEN",speed:"EVEN",skill:"EVEN",marking:"EVEN",tacticalIntelligence:"EVEN",competitiveness:"EVEN",momentum:"EVEN",historicalLearning:"EVEN",score:"EVEN"},
  });
  assert.equal(next.blueMetrics.scoreAvg, 3);
  assert.equal(next.yellowMetrics.scoreAvg, 3);
});

test("transferência individual atualiza quantidade, custo e classificação", () => {
  const moved = blue[1];
  const next = recalculateTeamResult(result, [blue[0]], [...yellow, moved]);
  assert.equal(next.delta.players, 2);
  assert.equal(next.delta.advantage.players, "YELLOW");
  assert.equal(next.delta.advantage.attackers, "YELLOW");
  assert.ok(next.cost >= 2000);
  assert.equal(next.rating, "Equilíbrio limitado");
});

test("lista ímpar recalcula dois times-base e identifica o jogador adicional",()=>{
  const additional=player("b-mid","Meio-campo"),next=recalculateTeamResult(result,[...blue,additional],yellow);
  assert.equal(next.extraId,additional.id);
  assert.equal(next.blueBaseMetrics.count,next.yellowBaseMetrics.count);
  assert.equal(next.blueBaseMetrics.count,2);
  assert.equal(next.blueBaseMetrics.scoreAvg,next.yellowBaseMetrics.scoreAvg);
  assert.equal(next.delta.baseTeams,true);
  assert.equal(next.delta.players,1);
  assert.equal(next.cost,0);
});

test("lista ímpar não escolhe um jogador protegido como adicional",()=>{
  const star={...player("star","Ataque"),speed:5,skill:5,marking:5,tacticalIntelligence:5,competitiveness:5},additional=player("regular","Meio-campo");
  const next=recalculateTeamResult({...result,protectedTopPlayersPercentage:.25},[...blue,star,additional],[...yellow,player("y-extra","Ataque")]);
  assert.notEqual(next.extraId,star.id);
});

test("usa a posição secundária quando ela reduz a diferença entre as faixas",()=>{
  const flexible={...player("flex","Ataque"),secondaryPosition:"Meio-campo"};
  const next=recalculateTeamResult(result,[player("b-def-2","Defesa"),flexible],[player("y-def-2","Defesa"),player("y-mid","Meio-campo")]);
  assert.equal(next.delta.midfielders,0);
  assert.equal(next.delta.attackers,0);
  assert.equal(next.cost,0);
});

test("usa as mesmas faixas de classificação do algoritmo", () => {
  assert.equal(balanceRating(34.99), "Excelente equilíbrio");
  assert.equal(balanceRating(35), "Bom equilíbrio");
  assert.equal(balanceRating(80), "Equilíbrio aceitável");
  assert.equal(balanceRating(150), "Equilíbrio limitado");
});
