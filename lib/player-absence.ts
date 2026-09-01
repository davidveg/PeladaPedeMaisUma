/* Long absences automatically answer open attendance lists without consuming rematches. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb } from "./database";

export type PlayerAbsence = {
  id: string;
  playerId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export function validatePlayerAbsence(input: any) {
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  const reason = String(input?.reason || "").trim();
  if (!validCalendarDate(startDate) || !validCalendarDate(endDate)) {
    return { error: "Informe datas válidas para o início e o fim da ausência." };
  }
  if (startDate > endDate) return { error: "A data final deve ser igual ou posterior à data inicial." };
  const duration = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
  if (duration > 730) return { error: "O período de ausência pode ter no máximo 2 anos." };
  if (reason.length > 160) return { error: "O motivo pode ter no máximo 160 caracteres." };
  return { startDate, endDate, reason: reason || null, error: "" };
}

export async function getPlayerAbsence(playerId: string): Promise<PlayerAbsence | null> {
  await ensureDb();
  const row: any = await db().prepare(`SELECT * FROM player_absence_periods WHERE player_id=?`).bind(playerId).first();
  return row ? mapAbsence(row) : null;
}

export async function savePlayerAbsence(playerId: string, input: any) {
  await ensureDb();
  const validation = validatePlayerAbsence(input);
  if (validation.error) throw statusError(validation.error, 400);
  const previous: any = await db().prepare(`SELECT * FROM player_absence_periods WHERE player_id=?`).bind(playerId).first();
  const id = String(previous?.id || crypto.randomUUID()), now = new Date().toISOString();
  if (previous) await restoreAutomaticAttendance({ playerId, absencePeriodId: id });
  await db().prepare(
    `INSERT INTO player_absence_periods (id,player_id,start_date,end_date,reason,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(player_id) DO UPDATE SET start_date=excluded.start_date,end_date=excluded.end_date,
       reason=excluded.reason,updated_at=excluded.updated_at`,
  ).bind(id, playerId, validation.startDate, validation.endDate, validation.reason, previous?.created_at || now, now).run();
  const affectedMatches = await applyAbsenceToOpenMatches({ id, player_id: playerId, start_date: validation.startDate, end_date: validation.endDate });
  return { absence: await getPlayerAbsence(playerId), previous: previous ? mapAbsence(previous) : null, affectedMatches };
}

export async function removePlayerAbsence(playerId: string) {
  await ensureDb();
  const previous: any = await db().prepare(`SELECT * FROM player_absence_periods WHERE player_id=?`).bind(playerId).first();
  if (!previous) return { previous: null, restoredMatches: 0 };
  const restoredMatches = await restoreAutomaticAttendance({ playerId, absencePeriodId: String(previous.id) });
  await db().prepare(`DELETE FROM player_absence_periods WHERE id=? AND player_id=?`).bind(previous.id, playerId).run();
  return { previous: mapAbsence(previous), restoredMatches };
}

export async function refreshAutomaticAbsencesForMatch(matchId: string) {
  await ensureDb();
  await restoreAutomaticAttendance({ matchId });
  const match: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(matchId).first();
  if (!match || match.status !== "OPEN" || new Date(match.confirmation_deadline).getTime() < Date.now()) return 0;
  const timezone = await configuredTimezone();
  const matchDate = dateInTimezone(String(match.match_at), timezone);
  const rows = (await db().prepare(
    `SELECT * FROM player_absence_periods WHERE start_date<=? AND end_date>=?`,
  ).bind(matchDate, matchDate).all()).results as any[];
  let affected = 0;
  for (const absence of rows) affected += await applyAutomaticAttendance(matchId, absence);
  return affected;
}

async function applyAbsenceToOpenMatches(absence: any) {
  const timezone = await configuredTimezone();
  const rows = (await db().prepare(
    `SELECT * FROM scheduled_matches WHERE status='OPEN' AND confirmation_deadline>=? ORDER BY match_at`,
  ).bind(new Date().toISOString()).all()).results as any[];
  let affected = 0;
  for (const match of rows) {
    const matchDate = dateInTimezone(String(match.match_at), timezone);
    if (matchDate >= absence.start_date && matchDate <= absence.end_date) {
      affected += await applyAutomaticAttendance(String(match.id), absence);
    }
  }
  return affected;
}

async function applyAutomaticAttendance(matchId: string, absence: any) {
  const previous: any = await db().prepare(
    `SELECT * FROM match_attendance WHERE match_id=? AND player_id=?`,
  ).bind(matchId, absence.player_id).first();
  if (previous?.absence_period_id === absence.id && previous.status === "ABSENT") return 0;
  const now = new Date().toISOString();
  if (previous) {
    await db().prepare(
      `UPDATE match_attendance SET status='ABSENT',absence_period_id=?,absence_previous_status=?,
       absence_previous_change_count=?,updated_by_administrator_id=NULL,updated_at=? WHERE id=?`,
    ).bind(absence.id, previous.status, Number(previous.change_count || 0), now, previous.id).run();
  } else {
    await db().prepare(
      `INSERT INTO match_attendance
       (id,match_id,player_id,status,change_count,responded_by_account_type,responded_by_account_id,
        updated_by_administrator_id,absence_period_id,absence_previous_status,absence_previous_change_count,created_at,updated_at)
       VALUES (?,?,?,'ABSENT',0,'automatic',NULL,NULL,?,NULL,NULL,?,?)`,
    ).bind(crypto.randomUUID(), matchId, absence.player_id, absence.id, now, now).run();
  }
  await db().prepare(`DELETE FROM match_guest_preconfirmations WHERE match_id=? AND player_id=?`).bind(matchId, absence.player_id).run();
  return 1;
}

async function restoreAutomaticAttendance(filters: { playerId?: string; absencePeriodId?: string; matchId?: string }) {
  const conditions = ["a.absence_period_id IS NOT NULL", "m.status='OPEN'"];
  const values: string[] = [];
  if (filters.playerId) { conditions.push("a.player_id=?"); values.push(filters.playerId); }
  if (filters.absencePeriodId) { conditions.push("a.absence_period_id=?"); values.push(filters.absencePeriodId); }
  if (filters.matchId) { conditions.push("a.match_id=?"); values.push(filters.matchId); }
  const rows = (await db().prepare(
    `SELECT a.* FROM match_attendance a JOIN scheduled_matches m ON m.id=a.match_id WHERE ${conditions.join(" AND ")}`,
  ).bind(...values).all()).results as any[];
  for (const row of rows) {
    if (row.absence_previous_status) {
      await db().prepare(
        `UPDATE match_attendance SET status=?,change_count=?,absence_period_id=NULL,absence_previous_status=NULL,
         absence_previous_change_count=NULL,updated_at=? WHERE id=?`,
      ).bind(row.absence_previous_status, Number(row.absence_previous_change_count || 0), new Date().toISOString(), row.id).run();
    } else {
      await db().prepare(`DELETE FROM match_attendance WHERE id=? AND absence_period_id IS NOT NULL`).bind(row.id).run();
    }
  }
  return rows.length;
}

async function configuredTimezone() {
  const row: any = await db().prepare(`SELECT timezone FROM instance_configuration WHERE id=1`).first();
  return String(row?.timezone || "America/Sao_Paulo");
}

export function dateInTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function mapAbsence(row: any): PlayerAbsence {
  return { id: String(row.id), playerId: String(row.player_id), startDate: String(row.start_date), endDate: String(row.end_date), reason: row.reason ? String(row.reason) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

function statusError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}
