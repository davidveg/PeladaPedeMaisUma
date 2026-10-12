import type { CareerAchievement, EngagementMatch, SeasonAwardSnapshot } from "./player-engagement";

export type HallPlayer = {
  id: string;
  displayName: string;
  photoUrl?: string | null;
  primaryPosition?: string | null;
  active?: boolean;
};

export type HallTotals = {
  games: number;
  wins: number;
  goals: number;
  assists: number;
  motmAwards: number;
  socialAwards: number;
};

export type HallFeaturedEntry = {
  id: string;
  player: HallPlayer;
  title: string;
  reason: string;
  inductedSeason: number;
  totals: HallTotals;
  badges: string[];
};

export type HallClassMember = {
  place: number;
  medal: string;
  title: string;
  player: HallPlayer;
  totals: HallTotals;
};

export type HallClass = {
  seasonNumber: number;
  endedAt: string;
  members: HallClassMember[];
};

export type HallRecord = {
  id: keyof HallTotals;
  icon: string;
  title: string;
  value: number;
  unit: string;
  players: HallPlayer[];
};

export type HallMoment = {
  id: string;
  icon: string;
  title: string;
  description: string;
  achievedAt: string;
  matchId?: string;
  player: HallPlayer;
};

export type HallOfFame = {
  summary: { seasons: number; inductedPlayers: number; officialMatches: number; records: number };
  featured: HallFeaturedEntry[];
  classes: HallClass[];
  records: HallRecord[];
  moments: HallMoment[];
  availableSeasons: number[];
};

export type HallManualHonor = { id: string; playerId: string; title: string; reason: string; seasonNumber: number; createdAt: string };

const rareAchievements = new Set([
  "motm_in_defeat", "social_sweep", "manita", "complete_show", "owned_attack",
  "attendance_10", "unbeaten_10", "motm_5", "social_10", "perfect_season",
]);

const recordDefinitions: Array<{ id: keyof HallTotals; icon: string; title: string; unit: string }> = [
  { id: "games", icon: "📅", title: "Mais partidas", unit: "jogos" },
  { id: "wins", icon: "🏆", title: "Mais vitórias", unit: "vitórias" },
  { id: "goals", icon: "⚽", title: "Maior artilheiro", unit: "gols" },
  { id: "assists", icon: "🎯", title: "Maior garçom", unit: "assistências" },
  { id: "motmAwards", icon: "⭐", title: "Mais vezes craque", unit: "eleições" },
  { id: "socialAwards", icon: "🤝", title: "Mais reconhecido", unit: "reconhecimentos" },
];

