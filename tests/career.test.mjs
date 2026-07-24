import assert from "node:assert/strict";
import test from "node:test";
import { careerVoteForAuthenticatedPlayer, defaultCareerConfig, matchWinner, rankCareerVotes, teamMomentumForResult, validateCareerConfig, validateCareerVote } from "../lib/career.ts";

const participantIds=["a","b","c","d","e","f","g"];
const valid={voterPlayerId:"a",motmThirdId:"b",motmSecondId:"c",motmFirstId:"d",dotmThirdId:"e",dotmSecondId:"f",dotmFirstId:"g"};

test("determina vencedor e empate pelo placar",()=>{assert.equal(matchWinner(3,1),"BLUE");assert.equal(matchWinner(0,2),"YELLOW");assert.equal(matchWinner(2,2),"DRAW")});
test("calcula o momentum da equipe e a diferença necessária ao corrigir o resultado",()=>{
 assert.equal(teamMomentumForResult("BLUE","BLUE",.1,-.1),.1);
 assert.equal(teamMomentumForResult("BLUE","YELLOW",.1,-.1),-.1);
 assert.equal(teamMomentumForResult("DRAW","BLUE",.1,-.1),0);
 const correction=teamMomentumForResult("YELLOW","BLUE",.1,-.1)-teamMomentumForResult("BLUE","BLUE",.1,-.1);
 assert.ok(Math.abs(correction-(-.2))<Number.EPSILON*4);
});
test("valida os valores padrão do Modo Carreira",()=>assert.equal(validateCareerConfig(defaultCareerConfig),true));
test("limita o multiplicador de momentum entre zero e cinco",()=>{assert.equal(validateCareerConfig({...defaultCareerConfig,momentumMultiplier:0}),true);assert.equal(validateCareerConfig({...defaultCareerConfig,momentumMultiplier:5}),true);assert.equal(validateCareerConfig({...defaultCareerConfig,momentumMultiplier:-.1}),false);assert.equal(validateCareerConfig({...defaultCareerConfig,momentumMultiplier:5.1}),false)});
test("valida os limites crescentes dos níveis de card",()=>{assert.equal(validateCareerConfig({...defaultCareerConfig,cardBronzeMax:2.4,cardSilverMax:3.9,cardGoldMax:4.5}),true);assert.equal(validateCareerConfig({...defaultCareerConfig,cardBronzeMax:4,cardSilverMax:3.9}),false);assert.equal(validateCareerConfig({...defaultCareerConfig,cardGoldMax:5}),false);assert.equal(validateCareerConfig({...defaultCareerConfig,cardSilverMax:3.95}),false)});
test("impede auto voto, repetição entre categorias e não participantes",()=>{
 assert.match(validateCareerVote({...valid,motmFirstId:"a"},participantIds),/si mesmo/);
 assert.match(validateCareerVote({...valid,dotmFirstId:"b"},participantIds),/somente uma vez/);
 assert.match(validateCareerVote({...valid,voterPlayerId:"x"},participantIds),/não participou/);
 assert.equal(validateCareerVote(valid,participantIds),null);
});
test("usa o jogador associado à conta e ignora identidade enviada pelo cliente",()=>{
 const vote=careerVoteForAuthenticatedPlayer({...valid,voterPlayerId:"fraudador"},"a");
 assert.equal(vote.voterPlayerId,"a");
 assert.equal(validateCareerVote(vote,participantIds),null);
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
