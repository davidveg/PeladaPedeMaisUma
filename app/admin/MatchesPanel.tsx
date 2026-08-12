"use client";
/* The administrative API and existing panel shell intentionally use schema-flexible payloads. */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { brazilianDateInput, brazilianDateTimeIso, brazilianDateTimeParts, brazilianTimeInput } from "../../lib/brazilian-date-time";
import { buildWhatsAppShareUrl } from "../../lib/career-sharing";
import { WhatsAppIcon } from "../components/WhatsAppIcon";
import { WeatherPreview } from "../components/WeatherPreview";

type Api = (url: string, options?: RequestInit) => Promise<any>;
type Props = { api: Api; setError(value: string): void; setNotice(value: string): void; instanceConfig?: any };
type Attendance = { playerId: string; playerName: string; status: "PRESENT" | "ABSENT"; changeCount: number };
type Match = {
  id: string; title: string; matchAt: string; confirmationDeadline: string; location?: string | null;
  maxChanges: number; status: string; separationId?: string | null;
  counts: { present: number; absent: number; pending: number; preconfirmed?: number }; attendance: Attendance[];
  guestPreconfirmation?: { enabled: boolean; threshold: number; canApprove: boolean };
  separationDraft?: { enabled: boolean; exists: boolean; stale: boolean; updatedAt?: string | null };
  preconfirmedGuestIds?: string[];
  goalkeepers?: { present: number; max: number };
  shareMessage?: string;
  weather?: any;
};
type Player = { id: string; displayName: string; type: string; primaryPosition: string };

