/* Database and Expo Push payloads are narrowed at their integration boundaries. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb } from "./database";
import { logEvent } from "./logger";

type AccountIdentity = { accountType: "administrator" | "member"; accountId: string };
type PushTokenRow = AccountIdentity & {
  id: string;
  expoPushToken: string;
  playerId: string | null;
};
type MatchRow = {
  id: string;
  separationId: string;
  matchTitle: string;
  snapshot: string;
  closesAt: string;
};
type PendingDelivery = { match: MatchRow; token: PushTokenRow };

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";

export async function notifyOpenCareerVote(careerMatchId: string) {
  await ensureDb();
  const match = await loadMatch(careerMatchId);
  if (!match) return { sent: 0 };
  const tokens = await loadTokens();
  return sendPending(tokens.flatMap(token => eligible(match, token) ? [{ match, token }] : []));
}

export async function notifyPendingCareerVotesForAccount(identity: AccountIdentity) {
  await ensureDb();
  const [tokens, matches] = await Promise.all([loadTokens(identity), loadOpenMatches()]);
  return sendPending(tokens.flatMap(token => matches.filter(match => eligible(match, token)).map(match => ({ match, token }))));
}

async function loadMatch(id: string): Promise<MatchRow | null> {
  const row: any = await db().prepare(
    `SELECT c.id,c.separation_id,c.closes_at,s.match_title,s.snapshot
     FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
     WHERE c.id=? AND c.status='OPEN' AND c.closes_at>? AND s.deleted_at IS NULL`,
  ).bind(id, new Date().toISOString()).first();
  return row ? mapMatch(row) : null;
}

async function loadOpenMatches(): Promise<MatchRow[]> {
  const rows = (await db().prepare(
    `SELECT c.id,c.separation_id,c.closes_at,s.match_title,s.snapshot
     FROM career_matches c JOIN team_separations s ON s.id=c.separation_id
     WHERE c.status='OPEN' AND c.closes_at>? AND s.deleted_at IS NULL`,
  ).bind(new Date().toISOString()).all()).results as any[];
  return rows.map(mapMatch);
}

async function loadTokens(identity?: AccountIdentity): Promise<PushTokenRow[]> {
  const clause = identity ? "AND t.account_type=? AND t.account_id=?" : "";
  const statement = db().prepare(
    `SELECT t.id,t.expo_push_token,l.player_id,t.account_type,t.account_id
     FROM mobile_push_tokens t
     LEFT JOIN player_account_links l ON l.account_type=t.account_type AND l.account_id=t.account_id
     WHERE t.active=1 ${clause}`,
  );
  const result = identity
    ? await statement.bind(identity.accountType, identity.accountId).all()
    : await statement.all();
  return (result.results as any[]).map(row => ({
    id: String(row.id),
    expoPushToken: String(row.expo_push_token),
    playerId: row.player_id ? String(row.player_id) : null,
    accountType: row.account_type === "administrator" ? "administrator" : "member",
    accountId: String(row.account_id),
  }));
}

function mapMatch(row: any): MatchRow {
  return {
    id: String(row.id),
    separationId: String(row.separation_id),
    matchTitle: String(row.match_title || "Pelada"),
    snapshot: String(row.snapshot || "{}"),
    closesAt: String(row.closes_at),
  };
}

function eligible(match: MatchRow, token: PushTokenRow) {
  if (!token.playerId) return false;
  try {
    const snapshot = JSON.parse(match.snapshot);
    return [...(snapshot.blue || []), ...(snapshot.yellow || [])].some((player: any) => String(player.id) === token.playerId);
  } catch {
    return false;
  }
}

async function sendPending(candidates: PendingDelivery[]) {
  const pending: (PendingDelivery & { deliveryId: string })[] = [];
  for (const candidate of candidates) {
    if (await hasVoted(candidate.match.id, candidate.token.playerId)) continue;
    const deliveryId = crypto.randomUUID(), now = new Date().toISOString();
    const existing: any = await db().prepare(
      `SELECT id,status FROM push_notification_deliveries WHERE career_match_id=? AND push_token_id=?`,
    ).bind(candidate.match.id, candidate.token.id).first();
    if (existing) {
      if (existing.status !== "FAILED") continue;
      const retry = await db().prepare(
        `UPDATE push_notification_deliveries SET status='PENDING',error=NULL,updated_at=? WHERE id=? AND status='FAILED'`,
      ).bind(now, existing.id).run();
      if (Number(retry.meta?.changes || 0) === 1) pending.push({ ...candidate, deliveryId: String(existing.id) });
      continue;
    }
    try {
      await db().prepare(
        `INSERT INTO push_notification_deliveries
         (id,career_match_id,push_token_id,status,created_at,updated_at)
         VALUES (?,?,?,'PENDING',?,?)`,
      ).bind(deliveryId, candidate.match.id, candidate.token.id, now, now).run();
      pending.push({ ...candidate, deliveryId });
    } catch (error: any) {
      if (!String(error?.message || error).toLowerCase().includes("unique")) throw error;
    }
  }

  for (let offset = 0; offset < pending.length; offset += 100) {
    const batch = pending.slice(offset, offset + 100);
    try {
      const response = await fetch(expoPushEndpoint, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(batch.map(item => ({
          to: item.token.expoPushToken,
          title: "Votação aberta",
          body: `Vote nos melhores e piores jogadores de ${item.match.matchTitle}.`,
          sound: "default",
          priority: "high",
          channelId: "career-votes",
          data: {
            type: "career_vote_open",
            separationId: item.match.separationId,
            careerMatchId: item.match.id,
          },
        }))),
        signal: AbortSignal.timeout(8_000),
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.errors?.[0]?.message || `Expo Push HTTP ${response.status}`);
      const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
      for (let index = 0; index < batch.length; index += 1) {
        const ticket = tickets[index] || {}, item = batch[index], now = new Date().toISOString();
        const error = ticket.status === "error" ? String(ticket.message || ticket.details?.error || "Falha no Expo Push") : null;
        await db().prepare(
          `UPDATE push_notification_deliveries SET status=?,ticket_id=?,error=?,updated_at=? WHERE id=?`,
        ).bind(error ? "FAILED" : "SENT", ticket.id || null, error, now, item.deliveryId).run();
        if (ticket.details?.error === "DeviceNotRegistered") {
          await db().prepare(`UPDATE mobile_push_tokens SET active=0,updated_at=? WHERE id=?`).bind(now, item.token.id).run();
        }
      }
    } catch (error: any) {
      const message = String(error?.message || error).slice(0, 500), now = new Date().toISOString();
      for (const item of batch) {
        await db().prepare(`UPDATE push_notification_deliveries SET status='FAILED',error=?,updated_at=? WHERE id=?`).bind(message, now, item.deliveryId).run();
      }
      logEvent("warn", "push_notification_failed", { count: batch.length, error: message });
    }
  }
  if (pending.length) logEvent("info", "career_vote_notifications_dispatched", { count: pending.length });
  return { sent: pending.length };
}

async function hasVoted(careerMatchId: string, playerId: string | null) {
  if (!playerId) return true;
  return Boolean(await db().prepare(
    `SELECT id FROM career_votes WHERE career_match_id=? AND voter_player_id=?`,
  ).bind(careerMatchId, playerId).first());
}
