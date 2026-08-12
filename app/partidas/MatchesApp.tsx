"use client";
/* API errors are narrowed at runtime and match state is synchronized after each request. */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { accountSignInHref } from "../../lib/site-navigation";
import { SiteHeader } from "../components/SiteHeader";
import { buildWhatsAppShareUrl } from "../../lib/career-sharing";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { WeatherPreview } from "../components/WeatherPreview";

type Attendance = { playerId: string; playerName: string; status: "PRESENT" | "ABSENT"; changeCount: number };
type Match = {
  id: string; title: string; matchAt: string; confirmationDeadline: string; location?: string | null;
  maxChanges: number; status: string; separationId?: string | null;
  counts: { present: number; absent: number; pending: number; preconfirmed?: number }; attendance: Attendance[];
  guestPreconfirmation?: { enabled: boolean; threshold: number; canApprove: boolean };
  preconfirmedGuests?: { playerId: string; playerName: string; photoUrl?: string | null }[];
  goalkeepers?: { present: number; max: number };
  shareMessage?: string;
  weather?: any;
  viewer: { playerId: string | null; status: "PRESENT" | "ABSENT" | null; changeCount: number; changesRemaining: number; canRespond: boolean; canConfirmPresence?: boolean; isGoalkeeper?: boolean; isGuest?: boolean; preconfirmed?: boolean };
};

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options), payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || "Não foi possível concluir."), { status: response.status });
  return payload;
}

