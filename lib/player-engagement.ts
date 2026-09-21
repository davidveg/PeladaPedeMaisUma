/* Pure engagement projections built from the official career history. */

export type EngagementPlayer = { id: string; displayName: string };
export type EngagementContribution = { scorerPlayerId: string; assistPlayerId?: string | null; ownGoal?: boolean };
export type EngagementMatch = {
  id: string;
  separationId: string;
  title: string;
  date: string;
  seasonNumber: number;
  status: string;
  blueScore: number;
  yellowScore: number;
  winnerTeam: "BLUE" | "YELLOW" | "DRAW";
  blue: EngagementPlayer[];
  yellow: EngagementPlayer[];
  contributions: EngagementContribution[];
  results?: { motm?: Array<{ playerId: string; place?: number }>; partner?: Array<{ playerId: string }>; fairPlay?: Array<{ playerId: string }>; defense?: Array<{ playerId: string }> } | null;
};

export type CareerAchievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  achievedAt: string;
  matchId?: string;
  playerId?: string;
  playerName?: string;
};

export type AchievementProgress = {
  id: "games" | "wins" | "goals" | "assists";
  label: string;
  current: number;
  target: number;
  percent: number;
};

export type MonthlyAwardSnapshot = {
  month: string;
  playerOfMonth?: { player?: EngagementPlayer } | null;
  selection?: Array<{ player?: EngagementPlayer }>;
};

export type SeasonAwardSnapshot = {
  seasonNumber: number;
  endedAt: string;
  annualMvp?: Array<{ place: number; player?: EngagementPlayer }>;
};

type Totals = {
  games: number;
  wins: number;
  losses: number;
  goals: number;
  assists: number;
  winningStreak: number;
  unbeatenStreak: number;
  losingStreak: number;
  attendanceStreak: number;
  motmAwards: number;
  socialAwards: number;
};

export type PlayerEngagement = {
  achievements: { unlocked: CareerAchievement[]; next: AchievementProgress[] };
  retrospective: {
    seasonNumber: number;
    title: string;
    summary: string;
    games: number;
    wins: number;
    draws: number;
    losses: number;
    goals: number;
    assists: number;
    winRate: number;
    bestWinningStreak: number;
    bestGoalsInMatch: number;
    bestAssistsInMatch: number;
    motmAwards: number;
    partnerAwards: number;
    fairPlayAwards: number;
    defenseAwards: number;
    playerOfMonthAwards: number;
    monthlySelections: number;
    topPartner: { id: string; displayName: string; games: number } | null;
    highlights: CareerAchievement[];
    shareText: string;
  };
};

export type RoundRecap = {
  date: string;
  title: string;
  headline: string;
  deck: string;
  highlights: string[];
  stories: Array<{ kind: "goals" | "assists" | "motm" | "recognition" | "record" | "achievement"; label: string; text: string; icon: string }>;
  records: string[];
  result: { blueScore: number; yellowScore: number; winnerTeam: "BLUE" | "YELLOW" | "DRAW"; winnerLabel: string; totalGoals: number; goalDifference: number };
  milestones: CareerAchievement[];
  shareText: string;
};

const gameMilestones = [1, 10, 25, 50, 100, 200];
const winMilestones = [1, 10, 25, 50, 100];
const goalMilestones = [1, 10, 25, 50, 100];
const assistMilestones = [1, 10, 25, 50];

export function buildPlayerEngagement(params: {
  player: EngagementPlayer;
  matches: EngagementMatch[];
  currentSeasonNumber: number;
  seasonStartedAt?: string | null;
  nextSeasonResetAt?: string | null;
  monthlyAwards?: MonthlyAwardSnapshot[];
  seasonAwards?: SeasonAwardSnapshot[];
}): PlayerEngagement {
  const ordered = orderMatches(params.matches);
  const scan = scanCareer(ordered);
  const awardAchievements = [
    ...achievementsFromAwards(params.player.id, params.monthlyAwards || [], params.seasonAwards || []),
    ...achievementsFromSeasonAttendance(params.player.id, ordered, params.seasonAwards || []),
  ];
  const unlocked = uniqueAchievements([...(scan.achievements.get(params.player.id) || []), ...awardAchievements])
    .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt) || a.title.localeCompare(b.title, "pt-BR"));
  const totals = scan.totals.get(params.player.id) || emptyTotals();
  const seasonMatches = ordered.filter(match => match.seasonNumber === params.currentSeasonNumber && participantTeam(match, params.player.id));
  const season = summarizeSeason(params.player, seasonMatches, params.monthlyAwards || [], unlocked, params.currentSeasonNumber, params.seasonStartedAt, params.nextSeasonResetAt);
  return {
    achievements: { unlocked, next: nextProgress(totals) },
    retrospective: season,
  };
}

