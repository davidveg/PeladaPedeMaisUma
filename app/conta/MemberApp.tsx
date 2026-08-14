"use client";

import { useEffect, useState } from "react";
import type { Config, Player } from "../../lib/football";
import { defaultConfig, score } from "../../lib/football";
import { playerCardTier, playerCardTierLabel } from "../../lib/player-card-tier";
import { safeSiteReturnTo } from "../../lib/site-navigation";
import { PlayerPhoto } from "../components/PlayerPhoto";
import { SiteHeader } from "../components/SiteHeader";
import { useInstanceBranding } from "../InstanceBranding";

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options), text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

type NotificationPreferences = {
  attendanceInApp: boolean; attendancePush: boolean;
  matchesInApp: boolean; matchesPush: boolean;
  separationsInApp: boolean; separationsPush: boolean;
  appUpdatesInApp: boolean; appUpdatesPush: boolean;
  careerVotesPush: boolean; pageSize: number;
};

export default function MemberApp() {
  const [member, setMember] = useState<any>(undefined), [player, setPlayer] = useState<Player | null>(null), [config, setConfig] = useState<Config>(defaultConfig), [available, setAvailable] = useState<any[]>([]), [error, setError] = useState(""), [notice, setNotice] = useState(""), [editing, setEditing] = useState(false);
  async function load() {
    const auth = await api("/api/member-auth");
    setMember(auth.member);
    if (!auth.member) { setPlayer(null); setAvailable([]); return { member: null, player: null }; }
    const profile = await api("/api/member-profile");
    setMember(profile.member); setPlayer(profile.player); setConfig({ ...defaultConfig, ...(profile.config || {}) });
    if (!profile.player) setAvailable((await api("/api/member-players")).players || []); else setAvailable([]);
    return { member: profile.member, player: profile.player };
  }
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);
  async function logout() { await api("/api/member-auth", { method: "DELETE" }); setMember(null); setPlayer(null); }
  async function associate(candidate: any) {
    if (!confirm(`Confirmar a associação da sua conta com ${candidate.displayName}? Depois disso, somente um administrador poderá desfazer a associação.`)) return;
    setError("");
    try {
      const result = await api("/api/member-players", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId: candidate.id }) });
      const returnTo = safeReturnTo();
      if (returnTo) { window.location.assign(returnTo); return; }
      setNotice(result.message);
      await load();
    } catch (cause: any) { setError(cause.message); }
  }
  if (member === undefined) return <div className="member-loading">Carregando sua conta…</div>;
  if (memberResetToken()) return <MemberAccess onDone={load} />;
  if (!member) return <MemberAccess onDone={load} />;
  return <div className="member-page"><SiteHeader active="account" isAdmin={member.accountType === "administrator" || member.role === "moderator"}/><main className="member-main"><div className="member-account-head member-account-actions"><div><div className="eyebrow">MINHA CONTA</div><h1>{player ? `Olá, ${player.displayName}` : "Associe seu jogador"}</h1><p>{member.email}{member.accountType === "administrator" ? " · Administrador" : member.role === "moderator" ? " · Moderador" : ""}</p></div><button className="ghost member-logout" type="button" onClick={logout}>Sair da conta</button></div>{error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="admin-notice" role="status"><span>✓</span><b>{notice}</b><button onClick={() => setNotice("")} aria-label="Fechar mensagem">×</button></div>}{!player ? <AssociationPicker players={available} onSelect={associate} /> : <MemberProfile player={player} config={config} onEdit={() => setEditing(true)} />}<NotificationPreferencesCard /></main>{editing && player && <MemberProfileForm player={player} onClose={() => setEditing(false)} onSaved={async message => { setEditing(false); setNotice(message); await load(); }} />}</div>;
}

