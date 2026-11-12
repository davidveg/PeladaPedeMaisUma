import { adminRequired, db, memberRequired } from "../../../lib/database";
import { detectImageType } from "../../../lib/image-upload";
import { BodyTooLargeError, readLimitedBody } from "../../../lib/limited-body";
import { getRuntimeBindings } from "../../../lib/runtime-bindings";
import { cleanupExpiredUploads, markUploadPending, rejectUpload, reserveUpload, uploadKey, uploadThumbnailKey, uploadUrl } from "../../../lib/upload-lifecycle";

const MAX_FILE_SIZE = 5_000_000;
const MAX_THUMBNAIL_SIZE = 250_000;

export async function POST(request: Request) {
  const purpose = request.headers.get("x-upload-purpose") === "branding" ? "branding" : "players";
  const administrator = await adminRequired(request);
  const member = purpose === "players" && !administrator ? await memberRequired(request) : null;
  const account = administrator || member;
  if (!account) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const thumbnailFor = request.headers.get("x-upload-thumbnail-for");
  if (thumbnailFor) return uploadThumbnail(request, thumbnailFor, administrator ? "administrator" : "member", String(account.id));
  const declaredHeader = request.headers.get("content-length"), declaredSize = declaredHeader === null ? 0 : Number(declaredHeader);
  if (!Number.isFinite(declaredSize) || declaredSize < 0) return Response.json({ error: "Content-Length inválido." }, { status: 400 });
  if (declaredSize > MAX_FILE_SIZE) return Response.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 413 });

  await cleanupExpiredUploads();
  const owner = { accountType: administrator ? "administrator" as const : "member" as const, accountId: String(account.id) };
  const uploadId = crypto.randomUUID(), reservationKey = `${purpose}/${uploadId}.pending`;
  const reservation = await reserveUpload(reservationKey, purpose, owner);
  if (!reservation.ok) {
    const error = reservation.reason === "pending"
      ? `Você atingiu o limite de ${reservation.limit} imagens ainda não salvas. Salve a configuração atual ou aguarde a limpeza automática antes de tentar novamente.`
      : `Você atingiu o limite de ${reservation.limit} uploads por hora. Aguarde antes de tentar novamente.`;
    return Response.json({ error, reason: reservation.reason, limit: reservation.limit }, { status: 429, headers: { "cache-control": "no-store", "retry-after": "3600" } });
  }

  let storedKey = reservationKey;
  try {
    const buffer = await readLimitedBody(request, MAX_FILE_SIZE);
    if (!buffer.byteLength) { await rejectUpload(reservationKey); return Response.json({ error: "A imagem deve ter entre 1 byte e 5 MB." }, { status: 400 }); }
    const detected = detectImageType(buffer);
    if (!detected) { await rejectUpload(reservationKey); return Response.json({ error: "O arquivo não é uma imagem ICO, PNG, JPEG ou WebP válida." }, { status: 400 }); }

    storedKey = `${purpose}/${uploadId}.${detected.extension}`;
    await markUploadPending(reservationKey, storedKey, buffer.byteLength, detected.contentType);
    await getRuntimeBindings().UPLOADS.put(storedKey, buffer, { httpMetadata: { contentType: detected.contentType } });
    return Response.json({ url: uploadUrl(storedKey) });
  } catch (error) {
    let cleaned = false;
    try { await getRuntimeBindings().UPLOADS.delete(storedKey); cleaned = true; } catch { /* A coleta de expirados tentará novamente. */ }
    if (cleaned) await rejectUpload(storedKey).catch(() => undefined);
    if (error instanceof BodyTooLargeError) return Response.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 413 });
    console.error("Image upload failed", error);
    return Response.json({ error: "Não foi possível armazenar a imagem. Tente novamente." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const key = parameters.get("key"), variant = parameters.get("variant");
  if (!key || (!key.startsWith("players/") && !key.startsWith("branding/"))) return new Response("Not found", { status: 404 });
  if (variant && variant !== "thumbnail") return new Response("Not found", { status: 404 });
  const thumbnail = variant === "thumbnail" && key.startsWith("players/")
    ? await getRuntimeBindings().UPLOADS.get(uploadThumbnailKey(key))
    : null;
  const object = thumbnail || await getRuntimeBindings().UPLOADS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "application/octet-stream", "cache-control": "public,max-age=86400", "x-player-photo-variant": thumbnail ? "thumbnail" : variant === "thumbnail" ? "original-fallback" : "original" } });
}

async function uploadThumbnail(request: Request, encodedOriginal: string, accountType: "administrator" | "member", accountId: string) {
  let originalUrl = encodedOriginal;
  try { originalUrl = decodeURIComponent(encodedOriginal); } catch { /* O valor pode já estar decodificado. */ }
  const key = uploadKey(originalUrl, "players");
  if (!key) return Response.json({ error: "A foto original da miniatura é inválida." }, { status: 400 });
  const original = await dbUploadOwner(key);
  if (!original || original.ownerAccountType !== accountType || original.ownerAccountId !== accountId || !["pending", "attached"].includes(original.status)) {
    return Response.json({ error: "A foto original não está disponível para esta conta." }, { status: 403 });
  }
  try {
    const buffer = await readLimitedBody(request, MAX_THUMBNAIL_SIZE);
    const detected = detectImageType(buffer);
    if (!buffer.byteLength || !detected || detected.extension === "ico") return Response.json({ error: "A miniatura deve ser uma imagem válida." }, { status: 400 });
    await getRuntimeBindings().UPLOADS.put(uploadThumbnailKey(key), buffer, { httpMetadata: { contentType: detected.contentType } });
    return Response.json({ url: `${uploadUrl(key)}&variant=thumbnail` });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return Response.json({ error: "A miniatura deve ter no máximo 250 KB." }, { status: 413 });
    console.error("Image thumbnail upload failed", error);
    return Response.json({ error: "Não foi possível armazenar a miniatura." }, { status: 500 });
  }
}

async function dbUploadOwner(key: string) {
  const row = await db().prepare(`SELECT owner_account_type,owner_account_id,status FROM upload_objects WHERE object_key=?`).bind(key).first<any>();
  return row ? { ownerAccountType: String(row.owner_account_type), ownerAccountId: String(row.owner_account_id), status: String(row.status) } : null;
}
