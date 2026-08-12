import type { Separation } from "./types";
import { teamColorMarker } from "./team-colors.ts";

function publicSeparationUrl(publicBaseUrl: string, separationId: string) {
  const url = new URL(`${publicBaseUrl.replace(/\/$/, "")}/?separation=${encodeURIComponent(separationId)}`);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Configure uma URL pública HTTPS para compartilhar.");
  }
  return url.toString();
}

export function careerResultsMessage(item: Separation, publicBaseUrl: string, branding: { siteName?: string; teamBlueName?: string; teamYellowName?: string; teamBlueColor?: string; teamYellowColor?: string } = {}) {
  if (!item.career || item.career.status !== "CLOSED") throw new Error("A votação ainda não foi encerrada.");
  const results = item.career.results;
  const names = Object.fromEntries([...item.snapshot.blue, ...item.snapshot.yellow].map(player => [player.id, player.displayName]));
  const medals = [0x1f947, 0x1f948, 0x1f949].map(code => String.fromCodePoint(code));
  const signed = (value: number) => `${value > 0 ? "+" : ""}${Number(value).toFixed(1)}`;
  const podium = (entries = results?.motm || []) => entries.map((entry, index) => `${medals[index] || `${entry.place}º`} ${names[entry.playerId] || "Jogador"} (${signed(entry.momentum)})`).join("\n");
  const voteCount = Number(results?.voteCount || 0);
  const details = voteCount
    ? `${String.fromCodePoint(0x1f3c6)} *Man of the Match*\n${podium(results?.motm)}\n\n${String.fromCodePoint(0x26a0, 0xfe0f)} *Deception of the Match*\n${podium(results?.dotm)}`
    : "Votação encerrada sem votos válidos.";
  const url = publicSeparationUrl(publicBaseUrl, item.id);
  const siteName = branding.siteName || "Pelada Pede Mais Uma", teamBlueName = branding.teamBlueName || "Azul", teamYellowName = branding.teamYellowName || "Amarelo";
  const teamBlueMarker = teamColorMarker(branding.teamBlueColor || "#1768E5"), teamYellowMarker = teamColorMarker(branding.teamYellowColor || "#F4BF20");

  return `${String.fromCodePoint(0x26bd, 0xfe0f)} *${siteName.toLocaleUpperCase("pt-BR")}*\n\n${String.fromCodePoint(0x1f3c6)} *Resultado da votação*\n${item.matchTitle.replace(/\*/g, "").trim()}\n\n*Placar:* ${teamBlueMarker} ${teamBlueName} ${item.career.blueScore} × ${item.career.yellowScore} ${teamYellowName} ${teamYellowMarker}\n*Votos registrados:* ${voteCount}\n\n${details}\n\n${String.fromCodePoint(0x1f4ca)} *Veja os detalhes da partida:*\n${url}`;
}
