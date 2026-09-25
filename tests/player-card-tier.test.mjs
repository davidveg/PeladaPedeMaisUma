import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("cards usam hierarquia compacta e textura metálica sem sobrepor textos", async()=>{
 const [publicCard,memberCard,theme]=await Promise.all([
  readFile(new URL("../app/FootballApp.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/conta/MemberApp.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/experimental-modern-theme.css",import.meta.url),"utf8"),
 ]);
 assert.match(publicCard,/className="card-position-line"/);
 assert.match(memberCard,/className="card-position-line"/);
 assert.match(theme,/\.card-position-line \{[\s\S]*overflow-wrap:\s*anywhere/);
 assert.match(theme,/Scratched brushed metal[\s\S]*repeating-linear-gradient\(7deg/);
 assert.match(theme,/\.player-card-modal \.card-identity h2,[\s\S]*overflow-wrap:\s*anywhere/);
});
