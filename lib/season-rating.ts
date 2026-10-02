/* Permanent, auditable end-of-season rating evolution. */
/* eslint-disable @typescript-eslint/no-explicit-any -- database and statistics adapters expose heterogeneous snapshots. */
import { addSeasonMonths } from "./career.ts";
import { audit, db, ensureDb } from "./database.ts";
import { attributeRating, defaultConfig } from "./football.ts";
import { logEvent } from "./logger.ts";
import { publicPlayer } from "./public-player.ts";
import { calculateAdvancedStatistics } from "./statistics-engine.ts";
import { STATISTICS_VERSION } from "./statistics-engine-config.ts";
import { loadAdvancedStatisticsData } from "./statistics-data.ts";

export const SEASON_RATING_FORMULA_VERSION = 1;
export const SEASON_RATING_MINIMUM_GAMES = 5;
export const SEASON_RATING_FULL_CONFIDENCE_GAMES = 15;
export const SEASON_RATING_MAX_DELTA = .2;
export const SEASON_RATING_CAREER_CAP = .6;
export const SEASON_RATING_STEP = .05;

export type SeasonRatingCandidate = {
  playerId: string;
  displayName: string;
  position: string;
  games: number;
  currentAdjustment: number;
  baseOverall: number;
  ipi: number | null;
  rawIpi: number | null;
  plusMinusPerGame: number;
  utilization: number;
  consistency: number | null;
  availableComponents: string[];
};

export type SeasonRatingEntry = SeasonRatingCandidate & {
  eligible: boolean;
  confidence: number;
  proposedDelta: number;
  newAdjustment: number;
  currentOverall: number;
  newOverall: number;
  reason: "ELIGIBLE" | "INSUFFICIENT_GAMES" | "NO_IPI" | "CAREER_CAP";
};

export type SeasonRatingReview = {
  seasonNumber: number;
  startedAt: string | null;
  endedAt: string;
  sourceHash: string;
  status: "PROPOSED" | "APPLIED";
  formulaVersion: number;
  statisticsVersion: number;
  rules: {
    minimumGames: number;
    fullConfidenceGames: number;
    maximumSeasonDelta: number;
    careerAdjustmentCap: number;
    roundingStep: number;
  };
  players: SeasonRatingEntry[];
  generatedAt: string;
  appliedAt?: string | null;
};

export function calculateSeasonRatingEntries(candidates: SeasonRatingCandidate[]): SeasonRatingEntry[] {
  return candidates.map(candidate => {
    const currentAdjustment = round(candidate.currentAdjustment, 3);
    const games = Math.max(0, Math.floor(candidate.games));
    const confidence = round(Math.min(1, games / SEASON_RATING_FULL_CONFIDENCE_GAMES), 3);
    const eligible = games >= SEASON_RATING_MINIMUM_GAMES && candidate.rawIpi != null && Number.isFinite(candidate.rawIpi);
    const unclampedDelta = eligible ? ((Number(candidate.rawIpi) - 50) / 50) * .25 * confidence : 0;
    const seasonDelta = roundToStep(clamp(unclampedDelta, -SEASON_RATING_MAX_DELTA, SEASON_RATING_MAX_DELTA), SEASON_RATING_STEP);
    const newAdjustment = round(clamp(currentAdjustment + seasonDelta, -SEASON_RATING_CAREER_CAP, SEASON_RATING_CAREER_CAP), 3);
    const proposedDelta = round(newAdjustment - currentAdjustment, 3);
    const reason = !eligible
      ? candidate.rawIpi == null ? "NO_IPI" as const : "INSUFFICIENT_GAMES" as const
      : proposedDelta !== seasonDelta ? "CAREER_CAP" as const
      : "ELIGIBLE" as const;
    return {
      ...candidate,
      games,
      currentAdjustment,
      eligible,
      confidence,
      proposedDelta,
      newAdjustment,
      currentOverall: round(clamp(candidate.baseOverall + currentAdjustment, 1, 5), 1),
      newOverall: round(clamp(candidate.baseOverall + newAdjustment, 1, 5), 1),
      reason,
    };
  }).sort((left, right) => right.proposedDelta - left.proposedDelta || right.ipi! - left.ipi! || left.displayName.localeCompare(right.displayName, "pt-BR"));
}

export async function getSeasonRatingReview(seasonNumber: number): Promise<SeasonRatingReview | null> {
  await ensureDb();
  const row: any = await db().prepare(`SELECT status,snapshot,applied_at FROM career_season_rating_reviews WHERE season_number=?`).bind(seasonNumber).first();
  if (!row) return null;
  const snapshot = parseJson(row.snapshot, null) as SeasonRatingReview | null;
  return snapshot ? { ...snapshot, status: row.status === "APPLIED" ? "APPLIED" : "PROPOSED", appliedAt: row.applied_at || snapshot.appliedAt || null } : null;
}

