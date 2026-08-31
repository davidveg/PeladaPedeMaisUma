/* Scheduled match rows and snapshots are narrowed at the service boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, db, ensureDb } from "./database";
import { ensureCareerSeasonCurrent } from "./career-season";
import { attachHistoricalPerformance } from "./historical-performance-store";
import { balanceTeams, defaultConfig, recalculateTeamBalance, type Config, type Player } from "./football";
import { buildMatchAttendanceShareMessage } from "./match-attendance-sharing";
import { instanceConfigurationFromRow } from "./instance-config";
import { refreshMatchWeather, weatherFromRow } from "./match-weather";

export type AttendanceStatus = "PRESENT" | "ABSENT";

export async function loadScheduledMatches(account: any, includePlayers = false, publicBaseUrl = "", matchId = "") {
  await ensureDb();
  const [matchResult, totalActive, allPlayerResult, instanceRow] = await Promise.all([db().prepare(
    `SELECT m.*,s.match_title separation_title,draft.id separation_draft_id,
            draft.updated_at separation_draft_updated_at,draft.present_player_ids separation_draft_player_ids
     FROM scheduled_matches m
     LEFT JOIN team_separations s ON s.id=m.separation_id
     LEFT JOIN match_separation_drafts draft ON draft.match_id=m.id
     WHERE (?='' OR m.id=?)
     ORDER BY CASE m.status WHEN 'OPEN' THEN 0 ELSE 1 END,
              CASE WHEN m.status='OPEN' THEN m.match_at END ASC,
              m.match_at DESC`,
  ).bind(matchId, matchId).all(), db().prepare(`SELECT COUNT(*) total FROM players WHERE active=1 AND deleted_at IS NULL`).first<any>(),
    db().prepare(`SELECT id,display_name,photo_url,type,primary_position,secondary_position FROM players WHERE deleted_at IS NULL AND active=1 ORDER BY display_name`).all(),
    db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first()]);
  const rows = matchResult.results as any[];
  const instance = instanceConfigurationFromRow(instanceRow as any);
  const playerRows = allPlayerResult.results as any[];
  const matches = [];
  for (const row of rows) {
    if (row.status === "OPEN") {
      try {
        row.weather_snapshot = JSON.stringify(await refreshMatchWeather(row, instance.defaultMatchLocation));
      } catch {
        // Weather is auxiliary: match and attendance data must remain available.
      }
    }
    const attendance = (await db().prepare(
      `SELECT a.*,p.display_name,p.photo_url,p.type,p.primary_position
       FROM match_attendance a JOIN players p ON p.id=a.player_id
       WHERE a.match_id=? ORDER BY p.display_name`,
    ).bind(row.id).all()).results as any[];
    const guestPreconfirmations = (await db().prepare(
      `SELECT waiting.*,p.display_name,p.photo_url
       FROM match_guest_preconfirmations waiting
       JOIN players p ON p.id=waiting.player_id
       WHERE waiting.match_id=? AND p.active=1 AND p.deleted_at IS NULL AND p.type='guest'
       ORDER BY p.display_name`,
    ).bind(row.id).all()).results as any[];
    matches.push(publicMatch(
      row, attendance, guestPreconfirmations, account, Number(totalActive?.total || 0), playerRows, publicBaseUrl, instance,
    ));
  }
  return {
    matches,
    players: includePlayers ? playerRows.map(publicPlayer) : undefined,
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
  if (administratorOverride && account.accountType !== "administrator" && account.role !== "moderator") throw statusError("Não autorizado.", 401);
  const player: any = await db().prepare(
    `SELECT id,display_name,type,primary_position FROM players WHERE id=? AND active=1 AND deleted_at IS NULL`,
  ).bind(playerId).first();
  if (!player) throw statusError("Jogador não encontrado ou inativo.", 404);
  const instance = instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
  const previous: any = await db().prepare(
    `SELECT * FROM match_attendance WHERE match_id=? AND player_id=?`,
  ).bind(matchId, playerId).first();
  if (previous?.status === status) {
    return { changed: false, attendance: mapAttendance(previous, player.display_name, match.max_changes) };
  }
  if (instance.guestPreconfirmationEnabled && player.type === "guest" && status === "PRESENT") {
    if (!administratorOverride) {
      throw statusError("A presença de convidados precisa ser aprovada por um administrador.", 403);
    }
    const waiting: any = await db().prepare(
      `SELECT id FROM match_guest_preconfirmations WHERE match_id=? AND player_id=?`,
    ).bind(matchId, playerId).first();
    if (!waiting) throw statusError("Adicione o convidado à lista de espera antes de aprovar sua presença.", 409);
    const totals: any = await db().prepare(
      `SELECT
         (SELECT COUNT(*) FROM match_attendance WHERE match_id=? AND status='PRESENT') present_total,
         (SELECT COUNT(*) FROM match_guest_preconfirmations WHERE match_id=?) waiting_total`,
    ).bind(matchId, matchId).first();
    if (Number(totals?.present_total || 0) + Number(totals?.waiting_total || 0) < instance.guestConfirmationThreshold) {
      throw statusError(
        `A aprovação fica disponível quando presentes e convidados na espera somarem ${instance.guestConfirmationThreshold}.`,
        409,
      );
    }
  }
  const goalkeeperConfirmation = status === "PRESENT" && (player.type === "goalkeeper" || player.primary_position === "Goleiro");
  if (goalkeeperConfirmation && await confirmedGoalkeeperCount(matchId, playerId) >= 2) {
    throw statusError("Esta partida já possui 2 goleiros confirmados. Aguarde a desistência de um deles.", 409);
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
       WHERE id=? AND status=? AND change_count=?
         AND (?=0 OR (
           SELECT COUNT(*) FROM match_attendance slots
           JOIN players goalkeepers ON goalkeepers.id=slots.player_id
           WHERE slots.match_id=? AND slots.status='PRESENT' AND slots.player_id<>?
             AND goalkeepers.active=1 AND goalkeepers.deleted_at IS NULL
             AND (goalkeepers.type='goalkeeper' OR goalkeepers.primary_position='Goleiro')
         )<2)`,
    ).bind(status, nextChanges, account.accountType, account.id, administratorOverride ? account.id : null, now, id, previous.status, previous.change_count,
      goalkeeperConfirmation ? 1 : 0, matchId, playerId).run();
    if (Number(updated.meta?.changes || 0) !== 1) {
      if (goalkeeperConfirmation && await confirmedGoalkeeperCount(matchId, playerId) >= 2) {
        throw statusError("Esta partida já possui 2 goleiros confirmados. Aguarde a desistência de um deles.", 409);
      }
      throw statusError("A resposta foi alterada em outro dispositivo. Atualize e tente novamente.", 409);
    }
  } else {
    try {
      const inserted = await db().prepare(
        `INSERT INTO match_attendance
         (id,match_id,player_id,status,change_count,responded_by_account_type,responded_by_account_id,updated_by_administrator_id,created_at,updated_at)
         SELECT ?,?,?,?,0,?,?,?,?,?
         WHERE (?=0 OR (
           SELECT COUNT(*) FROM match_attendance slots
           JOIN players goalkeepers ON goalkeepers.id=slots.player_id
           WHERE slots.match_id=? AND slots.status='PRESENT'
             AND goalkeepers.active=1 AND goalkeepers.deleted_at IS NULL
             AND (goalkeepers.type='goalkeeper' OR goalkeepers.primary_position='Goleiro')
         )<2)`,
      ).bind(id, matchId, playerId, status, account.accountType, account.id, administratorOverride ? account.id : null, now, now,
        goalkeeperConfirmation ? 1 : 0, matchId).run();
      if (Number(inserted.meta?.changes || 0) !== 1) {
        throw statusError("Esta partida já possui 2 goleiros confirmados. Aguarde a desistência de um deles.", 409);
      }
    } catch (error: any) {
      if (Number(error?.status) === 409) throw error;
      if (String(error?.message || error).toLowerCase().includes("unique")) throw statusError("A resposta foi registrada em outro dispositivo. Atualize para continuar.", 409);
      throw error;
    }
  }
  await audit(administratorOverride || account.accountType === "administrator" ? account.id : null, "MATCH_ATTENDANCE_CHANGED", "scheduled_match", matchId, {
    playerId, playerName: player.display_name, status, changeCount: nextChanges, administratorOverride,
  }, previous ? { status: previous.status, changeCount: previous.change_count } : undefined);
  await db().prepare(`DELETE FROM match_guest_preconfirmations WHERE match_id=? AND player_id=?`).bind(matchId, playerId).run();
  return {
    changed: true,
    playerName: String(player.display_name),
    attendance: { id, playerId, playerName: player.display_name, status, changeCount: nextChanges, maxChanges: Number(match.max_changes) },
    match,
  };
}

export async function setGuestPreconfirmation(params: {
  matchId: string;
  playerId: string;
  action: "ADD" | "REMOVE";
  account: any;
}) {
  await ensureDb();
  const { matchId, playerId, action, account } = params;
  if (account?.accountType !== "administrator" && account?.role !== "moderator") throw statusError("Não autorizado.", 401);
  if (!["ADD", "REMOVE"].includes(action)) throw statusError("Ação da lista de espera inválida.", 400);
  const [match, player, instanceRow] = await Promise.all([
    db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(matchId).first<any>(),
    db().prepare(`SELECT id,display_name,type FROM players WHERE id=? AND active=1 AND deleted_at IS NULL`).bind(playerId).first<any>(),
    db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first<any>(),
  ]);
  if (!match) throw statusError("Partida não encontrada.", 404);
  if (match.status !== "OPEN") throw statusError("A lista de presença está fechada.", 409);
  if (!player) throw statusError("Jogador não encontrado ou inativo.", 404);
  if (player.type !== "guest") throw statusError("A lista de espera é exclusiva para convidados.", 409);
  const instance = instanceConfigurationFromRow(instanceRow);
  if (!instance.guestPreconfirmationEnabled) throw statusError("A lista de espera de convidados está desativada.", 409);
  const previous: any = await db().prepare(
    `SELECT * FROM match_guest_preconfirmations WHERE match_id=? AND player_id=?`,
  ).bind(matchId, playerId).first();
  if (action === "REMOVE") {
    if (!previous) return { changed: false, message: "O convidado não estava na lista de espera." };
    await db().prepare(`DELETE FROM match_guest_preconfirmations WHERE id=?`).bind(previous.id).run();
    await audit(account.id, "MATCH_GUEST_PRECONFIRMATION_REMOVED", "scheduled_match", matchId, {
      playerId, playerName: player.display_name,
    }, { preconfirmed: true });
    return { changed: true, message: "Convidado removido da lista de espera." };
  }
  const attendance: any = await db().prepare(
    `SELECT * FROM match_attendance WHERE match_id=? AND player_id=?`,
  ).bind(matchId, playerId).first();
  if (attendance?.status === "PRESENT") throw statusError("Este convidado já está confirmado como presente.", 409);
  if (previous) return { changed: false, message: "O convidado já está na lista de espera." };
  const now = new Date().toISOString(), id = crypto.randomUUID();
  await db().batch([
    db().prepare(`DELETE FROM match_attendance WHERE match_id=? AND player_id=? AND status='ABSENT'`).bind(matchId, playerId),
    db().prepare(
      `INSERT INTO match_guest_preconfirmations
       (id,match_id,player_id,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    ).bind(id, matchId, playerId, account.id, now, now),
  ]);
  await audit(account.id, "MATCH_GUEST_PRECONFIRMED", "scheduled_match", matchId, {
    playerId, playerName: player.display_name, threshold: instance.guestConfirmationThreshold,
  }, attendance ? { status: attendance.status } : undefined);
  return { changed: true, message: "Convidado adicionado à lista de espera." };
}

async function confirmedGoalkeeperCount(matchId: string, excludedPlayerId = "") {
  const result: any = await db().prepare(
    `SELECT COUNT(*) total
     FROM match_attendance attendance
     JOIN players player ON player.id=attendance.player_id
     WHERE attendance.match_id=? AND attendance.status='PRESENT' AND attendance.player_id<>?
       AND player.active=1 AND player.deleted_at IS NULL
       AND (player.type='goalkeeper' OR player.primary_position='Goleiro')`,
  ).bind(matchId, excludedPlayerId).first();
  return Number(result?.total || 0);
}

export async function createMatchSeparationProposal(matchId: string, nonce = 0) {
  await ensureDb();
  await ensureCareerSeasonCurrent();
  const match: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(matchId).first();
  if (!match) throw statusError("Partida não encontrada.", 404);
  if (match.separation_id) throw statusError("Esta partida já possui uma separação confirmada.", 409);
  if (match.status !== "OPEN") throw statusError("Somente uma partida aberta pode gerar a separação.", 409);
  const presentRows = (await db().prepare(
    `SELECT p.* FROM match_attendance a JOIN players p ON p.id=a.player_id
     WHERE a.match_id=? AND a.status='PRESENT' AND p.active=1 AND p.deleted_at IS NULL
     ORDER BY p.display_name`,
  ).bind(matchId).all()).results as any[];
  if (presentRows.length < 4) throw statusError("São necessários pelo menos 4 jogadores presentes para gerar a separação.", 409);
  const [systemConfig, careerConfig] = await Promise.all([
    db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT result_momentum_multiplier,momentum_multiplier FROM career_configuration WHERE id=1`).first<any>(),
  ]);
  const config: Config = {
    ...defaultConfig,
    speedWeight: Number(systemConfig?.speed_weight ?? defaultConfig.speedWeight),
    skillWeight: Number(systemConfig?.skill_weight ?? defaultConfig.skillWeight),
    markingWeight: Number(systemConfig?.marking_weight ?? defaultConfig.markingWeight),
    tacticalIntelligenceWeight: Number(systemConfig?.tactical_intelligence_weight ?? defaultConfig.tacticalIntelligenceWeight),
    competitivenessWeight: Number(systemConfig?.competitiveness_weight ?? defaultConfig.competitivenessWeight),
    goalkeeperDefensesWeight: Number(systemConfig?.goalkeeper_defenses_weight ?? defaultConfig.goalkeeperDefensesWeight),
    goalkeeperPositioningWeight: Number(systemConfig?.goalkeeper_positioning_weight ?? defaultConfig.goalkeeperPositioningWeight),
    goalkeeperSafetyWeight: Number(systemConfig?.goalkeeper_safety_weight ?? defaultConfig.goalkeeperSafetyWeight),
    goalkeeperFootworkWeight: Number(systemConfig?.goalkeeper_footwork_weight ?? defaultConfig.goalkeeperFootworkWeight),
    goalkeeperLeadershipWeight: Number(systemConfig?.goalkeeper_leadership_weight ?? defaultConfig.goalkeeperLeadershipWeight),
    ratingSystemVersion: 2,
    resultMomentumMultiplier: Number(careerConfig?.result_momentum_multiplier ?? 1),
    momentumMultiplier: Number(careerConfig?.momentum_multiplier ?? 1),
    historicalLearningEnabled: Boolean(systemConfig?.historical_learning_enabled ?? 0),
    maximumPositionDifference: Number(systemConfig?.maximum_position_difference ?? 1),
    protectedTopPlayersPercentage: Number(systemConfig?.protected_top_players_percentage ?? .25),
    algorithmAttempts: Number(systemConfig?.algorithm_attempts ?? 2500),
  };
  const players = await attachHistoricalPerformance(presentRows.map(mapPlayer), Boolean(config.historicalLearningEnabled));
  const result = balanceTeams(players, config, Math.max(0, Math.floor(Number(nonce) || 0)));
  return {
    match: {
      id: String(match.id), title: String(match.title), matchAt: String(match.match_at),
      date: String(match.match_at).slice(0, 10), location: match.location ? String(match.location) : null,
      presentCount: players.length,
    },
    players,
    result,
    config,
  };
}

export async function loadMatchSeparationDraft(matchId: string) {
  await ensureDb();
  const instance = instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
  if (!instance.separationDraftsEnabled) throw statusError("Os rascunhos de separação estão desativados.", 403);
  const stored: any = await db().prepare(`SELECT * FROM match_separation_drafts WHERE match_id=?`).bind(matchId).first();
  const proposalNumber = Math.max(1, Math.floor(Number(stored?.proposal_number) || 1));
  const proposal = await createMatchSeparationProposal(matchId, proposalNumber - 1);
  if (!stored) return { ...proposal, draft: null };
  const currentIds = proposal.players.map(player => player.id).sort();
  const storedIds = parseIds(stored.present_player_ids);
  const stale = currentIds.length !== storedIds.length || currentIds.some((id, index) => id !== storedIds[index]);
  if (stale) return {
    ...proposal,
    draft: { exists: true, stale: true, manuallyAdjusted: Boolean(stored.manually_adjusted), updatedAt: String(stored.updated_at) },
  };
  return {
    ...proposal,
    result: JSON.parse(stored.snapshot),
    draft: { exists: true, stale: false, manuallyAdjusted: Boolean(stored.manually_adjusted), updatedAt: String(stored.updated_at) },
  };
}

export async function saveMatchSeparationDraft(matchId: string, admin: any, input: { result?: any; manuallyAdjusted?: boolean }) {
  await ensureDb();
  const instance = instanceConfigurationFromRow(await db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first());
  if (!instance.separationDraftsEnabled) throw statusError("Os rascunhos de separação estão desativados.", 403);
  if (!input?.result) throw statusError("Gere uma proposta antes de salvar o rascunho.", 400);
  const proposalNumber = Math.max(1, Math.floor(Number(input.result.proposal) || 1));
  const proposal = await createMatchSeparationProposal(matchId, proposalNumber - 1);
  const manuallyAdjusted = Boolean(input.manuallyAdjusted);
  const result = validateAndRebuildResult(input.result, proposal.players, proposal.config, proposal.result, manuallyAdjusted);
  const playerIds = proposal.players.map(player => player.id).sort(), now = new Date().toISOString(), id = crypto.randomUUID();
  const previous: any = await db().prepare(`SELECT * FROM match_separation_drafts WHERE match_id=?`).bind(matchId).first();
  await db().prepare(
    `INSERT INTO match_separation_drafts
     (id,match_id,snapshot,manually_adjusted,present_player_ids,proposal_number,created_by_administrator_id,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(match_id) DO UPDATE SET snapshot=excluded.snapshot,manually_adjusted=excluded.manually_adjusted,
       present_player_ids=excluded.present_player_ids,proposal_number=excluded.proposal_number,
       created_by_administrator_id=excluded.created_by_administrator_id,updated_at=excluded.updated_at`,
  ).bind(id, matchId, JSON.stringify(result), manuallyAdjusted ? 1 : 0, JSON.stringify(playerIds), proposalNumber, admin.id, now, now).run();
  await audit(admin.id, previous ? "MATCH_SEPARATION_DRAFT_UPDATED" : "MATCH_SEPARATION_DRAFT_CREATED", "separation_draft", matchId, {
    presentPlayers: playerIds.length, proposal: proposalNumber, manuallyAdjusted,
  }, previous ? { proposal: Number(previous.proposal_number), manuallyAdjusted: Boolean(previous.manually_adjusted) } : undefined);
  return { result, draft: { exists: true, stale: false, manuallyAdjusted, updatedAt: now } };
}

function parseIds(value: unknown) {
  try { return (JSON.parse(String(value || "[]")) as unknown[]).map(String).sort(); } catch { return []; }
}

export async function createSeparationFromMatch(
  matchId: string,
  admin: any,
  draft?: { result?: any; manuallyAdjusted?: boolean },
) {
  await ensureDb();
  const existing: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(matchId).first();
  if (!existing) throw statusError("Partida não encontrada.", 404);
  if (existing.separation_id) return { match: existing, separationId: String(existing.separation_id), alreadyCreated: true };
  const proposalNumber = Math.max(1, Math.floor(Number(draft?.result?.proposal) || 1));
  const proposal = await createMatchSeparationProposal(matchId, proposalNumber - 1);
  const match: any = existing;
  const manuallyAdjusted = Boolean(draft?.result && draft?.manuallyAdjusted);
  const result = draft?.result
    ? validateAndRebuildResult(draft.result, proposal.players, proposal.config, proposal.result, manuallyAdjusted)
    : proposal.result;
  const id = crypto.randomUUID(), now = new Date().toISOString(), date = String(match.match_at).slice(0, 10);
  const batch = await db().batch([
    db().prepare(
      `INSERT INTO team_separations
       (id,match_title,match_date,location,original_text,snapshot,manually_adjusted,balance_score,balance_classification,confirmed_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(id, match.title, date, match.location || null, "", JSON.stringify(result), manuallyAdjusted ? 1 : 0, result.cost, result.rating, now, now, now),
    db().prepare(`UPDATE scheduled_matches SET status='CLOSED',separation_id=?,closed_at=?,updated_at=? WHERE id=? AND status='OPEN' AND separation_id IS NULL`)
      .bind(id, now, now, matchId),
    db().prepare(`DELETE FROM match_separation_drafts WHERE match_id=?`).bind(matchId),
  ]);
  if (Number((batch[1] as any)?.meta?.changes || 0) !== 1) {
    await db().prepare(`DELETE FROM team_separations WHERE id=?`).bind(id).run();
    const latest: any = await db().prepare(`SELECT * FROM scheduled_matches WHERE id=?`).bind(matchId).first();
    if (latest?.separation_id) return { match: latest, separationId: String(latest.separation_id), alreadyCreated: true };
    throw statusError("A partida foi alterada enquanto a separação era gerada. Atualize e tente novamente.", 409);
  }
  await audit(admin.id, "MATCH_CLOSED_AND_SEPARATED", "scheduled_match", matchId, {
    separationId: id, presentPlayers: proposal.players.length, balanceClassification: result.rating,
    proposal: result.proposal, manuallyAdjusted,
  });
  return { match: { ...match, status: "CLOSED", separation_id: id }, separationId: id, result };
}

export function statusError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function validateAndRebuildResult(input: any, players: Player[], config: Config, generated: any, manuallyAdjusted: boolean) {
  const blueIds = Array.isArray(input?.blue) ? input.blue.map((player: any) => String(player?.id || "")) : [];
  const yellowIds = Array.isArray(input?.yellow) ? input.yellow.map((player: any) => String(player?.id || "")) : [];
  const submitted = [...blueIds, ...yellowIds], expected = new Set(players.map(player => player.id));
  if (!blueIds.length || !yellowIds.length || submitted.length !== expected.size || new Set(submitted).size !== submitted.length || submitted.some(id => !expected.has(id))) {
    throw statusError("A lista de presentes mudou ou a proposta está incompleta. Gere os times novamente.", 409);
  }
  const sameTeam = (left: string[], right: Player[]) => left.length === right.length && left.every(id => right.some(player => player.id === id));
  if (!manuallyAdjusted && (!sameTeam(blueIds, generated.blue) || !sameTeam(yellowIds, generated.yellow))) {
    throw statusError("A proposta enviada não corresponde à geração atual. Gere os times novamente.", 409);
  }
  if (!manuallyAdjusted) return generated;
  const byId = new Map(players.map(player => [player.id, player]));
  const blue = blueIds.map((id:string) => byId.get(id)!), yellow = yellowIds.map((id:string) => byId.get(id)!);
  return { ...generated, blue, yellow, ...recalculateTeamBalance(blue,yellow,config) };
}

function publicMatch(
  row: any,
  attendance: any[],
  guestPreconfirmations: any[],
  account: any,
  totalActive: number,
  players: any[],
  publicBaseUrl: string,
  instance: ReturnType<typeof instanceConfigurationFromRow>,
) {
  const own = attendance.find(item => String(item.player_id) === String(account?.playerId || ""));
  const viewerPlayer = players.find(item => String(item.id) === String(account?.playerId || ""));
  const preconfirmedIds = new Set(guestPreconfirmations.map(item => String(item.player_id)));
  const ownPreconfirmed = Boolean(account?.playerId && preconfirmedIds.has(String(account.playerId)));
  const presentPlayerIds = new Set(attendance.filter(item => item.status === "PRESENT").map(item => String(item.player_id)));
  const goalkeepersPresent = players.filter(item => presentPlayerIds.has(String(item.id)) && (item.type === "goalkeeper" || item.primary_position === "Goleiro")).length;
  const preconfirmedCount = instance.guestPreconfirmationEnabled ? guestPreconfirmations.length : 0;
  const presentCount = attendance.filter(item => item.status === "PRESENT").length;
  return {
    id: String(row.id), title: String(row.title), matchAt: String(row.match_at),
    confirmationDeadline: String(row.confirmation_deadline), location: row.location ? String(row.location) : null,
    maxChanges: Number(row.max_changes), status: String(row.status),
    acceptingResponses: row.status === "OPEN" && new Date(row.confirmation_deadline).getTime() >= Date.now(),
    separationId: row.separation_id ? String(row.separation_id) : null,
    separationDraft: {
      enabled: instance.separationDraftsEnabled,
      exists: Boolean(row.separation_draft_id),
      updatedAt: row.separation_draft_updated_at ? String(row.separation_draft_updated_at) : null,
      stale: Boolean(row.separation_draft_id) && (() => {
        const current = [...presentPlayerIds].sort(), stored = parseIds(row.separation_draft_player_ids);
        return current.length !== stored.length || current.some((id, index) => id !== stored[index]);
      })(),
    },
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    weather: weatherFromRow(row),
    counts: {
      present: presentCount,
      absent: attendance.filter(item => item.status === "ABSENT").length,
      pending: Math.max(0, totalActive - attendance.length - preconfirmedCount),
      preconfirmed: preconfirmedCount,
    },
    guestPreconfirmation: {
      enabled: instance.guestPreconfirmationEnabled,
      threshold: instance.guestConfirmationThreshold,
      canApprove: presentCount + preconfirmedCount >= instance.guestConfirmationThreshold,
    },
    preconfirmedGuestIds: instance.guestPreconfirmationEnabled ? [...preconfirmedIds] : [],
    preconfirmedGuests: instance.guestPreconfirmationEnabled ? guestPreconfirmations.map(item => ({
      playerId: String(item.player_id), playerName: String(item.display_name), photoUrl: item.photo_url || null,
    })) : [],
    goalkeepers: { present: goalkeepersPresent, max: 2 },
    attendance: attendance.map(item => mapAttendance(item, item.display_name, row.max_changes)),
    shareMessage: buildMatchAttendanceShareMessage({
      title: String(row.title), matchAt: String(row.match_at), location: row.location ? String(row.location) : null,
      players: players.map(publicPlayer),
      attendance: attendance.map(item => ({ playerId: String(item.player_id), status: item.status })),
      preconfirmedGuestIds: instance.guestPreconfirmationEnabled ? [...preconfirmedIds] : [],
      confirmationUrl: publicBaseUrl
        ? `${publicBaseUrl.replace(/\/$/, "")}/partidas?match=${encodeURIComponent(String(row.id))}`
        : null,
    }),
    viewer: {
      playerId: account?.playerId ? String(account.playerId) : null,
      status: own?.status || null,
      changeCount: Number(own?.change_count || 0),
      changesRemaining: Math.max(0, Number(row.max_changes) - Number(own?.change_count || 0)),
      isGoalkeeper: Boolean(viewerPlayer && (viewerPlayer.type === "goalkeeper" || viewerPlayer.primary_position === "Goleiro")),
      isGuest: viewerPlayer?.type === "guest",
      preconfirmed: ownPreconfirmed,
      canRespond: Boolean(account?.playerId && row.status === "OPEN" && new Date(row.confirmation_deadline).getTime() >= Date.now()),
      canConfirmPresence: Boolean(
        account?.playerId && row.status === "OPEN" && new Date(row.confirmation_deadline).getTime() >= Date.now()
        && !(instance.guestPreconfirmationEnabled && viewerPlayer?.type === "guest"),
      ),
    },
  };
}

function publicPlayer(row: any) {
  return { id: String(row.id), displayName: String(row.display_name), photoUrl: row.photo_url || null, type: row.type, primaryPosition: row.primary_position, secondaryPosition: row.secondary_position ?? null };
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
    primaryPosition: row.primary_position, secondaryPosition: row.secondary_position ?? null, speed: Number(row.speed), skill: Number(row.skill),
    marking: Number(row.marking ?? 3), tacticalIntelligence:Number(row.tactical_intelligence??3), competitiveness:Number(row.competitiveness??3), goalkeeperPositioning: Number(row.goalkeeper_positioning ?? row.speed ?? 3),
    goalExit: Number(row.goal_exit ?? row.marking ?? 3), goalkeeperSafety:Number(row.goalkeeper_safety??3), goalkeeperLeadership:Number(row.goalkeeper_leadership??3), momentum: Number(row.momentum ?? 0),
    resultMomentum: Number(row.result_momentum ?? 0), votingMomentum: Number(row.voting_momentum ?? 0),
    photoUrl: row.photo_url, active: Boolean(row.active),
  };
}
