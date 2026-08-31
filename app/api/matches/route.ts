/* Shared web/mobile endpoint for authenticated match attendance. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { playerAccountRequired } from "../../../lib/database";
import { broadcastAccountNotification } from "../../../lib/account-notifications";
import { loadScheduledMatches, setAttendance } from "../../../lib/scheduled-matches";
import { resolvePublicBaseUrl } from "../../../lib/public-url";
import { getRuntimeBindings } from "../../../lib/runtime-bindings";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const baseUrl = resolvePublicBaseUrl(request, getRuntimeBindings().APP_BASE_URL);
  return Response.json(await loadScheduledMatches(account, false, baseUrl, new URL(request.url).searchParams.get("id") || ""), { headers: noStore });
}

export async function PUT(request: Request) {
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  const payload = await request.json().catch(() => ({})) as any;
  try {
    const result = await setAttendance({
      matchId: String(payload.matchId || ""),
      playerId: String(account.playerId || ""),
      status: String(payload.status || "").toUpperCase() as any,
      account,
    });
    if (result.changed) {
      const present = result.attendance.status === "PRESENT";
      await broadcastAccountNotification({
        type: "ATTENDANCE_CHANGED",
        title: present ? "Presença confirmada" : "Ausência informada",
        body: `${result.playerName} ${present ? "confirmou presença" : "informou que não irá"} em ${result.match.title}.`,
        matchId: String(result.match.id),
      });
    }
    return Response.json({ ok: true, changed: result.changed, attendance: result.attendance }, { headers: noStore });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Não foi possível registrar a resposta." }, { status: Number(error?.status || 400), headers: noStore });
  }
}
