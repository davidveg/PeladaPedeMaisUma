import { normalizeName, type Player, type Position } from "./football.ts";

export type PlayerDirectoryFilters = {
  name: string;
  position: "" | Position;
  type: string;
};

export const PLAYER_POSITION_FILTER_OPTIONS: Position[] = ["Defesa", "Meio-campo", "Ataque", "Goleiro"];

export const PLAYER_TYPE_FILTER_OPTIONS = [
  { value: "monthly", label: "Mensalista" },
  { value: "guest", label: "Convidado" },
  { value: "goalkeeper", label: "Goleiro mensalista" },
  { value: "casual", label: "Avulso" },
] as const;

export function filterPlayerDirectory(players: Player[], filters: PlayerDirectoryFilters) {
  const name = normalizeName(filters.name);
  return players.filter(player => {
    const names = [player.displayName, player.fullName, player.nickname, ...(player.aliases || [])]
      .filter((value): value is string => Boolean(value))
      .map(normalizeName);
    const matchesName = !name || names.some(value => value.includes(name));
    const matchesPosition = !filters.position || player.primaryPosition === filters.position || player.secondaryPosition === filters.position;
    const matchesType = !filters.type || player.type === filters.type;
    return matchesName && matchesPosition && matchesType;
  });
}