function NotificationPreferencesCard() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null), [saving, setSaving] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => { api("/api/notification-preferences").then(result => setPreferences(result.preferences)).catch(cause => setError(cause.message)); }, []);
  const set = (key: keyof NotificationPreferences, value: boolean | number) => setPreferences(current => current ? { ...current, [key]: value } : current);
  async function save() {
    if (!preferences) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await api("/api/notification-preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(preferences) });
      setPreferences(result.preferences); setMessage(result.message);
    } catch (cause: any) { setError(cause.message); } finally { setSaving(false); }
  }
  function disableAll() {
    setPreferences(current => current ? {
      ...current, attendanceInApp: false, attendancePush: false, matchesInApp: false,
      matchesPush: false, separationsInApp: false, separationsPush: false,
      appUpdatesInApp: false, appUpdatesPush: false, careerVotesPush: false,
    } : current);
  }
  const rows = [
    { label: "Confirmações e ausências", description: "Mudanças na lista de presença.", inApp: "attendanceInApp", push: "attendancePush" },
    { label: "Partidas", description: "Criação, alteração ou cancelamento.", inApp: "matchesInApp", push: "matchesPush" },
    { label: "Separações prontas", description: "Lista encerrada e times disponíveis.", inApp: "separationsInApp", push: "separationsPush" },
    { label: "Atualizações do aplicativo", description: "Novas versões disponíveis para Android e iOS.", inApp: "appUpdatesInApp", push: "appUpdatesPush" },
  ] as const;
  return <section className="notification-preferences-card"><div className="notification-preferences-head"><div><div className="eyebrow">PREFERÊNCIAS</div><h2>Notificações e pushes</h2><p>Escolha quais novidades aparecem no feed e quais chegam à central de notificações do celular. A alteração vale para site, Android e iOS.</p></div><button className="ghost" type="button" onClick={disableAll} disabled={!preferences}>Desativar tudo</button></div>
    {error && <div className="alert error">{error}</div>}{message && <div className="admin-notice" role="status"><span>✓</span><b>{message}</b></div>}
    {!preferences ? <div className="member-empty">Carregando preferências…</div> : <><div className="notification-preferences-grid"><div className="notification-preferences-labels"><b>Tipo de aviso</b><b>No aplicativo</b><b>Push</b></div>{rows.map(row => <div className="notification-preference-row" key={row.label}><span><b>{row.label}</b><small>{row.description}</small></span><label><input type="checkbox" checked={preferences[row.inApp]} onChange={event => set(row.inApp, event.target.checked)} /><i aria-hidden="true"/></label><label><input type="checkbox" checked={preferences[row.push]} onChange={event => set(row.push, event.target.checked)} /><i aria-hidden="true"/></label></div>)}<div className="notification-preference-row"><span><b>Votações pós-jogo</b><small>Lembretes para votar em Man of the Match e Deception of the Match.</small></span><em>—</em><label><input type="checkbox" checked={preferences.careerVotesPush} onChange={event => set("careerVotesPush", event.target.checked)} /><i aria-hidden="true"/></label></div></div>
      <div className="notification-preferences-actions"><label>Notificações por página<select value={preferences.pageSize} onChange={event => set("pageSize", Number(event.target.value))}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><button className="primary" type="button" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar preferências"}</button></div></>}
  </section>;
}

function safeReturnTo() {
  if (typeof window === "undefined") return "";
  return safeSiteReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
}

