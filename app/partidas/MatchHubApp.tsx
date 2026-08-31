"use client";
// Document navigation is intentional for the existing Vinext routing setup.
/* eslint-disable @next/next/no-html-link-for-pages */
import "./match-hub.css";
import { useCallback, useEffect, useState } from "react";
import { matchHubFilters, matchHubHref, matchHubStatusLabel, type MatchHubItem, type MatchHubPayload } from "../../lib/match-hub";
import { accountSignInHref } from "../../lib/site-navigation";
import { SiteHeader } from "../components/SiteHeader";
import { useInstanceBranding } from "../InstanceBranding";
import { MatchesPanel, MatchEditor } from "../admin/MatchesPanel";
import MatchesApp from "./MatchesApp";
import SeparationPane, { hubApi } from "./SeparationPane";
import { MatchCardScore } from "./MatchCardScore";
import { MatchCardWeather } from "./MatchCardWeather";

const tabs = [{ id: "attendance", label: "Presenças" }, { id: "teams", label: "Times" }, { id: "result", label: "Súmula e resultado" }, { id: "voting", label: "Votação" }];

export default function MatchHubApp() {
  const { config: brand } = useInstanceBranding();
  const [search, setSearch] = useState<string | null>(null), [data, setData] = useState<MatchHubPayload | null>(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [loading, setLoading] = useState(true), [creating, setCreating] = useState(false);
  useEffect(() => {
    const update = () => setSearch(window.location.search);
    update(); window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const queryParams = new URLSearchParams(search || "");
  queryParams.delete("tab");
  const querySearch = search === null ? null : queryParams.toString();
  const load = useCallback(async (signal?: AbortSignal) => {
    if (querySearch === null) return;
    try {
      const next = await hubApi(`/api/match-hub?${querySearch}`, { signal });
      if (!signal?.aborted) { setData(next); setAccessRequired(false); }
    } catch (cause) {
      if (!signal?.aborted && (cause as { status?: number }).status === 401) {
        setData(null); setAccessRequired(true); setCreating(false); setNotice(""); setError("");
        return;
      }
      throw cause;
    }
  }, [querySearch]);
  useEffect(() => {
    // A URL change starts an external request; discard the previous loading/error state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError("");
    const controller = new AbortController();
    load(controller.signal).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    const requireAccess = () => { setData(null); setAccessRequired(true); setCreating(false); setNotice(""); setError(""); };
    const controller = new AbortController();
    const refresh = () => { if (document.visibilityState === "visible") void load(controller.signal).catch(() => undefined); };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("ppm:match-access-required", requireAccess);
    return () => {
      controller.abort(); window.clearInterval(interval);
      window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("ppm:match-access-required", requireAccess);
    };
  }, [load]);
  const returnTo = typeof window === "undefined" ? "/partidas" : window.location.pathname + window.location.search + window.location.hash;
  const params = new URLSearchParams(search || ""), detail = Boolean(params.get("match") || params.get("separation"));
  const item = detail ? data?.items[0] : null;
  const permissions = data?.viewer.permissions || [], allowed = (key: string) => permissions.includes("*") || permissions.includes(key);
  const adminMatches = ["MATCHES_MANAGE", "MATCH_ATTENDANCE_MANAGE", "MATCHES_CANCEL", "SEPARATIONS_MANAGE"].some(allowed);
  const requestedTab = params.get("tab"), tab = tabs.some(value => value.id === requestedTab) ? requestedTab! : item?.separationId ? "teams" : "attendance";
  const filter = params.get("filter") || "all";
  function navigate(href: string) {
    window.history.pushState({}, "", href); setSearch(new URL(href, window.location.origin).search);
  }
  function listHref(nextFilter: string, page = 1) { return `/partidas?${new URLSearchParams({ filter: nextFilter, page: String(page) })}`; }
  return <div className="member-page"><SiteHeader active="matches"/><main className="match-hub-main">
    <div className="match-hub-heading"><div><div className="eyebrow">AGENDA E HISTÓRICO DA PELADA</div><h1>Partidas</h1><p>Presenças, times, súmula e votação no mesmo lugar.</p></div>{allowed("MATCHES_MANAGE") && !detail && <button className="primary" onClick={() => setCreating(true)}>+ Criar partida</button>}</div>
    {error && !accessRequired && <div className="alert error" role="alert">{error}<button className="ghost" onClick={() => void load().then(() => setError("")).catch(cause => setError(cause.message))}>Tentar novamente</button></div>}
    {notice && <div className="alert" role="status">{notice}</div>}
    {accessRequired ? <SignIn returnTo={returnTo}/> : loading || search === null ? <div className="empty" role="status">Carregando partidas…</div> : !data ? null : detail ? item ? <>
      <a className="match-hub-back" href={listHref(filter)}>← Todas as partidas</a>
      <section className="match-hub-detail-head"><div><span className={`match-state ${item.status.toLowerCase()}`}>{matchHubStatusLabel[item.status]}</span><h2>{item.title}</h2><p>{dateLabel(item.date)}{item.location ? ` · ${item.location}` : ""}</p></div>{item.blueScore !== null && <ScoreSummary item={item} blueName={brand.teamBlueName} yellowName={brand.teamYellowName}/>}</section>
      {!item.matchId && <p className="match-hub-help">Separação do histórico, sem partida agendada vinculada. Não há lista de presenças registrada.</p>}
      <nav className="match-hub-tabs" aria-label="Áreas da partida">{tabs.map(value => <button type="button" key={value.id} aria-current={tab === value.id ? "page" : undefined} className={tab === value.id ? "on" : ""} onClick={() => navigate(matchHubHref(item, value.id))}>{value.label}</button>)}</nav>
      {tab === "attendance" ? !item.matchId ? <div className="empty">Esta separação antiga não possui uma lista de presenças.</div> : adminMatches ? <MatchesPanel key={item.matchId} matchId={item.matchId} api={hubApi} setError={setError} setNotice={setNotice} instanceConfig={brand} permissions={permissions}/> : <MatchesApp key={item.matchId} matchId={item.matchId}/> :
        item.separationId ? <SeparationPane key={item.separationId} id={item.separationId} section={tab} permissions={permissions} onChanged={() => void load().catch(cause => setError(cause.message))}/> :
        tab === "teams" && item.matchId && adminMatches ? <><p className="match-hub-help">Os times ainda não foram publicados. Use as presenças abaixo para gerar os times ou acessar o rascunho, quando habilitado.</p><MatchesPanel key={item.matchId} matchId={item.matchId} api={hubApi} setError={setError} setNotice={setNotice} instanceConfig={brand} permissions={permissions}/></> : <div className="empty">{tab === "teams" ? "Os times ainda não foram publicados." : "Esta área estará disponível após a publicação dos times."}</div>}
    </> : <div className="empty">Partida não encontrada. <a href="/partidas">Voltar às partidas</a></div> : <>
      <nav className="match-hub-tabs" aria-label="Filtrar partidas">{matchHubFilters.map(value => <button key={value.value} className={filter === value.value ? "on" : ""} aria-pressed={filter === value.value} onClick={() => navigate(listHref(value.value))}>{value.label}</button>)}</nav>
      <p className="match-hub-help">Canceladas aparecem somente no filtro “Canceladas”. Finalizadas são partidas com resultado confirmado.</p>
      <div className="match-hub-list">{data?.items.map(entry => <a key={entry.id} className="match-hub-card" href={matchHubHref(entry)}><div className="match-hub-card-info"><span className={`match-state ${entry.status.toLowerCase()}`}>{matchHubStatusLabel[entry.status]}</span><h2>{entry.title}</h2><p>{dateLabel(entry.date)}{entry.location ? ` · ${entry.location}` : ""}</p><small>{entry.present !== null ? `${entry.present} presentes` : "Separação do histórico"}{entry.votingStatus ? ` · Votação ${entry.votingStatus === "OPEN" ? "aberta" : "encerrada"}` : ""}</small><MatchCardWeather weather={entry.weatherSummary}/></div><div className="match-hub-card-action"><MatchCardScore blueScore={entry.blueScore} yellowScore={entry.yellowScore} blueName={brand.teamBlueName} yellowName={brand.teamYellowName}/><span>Ver partida →</span></div></a>)}</div>
      {!data?.items.length && <div className="empty">Nenhuma partida neste filtro.</div>}
      <div className="match-hub-pagination"><button className="ghost" disabled={!data || data.page <= 1} onClick={() => navigate(listHref(filter, (data?.page || 1) - 1))}>← Anteriores</button><span>Página {data?.page || 1}</span><button className="ghost" disabled={!data?.hasMore} onClick={() => navigate(listHref(filter, (data?.page || 1) + 1))}>Próximas →</button></div>
    </>}
    {creating && <MatchEditor match={null} api={hubApi} instanceConfig={brand} onClose={() => setCreating(false)} onSaved={async (message: string) => { setCreating(false); setNotice(message); await load(); }}/>}
  </main></div>;
}
function SignIn({ returnTo }: { returnTo: string }) { return <section className="member-access-card"><h2>Entre para acessar as partidas</h2><p>Presenças, times, súmulas, resultados e votações estão disponíveis somente para contas autenticadas de jogadores, moderadores e administradores.</p><a className="primary" href={accountSignInHref(returnTo)}>Entrar na minha conta</a></section>; }
function dateLabel(value: string | null) { return value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium", ...(value.length > 10 ? { timeStyle: "short" as const } : {}) }) : "Data não informada"; }
function ScoreSummary({ item, blueName, yellowName }: { item: MatchHubItem; blueName: string; yellowName: string }) {
  return <div className="match-hub-score" role="group" aria-label={`Placar: ${blueName} ${item.blueScore} a ${item.yellowScore} ${yellowName}`}>
    <span className="blue"><span className="match-hub-team-name">{blueName}</span><b>{item.blueScore}</b></span>
    <i aria-hidden="true">×</i>
    <span className="yellow"><b>{item.yellowScore}</b><span className="match-hub-team-name">{yellowName}</span></span>
  </div>;
}
