import { Linking, Share } from "react-native";
import type { Player, Separation } from "./types";

function ensurePublicHttps(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname)) throw new Error("Configure uma URL pública HTTPS para compartilhar.");
  return url;
}

export async function shareText(message: string) {
  const whatsapp = `whatsapp://send?text=${encodeURIComponent(message)}`;
  if (await Linking.canOpenURL(whatsapp)) return Linking.openURL(whatsapp);
  await Share.share({ message });
}

export function separationMessage(item: Separation, publicBaseUrl: string) {
  const lines = (players: Player[]) => players.map((player, index) => `${index + 1}. ${player.displayName}`).join("\n");
  const score = item.career ? `\n\nPlacar: 🔵 ${item.career.blueScore} × ${item.career.yellowScore} 🟡` : "";
  const url = ensurePublicHttps(`${publicBaseUrl.replace(/\/$/, "")}/?separation=${encodeURIComponent(item.id)}`);
  return `⚽ ${item.matchTitle}\n\n🔵 TIME AZUL\n${lines(item.snapshot.blue)}\n\n🟡 TIME AMARELO\n${lines(item.snapshot.yellow)}${score}\n\n${url}`;
}

export function votingMessage(item: Separation, votingUrl: string) {
  const url = ensurePublicHttps(votingUrl);
  return `🗳️ VOTAÇÃO — ${item.matchTitle}\n\nPlacar: 🔵 ${item.career?.blueScore ?? 0} × ${item.career?.yellowScore ?? 0} 🟡\n\nEscolha os três melhores e os três que ficaram devendo.\nPrazo: ${formatDate(item.career?.closesAt)}\n\n${url}`;
}

export const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Data não informada";
