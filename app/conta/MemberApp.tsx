"use client";

import { useEffect, useState } from "react";
import type { Config, Player } from "../../lib/football";
import { defaultConfig, score } from "../../lib/football";
import { PlayerPhoto } from "../components/PlayerPhoto";

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options), text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export default function MemberApp() {
  const [member, setMember] = useState<any>(undefined), [player, setPlayer] = useState<Player | null>(null), [config, setConfig] = useState<Config>(defaultConfig), [available, setAvailable] = useState<any[]>([]), [error, setError] = useState(""), [notice, setNotice] = useState(""), [editing, setEditing] = useState(false);
  async function load() {
    const auth = await api("/api/member-auth");
    setMember(auth.member);
    if (!auth.member) { setPlayer(null); setAvailable([]); return; }
    const profile = await api("/api/member-profile");
    setMember(profile.member); setPlayer(profile.player); setConfig({ ...defaultConfig, ...(profile.config || {}) });
    if (!profile.player) setAvailable((await api("/api/member-players")).players || []); else setAvailable([]);
  }
  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);
  async function logout() { await api("/api/member-auth", { method: "DELETE" }); setMember(null); setPlayer(null); }
  async function associate(candidate: any) {
    if (!confirm(`Confirmar a associação da sua conta com ${candidate.displayName}? Depois disso, somente um administrador poderá desfazer a associação.`)) return;
    setError("");
    try { const result = await api("/api/member-players", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId: candidate.id }) }); setNotice(result.message); await load(); } catch (cause: any) { setError(cause.message); }
  }
  if (member === undefined) return <div className="member-loading">Carregando sua conta…</div>;
  if (!member) return <MemberAccess onDone={load} />;
  return <div className="member-page"><header className="member-header"><a href="/" className="brand"><span className="brand-mark">⚽</span><span><b>Pelada</b><small>Pede Mais Uma</small></span></a><nav>{member.accountType === "administrator" && <a href="/admin">Painel administrativo</a>}<a href="/">Área pública</a><button onClick={logout}>Sair</button></nav></header><main className="member-main"><div className="member-account-head"><div><div className="eyebrow">MINHA CONTA</div><h1>{player ? `Olá, ${player.displayName}` : "Associe seu jogador"}</h1><p>{member.email}{member.accountType === "administrator" ? " · Administrador" : ""}</p></div></div>{error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="admin-notice" role="status"><span>✓</span><b>{notice}</b><button onClick={() => setNotice("")} aria-label="Fechar mensagem">×</button></div>}{!player ? <AssociationPicker players={available} onSelect={associate} /> : <MemberProfile player={player} config={config} onEdit={() => setEditing(true)} />}</main>{editing && player && <MemberProfileForm player={player} onClose={() => setEditing(false)} onSaved={async message => { setEditing(false); setNotice(message); await load(); }} />}</div>;
}

function MemberAccess({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login"), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await api("/api/member-auth", { method: mode === "login" ? "POST" : "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, confirmation }) }); await onDone(); } catch (cause: any) { setError(cause.message); } finally { setBusy(false); }
  }
  return <div className="member-access"><section className="member-access-copy"><a href="/">⚽ <b>Pelada Pede Mais Uma</b></a><div><span>ÁREA DO JOGADOR</span><h1>Seus números,<br />seu perfil, sua pelada.</h1><p>Associe sua conta ao seu jogador e acompanhe atributos, momentum e histórico de partidas.</p></div><small>Jogadores e administradores usam suas próprias credenciais.</small></section><form className="member-access-card" onSubmit={submit}><div className="member-access-tabs"><button type="button" className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button><button type="button" className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError(""); }}>Criar conta</button></div><div className="ball">⚽</div><h2>{mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}</h2><p>{mode === "login" ? "Jogadores e administradores podem entrar com seu e-mail e senha." : "Depois do cadastro, você escolherá seu nome na lista de jogadores disponíveis."}</p>{error && <div className="alert error">{error}</div>}<label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label><label>Senha<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>{mode === "register" && <label>Confirmar senha<input type="password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" required /><small>Mínimo de 8 caracteres.</small></label>}<button className="primary" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? "Entrar →" : "Cadastrar e continuar →"}</button><a href="/">← Voltar para a área pública</a></form></div>;
}

function AssociationPicker({ players, onSelect }: { players: any[]; onSelect: (player: any) => void }) {
  const [query, setQuery] = useState("");
  const filtered = players.filter(player => [player.displayName, player.primaryPosition, player.type === "guest" ? "Convidado" : "Mensalista"].some(value => value.toLowerCase().includes(query.toLowerCase())));
  return <section className="association-picker"><div className="association-warning"><b>Escolha com atenção</b><p>A associação é exclusiva e não poderá ser alterada por você. Se selecionar o jogador errado, será necessário solicitar a correção a um administrador.</p></div><label>Buscar meu jogador<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Digite seu nome ou apelido…" /></label><div className="association-grid">{filtered.map(candidate => <button key={candidate.id} onClick={() => onSelect(candidate)}><PlayerPhoto photoUrl={candidate.photoUrl} name={candidate.displayName} /><span><b>{candidate.displayName}</b><small>{candidate.type === "guest" ? "Convidado" : candidate.type === "goalkeeper" ? "Goleiro" : "Mensalista"} · {candidate.primaryPosition}</small></span><i>Associar →</i></button>)}</div>{filtered.length === 0 && <div className="member-empty">Nenhum jogador disponível com esse nome. Fale com um administrador caso seu cadastro ainda não exista.</div>}</section>;
}

