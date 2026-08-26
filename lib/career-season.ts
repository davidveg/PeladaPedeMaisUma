/* Database rows and D1 batch metadata are narrowed at this service boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { addSeasonMonths, nextSeasonResetAt } from "./career";
import { audit, db, ensureDb } from "./database";
import { logEvent } from "./logger";

let seasonCheck: Promise<boolean> | null = null;

export async function ensureCareerSeasonCurrent(now = new Date()) {
  await ensureDb();
  if (seasonCheck) return seasonCheck;
  seasonCheck = checkAndResetSeason(now).finally(() => { seasonCheck = null; });
  return seasonCheck;
}

export async function resetCareerSeasonNow(administratorId: string, now = new Date()) {
  await ensureDb();
  const row: any = await db().prepare(`SELECT season_duration_months,season_started_at,next_season_reset_at,season_number FROM career_configuration WHERE id=1`).first();
  const durationMonths = Number(row?.season_duration_months || 12), previousSeasonNumber = Number(row?.season_number || 1);
  const nextSeasonNumber = previousSeasonNumber + 1, timestamp = now.toISOString(), nextResetAt = addSeasonMonths(now, durationMonths).toISOString();
  const batch = await db().batch([
    db().prepare(`UPDATE players SET momentum=0,result_momentum=0,voting_momentum=0,updated_at=? WHERE momentum<>0 OR result_momentum<>0 OR voting_momentum<>0`).bind(timestamp),
    db().prepare(`UPDATE career_configuration SET season_started_at=?,next_season_reset_at=?,season_number=?,updated_at=? WHERE id=1 AND season_number=?`).bind(timestamp,nextResetAt,nextSeasonNumber,timestamp,previousSeasonNumber),
  ]);
  if (Number((batch[1] as any)?.meta?.changes || 0) !== 1) throw Object.assign(new Error("A temporada foi alterada em outra sessão. Atualize e tente novamente."), { status: 409 });
  await audit(administratorId,"CAREER_SEASON_RESET","career_configuration","1",{seasonNumber:nextSeasonNumber,seasonStartedAt:timestamp,nextSeasonResetAt:nextResetAt,durationMonths,manual:true},{seasonNumber:previousSeasonNumber,seasonStartedAt:row?.season_started_at,nextSeasonResetAt:row?.next_season_reset_at});
  logEvent("info","career_season_reset",{seasonNumber:nextSeasonNumber,durationMonths,nextSeasonResetAt:nextResetAt,manual:true});
  return { previousSeasonNumber, seasonNumber: nextSeasonNumber, seasonStartedAt: timestamp, nextSeasonResetAt: nextResetAt };
}

async function checkAndResetSeason(now: Date) {
  const row: any = await db().prepare(`SELECT season_duration_months,season_started_at,next_season_reset_at,season_number FROM career_configuration WHERE id=1`).first();
  if (!row?.next_season_reset_at || new Date(row.next_season_reset_at).getTime() > now.getTime()) return false;

  const durationMonths = Number(row.season_duration_months || 12);
  const previousResetAt = String(row.next_season_reset_at);
  const nextResetAt = nextSeasonResetAt(previousResetAt, durationMonths, now).toISOString();
  const nextSeasonNumber = Number(row.season_number || 1) + 1;
  const timestamp = now.toISOString();

  const batch = await db().batch([
    db().prepare(`UPDATE players SET momentum=0,result_momentum=0,voting_momentum=0,updated_at=? WHERE momentum<>0 OR result_momentum<>0 OR voting_momentum<>0`).bind(timestamp),
    db().prepare(`UPDATE career_configuration SET season_started_at=?,next_season_reset_at=?,season_number=?,updated_at=? WHERE id=1 AND next_season_reset_at=?`).bind(previousResetAt,nextResetAt,nextSeasonNumber,timestamp,previousResetAt),
  ]);
  if (Number((batch[1] as any)?.meta?.changes || 0) !== 1) return false;
  await audit(null,"CAREER_SEASON_RESET","career_configuration","1",{seasonNumber:nextSeasonNumber,seasonStartedAt:previousResetAt,nextSeasonResetAt:nextResetAt,durationMonths},{seasonNumber:Number(row.season_number||1),seasonStartedAt:row.season_started_at,nextSeasonResetAt:previousResetAt});
  logEvent("info","career_season_reset",{seasonNumber:nextSeasonNumber,durationMonths,nextSeasonResetAt});
  return true;
}
