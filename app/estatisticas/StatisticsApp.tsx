"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { PlayerPhoto } from "../components/PlayerPhoto";

type Player = { id: string; displayName: string; photoUrl?: string | null; type?: string | null };
type VersusMatch = { id: string; separationId: string; title: string; date: string; blueScore: number; yellowScore: number; teamA: "BLUE" | "YELLOW"; teamB: "BLUE" | "YELLOW"; result: "A" | "B" | "DRAW" };
type RankingSortKey = "goals" | "assists" | "participations";
type Payload = {
  from: string; to: string; players: Player[];
  leaderboard: { player: Player; goals: number; assists: number }[];
  attendance: { player: Player; presences: number; rate: number }[];
  coverage: { matches: number; matchesWithContributions: number };
  versus: { playerA: Player | null; playerB: Player | null; winsA: number; winsB: number; draws: number; matches: VersusMatch[] };
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
function range(period: "month" | "year") {
  const now = new Date();
  return period === "year"
    ? { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
    : { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}

export default function StatisticsApp() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [dates, setDates] = useState(range("month"));
  const [playerA, setPlayerA] = useState(""), [playerB, setPlayerB] = useState("");
  const [includeGuests, setIncludeGuests] = useState(false);
  const [rankingSort, setRankingSort] = useState<{ key: RankingSortKey; direction: "asc" | "desc" }>({ key: "participations", direction: "desc" });
  const [data, setData] = useState<Payload | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const query = useMemo(() => new URLSearchParams({ ...dates, ...(playerA ? { playerA } : {}), ...(playerB ? { playerB } : {}) }).toString(), [dates, playerA, playerB]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true); setError("");
      fetch(`/api/public-statistics?${query}`, { cache: "no-store" }).then(async response => {
        const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Não foi possível carregar as estatísticas.");
        if (active) setData(payload);
      }).catch(cause => active && setError(cause.message)).finally(() => active && setLoading(false));
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);
  const choosePeriod = (value: "month" | "year") => { setPeriod(value); setDates(range(value)); };
  const versus = data?.versus;
  const leaderboard = useMemo(() => (data?.leaderboard || []).filter(entry => includeGuests || entry.player.type !== "guest").sort((a, b) => {
    const value = (entry: typeof a) => rankingSort.key === "participations" ? entry.goals + entry.assists : entry[rankingSort.key];
    const difference = value(a) - value(b);
    return (rankingSort.direction === "asc" ? difference : -difference) || a.player.displayName.localeCompare(b.player.displayName, "pt-BR");
  }), [data?.leaderboard, includeGuests, rankingSort]);
  const attendance = useMemo(() => (data?.attendance || []).filter(entry => includeGuests || entry.player.type !== "guest"), [data?.attendance, includeGuests]);
  const sortRanking = (key: RankingSortKey) => setRankingSort(current => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }));
  const sortLabel = (key: RankingSortKey) => rankingSort.key === key ? rankingSort.direction === "desc" ? "↓" : "↑" : "↕";

  return <div className="statistics-page"><SiteHeader active="statistics"/><main className="statistics-main">
    <header className="statistics-hero"><div><div className="eyebrow">NÚMEROS DA PELADA</div><h1>Estatísticas</h1><p>Confira artilharia, assistências e o retrospecto direto entre dois jogadores.</p></div><div className="statistics-period"><button className={period==="month"?"active":""} onClick={()=>choosePeriod("month")}>Este mês</button><button className={period==="year"?"active":""} onClick={()=>choosePeriod("year")}>Este ano</button><label>De<input type="date" value={dates.from} onChange={event=>{setPeriod("month");setDates(current=>({...current,from:event.target.value}))}}/></label><label>Até<input type="date" value={dates.to} onChange={event=>{setPeriod("month");setDates(current=>({...current,to:event.target.value}))}}/></label></div></header>
    {error&&<div className="alert error">{error}</div>}
    {loading&&!data?<div className="statistics-loading">Calculando estatísticas…</div>:data&&<>
      <section className="statistics-summary"><article><small>PARTIDAS NO PERÍODO</small><b>{data.coverage.matches}</b><span>com resultado confirmado</span></article><article><small>SÚMULAS DETALHADAS</small><b>{data.coverage.matchesWithContributions}</b><span>com autores de gols</span></article><p>Gols e assistências consideram somente partidas com súmula detalhada. Gols contra não são creditados como gol ao jogador.</p></section>
      <div className="statistics-ranking-filter"><div><b>Jogadores exibidos nos rankings</b><small>{includeGuests?"Todos os jogadores, incluindo convidados.":"Convidados estão ocultos por padrão."}</small></div><label><input type="checkbox" checked={includeGuests} onChange={event=>setIncludeGuests(event.target.checked)}/><span>Incluir convidados</span></label></div>
      <section className="statistics-section"><div className="statistics-title"><div><small>DESTAQUES DO PERÍODO</small><h2>Gols e assistências</h2></div></div>{leaderboard.length?<div className="statistics-table"><div className="statistics-row head"><span>#</span><span>Jogador</span><button type="button" className={rankingSort.key==="goals"?"active":""} onClick={()=>sortRanking("goals")} aria-label="Ordenar por gols">Gols <i>{sortLabel("goals")}</i></button><button type="button" className={rankingSort.key==="assists"?"active":""} onClick={()=>sortRanking("assists")} aria-label="Ordenar por assistências">Assistências <i>{sortLabel("assists")}</i></button><button type="button" className={rankingSort.key==="participations"?"active":""} onClick={()=>sortRanking("participations")} aria-label="Ordenar por participações">Participações <i>{sortLabel("participations")}</i></button></div>{leaderboard.map((entry,index)=><div className="statistics-row" key={entry.player.id}><b>{index+1}</b><span className="statistics-player"><PlayerPhoto photoUrl={entry.player.photoUrl} name={entry.player.displayName}/><strong>{entry.player.displayName}</strong></span><strong>{entry.goals}</strong><strong>{entry.assists}</strong><strong>{entry.goals+entry.assists}</strong></div>)}</div>:<div className="empty">Nenhum gol ou assistência registrado neste período.</div>}</section>
      <AttendanceRanking entries={attendance} totalMatches={data.coverage.matches}/><section className="statistics-section versus-section"><div className="statistics-title"><div><small>CONFRONTO DIRETO</small><h2>Jogador versus jogador</h2><p>Conta apenas partidas em que os dois estiveram em equipes adversárias.</p></div></div><div className="versus-picker"><PlayerSelect label="Primeiro jogador" value={playerA} players={data.players} blocked={playerB} onChange={setPlayerA}/><b>VS</b><PlayerSelect label="Segundo jogador" value={playerB} players={data.players} blocked={playerA} onChange={setPlayerB}/></div>
      {versus?.playerA&&versus.playerB?<><div className="versus-score"><PlayerSide player={versus.playerA} wins={versus.winsA}/><div><small>{versus.matches.length} confrontos</small><b>{versus.winsA} <i>×</i> {versus.winsB}</b><span>{versus.draws} empates</span></div><PlayerSide player={versus.playerB} wins={versus.winsB}/></div><div className="versus-matches">{versus.matches.length?versus.matches.map(match=><a href={`/separacoes-salvas?separation=${encodeURIComponent(match.separationId)}`} key={match.id}><span><b>{new Date(match.date+"T12:00:00").toLocaleDateString("pt-BR")}</b><small>{match.title}</small></span><strong className={match.result==="A"?"winner":""}>{match.teamA==="BLUE"?match.blueScore:match.yellowScore}</strong><i>×</i><strong className={match.result==="B"?"winner":""}>{match.teamB==="BLUE"?match.blueScore:match.yellowScore}</strong><em>{match.result==="DRAW"?"Empate":match.result==="A"?`${versus.playerA!.displayName} venceu`:`${versus.playerB!.displayName} venceu`}</em></a>):<div className="empty">Nenhum confronto em equipes adversárias no período.</div>}</div></>:<div className="versus-empty">Selecione dois jogadores para comparar o retrospecto.</div>}</section>
    </>}</main></div>;
}

