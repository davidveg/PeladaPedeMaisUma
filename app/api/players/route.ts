import { audit, currentPlayerAccount, db, ensureDb, staffRequired, staffRequiredAny } from "../../../lib/database";
import { attachPlayerCareerStats } from "../../../lib/player-career-stats";
import { loadPlayerCareerStats } from "../../../lib/player-career-stats-store";
import { ensureCareerSeasonCurrent } from "../../../lib/career-season";
import { attachHistoricalPerformance } from "../../../lib/historical-performance-store";
import { playerTypeValidationError } from "../../../lib/player-types";

const map = (row: any) => ({
  ...row,
  fullName: row.full_name,
  displayName: row.display_name,
  primaryPosition: row.primary_position,
  photoUrl: row.photo_url,
  marking: Number(row.marking ?? 3),
  tacticalIntelligence: Number(row.tactical_intelligence ?? 3),
  competitiveness: Number(row.competitiveness ?? 3),
  goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.speed ?? 3),
  goalExit: Number(row.goal_exit ?? row.marking ?? 3),
  goalkeeperSafety: Number(row.goalkeeper_safety ?? 3),
  goalkeeperLeadership: Number(row.goalkeeper_leadership ?? 3),
  momentum: Number(row.momentum ?? 0),
  resultMomentum: Number(row.result_momentum ?? 0),
  votingMomentum: Number(row.voting_momentum ?? 0),
  aliases: JSON.parse(row.aliases || "[]"),
  active: Boolean(row.active),
});

