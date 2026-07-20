import { db, ensureDb } from "../../../lib/database";
import { attachPlayerCareerStats } from "../../../lib/player-career-stats";
import { loadPlayerCareerStats } from "../../../lib/player-career-stats-store";
import { publicPlayer } from "../../../lib/public-player";

export async function GET() {
  await ensureDb();
  const [players, careerStats, configuration, careerConfiguration] = await Promise.all([
    db().prepare(`SELECT id,display_name,type,primary_position,speed,skill,marking,goalkeeper_positioning,goal_exit,momentum,photo_url FROM players WHERE deleted_at IS NULL AND active=1 ORDER BY display_name`).all(),
    loadPlayerCareerStats(),
    db().prepare(`SELECT speed_weight,skill_weight,marking_weight FROM system_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT momentum_multiplier,track_contributions,card_tiers_enabled,card_bronze_max,card_silver_max,card_gold_max FROM career_configuration WHERE id=1`).first<any>(),
  ]);

  return Response.json({
    players: players.results.map(row => attachPlayerCareerStats(publicPlayer(row), careerStats)),
    config: {
      speedWeight: Number(configuration?.speed_weight ?? .48),
      skillWeight: Number(configuration?.skill_weight ?? .32),
      markingWeight: Number(configuration?.marking_weight ?? .2),
      momentumMultiplier: Number(careerConfiguration?.momentum_multiplier ?? 1),
      showContributions: Boolean(careerConfiguration?.track_contributions ?? 1),
      cardTiersEnabled: Boolean(careerConfiguration?.card_tiers_enabled ?? 0),
      cardBronzeMax: Number(careerConfiguration?.card_bronze_max ?? 2.4),
      cardSilverMax: Number(careerConfiguration?.card_silver_max ?? 3.9),
      cardGoldMax: Number(careerConfiguration?.card_gold_max ?? 4.5),
    },
  }, { headers: { "cache-control": "no-store, max-age=0" } });
}