export function buildHallOfFame(params: {
  players: HallPlayer[];
  matches: EngagementMatch[];
  seasonAwards: SeasonAwardSnapshot[];
  achievements?: CareerAchievement[];
  manualHonors?: HallManualHonor[];
}): HallOfFame {
  const playerMap = new Map(params.players.map(player => [player.id, player]));
  for (const match of params.matches) {
    for (const player of [...match.blue, ...match.yellow]) {
      if (!playerMap.has(player.id)) playerMap.set(player.id, { id: player.id, displayName: player.displayName, photoUrl: null, active: false });
    }
  }
  const totals = new Map<string, HallTotals>();
  const totalFor = (id: string) => {
    const value = totals.get(id) || emptyTotals();
    totals.set(id, value);
    return value;
  };
  const matches = [...params.matches].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const match of matches) {
    const blueIds = new Set(match.blue.map(player => player.id));
    const yellowIds = new Set(match.yellow.map(player => player.id));
    for (const player of [...match.blue, ...match.yellow]) {
      const value = totalFor(player.id);
      value.games += 1;
      if ((blueIds.has(player.id) && match.winnerTeam === "BLUE") || (yellowIds.has(player.id) && match.winnerTeam === "YELLOW")) value.wins += 1;
    }
    for (const contribution of match.contributions) {
      if (!contribution.ownGoal && contribution.scorerPlayerId) totalFor(contribution.scorerPlayerId).goals += 1;
      if (!contribution.ownGoal && contribution.assistPlayerId) totalFor(contribution.assistPlayerId).assists += 1;
    }
    const motm = match.status === "CLOSED" ? (match.results?.motm?.find(entry => Number(entry.place || 1) === 1) || match.results?.motm?.[0]) : null;
    if (motm?.playerId) totalFor(motm.playerId).motmAwards += 1;
    for (const category of [match.results?.partner, match.results?.fairPlay, match.results?.defense]) {
      const winner = match.status === "CLOSED" ? category?.[0]?.playerId : null;
      if (winner) totalFor(winner).socialAwards += 1;
    }
  }

  const classes = [...params.seasonAwards]
    .sort((a, b) => b.seasonNumber - a.seasonNumber)
    .map(award => ({
      seasonNumber: award.seasonNumber,
      endedAt: award.endedAt,
      members: (award.annualMvp || []).flatMap(entry => {
        const id = String(entry.player?.id || "");
        const player = playerMap.get(id);
        return player ? [{ place: Number(entry.place || 1), medal: medal(Number(entry.place || 1)), title: podiumTitle(Number(entry.place || 1)), player, totals: totals.get(id) || emptyTotals() }] : [];
      }).sort((a, b) => a.place - b.place),
    }))
    .filter(entry => entry.members.length);

  const championSeason = new Map<string, number>();
  for (const hallClass of [...classes].reverse()) {
    for (const member of hallClass.members) if (member.place === 1) championSeason.set(member.player.id, hallClass.seasonNumber);
  }
  const idolAchievement = new Map<string, CareerAchievement>();
  for (const achievement of params.achievements || []) {
    if (achievement.id === "social_10" && achievement.playerId) idolAchievement.set(achievement.playerId, achievement);
  }
  const seasonForMatch = new Map(matches.map(match => [match.separationId, match.seasonNumber]));
  const featuredIds = new Set([...idolAchievement.keys(), ...championSeason.keys()]);
  const featured: HallFeaturedEntry[] = [...featuredIds].flatMap((id): HallFeaturedEntry[] => {
    const player = playerMap.get(id);
    if (!player) return [];
    const value = totals.get(id) || emptyTotals();
    const idol = idolAchievement.get(id);
    const inductedSeason = idol ? seasonForMatch.get(idol.matchId || "") || championSeason.get(id) || 1 : championSeason.get(id) || 1;
    const badges = [value.motmAwards ? `${value.motmAwards}× craque` : "", value.socialAwards ? `${value.socialAwards}× reconhecido` : "", championSeason.has(id) ? "Campeão anual" : ""].filter(Boolean);
    return [{
      id: `automatic:${id}`,
      player,
      title: idol ? "Ídolo da Pelada" as const : "Lenda da Temporada" as const,
      reason: idol ? "Entrou para a história ao alcançar dez reconhecimentos sociais da comunidade." : `Liderou a premiação anual da temporada ${championSeason.get(id)}.`,
      inductedSeason,
      totals: value,
      badges,
    }];
  });
  for (const honor of params.manualHonors || []) {
    const player = playerMap.get(honor.playerId);
    if (!player) continue;
    featured.push({ id: `manual:${honor.id}`, player, title: honor.title, reason: honor.reason, inductedSeason: honor.seasonNumber, totals: totals.get(player.id) || emptyTotals(), badges: ["Homenagem especial"] });
  }
  featured.sort((a, b) => Number(b.title === "Ídolo da Pelada") - Number(a.title === "Ídolo da Pelada") || b.inductedSeason - a.inductedSeason || b.totals.games - a.totals.games).splice(8);

  const records = recordDefinitions.flatMap(definition => {
    const value = Math.max(0, ...[...totals.values()].map(item => item[definition.id]));
    if (!value) return [];
    const players = [...totals].filter(([, item]) => item[definition.id] === value).flatMap(([id]) => playerMap.get(id) || []).sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
    return [{ ...definition, value, players }];
  });

  const moments = (params.achievements || [])
    .filter(item => item.playerId && rareAchievements.has(item.id) && playerMap.has(item.playerId))
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    .slice(0, 12)
    .map(item => ({ id: `${item.id}:${item.playerId}`, icon: item.icon, title: item.title, description: item.description, achievedAt: item.achievedAt, matchId: item.matchId, player: playerMap.get(item.playerId!)! }));
  const availableSeasons = [...new Set(matches.map(match => match.seasonNumber))].sort((a, b) => b - a);
  const inductedPlayers = new Set([...featured.map(item => item.player.id), ...classes.flatMap(item => item.members.map(member => member.player.id))]).size;
  return { summary: { seasons: availableSeasons.length, inductedPlayers, officialMatches: matches.length, records: records.length }, featured, classes, records, moments, availableSeasons };
}

function emptyTotals(): HallTotals { return { games: 0, wins: 0, goals: 0, assists: 0, motmAwards: 0, socialAwards: 0 }; }
function medal(place: number) { return place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"; }
function podiumTitle(place: number) { return place === 1 ? "Bola de Ouro" : place === 2 ? "Bola de Prata" : "Bola de Bronze"; }
