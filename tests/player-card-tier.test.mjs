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

test("cards preservam a textura metálica com a hierarquia textual clássica", async()=>{
 const [publicCard,memberCard,mobileCard,theme,globalStyles,ratingHelp,mobileRatingHelp]=await Promise.all([
  readFile(new URL("../app/FootballApp.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/conta/MemberApp.tsx",import.meta.url),"utf8"),
  readFile(new URL("../mobile/app/(app)/card.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/experimental-modern-theme.css",import.meta.url),"utf8"),
  readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  readFile(new URL("../lib/player-rating-help.ts",import.meta.url),"utf8"),
  readFile(new URL("../mobile/src/player-card.ts",import.meta.url),"utf8"),
 ]);
 assert.match(publicCard,/className=\{`card-role\$\{player\.secondaryPosition\?' has-secondary':''\}`\}/);
 assert.match(memberCard,/className=\{`member-role\$\{player\.secondaryPosition\?' has-secondary':''\}`\}/);
 assert.match(publicCard,/<small>POSIÇÃO PRINCIPAL<\/small>/);
 assert.match(memberCard,/<small>POSIÇÃO PRINCIPAL<\/small>/);
 assert.doesNotMatch(publicCard,/stat\.shortLabel/);
 assert.doesNotMatch(memberCard,/stat\.shortLabel/);
 assert.match(theme,/Scratched brushed metal[\s\S]*repeating-linear-gradient\(7deg/);
 assert.match(theme,/Restore the original information hierarchy[\s\S]*\.card-role\.has-secondary/);
 assert.match(theme,/\.player-card-modal \.card-identity h2,[\s\S]*overflow-wrap:\s*anywhere/);
 assert.match(theme,/\.player-card-modal \.card-stats > span,[\s\S]*grid-template-rows:\s*34px 28px/);
 assert.doesNotMatch(theme,/\.player-card-modal \.card-stats span,/);
 assert.match(theme,/\.player-card-modal \.card-stats b,[\s\S]*font-size:\s*27px/);
 assert.match(theme,/\.player-card-modal \.card-stats > span:last-child b,[\s\S]*font-size:\s*29px/);
 assert.match(theme,/\.player-card-modal \.card-photo \.large-player-photo,[\s\S]*width:\s*240px[\s\S]*aspect-ratio:\s*1/);
 assert.match(theme,/\.card-evolution-highlight \{[\s\S]*min-height:\s*62px[\s\S]*border:\s*1px solid[\s\S]*border-radius:\s*11px[\s\S]*background:\s*rgba\(255, 248, 214, \.22\)/);
 assert.match(theme,/@media \(max-width: 560px\) \{[\s\S]*\.player-card-modal \.card-top,[\s\S]*\.member-card \.member-card-top \{[\s\S]*grid-template-columns:\s*84px minmax\(0, 1fr\)[\s\S]*column-gap:\s*10px[\s\S]*\.player-card-modal \.card-evolution-highlight,[\s\S]*width:\s*calc\(100% - 2px\)/);
 assert.match(publicCard,/className="card-side-metrics"[\s\S]*className="card-evolution-highlight"[\s\S]*PLAYER_RATING_HELP\.evolution[\s\S]*className="card-stats"[\s\S]*momentum-stat \$\{momentumClass\}[\s\S]*PLAYER_RATING_HELP\.momentum/);
 assert.match(memberCard,/className="card-side-metrics"[\s\S]*className="card-evolution-highlight"[\s\S]*PLAYER_RATING_HELP\.evolution[\s\S]*className="card-stats"[\s\S]*momentum-stat \$\{momentumClass\}[\s\S]*PLAYER_RATING_HELP\.momentum/);
 assert.match(mobileCard,/accessibilityLabel=\{`Ver explicação de \$\{label\}`\}[\s\S]*Alert\.alert\(label,help\)/);
 assert.match(mobileCard,/styles\.topMetrics[\s\S]*styles\.featuredRating[\s\S]*Alert\.alert\("Evolução",PLAYER_RATING_HELP\.evolution\)/);
 assert.match(mobileCard,/backgroundColor: palette\.stats, borderColor: palette\.statsBorder/);
 assert.match(mobileCard,/label==="Momentum"\?PLAYER_RATING_HELP\.momentum[\s\S]*label === "Momentum" \? momentumColor/);
 assert.match(mobileCard,/momentum > 0[\s\S]*#155E3D[\s\S]*momentum < 0[\s\S]*#8F3028/);
 for(const text of [/Ajuste permanente somado ao overall/,/Ajuste temporário somado ao overall/]){
  assert.match(ratingHelp,text);
  assert.match(mobileRatingHelp,text);
 }
 assert.doesNotMatch(globalStyles,/\.card-stats>\.momentum-stat/);
 assert.match(theme,/\.card-stats > \.momentum-stat\.positive > b \{[\s\S]*color:\s*#155e3d/);
 assert.match(theme,/\.card-stats > \.momentum-stat\.negative > b \{[\s\S]*color:\s*#8f3028/);
});
