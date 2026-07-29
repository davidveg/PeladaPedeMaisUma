"use client";
/* The administrative API and existing panel shell intentionally use schema-flexible payloads. */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { buildWhatsAppShareUrl } from "../../lib/career-sharing";
import { WhatsAppIcon } from "../components/WhatsAppIcon";

type Api = (url: string, options?: RequestInit) => Promise<any>;
type Props = { api: Api; setError(value: string): void; setNotice(value: string): void; instanceConfig?: any };
type Attendance = { playerId: string; playerName: string; status: "PRESENT" | "ABSENT"; changeCount: number };
type Match = {
  id: string; title: string; matchAt: string; confirmationDeadline: string; location?: string | null;
  maxChanges: number; status: string; separationId?: string | null;
  counts: { present: number; absent: number; pending: number }; attendance: Attendance[];
  goalkeepers?: { present: number; max: number };
  shareMessage?: string;
};
type Player = { id: string; displayName: string; type: string; primaryPosition: string };

export function MatchesPanel({ api, setError, setNotice, instanceConfig }: Props) {
  const [data, setData] = useState<{ matches: Match[]; players: Player[] }>({ matches: [], players: [] });
  const [editing, setEditing] = useState<Match | "new" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const result = await api("/api/admin/matches");
      setData(result);
      setSelected(current => current && result.matches.some((item: Match) => item.id === current) ? current : result.matches[0]?.id || null);
    } catch (cause: any) { setError(cause.message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const current = data.matches.find(item => item.id === selected) || null;

  async function attendance(playerId: string, status: "PRESENT" | "ABSENT") {
    setError("");
    try {
      const result = await api("/api/admin/matches", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "attendance", matchId: current?.id, playerId, status }),
      });
      setNotice(result.message); await load();
    } catch (cause: any) { setError(cause.message); }
  }
  function closeMatch(item: Match) {
    window.location.assign(`/?matchId=${encodeURIComponent(item.id)}`);
  }
  async function cancelMatch(item: Match) {
    if (!confirm(`Cancelar ${item.title}? Todos os usuários serão notificados.`)) return;
    setError("");
    try {
      const result = await api("/api/admin/matches", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", matchId: item.id }),
      });
      setNotice(result.message); await load();
    } catch (cause: any) { setError(cause.message); }
  }

  if (loading && !data.matches.length) return <div className="admin-card match-admin-empty">Carregando partidas…</div>;
  return <section className="admin-matches">
    <div className="match-admin-toolbar"><div><b>{data.matches.filter(item => item.status === "OPEN").length}</b><span>partidas abertas</span></div><p>A confirmação feita no site e no aplicativo usa a mesma contagem de remarcações.</p><button className="primary" onClick={() => setEditing("new")}>+ Criar partida</button></div>
    <div className="match-admin-layout"><div className="match-admin-list">{data.matches.length ? data.matches.map(item => <button className={`match-admin-card ${selected === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelected(item.id)}>
      <span className={`match-state ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
      <h3>{item.title}</h3><p>{dateTime(item.matchAt)}{item.location ? ` · ${item.location}` : ""}</p>
      <div><b className="present">{item.counts.present} presentes</b><b className="absent">{item.counts.absent} ausentes</b><b>{item.counts.pending} pendentes</b></div>
    </button>) : <div className="admin-card match-admin-empty">Nenhuma partida criada.</div>}</div>
    <div>{current ? <MatchAdminDetail match={current} players={data.players} onAttendance={attendance} onEdit={() => setEditing(current)} onClose={() => closeMatch(current)} onCancel={() => cancelMatch(current)}/> : <div className="admin-card match-admin-empty">Selecione uma partida para gerenciar as presenças.</div>}</div></div>
    {editing && <MatchEditor match={editing === "new" ? null : editing} api={api} instanceConfig={instanceConfig} onClose={() => setEditing(null)} onSaved={async message => { setEditing(null); setNotice(message); await load(); }}/>}
  </section>;
}

