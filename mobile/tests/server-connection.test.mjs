import assert from "node:assert/strict";
import test from "node:test";
import { checkServerConnection } from "../src/server-connection.ts";

test("libera o aplicativo somente quando o healthcheck confirma o servidor", async () => {
  const fetcher = async url => {
    assert.equal(url, "https://pelada.example/api/health");
    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  assert.equal(await checkServerConnection("https://pelada.example/", fetcher), true);
});

test("bloqueia o aplicativo quando o servidor falha ou responde como indisponível", async () => {
  assert.equal(await checkServerConnection("", async () => new Response()), false);
  assert.equal(await checkServerConnection("https://pelada.example", async () => new Response(JSON.stringify({ status: "unhealthy" }), { status: 503 })), false);
  assert.equal(await checkServerConnection("https://pelada.example", async () => { throw new Error("offline"); }), false);
});