export async function createSeasonRatingReview(params: { seasonNumber: number; startedAt?: string | null; endedAt: string; administratorId: string }) {
  await ensureDb();
  const existing = await getSeasonRatingReview(params.seasonNumber);
  if (existing?.status === "APPLIED") return existing;
  const from = isoDate(params.startedAt) || "0000-01-01", to = isoDate(params.endedAt) || new Date().toISOString().slice(0, 10);
  const [{ players, matches }, playerRows, systemRow] = await Promise.all([
    loadAdvancedStatisticsData(from, to),
    db().prepare(`SELECT * FROM players ORDER BY display_name,id`).all(),
    db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first<any>(),
  ]);
  const sourceHash = await seasonRatingSourceHash({ players, matches, playerRows: playerRows.results as any[], systemRow });
  if (existing?.sourceHash === sourceHash) return existing;
  const statistics = calculateAdvancedStatistics(players, matches, { from, to, seasonNumber: params.seasonNumber, recentWindow: 5, minimumGames: 1 });
  const statsByPlayer = new Map((statistics.players as any[]).map(entry => [String(entry.player.id), entry]));
  const config = {
    ...defaultConfig,
    speedWeight: Number(systemRow?.speed_weight ?? defaultConfig.speedWeight), skillWeight: Number(systemRow?.skill_weight ?? defaultConfig.skillWeight),
    markingWeight: Number(systemRow?.marking_weight ?? defaultConfig.markingWeight), tacticalIntelligenceWeight: Number(systemRow?.tactical_intelligence_weight ?? defaultConfig.tacticalIntelligenceWeight),
    competitivenessWeight: Number(systemRow?.competitiveness_weight ?? defaultConfig.competitivenessWeight), goalkeeperDefensesWeight: Number(systemRow?.goalkeeper_defenses_weight ?? defaultConfig.goalkeeperDefensesWeight),
    goalkeeperPositioningWeight: Number(systemRow?.goalkeeper_positioning_weight ?? defaultConfig.goalkeeperPositioningWeight), goalkeeperSafetyWeight: Number(systemRow?.goalkeeper_safety_weight ?? defaultConfig.goalkeeperSafetyWeight),
    goalkeeperFootworkWeight: Number(systemRow?.goalkeeper_footwork_weight ?? defaultConfig.goalkeeperFootworkWeight), goalkeeperLeadershipWeight: Number(systemRow?.goalkeeper_leadership_weight ?? defaultConfig.goalkeeperLeadershipWeight),
  };
  const candidates = (playerRows.results as any[]).flatMap(row => {
    const summary: any = statsByPlayer.get(String(row.id));
    if (!summary) return [];
    const player = publicPlayer(row), currentAdjustment = Number(row.career_rating_adjustment ?? 0);
    const baseOverall = attributeRating(player, config);
    return [{
      playerId: String(row.id), displayName: String(row.display_name), position: String(summary.position || row.primary_position || ""),
      games: Number(summary.games || 0), currentAdjustment, baseOverall, ipi: finite(summary.ipi?.value), rawIpi: finite(summary.ipi?.raw),
      plusMinusPerGame: Number(summary.plusMinusPerGame || 0), utilization: Number(summary.utilization || 0), consistency: finite(summary.consistency),
      availableComponents: Array.isArray(summary.ipi?.availableComponents) ? summary.ipi.availableComponents.map(String) : [],
    } satisfies SeasonRatingCandidate];
  });
  const generatedAt = new Date().toISOString();
  const review: SeasonRatingReview = {
    seasonNumber: params.seasonNumber, startedAt: params.startedAt || null, endedAt: to, sourceHash, status: "PROPOSED",
    formulaVersion: SEASON_RATING_FORMULA_VERSION, statisticsVersion: STATISTICS_VERSION,
    rules: { minimumGames: SEASON_RATING_MINIMUM_GAMES, fullConfidenceGames: SEASON_RATING_FULL_CONFIDENCE_GAMES, maximumSeasonDelta: SEASON_RATING_MAX_DELTA, careerAdjustmentCap: SEASON_RATING_CAREER_CAP, roundingStep: SEASON_RATING_STEP },
    players: calculateSeasonRatingEntries(candidates), generatedAt,
  };
  if (existing) {
    await db().prepare(`UPDATE career_season_rating_reviews SET formula_version=?,snapshot=?,created_by_administrator_id=?,created_at=? WHERE season_number=? AND status='PROPOSED'`)
      .bind(SEASON_RATING_FORMULA_VERSION, JSON.stringify(review), params.administratorId, generatedAt, params.seasonNumber).run();
  } else {
    await db().prepare(`INSERT INTO career_season_rating_reviews (season_number,status,formula_version,snapshot,created_by_administrator_id,created_at) VALUES (?,'PROPOSED',?,?,?,?)`)
      .bind(params.seasonNumber, SEASON_RATING_FORMULA_VERSION, JSON.stringify(review), params.administratorId, generatedAt).run();
  }
  const stored = await getSeasonRatingReview(params.seasonNumber);
  if (!stored) throw statusError("Não foi possível preservar a prévia de evolução da temporada.", 500);
  await audit(params.administratorId, existing ? "CAREER_SEASON_RATING_RECALCULATED" : "CAREER_SEASON_RATING_PROPOSED", "career_season_rating_review", String(params.seasonNumber), { seasonNumber: params.seasonNumber, players: review.players.length, eligible: review.players.filter(player => player.eligible).length, formulaVersion: SEASON_RATING_FORMULA_VERSION, sourceHash });
  return stored;
}

