import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);

test("servidor Node self-hosted resolve o módulo opcional do runtime Cloudflare", async () => {
  const script = `
    globalThis.__PELADA_RUNTIME_BINDINGS__ = { DB: { adapter: "sqlite" } };
    const runtime = await import("cloudflare:workers");
    console.log(JSON.stringify({ tracing: runtime.tracing ?? null, adapter: runtime.env.DB.adapter }));
  `;
  const { stdout } = await execute(process.execPath, [
    "--import",
    new URL("../server/selfhost-register.mjs", import.meta.url).pathname,
    "--input-type=module",
    "--eval",
    script,
  ]);

  assert.deepEqual(JSON.parse(stdout.trim()), { tracing: null, adapter: "sqlite" });
});

test("imagem self-hosted registra a ponte antes de iniciar o servidor", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile.selfhost.omv", import.meta.url), "utf8");
  assert.match(dockerfile, /selfhost-cloudflare-loader\.mjs/);
  assert.match(dockerfile, /selfhost-register\.mjs/);
  assert.match(dockerfile, /CMD \["node", "--import", "\.\/selfhost-register\.mjs", "selfhost-server\.mjs"\]/);
});
