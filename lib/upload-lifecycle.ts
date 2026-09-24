import { db } from "./database";
import { getRuntimeBindings } from "./runtime-bindings";

export type UploadOwner = { accountType: "administrator" | "member"; accountId: string };
export type UploadPurpose = "players" | "branding";
type UploadReference = { key: string; purpose: UploadPurpose; owner: UploadOwner; entityType: string; entityId: string };

const MEMBER_PENDING_LIMIT = 5;
const MEMBER_HOURLY_LIMIT = 20;
const ADMIN_PENDING_LIMIT = 15;
const ADMIN_HOURLY_LIMIT = 60;
const PENDING_TTL_MS = 60 * 60_000;
const METADATA_TTL_MS = 24 * 60 * 60_000;
const keyPattern = /^(players|branding)\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:ico|png|jpg|webp)$/i;

export function uploadUrl(key: string) {
  return `/api/upload?key=${encodeURIComponent(key)}`;
}

export function uploadKey(value: unknown, purpose?: UploadPurpose) {
  if (!value) return null;
  try {
    const url = new URL(String(value), "https://upload.local");
    if (url.origin !== "https://upload.local" || url.pathname !== "/api/upload" || [...url.searchParams.keys()].some(key => key !== "key")) return null;
    const key = url.searchParams.get("key") || "";
    const match = keyPattern.exec(key);
    if (!match || purpose && match[1].toLowerCase() !== purpose) return null;
    return key;
  } catch {
    return null;
  }
}

export async function cleanupExpiredUploads(limit = 20) {
  const now = new Date(), expired = new Date(now.getTime() - PENDING_TTL_MS).toISOString();
  const rows = await db().prepare(`SELECT object_key FROM upload_objects WHERE status IN ('uploading','pending') AND updated_at<? ORDER BY updated_at LIMIT ?`).bind(expired, limit).all<{ object_key: string }>();
  for (const row of rows.results) {
    try {
      await getRuntimeBindings().UPLOADS.delete(row.object_key);
      await db().prepare(`UPDATE upload_objects SET status='deleted',updated_at=? WHERE object_key=? AND status IN ('uploading','pending')`).bind(now.toISOString(), row.object_key).run();
    } catch (error) {
      console.error("Expired upload cleanup failed", error);
    }
  }
  await db().prepare(`DELETE FROM upload_objects WHERE status IN ('rejected','deleted') AND updated_at<?`).bind(new Date(now.getTime() - METADATA_TTL_MS).toISOString()).run();
}

export function uploadLimitsFor(owner: UploadOwner) {
  return owner.accountType === "administrator"
    ? { pending: ADMIN_PENDING_LIMIT, hourly: ADMIN_HOURLY_LIMIT }
    : { pending: MEMBER_PENDING_LIMIT, hourly: MEMBER_HOURLY_LIMIT };
}

export async function reserveUpload(key: string, purpose: UploadPurpose, owner: UploadOwner): Promise<
  { ok: true } | { ok: false; reason: "pending" | "hourly"; limit: number }
> {
  const now = new Date(), nowIso = now.toISOString(), hourAgo = new Date(now.getTime() - 60 * 60_000).toISOString();
  const limits = uploadLimitsFor(owner);
  const result = await db().prepare(`INSERT INTO upload_objects (object_key,purpose,owner_account_type,owner_account_id,status,created_at,updated_at)
    SELECT ?,?,?,?,'uploading',?,?
    WHERE (SELECT COUNT(*) FROM upload_objects WHERE owner_account_type=? AND owner_account_id=? AND status IN ('uploading','pending'))<?
      AND (SELECT COUNT(*) FROM upload_objects WHERE owner_account_type=? AND owner_account_id=? AND created_at>?)<?`)
    .bind(key, purpose, owner.accountType, owner.accountId, nowIso, nowIso, owner.accountType, owner.accountId, limits.pending, owner.accountType, owner.accountId, hourAgo, limits.hourly).run();
  if (Number(result.meta?.changes ?? 0) === 1) return { ok: true };

  const usage = await db().prepare(`SELECT
      SUM(CASE WHEN status IN ('uploading','pending') THEN 1 ELSE 0 END) pending,
      SUM(CASE WHEN created_at>? THEN 1 ELSE 0 END) hourly
    FROM upload_objects WHERE owner_account_type=? AND owner_account_id=?`)
    .bind(hourAgo, owner.accountType, owner.accountId).first<{ pending: number | null; hourly: number | null }>();
  if (Number(usage?.pending ?? 0) >= limits.pending) return { ok: false, reason: "pending", limit: limits.pending };
  return { ok: false, reason: "hourly", limit: limits.hourly };
}

