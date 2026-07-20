export type PlayerCardTier = "bronze" | "silver" | "gold" | "legendary";
export type PlayerCardTierSettings = { cardTiersEnabled?: boolean; cardBronzeMax?: number; cardSilverMax?: number; cardGoldMax?: number };

export function playerCardTier(overall: number, settings: boolean | PlayerCardTierSettings = false): PlayerCardTier {
  const enabled = typeof settings === "boolean" ? settings : Boolean(settings.cardTiersEnabled);
  if (!enabled) return "gold";
  const rounded = Math.round(Number(overall) * 10) / 10;
  const bronzeMax = typeof settings === "boolean" ? 2.4 : Number(settings.cardBronzeMax ?? 2.4);
  const silverMax = typeof settings === "boolean" ? 3.9 : Number(settings.cardSilverMax ?? 3.9);
  const goldMax = typeof settings === "boolean" ? 4.5 : Number(settings.cardGoldMax ?? 4.5);
  if (rounded <= bronzeMax) return "bronze";
  if (rounded <= silverMax) return "silver";
  if (rounded <= goldMax) return "gold";
  return "legendary";
}

export function playerCardTierLabel(tier: PlayerCardTier) {
  return ({ bronze: "BRONZE", silver: "PRATA", gold: "OURO", legendary: "LENDÁRIO" } as const)[tier];
}
