"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { PlayerPhoto } from "../components/PlayerPhoto";

type Player = { id: string; displayName: string; photoUrl?: string | null; type?: string | null; primaryPosition?: string | null };
type VersusMatch = { id: string; separationId: string; title: string; date: string; blueScore: number; yellowScore: number; teamA: "BLUE" | "YELLOW"; teamB: "BLUE" | "YELLOW"; result: "A" | "B" | "DRAW" };
type RankingSortKey = "goals" | "assists" | "participations";
type MonthlyStanding = { player: Player; resultMomentum: number; votingMomentum: number; totalMomentum: number; games: number; wins: number; draws: number; losses: number };
type MonthlyFormation = { goalkeepers: number; defenders: number; midfielders: number; attackers: number };
type MonthlyAward = { month: string; matchCount: number; formation?: MonthlyFormation; playerOfMonth: MonthlyStanding | null; selection: (MonthlyStanding & { role: string })[] };
type Payload = {
  from: string; to: string; players: Player[];
  leaderboard: { player: Player; goals: number; assists: number }[];
  attendance: { player: Player; presences: number; rate: number }[];
  coverage: { matches: number; matchesWithContributions: number };
  streaks: { winning: { length: number; players: Player[] }; unbeaten: { length: number; players: Player[] } };
  careerHighlights: { year: number; focusMonth: string; focusMonthClosed: boolean; focus: MonthlyAward | null; history: MonthlyAward[]; annualMvp: { player: Player; selections: number; playerOfMonthAwards: number; momentum: number; place: number; medal: string }[]; annualMvpAvailable: boolean; annualMvpAvailableAt: string };
  versus: { playerA: Player | null; playerB: Player | null; winsA: number; winsB: number; draws: number; matches: VersusMatch[] };
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
type PeriodMode = "month" | "year" | "closed" | "custom";
function range(period: "month" | "year") {
  const now = new Date();
  return period === "year"
    ? { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
    : { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function closedMonthRange(month: string) {
  const [year, value] = month.split("-").map(Number);
  return { from: `${month}-01`, to: iso(new Date(year, value, 0)) };
}

export default function StatisticsApp() {
  const [period, setPeriod] = useState<PeriodMode>("month");
  const [dates, setDates] = useState(range("month"));
  const [closedMonth, setClosedMonth] = useState("");
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
  const choosePeriod = (value: "month" | "year") => { setPeriod(value); setClosedMonth(""); setDates(range(value)); };
  const chooseClosedMonth = (value: string) => {
    setClosedMonth(value);
    if (!value) return;
    setPeriod("closed");
    setDates(closedMonthRange(value));
  };
  const changeDate = (key: "from" | "to", value: string) => {
    setPeriod("custom"); setClosedMonth(""); setDates(current => ({ ...current, [key]: value }));
  };
  const closedMonths = data?.careerHighlights.history || [];
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
    <header className="statistics-hero"><div className="statistics-hero-copy"><div className="eyebrow">NÚMEROS DA PELADA</div><h1>Estatísticas</h1><p>Confira recordes, destaques mensais, artilharia, assistências e confrontos entre jogadores.</p></div><div className="statistics-period"><div className="statistics-period-head"><strong>Período da consulta</strong><small>{period==="month"?"Mês atual":period==="year"?"Ano atual":period==="closed"?monthLabel(closedMonth):"Intervalo personalizado"}</small></div><div className="statistics-period-main"><div className="statistics-period-shortcuts"><button type="button" className={period==="month"?"active":""} onClick={()=>choosePeriod("month")}>Este mês</button><button type="button" className={period==="year"?"active":""} onClick={()=>choosePeriod("year")}>Este ano</button></div><label className="statistics-closed-month">Mês encerrado<select value={period==="closed"?closedMonth:""} onChange={event=>chooseClosedMonth(event.target.value)} disabled={!closedMonths.length}><option value="">{closedMonths.length?"Escolha um mês":"Nenhum mês disponível"}</option>{closedMonths.map(award=><option value={award.month} key={award.month}>{monthLabel(award.month)}</option>)}</select></label></div><div className="statistics-date-range"><span>Intervalo personalizado</span><label>De<input type="date" value={dates.from} onChange={event=>changeDate("from",event.target.value)}/></label><label>Até<input type="date" value={dates.to} onChange={event=>changeDate("to",event.target.value)}/></label></div></div></header>
    {error&&<div className="alert error">{error}</div>}
    {loading&&!data?<div className="statistics-loading">Calculando estatísticas…</div>:data&&<>
      <section className="statistics-summary"><article><small>PARTIDAS NO PERÍODO</small><b>{data.coverage.matches}</b><span>com resultado confirmado</span></article><article><small>SÚMULAS DETALHADAS</small><b>{data.coverage.matchesWithContributions}</b><span>com autores de gols</span></article><p>Gols e assistências consideram somente partidas com súmula detalhada. Gols contra não são creditados como gol ao jogador.</p></section>
      <div className="statistics-ranking-filter"><div><b>Jogadores exibidos nos rankings</b><small>{includeGuests?"Todos os jogadores, incluindo convidados.":"Convidados estão ocultos por padrão."}</small></div><label><input type="checkbox" checked={includeGuests} onChange={event=>setIncludeGuests(event.target.checked)}/><span>Incluir convidados</span></label></div>
      <CareerHighlights streaks={data.streaks} highlights={data.careerHighlights}/>
      <section className="statistics-section"><div className="statistics-title"><div><small>DESTAQUES DO PERÍODO</small><h2>Gols e assistências</h2></div></div>{leaderboard.length?<div className="statistics-table"><div className="statistics-row head"><span>#</span><span>Jogador</span><button type="button" className={rankingSort.key==="goals"?"active":""} onClick={()=>sortRanking("goals")} aria-label="Ordenar por gols">Gols <i>{sortLabel("goals")}</i></button><button type="button" className={rankingSort.key==="assists"?"active":""} onClick={()=>sortRanking("assists")} aria-label="Ordenar por assistências">Assistências <i>{sortLabel("assists")}</i></button><button type="button" className={rankingSort.key==="participations"?"active":""} onClick={()=>sortRanking("participations")} aria-label="Ordenar por participações">Participações <i>{sortLabel("participations")}</i></button></div>{leaderboard.map((entry,index)=><div className="statistics-row" key={entry.player.id}><b>{index+1}</b><span className="statistics-player"><PlayerPhoto photoUrl={entry.player.photoUrl} name={entry.player.displayName}/><strong>{entry.player.displayName}</strong></span><strong>{entry.goals}</strong><strong>{entry.assists}</strong><strong>{entry.goals+entry.assists}</strong></div>)}</div>:<div className="empty">Nenhum gol ou assistência registrado neste período.</div>}</section>
      <AttendanceRanking entries={attendance} totalMatches={data.coverage.matches}/><section className="statistics-section versus-section"><div className="statistics-title"><div><small>CONFRONTO DIRETO</small><h2>Jogador versus jogador</h2><p>Conta apenas partidas em que os dois estiveram em equipes adversárias.</p></div></div><div className="versus-picker"><PlayerSelect label="Primeiro jogador" value={playerA} players={data.players} blocked={playerB} onChange={setPlayerA}/><b>VS</b><PlayerSelect label="Segundo jogador" value={playerB} players={data.players} blocked={playerA} onChange={setPlayerB}/></div>
      {versus?.playerA&&versus.playerB?<><div className="versus-score"><PlayerSide player={versus.playerA} wins={versus.winsA}/><div><small>{versus.matches.length} confrontos</small><b>{versus.winsA} <i>×</i> {versus.winsB}</b><span>{versus.draws} empates</span></div><PlayerSide player={versus.playerB} wins={versus.winsB}/></div><div className="versus-matches">{versus.matches.length?versus.matches.map(match=><a href={`/separacoes-salvas?separation=${encodeURIComponent(match.separationId)}`} key={match.id}><span><b>{new Date(match.date+"T12:00:00").toLocaleDateString("pt-BR")}</b><small>{match.title}</small></span><strong className={match.result==="A"?"winner":""}>{match.teamA==="BLUE"?match.blueScore:match.yellowScore}</strong><i>×</i><strong className={match.result==="B"?"winner":""}>{match.teamB==="BLUE"?match.blueScore:match.yellowScore}</strong><em>{match.result==="DRAW"?"Empate":match.result==="A"?`${versus.playerA!.displayName} venceu`:`${versus.playerB!.displayName} venceu`}</em></a>):<div className="empty">Nenhum confronto em equipes adversárias no período.</div>}</div></>:<div className="versus-empty">Selecione dois jogadores para comparar o retrospecto.</div>}</section>
    </>}</main></div>;
}

function CareerHighlights({streaks,highlights}:{streaks:Payload["streaks"];highlights:Payload["careerHighlights"]}) {
  return <>
    <section className="statistics-record-grid">
      <StreakRecord title="Maior sequência de vitórias" record={streaks.winning} suffix="vitórias seguidas" icon="🔥"/>
      <StreakRecord title="Maior sequência invicta" record={streaks.unbeaten} suffix="jogos sem perder" icon="🛡️"/>
    </section>
    <section className="statistics-section monthly-honors"><div className="statistics-title"><div><small>DESTAQUES MENSAIS</small><h2>Jogador e seleção do mês</h2><p>Classificação pelo momentum bruto de resultados e das votações. Somente mensalistas e goleiros são elegíveis.</p></div></div>
      {highlights.focus?<><div className="month-award-head"><span>{monthLabel(highlights.focus.month)}</span><small>{highlights.focus.matchCount} {highlights.focus.matchCount===1?"partida considerada":"partidas consideradas"} · resultado mensal fechado</small></div><div className="monthly-highlight-layout"><PlayerOfMonth standing={highlights.focus.playerOfMonth}/><MonthlySelection award={highlights.focus}/></div></>:<div className="monthly-awards-pending"><span>{highlights.focusMonthClosed?"○":"⌛"}</span><div><b>{highlights.focusMonthClosed?"Sem premiação neste mês":"Premiação mensal em apuração"}</b><p>{highlights.focusMonthClosed?`Não houve partidas suficientes em ${monthLabel(highlights.focusMonth)} para registrar os destaques.`:`Jogador e Seleção de ${monthLabel(highlights.focusMonth)} serão publicados e preservados quando o mês terminar.`}</p></div></div>}
    </section>
    <section className="statistics-section annual-awards"><div className="statistics-title"><div><small>TEMPORADA {highlights.year}</small><h2>MVPs do ano</h2><p>O pódio considera aparições nas seleções mensais de mensalistas e goleiros. Jogador do mês e momentum acumulado são os critérios de desempate.</p></div></div>
      {!highlights.annualMvpAvailable?<div className="annual-awards-locked"><span>🔒</span><div><b>Premiação ainda em disputa</b><p>Bola de Ouro, Bola de Prata e Bola de Bronze serão reveladas em {dateLabel(highlights.annualMvpAvailableAt)}, no encerramento configurado da temporada.</p></div></div>:highlights.annualMvp.length?<div className="mvp-podium">{[...highlights.annualMvp].reverse().map(entry=><article className={`place-${entry.place}`} key={entry.player.id}><em>{entry.medal}</em><PlayerPhoto photoUrl={entry.player.photoUrl} name={entry.player.displayName}/><b>{entry.player.displayName}</b><strong>{entry.selections}</strong><small>{entry.selections===1?"seleção mensal":"seleções mensais"} · {entry.playerOfMonthAwards}× jogador do mês</small></article>)}</div>:<div className="empty">Não houve meses encerrados suficientes para formar o pódio.</div>}
      {highlights.history.length>0&&<div className="monthly-history"><h3>Histórico dos meses encerrados</h3>{highlights.history.map(award=><details key={award.month}><summary><span>{monthLabel(award.month)}</span><b>{award.playerOfMonth?.player.displayName||"Sem destaque"}</b><small>{award.selection.length}/{monthlySelectionSize(award)} na seleção</small></summary><div><p><strong>Jogador do mês:</strong> {award.playerOfMonth?.player.displayName||"—"}</p><p><strong>Seleção:</strong> {award.selection.map(member=>`${member.player.displayName} (${member.role})`).join(", ")||"—"}</p></div></details>)}</div>}
    </section>
  </>;
}

function StreakRecord({title,record,suffix,icon}:{title:string;record:{length:number;players:Player[]};suffix:string;icon:string}) {
  return <article><i>{icon}</i><div><small>RECORDE NO PERÍODO</small><h2>{title}</h2>{record.length?<><span className="streak-players">{record.players.slice(0,3).map(player=><span key={player.id}><PlayerPhoto photoUrl={player.photoUrl} name={player.displayName}/><b>{player.displayName}</b></span>)}</span>{record.players.length>3&&<em>+{record.players.length-3} empatados</em>}</>:<p>Nenhuma sequência registrada.</p>}</div><strong>{record.length}<small>{suffix}</small></strong></article>;
}

function PlayerOfMonth({standing}:{standing:MonthlyStanding|null}) {
  if(!standing)return <article className="player-of-month empty">Sem jogador elegível.</article>;
  return <article className="player-of-month">
    <div className="player-of-month-title"><span aria-hidden="true">★</span><div><small>DESTAQUE INDIVIDUAL</small><b>Jogador do mês</b></div></div>
    <div className="player-of-month-profile">
      <PlayerPhoto photoUrl={standing.player.photoUrl} name={standing.player.displayName} className="player-of-month-photo"/>
      <div className="player-of-month-identity"><h3>{standing.player.displayName}</h3><span>{standing.player.primaryPosition||"Jogador"}</span></div>
    </div>
    <div className="player-of-month-total"><strong>{signed(standing.totalMomentum)}</strong><small>momentum total</small></div>
    <dl className="player-of-month-breakdown">
      <div><dt>Resultados</dt><dd>{signed(standing.resultMomentum)}</dd></div>
      <div><dt>Votações</dt><dd>{signed(standing.votingMomentum)}</dd></div>
    </dl>
    <div className="player-of-month-campaign"><small>Campanha no mês</small><p><span><b>{standing.wins}</b> vitórias</span><span><b>{standing.draws}</b> empates</span><span><b>{standing.losses}</b> derrotas</span></p></div>
  </article>;
}

function MonthlySelection({award}:{award:MonthlyAward}) {
  const formation=award.formation||{goalkeepers:1,defenders:2,midfielders:2,attackers:2};
  const roles=[{name:"Goleiro",amount:formation.goalkeepers},{name:"Defesa",amount:formation.defenders},{name:"Meio-campo",amount:formation.midfielders},{name:"Ataque",amount:formation.attackers}].filter(role=>role.amount>0);
  const fieldLines=[...roles].reverse();
  return <div className="monthly-selection"><h3>Seleção do mês <span>{award.selection.length}/{monthlySelectionSize(award)}</span></h3><div className="monthly-pitch"><i className="pitch-box pitch-box-top" aria-hidden="true"/><i className="pitch-box pitch-box-bottom" aria-hidden="true"/><div className="monthly-formation" style={{gridTemplateRows:`repeat(${Math.max(fieldLines.length,1)},1fr)`}}>{fieldLines.map(role=><section className={`formation-line role-${role.name.toLowerCase().replace("-","")}`} key={role.name}><small>{role.name}</small><div>{award.selection.filter(member=>member.role===role.name).map(member=><article key={member.player.id}><PlayerPhoto photoUrl={member.player.photoUrl} name={member.player.displayName}/><span><b>{member.player.displayName}</b><small>{signed(member.totalMomentum)} momentum</small></span></article>)}{Array.from({length:Math.max(0,role.amount-award.selection.filter(member=>member.role===role.name).length)},(_,index)=><article className="vacant" key={index}><span>—</span><small>Vaga disponível</small></article>)}</div></section>)}</div></div></div>;
}

function monthlySelectionSize(award:MonthlyAward){const formation=award.formation;return formation?formation.goalkeepers+formation.defenders+formation.midfielders+formation.attackers:7}

function signed(value:number){return `${value>0?"+":""}${value.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:3})}`}
function monthLabel(month:string){const [year,value]=month.split("-").map(Number);return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(new Date(year,value-1,1)).replace(/^./,letter=>letter.toUpperCase())}
function dateLabel(value:string){const [year,month,day]=value.split("-").map(Number);return new Intl.DateTimeFormat("pt-BR").format(new Date(year,month-1,day))}

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
