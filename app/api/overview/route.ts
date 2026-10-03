import { db, ensureDb, playerAccountRequired } from "../../../lib/database";
import { defaultConfig, score } from "../../../lib/football";
import { instanceConfigurationFromRow } from "../../../lib/instance-config";
import type { OverviewBalance, OverviewHighlight, OverviewMatch, OverviewPayload } from "../../../lib/overview";
import { loadPlayerCareerStats } from "../../../lib/player-career-stats-store";
import { publicPlayer } from "../../../lib/public-player";
import { weatherSummaryFromRow } from "../../../lib/weather-presentation";

const headers = { "cache-control": "private, no-store", vary: "Cookie, Authorization" };

export async function GET(request: Request) {
  await ensureDb();
  const account: any = await playerAccountRequired(request);
  if (!account) return Response.json({ error: "Entre na sua conta para consultar a visão geral." }, { status: 401, headers });

  const now = new Date().toISOString(), year = now.slice(0, 4);
  const [instanceRow, systemRow, careerRow, playerRow, careerStats, activePlayerRows, yearMatchesRow, recentRows, awardRows] = await Promise.all([
    db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT * FROM system_configuration WHERE id=1`).first<any>(),
    db().prepare(`SELECT * FROM career_configuration WHERE id=1`).first<any>(),
    account.playerId ? db().prepare(`SELECT * FROM players WHERE id=? AND active=1 AND deleted_at IS NULL`).bind(account.playerId).first<any>() : null,
    loadPlayerCareerStats(),
    db().prepare(`SELECT id FROM players WHERE active=1 AND deleted_at IS NULL`).all<any>(),
    db().prepare(`SELECT COUNT(*) total FROM career_matches c JOIN team_separations s ON s.id=c.separation_id WHERE s.deleted_at IS NULL AND substr(COALESCE(s.match_date,c.created_at),1,4)=?`).bind(year).first<any>(),
    db().prepare(`SELECT s.id separation_id,s.match_title title,s.match_date match_at,s.location,s.snapshot,s.balance_classification,c.blue_score,c.yellow_score,c.status voting_status,m.id match_id,m.status match_status
      FROM team_separations s LEFT JOIN career_matches c ON c.separation_id=s.id LEFT JOIN scheduled_matches m ON m.separation_id=s.id
      WHERE s.deleted_at IS NULL ORDER BY COALESCE(s.match_date,s.confirmed_at) DESC,s.confirmed_at DESC LIMIT 3`).all<any>(),
    db().prepare(`SELECT snapshot FROM monthly_career_awards ORDER BY month DESC LIMIT 24`).all<any>(),
  ]);
  const instance = instanceConfigurationFromRow(instanceRow);
  const restrictedGuest = Boolean(instance.guestSelfConfirmationEnabled && playerRow?.type === "guest" && account.accountType !== "administrator" && account.role !== "moderator");
  const openBindings: (string | number)[] = [];
  const guestPredicate = restrictedGuest ? `AND m.guest_confirmation_opens_at IS NOT NULL AND m.guest_confirmation_opens_at<=?` : "";
  if (account.playerId) openBindings.push(account.playerId);
  if (restrictedGuest) openBindings.push(now);
  const viewerAttendance = account.playerId ? `(SELECT a.status FROM match_attendance a WHERE a.match_id=m.id AND a.player_id=? LIMIT 1)` : "NULL";
  const openRow = await db().prepare(`SELECT m.id match_id,m.separation_id,m.title,m.match_at,m.location,m.status,m.confirmation_deadline,m.weather_snapshot,
      (SELECT COUNT(*) FROM match_attendance a WHERE a.match_id=m.id AND a.status='PRESENT') present,
      (SELECT COUNT(*) FROM players p WHERE p.active=1 AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM match_attendance a WHERE a.match_id=m.id AND a.player_id=p.id)) pending,
      ${viewerAttendance} viewer_attendance_status,NULL blue_score,NULL yellow_score
    FROM scheduled_matches m WHERE m.status='OPEN' ${guestPredicate} ORDER BY m.match_at ASC LIMIT 1`).bind(...openBindings).first<any>();

  const config = {
    ...defaultConfig,
    speedWeight: Number(systemRow?.speed_weight ?? defaultConfig.speedWeight),
    skillWeight: Number(systemRow?.skill_weight ?? defaultConfig.skillWeight),
    markingWeight: Number(systemRow?.marking_weight ?? defaultConfig.markingWeight),
    tacticalIntelligenceWeight: Number(systemRow?.tactical_intelligence_weight ?? defaultConfig.tacticalIntelligenceWeight),
    competitivenessWeight: Number(systemRow?.competitiveness_weight ?? defaultConfig.competitivenessWeight),
    goalkeeperDefensesWeight: Number(systemRow?.goalkeeper_defenses_weight ?? defaultConfig.goalkeeperDefensesWeight),
    goalkeeperPositioningWeight: Number(systemRow?.goalkeeper_positioning_weight ?? defaultConfig.goalkeeperPositioningWeight),
    goalkeeperSafetyWeight: Number(systemRow?.goalkeeper_safety_weight ?? defaultConfig.goalkeeperSafetyWeight),
    goalkeeperFootworkWeight: Number(systemRow?.goalkeeper_footwork_weight ?? defaultConfig.goalkeeperFootworkWeight),
    goalkeeperLeadershipWeight: Number(systemRow?.goalkeeper_leadership_weight ?? defaultConfig.goalkeeperLeadershipWeight),
    resultMomentumMultiplier: Number(careerRow?.result_momentum_multiplier ?? 1),
    momentumMultiplier: Number(careerRow?.momentum_multiplier ?? 1),
  };
  const player = playerRow ? publicPlayer(playerRow) : null;
  const stats = player ? careerStats[player.id] : null;
  const playerPayload = player ? {
    id: player.id, displayName: player.displayName, photoUrl: player.photoUrl || null, type: player.type,
    primaryPosition: player.primaryPosition, secondaryPosition: player.secondaryPosition || null,
    overall: score(player, config), momentum: Number(player.momentum || 0), games: stats?.games || 0,
    wins: stats?.wins || 0, losses: stats?.losses || 0, goals: stats?.goals || 0, assists: stats?.assists || 0,
  } : null;

  const recentMatches = (recentRows.results || []).map((row: any) => separationMatch(row));
  const latestMatch = recentMatches[0] || null;
  const latestRow: any = recentRows.results?.[0];
  const balance = latestRow ? balanceFromRow(latestRow) : null;
  const activePlayerIds = new Set((activePlayerRows.results || []).map((row: any) => String(row.id)));
  const highlight = (awardRows.results || []).map((row: any) => highlightFromSnapshot(row.snapshot)).find((entry: OverviewHighlight | null) => entry && activePlayerIds.has(entry.player.id)) || null;
  const participantCounts = (recentRows.results || []).map((row: any) => {
    const snapshot = parseJson(row.snapshot, {});
    return new Set([...(snapshot.blue || []), ...(snapshot.yellow || [])].map((entry: any) => String(entry.id))).size;
  }).filter(Boolean);
  const permissions = Array.isArray(account.permissions) ? account.permissions : [];
  const payload: OverviewPayload = {
    player: playerPayload,
    openMatch: openRow ? scheduledMatch(openRow) : null,
    latestMatch,
    recentMatches,
    balance,
    highlight,
    summary: {
      matchesThisYear: Number(yearMatchesRow?.total || 0),
      activePlayers: activePlayerIds.size,
      averageAttendance: participantCounts.length ? Math.round(participantCounts.reduce((sum: number, value: number) => sum + value, 0) / participantCounts.length * 10) / 10 : null,
    },
    viewer: { canManageMatches: account.accountType === "administrator" || permissions.includes("*") || permissions.includes("MATCHES_MANAGE") },
  };
  return Response.json(payload, { headers });
}

function scheduledMatch(row: any): OverviewMatch {
  return {
    id: String(row.match_id), separationId: row.separation_id ? String(row.separation_id) : null,
    title: String(row.title), matchAt: row.match_at ? String(row.match_at) : null, location: row.location ? String(row.location) : null,
    status: "OPEN", confirmationDeadline: row.confirmation_deadline ? String(row.confirmation_deadline) : null,
    present: Number(row.present || 0), pending: Number(row.pending || 0), viewerAttendanceStatus: row.viewer_attendance_status || null,
    blueScore: null, yellowScore: null, weather: weatherSummaryFromRow({ weather_snapshot: row.weather_snapshot }),
  };
}

function separationMatch(row: any): OverviewMatch {
  const finished = row.blue_score !== null && row.blue_score !== undefined;
  return {
    id: row.match_id ? String(row.match_id) : String(row.separation_id), separationId: String(row.separation_id), title: String(row.title),
    matchAt: row.match_at ? String(row.match_at) : null, location: row.location ? String(row.location) : null,
    status: finished ? "FINISHED" : "TEAMS", confirmationDeadline: null, present: null, pending: null, viewerAttendanceStatus: null,
    blueScore: finished ? Number(row.blue_score) : null, yellowScore: finished ? Number(row.yellow_score) : null, weather: null,
  };
}

function balanceFromRow(row: any): OverviewBalance {
  const snapshot = parseJson(row.snapshot, {}), blue = snapshot.blueBaseMetrics || snapshot.blueMetrics, yellow = snapshot.yellowBaseMetrics || snapshot.yellowMetrics;
  const blueAverage = finite(blue?.scoreAvg), yellowAverage = finite(yellow?.scoreAvg);
  const difference = blueAverage !== null && yellowAverage !== null ? Math.round(Math.abs(blueAverage - yellowAverage) * 100) / 100 : null;
  const midpoint = blueAverage !== null && yellowAverage !== null ? (Math.abs(blueAverage) + Math.abs(yellowAverage)) / 2 : 0;
  const balancePercent = difference !== null && midpoint ? Math.max(0, Math.round((100 - difference / midpoint * 100) * 10) / 10) : null;
  const positionExcess = finite(snapshot.delta?.positionExcess ?? snapshot.delta?.positions);
  const metrics = [
    balanceMetric("players", "Jogadores", blue?.count, yellow?.count, snapshot.delta),
    balanceMetric("defenders", "Defensores", blue?.positions?.Defesa, yellow?.positions?.Defesa, snapshot.delta),
    balanceMetric("midfielders", "Meio-campistas", blue?.positions?.["Meio-campo"], yellow?.positions?.["Meio-campo"], snapshot.delta),
    balanceMetric("attackers", "Atacantes", blue?.positions?.Ataque, yellow?.positions?.Ataque, snapshot.delta),
    balanceMetric("defensiveMidfielders", "Meias defensivos", blue?.midfieldProfiles?.defensive, yellow?.midfieldProfiles?.defensive, snapshot.delta),
    balanceMetric("centralMidfielders", "Meias centrais", blue?.midfieldProfiles?.central, yellow?.midfieldProfiles?.central, snapshot.delta),
    balanceMetric("offensiveMidfielders", "Meias ofensivos", blue?.midfieldProfiles?.offensive, yellow?.midfieldProfiles?.offensive, snapshot.delta),
    balanceMetric("speed", "Físico / Posicionamento", blue?.speed, yellow?.speed, snapshot.delta),
    balanceMetric("skill", "Técnica / Defesas", blue?.skill, yellow?.skill, snapshot.delta),
    balanceMetric("marking", "Marcação / Pés", blue?.marking, yellow?.marking, snapshot.delta),
    balanceMetric("tacticalIntelligence", "Tática / Segurança", blue?.tacticalIntelligence, yellow?.tacticalIntelligence, snapshot.delta),
    balanceMetric("competitiveness", "Competitividade / Liderança", blue?.competitiveness, yellow?.competitiveness, snapshot.delta),
    balanceMetric("momentum", "Momentum", blue?.momentum, yellow?.momentum, snapshot.delta),
    balanceMetric("historicalLearning", "Histórico observado", blue?.historicalLearning, yellow?.historicalLearning, snapshot.delta),
    balanceMetric("score", "Pontuação", blue?.total, yellow?.total, snapshot.delta),
  ];
  return { separationId: String(row.separation_id), title: String(row.title), date: row.match_at ? String(row.match_at) : null,
    classification: String(row.balance_classification || snapshot.rating || "Equilíbrio calculado"), blueAverage, yellowAverage, difference, balancePercent,
    positionPercent: positionExcess === null ? null : Math.max(0, Math.round(100 - positionExcess * 20)), metrics };
}

function balanceMetric(key: string, label: string, blueValue: unknown, yellowValue: unknown, delta: any): OverviewBalance["metrics"][number] {
  const blue = finite(blueValue) ?? 0, yellow = finite(yellowValue) ?? 0;
  const difference = Math.abs(blue - yellow), midpoint = (Math.abs(blue) + Math.abs(yellow)) / 2;
  const differencePercent = midpoint ? Math.min(100, difference / midpoint * 100) : 0;
  const advantage = delta?.advantage?.[key] === "BLUE" || delta?.advantage?.[key] === "YELLOW" ? delta.advantage[key] : difference === 0 ? "EVEN" : blue > yellow ? "BLUE" : "YELLOW";
  return { key, label, difference: round(difference, key === "players" || key.endsWith("ers") || key.includes("Midfielders") ? 0 : 2),
    differencePercent: round(differencePercent, 1), balancePercent: round(Math.max(0, 100 - differencePercent), 1), advantage };
}

function highlightFromSnapshot(value: unknown): OverviewHighlight | null {
  const award = parseJson(value, null), standing = award?.playerOfMonth;
  if (!award?.month || !standing?.player?.id) return null;
  return { month: String(award.month), player: { id: String(standing.player.id), displayName: String(standing.player.displayName || "Jogador"),
    photoUrl: standing.player.photoUrl ? String(standing.player.photoUrl) : null, primaryPosition: standing.player.primaryPosition ? String(standing.player.primaryPosition) : null },
    totalMomentum: Number(standing.totalMomentum || 0), games: Number(standing.games || 0) };
}

function parseJson(value: unknown, fallback: any) { try { return value ? JSON.parse(String(value)) : fallback; } catch { return fallback; } }
function finite(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function round(value: number, digits: number) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