export function buildRoundRecaps(params: {
  matches: EngagementMatch[];
  siteName?: string;
  teamBlueName?: string;
  teamYellowName?: string;
}): Record<string, RoundRecap> {
  const ordered = orderMatches(params.matches), scan = scanCareer(ordered), recaps: Record<string, RoundRecap> = {};
  let recordGoals = -1, recordMargin = -1;
  for (const match of ordered) {
    const names = playerNames(match);
    const winner = match.winnerTeam === "BLUE" ? params.teamBlueName || "Azul" : match.winnerTeam === "YELLOW" ? params.teamYellowName || "Amarelo" : "Empate";
    const headline = match.winnerTeam === "DRAW"
      ? `Empate em ${match.blueScore} × ${match.yellowScore}`
      : `${winner} venceu por ${match.blueScore} × ${match.yellowScore}`;
    const highlights: string[] = [], records: string[] = [], stories: RoundRecap["stories"] = [];
    const goals = countBy(match.contributions.filter(item => !item.ownGoal), item => item.scorerPlayerId);
    const assists = countBy(match.contributions.filter(item => !item.ownGoal && item.assistPlayerId), item => String(item.assistPlayerId));
    const goalLeaders = leaders(goals), assistLeaders = leaders(assists);
    if (goalLeaders.value > 0) { const text = `${joinNames(goalLeaders.ids, names)} ${goalLeaders.ids.length === 1 ? "liderou" : "lideraram"} com ${goalLeaders.value} ${goalLeaders.value === 1 ? "gol" : "gols"}.`; highlights.push(text); stories.push({ kind: "goals", label: "Artilharia da rodada", text, icon: "⚽" }); }
    if (assistLeaders.value > 0) { const text = `${joinNames(assistLeaders.ids, names)} ${assistLeaders.ids.length === 1 ? "deu" : "deram"} ${assistLeaders.value} ${assistLeaders.value === 1 ? "assistência" : "assistências"}.`; highlights.push(text); stories.push({ kind: "assists", label: "Garçom da rodada", text, icon: "🎯" }); }
    const motm = match.status === "CLOSED" ? match.results?.motm?.find(entry => Number(entry.place || 1) === 1) || match.results?.motm?.[0] : null;
    if (motm?.playerId && names[motm.playerId]) { const text = `${names[motm.playerId]} foi o Man of the Match.`; highlights.push(text); stories.push({ kind: "motm", label: "Craque da partida", text, icon: "⭐" }); }
    if (match.status === "CLOSED") {
      const recognitions = [
        { entry: match.results?.partner?.[0], label: "Parceiro da rodada", icon: "🤝" },
        { entry: match.results?.fairPlay?.[0], label: "Fair Play", icon: "🟢" },
        { entry: match.results?.defense?.[0], label: "Defesa da rodada", icon: "🧤" },
      ];
      for (const recognition of recognitions) if (recognition.entry?.playerId && names[recognition.entry.playerId]) {
        const text = `${names[recognition.entry.playerId]} recebeu o reconhecimento de ${recognition.label}.`;
        highlights.push(text); stories.push({ kind: "recognition", label: recognition.label, text, icon: recognition.icon });
      }
    }
    const totalGoals = match.blueScore + match.yellowScore;
    const goalDifference = Math.abs(match.blueScore - match.yellowScore);
    if (recordGoals >= 0 && totalGoals > recordGoals) records.push(`Novo recorde de gols: ${totalGoals} em uma única partida.`);
    if (recordMargin >= 0 && match.winnerTeam !== "DRAW" && goalDifference > recordMargin) records.push(`Maior diferença no placar até aqui: ${goalDifference} ${goalDifference === 1 ? "gol" : "gols"}.`);
    for (const text of records) { highlights.push(text); stories.push({ kind: "record", label: "Recorde quebrado", text, icon: "📈" }); }
    recordGoals = Math.max(recordGoals, totalGoals);
    recordMargin = Math.max(recordMargin, goalDifference);
    const milestones = (scan.matchAchievements.get(match.separationId) || [])
      .map(item => ({ ...item, playerName: names[playerIdFromAchievement(item)] || "Jogador" }))
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR") || String(a.playerName).localeCompare(String(b.playerName), "pt-BR"));
    for (const achievement of milestones.slice(0, Math.max(0, 6 - highlights.length))) { const text = `${achievement.playerName} conquistou “${achievement.title}”.`; highlights.push(text); stories.push({ kind: "achievement", label: "Conquista desbloqueada", text, icon: achievement.icon || "🏆" }); }
    const visible = highlights.slice(0, 5);
    const title = `Resenha da rodada · ${match.title}`;
    const shareText = [`⚽ *${params.siteName || "Pelada"}*`, "", `📰 *${title}*`, headline, ...visible.map(item => `• ${item}`)].join("\n");
    const deck = match.winnerTeam === "DRAW"
      ? `Uma partida equilibrada terminou com ${totalGoals} ${totalGoals === 1 ? "gol" : "gols"} e ninguém conseguiu abrir vantagem no placar.`
      : `${winner} comandou o placar em uma rodada com ${totalGoals} ${totalGoals === 1 ? "gol" : "gols"} e ${goalDifference} de diferença.`;
    const recap = { date: match.date, title, headline, deck, highlights: visible, stories: stories.slice(0, 6), records, result: { blueScore: match.blueScore, yellowScore: match.yellowScore, winnerTeam: match.winnerTeam, winnerLabel: winner, totalGoals, goalDifference }, milestones, shareText };
    recaps[match.id] = recap;
    recaps[match.separationId] = recap;
  }
  return recaps;
}

