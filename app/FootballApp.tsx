"use client";

import { useEffect, useMemo, useState } from "react";
import {
  balanceTeams,
  calculateTeamDelta,
  defaultConfig,
  matchPlayers,
  parseWhatsApp,
  score,
  type Player,
} from "../lib/football";
import { PlayerPhoto } from "./components/PlayerPhoto";

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

type Stage = "import" | "review" | "result" | "history";
type GuestDraft = { displayName: string; fullName: string; nickname: string; primaryPosition: string; speed: number; skill: number; notes: string };

export default function FootballApp() {
  const [stage, setStage] = useState<Stage>("import");
  const [text, setText] = useState(sample);
  const [players, setPlayers] = useState<Player[]>([]);
  const [parsed, setParsed] = useState<ReturnType<typeof parseWhatsApp> | null>(null);
  const [selected, setSelected] = useState<Player[]>([]);
  const [result, setResult] = useState<any>(null);
  const [nonce, setNonce] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [historyDetail, setHistoryDetail] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<Player | null>(null);
  const [guestDraft, setGuestDraft] = useState<GuestDraft | null>(null);
  const [manual, setManual] = useState(false);
  const [config, setConfig] = useState(defaultConfig);

  const load = async () => {
    const [p, c, h] = await Promise.all([
      fetch("/api/players", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/config").then((response) => response.json()),
      fetch("/api/separations").then((response) => response.json()),
    ]);
    setPlayers(p.players || []);
    setConfig(c.config || defaultConfig);
    setHistory(h.separations || []);
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
    setGuestDraft({ displayName: name, fullName: name, nickname: "", primaryPosition: "Meio-campo", speed: 3, skill: 3, notes: "" });
  }

  async function saveGuest(draft: GuestDraft) {
    const response = await fetch("/api/guests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const payload = await response.json();
    if (!response.ok) { setToast(payload.error || "Não foi possível cadastrar o convidado."); return; }
    const guest = payload.player as Player;
    setPlayers((current) => current.some((player) => player.id === guest.id) ? current : [...current, guest]);
    setSelected((current) => current.some((player) => player.id === guest.id) ? current : [...current, guest]);
    setGuestDraft(null);
    setToast(payload.reused ? `${guest.displayName} já estava cadastrado e foi associado.` : `${guest.displayName} foi cadastrado e ficará disponível na área administrativa.`);
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
    const snapshot = { ...result, speedWeight: config.speedWeight, skillWeight: config.skillWeight };
    const response = await fetch("/api/separations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: parsed?.title, date: parsed?.date, originalText: text, result: snapshot, manuallyAdjusted: manual }) });
    if (response.ok) { setToast("Separação confirmada e salva."); await load(); setHistoryDetail(null); setStage("history"); }
  }

  async function copyTeams(source = result, withScores = false, titleOverride?: string) {
    const title = titleOverride || source?.matchTitle || parsed?.title || "PELADA";
    const format = (player: Player, index: number) => `${index + 1}. ${player.displayName}${withScores ? ` — ${player.primaryPosition} · Vel ${player.speed.toFixed(1)} · Hab ${player.skill.toFixed(1)}` : ""}`;
    const output = `⚽ ${title}\n\n🔵 TIME AZUL\n${source.blue.map(format).join("\n")}\n\n🟡 TIME AMARELO\n${source.yellow.map(format).join("\n")}\n\n📊 ${source.rating || source.balanceClassification}\nVelocidade: peso de ${Math.round(config.speedWeight * 100)}%\nHabilidade: peso de ${Math.round(config.skillWeight * 100)}%`;
    await navigator.clipboard.writeText(output);
    setToast("Times copiados com sucesso.");
  }

  return <div className="app-shell">
    <header><a className="brand" onClick={() => { setHistoryDetail(null); setStage("import"); }}><span className="brand-mark">⚽</span><span><b>Pelada</b><small>Pede Mais Uma</small></span></a><nav><button className={stage === "import" ? "active" : ""} onClick={() => { setHistoryDetail(null); setStage("import"); }}>Montar times</button><button className={stage === "history" ? "active" : ""} onClick={() => { setHistoryDetail(null); setStage("history"); }}>Separações salvas</button><a href="/admin">Área administrativa</a></nav></header>
    <main>
      {stage !== "history" && <div className="steps"><span className={stage === "import" ? "on" : "done"}>1 <i>Importar</i></span><b></b><span className={stage === "review" ? "on" : stage === "result" ? "done" : ""}>2 <i>Revisar</i></span><b></b><span className={stage === "result" ? "on" : ""}>3 <i>Times</i></span></div>}
      {stage === "import" && <section className="hero"><div className="eyebrow">ORGANIZAÇÃO SEM DRAMA</div><h1>Do WhatsApp para o campo,<br /><em>times justos em minutos.</em></h1><p>Cole a lista de confirmações. A gente identifica quem vai, equilibra posições e nível, e deixa tudo pronto para compartilhar.</p><div className="import-card"><label>Cole aqui a lista de confirmações do WhatsApp</label><textarea value={text} onChange={(event) => setText(event.target.value)} aria-label="Lista de confirmações" /><div className="card-foot"><span>✅ Só quem estiver confirmado entra na lista</span><button className="primary" onClick={process}>Processar confirmações <b>→</b></button></div></div><div className="trust"><span>⚖️ Equilibra posições e nível</span><span>🔒 Seus dados ficam protegidos</span><span>📱 Pronto para o WhatsApp</span></div></section>}
      {stage === "review" && parsed && <section className="content"><div className="section-head"><div><div className="eyebrow">REVISÃO DA PARTIDA</div><h2>{parsed.title}</h2><p>{parsed.confirmed.length} confirmados · {parsed.absent.length} ausentes</p></div><button className="ghost" onClick={() => setStage("import")}>← Editar lista</button></div>
        {parsed.duplicates.length > 0 && <div className="alert error">Jogadores duplicados: {parsed.duplicates.join(", ")}</div>}
        {missing.length > 0 && <div className="alert"><b>Existem jogadores confirmados sem dados suficientes.</b><span>Cadastre ou associe esses jogadores antes de gerar os times.</span></div>}
        <div className="review-grid"><div className="panel"><h3>Confirmados encontrados <span>{matches.length - missing.length}</span></h3>{matches.filter((match) => match.status === "found").map((match: any) => <PlayerRow key={match.name} player={match.player} onClick={() => setDetail(match.player)} />)}</div><div className="panel"><h3>Sem cadastro <span>{missing.length}</span></h3>{missing.map((match: any) => <div className="missing" key={match.name}><PlayerAvatar name={match.name} /><div><b>{match.name}</b><small>{match.status === "ambiguous" ? "Possível correspondência ambígua" : "Dados obrigatórios pendentes"}</small></div><button onClick={() => openGuest(match.name)}>+ Cadastrar convidado</button></div>)}</div></div>
        <div className="action-bar"><span>{selected.length} jogadores prontos</span><button className="primary" disabled={selected.length < 4 || missing.length > 0 || parsed.duplicates.length > 0} onClick={() => generate()}>Gerar times equilibrados →</button></div>
      </section>}
      {stage === "result" && result && <ResultPresentation result={result} manuallyAdjusted={manual} onPlayer={setDetail} onMove={move} onNew={() => generate(true)} onCopy={() => copyTeams(result, true)} onConfirm={confirmSeparation} />}
      {stage === "history" && !historyDetail && <section className="content"><div className="section-head"><div><div className="eyebrow">MEMÓRIA DA PELADA</div><h2>Separações salvas</h2><p>Clique em uma partida para rever todos os times e indicadores confirmados.</p></div><button className="primary" onClick={() => setStage("import")}>+ Nova separação</button></div><div className="history-list">{history.length === 0 ? <div className="empty">Nenhuma separação confirmada ainda.</div> : history.map((item) => <article key={item.id}><button className="history-open" onClick={() => setHistoryDetail(item)}><div className="history-date"><b>{item.matchDate ? new Date(item.matchDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</b><small>{new Date(item.confirmedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div><div className="history-main"><h3>{item.matchTitle}</h3><p><span className="dot blue-dot"></span>{item.snapshot.blue.map((player: Player) => player.displayName).join(", ")}</p><p><span className="dot yellow-dot"></span>{item.snapshot.yellow.map((player: Player) => player.displayName).join(", ")}</p></div></button><div className="history-actions"><span>● {item.balanceClassification}</span><button onClick={() => copyTeams(item.snapshot, false, item.matchTitle)}>Copiar para WhatsApp</button></div></article>)}</div></section>}
      {stage === "history" && historyDetail && <SavedSeparation item={historyDetail} onBack={() => setHistoryDetail(null)} onPlayer={setDetail} onCopy={(withScores) => copyTeams(historyDetail.snapshot, withScores, historyDetail.matchTitle)} />}
    </main>
    <footer><b>⚽ Pelada Pede Mais Uma</b><span>Times equilibrados. Resenha garantida.</span></footer>
    {toast && <div className="toast" onAnimationEnd={() => setToast("")}>{toast}</div>}
    {detail && <PlayerDetail player={detail} config={config} onClose={() => setDetail(null)} />}
    {guestDraft && <GuestForm draft={guestDraft} onClose={() => setGuestDraft(null)} onSave={saveGuest} />}
  </div>;
}

function ResultPresentation({ result, manuallyAdjusted, onPlayer, onMove, onNew, onCopy, onConfirm }: any) {
  return <section className="content"><div className="section-head"><div><div className="eyebrow">PROPOSTA {result.proposal}</div><h2>Times prontos para o jogo</h2><p>{manuallyAdjusted ? "Separação ajustada manualmente" : "O algoritmo comparou milhares de combinações."}</p></div><BalanceBadge rating={result.rating} /></div><TeamGrid result={result} onPlayer={onPlayer} onMove={onMove} /><BalanceMetrics delta={result.delta} /><div className="result-actions"><button className="ghost" onClick={onNew}>↻ Gerar nova separação</button><button className="ghost" onClick={onCopy}>Copiar com pontuações</button><button className="primary" onClick={onConfirm}>Confirmar separação</button></div></section>;
}

function SavedSeparation({ item, onBack, onPlayer, onCopy }: any) {
  const result = item.snapshot;
  return <section className="content saved-detail"><div className="section-head"><div><div className="eyebrow">SEPARAÇÃO CONFIRMADA</div><h2>{item.matchTitle}</h2><p>{item.matchDate ? new Date(item.matchDate + "T12:00:00").toLocaleDateString("pt-BR") : "Data não informada"} · confirmada em {new Date(item.confirmedAt).toLocaleString("pt-BR")}{item.manuallyAdjusted ? " · ajustada manualmente" : ""}</p></div><BalanceBadge rating={result.rating || item.balanceClassification} /></div><TeamGrid result={result} onPlayer={onPlayer} /><BalanceMetrics delta={result.delta} /><div className="saved-meta"><span><small>Proposta utilizada</small><b>{result.proposal || 1}</b></span><span><small>Peso da velocidade</small><b>{Math.round((result.speedWeight || .6) * 100)}%</b></span><span><small>Peso da habilidade</small><b>{Math.round((result.skillWeight || .4) * 100)}%</b></span><span><small>Ajuste manual</small><b>{item.manuallyAdjusted ? "Sim" : "Não"}</b></span></div><div className="result-actions"><button className="ghost" onClick={onBack}>← Voltar ao histórico</button><button className="ghost" onClick={() => onCopy(false)}>Copiar para WhatsApp</button><button className="primary" onClick={() => onCopy(true)}>Copiar com pontuações</button></div></section>;
}

function TeamGrid({ result, onPlayer, onMove }: any) {
  const scoringConfig = { ...defaultConfig, speedWeight: result.speedWeight ?? .6, skillWeight: result.skillWeight ?? .4 };
  return <div className="teams"><Team color="blue" title="Time Azul" players={result.blue} metrics={result.blueMetrics} extraId={result.extraId} scoringConfig={scoringConfig} onPlayer={onPlayer} onMove={onMove ? (id: string) => onMove(id, "blue") : undefined} /><Team color="yellow" title="Time Amarelo" players={result.yellow} metrics={result.yellowMetrics} extraId={result.extraId} scoringConfig={scoringConfig} onPlayer={onPlayer} onMove={onMove ? (id: string) => onMove(id, "yellow") : undefined} /></div>;
}

function BalanceBadge({ rating }: { rating: string }) { return <div className={`balance ${rating?.startsWith("Excelente") ? "great" : ""}`}><span>●</span><div><small>INDICADOR</small><b>{rating}</b></div></div>; }
function BalanceMetrics({ delta }: any) { return <div className="metrics"><h3>Diferenças entre os times</h3><div><Metric label="Jogadores" value={delta?.players ?? 0} /><Metric label="Defensores" value={delta?.defenders ?? 0} /><Metric label="Meio-campistas" value={delta?.midfielders ?? 0} /><Metric label="Atacantes" value={delta?.attackers ?? 0} /><Metric label="Velocidade" value={(delta?.speed ?? 0).toFixed(1)} /><Metric label="Habilidade" value={(delta?.skill ?? 0).toFixed(1)} /><Metric label="Pontuação" value={(delta?.score ?? 0).toFixed(2)} /></div></div>; }

function PlayerRow({ player, onClick }: { player: Player; onClick: () => void }) { return <button className="player-row" onClick={onClick}><PlayerAvatar player={player} /><div><b>{player.displayName}</b><small>{player.primaryPosition}</small></div><span className="rating">{score(player).toFixed(1)}</span><i>›</i></button>; }
function Team({ color, title, players, metrics, extraId, scoringConfig, onPlayer, onMove }: any) { return <article className={`team ${color}`}><div className="team-head"><div><span className="shirt">{color === "blue" ? "🔵" : "🟡"}</span><h3>{title}</h3></div><b>{players.length} jogadores</b></div><div className="team-summary"><span>DEF <b>{metrics?.positions.Defesa || 0}</b></span><span>MEI <b>{metrics?.positions["Meio-campo"] || 0}</b></span><span>ATA <b>{metrics?.positions.Ataque || 0}</b></span><span>MÉDIA <b>{metrics?.scoreAvg?.toFixed(2) || "—"}</b></span></div>{players.map((player: Player) => <div className="team-player" key={player.id}><button onClick={() => onPlayer(player)}><PlayerAvatar player={player} /><div><b>{player.displayName}</b><small>{player.primaryPosition}{player.id === extraId ? " · Jogador adicional" : ""}</small></div></button><span>{score(player, scoringConfig).toFixed(1)}</span>{onMove && <button className="swap" title="Mover para o outro time" onClick={() => onMove(player.id)}>⇄</button>}</div>)}</article>; }

function PlayerAvatar({ player, name }: { player?: Player; name?: string }) { const label = player?.displayName || name || "Jogador"; return <PlayerPhoto photoUrl={player?.photoUrl} name={label} />; }
function PlayerDetail({ player, config, onClose }: any) { return <div className="modal-back" onClick={onClose}><div className="modal player-detail-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={onClose}>×</button><PlayerPhoto photoUrl={player.photoUrl} name={player.displayName} large /><h2>{player.fullName}</h2><p>{player.nickname || player.displayName}</p><div className="detail-grid"><Metric label="Tipo" value={player.type === "guest" ? "Convidado" : player.type === "goalkeeper" ? "Goleiro" : "Mensalista"} /><Metric label="Posição" value={player.primaryPosition} /><Metric label="Velocidade" value={player.speed.toFixed(1)} /><Metric label="Habilidade" value={player.skill.toFixed(1)} /><Metric label="Pontuação" value={score(player, config).toFixed(2)} /></div>{player.notes && <blockquote>{player.notes}</blockquote>}</div></div>; }

function GuestForm({ draft, onClose, onSave }: { draft: GuestDraft; onClose: () => void; onSave: (draft: GuestDraft) => void }) {
  const [value, setValue] = useState(draft); const update = (key: keyof GuestDraft, next: any) => setValue((current) => ({ ...current, [key]: next }));
  return <div className="modal-back"><form className="editor guest-editor" onSubmit={(event) => { event.preventDefault(); onSave(value); }}><button className="close" type="button" onClick={onClose}>×</button><h2>Cadastrar convidado</h2><p>O convidado ficará salvo e aparecerá na área administrativa para futuras edições.</p><div className="form-grid"><label>Nome<input value={value.displayName} onChange={(event) => { update("displayName", event.target.value); update("fullName", event.target.value); }} required /></label><label>Apelido<input value={value.nickname} onChange={(event) => update("nickname", event.target.value)} /></label><label>Posição<select value={value.primaryPosition} onChange={(event) => update("primaryPosition", event.target.value)}><option>Defesa</option><option>Meio-campo</option><option>Ataque</option><option>Goleiro</option></select></label><RatingSlider label="Velocidade" value={value.speed} onChange={(next) => update("speed", next)} /><RatingSlider label="Habilidade" value={value.skill} onChange={(next) => update("skill", next)} /><label className="wide">Observações<textarea value={value.notes} onChange={(event) => update("notes", event.target.value)} /></label></div><div className="editor-actions"><button className="ghost" type="button" onClick={onClose}>Cancelar</button><button className="primary">Salvar convidado</button></div></form></div>;
}

function RatingSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="rating-slider"><span>{label}</span><input type="range" min="1" max="5" step="0.1" value={value} onChange={(event) => onChange(Math.round(Number(event.target.value) * 10) / 10)} /><output>{Number(value).toFixed(1)}</output><small><span>1</span><span>5</span></small></label>; }
function Metric({ label, value }: { label: string; value: any }) { return <span><small>{label}</small><b>{value}</b></span>; }
