import { db, ensureDb } from "../../../lib/database";
import { attachPlayerCareerStats } from "../../../lib/player-career-stats";
import { loadPlayerCareerStats } from "../../../lib/player-career-stats-store";
import { publicPlayer } from "../../../lib/public-player";
import { ensureCareerSeasonCurrent } from "../../../lib/career-season";

export async function GET(request?: Request) {
  const configOnly = Boolean(request && new URL(request.url).searchParams.get("configOnly") === "1");
  await ensureDb();
  if (!configOnly) await ensureCareerSeasonCurrent();
  const [players, careerStats, configuration, careerConfiguration] = await Promise.all([
    configOnly ? Promise.resolve({ results: [] }) : db().prepare(`SELECT id,display_name,type,primary_position,secondary_position,speed,skill,marking,tactical_intelligence,competitiveness,goalkeeper_positioning,goal_exit,goalkeeper_safety,goalkeeper_leadership,momentum,result_momentum,voting_momentum,photo_url FROM players WHERE deleted_at IS NULL AND active=1 ORDER BY display_name`).all(),
    configOnly ? Promise.resolve({}) : loadPlayerCareerStats(),
    db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT result_momentum_multiplier,momentum_multiplier,track_contributions,card_tiers_enabled,card_bronze_max,card_silver_max,card_gold_max FROM career_configuration WHERE id=1`).first<any>(),
  ]);

  return Response.json({
    players: players.results.map(row => attachPlayerCareerStats(publicPlayer(row), careerStats)),
    config: {
      speedWeight: Number(configuration?.speed_weight ?? .35),
      skillWeight: Number(configuration?.skill_weight ?? .25),
      markingWeight: Number(configuration?.marking_weight ?? .15),
      tacticalIntelligenceWeight: Number(configuration?.tactical_intelligence_weight ?? .2),
      competitivenessWeight: Number(configuration?.competitiveness_weight ?? .05),
      goalkeeperDefensesWeight: Number(configuration?.goalkeeper_defenses_weight ?? .4),
      goalkeeperPositioningWeight: Number(configuration?.goalkeeper_positioning_weight ?? .25),
      goalkeeperSafetyWeight: Number(configuration?.goalkeeper_safety_weight ?? .2),
      goalkeeperFootworkWeight: Number(configuration?.goalkeeper_footwork_weight ?? .1),
      goalkeeperLeadershipWeight: Number(configuration?.goalkeeper_leadership_weight ?? .05),
      ratingSystemVersion: 2,
      resultMomentumMultiplier: Number(careerConfiguration?.result_momentum_multiplier ?? 1),
      momentumMultiplier: Number(careerConfiguration?.momentum_multiplier ?? 1),
      showContributions: Boolean(careerConfiguration?.track_contributions ?? 1),
      cardTiersEnabled: Boolean(careerConfiguration?.card_tiers_enabled ?? 0),
      cardBronzeMax: Number(careerConfiguration?.card_bronze_max ?? 2.4),
      cardSilverMax: Number(careerConfiguration?.card_silver_max ?? 3.9),
      cardGoldMax: Number(careerConfiguration?.card_gold_max ?? 4.5),
    },
  }, { headers: { "cache-control": "no-store, max-age=0" } });
}