function MemberAccess({ onDone }: { onDone: () => Promise<{ member: any; player: Player | null }> }) {
  const { config: brand } = useInstanceBranding();
  const initialResetToken = memberResetToken();
  const [mode, setMode] = useState<"login" | "register" | "request" | "reset">(initialResetToken ? "reset" : "login"), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState(""), [resetToken] = useState(initialResetToken), [error, setError] = useState(""), [notice, setNotice] = useState(sessionExpiredNotice), [busy, setBusy] = useState(false);
  const changeMode = (next: "login" | "register" | "request") => { setMode(next); setError(""); setNotice(""); setPassword(""); setConfirmation(""); };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (mode === "request") {
        const result = await api("/api/member-password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
        setNotice(result.message);
      } else if (mode === "reset") {
        const result = await api("/api/member-password-reset", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: resetToken, password, confirmation }) });
        window.history.replaceState({}, "", window.location.pathname);
        setMode("login"); setPassword(""); setConfirmation(""); setNotice(result.message);
      } else {
        await api("/api/member-auth", { method: mode === "login" ? "POST" : "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, confirmation }) });
        await onDone();
        const returnTo = safeReturnTo();
        if (returnTo) {
          window.location.assign(returnTo);
          return;
        }
      }
    } catch (cause: any) { setError(cause.message); } finally { setBusy(false); }
  }
  const heading = mode === "login" ? "Bem-vindo de volta" : mode === "register" ? "Crie sua conta" : mode === "request" ? "Recuperar senha" : "Criar nova senha";
  const description = mode === "login" ? "Jogadores e administradores podem entrar com seu e-mail e senha." : mode === "register" ? "Depois do cadastro, você escolherá seu nome na lista de jogadores disponíveis." : mode === "request" ? "Enviaremos um link de uso único para o e-mail da sua conta de jogador." : "Escolha uma nova senha. O link expira em 30 minutos e só pode ser utilizado uma vez.";
  return <div className="member-access"><section className="member-access-copy"><a href="/">⚽ <b>{brand.siteName}</b></a><div><span>ÁREA DO JOGADOR</span><h1>Seus números,<br />seu perfil, sua pelada.</h1><p>Associe sua conta ao seu jogador e acompanhe atributos, momentum e histórico de partidas.</p></div><small>{brand.siteTagline}</small></section><form className="member-access-card" onSubmit={submit}>
    {mode === "login" || mode === "register" ? <div className="member-access-tabs"><button type="button" className={mode === "login" ? "on" : ""} onClick={() => changeMode("login")}>Entrar</button><button type="button" className={mode === "register" ? "on" : ""} onClick={() => changeMode("register")}>Criar conta</button></div> : null}
    <div className="ball">{mode === "request" ? "✉️" : mode === "reset" ? "🔐" : "⚽"}</div><h2>{heading}</h2><p>{description}</p>
    {error && <div className="alert error">{error}</div>}{notice && <div className="admin-notice" role="status"><span>✓</span><b>{notice}</b></div>}
    {mode !== "reset" && <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>}
    {mode !== "request" && <label>{mode === "reset" ? "Nova senha" : "Senha"}<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required />{mode === "reset" && <small>Mínimo de 8 caracteres.</small>}</label>}
    {(mode === "register" || mode === "reset") && <label>Confirmar senha<input type="password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" required /><small>Digite novamente a nova senha.</small></label>}
    {mode === "login" && <button className="member-forgot" type="button" onClick={() => changeMode("request")}>Esqueci minha senha</button>}
    <button className="primary" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? "Entrar →" : mode === "register" ? "Cadastrar e continuar →" : mode === "request" ? "Enviar link de recuperação" : "Redefinir senha"}</button>
    {mode === "request" && <button className="member-back" type="button" onClick={() => changeMode("login")}>← Voltar ao login</button>}
    {mode === "reset" && <button className="member-back" type="button" onClick={() => { window.history.replaceState({}, "", window.location.pathname); changeMode("login"); }}>Cancelar</button>}
    <a href="/">← Voltar para a área pública</a>
  </form></div>;
}

function memberResetToken() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("reset") || "";
}

function sessionExpiredNotice() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("reason") === "session-expired"
    ? "Sua sessão expirou. Entre novamente para continuar."
    : "";
}

