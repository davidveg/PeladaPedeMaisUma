"use client";

import { useEffect, useMemo, useState } from "react";

const fields = ["motmThirdId", "motmSecondId", "motmFirstId", "dotmThirdId", "dotmSecondId", "dotmFirstId"] as const;
type Field = typeof fields[number];

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a operação.");
  return payload;
}

export default function VotingApp() {
  const [data, setData] = useState<any>(null);
  const [votes, setVotes] = useState<Record<Field, string>>(emptyVotes());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") || "" : "";

  const load = async () => {
    const payload = await api(`/api/career/vote?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    setData(payload);
    return payload;
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
      setError(cause.message);
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

  if (!data) return <main className="vote-page"><div className="vote-card"><b>{error || "Carregando votação…"}</b></div></main>;

  const match = data.match;
  const closed = match.status === "CLOSED";
  const viewer = data.viewer || {};

  return (
    <main className="vote-page">
      <header className="vote-brand"><a href="/">⚽ <b>Pelada Pede Mais Uma</b></a><span>Modo Carreira</span></header>
      <section className="vote-card">
        <div className="vote-head">
          <div><small>VOTAÇÃO DA PARTIDA</small><h1>{match.matchTitle}</h1><p>{match.matchDate ? new Date(match.matchDate + "T12:00:00").toLocaleDateString("pt-BR") : "Data não informada"}</p></div>
          <div className="score-board"><span>Azul <b>{match.blueScore}</b></span><i>×</i><span><b>{match.yellowScore}</b> Amarelo</span></div>
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
                description="A votação é exclusiva para os jogadores presentes nesta separação. Se você entrou com a conta errada, troque de usuário."
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
    </main>
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
      <div><span>LOGIN OBRIGATÓRIO</span><h2>Entre para registrar seu voto</h2><p>O voto será associado automaticamente ao jogador vinculado à sua conta.</p></div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>Senha<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required /></label>
      <button className="primary" disabled={busy}>{busy ? "Entrando…" : "Entrar e continuar →"}</button>
      <small>Ainda não possui conta ou associação? <a href={`/conta?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/votacao")}`}>Acesse Minha conta</a>.</small>
    </form>
  );
}

function VoteIdentity({ player, onLogout, busy }: any) {
  return (
    <div className="vote-identity">
      <span><small>VOTANDO COMO</small><b>{player.displayName}</b><em>{player.team === "BLUE" ? "Time Azul" : "Time Amarelo"}</em></span>
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
  return <section className="career-contribution-summary vote-contribution-summary"><header className="vote-contribution-title"><span>ARTILHARIA DA PARTIDA</span><h2>Gols e assistências</h2></header><div>{contributions.map((goal: any, index: number) => <span className={`goal-${String(goal.team).toLowerCase()} ${goal.ownGoal ? "own-goal" : ""}`} key={`${goal.team}-${index}`}><i>{goal.team === "BLUE" ? "Time Azul" : "Time Amarelo"}</i>{goal.ownGoal ? <><b>GC</b><strong>{goal.scorerName}</strong></> : <><strong>{goal.scorerName}</strong>{goal.assistName ? <small><em>Assistência</em>{goal.assistName}</small> : <small className="no-assist">Sem assistência</small>}</>}</span>)}</div></section>;
}

function Podium({ title, subtitle, tone, fields: podiumFields, votes, setVotes, options }: any) {
  const places = ["3º lugar", "2º lugar", "1º lugar"];
  return <fieldset className={`vote-podium ${tone}`}><legend>{title}<small>{subtitle} · escolha do 3º ao 1º lugar</small></legend><div>{podiumFields.map((field: Field, index: number) => <label key={field}><span>{places[index]}</span><select value={votes[field]} onChange={event => setVotes((current: any) => ({ ...current, [field]: event.target.value }))} required><option value="">Selecione</option>{options(field).map((player: any) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label>)}</div></fieldset>;
}

function ClosedResults({ match, names }: any) {
  const results = match.results;
  return <div className="vote-closed"><span>✓ VOTAÇÃO ENCERRADA</span><h2>Resultado final</h2><p>Os votos são finais e o momentum já foi aplicado aos jogadores.</p>{!results?.voteCount ? <div className="empty">A votação foi encerrada sem votos válidos.</div> : <div className="career-results"><ResultPodium title="Man of the Match" entries={results.motm} names={names} /><ResultPodium title="Deception of the Match" entries={results.dotm} names={names} /></div>}</div>;
}

function ResultPodium({ title, entries, names }: any) {
  return <div><h3>{title}</h3>{(entries || []).map((entry: any) => <span key={entry.playerId}><b>{entry.place}º</b><em>{names[entry.playerId] || "Jogador"}</em><strong>{entry.momentum > 0 ? "+" : ""}{Number(entry.momentum).toFixed(1)}</strong></span>)}</div>;
}
