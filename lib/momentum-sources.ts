export type LegacyMomentumPlayer = { id: string; momentum: number };
export type SeparatedMomentum = { id: string; resultMomentum: number; votingMomentum: number };

export function splitLegacyMomentumSources(players: LegacyMomentumPlayer[], resultSnapshots: unknown[]): SeparatedMomentum[] {
  const votingByPlayer = new Map<string, number>();
  for (const snapshot of resultSnapshots) {
    try {
      const results = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot as any;
      for (const entry of [...(results?.motm || []), ...(results?.dotm || [])]) {
        const playerId = String(entry.playerId || "");
        if (playerId) votingByPlayer.set(playerId, (votingByPlayer.get(playerId) || 0) + Number(entry.momentum || 0));
      }
    } catch {
      // Snapshots corrompidos são ignorados; o saldo correspondente permanece como momentum de resultado.
    }
  }
  return players.map(player => {
    const votingMomentum = round3(votingByPlayer.get(String(player.id)) || 0);
    return { id: String(player.id), resultMomentum: round3(Number(player.momentum || 0) - votingMomentum), votingMomentum };
  });
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