function AssociationPicker({ players, onSelect }: { players: any[]; onSelect: (player: any) => void }) {
  const [query, setQuery] = useState("");
  const filtered = players.filter(player => [player.displayName, player.primaryPosition, player.type === "guest" ? "Convidado" : "Mensalista"].some(value => value.toLowerCase().includes(query.toLowerCase())));
  return <section className="association-picker"><div className="association-warning"><b>Escolha com atenção</b><p>A associação é exclusiva e não poderá ser alterada por você. Se selecionar o jogador errado, será necessário solicitar a correção a um administrador.</p></div><label>Buscar meu jogador<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Digite seu nome ou apelido…" /></label><div className="association-grid">{filtered.map(candidate => <button key={candidate.id} onClick={() => onSelect(candidate)}><PlayerPhoto photoUrl={candidate.photoUrl} name={candidate.displayName} /><span><b>{candidate.displayName}</b><small>{candidate.type === "guest" ? "Convidado" : candidate.type === "goalkeeper" ? "Goleiro" : "Mensalista"} · {candidate.primaryPosition}</small></span><i>Associar →</i></button>)}</div>{filtered.length === 0 && <div className="member-empty">Nenhum jogador disponível com esse nome. Fale com um administrador caso seu cadastro ainda não exista.</div>}</section>;
}

function MemberProfile({ player, config, onEdit }: { player: Player; config: Config; onEdit: () => void }) {
  const goalkeeper = player.type === "goalkeeper" || player.primaryPosition === "Goleiro", career = player.careerStats ?? { games: 0, wins: 0, losses: 0, goals: 0, assists: 0 },overall=score(player,config),tier=playerCardTier(overall,config);
  const stats=goalkeeper?[{label:"DEFESAS",value:player.skill,help:"Reflexo, tempo de reação, defesas à queima-roupa e consistência."},{label:"POSICIONAMENTO",value:player.goalkeeperPositioning??player.speed??3,help:"Leitura da jogada, colocação no gol, saída do gol e cobertura de ângulos."},{label:"JOGO COM OS PÉS",value:player.goalExit??player.marking??3,help:"Qualidade na reposição, passes curtos e lançamentos, participação na saída de bola."},{label:"SEGURANÇA",value:player.goalkeeperSafety??3,help:"Firmeza nas defesas, retenção da bola, saídas em cruzamentos e baixo índice de falhas."},{label:"LIDERANÇA",value:player.goalkeeperLeadership??3,help:"Organização da defesa, orientação aos companheiros e comando da linha defensiva."}]:[{label:"FÍSICO",value:player.speed,help:"Fôlego, velocidade e intensidade durante toda a partida."},{label:"TÉCNICA",value:player.skill,help:"Passe, domínio, drible, finalização e qualidade geral com a bola."},{label:"MARCAÇÃO",value:player.marking??3,help:"Desarme, posicionamento defensivo e recomposição."},{label:"INTELIGÊNCIA TÁTICA",value:player.tacticalIntelligence??3,help:"Ocupação de espaços, movimentação, leitura de jogo e tomada de decisão."},{label:"COMPETITIVIDADE",value:player.competitiveness??3,help:"Entrega, raça, disputa de bolas e comprometimento."}];
  return <div className="member-profile-layout"><section className={`member-card tier-${tier}`}><div className="member-card-top"><div className="member-overall"><strong>{overall.toFixed(1)}</strong><span className="member-overall-label">OVERALL</span>{config.cardTiersEnabled&&<em className="member-tier-badge">{playerCardTierLabel(tier)}</em>}</div><PlayerPhoto photoUrl={player.photoUrl} name={player.displayName} large /></div><h2>{player.displayName}</h2><div className="member-role"><span><small>TIPO</small><b>{player.type === "guest" ? "Convidado" : goalkeeper ? "Goleiro" : "Mensalista"}</b></span><span><small>POSIÇÃO</small><b>{player.primaryPosition}</b></span></div><div className="card-stats">{stats.map((stat,index)=><span key={stat.label}><b>{Number(stat.value).toFixed(1)}</b><small className="card-stat-label"><span>{stat.label}</span><MemberCardDisciplineHelp id={`member-card-discipline-${player.id}-${index}`} label={stat.label} text={stat.help}/></small></span>)}<span><b>{(player.momentum??0)>0?"+":""}{Number(player.momentum??0).toFixed(1)}</b><small>MOMENTUM</small></span></div><div className={`card-career-stats ${config.showContributions?'with-contributions':''}`}><span><b>{career.games}</b><small>JOGOS</small></span><span className="wins"><b>{career.wins}</b><small>VITÓRIAS</small></span><span className="losses"><b>{career.losses}</b><small>DERROTAS</small></span>{config.showContributions&&<><span className="goals"><b>{career.goals??0}</b><small>GOLS</small></span><span className="assists"><b>{career.assists??0}</b><small>ASSISTÊNCIAS</small></span></>}</div></section><section className="member-profile-actions"><div><div className="eyebrow">MEU PERFIL</div><h2>Informações do jogador</h2><p>Você pode manter seus dados pessoais atualizados. Notas esportivas e momentum continuam sob responsabilidade dos organizadores.</p></div><dl><div><dt>Nome completo</dt><dd>{player.fullName}</dd></div><div><dt>Apelido</dt><dd>{player.nickname || "Não informado"}</dd></div><div><dt>Posição</dt><dd>{player.primaryPosition}</dd></div><div><dt>Observações</dt><dd>{player.notes || "Nenhuma observação"}</dd></div></dl><button className="primary" onClick={onEdit}>Editar minhas informações</button></section></div>;
}

