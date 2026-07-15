export function buildVotingUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/votacao?token=${encodeURIComponent(token)}`;
}

export function buildWhatsAppVotingMessage({
  matchTitle,
  votingUrl,
  closesAt,
}: {
  matchTitle: string;
  votingUrl: string;
  closesAt?: string;
}): string {
  // Construímos os símbolos por code point para que nenhuma etapa de build,
  // container ou proxy possa reinterpretar os bytes UTF-8 do arquivo-fonte.
  const ball = String.fromCodePoint(0x26bd, 0xfe0f);
  const trophy = String.fromCodePoint(0x1f3c6);
  const pointing = String.fromCodePoint(0x1f449);
  const hourglass = String.fromCodePoint(0x23f3);
  const title = matchTitle.replace(/\*/g, "").trim();
  const deadline = closesAt
    ? `\n\n${hourglass} Votação disponível até ${new Date(closesAt).toLocaleString("pt-BR")}.`
    : "";

  return `${ball} *PELADA PEDE MAIS UMA*\n\n${trophy} *Votação dos destaques*\n${title}\n\nEscolha os 3 melhores e os 3 que ficaram devendo na partida.\n\n${pointing} *Acesse e vote:*\n${votingUrl}${deadline}`;
}

export function buildWhatsAppShareUrl(message: string): string {
  const url = new URL("https://api.whatsapp.com/send");
  url.searchParams.set("text", message);
  return url.toString();
}