export async function GET(request: Request) {
  if (!(await currentPlayerAccount(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await staffRequiredAny(request,["PLAYERS_MANAGE","SEPARATIONS_MANAGE","MATCH_RESULTS_MANAGE"]))) return Response.json({ error: "Sem permissão para consultar os dados administrativos dos jogadores." }, { status: 403 });
  await ensureDb();
  await ensureCareerSeasonCurrent();
  const [rows, careerStats, configuration] = await Promise.all([
    db().prepare(`SELECT * FROM players WHERE deleted_at IS NULL ORDER BY display_name`).all(),
    loadPlayerCareerStats(),
    db().prepare(`SELECT historical_learning_enabled FROM system_configuration WHERE id=1`).first<any>(),
  ]);
  const players = rows.results.map(row => attachPlayerCareerStats(map(row), careerStats));
  return Response.json({ players: await attachHistoricalPerformance(players as any[], Boolean(configuration?.historical_learning_enabled)) }, { headers: { "cache-control": "no-store, max-age=0", pragma: "no-cache" } });
}

export async function POST(request: Request) {
  if (!(await currentPlayerAccount(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const admin: any = await staffRequired(request,"PLAYERS_MANAGE");
  if (!admin) return Response.json({ error: "Sem permissão para gerenciar jogadores." }, { status: 403 });
  await ensureDb();
  const player = await request.json() as any;
  const values = playerRatings(player);
  if (!validPlayer(player, values)) return Response.json({ error: "Preencha nome, posição e todos os atributos entre 1 e 5." }, { status: 400 });
  const typeError = playerTypeValidationError(player.type, player.primaryPosition);
  if (typeError) return Response.json({ error: typeError }, { status: 400 });
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,tactical_intelligence,competitiveness,goalkeeper_positioning,goal_exit,goalkeeper_safety,goalkeeper_leadership,photo_url,active,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, player.fullName || player.displayName, player.displayName, player.nickname || null, JSON.stringify(player.aliases || []), player.type || "guest", player.primaryPosition, values.speed, values.skill, values.marking, values.tacticalIntelligence, values.competitiveness, values.goalkeeperPositioning, values.goalExit, values.goalkeeperSafety, values.goalkeeperLeadership, player.photoUrl || null, player.active === false ? 0 : 1, player.notes || null, now, now).run();
  await audit(admin.id, "CREATE", "player", id, { ...player, ...values });
  return Response.json({ id }, { status: 201 });
}

export async function PUT(request: Request) {
  if (!(await currentPlayerAccount(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const admin: any = await staffRequired(request,"PLAYERS_MANAGE");
  if (!admin) return Response.json({ error: "Sem permissão para gerenciar jogadores." }, { status: 403 });
  await ensureDb();
  const player = await request.json() as any;
  const values = playerRatings(player);
  if (!validPlayer(player, values)) return Response.json({ error: "Preencha nome, posição e todos os atributos entre 1 e 5." }, { status: 400 });
  const typeError = playerTypeValidationError(player.type, player.primaryPosition);
  if (typeError) return Response.json({ error: typeError }, { status: 400 });
  const previous = await db().prepare(`SELECT full_name,display_name,nickname,type,primary_position,speed,skill,marking,tactical_intelligence,competitiveness,goalkeeper_positioning,goal_exit,goalkeeper_safety,goalkeeper_leadership,photo_url,active,notes FROM players WHERE id=? AND deleted_at IS NULL`).bind(player.id).first();
  if (!previous) return Response.json({ error: "Jogador não encontrado." }, { status: 404 });
  await db().prepare(`UPDATE players SET full_name=?,display_name=?,nickname=?,aliases=?,type=?,primary_position=?,speed=?,skill=?,marking=?,tactical_intelligence=?,competitiveness=?,goalkeeper_positioning=?,goal_exit=?,goalkeeper_safety=?,goalkeeper_leadership=?,photo_url=?,active=?,notes=?,updated_at=? WHERE id=? AND deleted_at IS NULL`)
    .bind(player.fullName, player.displayName, player.nickname || null, JSON.stringify(player.aliases || []), player.type, player.primaryPosition, values.speed, values.skill, values.marking, values.tacticalIntelligence, values.competitiveness, values.goalkeeperPositioning, values.goalExit, values.goalkeeperSafety, values.goalkeeperLeadership, player.photoUrl || null, player.active ? 1 : 0, player.notes || null, new Date().toISOString(), player.id).run();
  await audit(admin.id, "UPDATE", "player", player.id, { displayName: player.displayName, type: player.type, primaryPosition: player.primaryPosition, ...values, active: Boolean(player.active), photoUrl: player.photoUrl || null }, previous);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await currentPlayerAccount(request))) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const admin: any = await staffRequired(request,"PLAYERS_MANAGE");
  if (!admin) return Response.json({ error: "Sem permissão para gerenciar jogadores." }, { status: 403 });
  await ensureDb();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Informe o jogador que será excluído." }, { status: 400 });
  const previous: any = await db().prepare(`SELECT p.id,p.display_name,p.active,p.deleted_at,
    (SELECT COUNT(*) FROM player_account_links l WHERE l.player_id=p.id)+
    (SELECT COUNT(*) FROM member_accounts m WHERE m.player_id=p.id) associated_accounts
    FROM players p WHERE p.id=? AND p.deleted_at IS NULL`).bind(id).first();
  if (!previous) return Response.json({ error: "Jogador não encontrado." }, { status: 404 });
  if (Boolean(previous.active)) return Response.json({ error: "Desative o jogador e salve a alteração antes de excluí-lo." }, { status: 409 });
  if (Number(previous.associated_accounts) > 0) return Response.json({ error: "Desassocie a conta de usuário deste jogador antes de excluí-lo." }, { status: 409 });
  const now = new Date().toISOString();
  const deleted = await db().prepare(`UPDATE players SET active=0,deleted_at=?,updated_at=?
    WHERE id=? AND active=0 AND deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM player_account_links l WHERE l.player_id=players.id)
    AND NOT EXISTS (SELECT 1 FROM member_accounts m WHERE m.player_id=players.id)`).bind(now, now, id).run();
  if (Number(deleted.meta?.changes ?? 0) !== 1) return Response.json({ error: "O jogador não atende mais aos critérios de exclusão. Atualize a página e tente novamente." }, { status: 409 });
  await audit(admin.id, "DELETE", "player", id, { displayName: previous.display_name, active: false, deletedAt: now, deletionType: "logical" }, previous);
  return Response.json({ ok: true, message: "Jogador excluído do cadastro. O histórico esportivo foi preservado." });
}

function rating(value: any) { return Math.round(Number(value) * 10) / 10; }
function playerRatings(player: any) {
  return {
    speed: rating(player.speed), skill: rating(player.skill), marking: rating(player.marking ?? 3),
    tacticalIntelligence: rating(player.tacticalIntelligence ?? 3), competitiveness: rating(player.competitiveness ?? 3),
    goalkeeperPositioning: rating(player.goalkeeperPositioning ?? player.speed ?? 3), goalExit: rating(player.goalExit ?? player.marking ?? 3),
    goalkeeperSafety: rating(player.goalkeeperSafety ?? 3), goalkeeperLeadership: rating(player.goalkeeperLeadership ?? 3),
  };
}
function validPlayer(player: any, ratings: Record<string, number>) { return Boolean(player.displayName && player.primaryPosition) && Object.values(ratings).every(value => Number.isFinite(value) && value >= 1 && value <= 5); }
