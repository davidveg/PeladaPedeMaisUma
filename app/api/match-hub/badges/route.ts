import { db, playerAccountRequired } from "../../../../lib/database";
import { instanceConfigurationFromRow } from "../../../../lib/instance-config";

/** Counts only: the tab bar must not download full match/separation snapshots. */
export async function GET(request: Request) {
  const account = await playerAccountRequired(request) as { playerId?: string; accountType?: string; role?: string } | null;
  const headers = { "cache-control": "private, no-store", vary: "Cookie, Authorization" };
  if (!account) return Response.json({ error: "Não autorizado." }, { status: 401, headers });
  if (!account.playerId) return Response.json({ attendance: 0, votes: 0 }, { headers });
  const now = new Date().toISOString(), playerId = account.playerId;
  const [viewerPlayer, instanceRow] = await Promise.all([
    db().prepare(`SELECT type FROM players WHERE id=? AND active=1 AND deleted_at IS NULL`).bind(playerId).first<{ type: string }>(),
    db().prepare(`SELECT * FROM instance_configuration WHERE id=1`).first(),
  ]);
  const instance = instanceConfigurationFromRow(instanceRow as any);
  const restrictedGuest = instance.guestSelfConfirmationEnabled && viewerPlayer?.type === "guest" && account.accountType !== "administrator" && account.role !== "moderator";
  const guestMatchFilter = restrictedGuest
    ? instance.guestSelfConfirmationEnabled ? "AND m.guest_confirmation_opens_at IS NOT NULL AND m.guest_confirmation_opens_at<=?" : "AND 0=1"
    : "";
  const attendanceBindings = restrictedGuest && instance.guestSelfConfirmationEnabled ? [now, now, playerId] : [now, playerId];
  const [attendance, votes] = await Promise.all([
    db().prepare(`SELECT COUNT(*) total FROM scheduled_matches m
      WHERE m.status='OPEN' AND m.confirmation_deadline>=?
      ${guestMatchFilter}
      AND NOT EXISTS(SELECT 1 FROM match_attendance a WHERE a.match_id=m.id AND a.player_id=?)`).bind(...attendanceBindings).first<{ total: number }>(),
    db().prepare(`SELECT COUNT(*) total,MIN(s.id) nextVoteSeparationId FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
      WHERE s.deleted_at IS NULL AND c.status='OPEN' AND c.closes_at>?
      AND NOT EXISTS(SELECT 1 FROM career_votes v WHERE v.career_match_id=c.id AND v.voter_player_id=?)
      AND (EXISTS(SELECT 1 FROM json_each(COALESCE(c.participation_snapshot,s.snapshot),'$.blue') p WHERE json_extract(p.value,'$.id')=?)
        OR EXISTS(SELECT 1 FROM json_each(COALESCE(c.participation_snapshot,s.snapshot),'$.yellow') p WHERE json_extract(p.value,'$.id')=?))`).bind(now, playerId, playerId, playerId).first<{ total: number; nextVoteSeparationId: string | null }>(),
  ]);
  return Response.json({ attendance: Number(attendance?.total || 0), votes: Number(votes?.total || 0), nextVoteSeparationId: votes?.nextVoteSeparationId || null }, { headers });
}