function summarizeSeason(player: EngagementPlayer, matches: EngagementMatch[], awards: MonthlyAwardSnapshot[], unlocked: CareerAchievement[], seasonNumber: number, startedAt?: string | null, nextResetAt?: string | null): PlayerEngagement["retrospective"] {
  let wins = 0, losses = 0, goals = 0, assists = 0, streak = 0, bestWinningStreak = 0, bestGoalsInMatch = 0, bestAssistsInMatch = 0, motmAwards = 0, partnerAwards = 0, fairPlayAwards = 0, defenseAwards = 0;
  const partners = new Map<string, { id: string; displayName: string; games: number }>();
  for (const match of matches) {
    const team = participantTeam(match, player.id)!;
    if (match.winnerTeam === team) { wins += 1; streak += 1; bestWinningStreak = Math.max(bestWinningStreak, streak); }
    else { if (match.winnerTeam !== "DRAW") losses += 1; streak = 0; }
    const matchGoals = match.contributions.filter(item => !item.ownGoal && item.scorerPlayerId === player.id).length;
    const matchAssists = match.contributions.filter(item => !item.ownGoal && item.assistPlayerId === player.id).length;
    goals += matchGoals; assists += matchAssists; bestGoalsInMatch = Math.max(bestGoalsInMatch, matchGoals); bestAssistsInMatch = Math.max(bestAssistsInMatch, matchAssists);
    if (match.status === "CLOSED" && (match.results?.motm?.find(entry => Number(entry.place || 1) === 1) || match.results?.motm?.[0])?.playerId === player.id) motmAwards += 1;
    if (match.status === "CLOSED" && match.results?.partner?.[0]?.playerId === player.id) partnerAwards += 1;
    if (match.status === "CLOSED" && match.results?.fairPlay?.[0]?.playerId === player.id) fairPlayAwards += 1;
    if (match.status === "CLOSED" && match.results?.defense?.[0]?.playerId === player.id) defenseAwards += 1;
    const teammates = team === "BLUE" ? match.blue : match.yellow;
    for (const teammate of teammates) if (teammate.id !== player.id) { const current = partners.get(teammate.id) || { ...teammate, games: 0 }; current.games += 1; partners.set(teammate.id, current); }
  }
  const draws = matches.length - wins - losses;
  const rangeStart = String(startedAt || matches[0]?.date || "0000-01-01").slice(0, 10), rangeEnd = String(nextResetAt || "9999-12-31").slice(0, 10);
  const seasonAwards = awards.filter(award => `${award.month}-28` >= rangeStart && `${award.month}-01` < rangeEnd);
  const playerOfMonthAwards = seasonAwards.filter(award => award.playerOfMonth?.player?.id === player.id).length;
  const monthlySelections = seasonAwards.filter(award => award.selection?.some(entry => entry.player?.id === player.id)).length;
  const topPartner = [...partners.values()].sort((a, b) => b.games - a.games || a.displayName.localeCompare(b.displayName, "pt-BR"))[0] || null;
  const highlights = unlocked.filter(item => item.achievedAt >= rangeStart && item.achievedAt < rangeEnd).slice(0, 4);
  const winRate = matches.length ? Math.round((wins / matches.length) * 100) : 0;
  const summary = matches.length
    ? `${player.displayName} disputou ${matches.length} ${matches.length === 1 ? "jogo" : "jogos"} na temporada ${seasonNumber}, com ${wins} ${wins === 1 ? "vitória" : "vitórias"} e ${goals} ${goals === 1 ? "gol" : "gols"}.`
    : `A temporada ${seasonNumber} ainda não possui partidas registradas para ${player.displayName}.`;
  const roundAwards = [partnerAwards ? `🤝 ${partnerAwards}× parceiro da rodada` : "", fairPlayAwards ? `🟢 ${fairPlayAwards}× Fair Play` : "", defenseAwards ? `🧤 ${defenseAwards}× defesa da rodada` : ""].filter(Boolean).join(" · ");
  const shareText = [`⚽ *Retrospectiva de ${player.displayName}*`, `Temporada ${seasonNumber}`, "", summary, `📊 ${wins}V · ${draws}E · ${losses}D · ${winRate}% de aproveitamento`, `⚽ ${goals} gols · 🎯 ${assists} assistências`, topPartner ? `🤝 Parceria mais frequente: ${topPartner.displayName} (${topPartner.games} jogos)` : "", roundAwards, playerOfMonthAwards ? `⭐ ${playerOfMonthAwards}× jogador do mês` : "", monthlySelections ? `🏅 ${monthlySelections}× na seleção do mês` : ""].filter(Boolean).join("\n");
  return { seasonNumber, title: `Minha temporada ${seasonNumber}`, summary, games: matches.length, wins, draws, losses, goals, assists, winRate, bestWinningStreak, bestGoalsInMatch, bestAssistsInMatch, motmAwards, partnerAwards, fairPlayAwards, defenseAwards, playerOfMonthAwards, monthlySelections, topPartner, highlights, shareText };
}

