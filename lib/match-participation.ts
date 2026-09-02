export type MatchParticipationInput = {
  reviewed: boolean;
  blueIds: string[];
  yellowIds: string[];
};

export type MatchParticipationPlayer = {
  id: string;
  displayName: string;
  fullName?: string | null;
  photoUrl?: string | null;
  primaryPosition?: string | null;
  secondaryPosition?: string | null;
  type?: string | null;
};

export type MatchParticipationSnapshot = {
  version: 1;
  reviewedAt: string;
  reviewedByAdministratorId: string;
  blue: MatchParticipationPlayer[];
  yellow: MatchParticipationPlayer[];
  lineupBlueIds: string[];
  lineupYellowIds: string[];
};

const parse = (value: unknown, fallback: any) => {
  try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; }
};

const lineupPlayers = (snapshot: any, team: "blue" | "yellow") => Array.isArray(snapshot?.[team]) ? snapshot[team] : [];

export function participationFromRow(row: any): MatchParticipationSnapshot | null {
  const stored = parse(row?.participation_snapshot ?? row?.participationSnapshot, null);
  if (!stored || !Array.isArray(stored.blue) || !Array.isArray(stored.yellow)) return null;
  return stored as MatchParticipationSnapshot;
}

export function effectiveParticipation(row: any) {
  const stored = participationFromRow(row);
  if (stored) return { blue: stored.blue, yellow: stored.yellow, reviewed: true, snapshot: stored };
  const lineup = parse(row?.snapshot, row?.snapshot || {});
  return { blue: lineupPlayers(lineup, "blue"), yellow: lineupPlayers(lineup, "yellow"), reviewed: false, snapshot: null };
}

export function participationIds(row: any) {
  const participation = effectiveParticipation(row);
  return {
    blueIds: participation.blue.map((player: any) => String(player.id)),
    yellowIds: participation.yellow.map((player: any) => String(player.id)),
  };
}

export function buildParticipationSnapshot(params: {
  input: MatchParticipationInput;
  lineup: any;
  players: any[];
  administratorId: string;
  now: string;
}): MatchParticipationSnapshot {
  const blueIds = normalizedIds(params.input?.blueIds), yellowIds = normalizedIds(params.input?.yellowIds);
  if (params.input?.reviewed !== true) throw new Error("Revise e confirme a participação efetiva antes de salvar o resultado.");
  if (!blueIds.length || !yellowIds.length) throw new Error("A participação efetiva deve manter ao menos um jogador em cada time.");
  const repeated = blueIds.find(id => yellowIds.includes(id));
  if (repeated) throw new Error("Um jogador não pode participar pelos dois times na mesma partida.");
  if (blueIds.length + yellowIds.length < 7) throw new Error("São necessários pelo menos 7 participantes efetivos para abrir a votação dos destaques.");

  const lineupBlue = lineupPlayers(params.lineup, "blue"), lineupYellow = lineupPlayers(params.lineup, "yellow");
  const fallbacks = new Map([...lineupBlue, ...lineupYellow].map((player: any) => [String(player.id), player]));
  const available = new Map(params.players.map((player: any) => [String(player.id), player]));
  const selected = [...blueIds, ...yellowIds];
  const missing = selected.find(id => !available.has(id) && !fallbacks.has(id));
  if (missing) throw new Error("A participação contém um jogador que não está mais disponível.");
  const player = (id: string): MatchParticipationPlayer => {
    const source: any = available.get(id) || fallbacks.get(id);
    return {
      id,
      displayName: String(source.display_name ?? source.displayName ?? source.full_name ?? source.fullName ?? "Jogador"),
      fullName: source.full_name ?? source.fullName ?? null,
      photoUrl: source.photo_url ?? source.photoUrl ?? null,
      primaryPosition: source.primary_position ?? source.primaryPosition ?? null,
      secondaryPosition: source.secondary_position ?? source.secondaryPosition ?? null,
      type: source.type ?? null,
    };
  };
  return {
    version: 1,
    reviewedAt: params.now,
    reviewedByAdministratorId: params.administratorId,
    blue: blueIds.map(player),
    yellow: yellowIds.map(player),
    lineupBlueIds: lineupBlue.map((entry: any) => String(entry.id)),
    lineupYellowIds: lineupYellow.map((entry: any) => String(entry.id)),
  };
}

export function participationSummary(participation: MatchParticipationSnapshot) {
  const actual = new Set([...participation.blue, ...participation.yellow].map(player => player.id));
  const lineup = [...participation.lineupBlueIds, ...participation.lineupYellowIds];
  return {
    played: participation.blue.length + participation.yellow.length,
    noShowIds: lineup.filter(id => !actual.has(id)),
    addedIds: [...actual].filter(id => !lineup.includes(id)),
  };
}

function normalizedIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids = value.map(String).map(id => id.trim()).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error("A participação efetiva não pode repetir jogadores.");
  return ids;
}
