import type { Metadata } from "next";
import { headers } from "next/headers";
import { db, ensureDb } from "../lib/database";
import { DEFAULT_INSTANCE_CONFIGURATION, instanceConfigurationFromRow } from "../lib/instance-config";
import { instanceFaviconUrl, instanceShareImageUrl } from "../lib/instance-metadata";
import { getRuntimeBindings } from "../lib/runtime-bindings";
import { InstanceBrandingProvider } from "./InstanceBranding";
import "./globals.css";
import "./branding.css";

const siteIcons: Metadata["icons"] = {
  icon: [
    { url: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
    { url: "/favicon.png", sizes: "512x512", type: "image/png" },
  ],
  shortcut: "/favicon.ico",
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
};

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  let configuredBase = "";
  try { configuredBase = getRuntimeBindings().APP_BASE_URL?.trim() || ""; } catch { /* Usa os cabeçalhos da requisição durante o build local. */ }
  let base = `${protocol}://${host}`;
  if (configuredBase) {
    try { base = new URL(configuredBase).toString().replace(/\/$/, ""); } catch { /* Ignora APP_BASE_URL inválida e usa a origem recebida. */ }
  }
  let instance = DEFAULT_INSTANCE_CONFIGURATION;
  try {
    await ensureDb();
    instance = instanceConfigurationFromRow(await db().prepare("SELECT * FROM instance_configuration WHERE id=1").first());
  } catch {
    // Mantém metadados válidos enquanto os bindings ainda não estiverem disponíveis no build.
  }
  const image = instanceShareImageUrl(instance, base);
  const favicon = instanceFaviconUrl(instance);
  return {
    metadataBase: new URL(base),
    title: instance.siteName,
    description: instance.siteTagline,
    icons: favicon ? { icon: [{ url: favicon }], shortcut: favicon, apple: [{ url: favicon }] } : siteIcons,
    openGraph: { type: "website", url: base, siteName: instance.siteName, title: instance.siteName, description: instance.siteTagline, images: [{ url: image }], ...(instance.updatedAt ? { modifiedTime: instance.updatedAt } : {}) },
    twitter: { card: "summary_large_image", title: instance.siteName, description: instance.siteTagline, images: [image] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let instance = DEFAULT_INSTANCE_CONFIGURATION;
  try {
    await ensureDb();
    instance = instanceConfigurationFromRow(await db().prepare("SELECT * FROM instance_configuration WHERE id=1").first());
  } catch {
    // O provedor mantém os padrões durante builds sem acesso ao banco.
  }
  return (
    <html lang="pt-BR">
      <body><InstanceBrandingProvider initialConfig={instance}>{children}</InstanceBrandingProvider></body>
    </html>
  );
}