function scanCareer(matches: EngagementMatch[]) {
  const totals = new Map<string, Totals>(), achievements = new Map<string, CareerAchievement[]>(), matchAchievements = new Map<string, CareerAchievement[]>();
  const add = (playerId: string, achievement: CareerAchievement) => {
    const list = achievements.get(playerId) || [];
    if (list.some(item => item.id === achievement.id)) return;
    list.push(achievement); achievements.set(playerId, list);
    const matchList = matchAchievements.get(achievement.matchId || "") || []; matchList.push({ ...achievement, id: `${achievement.id}:${playerId}`, playerId }); matchAchievements.set(achievement.matchId || "", matchList);
  };
  for (const match of matches) {
    const participants = [...match.blue.map(player => ({ player, team: "BLUE" as const })), ...match.yellow.map(player => ({ player, team: "YELLOW" as const }))];
    const participantIds = new Set(participants.map(entry => entry.player.id));
    for (const [playerId, value] of totals) if (!participantIds.has(playerId)) value.attendanceStreak = 0;
    const goals = countBy(match.contributions.filter(item => !item.ownGoal), item => item.scorerPlayerId), assists = countBy(match.contributions.filter(item => !item.ownGoal && item.assistPlayerId), item => String(item.assistPlayerId));
    const motm = match.status === "CLOSED" ? match.results?.motm?.find(entry => Number(entry.place || 1) === 1) || match.results?.motm?.[0] : null;
    const socialWinners = {
      partner: match.status === "CLOSED" ? match.results?.partner?.[0]?.playerId : undefined,
      fairPlay: match.status === "CLOSED" ? match.results?.fairPlay?.[0]?.playerId : undefined,
      defense: match.status === "CLOSED" ? match.results?.defense?.[0]?.playerId : undefined,
    };
    for (const { player, team } of participants) {
      const value = totals.get(player.id) || emptyTotals();
      const before = { ...value };
      const won = match.winnerTeam === team, drew = match.winnerTeam === "DRAW", lost = !won && !drew;
      const matchGoals = goals.get(player.id) || 0, matchAssists = assists.get(player.id) || 0;
      value.games += 1; value.attendanceStreak += 1;
      if (won) { value.wins += 1; value.winningStreak += 1; value.unbeatenStreak += 1; value.losingStreak = 0; }
      else if (drew) { value.winningStreak = 0; value.unbeatenStreak += 1; value.losingStreak = 0; }
      else { value.losses += 1; value.winningStreak = 0; value.unbeatenStreak = 0; value.losingStreak += 1; }
      value.goals += matchGoals; value.assists += matchAssists;
      const wonMotm = motm?.playerId === player.id;
      if (wonMotm) value.motmAwards += 1;
      const socialCount = [socialWinners.partner, socialWinners.fairPlay, socialWinners.defense].filter(id => id === player.id).length;
      value.socialAwards += socialCount;
      totals.set(player.id, value);
      milestone(gameMilestones, before.games, value.games, "games", match, player.id, add);
      milestone(winMilestones, before.wins, value.wins, "wins", match, player.id, add);
      milestone(goalMilestones, before.goals, value.goals, "goals", match, player.id, add);
      milestone(assistMilestones, before.assists, value.assists, "assists", match, player.id, add);
      if (matchGoals >= 3) add(player.id, achievement("hat_trick", "Hat-trick", "Marcou pelo menos três gols na mesma partida.", "🎩", match));
      if (matchGoals >= 4) add(player.id, achievement("poker", "Poker", "Marcou pelo menos quatro gols na mesma partida.", "🃏", match));
      if (matchGoals >= 5) add(player.id, achievement("manita", "Manita", "Marcou pelo menos cinco gols na mesma partida.", "✋", match));
      if (matchAssists >= 3) add(player.id, achievement("three_assists", "Maestro", "Deu pelo menos três assistências na mesma partida.", "🎯", match));
      if (matchGoals >= 1 && matchAssists >= 1) add(player.id, achievement("complete_match", "Partida completa", "Marcou e deu assistência na mesma partida.", "⚽", match));
      if (matchGoals >= 2 && matchAssists >= 2) add(player.id, achievement("complete_show", "Show completo", "Marcou pelo menos dois gols e deu duas assistências na mesma partida.", "🎆", match));
      const teamScore = team === "BLUE" ? match.blueScore : match.yellowScore;
      if (teamScore >= 3 && matchGoals + matchAssists >= teamScore) add(player.id, achievement("owned_attack", "Dono do ataque", "Participou de todos os gols do time em uma partida com pelo menos três gols.", "👑", match));
      if (lost && matchGoals >= 2) add(player.id, achievement("fought_to_end", "Lutou até o fim", "Marcou pelo menos dois gols mesmo com a derrota.", "🛡️", match));
      if (won && Math.abs(match.blueScore - match.yellowScore) === 1 && matchGoals >= 1) add(player.id, achievement("fine_margin", "No detalhe", "Marcou em uma vitória por apenas um gol de diferença.", "🎯", match));
      const assistedScorers = countBy(match.contributions.filter(item => !item.ownGoal && item.assistPlayerId === player.id), item => item.scorerPlayerId);
      if ([...assistedScorers.values()].some(count => count >= 2)) add(player.id, achievement("perfect_connection", "Conexão perfeita", "Deu pelo menos duas assistências para o mesmo companheiro na partida.", "🔗", match));
      if (value.winningStreak === 3) add(player.id, achievement("winning_streak_3", "Embalado", "Venceu três partidas seguidas.", "🔥", match));
      if (value.winningStreak === 5) add(player.id, achievement("winning_streak_5", "Imparável", "Venceu cinco partidas seguidas.", "⚡", match));
      if (value.unbeatenStreak === 5) add(player.id, achievement("unbeaten_5", "Invicto", "Completou cinco partidas seguidas sem perder.", "🔥", match));
      if (value.unbeatenStreak === 10) add(player.id, achievement("unbeaten_10", "Inabalável", "Completou dez partidas seguidas sem perder.", "🧱", match));
      if (won && before.losingStreak >= 3) add(player.id, achievement("turned_the_tide", "Virada de chave", "Voltou a vencer depois de três derrotas seguidas.", "🔄", match));
      if (value.attendanceStreak === 10) add(player.id, achievement("attendance_10", "Presença garantida", "Participou de dez partidas oficiais consecutivas.", "📅", match));
      if (wonMotm) {
        add(player.id, achievement("motm_first", "Craque da rodada", "Conquistou o primeiro Man of the Match.", "⭐", match));
        if (lost) add(player.id, achievement("motm_in_defeat", "Craque até na derrota", "Foi eleito Man of the Match mesmo atuando pelo time derrotado.", "🦁", match));
        if (drew) add(player.id, achievement("motm_in_draw", "Craque sem vencedor", "Foi eleito Man of the Match em uma partida empatada.", "🤝", match));
        if (socialCount >= 1) add(player.id, achievement("complete_highlight", "Destaque completo", "Venceu o Man of the Match e outro reconhecimento na mesma rodada.", "🌟", match));
      }
      if (before.motmAwards < 3 && value.motmAwards >= 3) add(player.id, achievement("motm_3", "Colecionador de estrelas", "Conquistou três títulos de Man of the Match.", "⭐", match));
      if (before.motmAwards < 5 && value.motmAwards >= 5) add(player.id, achievement("motm_5", "Lenda das rodadas", "Conquistou cinco títulos de Man of the Match.", "🌠", match));
      if (socialWinners.partner === player.id) add(player.id, achievement("partner_first", "Parceiro da rodada", "Recebeu seu primeiro reconhecimento de Parceiro da rodada.", "🤝", match));
      if (socialWinners.fairPlay === player.id) add(player.id, achievement("fair_play_first", "Espírito esportivo", "Recebeu seu primeiro reconhecimento de Fair Play.", "🟢", match));
      if (socialWinners.defense === player.id) add(player.id, achievement("defense_first", "Guardião da rodada", "Recebeu seu primeiro reconhecimento de Defesa da rodada.", "🛡️", match));
      if (socialCount >= 2) add(player.id, achievement("round_favorite", "Queridinho da rodada", "Venceu pelo menos dois reconhecimentos sociais na mesma partida.", "🏅", match));
      if (socialCount === 3) add(player.id, achievement("social_sweep", "Tríplice reconhecimento", "Venceu Parceiro, Fair Play e Defesa na mesma rodada.", "👑", match));
      if (before.socialAwards < 5 && value.socialAwards >= 5) add(player.id, achievement("social_5", "Reconhecido pela galera", "Alcançou cinco reconhecimentos sociais.", "🏆", match));
      if (before.socialAwards < 10 && value.socialAwards >= 10) add(player.id, achievement("social_10", "Ídolo da pelada", "Alcançou dez reconhecimentos sociais.", "💎", match));
    }
  }
  return { totals, achievements, matchAchievements };
}

