"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInstanceBranding } from "../InstanceBranding";
import { PlayerPhoto } from "../components/PlayerPhoto";

const fields = ["motmThirdId", "motmSecondId", "motmFirstId", "dotmThirdId", "dotmSecondId", "dotmFirstId"] as const;
type Field = typeof fields[number];
type VotePlayer = { id: string; displayName: string; photoUrl?: string | null; team: "BLUE" | "YELLOW" };

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || "Não foi possível concluir a operação."), { status: response.status });
  return payload;
}

export default function VotingApp({ votingToken, embedded = false }: { votingToken?: string; embedded?: boolean }) {
  const Container = embedded ? "div" : "main";
  const { config: brand } = useInstanceBranding();
  const [data, setData] = useState<any>(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [votes, setVotes] = useState<Record<Field, string>>(emptyVotes());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const token = votingToken || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") || "" : "");

  const load = async () => {
    try {
      const payload = await api(`/api/career/vote?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      setData(payload); setAccessRequired(false);
      return payload;
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) {
        setData(null); setVotes(emptyVotes()); setMessage(""); setError(""); setAccessRequired(true);
        window.dispatchEvent(new Event("ppm:match-access-required"));
        return null;
      }
      throw cause;
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = () => load().catch(cause => { if (active) setError(cause.message); });
    refresh();
    const interval = window.setInterval(refresh, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  const names = useMemo(() => Object.fromEntries((data?.players || []).map((player: any) => [player.id, player.displayName])), [data]);
  const selected = new Set(Object.values(votes).filter(Boolean));
  const voterPlayerId = data?.viewer?.player?.id || "";
  function options(field: Field) {
    return (data?.players || []).filter((player: any) => player.id !== voterPlayerId && (!selected.has(player.id) || votes[field] === player.id));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (fields.some(field => !votes[field])) {
      setError("Preencha os seis lugares do pódio.");
      return;
    }
    setBusy(true);
    try {
      const payload = await api("/api/career/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...votes }),
      });
      setMessage(payload.message);
      setVotes(emptyVotes());
      await load();
    } catch (cause: any) {
      if (cause.status === 401) await load();
      else setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/api/member-auth", { method: "DELETE" });
      setVotes(emptyVotes());
      setMessage("");
      await load();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  if (accessRequired) return <Container className={embedded ? "vote-page match-vote-embedded" : "vote-page"}><section className="vote-card"><VoteLogin onDone={async () => { setError(""); await load(); }}/></section></Container>;
  if (!data) return <Container className={embedded ? "vote-page match-vote-embedded" : "vote-page"}><div className="vote-card"><b>{error || "Carregando votação…"}</b></div></Container>;

  const match = data.match;
  const closed = match.status === "CLOSED";
  const viewer = data.viewer || {};

  return (
    <Container className={embedded ? "vote-page match-vote-embedded" : "vote-page"}>
      {!embedded && <header className="vote-brand"><a href="/">⚽ <b>{brand.siteName}</b></a><span>Modo Carreira</span></header>}
      <section className="vote-card">
        <div className="vote-head">
          <div><small>VOTAÇÃO DA PARTIDA</small><h1>{match.matchTitle}</h1><p>{match.matchDate ? new Date(match.matchDate + "T12:00:00").toLocaleDateString("pt-BR") : "Data não informada"}</p></div>
          <div className="score-board"><span className="blue">{brand.teamBlueName} <b>{match.blueScore}</b></span><i>×</i><span className="yellow"><b>{match.yellowScore}</b> {brand.teamYellowName}</span></div>
        </div>
        {data.showContributions && match.contributions?.length > 0 && <VoteContributions contributions={match.contributions} />}
        {!data.enabled && !closed && <div className="alert">O Modo Carreira está temporariamente desativado. Nenhum voto pode ser enviado agora.</div>}
        {closed ? <ClosedResults match={match} names={names} /> : (
          <section className="career-vote-area">
            <div className="vote-deadline">Votação aberta até <b>{new Date(match.closesAt).toLocaleString("pt-BR")}</b></div>
            {error && <div className="alert error" role="alert">{error}</div>}
            {message && <div className="admin-notice" role="status"><span>✓</span><b>{message}</b></div>}
            {!data.enabled ? null : !viewer.authenticated ? (
              <VoteLogin onDone={async () => { setError(""); await load(); }} />
            ) : !viewer.hasPlayerAssociation ? (
              <VoteAccessState
                title="Associe sua conta a um jogador"
                description="Somente contas vinculadas a um jogador podem participar da votação. Faça a associação na área Minha conta e depois retorne a este link."
                actionHref={`/conta?returnTo=${encodeURIComponent(`/votacao?token=${token}`)}`}
                actionLabel="Ir para Minha conta"
                onLogout={logout}
                busy={busy}
              />
            ) : !viewer.isParticipant ? (
              <VoteAccessState
                title="Seu jogador não participou desta partida"
                description="A votação é exclusiva para os jogadores presentes nesta escalação. Se você entrou com a conta errada, troque de usuário."
                onLogout={logout}
                busy={busy}
              />
            ) : viewer.hasVoted ? (
              <VoteAccessState
                title="Seu voto já foi registrado"
                description={`${viewer.player.displayName}, cada jogador pode enviar apenas um voto por partida. Um administrador poderá removê-lo somente enquanto a votação estiver aberta.`}
                onLogout={logout}
                busy={busy}
              />
            ) : (
              <form className="career-vote-form" onSubmit={submit}>
                <VoteIdentity player={viewer.player} onLogout={logout} busy={busy} />
                <Podium title="Man of the Match" subtitle="Os três melhores da partida" tone="best" fields={fields.slice(0, 3) as Field[]} votes={votes} setVotes={setVotes} options={options} />
                <Podium title="Deception of the Match" subtitle="Os três desempenhos abaixo do esperado" tone="worst" fields={fields.slice(3) as Field[]} votes={votes} setVotes={setVotes} options={options} />
                <button className="primary vote-submit" disabled={busy || !viewer.canVote}>{busy ? "Enviando…" : "Confirmar meus votos"}</button>
              </form>
            )}
          </section>
        )}
      </section>
    </Container>
  );
}

function emptyVotes() {
  return Object.fromEntries(fields.map(field => [field, ""])) as Record<Field, string>;
}

function VoteLogin({ onDone }: { onDone: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/member-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      await onDone();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="vote-login" onSubmit={submit}>
      <div><span>LOGIN OBRIGATÓRIO</span><h2>Entre para acessar a votação</h2><p>Os dados da partida e os resultados da votação são exclusivos para contas autenticadas. Use sua conta de jogador, moderador ou administrador.</p></div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required /></label>
      <button className="primary" disabled={busy}>{busy ? "Entrando…" : "Entrar e continuar →"}</button>
      <small>Ainda não possui conta ou associação? <a href={`/conta?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/votacao")}`}>Acesse Minha conta</a>.</small>
    </form>
  );
}

function VoteIdentity({ player, onLogout, busy }: any) {
  const { config: brand } = useInstanceBranding();
  return (
    <div className="vote-identity">
      <PlayerPhoto photoUrl={player.photoUrl} name={player.displayName} className="vote-identity-photo" previewSize={280} />
      <span><small>VOTANDO COMO</small><b>{player.displayName}</b><em className={player.team.toLowerCase()}>{player.team === "BLUE" ? `Time ${brand.teamBlueName}` : `Time ${brand.teamYellowName}`}</em></span>
      <p>Sua identidade foi confirmada pela conta associada. Você não poderá selecionar a si mesmo.</p>
      <button type="button" className="ghost" onClick={onLogout} disabled={busy}>Trocar conta</button>
    </div>
  );
}

function VoteAccessState({ title, description, actionHref, actionLabel, onLogout, busy }: any) {
  return (
    <div className="vote-access-state">
      <span>🔒</span>
      <div><h2>{title}</h2><p>{description}</p></div>
      <div>{actionHref && <a className="primary" href={actionHref}>{actionLabel}</a>}<button className="ghost" type="button" onClick={onLogout} disabled={busy}>Entrar com outra conta</button></div>
    </div>
  );
}

function VoteContributions({ contributions }: any) {
  const { config: brand } = useInstanceBranding();
  return <section className="career-contribution-summary vote-contribution-summary"><header className="vote-contribution-title"><span>ARTILHARIA DA PARTIDA</span><h2>Gols e assistências</h2></header><div>{contributions.map((goal: any, index: number) => <span className={`goal-${String(goal.team).toLowerCase()} ${goal.ownGoal ? "own-goal" : ""}`} key={`${goal.team}-${index}`}><i>{goal.team === "BLUE" ? `Time ${brand.teamBlueName}` : `Time ${brand.teamYellowName}`}</i>{goal.ownGoal ? <><b>GC</b><strong>{goal.scorerName}</strong></> : <><strong>{goal.scorerName}</strong>{goal.assistName ? <small><em>Assistência</em>{goal.assistName}</small> : <small className="no-assist">Sem assistência</small>}</>}</span>)}</div></section>;
}

function Podium({ title, subtitle, tone, fields: podiumFields, votes, setVotes, options }: any) {
  const places = ["3º lugar", "2º lugar", "1º lugar"];
  return <fieldset className={`vote-podium ${tone}`}><legend>{title}<small>{subtitle} · escolha do 3º ao 1º lugar</small></legend><div>{podiumFields.map((field: Field, index: number) => <div className="vote-podium-field" key={field}><span>{places[index]}</span><VotePlayerSelect field={field} label={`${places[index]} de ${title}`} value={votes[field]} players={options(field)} onChange={(playerId:string)=>setVotes((current:any)=>({...current,[field]:playerId}))}/></div>)}</div></fieldset>;
}

function VotePlayerSelect({ field, label, value, players, onChange }: { field: Field; label: string; value: string; players: VotePlayer[]; onChange: (playerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = players.find(player => player.id === value);
  const listId = `vote-options-${field}`;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={`vote-player-select ${open ? "open" : ""}`} ref={root}>
    <button type="button" className="vote-player-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(current => !current)}>
      {selected ? <PlayerPhoto photoUrl={selected.photoUrl} name={selected.displayName} className="vote-option-photo" previewSize={280} /> : <span className="vote-empty-photo" aria-hidden="true">👤</span>}
      <b>{selected?.displayName || "Selecionar jogador"}</b><i aria-hidden="true">{open ? "⌃" : "⌄"}</i>
    </button>
    {open && <div className="vote-player-options" id={listId} role="listbox" aria-label={label}>
      {players.map(player => <button type="button" role="option" aria-selected={player.id === value} className={player.id === value ? "selected" : ""} key={player.id} onClick={() => { onChange(player.id); setOpen(false); }}>
        <PlayerPhoto photoUrl={player.photoUrl} name={player.displayName} className="vote-option-photo" previewSize={280} />
        <b>{player.displayName}</b>{player.id === value && <span aria-hidden="true">✓</span>}
      </button>)}
    </div>}
  </div>;
}

function ClosedResults({ match, names }: any) {
  const results = match.results;
  return <div className="vote-closed"><span>✓ VOTAÇÃO ENCERRADA</span><h2>Resultado final</h2><p>Os votos são finais e o momentum já foi aplicado aos jogadores.</p>{!results?.voteCount ? <div className="empty">A votação foi encerrada sem votos válidos.</div> : <div className="career-results"><ResultPodium title="Man of the Match" entries={results.motm} names={names} /><ResultPodium title="Deception of the Match" entries={results.dotm} names={names} /></div>}</div>;
}

function ResultPodium({ title, entries, names }: any) {
  return <div><h3>{title}</h3>{(entries || []).map((entry: any) => <span key={entry.playerId}><b>{entry.place}º</b><em>{names[entry.playerId] || "Jogador"}</em><strong>{entry.momentum > 0 ? "+" : ""}{Number(entry.momentum).toFixed(1)}</strong></span>)}</div>;
}
