import { audit, db, playerAccountRequired } from "../../../lib/database";
import { attachPlayerCareerStats } from "../../../lib/player-career-stats";
import { loadPlayerCareerStats } from "../../../lib/player-career-stats-store";

const positions = new Set(["Defesa", "Meio-campo", "Ataque", "Goleiro"]);

export async function GET(request: Request) {
  const member: any = await playerAccountRequired(request);
  if (!member) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (!member.playerId) return Response.json({ member, player: null });
  const [row, careerStats, configuration, careerConfiguration] = await Promise.all([
    db().prepare(`SELECT * FROM players WHERE id=? AND deleted_at IS NULL`).bind(member.playerId).first<any>(),
    loadPlayerCareerStats(),
    db().prepare(`SELECT speed_weight,skill_weight,marking_weight FROM system_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT momentum_multiplier,track_contributions,card_tiers_enabled,card_bronze_max,card_silver_max,card_gold_max FROM career_configuration WHERE id=1`).first<any>(),
  ]);
  if (!row) return Response.json({ member: { ...member, playerId: null }, player: null });
  const player = attachPlayerCareerStats({ id: row.id, fullName: row.full_name, displayName: row.display_name, nickname: row.nickname, type: row.type, primaryPosition: row.primary_position, speed: Number(row.speed), skill: Number(row.skill), marking: Number(row.marking ?? 3), goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.speed ?? 3), goalExit: Number(row.goal_exit ?? row.marking ?? 3), momentum: Number(row.momentum ?? 0), photoUrl: row.photo_url, notes: row.notes, active: !!row.active }, careerStats);
  return Response.json({ member, player, config: { speedWeight: Number(configuration?.speed_weight ?? .48), skillWeight: Number(configuration?.skill_weight ?? .32), markingWeight: Number(configuration?.marking_weight ?? .2), momentumMultiplier: Number(careerConfiguration?.momentum_multiplier ?? 1), showContributions: Boolean(careerConfiguration?.track_contributions ?? 1), cardTiersEnabled: Boolean(careerConfiguration?.card_tiers_enabled ?? 0), cardBronzeMax: Number(careerConfiguration?.card_bronze_max ?? 2.4), cardSilverMax: Number(careerConfiguration?.card_silver_max ?? 3.9), cardGoldMax: Number(careerConfiguration?.card_gold_max ?? 4.5) } }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const member: any = await playerAccountRequired(request);
  if (!member?.playerId) return Response.json({ error: "Associe sua conta a um jogador antes de editar o perfil." }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as any;
  const fullName = String(payload.fullName || "").trim(), nickname = String(payload.nickname || "").trim(), primaryPosition = String(payload.primaryPosition || ""), notes = String(payload.notes || "").trim(), photoUrl = payload.photoUrl ? String(payload.photoUrl) : null;
  if (fullName.length < 2 || fullName.length > 120) return Response.json({ error: "Informe um nome completo válido." }, { status: 400 });
  if (nickname.length > 60 || notes.length > 1000 || !positions.has(primaryPosition)) return Response.json({ error: "Revise apelido, posição e observações." }, { status: 400 });
  if (photoUrl && !/^\/api\/upload\?key=players(?:%2f|\/)/i.test(photoUrl)) return Response.json({ error: "A referência da foto é inválida." }, { status: 400 });
  const previous = await db().prepare(`SELECT full_name,nickname,primary_position,photo_url,notes FROM players WHERE id=? AND deleted_at IS NULL`).bind(member.playerId).first();
  if (!previous) return Response.json({ error: "Jogador não encontrado." }, { status: 404 });
  await db().prepare(`UPDATE players SET full_name=?,nickname=?,primary_position=?,photo_url=?,notes=?,updated_at=? WHERE id=?`).bind(fullName, nickname || null, primaryPosition, photoUrl, notes || null, new Date().toISOString(), member.playerId).run();
  await audit(member.accountType === "administrator" ? member.id : null, "MEMBER_PROFILE_UPDATE", "player", member.playerId, { fullName, nickname: nickname || null, primaryPosition, photoUrl, notes: notes || null, accountId: member.id, accountType: member.accountType }, previous);
  return Response.json({ ok: true, message: "Perfil atualizado com sucesso." });
}
