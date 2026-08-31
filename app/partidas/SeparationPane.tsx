"use client";
/* Saved snapshots use the same schema-flexible payload as FootballApp. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { PlayerDetail, SavedSeparation, resultConfig } from "../FootballApp";
import VotingApp from "../votacao/VotingApp";
import MatchVotingSharing from "./MatchVotingSharing";
import { useInstanceBranding } from "../InstanceBranding";
import { teamColorMarker } from "../../lib/team-colors";
import { type Player } from "../../lib/football";

export async function hubApi(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "Não foi possível carregar a partida."), { status: response.status });
  return body;
}

export default function SeparationPane({ id, section, permissions, onChanged }: {
  id: string; section: string; permissions: string[]; onChanged(): void;
}) {
  const { config: brand } = useInstanceBranding();
  const [item, setItem] = useState<any>(null), [careerConfig, setCareerConfig] = useState<any>(null), [cardConfig, setCardConfig] = useState<any>({});
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<Player | null>(null);
  const allowed = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const canManageResults = allowed("MATCH_RESULTS_MANAGE");
  const load = useCallback(async () => {
    try {
      const data = await hubApi(`/api/separations?id=${encodeURIComponent(id)}`);
      setItem(data.separations[0] || null);
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) {
        setItem(null); setPlayer(null);
        window.dispatchEvent(new Event("ppm:match-access-required"));
      }
      throw cause;
    }
  }, [id]);
  useEffect(() => {
    // Data arrives asynchronously; keep the existing snapshot current after returning to the tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(cause => setError(cause.message)).finally(() => setLoading(false));
    const refresh = () => { if (document.visibilityState === "visible") void load().catch(() => undefined); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  useEffect(() => {
    hubApi("/api/public-players?configOnly=1").then(data => setCardConfig(data.config || {})).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (canManageResults) hubApi("/api/career/admin?configOnly=1").then(data => setCareerConfig(data.config)).catch(cause => setError(cause.message));
  }, [canManageResults]);
  async function mutate(url: string, method: string, body: any) {
    const result = await hubApi(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    await load(); onChanged(); setNotice(result.message || "Alterações salvas.");
  }
  async function share() {
    try {
      const url = `${window.location.origin}/partidas?separation=${encodeURIComponent(id)}`;
      if (navigator.share) await navigator.share({ title: item.matchTitle, url });
      else { await navigator.clipboard.writeText(url); setNotice("Link copiado."); }
    } catch (cause: any) { if (cause.name !== "AbortError") setError("Não foi possível compartilhar o link."); }
  }
  async function copy(withScores: boolean) {
    try {
      const config = resultConfig(item.snapshot);
      const format = (p: Player, index: number) => {
        const goalkeeper = p.type === "goalkeeper" || p.primaryPosition === "Goleiro";
        const attributes = goalkeeper ? `Hab ${p.skill.toFixed(1)} · Pos ${(p.goalkeeperPositioning ?? p.speed).toFixed(1)} · Saída ${(p.goalExit ?? p.marking ?? 3).toFixed(1)}` : `Vel ${p.speed.toFixed(1)} · Hab ${p.skill.toFixed(1)} · Mar ${(p.marking ?? 3).toFixed(1)}`;
        return `${index + 1}. ${p.displayName}${p.id === item.snapshot.extraId ? " (jogador adicional)" : ""}${withScores ? ` — ${p.primaryPosition} · ${attributes}` : ""}`;
      };
      const team = (side: "blue" | "yellow", name: string, color: string) => `${teamColorMarker(color)} TIME ${name.toUpperCase()}\n${item.snapshot[side].map(format).join("\n")}`;
      await navigator.clipboard.writeText(`⚽ ${item.matchTitle}\n\n${team("blue", brand.teamBlueName, brand.teamBlueColor)}\n\n${team("yellow", brand.teamYellowName, brand.teamYellowColor)}\n\n📊 ${item.balanceClassification}\nFísico: ${Math.round(config.speedWeight * 100)}% · Técnica: ${Math.round(config.skillWeight * 100)}% · Marcação: ${Math.round(config.markingWeight * 100)}%\nInteligência tática: ${Math.round(config.tacticalIntelligenceWeight * 100)}% · Competitividade: ${Math.round(config.competitivenessWeight * 100)}%`);
      setNotice("Times copiados.");
    } catch { setError("Não foi possível copiar os times."); }
  }
  if (loading) return <div className="empty" role="status">Carregando detalhes…</div>;
  if (!item) return <div className="alert">{error || "Esta separação não está mais disponível."}</div>;
  return <div className="match-separation-pane">
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert" role="status">{notice}</div>}
    {section === "voting" ? item.career ? <><MatchVotingSharing item={item}/><VotingApp key={item.career.votingToken} votingToken={item.career.votingToken} embedded/></> : <div className="empty">A votação ficará disponível após a confirmação do resultado, quando o Modo Carreira estiver habilitado.</div> :
      <SavedSeparation key={`${id}:${section}`} item={item} section={section} isAdmin={allowed("SEPARATIONS_MANAGE")} canManageResults={canManageResults} careerConfig={careerConfig || { enabled: false }} publicBaseUrl={typeof window === "undefined" ? "" : window.location.origin}
        onConfirmCareer={(separationId: string, blueScore: number, yellowScore: number, contributions: any[]) => mutate("/api/career/match", "POST", { separationId, blueScore, yellowScore, contributions })}
        onEditCareer={(matchId: string, blueScore: number, yellowScore: number, contributions: any[]) => mutate("/api/career/match", "PUT", { matchId, blueScore, yellowScore, contributions })}
        onSaveArrivalOrder={(id: string, arrivalOrder: unknown) => mutate("/api/separations", "PATCH", { id, arrivalOrder })}
        onSaveTeams={(id: string, blue: string[], yellow: string[]) => mutate("/api/separations", "PATCH", { action: "teams", id, blue, yellow })}
        onBack={() => window.location.assign("/partidas")} onShareLink={share} onPlayer={setPlayer} onCopy={copy}/>
    }
    {player && <PlayerDetail player={player} config={{ ...resultConfig(item.snapshot), showContributions: cardConfig.showContributions, cardTiersEnabled: cardConfig.cardTiersEnabled, cardBronzeMax: cardConfig.cardBronzeMax, cardSilverMax: cardConfig.cardSilverMax, cardGoldMax: cardConfig.cardGoldMax }} onClose={() => setPlayer(null)}/>}
  </div>;
}
