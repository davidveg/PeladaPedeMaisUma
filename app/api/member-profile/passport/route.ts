import { playerAccountRequired } from "../../../../lib/database";
import { loadPlayerSeasonPassport } from "../../../../lib/player-engagement-store";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: Request) {
  const member: any = await playerAccountRequired(request);
  if (!member) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (!member.playerId) return Response.json({ error: "Associe sua conta a um jogador para consultar o passaporte." }, { status: 403 });
  const url = new URL(request.url);
  const requestedSeason = Number(url.searchParams.get("season") || 0);
  const month = String(url.searchParams.get("month") || "");
  const passport = await loadPlayerSeasonPassport(
    { id: String(member.playerId), displayName: String(member.playerName || "Jogador") },
    Number.isInteger(requestedSeason) && requestedSeason > 0 ? requestedSeason : undefined,
    monthPattern.test(month) ? month : null,
  );
  return Response.json(passport, { headers: { "cache-control": "no-store" } });
}
