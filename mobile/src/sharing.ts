import { Linking, Share } from "react-native";
import type { Player, Separation } from "./types";
import { teamColorMarker } from "./team-colors";
export { careerResultsMessage } from "./career-results";

function ensurePublicHttps(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname)) throw new Error("Configure uma URL pública HTTPS para compartilhar.");
  return url;
}

export async function shareText(message?: string | null) {
  if (!message?.trim()) throw new Error("A mensagem de compartilhamento não está disponível. Atualize os dados e tente novamente.");
  const whatsapp = `whatsapp://send?text=${encodeURIComponent(message)}`;
  if (await Linking.canOpenURL(whatsapp)) return Linking.openURL(whatsapp);
  await Share.share({ message });
}

type TeamBranding = { teamBlueName?: string; teamYellowName?: string; teamBlueColor?: string; teamYellowColor?: string };
export function separationMessage(item: Separation, publicBaseUrl: string, branding: TeamBranding = {}) {
  const lines = (players: Player[]) => players.map((player, index) => `${index + 1}. ${player.displayName}`).join("\n");
  const blueName=branding.teamBlueName||"Azul",yellowName=branding.teamYellowName||"Amarelo",blueMarker=teamColorMarker(branding.teamBlueColor||"#1768E5"),yellowMarker=teamColorMarker(branding.teamYellowColor||"#F4BF20");
  const score = item.career ? `\n\nPlacar: ${blueMarker} ${blueName} ${item.career.blueScore} × ${item.career.yellowScore} ${yellowName} ${yellowMarker}` : "";
  const url = ensurePublicHttps(`${publicBaseUrl.replace(/\/$/, "")}/?separation=${encodeURIComponent(item.id)}`);
  return `⚽ ${item.matchTitle}\n\n${blueMarker} TIME ${blueName.toLocaleUpperCase("pt-BR")}\n${lines(item.snapshot.blue)}\n\n${yellowMarker} TIME ${yellowName.toLocaleUpperCase("pt-BR")}\n${lines(item.snapshot.yellow)}${score}\n\n${url}`;
}

export function votingMessage(item: Separation, votingUrl: string, branding: TeamBranding = {}) {
  const url = ensurePublicHttps(votingUrl);
  const blueName=branding.teamBlueName||"Azul",yellowName=branding.teamYellowName||"Amarelo",blueMarker=teamColorMarker(branding.teamBlueColor||"#1768E5"),yellowMarker=teamColorMarker(branding.teamYellowColor||"#F4BF20");
  return `🗳️ VOTAÇÃO — ${item.matchTitle}\n\nPlacar: ${blueMarker} ${blueName} ${item.career?.blueScore ?? 0} × ${item.career?.yellowScore ?? 0} ${yellowName} ${yellowMarker}\n\nEscolha os três melhores e os três que ficaram devendo.\nPrazo: ${formatDate(item.career?.closesAt)}\n\n${url}`;
}

export const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Data não informada";
