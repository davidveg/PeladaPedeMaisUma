import type { Player, ProfilePayload } from "./types";

export type PlayerCardTier = "default" | "bronze" | "silver" | "gold" | "legendary";
export type CardConfig = ProfilePayload["config"];

export const isKeeper = (player: Player) => player.type === "goalkeeper" || player.primaryPosition === "Goleiro";

export function playerMomentumContribution(player: Player, votingMultiplier = 1, resultMultiplier = 1) {
  const hasSeparatedSources = player.resultMomentum != null || player.votingMomentum != null;
  if (!hasSeparatedSources) return (player.momentum ?? 0) * votingMultiplier;
  return (player.resultMomentum ?? 0) * resultMultiplier + (player.votingMomentum ?? 0) * votingMultiplier;
}

export function playerAttributes(player: Player): [string, number][] {
  return isKeeper(player)
    ? [
        ["Habilidade", player.skill],
        ["Posicionamento", player.goalkeeperPositioning ?? player.speed],
        ["Saída de gol", player.goalExit ?? player.marking ?? 3],
        ["Momentum", player.momentum ?? 0],
      ]
    : [
        ["Velocidade", player.speed],
        ["Habilidade", player.skill],
        ["Marcação", player.marking ?? 3],
        ["Momentum", player.momentum ?? 0],
      ];
}

export function playerOverall(player: Player, config: CardConfig) {
  const speed = isKeeper(player) ? player.goalkeeperPositioning ?? player.speed : player.speed;
  const marking = isKeeper(player) ? player.goalExit ?? player.marking ?? 3 : player.marking ?? 3;
  const raw = speed * (config?.speedWeight ?? 0.48)
    + player.skill * (config?.skillWeight ?? 0.32)
    + marking * (config?.markingWeight ?? 0.2)
    + playerMomentumContribution(player, config?.momentumMultiplier ?? 1, config?.resultMomentumMultiplier ?? 1);
  return Math.round(Math.max(1, Math.min(5, raw)) * 10) / 10;
}

export function playerCardTier(overall: number, config: CardConfig): PlayerCardTier {
  if (!config?.cardTiersEnabled) return "default";
  const rounded = Math.round(overall * 10) / 10;
  if (rounded <= config.cardBronzeMax) return "bronze";
  if (rounded <= config.cardSilverMax) return "silver";
  if (rounded <= config.cardGoldMax) return "gold";
  return "legendary";
}

export function playerCardTierLabel(tier: PlayerCardTier) {
  return {
    default: "CARD DO JOGADOR",
    bronze: "BRONZE",
    silver: "PRATA",
    gold: "OURO",
    legendary: "LENDÁRIO",
  }[tier];
}