export async function applySeasonRatingReview(params: { seasonNumber: number; administratorId: string; now?: Date }) {
  await ensureDb();
  const review = await getSeasonRatingReview(params.seasonNumber);
  if (!review) throw statusError("Gere a prévia da evolução antes de encerrar a temporada.", 409);
  if (review.status === "APPLIED") throw statusError("A evolução desta temporada já foi aplicada.", 409);
  const config: any = await db().prepare(`SELECT season_number,season_duration_months,season_started_at,next_season_reset_at FROM career_configuration WHERE id=1`).first();
  if (Number(config?.season_number || 1) !== params.seasonNumber) throw statusError("A temporada atual mudou desde a geração da prévia. Atualize a página.", 409);
  const from = isoDate(review.startedAt) || "0000-01-01", to = isoDate(review.endedAt) || new Date().toISOString().slice(0, 10);
  const [{ players, matches }, sourcePlayerRows, systemRow] = await Promise.all([
    loadAdvancedStatisticsData(from, to),
    db().prepare(`SELECT * FROM players ORDER BY display_name,id`).all(),
    db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first<any>(),
  ]);
  const currentSourceHash = await seasonRatingSourceHash({ players, matches, playerRows: sourcePlayerRows.results as any[], systemRow });
  if (!review.sourceHash || review.sourceHash !== currentSourceHash) {
    throw statusError("Partidas, jogadores ou pesos estatísticos mudaram depois da prévia. Recalcule a prévia antes de aplicar.", 409);
  }
  const ids = review.players.map(player => player.playerId);
  const currentRows = ids.length ? (await db().prepare(`SELECT id,career_rating_adjustment FROM players WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results as any[] : [];
  const currentById = new Map(currentRows.map(row => [String(row.id), Number(row.career_rating_adjustment || 0)]));
  for (const player of review.players) if (Math.abs(Number(currentById.get(player.playerId) ?? 0) - player.currentAdjustment) > .0001) {
    throw statusError(`A evolução de ${player.displayName} mudou após a prévia. Gere uma nova revisão antes de aplicar.`, 409);
  }
  const now = params.now || new Date(), timestamp = now.toISOString(), nextSeasonNumber = params.seasonNumber + 1;
  const durationMonths = Number(config?.season_duration_months || 12), nextResetAt = addSeasonMonths(now, durationMonths).toISOString();
  const statements: any[] = [];
  for (const player of review.players) {
    statements.push(db().prepare(`INSERT INTO player_season_rating_adjustments (id,season_number,player_id,previous_adjustment,proposed_delta,applied_delta,new_adjustment,metrics_snapshot,formula_version,applied_by_administrator_id,applied_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), params.seasonNumber, player.playerId, player.currentAdjustment, player.proposedDelta, player.proposedDelta, player.newAdjustment, JSON.stringify({ games: player.games, position: player.position, ipi: player.ipi, rawIpi: player.rawIpi, plusMinusPerGame: player.plusMinusPerGame, utilization: player.utilization, consistency: player.consistency, confidence: player.confidence, eligible: player.eligible, reason: player.reason, availableComponents: player.availableComponents }), review.formulaVersion, params.administratorId, timestamp));
    if (player.proposedDelta) statements.push(db().prepare(`UPDATE players SET career_rating_adjustment=?,updated_at=? WHERE id=? AND career_rating_adjustment=?`).bind(player.newAdjustment, timestamp, player.playerId, player.currentAdjustment));
  }
  statements.push(
    db().prepare(`UPDATE players SET momentum=0,result_momentum=0,voting_momentum=0,updated_at=? WHERE momentum<>0 OR result_momentum<>0 OR voting_momentum<>0`).bind(timestamp),
    db().prepare(`UPDATE system_configuration SET historical_learning_enabled=0,updated_at=? WHERE id=1`).bind(timestamp),
    db().prepare(`UPDATE career_configuration SET season_started_at=?,next_season_reset_at=?,season_number=?,updated_at=? WHERE id=1 AND season_number=?`).bind(timestamp, nextResetAt, nextSeasonNumber, timestamp, params.seasonNumber),
    db().prepare(`UPDATE career_season_rating_reviews SET status='APPLIED',applied_by_administrator_id=?,applied_at=? WHERE season_number=? AND status='PROPOSED'`).bind(params.administratorId, timestamp, params.seasonNumber),
  );
  const results = await db().batch(statements);
  const configResult: any = results[results.length - 2], reviewResult: any = results[results.length - 1];
  if (Number(configResult?.meta?.changes || 0) !== 1 || Number(reviewResult?.meta?.changes || 0) !== 1) throw statusError("A temporada foi alterada em outra sessão. Atualize e confirme o estado atual.", 409);
  await audit(params.administratorId, "CAREER_SEASON_RATING_APPLIED", "career_season_rating_review", String(params.seasonNumber), { seasonNumber: params.seasonNumber, nextSeasonNumber, players: review.players.length, changed: review.players.filter(player => player.proposedDelta).length, nextSeasonResetAt: nextResetAt, formulaVersion: review.formulaVersion });
  logEvent("info", "career_season_rating_applied", { seasonNumber: params.seasonNumber, nextSeasonNumber, players: review.players.length, changed: review.players.filter(player => player.proposedDelta).length });
  return { ...review, status: "APPLIED" as const, appliedAt: timestamp, nextSeasonNumber, nextSeasonResetAt: nextResetAt };
}

