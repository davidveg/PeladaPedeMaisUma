/* Administrative match lifecycle and attendance overrides. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, db, ensureDb, staffRequired, staffRequiredAny } from "../../../../lib/database";
import { broadcastAccountNotification } from "../../../../lib/account-notifications";
import { createSeparationFromMatch, loadScheduledMatches, setAttendance, setGuestPreconfirmation } from "../../../../lib/scheduled-matches";
import { resolvePublicBaseUrl } from "../../../../lib/public-url";
import { getRuntimeBindings } from "../../../../lib/runtime-bindings";
import { instanceConfigurationFromRow } from "../../../../lib/instance-config";
import { refreshMatchWeather } from "../../../../lib/match-weather";
import { refreshAutomaticAbsencesForMatch } from "../../../../lib/player-absence";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const admin: any = await staffRequiredAny(request,["MATCHES_MANAGE","MATCH_ATTENDANCE_MANAGE","MATCHES_CANCEL","SEPARATIONS_MANAGE"]);
  if (!admin) return Response.json({ error: "Sem permissão para acessar a gestão de partidas." }, { status: 403, headers: noStore });
  const baseUrl = resolvePublicBaseUrl(request, getRuntimeBindings().APP_BASE_URL);
  return Response.json(await loadScheduledMatches(admin, true, baseUrl, new URL(request.url).searchParams.get("id") || ""), { headers: noStore });
}

export async function POST(request: Request) {
  const admin: any = await staffRequired(request,"MATCHES_MANAGE");
  if (!admin) return Response.json({ error: "Sem permissão para criar partidas." }, { status: 403, headers: noStore });
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as any;
  const instance = instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
  const validation = validateMatch(payload, instance.defaultMatchLocation);
  if (validation.error) return Response.json({ error: validation.error }, { status: 400, headers: noStore });
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await db().prepare(
    `INSERT INTO scheduled_matches
     (id,title,match_at,confirmation_deadline,location,max_changes,status,created_by_administrator_id,created_at,updated_at)
     VALUES (?,?,?,?,?,?,'OPEN',?,?,?)`,
  ).bind(id, validation.title, validation.matchAt, validation.deadline, validation.location, validation.maxChanges, admin.id, now, now).run();
  await refreshAutomaticAbsencesForMatch(id);
  const created: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(id).first();
  if (created) await refreshMatchWeather(created, instance.defaultMatchLocation, true).catch(() => undefined);
  await audit(admin.id, "MATCH_CREATED", "scheduled_match", id, validation);
  await broadcastAccountNotification({
    type: "MATCH_CREATED",
    title: "Nova partida criada",
    body: `${validation.title}: confirme sua presença até ${formatDate(String(validation.deadline))}.`,
    matchId: id,
  });
  return Response.json({ id, message: "Partida criada e participantes notificados." }, { status: 201, headers: noStore });
}

export async function PATCH(request: Request) {
  const payload = await request.json().catch(() => ({})) as any;
  const action = String(payload.action || "update");
  const permission = action === "attendance" || action === "guest-preconfirmation" ? "MATCH_ATTENDANCE_MANAGE" : action === "cancel" ? "MATCHES_CANCEL" : action === "close" ? "SEPARATIONS_MANAGE" : "MATCHES_MANAGE";
  const admin: any = await staffRequired(request,permission);
  if (!admin) return Response.json({ error: "Este perfil moderador não possui permissão para esta operação." }, { status: 403, headers: noStore });
  await ensureDb();
  try {
    if (action === "guest-preconfirmation") {
      const result = await setGuestPreconfirmation({
        matchId: String(payload.matchId || ""),
        playerId: String(payload.playerId || ""),
        action: String(payload.guestAction || "").toUpperCase() as "ADD" | "REMOVE",
        account: admin,
      });
      return Response.json({ ok: true, changed: result.changed, message: result.message }, { headers: noStore });
    }
    if (action === "attendance") {
      const result = await setAttendance({
        matchId: String(payload.matchId || ""), playerId: String(payload.playerId || ""),
        status: String(payload.status || "").toUpperCase() as any, account: admin, administratorOverride: true,
      });
      if (result.changed) {
        const present = result.attendance.status === "PRESENT";
        await broadcastAccountNotification({
          type: "ATTENDANCE_CHANGED",
          title: present ? "Presença confirmada" : "Ausência informada",
          body: `${result.playerName} foi marcado como ${present ? "presente" : "ausente"} pelo administrador em ${result.match.title}.`,
          matchId: String(result.match.id),
        });
      }
      return Response.json({ ok: true, changed: result.changed, message: "Presença atualizada." }, { headers: noStore });
    }
    if (action === "close") {
      const result = await createSeparationFromMatch(String(payload.matchId || ""), admin, {
        result: payload.result,
        manuallyAdjusted: Boolean(payload.manuallyAdjusted),
      });
      if (!result.alreadyCreated) {
        await broadcastAccountNotification({
          type: "MATCH_CLOSED",
          title: "Lista de presença encerrada",
          body: `${result.match.title}: a escalação dos times já está disponível.`,
          matchId: String(result.match.id),
        });
      }
      return Response.json({ ok: true, separationId: result.separationId, message: result.alreadyCreated ? "A escalação desta partida já havia sido criada." : "Lista fechada e escalação criada." }, { headers: noStore });
    }
    if (action === "cancel") {
      const id = String(payload.matchId || ""), previous: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(id).first();
      if (!previous) return Response.json({ error: "Partida não encontrada." }, { status: 404, headers: noStore });
      if (previous.status !== "OPEN") return Response.json({ error: "Somente partidas abertas podem ser canceladas." }, { status: 409, headers: noStore });
      const now = new Date().toISOString();
      await db().batch([
        db().prepare(`UPDATE scheduled_matches SET status='CANCELLED',closed_at=?,updated_at=? WHERE id=?`).bind(now, now, id),
        db().prepare(`DELETE FROM match_separation_drafts WHERE match_id=?`).bind(id),
      ]);
      await audit(admin.id, "MATCH_CANCELLED", "scheduled_match", id, { status: "CANCELLED" }, previous);
      await broadcastAccountNotification({ type: "MATCH_CANCELLED", title: "Partida cancelada", body: `${previous.title} foi cancelada.`, matchId: id });
      return Response.json({ ok: true, message: "Partida cancelada." }, { headers: noStore });
    }

    const id = String(payload.matchId || ""), previous: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(id).first();
    if (!previous) return Response.json({ error: "Partida não encontrada." }, { status: 404, headers: noStore });
    if (previous.status !== "OPEN") return Response.json({ error: "Somente partidas abertas podem ser editadas." }, { status: 409, headers: noStore });
    const instance = instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
    const validation = validateMatch(payload, instance.defaultMatchLocation);
    if (validation.error) return Response.json({ error: validation.error }, { status: 400, headers: noStore });
    const now = new Date().toISOString();
    await db().prepare(
      `UPDATE scheduled_matches SET title=?,match_at=?,confirmation_deadline=?,location=?,max_changes=?,weather_snapshot=NULL,weather_updated_at=NULL,updated_at=? WHERE id=?`,
    ).bind(validation.title, validation.matchAt, validation.deadline, validation.location, validation.maxChanges, now, id).run();
    await refreshAutomaticAbsencesForMatch(id);
    const updated: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(id).first();
    if (updated) await refreshMatchWeather(updated, instance.defaultMatchLocation, true).catch(() => undefined);
    await audit(admin.id, "MATCH_UPDATED", "scheduled_match", id, validation, previous);
    await broadcastAccountNotification({
      type: "MATCH_UPDATED", title: "Partida atualizada",
      body: `${validation.title} teve data, local ou regras atualizados. Confira os detalhes.`,
      matchId: id,
    });
    return Response.json({ ok: true, message: "Partida atualizada e participantes notificados." }, { headers: noStore });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Não foi possível concluir a operação." }, { status: Number(error?.status || 400), headers: noStore });
  }
}

function validateMatch(payload: any, defaultLocation: string) {
  const title = String(payload.title || "").trim().slice(0, 120);
  const matchAt = validIso(payload.matchAt), deadline = validIso(payload.confirmationDeadline);
  const maxChanges = Math.floor(Number(payload.maxChanges));
  if (!title) return { error: "Informe o título da partida." };
  if (!matchAt || !deadline) return { error: "Informe datas e horários válidos." };
  if (new Date(deadline).getTime() > new Date(matchAt).getTime()) return { error: "O prazo de confirmação deve terminar antes do início da partida." };
  if (!Number.isInteger(maxChanges) || maxChanges < 0 || maxChanges > 20) return { error: "O limite de remarcações deve ficar entre 0 e 20." };
  return { title, matchAt, deadline, maxChanges, location: String(payload.location || "").trim().slice(0, 300) || defaultLocation, error: "" };
}

function validIso(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