function achievementsFromSeasonAttendance(playerId: string, matches: EngagementMatch[], seasons: SeasonAwardSnapshot[]) {
  return seasons.flatMap(season => {
    const seasonMatches = matches.filter(match => match.seasonNumber === season.seasonNumber);
    if (!seasonMatches.length) return [];
    const appearances = seasonMatches.filter(match => participantTeam(match, playerId)).length;
    const attendance = appearances / seasonMatches.length;
    if (attendance < .95) return [];
    return [{
      id: `perfect_season_${season.seasonNumber}`,
      title: "Temporada perfeita",
      description: `Participou de ${appearances} das ${seasonMatches.length} partidas da temporada ${season.seasonNumber} (${Math.round(attendance * 100)}% de assiduidade).`,
      icon: "💯",
      achievedAt: season.endedAt,
    } satisfies CareerAchievement];
  });
}

function achievementsFromAwards(playerId: string, monthly: MonthlyAwardSnapshot[], seasons: SeasonAwardSnapshot[]) {
  const result: CareerAchievement[] = [];
  for (const award of monthly) {
    const date = `${award.month}-28`;
    if (award.playerOfMonth?.player?.id === playerId) result.push({ id: "player_of_month_first", title: "Jogador do mês", description: "Foi eleito jogador do mês pela primeira vez.", icon: "🌟", achievedAt: date });
    if (award.selection?.some(entry => entry.player?.id === playerId)) result.push({ id: "monthly_selection_first", title: "Seleção do mês", description: "Entrou na seleção mensal pela primeira vez.", icon: "🏅", achievedAt: date });
  }
  for (const season of seasons) {
    const placing = season.annualMvp?.find(entry => entry.player?.id === playerId);
    if (placing) result.push({ id: `season_mvp_${placing.place}`, title: placing.place === 1 ? "Bola de Ouro" : placing.place === 2 ? "Bola de Prata" : "Bola de Bronze", description: `Terminou a temporada ${season.seasonNumber} no ${placing.place}º lugar.`, icon: placing.place === 1 ? "🥇" : placing.place === 2 ? "🥈" : "🥉", achievedAt: season.endedAt });
  }
  return result;
}