function roundToStep(value: number, step: number) { return round(Math.round(value / step) * step, 3); }
function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(maximum, value)); }
function round(value: number, digits: number) { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; }
function finite(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function isoDate(value: unknown) { const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/); return match?.[0] || ""; }
function parseJson(value: unknown, fallback: any) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
function statusError(message: string, status: number) { return Object.assign(new Error(message), { status }); }

async function seasonRatingSourceHash(input: { players: any[]; matches: any[]; playerRows: any[]; systemRow: any }) {
  const players = input.players.map(player => ({ id: String(player.id), type: player.type || null, primaryPosition: player.primaryPosition || null })).sort(byId);
  const matches = input.matches.map(match => ({
    ...match,
    blue: [...(match.blue || [])].sort(byPlayerId),
    yellow: [...(match.yellow || [])].sort(byPlayerId),
    contributions: [...(match.contributions || [])].sort(byStableJson),
    votes: [...(match.votes || [])].sort(byStableJson),
  })).sort(byId);
  const playerRows = input.playerRows.map(row => ({
    id: String(row.id), type: row.type || null, primaryPosition: row.primary_position || null,
    speed: Number(row.speed), skill: Number(row.skill), marking: Number(row.marking),
    tacticalIntelligence: Number(row.tactical_intelligence), competitiveness: Number(row.competitiveness),
    goalkeeperPositioning: Number(row.goalkeeper_positioning), goalkeeperSafety: Number(row.goalkeeper_safety),
    goalkeeperFootwork: Number(row.goal_exit), goalkeeperLeadership: Number(row.goalkeeper_leadership),
    careerRatingAdjustment: Number(row.career_rating_adjustment || 0),
  })).sort(byId);
  const weights = {
    speed: Number(input.systemRow?.speed_weight ?? defaultConfig.speedWeight), skill: Number(input.systemRow?.skill_weight ?? defaultConfig.skillWeight),
    marking: Number(input.systemRow?.marking_weight ?? defaultConfig.markingWeight), tacticalIntelligence: Number(input.systemRow?.tactical_intelligence_weight ?? defaultConfig.tacticalIntelligenceWeight),
    competitiveness: Number(input.systemRow?.competitiveness_weight ?? defaultConfig.competitivenessWeight), goalkeeperDefenses: Number(input.systemRow?.goalkeeper_defenses_weight ?? defaultConfig.goalkeeperDefensesWeight),
    goalkeeperPositioning: Number(input.systemRow?.goalkeeper_positioning_weight ?? defaultConfig.goalkeeperPositioningWeight), goalkeeperSafety: Number(input.systemRow?.goalkeeper_safety_weight ?? defaultConfig.goalkeeperSafetyWeight),
    goalkeeperFootwork: Number(input.systemRow?.goalkeeper_footwork_weight ?? defaultConfig.goalkeeperFootworkWeight), goalkeeperLeadership: Number(input.systemRow?.goalkeeper_leadership_weight ?? defaultConfig.goalkeeperLeadershipWeight),
  };
  const bytes = new TextEncoder().encode(stableJson({ players, matches, playerRows, weights }));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
}

function stableJson(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function byId(left: any, right: any) { return String(left.id).localeCompare(String(right.id)); }
function byPlayerId(left: any, right: any) { return String(left.playerId).localeCompare(String(right.playerId)); }
function byStableJson(left: any, right: any) { return stableJson(left).localeCompare(stableJson(right)); }
