"use client";
/* API errors are narrowed at runtime and match state is synchronized after each request. */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { accountSignInHref } from "../../lib/site-navigation";
import { SiteHeader } from "../components/SiteHeader";
import { buildWhatsAppShareUrl } from "../../lib/career-sharing";
import { WhatsAppIcon } from "../components/WhatsAppIcon";

type Attendance = { playerId: string; playerName: string; status: "PRESENT" | "ABSENT"; changeCount: number };
type Match = {
  id: string; title: string; matchAt: string; confirmationDeadline: string; location?: string | null;
  maxChanges: number; status: string; separationId?: string | null;
  counts: { present: number; absent: number; pending: number }; attendance: Attendance[];
  goalkeepers?: { present: number; max: number };
  shareMessage?: string;
  viewer: { playerId: string | null; status: "PRESENT" | "ABSENT" | null; changeCount: number; changesRemaining: number; canRespond: boolean; isGoalkeeper?: boolean };
};

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options), payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || "Não foi possível concluir."), { status: response.status });
  return payload;
}

export default function MatchesApp() {
  const [matches, setMatches] = useState<Match[]>([]), [loading, setLoading] = useState(true), [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(""), [isAdmin, setIsAdmin] = useState(false);
  const [targetMatchId, setTargetMatchId] = useState("");
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
    window.requestAnimationFrame(() => document.getElementById(targetMatchId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [matches, targetMatchId]);
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
  return <div className="member-page"><SiteHeader active="matches" isAdmin={isAdmin}/><main className="member-main match-site-main"><div className="member-account-head"><div><div className="eyebrow">AGENDA DA PELADA</div><h1>Partidas e presenças</h1><p>Suas respostas são sincronizadas entre o site e o aplicativo.</p></div></div>{error && <div className="alert error">{error}</div>}{notice && <div className="admin-notice"><span>✓</span><b>{notice}</b><button onClick={() => setNotice("")}>×</button></div>}<div className="match-site-list">{matches.length ? matches.map(item => <article id={item.id} className={`match-site-card ${item.status.toLowerCase()}`} key={item.id}><div className="match-site-head"><div><span className={`match-state ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span><h2>{item.title}</h2><p>{dateTime(item.matchAt)}{item.location ? ` · ${item.location}` : ""}</p></div><div className="match-site-count"><b>{item.counts.present}</b><span>confirmados</span></div></div><div className="match-site-deadline">Confirmações até <b>{dateTime(item.confirmationDeadline)}</b> · {item.maxChanges} remarcações permitidas</div><div className="match-site-roster"><Roster title="Presentes" entries={item.attendance.filter(entry => entry.status === "PRESENT")}/><Roster title="Ausentes" entries={item.attendance.filter(entry => entry.status === "ABSENT")}/></div>{item.viewer.playerId ? <div className="match-site-answer"><span>{goalkeeperLimitReached(item) ? "Os dois lugares de goleiro já estão preenchidos." : item.viewer.status ? `Sua resposta: ${item.viewer.status === "PRESENT" ? "Presente" : "Ausente"} · ${item.viewer.changesRemaining} remarcações restantes` : "Você ainda não respondeu."}</span>{item.status === "OPEN" && <div><button disabled={busy === item.id || !item.viewer.canRespond || goalkeeperLimitReached(item)} className={item.viewer.status === "PRESENT" ? "attendance-present on" : "attendance-present"} onClick={() => answer(item, "PRESENT")}>✓ Vou jogar</button><button disabled={busy === item.id || !item.viewer.canRespond} className={item.viewer.status === "ABSENT" ? "attendance-absent on" : "attendance-absent"} onClick={() => answer(item, "ABSENT")}>× Não vou</button></div>}</div> : <div className="alert">Sua conta ainda não está associada a um jogador. Faça a associação em “Minha conta” para responder.</div>}{item.status === "OPEN" && item.shareMessage ? <div className="match-site-share"><button type="button" className="ghost whatsapp-button" onClick={() => share(item)}><WhatsAppIcon/>Compartilhar parcial no WhatsApp</button></div> : null}{item.separationId && <a className="ghost match-separation-link" href={`/separacoes-salvas?separation=${encodeURIComponent(item.separationId)}`}>Ver times gerados ↗</a>}</article>) : <div className="empty">Nenhuma partida criada ainda.</div>}</div></main></div>;
}

function Roster({ title, entries }: { title: string; entries: Attendance[] }) { return <div><b>{title} ({entries.length})</b><p>{entries.length ? entries.map(item => item.playerName).join(", ") : "Ninguém ainda"}</p></div>; }
function goalkeeperLimitReached(item: Match) { return Boolean(item.viewer.isGoalkeeper && item.viewer.status !== "PRESENT" && (item.goalkeepers?.present || 0) >= (item.goalkeepers?.max || 2)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function statusLabel(status: string) { return status === "OPEN" ? "Confirmações abertas" : status === "CLOSED" ? "Lista encerrada" : "Cancelada"; }
