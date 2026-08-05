import { adminRequired, audit, db, ensureDb } from "../../../lib/database";
import { ensureCareerSeasonCurrent } from "../../../lib/career-season";

const lineWeightKeys = ["speedWeight", "skillWeight", "markingWeight", "tacticalIntelligenceWeight", "competitivenessWeight"] as const;
const goalkeeperWeightKeys = ["goalkeeperDefensesWeight", "goalkeeperPositioningWeight", "goalkeeperSafetyWeight", "goalkeeperFootworkWeight", "goalkeeperLeadershipWeight"] as const;

export async function GET(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  await ensureCareerSeasonCurrent();
  const configuration: any = await db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first();
  const career: any = await db().prepare(`SELECT result_momentum_multiplier,momentum_multiplier FROM career_configuration WHERE id=1`).first();
  return Response.json({ config: mapConfiguration(configuration, career) });
}

export async function PUT(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado" }, { status: 401 });
  await ensureDb();
  const configuration = await request.json() as any;
  const lineWeights = lineWeightKeys.map(key => Number(configuration[key]));
  const goalkeeperWeights = goalkeeperWeightKeys.map(key => Number(configuration[key]));
  if (!validWeights(lineWeights) || !validWeights(goalkeeperWeights)) return Response.json({ error: "Os cinco pesos de jogadores e os cinco pesos de goleiros devem somar 100% em cada grupo." }, { status: 400 });
  const previous = await db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first();
  await db().prepare(`UPDATE system_configuration SET default_player_count=?,minimum_recommended_players=?,maximum_recommended_players=?,speed_weight=?,skill_weight=?,marking_weight=?,tactical_intelligence_weight=?,competitiveness_weight=?,goalkeeper_defenses_weight=?,goalkeeper_positioning_weight=?,goalkeeper_safety_weight=?,goalkeeper_footwork_weight=?,goalkeeper_leadership_weight=?,maximum_position_difference=?,protected_top_players_percentage=?,default_reserve_count=?,algorithm_attempts=?,updated_at=? WHERE id=1`)
    .bind(configuration.defaultPlayerCount, configuration.minimumRecommendedPlayers, configuration.maximumRecommendedPlayers, ...lineWeights, ...goalkeeperWeights, configuration.maximumPositionDifference, configuration.protectedTopPlayersPercentage, configuration.defaultReserveCount, configuration.algorithmAttempts, new Date().toISOString()).run();
  await audit(admin.id, "UPDATE", "configuration", "1", configuration, previous);
  return Response.json({ ok: true, message: "Configurações salvas com sucesso." });
}

function validWeights(weights: number[]) { return weights.every(weight => Number.isFinite(weight) && weight >= 0 && weight <= 1) && Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) <= .0001; }
function mapConfiguration(c: any, career: any) {
  return {
    defaultPlayerCount: c.default_player_count, minimumRecommendedPlayers: c.minimum_recommended_players, maximumRecommendedPlayers: c.maximum_recommended_players,
    speedWeight: Number(c.speed_weight ?? .35), skillWeight: Number(c.skill_weight ?? .25), markingWeight: Number(c.marking_weight ?? .15), tacticalIntelligenceWeight: Number(c.tactical_intelligence_weight ?? .2), competitivenessWeight: Number(c.competitiveness_weight ?? .05),
    goalkeeperDefensesWeight: Number(c.goalkeeper_defenses_weight ?? .4), goalkeeperPositioningWeight: Number(c.goalkeeper_positioning_weight ?? .25), goalkeeperSafetyWeight: Number(c.goalkeeper_safety_weight ?? .2), goalkeeperFootworkWeight: Number(c.goalkeeper_footwork_weight ?? .1), goalkeeperLeadershipWeight: Number(c.goalkeeper_leadership_weight ?? .05), ratingSystemVersion: 2,
    resultMomentumMultiplier: Number(career?.result_momentum_multiplier ?? 1), momentumMultiplier: Number(career?.momentum_multiplier ?? 1), maximumPositionDifference: c.maximum_position_difference, protectedTopPlayersPercentage: c.protected_top_players_percentage, defaultReserveCount: c.default_reserve_count, algorithmAttempts: c.algorithm_attempts,
  };
}