export default function MatchesApp() {
  const [matches, setMatches] = useState<Match[]>([]), [loading, setLoading] = useState(true), [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(""), [isAdmin, setIsAdmin] = useState(false);
  const [targetMatchId, setTargetMatchId] = useState(""), [onlyActiveOrSeparated, setOnlyActiveOrSeparated] = useState(true);
  async function load() {
    try {
      const [matchPayload, authPayload] = await Promise.all([api("/api/matches"), api("/api/member-auth")]);
      setMatches(matchPayload.matches || []);
      setIsAdmin(authPayload.member?.accountType === "administrator");
      setUnauthorized(false);
    }
    catch (cause: any) { if (cause.status === 401) setUnauthorized(true); else setError(cause.message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    setTargetMatchId(new URLSearchParams(window.location.search).get("match") || "");
    void load();
  }, []);
  useEffect(() => {
    if (!targetMatchId || !matches.some(item => item.id === targetMatchId)) return;
    if (onlyActiveOrSeparated && !isActiveOrSeparated(matches.find(item => item.id === targetMatchId)!)) { setOnlyActiveOrSeparated(false); return; }
    window.requestAnimationFrame(() => document.getElementById(targetMatchId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [matches, onlyActiveOrSeparated, targetMatchId]);
  async function answer(item: Match, status: "PRESENT" | "ABSENT") {
    const changes = item.viewer.status && item.viewer.status !== status;
    if (changes && !confirm(`Alterar sua resposta? Isso consumirá 1 das ${item.maxChanges} remarcações permitidas.`)) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const result = await api("/api/matches", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ matchId: item.id, status }) });
      setNotice(result.changed ? "Sua resposta foi registrada e os participantes foram notificados." : "Esta resposta já estava registrada.");
      await load();
    } catch (cause: any) {
      if (cause.status === 401) {
        setUnauthorized(true);
        window.location.assign(accountSignInHref(targetMatchId ? `/partidas?match=${encodeURIComponent(targetMatchId)}` : "/partidas", true));
      } else setError(cause.message);
    } finally { setBusy(""); }
  }
  function share(item: Match) {
    if (!item.shareMessage?.trim()) {
      setError("A parcial desta partida não está disponível. Atualize a página e tente novamente.");
      return;
    }
    window.open(buildWhatsAppShareUrl(item.shareMessage), "_blank", "noopener,noreferrer");
  }
  if (loading) return <div className="member-loading">Carregando partidas…</div>;
  if (unauthorized) {
    const returnTo = targetMatchId ? `/partidas?match=${encodeURIComponent(targetMatchId)}` : "/partidas";
    return <div className="member-page"><SiteHeader active="matches"/><main className="member-main"><div className="member-access-card match-login-required"><div className="ball">📅</div><h2>Entre para confirmar</h2><p>Use sua conta de jogador ou administrador para confirmar presença.</p><a className="primary" href={accountSignInHref(returnTo)}>Entrar na minha conta</a></div></main></div>;
  }
  const visibleMatches = onlyActiveOrSeparated ? matches.filter(isActiveOrSeparated) : matches;
  return <div className="member-page"><SiteHeader active="matches" isAdmin={isAdmin}/><main className="member-main match-site-main"><div className="member-account-head"><div><div className="eyebrow">AGENDA DA PELADA</div><h1>Partidas e presenças</h1><p>Suas respostas são sincronizadas entre o site e o aplicativo.</p></div></div>{error && <div className="alert error">{error}</div>}{notice && <div className="admin-notice"><span>✓</span><b>{notice}</b><button onClick={() => setNotice("")}>×</button></div>}<label className="match-list-filter"><span><b>Somente abertas ou com times gerados</b><small>Oculta partidas canceladas e listas encerradas sem separação.</small></span><input type="checkbox" checked={onlyActiveOrSeparated} onChange={event => setOnlyActiveOrSeparated(event.target.checked)}/></label><div className="match-site-list">{visibleMatches.length ? visibleMatches.map(item => <MatchSiteCard key={item.id} item={item} busy={busy} onAnswer={answer} onShare={share}/>) : <div className="empty">Nenhuma partida corresponde ao filtro atual.</div>}</div></main></div>;
}

function MatchSiteCard({ item, busy, onAnswer, onShare }: { item: Match; busy: string; onAnswer(item: Match, status: "PRESENT" | "ABSENT"): void; onShare(item: Match): void }) {
  const waiting = item.preconfirmedGuests || [];
  const guestManaged = Boolean(item.guestPreconfirmation?.enabled && item.viewer.isGuest);
  const answerText = guestManaged
    ? item.viewer.status === "PRESENT" ? "Sua presença foi aprovada pelo administrador."
      : item.viewer.preconfirmed ? "Você está na lista de espera e aguarda aprovação do administrador."
      : item.viewer.status === "ABSENT" ? "Sua resposta: Ausente."
      : "A presença de convidados é gerenciada pelos administradores."
    : goalkeeperLimitReached(item) ? "Os dois lugares de goleiro já estão preenchidos."
      : item.viewer.status ? `Sua resposta: ${item.viewer.status === "PRESENT" ? "Presente" : "Ausente"} · ${item.viewer.changesRemaining} remarcações restantes`
      : "Você ainda não respondeu.";
  return <article id={item.id} className={`match-site-card ${item.status.toLowerCase()}`}>
    <div className="match-site-head"><div><span className={`match-state ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span><h2>{item.title}</h2><p>{dateTime(item.matchAt)}{item.location ? ` · ${item.location}` : ""}</p></div><div className="match-site-count"><b>{item.counts.present}</b><span>confirmados</span></div></div>
    <div className="match-site-deadline">Confirmações até <b>{dateTime(item.confirmationDeadline)}</b> · {item.maxChanges} remarcações permitidas</div>
    <WeatherPreview weather={item.weather}/>
    <div className="match-site-roster">
      <Roster title="Presentes" entries={item.attendance.filter(entry => entry.status === "PRESENT")}/>
      {item.guestPreconfirmation?.enabled && <WaitingRoster entries={waiting}/>}
      <Roster title="Ausentes" entries={item.attendance.filter(entry => entry.status === "ABSENT")}/>
    </div>
    {item.viewer.playerId ? <div className="match-site-answer"><span>{answerText}</span>{item.status === "OPEN" && <div>
      {!guestManaged && <button disabled={busy === item.id || !item.viewer.canConfirmPresence || goalkeeperLimitReached(item)} className={item.viewer.status === "PRESENT" ? "attendance-present on" : "attendance-present"} onClick={() => onAnswer(item, "PRESENT")}>✓ Vou jogar</button>}
      <button disabled={busy === item.id || !item.viewer.canRespond} className={item.viewer.status === "ABSENT" ? "attendance-absent on" : "attendance-absent"} onClick={() => onAnswer(item, "ABSENT")}>× Não vou</button>
    </div>}</div> : <div className="alert">Sua conta ainda não está associada a um jogador. Faça a associação em “Minha conta” para responder.</div>}
    {item.status === "OPEN" && item.shareMessage ? <div className="match-site-share"><button type="button" className="ghost whatsapp-button" onClick={() => onShare(item)}><WhatsAppIcon/>Compartilhar parcial no WhatsApp</button></div> : null}
    {item.separationId && <a className="ghost match-separation-link" href={`/separacoes-salvas?separation=${encodeURIComponent(item.separationId)}`}>Ver times gerados ↗</a>}
  </article>;
}

function Roster({ title, entries }: { title: string; entries: Attendance[] }) { return <div><b>{title} ({entries.length})</b><p>{entries.length ? entries.map(item => item.playerName).join(", ") : "Ninguém ainda"}</p></div>; }
function WaitingRoster({ entries }: { entries: { playerId: string; playerName: string }[] }) { return <div className="waiting"><b>Lista de espera ({entries.length})</b><p>{entries.length ? entries.map(item => item.playerName).join(", ") : "Ninguém aguardando"}</p></div>; }
function goalkeeperLimitReached(item: Match) { return Boolean(item.viewer.isGoalkeeper && item.viewer.status !== "PRESENT" && (item.goalkeepers?.present || 0) >= (item.goalkeepers?.max || 2)); }
function isActiveOrSeparated(item: Match) { return item.status !== "CANCELLED" && (item.status === "OPEN" || Boolean(item.separationId)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function statusLabel(status: string) { return status === "OPEN" ? "Confirmações abertas" : status === "CLOSED" ? "Lista encerrada" : "Cancelada"; }
