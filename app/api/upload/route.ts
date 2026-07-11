import { env } from "cloudflare:workers";
import { adminRequired } from "../../../lib/database";

const MAX_FILE_SIZE = 5_000_000;

function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

export async function POST(request: Request) {
  if (!(await adminRequired(request))) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_FILE_SIZE) return Response.json({ error: "A foto deve ter no máximo 5 MB." }, { status: 413 });

  try {
    const buffer = await request.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > MAX_FILE_SIZE) return Response.json({ error: "A foto deve ter entre 1 byte e 5 MB." }, { status: 413 });
    const detected = detectImageType(new Uint8Array(buffer));
    if (!detected) return Response.json({ error: "O arquivo não é uma imagem PNG, JPEG ou WebP válida." }, { status: 400 });

    const key = `players/${crypto.randomUUID()}.${detected.extension}`;
    await (env.UPLOADS as R2Bucket).put(key, buffer, { httpMetadata: { contentType: detected.contentType } });
    return Response.json({ url: `/api/upload?key=${encodeURIComponent(key)}` });
  } catch (error) {
    console.error("Player photo upload failed", error);
    return Response.json({ error: "Não foi possível armazenar a foto. Tente novamente." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key?.startsWith("players/")) return new Response("Not found", { status: 404 });
  const object = await (env.UPLOADS as R2Bucket).get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "application/octet-stream", "cache-control": "public,max-age=86400" } });
}
