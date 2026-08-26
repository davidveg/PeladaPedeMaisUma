/* Durable monthly and season award snapshots. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { careerConfigFromRow, monthlyTeamFormation } from "./career";
import { audit, db, ensureDb } from "./database";
import { logEvent } from "./logger";
import { buildAnnualMvpFromAwards, buildMonthAward, type MonthlyCareerAward, type StatisticsMatch, type StatisticsPlayer } from "./public-statistics";
import { isLastRegularMatchOfMonth } from "./career-award-calendar";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export type AwardFinalizationReason = "AUTOMATIC_LAST_MATCH" | "CALENDAR" | "MANUAL_MONTH" | "MANUAL_SEASON";

export async function finalizeMonthlyCareerAward(month: string, reason: AwardFinalizationReason, administratorId: string | null, finalizedAt = new Date().toISOString()) {
  await ensureDb();
  if (!monthPattern.test(month)) throw statusError("Informe um mês válido para o encerramento.", 400);
  const stored: any = await db().prepare(`SELECT snapshot,finalized_at FROM monthly_career_awards WHERE month=?`).bind(month).first();
  if (stored) return { award: parseJson(stored.snapshot, null) as MonthlyCareerAward, finalizedAt: String(stored.finalized_at), created: false };

  const { players, matches, formation, openVotes } = await loadMonthData(month);
  if (!matches.length) throw statusError("Não há partidas com resultado registrado neste mês.", 409);
  if (openVotes > 0) throw statusError("Ainda existem votações abertas neste mês. Encerre-as antes de consolidar o resultado.", 409);
  const eligible = players.filter(player => player.type === "monthly" || player.type === "goalkeeper" || player.type === "casual" || player.primaryPosition === "Goleiro");
  const award = buildMonthAward(month, matches, new Map(eligible.map(player => [player.id, player])), formation);
  if (!award) throw statusError("Não há jogadores elegíveis para a premiação deste mês.", 409);
  const inserted = await db().prepare(`INSERT OR IGNORE INTO monthly_career_awards (month,year,snapshot,finalized_at) VALUES (?,?,?,?)`)
    .bind(month, Number(month.slice(0, 4)), JSON.stringify(award), finalizedAt).run();
  const created = Number(inserted.meta?.changes || 0) === 1;
  if (created) {
    await audit(administratorId, "CAREER_MONTH_AWARDS_FINALIZED", "monthly_career_award", month, { month, reason, matchCount: award.matchCount, playerOfMonth: award.playerOfMonth?.player.displayName || null, selectionSize: award.selection.length });
    logEvent("info", "career_month_awards_finalized", { month, reason, matchCount: award.matchCount, automatic: !administratorId });
  }
  return { award, finalizedAt, created };
}

export async function tryFinalizeMonthlyAwardAfterMatch(careerMatchId: string) {
  await ensureDb();
  const row: any = await db().prepare(`SELECT c.status,s.match_date FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE c.id=?`).bind(careerMatchId).first();
  if (!row || row.status !== "CLOSED" || !row.match_date) return null;
  const date = String(row.match_date).slice(0, 10), month = date.slice(0, 7);
  if (!monthPattern.test(month) || await db().prepare(`SELECT 1 found FROM monthly_career_awards WHERE month=?`).bind(month).first("found")) return null;
  const instance: any = await db().prepare(`SELECT default_match_weekday FROM instance_configuration WHERE id=1`).first();
  if (!isLastRegularMatchOfMonth(date, Number(instance?.default_match_weekday ?? 0))) return null;
  const end = monthEnd(month);
  const futureScheduled = await db().prepare(`SELECT 1 found FROM scheduled_matches WHERE status<>'CANCELLED' AND substr(match_at,1,10)>? AND substr(match_at,1,10)<=? LIMIT 1`).bind(date, end).first("found");
  const futureCareer = await db().prepare(`SELECT 1 found FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL AND s.match_date>? AND s.match_date<=? LIMIT 1`).bind(date, end).first("found");
  if (futureScheduled || futureCareer) return null;
  const openVotes = await db().prepare(`SELECT COUNT(*) total FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL AND substr(s.match_date,1,7)=? AND c.status<>'CLOSED'`).bind(month).first("total");
  if (Number(openVotes || 0) > 0) return null;
  return finalizeMonthlyCareerAward(month, "AUTOMATIC_LAST_MATCH", null);
}

export async function tryFinalizeCurrentMonthFromHistory(referenceDate = new Date().toISOString().slice(0, 10)) {
  await ensureDb();
  const month = referenceDate.slice(0, 7);
  const latest: any = await db().prepare(`SELECT c.id FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL AND substr(s.match_date,1,7)=? AND c.status='CLOSED' ORDER BY s.match_date DESC,c.closed_at DESC LIMIT 1`).bind(month).first();
  return latest?.id ? tryFinalizeMonthlyAwardAfterMatch(String(latest.id)) : null;
}

export async function getCareerAwardControl(referenceDate = new Date().toISOString().slice(0, 10)) {
  await ensureDb();
  const month = referenceDate.slice(0, 7);
  const [config, finalized, monthCounts, lastSeason] = await Promise.all([
    db().prepare(`SELECT season_number,season_started_at,next_season_reset_at FROM career_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT month,finalized_at FROM monthly_career_awards ORDER BY month DESC`).all(),
    db().prepare(`SELECT COUNT(*) match_count,SUM(CASE WHEN c.status<>'CLOSED' THEN 1 ELSE 0 END) open_votes FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL AND substr(s.match_date,1,7)=?`).bind(month).first<any>(),
    db().prepare(`SELECT season_number,started_at,ended_at,finalized_at FROM career_season_awards ORDER BY season_number DESC LIMIT 1`).first<any>(),
  ]);
  return {
    currentMonth: month,
    finalizedMonths: (finalized.results as any[]).map(row => ({ month: String(row.month), finalizedAt: String(row.finalized_at) })),
    currentMonthMatchCount: Number(monthCounts?.match_count || 0),
    currentMonthOpenVotes: Number(monthCounts?.open_votes || 0),
    season: { number: Number(config?.season_number || 1), startedAt: config?.season_started_at || null, nextResetAt: config?.next_season_reset_at || null },
    lastSeasonClosure: lastSeason ? { seasonNumber: Number(lastSeason.season_number), startedAt: lastSeason.started_at, endedAt: lastSeason.ended_at, finalizedAt: lastSeason.finalized_at } : null,
  };
}

export async function finalizeSeasonAwards(params: { seasonNumber: number; startedAt?: string | null; endedAt: string; administratorId: string }) {
  await ensureDb();
  const existing: any = await db().prepare(`SELECT snapshot,finalized_at FROM career_season_awards WHERE season_number=?`).bind(params.seasonNumber).first();
  if (existing) return { snapshot: parseJson(existing.snapshot, {}), finalizedAt: existing.finalized_at, created: false };
  const startMonth = String(params.startedAt || "0000-01").slice(0, 7), endMonth = params.endedAt.slice(0, 7);
  const rows = await db().prepare(`SELECT snapshot FROM monthly_career_awards WHERE month>=? AND month<=? ORDER BY month`).bind(startMonth, endMonth).all();
  const awards = (rows.results as any[]).flatMap(row => { const award = parseJson(row.snapshot, null) as MonthlyCareerAward | null; return award?.month ? [award] : []; });
  if (!awards.length) throw statusError("A temporada ainda não possui meses consolidados.", 409);
  const snapshot = { seasonNumber: params.seasonNumber, startedAt: params.startedAt || null, endedAt: params.endedAt, months: awards.map(award => award.month), annualMvp: buildAnnualMvpFromAwards(awards) };
  const finalizedAt = new Date().toISOString();
  await db().prepare(`INSERT INTO career_season_awards (season_number,year,started_at,ended_at,snapshot,finalized_by_administrator_id,finalized_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(params.seasonNumber, Number(params.endedAt.slice(0, 4)), params.startedAt || null, params.endedAt, JSON.stringify(snapshot), params.administratorId, finalizedAt).run();
  await audit(params.administratorId, "CAREER_SEASON_AWARDS_FINALIZED", "career_season_award", String(params.seasonNumber), { seasonNumber: params.seasonNumber, months: snapshot.months, mvpCount: snapshot.annualMvp.length });
  logEvent("info", "career_season_awards_finalized", { seasonNumber: params.seasonNumber, months: snapshot.months.length });
  return { snapshot, finalizedAt, created: true };
}

async function loadMonthData(month: string) {
  const from = `${month}-01`, to = monthEnd(month);
  const [playerRows, matchRows, configRow] = await Promise.all([
    db().prepare(`SELECT id,display_name,photo_url,type,primary_position FROM players ORDER BY display_name`).all(),
    db().prepare(`SELECT c.id,c.separation_id,c.status,c.blue_score,c.yellow_score,c.winner_team,c.config_snapshot,c.results_snapshot,s.match_title,s.match_date,s.snapshot FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL AND s.match_date BETWEEN ? AND ? ORDER BY s.match_date,c.created_at`).bind(from, to).all(),
    db().prepare(`SELECT * FROM career_configuration WHERE id=1`).first(),
  ]);
  const players = (playerRows.results as any[]).map(row => ({ id: String(row.id), displayName: String(row.display_name), photoUrl: row.photo_url || null, type: row.type || null, primaryPosition: row.primary_position || null })) as StatisticsPlayer[];
  const allRows = matchRows.results as any[];
  const matches = allRows.filter(row => row.status === "CLOSED").map(mapStatisticsMatch);
  const config = careerConfigFromRow(configRow);
  return { players, matches, formation: monthlyTeamFormation(config), openVotes: allRows.filter(row => row.status !== "CLOSED").length };
}

function mapStatisticsMatch(row: any): StatisticsMatch {
  const snapshot = parseJson(row.snapshot, {});
  return { id: String(row.id), separationId: String(row.separation_id), title: String(row.match_title), date: String(row.match_date), blueScore: Number(row.blue_score), yellowScore: Number(row.yellow_score), winnerTeam: row.winner_team === "BLUE" || row.winner_team === "YELLOW" ? row.winner_team : "DRAW", blueIds: (snapshot.blue || []).map((player: any) => String(player.id)), yellowIds: (snapshot.yellow || []).map((player: any) => String(player.id)), config: parseJson(row.config_snapshot, null), results: parseJson(row.results_snapshot, null) };
}

function monthEnd(month: string) { const [year, value] = month.split("-").map(Number); return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10); }
function parseJson(value: unknown, fallback: any) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
function statusError(message: string, status: number) { return Object.assign(new Error(message), { status }); }
