/* D1 and untrusted JSON payloads are narrowed explicitly at each use. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb, staffRequired } from "../../../../../lib/database";
import { ensureCareerSeasonCurrent } from "../../../../../lib/career-season";
import { balanceTeams, matchPlayers, parseWhatsApp, type Config, type Player } from "../../../../../lib/football";
import { createMatchSeparationProposal, loadMatchSeparationDraft } from "../../../../../lib/scheduled-matches";
import { attachHistoricalPerformance } from "../../../../../lib/historical-performance-store";
const adminRequired=(request:Request)=>staffRequired(request,"SEPARATIONS_MANAGE");

export async function POST(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();
  await ensureCareerSeasonCurrent();
  const payload = await request.json().catch(() => ({})) as any;
  if (payload.matchId) {
    try {
      const proposal = payload.loadDraft
        ? await loadMatchSeparationDraft(String(payload.matchId))
        : await createMatchSeparationProposal(String(payload.matchId), Number(payload.nonce) || 0);
      return Response.json({
        parsed: { title: proposal.match.title, date: proposal.match.date },
        ...proposal,
      }, { headers: { "cache-control": "no-store" } });
    } catch (error: any) {
      return Response.json({ error: error?.message || "Não foi possível gerar os times." }, { status: Number(error?.status || 400) });
    }
  }
  const [playerRows, systemConfig, careerConfig] = await Promise.all([
    db().prepare(`SELECT * FROM players WHERE deleted_at IS NULL AND active=1 ORDER BY display_name`).all(),
    db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT result_momentum_multiplier,momentum_multiplier FROM career_configuration WHERE id=1`).first<any>(),
  ]);
  const players = await attachHistoricalPerformance(playerRows.results.map(mapPlayer), Boolean(systemConfig?.historical_learning_enabled)), nonce = Math.max(0, Math.floor(Number(payload.nonce) || 0));
  let selected: Player[] = [], parsed: ReturnType<typeof parseWhatsApp> | null = null, matches: ReturnType<typeof matchPlayers> = [];
  if (Array.isArray(payload.playerIds)) {
    const ids = [...new Set(payload.playerIds.map(String))];
    selected = ids.map(id => players.find(player => player.id === id)).filter(Boolean) as Player[];
    if (selected.length !== ids.length) return Response.json({ error: "A seleção contém jogador inexistente ou inativo." }, { status: 422 });
  } else {
    const originalText = String(payload.originalText || "");
    if (!originalText.trim()) return Response.json({ error: "Cole a lista de confirmações do WhatsApp." }, { status: 400 });
    parsed = parseWhatsApp(originalText);
    matches = matchPlayers(parsed.confirmed, players);
    const unresolved = matches.filter(match => match.status !== "found");
    if (parsed.duplicates.length || unresolved.length) return Response.json({
      error: "Existem nomes duplicados, não reconhecidos ou ambíguos. Corrija-os na aplicação web antes de continuar.",
      parsed, matches: matches.map(publicMatch),
    }, { status: 422 });
    selected = matches.map(match => (match as any).player);
  }
  const config: Config = {
    speedWeight: Number(systemConfig.speed_weight), skillWeight: Number(systemConfig.skill_weight), markingWeight: Number(systemConfig.marking_weight),
    tacticalIntelligenceWeight:Number(systemConfig.tactical_intelligence_weight??.2), competitivenessWeight:Number(systemConfig.competitiveness_weight??.05),
    goalkeeperDefensesWeight:Number(systemConfig.goalkeeper_defenses_weight??.4), goalkeeperPositioningWeight:Number(systemConfig.goalkeeper_positioning_weight??.25), goalkeeperSafetyWeight:Number(systemConfig.goalkeeper_safety_weight??.2), goalkeeperFootworkWeight:Number(systemConfig.goalkeeper_footwork_weight??.1), goalkeeperLeadershipWeight:Number(systemConfig.goalkeeper_leadership_weight??.05), ratingSystemVersion:2,
    resultMomentumMultiplier: Number(careerConfig?.result_momentum_multiplier ?? 1), momentumMultiplier: Number(careerConfig?.momentum_multiplier ?? 1), historicalLearningEnabled: Boolean(systemConfig?.historical_learning_enabled), maximumPositionDifference: Number(systemConfig.maximum_position_difference),
    protectedTopPlayersPercentage: Number(systemConfig.protected_top_players_percentage), algorithmAttempts: Number(systemConfig.algorithm_attempts),
  };
  try {
    const result = balanceTeams(selected, config, nonce);
    return Response.json({ parsed, matches: matches.map(publicMatch), players: selected, result, config }, { headers: { "cache-control": "no-store" } });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Não foi possível gerar os times." }, { status: 400 });
  }
}

function mapPlayer(row: any): Player {
  return { id: row.id, fullName: row.full_name, displayName: row.display_name, nickname: row.nickname, aliases: JSON.parse(row.aliases || "[]"), type: row.type, primaryPosition: row.primary_position, speed: Number(row.speed), skill: Number(row.skill), marking: Number(row.marking ?? 3), tacticalIntelligence:Number(row.tactical_intelligence??3), competitiveness:Number(row.competitiveness??3), goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.speed ?? 3), goalExit: Number(row.goal_exit ?? row.marking ?? 3), goalkeeperSafety:Number(row.goalkeeper_safety??3), goalkeeperLeadership:Number(row.goalkeeper_leadership??3), momentum: Number(row.momentum ?? 0), resultMomentum: Number(row.result_momentum ?? 0), votingMomentum: Number(row.voting_momentum ?? 0), photoUrl: row.photo_url, active: Boolean(row.active) } as Player;
}

function publicMatch(match: any) {
  return match.status === "found" ? { name: match.name, status: match.status, player: match.player } : { name: match.name, status: match.status, suggestions: match.suggestions || [] };
}
