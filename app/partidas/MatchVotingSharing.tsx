"use client";
/* Voting snapshots share the established career payload. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import QRCode from "qrcode";
import { buildVotingUrl, buildWhatsAppCareerResultsMessage, buildWhatsAppShareUrl, buildWhatsAppVotingMessage } from "../../lib/career-sharing";
import { useInstanceBranding } from "../InstanceBranding";
import { WhatsAppIcon } from "../components/WhatsAppIcon";

export default function MatchVotingSharing({ item }: { item: any }) {
  const { config: brand } = useInstanceBranding(), [qr, setQr] = useState(""), [message, setMessage] = useState("");
  const closed = item.career.status === "CLOSED";
  const votingUrl = () => buildVotingUrl(window.location.origin, item.career.votingToken);
  async function copy() {
    try { await navigator.clipboard.writeText(votingUrl()); setMessage("Link da votação copiado."); }
    catch { setMessage("Não foi possível copiar o link."); }
  }
  async function showQr() {
    if (qr) { setQr(""); return; }
    try { setQr(await QRCode.toDataURL(votingUrl(), { width: 220, margin: 1 })); }
    catch { setMessage("Não foi possível gerar o QR Code."); }
  }
  function share() {
    const text = closed ? buildWhatsAppCareerResultsMessage({
      matchTitle: item.matchTitle, blueScore: item.career.blueScore, yellowScore: item.career.yellowScore,
      results: item.career.results, names: Object.fromEntries([...item.snapshot.blue, ...item.snapshot.yellow].map((p: any) => [p.id, p.displayName])),
      separationUrl: `${window.location.origin}/partidas?separation=${encodeURIComponent(item.id)}&tab=voting`,
      siteName: brand.siteName, teamBlueName: brand.teamBlueName, teamYellowName: brand.teamYellowName,
    }) : buildWhatsAppVotingMessage({ matchTitle: item.matchTitle, votingUrl: votingUrl(), closesAt: item.career.closesAt, siteName: brand.siteName });
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  }
  return <div className="match-voting-sharing"><div className="result-actions"><button className="ghost" onClick={copy}>Copiar link da votação</button>{!closed && <button className="ghost" onClick={showQr}>{qr ? "Ocultar QR Code" : "Ver QR Code"}</button>}<button className="primary whatsapp-button" onClick={share}><WhatsAppIcon/>{closed ? "Compartilhar resultado" : "Compartilhar votação"}</button></div>{qr && <img src={qr} width="220" height="220" alt="QR Code para a votação desta partida"/>}{message && <p role="status">{message}</p>}</div>;
}
