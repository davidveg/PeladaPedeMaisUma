"use client";

import { useRef, useState } from "react";
import type { InstanceConfiguration } from "../../lib/instance-config";
import type { CareerAchievement } from "../../lib/player-engagement";
import { buildWhatsAppShareUrl } from "../../lib/career-sharing";
import { renderRecapPng, shareRecapFile } from "../recap-image-client";
import { AchievementBadge } from "./AchievementBadge";

type SharePlayer = { displayName: string; photoUrl?: string | null };

export function AchievementShareCard({ achievement, player, brand }: { achievement: CareerAchievement; player: SharePlayer; brand: InstanceConfiguration }) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const date = achievementDate(achievement.achievedAt);
  const rarity = achievement.rarity ? achievementRarityLabel(achievement.rarity.tier) : "CONQUISTA";

  async function share() {
    setSharing(true);
    setNotice("");
    try {
      if (!captureRef.current) throw new Error("Cartão indisponível para compartilhamento.");
      const matchUrl = achievement.matchId
        ? `${window.location.origin}/separacoes-salvas?separation=${encodeURIComponent(achievement.matchId)}`
        : window.location.href;
      const title = `${achievement.title} · ${player.displayName}`;
      const message = [`🏆 *${player.displayName} desbloqueou ${achievement.title}*`, achievement.description, `📅 ${date}`, `⚽ ${achievement.matchTitle || "Premiação oficial da pelada"}`, "", matchUrl].join("\n");
      const image = await renderRecapPng(captureRef.current, title, "#123f31");
      const outcome = await shareRecapFile(image, title, message);
      if (outcome === "downloaded") {
        window.open(buildWhatsAppShareUrl(message), "_blank", "noopener,noreferrer");
        setNotice("Imagem baixada. O WhatsApp foi aberto com a legenda.");
      }
    } catch (error: any) {
      setNotice(error?.message || "Não foi possível gerar o cartão da conquista.");
    } finally {
      setSharing(false);
    }
  }

  return <>
    <button className="achievement-share-button" type="button" disabled={sharing} onClick={share}>{sharing ? "Gerando imagem…" : "Compartilhar conquista"}</button>
    {notice && <small className="achievement-share-notice" role="status">{notice}</small>}
    <span className="achievement-share-capture-shell" aria-hidden="true">
      <div className={`achievement-share-card rarity-${achievement.rarity?.tier || "common"}`} ref={captureRef}>
        <header>
          <div className="achievement-share-brand">{brand.logoUrl ? <img src={brand.logoUrl} alt=""/> : <span>⚽</span>}<b>{brand.siteName}</b></div>
          <small>CONQUISTA DESBLOQUEADA</small>
        </header>
        <main>
          <div className="achievement-share-badge"><AchievementBadge id={achievement.id} icon={achievement.icon} title={achievement.title}/></div>
          <span className="achievement-share-rarity">{rarity}</span>
          <h3>{achievement.title}</h3>
          <p>{achievement.description}</p>
          <div className="achievement-share-player">{player.photoUrl ? <img src={player.photoUrl} alt=""/> : <span>👤</span>}<div><small>CONQUISTA DE</small><b>{player.displayName}</b></div></div>
        </main>
        <footer><span><small>DATA</small><b>{date}</b></span><span><small>PARTIDA</small><b>{achievement.matchTitle || "Premiação oficial da pelada"}</b></span></footer>
      </div>
    </span>
  </>;
}

function achievementDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function achievementRarityLabel(tier: "common" | "rare" | "epic" | "legendary") {
  return tier === "legendary" ? "LENDÁRIA" : tier === "epic" ? "ÉPICA" : tier === "rare" ? "RARA" : "COMUM";
}
