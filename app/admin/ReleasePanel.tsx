"use client";

import { useEffect, useState } from "react";

type Release = {
  latestVersion: string;
  androidBuild: number;
  iosBuild: number;
  minimumAndroidBuild: number;
  minimumIosBuild: number;
  androidEnabled: boolean;
  iosEnabled: boolean;
  androidUrl: string;
  iosUrl: string;
  releaseNotes: string;
  publishedAt: string | null;
};
type Props = {
  api(url: string, options?: RequestInit): Promise<unknown>;
  setError(value: string): void;
  setNotice(value: string): void;
};
type ReleaseApiResponse = { release: Release; message?: string };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

export function ReleasePanel({ api, setError, setNotice }: Props) {
  const [release, setRelease] = useState<Release | null>(null), [busy, setBusy] = useState<"save" | "publish" | "">("");
  // The panel loads once when its tab is mounted.
  useEffect(() => {
    api("/api/admin/mobile-release")
      .then(result => setRelease((result as ReleaseApiResponse).release))
      .catch(error => setError(errorMessage(error)));
    // The parent owns these callbacks; mounting this tab is the reload boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = <K extends keyof Release>(key: K, value: Release[K]) => setRelease(current => current ? { ...current, [key]: value } : current);
  async function submit(publish: boolean) {
    if (!release) return;
    if (publish && !confirm(`Publicar a versão ${release.latestVersion} e avisar todos os usuários agora?`)) return;
    setBusy(publish ? "publish" : "save"); setError(""); setNotice("");
    try {
      const result = await api("/api/admin/mobile-release", {
        method: publish ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(release),
      }) as ReleaseApiResponse;
      setRelease(result.release); setNotice(result.message || (publish ? "Versão publicada." : "Rascunho salvo."));
    } catch (error: unknown) { setError(errorMessage(error)); } finally { setBusy(""); }
  }
  if (!release) return <div className="admin-card match-admin-empty">Carregando configuração das versões…</div>;
  return <div className="release-admin-layout">
    <section className="admin-card release-admin-intro"><div><small>VERSÃO ATIVA</small><h2>{release.latestVersion}</h2><p>{release.publishedAt ? `Publicada em ${new Date(release.publishedAt).toLocaleString("pt-BR")}` : "Ainda não publicada. Salve o rascunho e publique quando os arquivos estiverem disponíveis."}</p></div><a className="ghost" href="/baixar-app" target="_blank" rel="noreferrer">Ver página de download ↗</a></section>
    <section className="admin-card release-admin-form">
      <div className="release-form-heading"><div><small>PUBLICAÇÃO MOBILE</small><h2>Versão e compatibilidade</h2><p>O número de build define se o aparelho precisa atualizar. A versão é o nome exibido ao usuário.</p></div></div>
      <div className="release-version-grid"><label>Versão pública<input value={release.latestVersion} onChange={event => set("latestVersion", event.target.value)} placeholder="1.2.0"/></label><label>Notas da versão<textarea value={release.releaseNotes} onChange={event => set("releaseNotes", event.target.value)} placeholder="Descreva as principais novidades…"/></label></div>
      <PlatformRelease title="Android" enabled={release.androidEnabled} build={release.androidBuild} minimumBuild={release.minimumAndroidBuild} url={release.androidUrl} urlPlaceholder="https://…/PeladaPedeMaisUma.apk" onEnabled={value => set("androidEnabled", value)} onBuild={value => set("androidBuild", value)} onMinimumBuild={value => set("minimumAndroidBuild", value)} onUrl={value => set("androidUrl", value)}/>
      <PlatformRelease title="iOS" enabled={release.iosEnabled} build={release.iosBuild} minimumBuild={release.minimumIosBuild} url={release.iosUrl} urlPlaceholder="https://testflight.apple.com/join/…" onEnabled={value => set("iosEnabled", value)} onBuild={value => set("iosBuild", value)} onMinimumBuild={value => set("minimumIosBuild", value)} onUrl={value => set("iosUrl", value)}/>
      <div className="release-admin-help"><b>Como funciona</b><span>Build instalada menor que a publicada: atualização opcional.</span><span>Build instalada menor que a mínima: atualização obrigatória e bloqueante.</span><span>“Salvar rascunho” não avisa ninguém. “Publicar” cria aviso interno e envia push conforme as preferências de cada conta.</span></div>
      <div className="release-admin-actions"><button className="ghost" disabled={Boolean(busy)} onClick={() => submit(false)}>{busy === "save" ? "Salvando…" : "Salvar rascunho"}</button><button className="primary" disabled={Boolean(busy)} onClick={() => submit(true)}>{busy === "publish" ? "Publicando…" : "Publicar e notificar usuários"}</button></div>
    </section>
  </div>;
}

function PlatformRelease({ title, enabled, build, minimumBuild, url, urlPlaceholder, onEnabled, onBuild, onMinimumBuild, onUrl }: {
  title: string; enabled: boolean; build: number; minimumBuild: number; url: string; urlPlaceholder: string;
  onEnabled(value: boolean): void; onBuild(value: number): void; onMinimumBuild(value: number): void; onUrl(value: string): void;
}) {
  return <fieldset className={enabled ? "release-platform enabled" : "release-platform"}><legend><span>{title}</span><label className="release-platform-toggle"><input type="checkbox" checked={enabled} onChange={event => onEnabled(event.target.checked)}/> Disponibilizar</label></legend><div><label>Build publicada<input type="number" min="1" step="1" value={build} onChange={event => onBuild(Number(event.target.value))}/></label><label>Build mínima<input type="number" min="1" step="1" value={minimumBuild} onChange={event => onMinimumBuild(Number(event.target.value))}/></label><label>Link de instalação<input type="url" value={url} onChange={event => onUrl(event.target.value)} placeholder={urlPlaceholder}/></label></div></fieldset>;
}
