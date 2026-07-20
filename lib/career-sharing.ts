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

export function buildWhatsAppCareerResultsMessage({matchTitle,blueScore,yellowScore,results,names,separationUrl}:{matchTitle:string;blueScore:number;yellowScore:number;results:any;names:Record<string,string>;separationUrl?:string}) {
  const ball=String.fromCodePoint(0x26bd,0xfe0f),trophy=String.fromCodePoint(0x1f3c6),chart=String.fromCodePoint(0x1f4ca),warning=String.fromCodePoint(0x26a0,0xfe0f),medals=[0x1f947,0x1f948,0x1f949].map(code=>String.fromCodePoint(code));
  const title=matchTitle.replace(/\*/g,"").trim(),signed=(value:number)=>`${value>0?"+":""}${Number(value).toFixed(1)}`;
  const podium=(entries:any[])=>(entries||[]).map((entry:any,index:number)=>`${medals[index]||`${entry.place}º`} ${names[entry.playerId]||"Jogador"} (${signed(entry.momentum)})`).join("\n");
  const voteCount=Number(results?.voteCount||0),details=voteCount?`${trophy} *Man of the Match*\n${podium(results.motm)}\n\n${warning} *Deception of the Match*\n${podium(results.dotm)}`:"Votação encerrada sem votos válidos.";
  const link=separationUrl?`\n\n${chart} *Veja os detalhes da partida:*\n${separationUrl}`:"";
  return `${ball} *PELADA PEDE MAIS UMA*\n\n${trophy} *Resultado da votação*\n${title}\n\n*Placar:* Azul ${blueScore} × ${yellowScore} Amarelo\n*Votos registrados:* ${voteCount}\n\n${details}${link}`;
}
