/* D1 and untrusted JSON payloads are narrowed explicitly at each use. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { adminRequired, db, ensureDb } from "../../../../../lib/database";
import { balanceTeams, matchPlayers, parseWhatsApp, type Config, type Player } from "../../../../../lib/football";

export async function POST(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  await ensureDb();
  const payload = await request.json().catch(() => ({})) as any;
  const [playerRows, systemConfig, careerConfig] = await Promise.all([
    db().prepare(`SELECT * FROM players WHERE deleted_at IS NULL AND active=1 ORDER BY display_name`).all(),
    db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT momentum_multiplier FROM career_configuration WHERE id=1`).first<any>(),
  ]);
  const players = playerRows.results.map(mapPlayer), nonce = Math.max(0, Math.floor(Number(payload.nonce) || 0));
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
    momentumMultiplier: Number(careerConfig?.momentum_multiplier ?? 1), maximumPositionDifference: Number(systemConfig.maximum_position_difference),
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
  return { id: row.id, fullName: row.full_name, displayName: row.display_name, nickname: row.nickname, aliases: JSON.parse(row.aliases || "[]"), type: row.type, primaryPosition: row.primary_position, speed: Number(row.speed), skill: Number(row.skill), marking: Number(row.marking ?? 3), goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.speed ?? 3), goalExit: Number(row.goal_exit ?? row.marking ?? 3), momentum: Number(row.momentum ?? 0), photoUrl: row.photo_url, active: Boolean(row.active) } as Player;
}

function publicMatch(match: any) {
  return match.status === "found" ? { name: match.name, status: match.status, player: match.player } : { name: match.name, status: match.status, suggestions: match.suggestions || [] };
}
