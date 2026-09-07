import { playerAccountRequired } from "../../../lib/database";

const disabled = () => Response.json({ error: "A associação de jogador exige aprovação de um administrador." }, { status: 403, headers: { "cache-control": "no-store" } });

export async function GET(request: Request) {
  const member = await playerAccountRequired(request);
  if (!member) return Response.json({ error: "Não autorizado." }, { status: 401 });
  return disabled();
}

export async function POST(request: Request) {
  const member = await playerAccountRequired(request);
  if (!member) return Response.json({ error: "Não autorizado." }, { status: 401 });
  return disabled();
}
