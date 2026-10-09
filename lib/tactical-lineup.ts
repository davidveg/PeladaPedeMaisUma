export type TacticalRole = "Defesa" | "Meio-campo" | "Ataque" | "Goleiro";
export type TacticalFormationOption = { defenders: number; midfielders: number; attackers: number };
export type TacticalFormation = string;

export const DEFAULT_TACTICAL_FORMATIONS: TacticalFormationOption[] = [
  { defenders: 2, midfielders: 3, attackers: 1 },
  { defenders: 2, midfielders: 2, attackers: 2 },
];

export const tacticalFormationLabel = (formation: TacticalFormationOption) => `${formation.defenders}-${formation.midfielders}-${formation.attackers}`;
export const tacticalFormationSize = (formation: TacticalFormationOption) => formation.defenders + formation.midfielders + formation.attackers + 1;

export function normalizeTacticalFormations(input: unknown): TacticalFormationOption[] {
  if (!Array.isArray(input)) return DEFAULT_TACTICAL_FORMATIONS.map(formation => ({ ...formation }));
  const normalized = input.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const source = value as Record<string, unknown>;
    const formation = {
      defenders: Number(source.defenders),
      midfielders: Number(source.midfielders),
      attackers: Number(source.attackers),
    };
    const counts = Object.values(formation);
    if (!counts.every(count => Number.isInteger(count) && count >= 0 && count <= 10)) return [];
    const outfield = counts.reduce((sum, count) => sum + count, 0);
    return outfield >= 1 && outfield <= 14 ? [formation] : [];
  });
  const unique = normalized.filter((formation, index, all) => all.findIndex(candidate => tacticalFormationLabel(candidate) === tacticalFormationLabel(formation)) === index);
  return unique.length ? unique.slice(0, 6) : DEFAULT_TACTICAL_FORMATIONS.map(formation => ({ ...formation }));
}

export type TacticalPlayer = {
  id: string;
  displayName: string;
  type?: string | null;
  primaryPosition?: string | null;
  secondaryPosition?: string | null;
};

export type TacticalLineupMember<Player extends TacticalPlayer> = {
  player: Player;
  role: TacticalRole;
  rating: number;
  usedSecondaryPosition: boolean;
};

export type TacticalLineup<Player extends TacticalPlayer> = {
  formation: TacticalFormation;
  defenders: TacticalLineupMember<Player>[];
  midfielders: TacticalLineupMember<Player>[];
  attackers: TacticalLineupMember<Player>[];
  goalkeeper: TacticalLineupMember<Player> | null;
  reserves: Player[];
  filledSlots: number;
  totalSlots: number;
  totalRating: number;
  slots: TacticalFormationOption & { goalkeepers: 1 };
};

type FormationPlan = { formation: TacticalFormation; roles: TacticalRole[] };
type Assignment<Player extends TacticalPlayer> = { player: Player; slot: number; rating: number; primary: boolean };
type State<Player extends TacticalPlayer> = { rating: number; primaryUses: number; assignments: Assignment<Player>[] };

const formationPlan = (formation: TacticalFormationOption): FormationPlan => ({
  formation: tacticalFormationLabel(formation),
  roles: [
    ...Array<TacticalRole>(formation.defenders).fill("Defesa"),
    ...Array<TacticalRole>(formation.midfielders).fill("Meio-campo"),
    ...Array<TacticalRole>(formation.attackers).fill("Ataque"),
  ],
});

const bitCount = (value: number) => {
  let count = 0;
  for (let current = value; current; current &= current - 1) count++;
  return count;
};

const isGoalkeeper = (player: TacticalPlayer) => player.primaryPosition === "Goleiro" || player.type === "goalkeeper" || player.type === "casual";
const canPlay = (player: TacticalPlayer, role: TacticalRole) => player.primaryPosition === role || player.secondaryPosition === role;
const betterState = <Player extends TacticalPlayer>(candidate: State<Player>, current?: State<Player>) => !current
  || candidate.rating > current.rating + 1e-9
  || (Math.abs(candidate.rating - current.rating) < 1e-9 && candidate.primaryUses > current.primaryUses);

