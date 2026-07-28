import { SiteHeader } from "../components/SiteHeader";
import { getMobileReleaseConfiguration } from "../../lib/mobile-release";
import { db, ensureDb } from "../../lib/database";
import { instanceConfigurationFromRow } from "../../lib/instance-config";

export const dynamic = "force-dynamic";

export default async function DownloadAppPage() {
  await ensureDb();
  const release = await getMobileReleaseConfiguration();
  const instance = instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
  return <div className="member-page"><SiteHeader active="home"/><main className="download-app-main">
    <section className="download-app-hero"><div className="eyebrow">APLICATIVO OFICIAL</div><h1>{instance.appName}<br/><em>sempre atualizado.</em></h1><p>Baixe a versão mais recente para seu aparelho. Esta página mantém os links oficiais definidos pelos organizadores da pelada.</p>{release.publishedAt && <span>Versão {release.latestVersion} · publicada em {new Date(release.publishedAt).toLocaleDateString("pt-BR")}</span>}</section>
    <div className="download-platform-grid">
      <DownloadPlatform platform="Android" icon="APK" enabled={release.androidEnabled} build={release.androidBuild} url={release.androidUrl} description="Instale o APK mais recente no seu celular Android."/>
      <DownloadPlatform platform="iOS" icon="iOS" enabled={release.iosEnabled} build={release.iosBuild} url={release.iosUrl} description="Abra o TestFlight ou a App Store para atualizar no iPhone."/>
    </div>
    {release.releaseNotes && <section className="download-release-notes"><div className="eyebrow">NOVIDADES DA VERSÃO {release.latestVersion}</div><p>{release.releaseNotes}</p></section>}
    <section className="download-app-help"><b>Instalação segura</b><p>Use apenas os botões desta página. No Android, o sistema pode pedir autorização para instalar o APK. No iOS, a instalação é concluída pelo TestFlight ou pela App Store.</p></section>
  </main></div>;
}

function DownloadPlatform({ platform, icon, enabled, build, url, description }: {
  platform: string; icon: string; enabled: boolean; build: number; url: string; description: string;
}) {
  return <article className={enabled && url ? "download-platform available" : "download-platform"}><span>{icon}</span><div><small>{enabled && url ? "DISPONÍVEL AGORA" : "INDISPONÍVEL"}</small><h2>{platform}</h2><p>{description}</p><em>Build {build}</em></div>{enabled && url ? <a className="primary" href={url} target="_blank" rel="noopener noreferrer">Baixar atualização ↓</a> : <b>Em breve</b>}</article>;
}
