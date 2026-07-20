"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerPhoto } from "../components/PlayerPhoto";

type Team = "BLUE" | "YELLOW";
type Goal = { team: Team; scorerPlayerId: string; assistPlayerId: string; ownGoal: boolean };

export default function MatchDraftApp() {
  const separationId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("separationId") || "" : "";
  const [data,setData]=useState<any>(null),[goals,setGoals]=useState<Goal[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[dirty,setDirty]=useState(false);
  const scores=useMemo(()=>({blue:goals.filter(goal=>goal.team==="BLUE").length,yellow:goals.filter(goal=>goal.team==="YELLOW").length}),[goals]);
  const load=async()=>{const response=await fetch(`/api/career/draft?separationId=${encodeURIComponent(separationId)}`,{cache:"no-store"}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"Não foi possível carregar o rascunho.");setData(payload);setGoals((payload.draft?.contributions||[]).map((goal:any)=>({...goal,assistPlayerId:goal.assistPlayerId||""})));setDirty(false)};
  useEffect(()=>{load().catch(error=>setError(error.message))},[separationId]);
  const players=(team:Team)=>team==="BLUE"?data.players.blue:data.players.yellow;
  const addGoal=(team:Team)=>{setGoals(current=>[...current,{team,scorerPlayerId:"",assistPlayerId:"",ownGoal:false}]);setDirty(true);setMessage("")};
  const updateGoal=(index:number,key:keyof Goal,value:any)=>{setGoals(current=>current.map((goal,goalIndex)=>{if(goalIndex!==index)return goal;if(key==="ownGoal")return{...goal,ownGoal:Boolean(value),scorerPlayerId:"",assistPlayerId:""};const next={...goal,[key]:value};if(key==="scorerPlayerId"&&next.assistPlayerId===value)next.assistPlayerId="";return next}));setDirty(true);setMessage("")};
  const removeGoal=(index:number)=>{setGoals(current=>current.filter((_,goalIndex)=>goalIndex!==index));setDirty(true);setMessage("")};
  async function save(){setBusy(true);setError("");setMessage("");try{const response=await fetch(`/api/career/draft?separationId=${encodeURIComponent(separationId)}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({contributions:goals})}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"Não foi possível salvar o rascunho.");setGoals((payload.draft.contributions||[]).map((goal:any)=>({...goal,assistPlayerId:goal.assistPlayerId||""})));setDirty(false);setMessage(payload.message)}catch(error:any){setError(error.message)}finally{setBusy(false)}}
  if(!data)return <main className="match-draft-page"><div className="match-draft-loading"><b>{error||"Carregando rascunho da partida…"}</b><a href="/">Voltar ao site</a></div></main>;
  const backUrl=`/?view=history&separation=${encodeURIComponent(separationId)}`;
  return <main className="match-draft-page">
    <header className="match-draft-top"><a href={backUrl}>← Voltar para a separação</a><span>⚽ Pelada Pede Mais Uma</span></header>
    <section className="match-draft-hero"><div><small>RASCUNHO DA SÚMULA</small><h1>{data.matchTitle}</h1><p>{data.matchDate?new Date(data.matchDate+"T12:00:00").toLocaleDateString("pt-BR"):"Data não informada"}</p></div><div className="match-draft-score"><span className="blue">Azul <b>{scores.blue}</b></span><i>×</i><span className="yellow"><b>{scores.yellow}</b> Amarelo</span></div></section>
    {data.officialResultConfirmed&&<div className="match-draft-notice">O resultado desta partida já foi confirmado. O rascunho não pode mais ser alterado.</div>}
    {(!data.enabled||!data.trackContributions)&&<div className="match-draft-notice">O registro de gols e assistências está desativado no Modo Carreira.</div>}
    {!data.officialResultConfirmed&&data.enabled&&data.trackContributions&&<>
      <section className="match-draft-add"><button className="draft-blue" onClick={()=>addGoal("BLUE")}>+ Gol do Time Azul</button><button className="draft-yellow" onClick={()=>addGoal("YELLOW")}>+ Gol do Time Amarelo</button></section>
      <section className="match-draft-goals"><div className="match-draft-section-title"><div><small>LANCES REGISTRADOS</small><h2>Gols e assistências</h2></div><b>{goals.length} {goals.length===1?"gol":"gols"}</b></div>
        {goals.length===0?<div className="match-draft-empty">Nenhum gol registrado. Use os botões acima conforme o placar evoluir.</div>:goals.map((goal,index)=>{const teamPlayers=players(goal.team),opponentPlayers=players(goal.team==="BLUE"?"YELLOW":"BLUE"),scorerPlayers=goal.ownGoal?opponentPlayers:teamPlayers,number=goals.slice(0,index+1).filter(item=>item.team===goal.team).length;return <article className={`match-draft-goal ${goal.team.toLowerCase()} ${goal.ownGoal?"own-goal":""}`} key={`${goal.team}-${index}`}><header><b>{goal.team==="BLUE"?"Time Azul":"Time Amarelo"} · Gol {number}</b><button onClick={()=>removeGoal(index)} aria-label={`Remover gol ${number}`}>Remover</button></header><label className="match-draft-own-goal"><input type="checkbox" checked={goal.ownGoal} onChange={event=>updateGoal(index,"ownGoal",event.target.checked)}/> Gol contra (GC)</label><label><span>{goal.ownGoal?"Jogador adversário que marcou contra":"Autor do gol"}</span><select value={goal.scorerPlayerId} onChange={event=>updateGoal(index,"scorerPlayerId",event.target.value)}><option value="">Selecione o jogador</option>{scorerPlayers.map((player:any)=><option value={player.id} key={player.id}>{player.displayName}</option>)}</select></label><label><span>Assistência</span><select value={goal.assistPlayerId} onChange={event=>updateGoal(index,"assistPlayerId",event.target.value)} disabled={goal.ownGoal}><option value="">{goal.ownGoal?"Não se aplica":"Sem assistência"}</option>{!goal.ownGoal&&teamPlayers.filter((player:any)=>player.id!==goal.scorerPlayerId).map((player:any)=><option value={player.id} key={player.id}>{player.displayName}</option>)}</select></label>{goal.scorerPlayerId&&<div className="match-draft-player"><PlayerPhoto photoUrl={scorerPlayers.find((player:any)=>player.id===goal.scorerPlayerId)?.photoUrl} name={scorerPlayers.find((player:any)=>player.id===goal.scorerPlayerId)?.displayName||"Jogador"}/><span>{scorerPlayers.find((player:any)=>player.id===goal.scorerPlayerId)?.displayName}</span>{goal.ownGoal&&<b>GC</b>}</div>}</article>})}
      </section>
      <section className="match-draft-save"><div><b>{dirty?"Existem alterações ainda não salvas.":data.draft?.updatedAt?`Salvo em ${new Date(data.draft.updatedAt).toLocaleString("pt-BR")}.`:"O rascunho ainda não foi salvo."}</b><span>O resultado oficial só será aplicado depois da revisão e confirmação na separação.</span></div><button className="primary" onClick={save} disabled={busy||!dirty}>{busy?"Salvando…":"Salvar rascunho"}</button></section>
    </>}
    {error&&<div className="alert error match-draft-feedback">{error}</div>}{message&&<div className="admin-notice match-draft-feedback"><span>✓</span><b>{message}</b></div>}
  </main>;
}
