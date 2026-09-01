"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  balanceTeams,
  defaultConfig,
  recalculateTeamBalance,
  score,
  type Player,
} from "../lib/football";
import { PlayerPhoto } from "./components/PlayerPhoto";
import { SiteHeader } from "./components/SiteHeader";
import { WhatsAppIcon } from "./components/WhatsAppIcon";
import { useInstanceBranding } from "./InstanceBranding";
import { playerTypeLabel } from "../lib/player-types";
import { buildVotingUrl, buildWhatsAppCareerResultsMessage, buildWhatsAppRoundRecapMessage, buildWhatsAppShareUrl, buildWhatsAppVotingMessage } from "../lib/career-sharing";
import { playerCardTier, playerCardTierLabel } from "../lib/player-card-tier";
import { teamColorMarker } from "../lib/team-colors";
import QRCode from "qrcode";

type Stage = "result" | "history" | "players";
type InitialStage = Extract<Stage, "history" | "players">;
type MatchSeparationSource = { id: string; title: string; matchAt: string; date: string; location?: string | null; presentCount: number };
function stageForCurrentRoute(fallback?: InitialStage): InitialStage | undefined {
  if (window.location.pathname === "/jogadores") return "players";
  if (window.location.pathname === "/separacoes-salvas") return "history";
  return fallback;
}

