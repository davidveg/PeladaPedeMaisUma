import { adminRequired, memberRequired } from "../../../lib/database";
import { detectImageType } from "../../../lib/image-upload";
import { BodyTooLargeError, readLimitedBody } from "../../../lib/limited-body";
import { getRuntimeBindings } from "../../../lib/runtime-bindings";
import { cleanupExpiredUploads, markUploadPending, rejectUpload, reserveUpload, uploadUrl } from "../../../lib/upload-lifecycle";

const MAX_FILE_SIZE = 5_000_000;

export async function POST(request: Request) {
  const purpose = request.headers.get("x-upload-purpose") === "branding" ? "branding" : "players";
  const administrator = await adminRequired(request);
  const member = purpose === "players" && !administrator ? await memberRequired(request) : null;
  const account = administrator || member;
  if (!account) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
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
  const key = new URL(request.url).searchParams.get("key");
  if (!key || (!key.startsWith("players/") && !key.startsWith("branding/"))) return new Response("Not found", { status: 404 });
  const object = await getRuntimeBindings().UPLOADS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "application/octet-stream", "cache-control": "public,max-age=86400" } });
}
