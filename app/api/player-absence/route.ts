import { audit, playerAccountRequired } from "../../../lib/database";
import { getPlayerAbsence, removePlayerAbsence, savePlayerAbsence } from "../../../lib/player-absence";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  if (!account.playerId) return Response.json({ absence: null }, { headers: noStore });
  return Response.json({ absence: await getPlayerAbsence(String(account.playerId)) }, { headers: noStore });
}

export async function PUT(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account?.playerId) return Response.json({ error: "Associe sua conta a um jogador para informar uma ausência." }, { status: 403, headers: noStore });
  try {
    const payload = await request.json().catch(() => ({}));
    const result = await savePlayerAbsence(String(account.playerId), payload);
    await audit(account.accountType === "administrator" ? account.id : null, "PLAYER_ABSENCE_SAVED", "player_absence", result.absence?.id, {
      playerId: account.playerId, startDate: result.absence?.startDate, endDate: result.absence?.endDate,
      reason: result.absence?.reason, affectedMatches: result.affectedMatches, accountId: account.id, accountType: account.accountType,
    }, result.previous);
    const suffix = result.affectedMatches === 1 ? "1 partida aberta foi atualizada." : `${result.affectedMatches} partidas abertas foram atualizadas.`;
    return Response.json({ absence: result.absence, affectedMatches: result.affectedMatches, message: `Período de ausência salvo. ${suffix}` }, { headers: noStore });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Não foi possível salvar o período de ausência." }, { status: Number(error?.status || 400), headers: noStore });
  }
}

export async function DELETE(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account?.playerId) return Response.json({ error: "Associe sua conta a um jogador para alterar a ausência." }, { status: 403, headers: noStore });
  const result = await removePlayerAbsence(String(account.playerId));
  if (result.previous) await audit(account.accountType === "administrator" ? account.id : null, "PLAYER_ABSENCE_REMOVED", "player_absence", result.previous.id, {
    playerId: account.playerId, restoredMatches: result.restoredMatches, accountId: account.id, accountType: account.accountType,
  }, result.previous);
  return Response.json({ absence: null, restoredMatches: result.restoredMatches, message: "Período de ausência removido." }, { headers: noStore });
}
