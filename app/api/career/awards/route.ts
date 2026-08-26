import { finalizeMonthlyCareerAward, finalizeSeasonAwards, getCareerAwardControl } from "../../../../lib/career-awards";
import { resetCareerSeasonNow } from "../../../../lib/career-season";
import { finalizeCareerMatch, getCareerConfig } from "../../../../lib/career-service";
import { adminRequired, db, ensureDb } from "../../../../lib/database";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado" }, { status: 401 });
  return Response.json({ awards: await getCareerAwardControl() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const administrator: any = await adminRequired(request);
  if (!administrator) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as any, action = String(payload.action || "");
  try {
    if (payload.confirmation !== action || !["FINALIZE_MONTH", "FINALIZE_SEASON"].includes(action)) {
      throw statusError("A confirmação final do encerramento não foi recebida.", 400);
    }
    if (action === "FINALIZE_MONTH") {
      const month = String(payload.month || "");
      if (!monthPattern.test(month)) throw statusError("Selecione um mês válido.", 400);
      if (month > new Date().toISOString().slice(0, 7)) throw statusError("Não é possível encerrar um mês futuro.", 400);
      await finalizeOpenVotes(month, administrator.id);
      const result = await finalizeMonthlyCareerAward(month, "MANUAL_MONTH", administrator.id);
      return Response.json({ ok: true, award: result.award, message: result.created ? `Resultados de ${monthLabel(month)} consolidados.` : `Os resultados de ${monthLabel(month)} já estavam consolidados.` });
    }
    if (action === "FINALIZE_SEASON") {
      const config = await getCareerConfig(), today = new Date().toISOString().slice(0, 10);
      const rows = (await db().prepare(`SELECT c.id,c.status,c.config_snapshot,s.match_date FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL AND s.match_date<=? ORDER BY s.match_date`).bind(today).all()).results as any[];
      const seasonRows = rows.filter(row => Number(parseJson(row.config_snapshot, {}).seasonNumber ?? 1) === config.seasonNumber);
      if (!seasonRows.length) throw statusError("A temporada atual ainda não possui partidas com resultado.", 409);
      if (seasonRows.some(row => row.status === "FINALIZING")) throw statusError("Uma votação da temporada já está sendo encerrada. Aguarde e tente novamente.", 409);
      for (const row of seasonRows) if (row.status === "OPEN") await finalizeCareerMatch(String(row.id), administrator.id);
      const months = [...new Set(seasonRows.map(row => String(row.match_date).slice(0, 7)).filter(month => monthPattern.test(month)))].sort();
      for (const month of months) await finalizeMonthlyCareerAward(month, "MANUAL_SEASON", administrator.id);
      const seasonAwards = await finalizeSeasonAwards({ seasonNumber: config.seasonNumber, startedAt: config.seasonStartedAt || null, endedAt: today, administratorId: administrator.id });
      const next = await resetCareerSeasonNow(administrator.id);
      return Response.json({ ok: true, seasonAwards: seasonAwards.snapshot, season: next, message: `Temporada ${config.seasonNumber} encerrada; os resultados foram preservados e a temporada ${next.seasonNumber} foi iniciada.` });
    }
    throw statusError("Ação de encerramento inválida.", 400);
  } catch (error: any) {
    return Response.json({ error: error?.message || "Não foi possível consolidar os resultados." }, { status: Number(error?.status || 400) });
  }
}

async function finalizeOpenVotes(month: string, administratorId: string) {
  const rows = (await db().prepare(`SELECT c.id,c.status FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL AND substr(s.match_date,1,7)=?`).bind(month).all()).results as any[];
  if (!rows.length) throw statusError("Não há partidas com resultado registrado neste mês.", 409);
  if (rows.some(row => row.status === "FINALIZING")) throw statusError("Uma votação deste mês já está sendo encerrada. Aguarde e tente novamente.", 409);
  for (const row of rows) if (row.status === "OPEN") await finalizeCareerMatch(String(row.id), administratorId);
}

function parseJson(value: unknown, fallback: any) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
function statusError(message: string, status: number) { return Object.assign(new Error(message), { status }); }
function monthLabel(month: string) { const [year, value] = month.split("-").map(Number); return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, value - 1, 1)); }
