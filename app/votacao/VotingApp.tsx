"use client";
import { useEffect,useMemo,useState } from "react";
import { PlayerPhoto } from "../components/PlayerPhoto";

const fields=["motmThirdId","motmSecondId","motmFirstId","dotmThirdId","dotmSecondId","dotmFirstId"] as const;
type Field=typeof fields[number];

export default function VotingApp(){
 const [data,setData]=useState<any>(null),[voter,setVoter]=useState(""),[votes,setVotes]=useState<Record<Field,string>>(Object.fromEntries(fields.map(field=>[field,""])) as any),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const token=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("token")||"":"";
 const load=async()=>{const response=await fetch(`/api/career/vote?token=${encodeURIComponent(token)}`,{cache:"no-store"}),payload=await response.json();if(!response.ok)throw new Error(payload.error);setData(payload)};
 useEffect(()=>{
  let active=true;
  const refresh=()=>load().catch(error=>{if(active)setError(error.message)});
  refresh();
  const interval=window.setInterval(refresh,30000);
  const onVisible=()=>{if(document.visibilityState==="visible")refresh()};
  window.addEventListener("focus",refresh);
  document.addEventListener("visibilitychange",onVisible);
  return()=>{active=false;window.clearInterval(interval);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",onVisible)};
 },[token]);
 const names=useMemo(()=>Object.fromEntries((data?.players||[]).map((player:any)=>[player.id,player.displayName])),[data]);
 const selected=new Set(Object.values(votes).filter(Boolean));
 function options(field:Field){return(data?.players||[]).filter((player:any)=>player.id!==voter&&(!selected.has(player.id)||votes[field]===player.id));}
 async function submit(event:any){event.preventDefault();setError("");setMessage("");if(!voter||fields.some(field=>!votes[field])){setError("Identifique-se e preencha os seis lugares do pódio.");return}setBusy(true);try{const response=await fetch("/api/career/vote",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,voterPlayerId:voter,...votes})}),payload=await response.json();if(!response.ok)throw new Error(payload.error);setMessage(payload.message);await load()}catch(error:any){setError(error.message)}finally{setBusy(false)}}
 if(!data)return <main className="vote-page"><div className="vote-card"><b>{error||"Carregando votação…"}</b></div></main>;
 const match=data.match,closed=match.status==="CLOSED",voted=new Set(data.votedPlayerIds||[]);
 return <main className="vote-page"><header className="vote-brand"><a href="/">⚽ <b>Pelada Pede Mais Uma</b></a><span>Modo Carreira</span></header><section className="vote-card"><div className="vote-head"><div><small>VOTAÇÃO DA PARTIDA</small><h1>{match.matchTitle}</h1><p>{match.matchDate?new Date(match.matchDate+"T12:00:00").toLocaleDateString("pt-BR"):"Data não informada"}</p></div><div className="score-board"><span>Azul <b>{match.blueScore}</b></span><i>×</i><span><b>{match.yellowScore}</b> Amarelo</span></div></div>{data.showContributions&&match.contributions?.length>0&&<VoteContributions contributions={match.contributions}/>} {!data.enabled&&!closed&&<div className="alert">O Modo Carreira está temporariamente desativado. Nenhum voto pode ser enviado agora.</div>}{closed?<ClosedResults match={match} names={names}/>:<form className="career-vote-form" onSubmit={submit}><div className="vote-deadline">Votação aberta até <b>{new Date(match.closesAt).toLocaleString("pt-BR")}</b></div>{error&&<div className="alert error" role="alert">{error}</div>}{message&&<div className="admin-notice" role="status"><span>✓</span><b>{message}</b></div>}<label className="voter-select">Quem está votando?<select value={voter} onChange={event=>{setVoter(event.target.value);setVotes(Object.fromEntries(fields.map(field=>[field,""])) as any)}} required><option value="">Selecione seu nome</option>{data.players.map((player:any)=><option key={player.id} value={player.id} disabled={voted.has(player.id)}>{player.displayName}{voted.has(player.id)?" — voto já registrado":""}</option>)}</select></label>{voter&&voted.has(voter)?<div className="alert">Este jogador já votou. Um novo voto só será possível se um administrador remover o voto atual antes do encerramento.</div>:<><Podium title="Man of the Match" subtitle="Os três melhores da partida" tone="best" fields={fields.slice(0,3) as Field[]} votes={votes} setVotes={setVotes} options={options}/><Podium title="Deception of the Match" subtitle="Os três desempenhos abaixo do esperado" tone="worst" fields={fields.slice(3) as Field[]} votes={votes} setVotes={setVotes} options={options}/><button className="primary vote-submit" disabled={busy||!data.enabled}>{busy?"Enviando…":"Confirmar meus votos"}</button></>}</form>}</section></main>
}

function VoteContributions({contributions}:any){return <section className="career-contribution-summary vote-contribution-summary"><header className="vote-contribution-title"><span>ARTILHARIA DA PARTIDA</span><h2>Gols e assistências</h2></header><div>{contributions.map((goal:any,index:number)=><span className={`goal-${String(goal.team).toLowerCase()} ${goal.ownGoal?'own-goal':''}`} key={`${goal.team}-${index}`}><i>{goal.team==='BLUE'?'Time Azul':'Time Amarelo'}</i>{goal.ownGoal?<><b>GC</b><strong>{goal.scorerName}</strong></>:<><strong>{goal.scorerName}</strong>{goal.assistName?<small><em>Assistência</em>{goal.assistName}</small>:<small className="no-assist">Sem assistência</small>}</>}</span>)}</div></section>}

function Podium({title,subtitle,tone,fields,votes,setVotes,options}:any){const places=["3º lugar","2º lugar","1º lugar"];return <fieldset className={`vote-podium ${tone}`}><legend>{title}<small>{subtitle} · escolha do 3º ao 1º lugar</small></legend><div>{fields.map((field:Field,index:number)=><label key={field}><span>{places[index]}</span><select value={votes[field]} onChange={event=>setVotes((current:any)=>({...current,[field]:event.target.value}))} required><option value="">Selecione</option>{options(field).map((player:any)=><option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label>)}</div></fieldset>}

function ClosedResults({match,names}:any){const results=match.results;return <div className="vote-closed"><span>✓ VOTAÇÃO ENCERRADA</span><h2>Resultado final</h2><p>Os votos são finais e o momentum já foi aplicado aos jogadores.</p>{!results?.voteCount?<div className="empty">A votação foi encerrada sem votos válidos.</div>:<div className="career-results"><ResultPodium title="Man of the Match" entries={results.motm} names={names}/><ResultPodium title="Deception of the Match" entries={results.dotm} names={names}/></div>}</div>}
function ResultPodium({title,entries,names}:any){return <div><h3>{title}</h3>{(entries||[]).map((entry:any)=><span key={entry.playerId}><b>{entry.place}º</b><em>{names[entry.playerId]||"Jogador"}</em><strong>{entry.momentum>0?"+":""}{Number(entry.momentum).toFixed(1)}</strong></span>)}</div>}
