/* Scheduled match rows and snapshots are narrowed at the service boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, db, ensureDb } from "./database";
import { balanceTeams, defaultConfig, type Config, type Player } from "./football";

export type AttendanceStatus = "PRESENT" | "ABSENT";

export async function loadScheduledMatches(account: any, includePlayers = false) {
  await ensureDb();
  const [matchResult, totalActive] = await Promise.all([db().prepare(
    `SELECT m.*,s.match_title separation_title
     FROM scheduled_matches m
     LEFT JOIN team_separations s ON s.id=m.separation_id
     ORDER BY CASE m.status WHEN 'OPEN' THEN 0 ELSE 1 END,
              CASE WHEN m.status='OPEN' THEN m.match_at END ASC,
              m.match_at DESC`,
  ).all(), db().prepare(`SELECT COUNT(*) total FROM players WHERE active=1 AND deleted_at IS NULL`).first<any>()]);
  const rows = matchResult.results as any[];
  const playerRows = includePlayers
    ? (await db().prepare(`SELECT * FROM players WHERE deleted_at IS NULL AND active=1 ORDER BY display_name`).all()).results as any[]
    : [];
  const matches = [];
  for (const row of rows) {
    const attendance = (await db().prepare(
      `SELECT a.*,p.display_name,p.photo_url,p.type,p.primary_position
       FROM match_attendance a JOIN players p ON p.id=a.player_id
       WHERE a.match_id=? ORDER BY p.display_name`,
    ).bind(row.id).all()).results as any[];
    matches.push(publicMatch(row, attendance, account, Number(totalActive?.total || 0)));
  }
  return {
    matches,
    players: playerRows.map(publicPlayer),
    serverNow: new Date().toISOString(),
  };
}

export async function setAttendance(params: {
  matchId: string;
  playerId: string;
  status: AttendanceStatus;
  account: any;
  administratorOverride?: boolean;
}) {
  await ensureDb();
  const { matchId, playerId, status, account, administratorOverride = false } = params;
  if (!["PRESENT", "ABSENT"].includes(status)) throw statusError("Informe presença ou ausência.", 400);
  const match: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(matchId).first();
  if (!match) throw statusError("Partida não encontrada.", 404);
  if (match.status !== "OPEN") throw statusError("A lista de presença está fechada.", 409);
  if (!administratorOverride && new Date(match.confirmation_deadline).getTime() < Date.now()) {
    throw statusError("O prazo para confirmar presença foi encerrado.", 409);
  }
  if (!administratorOverride && String(account.playerId || "") !== playerId) {
    throw statusError("Você só pode responder pela sua própria associação.", 403);
  }
  if (administratorOverride && account.accountType !== "administrator") throw statusError("Não autorizado.", 401);
  const player: any = await db().prepare(
    `SELECT id,display_name FROM players WHERE id=? AND active=1 AND deleted_at IS NULL`,
  ).bind(playerId).first();
  if (!player) throw statusError("Jogador não encontrado ou inativo.", 404);
  const previous: any = await db().prepare(
    `SELECT * FROM match_attendance WHERE match_id=? AND player_id=?`,
  ).bind(matchId, playerId).first();
  if (previous?.status === status) {
    return { changed: false, attendance: mapAttendance(previous, player.display_name, match.max_changes) };
  }
  const nextChanges = previous ? Number(previous.change_count || 0) + 1 : 0;
  if (!administratorOverride && nextChanges > Number(match.max_changes)) {
    throw statusError(`Você atingiu o limite de ${match.max_changes} remarcações para esta partida.`, 409);
  }
  const now = new Date().toISOString(), id = previous?.id || crypto.randomUUID();
  if (previous) {
    const updated = await db().prepare(
      `UPDATE match_attendance
       SET status=?,change_count=?,responded_by_account_type=?,responded_by_account_id=?,
           updated_by_administrator_id=?,updated_at=?
       WHERE id=? AND status=? AND change_count=?`,
    ).bind(status, nextChanges, account.accountType, account.id, administratorOverride ? account.id : null, now, id, previous.status, previous.change_count).run();
    if (Number(updated.meta?.changes || 0) !== 1) throw statusError("A resposta foi alterada em outro dispositivo. Atualize e tente novamente.", 409);
  } else {
    try {
      await db().prepare(
        `INSERT INTO match_attendance
         (id,match_id,player_id,status,change_count,responded_by_account_type,responded_by_account_id,updated_by_administrator_id,created_at,updated_at)
         VALUES (?,?,?,?,0,?,?,?,?,?)`,
      ).bind(id, matchId, playerId, status, account.accountType, account.id, administratorOverride ? account.id : null, now, now).run();
    } catch (error: any) {
      if (String(error?.message || error).toLowerCase().includes("unique")) throw statusError("A resposta foi registrada em outro dispositivo. Atualize para continuar.", 409);
      throw error;
    }
  }
  await audit(account.accountType === "administrator" ? account.id : null, "MATCH_ATTENDANCE_CHANGED", "scheduled_match", matchId, {
    playerId, playerName: player.display_name, status, changeCount: nextChanges, administratorOverride,
  }, previous ? { status: previous.status, changeCount: previous.change_count } : undefined);
  return {
    changed: true,
    playerName: String(player.display_name),
    attendance: { id, playerId, playerName: player.display_name, status, changeCount: nextChanges, maxChanges: Number(match.max_changes) },
    match,
  };
}

export async function createSeparationFromMatch(matchId: string, admin: any) {
  await ensureDb();
  const match: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(matchId).first();
  if (!match) throw statusError("Partida não encontrada.", 404);
  if (match.separation_id) return { match, separationId: String(match.separation_id), alreadyCreated: true };
  if (match.status !== "OPEN") throw statusError("Somente uma partida aberta pode gerar a separação.", 409);
  const presentRows = (await db().prepare(
    `SELECT p.* FROM match_attendance a JOIN players p ON p.id=a.player_id
     WHERE a.match_id=? AND a.status='PRESENT' AND p.active=1 AND p.deleted_at IS NULL`,
  ).bind(matchId).all()).results as any[];
  if (presentRows.length < 4) throw statusError("São necessários pelo menos 4 jogadores presentes para gerar a separação.", 409);
  const [systemConfig, careerConfig] = await Promise.all([
    db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT momentum_multiplier FROM career_configuration WHERE id=1`).first<any>(),
  ]);
  const config: Config = {
    ...defaultConfig,
    speedWeight: Number(systemConfig?.speed_weight ?? defaultConfig.speedWeight),
    skillWeight: Number(systemConfig?.skill_weight ?? defaultConfig.skillWeight),
    markingWeight: Number(systemConfig?.marking_weight ?? defaultConfig.markingWeight),
    momentumMultiplier: Number(careerConfig?.momentum_multiplier ?? 1),
    maximumPositionDifference: Number(systemConfig?.maximum_position_difference ?? 1),
    protectedTopPlayersPercentage: Number(systemConfig?.protected_top_players_percentage ?? .25),
    algorithmAttempts: Number(systemConfig?.algorithm_attempts ?? 2500),
  };
  const result = balanceTeams(presentRows.map(mapPlayer), config);
  const id = crypto.randomUUID(), now = new Date().toISOString(), date = String(match.match_at).slice(0, 10);
  const batch = await db().batch([
    db().prepare(
      `INSERT INTO team_separations
       (id,match_title,match_date,location,original_text,snapshot,manually_adjusted,balance_score,balance_classification,confirmed_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,0,?,?,?,?,?)`,
    ).bind(id, match.title, date, match.location || null, "", JSON.stringify(result), result.cost, result.rating, now, now, now),
    db().prepare(`UPDATE scheduled_matches SET status='CLOSED',separation_id=?,closed_at=?,updated_at=? WHERE id=? AND status='OPEN' AND separation_id IS NULL`)
      .bind(id, now, now, matchId),
  ]);
  if (Number((batch[1] as any)?.meta?.changes || 0) !== 1) {
    await db().prepare(`DELETE FROM team_separations WHERE id=?`).bind(id).run();
    const latest: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(matchId).first();
    if (latest?.separation_id) return { match: latest, separationId: String(latest.separation_id), alreadyCreated: true };
    throw statusError("A partida foi alterada enquanto a separação era gerada. Atualize e tente novamente.", 409);
  }
  await audit(admin.id, "MATCH_CLOSED_AND_SEPARATED", "scheduled_match", matchId, {
    separationId: id, presentPlayers: presentRows.length, balanceClassification: result.rating,
  });
  return { match: { ...match, status: "CLOSED", separation_id: id }, separationId: id, result };
}

export function statusError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function publicMatch(row: any, attendance: any[], account: any, totalActive: number) {
  const own = attendance.find(item => String(item.player_id) === String(account?.playerId || ""));
  return {
    id: String(row.id), title: String(row.title), matchAt: String(row.match_at),
    confirmationDeadline: String(row.confirmation_deadline), location: row.location ? String(row.location) : null,
    maxChanges: Number(row.max_changes), status: String(row.status),
    acceptingResponses: row.status === "OPEN" && new Date(row.confirmation_deadline).getTime() >= Date.now(),
    separationId: row.separation_id ? String(row.separation_id) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    counts: {
      present: attendance.filter(item => item.status === "PRESENT").length,
      absent: attendance.filter(item => item.status === "ABSENT").length,
      pending: Math.max(0, totalActive - attendance.length),
    },
    attendance: attendance.map(item => mapAttendance(item, item.display_name, row.max_changes)),
    viewer: {
      playerId: account?.playerId ? String(account.playerId) : null,
      status: own?.status || null,
      changeCount: Number(own?.change_count || 0),
      changesRemaining: Math.max(0, Number(row.max_changes) - Number(own?.change_count || 0)),
      canRespond: Boolean(account?.playerId && row.status === "OPEN" && new Date(row.confirmation_deadline).getTime() >= Date.now()),
    },
  };
}

function publicPlayer(row: any) {
  return { id: String(row.id), displayName: String(row.display_name), photoUrl: row.photo_url || null, type: row.type, primaryPosition: row.primary_position };
}

function mapAttendance(row: any, playerName: string, maxChanges: number) {
  return {
    id: String(row.id), playerId: String(row.player_id), playerName: String(playerName),
    photoUrl: row.photo_url || null, status: row.status as AttendanceStatus,
    changeCount: Number(row.change_count || 0), maxChanges: Number(maxChanges),
    updatedAt: String(row.updated_at || row.created_at),
    administratorOverride: Boolean(row.updated_by_administrator_id),
  };
}

function mapPlayer(row: any): Player {
  return {
    id: String(row.id), fullName: String(row.full_name), displayName: String(row.display_name),
    nickname: row.nickname, aliases: JSON.parse(row.aliases || "[]"), type: row.type,
    primaryPosition: row.primary_position, speed: Number(row.speed), skill: Number(row.skill),
    marking: Number(row.marking ?? 3), goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.speed ?? 3),
    goalExit: Number(row.goal_exit ?? row.marking ?? 3), momentum: Number(row.momentum ?? 0),
    photoUrl: row.photo_url, active: Boolean(row.active),
  };
}
