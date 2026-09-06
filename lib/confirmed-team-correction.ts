import { audit, db, ensureDb } from "./database";
import { teamMomentumForResult } from "./career";
import { getCareerConfig } from "./career-service";
import { normalizeArrivalOrder } from "./arrival-order";
import { buildParticipationSnapshot, effectiveParticipation, participationSummary } from "./match-participation";
import { validateMatchContributions } from "./match-contributions";
import { rebuildEditedSeparation } from "./separation-team-edit";
import { logEvent } from "./logger";

export type ConfirmedTeamCorrectionEligibility = { allowed: boolean; separationId?: string; reason?: string };

export async function confirmedTeamCorrectionEligibility(separationId?: string): Promise<ConfirmedTeamCorrectionEligibility> {
  await ensureDb();
  const row: any = await db().prepare(`
    SELECT s.id separation_id,s.match_date,c.config_snapshot,
      COALESCE(m.match_at,CASE WHEN s.match_date IS NOT NULL THEN s.match_date||'T23:59:59' END,c.created_at) effective_match_at
    FROM career_matches c
    JOIN team_separations s ON s.id=c.separation_id AND s.deleted_at IS NULL
    LEFT JOIN scheduled_matches m ON m.separation_id=s.id
    WHERE (?='' OR s.id=?)
    ORDER BY effective_match_at DESC,c.created_at DESC
    LIMIT 1
  `).bind(separationId || "", separationId || "").first();
  if (!row) return { allowed: false, reason: "A partida ainda não possui resultado confirmado." };

  const latest: any = await db().prepare(`
    SELECT s.id separation_id
    FROM career_matches c
    JOIN team_separations s ON s.id=c.separation_id AND s.deleted_at IS NULL
    LEFT JOIN scheduled_matches m ON m.separation_id=s.id
    ORDER BY COALESCE(m.match_at,CASE WHEN s.match_date IS NOT NULL THEN s.match_date||'T23:59:59' END,c.created_at) DESC,c.created_at DESC
    LIMIT 1
  `).first();
  if (String(latest?.separation_id || "") !== String(row.separation_id)) return { allowed: false, reason: "Somente a última partida realizada pode ter a escalação corrigida." };

  const newer = await db().prepare(`SELECT 1 found FROM scheduled_matches WHERE status<>'CANCELLED' AND match_at>? LIMIT 1`).bind(String(row.effective_match_at)).first("found");
  if (newer) return { allowed: false, reason: "Há uma partida mais nova criada. A correção fica disponível somente antes da próxima partida." };

  const month = String(row.match_date || row.effective_match_at).slice(0, 7);
  if (month && await db().prepare(`SELECT 1 found FROM monthly_career_awards WHERE month=?`).bind(month).first("found")) return { allowed: false, reason: "O resultado mensal desta partida já foi consolidado." };
  const seasonNumber = Number(parseJson(row.config_snapshot, {}).seasonNumber ?? 1);
  if (await db().prepare(`SELECT 1 found FROM career_season_awards WHERE season_number=?`).bind(seasonNumber).first("found")) return { allowed: false, reason: "A temporada desta partida já foi encerrada." };
  return { allowed: true, separationId: String(row.separation_id) };
}

