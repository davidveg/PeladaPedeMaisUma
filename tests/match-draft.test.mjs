import assert from "node:assert/strict";
import test from "node:test";
import { scoresFromContributions, validateMatchDraft } from "../lib/match-draft.ts";

const blueIds=["b1","b2"],yellowIds=["y1","y2"];

test("rascunho calcula o placar automaticamente pelos gols registrados",()=>{
 const contributions=[
  {team:"BLUE",scorerPlayerId:"b1",assistPlayerId:"b2",ownGoal:false},
  {team:"YELLOW",scorerPlayerId:"y1",assistPlayerId:null,ownGoal:false},
  {team:"BLUE",scorerPlayerId:"y2",assistPlayerId:null,ownGoal:true},
 ];
 assert.deepEqual(scoresFromContributions(contributions),{blueScore:2,yellowScore:1});
 assert.equal(validateMatchDraft({contributions,blueIds,yellowIds}).error,null);
});

test("rascunho rejeita autor e assistência incompatíveis com a equipe",()=>{
 const invalid=[{team:"BLUE",scorerPlayerId:"y1",assistPlayerId:"b2",ownGoal:false}];
 assert.match(validateMatchDraft({contributions:invalid,blueIds,yellowIds}).error,/autor do time correspondente/);
});
