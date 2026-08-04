import { adminRequired, memberRequired } from "../../../lib/database";
import { detectImageType } from "../../../lib/image-upload";
import { getRuntimeBindings } from "../../../lib/runtime-bindings";

const MAX_FILE_SIZE = 5_000_000;

export async function POST(request: Request) {
  const purpose = request.headers.get("x-upload-purpose") === "branding" ? "branding" : "players";
  const administrator = await adminRequired(request);
  if (purpose === "branding" ? !administrator : !administrator && !(await memberRequired(request))) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_FILE_SIZE) return Response.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 413 });

  try {
    const buffer = await request.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > MAX_FILE_SIZE) return Response.json({ error: "A imagem deve ter entre 1 byte e 5 MB." }, { status: 413 });
    const detected = detectImageType(new Uint8Array(buffer));
    if (!detected) return Response.json({ error: "O arquivo não é uma imagem ICO, PNG, JPEG ou WebP válida." }, { status: 400 });

    const key = `${purpose}/${crypto.randomUUID()}.${detected.extension}`;
    await getRuntimeBindings().UPLOADS.put(key, buffer, { httpMetadata: { contentType: detected.contentType } });
    return Response.json({ url: `/api/upload?key=${encodeURIComponent(key)}` });
  } catch (error) {
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