export async function correctConfirmedTeamAssignment(params: { separationId: string; blue: unknown; yellow: unknown; administratorId: string }) {
  await ensureDb();
  const eligibility = await confirmedTeamCorrectionEligibility(params.separationId);
  if (!eligibility.allowed) throw new Error(eligibility.reason || "Esta partida não pode mais ser corrigida.");
  const row: any = await db().prepare(`
    SELECT s.*,c.id career_id,c.blue_score,c.yellow_score,c.winner_team,c.config_snapshot,c.participation_snapshot
    FROM team_separations s JOIN career_matches c ON c.separation_id=s.id
    WHERE s.id=? AND s.deleted_at IS NULL
  `).bind(params.separationId).first();
  if (!row) throw new Error("Partida confirmada não encontrada.");
  const previousSnapshot = parseJson(row.snapshot, {});
  const snapshot = rebuildEditedSeparation(previousSnapshot, params.blue, params.yellow);
  const previous = effectiveParticipation(row);
  const previousBlueIds = previous.blue.map((player: any) => String(player.id));
  const previousYellowIds = previous.yellow.map((player: any) => String(player.id));
  const actualIds = new Set([...previousBlueIds, ...previousYellowIds]);
  const lineupIds = new Set([...(previousSnapshot.blue || []), ...(previousSnapshot.yellow || [])].map((player: any) => String(player.id)));
  const nextBlueLineup = (snapshot.blue || []).map((player: any) => String(player.id));
  const nextYellowLineup = (snapshot.yellow || []).map((player: any) => String(player.id));
  const nextBlueIds = [...nextBlueLineup.filter((id: string) => actualIds.has(id)), ...previousBlueIds.filter((id: string) => !lineupIds.has(id))];
  const nextYellowIds = [...nextYellowLineup.filter((id: string) => actualIds.has(id)), ...previousYellowIds.filter((id: string) => !lineupIds.has(id))];
  const playerRows = (await db().prepare(`SELECT id,display_name,full_name,photo_url,primary_position,secondary_position,type FROM players`).all()).results as any[];
  const now = new Date().toISOString();
  const participation = buildParticipationSnapshot({ input: { reviewed: true, blueIds: nextBlueIds, yellowIds: nextYellowIds }, lineup: snapshot, players: playerRows, administratorId: params.administratorId, now });

  const contributionRows = (await db().prepare(`SELECT scorer_player_id,assist_player_id,team,is_own_goal FROM career_match_contributions WHERE career_match_id=? ORDER BY created_at`).bind(row.career_id).all()).results as any[];
  if (contributionRows.length) {
    const contributions = contributionRows.map(goal => ({ team: goal.team, scorerPlayerId: goal.scorer_player_id, assistPlayerId: goal.assist_player_id, ownGoal: Boolean(goal.is_own_goal) }));
    const validation = validateMatchContributions({ contributions, blueScore: Number(row.blue_score), yellowScore: Number(row.yellow_score), blueIds: nextBlueIds, yellowIds: nextYellowIds });
    if (validation.error) throw new Error("A troca conflita com gols ou assistências registrados. Corrija primeiro a súmula e tente novamente.");
  }

  const currentConfig = await getCareerConfig();
  const rules = { winnerBonus: .1, loserPenalty: -.1, ...parseJson(row.config_snapshot, {}) };
  const statements: any[] = [];
  if (Number(rules.seasonNumber ?? 1) === Number(currentConfig.seasonNumber ?? 1)) {
    const before = resultMomentum(previousBlueIds, previousYellowIds, row.winner_team, rules);
    const after = resultMomentum(nextBlueIds, nextYellowIds, row.winner_team, rules);
    for (const playerId of new Set([...before.keys(), ...after.keys()])) {
      const adjustment = (after.get(playerId) || 0) - (before.get(playerId) || 0);
      if (adjustment) statements.push(db().prepare(`UPDATE players SET momentum=ROUND(momentum+?,3),result_momentum=ROUND(result_momentum+?,3),updated_at=? WHERE id=?`).bind(adjustment, adjustment, now, playerId));
    }
  }
  const previousArrival = normalizeArrivalOrder(row.arrival_order, (previousSnapshot.blue || []).map((player: any) => String(player.id)), (previousSnapshot.yellow || []).map((player: any) => String(player.id)));
  const order = unique([...(previousArrival?.blue || []), ...(previousArrival?.yellow || []), ...(previousSnapshot.blue || []).map((p: any) => String(p.id)), ...(previousSnapshot.yellow || []).map((p: any) => String(p.id))]);
  const arrivalOrder = previousArrival ? { blue: order.filter(id => nextBlueLineup.includes(id)), yellow: order.filter(id => nextYellowLineup.includes(id)) } : null;
  const balanceScore = Number.isFinite(Number(snapshot.cost)) ? Number(snapshot.cost) : Number(row.balance_score || 0);
  const balanceClassification = String(snapshot.rating || row.balance_classification || "Equilíbrio recalculado");
  statements.push(db().prepare(`UPDATE team_separations SET snapshot=?,manually_adjusted=1,balance_score=?,balance_classification=?,arrival_order=?,updated_at=? WHERE id=? AND deleted_at IS NULL`).bind(JSON.stringify(snapshot), balanceScore, balanceClassification, arrivalOrder ? JSON.stringify(arrivalOrder) : null, now, params.separationId));
  statements.push(db().prepare(`UPDATE career_matches SET participation_snapshot=?,updated_at=? WHERE id=?`).bind(JSON.stringify(participation), now, row.career_id));
  await db().batch(statements);
  const moved = [...new Set([...previousBlueIds, ...previousYellowIds])].filter(id => previousBlueIds.includes(id) !== nextBlueIds.includes(id));
  await audit(params.administratorId, "CORRECT_CONFIRMED_TEAM_ASSIGNMENT", "career_match", row.career_id, { separationId: params.separationId, blue: nextBlueLineup, yellow: nextYellowLineup, participation: participationSummary(participation), movedPlayerIds: moved, votesPreserved: true }, { blue: (previousSnapshot.blue || []).map((p: any) => p.id), yellow: (previousSnapshot.yellow || []).map((p: any) => p.id), participation: { blueIds: previousBlueIds, yellowIds: previousYellowIds } });
  logEvent("info", "confirmed_team_assignment_corrected", { careerMatchId: row.career_id, separationId: params.separationId, movedPlayerIds: moved });
  return { snapshot, participation, arrivalOrder, message: "Escalação corrigida. O Momentum do resultado foi recalculado e os votos foram preservados." };
}

function resultMomentum(blueIds: string[], yellowIds: string[], winner: "BLUE" | "YELLOW" | "DRAW", rules: any) {
  const values = new Map<string, number>();
  for (const [team, ids] of [["BLUE", blueIds], ["YELLOW", yellowIds]] as const) {
    const value = teamMomentumForResult(winner, team, Number(rules.winnerBonus), Number(rules.loserPenalty));
    for (const id of ids) values.set(id, value);
  }
  return values;
}
function unique(ids: string[]) { return [...new Set(ids)]; }
function parseJson(value: unknown, fallback: any) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
