import assert from "node:assert/strict";
import test from "node:test";
import { playerCardTier } from "../lib/player-card-tier.ts";

test("mantém todas as cartas douradas quando os níveis estão desativados",()=>{
 assert.equal(playerCardTier(1.2,false),"gold");
 assert.equal(playerCardTier(4.9,false),"gold");
});

test("classifica as cartas pelo overall arredondado em uma casa",()=>{
 assert.equal(playerCardTier(2.4,true),"bronze");
 assert.equal(playerCardTier(2.5,true),"silver");
 assert.equal(playerCardTier(3.9,true),"silver");
 assert.equal(playerCardTier(4,true),"gold");
 assert.equal(playerCardTier(4.5,true),"gold");
 assert.equal(playerCardTier(4.6,true),"legendary");
});

test("respeita os limites personalizados configurados pelo administrador",()=>{
 const settings={cardTiersEnabled:true,cardBronzeMax:2,cardSilverMax:3.5,cardGoldMax:4.2};
 assert.equal(playerCardTier(2,settings),"bronze");
 assert.equal(playerCardTier(2.1,settings),"silver");
 assert.equal(playerCardTier(3.6,settings),"gold");
 assert.equal(playerCardTier(4.3,settings),"legendary");
});