export async function rejectUpload(key: string) {
  await db().prepare(`UPDATE upload_objects SET status='rejected',updated_at=? WHERE object_key=? AND status IN ('uploading','pending')`).bind(new Date().toISOString(), key).run();
}

export async function markUploadPending(reservationKey: string, objectKey: string, size: number, contentType: string) {
  await db().prepare(`UPDATE upload_objects SET object_key=?,size_bytes=?,content_type=?,status='pending',updated_at=? WHERE object_key=? AND status='uploading'`).bind(objectKey, size, contentType, new Date().toISOString(), reservationKey).run();
}

export async function validateUploadAttachment(value: unknown, purpose: UploadPurpose, owner: UploadOwner, entityType: string, entityId: string): Promise<{ reference?: UploadReference; error?: string }> {
  const key = uploadKey(value, purpose);
  if (!key) return { error: "A referência do upload é inválida." };
  const row = await db().prepare(`SELECT purpose,owner_account_type,owner_account_id,status,attached_entity_type,attached_entity_id,updated_at FROM upload_objects WHERE object_key=?`).bind(key).first<{ purpose: string; owner_account_type: string; owner_account_id: string; status: string; attached_entity_type?: string | null; attached_entity_id?: string | null; updated_at: string }>();
  if (!row) return { error: "O upload não existe ou foi criado antes do controle de anexos." };
  if (row.purpose !== purpose || row.owner_account_type !== owner.accountType || row.owner_account_id !== owner.accountId) return { error: "O upload pertence a outra conta ou finalidade." };
  if (row.status === "pending" && row.updated_at <= new Date(Date.now() - PENDING_TTL_MS).toISOString()) return { error: "O prazo para associar este upload expirou." };
  if (row.status !== "pending" && !(row.status === "attached" && row.attached_entity_type === entityType && row.attached_entity_id === entityId)) return { error: "O upload não está disponível para este registro." };
  return { reference: { key, purpose, owner, entityType, entityId } };
}

export async function finalizeUploadAttachment(reference: UploadReference | undefined, previousValue: unknown) {
  if (reference) {
    const now = new Date().toISOString();
    await db().prepare(`UPDATE upload_objects SET status='attached',attached_entity_type=?,attached_entity_id=?,attached_at=COALESCE(attached_at,?),updated_at=? WHERE object_key=? AND owner_account_type=? AND owner_account_id=?`)
      .bind(reference.entityType, reference.entityId, now, now, reference.key, reference.owner.accountType, reference.owner.accountId).run();
  }
  const previousKey = uploadKey(previousValue);
  if (!previousKey || previousKey === reference?.key) return;
  const stillReferenced = await db().prepare(`SELECT 1 found FROM players WHERE photo_url=?
    UNION ALL SELECT 1 FROM instance_configuration WHERE logo_url=? OR favicon_url=? OR share_image_url=? LIMIT 1`)
    .bind(String(previousValue), String(previousValue), String(previousValue), String(previousValue)).first("found");
  if (stillReferenced) return;
  const managed = await db().prepare(`SELECT object_key FROM upload_objects WHERE object_key=? AND status='attached'`).bind(previousKey).first();
  if (!managed) return;
  try {
    await getRuntimeBindings().UPLOADS.delete(previousKey);
    await db().prepare(`UPDATE upload_objects SET status='deleted',updated_at=? WHERE object_key=?`).bind(new Date().toISOString(), previousKey).run();
  } catch (error) {
    console.error("Managed upload cleanup failed", error);
  }
}
