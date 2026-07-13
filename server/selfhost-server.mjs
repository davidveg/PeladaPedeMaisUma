import { join, resolve } from "node:path";
import { startProdServer } from "vinext/server/prod-server";
import { createSelfhostBindings } from "./selfhost-runtime.mjs";

const dataDirectory = resolve(process.env.DATA_DIR ?? "/data");
const bindings = await createSelfhostBindings(dataDirectory);

globalThis.__PELADA_RUNTIME_BINDINGS__ = bindings;

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

console.log(`[selfhost] Dados persistentes: ${dataDirectory}`);
console.log(`[selfhost] Servidor: http://${host}:${port}`);

startProdServer({
  port,
  host,
  outDir: join(import.meta.dirname, "dist"),
}).catch((error) => {
  console.error("[selfhost] Não foi possível iniciar o servidor.");
  console.error(error);
  bindings.DB.close();
  process.exit(1);
});