export default function FootballApp({ initialStage }: { initialStage?: InitialStage }) {
  const { config: instanceBrand } = useInstanceBranding();
  const initialized = useRef(false);
  const previousInitialStage = useRef<InitialStage | undefined>(initialStage);
  const previousAdministrator = useRef<boolean | undefined>(undefined);
  const [stage, setStage] = useState<Stage>(initialStage ?? "history");
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);
  const [canManageResults, setCanManageResults] = useState(false);
  const [publicPlayers, setPublicPlayers] = useState<Player[]>([]);
  const [publicPlayerConfig, setPublicPlayerConfig] = useState(defaultConfig);
  const [selected, setSelected] = useState<Player[]>([]);
  const [result, setResult] = useState<any>(null);
  const [nonce, setNonce] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [historyDetail, setHistoryDetail] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<Player | null>(null);
  const [detailConfig, setDetailConfig] = useState(defaultConfig);
  const [manual, setManual] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [careerConfig, setCareerConfig] = useState<any>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [matchSource, setMatchSource] = useState<MatchSeparationSource | null>(null);
  const [separationDraftsEnabled, setSeparationDraftsEnabled] = useState(false);
  const [draftMode, setDraftMode] = useState(false);
  const [loadedDraft, setLoadedDraft] = useState<any>(null);

  const load = async () => {
    const [auth, h, publicConfig, publicPlayersPayload] = await Promise.all([
      fetch("/api/auth", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/separations").then((response) => response.json()),
      fetch("/api/public-config", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/public-players", { cache: "no-store" }).then((response) => response.json()),
    ]);
    const permissions:string[]=Array.isArray(auth.admin?.permissions)?auth.admin.permissions:[];
    const fullAdministrator=auth.admin?.accountType==="administrator";
    const administrator=Boolean(fullAdministrator||permissions.includes("SEPARATIONS_MANAGE"));
    const resultManager=Boolean(fullAdministrator||permissions.includes("MATCH_RESULTS_MANAGE"));
    const protectedAccess=administrator||resultManager;
    const authenticationChanged = previousAdministrator.current !== undefined && previousAdministrator.current !== protectedAccess;
    const routeInitialStage = stageForCurrentRoute(initialStage);
    setIsAdmin(administrator);
    setCanManageResults(resultManager);
    const separations = h.separations || [];
    const searchParams = new URLSearchParams(window.location.search);
    const requestedSeparation=searchParams.get("separation");
    const requestedMatchId=searchParams.get("matchId");
    const requestedDraftMode=searchParams.get("draft")==="1";
    const requested=separations.find((separation:any)=>separation.id===requestedSeparation);
    const draftsEnabled=Boolean(publicConfig.instance?.separationDraftsEnabled);
    setHistory(separations);
    setSeparationDraftsEnabled(draftsEnabled);
    setDraftMode(Boolean(requestedMatchId&&requestedDraftMode));
    setPublicBaseUrl(publicConfig.baseUrl || window.location.origin);
    setPublicPlayers(publicPlayersPayload.players || []);
    setPublicPlayerConfig({ ...defaultConfig, ...(publicPlayersPayload.config || {}) });
    if (protectedAccess) {
      const [c, career] = await Promise.all([
        fetch("/api/config", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/career/admin", { cache: "no-store" }).then((response) => response.json()),
      ]);
      const nextConfig = {
        ...(c.config || defaultConfig),
        showContributions: Boolean(career.config?.trackContributions),
        cardTiersEnabled: Boolean(career.config?.cardTiersEnabled),
        cardBronzeMax: Number(career.config?.cardBronzeMax ?? 2.4),
        cardSilverMax: Number(career.config?.cardSilverMax ?? 3.9),
        cardGoldMax: Number(career.config?.cardGoldMax ?? 4.5),
      };
      setConfig(nextConfig);
      setCareerConfig(career.config || null);
      if (!initialized.current || authenticationChanged) {
        setHistoryDetail(null);
        setDetail(null);
        if(requested){setStage("history");setHistoryDetail(requested)}
        else if (requestedMatchId) {
          const proposalResponse = await fetch("/api/mobile/separations/proposal", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ matchId: requestedMatchId, nonce: 0, loadDraft: requestedDraftMode }),
          });
          const proposal = await proposalResponse.json().catch(() => ({}));
          if (!proposalResponse.ok) {
            setToast(proposal.error || "Não foi possível carregar os presentes desta partida.");
            setStage("history");
          } else {
            setMatchSource(proposal.match);
            setSelected(proposal.players || []);
            setResult(proposal.result);
            setLoadedDraft(proposal.draft||null);
            setNonce(Math.max(0, Number(proposal.result?.proposal || 1) - 1));
            setManual(Boolean(proposal.draft?.exists&&!proposal.draft?.stale&&proposal.draft?.manuallyAdjusted));
            setStage("result");
            if(proposal.draft?.stale)setToast("O rascunho anterior ficou desatualizado. Uma nova proposta foi gerada com os presentes atuais.");
          }
        } else {
          setMatchSource(null);
          setStage(routeInitialStage ?? "history");
        }
      }
    } else {
      setConfig(defaultConfig);
      setCareerConfig(null);
      if (!initialized.current || authenticationChanged) {
        setSelected([]);
        setResult(null);
        setMatchSource(null);
        setManual(false);
        setDetail(null);
        setHistoryDetail(null);
        setStage(routeInitialStage ?? "history");
        if(requested){setStage("history");setHistoryDetail(requested)}
      }
    }
    previousAdministrator.current = protectedAccess;
    initialized.current = true;
    return separations;
  };

  function openSavedSeparation(item:any){setHistoryDetail(item);setStage("history");window.history.pushState({},"",`/separacoes-salvas?separation=${encodeURIComponent(item.id)}`);window.scrollTo({top:0,behavior:"smooth"})}
  function closeSavedSeparation(){setHistoryDetail(null);setStage("history");window.history.pushState({},"","/separacoes-salvas")}
  function savedSeparationUrl(item:any){return `${window.location.origin}/separacoes-salvas?separation=${encodeURIComponent(item.id)}`}
  async function shareSavedSeparation(item:any){const url=savedSeparationUrl(item),recap=item.career?.recap;if(recap?.shareText){window.open(buildWhatsAppShareUrl(buildWhatsAppRoundRecapMessage(recap.shareText,url)),'_blank','noopener,noreferrer');return}const text=`⚽ ${item.matchTitle}\nConfira os times e os detalhes desta escalação:`,message=buildWhatsAppRoundRecapMessage(text,url);if(navigator.share){try{await navigator.share({title:item.matchTitle,text:message});return}catch(error:any){if(error?.name==="AbortError")return}}await navigator.clipboard.writeText(message);setToast("Link da escalação copiado.")}

  useEffect(() => {
    load().catch(() => setToast("Não foi possível carregar os dados."));
    const refresh = () => load().catch(() => undefined);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const syncNavigation=()=>load().then(separations=>{const id=new URLSearchParams(window.location.search).get("separation");setStage("history");setHistoryDetail(id?separations.find((item:any)=>item.id===id)||null:null)}).catch(()=>undefined);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("popstate",syncNavigation);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { window.removeEventListener("pageshow", refresh);window.removeEventListener("popstate",syncNavigation); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, []);

  useEffect(() => {
    if (isAdmin === undefined || previousInitialStage.current === initialStage) return;
    previousInitialStage.current = initialStage;
    setHistoryDetail(null);
    setDetail(null);
    setStage(initialStage ?? "history");
  }, [initialStage, isAdmin]);

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
      return { ...current, blue, yellow, ...recalculateTeamBalance(blue, yellow, config) };
    });
    setManual(true);
  }

  async function confirmSeparation(mode:"save-draft"|"publish"="publish") {
    if(!matchSource){setToast("Abra uma partida para montar os times pelas presenças.");return;}
    if(matchSource&&draftMode&&mode==="save-draft"){
      if(!separationDraftsEnabled){setToast("Os rascunhos de escalação estão desativados.");return}
      if(!confirm(`Salvar esta proposta como rascunho de ${matchSource.title}? A lista continuará aberta e ninguém será notificado.`))return;
      const snapshot={...result,...config,ratingSystemVersion:2};
      const response=await fetch('/api/admin/separation-drafts',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({matchId:matchSource.id,result:snapshot,manuallyAdjusted:manual})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){setToast(payload.error||'Não foi possível salvar o rascunho.');return}
      setResult(payload.result||result);setLoadedDraft(payload.draft||null);setToast(payload.message||'Rascunho salvo. Você pode continuar ajustando ou publicar a escalação.');return;
    }
    const confirmation = `Deseja fechar a lista de ${matchSource.title}, publicar esta escalação e notificar os jogadores?`;
    if (!confirm(confirmation)) return;
    const snapshot = { ...result, ...config, ratingSystemVersion:2 };
    const response = await fetch("/api/admin/matches", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close", matchId: matchSource.id, result: snapshot, manuallyAdjusted: manual }),
      });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setToast(payload.error || "Não foi possível confirmar a escalação."); if (response.status === 401) await load(); return; }
    setToast(payload.message || "Escalação confirmada e salva.");
    const separationId = payload.separationId || payload.id;
    window.location.assign(separationId ? `/partidas?separation=${encodeURIComponent(separationId)}` : "/partidas");
  }

  async function confirmCareerMatch(separationId:string,blueScore:number,yellowScore:number,contributions:any[]=[]){
    const response=await fetch('/api/career/match',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({separationId,blueScore,yellowScore,contributions})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Não foi possível confirmar o placar.');
    setToast('Partida confirmada e votação aberta.');
    const separations=await load();
    setHistoryDetail((current:any)=>separations.find((separation:any)=>separation.id===current?.id)??current);
  }

  async function editCareerResult(matchId:string,blueScore:number,yellowScore:number,contributions:any[]=[]){
    const response=await fetch('/api/career/match',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({matchId,blueScore,yellowScore,contributions})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Não foi possível atualizar o resultado.');
    const separations=await load();
    setHistoryDetail((current:any)=>separations.find((separation:any)=>separation.id===current?.id)??current);
    setToast(payload.message||'Resultado da partida atualizado.');
  }

  async function saveArrivalOrder(separationId:string,arrivalOrder:{blue:string[];yellow:string[]}){
    const response=await fetch('/api/separations',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:separationId,arrivalOrder})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Não foi possível salvar a ordem de chegada.');
    const separations=await load();
    setHistoryDetail((current:any)=>separations.find((separation:any)=>separation.id===current?.id)??current);
    setToast(payload.message||'Ordem de chegada salva.');
  }

  async function saveSeparationTeams(separationId:string,blue:string[],yellow:string[]){
    const response=await fetch('/api/separations',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'teams',id:separationId,blue,yellow})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Não foi possível atualizar os times.');
    const separations=await load();
    setHistoryDetail((current:any)=>separations.find((separation:any)=>separation.id===current?.id)??current);
    setToast(payload.message||'Times atualizados e indicadores recalculados.');
  }

  async function copyTeams(source = result, withScores = false, titleOverride?: string) {
    const title = titleOverride || source?.matchTitle || matchSource?.title || "PELADA";
    const weights = resultConfig(source);
    const format = (player: Player, index: number) => {const goalkeeper=player.type==="goalkeeper"||player.primaryPosition==="Goleiro";const stats=goalkeeper?`Hab ${player.skill.toFixed(1)} · Pos ${(player.goalkeeperPositioning??player.speed).toFixed(1)} · Saída ${(player.goalExit??player.marking??3).toFixed(1)}`:`Vel ${player.speed.toFixed(1)} · Hab ${player.skill.toFixed(1)} · Mar ${(player.marking??3).toFixed(1)}`;return `${index + 1}. ${player.displayName}${player.id===source.extraId?" (jogador adicional)":""}${withScores ? ` — ${player.primaryPosition} · ${stats}` : ""}`};
    const output = `⚽ ${title}\n\n${teamColorMarker(instanceBrand.teamBlueColor)} TIME ${instanceBrand.teamBlueName.toUpperCase()}\n${source.blue.map(format).join("\n")}\n\n${teamColorMarker(instanceBrand.teamYellowColor)} TIME ${instanceBrand.teamYellowName.toUpperCase()}\n${source.yellow.map(format).join("\n")}\n\n📊 ${source.rating || source.balanceClassification}\nFísico: ${Math.round(weights.speedWeight * 100)}% · Técnica: ${Math.round(weights.skillWeight * 100)}% · Marcação: ${Math.round(weights.markingWeight * 100)}%\nInteligência tática: ${Math.round(weights.tacticalIntelligenceWeight * 100)}% · Competitividade: ${Math.round(weights.competitivenessWeight * 100)}%`;
    await navigator.clipboard.writeText(output);
    setToast("Times copiados com sucesso.");
  }

  if (isAdmin === undefined) return <div className="admin-loading">Carregando escalações…</div>;
  const showPlayer = (player: Player, scoringConfig = config) => { setDetail(player); setDetailConfig(scoringConfig); };
  return <div className="app-shell">
    <SiteHeader active={stage === "players" ? "players" : stage === "history" ? "separations" : "home"} isAdmin={isAdmin}/>
    <main>
      {isAdmin && matchSource && stage === "result" && result && <ResultPresentation result={result} source={matchSource} manuallyAdjusted={manual} draftMode={draftMode} loadedDraft={loadedDraft} onBack={() => window.history.back()} onPlayer={(player:Player)=>showPlayer(player)} onMove={move} onNew={() => generate(true)} onCopy={() => copyTeams(result, true)} onSaveDraft={()=>confirmSeparation("save-draft")} onConfirm={()=>confirmSeparation("publish")} />}
      {stage === "players" && <PublicPlayersView players={publicPlayers} config={publicPlayerConfig} onPlayer={(player:Player)=>showPlayer(player,publicPlayerConfig)} />}
      {stage === "history" && !historyDetail && <section className={`content ${isAdmin?"":"public-history"}`}><div className="section-head"><div><div className="eyebrow">{isAdmin?"MEMÓRIA DA PELADA":"RESULTADOS DA PELADA"}</div><h2>{isAdmin?"Escalações salvas":"Últimas escalações"}</h2><p>{isAdmin?"Clique em uma partida para rever todos os times e indicadores confirmados.":"Consulte os times confirmados, os dados dos jogadores e todas as regras aplicadas em cada escalação."}</p></div>{isAdmin&&<a className="primary" href="/partidas">Gerenciar partidas</a>}</div><div className="history-list">{history.length === 0 ? <div className="empty">Nenhuma escalação confirmada ainda.</div> : history.map((item) => <article key={item.id}><a className="history-open" href={`/separacoes-salvas?separation=${encodeURIComponent(item.id)}`} onClick={event=>{event.preventDefault();openSavedSeparation(item)}}><div className="history-date"><b>{item.matchDate ? new Date(item.matchDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</b><small>{new Date(item.confirmedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div><div className="history-main"><h3>{item.matchTitle}</h3><p><span className="dot blue-dot"></span>{item.snapshot.blue.map((player: Player) => player.displayName).join(", ")}</p><p><span className="dot yellow-dot"></span>{item.snapshot.yellow.map((player: Player) => player.displayName).join(", ")}</p></div></a><div className="history-actions"><span>● {item.balanceClassification}</span><button onClick={() => copyTeams(item.snapshot, false, item.matchTitle)}>Copiar times</button><button onClick={()=>shareSavedSeparation(item)}>{item.career?.recap?"Compartilhar resenha":"Compartilhar link"}</button></div></article>)}</div></section>}
      {stage === "history" && historyDetail && <SavedSeparation key={`${historyDetail.id}:${historyDetail.updatedAt || historyDetail.confirmedAt}`} item={historyDetail} isAdmin={Boolean(isAdmin)} canManageResults={canManageResults} careerConfig={careerConfig} publicBaseUrl={publicBaseUrl} onConfirmCareer={confirmCareerMatch} onEditCareer={editCareerResult} onSaveArrivalOrder={saveArrivalOrder} onSaveTeams={saveSeparationTeams} onBack={closeSavedSeparation} onShareLink={()=>shareSavedSeparation(historyDetail)} onPlayer={(player:Player)=>showPlayer(player,{...resultConfig(historyDetail.snapshot),showContributions:publicPlayerConfig.showContributions,cardTiersEnabled:publicPlayerConfig.cardTiersEnabled,cardBronzeMax:publicPlayerConfig.cardBronzeMax,cardSilverMax:publicPlayerConfig.cardSilverMax,cardGoldMax:publicPlayerConfig.cardGoldMax})} onCopy={(withScores: boolean) => copyTeams(historyDetail.snapshot, withScores, historyDetail.matchTitle)} />}
    </main>
    <footer className="site-footer">
      <div className="footer-signature"><b>⚽ {instanceBrand.siteName}</b><span>{instanceBrand.footerText}</span></div>
      <div className="app-downloads" aria-label={`Aplicativos ${instanceBrand.appName}`}>
        <a className="app-download-badge android" href="/baixar-app?platform=android" aria-label={`Baixar aplicativo ${instanceBrand.appName} para Android`}>
          <span className="app-platform-icon" aria-hidden="true">APK</span>
          <span><small>BAIXE AGORA</small><b>Aplicativo Android</b></span>
          <i aria-hidden="true">↓</i>
        </a>
        <a className="app-download-badge ios" href="/baixar-app?platform=ios" aria-label={`Baixar aplicativo ${instanceBrand.appName} para iOS`}>
          <span className="app-platform-icon" aria-hidden="true">iOS</span>
          <span><small>TESTFLIGHT / APP STORE</small><b>Aplicativo para iOS</b></span>
          <i aria-hidden="true">ABRIR</i>
        </a>
      </div>
    </footer>
    {toast && <div className="toast" onAnimationEnd={() => setToast("")}>{toast}</div>}
    {detail && <PlayerDetail player={detail} config={detailConfig} onClose={() => setDetail(null)} />}
  </div>;
}

function PublicPlayersView({players,config,onPlayer}:{players:Player[];config:any;onPlayer:(player:Player)=>void}) {
  const [query,setQuery]=useState("");
  const filtered=useMemo(()=>players.filter(player=>[player.displayName,player.primaryPosition,playerTypeLabel(player.type)].some(value=>value.toLowerCase().includes(query.trim().toLowerCase()))),[players,query]);
  const goalkeepers=filtered.filter(player=>player.type==="goalkeeper"||player.primaryPosition==="Goleiro");
  const linePlayers=filtered.filter(player=>player.type!=="goalkeeper"&&player.primaryPosition!=="Goleiro");
  return <section className="content public-players"><div className="section-head"><div><div className="eyebrow">ELENCO DA PELADA</div><h2>Jogadores</h2><p>Consulte os atributos e clique em um jogador para abrir seu card completo.</p></div><div className="public-player-total"><b>{players.length}</b><span>jogadores ativos</span></div></div><label className="public-player-search"><span>Buscar jogador</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nome, tipo ou posição…"/></label><PublicPlayerList title="Jogadores de linha" subtitle="Físico, técnica, marcação, inteligência tática e competitividade" players={linePlayers} config={config} onPlayer={onPlayer}/><PublicPlayerList title="Goleiros" subtitle="Defesas, posicionamento, jogo com os pés, segurança e liderança" players={goalkeepers} config={config} onPlayer={onPlayer} goalkeeper/></section>;
}

type PublicPlayerSortKey="name"|"type"|"position"|"primaryRating"|"skill"|"secondaryRating"|"fourthRating"|"fifthRating"|"momentum"|"games"|"overall";
type PublicPlayerSort={key:PublicPlayerSortKey;direction:"asc"|"desc"};

function PublicPlayerList({title,subtitle,players,config,onPlayer,goalkeeper=false}:{title:string;subtitle:string;players:Player[];config:any;onPlayer:(player:Player)=>void;goalkeeper?:boolean}) {
  const [sort,setSort]=useState<PublicPlayerSort>({key:"name",direction:"asc"});
  const headers:{label:string;key:PublicPlayerSortKey}[]=goalkeeper?[{label:"Goleiro",key:"name"},{label:"Defesas",key:"skill"},{label:"Posicionamento",key:"primaryRating"},{label:"Jogo com os pés",key:"secondaryRating"},{label:"Segurança",key:"fourthRating"},{label:"Liderança",key:"fifthRating"},{label:"Momentum",key:"momentum"},{label:"J / V / D",key:"games"},{label:"Overall",key:"overall"}]:[{label:"Jogador",key:"name"},{label:"Tipo",key:"type"},{label:"Posição",key:"position"},{label:"Físico",key:"primaryRating"},{label:"Técnica",key:"skill"},{label:"Marcação",key:"secondaryRating"},{label:"Inteligência tática",key:"fourthRating"},{label:"Competitividade",key:"fifthRating"},{label:"Momentum",key:"momentum"},{label:"J / V / D",key:"games"},{label:"Overall",key:"overall"}];
  const sorted=useMemo(()=>[...players].sort((a,b)=>comparePublicPlayers(a,b,sort,config,goalkeeper)),[players,sort,config,goalkeeper]);
  const toggle=(key:PublicPlayerSortKey)=>setSort(current=>({key,direction:current.key===key&&current.direction==="asc"?"desc":"asc"}));
  return <section className="public-player-section"><div className="public-player-list-title"><div><h3>{title}</h3><p>{subtitle}</p></div><b>{players.length}</b></div><div className="public-player-table" role="table"><div className={`public-player-tr ${goalkeeper?"goalkeeper":"line"} th`} role="row">{headers.map(header=>{const active=sort.key===header.key;return <button type="button" role="columnheader" aria-sort={active?(sort.direction==="asc"?"ascending":"descending"):"none"} className={active?"public-sort-header active":"public-sort-header"} key={header.key} onClick={()=>toggle(header.key)} title={`Ordenar por ${header.label}`}><span>{header.label}</span><i aria-hidden="true">{active?(sort.direction==="asc"?"↑":"↓"):"↕"}</i></button>})}</div>{sorted.length===0?<div className="public-player-empty">Nenhum jogador encontrado nesta lista.</div>:sorted.map(player=>{const career=player.careerStats??{games:0,wins:0,losses:0},overall=score(player,config),tier=playerCardTier(overall,config),tierClass=config.cardTiersEnabled?` tier-row tier-${tier}`:"";return <button className={`public-player-tr ${goalkeeper?"goalkeeper":"line"}${tierClass}`} key={player.id} onClick={()=>onPlayer(player)} aria-label={`Abrir card de ${player.displayName}`}><span className="public-player-identity"><PlayerAvatar player={player}/><b>{player.displayName}<small>{playerTypeLabel(player.type)}</small></b></span>{goalkeeper?<><span>{player.skill.toFixed(1)}</span><span>{(player.goalkeeperPositioning??player.speed).toFixed(1)}</span><span>{(player.goalExit??player.marking??3).toFixed(1)}</span><span>{(player.goalkeeperSafety??3).toFixed(1)}</span><span>{(player.goalkeeperLeadership??3).toFixed(1)}</span></>:<><span>{playerTypeLabel(player.type)}</span><span>{player.primaryPosition}</span><span>{player.speed.toFixed(1)}</span><span>{player.skill.toFixed(1)}</span><span>{(player.marking??3).toFixed(1)}</span><span>{(player.tacticalIntelligence??3).toFixed(1)}</span><span>{(player.competitiveness??3).toFixed(1)}</span></>}<span className={(player.momentum??0)>0?"positive":(player.momentum??0)<0?"negative":""}>{(player.momentum??0)>0?"+":""}{(player.momentum??0).toFixed(1)}</span><span>{career.games} / {career.wins} / {career.losses}</span><strong>{overall.toFixed(1)}</strong></button>})}</div></section>;
}

function comparePublicPlayers(a:Player,b:Player,sort:PublicPlayerSort,config:any,goalkeeper:boolean){
  const value=(player:Player)=>{switch(sort.key){case"name":return player.displayName;case"type":return playerTypeLabel(player.type);case"position":return player.primaryPosition;case"primaryRating":return goalkeeper?(player.goalkeeperPositioning??player.speed):player.speed;case"skill":return player.skill;case"secondaryRating":return goalkeeper?(player.goalExit??player.marking??3):(player.marking??3);case"fourthRating":return goalkeeper?(player.goalkeeperSafety??3):(player.tacticalIntelligence??3);case"fifthRating":return goalkeeper?(player.goalkeeperLeadership??3):(player.competitiveness??3);case"momentum":return player.momentum??0;case"games":return player.careerStats?.games??0;case"overall":return score(player,config)}};
  const aValue=value(a),bValue=value(b);let result=typeof aValue==="number"&&typeof bValue==="number"?aValue-bValue:String(aValue).localeCompare(String(bValue),"pt-BR",{sensitivity:"base",numeric:true});if(result===0)result=a.displayName.localeCompare(b.displayName,"pt-BR",{sensitivity:"base",numeric:true});return sort.direction==="asc"?result:-result;
}

function ResultPresentation({ result, source, manuallyAdjusted, draftMode, loadedDraft, onBack, onPlayer, onMove, onNew, onCopy, onSaveDraft, onConfirm }: any) {
  return <section className="content"><div className="section-head"><div><div className="eyebrow">{draftMode?"RASCUNHO · ":""}{source ? `${source.presentCount} PRESENTES · ` : ""}PROPOSTA {result.proposal}</div><h2>{draftMode?"Planejamento dos times":"Times prontos para o jogo"}</h2><p>{source ? `${source.title} · proposta criada somente com as presenças confirmadas.${draftMode?" Salve para continuar depois ou publique quando os times estiverem definidos.":""}` : manuallyAdjusted ? "Escalação ajustada manualmente" : "O algoritmo comparou milhares de combinações."}</p>{draftMode&&loadedDraft?.updatedAt&&<small className="draft-updated">Rascunho atualizado em {new Date(loadedDraft.updatedAt).toLocaleString('pt-BR')}. A lista permanece aberta.</small>}</div><BalanceBadge rating={result.rating} /></div><TeamGrid result={result} onPlayer={onPlayer} onMove={onMove} /><BalanceMetrics delta={result.delta} /><div className="result-actions">{onBack && <button className="ghost" onClick={onBack}>← Voltar às presenças</button>}<button className="ghost" onClick={onNew}>↻ Gerar nova escalação</button><button className="ghost" onClick={onCopy}>Copiar com pontuações</button>{draftMode&&<button className="ghost" onClick={onSaveDraft}>Salvar rascunho</button>}<button className="primary" onClick={onConfirm}>{draftMode?"Fechar lista e publicar":source ? "Fechar lista e confirmar" : "Confirmar escalação"}</button></div></section>;
}

export function SavedSeparation({ item, isAdmin, canManageResults = isAdmin, section = "all", careerConfig, publicBaseUrl, onConfirmCareer, onEditCareer, onSaveArrivalOrder, onSaveTeams, onBack, onShareLink, onPlayer, onCopy }: any) {
  const result = item.snapshot;
  const weights = resultConfig(result);
  const [editingTeams,setEditingTeams]=useState(false),[teamDraft,setTeamDraft]=useState(result),[teamBusy,setTeamBusy]=useState(false),[teamError,setTeamError]=useState('');
  const moveTeamPlayer=(id:string,from:'blue'|'yellow')=>{setTeamDraft((current:any)=>{if((current[from]||[]).length<=1){setTeamError('Os dois times precisam ter pelo menos um jogador.');return current}const moved=current[from].find((player:Player)=>player.id===id);if(!moved)return current;const blue=from==='blue'?current.blue.filter((player:Player)=>player.id!==id):[...current.blue,moved],yellow=from==='yellow'?current.yellow.filter((player:Player)=>player.id!==id):[...current.yellow,moved];setTeamError('');return{...current,blue,yellow,...recalculateTeamBalance(blue,yellow,resultConfig(current))}})};
  const saveTeams=async()=>{if(!confirm('Salvar esta nova distribuição? A ordem de chegada e um eventual rascunho de súmula serão limpos para evitar inconsistências.'))return;setTeamBusy(true);setTeamError('');try{await onSaveTeams(item.id,teamDraft.blue.map((player:Player)=>player.id),teamDraft.yellow.map((player:Player)=>player.id));setEditingTeams(false)}catch(error:any){setTeamError(error.message)}finally{setTeamBusy(false)}};
  const arrivalOrder=item.arrivalOrder&&typeof item.arrivalOrder==='object'?item.arrivalOrder:null,orderPlayers=(players:Player[],ids:string[]|undefined)=>{if(!ids?.length)return players;const index=new Map<string,number>(ids.map((id:string,position:number)=>[id,position] as [string,number]));return [...players].sort((a,b)=>(index.get(a.id)??999)-(index.get(b.id)??999))},orderedBlue=orderPlayers(result.blue||[],arrivalOrder?.blue),orderedYellow=orderPlayers(result.yellow||[],arrivalOrder?.yellow),orderedResult={...result,blue:orderedBlue,yellow:orderedYellow,...recalculateTeamBalance(orderedBlue,orderedYellow,resultConfig(result))};
  const displayedResult=editingTeams?teamDraft:orderedResult;
  if (section === "result") return <CareerMatchCard item={item} isAdmin={canManageResults} section="result" enabled={careerConfig?.enabled!==false} trackContributions={careerConfig?.trackContributions!==false} publicBaseUrl={publicBaseUrl} onConfirm={onConfirmCareer} onEdit={onEditCareer}/>;
  return <section className="content saved-detail"><div className="section-head"><div><div className="eyebrow">ESCALAÇÃO CONFIRMADA</div><h2>{item.matchTitle}</h2><p>{item.matchDate ? new Date(item.matchDate + "T12:00:00").toLocaleDateString("pt-BR") : "Data não informada"} · confirmada em {new Date(item.confirmedAt).toLocaleString("pt-BR")}{item.manuallyAdjusted ? " · ajustada manualmente" : ""}</p></div><BalanceBadge rating={result.rating || item.balanceClassification} /></div>{section==="all"&&item.career?.recap&&<RoundRecapCard recap={item.career.recap} onShare={onShareLink}/>} {section==="all"&&(item.career||canManageResults)&&<CareerMatchCard item={item} isAdmin={canManageResults} enabled={careerConfig?.enabled!==false} trackContributions={careerConfig?.trackContributions!==false} publicBaseUrl={publicBaseUrl} onConfirm={onConfirmCareer} onEdit={onEditCareer}/>} {isAdmin&&!item.career&&<section className={`saved-team-editor ${editingTeams?'editing':''}`}><div><small>AJUSTE ANTES DO RESULTADO</small><h3>Distribuição dos jogadores</h3><p>{editingTeams?'Use as setas nos jogadores para transferi-los ao outro time.':'Se alguém atrasar ou um time ficar desfalcado, ajuste os times antes de confirmar o resultado.'}</p></div>{editingTeams?<div className="saved-team-editor-actions"><button className="ghost" disabled={teamBusy} onClick={()=>{setTeamDraft(result);setEditingTeams(false);setTeamError('')}}>Cancelar</button><button className="primary" disabled={teamBusy} onClick={saveTeams}>{teamBusy?'Salvando…':'Salvar novos times'}</button></div>:<button className="ghost" onClick={()=>setEditingTeams(true)}>Editar times</button>}{teamError&&<div className="alert error">{teamError}</div>}</section>} {!editingTeams&&<ArrivalOrder item={item} isAdmin={isAdmin} onSave={onSaveArrivalOrder}/>}<TeamGrid result={displayedResult} onPlayer={onPlayer} onMove={editingTeams?moveTeamPlayer:undefined}/><BalanceMetrics delta={displayedResult.delta} /><div className="saved-meta"><span><small>Proposta utilizada</small><b>{result.proposal || 1}</b></span><span><small>Peso da velocidade</small><b>{Math.round(weights.speedWeight * 100)}%</b></span><span><small>Peso da habilidade</small><b>{Math.round(weights.skillWeight * 100)}%</b></span><span><small>Peso da marcação</small><b>{Math.round(weights.markingWeight * 100)}%</b></span><span><small>Diferença máx. por posição</small><b>{result.maximumPositionDifference??"Não registrado"}</b></span><span><small>Melhores protegidos</small><b>{result.protectedTopPlayersPercentage==null?"Não registrado":`${Math.round(result.protectedTopPlayersPercentage*100)}%`}</b></span><span><small>Tentativas avaliadas</small><b>{result.algorithmAttempts ?? "Não registrado"}</b></span><span><small>Ajuste manual</small><b>{item.manuallyAdjusted ? "Sim" : "Não"}</b></span></div><div className="result-actions"><button className="ghost" onClick={onBack}>← Voltar ao histórico</button><button className="ghost" onClick={onShareLink}>{item.career?.recap?"Compartilhar resenha":"Compartilhar link da escalação"}</button><button className="ghost" onClick={() => onCopy(false)}>Copiar times</button><button className="primary" onClick={() => onCopy(true)}>Copiar com pontuações</button></div></section>;
}

function RoundRecapCard({recap,onShare}:any){
  const stories=(recap.stories?.length?recap.stories:(recap.highlights||[]).map((text:string)=>({kind:'highlight',label:'Destaque da rodada',text,icon:'•'}))).filter((story:any)=>story.kind!=='record'&&story.kind!=='achievement');
  const records=recap.records||[],milestones=recap.milestones||[],result=recap.result,date=recap.date?new Date(`${String(recap.date).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}):'Edição especial';
  return <section className="round-recap newspaper-recap">
    <div className="newspaper-masthead"><div><span>DESDE O PRIMEIRO APITO</span><h2>A Gazeta da Pelada</h2><small>{date} · RESULTADO OFICIAL</small></div><i aria-hidden="true">⚽</i></div>
    <div className="newspaper-front"><div><span className="newspaper-kicker">RESENHA DA RODADA</span><h3>{String(recap.title||'Resenha').replace(/^Resenha da rodada · /,'')}</h3><p>{recap.deck||'Os fatos e destaques registrados oficialmente nesta partida.'}</p></div>{result?<div className="newspaper-score" aria-label={`Placar ${result.blueScore} a ${result.yellowScore}`}><span><small>{result.winnerTeam==='BLUE'?'VENCEDOR':'TIME AZUL'}</small><b>{result.blueScore}</b></span><i>×</i><span><small>{result.winnerTeam==='YELLOW'?'VENCEDOR':'TIME AMARELO'}</small><b>{result.yellowScore}</b></span></div>:<strong className="newspaper-headline">{recap.headline}</strong>}</div>
    <div className="newspaper-rule"><span>{recap.headline}</span></div>
    <div className="newspaper-columns"><section><h4>Destaques do jogo</h4>{stories.length?<div className="newspaper-stories">{stories.map((story:any,index:number)=><article key={`${story.kind}-${index}`}><i aria-hidden="true">{story.icon}</i><div><small>{story.label}</small><p>{story.text}</p></div></article>)}</div>:<p className="newspaper-empty">O placar foi registrado, mas a súmula ainda não possui destaques individuais.</p>}</section><aside><h4>Recordes e marcas</h4>{records.map((record:string,index:number)=><p className="newspaper-record" key={`record-${index}`}><span>📈</span>{record}</p>)}{milestones.slice(0,4).map((milestone:any,index:number)=><p className="newspaper-record" key={`${milestone.id}-${index}`}><span>{milestone.icon||'🏆'}</span><b>{milestone.title}</b>{milestone.description}</p>)}{!records.length&&!milestones.length?<p className="newspaper-empty">Nenhum recorde foi quebrado nesta rodada. O livro da pelada continua aberto para a próxima partida.</p>:null}</aside></div>
    <div className="newspaper-footer"><p><b>Leve a notícia para o grupo.</b><span>O texto compartilhado inclui o placar, os destaques e o link desta partida.</span></p><button className="primary whatsapp-button" type="button" onClick={onShare}><WhatsAppIcon/>Compartilhar resenha no WhatsApp</button></div>
  </section>;
}

function ArrivalOrder({item,isAdmin,onSave}:any){
 const {config:brand}=useInstanceBranding(),blueName=brand.teamBlueName,yellowName=brand.teamYellowName;
  const bluePlayers:Player[]=item.snapshot.blue||[],yellowPlayers:Player[]=item.snapshot.yellow||[],saved=item.arrivalOrder&&typeof item.arrivalOrder==='object'&&!Array.isArray(item.arrivalOrder)?item.arrivalOrder:null,initialBlue=saved?.blue||bluePlayers.map(player=>player.id),initialYellow=saved?.yellow||yellowPlayers.map(player=>player.id),[blueOrder,setBlueOrder]=useState<string[]>(initialBlue),[yellowOrder,setYellowOrder]=useState<string[]>(initialYellow),[editing,setEditing]=useState(!saved),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setBlueOrder(saved?.blue||bluePlayers.map(player=>player.id));setYellowOrder(saved?.yellow||yellowPlayers.map(player=>player.id));setEditing(!saved)},[item.id,JSON.stringify(saved)]);
  if(!isAdmin&&!saved)return null;
  const dirty=!saved||blueOrder.join('|')!==(saved.blue||[]).join('|')||yellowOrder.join('|')!==(saved.yellow||[]).join('|');
  const move=(setter:any,index:number,direction:-1|1)=>setter((current:string[])=>{const target=index+direction;if(target<0||target>=current.length)return current;const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next});
  const save=async()=>{setBusy(true);setError('');try{await onSave(item.id,{blue:blueOrder,yellow:yellowOrder});setEditing(false)}catch(error:any){setError(error.message)}finally{setBusy(false)}};
  const cancel=()=>{setBlueOrder(saved?.blue||bluePlayers.map(player=>player.id));setYellowOrder(saved?.yellow||yellowPlayers.map(player=>player.id));setError('');setEditing(!saved)};
  const actions=isAdmin?(editing?<div className="arrival-order-actions"><button className="ghost" onClick={cancel} disabled={busy}>Cancelar</button><button className="primary" onClick={save} disabled={busy||!dirty}>{busy?'Salvando…':saved?'Salvar novamente':'Confirmar ordens'}</button></div>:<button className="ghost arrival-edit" onClick={()=>setEditing(true)}>Editar ordens</button>):null;
  return <section className={`arrival-order-card ${editing?'editing':'confirmed'}`}><div className="arrival-order-head"><div><small>CHEGADA AO CAMPO</small><h3>Ordem de chegada por equipe</h3><p>{saved?(editing?'Faça os ajustes necessários e salve novamente.':'Ordens confirmadas. Use “Editar ordens” caso seja necessário corrigir.'):'Ajuste as duas equipes e salve para registrar as ordens de chegada.'}</p></div>{actions}</div><div className="arrival-team-orders"><ArrivalTeamList color="blue" title={`Time ${blueName}`} order={blueOrder} players={bluePlayers} isAdmin={isAdmin&&editing} onMove={(index:number,direction:-1|1)=>move(setBlueOrder,index,direction)}/><ArrivalTeamList color="yellow" title={`Time ${yellowName}`} order={yellowOrder} players={yellowPlayers} isAdmin={isAdmin&&editing} onMove={(index:number,direction:-1|1)=>move(setYellowOrder,index,direction)}/></div>{error&&<div className="alert error">{error}</div>}</section>
}

function ArrivalTeamList({color,title,order,players,isAdmin,onMove}:any){const byId=Object.fromEntries(players.map((player:Player)=>[player.id,player]));return <section className={`arrival-team-list ${color}`}><h4><i></i>{title}<span>{order.length} jogadores</span></h4><ol>{order.map((id:string,index:number)=>{const player=byId[id];if(!player)return null;return <li key={id}><b>{index+1}</b><PlayerPhoto photoUrl={player.photoUrl} name={player.displayName}/><span><strong>{player.displayName}</strong></span>{isAdmin&&<div><button onClick={()=>onMove(index,-1)} disabled={index===0} aria-label={`Mover ${player.displayName} para cima`}>↑</button><button onClick={()=>onMove(index,1)} disabled={index===order.length-1} aria-label={`Mover ${player.displayName} para baixo`}>↓</button></div>}</li>})}</ol></section>}

function CareerMatchCard({item,isAdmin,section="all",enabled,trackContributions,publicBaseUrl,onConfirm,onEdit}:any){
 const {config:brand}=useInstanceBranding(),blueName=brand.teamBlueName,yellowName=brand.teamYellowName;
  const career=item.career;
  const [blueScore,setBlueScore]=useState(0),[yellowScore,setYellowScore]=useState(0),[contributions,setContributions]=useState<any[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[qr,setQr]=useState(''),[editingResult,setEditingResult]=useState(false),[savedDraft,setSavedDraft]=useState<any>(null);
  const bluePlayers=item.snapshot.blue||[],yellowPlayers=item.snapshot.yellow||[];
  const votingUrl=career&&publicBaseUrl?buildVotingUrl(publicBaseUrl,career.votingToken):'';
  useEffect(()=>{if(votingUrl)QRCode.toDataURL(votingUrl,{width:220,margin:1,color:{dark:'#143f31',light:'#ffffff'}}).then(setQr).catch(()=>setQr(''))},[votingUrl]);
  useEffect(()=>{if(career||!isAdmin||!enabled||!trackContributions)return;fetch(`/api/career/draft?separationId=${encodeURIComponent(item.id)}`,{cache:'no-store'}).then(async response=>{const payload=await response.json();if(response.ok)setSavedDraft(payload.draft)}).catch(()=>undefined)},[item.id,career,isAdmin,enabled,trackContributions]);
  useEffect(()=>{if(!trackContributions){setContributions([]);return}setContributions(current=>{const next:any[]=[];for(const [team,count] of [['BLUE',blueScore],['YELLOW',yellowScore]] as const){const existing=current.filter(goal=>goal.team===team);for(let index=0;index<count;index++)next.push(existing[index]||{team,scorerPlayerId:'',assistPlayerId:'',ownGoal:false})}return next})},[blueScore,yellowScore,trackContributions]);
  const setContribution=(index:number,key:string,value:any)=>setContributions(current=>current.map((goal,goalIndex)=>{if(goalIndex!==index)return goal;if(key==='ownGoal')return {...goal,ownGoal:Boolean(value),scorerPlayerId:'',assistPlayerId:''};return {...goal,[key]:value,...(key==='scorerPlayerId'&&goal.assistPlayerId===value?{assistPlayerId:''}:{})}}));
  async function submit(event:any){event.preventDefault();if(!confirm(`Confirmar o placar ${blueScore} × ${yellowScore}? O momentum${trackContributions?' e as estatísticas de gols e assistências':''} será aplicado imediatamente.`))return;setBusy(true);setError('');try{await onConfirm(item.id,blueScore,yellowScore,contributions)}catch(error:any){setError(error.message)}finally{setBusy(false)}}
  async function copy(){await navigator.clipboard.writeText(votingUrl)}
  function whatsapp(){const message=buildWhatsAppVotingMessage({matchTitle:item.matchTitle,votingUrl,closesAt:career.closesAt,siteName:brand.siteName});window.open(buildWhatsAppShareUrl(message),'_blank','noopener,noreferrer')}
  function shareVotingResults(){const players=[...bluePlayers,...yellowPlayers],names=Object.fromEntries(players.map((player:Player)=>[player.id,player.displayName])),separationUrl=`${String(publicBaseUrl||window.location.origin).replace(/\/$/,"")}/?separation=${encodeURIComponent(item.id)}`,message=buildWhatsAppCareerResultsMessage({matchTitle:item.matchTitle,blueScore:career.blueScore,yellowScore:career.yellowScore,results:career.results,names,separationUrl,siteName:brand.siteName,teamBlueName:blueName,teamYellowName:yellowName});window.open(buildWhatsAppShareUrl(message),'_blank','noopener,noreferrer')}
  function applySavedDraft(){if(!savedDraft)return;setBlueScore(Number(savedDraft.blueScore||0));setYellowScore(Number(savedDraft.yellowScore||0));setContributions((savedDraft.contributions||[]).map((goal:any)=>({...goal,assistPlayerId:goal.assistPlayerId||''})));setError('')}
  function beginEdit(){
    setBlueScore(Number(career.blueScore));
    setYellowScore(Number(career.yellowScore));
    setContributions((career.contributions||[]).map((goal:any)=>({team:goal.team,scorerPlayerId:goal.scorerPlayerId,assistPlayerId:goal.assistPlayerId||'',ownGoal:Boolean(goal.ownGoal)})));
    setError('');
    setEditingResult(true);
  }
  async function submitEdit(event:any){
    event.preventDefault();
    if(!confirm(`Salvar a correção do placar para ${blueScore} × ${yellowScore}? O momentum das equipes será recalculado pela diferença, sem duplicar bônus ou ônus.`))return;
    setBusy(true);setError('');
    try{await onEdit(career.id,blueScore,yellowScore,contributions);setEditingResult(false)}catch(error:any){setError(error.message)}finally{setBusy(false)}
  }
  if(!career)return <section className={`career-match-card pending ${trackContributions?'with-contributions':''}`}><div><small>MODO CARREIRA</small><h3>Este jogo foi realizado?</h3><p>Confirme o placar para aplicar o momentum das equipes e abrir a votação dos destaques.{trackContributions?' Informe também o autor de cada gol e, quando houver, da assistência.':''}</p>{isAdmin&&enabled&&trackContributions&&<div className="match-draft-actions"><a className="ghost" href={`/sumula?separationId=${encodeURIComponent(item.id)}`}>Abrir rascunho da súmula ↗</a>{savedDraft?.contributions?.length>0&&<button className="ghost" type="button" onClick={applySavedDraft}>Usar rascunho ({savedDraft.blueScore} × {savedDraft.yellowScore})</button>}{savedDraft?.updatedAt&&<small>Atualizado em {new Date(savedDraft.updatedAt).toLocaleString('pt-BR')}</small>}</div>}</div>{isAdmin?(enabled?<form className="career-confirm-form" onSubmit={submit}><div className="career-score-inputs"><label>{`Time ${blueName}`}<input type="number" min="0" max="99" value={blueScore} onChange={e=>setBlueScore(Number(e.target.value))}/></label><b>×</b><label>{`Time ${yellowName}`}<input type="number" min="0" max="99" value={yellowScore} onChange={e=>setYellowScore(Number(e.target.value))}/></label></div>{trackContributions&&contributions.length>0&&<div className="contribution-editor"><div className="contribution-head"><b>Gols e assistências</b><small>Assistência é opcional; marque GC quando o gol tiver sido contra.</small></div>{contributions.map((goal,index)=>{const teamPlayers=goal.team==='BLUE'?bluePlayers:yellowPlayers,opponentPlayers=goal.team==='BLUE'?yellowPlayers:bluePlayers,scorerPlayers=goal.ownGoal?opponentPlayers:teamPlayers,teamNumber=contributions.slice(0,index+1).filter(item=>item.team===goal.team).length;return <div className={`contribution-row ${goal.team.toLowerCase()} ${goal.ownGoal?'own-goal':''}`} key={`${goal.team}-${teamNumber}`}><strong>{goal.team==='BLUE'?'🔵':'🟡'} Gol {teamNumber}{goal.ownGoal&&<em>GC</em>}</strong><label className="own-goal-check"><input type="checkbox" checked={Boolean(goal.ownGoal)} onChange={event=>setContribution(index,'ownGoal',event.target.checked)}/> GC (Gol Contra)</label><label>{goal.ownGoal?'Jogador que marcou contra':'Autor'}<select value={goal.scorerPlayerId} onChange={event=>setContribution(index,'scorerPlayerId',event.target.value)} required><option value="">Selecione</option>{scorerPlayers.map((player:Player)=><option value={player.id} key={player.id}>{player.displayName}</option>)}</select></label><label>Assistência<select value={goal.assistPlayerId} onChange={event=>setContribution(index,'assistPlayerId',event.target.value)} disabled={goal.ownGoal}><option value="">{goal.ownGoal?'Não se aplica':'Sem assistência'}</option>{!goal.ownGoal&&teamPlayers.filter((player:Player)=>player.id!==goal.scorerPlayerId).map((player:Player)=><option value={player.id} key={player.id}>{player.displayName}</option>)}</select></label></div>})}</div>}<button className="primary" disabled={busy}>{busy?'Confirmando…':'Confirmar partida'}</button>{error&&<span className="career-error">{error}</span>}</form>:<div className="alert">O Modo Carreira está desativado nas configurações administrativas.</div>):null}</section>;
  if(editingResult)return <CareerResultEditor blueScore={blueScore} yellowScore={yellowScore} setBlueScore={setBlueScore} setYellowScore={setYellowScore} contributions={contributions} setContribution={setContribution} bluePlayers={bluePlayers} yellowPlayers={yellowPlayers} trackContributions={trackContributions} busy={busy} error={error} onSubmit={submitEdit} onCancel={()=>{setEditingResult(false);setError('')}}/>;
  const winner=career.winnerTeam==='BLUE'?`Time ${blueName}`:career.winnerTeam==='YELLOW'?`Time ${yellowName}`:'Empate',rules=career.config;
  return <section className="career-match-card confirmed"><div className="career-score">{isAdmin&&<button className="ghost career-edit-result" onClick={beginEdit}>Editar resultado</button>}<small>PLACAR CONFIRMADO</small><strong><span className="blue">{blueName} <b>{career.blueScore}</b></span><i>×</i><span className="yellow"><b>{career.yellowScore}</b> {yellowName}</span></strong><em>{winner}</em>{rules&&<p className="career-rules">Votos {Number(rules.momentumMultiplier??1).toFixed(1)}× · vitória {signed(rules.winnerBonus)} · derrota {signed(rules.loserPenalty)} · votação por {rules.votingDays} dias</p>}</div>{trackContributions&&career.contributions?.length>0&&<CareerContributions contributions={career.contributions}/>}{section!=="result"&&<><div className="career-voting-share"><div><small>{career.status==='OPEN'?'VOTAÇÃO ABERTA':'VOTAÇÃO ENCERRADA'}</small><h3>Destaques da partida</h3><p>{career.status==='OPEN'?`Votos aceitos até ${new Date(career.closesAt).toLocaleString('pt-BR')}.`:'Resultado final consolidado; os votos não podem mais ser alterados.'}</p>{career.status==='OPEN'&&<div className="career-link-actions"><button className="ghost" onClick={copy}>Copiar link</button><button className="primary whatsapp-button" onClick={whatsapp}><WhatsAppIcon/>Compartilhar no WhatsApp</button></div>}</div>{career.status==='OPEN'&&qr&&<a href={votingUrl} target="_blank" rel="noreferrer"><img src={qr} alt="QR Code para votação da partida"/><span>Abrir votação</span></a>}</div>{career.status==='CLOSED'&&<CareerPublicResults results={career.results} players={[...item.snapshot.blue,...item.snapshot.yellow]} onShare={enabled?shareVotingResults:null}/>}</>}</section>
}
function CareerResultEditor({blueScore,yellowScore,setBlueScore,setYellowScore,contributions,setContribution,bluePlayers,yellowPlayers,trackContributions,busy,error,onSubmit,onCancel}:any){
  const {config:brand}=useInstanceBranding(),blueName=brand.teamBlueName,yellowName=brand.teamYellowName;
  return <section className="career-match-card career-result-editor">
    <div className="career-result-editor-head">
      <div><small>CORREÇÃO ADMINISTRATIVA</small><h3>Editar resultado da partida</h3><p>Corrija o placar e, quando habilitado, os autores dos gols e assistências. A votação existente não será alterada.</p></div>
    </div>
    <form className="career-confirm-form" onSubmit={onSubmit}>
      <div className="career-score-inputs"><label>{`Time ${blueName}`}<input type="number" min="0" max="99" value={blueScore} onChange={event=>setBlueScore(Number(event.target.value))}/></label><b>×</b><label>{`Time ${yellowName}`}<input type="number" min="0" max="99" value={yellowScore} onChange={event=>setYellowScore(Number(event.target.value))}/></label></div>
      {trackContributions&&contributions.length>0&&<div className="contribution-editor"><div className="contribution-head"><b>Gols e assistências</b><small>A quantidade de registros acompanha o placar. Assistência é opcional; marque GC para gol contra.</small></div>{contributions.map((goal:any,index:number)=>{const teamPlayers=goal.team==='BLUE'?bluePlayers:yellowPlayers,opponentPlayers=goal.team==='BLUE'?yellowPlayers:bluePlayers,scorerPlayers=goal.ownGoal?opponentPlayers:teamPlayers,teamNumber=contributions.slice(0,index+1).filter((item:any)=>item.team===goal.team).length;return <div className={`contribution-row ${goal.team.toLowerCase()} ${goal.ownGoal?'own-goal':''}`} key={`${goal.team}-${teamNumber}`}><strong>{goal.team==='BLUE'?'🔵':'🟡'} Gol {teamNumber}{goal.ownGoal&&<em>GC</em>}</strong><label className="own-goal-check"><input type="checkbox" checked={Boolean(goal.ownGoal)} onChange={event=>setContribution(index,'ownGoal',event.target.checked)}/> GC (Gol Contra)</label><label>{goal.ownGoal?'Jogador que marcou contra':'Autor'}<select value={goal.scorerPlayerId} onChange={event=>setContribution(index,'scorerPlayerId',event.target.value)} required><option value="">Selecione</option>{scorerPlayers.map((player:Player)=><option value={player.id} key={player.id}>{player.displayName}</option>)}</select></label><label>Assistência<select value={goal.assistPlayerId} onChange={event=>setContribution(index,'assistPlayerId',event.target.value)} disabled={goal.ownGoal}><option value="">{goal.ownGoal?'Não se aplica':'Sem assistência'}</option>{!goal.ownGoal&&teamPlayers.filter((player:Player)=>player.id!==goal.scorerPlayerId).map((player:Player)=><option value={player.id} key={player.id}>{player.displayName}</option>)}</select></label></div>})}</div>}
      <div className="career-result-edit-actions"><button className="ghost" type="button" onClick={onCancel} disabled={busy}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar correções'}</button></div>
      {error&&<span className="career-error">{error}</span>}
    </form>
  </section>
}
function signed(value:number){return `${value>0?'+':''}${Number(value).toFixed(1)}`}
function CareerContributions({contributions}:any){const {config:brand}=useInstanceBranding(),blueName=brand.teamBlueName,yellowName=brand.teamYellowName;return <div className="career-contribution-summary"><h4>Gols da partida</h4><div>{contributions.map((goal:any,index:number)=><span className={`goal-${String(goal.team).toLowerCase()} ${goal.ownGoal?'own-goal':''}`} key={`${goal.team}-${index}`}><i>{goal.team==='BLUE'?'Time '+blueName:'Time '+yellowName}</i>{goal.ownGoal?<><b>GC</b><strong>{goal.scorerName}</strong></>:<><strong>{goal.scorerName}</strong>{goal.assistName?<small><em>Assistência</em>{goal.assistName}</small>:<small className="no-assist">Sem assistência</small>}</>}</span>)}</div></div>}
function CareerPublicResults({results,players,onShare}:any){const names=Object.fromEntries(players.map((player:any)=>[player.id,player.displayName])),podium=(title:string,entries:any[])=><div><h4>{title}</h4>{entries.map(entry=><span key={entry.playerId}><b>{entry.place}º</b><em>{names[entry.playerId]||'Jogador'}</em><strong>{entry.momentum>0?'+':''}{Number(entry.momentum).toFixed(1)}</strong></span>)}</div>;return <div className={`career-public-results ${!results?.voteCount?'no-votes':''}`}><header className="career-results-share"><div><h4>Resultado final da votação</h4><p>{results?.voteCount?`${results.voteCount} voto${results.voteCount===1?'':'s'} contabilizado${results.voteCount===1?'':'s'}.`:'A votação foi encerrada sem votos válidos.'}</p></div>{onShare&&<button className="primary whatsapp-button" onClick={onShare}><WhatsAppIcon/><span>Compartilhar resultado no WhatsApp</span></button>}</header>{results?.voteCount&&<>{podium('Man of the Match',results.motm||[])}{podium('Deception of the Match',results.dotm||[])}</>}</div>}

export function resultConfig(result: any) {
  const legacySnapshot = result?.markingWeight == null && result?.speedWeight != null && result?.skillWeight != null;
  const expanded=result?.ratingSystemVersion===2||result?.tacticalIntelligenceWeight!=null;
  if(!expanded)return {speedWeight:result?.speedWeight??.6,skillWeight:result?.skillWeight??.4,markingWeight:result?.markingWeight??(legacySnapshot?0:.2),ratingSystemVersion:1,resultMomentumMultiplier:result?.resultMomentumMultiplier??1,momentumMultiplier:result?.momentumMultiplier??1,maximumPositionDifference:result?.maximumPositionDifference??1,protectedTopPlayersPercentage:result?.protectedTopPlayersPercentage??.25,algorithmAttempts:result?.algorithmAttempts??2500};
  return { ...defaultConfig, ...result, ratingSystemVersion:2 };
}

function TeamGrid({ result, onPlayer, onMove }: any) {
  const { config: brand } = useInstanceBranding(), blueName = brand.teamBlueName, yellowName = brand.teamYellowName;
  const scoringConfig = resultConfig(result);
  return <div className="teams"><Team color="blue" title={`Time ${blueName}`} players={result.blue} metrics={result.blueMetrics} baseMetrics={result.blueBaseMetrics} extraId={result.extraId} scoringConfig={scoringConfig} onPlayer={onPlayer} onMove={onMove ? (id: string) => onMove(id, "blue") : undefined} /><Team color="yellow" title={`Time ${yellowName}`} players={result.yellow} metrics={result.yellowMetrics} baseMetrics={result.yellowBaseMetrics} extraId={result.extraId} scoringConfig={scoringConfig} onPlayer={onPlayer} onMove={onMove ? (id: string) => onMove(id, "yellow") : undefined} /></div>;
}

function BalanceBadge({ rating }: { rating: string }) { return <div className={`balance ${rating?.startsWith("Excelente") ? "great" : ""}`}><span>●</span><div><small>INDICADOR</small><b>{rating}</b></div></div>; }
function BalanceMetrics({ delta, extraId }: any) {
  const {config:brand}=useInstanceBranding(),blueName=brand.teamBlueName,yellowName=brand.teamYellowName,usesBaseTeams=Boolean(extraId||delta?.baseTeams),side=(key:string,value:any)=>Number(value)===0?'EVEN':delta?.advantage?.[key];
  return <div className="metrics"><h3>Diferenças entre os times</h3>{usesBaseTeams&&<p className="base-team-note">Os atributos e a pontuação comparam times-base do mesmo tamanho. O jogador adicional aparece separado.</p>}<div><Metric label="Jogadores" value={delta?.players ?? 0} side={side('players',delta?.players)} blueName={blueName} yellowName={yellowName}/><Metric label="Defensores" value={delta?.defenders ?? 0} side={side('defenders',delta?.defenders)} blueName={blueName} yellowName={yellowName}/><Metric label="Meio-campistas" value={delta?.midfielders ?? 0} side={side('midfielders',delta?.midfielders)} blueName={blueName} yellowName={yellowName}/><Metric label="Atacantes" value={delta?.attackers ?? 0} side={side('attackers',delta?.attackers)} blueName={blueName} yellowName={yellowName}/><Metric label="Físico / Pos." value={(delta?.speed ?? 0).toFixed(1)} side={side('speed',(delta?.speed??0).toFixed(1))} blueName={blueName} yellowName={yellowName}/><Metric label="Técnica / Def." value={(delta?.skill ?? 0).toFixed(1)} side={side('skill',(delta?.skill??0).toFixed(1))} blueName={blueName} yellowName={yellowName}/><Metric label="Marcação / Pés" value={(delta?.marking ?? 0).toFixed(1)} side={side('marking',(delta?.marking??0).toFixed(1))} blueName={blueName} yellowName={yellowName}/><Metric label="Tática / Segurança" value={(delta?.tacticalIntelligence ?? 0).toFixed(1)} side={side('tacticalIntelligence',(delta?.tacticalIntelligence??0).toFixed(1))} blueName={blueName} yellowName={yellowName}/><Metric label="Comp. / Liderança" value={(delta?.competitiveness ?? 0).toFixed(1)} side={side('competitiveness',(delta?.competitiveness??0).toFixed(1))} blueName={blueName} yellowName={yellowName}/><Metric label="Momentum" value={(delta?.momentum ?? 0).toFixed(1)} side={side('momentum',(delta?.momentum??0).toFixed(1))} blueName={blueName} yellowName={yellowName} help="Diferença entre os saldos de momentum de resultados e votações usados no overall dos jogadores."/>{delta?.historicalLearning!=null&&<Metric label="Histórico observado" value={Number(delta.historicalLearning).toFixed(2)} side={side('historicalLearning',Number(delta.historicalLearning).toFixed(2))} blueName={blueName} yellowName={yellowName} help="Diferença do ajuste histórico interno que considera resultados, saldo de gols, gols, assistências, avaliações e desempenho recente. Esse índice não altera o OVR exibido."/>}<Metric label="Pontuação" value={(delta?.score ?? 0).toFixed(2)} side={side('score',(delta?.score??0).toFixed(2))} blueName={blueName} yellowName={yellowName} help={usesBaseTeams?"Diferença entre as somas dos overalls dos dois times-base, sem o jogador adicional.":"Diferença entre as somas dos overalls dos dois times. Quanto mais próximo de zero, mais equilibradas estão as pontuações."}/></div></div>;
}

function Team({ color, title, players, metrics, baseMetrics, extraId, scoringConfig, onPlayer, onMove }: any) { const averageMetrics=baseMetrics||metrics;return <article className={`team ${color}`}><div className="team-head"><div><span className="shirt" aria-hidden="true"></span><h3>{title}</h3></div><b>{players.length} jogadores</b></div><div className="team-summary"><span>DEF <b>{metrics?.positions.Defesa || 0}</b></span><span>MEI <b>{metrics?.positions["Meio-campo"] || 0}</b></span><span>ATA <b>{metrics?.positions.Ataque || 0}</b></span><span>{baseMetrics?'MÉDIA BASE':'MÉDIA'} <b>{averageMetrics?.scoreAvg?.toFixed(2) || "—"}</b></span></div>{players.map((player: Player) => <div className={player.id===extraId?'team-player additional':'team-player'} key={player.id}><button onClick={() => onPlayer(player)}><PlayerAvatar player={player} /><div><b>{player.displayName}</b><small>{player.primaryPosition}{player.secondaryPosition?` / ${player.secondaryPosition}`:""}{player.id === extraId ? " · Jogador adicional" : ""}</small></div></button><span>{score(player, scoringConfig).toFixed(1)}</span>{onMove && <button className="swap" title="Mover para o outro time" onClick={() => onMove(player.id)}>⇄</button>}</div>)}</article>; }

function PlayerAvatar({ player, name }: { player?: Player; name?: string }) { const label = player?.displayName || name || "Jogador"; return <PlayerPhoto photoUrl={player?.photoUrl} name={label} />; }

function CardDisciplineHelp({id,label,text}:{id:string;label:string;text:string}){
  return <span className="help-tip card-stat-help"><button type="button" aria-label={`Ver explicação de ${label}`} aria-describedby={id}>?</button><span id={id} role="tooltip">{text}</span></span>;
}

export function PlayerDetail({ player, config, onClose }: any) {
  const type=playerTypeLabel(player.type);
  const goalkeeper=player.type==="goalkeeper"||player.primaryPosition==="Goleiro";
  const overall=score(player,config),tier=playerCardTier(overall,config ?? false);
  const stats=goalkeeper?[{label:"DEFESAS",value:player.skill,help:"Reflexo, tempo de reação, defesas à queima-roupa e consistência."},{label:"POSICIONAMENTO",value:player.goalkeeperPositioning??player.speed??3,help:"Leitura da jogada, colocação no gol, saída do gol e cobertura de ângulos."},{label:"JOGO COM OS PÉS",value:player.goalExit??player.marking??3,help:"Qualidade na reposição, passes curtos e lançamentos, participação na saída de bola."},{label:"SEGURANÇA",value:player.goalkeeperSafety??3,help:"Firmeza nas defesas, retenção da bola, saídas em cruzamentos e baixo índice de falhas."},{label:"LIDERANÇA",value:player.goalkeeperLeadership??3,help:"Organização da defesa, orientação aos companheiros e comando da linha defensiva."}]:[{label:"FÍSICO",value:player.speed,help:"Fôlego, velocidade e intensidade durante toda a partida."},{label:"TÉCNICA",value:player.skill,help:"Passe, domínio, drible, finalização e qualidade geral com a bola."},{label:"MARCAÇÃO",value:player.marking??3,help:"Desarme, posicionamento defensivo e recomposição."},{label:"INTELIGÊNCIA TÁTICA",value:player.tacticalIntelligence??3,help:"Ocupação de espaços, movimentação, leitura de jogo e tomada de decisão."},{label:"COMPETITIVIDADE",value:player.competitiveness??3,help:"Entrega, raça, disputa de bolas e comprometimento."}];
  const careerStats=player.careerStats??{games:0,wins:0,losses:0,goals:0,assists:0};
  return <div className="modal-back" onClick={onClose}><div className={`player-card-modal tier-${tier}`} onClick={event=>event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Fechar detalhes">×</button><div className="player-card"><div className="card-top"><div className="overall"><strong>{overall.toFixed(1)}</strong><span className="card-overall-label">OVERALL</span>{config?.cardTiersEnabled&&<em className="player-tier-badge">{playerCardTierLabel(tier)}</em>}</div><div className="card-photo"><PlayerPhoto photoUrl={player.photoUrl} name={player.displayName} large /></div></div><div className="card-identity"><h2>{player.displayName}</h2>{player.fullName!==player.displayName&&<p>{player.fullName}</p>}</div><div className={`card-role${player.secondaryPosition?' has-secondary':''}`}><span><small>TIPO</small><b>{type}</b></span><span><small>POSIÇÃO PRINCIPAL</small><b>{player.primaryPosition}</b></span>{player.secondaryPosition&&<span><small>POSIÇÃO SECUNDÁRIA</small><b>{player.secondaryPosition}</b></span>}</div><div className="card-stats">{stats.map((stat,index)=><span key={stat.label}><b>{Number(stat.value).toFixed(1)}</b><small className="card-stat-label"><span>{stat.label}</span><CardDisciplineHelp id={`card-discipline-${player.id}-${index}`} label={stat.label} text={stat.help}/></small></span>)}<span><b>{(player.momentum??0)>0?'+':''}{(player.momentum??0).toFixed(1)}</b><small>MOMENTUM</small></span></div><div className={`card-career-stats ${config?.showContributions?'with-contributions':''}`} aria-label="Estatísticas de partidas confirmadas"><span><b>{careerStats.games}</b><small>JOGOS</small></span><span className="wins"><b>{careerStats.wins}</b><small>VITÓRIAS</small></span><span className="losses"><b>{careerStats.losses}</b><small>DERROTAS</small></span>{config?.showContributions&&<><span className="goals"><b>{careerStats.goals??0}</b><small>GOLS</small></span><span className="assists"><b>{careerStats.assists??0}</b><small>ASSISTÊNCIAS</small></span></>}</div>{player.notes&&<blockquote>{player.notes}</blockquote>}</div></div></div>;
}

function Metric({label,value,side,blueName,yellowName,help}:{label:string;value:any;side?:string;blueName?:string;yellowName?:string;help?:string}) { const sideLabel=side==='BLUE'?`Time ${blueName}`:side==='YELLOW'?`Time ${yellowName}`:side==='EVEN'?'Sem diferença':'';return <span className="balance-metric"><small>{label}{help&&<MetricHelp text={help}/>}</small><b>{value}</b>{sideLabel&&<em className={side==='BLUE'?'blue':side==='YELLOW'?'yellow':'even'}>{sideLabel}</em>}</span>; }
function MetricHelp({text}:{text:string}) { return <span className="metric-help"><button type="button" aria-label="Ver explicação">?</button><span role="tooltip">{text}</span></span>; }
