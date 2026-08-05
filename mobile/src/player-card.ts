import type { Player, ProfilePayload } from "./types";

export type PlayerCardTier = "default" | "bronze" | "silver" | "gold" | "legendary";
export type CardConfig = ProfilePayload["config"];
export const isKeeper = (player: Player) => player.type === "goalkeeper" || player.primaryPosition === "Goleiro";

export function playerMomentumContribution(player: Player, votingMultiplier = 1, resultMultiplier = 1) {
  const separated = player.resultMomentum != null || player.votingMomentum != null;
  return separated ? (player.resultMomentum ?? 0) * resultMultiplier + (player.votingMomentum ?? 0) * votingMultiplier : (player.momentum ?? 0) * votingMultiplier;
}

export function playerAttributes(player: Player): [string, number][] {
  return isKeeper(player)
    ? [["Defesas",player.skill],["Posicionamento",player.goalkeeperPositioning??player.speed],["Jogo com os Pés",player.goalExit??player.marking??3],["Segurança",player.goalkeeperSafety??3],["Liderança",player.goalkeeperLeadership??3],["Momentum",player.momentum??0]]
    : [["Físico",player.speed],["Técnica",player.skill],["Marcação",player.marking??3],["Inteligência Tática",player.tacticalIntelligence??3],["Competitividade",player.competitiveness??3],["Momentum",player.momentum??0]];
}

export function playerOverall(player: Player, config: CardConfig) {
  const goalkeeper=isKeeper(player),speed=goalkeeper?player.goalkeeperPositioning??player.speed:player.speed,marking=goalkeeper?player.goalExit??player.marking??3:player.marking??3;
  const modern=config?.ratingSystemVersion===2||config?.tacticalIntelligenceWeight!=null;
  const base=!modern?speed*(config?.speedWeight??.48)+player.skill*(config?.skillWeight??.32)+marking*(config?.markingWeight??.2):goalkeeper
    ?player.skill*(config?.goalkeeperDefensesWeight??.4)+speed*(config?.goalkeeperPositioningWeight??.25)+(player.goalkeeperSafety??3)*(config?.goalkeeperSafetyWeight??.2)+marking*(config?.goalkeeperFootworkWeight??.1)+(player.goalkeeperLeadership??3)*(config?.goalkeeperLeadershipWeight??.05)
    :speed*(config?.speedWeight??.35)+player.skill*(config?.skillWeight??.25)+marking*(config?.markingWeight??.15)+(player.tacticalIntelligence??3)*(config?.tacticalIntelligenceWeight??.2)+(player.competitiveness??3)*(config?.competitivenessWeight??.05);
  const raw=base+playerMomentumContribution(player,config?.momentumMultiplier??1,config?.resultMomentumMultiplier??1);
  return Math.round(Math.max(1,Math.min(5,raw))*10)/10;
}

export function playerCardTier(overall:number,config:CardConfig):PlayerCardTier{if(!config?.cardTiersEnabled)return "default";const rounded=Math.round(overall*10)/10;if(rounded<=config.cardBronzeMax)return "bronze";if(rounded<=config.cardSilverMax)return "silver";if(rounded<=config.cardGoldMax)return "gold";return "legendary"}
export function playerCardTierLabel(tier:PlayerCardTier){return {default:"CARD DO JOGADOR",bronze:"BRONZE",silver:"PRATA",gold:"OURO",legendary:"LENDÁRIO"}[tier]}
