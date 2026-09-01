export type MatchSharePlayer = {
  id: string;
  displayName: string;
  type?: string | null;
  primaryPosition?: string | null;
};
export type MatchShareAttendance = { playerId: string; status: "PRESENT" | "ABSENT" };

export function buildMatchAttendanceShareMessage(input: {
  title: string;
  matchAt: string;
  location?: string | null;
  players: MatchSharePlayer[];
  attendance: MatchShareAttendance[];
  preconfirmedGuestIds?: string[];
  confirmationUrl?: string | null;
  timezone?: string;
}) {
  const status = new Map(input.attendance.map(entry => [entry.playerId, entry.status]));
  const waitingPosition = new Map((input.preconfirmedGuestIds || []).map((id, index) => [id, index]));
  const preconfirmedGuestIds = new Set(input.preconfirmedGuestIds || []);
  const isGoalkeeper = (player: MatchSharePlayer) => player.type === "goalkeeper" || player.primaryPosition === "Goleiro";
  const ordered = (players: MatchSharePlayer[]) => players.sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
  const orderedGuests = (players: MatchSharePlayer[]) => players.sort((a, b) => {
    const aWaiting = waitingPosition.get(a.id), bWaiting = waitingPosition.get(b.id);
    if (aWaiting !== undefined && bWaiting !== undefined) return aWaiting - bWaiting;
    if (aWaiting !== undefined) return 1;
    if (bWaiting !== undefined) return -1;
    return a.displayName.localeCompare(b.displayName, "pt-BR");
  });
  const goalkeepers = ordered(input.players.filter(player => isGoalkeeper(player) && status.get(player.id) === "PRESENT")).slice(0, 2);
  const linePlayers = input.players.filter(player => !isGoalkeeper(player) && (
    player.type !== "guest" || status.get(player.id) === "PRESENT" || preconfirmedGuestIds.has(player.id)
  ));
  const displayedPlayers = [...linePlayers, ...goalkeepers];
  const displayedPlayerIds = new Set(displayedPlayers.map(player => player.id));
  const displayedAttendance = input.attendance.filter(entry => displayedPlayerIds.has(entry.playerId));
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    timeZone: input.timezone || "America/Sao_Paulo",
  }).format(new Date(input.matchAt));
  const header = [input.title.trim(), date, input.location?.trim()].filter(Boolean).join(" - ");
  const groups = [
    { title: "Mensalistas", players: ordered(linePlayers.filter(player => player.type !== "guest")) },
    { title: "Convidados", players: orderedGuests(linePlayers.filter(player => player.type === "guest")) },
  ];
  const line = (player: MatchSharePlayer, index: number) => {
    const answer = status.get(player.id);
    return `${index + 1} - ${player.displayName}: ${answer === "PRESENT" ? "✅" : answer === "ABSENT" ? "❌" : ""}`;
  };
  const goalkeeperSection = `Goleiros:\n${[0, 1].map(index => `${index + 1} - ${goalkeepers[index]?.displayName || ""}`).join("\n")}`;
  const sections = [goalkeeperSection, ...groups.filter(group => group.players.length).map(group => `${group.title}:\n${group.players.map(line).join("\n")}`)];
  const present = displayedAttendance.filter(entry => entry.status === "PRESENT").length;
  const absent = displayedAttendance.filter(entry => entry.status === "ABSENT").length;
  const pending = Math.max(0, displayedPlayers.length - new Set(displayedAttendance.map(entry => entry.playerId)).size);
  const answeredWaiting = displayedPlayers.filter(player => preconfirmedGuestIds.has(player.id)).length;
  const confirmation = input.confirmationUrl?.trim()
    ? `🔗 *Confirme sua presença no site:*\n${input.confirmationUrl.trim()}\n\n`
    : "";
  return `⚽ *${header.toLocaleUpperCase("pt-BR")}*\n\n${confirmation}Aguardando confirmações de presença.\n✅ ${present} confirmados · ❌ ${absent} ausentes · ⏳ ${Math.max(0, pending - answeredWaiting)} pendentes\n\n${sections.join("\n\n")}`;
}