function PlayerSelect({label,value,players,blocked,onChange}:{label:string;value:string;players:Player[];blocked:string;onChange(value:string):void}){return <label>{label}<select value={value} onChange={event=>onChange(event.target.value)}><option value="">Selecione</option>{players.filter(player=>player.id!==blocked).map(player=><option value={player.id} key={player.id}>{player.displayName}</option>)}</select></label>}
function PlayerSide({player,wins}:{player:Player;wins:number}){return <div className="versus-player"><PlayerPhoto photoUrl={player.photoUrl} name={player.displayName}/><b>{player.displayName}</b><span>{wins} {wins===1?"vitória":"vitórias"}</span></div>}

function AttendanceRanking({entries,totalMatches}:{entries:Payload["attendance"];totalMatches:number}){
  const [sort,setSort]=useState<{key:"name"|"presences"|"rate";direction:"asc"|"desc"}>({key:"presences",direction:"desc"});
  const sorted=useMemo(()=>[...entries].sort((a,b)=>{
    const difference=sort.key==="name"?a.player.displayName.localeCompare(b.player.displayName,"pt-BR"):a[sort.key]-b[sort.key];
    return (sort.direction==="asc"?difference:-difference)||a.player.displayName.localeCompare(b.player.displayName,"pt-BR");
  }),[entries,sort]);
  const change=(key:typeof sort.key)=>setSort(current=>({key,direction:current.key===key&&current.direction==="desc"?"asc":"desc"}));
  const indicator=(key:typeof sort.key)=>sort.key===key?(sort.direction==="desc"?"↓":"↑"):"↕";
  return <section className="statistics-section attendance-section"><div className="statistics-title"><div><small>PRESENÇA EM CAMPO</small><h2>Ranking de assiduidade</h2><p>Considera seleções salvas com resultado cadastrado no período.</p></div></div>{sorted.length?<div className="statistics-table"><div className="statistics-row head attendance-row"><span>#</span><button type="button" className={sort.key==="name"?"active":""} onClick={()=>change("name")}>Jogador <i>{indicator("name")}</i></button><button type="button" className={sort.key==="presences"?"active":""} onClick={()=>change("presences")}>Presenças <i>{indicator("presences")}</i></button><button type="button" className={sort.key==="rate"?"active":""} onClick={()=>change("rate")}>Assiduidade <i>{indicator("rate")}</i></button></div>{sorted.map((entry,index)=><div className="statistics-row attendance-row" key={entry.player.id}><b>{index+1}</b><span className="statistics-player"><PlayerPhoto photoUrl={entry.player.photoUrl} name={entry.player.displayName}/><strong>{entry.player.displayName}</strong></span><strong>{entry.presences}<small> de {totalMatches}</small></strong><span className="attendance-rate"><b>{entry.rate.toLocaleString("pt-BR",{maximumFractionDigits:1})}%</b><i><span style={{width:`${entry.rate}%`}}/></i></span></div>)}</div>:<div className="empty">Nenhuma presença encontrada neste período.</div>}</section>
}