function MemberProfile({ player, config, onEdit }: { player: Player; config: Config; onEdit: () => void }) {
  const goalkeeper = player.type === "goalkeeper" || player.primaryPosition === "Goleiro", career = player.careerStats ?? { games: 0, wins: 0, losses: 0 };
  return <div className="member-profile-layout"><section className="member-card"><div className="member-card-top"><div className="member-overall"><strong>{score(player, config).toFixed(1)}</strong><span>OVERALL</span></div><PlayerPhoto photoUrl={player.photoUrl} name={player.displayName} large /></div><h2>{player.displayName}</h2><div className="member-role"><span><small>TIPO</small><b>{player.type === "guest" ? "Convidado" : goalkeeper ? "Goleiro" : "Mensalista"}</b></span><span><small>POSIÇÃO</small><b>{player.primaryPosition}</b></span></div><div className="member-attributes">{goalkeeper ? <><Attribute label="POSICIONAMENTO" value={player.goalkeeperPositioning ?? player.speed} /><Attribute label="HABILIDADE" value={player.skill} /><Attribute label="SAÍDA DE GOL" value={player.goalExit ?? player.marking ?? 3} /></> : <><Attribute label="VELOCIDADE" value={player.speed} /><Attribute label="HABILIDADE" value={player.skill} /><Attribute label="MARCAÇÃO" value={player.marking ?? 3} /></>}<Attribute label="MOMENTUM" value={player.momentum ?? 0} signed /></div><div className="card-career-stats"><span><b>{career.games}</b><small>JOGOS</small></span><span className="wins"><b>{career.wins}</b><small>VITÓRIAS</small></span><span className="losses"><b>{career.losses}</b><small>DERROTAS</small></span></div></section><section className="member-profile-actions"><div><div className="eyebrow">MEU PERFIL</div><h2>Informações do jogador</h2><p>Você pode manter seus dados pessoais atualizados. Notas esportivas e momentum continuam sob responsabilidade dos organizadores.</p></div><dl><div><dt>Nome completo</dt><dd>{player.fullName}</dd></div><div><dt>Apelido</dt><dd>{player.nickname || "Não informado"}</dd></div><div><dt>Posição</dt><dd>{player.primaryPosition}</dd></div><div><dt>Observações</dt><dd>{player.notes || "Nenhuma observação"}</dd></div></dl><button className="primary" onClick={onEdit}>Editar minhas informações</button></section></div>;
}

function Attribute({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) { return <span><b>{signed && value > 0 ? "+" : ""}{Number(value).toFixed(1)}</b><small>{label}</small></span>; }

function MemberProfileForm({ player, onClose, onSaved }: { player: Player; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState({ fullName: player.fullName, nickname: player.nickname || "", primaryPosition: player.primaryPosition, notes: player.notes || "", photoUrl: player.photoUrl || null }), [uploading, setUploading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const set = (key: string, value: any) => setForm(current => ({ ...current, [key]: value }));
  async function upload(file?: File) { if (!file) return; setUploading(true); setError(""); try { const result = await api("/api/upload", { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: file }); set("photoUrl", result.url); } catch (cause: any) { setError(cause.message); } finally { setUploading(false); } }
  async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const result = await api("/api/member-profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) }); await onSaved(result.message); } catch (cause: any) { setError(cause.message); } finally { setSaving(false); } }
  return <div className="modal-back"><form className="editor member-editor" onSubmit={save}><button className="close" type="button" onClick={onClose}>×</button><h2>Editar meu perfil</h2><p>As alterações ficam disponíveis imediatamente para os organizadores.</p>{error && <div className="alert error">{error}</div>}<div className="photo-editor"><PlayerPhoto photoUrl={form.photoUrl} name={player.displayName} /><div><label className="photo-upload">{uploading ? "Enviando…" : "Selecionar foto"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event => upload(event.target.files?.[0])} /></label>{form.photoUrl && <button type="button" onClick={() => set("photoUrl", null)}>Remover foto</button>}<small>JPG, PNG ou WebP de até 5 MB.</small></div></div><div className="form-grid"><label>Nome completo<input value={form.fullName} maxLength={120} onChange={event => set("fullName", event.target.value)} required /></label><label>Apelido<input value={form.nickname} maxLength={60} onChange={event => set("nickname", event.target.value)} /></label><label>Posição<select value={form.primaryPosition} onChange={event => set("primaryPosition", event.target.value)}><option>Defesa</option><option>Meio-campo</option><option>Ataque</option><option>Goleiro</option></select></label><label className="wide">Observações<textarea value={form.notes} maxLength={1000} onChange={event => set("notes", event.target.value)} /></label></div><div className="editor-actions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={uploading || saving}>{saving ? "Salvando…" : "Salvar alterações"}</button></div></form></div>;
}