function MemberCardDisciplineHelp({id,label,text}:{id:string;label:string;text:string}) {
  return <span className="help-tip card-stat-help"><button type="button" aria-label={`Ver explicação de ${label}`} aria-describedby={id}>?</button><span id={id} role="tooltip">{text}</span></span>;
}

function MemberProfileForm({ player, onClose, onSaved }: { player: Player; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState({ fullName: player.fullName, nickname: player.nickname || "", primaryPosition: player.primaryPosition, notes: player.notes || "", photoUrl: player.photoUrl || null }), [uploading, setUploading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const set = (key: string, value: any) => setForm(current => ({ ...current, [key]: value }));
  async function upload(file?: File) { if (!file) return; setUploading(true); setError(""); try { const result = await api("/api/upload", { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: file }); set("photoUrl", result.url); } catch (cause: any) { setError(cause.message); } finally { setUploading(false); } }
  async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const result = await api("/api/member-profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }); await onSaved(result.message); } catch (cause: any) { setError(cause.message); } finally { setSaving(false); } }
  return <div className="modal-back"><form className="editor member-editor" onSubmit={save}><button className="close" type="button" onClick={onClose}>×</button><h2>Editar meu perfil</h2><p>As alterações ficam disponíveis imediatamente para os organizadores.</p>{error && <div className="alert error">{error}</div>}<div className="photo-editor"><PlayerPhoto photoUrl={form.photoUrl} name={player.displayName} /><div><label className="photo-upload">{uploading ? "Enviando…" : "Selecionar foto"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event => upload(event.target.files?.[0])} /></label>{form.photoUrl && <button type="button" onClick={() => set("photoUrl", null)}>Remover foto</button>}<small>JPG, PNG ou WebP de até 5 MB.</small></div></div><div className="form-grid"><label>Nome completo<input value={form.fullName} maxLength={120} onChange={event => set("fullName", event.target.value)} required /></label><label>Apelido<input value={form.nickname} maxLength={60} onChange={event => set("nickname", event.target.value)} /></label><label>Posição<select value={form.primaryPosition} onChange={event => set("primaryPosition", event.target.value)}><option>Defesa</option><option>Meio-campo</option><option>Ataque</option><option>Goleiro</option></select></label><label className="wide">Observações<textarea value={form.notes} maxLength={1000} onChange={event => set("notes", event.target.value)} /></label></div><div className="editor-actions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={uploading || saving}>{saving ? "Salvando…" : "Salvar alterações"}</button></div></form></div>;
}