function milestone(levels: number[], previous: number, current: number, kind: "games" | "wins" | "goals" | "assists", match: EngagementMatch, playerId: string, add: (playerId: string, achievement: CareerAchievement) => void) {
  const reached = levels.filter(level => previous < level && current >= level);
  for (const level of reached) {
  const noun = kind === "games" ? "jogos" : kind === "wins" ? "vitórias" : kind === "goals" ? "gols" : "assistências";
  const first = level === 1;
  const title = first ? (kind === "games" ? "Estreia" : kind === "wins" ? "Primeira vitória" : kind === "goals" ? "Primeiro gol" : "Primeira assistência") : `${level} ${noun}`;
  const icon = kind === "games" ? "👕" : kind === "wins" ? "🏆" : kind === "goals" ? "⚽" : "🎯";
  add(playerId, achievement(`${kind}_${level}`, title, first ? `Registrou sua primeira marca de ${noun}.` : `Alcançou a marca de ${level} ${noun}.`, icon, match));
  }
}

function achievement(id: string, title: string, description: string, icon: string, match: EngagementMatch): CareerAchievement { return { id, title, description, icon, achievedAt: match.date, matchId: match.separationId }; }
function emptyTotals(): Totals { return { games: 0, wins: 0, losses: 0, goals: 0, assists: 0, winningStreak: 0, unbeatenStreak: 0, losingStreak: 0, attendanceStreak: 0, motmAwards: 0, socialAwards: 0 }; }
function orderMatches(matches: EngagementMatch[]) { return [...matches].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)); }
function participantTeam(match: EngagementMatch, playerId: string) { return match.blue.some(player => player.id === playerId) ? "BLUE" as const : match.yellow.some(player => player.id === playerId) ? "YELLOW" as const : null; }
function playerNames(match: EngagementMatch) { return Object.fromEntries([...match.blue, ...match.yellow].map(player => [player.id, player.displayName])); }
function countBy<T>(items: T[], key: (item: T) => string) { const result = new Map<string, number>(); for (const item of items) { const id = key(item); if (id) result.set(id, (result.get(id) || 0) + 1); } return result; }
function leaders(values: Map<string, number>) { const value = Math.max(0, ...values.values()); return { value, ids: [...values].filter(([, count]) => count === value && value > 0).map(([id]) => id) }; }
function joinNames(ids: string[], names: Record<string, string>) { const values = ids.map(id => names[id] || "Jogador"); return values.length < 2 ? values[0] || "Jogador" : `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`; }
function playerIdFromAchievement(achievement: CareerAchievement) { return achievement.playerId || achievement.id.split(":").at(-1) || ""; }
function uniqueAchievements(items: CareerAchievement[]) { const byId = new Map<string, CareerAchievement>(); for (const item of items.sort((a, b) => a.achievedAt.localeCompare(b.achievedAt))) if (!byId.has(item.id)) byId.set(item.id, item); return [...byId.values()]; }
function nextProgress(totals: Totals): AchievementProgress[] {
  const definitions: Array<[AchievementProgress["id"], string, number, number[]]> = [["games", "Jogos", totals.games, gameMilestones], ["wins", "Vitórias", totals.wins, winMilestones], ["goals", "Gols", totals.goals, goalMilestones], ["assists", "Assistências", totals.assists, assistMilestones]];
  return definitions.flatMap(([id, label, current, levels]) => { const target = levels.find(level => level > current); return target ? [{ id, label, current, target, percent: Math.min(100, Math.round((current / target) * 100)) }] : []; });
}
