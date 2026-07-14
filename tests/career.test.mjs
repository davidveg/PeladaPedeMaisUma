import assert from "node:assert/strict";
import test from "node:test";
import { defaultCareerConfig, matchWinner, rankCareerVotes, validateCareerConfig, validateCareerVote } from "../lib/career.ts";

const participantIds=["a","b","c","d","e","f","g"];
const valid={voterPlayerId:"a",motmThirdId:"b",motmSecondId:"c",motmFirstId:"d",dotmThirdId:"e",dotmSecondId:"f",dotmFirstId:"g"};

test("determina vencedor e empate pelo placar",()=>{assert.equal(matchWinner(3,1),"BLUE");assert.equal(matchWinner(0,2),"YELLOW");assert.equal(matchWinner(2,2),"DRAW")});
test("valida os valores padrão do Modo Carreira",()=>assert.equal(validateCareerConfig(defaultCareerConfig),true));
test("impede auto voto, repetição entre categorias e não participantes",()=>{
 assert.match(validateCareerVote({...valid,motmFirstId:"a"},participantIds),/si mesmo/);
 assert.match(validateCareerVote({...valid,dotmFirstId:"b"},participantIds),/somente uma vez/);
 assert.match(validateCareerVote({...valid,voterPlayerId:"x"},participantIds),/não participou/);
 assert.equal(validateCareerVote(valid,participantIds),null);
});
test("classifica votos por pesos 3, 2 e 1 com desempate por primeiros lugares",()=>{
 const votes=[
  {motm_third_id:"b",motm_second_id:"c",motm_first_id:"d"},
  {motm_third_id:"c",motm_second_id:"b",motm_first_id:"d"},
  {motm_third_id:"d",motm_second_id:"b",motm_first_id:"c"},
 ];
 const ranking=rankCareerVotes(votes,"motm");
 assert.deepEqual(ranking.map(entry=>entry.playerId),["d","c","b"]);
 assert.deepEqual(ranking.map(entry=>entry.place),[1,2,3]);
});
