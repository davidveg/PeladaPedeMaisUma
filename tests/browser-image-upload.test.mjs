import assert from "node:assert/strict";
import test from "node:test";
import { uploadResponsePayload } from "../lib/browser-image-upload.ts";

test("upload interpreta a resposta JSON da API", async () => {
  const payload = await uploadResponsePayload(Response.json({ url: "/api/upload?key=branding%2Fsocial.webp" }));
  assert.equal(payload.url, "/api/upload?key=branding%2Fsocial.webp");
});

test("upload converte um 413 HTML do proxy em mensagem compreensível", async () => {
  const response = new Response("<html><h1>413 Request Entity Too Large</h1></html>", { status: 413, headers: { "content-type": "text/html" } });
  const payload = await uploadResponsePayload(response);
  assert.match(payload.error, /recusou a imagem por tamanho/i);
});

test("upload não expõe erro de JSON quando o proxy devolve outra página HTML", async () => {
  const response = new Response("<html><h1>Bad Gateway</h1></html>", { status: 502, headers: { "content-type": "text/html" } });
  const payload = await uploadResponsePayload(response);
  assert.match(payload.error, /interrompeu o upload/i);
});
