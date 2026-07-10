import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pelada Pede Mais Uma",
  description: "Monte times de futebol equilibrados a partir da lista do WhatsApp.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = `${protocol}://${host}`;
  return {
    title: "Pelada Pede Mais Uma",
    description: "Times equilibrados. Resenha garantida.",
    openGraph: { title: "Pelada Pede Mais Uma", description: "Times equilibrados. Resenha garantida.", images: [{ url: `${base}/og.png`, width: 1734, height: 897 }] },
    twitter: { card: "summary_large_image", title: "Pelada Pede Mais Uma", description: "Times equilibrados. Resenha garantida.", images: [`${base}/og.png`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