export function MatchesPanel({ api, setError, setNotice, instanceConfig }: Props) {
  const [data, setData] = useState<{ matches: Match[]; players: Player[] }>({ matches: [], players: [] });
  const [editing, setEditing] = useState<Match | "new" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [onlyActiveOrSeparated, setOnlyActiveOrSeparated] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const result = await api("/api/admin/matches");
      setData(result);
      const defaultMatches = result.matches.filter(isActiveOrSeparated);
      setSelected(current => current && defaultMatches.some((item: Match) => item.id === current) ? current : defaultMatches[0]?.id || null);
    } catch (cause: any) { setError(cause.message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const visibleMatches = useMemo(() => onlyActiveOrSeparated ? data.matches.filter(isActiveOrSeparated) : data.matches, [data.matches, onlyActiveOrSeparated]);
  useEffect(() => { if (!visibleMatches.some(item => item.id === selected)) setSelected(visibleMatches[0]?.id || null); }, [visibleMatches, selected]);
  const current = visibleMatches.find(item => item.id === selected) || null;

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
  async function guestPreconfirmation(playerId: string, guestAction: "ADD" | "REMOVE") {
    setError("");
    try {
      const result = await api("/api/admin/matches", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "guest-preconfirmation", matchId: current?.id, playerId, guestAction }),
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
    <label className="match-list-filter admin-filter"><span><b>Somente abertas ou com times gerados</b><small>Desmarque para consultar canceladas e listas encerradas sem separação.</small></span><input type="checkbox" checked={onlyActiveOrSeparated} onChange={event => setOnlyActiveOrSeparated(event.target.checked)}/></label>
    <div className="match-admin-layout"><div className="match-admin-list">{visibleMatches.length ? visibleMatches.map(item => <button className={`match-admin-card ${selected === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelected(item.id)}>
      <span className={`match-state ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
      <h3>{item.title}</h3><p>{dateTime(item.matchAt)}{item.location ? ` · ${item.location}` : ""}</p>
      <div><b className="present">{item.counts.present} presentes</b><b className="absent">{item.counts.absent} ausentes</b>{item.guestPreconfirmation?.enabled && <b>{item.counts.preconfirmed || 0} na espera</b>}<b>{item.counts.pending} pendentes</b></div>
    </button>) : <div className="admin-card match-admin-empty">Nenhuma partida criada.</div>}</div>
    <div>{current ? <MatchAdminDetail match={current} players={data.players} onAttendance={attendance} onGuestPreconfirmation={guestPreconfirmation} onEdit={() => setEditing(current)} onClose={() => closeMatch(current)} onCancel={() => cancelMatch(current)}/> : <div className="admin-card match-admin-empty">Selecione uma partida para gerenciar as presenças.</div>}</div></div>
    {editing && <MatchEditor match={editing === "new" ? null : editing} api={api} instanceConfig={instanceConfig} onClose={() => setEditing(null)} onSaved={async message => { setEditing(null); setNotice(message); await load(); }}/>}
  </section>;
}

function MatchAdminDetail({ match, players, onAttendance, onGuestPreconfirmation, onEdit, onClose, onCancel }: any) {
  const byPlayer = useMemo(
    () => Object.fromEntries(match.attendance.map((item: Attendance) => [item.playerId, item])),
    [match.attendance],
  );
  const waiting = useMemo(() => new Set<string>(match.preconfirmedGuestIds || []), [match.preconfirmedGuestIds]);
  const goalkeepersPresent = match.goalkeepers?.present ?? players.filter((player: Player) =>
    (player.type === "goalkeeper" || player.primaryPosition === "Goleiro") && byPlayer[player.id]?.status === "PRESENT"
  ).length;
  const share = () => match.shareMessage?.trim() && window.open(buildWhatsAppShareUrl(match.shareMessage), "_blank", "noopener,noreferrer");
  return <section className="admin-card match-admin-detail">
    <div className="match-detail-head"><div><span className={`match-state ${match.status.toLowerCase()}`}>{statusLabel(match.status)}</span><h2>{match.title}</h2><p>Jogo: {dateTime(match.matchAt)}<br/>Confirmações até {dateTime(match.confirmationDeadline)} · máximo de {match.maxChanges} remarcações</p></div>{match.status === "OPEN" && <button className="ghost" onClick={onEdit}>Editar</button>}</div>
    <WeatherPreview weather={match.weather}/>
    <div className="match-attendance-summary">
      <span><b>{match.counts.present}</b>Presentes</span><span><b>{match.counts.absent}</b>Ausentes</span>
      {match.guestPreconfirmation?.enabled && <span><b>{match.counts.preconfirmed || 0}</b>Na espera</span>}
      <span><b>{match.counts.pending}</b>Pendentes</span><span><b>{goalkeepersPresent}/2</b>Goleiros</span>
    </div>
    {match.guestPreconfirmation?.enabled && <p className="match-preconfirmation-help">Convidados entram primeiro na lista de espera. A aprovação é liberada quando presentes + espera somarem <b>{match.guestPreconfirmation.threshold}</b>.</p>}
    <div className="match-player-admin-list">{players.map((player: Player) => {
      const answer = byPlayer[player.id], guest = player.type === "guest", preconfirmed = waiting.has(player.id);
      const goalkeeper = player.type === "goalkeeper" || player.primaryPosition === "Goleiro";
      const goalkeeperBlocked = goalkeeper && answer?.status !== "PRESENT" && goalkeepersPresent >= 2;
      const guestFlow = guest && match.guestPreconfirmation?.enabled;
      const responseLabel = preconfirmed ? "Na lista de espera · aguardando aprovação" : answer ? `${answer.changeCount}/${match.maxChanges} remarcações` : "Sem resposta";
      return <div className={`${guest ? "guest" : ""}${preconfirmed ? " preconfirmed" : ""}`} key={player.id}>
        <span><b>{player.displayName}{guest && <em>Convidado</em>}</b><small>{player.primaryPosition} · {responseLabel}</small></span>
        <div>{guestFlow && answer?.status !== "PRESENT" ? <>
          {!preconfirmed && <button className="attendance-waiting" onClick={() => onGuestPreconfirmation(player.id, "ADD")}>⏳ Colocar na espera</button>}
          {preconfirmed && <button className="attendance-present" disabled={!match.guestPreconfirmation.canApprove} title={!match.guestPreconfirmation.canApprove ? `Aguarde presentes e fila somarem ${match.guestPreconfirmation.threshold}.` : undefined} onClick={() => onAttendance(player.id, "PRESENT")}>✓ Confirmar</button>}
          {preconfirmed && <button className="attendance-waiting on" onClick={() => onGuestPreconfirmation(player.id, "REMOVE")}>Remover espera</button>}
        </> : <button disabled={goalkeeperBlocked} title={goalkeeperBlocked ? "Os dois lugares de goleiro já estão preenchidos." : undefined} className={answer?.status === "PRESENT" ? "attendance-present on" : "attendance-present"} onClick={() => onAttendance(player.id, "PRESENT")}>✓ Presente</button>}
        <button className={answer?.status === "ABSENT" ? "attendance-absent on" : "attendance-absent"} onClick={() => onAttendance(player.id, "ABSENT")}>× Ausente</button></div>
      </div>;
    })}</div>
    {match.status === "OPEN" && match.separationDraft?.enabled && match.separationDraft?.exists && <p className={match.separationDraft.stale ? "match-draft-status stale" : "match-draft-status"}>{match.separationDraft.stale ? "O rascunho ficou desatualizado porque a lista de presentes mudou. Ao abri-lo, uma nova proposta será iniciada." : `Rascunho salvo${match.separationDraft.updatedAt ? ` em ${dateTime(match.separationDraft.updatedAt)}` : ""}.`}</p>}
    <div className="match-admin-actions">{match.status === "OPEN" && match.shareMessage ? <button className="ghost whatsapp-button" onClick={share}><WhatsAppIcon/>Compartilhar parcial no WhatsApp</button> : null}{match.separationId && <a className="ghost" href={`/separacoes-salvas?separation=${encodeURIComponent(match.separationId)}`}>Abrir separação ↗</a>}{match.status === "OPEN" && <>{match.separationDraft?.enabled&&<a className="ghost" aria-disabled={match.counts.present<4} href={match.counts.present>=4?`/?matchId=${encodeURIComponent(match.id)}&draft=1`:undefined}>{match.separationDraft.exists&&!match.separationDraft.stale?'Editar rascunho de separação':'Criar rascunho de separação'}</a>}<button className="danger" onClick={onCancel}>Cancelar partida</button><button className="primary" disabled={match.counts.present < 4} onClick={onClose}>Fechar lista e gerar times</button></>}</div>
  </section>;
}

function MatchEditor({ match, api, instanceConfig, onClose, onSaved }: { match: Match | null; api: Api; instanceConfig?: any; onClose(): void; onSaved(message: string): Promise<void> }) {
  const defaults = nextMatchDefaults(instanceConfig);
  const matchParts = match ? brazilianDateTimeParts(match.matchAt) : defaults.match;
  const deadlineParts = match ? brazilianDateTimeParts(match.confirmationDeadline) : defaults.deadline;
  const [title, setTitle] = useState(match?.title || instanceConfig?.defaultMatchTitle || "Pelada");
  const [matchDate, setMatchDate] = useState(matchParts.date), [matchTime, setMatchTime] = useState(matchParts.time);
  const [deadlineDate, setDeadlineDate] = useState(deadlineParts.date), [deadlineTime, setDeadlineTime] = useState(deadlineParts.time);
  const [location, setLocation] = useState(match?.location || instanceConfig?.defaultMatchLocation || "Rio de Janeiro, Brasil");
  const [maxChanges, setMaxChanges] = useState(match?.maxChanges ?? 2);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const matchAt = brazilianDateTimeIso(matchDate, matchTime), confirmationDeadline = brazilianDateTimeIso(deadlineDate, deadlineTime);
      if (!matchAt || !confirmationDeadline) throw new Error("Use datas no formato DD/MM/AAAA e horários no formato HH:MM.");
      if (new Date(confirmationDeadline).getTime() > new Date(matchAt).getTime()) throw new Error("O prazo de confirmação deve terminar antes do início do jogo.");
      const body = { ...(match ? { action: "update", matchId: match.id } : {}), title, matchAt, confirmationDeadline, location, maxChanges };
      const result = await api("/api/admin/matches", { method: match ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      await onSaved(result.message);
    } catch (cause: any) { setError(cause.message); } finally { setBusy(false); }
  }
  return <div className="modal-back"><form className="editor match-editor" onSubmit={submit}><button type="button" className="close" onClick={onClose}>×</button><div className="ball">📅</div><h2>{match ? "Editar partida" : "Criar partida"}</h2><p>Todos os usuários serão avisados no aplicativo e, quando disponível, por push.</p>{error && <div className="alert error">{error}</div>}<div className="form-grid"><label className="wide">Título<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={120}/></label><label>Data do jogo (DD/MM/AAAA)<input value={matchDate} onChange={event => setMatchDate(brazilianDateInput(event.target.value))} inputMode="numeric" placeholder="DD/MM/AAAA" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} required/></label><label>Hora do jogo (HH:MM)<input value={matchTime} onChange={event => setMatchTime(brazilianTimeInput(event.target.value))} inputMode="numeric" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" maxLength={5} required/></label><label>Confirmar até (DD/MM/AAAA)<input value={deadlineDate} onChange={event => setDeadlineDate(brazilianDateInput(event.target.value))} inputMode="numeric" placeholder="DD/MM/AAAA" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" maxLength={10} required/></label><label>Horário limite (HH:MM)<input value={deadlineTime} onChange={event => setDeadlineTime(brazilianTimeInput(event.target.value))} inputMode="numeric" placeholder="HH:MM" pattern="[0-9]{2}:[0-9]{2}" maxLength={5} required/></label><label>Local<input value={location} onChange={event => setLocation(event.target.value)} maxLength={160}/></label><label>Máximo de remarcações<input type="number" min="0" max="20" value={maxChanges} onChange={event => setMaxChanges(Number(event.target.value))} required/></label></div><div className="editor-actions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Salvando…" : match ? "Salvar alterações" : "Criar e notificar"}</button></div></form></div>;
}

function nextMatchDefaults(config?: any) {
  const now = new Date(), weekday = Number(config?.defaultMatchWeekday ?? 0);
  const [hour, minute] = String(config?.defaultMatchTime || "09:00").split(":").map(Number);
  let days = (weekday - now.getDay() + 7) % 7;
  const todayMatch = new Date(now); todayMatch.setHours(hour, minute, 0, 0);
  if (days === 0 && todayMatch.getTime() <= now.getTime()) days = 7;
  const match = new Date(now); match.setDate(now.getDate() + days); match.setHours(hour, minute, 0, 0);
  const deadline = new Date(match.getTime() - Number(config?.confirmationLeadMinutes ?? 60) * 60_000);
  return { match: brazilianDateTimeParts(match.toISOString()), deadline: brazilianDateTimeParts(deadline.toISOString()) };
}
function dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function statusLabel(status: string) { return status === "OPEN" ? "Confirmações abertas" : status === "CLOSED" ? "Lista encerrada" : "Cancelada"; }
function isActiveOrSeparated(item: Match) { return item.status !== "CANCELLED" && (item.status === "OPEN" || Boolean(item.separationId)); }