function MatchAdminDetail({ match, players, onAttendance, onEdit, onClose, onCancel }: any) {
  const byPlayer = useMemo(() => Object.fromEntries(match.attendance.map((item: Attendance) => [item.playerId, item])), [match.attendance]);
  const goalkeepersPresent = match.goalkeepers?.present ?? players.filter((player: Player) => (player.type === "goalkeeper" || player.primaryPosition === "Goleiro") && byPlayer[player.id]?.status === "PRESENT").length;
  const share = () => match.shareMessage?.trim() && window.open(buildWhatsAppShareUrl(match.shareMessage), "_blank", "noopener,noreferrer");
  return <section className="admin-card match-admin-detail"><div className="match-detail-head"><div><span className={`match-state ${match.status.toLowerCase()}`}>{statusLabel(match.status)}</span><h2>{match.title}</h2><p>Jogo: {dateTime(match.matchAt)}<br/>Confirmações até {dateTime(match.confirmationDeadline)} · máximo de {match.maxChanges} remarcações</p></div>{match.status === "OPEN" && <button className="ghost" onClick={onEdit}>Editar</button>}</div>
    <div className="match-attendance-summary"><span><b>{match.counts.present}</b>Presentes</span><span><b>{match.counts.absent}</b>Ausentes</span><span><b>{match.counts.pending}</b>Pendentes</span><span><b>{goalkeepersPresent}/2</b>Goleiros</span></div>
    <div className="match-player-admin-list">{players.map((player: Player) => { const answer = byPlayer[player.id], guest = player.type === "guest", goalkeeper = player.type === "goalkeeper" || player.primaryPosition === "Goleiro", goalkeeperBlocked = goalkeeper && answer?.status !== "PRESENT" && goalkeepersPresent >= 2; return <div className={guest ? "guest" : ""} key={player.id}><span><b>{player.displayName}{guest && <em>Convidado</em>}</b><small>{player.primaryPosition} · {answer ? `${answer.changeCount}/${match.maxChanges} remarcações` : "Sem resposta"}</small></span><div><button disabled={goalkeeperBlocked} title={goalkeeperBlocked ? "Os dois lugares de goleiro já estão preenchidos." : undefined} className={answer?.status === "PRESENT" ? "attendance-present on" : "attendance-present"} onClick={() => onAttendance(player.id, "PRESENT")}>✓ Presente</button><button className={answer?.status === "ABSENT" ? "attendance-absent on" : "attendance-absent"} onClick={() => onAttendance(player.id, "ABSENT")}>× Ausente</button></div></div>})}</div>
    <div className="match-admin-actions">{match.status === "OPEN" && match.shareMessage ? <button className="ghost whatsapp-button" onClick={share}><WhatsAppIcon/>Compartilhar parcial no WhatsApp</button> : null}{match.separationId && <a className="ghost" href={`/separacoes-salvas?separation=${encodeURIComponent(match.separationId)}`}>Abrir separação ↗</a>}{match.status === "OPEN" && <><button className="danger" onClick={onCancel}>Cancelar partida</button><button className="primary" disabled={match.counts.present < 4} onClick={onClose}>Fechar lista e gerar times</button></>}</div>
  </section>;
}

function MatchEditor({ match, api, instanceConfig, onClose, onSaved }: { match: Match | null; api: Api; instanceConfig?: any; onClose(): void; onSaved(message: string): Promise<void> }) {
  const defaults = nextMatchDefaults(instanceConfig);
  const [title, setTitle] = useState(match?.title || instanceConfig?.defaultMatchTitle || "Pelada");
  const [matchAt, setMatchAt] = useState(localInput(match?.matchAt) || defaults.matchAt);
  const [deadline, setDeadline] = useState(localInput(match?.confirmationDeadline) || defaults.deadline);
  const [location, setLocation] = useState(match?.location || "");
  const [maxChanges, setMaxChanges] = useState(match?.maxChanges ?? 2);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = { ...(match ? { action: "update", matchId: match.id } : {}), title, matchAt: new Date(matchAt).toISOString(), confirmationDeadline: new Date(deadline).toISOString(), location, maxChanges };
      const result = await api("/api/admin/matches", { method: match ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      await onSaved(result.message);
    } catch (cause: any) { setError(cause.message); } finally { setBusy(false); }
  }
  return <div className="modal-back"><form className="editor match-editor" onSubmit={submit}><button type="button" className="close" onClick={onClose}>×</button><div className="ball">📅</div><h2>{match ? "Editar partida" : "Criar partida"}</h2><p>Todos os usuários serão avisados no aplicativo e, quando disponível, por push.</p>{error && <div className="alert error">{error}</div>}<div className="form-grid"><label className="wide">Título<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={120}/></label><label>Data e hora do jogo<input type="datetime-local" value={matchAt} onChange={event => setMatchAt(event.target.value)} required/></label><label>Confirmar presença até<input type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} required/></label><label>Local<input value={location} onChange={event => setLocation(event.target.value)} maxLength={160}/></label><label>Máximo de remarcações<input type="number" min="0" max="20" value={maxChanges} onChange={event => setMaxChanges(Number(event.target.value))} required/></label></div><div className="editor-actions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Salvando…" : match ? "Salvar alterações" : "Criar e notificar"}</button></div></form></div>;
}

function nextMatchDefaults(config?: any) {
  const now = new Date(), weekday = Number(config?.defaultMatchWeekday ?? 0);
  const [hour, minute] = String(config?.defaultMatchTime || "09:00").split(":").map(Number);
  let days = (weekday - now.getDay() + 7) % 7;
  const todayMatch = new Date(now); todayMatch.setHours(hour, minute, 0, 0);
  if (days === 0 && todayMatch.getTime() <= now.getTime()) days = 7;
  const match = new Date(now); match.setDate(now.getDate() + days); match.setHours(hour, minute, 0, 0);
  const deadline = new Date(match.getTime() - Number(config?.confirmationLeadMinutes ?? 60) * 60_000);
  return { matchAt: localInput(match.toISOString()), deadline: localInput(deadline.toISOString()) };
}
function localInput(value?: string | null) { if (!value) return ""; const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
function dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function statusLabel(status: string) { return status === "OPEN" ? "Confirmações abertas" : status === "CLOSED" ? "Lista encerrada" : "Cancelada"; }
