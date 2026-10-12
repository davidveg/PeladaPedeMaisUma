"use client";

import { useEffect, useState } from "react";
import type { SeasonPassportDetails, SeasonPassportStamp } from "../../../lib/season-passport";
import { BrandedLoading } from "../../components/BrandedLoading";
import { SiteHeader } from "../../components/SiteHeader";
import { useInstanceBranding } from "../../InstanceBranding";

export default function SeasonPassportApp() {
  const { config } = useInstanceBranding();
  const [data, setData] = useState<SeasonPassportDetails | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [selectedStamp, setSelectedStamp] = useState<SeasonPassportStamp | null>(null);

  async function load(season?: number, month?: string | null) {
    setLoading(true); setError(""); setSelectedStamp(null);
    try {
      const query = new URLSearchParams();
      if (season) query.set("season", String(season));
      if (month) query.set("month", month);
      const response = await fetch(`/api/member-profile/passport?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o passaporte.");
      setData(payload);
    } catch (cause: any) { setError(cause.message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const summary = data?.summary;
  const month = data?.months.find(item => item.month === data.selectedMonth);
  return <div className="member-page"><SiteHeader active="account"/><main className="member-main passport-main">
    <a className="passport-back" href="/conta">← Voltar para Minha conta</a>
    <section className="passport-hero"><div><div className="eyebrow">PASSAPORTE DA TEMPORADA</div><h1>Sua história em cada rodada</h1><p>Explore um mês por vez. O resumo permanece leve mesmo em temporadas com muitas partidas.</p></div>{data?.availableSeasons.length ? <label>Temporada<select value={summary?.seasonNumber || ""} onChange={event=>void load(Number(event.target.value),null)}>{data.availableSeasons.map(value=><option key={value} value={value}>Temporada {value}</option>)}</select></label> : null}</section>
    {error ? <div className="alert error"><b>Não foi possível abrir o passaporte.</b><span>{error}</span><button className="ghost" type="button" onClick={()=>void load()}>Tentar novamente</button></div> : null}
    {loading && !data ? <BrandedLoading variant="inline" message="Carregando passaporte…"/> : null}
    {data && summary ? <>
      <section className="passport-summary"><div><small>PARTICIPAÇÕES</small><strong>{summary.appearances}<em>/{summary.totalMatches}</em></strong></div><div><small>ASSIDUIDADE</small><strong>{summary.attendanceRate}%</strong></div><div><small>SEQUÊNCIA ATUAL</small><strong>{summary.currentAttendanceStreak}</strong></div><div><small>VITÓRIAS</small><strong>{summary.wins}</strong></div><div><small>GOLS</small><strong>{summary.goals}</strong></div><div><small>ASSISTÊNCIAS</small><strong>{summary.assists}</strong></div></section>
      <section className="season-passport-page">
        <div className="passport-perfect-progress"><span><b>Temporada perfeita</b><small>{summary.appearances} de {summary.totalMatches} rodadas · meta de {summary.perfectSeasonTarget}%</small></span><div role="progressbar" aria-label="Progresso para temporada perfeita" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.perfectSeasonProgress}><i style={{width:`${summary.perfectSeasonProgress}%`}}/></div><strong>{summary.attendanceRate}%</strong></div>
        <div className="passport-month-head"><div><div className="eyebrow">PÁGINA DO PASSAPORTE</div><h2>{data.selectedMonth ? formatMonth(data.selectedMonth) : "Temporada sem partidas"}</h2><p>{month ? `${month.totalMatches} partidas · ${month.appearances} participações · ${month.wins} vitórias` : "Os carimbos aparecerão depois do primeiro resultado oficial."}</p></div>{data.months.length ? <label>Mês<select value={data.selectedMonth || ""} onChange={event=>void load(summary.seasonNumber,event.target.value)}>{data.months.map(item=><option key={item.month} value={item.month}>{formatMonth(item.month)}</option>)}</select></label> : null}</div>
        {loading ? <BrandedLoading variant="inline" message="Virando a página…"/> : data.stamps.length ? <div className="passport-stamp-grid passport-full-grid">{data.stamps.map(stamp=><button type="button" aria-pressed={selectedStamp?.id===stamp.id} onClick={()=>setSelectedStamp(current=>current?.id===stamp.id?null:stamp)} className={`passport-stamp ${stamp.result.toLowerCase()} team-${String(stamp.team||"none").toLowerCase()}${selectedStamp?.id===stamp.id?" selected":""}`} key={stamp.id}><small>ROD. {stamp.round}</small><b>{resultLabel(stamp.result)}</b><i aria-hidden="true">{stamp.primaryIcon}</i><span>{formatDate(stamp.date)}</span></button>)}</div> : <div className="engagement-empty">Não há partidas oficiais nesta página.</div>}
        {selectedStamp ? <StampDetails stamp={selectedStamp} blueName={config.teamBlueName} yellowName={config.teamYellowName}/> : null}
      </section>
    </> : null}
  </main></div>;
}

function StampDetails({ stamp, blueName, yellowName }: { stamp: SeasonPassportStamp; blueName: string; yellowName: string }) {
  const recognitions = stamp.recognitions.map(value=>value==="PARTNER"?"Parceiro da rodada":value==="FAIR_PLAY"?"Fair Play":"Defesa da rodada");
  return <article className="passport-stamp-detail"><header><div><small>RODADA {stamp.round} · {formatDate(stamp.date)}</small><h3>{stamp.title}</h3></div><strong>{stamp.blueScore} × {stamp.yellowScore}</strong></header><div className="passport-detail-facts"><span><small>SITUAÇÃO</small><b>{stamp.participated?`${resultName(stamp.result)} · ${stamp.team==="BLUE"?blueName:yellowName}`:"Não participou"}</b></span><span><small>CONTRIBUIÇÕES</small><b>{stamp.goals} gols · {stamp.assists} assistências</b></span><span><small>DESTAQUES</small><b>{[stamp.motm?"Craque da rodada":"",...recognitions].filter(Boolean).join(" · ")||"Nenhum nesta rodada"}</b></span><span><small>CONQUISTAS</small><b>{stamp.achievements.map(value=>`${value.icon} ${value.title}`).join(" · ")||"Nenhuma nesta rodada"}</b></span></div><a className="primary" href={`/partidas?separation=${encodeURIComponent(stamp.separationId)}&tab=result`}>Ver partida e resenha →</a></article>;
}

function formatMonth(value:string){return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}-15T12:00:00Z`)).replace(/^./,letter=>letter.toUpperCase());}
function formatDate(value:string){return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(`${value.slice(0,10)}T12:00:00Z`));}
function resultLabel(value:SeasonPassportStamp["result"]){return value==="WIN"?"V":value==="DRAW"?"E":value==="LOSS"?"D":"—";}
function resultName(value:SeasonPassportStamp["result"]){return value==="WIN"?"Vitória":value==="DRAW"?"Empate":value==="LOSS"?"Derrota":"Ausente";}
