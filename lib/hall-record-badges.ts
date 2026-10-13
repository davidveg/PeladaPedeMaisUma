const hallRecordBadgeFiles: Record<string, string> = {
  games: "games.png",
  wins: "wins.png",
  goals: "goals.png",
  assists: "assists.png",
  motmAwards: "motm-awards.png",
  socialAwards: "social-awards.png",
};

export function hallRecordBadgePath(id: string) {
  const file = hallRecordBadgeFiles[String(id || "")];
  return file ? `/hall-of-fame/records/${file}` : "";
}
