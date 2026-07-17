"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  balanceTeams,
  calculateTeamDelta,
  defaultConfig,
  matchPlayers,
  normalizeName,
  parseWhatsApp,
  score,
  type ImportedPlayerType,
  type Player,
} from "../lib/football";
import { PlayerPhoto } from "./components/PlayerPhoto";
import { buildVotingUrl, buildWhatsAppShareUrl, buildWhatsAppVotingMessage } from "../lib/career-sharing";
import QRCode from "qrcode";

const sample = `PELADA - 12/07 - BATISTA

Goleiros:
1 - Antonio: ✅

Mensalistas
1 - William: ✅
2 - Cussa: ✅
3 - Guillaume: ✅
4 - Roberto: ✅
5 - Marcio: ✅
6 - Thiago C: ✅
7 - Gaspar: ✅
8 - Mateus: ✅
9 - Pedro Henrique: ✅`;

type Stage = "import" | "review" | "result" | "history" | "players";
type GuestDraft = { displayName: string; fullName: string; nickname: string; type: ImportedPlayerType; primaryPosition: string; speed: number; skill: number; marking: number; goalkeeperPositioning: number; goalExit: number; notes: string };

export default function FootballApp() {
  const initialized = useRef(false);
  const [stage, setStage] = useState<Stage>("history");
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);
  const [text, setText] = useState(sample);
  const [players, setPlayers] = useState<Player[]>([]);
  const [publicPlayers, setPublicPlayers] = useState<Player[]>([]);
  const [publicPlayerConfig, setPublicPlayerConfig] = useState(defaultConfig);
  const [parsed, setParsed] = useState<ReturnType<typeof parseWhatsApp> | null>(null);
  const [selected, setSelected] = useState<Player[]>([]);
  const [result, setResult] = useState<any>(null);
  const [nonce, setNonce] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [historyDetail, setHistoryDetail] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<Player | null>(null);
  const [detailConfig, setDetailConfig] = useState(defaultConfig);
  const [guestDraft, setGuestDraft] = useState<GuestDraft | null>(null);
  const [manual, setManual] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [careerConfig, setCareerConfig] = useState<any>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState("");

  const load = async () => {
    const [auth, h, publicConfig, publicPlayersPayload] = await Promise.all([
      fetch("/api/auth", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/separations").then((response) => response.json()),
      fetch("/api/public-config", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/public-players", { cache: "no-store" }).then((response) => response.json()),
    ]);
    const administrator = Boolean(auth.admin);
    setIsAdmin(administrator);
    const separations = h.separations || [];
    setHistory(separations);
    setPublicBaseUrl(publicConfig.baseUrl || window.location.origin);
    setPublicPlayers(publicPlayersPayload.players || []);
    setPublicPlayerConfig({ ...defaultConfig, ...(publicPlayersPayload.config || {}) });
    if (administrator) {
      const [p, c, career] = await Promise.all([
        fetch("/api/players", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/config", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/career/admin", { cache: "no-store" }).then((response) => response.json()),
      ]);
      setPlayers(p.players || []);
      setConfig(c.config || defaultConfig);
      setCareerConfig(career.config || null);
      if (!initialized.current) setStage("import");
    } else {
      setPlayers([]);
      setConfig(defaultConfig);
      setCareerConfig(null);
      if (!initialized.current) setStage("history");
    }
    initialized.current = true;
    return separations;
  };

  useEffect(() => {
    load().catch(() => setToast("Não foi possível carregar os dados."));
    const refresh = () => load().catch(() => undefined);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, []);
  const matches = useMemo(() => parsed ? matchPlayers(parsed.confirmed, players) : [], [parsed, players]);
  const missing = matches.filter((match) => match.status !== "found");

  async function process() {
    const next = parseWhatsApp(text);
    let currentPlayers = players;
    try {
      const response = await fetch(`/api/players?refresh=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.players) { currentPlayers = payload.players; setPlayers(currentPlayers); }
    } catch { /* Continue with the most recent in-memory list. */ }
    setParsed(next);
    setSelected(next.confirmed.map((name) => matchPlayers([name], currentPlayers)[0]).filter((match) => match.status === "found").map((match: any) => match.player));
    setStage("review");
  }

  function openGuest(name: string) {
    const type=parsed?.typesByName[normalizeName(name)]||"monthly";
    setGuestDraft({ displayName: name, fullName: name, nickname: "", type, primaryPosition: type==="goalkeeper"?"Goleiro":"Meio-campo", speed: 3, skill: 3, marking: 3, goalkeeperPositioning: 3, goalExit: 3, notes: "" });
  }

  async function saveGuest(draft: GuestDraft) {
    const response = await fetch("/api/guests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const payload = await response.json();
    if (!response.ok) { setToast(payload.error || "Não foi possível cadastrar o convidado."); return; }
    const guest = payload.player as Player;
    setPlayers((current) => current.some((player) => player.id === guest.id) ? current : [...current, guest]);
    setSelected((current) => current.some((player) => player.id === guest.id) ? current : [...current, guest]);
    setGuestDraft(null);
    setToast(payload.reused ? `${guest.displayName} já estava cadastrado e foi associado.` : `${guest.displayName} foi cadastrado como ${playerTypeLabel(guest.type).toLowerCase()} e ficará disponível na área administrativa.`);
  }

  function generate(next = false) {
    try {
      const proposal = next ? nonce + 1 : nonce;
      setNonce(proposal);
      setResult(balanceTeams(selected, config, proposal));
      setManual(false);
      setStage("result");
    } catch (error: any) { setToast(error.message); }
  }

  function move(id: string, from: "blue" | "yellow") {
    const other = from === "blue" ? "yellow" : "blue";
    setResult((current: any) => {
      const moved = current[from].find((player: Player) => player.id === id);
      const blue = from === "blue" ? current.blue.filter((player: Player) => player.id !== id) : [...current.blue, moved];
      const yellow = from === "yellow" ? current.yellow.filter((player: Player) => player.id !== id) : [...current.yellow, moved];
      return { ...current, blue, yellow, ...calculateTeamDelta(blue, yellow, config) };
    });
    setManual(true);
  }

  async function confirmSeparation() {
    if (!confirm("Deseja confirmar esta separação? Os times serão salvos no histórico.")) return;
    const snapshot = { ...result, speedWeight: config.speedWeight, skillWeight: config.skillWeight, markingWeight: config.markingWeight };
    const response = await fetch("/api/separations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: parsed?.title, date: parsed?.date, originalText: text, result: snapshot, manuallyAdjusted: manual }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setToast(payload.error || "Não foi possível confirmar a separação."); if (response.status === 401) await load(); return; }
    setToast("Separação confirmada e salva."); await load(); setHistoryDetail(null); setStage("history");
  }

  async function confirmCareerMatch(separationId:string,blueScore:number,yellowScore:number){
    const response=await fetch('/api/career/match',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({separationId,blueScore,yellowScore})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Não foi possível confirmar o placar.');
    setToast('Partida confirmada e votação aberta.');
    const separations=await load();
    setHistoryDetail((current:any)=>separations.find((separation:any)=>separation.id===current?.id)??current);
  }

  async function copyTeams(source = result, withScores = false, titleOverride?: string) {
    const title = titleOverride || source?.matchTitle || parsed?.title || "PELADA";
    const weights = resultConfig(source);
    const format = (player: Player, index: number) => {const goalkeeper=player.type==="goalkeeper"||player.primaryPosition==="Goleiro";const stats=goalkeeper?`Hab ${player.skill.toFixed(1)} · Pos ${(player.goalkeeperPositioning??player.speed).toFixed(1)} · Saída ${(player.goalExit??player.marking??3).toFixed(1)}`:`Vel ${player.speed.toFixed(1)} · Hab ${player.skill.toFixed(1)} · Mar ${(player.marking??3).toFixed(1)}`;return `${index + 1}. ${player.displayName}${withScores ? ` — ${player.primaryPosition} · ${stats}` : ""}`};
    const output = `⚽ ${title}\n\n🔵 TIME AZUL\n${source.blue.map(format).join("\n")}\n\n🟡 TIME AMARELO\n${source.yellow.map(format).join("\n")}\n\n📊 ${source.rating || source.balanceClassification}\nVelocidade: peso de ${Math.round(weights.speedWeight * 100)}%\nHabilidade: peso de ${Math.round(weights.skillWeight * 100)}%\nMarcação: peso de ${Math.round(weights.markingWeight * 100)}%`;
    await navigator.clipboard.writeText(output);
    setToast("Times copiados com sucesso.");
  }

  if (isAdmin === undefined) return <div className="admin-loading">Carregando separações…</div>;
  const showPlayer = (player: Player, scoringConfig = config) => { setDetail(player); setDetailConfig(scoringConfig); };
  return <div className="app-shell">
    <header><a className="brand" onClick={() => { setHistoryDetail(null); setStage(isAdmin ? "import" : "history"); }}><span className="brand-mark">⚽</span><span><b>Pelada</b><small>Pede Mais Uma</small></span></a><nav>{isAdmin&&<button className={stage === "import" ? "active" : ""} onClick={() => { setHistoryDetail(null); setStage("import"); }}>Montar times</button>}<button className={stage === "players" ? "active" : ""} onClick={() => { setHistoryDetail(null); setStage("players"); }}>Jogadores</button><button className={stage === "history" ? "active" : ""} onClick={() => { setHistoryDetail(null); setStage("history"); }}>{isAdmin?"Separações salvas":"Últimas separações"}</button><a href="/conta">Minha conta</a><a href="/admin">{isAdmin?"Painel administrativo":"Entrar como administrador"}</a></nav></header>
    <main>
      {isAdmin && stage !== "history" && stage !== "players" && <div className="steps"><span className={stage === "import" ? "on" : "done"}>1 <i>Importar</i></span><b></b><span className={stage === "review" ? "on" : stage === "result" ? "done" : ""}>2 <i>Revisar</i></span><b></b><span className={stage === "result" ? "on" : ""}>3 <i>Times</i></span></div>}
      {isAdmin && stage === "import" && <section className="hero"><div className="eyebrow">ORGANIZAÇÃO SEM DRAMA</div><h1>Do WhatsApp para o campo,<br /><em>times justos em minutos.</em></h1><p>Cole a lista de confirmações. A gente identifica quem vai, equilibra posições e nível, e deixa tudo pronto para compartilhar.</p><div className="import-card"><label>Cole aqui a lista de confirmações do WhatsApp</label><textarea value={text} onChange={(event) => setText(event.target.value)} aria-label="Lista de confirmações" /><div className="card-foot"><span>✅ Só quem estiver confirmado entra na lista</span><button className="primary" onClick={process}>Processar confirmações <b>→</b></button></div></div><div className="trust"><span>⚖️ Equilibra posições e nível</span><span>🔒 Seus dados ficam protegidos</span><span>📱 Pronto para o WhatsApp</span></div></section>}
      {isAdmin && stage === "review" && parsed && <section className="content"><div className="section-head"><div><div className="eyebrow">REVISÃO DA PARTIDA</div><h2>{parsed.title}</h2><p>{parsed.confirmed.length} confirmados · {parsed.absent.length} ausentes</p></div><button className="ghost" onClick={() => setStage("import")}>← Editar lista</button></div>
        {parsed.duplicates.length > 0 && <div className="alert error">Jogadores duplicados: {parsed.duplicates.join(", ")}</div>}
        {missing.length > 0 && <div className="alert"><b>Existem jogadores confirmados sem dados suficientes.</b><span>Cadastre ou associe esses jogadores antes de gerar os times.</span></div>}
        <div className="review-grid"><div className="panel"><h3>Confirmados encontrados <span>{matches.length - missing.length}</span></h3>{matches.filter((match) => match.status === "found").map((match: any) => <PlayerRow key={match.name} player={match.player} onClick={() => showPlayer(match.player)} />)}</div><div className="panel"><h3>Sem cadastro <span>{missing.length}</span></h3>{missing.map((match: any) => <div className="missing" key={match.name}><PlayerAvatar name={match.name} /><div><b>{match.name}</b><small>{match.status === "ambiguous" ? "Possível correspondência ambígua" : `${playerTypeLabel(importedPlayerType(parsed,match.name))} sem cadastro`}</small></div><button onClick={() => openGuest(match.name)}>+ Cadastrar {playerTypeLabel(importedPlayerType(parsed,match.name)).toLowerCase()}</button></div>)}</div></div>
        <div className="action-bar"><span>{selected.length} jogadores prontos</span><button className="primary" disabled={selected.length < 4 || missing.length > 0 || parsed.duplicates.length > 0} onClick={() => generate()}>Gerar times equilibrados →</button></div>
      </section>}
      {isAdmin && stage === "result" && result && <ResultPresentation result={result} manuallyAdjusted={manual} onPlayer={(player:Player)=>showPlayer(player)} onMove={move} onNew={() => generate(true)} onCopy={() => copyTeams(result, true)} onConfirm={confirmSeparation} />}
      {stage === "players" && <PublicPlayersView players={publicPlayers} config={publicPlayerConfig} onPlayer={(player:Player)=>showPlayer(player,publicPlayerConfig)} />}
      {stage === "history" && !historyDetail && <section className={`content ${isAdmin?"":"public-history"}`}><div className="section-head"><div><div className="eyebrow">{isAdmin?"MEMÓRIA DA PELADA":"RESULTADOS DA PELADA"}</div><h2>{isAdmin?"Separações salvas":"Últimas separações"}</h2><p>{isAdmin?"Clique em uma partida para rever todos os times e indicadores confirmados.":"Consulte os times confirmados, os dados dos jogadores e todas as regras aplicadas em cada separação."}</p></div>{isAdmin&&<button className="primary" onClick={() => setStage("import")}>+ Nova separação</button>}</div><div className="history-list">{history.length === 0 ? <div className="empty">Nenhuma separação confirmada ainda.</div> : history.map((item) => <article key={item.id}><button className="history-open" onClick={() => setHistoryDetail(item)}><div className="history-date"><b>{item.matchDate ? new Date(item.matchDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</b><small>{new Date(item.confirmedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div><div className="history-main"><h3>{item.matchTitle}</h3><p><span className="dot blue-dot"></span>{item.snapshot.blue.map((player: Player) => player.displayName).join(", ")}</p><p><span className="dot yellow-dot"></span>{item.snapshot.yellow.map((player: Player) => player.displayName).join(", ")}</p></div></button><div className="history-actions"><span>● {item.balanceClassification}</span><button onClick={() => copyTeams(item.snapshot, false, item.matchTitle)}>Copiar para WhatsApp</button></div></article>)}</div></section>}
      {stage === "history" && historyDetail && <SavedSeparation item={historyDetail} isAdmin={isAdmin} careerEnabled={careerConfig?.enabled!==false} publicBaseUrl={publicBaseUrl} onConfirmCareer={confirmCareerMatch} onBack={() => setHistoryDetail(null)} onPlayer={(player:Player)=>showPlayer(player,resultConfig(historyDetail.snapshot))} onCopy={(withScores: boolean) => copyTeams(historyDetail.snapshot, withScores, historyDetail.matchTitle)} />}
    </main>
    <footer><b>⚽ Pelada Pede Mais Uma</b><span>Times equilibrados. Resenha garantida.</span></footer>
    {toast && <div className="toast" onAnimationEnd={() => setToast("")}>{toast}</div>}
    {detail && <PlayerDetail player={detail} config={detailConfig} onClose={() => setDetail(null)} />}
    {isAdmin && guestDraft && <GuestForm draft={guestDraft} onClose={() => setGuestDraft(null)} onSave={saveGuest} />}
  </div>;
}

function PublicPlayersView({players,config,onPlayer}:{players:Player[];config:any;onPlayer:(player:Player)=>void}) {
  const [query,setQuery]=useState("");
  const filtered=useMemo(()=>players.filter(player=>[player.displayName,player.primaryPosition,playerTypeLabel(player.type)].some(value=>value.toLowerCase().includes(query.trim().toLowerCase()))),[players,query]);
  const goalkeepers=filtered.filter(player=>player.type==="goalkeeper"||player.primaryPosition==="Goleiro");
  const linePlayers=filtered.filter(player=>player.type!=="goalkeeper"&&player.primaryPosition!=="Goleiro");
  return <section className="content public-players"><div className="section-head"><div><div className="eyebrow">ELENCO DA PELADA</div><h2>Jogadores</h2><p>Consulte os atributos e clique em um jogador para abrir seu card completo.</p></div><div className="public-player-total"><b>{players.length}</b><span>jogadores ativos</span></div></div><label className="public-player-search"><span>Buscar jogador</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nome, tipo ou posição…"/></label><PublicPlayerList title="Jogadores de linha" subtitle="Velocidade, habilidade e marcação" players={linePlayers} config={config} onPlayer={onPlayer}/><PublicPlayerList title="Goleiros" subtitle="Posicionamento, habilidade e saída de gol" players={goalkeepers} config={config} onPlayer={onPlayer} goalkeeper/></section>;
}

type PublicPlayerSortKey="name"|"type"|"position"|"primaryRating"|"skill"|"secondaryRating"|"momentum"|"games"|"overall";
type PublicPlayerSort={key:PublicPlayerSortKey;direction:"asc"|"desc"};

function PublicPlayerList({title,subtitle,players,config,onPlayer,goalkeeper=false}:{title:string;subtitle:string;players:Player[];config:any;onPlayer:(player:Player)=>void;goalkeeper?:boolean}) {
  const [sort,setSort]=useState<PublicPlayerSort>({key:"name",direction:"asc"});
  const headers:{label:string;key:PublicPlayerSortKey}[]=goalkeeper?[{label:"Goleiro",key:"name"},{label:"Posicionamento",key:"primaryRating"},{label:"Habilidade",key:"skill"},{label:"Saída de gol",key:"secondaryRating"},{label:"Momentum",key:"momentum"},{label:"J / V / D",key:"games"},{label:"Overall",key:"overall"}]:[{label:"Jogador",key:"name"},{label:"Tipo",key:"type"},{label:"Posição",key:"position"},{label:"Velocidade",key:"primaryRating"},{label:"Habilidade",key:"skill"},{label:"Marcação",key:"secondaryRating"},{label:"Momentum",key:"momentum"},{label:"J / V / D",key:"games"},{label:"Overall",key:"overall"}];
  const sorted=useMemo(()=>[...players].sort((a,b)=>comparePublicPlayers(a,b,sort,config,goalkeeper)),[players,sort,config,goalkeeper]);
  const toggle=(key:PublicPlayerSortKey)=>setSort(current=>({key,direction:current.key===key&&current.direction==="asc"?"desc":"asc"}));
  return <section className="public-player-section"><div className="public-player-list-title"><div><h3>{title}</h3><p>{subtitle}</p></div><b>{players.length}</b></div><div className="public-player-table" role="table"><div className={`public-player-tr ${goalkeeper?"goalkeeper":"line"} th`} role="row">{headers.map(header=>{const active=sort.key===header.key;return <button type="button" role="columnheader" aria-sort={active?(sort.direction==="asc"?"ascending":"descending"):"none"} className={active?"public-sort-header active":"public-sort-header"} key={header.key} onClick={()=>toggle(header.key)} title={`Ordenar por ${header.label}`}><span>{header.label}</span><i aria-hidden="true">{active?(sort.direction==="asc"?"↑":"↓"):"↕"}</i></button>})}</div>{sorted.length===0?<div className="public-player-empty">Nenhum jogador encontrado nesta lista.</div>:sorted.map(player=>{const career=player.careerStats??{games:0,wins:0,losses:0};return <button className={`public-player-tr ${goalkeeper?"goalkeeper":"line"}`} key={player.id} onClick={()=>onPlayer(player)} aria-label={`Abrir card de ${player.displayName}`}><span className="public-player-identity"><PlayerAvatar player={player}/><b>{player.displayName}<small>{goalkeeper?"Goleiro":playerTypeLabel(player.type)}</small></b></span>{goalkeeper?<><span>{(player.goalkeeperPositioning??player.speed).toFixed(1)}</span><span>{player.skill.toFixed(1)}</span><span>{(player.goalExit??player.marking??3).toFixed(1)}</span></>:<><span>{playerTypeLabel(player.type)}</span><span>{player.primaryPosition}</span><span>{player.speed.toFixed(1)}</span><span>{player.skill.toFixed(1)}</span><span>{(player.marking??3).toFixed(1)}</span></>}<span className={(player.momentum??0)>0?"positive":(player.momentum??0)<0?"negative":""}>{(player.momentum??0)>0?"+":""}{(player.momentum??0).toFixed(1)}</span><span>{career.games} / {career.wins} / {career.losses}</span><strong>{score(player,config).toFixed(1)}</strong></button>})}</div></section>;
}

function comparePublicPlayers(a:Player,b:Player,sort:PublicPlayerSort,config:any,goalkeeper:boolean){
  const value=(player:Player)=>{switch(sort.key){case"name":return player.displayName;case"type":return playerTypeLabel(player.type);case"position":return player.primaryPosition;case"primaryRating":return goalkeeper?(player.goalkeeperPositioning??player.speed):player.speed;case"skill":return player.skill;case"secondaryRating":return goalkeeper?(player.goalExit??player.marking??3):(player.marking??3);case"momentum":return player.momentum??0;case"games":return player.careerStats?.games??0;case"overall":return score(player,config)}};
  const aValue=value(a),bValue=value(b);let result=typeof aValue==="number"&&typeof bValue==="number"?aValue-bValue:String(aValue).localeCompare(String(bValue),"pt-BR",{sensitivity:"base",numeric:true});if(result===0)result=a.displayName.localeCompare(b.displayName,"pt-BR",{sensitivity:"base",numeric:true});return sort.direction==="asc"?result:-result;
}

function ResultPresentation({ result, manuallyAdjusted, onPlayer, onMove, onNew, onCopy, onConfirm }: any) {
  return <section className="content"><div className="section-head"><div><div className="eyebrow">PROPOSTA {result.proposal}</div><h2>Times prontos para o jogo</h2><p>{manuallyAdjusted ? "Separação ajustada manualmente" : "O algoritmo comparou milhares de combinações."}</p></div><BalanceBadge rating={result.rating} /></div><TeamGrid result={result} onPlayer={onPlayer} onMove={onMove} /><BalanceMetrics delta={result.delta} /><div className="result-actions"><button className="ghost" onClick={onNew}>↻ Gerar nova separação</button><button className="ghost" onClick={onCopy}>Copiar com pontuações</button><button className="primary" onClick={onConfirm}>Confirmar separação</button></div></section>;
}

function SavedSeparation({ item, isAdmin, careerEnabled, publicBaseUrl, onConfirmCareer, onBack, onPlayer, onCopy }: any) {
  const result = item.snapshot;
  const weights = resultConfig(result);
  return <section className="content saved-detail"><div className="section-head"><div><div className="eyebrow">SEPARAÇÃO CONFIRMADA</div><h2>{item.matchTitle}</h2><p>{item.matchDate ? new Date(item.matchDate + "T12:00:00").toLocaleDateString("pt-BR") : "Data não informada"} · confirmada em {new Date(item.confirmedAt).toLocaleString("pt-BR")}{item.manuallyAdjusted ? " · ajustada manualmente" : ""}</p></div><BalanceBadge rating={result.rating || item.balanceClassification} /></div>{(item.career||isAdmin)&&<CareerMatchCard item={item} isAdmin={isAdmin} enabled={careerEnabled} publicBaseUrl={publicBaseUrl} onConfirm={onConfirmCareer}/>}<TeamGrid result={result} onPlayer={onPlayer} /><BalanceMetrics delta={result.delta} /><div className="saved-meta"><span><small>Proposta utilizada</small><b>{result.proposal || 1}</b></span><span><small>Peso da velocidade</small><b>{Math.round(weights.speedWeight * 100)}%</b></span><span><small>Peso da habilidade</small><b>{Math.round(weights.skillWeight * 100)}%</b></span><span><small>Peso da marcação</small><b>{Math.round(weights.markingWeight * 100)}%</b></span><span><small>Diferença máx. por posição</small><b>{result.maximumPositionDifference??"Não registrado"}</b></span><span><small>Melhores protegidos</small><b>{result.protectedTopPlayersPercentage==null?"Não registrado":`${Math.round(result.protectedTopPlayersPercentage*100)}%`}</b></span><span><small>Tentativas avaliadas</small><b>{result.algorithmAttempts??"Não registrado"}</b></span><span><small>Ajuste manual</small><b>{item.manuallyAdjusted ? "Sim" : "Não"}</b></span></div><div className="result-actions"><button className="ghost" onClick={onBack}>← Voltar ao histórico</button><button className="ghost" onClick={() => onCopy(false)}>Copiar para WhatsApp</button><button className="primary" onClick={() => onCopy(true)}>Copiar com pontuações</button></div></section>;
}

function CareerMatchCard({item,isAdmin,enabled,publicBaseUrl,onConfirm}:any){
  const career=item.career;
  const [blueScore,setBlueScore]=useState(0),[yellowScore,setYellowScore]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[qr,setQr]=useState('');
  const votingUrl=career&&publicBaseUrl?buildVotingUrl(publicBaseUrl,career.votingToken):'';
  useEffect(()=>{if(votingUrl)QRCode.toDataURL(votingUrl,{width:220,margin:1,color:{dark:'#143f31',light:'#ffffff'}}).then(setQr).catch(()=>setQr(''))},[votingUrl]);
  async function submit(event:any){event.preventDefault();if(!confirm(`Confirmar o placar ${blueScore} × ${yellowScore}? O momentum das equipes será aplicado imediatamente.`))return;setBusy(true);setError('');try{await onConfirm(item.id,blueScore,yellowScore)}catch(error:any){setError(error.message)}finally{setBusy(false)}}
  async function copy(){await navigator.clipboard.writeText(votingUrl)}
  function whatsapp(){const message=buildWhatsAppVotingMessage({matchTitle:item.matchTitle,votingUrl,closesAt:career.closesAt});window.open(buildWhatsAppShareUrl(message),'_blank','noopener,noreferrer')}
  if(!career)return <section className="career-match-card pending"><div><small>MODO CARREIRA</small><h3>Este jogo foi realizado?</h3><p>Confirme o placar para aplicar o momentum das equipes e abrir a votação dos destaques.</p></div>{isAdmin?(enabled?<form onSubmit={submit}><label>Time Azul<input type="number" min="0" max="99" value={blueScore} onChange={e=>setBlueScore(Number(e.target.value))}/></label><b>×</b><label>Time Amarelo<input type="number" min="0" max="99" value={yellowScore} onChange={e=>setYellowScore(Number(e.target.value))}/></label><button className="primary" disabled={busy}>{busy?'Confirmando…':'Confirmar partida'}</button>{error&&<span className="career-error">{error}</span>}</form>:<div className="alert">O Modo Carreira está desativado nas configurações administrativas.</div>):null}</section>;
  const winner=career.winnerTeam==='BLUE'?'Time Azul':career.winnerTeam==='YELLOW'?'Time Amarelo':'Empate',rules=career.config;
  return <section className="career-match-card confirmed"><div className="career-score"><small>PLACAR CONFIRMADO</small><strong><span>Azul <b>{career.blueScore}</b></span><i>×</i><span><b>{career.yellowScore}</b> Amarelo</span></strong><em>{winner}</em>{rules&&<p className="career-rules">Multiplicador {Number(rules.momentumMultiplier??1).toFixed(1)}× · vitória {signed(rules.winnerBonus)} · derrota {signed(rules.loserPenalty)} · votação por {rules.votingDays} dias</p>}</div><div className="career-voting-share"><div><small>{career.status==='OPEN'?'VOTAÇÃO ABERTA':'VOTAÇÃO ENCERRADA'}</small><h3>Destaques da partida</h3><p>{career.status==='OPEN'?`Votos aceitos até ${new Date(career.closesAt).toLocaleString('pt-BR')}.`:'Resultado final consolidado; os votos não podem mais ser alterados.'}</p>{career.status==='OPEN'&&<div className="career-link-actions"><button className="ghost" onClick={copy}>Copiar link</button><button className="primary" onClick={whatsapp}>Compartilhar no WhatsApp</button></div>}</div>{career.status==='OPEN'&&qr&&<a href={votingUrl} target="_blank" rel="noreferrer"><img src={qr} alt="QR Code para votação da partida"/><span>Abrir votação</span></a>}</div>{career.status==='CLOSED'&&<CareerPublicResults results={career.results} players={[...item.snapshot.blue,...item.snapshot.yellow]}/>}</section>
}
function signed(value:number){return `${value>0?'+':''}${Number(value).toFixed(1)}`}
function CareerPublicResults({results,players}:any){const names=Object.fromEntries(players.map((player:any)=>[player.id,player.displayName]));if(!results?.voteCount)return <div className="career-public-results empty">Votação encerrada sem votos válidos.</div>;const podium=(title:string,entries:any[])=><div><h4>{title}</h4>{entries.map(entry=><span key={entry.playerId}><b>{entry.place}º</b><em>{names[entry.playerId]||'Jogador'}</em><strong>{entry.momentum>0?'+':''}{Number(entry.momentum).toFixed(1)}</strong></span>)}</div>;return <div className="career-public-results">{podium('Man of the Match',results.motm||[])}{podium('Deception of the Match',results.dotm||[])}</div>}

function resultConfig(result: any) {
  const legacySnapshot = result?.markingWeight == null && result?.speedWeight != null && result?.skillWeight != null;
  return { ...defaultConfig, speedWeight: result?.speedWeight ?? defaultConfig.speedWeight, skillWeight: result?.skillWeight ?? defaultConfig.skillWeight, markingWeight: result?.markingWeight ?? (legacySnapshot ? 0 : defaultConfig.markingWeight), momentumMultiplier: result?.momentumMultiplier ?? defaultConfig.momentumMultiplier, maximumPositionDifference: result?.maximumPositionDifference ?? defaultConfig.maximumPositionDifference, protectedTopPlayersPercentage: result?.protectedTopPlayersPercentage ?? defaultConfig.protectedTopPlayersPercentage, algorithmAttempts: result?.algorithmAttempts ?? defaultConfig.algorithmAttempts };
}

function TeamGrid({ result, onPlayer, onMove }: any) {
  const scoringConfig = resultConfig(result);
  return <div className="teams"><Team color="blue" title="Time Azul" players={result.blue} metrics={result.blueMetrics} extraId={result.extraId} scoringConfig={scoringConfig} onPlayer={onPlayer} onMove={onMove ? (id: string) => onMove(id, "blue") : undefined} /><Team color="yellow" title="Time Amarelo" players={result.yellow} metrics={result.yellowMetrics} extraId={result.extraId} scoringConfig={scoringConfig} onPlayer={onPlayer} onMove={onMove ? (id: string) => onMove(id, "yellow") : undefined} /></div>;
}

function BalanceBadge({ rating }: { rating: string }) { return <div className={`balance ${rating?.startsWith("Excelente") ? "great" : ""}`}><span>●</span><div><small>INDICADOR</small><b>{rating}</b></div></div>; }
function BalanceMetrics({ delta }: any) { return <div className="metrics"><h3>Diferenças entre os times</h3><div><Metric label="Jogadores" value={delta?.players ?? 0} /><Metric label="Defensores" value={delta?.defenders ?? 0} /><Metric label="Meio-campistas" value={delta?.midfielders ?? 0} /><Metric label="Atacantes" value={delta?.attackers ?? 0} /><Metric label="Velocidade" value={(delta?.speed ?? 0).toFixed(1)} /><Metric label="Habilidade" value={(delta?.skill ?? 0).toFixed(1)} /><Metric label="Marcação" value={(delta?.marking ?? 0).toFixed(1)} /><Metric label="Momentum" value={(delta?.momentum ?? 0).toFixed(1)} /><Metric label="Pontuação" value={(delta?.score ?? 0).toFixed(2)} /></div></div>; }

function PlayerRow({ player, onClick }: { player: Player; onClick: () => void }) { return <button className="player-row" onClick={onClick}><PlayerAvatar player={player} /><div><b>{player.displayName}</b><small>{player.primaryPosition}</small></div><span className="rating">{score(player).toFixed(1)}</span><i>›</i></button>; }
function Team({ color, title, players, metrics, extraId, scoringConfig, onPlayer, onMove }: any) { return <article className={`team ${color}`}><div className="team-head"><div><span className="shirt">{color === "blue" ? "🔵" : "🟡"}</span><h3>{title}</h3></div><b>{players.length} jogadores</b></div><div className="team-summary"><span>DEF <b>{metrics?.positions.Defesa || 0}</b></span><span>MEI <b>{metrics?.positions["Meio-campo"] || 0}</b></span><span>ATA <b>{metrics?.positions.Ataque || 0}</b></span><span>MÉDIA <b>{metrics?.scoreAvg?.toFixed(2) || "—"}</b></span></div>{players.map((player: Player) => <div className="team-player" key={player.id}><button onClick={() => onPlayer(player)}><PlayerAvatar player={player} /><div><b>{player.displayName}</b><small>{player.primaryPosition}{player.id === extraId ? " · Jogador adicional" : ""}</small></div></button><span>{score(player, scoringConfig).toFixed(1)}</span>{onMove && <button className="swap" title="Mover para o outro time" onClick={() => onMove(player.id)}>⇄</button>}</div>)}</article>; }

function PlayerAvatar({ player, name }: { player?: Player; name?: string }) { const label = player?.displayName || name || "Jogador"; return <PlayerPhoto photoUrl={player?.photoUrl} name={label} />; }
function importedPlayerType(parsed:ReturnType<typeof parseWhatsApp>,name:string):ImportedPlayerType{return parsed.typesByName[normalizeName(name)]||"monthly"}
function playerTypeLabel(type:string){return type==="guest"?"Convidado":type==="goalkeeper"?"Goleiro":"Mensalista"}

function PlayerDetail({ player, config, onClose }: any) {
  const type=player.type === "guest" ? "Convidado" : player.type === "goalkeeper" ? "Goleiro" : "Mensalista";
  const goalkeeper=player.type==="goalkeeper"||player.primaryPosition==="Goleiro";
  const stats=goalkeeper?[{label:"HABILIDADE",value:player.skill},{label:"POSICIONAMENTO",value:player.goalkeeperPositioning??player.speed??3},{label:"SAÍDA DE GOL",value:player.goalExit??player.marking??3}]:[{label:"VELOCIDADE",value:player.speed},{label:"HABILIDADE",value:player.skill},{label:"MARCAÇÃO",value:player.marking??3}];
  const careerStats=player.careerStats??{games:0,wins:0,losses:0};
  return <div className="modal-back" onClick={onClose}><div className="player-card-modal" onClick={event=>event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Fechar detalhes">×</button><div className="player-card"><div className="card-top"><div className="overall"><strong>{score(player,config).toFixed(1)}</strong><span>OVERALL</span></div><div className="card-photo"><PlayerPhoto photoUrl={player.photoUrl} name={player.displayName} large /></div></div><div className="card-identity"><h2>{player.displayName}</h2>{player.fullName!==player.displayName&&<p>{player.fullName}</p>}</div><div className="card-role"><span><small>TIPO</small><b>{type}</b></span><span><small>POSIÇÃO</small><b>{player.primaryPosition}</b></span></div><div className="card-stats">{stats.map(stat=><span key={stat.label}><b>{Number(stat.value).toFixed(1)}</b><small>{stat.label}</small></span>)}<span><b>{(player.momentum??0)>0?'+':''}{(player.momentum??0).toFixed(1)}</b><small>MOMENTUM</small></span></div><div className="card-career-stats" aria-label="Estatísticas de partidas confirmadas"><span><b>{careerStats.games}</b><small>JOGOS</small></span><span className="wins"><b>{careerStats.wins}</b><small>VITÓRIAS</small></span><span className="losses"><b>{careerStats.losses}</b><small>DERROTAS</small></span></div>{player.notes&&<blockquote>{player.notes}</blockquote>}</div></div></div>;
}

function GuestForm({ draft, onClose, onSave }: { draft: GuestDraft; onClose: () => void; onSave: (draft: GuestDraft) => void }) {
  const [value,setValue]=useState(draft);const update=(key:keyof GuestDraft,next:any)=>setValue(current=>({...current,[key]:next}));const goalkeeper=value.type==="goalkeeper"||value.primaryPosition==="Goleiro";
  function changeType(type:ImportedPlayerType){setValue(current=>({...current,type,primaryPosition:type==='goalkeeper'?'Goleiro':current.primaryPosition==='Goleiro'?'Meio-campo':current.primaryPosition}))}
  function changePosition(primaryPosition:string){setValue(current=>({...current,primaryPosition,type:primaryPosition==='Goleiro'?'goalkeeper':current.type==='goalkeeper'?'monthly':current.type}))}
  return <div className="modal-back"><form className="editor guest-editor" onSubmit={event=>{event.preventDefault();onSave(value)}}><button className="close" type="button" onClick={onClose}>×</button><h2>Cadastrar {playerTypeLabel(value.type).toLowerCase()}</h2><p>O jogador ficará salvo com o tipo identificado na lista e aparecerá na área administrativa para futuras edições.</p><div className="form-grid"><label>Nome<input value={value.displayName} onChange={event=>{update('displayName',event.target.value);update('fullName',event.target.value)}} required/></label><label>Apelido<input value={value.nickname} onChange={event=>update('nickname',event.target.value)}/></label><label>Tipo<select value={value.type} onChange={event=>changeType(event.target.value as ImportedPlayerType)}><option value="monthly">Mensalista</option><option value="guest">Convidado</option><option value="goalkeeper">Goleiro</option></select></label><label>Posição<select value={value.primaryPosition} onChange={event=>changePosition(event.target.value)}><option>Defesa</option><option>Meio-campo</option><option>Ataque</option><option>Goleiro</option></select></label>{goalkeeper?<><RatingSlider label="Habilidade (reflexos e agilidade)" value={value.skill} onChange={next=>update('skill',next)}/><RatingSlider label="Posicionamento" value={value.goalkeeperPositioning} onChange={next=>update('goalkeeperPositioning',next)}/><RatingSlider label="Saída de gol (coragem)" value={value.goalExit} onChange={next=>update('goalExit',next)}/></>:<><RatingSlider label="Velocidade" value={value.speed} onChange={next=>update('speed',next)}/><RatingSlider label="Habilidade" value={value.skill} onChange={next=>update('skill',next)}/><RatingSlider label="Marcação" value={value.marking} onChange={next=>update('marking',next)}/></>}<label className="wide">Observações<textarea value={value.notes} onChange={event=>update('notes',event.target.value)}/></label></div><div className="editor-actions"><button className="ghost" type="button" onClick={onClose}>Cancelar</button><button className="primary">Salvar {playerTypeLabel(value.type).toLowerCase()}</button></div></form></div>;
}

function RatingSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="rating-slider"><span>{label}</span><input type="range" min="1" max="5" step="0.1" value={value} onChange={(event) => onChange(Math.round(Number(event.target.value) * 10) / 10)} /><output>{Number(value).toFixed(1)}</output><small><span>1</span><span>5</span></small></label>; }
function Metric({ label, value }: { label: string; value: any }) { return <span><small>{label}</small><b>{value}</b></span>; }
