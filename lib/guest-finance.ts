/* Automatic guest attendance charges. Monetary values are stored as integer cents. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { audit, db } from "./database";

const FINANCIAL_SCOPE = "instance:1";
export const AUTOMATIC_GUEST_CHARGE_ORIGIN = "AUTO_GUEST_ATTENDANCE";

type GuestChargeConfiguration = {
  financeEnabled: boolean;
  automaticGuestChargeEnabled: boolean;
  automaticGuestChargeAmountCents: number;
  timezone: string;
};

function dateInTimeZone(value: string, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function competenceIsClosed(competence: string) {
  return Boolean(await db().prepare(
    `SELECT id FROM financial_monthly_closures WHERE scope_id=? AND competence=?`,
  ).bind(FINANCIAL_SCOPE, competence).first());
}

export async function syncAutomaticGuestCharge(params: {
  match: any;
  player: any;
  status: "PRESENT" | "ABSENT";
  configuration: GuestChargeConfiguration;
  actorId?: string | null;
}) {
  const { match, player, status, configuration, actorId = null } = params;
  if (String(player.type) !== "guest") return { changed: false };
  const existing: any = await db().prepare(
    `SELECT c.*,EXISTS(SELECT 1 FROM financial_payments p WHERE p.charge_id=c.id AND p.status='COMPLETED') has_payment
     FROM financial_charges c
     WHERE c.scope_id=? AND c.match_id=? AND c.player_id=? AND c.type='SINGLE_MATCH' AND c.origin=?`,
  ).bind(FINANCIAL_SCOPE, match.id, player.id, AUTOMATIC_GUEST_CHARGE_ORIGIN).first();

  if (status === "ABSENT") {
    if (!existing || existing.status !== "PENDING" || existing.has_payment || await competenceIsClosed(existing.competence)) return { changed: false };
    const now = new Date().toISOString();
    await db().prepare(
      `UPDATE financial_charges SET status='CANCELLED',cancelled_at=?,cancelled_by_administrator_id=?,cancellation_reason=?,updated_at=?
       WHERE id=? AND status='PENDING' AND NOT EXISTS(SELECT 1 FROM financial_payments p WHERE p.charge_id=financial_charges.id AND p.status='COMPLETED')`,
    ).bind(now, match.created_by_administrator_id, "Presença do convidado removida", now, existing.id).run();
    await audit(actorId, "AUTOMATIC_GUEST_CHARGE_CANCELLED", "financial_charge", existing.id, {
      status: "CANCELLED", matchId: match.id, playerId: player.id, source: AUTOMATIC_GUEST_CHARGE_ORIGIN,
    }, { status: existing.status });
    return { changed: true, action: "cancelled", chargeId: existing.id };
  }

  if (!configuration.financeEnabled || !configuration.automaticGuestChargeEnabled || configuration.automaticGuestChargeAmountCents <= 0) return { changed: false };
  const dueDate = dateInTimeZone(match.match_at, configuration.timezone), competence = dueDate.slice(0, 7);
  if (await competenceIsClosed(competence)) return { changed: false, reason: "closed_competence" };
  const amountCents = Number(configuration.automaticGuestChargeAmountCents), now = new Date().toISOString();
  if (existing) {
    if (existing.status !== "CANCELLED" || existing.has_payment) return { changed: false };
    await db().prepare(
      `UPDATE financial_charges SET status='PENDING',description=?,amount_cents=?,competence=?,due_date=?,cancelled_at=NULL,cancelled_by_administrator_id=NULL,cancellation_reason=NULL,updated_at=? WHERE id=? AND status='CANCELLED'`,
    ).bind(`Participação — ${match.title}`, amountCents, competence, dueDate, now, existing.id).run();
    await audit(actorId, "AUTOMATIC_GUEST_CHARGE_REACTIVATED", "financial_charge", existing.id, {
      status: "PENDING", amountCents, competence, dueDate, matchId: match.id, playerId: player.id, source: AUTOMATIC_GUEST_CHARGE_ORIGIN,
    }, { status: existing.status, amountCents: Number(existing.amount_cents) });
    return { changed: true, action: "reactivated", chargeId: existing.id };
  }

  const id = crypto.randomUUID();
  try {
    await db().prepare(
      `INSERT INTO financial_charges
       (id,scope_id,player_id,match_id,type,origin,description,category,amount_cents,competence,due_date,status,created_by_administrator_id,created_at,updated_at)
       VALUES (?,?,?,?,? ,?,?,?,?,?,?,'PENDING',?,?,?)`,
    ).bind(id, FINANCIAL_SCOPE, player.id, match.id, "SINGLE_MATCH", AUTOMATIC_GUEST_CHARGE_ORIGIN, `Participação — ${match.title}`, "SINGLE_MATCH", amountCents, competence, dueDate, match.created_by_administrator_id, now, now).run();
  } catch (error: any) {
    if (/unique|constraint/i.test(String(error?.message || error))) return { changed: false };
    throw error;
  }
  await audit(actorId, "AUTOMATIC_GUEST_CHARGE_CREATED", "financial_charge", id, {
    status: "PENDING", amountCents, competence, dueDate, matchId: match.id, playerId: player.id, source: AUTOMATIC_GUEST_CHARGE_ORIGIN,
  });
  return { changed: true, action: "created", chargeId: id };
}

export async function cancelAutomaticGuestChargesForMatch(match: any, actorId: string | null) {
  const charges = await db().prepare(
    `SELECT c.*,EXISTS(SELECT 1 FROM financial_payments p WHERE p.charge_id=c.id AND p.status='COMPLETED') has_payment,
            EXISTS(SELECT 1 FROM financial_monthly_closures mc WHERE mc.scope_id=c.scope_id AND mc.competence=c.competence) closed_competence
     FROM financial_charges c WHERE c.scope_id=? AND c.match_id=? AND c.type='SINGLE_MATCH' AND c.origin=?`,
  ).bind(FINANCIAL_SCOPE, match.id, AUTOMATIC_GUEST_CHARGE_ORIGIN).all();
  let cancelled = 0;
  for (const charge of charges.results as any[]) {
    if (charge.status !== "PENDING" || charge.has_payment || charge.closed_competence) continue;
    const now = new Date().toISOString();
    await db().prepare(
      `UPDATE financial_charges SET status='CANCELLED',cancelled_at=?,cancelled_by_administrator_id=?,cancellation_reason=?,updated_at=? WHERE id=? AND status='PENDING'`,
    ).bind(now, match.created_by_administrator_id, "Partida cancelada", now, charge.id).run();
    await audit(actorId, "AUTOMATIC_GUEST_CHARGE_CANCELLED", "financial_charge", String(charge.id), {
      status: "CANCELLED", matchId: match.id, playerId: charge.player_id, source: AUTOMATIC_GUEST_CHARGE_ORIGIN, reason: "match_cancelled",
    }, { status: charge.status });
    cancelled++;
  }
  return { cancelled };
}

export async function reconcileAutomaticGuestCharges(configuration: GuestChargeConfiguration, actorId: string | null) {
  if (!configuration.financeEnabled || !configuration.automaticGuestChargeEnabled || configuration.automaticGuestChargeAmountCents <= 0) {
    return { eligible: 0, created: 0, skippedClosedCompetence: 0 };
  }
  const rows = await db().prepare(
    `SELECT m.*,p.id player_id,p.display_name player_name,p.type player_type
     FROM scheduled_matches m
     JOIN match_attendance attendance ON attendance.match_id=m.id AND attendance.status='PRESENT'
     JOIN players p ON p.id=attendance.player_id AND p.type='guest' AND p.active=1 AND p.deleted_at IS NULL
     LEFT JOIN financial_charges charge
       ON charge.scope_id=? AND charge.match_id=m.id AND charge.player_id=p.id
      AND charge.type='SINGLE_MATCH' AND charge.origin=?
     WHERE m.status='OPEN' AND m.match_at>=? AND charge.id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM career_matches confirmed_result
         WHERE confirmed_result.separation_id=m.separation_id
       )
     ORDER BY m.match_at,p.display_name`,
  ).bind(FINANCIAL_SCOPE, AUTOMATIC_GUEST_CHARGE_ORIGIN, new Date().toISOString()).all();
  let created = 0, skippedClosedCompetence = 0;
  for (const row of rows.results as any[]) {
    const result = await syncAutomaticGuestCharge({
      match: row,
      player: { id: row.player_id, display_name: row.player_name, type: row.player_type },
      status: "PRESENT",
      configuration,
      actorId,
    });
    if (result.action === "created") created++;
    else if (result.reason === "closed_competence") skippedClosedCompetence++;
  }
  return { eligible: rows.results.length, created, skippedClosedCompetence };
}
