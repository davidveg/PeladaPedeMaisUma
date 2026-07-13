import { adminRequired, audit, db, ensureDb } from "../../../lib/database";

export async function GET() {
  await ensureDb();
  const c: any = await db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first();
  return Response.json({
    config: {
      defaultPlayerCount: c.default_player_count,
      minimumRecommendedPlayers: c.minimum_recommended_players,
      maximumRecommendedPlayers: c.maximum_recommended_players,
      speedWeight: c.speed_weight,
      skillWeight: c.skill_weight,
      markingWeight: c.marking_weight,
      maximumPositionDifference: c.maximum_position_difference,
      protectedTopPlayersPercentage: c.protected_top_players_percentage,
      defaultReserveCount: c.default_reserve_count,
      algorithmAttempts: c.algorithm_attempts,
    },
  });
}

export async function PUT(request: Request) {
  const admin: any = await adminRequired(request);
  if (!admin) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const c = await request.json() as any;
  const weights = [+c.speedWeight, +c.skillWeight, +c.markingWeight];
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0 || weight > 1) || Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) > .0001) {
    return Response.json({ error: "Os pesos de velocidade, habilidade e marcação devem somar 100%." }, { status: 400 });
  }

  const previous = await db().prepare(`SELECT default_player_count,minimum_recommended_players,maximum_recommended_players,speed_weight,skill_weight,marking_weight,maximum_position_difference,protected_top_players_percentage,default_reserve_count,algorithm_attempts FROM system_configuration WHERE id=1`).first();
  await db().prepare(`UPDATE system_configuration SET default_player_count=?,minimum_recommended_players=?,maximum_recommended_players=?,speed_weight=?,skill_weight=?,marking_weight=?,maximum_position_difference=?,protected_top_players_percentage=?,default_reserve_count=?,algorithm_attempts=?,updated_at=? WHERE id=1`)
    .bind(c.defaultPlayerCount, c.minimumRecommendedPlayers, c.maximumRecommendedPlayers, weights[0], weights[1], weights[2], c.maximumPositionDifference, c.protectedTopPlayersPercentage, c.defaultReserveCount, c.algorithmAttempts, new Date().toISOString()).run();
  await audit(admin.id, "UPDATE", "configuration", "1", c, previous);
  return Response.json({ ok: true, message: "Configurações salvas com sucesso." });
}