function bestOutfieldAssignment<Player extends TacticalPlayer>(players: Player[], plan: FormationPlan, ratingOf: (player: Player) => number) {
  let states = new Map<number, State<Player>>([[0, { rating: 0, primaryUses: 0, assignments: [] }]]);
  for (const player of players) {
    const next = new Map(states);
    const rating = ratingOf(player);
    for (const [mask, state] of states) {
      for (let slot = 0; slot < plan.roles.length; slot++) {
        const bit = 1 << slot, role = plan.roles[slot];
        if ((mask & bit) || !canPlay(player, role)) continue;
        const candidate: State<Player> = {
          rating: state.rating + rating,
          primaryUses: state.primaryUses + (player.primaryPosition === role ? 1 : 0),
          assignments: [...state.assignments, { player, slot, rating, primary: player.primaryPosition === role }],
        };
        const key = mask | bit;
        if (betterState(candidate, next.get(key))) next.set(key, candidate);
      }
    }
    states = next;
  }
  return [...states.entries()].reduce((best, entry) => {
    if (!best) return entry;
    const filled = bitCount(entry[0]), bestFilled = bitCount(best[0]);
    if (filled !== bestFilled) return filled > bestFilled ? entry : best;
    return betterState(entry[1], best[1]) ? entry : best;
  }, null as [number, State<Player>] | null)!;
}

function lineupForFormation<Player extends TacticalPlayer>(players: Player[], plan: FormationPlan, ratingOf: (player: Player) => number): TacticalLineup<Player> {
  const goalkeepers = players.filter(isGoalkeeper).sort((a, b) => ratingOf(b) - ratingOf(a) || a.displayName.localeCompare(b.displayName, "pt-BR"));
  const goalkeeper = goalkeepers[0] || null;
  const outfield = players.filter(player => !isGoalkeeper(player));
  const [mask, state] = bestOutfieldAssignment(outfield, plan, ratingOf);
  const members = state.assignments.map(assignment => ({
    player: assignment.player,
    role: plan.roles[assignment.slot],
    rating: assignment.rating,
    usedSecondaryPosition: !assignment.primary,
  }));
  const selected = new Set(members.map(member => member.player.id));
  if (goalkeeper) selected.add(goalkeeper.id);
  const byRole = (role: TacticalRole) => members.filter(member => member.role === role);
  return {
    formation: plan.formation,
    defenders: byRole("Defesa"),
    midfielders: byRole("Meio-campo"),
    attackers: byRole("Ataque"),
    goalkeeper: goalkeeper ? { player: goalkeeper, role: "Goleiro", rating: ratingOf(goalkeeper), usedSecondaryPosition: false } : null,
    reserves: players.filter(player => !selected.has(player.id)).sort((a, b) => ratingOf(b) - ratingOf(a) || a.displayName.localeCompare(b.displayName, "pt-BR")),
    filledSlots: bitCount(mask) + (goalkeeper ? 1 : 0),
    totalSlots: plan.roles.length + 1,
    totalRating: state.rating + (goalkeeper ? ratingOf(goalkeeper) : 0),
    slots: {
      defenders: plan.roles.filter(role => role === "Defesa").length,
      midfielders: plan.roles.filter(role => role === "Meio-campo").length,
      attackers: plan.roles.filter(role => role === "Ataque").length,
      goalkeepers: 1,
    },
  };
}

export function buildTacticalLineup<Player extends TacticalPlayer>(players: Player[], ratingOf: (player: Player) => number, options: TacticalFormationOption[] = DEFAULT_TACTICAL_FORMATIONS): TacticalLineup<Player> {
  const candidates = normalizeTacticalFormations(options).map(formation => lineupForFormation(players, formationPlan(formation), ratingOf));
  return candidates.reduce((best, candidate) => {
    const distance = Math.abs(candidate.totalSlots - players.length), bestDistance = Math.abs(best.totalSlots - players.length);
    if (distance !== bestDistance) return distance < bestDistance ? candidate : best;
    if (candidate.filledSlots !== best.filledSlots) return candidate.filledSlots > best.filledSlots ? candidate : best;
    if (Math.abs(candidate.totalRating - best.totalRating) > 1e-9) return candidate.totalRating > best.totalRating ? candidate : best;
    return best;
  });
}
